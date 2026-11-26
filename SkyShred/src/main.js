// SKY SHRED — prototype 1.  RUN on a hovership deck -> DIVE -> GLIDE + DOGFIGHT -> LAND -> RUN ...
// See pipeline/build-docs/SkyShred.md for the spec.  Leg-local coordinates, forward = -Z; each leg is rebuilt at the origin.
import * as THREE from 'three';
import { Leg, DECK_LEN, LAT_MAX } from './path.js';
import { LegWorld, Clouds, makeSkyTexture, GLOW } from './world.js';
import { Rider, HIP } from './rider.js';
import { OpenWorld, THEMES, PORTAL_R } from './open.js';
import { Combat, GUN } from './combat.js';
import { Input } from './input.js';
import { clamp, lerp, damp, smoothstep, easeInOut, mulberry32 } from './util.js';

const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ── tuning (all of it the thing to play with) ──
const T = {
  runSpeed: 12, runLat: 10, runLatMax: 6, camBlendIn: 1.9, camBlendOut: 1.4,
  V0: 22, vDive: 46, vMin: 17, vMax: 46, vClimb: 24,
  latRate: 14, latResp: 6,
  skimH: 14, skimBoost: 8, floor: 1.7, landPull: 3.2,
  nudgeUp: 10, nudgeDown: -7,
};

// ── renderer / scene ──
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = makeSkyTexture();
scene.fog = new THREE.Fog(0xe9c3d8, 170, 980);
const camera = new THREE.PerspectiveCamera(66, 1, 0.3, 1600);
const clouds = new Clouds(scene);
const hemi = new THREE.HemisphereLight(0xfff0e8, 0x8a6a7a, 1.05); scene.add(hemi);
const OPEN = Q.get('open') === '1';   // path legs (run -> dive -> glide -> land) are the default on this branch; ?open=1 is the open-sky mode
const sun = new THREE.DirectionalLight(0xffe2c0, 1.25); sun.position.set(-0.45, 0.9, 0.6); scene.add(sun);
const fx = $('fx'), fxc = fx.getContext('2d');
let W = 1, H = 1;
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  fx.width = W; fx.height = H;
  document.documentElement.style.setProperty('--rr', Math.round(GUN.lockR * H * 2) + 'px');
}
window.addEventListener('resize', resize); resize();

const input = new Input($('hud').parentElement);
const rider = new Rider(scene);
const rnd = mulberry32(42);
const G = {
  phase: 'loading', legIdx: Number(Q.get('leg') || 0), leg: null, world: null, t: 0, paused: false,
  score: 0, mode: Q.get('mode') === 'nudge' ? 'nudge' : 'path', auto: Q.get('auto') === '1',
  // run
  px: 0, pz: 0, runT: 0, deckY: 0, prevWorld: null, secKind: '', landOff: 0, camMix: 0, surf: { top: -Infinity, edge: false },
  // glide
  s: 0, lat: 0, latV: 0, v: 18, nudge: 0, h: 99, y: 0, pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0,
  skimPts: 0, rings: 0, tilt: new THREE.Vector3(0, 0, -1),
  open: OPEN, desc: 0, lvStartS: 0, lvDist: 0, level: 0, guide: { w: 0, st: null, y: 0, x: 0 }, dropT: 0, rebased: false,
  shake: 0, fovKick: 0, lean: 0, camInit: false, landBonus: 0, bannerT: 0,
};
const combat = new Combat(scene, GLOW, {
  kill: (p, big) => { award(big ? 600 : 400, p, big ? 'MISSILE!' : '+400'); G.shake = Math.max(G.shake, big ? 0.9 : 0.35); },
  blast: () => { G.shake = Math.max(G.shake, 1.0); G.fovKick = Math.max(G.fovKick, 6); },
  missile: () => { G.fovKick = Math.max(G.fovKick, 3); },
  foeDown: (kind, p) => { award(kind === 2 ? 150 : 100, p, kind === 2 ? 'KICK!' : '+100'); },
  shake: (v) => { G.shake = Math.max(G.shake, v); },
});

// ── HUD helpers ──
function banner(text, color) {
  const b = $('banner'); b.textContent = text; b.style.color = color || ''; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function award(n, worldPos, label) {
  G.score += n;
  if (worldPos) {
    const v = worldPos.clone().project(camera);
    if (v.z < 1) {
      const d = document.createElement('div'); d.className = 'pop'; d.textContent = label || '+' + n;
      d.style.left = ((v.x * 0.5 + 0.5) * W) + 'px'; d.style.top = ((-v.y * 0.5 + 0.5) * H) + 'px';
      $('hud').appendChild(d); setTimeout(() => d.remove(), 950);
    }
  }
}
const brackets = []; for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.innerHTML = '<span></span>'; d.style.display = 'none'; $('brackets').appendChild(d); brackets.push(d); }
function flash() { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }

