import * as THREE from 'three';

// Shared centerline for the whole tunnel: every piece (walls, decorative
// rings, obstacles) offsets by this same function of world-space z so the
// tube reads as one coherent bending shape instead of independent straight
// pieces. Deliberately zero at z=0 — that's the ship's fixed operating
// plane (see main.js PLAYER_Z), so its own fixed-radius circle around the
// world origin always lines up with the tunnel's local center exactly,
// with no special-casing needed at the seam.
const BEND_X1 = 1.6;
const BEND_X1_FREQ = 0.045;
const BEND_X2 = 0.9;
const BEND_X2_FREQ = 0.017;
const BEND_Y1 = 1.1;
const BEND_Y1_FREQ = 0.03;

export function tunnelCenterAt(z) {
  const x = Math.sin(z * BEND_X1_FREQ) * BEND_X1 + Math.sin(z * BEND_X2_FREQ) * BEND_X2;
  const y = Math.sin(z * BEND_Y1_FREQ) * BEND_Y1;
  return { x, y };
}

// A handful of hand-picked color palettes the tunnel cycles through over
// time (see the environment-event system below) — same panel-pattern
// texture generator, just re-themed.
const THEME_PALETTES = [
  {
    bg0: '#140b30',
    bg1: '#050318',
    grid: 'rgba(160, 210, 255, 0.35)',
    rivet: 'rgba(210, 235, 255, 0.55)',
    panelHues: ['rgba(90, 210, 255, 0.32)', 'rgba(255, 110, 210, 0.28)', 'rgba(255, 180, 90, 0.26)'],
  },
  {
    bg0: '#301207',
    bg1: '#180402',
    grid: 'rgba(255, 180, 110, 0.35)',
    rivet: 'rgba(255, 225, 200, 0.55)',
    panelHues: ['rgba(255, 140, 60, 0.34)', 'rgba(255, 70, 70, 0.28)', 'rgba(255, 220, 120, 0.26)'],
  },
  {
    bg0: '#062616',
    bg1: '#020e08',
    grid: 'rgba(140, 255, 195, 0.35)',
    rivet: 'rgba(210, 255, 235, 0.55)',
    panelHues: ['rgba(90, 255, 170, 0.32)', 'rgba(80, 220, 255, 0.26)', 'rgba(210, 255, 120, 0.24)'],
  },
];

// One representative hue per theme (0-1, HSL hue), so obstacle walls can be
// colored to match whichever theme is currently active instead of being
// fully independent random colors — see ObstacleField.setThemeHue in
// obstacles.js, driven from main.js whenever walls.currentTheme changes.
export const THEME_HUE_CENTERS = [0.53, 0.05, 0.38]; // cyan/pink, amber/red, green/teal

