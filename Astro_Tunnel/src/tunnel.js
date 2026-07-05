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

function createGridTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#120a2e');
  bg.addColorStop(1, '#050318');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const step = size / 8;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(130, 230, 255, 0.4)';
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 120, 220, 0.28)';
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // faint diagonal accent lines for extra texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let i = -size; i <= size; i += step * 2) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 40);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The wall is one static mesh built once along a gently winding centerline
// (via tunnelCenterAt) instead of a straight cylinder — it never moves;
// only its texture scrolls to sell forward motion, same as before.
export function createTunnelWalls(scene, length, radius) {
  const sampleCount = 80;
  const points = [];
  for (let i = 0; i <= sampleCount; i++) {
    const z = 20 - (length * i) / sampleCount;
    const c = tunnelCenterAt(z);
    points.push(new THREE.Vector3(c.x, c.y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 300, radius, 32, false);
  const texture = createGridTexture();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.BackSide,
      roughness: 0.85,
      metalness: 0.2,
      emissive: 0x0d0630,
      emissiveIntensity: 0.4,
    }),
  );
  scene.add(mesh);
  return { mesh, texture };
}

export function scrollTunnelWalls(walls, speed) {
  walls.texture.offset.y -= speed * 0.05;
}

export function createSpeedRings(scene, radius, count, spacing) {
  const geo = new THREE.TorusGeometry(radius + 0.15, 0.06, 8, 32);
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

// A thin field of glowing dust streaking past to sell forward speed, since
// the rings/walls alone read as fairly static at a glance.
export function createSpeedParticles(scene, radius, count, length) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = radius * (0.15 + Math.random() * 0.85);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle) * r;
    positions[i * 3 + 2] = -Math.random() * length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xbdeeff,
    size: 0.1,
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
      const r = field.radius * (0.15 + Math.random() * 0.85);
      pos.setX(i, Math.cos(angle) * r);
      pos.setY(i, Math.sin(angle) * r);
    }
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
}