// ── leg lifecycle ──
// rb (re-base) is set when a leg ends: the landing ship BECOMES the next leg's start deck, so nothing is swapped --
// the old world is just shifted so the deck sits at the origin, and the new world is built around that same ship.
function startLeg(index, rb = null) {
  const prev = G.world;
  if (G.prevWorld) { G.prevWorld.dispose(); G.prevWorld = null; }
  G.legIdx = index; G.leg = new Leg(index);
  let ship = null;
  if (rb && prev) {
    const O = new THREE.Vector3(rb.x, rb.y, rb.z);
    ship = prev.releaseLanding();
    prev.group.position.copy(O).negate(); G.prevWorld = prev;
    camera.position.sub(O); lookNow.sub(O); clouds.shift(O);
  } else if (prev) prev.dispose();
  G.world = new LegWorld(G.leg, scene, ship);
  combat.reset();
  G.phase = 'run'; G.runT = rb ? 0.5 : 0; G.deckY = 0; G.pz = rb ? rb.pz : 2; G.px = rb ? clamp(rb.px, -T.runLatMax, T.runLatMax) : 0; G.lean = 0;
  G.secKind = ''; G.landOff = 0;
  rider.setMode('run');
  if (!rb) { rider.prone = 0; rider.deploy = 0; }
  rider.root.position.set(G.px, G.deckY, G.pz);
  combat.spawnFoes(rnd, -44, -DECK_LEN + 10, 7);
  if (!rb) { G.camInit = false; G.camMix = 0; }
  if (!rb) clouds.reset(new THREE.Vector3(0, 0, 0));
}

function startGlide() {
  G.phase = 'glide'; G.s = 0; G.lat = clamp(G.px, -LAT_MAX, LAT_MAX); G.latV = 0; G.v = 20; G.nudge = 0; G.skimPts = 0; G.h = 99;
  rider.setMode('glide');
  for (const f of combat.foes) f.g.visible = false;
  if (G.prevWorld) { G.prevWorld.dispose(); G.prevWorld = null; }
  banner('DIVE!', '#ffd24a'); G.fovKick = 8; G.shake = Math.max(G.shake, 0.3);
  G.rings = 0; combat.spawnCD = 0.4;
}

/** touchdown on the landing ship: bonus, then straight on into the next leg's run, same deck */
function touchdown() {
  const off = G.landOff;
  const bonus = off < 4 ? 1000 : off < 8 ? 500 : 200;
  award(bonus, G.pos.clone().add(new THREE.Vector3(0, 3, 0)), off < 4 ? 'PERFECT LANDING +1000' : 'LANDED +' + bonus);
  const O = G.leg.O;
  const rb = { x: O.x, y: O.y, z: O.z, px: G.pos.x - O.x, pz: G.pos.z - O.z };
  startLeg(G.legIdx + 1, rb);
  rider.playRoll();
  banner('LANDED!', '#9fe8ff'); G.shake = Math.max(G.shake, 0.5);
}
function nextLeg() { touchdown(); }

// ── autopilot (also what the headless test drives with) ──
function autoLean() {
  if (G.open) {
    const t = combat.lockTarget || combat.drones.find((d) => d.alive && d.on);
    let ax = null;
    if (ow.portal && !ow.portal.got && !(combat.lockTarget && combat.lockT > 0.3)) ax = ow.portal.x;
    else if (t) ax = t.g.position.x;
    else { const r = ow.rings.filter((q) => !q.got && q.z < G.pos.z - 8 && Math.abs(q.x - G.pos.x) < 70).sort((a, b) => b.z - a.z)[0]; if (r) ax = r.x; else if (G.guide.st) ax = G.guide.x; }
    return ax === null ? 0 : clamp((ax - G.pos.x) * 0.2 - G.latV * 0.05, -1, 1);
  }
  if (G.phase === 'run') {
    let best = null, bz = -1e9;
    for (const f of combat.foes) if (f.alive && f.z < G.pz - 1 && f.z > bz) { bz = f.z; best = f; }
    return best ? clamp((best.x - G.px) * 0.5, -1, 1) : 0;
  }
  if (G.phase === 'glide') {
    const L = G.leg;
    let aim = null;
    const t = combat.lockTarget || combat.drones.filter((d) => d.alive && d.on).sort((a, b) => a.dist - b.dist)[0];
    if (t) aim = t.lat;
    else { const r = G.world.rings.find((q) => !q.got && q.s > G.s + 4); if (r) aim = r.lat; }
    if (G.s > L.L - 90) aim = 0;
    return aim === null ? 0 : clamp((aim - G.lat) * 0.25 - G.latV * 0.05, -1, 1);
  }
  return 0;
}

