import * as THREE from 'three';
import { tunnelCenterAt } from './spline.js';
import { CROSS_SECTIONS } from './crossSection.js';
import ring1Url from '../assets/tunnel_ring_1.jpg';
import ring2Url from '../assets/tunnel_ring_2.jpg';
import ring3Url from '../assets/tunnel_ring_3.jpg';

// --- Wall material: real illustrated ring segments --------------------------
// Earlier versions of this file tried a single continuous tube with a
// code-drawn procedural canvas texture (rectangles-on-gradient, then a
// tinted photo) spinning via texture.offset -- exactly the "generic
// proceduralized 3D" anti-pattern this pipeline wants to avoid for
// environment surfaces (ground/walls), same issue Astro_Tunnel has. Per
// concept-01..04 and tunnelRef.png, the wall should be real hand-painted,
// cel-shaded illustrated art matching the character/prop sprites' own style
// -- so it's Kolbo-generated (nano-banana-pro, styled off concept-01) like
// every other asset in this game, not code-drawn. Three ring images cycle
// across consecutive tunnel segments so it doesn't read as one repeating
// tile, matching the user's explicit "texture on each ring section" note.
const RING_IMAGE_URLS = [ring1Url, ring2Url, ring3Url];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadRingTextures() {
  const images = await Promise.all(RING_IMAGE_URLS.map(loadImage));
  return images.map((img) => {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  });
}

// Per-pipe-section mood (§5.4: storm drain -> main line -> treatment chamber
// should read as distinct). Kept as a light multiply tint on top of the
// illustrated art rather than a strong wash -- the whole point of switching
// to real art was to make that detail the star, not bury it again.
const SECTION_TINTS = [0xffffff, 0xe7f7d6, 0xd9f5df];

// Concept art's glow is a floor-level light pool, not an even wash over the
// whole wall -- per-vertex color keyed to each vertex's actual world-space
// height relative to the tube's OWN centerline (not texture UV, which has no
// idea where "down" is) gives a true bright-at-floor/dark-at-ceiling
// gradient that stays correct through the spline's bends, and conveniently
// masks the one hard seam where each image's own vertical gradient wraps
// around the full circumference and meets itself.
const FLOOR_GLOW = new THREE.Color(0xffffff);
const CEILING_DARK = new THREE.Color(0x141f1c);

