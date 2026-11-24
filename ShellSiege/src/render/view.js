// THE CAMERA, THE LIGHT AND THE AIR.
//
// A FIXED ISOMETRIC CAMERA, which is a design decision and not a shortcut.
// The reference footage never rotates its camera, and neither does Diablo:
// one unchanging viewing angle is what lets a player read a crowd at a glance,
// because every silhouette is always presented the same way. It also means the
// lean-to-world mapping is one constant rotation (core/axes.js) instead of
// something the player has to re-learn every time the view swings.
//
// WHY PERSPECTIVE AND NOT ORTHOGRAPHIC. A true ortho camera is the textbook
// isometric answer and it looks dead: with no convergence the pillars at the
// back of the plaza are exactly as wide as the ones at the front and the floor
// has no sense of receding. A long lens -- a narrow FOV from far back -- keeps
// almost all of ortho's readability and gives back just enough convergence for
// the room to have depth.
//
// EVERY NUMBER HERE IS A URL OVERRIDE, because none of them can be settled at
// a desk. The whole point of the prototype is to stand on a board and find out
// whether the pitch is right.
//
//   ?yaw=45     camera azimuth, degrees      ?pitch=50  how far down it looks
//   ?cdist=17.1 how far back, in units       ?vieww=19.2 units visible across
//   ?exp=1.25   tone-mapping exposure
import * as THREE from 'three';
import { ARENA } from '../core/world.js';
import { u } from './units.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};
const rad = (deg) => (deg * Math.PI) / 180;

export const CAM = {
  yaw: rad(num('yaw', 45)),
  pitch: rad(num('pitch', 50)),
  dist: num('cdist', 22),
  // How much of the world is visible ACROSS the screen. Sized against the
  // WIDTH on purpose: a narrower phone then shows less height rather than
  // zooming the whole scene in, which is the rule Nova Vanguard landed on
  // after its board screens came out cropped on the short edge.
  // 20 units across, which is DELIBERATELY TIGHTER than the reference.
  // Measured off the footage, that game puts its player at about 11.5% of the
  // screen height; 24 units here reproduces that exactly, and on a board it
  // was too small. The reference is a phone game held at arm's length and this
  // is played standing back from the screen on a balance board, so the
  // character has to carry further. 20 units puts Raphael at about 14%.
  viewWidth: num('vieww', 20),
  // How quickly the camera catches up to the player, as a fraction per second.
  // Not zero: a camera welded to the player makes the whole screen twitch with
  // every deadzone stutter, and the board stutters.
  lag: num('clag', 9),
};

/** The haze the plaza fades into. */
// WAS 0x16242c, A NEAR-BLACK BLUE. The room read as a cave, and because fog
// colour is also the background colour it set the value of every pixel the
// floor does not cover -- so the single darkest colour in the scene was the
// one filling the edges of the screen. A pale warm haze is the single biggest
// lever on "much less dark" and costs nothing.
//
// Fog NEAR has to sit beyond the camera's own distance to the player (22) or
// the player is the first thing it eats.
export const FOG = {
  color: QS.get('fog') ? Number('0x' + QS.get('fog').replace('#', '')) : 0x8d94a0,
  near: num('fnear', 30),
  far: num('ffar', 62),
};

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // 1.25, DOWN FROM 1.5 (and 1.75 before that). A retina phone renders roughly a quarter fewer
  // fragments at 1.5, and on a floor shaded per-pixel with several lights that
  // is the single cheapest frame-rate win available. Nothing in this scene is
  // thin enough to alias badly at 1.5 -- the art is big painted shapes and the
  // one hairline, the rune ring, is additive and soft by construction.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, num('dpr', 1.25)));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = num('exp', 1.2);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
  scene.background = new THREE.Color(FOG.color);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 120);

  // THE SKY HERE IS A CEILING, so the "sky" colour is the cool bounce off wet
  // stone rather than anything blue. Carrying most of the exposure on the
  // hemisphere rather than the key light is what keeps this "a bit less dark"
  // than the reference without flattening it: the shadows lift, the highlights
  // stay where the key put them.
  //
  // THE SKY IS NOT TEAL, even though the room is. The floor painting already
  // carries all the green it needs; tinting the light green on top of it
  // doubled the cast, washed the stone out to a flat mint, and put a green
  // turtle in front of a green wall. A cool neutral grey-blue lets the
  // painting's own colour read and keeps Raphael the only saturated green on
  // screen, which is the whole legibility argument for this camera.
  //
  // THE GROUND BOUNCE IS NOW WARM, because the floor under it is. A sandstone
  // plaza throws warm light back up; leaving the bounce at the old cold
  // 0x232f36 would have put a cold shadow side on a character standing on a
  // warm floor, which is the specific tell that makes a figure look pasted on.
  //
  // INTENSITY 0.85 -> 1.3. "Much less dark" is carried HERE rather than on the
  // key, on purpose: raising the key would deepen every shadow by the same
  // amount it brightened the lit side, which makes a scene more contrasty, not
  // less dark. Raising the ambient lifts the floor of the whole image.
  const hemi = new THREE.HemisphereLight(0xdde4e8, 0x7a6a53, num('hemi', 1.3));
  scene.add(hemi);

  // One warm key from the upper LEFT of the screen, so it reads against the
  // teal bounce and so Raphael's lit side is the side facing the player.
  const key = new THREE.DirectionalLight(0xffeccb, num('key', 1.0));
  key.position.set(-Math.sin(CAM.yaw) * 10 + 18, 16, Math.cos(CAM.yaw) * 10 + 18);
  key.target.position.set(18, 0, 18);
  scene.add(key, key.target);

  const target = new THREE.Vector3(u(ARENA.width / 2), 0, u(ARENA.height / 2));

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const aspect = w / h;
    camera.aspect = aspect;
    // Vertical FOV derived from the horizontal span we want -- see CAM.viewWidth.
    const halfH = CAM.viewWidth / 2 / aspect;
    camera.fov = (2 * Math.atan(halfH / CAM.dist) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  /** Put the camera behind and above `target`, at the fixed angle. */
  function place() {
    const ch = Math.cos(CAM.pitch) * CAM.dist;
    camera.position.set(
      target.x + Math.cos(CAM.yaw) * ch,
      target.y + Math.sin(CAM.pitch) * CAM.dist,
      target.z + Math.sin(CAM.yaw) * ch,
    );
    camera.lookAt(target);
  }

  /** Ease the look-at point toward the player, in SIM px. */
  function follow(simX, simY, dt) {
    const k = 1 - Math.exp(-CAM.lag * dt);
    target.x += (u(simX) - target.x) * k;
    target.z += (u(simY) - target.z) * k;
    place();
  }

  resize();
  place();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, hemi, key, resize, follow, place, target };
}