// ── per-phase updates ──
const _p = new THREE.Vector3(), _cp = new THREE.Vector3();
function updateRun(dt, lean) {
  if (G.phase === 'run') { G.runT += dt; if (G.runT > 0.4) G.pz -= T.runSpeed * dt; }
  G.px = clamp(G.px + lean * T.runLat * dt, -T.runLatMax, T.runLatMax);
  rider.root.position.set(G.px, G.deckY, G.pz);
  rider.update(dt, G.t, { yaw: 0, pitch: 0, roll: 0 }, G.phase === 'title' ? 0.15 : T.runSpeed / 11);
  if (G.phase === 'title') return;
  combat.runUpdate(dt, { rider, x: G.px, z: G.pz, deckY: G.deckY, auto: G.auto });
  if (G.pz <= -DECK_LEN + 3) startGlide();
}

function updateGlide(dt, lean) {
  const L = G.leg, s = G.s;
  // speed comes from the path's slope, plus a bonus for flying low
  const desc = L.descent(s);
  let vT = T.V0 + (desc > 0 ? desc * (T.vDive - T.V0) / 0.35 : desc * T.vClimb);
  const skimF = clamp((T.skimH - G.h) / (T.skimH - 2), 0, 1);
  vT += skimF * T.skimBoost;
  vT = clamp(vT, T.vMin, T.vMax);
  G.v = damp(G.v, vT, 1.8, dt);
  // sideways: lean is a steering rate, nothing else
  const prev = G.s; G.s += G.v * dt;
  G.latV = damp(G.latV, lean * T.latRate, T.latResp, dt);
  G.lat += G.latV * dt;
  if (Math.abs(G.lat) > LAT_MAX) { G.lat = Math.sign(G.lat) * LAT_MAX; if (G.latV * G.lat > 0) G.latV *= 0.2; }
  // altitude: the path (A), or the path plus a small nudge from forward/back lean (B)
  const up = G.mode === 'nudge' ? -input.readPitch() * (G.auto ? 0 : 1) : 0;
  G.nudge = damp(G.nudge, up > 0 ? up * T.nudgeUp : up * -T.nudgeDown, 2.2, dt);
  // the last stretch gently pulls him onto the landing deck (no missing it); how well he lined up is the bonus
  const pull = smoothstep(L.L - 75, L.L - 25, G.s);
  if (G.s > L.L - 78 && G.landOff === 0) G.landOff = Math.abs(G.lat) + 0.001;
  if (pull > 0) G.lat += -G.lat * Math.min(1, T.landPull * pull * dt);
  L.pointAt(G.s, G.lat, _p);
  let y = _p.y + G.nudge;
  L.surface(_p.x, y, _p.z, G.surf);
  const g = G.surf.top;
  if (y < g + T.floor) y = g + T.floor;            // the floor: skimming is thrilling, never punishing
  G.y = y; G.h = g === -Infinity ? 99 : y - g;
  G.pos.set(_p.x, y, _p.z);
  // skim points
  const sk = clamp((T.skimH - G.h) / (T.skimH - 2), 0, 1);
  if (sk > 0.2) { G.skimPts += dt * 140 * sk; G.score += dt * 140 * sk; }
  else if (G.skimPts > 0) { if (G.skimPts > 60) { award(0, G.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 'SKIM +' + Math.round(G.skimPts)); } G.skimPts = 0; }
  // dust trail when low
  if (G.h < 18) { const gp = new THREE.Vector3(G.pos.x + (Math.random() - 0.5) * 3, g + 0.4, G.pos.z + 6); combat.particles.emit(gp, new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, 4), [0.9, 0.78, 0.58], 0.9, 3.2, 0, 0.5 * (1 - G.h / 18)); }
  // rings
  for (const r of G.world.rings) {
    if (r.got || !(prev < r.s && G.s >= r.s)) continue;
    if (Math.abs(G.lat - r.lat) < 5.4 && Math.abs(G.y - r.mesh.position.y) < 6) {
      r.got = true; r.mesh.material = r.mesh.material.clone(); r.mesh.material.color.setHex(0xffd24a); G.rings++;
      award(250, r.mesh.position.clone(), 'RING +250'); G.v = Math.min(T.vMax, G.v + 3); G.fovKick = Math.max(G.fovKick, 5);
      combat.particles.burst(r.mesh.position, 24, 14, [1, 0.9, 0.4], 0.5, 1.4);
    }
  }
  for (const r of G.world.rings) if (r.mesh.visible && G.s > r.s + 5) r.mesh.visible = false;
  // orientation
  const dyds = -L.descent(G.s) + G.nudge * 0, tx = L.dxds(G.s) + G.latV / Math.max(G.v, 1), tz = -1;
  const hl = Math.hypot(tx, tz);
  G.tilt.set(tx, dyds, tz).normalize();
  const yaw = Math.atan2(-tx, -tz), pitch = clamp(Math.atan2(dyds, hl), -0.7, 0.5);
  G.yaw = damp(G.yaw, yaw, 8, dt); G.pitch = damp(G.pitch, pitch, 6, dt); G.roll = damp(G.roll, clamp(-G.latV * 0.045, -0.7, 0.7), 7, dt);
  rider.root.position.set(G.pos.x, G.pos.y - HIP, G.pos.z);
  rider.update(dt, G.t, { yaw: G.yaw, pitch: G.pitch, roll: G.roll }, 1);
  // combat
  const sec = L.sectionAt(G.s);
  if (sec.kind !== G.secKind) { G.secKind = sec.kind; if (sec.hint) banner(sec.hint, sec.kind === 'target' ? '#ff9a7a' : '#9fe8ff'); }
  let fightOpen, cap = 3;
  if (L.tutorial) {
    if (sec.kind === 'target') { fightOpen = combat.kills === 0 && combat.drones.length < 1; cap = 1; }   // exactly one target in empty sky, until it is shot down
    else fightOpen = sec.kind === 'fight';
  } else fightOpen = (sec.kind === 'fight' || (sec.kind === 'dive' && G.s > 40));
  fightOpen = fightOpen && G.s < L.L - 130;
  combat.glideUpdate(dt, { leg: L, s: G.s, lat: G.lat, pos: G.pos, camera, W, H, time: G.t, rnd, fightOpen, cap, speed: G.v });
  if (G.s >= L.L - 6) touchdown();
}


