import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBlobShadow } from './shadow.js';

// Body comes from an imported, payload-optimized mesh (see preloadCarAsset())
// when available -- originally a 13MB PBR asset (four 2048px texture maps);
// stripped down to geometry + one recompressed 512px base-color texture
// (~1.1MB + ~76KB) since the normal/roughness/metallic maps wouldn't read at
// this camera distance/style anyway and the payload cost wasn't worth it.
// Falls back to the earlier primitive-built hoverboard shape if the asset
// hasn't loaded (e.g. preload failed) -- everything else (hover, thruster
// glow, glow accents, shadow, trail anchor) is shared between both paths.
const HOVER_HEIGHT = 0.22;
const HOVER_AMPLITUDE = 0.05;
const HOVER_SPEED = 2.6;
const THRUSTER_COLOR = 0x5fe0ff;

// Imported mesh orientation/scale -- inferred from the raw bounding box
// (Y was unambiguous, by far the thinnest axis; X vs Z as forward-facing
// was NOT verifiable without rendering it, so this is a best guess). If the
// car turns out sideways or backwards in a real render, these three
// constants are the only thing that needs adjusting.
const MODEL_SCALE = 1.4;
const MODEL_ROTATE_Y = Math.PI / 2; // swaps the model's local X/Z axes
const MODEL_FACING_FLIP = Math.PI; // confirmed backwards in a real render -- flipped
const MODEL_Y_OFFSET = 0.32; // lifts the model so its bottom sits near y=0
const MODEL_FRONT_Z = -1.2;
const MODEL_REAR_Z = 1.2;
const MODEL_HALF_WIDTH = 1.0;

let sharedCarGeometry = null;
let sharedCarTexture = null;

// Call once at boot, before any createCarModel() calls, and await it -- the
// geometry/texture are shared (not cloned) across every car instance.
export async function preloadCarAsset() {
  const gltfLoader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();

  const [gltf, texture] = await Promise.all([
    gltfLoader.loadAsync('/models/car-body.glb'),
    textureLoader.loadAsync('/textures/car-livery.jpg'),
  ]);

  let geometry = null;
  gltf.scene.traverse((child) => {
    if (child.isMesh && !geometry) geometry = child.geometry;
  });
  if (!geometry) throw new Error('car-body.glb has no mesh');

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // glTF UV convention

  sharedCarGeometry = geometry;
  sharedCarTexture = texture;
}

// Self-lit a little (not just base color) so paint stays vivid against the
// dim neon-void ambient instead of reading as a dark, muddy color under
// low light -- this is what "much brighter" actually needed, not just more
// saturated hex values.
function glossy(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.25, metalness: 0.15,
    emissive: color, emissiveIntensity: 0.32,
    ...extra,
  });
}

function createGlowTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const c = new THREE.Color(colorHex);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},0.95)`);
  grad.addColorStop(0.55, `rgba(${rgb},0.4)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

let thrusterGlowMat = null;
function getThrusterGlowMaterial() {
  if (!thrusterGlowMat) {
    thrusterGlowMat = new THREE.MeshBasicMaterial({
      map: createGlowTexture(THRUSTER_COLOR),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
  }
  return thrusterGlowMat;
}

const HEADLIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
const TAILLIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xff4444 });

function buildImportedBody(group) {
  // No per-car color tint on the body: MeshStandardMaterial multiplies
  // `map` by `color`, and a saturated tint (the same approach the flat
  // primitive cars use) crushed the actual livery -- white paint went flat
  // solid blue, the orange accent panels in the texture went muddy brown
  // instead of reading as orange. Per-car identity now lives entirely in
  // the glow accents (edge strips/vents, driven by accentColor below), not
  // the body paint -- the whole point of the real texture was to show it.
  // Low roughness + a little metalness for the "glowing plastic/metal"
  // sheen that was asked for; a soft white emissive lift (not a color, so
  // it can't wash out the texture) keeps it visible against the dim
  // neon-void ambient the same way every other material in this game does.
  const material = new THREE.MeshStandardMaterial({
    map: sharedCarTexture, color: 0xffffff,
    roughness: 0.16, metalness: 0.3,
    emissive: 0xffffff, emissiveIntensity: 0.08,
  });
  const mesh = new THREE.Mesh(sharedCarGeometry, material);
  mesh.rotation.y = MODEL_ROTATE_Y + MODEL_FACING_FLIP;
  mesh.scale.setScalar(MODEL_SCALE);
  mesh.position.y = MODEL_Y_OFFSET;
  group.add(mesh);
}

