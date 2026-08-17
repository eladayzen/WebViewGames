// Texture loading, with procedural placeholders for anything not yet authored.
//
// Part of /render, so this is one of the only files allowed to touch renderer
// APIs (§9.1). Everything it exports is opaque handles the rest of the render
// layer draws with; no system outside /render ever sees a Texture.
//
// Two of these are procedural ON PURPOSE and are not placeholders:
//   * the additive particle sprite -- a radial falloff generated at runtime
//     has perfectly clean alpha, which is exactly what additive blending
//     wants, and no generated PNG would improve it;
//   * the air-entity shadow blob -- likewise one soft radial, tinted and
//     scaled per entity (§5.4 specifies exactly that: "one shared texture,
//     tinted and scaled").
//
// Everything else falls back to a flat coloured placeholder that is obviously
// programmer art, so a missing asset reads as missing rather than as a
// styling choice. Per §2, the SURFACE is the one thing that may not be a
// placeholder at POC -- the scroll feeling cannot be judged against a noise
// field -- so a missing surface texture is reported loudly.

import { Assets, Texture } from 'pixi.js';

export const ASSET_MANIFEST = {
  // The one asset that must be real at POC (§2, §10 POC-3). Two of §5.4's five
  // sector surfaces are built; /data/surfaces.js maps a surface id to the two
  // keys below, and nothing outside /render ever names a texture key directly.
  //
  // Base tiles are JPEG, not PNG: they are opaque full-frame textures with no
  // alpha to preserve, and PNG costs ~3.3-3.9 MB each against ~0.6-0.8 MB at
  // q90. Glow layers stay PNG -- they are almost entirely pure black, which PNG
  // compresses to nothing, and JPEG ringing in a black field would show up as
  // haze under additive blending.
  surfaceAshfallBase: 'assets/surface-ashfall-base.jpg',
  surfaceAshfallGlow: 'assets/surface-ashfall-glow.png',
  surfaceKesselringBase: 'assets/surface-kesselring-base.jpg',
  surfaceKesselringGlow: 'assets/surface-kesselring-glow.png',
  surfaceBulwarkBase: 'assets/surface-bulwark-base.jpg',
  surfaceBulwarkGlow: 'assets/surface-bulwark-glow.png',
  shipLevel: 'assets/ship-level.png',
  shipRollL: 'assets/ship-roll-l.png',
  shipRollR: 'assets/ship-roll-r.png',
  // Air enemies (§6.2). One image per body, rotated at runtime to heading.
  drone: 'assets/enemy-drone.png',
  emitter: 'assets/enemy-emitter.png',
  // Level two's two types (§6.2). Chromatically separated from everything
  // already on the playfield: crimson and bone-ivory against the player's
  // blue-and-white, the drone's purple and the Emitter's acid jade.
  warden: 'assets/enemy-warden.png',
  splitter: 'assets/enemy-splitter.png',
  bolt: 'assets/proj-player-bolt.png',
  // The pickup weapon's round (WEAPONS.scatter). Cyan-white like every other
  // player projectile -- §5.4's ownership coding admits no exceptions, so a
  // temporary weapon changes shape and never side.
  spread: 'assets/proj-player-spread.png',
  orb: 'assets/proj-enemy-orb.png',
  // The pickup itself (§5.6). One static sprite, spun and pulsed at runtime.
  pickupWeapon: 'assets/pickup-weapon.png',
  // Boss (§6.4): one hull + one pod + one blown pod, instanced four times.
  bossCinderjawHull: 'assets/boss-cinderjaw-hull.png',
  bossPod: 'assets/boss-pod.png',
  bossPodDead: 'assets/boss-pod-dead.png',
  // Boss two -- Brood Gantry. One hull plus THREE bay states, because the
  // fight's mechanic is a bay that opens and shuts: the shut state is the
  // difference between "this is armour" and "this is a target that is closed",
  // and a fight that cannot say which is the fight boss one shipped as.
  bossBroodGantryHull: 'assets/boss-broodgantry-hull.png',
  bossBayOpen: 'assets/boss-bay-open.png',
  bossBayShut: 'assets/boss-bay-shut.png',
  bossBayDead: 'assets/boss-bay-dead.png',
  // The shared damage overlay (§6.2), tinted and scaled per entity.
  scorch: 'assets/fx-scorch.png',
  // Props, ONE SET PER SURFACE. Keys are named through /data/surfaces.js and
  // nothing outside /render resolves one -- so a fourth surface's props are a
  // row there plus four rows here, and no code path changes.
  propAshfallContainer: 'assets/prop-ashfall-container.png',
  propAshfallRock: 'assets/prop-ashfall-rock.png',
  propAshfallWreck: 'assets/prop-ashfall-wreck.png',
  propAshfallPipe: 'assets/prop-ashfall-pipe.png',
  propKesselringPallet: 'assets/prop-kesselring-pallet.png',
  propKesselringHatch: 'assets/prop-kesselring-hatch.png',
  propKesselringRig: 'assets/prop-kesselring-rig.png',
  propKesselringCradle: 'assets/prop-kesselring-cradle.png',
  propBulwarkClamp: 'assets/prop-bulwark-clamp.png',
  propBulwarkMast: 'assets/prop-bulwark-mast.png',
  propBulwarkGrille: 'assets/prop-bulwark-grille.png',
  propBulwarkManifold: 'assets/prop-bulwark-manifold.png',
};

