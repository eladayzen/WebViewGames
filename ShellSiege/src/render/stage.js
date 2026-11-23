// THE PLAZA ITSELF.
//
// THE FLOOR IS ONE PAINTED IMAGE, not a tiling material and not a procedural
// pattern. That is a rule this repo learned the expensive way on Astro Tunnel
// and the first cut of Sewer Slide: a code-drawn surface reads as proceduralised
// 3D no matter how much noise is layered into it, and the only fix is real
// illustrated art. Because the arena is BOUNDED, one 2048px painting can cover
// the whole of it -- which also means there is no tile to seam, no repeat to
// spot, and the dais, the cracks, the ooze and the drains are composed rather
// than scattered.
//
// WHAT IS PAINTED AND WHAT IS GEOMETRY. Anything flat is in the painting:
// flagstones, cracks, moss, puddles, grates, the carved dais and its spokes.
// Anything with height is a mesh: the colonnade and the braziers. Nothing is
// in both, so nothing can disagree with itself when the light moves.
//
// THE COLONNADE IS ONLY ON THE TWO FAR EDGES. The camera never rotates, so the
// -x and -z walls are always the backdrop and the +x and +z walls are always
// between the camera and the player. Columns on the near edges would spend the
// whole game standing in front of the thing the player is trying to watch.
// The near edges get a low kerb instead: it still closes the room off, and it
// is below the eyeline.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA } from '../core/world.js';
import { FLOORS } from './floors.js';
import { u } from './units.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

const W = u(ARENA.width);          // 36 units
const H = u(ARENA.height);
const CX = W / 2, CZ = H / 2;

// MEASURED off whichever floor art is loaded, not guessed -- the scan bins the
// green-minus-red signal by radius and takes the peak band. Each floor painting
// puts its runes somewhere different, so the radius travels with the art rather
// than living here as a constant; see render/floors.js. `?ring=` still overrides.
const runeRadius = (floorKey) => num('ring', (FLOORS[floorKey] || FLOORS.warm).runeR);

/** A soft round glow, built once and shared by every additive sprite. */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pillarGeometry() {
  // Base, tapered shaft, capital -- merged so the whole colonnade is one draw.
  const parts = [];
  const base = new THREE.BoxGeometry(1.15, 0.36, 1.15);
  base.translate(0, 0.18, 0);
  const shaft = new THREE.CylinderGeometry(0.34, 0.44, 3.6, 10, 1);
  shaft.translate(0, 0.36 + 1.8, 0);
  const cap = new THREE.BoxGeometry(1.05, 0.34, 1.05);
  cap.translate(0, 0.36 + 3.6 + 0.17, 0);
  parts.push(base, shaft, cap);
  return mergeGeometries(parts, false);
}

/**
 * @param tex.floors  { warm, stone }: every painting a theme can use, loaded up
 *        front so swapping rooms is a pointer change, not a decode.
 */