// Sci-fi hull paneling, kept deliberately simple: a few bezeled panels, some
// lit up in the theme's colors, and sparse corner rivets. An earlier version
// had a busy diamond lattice filling every unlit cell plus a rivet at every
// grid intersection — fine sitting still, but at actual scroll speed (and
// with bloom) that density read as a fast-spinning tire-tread pattern
// instead of a calm structural surface. Fewer, bigger, simpler elements.
function createGridTexture(palette) {
  const size = 512;
  const cols = 5;
  const cell = size / cols;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, palette.bg0);
  bg.addColorStop(1, palette.bg1);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const margin = cell * 0.14;

  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < cols; cy++) {
      const x0 = cx * cell;
      const y0 = cy * cell;
      if (Math.random() < 0.16) {
        // Lit panel: soft glow fill + brighter inset border
        const hue = palette.panelHues[Math.floor(Math.random() * palette.panelHues.length)];
        ctx.fillStyle = hue;
        ctx.fillRect(x0 + margin, y0 + margin, cell - margin * 2, cell - margin * 2);
        ctx.strokeStyle = hue.replace(/[\d.]+\)$/, '0.9)');
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + margin, y0 + margin, cell - margin * 2, cell - margin * 2);
      }
    }
  }

  // Structural bezel grid over everything
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 2;
  for (let i = 0; i <= cols; i++) {
    const p = i * cell;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // A single small rivet at each panel corner — enough to read as built
  // structure without the moiré-prone every-cell density of before.
  ctx.fillStyle = palette.rivet;
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j <= cols; j++) {
      ctx.beginPath();
      ctx.arc(i * cell, j * cell, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // 40 repeats over the 400-unit wall == 10 world-units per tile.
  texture.repeat.set(6, 40);
  texture.colorSpace = THREE.SRGBColorSpace;
  // The camera sits deep inside this tube, so the wall right around it is
  // seen at an extreme grazing angle (near-parallel to the surface).
  // Without anisotropic filtering, the GPU's mipmapping averages that
  // whole grazing region down to a flat grey smear instead of resolving
  // the actual panel/grid pattern — that smear is what was reading as a
  // stray "white/grey background". Three clamps this to the GPU's actual
  // max automatically, so a high fixed value here is always safe.
  texture.anisotropy = 16;
  return texture;
}

// One continuous, always-opaque mesh — no segments, no transparency, no
// backdrop-through-windows. Built once along a gently winding centerline
// (via tunnelCenterAt); never moves, only its texture scrolls to sell
// forward motion. Themes still cycle over time (see advanceTunnelTheme
// below), just as an instant texture swap on this one mesh.
export function createTunnelWalls(scene, length, radius) {
  const themeTextures = THEME_PALETTES.map(createGridTexture);
  const sampleCount = 80;
  const points = [];
  for (let i = 0; i <= sampleCount; i++) {
    const z = 20 - (length * i) / sampleCount;
    const c = tunnelCenterAt(z);
    points.push(new THREE.Vector3(c.x, c.y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 300, radius, 32, false);
  const material = new THREE.MeshStandardMaterial({
    map: themeTextures[0],
    side: THREE.BackSide,
    roughness: 0.85,
    metalness: 0.2,
    emissive: 0x0d0630,
    emissiveIntensity: 0.4,
  });
  const mesh = new THREE.Mesh(geo, material);
  scene.add(mesh);

  return { mesh, material, themeTextures, currentTheme: 0 };
}

export function scrollTunnelWalls(walls, speed) {
  for (const tex of walls.themeTextures) {
    tex.offset.y -= speed * 0.05;
  }
}

// Instantly swaps to the next color theme — no fade, no transparency.
export function advanceTunnelTheme(walls) {
  walls.currentTheme = (walls.currentTheme + 1) % walls.themeTextures.length;
  walls.material.map = walls.themeTextures[walls.currentTheme];
}

export function createSpeedRings(scene, radius, count, spacing) {
  // Was radius + 0.15 — that placed it OUTSIDE the tunnel wall's own radius,
  // which is a solid opaque surface at exactly `radius`: from inside the
  // tube, anything beyond that radius is occluded, behind the wall, and
  // literally never visible. Bringing it just inside the wall instead is
  // what actually makes it render.
  const geo = new THREE.TorusGeometry(radius - 0.3, 0.06, 8, 32);
  const rings = [];
  for (let i = 0; i < count; i++) {
    const hue = (i / count) % 1;
    const baseColor = new THREE.Color().setHSL(hue, 0.85, 0.6);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: baseColor.clone(), transparent: true, opacity: 0.9 }),
    );
    const z = -i * spacing - spacing;
    const c = tunnelCenterAt(z);
    mesh.position.set(c.x, c.y, z);
    scene.add(mesh);
    // See the "decorative ring glow" README block below for how/why only
    // some rings glow and when.
    rings.push({ mesh, baseColor, glows: i % RING_GLOW_EVERY_NTH === 0 });
  }
  return { rings, spacing, length: count * spacing };
}