const tex = {};
const missing = new Set();

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  return Texture.from(c);
}

/** Soft radial falloff, white -> transparent. Used additively for every
 *  particle, bloom flash and glow in the game. */
function makeParticle() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.62)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

/** The altitude cue (§5.4): a small soft dark blob under every air entity.
 *  This is what sells "flying low over" rather than "lying on". */
function makeShadow() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function placeholderShip(roll) {
  return canvasTexture(140, 160, (g, w, h) => {
    g.translate(w / 2, h / 2);
    // Roll only -- the silhouette stays vertically aligned and the nose stays
    // north (§0.2). A placeholder that yawed would teach the wrong shape.
    g.scale(1 - Math.abs(roll) * 0.28, 1);
    g.beginPath();
    g.moveTo(0, -h / 2 + 8);
    g.lineTo(w / 2 - 10, h / 2 - 30);
    g.lineTo(14, h / 2 - 44);
    g.lineTo(10, h / 2 - 8);
    g.lineTo(-10, h / 2 - 8);
    g.lineTo(-14, h / 2 - 44);
    g.lineTo(-w / 2 + 10, h / 2 - 30);
    g.closePath();
    g.fillStyle = roll === 0 ? '#3f7fd8' : roll < 0 ? '#3670c4' : '#4a8ce8';
    g.fill();
    g.strokeStyle = '#cfe9ff';
    g.lineWidth = 3;
    g.stroke();
  });
}

function placeholderDrone() {
  return canvasTexture(110, 110, (g, w, h) => {
    g.translate(w / 2, h / 2);
    g.beginPath();
    g.moveTo(0, h / 2 - 10);
    g.lineTo(w / 2 - 8, -6);
    g.lineTo(10, -h / 2 + 12);
    g.lineTo(-10, -h / 2 + 12);
    g.lineTo(-w / 2 + 8, -6);
    g.closePath();
    // Enemy craft stay chromatically separated from the player's blue-and-
    // white -- purple/magenta (§9.5 rule 7). concept-02 is the counter-example.
    g.fillStyle = '#7a3fb0';
    g.fill();
    g.strokeStyle = '#e37bff';
    g.lineWidth = 3;
    g.stroke();
  });
}

/** Wide, squat, no attack wings -- even the placeholder has to read as a craft
 *  that HOLDS ITS SLOT, because that silhouette is the type's whole point. */
function placeholderEmitter() {
  return canvasTexture(140, 104, (g, w, h) => {
    g.translate(w / 2, h / 2);
    g.beginPath();
    g.moveTo(-34, -h / 2 + 8);
    g.lineTo(34, -h / 2 + 8);
    g.lineTo(52, 0);
    g.lineTo(28, h / 2 - 10);
    g.lineTo(-28, h / 2 - 10);
    g.lineTo(-52, 0);
    g.closePath();
    // Acid jade, separated from BOTH the player's blue-white and the drone's
    // purple, so ownership stays readable at a glance (§5.4).
    g.fillStyle = '#2f6b45';
    g.fill();
    g.strokeStyle = '#9dff5a';
    g.lineWidth = 3;
    g.stroke();
    // The outrigger emitter drums.
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.arc(sx * 58, 0, 12, 0, Math.PI * 2);
      g.fillStyle = '#c8ff6a';
      g.fill();
    }
    // The firing bar across the front.
    g.fillStyle = '#c8ff6a';
    g.fillRect(-30, -h / 2 + 14, 60, 7);
  });
}

/** Heavy, slab-sided, four shield nacelles -- even the placeholder has to read
 *  as the craft that does NOT die on approach, because that is the whole type
 *  (§6.2). Oxblood crimson: the only red hull on the playfield. */