function paintFloorGlowVertexColors(geo, radius) {
  const posAttr = geo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const v = new THREE.Vector3();
  const tmp = new THREE.Color();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    const center = tunnelCenterAt(v.z);
    const dy = v.y - center.y; // this vertex's height relative to the tube's own local center
    const t = THREE.MathUtils.clamp((radius - dy) / (2 * radius), 0, 1); // 1 at floor, 0 at ceiling
    tmp.copy(CEILING_DARK).lerp(FLOOR_GLOW, Math.pow(t, 1.7));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// Discrete non-repeating ring segments, NOT one continuous mesh with a
// scrolling repeated texture -- each segment gets one full illustrated image
// mapped once (no tiling), cycling through the 3 ring variants so
// consecutive segments read as distinct painted panels, matching how the
// concept art's tunnel is built from individual riveted ring sections.
const SEGMENT_LENGTH = 20; // tuned close to circumference/image-aspect so the art doesn't visibly squash
const SEGMENT_COUNT = 14; // matches this file's reachable-rail total span (14 * 18) for a comparable draw distance
const SEGMENT_TUBULAR_SEGMENTS = 6;
const SEGMENT_RADIAL_SEGMENTS = 32;

function buildSegmentGeometry(frontZ, radius) {
  const localSamples = 6;
  const points = [];
  for (let i = 0; i <= localSamples; i++) {
    const z = frontZ - (SEGMENT_LENGTH * i) / localSamples;
    const c = tunnelCenterAt(z);
    points.push(new THREE.Vector3(c.x, c.y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, SEGMENT_TUBULAR_SEGMENTS, radius, SEGMENT_RADIAL_SEGMENTS, false);
}

function makeSegment(scene, frontZ, radius, texIdx, textures, tint) {
  const geo = buildSegmentGeometry(frontZ, radius);
  paintFloorGlowVertexColors(geo, radius);
  const mat = new THREE.MeshBasicMaterial({
    map: textures[texIdx],
    vertexColors: true,
    color: tint,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return { mesh, geo, mat, anchorZ: frontZ, texIdx };
}

export async function createTunnelWalls(scene, length, radius) {
  const textures = await loadRingTextures();
  const segments = [];
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const frontZ = 20 - i * SEGMENT_LENGTH;
    segments.push(makeSegment(scene, frontZ, radius, i % textures.length, textures, SECTION_TINTS[0]));
  }
  return { segments, textures, radius, totalSpan: SEGMENT_COUNT * SEGMENT_LENGTH, currentTheme: 0 };
}

// Each segment's geometry bakes in absolute world z (via tunnelCenterAt), so
// unlike the decorative rings/particles (which just translate a position),
// a segment that drifts forward needs its curvature resampled at recycle
// time rather than carrying stale bend shape from where it was built --
// cheap since this only fires once per segment per lap, not every frame.
export function scrollTunnelWalls(walls, speed, playerZ) {
  for (const seg of walls.segments) {
    seg.mesh.position.z += speed;
    const effectiveFrontZ = seg.anchorZ + seg.mesh.position.z;
    if (effectiveFrontZ - SEGMENT_LENGTH > playerZ + 8) {
      const newAnchorZ = effectiveFrontZ - walls.totalSpan;
      seg.geo.dispose();
      seg.geo = buildSegmentGeometry(newAnchorZ, walls.radius);
      paintFloorGlowVertexColors(seg.geo, walls.radius);
      seg.mesh.geometry = seg.geo;
      seg.anchorZ = newAnchorZ;
      seg.mesh.position.z = 0;
      seg.texIdx = Math.floor(Math.random() * walls.textures.length);
      seg.mat.map = walls.textures[seg.texIdx];
    }
  }
}

export function setTunnelTheme(walls, themeIndex) {
  walls.currentTheme = themeIndex;
  const tint = SECTION_TINTS[themeIndex];
  for (const seg of walls.segments) {
    seg.mat.color.setHex(tint);
  }
}

// --- Reachable-arc rail ------------------------------------------------------
// The build doc's own "known gap" note (§1, §12): the concept art's single
// painted safe lane predates continuous angular steering and shouldn't be
// built literally. What actually needs to read at a glance is "how much of
// the pipe's circumference can I reach right now" -- a continuously glowing
// arc band at Raphael's own ring radius, spanning exactly the active
// section's cross-section range, not a fixed narrow lane down the middle.
// Built the same way Astro_Tunnel builds its decorative speed rings (partial
// THREE.TorusGeometry segments, positioned via tunnelCenterAt + recycled as
// they scroll toward the camera) -- proven technique, just swapping a full
// ring for a section-shaped arc. THREE.TorusGeometry's own `arc` parameter
// sweeps from local angle 0, so `mesh.rotation.z = section.min` shifts that
// start to line up with our theta convention (same cos/sin-from-+X axis
// Raphael's own position uses), keeping the rail and actual reachable theta
// range exactly in sync -- no UV/Frenet-frame alignment risk.
const RAIL_TUBE_RADIUS = 0.05;
const RAIL_GLOW_COLOR = 0x6dffb0;

export function createReachableRail(scene, ringRadius, count, spacing, sectionKey) {
  const section = CROSS_SECTIONS[sectionKey];
  const arcWidth = section.max - section.min;
  const geo = new THREE.TorusGeometry(ringRadius, RAIL_TUBE_RADIUS, 8, 48, arcWidth);
  const mat = new THREE.MeshBasicMaterial({ color: RAIL_GLOW_COLOR, transparent: true, opacity: 0.85 });
  const segments = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = section.min;
    const z = -i * spacing - spacing;
    const c = tunnelCenterAt(z);
    mesh.position.set(c.x, c.y, z);
    scene.add(mesh);
    segments.push({ mesh, z });
  }
  return { segments, spacing, length: count * spacing, geo, mat, sectionKey, ringRadius };
}

export function scrollReachableRail(rail, speed, playerZ) {
  for (const seg of rail.segments) {
    seg.z += speed;
    if (seg.z > playerZ + 8) {
      seg.z -= rail.length;
    }
    const c = tunnelCenterAt(seg.z);
    seg.mesh.position.set(c.x, c.y, seg.z);
  }
}

// Instant swap when the active section's cross-section changes -- disposes
// the old shared geometry (every segment shares one geometry/material
// instance, so this is one dispose + one new geometry, not per-segment).
export function setRailCrossSection(rail, sectionKey) {
  if (rail.sectionKey === sectionKey) return;
  const section = CROSS_SECTIONS[sectionKey];
  const arcWidth = section.max - section.min;
  rail.geo.dispose();
  rail.geo = new THREE.TorusGeometry(rail.ringRadius, RAIL_TUBE_RADIUS, 8, 48, arcWidth);
  for (const seg of rail.segments) {
    seg.mesh.geometry = rail.geo;
    seg.mesh.rotation.z = section.min;
  }
  rail.sectionKey = sectionKey;
}

// --- Decorative structural rings (full circle, thin) -------------------------
// Sells "built structure" / speed without competing visually with the
// brighter reachable-arc rail. Same technique as Astro_Tunnel's speed rings,
// simplified (no per-ring glow pulse -- that read as too busy against this
// game's calmer, more legible pacing goal).
export function createSpeedRings(scene, radius, count, spacing) {
  const geo = new THREE.TorusGeometry(radius - 0.25, 0.045, 6, 32);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2f6b52, transparent: true, opacity: 0.55 });
  const rings = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    const z = -i * spacing - spacing;
    const c = tunnelCenterAt(z);
    mesh.position.set(c.x, c.y, z);
    scene.add(mesh);
    rings.push({ mesh, z });
  }
  return { rings, spacing, length: count * spacing };
}

export function scrollSpeedRings(decor, speed, playerZ) {
  for (const ring of decor.rings) {
    ring.z += speed;
    if (ring.z > playerZ + 8) {
      ring.z -= decor.length;
    }
    const c = tunnelCenterAt(ring.z);
    ring.mesh.position.set(c.x, c.y, ring.z);
  }
}

// --- Speed dust ---------------------------------------------------------------
const PARTICLE_MIN_RADIUS_FACTOR = 0.65;
const PARTICLE_RADIUS_SPREAD = 0.32;

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
    color: 0xbdffe4,
    size: 0.1,
    transparent: true,
    opacity: 0.7,
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
