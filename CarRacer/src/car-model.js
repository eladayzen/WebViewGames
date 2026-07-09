import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createBlobShadow } from './shadow.js';

// Stylized toy racer: chunky rounded/beveled panels, glossy paint (real
// specular highlights, not flat toon shading -- that's what makes these
// read as "detailed" against a reference), big contrasting-rim wheels.
const WHEEL_RADIUS = 0.46;
const HEADLIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
const TAILLIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xff4444 });
const TIRE_MAT = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.85 });

function glossy(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.12, ...extra });
}

function createWheel(rimMat, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.rotation.z = Math.PI / 2; // lay cylinders on their side, axis along local Y
  const spin = new THREE.Group();
  pivot.add(spin);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.36, 14), TIRE_MAT);
  spin.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS * 0.5, WHEEL_RADIUS * 0.5, 0.38, 8), rimMat);
  spin.add(rim);
  return { pivot, spin };
}

// Shared primitive-built car factory -- player and traffic cars are both
// this same shape, just different colors/detail level, so there's one
// place to tune the silhouette.
export function createCarModel({ bodyColor, accentColor = 0xff8a2f, detailed = true }) {
  const group = new THREE.Group();
  const bodyMat = glossy(bodyColor);
  const accentMat = glossy(accentColor);
  const darkMat = glossy(0x1a1a22, { roughness: 0.5 });

  const body = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.6, 3.1, 3, 0.25), bodyMat);
  body.position.y = 0.56;
  group.add(body);

  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.15, 0.48, 1.5, 3, 0.2), bodyMat);
  cabin.position.set(0, 0.98, -0.15);
  group.add(cabin);

  const grille = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.26, 0.1, 2, 0.04), darkMat);
  grille.position.set(0, 0.5, -1.58);
  group.add(grille);

  if (detailed) {
    const hoodScoop = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.14, 0.46, 2, 0.05), darkMat);
    hoodScoop.position.set(0, 0.9, -1.1);
    group.add(hoodScoop);

    const spoiler = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.1, 0.32, 2, 0.05), accentMat);
    spoiler.position.set(0, 0.96, 1.48);
    group.add(spoiler);

    const strutGeo = new RoundedBoxGeometry(0.08, 0.24, 0.08, 1, 0.02);
    for (const x of [-0.6, 0.6]) {
      const strut = new THREE.Mesh(strutGeo, darkMat);
      strut.position.set(x, 0.82, 1.48);
      group.add(strut);
    }

    const stripeGeo = new THREE.BoxGeometry(0.04, 0.1, 2.6);
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(stripeGeo, accentMat);
      stripe.position.set(side * 0.87, 0.42, -0.05);
      group.add(stripe);
    }
  }

  const lightGeo = new THREE.BoxGeometry(0.28, 0.14, 0.06);
  for (const x of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(lightGeo, HEADLIGHT_MAT);
    hl.position.set(x, 0.55, -1.58);
    group.add(hl);
    const tl = new THREE.Mesh(lightGeo, TAILLIGHT_MAT);
    tl.position.set(x, 0.55, 1.56);
    group.add(tl);
  }

  const wheelY = WHEEL_RADIUS - 0.05;
  const wheelPositions = [
    [-0.95, wheelY, -1.02], [0.95, wheelY, -1.02],
    [-0.95, wheelY, 1.02], [0.95, wheelY, 1.02],
  ];
  const wheels = wheelPositions.map(([x, y, z]) => {
    const wheel = createWheel(accentMat, x, y, z);
    group.add(wheel.pivot);
    return wheel;
  });

  const shadow = createBlobShadow(2.8);
  shadow.position.y = 0.015;
  group.add(shadow);

  group.userData.wheels = wheels;
  return group;
}

export function spinWheels(car, speed, dt) {
  const angularSpeed = speed / WHEEL_RADIUS;
  for (const wheel of car.userData.wheels) {
    wheel.spin.rotation.y += angularSpeed * dt;
  }
}