// ═══ OPEN SKY ═══  free left/right; ships + islands grow a soft skim path when you near them; portals drop you to the next sky
const ow = new OpenWorld(scene);
const fadeEl = document.createElement('div');
fadeEl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:5';
document.body.appendChild(fadeEl);
const OPEN_SLOPE = -0.02;
const adapter = {
  L: 1e9, pathYAt: (s) => G.y + OPEN_SLOPE * (s - G.s), center: () => G.pos.x, zAt: (s) => -s,
  spawnX: () => G.pos.x, droneX: (d) => d.cx, evasive: true, slopeY: OPEN_SLOPE, droneBaseY: (s) => G.y + OPEN_SLOPE * (s - G.s),
};
function applyTheme(i) {
  const th = THEMES[i % THEMES.length];
  if (scene.background && scene.background.dispose) scene.background.dispose();
  scene.background = makeSkyTexture(th.stops);
  scene.fog.color.setHex(th.fog); hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); sun.color.setHex(th.sun);
  return th;
}
function startOpen() {
  G.leg = null;
  G.pos.set(0, 0, 0); G.y = 0; G.s = 0; G.v = 22; G.latV = 0; G.desc = 0.05; G.nudge = 0; G.h = 99; G.level = 0; G.lvStartS = 0; G.lvDist = 0;
  G.phase = 'title'; G.camInit = false; G.camMix = 1;
  applyTheme(0); ow.reset(0, 0, 0, 0); ow.fill(0, 0, 0);
  combat.reset(); clouds.reset(G.pos);
  rider.setMode('glide'); rider.deploy = 1; rider.prone = 1;
  G.yaw = 0; G.pitch = -0.1; G.roll = 0;
}
function startDrop() {
  G.phase = 'drop'; G.dropT = 0; G.rebased = false;
  banner('DROP!', '#ff9be8'); G.fovKick = 16; G.shake = Math.max(G.shake, 0.8);
  for (const d of combat.drones) { d.alive = false; scene.remove(d.g); } combat.drones = [];
}
function setFade(a) { fadeEl.style.opacity = String(a); }
function flightOrient(dt, pitchOverride) {
  const v = Math.max(G.v, 1), tx = G.latV / v, dyds = -G.desc, hl = Math.hypot(tx, 1);
  G.tilt.set(tx, dyds, -1).normalize();
  const yaw = Math.atan2(-tx, 1), pitch = pitchOverride !== undefined ? pitchOverride : clamp(Math.atan2(dyds, hl), -0.7, 0.5);
  G.yaw = damp(G.yaw, yaw, 8, dt); G.pitch = damp(G.pitch, pitch, 6, dt); G.roll = damp(G.roll, clamp(-G.latV * 0.045, -0.7, 0.7), 7, dt);
  rider.root.position.set(G.pos.x, G.pos.y - HIP, G.pos.z);
  rider.update(dt, G.t, { yaw: G.yaw, pitch: G.pitch, roll: G.roll }, 1);
}
function updateOpen(dt, lean) {
  const frozen = G.phase === 'title';
  ow.update(dt, G.t);
  const skimF = clamp((T.skimH - G.h) / (T.skimH - 2), 0, 1);
  let vT = T.V0 + (G.desc > 0 ? G.desc * (T.vDive - T.V0) / 0.35 : G.desc * T.vClimb) + skimF * T.skimBoost;
  vT = clamp(vT, T.vMin, T.vMax);
  G.v = damp(G.v, frozen ? 10 : vT, 1.8, dt);
  const step = frozen ? 0 : G.v * dt, prevZ = G.pos.z;
  G.pos.z -= step; G.s = -G.pos.z; G.lvDist = G.s - G.lvStartS;
  // the guide that has grown over a nearby ship / island: pulls altitude (and, softly, the line) -- steer and it lets go
  ow.guide(G.pos.x, G.y, G.pos.z, G.guide);
  const gd = G.guide;
  const assist = gd.st ? clamp((gd.x - G.pos.x) * 0.3, -7, 7) * gd.w * (1 - Math.min(1, Math.abs(lean) * 1.6)) : 0;
  G.latV = damp(G.latV, lean * T.latRate + assist, T.latResp, dt);
  if (!frozen) G.pos.x += G.latV * dt;
  const yPrev = G.y;
  if (!frozen) {
    G.y += OPEN_SLOPE * step;
    // chasing a drone: ITS path (pull-ups, dives, speed bursts) becomes the invisible path you are aligned to
    const ch = combat.lockTarget && combat.lockTarget.alive ? combat.lockTarget : combat.drones.filter((d) => d.alive && d.dist < 230 && d.g.position.z < G.pos.z - 8).sort((a, b) => a.dist - b.dist)[0];
    G.chase = ch || null;
    if (ch) { const wc = 1 - smoothstep(110, 230, ch.dist); G.y = damp(G.y, ch.g.position.y - 0.6, 3.2 * wc + 0.4, dt); G.v = Math.max(G.v, damp(G.v, ch.vd + 5 + 9 * clamp(ch.g.position.y < G.y - 2 ? 1 : 0, 0, 1), 1.5, dt)); }
    else if (gd.st) G.y = damp(G.y, gd.y, 2.6 * gd.w, dt);
    if (G.mode === 'nudge' && !G.auto) G.y += clamp(-input.readPitch(), -1, 1) * 9 * dt;
  }
  ow.surface(G.pos.x, G.y, G.pos.z, G.surf);
  const g = G.surf.top;
  if (G.y < g + T.floor) G.y = g + T.floor;
  G.pos.y = G.y; G.h = g === -Infinity ? 99 : G.y - g;
  G.desc = damp(G.desc, step > 0 ? (yPrev - G.y) / step : 0, 3, dt);
  // skim points + dust
  const sk = clamp((T.skimH - G.h) / (T.skimH - 2), 0, 1);
  if (sk > 0.2) { G.skimPts += dt * 140 * sk; G.score += dt * 140 * sk; }
  else if (G.skimPts > 0) { if (G.skimPts > 60) award(0, G.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 'SKIM +' + Math.round(G.skimPts)); G.skimPts = 0; }
  if (G.h < 18) combat.particles.emit(_p.set(G.pos.x + (Math.random() - 0.5) * 3, g + 0.4, G.pos.z + 6), new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, 4), [0.9, 0.85, 0.75], 0.9, 3.2, 0, 0.5 * (1 - G.h / 18));
  // boost rings + the portal
  for (const r of ow.rings) {
    if (r.got || !(prevZ > r.z && G.pos.z <= r.z)) continue;
    if (Math.hypot(G.pos.x - r.x, G.pos.y - r.y) < r.r + 0.6) {
      r.got = true; r.mesh.material = r.mesh.material.clone(); r.mesh.material.color.setHex(0xffd24a); G.rings++;
      award(250, r.mesh.position.clone(), 'RING +250'); G.v = Math.min(T.vMax, G.v + 3); G.fovKick = Math.max(G.fovKick, 5);
      combat.particles.burst(r.mesh.position, 24, 14, [1, 0.9, 0.4], 0.5, 1.4);
    }
  }
  for (const r of ow.rings) if (r.mesh.visible && G.pos.z < r.z - 6) r.mesh.visible = false;
  const pt = ow.portal;
  if (pt && !pt.got && prevZ > pt.z && G.pos.z <= pt.z && Math.hypot(G.pos.x - pt.x, G.pos.y - pt.y) < PORTAL_R * 0.92) { startDrop(); return; }
  flightOrient(dt);
  // dogfight, once the level has warmed up
  const warm = G.level === 0 ? 650 : 220;
  const fightOpen = !frozen && G.lvDist > warm && !(pt && G.pos.z - pt.z < 150);
  combat.glideUpdate(dt, { leg: adapter, s: G.s, lat: 0, pos: G.pos, camera, W, H, time: G.t, rnd, fightOpen, cap: 2, speed: G.v });
  if (!frozen) ow.fill(G.pos.x, G.pos.y, G.pos.z);
}
function updateDrop(dt, lean) {
  G.dropT += dt; const k = G.dropT;
  ow.update(dt, G.t);
  G.v = damp(G.v, 54, 2.5, dt);
  G.latV = damp(G.latV, lean * T.latRate * 0.6, T.latResp, dt);
  G.pos.x += G.latV * dt; G.pos.z -= G.v * 0.8 * dt; G.y -= 36 * smoothstep(0, 0.6, k) * dt; G.pos.y = G.y; G.s = -G.pos.z;
  G.desc = 0.75; G.h = 99;
  flightOrient(dt, -1.0);
  G.tilt.set(0, -0.9, -1).normalize();
  if (!G.rebased && k >= 1.9) {
    G.rebased = true; G.level++; const th = applyTheme(G.level);
    ow.reset(G.level, G.pos.x, G.pos.y, G.pos.z); G.lvStartS = G.s; G.lvDist = 0; combat.reset();
    banner('SKY ' + (G.level + 1) + ' - ' + th.name, '#ffd24a'); G.score += 500;
  }
  setFade(k < 1.9 ? smoothstep(1.1, 1.9, k) : 1 - smoothstep(1.9, 2.8, k));
  if (G.rebased) ow.fill(G.pos.x, G.pos.y, G.pos.z);
  if (k >= 2.8) { G.phase = 'open'; setFade(0); G.fovKick = 0; }
}

