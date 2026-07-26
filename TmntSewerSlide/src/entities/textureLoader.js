// Tiny lazy-load + cache wrapper around THREE.TextureLoader, shared by
// player/obstacles/pickups. Keeps data/*Types.js holding plain string URLs
// (data-only, per §9.3's "keep reskinnable content in /data") rather than
// live THREE.Texture instances, so the art pass only ever has to edit a URL
// string, never touch loading logic.

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
