// SKY SHRED — prototype 1.  RUN on a hovership deck -> DIVE -> GLIDE + DOGFIGHT -> LAND -> RUN ...
// See pipeline/build-docs/SkyShred.md for the spec.  Leg-local coordinates, forward = -Z; each leg is rebuilt at the origin.
import * as THREE from 'three';
import { Leg, DECK_LEN, LAT_MAX, CHASE_FEATURE } from './path.js';
import { LegWorld, Clouds, makeSkyTexture, GLOW } from './world.js';
import { Rider, HIP } from './rider.js';
import { OpenWorld, THEMES, PORTAL_R, wrapPi } from './open.js';
import { Combat, GUN } from './combat.js';
import { EnemyFire } from './enemy.js';
import { Input } from './input.js';
import { clamp, lerp, damp, smoothstep, easeInOut, mulberry32 } from './util.js';

const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ── tuning (all of it the thing to play with) ──
const T = {
  runSpeed: 12, runLat: 10, runLatMax: 6, camBlendIn: 1.9, camBlendOut: 1.4,
  V0: 30, vDive: 58, vMin: 26, vMax: 58, vClimb: 24,
  latRate: 19, latResp: 6,
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
  hdg: 0, pturn: 0, turn: 0, hp: 100, invuln: 0, lastHit: -9, hurtT: 0, loopOn: false, loopT: 0, loopTh: 0, base: new THREE.Vector3(), vel: new THREE.Vector3(), pp: new THREE.Vector3(),
  shake: 0, fovKick: 0, lean: 0, camInit: false, landBonus: 0, bannerT: 0,
};
const enemy = new EnemyFire(scene, GLOW);
const combat = new Combat(scene, GLOW, {
  kill: (p, big) => { award(big ? 900 : 700, p, big ? 'MISSILE KILL +900' : 'SPLASH +700'); G.shake = Math.max(G.shake, big ? 1.0 : 0.5); },
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
const brackets = [];
for (let i = 0; i < 6; i++) {
  const d = document.createElement('div'); d.innerHTML = '<span></span>'; d.style.display = 'none';
  const bar = document.createElement('i'); bar.style.cssText = 'position:absolute;left:calc(var(--bs,40px)/-2);top:calc(var(--bs,40px)/2 + 24px);width:var(--bs,40px);height:5px;background:rgba(0,0,0,.55);border-radius:3px;overflow:hidden';
  const fill = document.createElement('b'); fill.style.cssText = 'display:block;height:100%;width:100%;background:#ff5a4a'; bar.appendChild(fill); d.appendChild(bar); d.hpFill = fill;
  $('brackets').appendChild(d); brackets.push(d);
}
// shield bar, damage flash, rear-view mirror frame
const hpEl = document.createElement('div');
hpEl.style.cssText = 'position:fixed;left:16px;bottom:52px;width:150px;height:10px;background:rgba(0,0,0,.45);border-radius:6px;overflow:hidden;z-index:3;pointer-events:none;display:none';
hpEl.innerHTML = '<b style="display:block;height:100%;width:100%;background:linear-gradient(90deg,#5ff2ff,#7dffb0)"></b>'; document.body.appendChild(hpEl);
const hurtEl = document.createElement('div');
hurtEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;background:radial-gradient(ellipse at center,rgba(255,40,30,0) 45%,rgba(255,40,30,.75) 100%)'; document.body.appendChild(hurtEl);
const mirrorEl = document.createElement('div');
mirrorEl.style.cssText = 'position:fixed;z-index:3;pointer-events:none;display:none;border:3px solid #fff;border-radius:10px;box-shadow:0 2px 12px #0007;color:#fff;font:800 11px system-ui,sans-serif;letter-spacing:1px';
mirrorEl.innerHTML = '<span style="position:absolute;left:8px;top:4px;text-shadow:0 1px 3px #000">REAR</span>'; document.body.appendChild(mirrorEl);
const rearCam = new THREE.PerspectiveCamera(68, 1.8, 0.3, 900);
const MIR = { x: 0, y: 0, w: 0, h: 0, on: false };
function flash() { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }

// ── leg lifecycle ──
// Leg 0 starts on the run deck; every later leg hands over in MID-AIR: the old world is shifted so the hand-over point
// becomes the new origin, the new leg is built around the glider, and the old world is dropped once it is far behind.
function startLeg(index, rb = null) {
  const prev = G.world;
  if (G.prevWorld) { G.prevWorld.dispose(); G.prevWorld = null; }
  G.legIdx = index; G.leg = new Leg(index);
  if (rb && prev) {
    const O = new THREE.Vector3(rb.x, rb.y, rb.z);
    prev.group.position.copy(O).negate(); G.prevWorld = prev;
    camera.position.sub(O); lookNow.sub(O); clouds.shift(O);
    G.pos.sub(O); G.pp.sub(O); G.y = G.pos.y;
  } else if (prev) prev.dispose();
  G.world = new LegWorld(G.leg, scene, null);
  combat.reset(); enemy.reset(); registerRaid();
  G.secKind = ''; G.loopOn = false;
  if (rb) { G.s = 0; G.lat = G.pos.x; G.phase = 'glide'; banner('LEG ' + (index + 1), '#ffd24a'); return; }
  G.phase = 'run'; G.runT = 0; G.deckY = 0; G.pz = -30; G.px = 0; G.lean = 0; G.landOff = 0;
  rider.setMode('run'); rider.prone = 0; rider.deploy = 0;
  rider.root.position.set(G.px, G.deckY, G.pz);
  combat.spawnFoes(rnd, -52, -DECK_LEN + 10, 5);
  G.camInit = false; G.camMix = 0; clouds.reset(new THREE.Vector3(0, 0, 0));
}

function registerRaid() {
  for (const c of G.world.smalls) combat.addStatic(c.pos, c.hp, c.s, (d) => {
    award(250, d.g.position.clone(), 'TARGET +250');
    combat.particles.burst(d.g.position, 36, 24, [1, 0.75, 0.3], 0.7, 2.2); G.shake = Math.max(G.shake, 0.4);
  }, true).ship = c.st;
  for (const c of G.world.cores) combat.addStatic(c.pos, c.st.hp, c.s, (d) => {
    for (const o of combat.drones) if (o.small && o.ship === c.st && o.alive) { o.alive = false; combat.scene.remove(o.g); combat.particles.burst(o.g.position, 20, 16, [1, 0.6, 0.3], 0.5, 1.6); }
    G.world.sink(c.st); award(900, d.g.position.clone(), 'CORE DOWN +900');
    combat.particles.burst(d.g.position, 90, 46, [1, 0.6, 0.25], 1.1, 3.2); combat.particles.burst(d.g.position, 40, 20, [1, 0.95, 0.7], 0.7, 4.5);
    G.shake = Math.max(G.shake, 1.0); G.fovKick = Math.max(G.fovKick, 8);
  });
  enemy.turrets = G.world.turrets;
}

function startGlide() {
  G.phase = 'glide'; G.s = 0; G.lat = clamp(G.px, -LAT_MAX, LAT_MAX); G.latV = 0; G.v = 26; G.nudge = 0; G.skimPts = 0; G.h = 99;
  G.pp.copy(G.pos);
  rider.setMode('glide');
  for (const f of combat.foes) f.g.visible = false;
  banner('DIVE!', '#ffd24a'); G.fovKick = 8; G.shake = Math.max(G.shake, 0.3);
  G.rings = 0; combat.spawnCD = 0.4;
}

function handover() { startLeg(G.legIdx + 1, G.leg.O); }
function nextLeg() { if (G.phase === 'glide' && G.leg) G.s = Math.max(G.s, G.leg.L - 4); }

// ── autopilot (also what the headless test drives with) ──
function autoLean() {
  if (G.open) {
    const t = combat.lockTarget || combat.drones.find((d) => d.alive && d.on);
    const fx = Math.sin(G.hdg), fz = -Math.cos(G.hdg);
    let ax = null, az = 0;
    if (ow.portal && !ow.portal.got && !(combat.lockTarget && combat.lockT > 0.3)) { ax = ow.portal.x; az = ow.portal.z; }
    else if (t) { ax = t.g.position.x; az = t.g.position.z; }
    else {
      const r = ow.rings.filter((q) => !q.got && (q.x - G.pos.x) * fx + (q.z - G.pos.z) * fz > 20 && Math.hypot(q.x - G.pos.x, q.z - G.pos.z) < 380).sort((a, b) => Math.hypot(a.x - G.pos.x, a.z - G.pos.z) - Math.hypot(b.x - G.pos.x, b.z - G.pos.z))[0];
      if (r) { ax = r.x; az = r.z; } else if (G.guide.st) { ax = G.guide.x; az = G.guide.z; }
    }
    return ax === null ? 0 : clamp(wrapPi(Math.atan2(ax - G.pos.x, -(az - G.pos.z)) - G.hdg) * 1.6, -1, 1);
  }
  if (G.phase === 'run') {
    let best = null, bz = -1e9;
    for (const f of combat.foes) if (f.alive && f.z < G.pz - 1 && f.z > bz) { bz = f.z; best = f; }
    return best ? clamp((best.x - G.px) * 0.5, -1, 1) : 0;
  }
  if (G.phase === 'glide') {
    if (G.loopOn) return 0;
    let aim = null;
    const t = combat.lockTarget || combat.drones.filter((d) => d.alive && d.on && d.dist < 260).sort((a, b) => a.dist - b.dist)[0];
    const orb = G.world.orbs.find((o) => !o.got && o.s > G.s + 2 && o.s < G.s + 150);
    if (enemy.pursuers.length) { if (orb) aim = orb.lat; else return Math.sin(G.t * 2.6); }   // pilots on the tail: grab the loop, else swing and dodge
    else if (t) aim = latOf(t.g.position.x, t.g.position.z);
    else { const r = G.world.rings.find((q) => !q.got && q.s > G.s + 4); if (r) aim = r.lat; }
    return aim === null ? 0 : clamp((aim - G.lat) * 0.25 - G.latV * 0.05, -1, 1);
  }
  return 0;
}

// ── per-phase updates ──
const _p = new THREE.Vector3(), _cp = new THREE.Vector3(), _w = new THREE.Vector3();
function updateRun(dt, lean) {
  if (G.phase === 'run') { G.runT += dt; if (G.runT > 0.4) G.pz -= T.runSpeed * dt; }
  G.px = clamp(G.px + lean * T.runLat * dt, -T.runLatMax, T.runLatMax);
  rider.root.position.set(G.px, G.deckY, G.pz);
  rider.update(dt, G.t, { yaw: 0, pitch: 0, roll: 0 }, G.phase === 'title' ? 0.15 : T.runSpeed / 11);
  if (G.phase === 'title') return;
  combat.runUpdate(dt, { rider, x: G.px, z: G.pz, deckY: G.deckY, auto: G.auto });
  if (G.pz <= -DECK_LEN + 3) startGlide();
}

function latOf(x, z) { return G.leg.latOf(x, z, G.s); }
const LOOP_R = 24, LOOP_T = 2.3;
function hurt(dmg) {
  if (G.invuln > 0 || G.loopOn) return;
  G.hp -= dmg; G.invuln = 0.55; G.lastHit = G.t; G.hurtT = 1; G.shake = Math.max(G.shake, 0.7); G.v = Math.max(T.vMin, G.v - 3);
  combat.particles.burst(G.pos, 14, 16, [1, 0.5, 0.3], 0.4, 1.4);
  if (G.hp <= 0) { G.hp = 100; G.invuln = 3; G.score = Math.max(0, G.score - 300); banner('SHIELD DOWN - RECOVERED -300', '#ff6a6a'); }
}
function startLoop() { G.loopOn = true; G.loopT = 0; G.invuln = 3.5; banner('LOOP!', '#ffd24a'); G.fovKick = 10; G.shake = Math.max(G.shake, 0.4); }
function endLoop() {
  G.loopOn = false; G.pitch = 0; G.invuln = 1;
  const n = enemy.pursuers.length;
  for (let i = 0; i < n; i++) combat.spawnDrone(G.leg, G.s + 58 + i * 14, rnd, G.v * 0.78);   // the pilots that were on his tail are now in his sights
  enemy.clearPursuers(); for (const b of enemy.bolts) { b.on = false; b.m.visible = false; }
  if (n) { banner('ON HIS TAIL!', '#ff9be8'); G.score += 500; G.fovKick = 12; }
}
function enterSection(sec) {
  if (sec.hint) banner(sec.hint, sec.kind === 'chase' ? '#ff9a7a' : sec.kind === 'drop' ? '#ffd24a' : '#9fe8ff');
  if (sec.kind === 'chase') enemy.spawnPursuers(G.legIdx >= 2 ? 3 : 2, rnd);
}
function leaveSection(kind) {
  if (kind === 'chase' && enemy.pursuers.length) { enemy.clearPursuers(); banner('LOST THEM!', '#9fe8ff'); G.score += 300; }
}
const muzzle = (p) => combat.particles.burst(p, 6, 10, [1, 0.5, 0.3], 0.25, 1.2);

function updateGlide(dt, lean) {
  const L = G.leg, s = G.s;
  // speed comes from the path's slope, plus a bonus for flying low
  const desc = L.descent(s);
  let vT = T.V0 + (desc > 0 ? desc * (T.vDive - T.V0) / 0.35 : desc * T.vClimb);
  const skimF = clamp((T.skimH - G.h) / (T.skimH - 2), 0, 1);
  vT += skimF * T.skimBoost;
  vT = clamp(vT, T.vMin, T.vMax);
  if (G.loopOn) vT = Math.max(vT, 42);
  G.v = damp(G.v, vT, 1.8, dt);
  // sideways: lean is a steering rate, nothing else
  const prev = G.s; G.s += G.v * dt * (G.loopOn ? 0.55 : 1);
  // the edge of the path is an invisible tunnel wall: pushing into it fades to nothing (no hard stop, no jolt), and he tilts
  // a little, like riding the curve of the tunnel
  let lv = lean * T.latRate;
  const edge = smoothstep(LAT_MAX * 0.6, LAT_MAX, Math.abs(G.lat));
  if (lv * G.lat > 0) lv *= Math.pow(1 - edge, 1.7);
  lv -= Math.sign(G.lat) * edge * 2.5;                           // and the wall eases him back a touch
  G.latV = damp(G.latV, lv, T.latResp, dt);
  G.lat += G.latV * dt;
  if (Math.abs(G.lat) > LAT_MAX) { G.lat = Math.sign(G.lat) * LAT_MAX; G.latV = Math.min(Math.abs(G.latV), 1) * Math.sign(G.latV) * 0.5; }
  G.wall = damp(G.wall || 0, Math.sign(G.lat) * edge, 5, dt);
  // altitude: the path (A), or the path plus a small nudge from forward/back lean (B)
  const up = G.mode === 'nudge' ? -input.readPitch() * (G.auto ? 0 : 1) : 0;
  G.nudge = damp(G.nudge, up > 0 ? up * T.nudgeUp : up * -T.nudgeDown, 2.2, dt);
  G.pp.copy(G.pos);
  L.pointAt(G.s, G.lat, _p);
  G.base.copy(_p);
  let y = _p.y + G.nudge;
  if (G.loopOn) {     // the loop power-up: pull up and over, ending ahead of where he started
    G.loopT += dt; const k = clamp(G.loopT / LOOP_T, 0, 1), th = Math.PI * 2 * easeInOut(k);
    const hf = L.hdgAt(G.s); y += LOOP_R * (1 - Math.cos(th)); _p.x += Math.sin(hf) * LOOP_R * Math.sin(th); _p.z -= Math.cos(hf) * LOOP_R * Math.sin(th); G.loopTh = th;
    G.h = 99;
  } else {
    L.surface(_p.x, y, _p.z, G.surf);
    const g = G.surf.top;
    if (y < g + T.floor) y = g + T.floor;            // the floor: skimming is thrilling, never punishing
    G.h = g === -Infinity ? 99 : y - g;
  }
  G.y = y;
  G.pos.set(_p.x, y, _p.z);
  if (dt > 0) { _w.set((G.pos.x - G.pp.x) / dt, (G.pos.y - G.pp.y) / dt, (G.pos.z - G.pp.z) / dt); G.vel.lerp(_w, 1 - Math.exp(-dt * 14)); }
  // skim points
  const sk = clamp((T.skimH - G.h) / (T.skimH - 2), 0, 1);
  if (sk > 0.2) { G.skimPts += dt * 140 * sk; G.score += dt * 140 * sk; }
  else if (G.skimPts > 0) { if (G.skimPts > 60) { award(0, G.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 'SKIM +' + Math.round(G.skimPts)); } G.skimPts = 0; }
  // dust trail when low
  if (G.h < 18) { const gp = new THREE.Vector3(G.pos.x + (Math.random() - 0.5) * 3, G.surf.top + 0.4, G.pos.z + 6); combat.particles.emit(gp, new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, 4), [0.9, 0.78, 0.58], 0.9, 3.2, 0, 0.5 * (1 - G.h / 18)); }
  // rings
  for (const r of G.world.rings) {
    if (r.got || !(prev < r.s && G.s >= r.s)) continue;
    if (Math.abs(G.lat - r.lat) < 5.6 && Math.abs(G.y - r.mesh.position.y) < 6) {
      r.got = true; r.mesh.material = r.mesh.material.clone(); r.mesh.material.color.setHex(0xffd24a); G.rings++;
      award(250, r.mesh.position.clone(), 'RING +250'); G.v = Math.min(T.vMax, G.v + 3); G.fovKick = Math.max(G.fovKick, 5);
      combat.particles.burst(r.mesh.position, 24, 14, [1, 0.9, 0.4], 0.5, 1.4);
    }
  }
  for (const r of G.world.rings) if (r.mesh.visible && G.s > r.s + 5) r.mesh.visible = false;
  // loop power-ups
  for (const o of G.world.orbs) if (!o.got && prev < o.s && G.s >= o.s && Math.abs(G.lat - o.lat) < 5.6) {
    o.got = true; o.g.visible = false; combat.particles.burst(o.g.position, 30, 18, [1, 0.85, 0.4], 0.6, 1.8);
    if (!G.loopOn) startLoop();
  }
  // orientation
  if (G.loopOn) {
    G.pitch = G.loopTh; G.hdg = L.hdgAt(G.s); G.yaw = damp(G.yaw, -G.hdg, 8, dt); G.roll = damp(G.roll, 0, 8, dt);
    if (G.loopT >= LOOP_T) endLoop();
  } else {
    const dyds = -L.descent(G.s), tx = L.dxds(G.s) + G.latV / Math.max(G.v, 1), hd = L.hdgAt(G.s);
    const hl = Math.hypot(tx, 1);
    G.hdg = hd; G.pturn = (L.hdgAt(G.s + 6) - L.hdgAt(G.s - 6)) / 12 * G.v;          // how fast the path is turning, rad/s
    G.tilt.set(Math.sin(hd), dyds, -Math.cos(hd)).normalize();
    const yaw = -(hd + Math.atan(tx)), pitch = clamp(Math.atan2(dyds, hl), -0.7, 0.5);
    G.yaw = damp(G.yaw, yaw, 8, dt); G.pitch = damp(G.pitch, pitch, 6, dt); G.roll = damp(G.roll, clamp(-G.latV * 0.04 + G.wall * 0.42, -0.7, 0.7), 7, dt);
  }
  rider.root.position.set(G.pos.x, G.pos.y - HIP, G.pos.z);
  rider.update(dt, G.t, { yaw: G.yaw, pitch: G.pitch, roll: G.roll }, 1);
  // sections: what is happening on the path right now
  const sec = L.sectionAt(G.s);
  if (sec.kind !== G.secKind) { leaveSection(G.secKind); G.secKind = sec.kind; enterSection(sec); }
  // enemy fire: pilots on the tail, deck turrets; the bolts themselves hurt
  G.invuln = Math.max(0, G.invuln - dt); G.hurtT = Math.max(0, G.hurtT - dt * 2.2);
  if (G.t - G.lastHit > 3.5) G.hp = Math.min(100, G.hp + 8 * dt);
  if (CHASE_FEATURE && enemy.pursuers.length && !G.loopOn) enemy.updatePursuers(dt, { leg: L, s: G.s, lat: G.lat, pos: G.pos, vel: G.vel, t: G.t, onFire: muzzle });
  if (CHASE_FEATURE && sec.kind === 'raid') enemy.updateTurrets(dt, { s: G.s, pos: G.pos, vel: G.vel, onFire: muzzle });
  enemy.update(dt, G.pos, (b) => hurt(b.dmg));
  // dogfight
  const fightOpen = sec.kind === 'fight' && G.s < sec.s1 - 40 && !G.loopOn;
  if (G.loopOn) combat.updateEffects(dt);
  else combat.glideUpdate(dt, { leg: L, s: G.s, lat: G.lat, pos: G.pos, camera, W, H, time: G.t, rnd, fightOpen, cap: sec.cap || 3, speed: G.v, spawnAhead: 90, droneV: G.v * 0.8, fwd: { x: Math.sin(G.hdg), z: -Math.cos(G.hdg) } });
  if (G.prevWorld && G.s > 260) { G.prevWorld.dispose(); G.prevWorld = null; }
  if (G.s >= L.L) handover();
}

// ═══ OPEN SKY ═══  a free heading: left/right TURNS him (circle all you like). Ships + islands grow a soft skim path when
// you near them; portals drop you into the next sky.  See open.js.
const ow = new OpenWorld(scene);
const fadeEl = document.createElement('div');
fadeEl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:5';
document.body.appendChild(fadeEl);
const pmark = document.createElement('div');
pmark.style.cssText = 'position:fixed;left:0;top:0;z-index:4;pointer-events:none;color:#ffd0f4;font:700 14px system-ui,sans-serif;text-shadow:0 1px 4px #000a;transform:translate(-50%,-50%);display:none;text-align:center;white-space:nowrap';
document.body.appendChild(pmark);
T.turnRate = 1.05;
const adapter = { free: true, L: 1e9 };
function applyTheme(i) {
  const th = THEMES[i % THEMES.length];
  if (scene.background && scene.background.dispose) scene.background.dispose();
  scene.background = makeSkyTexture(th.stops);
  scene.fog.color.setHex(th.fog); hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); sun.color.setHex(th.sun);
  return th;
}
function prebuild() { for (let i = 0; i < 400 && (ow.queue.length || ow.ci === null); i++) ow.stream(G.pos.x, G.pos.z, Math.sin(G.hdg), -Math.cos(G.hdg)); }
function startOpen() {
  G.leg = null;
  G.pos.set(0, 0, 0); G.y = 0; G.s = 0; G.v = 22; G.latV = 0; G.turn = 0; G.hdg = 0; G.desc = 0.05; G.nudge = 0; G.h = 99; G.level = 0; G.lvStartS = 0; G.lvDist = 0;
  G.phase = 'title'; G.camInit = false; G.camMix = 1;
  applyTheme(0); ow.reset(0); prebuild();
  combat.reset(); clouds.radial = true; clouds.reset(G.pos);
  rider.setMode('glide'); rider.deploy = 1; rider.prone = 1;
  G.yaw = 0; G.pitch = -0.1; G.roll = 0;
}
function startDrop() {
  G.phase = 'drop'; G.dropT = 0; G.rebased = false; ow.portal.got = true;
  banner('DROP!', '#ff9be8'); G.fovKick = 16; G.shake = Math.max(G.shake, 0.8);
  for (const d of combat.drones) { d.alive = false; scene.remove(d.g); } combat.drones = [];
}
function setFade(a) { fadeEl.style.opacity = String(a); }
function flightOrient(dt, pitchOverride) {
  const fx = Math.sin(G.hdg), fz = -Math.cos(G.hdg), dyds = -G.desc;
  G.tilt.set(fx, dyds, fz).normalize();
  const pitch = pitchOverride !== undefined ? pitchOverride : clamp(Math.atan2(dyds, 1), -0.7, 0.5);
  G.yaw = damp(G.yaw, -G.hdg, 12, dt); G.pitch = damp(G.pitch, pitch, 6, dt); G.roll = damp(G.roll, clamp(-G.turn * 0.65, -0.7, 0.7), 7, dt);
  G.latV = G.turn * 14;
  rider.root.position.set(G.pos.x, G.pos.y - HIP, G.pos.z);
  rider.update(dt, G.t, { yaw: G.yaw, pitch: G.pitch, roll: G.roll }, 1);
}
function updateOpen(dt, lean) {
  const frozen = G.phase === 'title';
  ow.update(dt, G.t, G.pos);
  const skimF = clamp((T.skimH - G.h) / (T.skimH - 2), 0, 1);
  let vT = T.V0 + (G.desc > 0 ? G.desc * (T.vDive - T.V0) / 0.35 : G.desc * T.vClimb) + skimF * T.skimBoost;
  vT = clamp(vT, T.vMin, T.vMax);
  G.v = damp(G.v, frozen ? 10 : vT, 1.8, dt);
  const step = frozen ? 0 : G.v * dt;
  let fx = Math.sin(G.hdg), fz = -Math.cos(G.hdg);
  // the guide that has grown over a nearby ship / island: pulls altitude (and, softly, the line) -- steer and it lets go
  ow.guide(G.pos.x, G.y, G.pos.z, fx, fz, G.guide);
  const gd = G.guide;
  let assist = 0;
  if (gd.st && gd.d > 2) { const da = wrapPi(Math.atan2(gd.x - G.pos.x, -(gd.z - G.pos.z)) - G.hdg); if (Math.abs(da) < 0.9) assist = clamp(da * 0.8, -0.5, 0.5) * gd.w * (1 - Math.min(1, Math.abs(lean) * 1.6)); }
  G.turn = damp(G.turn, lean * T.turnRate + assist, 6, dt);
  if (!frozen) G.hdg += G.turn * dt;
  fx = Math.sin(G.hdg); fz = -Math.cos(G.hdg);
  const prevX = G.pos.x, prevZ = G.pos.z;
  G.pos.x += fx * step; G.pos.z += fz * step; G.s += step; G.lvDist = G.s - G.lvStartS;
  const yPrev = G.y;
  let ch = null;
  if (!frozen) {
    // chasing a drone: ITS path (pull-ups, dives, speed bursts) becomes the invisible path you are aligned to
    ch = combat.lockTarget && combat.lockTarget.alive ? combat.lockTarget : combat.drones.filter((d) => d.alive && d.dist < 230 && (d.g.position.x - G.pos.x) * fx + (d.g.position.z - G.pos.z) * fz > 8).sort((a, b) => a.dist - b.dist)[0];
    if (ch) { const wc = 1 - smoothstep(110, 230, ch.dist); G.y = damp(G.y, ch.g.position.y - 0.6, 3.2 * wc + 0.4, dt); G.v = Math.max(G.v, damp(G.v, ch.vd + 5 + (ch.g.position.y < G.y - 2 ? 9 : 0), 1.5, dt)); }
    else if (gd.st) G.y = damp(G.y, gd.y, 2.6 * gd.w, dt);
    if (!ch) G.y = damp(G.y, 0, 0.25 * (1 - gd.w), dt);                  // drifts back up to cruise altitude once nothing holds him down
    if (G.mode === 'nudge' && !G.auto) G.y += clamp(-input.readPitch(), -1, 1) * 9 * dt;
  }
  G.chase = ch;
  ow.surface(G.pos.x, G.y, G.pos.z, G.surf);
  const g = G.surf.top;
  if (G.y < g + T.floor) G.y = g + T.floor;
  G.pos.y = G.y; G.h = g === -Infinity ? 99 : G.y - g;
  G.desc = damp(G.desc, step > 0 ? (yPrev - G.y) / step : 0, 3, dt);
  // skim points + dust
  const sk = clamp((T.skimH - G.h) / (T.skimH - 2), 0, 1);
  if (sk > 0.2) { G.skimPts += dt * 140 * sk; G.score += dt * 140 * sk; }
  else if (G.skimPts > 0) { if (G.skimPts > 60) award(0, G.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 'SKIM +' + Math.round(G.skimPts)); G.skimPts = 0; }
  if (G.h < 18) combat.particles.emit(_p.set(G.pos.x + (Math.random() - 0.5) * 3, g + 0.4, G.pos.z + (Math.random() - 0.5) * 3), new THREE.Vector3(-fx * 4, 2 + Math.random() * 3, -fz * 4), [0.9, 0.85, 0.75], 0.9, 3.2, 0, 0.5 * (1 - G.h / 18));
  // boost rings (any direction) + the portal
  for (const r of ow.rings) {
    if (r.got) continue;
    if (Math.hypot(G.pos.x - r.x, G.pos.y - r.y, G.pos.z - r.z) < r.r + 1.0) {
      r.got = true; r.mesh.visible = false; G.rings++;
      award(250, r.mesh.position.clone(), 'RING +250'); G.v = Math.min(T.vMax, G.v + 3); G.fovKick = Math.max(G.fovKick, 5);
      combat.particles.burst(r.mesh.position, 24, 14, [1, 0.9, 0.4], 0.5, 1.4);
    }
  }
  if (!frozen && !ow.portal && G.lvDist > ow.portalDist()) ow.spawnPortal(G.pos.x, G.y, G.pos.z, fx, fz);
  const pt = ow.portal;
  if (pt && !pt.got && Math.hypot(G.pos.x - pt.x, G.pos.y - pt.y, G.pos.z - pt.z) < PORTAL_R * 0.9) { startDrop(); return; }
  flightOrient(dt);
  // dogfight, once the level has warmed up
  const warm = G.level === 0 ? 650 : 220;
  const fightOpen = !frozen && G.lvDist > warm && !(pt && Math.hypot(G.pos.x - pt.x, G.pos.z - pt.z) < 150);
  combat.glideUpdate(dt, { leg: adapter, s: G.s, lat: 0, pos: G.pos, camera, W, H, time: G.t, rnd, fightOpen, cap: 2, speed: G.v, hdg: G.hdg, fwd: { x: fx, z: fz } });
  ow.stream(G.pos.x, G.pos.z, fx, fz);
}
function updateDrop(dt, lean) {
  G.dropT += dt; const k = G.dropT;
  ow.update(dt, G.t, G.pos);
  G.v = damp(G.v, 54, 2.5, dt);
  G.turn = damp(G.turn, lean * T.turnRate * 0.5, 6, dt); G.hdg += G.turn * dt;
  const fx = Math.sin(G.hdg), fz = -Math.cos(G.hdg);
  G.pos.x += fx * G.v * 0.8 * dt; G.pos.z += fz * G.v * 0.8 * dt; G.y -= 36 * smoothstep(0, 0.6, k) * dt; G.pos.y = G.y; G.s += G.v * 0.8 * dt;
  G.desc = 0.75; G.h = 99;
  flightOrient(dt, -1.0);
  G.tilt.set(fx * 0.7, -0.9, fz * 0.7).normalize();
  if (!G.rebased && k >= 1.9) {
    G.rebased = true; G.level++; const th = applyTheme(G.level);
    const dy = G.y; camera.position.y -= dy; lookNow.y -= dy; G.y = 0; G.pos.y = 0;       // new level starts at altitude 0, hidden under the fade
    ow.reset(G.level); prebuild(); G.lvStartS = G.s; G.lvDist = 0; combat.reset(); clouds.reset(G.pos);
    banner('SKY ' + (G.level + 1) + ' - ' + th.name, '#ffd24a'); G.score += 500;
  }
  setFade(k < 1.9 ? smoothstep(1.1, 1.9, k) : 1 - smoothstep(1.9, 2.8, k));
  if (G.rebased) ow.stream(G.pos.x, G.pos.z, fx, fz);
  if (k >= 2.8) { G.phase = 'open'; setFade(0); G.fovKick = 0; }
}
function updatePortalMark() {
  const pt = ow.portal;
  if (!G.open || !pt || pt.got || !(G.phase === 'open')) { pmark.style.display = 'none'; return; }
  const v = _cp.set(pt.x, pt.y, pt.z).project(camera);
  const da = wrapPi(Math.atan2(pt.x - G.pos.x, -(pt.z - G.pos.z)) - G.hdg);
  const on = v.z < 1 && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.85;
  const dist = Math.round(Math.hypot(pt.x - G.pos.x, pt.z - G.pos.z));
  let nx = v.x, ny = v.y;
  if (!on) { nx = Math.abs(da) > 1.6 ? Math.sign(da) * 0.88 : clamp(v.z < 1 ? v.x : Math.sign(da), -0.88, 0.88); ny = v.z < 1 ? clamp(v.y, -0.8, 0.8) : 0.0; }
  pmark.style.display = 'block'; pmark.style.left = ((nx * 0.5 + 0.5) * W) + 'px'; pmark.style.top = ((-ny * 0.5 + 0.5) * H) + 'px';
  pmark.textContent = (on ? '' : da > 0 ? '▶ ' : '◀ ') + 'PORTAL ' + dist + 'm' + (on ? '' : da > 0 ? ' ▶' : ' ◀').replace(' ▶', '').replace(' ◀', '');
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
    const height = lerp(6.4, 4.6, low), back = lerp(8.6, 7.2, low) + sp * 1.2, ahead = 62;      // camera up and back: Donnie rides in the lower third, below the sights
    fovG = 70 + sp * 14 + (1 - smoothstep(2, 14, G.h)) * 6;
    if (G.open) {       // heading-relative rig: behind him along his heading, swinging to the outside of a turn
      const fx = Math.sin(G.hdg), fz = -Math.cos(G.hdg), qx = Math.cos(G.hdg), qz = Math.sin(G.hdg);
      glTgt.set(G.pos.x - fx * back - qx * G.turn * 2.2, G.pos.y + height - G.tilt.y * back * 0.6, G.pos.z - fz * back - qz * G.turn * 2.2);
      glLook.set(G.pos.x + fx * ahead * 0.95, G.pos.y + G.tilt.y * ahead + 0.5, G.pos.z + fz * ahead * 0.95);
    } else if (G.loopOn) {   // the loop: still third person -- the camera rides behind him along his own flight direction, over the top and down
      const th = G.loopTh, hx = Math.sin(G.hdg), hz = -Math.cos(G.hdg), fy = Math.sin(th), fc = Math.cos(th), back = 8.5;
      glTgt.set(G.pos.x - hx * fc * back - hx * -Math.sin(th) * 0.55 * 3.2, G.pos.y - fy * back + (fc * 0.55 + 0.45) * 3.2, G.pos.z - hz * fc * back - hz * -Math.sin(th) * 0.55 * 3.2);
      glLook.set(G.pos.x + hx * fc * 9, G.pos.y + fy * 9, G.pos.z + hz * fc * 9); fovG = 76;
    } else {       // the path's own heading: behind him along the curve, swinging to the outside of a turn
      const fx = Math.sin(G.hdg), fz = -Math.cos(G.hdg), qx = Math.cos(G.hdg), qz = Math.sin(G.hdg), sway = G.latV * 0.12 + (G.pturn || 0) * 2.4;
      glTgt.set(G.pos.x - fx * back - qx * sway, G.pos.y + height - G.tilt.y * back * 0.6, G.pos.z - fz * back - qz * sway);
      glLook.set(G.pos.x + fx * ahead * 0.95, G.pos.y + G.tilt.y * ahead + 0.5, G.pos.z + fz * ahead * 0.95);
    }
  } else { glTgt.copy(runTgt); glLook.copy(runLook); }
  camTgt.lerpVectors(runTgt, glTgt, k); camLook.lerpVectors(runLook, glLook, k);
  const swoop = Math.sin(Math.PI * k);                              // pull out a touch mid-transition, so the move reads
  camTgt.z += swoop * 2.6; camTgt.y += swoop * 1.3;
  const fov = lerp(64, fovG, k) + swoop * 3;
  if (!G.camInit) { camera.position.copy(camTgt); lookNow.copy(camLook); G.camInit = true; }
  const rate = gl ? (G.loopOn ? 16 : 7) : 6;
  camera.position.x = damp(camera.position.x, camTgt.x, rate, dt); camera.position.y = damp(camera.position.y, camTgt.y, rate * 0.9, dt); camera.position.z = damp(camera.position.z, camTgt.z, rate + 2, dt);
  const lr = G.loopOn ? 22 : 9; lookNow.x = damp(lookNow.x, camLook.x, lr, dt); lookNow.y = damp(lookNow.y, camLook.y, lr, dt); lookNow.z = damp(lookNow.z, camLook.z, lr, dt);
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
  else if (G.leg) { $('prog-dive').textContent = 'LEG ' + (G.legIdx + 1); $('prog-land').textContent = 'NEXT'; }
  hpEl.style.display = gl && !G.open && CHASE_FEATURE ? 'block' : 'none'; hpEl.firstChild.style.width = clamp(G.hp, 0, 100) + '%';
  hurtEl.style.opacity = String(clamp(G.hurtT, 0, 1) * 0.85);
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
    const shown = combat.drones.filter((d) => d.alive && d.on && d.dist < 230).sort((a, b) => a.dist - b.dist);
    for (const d of shown) {
      if (n >= brackets.length) break;
      const b = brackets[n++]; b.style.display = 'block';
      b.style.left = d.sx + 'px'; b.style.top = d.sy + 'px';
      b.style.setProperty('--bs', clamp(5200 / Math.max(d.dist, 20), 26, 90) + 'px');
      b.className = d === combat.lockTarget && locked ? 'lock' : '';
      b.firstChild.textContent = (d.core ? 'CORE ' : '') + Math.round(d.dist) + 'm';
      b.hpFill.style.width = clamp(d.hp / d.maxhp, 0, 1) * 100 + '%';
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
window.addEventListener('keydown', (e) => { if (e.code === 'KeyP') togglePause(); if (e.code === 'KeyM') setMode(G.mode === 'path' ? 'nudge' : 'path'); if (e.code === 'KeyO') setAuto(!G.auto); if (e.code === 'KeyN') { if (G.open) { if (ow.portal) { G.pos.set(ow.portal.x - Math.sin(G.hdg) * 40, ow.portal.y, ow.portal.z + Math.cos(G.hdg) * 40); G.y = ow.portal.y; } } else if (G.leg) nextLeg(); } });
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
    updateHud(dt); updatePortalMark();
  }
  renderer.render(scene, camera);
  // rear-view mirror while pilots are on the tail
  const mirror = !G.open && G.phase === 'glide' && enemy.pursuers.length > 0 && !G.loopOn;
  if (mirror) {
    const mw = Math.round(Math.min(330, W * 0.3)), mh = Math.round(mw * 0.56), mx = W - mw - 14, myTop = 74;
    const mfx = Math.sin(G.hdg), mfz = -Math.cos(G.hdg);
    rearCam.position.set(G.pos.x - mfx * 3, G.pos.y + 2.4, G.pos.z - mfz * 3); rearCam.lookAt(G.pos.x - mfx * 80, G.pos.y + 0.9, G.pos.z - mfz * 80);
    renderer.setScissorTest(true); renderer.setViewport(mx, H - myTop - mh, mw, mh); renderer.setScissor(mx, H - myTop - mh, mw, mh);
    renderer.render(scene, rearCam);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    mirrorEl.style.display = 'block'; mirrorEl.style.left = mx + 'px'; mirrorEl.style.top = myTop + 'px'; mirrorEl.style.width = (mw - 6) + 'px'; mirrorEl.style.height = (mh - 6) + 'px';
    mirrorEl.style.borderColor = enemy.warn > 0.2 ? (Math.floor(G.t * 10) % 2 ? '#ff3b3b' : '#fff') : '#fff';
  } else mirrorEl.style.display = 'none';
}

async function boot() {
  await rider.load('/models/raphael.glb', '/models/clips.json', '/models/clips_run.json', '/models/attacks.json');
  if (OPEN) startOpen(); else { startLeg(G.legIdx); G.phase = 'title'; }
  window.__game = { G, rider, combat, T, input, get leg() { return G.leg; }, camera, scene, renderer, startGlide, handover, nextLeg, enemy, startLoop, setAuto, setMode, ow, startDrop };
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