// ── camera ──
const flying = () => G.phase === 'glide' || G.phase === 'open' || G.phase === 'drop' || (G.open && G.phase === 'title');
const camTgt = new THREE.Vector3(), camLook = new THREE.Vector3(), lookNow = new THREE.Vector3();
const runTgt = new THREE.Vector3(), runLook = new THREE.Vector3(), glTgt = new THREE.Vector3(), glLook = new THREE.Vector3();
function updateCamera(dt) {
  if (window.__camOff) {   // debug close-ups (tools/closeup.mjs)
    const o = window.__camOff, tp = rider.pivot.getWorldPosition(new THREE.Vector3());
    camera.position.set(tp.x + o[0], tp.y + o[1], tp.z + o[2]); camera.lookAt(tp); camera.fov = 50; camera.updateProjectionMatrix(); return;
  }
  // Two rigs -- the run chase cam and the flight cam -- and ONE camera that is blended between them, so jumping off the
  // ledge is a swoop (and landing is the swoop back), never a cut.
  const gl = flying();
  G.camMix = clamp(G.camMix + dt / (gl ? T.camBlendIn : -T.camBlendOut), 0, 1);
  const k = easeInOut(G.camMix);
  // run rig follows the rider wherever he is (also mid-dive, so we see him leave the ledge)
  const rx = gl ? G.pos.x : G.px, ry = gl ? G.pos.y - HIP : G.deckY, rz = gl ? G.pos.z : G.pz;
  runTgt.set(rx * 0.85, ry + 3.5, rz + 8.6);
  runLook.set(rx * 0.85, ry + 1.5, rz - 15);
  // flight rig
  let fovG = 72;
  if (gl) {
    const sp = clamp((G.v - T.V0) / (T.vMax - T.V0), 0, 1);
    const low = 1 - smoothstep(4, 40, G.h);
    const height = lerp(3.0, 1.9, low), back = lerp(6.9, 5.6, low) + sp * 1.0, ahead = 34;
    fovG = 70 + sp * 14 + (1 - smoothstep(2, 14, G.h)) * 6;
    glTgt.set(G.pos.x - G.tilt.x * back * 0.4 - G.latV * 0.12, G.pos.y + height - G.tilt.y * back * 0.6, G.pos.z + back);
    glLook.set(G.pos.x + G.tilt.x * ahead * 0.35, G.pos.y + G.tilt.y * ahead + 0.5, G.pos.z - ahead);
  } else { glTgt.copy(runTgt); glLook.copy(runLook); }
  camTgt.lerpVectors(runTgt, glTgt, k); camLook.lerpVectors(runLook, glLook, k);
  const swoop = Math.sin(Math.PI * k);                              // pull out a touch mid-transition, so the move reads
  camTgt.z += swoop * 2.6; camTgt.y += swoop * 1.3;
  const fov = lerp(64, fovG, k) + swoop * 3;
  if (!G.camInit) { camera.position.copy(camTgt); lookNow.copy(camLook); G.camInit = true; }
  const rate = gl ? 7 : 6;
  camera.position.x = damp(camera.position.x, camTgt.x, rate, dt); camera.position.y = damp(camera.position.y, camTgt.y, rate * 0.9, dt); camera.position.z = damp(camera.position.z, camTgt.z, rate + 2, dt);
  lookNow.x = damp(lookNow.x, camLook.x, 9, dt); lookNow.y = damp(lookNow.y, camLook.y, 9, dt); lookNow.z = damp(lookNow.z, camLook.z, 9, dt);
  // never inside a deck or island
  if ((G.leg || G.open) && gl) L_surf(camera.position);
  G.shake = Math.max(0, G.shake - dt * 2.2); G.fovKick = Math.max(0, G.fovKick - dt * 22);
  const sh = G.shake * 0.35;
  camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh;
  camera.lookAt(lookNow);
  camera.rotateZ(gl ? -G.latV * 0.011 * k : 0);
  const f = fov + G.fovKick;
  if (Math.abs(camera.fov - f) > 0.01) { camera.fov = damp(camera.fov, f, 6, dt); camera.updateProjectionMatrix(); }
  combat.particles.uniforms.uScale.value = (H * 0.5) / Math.tan((camera.fov * Math.PI) / 360) * (renderer.getPixelRatio() || 1);
}
const _sf = { top: -Infinity, edge: false };
function L_surf(cp) {
  (G.open ? ow : G.leg).surface(cp.x, cp.y, cp.z, _sf);
  if (_sf.top > -Infinity && cp.y < _sf.top + 1.3) cp.y = _sf.top + 1.3;
}

