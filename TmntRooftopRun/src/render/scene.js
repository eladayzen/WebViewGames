// The 2.5D picture: a real 3D camera looking at the run from the side, a 3D
// turtle, and a world built from FLAT PAINTED SPRITES set at different depths.
// Because the camera is a true perspective camera, the depth does the parallax
// by itself, and moving the camera nearer/farther (the DOLLY) zooms the play
// in and out without anything else changing.
//
// THE TARGET is art/concept.png (Elad's pick, "v2"): a golden-dusk Manhattan
// with a dense layered skyline, a sun glow, hazy mid-distance buildings with
// billboards and water towers, and big chunky rooftops in the foreground.
//
// LAYERS (z = depth, the play lane is z = 0), back to front:
//   sky        gradient + sun glow (screen-fixed), clouds at z -520
//   skyline    z -380 (palest) and z -240 (warmer, more detail); bridge z -300
//   mid        z -120 and z -55: individual painted buildings, each with a
//              water tower, billboard or roof props on top
//   play       z    0: the rooftops he runs on -- facade front, tan roof top,
//              cornice, door huts / water towers / props along the back edge
// Every layer is individual sprites placed by a deterministic hash per slot
// (never a looping strip), so nothing repeats in step and nothing is stored.
// Fog does the aerial perspective; a CSS light grade (#grade) fuses it all.
import * as THREE from 'three';
import { CAMERA, ENEMY, HAZARD } from '../game/constants.js';
import { airTime } from '../game/world.js';
import { Turtle } from './turtle.js';

const URL_OF = import.meta.glob('../assets/*.webp', { eager: true, query: '?url', import: 'default' });
const url = (n) => URL_OF[`../assets/${n}.webp`];

// sampled from the concept: warm apricot overhead, gold at the horizon
const SKY = [[0, '#e9925a'], [0.35, '#f2a967'], [0.7, '#f8c785'], [1, '#fbdca6']];
const FOG = 0xf6c88e;

