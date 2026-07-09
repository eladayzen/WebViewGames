import * as THREE from 'three';

// Shared 4-step toon gradient map. One tiny texture reused by every
// MeshToonMaterial in the game -- this (not PBR/textures) is the main lever
// for the stylized look, and it's essentially free (built-in material, no
// custom GLSL, one shared texture).
let gradientMap = null;
function getGradientMap() {
  if (!gradientMap) {
    const data = new Uint8Array([70, 140, 200, 255]);
    gradientMap = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

export function createToonMaterial(color, options = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap(), ...options });
}