// --- Decorative ring glow ---------------------------------------------
// Read this before tweaking — the "when should a ring glow" behavior has
// gone through several rounds and is still being felt out, so every knob
// is grouped here instead of scattered through the update loop.
//
// HOW IT WORKS
// - Rings originally only bloomed (via the postprocessing bloom pass)
//   once fog happened to thin out enough as they approached the camera —
//   but yellow/green hues read far brighter than blue/purple ones to the
//   bloom pass's luminance check, so some hues bloomed reliably and
//   others almost never did, regardless of distance. Rebalancing hue
//   brightness to fix that changed how every ring looked at every
//   distance (a bigger, worse trade-off) — so instead, glow is now an
//   explicit, direct effect this code controls, not an emergent one.
// - Each ring gets a fixed base color (from its hue) and a `glows` flag
//   decided once at creation time (createSpeedRings, above) — currently
//   every Nth ring by index. Rings without the flag stay their plain base
//   color forever; the boost math below is skipped for them entirely.
// - Every frame (scrollSpeedRings), for rings WITH the flag: the code
//   measures how far the ring is from a "glow peak" — a point
//   RING_GLOW_LAG world-units past the player's own z (positive = the
//   ship has already passed the ring, since z increases toward and
//   through the player as everything scrolls forward). The closer the
//   ring is to that peak, the more its base color gets multiplied up,
//   maxing out at RING_GLOW_BOOST right at the peak and fading back to
//   1x (unboosted) over RING_GLOW_RANGE world-units on either side.
//
// QUICK KNOBS
// - How MANY rings can ever glow: RING_GLOW_EVERY_NTH (1-in-N by index;
//   bigger number = fewer glowing rings).
// - WHEN the flash happens, relative to the player: RING_GLOW_LAG. Rings
//   recycle at playerZ + 8 (see the recycle check below), which is
//   effectively where they exit the frame near the camera — a LAG close
//   to 8 flashes just before a ring disappears; a small/zero LAG flashes
//   right as the player passes it; a negative LAG would flash while still
//   approaching.
// - HOW LONG/gradual the flash reads: RING_GLOW_RANGE (smaller = a
//   snappier, more sudden flash; larger = a slow fade in/out).
// - HOW BRIGHT the flash gets: RING_GLOW_BOOST (multiplier on the base
//   color at the peak; 1 would mean no visible boost at all).
const RING_GLOW_EVERY_NTH = 10;
const RING_GLOW_RANGE = 4;
const RING_GLOW_BOOST = 2.4;
const RING_GLOW_LAG = 7;

export function scrollSpeedRings(decor, speed, playerZ) {
  for (const { mesh, baseColor, glows } of decor.rings) {
    mesh.position.z += speed;
    if (mesh.position.z > playerZ + 8) {
      mesh.position.z -= decor.length;
    }
    const c = tunnelCenterAt(mesh.position.z);
    mesh.position.x = c.x;
    mesh.position.y = c.y;
    mesh.rotation.z += 0.003;

    if (!glows) continue;
    const dist = Math.abs(mesh.position.z - playerZ - RING_GLOW_LAG);
    const t = THREE.MathUtils.clamp(1 - dist / RING_GLOW_RANGE, 0, 1);
    const boost = 1 + t * t * RING_GLOW_BOOST;
    mesh.material.color.copy(baseColor).multiplyScalar(boost);
  }
}

// A field of glowing dust streaking past to sell forward speed, since the
// rings/walls alone read as fairly static at a glance. Deliberately hugs
// the tunnel's outer band (near the walls, "the sides") rather than being
// scattered across the whole cross-section — spread across the center is
// what read as noisy clutter in front of the gameplay.
const PARTICLE_MIN_RADIUS_FACTOR = 0.62;
const PARTICLE_RADIUS_SPREAD = 0.36;

export function createSpeedParticles(scene, radius, count, length) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = radius * (PARTICLE_MIN_RADIUS_FACTOR + Math.random() * PARTICLE_RADIUS_SPREAD);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle) * r;
    positions[i * 3 + 2] = -Math.random() * length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xbdeeff,
    size: 0.13,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return { points, radius, length, count };
}

export function scrollSpeedParticles(field, speed, playerZ) {
  const pos = field.points.geometry.attributes.position;
  for (let i = 0; i < field.count; i++) {
    let z = pos.getZ(i) + speed * 2.2;
    if (z > playerZ + 4) {
      z -= field.length;
      const angle = Math.random() * Math.PI * 2;
      const r = field.radius * (PARTICLE_MIN_RADIUS_FACTOR + Math.random() * PARTICLE_RADIUS_SPREAD);
      pos.setX(i, Math.cos(angle) * r);
      pos.setY(i, Math.sin(angle) * r);
    }
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
}
