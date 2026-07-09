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
    const color = new THREE.Color().setHSL(hue, 0.85, 0.6);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    const z = -i * spacing - spacing;
    const c = tunnelCenterAt(z);
    mesh.position.set(c.x, c.y, z);
    scene.add(mesh);
    rings.push(mesh);
  }
  return { rings, spacing, length: count * spacing };
}

export function scrollSpeedRings(decor, speed, playerZ) {
  for (const ring of decor.rings) {
    ring.position.z += speed;
    if (ring.position.z > playerZ + 8) {
      ring.position.z -= decor.length;
    }
    const c = tunnelCenterAt(ring.position.z);
    ring.position.x = c.x;
    ring.position.y = c.y;
    ring.rotation.z += 0.003;
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