export function createStage(scene, tex) {
  const group = new THREE.Group();
  scene.add(group);

  // --- the apron: stone past the painted plaza, so the colonnade has something
  // to stand on and the arena has no visible cut edge. Fog takes it.
  // WARM MID GREY, not the old near-black 0x24313a: the apron is the frame
  // around the picture, and a black frame makes everything inside it read dark
  // however bright the painting is.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 110),
    new THREE.MeshLambertMaterial({ color: 0x8a8070 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(CX, -0.02, CZ);
  group.add(apron);

  // --- the painted plaza, exactly the size of the playable arena.
  // Phong rather than Lambert: Lambert in three.js is per-VERTEX, and a floor
  // is two triangles, so the brazier pools would light four corners and
  // nothing in between. Phong with no specular is per-pixel and costs one
  // screen of fill, which is what a floor costs anyway.
  for (const t of Object.values(tex.floors)) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshPhongMaterial({ map: tex.floors.warm, shininess: 0, specular: 0x000000 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(CX, 0, CZ);
  group.add(floor);

  // --- the rune ring: a live glow sitting exactly on the painted one, so the
  // dais breathes instead of being a picture of a dais.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(runeRadius('warm') - 0.28, runeRadius('warm') + 0.28, 96),
    new THREE.MeshBasicMaterial({
      color: 0x3ce6a0, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      fog: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(CX, 0.015, CZ);
  group.add(ring);

  // (the colonnade of columns that stood here is gone: the back walls do the job on their own)
  const mat = new THREE.MeshLambertMaterial({ color: 0xc6b89d });
  const colMat = mat;                    // recoloured per theme
  const OUT = num('colon', 1.6);         // how far outside the floor the kerb stands

  // --- THE BACK WALLS: a solid wall along the two far edges (north-west and north-east on screen),
  // behind the columns, with a lighter cap and a dark plinth, so the room reads as closed in
  // rather than as a floor with a row of posts. Recoloured per theme.
  const WALL_T = 1.3, WALL_H = 2.7;   // the wall's inner face sits exactly on the floor's edge
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xb4a68c });
  const capMat = new THREE.MeshLambertMaterial({ color: 0xd2c6ac });
  const plinthMat = new THREE.MeshLambertMaterial({ color: 0x8c7f68 });
  for (const [px, pz, sx, sz] of [
    [-WALL_T / 2, CZ - WALL_T / 2, WALL_T, H + WALL_T],         // along the west edge
    [CX - WALL_T / 2, -WALL_T / 2, W + WALL_T, WALL_T],         // along the north edge
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, WALL_H, sz), wallMat);
    wall.position.set(px, WALL_H / 2, pz);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.3, 0.28, sz + 0.3), capMat);
    cap.position.set(px, WALL_H + 0.14, pz);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.3, 0.5, sz + 0.3), plinthMat);
    plinth.position.set(px, 0.25, pz);
    group.add(wall, cap, plinth);
  }

  // --- a low kerb on the two near edges: closes the room without standing in
  // front of it.
  const kerbMat = new THREE.MeshLambertMaterial({ color: 0xb0a287 });
  for (const [px, pz, sx, sz] of [
    [W + OUT, CZ, 0.9, H + OUT * 2],
    [CX, H + OUT, W + OUT * 2, 0.9],
  ]) {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.55, sz), kerbMat);
    kerb.position.set(px, 0.275, pz);
    group.add(kerb);
  }

  // --- braziers: four, around the dais, close enough that their pools reach
  // the player while he is near the middle. Each is the only moving light in
  // the scene, and there are four of them because that is as many as a phone
  // should be asked to carry on a per-pixel floor.
  const flameTex = glowTexture('rgba(255,196,96,1)', 'rgba(255,120,30,0)');
  const braziers = [];
  const bowlMat = new THREE.MeshLambertMaterial({ color: 0x9a9388 });
  const D = num('braz', 7);
  // ONLY TWO OF THE FOUR CARRY A REAL LIGHT. A point light costs its shading
  // on every fragment of a per-pixel floor whether or not that fragment is
  // near it, so four of them is four floor passes. Two is the compromise:
  // since the room was brightened the warm pools barely read anyway -- they
  // were carrying the old murk, not the new plaza -- and the bowls and flame
  // sprites, which are what you actually SEE, all stay. ?brazlit=0 for none,
  // 4 to put them back.
  const LIT = num('brazlit', 2);
  let litCount = 0;
  for (const [dx, dz] of [[-D, -D], [D, -D], [-D, D], [D, D]]) {
    const b = new THREE.Group();
    b.position.set(CX + dx, 0, CZ + dz);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 1.15, 8), bowlMat);
    stem.position.y = 0.575;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.34, 10), bowlMat);
    bowl.position.y = 1.3;
    // Warm, not white. An additive sprite at full white clips to a flat disc
    // the moment it overlaps itself, which read as a street lamp rather than
    // as fire; tinting it toward the flame colour keeps the core hot without
    // blowing the whole sprite out.
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flameTex, color: 0xffa94e, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, fog: false, opacity: 0.85,
    }));
    flame.position.y = 1.58;
    flame.scale.set(0.95, 1.15, 1);
    let light = null;
    if (litCount < LIT) {
      litCount++;
      light = new THREE.PointLight(0xffb169, 5.5, 13, 2);
      light.position.y = 1.7;
      b.add(light);
    }
    b.add(stem, bowl, flame);
    group.add(b);
    braziers.push({ flame, light, phase: Math.random() * Math.PI * 2 });
  }

  /** Breathe the runes and flicker the fires. */
  function update(timeS) {
    ring.material.opacity = 0.13 + 0.06 * Math.sin(timeS * 1.5);
    for (const b of braziers) {
      const f = 0.85 + 0.15 * Math.sin(timeS * 11 + b.phase) + 0.08 * Math.sin(timeS * 23.3 + b.phase * 2);
      if (b.light) b.light.intensity = 5.5 * f;
      b.flame.scale.set(0.95 * f, 1.15 * (0.94 + f * 0.08), 1);
    }
  }

  // ---- ROOMS: a theme for the floor and the mood, obstacles for the layout ----
  //
  // THE FLOOR IS SWAPPED BY POINTER AND THE GRADE BY MATERIAL COLOUR. The
  // paintings are decoded once, at load. A material's `color` multiplies its
  // map, so the same stone reads as dusk or ember for the price of one
  // setHex(); a real new painting is one more entry in `tex.floors`.
  //
  // THE FOG IS ALSO THE BACKGROUND, so it moves with the theme: it sets the
  // value of every pixel the floor does not cover.
  function setTheme(theme) {
    floor.material.map = tex.floors[theme.floor] || tex.floors.warm;
    floor.material.color.setHex(theme.tint);
    floor.material.needsUpdate = true;
    apron.material.color.setHex(theme.apron);
    scene.fog.color.setHex(theme.fog);
    scene.background.setHex(theme.fog);
    colMat.color.setHex(theme.props);
    wallMat.color.setHex(theme.props).multiplyScalar(0.92);
    capMat.color.setHex(theme.props).multiplyScalar(1.1);
    plinthMat.color.setHex(theme.props).multiplyScalar(0.72);
    kerbMat.color.setHex(theme.props).multiplyScalar(0.88);
    if (theme.ring) {
      const r = runeRadius(theme.floor);
      ring.geometry.dispose();
      ring.geometry = new THREE.RingGeometry(r - 0.28, r + 0.28, 96);
      ring.material.color.setHex(theme.ring.color);
      ring.visible = true;
    } else {
      ring.visible = false;
    }
  }

  const obstacleGroup = new THREE.Group();
  group.add(obstacleGroup);
  const pillarGeo = pillarGeometry();
  const rubbleGeo = new THREE.DodecahedronGeometry(1, 0);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let obstacleMats = [];

  /**
   * Build the room's obstacles from the same list the simulation collides with,
   * so what you see is exactly what stops you. The visual footprint is a few
   * percent WIDER than the hitbox on purpose: a body that stops just short of
   * the visible edge reads as solid, one that sinks into it reads as broken.
   *
   * Pillars are cut down to about half height. Full-height columns at this
   * pitch hid the enemy standing behind them, which is the one thing an
   * obstacle in a combat room must not do.
   */
  function setObstacles(list, theme) {
    for (const c of [...obstacleGroup.children]) obstacleGroup.remove(c);
    for (const m of obstacleMats) m.dispose();
    obstacleMats = [];
    const base = new THREE.Color(theme.props);
    const mk = (k) => { const m = new THREE.MeshLambertMaterial({ color: base.clone().multiplyScalar(k) }); obstacleMats.push(m); return m; };
    const matPillar = mk(1.0), matRubble = mk(0.74), matWall = mk(0.9);
    list.forEach((o, i) => {
      let mesh;
      if (o.kind === 'rect') {
        mesh = new THREE.Mesh(boxGeo, matWall);
        mesh.scale.set(u(o.hw * 2), 1.25, u(o.hh * 2));
        mesh.position.set(u(o.x), 0.625, u(o.y));
      } else if (o.tall) {
        mesh = new THREE.Mesh(pillarGeo, matPillar);
        const s = u(o.r) / 0.55;
        mesh.scale.set(s, s * 0.5, s);
        mesh.position.set(u(o.x), 0, u(o.y));
        mesh.rotation.y = i * 0.7;
      } else {
        mesh = new THREE.Mesh(rubbleGeo, matRubble);
        const r = u(o.r);
        mesh.scale.set(r * 1.05, r * 0.7, r * 0.95);
        mesh.position.set(u(o.x), r * 0.45, u(o.y));
        mesh.rotation.set(i * 0.5, i * 1.1, 0);
      }
      obstacleGroup.add(mesh);
    });
  }

  return { group, floor, ring, braziers, update, glowTexture, setTheme, setObstacles };
}
