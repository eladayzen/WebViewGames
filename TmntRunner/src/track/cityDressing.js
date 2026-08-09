import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { createToonMaterial } from '../core/toonMaterial';
import { createWindowGridTexture } from '../core/proceduralTextures';
// Side-effect import: registers Mesh.prototype.createInstance(), used below.
import '@babylonjs/core/Meshes/instancedMesh';

// Purely decorative roadside dressing (buildings + neon signs), parented
// under each pooled chunk (track/chunkPool.js) so it scrolls/recycles for
// free with the same logic already built for obstacles -- pulling the
// reference image's city-street look forward without a separate pooling
// system, and without creating/disposing meshes after boot.
const BUILDING_PALETTE = [
  '#4a1f5c',
  '#37173f',
  '#602c3d',
  '#212a4d',
];

let buildingBases = null;
let neonBaseA = null;
let neonBaseB = null;
let counter = 0;

function ensureBaseMeshes(scene) {
  if (buildingBases) return;

  // Each building colour variant gets its own procedurally-drawn window-grid
  // facade texture (core/proceduralTextures.js) -- a plain flat-colour box
  // reads as a shape, not a building; lit/unlit windows are what sell it as
  // a facade, matching the reference image's backdrop.
  buildingBases = BUILDING_PALETTE.map((hex, i) => {
    const base = CreateBox(`buildingBase${i}`, { width: 6, height: 1, depth: 8 }, scene);
    base.material = createToonMaterial(scene, {
      name: `buildingBaseMat${i}`,
      baseColor: new Color3(1, 1, 1), // texture supplies the actual colour
      rimColor: new Color3(0.7, 0.6, 0.9),
      rimPower: 2.8,
      texture: createWindowGridTexture(scene, { base: hex }),
    });
    base.isVisible = false;
    return base;
  });

  neonBaseA = CreatePlane('neonBaseA', { width: 2.2, height: 1 }, scene);
  neonBaseA.material = createToonMaterial(scene, {
    name: 'neonMatA',
    baseColor: new Color3(0.05, 0.05, 0.05),
    rimColor: new Color3(0.2, 0.9, 1),
    emissiveColor: new Color3(0.2, 0.9, 1.0),
  });
  neonBaseA.isVisible = false;

  neonBaseB = CreatePlane('neonBaseB', { width: 2.2, height: 1 }, scene);
  neonBaseB.material = createToonMaterial(scene, {
    name: 'neonMatB',
    baseColor: new Color3(0.05, 0.05, 0.05),
    rimColor: new Color3(1, 0.25, 0.55),
    emissiveColor: new Color3(1.0, 0.25, 0.55),
  });
  neonBaseB.isVisible = false;
}

// Creates one chunk's worth of dressing (one instance of every building
// colour + both neon variants, per side) and returns a reroll() that toggles
// which are visible and re-randomizes height -- called whenever the owning
// chunk's obstacle template is (re)applied, so dressing varies with recycling.
export function createChunkDressing(scene, parent) {
  ensureBaseMeshes(scene);
  counter += 1;

  const sides = [-1, 1].map((side) => {
    const buildingInstances = buildingBases.map((base, i) => {
      const inst = base.createInstance(`buildingInst_${counter}_${side}_${i}`);
      inst.parent = parent;
      inst.position.x = side * 9;
      inst.isVisible = false;
      return inst;
    });

    const neonA = neonBaseA.createInstance(`neonAInst_${counter}_${side}`);
    const neonB = neonBaseB.createInstance(`neonBInst_${counter}_${side}`);
    [neonA, neonB].forEach((neon) => {
      neon.parent = parent;
      neon.position.x = side * (9 - 3.05);
      neon.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      neon.isVisible = false;
    });

    return { buildingInstances, neonA, neonB };
  });

  function reroll() {
    sides.forEach(({ buildingInstances, neonA, neonB }) => {
      const activeIdx = Math.floor(Math.random() * buildingInstances.length);
      const height = 6 + Math.floor(Math.random() * 7);
      buildingInstances.forEach((inst, i) => {
        inst.isVisible = i === activeIdx;
        if (i === activeIdx) {
          inst.scaling.y = height;
          inst.position.y = height / 2;
        }
      });

      const neonRoll = Math.random();
      neonA.isVisible = neonRoll < 0.35;
      neonB.isVisible = neonRoll >= 0.35 && neonRoll < 0.6;
      const activeNeon = neonA.isVisible ? neonA : neonB.isVisible ? neonB : null;
      if (activeNeon) activeNeon.position.y = height * (0.5 + Math.random() * 0.25);
    });
  }

  reroll();
  return { reroll };
}
