import * as THREE from 'three';
import { tunnelCenterAt } from './tunnel.js';

const GAP_WIDTH = Math.PI / 2.2; // ~82 degrees of open sector per ring
const GATE_GEO = new THREE.SphereGeometry(0.16, 12, 12);
const GATE_MAT = new THREE.MeshBasicMaterial({ color: 0xdfffff });

function randomGapAngle() {
  return Math.random() * Math.PI * 2;
}

function randomWallHue() {
  return Math.random();
}

function wallGeometry(radius, gapAngle) {
  return new THREE.RingGeometry(0, radius, 64, 1, gapAngle + GAP_WIDTH, Math.PI * 2 - GAP_WIDTH);
}

// The wedge/rim geometry is built around its own local origin, so following
// the tunnel's bend is just translating the whole mesh to the centerline's
// offset at this ring's z — same trick used for gates/gems below.
function placeWall(ring) {
  const c = tunnelCenterAt(ring.z);
  ring.mesh.position.set(c.x, c.y, ring.z);
  ring.rim.position.set(c.x, c.y, ring.z);
}

function placeGates(ring, radius) {
  const c = tunnelCenterAt(ring.z);
  const a1 = ring.gapAngle;
  const a2 = ring.gapAngle + GAP_WIDTH;
  ring.gateA.position.set(c.x + Math.cos(a1) * radius, c.y + Math.sin(a1) * radius, ring.z);
  ring.gateB.position.set(c.x + Math.cos(a2) * radius, c.y + Math.sin(a2) * radius, ring.z);
}

function placeGem(ring, ringRadius) {
  const c = tunnelCenterAt(ring.z);
  const gemAngle = ring.gapAngle + GAP_WIDTH / 2;
  ring.gem.position.set(c.x + Math.cos(gemAngle) * ringRadius, c.y + Math.sin(gemAngle) * ringRadius, ring.z);
}

export class ObstacleField {
  // `radius` is the tunnel wall radius the wedge geometry spans (0..radius).
  // `ringRadius` is the ship's fixed travel radius — gems and gate markers
  // need to sit there, not at the tunnel's center, now that the ship never
  // leaves that circle.
  constructor(scene, { radius, ringRadius, count, spacing, startZ }) {
    this.scene = scene;
    this.radius = radius;
    this.ringRadius = ringRadius;
    this.spacing = spacing;
    this.rings = [];
    for (let i = 0; i < count; i++) {
      this.rings.push(this.createRing(startZ - i * spacing));
    }
  }

  createRing(z) {
    const gapAngle = randomGapAngle();
    const hue = randomWallHue();
    const mesh = new THREE.Mesh(
      wallGeometry(this.radius, gapAngle),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.7, 0.42),
        emissive: new THREE.Color().setHSL(hue, 0.9, 0.35),
        emissiveIntensity: 1.1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
        roughness: 0.3,
        metalness: 0.2,
      }),
    );
    this.scene.add(mesh);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius, 0.08, 8, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.9, 0.65) }),
    );
    this.scene.add(rim);

    const gateA = new THREE.Mesh(GATE_GEO, GATE_MAT);
    const gateB = new THREE.Mesh(GATE_GEO, GATE_MAT);
    this.scene.add(gateA, gateB);

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshStandardMaterial({
        color: 0xffe082,
        emissive: 0xffb300,
        emissiveIntensity: 1,
        roughness: 0.25,
      }),
    );
    this.scene.add(gem);

    const ring = { mesh, rim, gateA, gateB, gem, z, gapAngle, gapWidth: GAP_WIDTH, collected: false, passed: false };
    placeWall(ring);
    placeGates(ring, this.ringRadius);
    placeGem(ring, this.ringRadius);
    return ring;
  }

  recycle(ring, newZ) {
    const gapAngle = randomGapAngle();
    const hue = randomWallHue();

    ring.mesh.geometry.dispose();
    ring.mesh.geometry = wallGeometry(this.radius, gapAngle);
    ring.mesh.material.color.setHSL(hue, 0.7, 0.42);
    ring.mesh.material.emissive.setHSL(hue, 0.9, 0.35);
    ring.rim.material.color.setHSL(hue, 0.9, 0.65);

    ring.gapAngle = gapAngle;
    ring.z = newZ;
    ring.collected = false;
    ring.passed = false;
    placeWall(ring);
    placeGates(ring, this.ringRadius);
    placeGem(ring, this.ringRadius);
    ring.gem.visible = true;
  }

  reset(startZ) {
    this.rings.forEach((ring, i) => this.recycle(ring, startZ - i * this.spacing));
  }

  update(speed, playerZ, playerX, playerY, callbacks) {
    let farthestZ = Infinity;
    for (const ring of this.rings) farthestZ = Math.min(farthestZ, ring.z);

    for (const ring of this.rings) {
      ring.z += speed;
      placeWall(ring);
      placeGates(ring, this.ringRadius);
      if (ring.gem.visible) placeGem(ring, this.ringRadius);

      if (!ring.passed && ring.z >= playerZ) {
        ring.passed = true;
        const angle = Math.atan2(playerY, playerX);
        const norm = (((angle - ring.gapAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (norm < ring.gapWidth) {
          callbacks.onPass();
        } else {
          callbacks.onCollide();
        }
      }

      if (!ring.collected && ring.gem.visible) {
        const dz = ring.z - playerZ;
        const dx = ring.gem.position.x - playerX;
        const dy = ring.gem.position.y - playerY;
        if (Math.abs(dz) < 1 && Math.hypot(dx, dy) < 0.7) {
          ring.collected = true;
          ring.gem.visible = false;
          callbacks.onGem();
        }
      }

      if (ring.z > playerZ + 10) {
        farthestZ -= this.spacing;
        this.recycle(ring, farthestZ);
      }
    }
  }
}