function hash(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

export function createScene(canvas, world, runner) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 50, 460);
  {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
    for (const [k, col] of SKY) gr.addColorStop(k, col);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }
  const camera = new THREE.PerspectiveCamera(CAMERA.FOV, 16 / 9, 0.5, 1500);
  scene.add(camera);

  // light: warm low sun from the front-left, a warm fill, a hot rim from behind
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x8a6a5a, 2.3));
  const sun = new THREE.DirectionalLight(0xffd29a, 2.8); sun.position.set(-5, 6, 12); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffa860, 3.2); rim.position.set(9, 4, -10); scene.add(rim);

  // ---------------------------------------------------------------- textures
  const loader = new THREE.TextureLoader();
  const tex = {}, ASPECT = {};
  // What the art really looks like at its edges, read once from the pixels:
  //   ROOF[name]  the roof line of a building sprite across its width (0..1 of its height), so
  //               a water tower or billboard is set ON the roof, not at a guessed height;
  //   HAZE        the colour of the skyline's bottom edge, which the city fill below continues.
  const ROOF = {}, HAZE = { r: 232, g: 185, b: 145 };
  function analyse(n, img) {
    if (!['bldA', 'bldB', 'skyline', 'skyline2', 'skyline3'].includes(n)) return;
    const W = 96, H = Math.max(8, Math.round((96 * img.height) / img.width));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    if (n.startsWith('bld')) {
      const prof = [];
      for (let x = 0; x < W; x++) {
        let row = H - 1; for (let y = 0; y < H; y++) if (d[(y * W + x) * 4 + 3] > 140) { row = y; break; }
        prof.push(1 - row / H);
      }
      ROOF[n] = prof;
    } else {                                           // skyline: average colour of its lowest opaque rows
      let r = 0, gg = 0, b = 0, k = 0;
      for (let y = H - 10; y < H - 2; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; k++; } }
      if (k > 20) { HAZE.r = r / k; HAZE.g = gg / k; HAZE.b = b / k; fillTop = true; }
    }
  }
  let fillTop = false;
  const NAMES = ['skyline', 'skyline2', 'skyline3', 'bridge', 'cloud1', 'cloud2', 'bldA', 'bldB',
    'tower', 'props', 'billboard', 'hut', 'foot', 'pizza', 'cornice', 'facade'];
  for (const n of NAMES) {
    ASPECT[n] = 1;
    const t = loader.load(url(n), (tt) => { ASPECT[n] = tt.image.width / tt.image.height; analyse(n, tt.image); });
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    tex[n] = t;
  }
  tex.facade.wrapS = tex.facade.wrapT = THREE.RepeatWrapping;
  tex.cornice.wrapS = THREE.RepeatWrapping;

  const spriteMat = (t, opts = {}) => new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.03, depthWrite: true, fog: true, ...opts });
  const unitPlane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);       // origin at bottom centre

  /** A pool of bottom-anchored sprite meshes; reset each frame, take as needed. */
  function pool(mat, parent = scene) {
    const items = []; let used = 0;
    return {
      mat,
      begin() { used = 0; },
      take() {
        if (used === items.length) { const m = new THREE.Mesh(unitPlane, mat); parent.add(m); items.push(m); }
        const m = items[used++]; m.visible = true; return m;
      },
      end() { for (let i = used; i < items.length; i++) items[i].visible = false; },
    };
  }
  /** Place a bottom-centred sprite: x, bottom y, z, height (width from the art). */
  function put(p, name, x, y, z, h, flip = false) {
    const m = p.take(); m.position.set(x, y, z); m.scale.set(h * ASPECT[name] * (flip ? -1 : 1), h, 1); return m;
  }

  // ---------------------------------------------------------------- sky
  // The sun glow: a big soft additive disc low over the skyline, riding with
  // the camera (it is "at infinity"), just right of centre as in the concept.
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,246,214,0.95)'); gr.addColorStop(0.18, 'rgba(255,226,160,0.6)');
    gr.addColorStop(0.5, 'rgba(255,196,120,0.18)'); gr.addColorStop(1, 'rgba(255,180,110,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
  glow.renderOrder = -10;
  camera.add(glow);

  // ---------------------------------------------------------------- distant layers
  // name pools are per layer so each layer can carry its own haze tint
  const LAYERS = [
    { id: 1, z: -520, kind: 'cloud', slot: 130, tint: 0xffffff },
    { id: 2, z: -380, kind: 'sky', slot: 120, h: [100, 140], base: -45, tint: 0xf7dcc4, noFog: true },
    { id: 3, z: -300, kind: 'bridge', slot: 700, h: [38, 38], base: -14, tint: 0xf2d2b6, noFog: true },
    { id: 4, z: -240, kind: 'sky', slot: 110, h: [70, 95], base: -32, tint: 0xffffff, noFog: true },
    // mid buildings sit BELOW the skyline band, as in the concept: their roofs
    // land around the play roof line, so the skyline stays the horizon
    { id: 5, z: -120, kind: 'bld', slot: 25, h: [26, 36], base: -30, tint: 0xf3d3b8 },
    { id: 7, z: -85, kind: 'bld', slot: 24, h: [22, 31], base: -27, tint: 0xeccaa9 },
    { id: 6, z: -55, kind: 'bld', slot: 21, h: [18, 26], base: -24, tint: 0xe6b894 },
  ];
  for (const L of LAYERS) {
    const mk = (n, o) => pool(spriteMat(tex[n], { color: L.tint, depthWrite: L.kind === 'bld', fog: !L.noFog, ...o }));
    L.p = {};
    if (L.kind === 'cloud') { L.p.cloud1 = mk('cloud1', { fog: false }); L.p.cloud2 = mk('cloud2', { fog: false }); }
    if (L.kind === 'sky') for (const n of ['skyline', 'skyline2', 'skyline3']) L.p[n] = mk(n);
    if (L.kind === 'bridge') L.p.bridge = mk('bridge');
    if (L.kind === 'bld') for (const n of ['bldA', 'bldB', 'tower', 'billboard', 'props', 'hut']) L.p[n] = mk(n);
  }

  /** World x range visible at depth z for the current camera. */
  function visibleX(z, margin = 1.2) {
    const d = camera.position.z - z;
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d * camera.aspect * margin;
    return [camera.position.x - half, camera.position.x + half];
  }

  const roofAtArt = (n, fx, flip, dflt) => {            // fx: -0.5..0.5 across the sprite, flip: mirrored
    const p = ROOF[n]; if (!p) return dflt;
    let u = fx + 0.5; if (flip) u = 1 - u;
    const i = Math.min(p.length - 1, Math.max(0, Math.floor(u * p.length)));
    let lo = p[i]; for (let k = Math.max(0, i - 2); k <= Math.min(p.length - 1, i + 2); k++) lo = Math.min(lo, p[k]);   // the lowest nearby: never float
    return lo;
  };

  // THE CITY FILL: below the skyline's hard bottom edge the sky used to show through between
  // the mid buildings as flat pale yellow. This continues the skyline's own haze colour down
  // and deepens it, so a gap reads as a canyon between buildings.
  const fillTex = canvasTex2(4, 256);
  function canvasTex2(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  let fillPainted = false;
  function paintFill() {
    const g = fillTex.image.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    const t = LAYERS[1].tint, tr = ((t >> 16) & 255) / 255, tg = ((t >> 8) & 255) / 255, tb = (t & 255) / 255;
    const c0 = [HAZE.r * tr, HAZE.g * tg, HAZE.b * tb];
    const mix = (k) => `rgb(${c0.map((v, i) => Math.round(v * (1 - k) + [96, 52, 42][i] * k)).join(',')})`;
    gr.addColorStop(0, mix(0)); gr.addColorStop(0.25, mix(0.18)); gr.addColorStop(0.6, mix(0.55)); gr.addColorStop(1, mix(0.8));
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256); fillTex.needsUpdate = true; fillPainted = true;
  }
  paintFill();
  const cityFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: fillTex, fog: false, depthWrite: false }));
  cityFill.renderOrder = -6; scene.add(cityFill);

  // CANYON SHADE: the skyline art fades to pale haze at its bottom, which shows through every
  // gap between the mid buildings. A soft warm-brown gradient sits between the skyline and the
  // mid buildings (it is camera-fixed but depth-tested, so it only darkens what is behind them).
  const shadeTex = (() => {
    const t = canvasTex2(4, 256), g = t.image.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(120,66,48,0)'); gr.addColorStop(0.42, 'rgba(120,66,48,0)');
    gr.addColorStop(0.62, 'rgba(112,60,46,0.42)'); gr.addColorStop(1, 'rgba(84,42,36,0.78)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256); t.needsUpdate = true; return t;
  })();
  const canyonShade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, fog: false, depthWrite: false }));
  camera.add(canyonShade);

  function drawBackdrop(time) {
    if (fillTop && fillPainted !== 'done') { paintFill(); fillPainted = 'done'; }
    // a wide band behind the skyline, from well below the screen up to just inside the skyline's body
    { const dd = 190, hh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dd;
      canyonShade.position.set(0, 0, -dd); canyonShade.scale.set(hh * camera.aspect * 1.05, hh * 1.05, 1); }
    cityFill.position.set(camera.position.x, -62, -396); cityFill.scale.set(1600, 120, 1);
    // the sun glow, in camera space: far, a little right, low over the skyline
    const vh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 100;
    glow.position.set(vh * camera.aspect * 0.18, vh * 0.05, -100); glow.scale.setScalar(vh * 1.9);

    for (const L of LAYERS) {
      for (const k in L.p) L.p[k].begin();
      const [a, b] = visibleX(L.z, 1.3);
      for (let i = Math.floor(a / L.slot) - 2; i <= Math.ceil(b / L.slot) + 1; i++) {
        const r = (s) => hash(L.id * 97 + s, i);
        if (L.kind === 'cloud') {
          if (r(1) < 0.35) continue;
          const n = r(2) < 0.5 ? 'cloud1' : 'cloud2';
          const drift = time * 1.2;                                     // their own slow drift
          put(L.p[n], n, i * L.slot + r(3) * L.slot * 0.6 - drift, 28 + r(4) * 45, L.z, 30 + r(5) * 26, r(6) < 0.5);
        } else if (L.kind === 'sky') {
          // dense: slots narrower than the art, so clusters overlap into a range
          const n = ['skyline', 'skyline2', 'skyline3'][Math.floor(r(1) * 3)];
          const h = L.h[0] + r(2) * (L.h[1] - L.h[0]);
          put(L.p[n], n, i * L.slot + (r(3) - 0.5) * L.slot * 0.5, L.base, L.z - r(4) * 15, n === 'skyline' ? h * 1.15 : h * 0.62, r(5) < 0.5);
        } else if (L.kind === 'bridge') {
          if (r(1) < 0.3) continue;
          put(L.p.bridge, 'bridge', i * L.slot, L.base, L.z, L.h[0]);
        } else {
          const n = r(1) < 0.55 ? 'bldA' : 'bldB';
          const h = L.h[0] + r(2) * (L.h[1] - L.h[0]);
          const x = i * L.slot + (r(3) - 0.5) * L.slot * 0.5;
          const z = L.z - r(4) * 6;
          const flip = r(5) < 0.5;
          const m = put(L.p[n], n, x, L.base, z, h, flip);
          const w = Math.abs(m.scale.x), dress = r(6);
          // set each prop on the building's REAL roof line at that spot (sunk a hair so its feet are hidden)
          const onRoof = (k, spread) => { const fx = (r(7) - 0.5) * spread; return [x + fx * w, L.base + h * roofAtArt(n, fx, flip, n === 'bldA' ? 0.965 : 0.91) - 0.35]; };
          if (dress < 0.45) { const [px, py] = onRoof('tower', 0.5); put(L.p.tower, 'tower', px, py, z - 0.5, 6 + r(8) * 3); }
          else if (dress < 0.62) { const [px, py] = onRoof('billboard', 0.3); put(L.p.billboard, 'billboard', px, py, z - 0.5, 7 + r(8) * 2); }
          else if (dress < 0.78) { const [px, py] = onRoof('props', 0.4); put(L.p.props, 'props', px, py, z - 0.5, 2.6); }
          else if (dress < 0.9) { const [px, py] = onRoof('hut', 0.4); put(L.p.hut, 'hut', px, py, z - 0.5, 3.4); }
        }
      }
      for (const k in L.p) L.p[k].end();
    }
  }

  // ---------------------------------------------------------------- the play lane
  // Facade geometry with WORLD-anchored UVs, so neighbouring buildings never
  // show the texture restarting at their edge.
  const FACADE_TILE = 10;      // metres per texture repeat (big windows, like the concept)
  function facadePool(mat) {
    const items = []; let used = 0;
    return {
      begin() { used = 0; },
      take() {
        if (used === items.length) {
          const g = new THREE.PlaneGeometry(1, 1).translate(0.5, -0.5, 0);   // origin top-left
          const m = new THREE.Mesh(g, mat); m.userData.uv = g.attributes.uv; scene.add(m); items.push(m);
        }
        const m = items[used++]; m.visible = true; return m;
      },
      end() { for (let i = used; i < items.length; i++) items[i].visible = false; },
    };
  }
  function setUV(m, u0, u1, v0, v1) {
    const uv = m.userData.uv;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); uv.needsUpdate = true;
  }

  const ROOF_FRONT = 1.6, ROOF_BACK = -4.5;            // roof slab depth (z)
  const playFacade = facadePool(new THREE.MeshLambertMaterial({ map: tex.facade, color: 0xf2dccb }));
  const playCornice = facadePool(new THREE.MeshLambertMaterial({ map: tex.cornice, transparent: true, alphaTest: 0.1 }));
  // the roof top: warm tan tar, lit by the low sun, a soft darker band at the back
  const roofTex = (() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 64;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#6e4636'); gr.addColorStop(0.4, '#94664f'); gr.addColorStop(1, '#ad7d60');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const roofTopGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0.5);
  const roofTopMat = new THREE.MeshBasicMaterial({ map: roofTex });
  const roofTops = [];
  const sideMat = new THREE.MeshLambertMaterial({ color: 0x6a3a2c, side: THREE.DoubleSide });
  const sideGeo = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2).translate(0, -0.5, 0.5);
  const roofSides = [];
  const playTowers = pool(spriteMat(tex.tower));
  const playHuts = pool(spriteMat(tex.hut));
  const playBoards = pool(spriteMat(tex.billboard));
  const playProps = pool(spriteMat(tex.props));
  const foes = pool(spriteMat(tex.foot));

  // ---------------------------------------------------------------- hazards
  // Procedural placeholders, in the same warm palette: a crate to jump, a
  // hanging sign to roll under, a shield for the shielded ninja, a bobbing lift.
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const stripes = (g, x, y, w, h, a = '#f2b705', b = '#2a1c14', n = 8) => {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = b; g.fillRect(x, y, w, h); g.fillStyle = a;
    const sw = w / n;
    for (let i = -2; i < n + 2; i++) { g.beginPath(); g.moveTo(x + i * sw, y + h); g.lineTo(x + i * sw + sw / 2, y + h); g.lineTo(x + i * sw + sw / 2 + h * 0.6, y); g.lineTo(x + i * sw + h * 0.6, y); g.fill(); }
    g.restore();
  };
  const crateTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b9824f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#c48f58' : '#ad7843'; g.fillRect(0, i * 32, w, 30); }
    g.strokeStyle = '#4a2a16'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.lineWidth = 7; g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, h - 8); g.moveTo(w - 8, 8); g.lineTo(8, h - 8); g.stroke();
    stripes(g, 0, 0, w, 14, '#e8a21a', '#3a2214', 6);
  });
  const signTex = canvasTex(128, 192, (g, w, h) => {
    g.fillStyle = '#4a3a3a'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,200,150,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#241816'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    stripes(g, 8, h - 46, w - 16, 38, '#f2b705', '#2a1c14', 5);
    g.fillStyle = '#e8a21a'; g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.fillText('v', w / 2, 74); g.fillText('v', w / 2, 130);
  });
  const liftTex = canvasTex(256, 32, (g, w, h) => {
    g.fillStyle = '#6a5446'; g.fillRect(0, 0, w, h);
    stripes(g, 0, 0, w, 14, '#f2b705', '#2a1c14', 14);
    g.fillStyle = '#3a2a22'; g.fillRect(0, 22, w, 10);
  });
  const shieldTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(54, 50, 6, 64, 64, 62); gr.addColorStop(0, '#e9eef2'); gr.addColorStop(1, '#6f7c88');
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.strokeStyle = '#8a1f1f'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
    g.fillStyle = '#8a1f1f'; g.beginPath(); g.arc(64, 64, 18, 0, 7); g.fill();
    g.strokeStyle = '#3a1010'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.stroke();
  });
  const litMat = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, emissive: 0x5a3a28, ...extra });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x4a3a34, emissive: 0x2a1a14 });
  function objPool(make) {
    const items = []; let used = 0;
    return {
      begin() { used = 0; },
      take() { if (used === items.length) { const o = make(); scene.add(o); items.push(o); } const o = items[used++]; o.visible = true; return o; },
      end() { for (let i = used; i < items.length; i++) items[i].visible = false; },
    };
  }
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), mat);
  const crates = objPool(() => box(HAZARD.BARRIER_W, HAZARD.BARRIER_H, 1.4, litMat(crateTex)));
  const signs = objPool(() => {                       // gantry: two posts, a top beam, a plate hanging on chains
    const g = new THREE.Group();
    const plate = box(HAZARD.OVER_W, HAZARD.OVER_TOP - HAZARD.OVER_LOW, 0.3, litMat(signTex)); plate.position.y = HAZARD.OVER_LOW; g.add(plate);
    const topY = HAZARD.OVER_TOP + 1.7;
    for (const sx of [-1.25, 1.25]) { const post = box(0.2, topY, 0.25, metalMat); post.position.x = sx; g.add(post); }
    const beam = box(2.7, 0.22, 0.3, metalMat); beam.position.y = topY; g.add(beam);
    for (const sx of [-0.42, 0.42]) { const ch = box(0.05, 1.7, 0.05, metalMat); ch.position.set(sx, HAZARD.OVER_TOP, 0); g.add(ch); }
    return g;
  });
  const lifts = objPool(() => {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 2.6).translate(0, -0.2, 0), litMat(liftTex)); slab.name = 'slab'; g.add(slab);
    for (const n of ['cabL', 'cabR']) { const c = box(0.07, 60, 0.07, metalMat); c.name = n; g.add(c); }
    return g;
  });

  // hover pads: a slab on thrusters with a warm glow underneath; hearts pulse
  const padTex = canvasTex(256, 48, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8e7a6a'); gr.addColorStop(0.45, '#5e4c42'); gr.addColorStop(1, '#2e221e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd37a'; g.fillRect(0, 0, w, 5);                               // lit top edge
    g.fillStyle = '#ffb347'; for (let x = 14; x < w; x += 32) g.fillRect(x, 26, 14, 6);   // running lights
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 8, w, 8);
  });
  const padGlowTex = canvasTex(128, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, 6, 2, w / 2, 6, w / 2); gr.addColorStop(0, 'rgba(255,196,110,0.85)'); gr.addColorStop(0.5, 'rgba(255,150,70,0.28)'); gr.addColorStop(1, 'rgba(255,120,50,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const heartTex = canvasTex(128, 128, (g, w, h) => {
    const heart = (sc, fill) => { g.beginPath(); g.moveTo(64, 112 * sc + 8 * (1 - sc)); g.bezierCurveTo(-18, 56, 22, 6, 64, 42); g.bezierCurveTo(106, 6, 146, 56, 64, 112); g.fillStyle = fill; g.fill(); };
    g.shadowColor = 'rgba(255,90,110,0.9)'; g.shadowBlur = 14;
    heart(1, '#ff3d5e'); g.shadowBlur = 0;
    g.lineWidth = 6; g.strokeStyle = '#7a1230'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(38, 40, 13, 8, -0.7, 0, 7); g.fill();
  });
  const pads = objPool(() => {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.34, 3.2).translate(0, -0.17, 0), litMat(padTex)); slab.name = 'slab'; g.add(slab);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ map: padGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glow.name = 'glow'; glow.position.y = -0.3; glow.position.z = 1.7; g.add(glow);
    return g;
  });
  const hearts = objPool(() => new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ map: heartTex, transparent: true, alphaTest: 0.05, fog: false })));
  const shields = objPool(() => new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), new THREE.MeshBasicMaterial({ map: shieldTex, transparent: true, fog: true })));

  // a soft contact shadow under everything that stands on a play roof, so
  // nothing floats on the flat roof surface
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 16, 0, 64, 16, 64);
    gr.addColorStop(0, 'rgba(40,16,10,0.55)'); gr.addColorStop(1, 'rgba(40,16,10,0)');
    g.setTransform(1, 0, 0, 0.25, 0, 12); g.fillStyle = gr; g.fillRect(0, -64, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadows = [];
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  let shi = 0;
  function shadow(x, y, z, w, d = 1.6) {
    if (!shadows[shi]) { shadows[shi] = new THREE.Mesh(shadowGeo, shadowMat); scene.add(shadows[shi]); }
    const m = shadows[shi++]; m.visible = true; m.position.set(x, y + 0.02, z); m.scale.set(w, 1, d);
  }
  // THE ALLEY: a gap must read as a drop -- a shaft that is warm haze at the
  // lip and deepens to brown shadow, like the concept's street far below.
  const alleyTex = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(150,86,64,0.78)'); gr.addColorStop(0.12, 'rgba(104,54,44,0.95)'); gr.addColorStop(1, 'rgba(34,15,16,1)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const alleyGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, -0.5, 0);
  const alleyMat = new THREE.MeshBasicMaterial({ map: alleyTex, transparent: true, fog: false, depthWrite: false });
  const alleys = [];
  const pizzas = pool(spriteMat(tex.pizza));

  function drawPlay(time) {
    const [a, b] = visibleX(0, 1.3);
    playFacade.begin(); playCornice.begin(); playTowers.begin(); playProps.begin(); playHuts.begin(); playBoards.begin();
    let ti = 0, si = 0; shi = 0;
    for (const r of world.roofs) {
      if (r.x1 < a - 10 || r.x0 > b + 10) continue;
      if (r.lift) continue;                           // lifts are drawn with the hazards
      const f = playFacade.take(); f.position.set(r.x0, r.y, ROOF_FRONT); f.scale.set(r.x1 - r.x0, 80, 1);
      setUV(f, r.x0 / FACADE_TILE, r.x1 / FACADE_TILE, -80 / FACADE_TILE, 0);
      const c = playCornice.take(); c.position.set(r.x0 - 0.2, r.y + 0.05, ROOF_FRONT + 0.06); c.scale.set(r.x1 - r.x0 + 0.4, 1.3, 1);
      setUV(c, r.x0 / 7, r.x1 / 7, 0, 1);
      if (!roofTops[ti]) { roofTops[ti] = new THREE.Mesh(roofTopGeo, roofTopMat); scene.add(roofTops[ti]); }
      const t = roofTops[ti++]; t.visible = true;
      t.position.set(r.x0, r.y - 0.02, ROOF_BACK); t.scale.set(r.x1 - r.x0, 1, ROOF_FRONT - ROOF_BACK);
      for (const [x, s] of [[r.x0, 1], [r.x1, -1]]) {
        if (!roofSides[si]) { roofSides[si] = new THREE.Mesh(sideGeo, sideMat); scene.add(roofSides[si]); }
        const m = roofSides[si++]; m.visible = true;
        m.position.set(x, r.y - 0.02, s > 0 ? ROOF_BACK : ROOF_FRONT); m.scale.set(1, 80, ROOF_FRONT - ROOF_BACK); m.rotation.y = s > 0 ? 0 : Math.PI;
      }
      // dressing along the BACK edge of the roof -- never in the lane, and
      // never anything that looks like an obstacle
      const len = r.x1 - r.x0, d = hash(61, r.id);
      const deco = (p, n, x, z, h, sw) => { const m = put(p, n, x, r.y, z, h); shadow(x + 0.4, r.y, z + 0.3, Math.abs(m.scale.x) * sw); };
      if (d < 0.45 && len > 14) deco(playTowers, 'tower', r.x0 + 3 + (len - 6) * hash(71, r.id), ROOF_BACK + 0.4, 6, 1.1);
      else if (d < 0.72 && len > 14) deco(playBoards, 'billboard', r.x0 + 3 + (len - 6) * hash(73, r.id), ROOF_BACK + 0.3, 7, 0.9);
      if (hash(47, r.id) < 0.5 && len > 10) deco(playProps, 'props', r.x0 + 2 + (len - 4) * hash(53, r.id), ROOF_BACK + 2.2, 1.5, 1.1);
    }
    let ai = 0;
    const solid = world.roofs.filter((r) => !r.lift);       // a lift floats in the gap: the shaft runs behind it
    for (let i = 1; i < solid.length; i++) {
      const L = solid[i - 1], R = solid[i];
      if (R.x0 < a - 10 || L.x1 > b + 10) continue;
      if (!alleys[ai]) { alleys[ai] = new THREE.Mesh(alleyGeo, alleyMat); alleys[ai].renderOrder = -1; scene.add(alleys[ai]); }
      const m = alleys[ai++]; m.visible = true;
      const top = Math.max(L.y, R.y) + 1.2;
      m.position.set(L.x1, top, ROOF_BACK - 0.3); m.scale.set(R.x0 - L.x1, top - Math.min(L.y, R.y) + 34, 1);
    }
    for (let i = ai; i < alleys.length; i++) alleys[i].visible = false;
    for (let i = shi; i < shadows.length; i++) shadows[i].visible = false;
    for (let i = ti; i < roofTops.length; i++) roofTops[i].visible = false;
    for (let i = si; i < roofSides.length; i++) roofSides[i].visible = false;
    playFacade.end(); playCornice.end(); playTowers.end(); playProps.end(); playHuts.end(); playBoards.end();

    // Foot soldiers: a ready-stance bob; knocked out = spin up and away
    crates.begin(); signs.begin(); lifts.begin(); shields.begin(); pads.begin(); hearts.begin();
    for (const o of world.barriers) {
      if (o.x < a || o.x > b) continue;
      crates.take().position.set(o.x, o.y, 0); shadow(o.x + 0.2, o.y, 0, 1.3, 1.6);
    }
    for (const o of world.overheads) {
      if (o.x < a || o.x > b) continue;
      signs.take().position.set(o.x, o.y, 0); shadow(o.x + 0.2, o.y, 0, 1.6, 1.4);
    }
    for (const r of world.roofs) {
      if (!r.lift || r.x1 < a - 8 || r.x0 > b + 8) continue;
      const g = lifts.take(), len = r.x1 - r.x0;
      g.position.set((r.x0 + r.x1) / 2, r.y, 0);
      g.getObjectByName('slab').scale.x = len;
      g.getObjectByName('cabL').position.set(-len / 2 + 0.45, 0, 0);
      g.getObjectByName('cabR').position.set(len / 2 - 0.45, 0, 0);
    }
    for (const pd of world.pads) {
      if (pd.x1 < a - 6 || pd.x0 > b + 6) continue;
      const g = pads.take(), len = pd.x1 - pd.x0;
      g.position.set((pd.x0 + pd.x1) / 2, pd.y + Math.sin(time * 1.8 + pd.x0) * 0.04, 0);   // a faint hover bob (the floor itself is steady)
      g.getObjectByName('slab').scale.x = len;
      const gl = g.getObjectByName('glow'); gl.scale.set(len * 1.05, 1.5, 1);
    }
    for (const h of world.hearts) {
      if (h.taken || h.x < a - 2 || h.x > b + 2) continue;
      const m = hearts.take(); const k = 1 + Math.sin(time * 5) * 0.08;
      m.position.set(h.x, h.y + Math.sin(time * 2.4) * 0.1, 0.25); m.scale.set(k, k, 1);
    }
    foes.begin();
    for (const f of world.foes) {
      if (f.x < a || f.x > b) continue;
      if (!f.alive && (f.ko < 0 || f.ko > 1.2)) continue;
      const h = ENEMY.DRAW_H, bob = 1 + Math.sin(f.t * 5) * 0.02;
      const m = put(foes, 'foot', f.x, f.y, 0.1, h, true);    // art faces right; he must face the turtle (left) m.scale.y = h * bob;
      if (f.alive) m.rotation.z = 0;
      else { const k = f.ko; m.position.set(f.x + k * 9, f.y + k * 7 - k * k * 9, 0.1 + k * 3); m.rotation.z = -k * 9; }
      if (f.shield) {                                 // the shield rides with him, held out toward the turtle
        const sh = shields.take(), c = Math.cos(m.rotation.z), sn = Math.sin(m.rotation.z), ox = -0.5, oy = 0.85;
        sh.position.set(m.position.x + ox * c - oy * sn, m.position.y + ox * sn + oy * c, m.position.z + 0.05);
        sh.rotation.z = m.rotation.z;
      }
    }
    foes.end(); crates.end(); signs.end(); lifts.end(); shields.end(); pads.end(); hearts.end();
    // pizza: a slow spin and a hover
    pizzas.begin();
    for (const z of world.pizzas) {
      if (z.taken || z.x < a || z.x > b) continue;
      const h = 0.75;
      const m = put(pizzas, 'pizza', z.x, z.y - h / 2 + Math.sin(time * 3 + z.x) * 0.08, 0.2, h);
      m.scale.x *= Math.cos(time * 2.4 + z.x * 0.3);
    }
    pizzas.end();
  }

  // ---------------------------------------------------------------- bursts
  const sparkTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const sparks = [];
  const sparkGeo = new THREE.PlaneGeometry(1, 1);
  function burst(x, y, color, n, spread) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ map: sparkTex, color, transparent: true, depthWrite: false, fog: false }));
      const a = Math.random() * Math.PI * 2, s = spread * (0.4 + Math.random() * 0.6);
      m.position.set(x, y, 0.5);
      m.userData = { vx: Math.cos(a) * s, vy: Math.sin(a) * s + spread * 0.3, life: 0.5 + Math.random() * 0.3, t: 0, size: 0.25 + Math.random() * 0.35 };
      scene.add(m); sparks.push(m);
    }
  }
  function updateSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const m = sparks[i], u = m.userData;
      u.t += dt; u.vy -= 9 * dt;
      m.position.x += u.vx * dt; m.position.y += u.vy * dt;
      const k = 1 - u.t / u.life;
      m.material.opacity = Math.max(0, k); m.scale.setScalar(u.size * (0.5 + k));
      if (u.t >= u.life) { scene.remove(m); m.material.dispose(); sparks.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- camera
  // THE DOLLY. The camera eases between three distances:
  //   in   a Foot soldier is coming up (the fight reads up close)
  //   out  a big drop or a long gap is next, or every 5th building (a vista)
  //   mid  everything else
  const cam = { x: 0, y: CAMERA.DIST.mid * CAMERA.ROOF_FRAME, dist: CAMERA.DIST.mid, vDist: 0, mode: 'mid' };
  function dollyTarget() {
    const p = runner.p, v = Math.max(1, p.speed);
    for (const f of world.foes) {
      if (!f.alive || f.x < p.x - 2) continue;
      if ((f.x - p.x) / v < 2.0) return 'in';
      break;
    }
    for (const arr of [world.barriers, world.overheads]) for (const o of arr) { if (o.x > p.x - 2 && (o.x - p.x) / v < 2.0) return 'in'; }
    const r = world.roofAt(p.x) || world.nextRoof(p.x);
    const n = r && world.nextRoof(r.x0 + 0.01);
    if (r && n && (r.x1 - p.x) / v < 1.6) {
      const big = n.y < r.y - 0.8 || (n.x0 - r.x1) > v * airTime(0) * 0.48;
      if (big) return 'out';
    }
    if (p.onPad && p.roofY > (r ? r.y : p.roofY) + 1.2) return 'out';      // on the upper road: pull back to see both roads
    if (r && r.id % 5 === 0 && r.id > 0) return 'out';
    return 'mid';
  }
  function resetCamera() {
    const p = runner.p;
    cam.x = p.x + CAMERA.LEAD_X; cam.y = p.roofY + CAMERA.DIST.mid * CAMERA.ROOF_FRAME; cam.dist = CAMERA.DIST.mid; cam.vDist = 0;
  }
  function updateCamera(dt) {
    const p = runner.p;
    cam.mode = dollyTarget();
    const goal = CAMERA.DIST[cam.mode];
    // critically damped spring: smooth start, smooth stop, no overshoot
    const k = CAMERA.DOLLY_EASE * CAMERA.DOLLY_EASE * 4;
    cam.vDist += (k * (goal - cam.dist) - 2 * Math.sqrt(k) * cam.vDist) * dt;
    cam.dist += cam.vDist * dt;
    const out = (cam.dist - CAMERA.DIST.mid) / (CAMERA.DIST.out - CAMERA.DIST.mid);
    const lead = CAMERA.LEAD_X * (cam.dist / CAMERA.DIST.mid);
    cam.x += (p.x + lead - cam.x) * Math.min(1, dt * 8);
    // frame the roof line in the lower third at EVERY dolly distance: the
    // screen centre sits ROOF_FRAME x dist above the roof, the camera a touch
    // higher still so it looks slightly down onto the roofs.
    const gy = p.roofY + cam.dist * CAMERA.ROOF_FRAME;
    cam.y += (gy - cam.y) * Math.min(1, dt * CAMERA.FOLLOW_Y);
    camera.position.set(cam.x, cam.y + cam.dist * CAMERA.LOOK_DOWN, cam.dist);
    camera.lookAt(cam.x, cam.y, 0);
  }

  // ---------------------------------------------------------------- frame
  const turtle = new Turtle(scene);
  let time = 0;
  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function frame(dt) {
    time += dt;
    updateCamera(dt);
    drawBackdrop(time);
    drawPlay(time);
    turtle.update(dt, runner.p, time);
    updateSparks(dt);
    renderer.render(scene, camera);
  }
  const ready = turtle.load('/models/raphael.glb', '/models/clips.json');

  return { resize, frame, burst, resetCamera, ready, turtle, cam, renderer };
}
