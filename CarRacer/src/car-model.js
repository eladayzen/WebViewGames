import * as THREE from 'three';
import { createBlobShadow } from './shadow.js';

// Simple, sharp-edged hoverboard -- angular deck, a diamond-cut nose, a
// blade dorsal fin, swept-back side fins. No rounded bevels anywhere
// (deliberately plainer than the earlier "toy car" pass): a handful of flat
// boxes, glossy paint, no wheels -- it hovers, with a glowing thruster
// underneath and an idle float bob. The deck has real thickness (not a
// thin plank) and every car gets a raised canopy hump -- traffic previously
// had zero vertical detail beyond the flat deck, which read as 2D/hard to
// see; this gives all of them a visible silhouette from behind.
const HOVER_HEIGHT = 0.22;
const HOVER_AMPLITUDE = 0.05;
const HOVER_SPEED = 2.6;
const THRUSTER_COLOR = 0x5fe0ff;

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

// Shared primitive-built hoverboard factory -- player and traffic craft are
// both this same shape, just different colors/detail level.
export function createCarModel({ bodyColor, accentColor = 0xff8a2f, detailed = true }) {
  const group = new THREE.Group();
  const bodyMat = glossy(bodyColor);
  const accentMat = glossy(accentColor);
  const darkMat = glossy(0x14141a, { roughness: 0.45 });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 2.5), bodyMat);
  deck.position.y = 0.36;
  group.add(deck);

  // Diamond-cut nose cap: a box rotated 45 deg pokes a sharp point out past
  // the deck's flat front edge -- an angular tip with no cone/rounding.
  const noseCap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.85), bodyMat);
  noseCap.rotation.y = Math.PI / 4;
  noseCap.position.set(0, 0.36, -1.68);
  group.add(noseCap);

  const lightGeo = new THREE.BoxGeometry(0.26, 0.1, 0.06);
  for (const x of [-0.55, 0.55]) {
    const hl = new THREE.Mesh(lightGeo, HEADLIGHT_MAT);
    hl.position.set(x, 0.36, -1.55);
    group.add(hl);
    const tl = new THREE.Mesh(lightGeo, TAILLIGHT_MAT);
    tl.position.set(x, 0.36, 1.2);
    group.add(tl);
  }

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

  // Underside thruster glow -- static decal, not a particle system (that's
  // the trail VFX, layered on top of this in vfx.js).
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), getThrusterGlowMaterial());
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.03, 1.1);
  group.add(glow);

  const shadow = createBlobShadow(2.6);
  shadow.position.y = 0.015;
  group.add(shadow);

  // World-space mount point for the trail VFX (vfx.js reads this via
  // getWorldPosition each frame rather than duplicating the rear offset).
  const trailAnchor = new THREE.Object3D();
  trailAnchor.position.set(0, 0.1, 1.4);
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
