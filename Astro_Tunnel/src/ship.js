import * as THREE from 'three';

// Small glowing sci-fi ship, built from primitives so the prototype needs no
// external model/asset payload. Faces -Z (into the tunnel). Local +Y is
// "up" (cockpit side); local -Y is "down" (belly/thruster side) — this
// matters because main.js rotates the whole group to bank it as it swings
// around the tunnel, keeping -Y always pointing into the wall.
export function createShip() {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xd7dee6,
    metalness: 0.75,
    roughness: 0.25,
    flatShading: true,
  });

  const hullGeo = new THREE.ConeGeometry(0.16, 0.85, 8);
  hullGeo.rotateX(-Math.PI / 2); // apex points -Z (forward)
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.set(0, 0, -0.05);
  group.add(hull);

  const collarGeo = new THREE.CylinderGeometry(0.16, 0.19, 0.28, 8);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, hullMat);
  collar.position.set(0, 0, 0.32);
  group.add(collar);

  const cockpitMat = new THREE.MeshStandardMaterial({
    color: 0x8ff5ff,
    emissive: 0x2fd9ff,
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), cockpitMat);
  cockpit.position.set(0, 0.1, -0.15);
  group.add(cockpit);

  const wingMat = new THREE.MeshStandardMaterial({ color: 0x3a4250, metalness: 0.6, roughness: 0.4 });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x2fd9ff,
    emissive: 0x2fd9ff,
    emissiveIntensity: 2,
  });
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.4), wingMat);
    wing.position.set(0.3 * s, -0.02, 0.15);
    wing.rotation.z = s * 0.12;
    wing.rotation.y = s * 0.15;
    group.add(wing);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.015, 0.05), trimMat);
    trim.position.set(0.3 * s, -0.02, 0.34);
    trim.rotation.z = s * 0.12;
    trim.rotation.y = s * 0.15;
    group.add(trim);
  }

  const engineMat = new THREE.MeshStandardMaterial({
    color: 0xffb44a,
    emissive: 0xff8a1a,
    emissiveIntensity: 2.4,
  });
  const engine = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), engineMat);
  engine.position.set(0, 0, 0.48);
  group.add(engine);

  const engineLight = new THREE.PointLight(0xff9a3c, 1.4, 3.5);
  engineLight.position.set(0, 0, 0.5);
  group.add(engineLight);

  const bellyGlowMat = new THREE.MeshStandardMaterial({
    color: 0x2fd9ff,
    emissive: 0x2fd9ff,
    emissiveIntensity: 1.6,
  });
  const bellyGlow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.7), bellyGlowMat);
  bellyGlow.position.set(0, -0.14, 0.05);
  group.add(bellyGlow);

  return group;
}