function placeholderWarden() {
  return canvasTexture(132, 156, (g, w, h) => {
    g.translate(w / 2, h / 2);
    g.beginPath();
    g.moveTo(0, -h / 2 + 6);
    g.lineTo(26, -h / 2 + 34);
    g.lineTo(w / 2 - 6, 10);
    g.lineTo(28, h / 2 - 8);
    g.lineTo(-28, h / 2 - 8);
    g.lineTo(-w / 2 + 6, 10);
    g.lineTo(-26, -h / 2 + 34);
    g.closePath();
    g.fillStyle = '#5a1420';
    g.fill();
    g.strokeStyle = '#2a2026';
    g.lineWidth = 5;
    g.stroke();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.beginPath();
      g.arc(sx * 48, sy * 34, 13, 0, Math.PI * 2);
      g.fillStyle = '#ffab3c';
      g.fill();
    }
  });
}

/** A clam-shell split down the centre, halves already parting -- the
 *  silhouette has to say "this comes apart" before it does (§6.2). Bone ivory
 *  with a hot magenta seam: the only pale hull in the game. */
function placeholderSplitter() {
  return canvasTexture(120, 160, (g, w, h) => {
    g.translate(w / 2, h / 2);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 4, -h / 2 + 6);
      g.lineTo(s * (w / 2 - 6), 18);
      g.lineTo(s * (w / 2 - 20), h / 2 - 10);
      g.lineTo(s * 6, h / 2 - 10);
      g.closePath();
      g.fillStyle = '#ded6c6';
      g.fill();
      g.strokeStyle = '#8f8676';
      g.lineWidth = 3;
      g.stroke();
    }
    g.fillStyle = '#ff3fd0';
    g.fillRect(-2, -h / 2 + 6, 4, h - 16);
  });
}

/** Wide capital hull lying lengthwise, with four empty pod sockets (§6.4). */
function placeholderBossHull() {
  return canvasTexture(1024, 376, (g, w, h) => {
    g.fillStyle = '#241c30';
    g.beginPath();
    g.moveTo(6, h / 2);
    g.lineTo(w * 0.16, 24);
    g.lineTo(w - 12, 46);
    g.lineTo(w - 12, h - 46);
    g.lineTo(w * 0.16, h - 24);
    g.closePath();
    g.fill();
    g.strokeStyle = '#ff5fc0';
    g.lineWidth = 4;
    g.stroke();
    for (const dx of [0.13, 0.255, 0.452, 0.818]) {
      g.beginPath();
      g.arc(w * dx, h / 2, 34, 0, Math.PI * 2);
      g.fillStyle = '#141018';
      g.fill();
    }
  });
}

function placeholderPod(dead) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.translate(w / 2, h / 2);
    g.beginPath();
    g.arc(0, 0, w / 2 - 8, 0, Math.PI * 2);
    g.fillStyle = dead ? '#1a1a1e' : '#3a2c46';
    g.fill();
    g.strokeStyle = dead ? '#4a4a52' : '#ff4fbf';
    g.lineWidth = 10;
    g.stroke();
  });
}

/** Soft dark blotch. Only ever used if the real scorch decal is absent. */
function placeholderScorch() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(10,8,8,0.95)');
    grad.addColorStop(0.6, 'rgba(24,18,16,0.55)');
    grad.addColorStop(1, 'rgba(24,18,16,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function placeholderBolt() {
  return canvasTexture(24, 64, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(190,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
    g.fill();
  });
}