// ── HUD ──
function updateHud(dt) {
  $('score').textContent = Math.floor(G.score).toLocaleString();
  const gl = flying();
  $('speed').textContent = Math.round((gl ? G.v : T.runSpeed) * 3.6) + ' KM/H';
  $('progress').style.visibility = G.leg || G.open ? 'visible' : 'hidden';
  if (G.open) { $('prog-dive').textContent = 'SKY ' + (G.level + 1); $('prog-land').textContent = 'PORTAL'; }
  const frac = G.open ? clamp(G.lvDist / ow.portalDist(), 0, 1) : G.phase !== 'glide' ? clamp(-G.pz / DECK_LEN, 0, 1) * 0.12 * (G.phase === 'title' ? 0 : 1) : gl ? 0.12 + 0.88 * clamp(G.s / G.leg.L, 0, 1) : 1;
  $('prog-fill').style.width = (frac * 100) + '%';
  const ret = $('reticle');
  ret.classList.toggle('on', gl);
  if (gl) {
    const armed = combat.armed, locked = !!combat.candidate;
    ret.classList.toggle('lock', locked && !armed); ret.classList.toggle('armed', armed);
    $('reticle').style.setProperty('--p', locked ? clamp(combat.lockT / GUN.armAt, 0, 1) : 0);
    $('ret-msg').textContent = armed ? 'MISSILE' : '';
    let n = 0;
    for (const d of combat.drones) {
      if (!d.alive || !d.on || n >= brackets.length) continue;
      const b = brackets[n++]; b.style.display = 'block';
      b.style.left = d.sx + 'px'; b.style.top = d.sy + 'px';
      b.style.setProperty('--bs', clamp(5200 / Math.max(d.dist, 20), 26, 90) + 'px');
      b.className = d === combat.lockTarget && locked ? 'lock' : '';
      b.firstChild.textContent = Math.round(d.dist) + 'm';
    }
    for (; n < brackets.length; n++) brackets[n].style.display = 'none';
  } else for (const b of brackets) b.style.display = 'none';
  const sk = $('skim');
  const low = gl && G.h < T.skimH - 3;
  sk.classList.toggle('on', low);
  if (low) sk.textContent = (G.surf.edge ? 'EDGE SKIM' : G.h < 8 ? 'DECK PROXIMITY' : 'LOW FLIGHT') + '  +' + Math.round(G.skimPts);
  $('mode-tag').textContent = G.mode === 'nudge' ? 'ALT: PATH + NUDGE (W/S)' : 'ALT: PATH ONLY';
  // speed lines
  fxc.clearRect(0, 0, W, H);
  const sp = gl ? clamp((G.v - 26) / 18, 0, 1) + clamp((T.skimH - G.h) / T.skimH, 0, 1) * 0.5 : 0;
  if (sp > 0.05) {
    fxc.strokeStyle = 'rgba(255,255,255,' + (0.18 * Math.min(1, sp)) + ')'; fxc.lineWidth = 2; fxc.beginPath();
    const cx = W / 2, cy = H * 0.5, r0 = Math.min(W, H) * 0.42;
    for (let i = 0; i < 34; i++) { const a = rnd() * 6.283, r = r0 * (1 + rnd() * 0.3), l = r0 * (0.2 + rnd() * 0.45 * sp); fxc.moveTo(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r); fxc.lineTo(cx + Math.cos(a) * (r + l) * 1.4, cy + Math.sin(a) * (r + l)); }
    fxc.stroke();
  }
}

