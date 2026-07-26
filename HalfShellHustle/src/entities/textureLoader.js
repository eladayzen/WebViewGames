// Tiny lazy-load + cache wrapper around THREE.TextureLoader (mirrors
// TmntSewerSlide/src/entities/textureLoader.js) -- keeps data/*.js holding
// plain string URLs, not live THREE.Texture instances, so a future art swap
// only ever touches a URL string, never loading logic.

import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();

export function getTexture(url) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(url, texture);
  return texture;
}