function buildPrimitiveBody(group, { bodyMat, accentMat, darkMat }, detailed) {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 2.5), bodyMat);
  deck.position.y = 0.36;
  group.add(deck);

  // Diamond-cut nose cap: a box rotated 45 deg pokes a sharp point out past
  // the deck's flat front edge -- an angular tip with no cone/rounding.
  const noseCap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.85), bodyMat);
  noseCap.rotation.y = Math.PI / 4;
  noseCap.position.set(0, 0.36, -1.68);
  group.add(noseCap);

  // Raised canopy hump -- on every car, detailed or not, so even the plain
  // traffic variant has a visible top silhouette instead of reading as a
  // flat plank from behind.
  const hump = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.95), accentMat);
  hump.position.set(0, 0.65, -0.15);
  group.add(hump);

  if (detailed) {
    const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 1.0), darkMat);
    dorsal.position.set(0, 0.86, -0.15);
    group.add(dorsal);

    const finGeo = new THREE.BoxGeometry(0.06, 0.3, 0.85);
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.position.set(side * 0.76, 0.56, 0.85);
      fin.rotation.z = side * -0.3;
      fin.rotation.y = side * 0.18;
      group.add(fin);
    }

    // Floating blade spoiler -- no struts, reads as hover-tech rather than
    // a mounted car part.
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.22), accentMat);
    spoiler.position.set(0, 0.78, 1.25);
    group.add(spoiler);
  }
}

// Shared car factory -- player and traffic craft are both this same shape,
// just different colors/detail level.
export function createCarModel({ bodyColor, accentColor = 0xff8a2f, detailed = true }) {
  const group = new THREE.Group();
  const accentMat = glossy(accentColor);

  const usingImportedBody = !!(sharedCarGeometry && sharedCarTexture);
  if (usingImportedBody) {
    buildImportedBody(group);
  } else {
    const bodyMat = glossy(bodyColor);
    const darkMat = glossy(0x14141a, { roughness: 0.45 });
    buildPrimitiveBody(group, { bodyMat, accentMat, darkMat }, detailed);
  }

  const frontZ = usingImportedBody ? MODEL_FRONT_Z : -1.55;
  const rearZ = usingImportedBody ? MODEL_REAR_Z : 1.2;
  const halfWidth = usingImportedBody ? MODEL_HALF_WIDTH : 0.76;
  const midY = usingImportedBody ? MODEL_Y_OFFSET : 0.36;

  const lightGeo = new THREE.BoxGeometry(0.26, 0.1, 0.06);
  for (const x of [-0.55, 0.55]) {
    const hl = new THREE.Mesh(lightGeo, HEADLIGHT_MAT);
    hl.position.set(x, midY, frontZ);
    group.add(hl);
    const tl = new THREE.Mesh(lightGeo, TAILLIGHT_MAT);
    tl.position.set(x, midY, rearZ);
    group.add(tl);
  }

  // Glowing accent details -- pure emissive (unlit MeshBasicMaterial, no
  // glow-texture trick needed), left for the postFX bloom pass to pick up.
  // Sized conservatively (short, tucked inboard) on the imported body: its
  // real footprint is still a best-guess from raw bounding-box numbers, and
  // a long strip at the guessed half-width is exactly what turned into
  // stray "wing" shapes sticking out past the actual mesh in a real render.
  const glowAccentMat = new THREE.MeshBasicMaterial({ color: accentColor });
  const edgeLengthFactor = usingImportedBody ? 0.35 : 0.85;
  const edgeInset = usingImportedBody ? 0.6 : 1.0;
  const edgeGeo = new THREE.BoxGeometry(0.05, 0.06, (rearZ - frontZ) * edgeLengthFactor);
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(edgeGeo, glowAccentMat);
    edge.position.set(side * halfWidth * edgeInset, midY * 0.55, (frontZ + rearZ) / 2);
    group.add(edge);
  }
  const ventGeo = new THREE.SphereGeometry(0.07, 8, 6);
  for (const side of [-1, 1]) {
    const vent = new THREE.Mesh(ventGeo, glowAccentMat);
    vent.position.set(side * halfWidth * 0.35, midY * 0.6, rearZ);
    group.add(vent);
  }

  // Underside thruster glow -- static decal, not a particle system (that's
  // the trail VFX, layered on top of this in vfx.js).
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, rearZ - frontZ + 1.1), getThrusterGlowMaterial());
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.03, (frontZ + rearZ) / 2 + 0.3);
  group.add(glow);

  const shadow = createBlobShadow(rearZ - frontZ + 0.4);
  shadow.position.y = 0.015;
  group.add(shadow);

  // World-space mount point for the trail VFX (vfx.js reads this via
  // getWorldPosition each frame rather than duplicating the rear offset).
  const trailAnchor = new THREE.Object3D();
  trailAnchor.position.set(0, 0.1, rearZ + 0.2);
  group.add(trailAnchor);

  group.userData.shadow = shadow;
  group.userData.trailAnchor = trailAnchor;
  group.userData.hoverPhase = Math.random() * Math.PI * 2;
  group.position.y = HOVER_HEIGHT;
  return group;
}

export function updateHover(car, dt) {
  car.userData.hoverPhase += dt * HOVER_SPEED;
  const y = HOVER_HEIGHT + Math.sin(car.userData.hoverPhase) * HOVER_AMPLITUDE;
  car.position.y = y;
  // Shadow is a child (so x/z stay in sync for free); cancel the parent's
  // y-hover here so it stays pinned to the ground instead of hovering too.
  car.userData.shadow.position.y = -y + 0.02;
}