// ── buttons ──
function setMode(m) { G.mode = m; $('mode-btn').textContent = m === 'nudge' ? 'ALT: PATH+NUDGE' : 'ALT: PATH'; }
function setAuto(a) { G.auto = a; $('auto-btn').textContent = a ? 'AUTO: ON' : 'AUTO: OFF'; }
$('mode-btn').addEventListener('click', () => setMode(G.mode === 'path' ? 'nudge' : 'path'));
$('auto-btn').addEventListener('click', () => setAuto(!G.auto));
const togglePause = () => { if (G.phase === 'title' || G.phase === 'loading') return; G.paused = !G.paused; $('pause-overlay').hidden = !G.paused; };
$('pause-btn').addEventListener('click', togglePause);
window.addEventListener('keydown', (e) => { if (e.code === 'KeyP') togglePause(); if (e.code === 'KeyM') setMode(G.mode === 'path' ? 'nudge' : 'path'); if (e.code === 'KeyO') setAuto(!G.auto); if (e.code === 'KeyN') { if (G.open) { if (ow.portal) { G.pos.set(ow.portal.x, ow.portal.y, ow.portal.z + 4); G.y = ow.portal.y; } } else if (G.leg) nextLeg(); } });
setMode(G.mode); setAuto(G.auto);

// ── main loop ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!G.leg && !G.open) return;
  if (G.phase === 'title') { dt = Math.min(dt, 0.033); }
  if (!G.paused) {
    G.t += dt;
    const lean = G.phase === 'title' ? 0 : (G.auto ? autoLean() : input.read(dt));
    G.lean = lean;
    if (G.open && G.phase === 'title') updateOpen(dt, 0);
    else if (G.phase === 'run' || G.phase === 'title') updateRun(dt, lean);
    else if (G.phase === 'glide') updateGlide(dt, lean);
    else if (G.phase === 'open') updateOpen(dt, lean);
    else if (G.phase === 'drop') updateDrop(dt, lean);
    updateCamera(dt);
    if (G.world) G.world.update(dt, G.t);
    clouds.update(flying() ? G.pos : _cp.set(G.px, G.deckY, G.pz), camera.position);
    updateHud(dt);
  }
  renderer.render(scene, camera);
}

async function boot() {
  await rider.load('/models/raphael.glb', '/models/clips.json', '/models/clips_run.json', '/models/attacks.json');
  if (OPEN) startOpen(); else { startLeg(G.legIdx); G.phase = 'title'; }
  window.__game = { G, rider, combat, T, input, get leg() { return G.leg; }, camera, scene, renderer, startGlide, touchdown, nextLeg, setAuto, setMode, ow, startDrop };
  const begin = () => { if (G.phase !== 'title') return; $('title').hidden = true; if (G.open) { G.phase = 'open'; banner('LEAN LEFT / RIGHT TO STEER', '#9fe8ff'); return; } G.phase = 'run'; G.runT = 0; banner('RUN!', '#9fe8ff'); };
  window.__begin = begin;
  $('go').addEventListener('click', begin);
  if (Q.get('start') === '1' || G.auto) begin();
  // dev: jump straight into the glide at a given distance (?s=300)
  if (Q.get('s') && !OPEN) { begin(); startGlide(); G.s = Number(Q.get('s')); }
  const tick = () => { if (G.phase === 'title' && input.consumePress()) begin(); setTimeout(tick, 50); };
  tick();
  requestAnimationFrame(frame);
}
boot();