function placeholderOrb() {
  return canvasTexture(96, 96, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,235,255,1)');
    grad.addColorStop(0.35, 'rgba(238,64,196,0.95)');
    grad.addColorStop(0.7, 'rgba(255,132,42,0.75)');
    grad.addColorStop(1, 'rgba(255,132,42,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

/** The pickup canister (§5.6) -- a bright hexagonal pod with a cyan-white
 *  core and an up-chevron on its face. It has to read as YOURS at a glance:
 *  the frame's whole orange/magenta vocabulary means "this will hurt you", so
 *  a collectable that is not obviously cyan-white is a collectable the player
 *  will dodge. */
function placeholderPickup() {
  return canvasTexture(160, 160, (g, w, h) => {
    g.translate(w / 2, h / 2);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 64;
      const y = Math.sin(a) * 64;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = '#b9c3ce';
    g.fill();
    g.strokeStyle = '#f0c66a';
    g.lineWidth = 6;
    g.stroke();
    const grad = g.createRadialGradient(0, 0, 2, 0, 0, 40);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(120,240,255,0.95)');
    grad.addColorStop(1, 'rgba(120,240,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, 40, 0, Math.PI * 2);
    g.fill();
  });
}

/** The pickup weapon's round: short, fat, blunt -- deliberately unlike the
 *  standard bolt's 1:2.8 shard, so the stream visibly thickens on collection
 *  (WEAPONS.scatter). Drawn on black, like every projectile, because it is
 *  composited additively. */
function placeholderSpread() {
  return canvasTexture(64, 104, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h * 0.36, 2, w / 2, h * 0.45, h * 0.5);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(200,248,255,0.9)');
    grad.addColorStop(1, 'rgba(140,220,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

/** Brood Gantry's bays (§6.4). Three states that must be unmistakable from
 *  each other at 126 px, because telling them apart IS the fight's rule. */
function placeholderBay(state) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.translate(w / 2, h / 2);
    g.beginPath();
    g.arc(0, 0, w / 2 - 10, 0, Math.PI * 2);
    g.fillStyle = '#1b1b22';
    g.fill();
    g.strokeStyle = '#5c5c68';
    g.lineWidth = 12;
    g.stroke();
    if (state === 'open') {
      g.beginPath();
      g.arc(0, 0, w / 2 - 44, 0, Math.PI * 2);
      g.fillStyle = '#ff2fc8';
      g.fill();
    } else if (state === 'shut') {
      g.strokeStyle = '#3a3a44';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(-(w / 2 - 26), 0);
      g.lineTo(w / 2 - 26, 0);
      g.stroke();
    } else {
      g.fillStyle = '#000000';
      g.beginPath();
      g.arc(0, 0, w / 2 - 48, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function placeholderProp(i) {
  const cols = ['#4a4b55', '#3a3b44', '#55474a', '#43484f'];
  return canvasTexture(120, 90, (g, w, h) => {
    g.fillStyle = cols[i % cols.length];
    g.fillRect(8, 8, w - 16, h - 16);
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 4;
    g.strokeRect(8, 8, w - 16, h - 16);
  });
}

/** Obvious programmer-art surface, only ever used if the real texture is
 *  absent. §2 makes the surface the one POC asset that may NOT be a
 *  placeholder, so this path also logs. */
function placeholderSurface() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#14151c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,90,30,0.30)';
    g.lineWidth = 3;
    for (let i = 0; i < 24; i++) {
      g.beginPath();
      const x = Math.random() * w;
      const y = Math.random() * h;
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 160);
      g.stroke();
    }
  });
}

const emptyGlow = () => canvasTexture(8, 8, (g) => g.clearRect(0, 0, 8, 8));

const PLACEHOLDERS = {
  surfaceAshfallBase: placeholderSurface,
  surfaceAshfallGlow: emptyGlow,
  surfaceKesselringBase: placeholderSurface,
  surfaceKesselringGlow: emptyGlow,
  surfaceBulwarkBase: placeholderSurface,
  surfaceBulwarkGlow: emptyGlow,
  shipLevel: () => placeholderShip(0),
  shipRollL: () => placeholderShip(-1),
  shipRollR: () => placeholderShip(1),
  drone: placeholderDrone,
  emitter: placeholderEmitter,
  warden: placeholderWarden,
  splitter: placeholderSplitter,
  bolt: placeholderBolt,
  spread: placeholderSpread,
  orb: placeholderOrb,
  pickupWeapon: placeholderPickup,
  bossCinderjawHull: placeholderBossHull,
  bossPod: () => placeholderPod(false),
  bossPodDead: () => placeholderPod(true),
  bossBroodGantryHull: placeholderBossHull,
  bossBayOpen: () => placeholderBay('open'),
  bossBayShut: () => placeholderBay('shut'),
  bossBayDead: () => placeholderBay('dead'),
  scorch: placeholderScorch,
};
// Every prop falls back to the same flat programmer-art block, keyed by
// position in the manifest so a missing prop is obvious without needing a
// bespoke placeholder per rock.
let _propN = 0;
for (const key of Object.keys(ASSET_MANIFEST)) {
  if (key.startsWith('prop')) {
    const i = _propN++;
    PLACEHOLDERS[key] = () => placeholderProp(i);
  }
}

export async function loadTextures() {
  tex.particle = makeParticle();
  tex.shadow = makeShadow();

  await Promise.all(
    Object.keys(ASSET_MANIFEST).map(async (key) => {
      try {
        tex[key] = await Assets.load(ASSET_MANIFEST[key]);
      } catch {
        missing.add(key);
        tex[key] = PLACEHOLDERS[key]();
      }
    })
  );

  if (missing.size) {
    console.warn(
      `[NovaVanguard/art] placeholder art in use for: ${[...missing].join(', ')}`
    );
    if (missing.has('surfaceAshfallBase')) {
      console.error(
        '[NovaVanguard/art] the SURFACE is on a placeholder. §2 makes the ' +
          'surface the one POC asset that must be real — the scroll feeling ' +
          'cannot be judged against programmer art, so POC-8 is not valid in ' +
          'this state.'
      );
    }
  }
  return tex;
}

export function T(name) {
  return tex[name];
}

export function missingAssets() {
  return [...missing];
}
