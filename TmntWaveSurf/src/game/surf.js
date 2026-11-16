// The gameplay layer: rider physics, scripted air tilt, wake, obstacles,
// pickups, the ammo clip, shooting, the flying boss and the (switched-off)
// jetski boss -- all drawn on the 2D canvas over the wave.
//
// PORTED FROM THE PROTOTYPE (DawnPatrol/experiments/wave-levels/levels.html)
// with the behaviour, numbers and draw order unchanged. What changed:
//   * the window-global plumbing to the wave iframe is a direct call:
//     frame() steps the physics, hands the rider height to wave.update(), and
//     draws against the geometry it returns, all in one rAF callback;
//   * `live` gates spawning and scoring, so the countdown rides the wave with
//     nothing coming at you and a restart starts from zero;
//   * a hit reports through hooks.onDamage, which owns lives and the run's end;
//   * the score accumulates here (distance, airtime, pickups, boss KOs);
//   * the test hooks on window (__spawnObstacle, __summonBoss, __hold, ...)
//     are now methods on the returned object, reached only through the dev tools.
import { PHYS, GAME, WAKE, RUN, DIRECT_RATE } from './constants.js';
import mikeyUrl from '../assets/mikey_surf.webp';
import obstAUrl from '../assets/obstacle_a.webp';
import obstBUrl from '../assets/obstacle_b.webp';
import bossUrl from '../assets/boss.webp';
import projUrl from '../assets/projectile.webp';
import jetUrl from '../assets/jetski_boss.webp';

// flow speed by face height in screen-widths/s (same curve as the shader flow)
const flowAt = hh => (2.05 + (0.5 - 2.05) * Math.pow(Math.min(1, Math.max(0, hh / 0.95)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, hh / 0.95))), 1.5)) / 1.778;
const rand = ([a, b]) => a + Math.random() * (b - a);
const INK = '#120a1e';
const ANCHOR = { x: 0.57, y: 0.90 };   // board contact point inside the 768x638 sprite
const TAIL = { x: 0.20, y: 0.86 };      // board tail inside the sprite

// ---- sprite slots: the art if it loads, otherwise ink-outlined placeholders ----
function slot(url, makePlaceholder) {
  const o = { img: null, ph: makePlaceholder() }; const im = new Image();
  im.onload = () => { if (im.naturalWidth > 0) o.img = im; }; im.src = url; return o;
}
const canvasOf = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')); return c; };
function blobPH(body, hair, band) {
  return canvasOf(300, 320, g => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const tent = [[150, 95, 70, 40], [150, 90, 120, 20], [150, 90, 185, 25], [155, 95, 240, 50], [140, 100, 45, 110], [165, 100, 262, 120], [150, 90, 150, 10]];
    for (const [x0, y0, x1, y1] of tent) { g.strokeStyle = INK; g.lineWidth = 40; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 20, (y0 + y1) / 2 - 25, x1, y1); g.stroke(); }
    for (const [x0, y0, x1, y1] of tent) { g.strokeStyle = hair; g.lineWidth = 28; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 20, (y0 + y1) / 2 - 25, x1, y1); g.stroke(); }
    g.fillStyle = body; g.strokeStyle = INK; g.lineWidth = 9;
    g.beginPath(); g.ellipse(150, 210, 98, 112, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(185, 230, 55, 85, 0, 0, Math.PI * 2); g.fill();
    if (band) { g.fillStyle = band; g.strokeStyle = INK; g.lineWidth = 6; g.fillRect(85, 112, 130, 20); g.strokeRect(85, 112, 130, 20); }
    for (const ex of [115, 185]) { g.fillStyle = '#fff6d8'; g.beginPath(); g.ellipse(ex, 180, 26, 22, 0, 0, Math.PI * 2); g.fill(); g.lineWidth = 6; g.stroke();
      g.lineWidth = 7; g.beginPath(); g.moveTo(ex - 10, 170); g.lineTo(ex + 10, 190); g.moveTo(ex + 10, 170); g.lineTo(ex - 10, 190); g.stroke(); }
    g.lineWidth = 7; g.beginPath(); g.arc(150, 265, 30, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  });
}
const bossPH = () => canvasOf(300, 380, g => {
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 9;
  g.fillStyle = '#1b1c22'; g.beginPath(); g.moveTo(105, 225); g.lineTo(195, 225); g.lineTo(210, 300); g.lineTo(90, 300); g.closePath(); g.fill(); g.stroke();
  for (const [x0, x1] of [[120, 105], [180, 195]]) { g.beginPath(); g.moveTo(x0, 300); g.lineTo(x1, 365); g.lineWidth = 34; g.strokeStyle = INK; g.stroke(); g.lineWidth = 24; g.strokeStyle = '#1b1c22'; g.stroke(); g.lineWidth = 5; g.strokeStyle = '#00c9ff'; g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 30; g.beginPath(); g.moveTo(105, 235); g.lineTo(55, 290); g.moveTo(195, 235); g.lineTo(250, 285); g.stroke();
  g.strokeStyle = '#1b1c22'; g.lineWidth = 20; g.stroke(); g.strokeStyle = '#00c9ff'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#d98a2b'; g.strokeStyle = INK; g.lineWidth = 7; for (const [x, y] of [[55, 292], [250, 288], [105, 368], [195, 368]]) { g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); g.stroke(); }
  g.fillStyle = '#ffd400'; g.lineWidth = 8; g.beginPath(); g.moveTo(120, 50); g.lineTo(175, 2); g.lineTo(165, 45); g.lineTo(205, 40); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#d98a2b'; g.lineWidth = 9; g.beginPath(); g.arc(150, 130, 100, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.arc(185, 150, 70, -0.6, 1.9); g.fill();
  for (const ex of [105, 185]) { g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(ex, 135, 30, 24, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(ex - 4, 138, 7, 0, 7); g.fill(); }
  g.lineWidth = 9; g.beginPath(); g.moveTo(70, 100); g.lineTo(135, 118); g.moveTo(225, 100); g.lineTo(160, 118); g.stroke();
  g.lineWidth = 7; g.beginPath(); g.arc(150, 200, 22, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
});

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas   the 2D gameplay canvas (on top of the wave)
 * @param {object} o.wave               from createWave()
 * @param {() => boolean} o.holding     the single input
 * @param {() => object} o.directKeys   {up, dn, lastKey} for the Direct dev controller
 * @param {object} o.hooks              { onDamage() }
 */
export function createSurf({ canvas, wave, holding, directKeys, hooks }) {
  const ctx = canvas.getContext('2d');
  const SPR = {
    a: slot(obstAUrl, () => blobPH('#b5643c', '#f0a640', null)), b: slot(obstBUrl, () => blobPH('#c9c24a', '#9fd9b0', '#c8323c')),
    boss: slot(bossUrl, bossPH), proj: slot(projUrl, () => canvasOf(120, 120, g => { g.fillStyle = '#00ff1e'; g.strokeStyle = INK; g.lineWidth = 9;
      g.beginPath(); g.arc(60, 60, 48, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#c8ffb0'; g.beginPath(); g.arc(45, 45, 14, 0, 7); g.fill(); })),
    jet: slot(jetUrl, bossPH),
  };
  const sprImg = o => o.img || o.ph;
  const img = new Image(); img.src = mikeyUrl;

  // ---------- run state ----------
  let game, mode = 'Physics', noSpawn = false, lastW = 1280;
  let h, sPos, sVel, air, airT, airH, airV, airG, tilt, lastY, vyScreen, holdT, airTilt0, airTp, railNow, directT;
  const wake = []; let trailPrev = null;
  const lines = Array.from({ length: 9 }, () => ({ x: Math.random(), y: 0.58 + Math.random() * 0.4, len: 0.05 + Math.random() * 0.09, v: 1.3 + Math.random() * 0.6 }));
  let debugText = '';

  function reset() {
    game = { hits: 0, dodged: 0, obst: [], proj: [], nextObst: 2.0, invuln: 0, flash: 0, knockTilt: 0,
      boss: { state: 'away', t: 0, next: 20 + Math.random() * 10, x: 0, y: 0, tx: 0, shots: [], fired: 0, windup: 0, stay: 10 }, projTimes: [], clock: 0 };
    game.picks = []; game.clip = []; game.shots = []; game.pops = []; game.nextPick = 1.2; game.fireCd = 0; game.collected = 0; game.bossHits = 0; game.bossKills = 0;
    game.boss.hp = GAME.BOSS_HP; game.boss.flash = 0;
    game.jet = { state: 'away', next: 34 + Math.random() * 10, t: 0, x: 0, y: 0, s: 0.3, v: 0, holdT: 0, air: false, airH: 0, airV: 0, airG: 1, airT: 0,
      tgt: 0.4, tgtT: 0, hp: GAME.BOSS_HP, flash: 0, shots: [], fired: 0, windup: 0, stay: 12, tilt: 0, spin: 0, cx: 0, cy: 0 };
    // the run's score: distance + airtime + pickups + boss KOs
    game.score = 0; game.dist = 0; game.airTime = 0; game.stars = 0; game.specials = 0;
    h = 0.5; sPos = 0; sVel = 0; air = false; airT = 0; airH = 0; airV = 0; airG = 1;
    tilt = 0; lastY = null; vyScreen = 0; holdT = 0; airTilt0 = 0; airTp = 0.6; directT = 0;
    wake.length = 0; trailPrev = null;
  }
  reset();

  function spawnPicks(air_, xFrac) {
    const W = lastW, n = Math.round(rand([GAME.PICK_N[0], GAME.PICK_N[1] + 0.99]));
    const special = Math.random() < GAME.PICK_SPECIAL, x0 = (xFrac ?? 1.08) * W;
    if (air_ ?? (Math.random() < GAME.PICK_AIR_CHANCE)) {
      for (let i = 0; i < n; i++) game.picks.push({ air: true, i, n, x: x0 + i * GAME.PICK_SPACING * W, type: special && i === n - 1 ? 'special' : 'star', ph: Math.random() * 6 });
    } else {
      const h0 = 0.15 + Math.random() * 0.6, slope = (Math.random() - 0.5) * 0.12;
      for (let i = 0; i < n; i++) game.picks.push({ air: false, h: Math.min(0.92, Math.max(0.06, h0 + slope * i + 0.04 * Math.sin(i * 0.9))), x: x0 + i * GAME.PICK_SPACING * W, type: special && i === n - 1 ? 'special' : 'star', ph: Math.random() * 6 });
    }
  }
  const spawnObstacle = (hh, xFrac) => { game.obst.push({ x: (xFrac ?? 1.1) * lastW, h: hh, type: Math.random() < 0.5 ? 'a' : 'b', ph: Math.random() * 6.3, hit: false, passed: false }); };
  const summonBoss = () => { if (game.boss.state === 'away' && game.jet.state === 'away') game.boss.next = 0; };
  const summonJet = () => { if (GAME.JET_ENABLED && game.boss.state === 'away' && game.jet.state === 'away') game.jet.next = 0; };
  const peakBodyY = H => PHYS.AIR_PEAK_Y * H - 0.45 * (H / 1080 * 205);   // rider body centre at the top of a (locked) jump

  function drawShuriken(x, y, r, rot) {   // 4-point steel star, ink outline, toon highlight
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.lineJoin = 'miter';
    const tip = r, inn = r * 0.30;
    const starPath = () => { ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 === 0 ? tip : inn; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); };
    for (let k = 0; k < 4; k++) {   // each blade: lit half + shadow half (toon facets)
      const a = k * Math.PI / 2, a1 = a - Math.PI / 4, a2 = a + Math.PI / 4;
      ctx.fillStyle = '#dfe8f0'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a1) * inn, Math.sin(a1) * inn); ctx.lineTo(Math.cos(a) * tip, Math.sin(a) * tip); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8796a8'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * tip, Math.sin(a) * tip); ctx.lineTo(Math.cos(a2) * inn, Math.sin(a2) * inn); ctx.closePath(); ctx.fill();
    }
    starPath(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * 0.14); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, r * 0.13, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawNunchaku(x, y, r, rot) {   // two orange-wrapped sticks on a short chain
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const L = r * 1.15, Wd = r * 0.36;
    const stick = (ang, ox) => { ctx.save(); ctx.translate(ox, -r * 0.05); ctx.rotate(ang);
      ctx.fillStyle = '#9a5a2b'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.beginPath(); ctx.roundRect(-Wd / 2, 0, Wd, L, Wd / 2); ctx.fill();
      ctx.fillStyle = '#f15a24'; for (const f of [0.35, 0.6]) ctx.fillRect(-Wd / 2, L * f, Wd, L * 0.12);
      ctx.beginPath(); ctx.roundRect(-Wd / 2, 0, Wd, L, Wd / 2); ctx.stroke(); ctx.restore(); };
    stick(0.55, -r * 0.18); stick(-0.55, r * 0.18);
    ctx.strokeStyle = '#3a3444'; ctx.lineWidth = Math.max(2, r * 0.09); ctx.beginPath(); ctx.moveTo(-r * 0.18, -r * 0.05); ctx.quadraticCurveTo(0, -r * 0.45, r * 0.18, -r * 0.05); ctx.stroke();
    ctx.restore();
  }
  const drawAmmo = (type, x, y, r, rot) => type === 'special' ? drawNunchaku(x, y, r, rot) : drawShuriken(x, y, r, rot);

  function crestAt(x, W, rail, line) {   // live riding-range top (screen px) at screen x
    if (!line || line.length < 2) return rail.yCrest;
    const f = Math.min(line.length - 1, Math.max(0, x / W * (line.length - 1))), i = Math.floor(f), j = Math.min(line.length - 1, i + 1);
    return line[i] + (line[j] - line[i]) * (f - i);
  }
  function burst(x, y, n, up, W, H) {   // launch spray / landing splash
    for (let i = 0; i < n; i++) wake.push({ x, y, vx: -W * (0.2 + Math.random() * 0.5), vy: -(up * (0.5 + Math.random())) * H / 1080,
      r: (4 + Math.random() * 8) * H / 1080, age: 0, life: 0.35 + Math.random() * 0.3, g: 1500 * H / 1080, dir: 0, burst: true });
  }
  function onHit(x, y, W, H) {
    if (game.invuln > 0) return;
    game.hits++; game.invuln = GAME.INVULN; game.flash = 0.14; game.knockTilt = 0.55;
    if (mode === 'Physics') { if (air) { airV = Math.min(airV, 0); } else sVel = Math.min(sVel, -GAME.KNOCK_V); }
    else h = Math.max(0, h - 0.1);
    burst(x, y, 26, 700, W, H);
    if (hooks && hooks.onDamage) hooks.onDamage();
  }

  function updateGame(dt, W, H, rail, line, body, live) {
    game.clock += dt; game.invuln = Math.max(0, game.invuln - dt); game.flash = Math.max(0, game.flash - dt); game.knockTilt *= Math.exp(-dt * 5);
    const sprH = H / 1080 * 205;
    // --- obstacles ---
    if (live) game.nextObst -= dt;
    if (game.nextObst <= 0 && !noSpawn && live) { spawnObstacle(rand(GAME.OBST_H)); game.nextObst = rand(GAME.OBST_GAP) * (game.boss.state === 'away' ? 1 : 1.7); }
    const yTr = rail.yTrough;
    for (let i = game.obst.length - 1; i >= 0; i--) {
      const o = game.obst[i]; o.x -= flowAt(o.h) * GAME.OBST_SPEED * W * dt;
      o.size = GAME.OBST_SIZE * sprH;
      o.y = yTr - o.h * (yTr - crestAt(o.x, W, rail, line)) + Math.sin(game.clock * 2.4 + o.ph) * GAME.OBST_BOB * H / 1080;   // waterline
      const cx = o.x, cy = o.y - 0.38 * o.size;
      if (!o.hit && Math.hypot(cx - body.x, cy - body.y) < body.r + 0.30 * o.size) { o.hit = true; onHit(cx, cy, W, H); }
      if (!o.passed && o.x < body.x - body.r) { o.passed = true; if (!o.hit) game.dodged++; }
      if (o.x < -o.size) game.obst.splice(i, 1);
    }
    // --- boss ---
    const B = game.boss, bs = GAME.BOSS_SIZE * sprH;
    if (B.state === 'away') { if (game.jet.state === 'away' && live) B.next -= dt; if (B.next <= 0 && game.jet.state === 'away') { B.state = 'enter'; B.t = 0; B.hp = GAME.BOSS_HP; B.dy = 0; B.flat = false; B.baseY = peakBodyY(H); B.spin = 0; B.x = W * 1.15; B.tx = rand(GAME.BOSS_POS.x) * W; B.y = peakBodyY(H);
        B.stay = rand(GAME.BOSS_STAY); const n = Math.round(rand([GAME.BOSS_SHOTS[0], GAME.BOSS_SHOTS[1] + 0.99])); B.shots = [];
        let ts = 1.4; for (let k = 0; k < n; k++) { B.shots.push(ts); ts += (B.stay - 2.2) / n; } B.fired = 0; B.windup = 0; } }
    else {
      B.t += dt;
      if (B.state === 'enter') { const k = Math.min(1, B.t / 1.0); B.x = W * 1.15 + (B.tx - W * 1.15) * (1 - Math.pow(1 - k, 3)); if (k >= 1) { B.state = 'hover'; B.t = 0; } }
      else if (B.state === 'hover') {
        B.x = B.tx + Math.sin(B.t * 0.7) * 0.03 * W; B.yb = Math.sin(B.t * 2.1) * 10 * H / 1080;
        if (B.fired < B.shots.length && B.t >= B.shots[B.fired] - GAME.WINDUP) {
          if (B.windup === 0) B.flat = body.y < GAME.FLAT_ZONE * H;          // decide the shot type as the wind-up starts
          B.windup = Math.min(1, (B.t - (B.shots[B.fired] - GAME.WINDUP)) / GAME.WINDUP);
          if (B.flat) B.laneY = Math.min(GAME.FLAT_ZONE * H, body.y);        // track the rider's height through the wind-up
        } else B.windup = 0;
        // swoop: slide down to the firing lane for a flat shot, back up to the hover height otherwise
        B.baseY = peakBodyY(H);
        const tgtDy = B.flat && B.windup > 0 ? (B.laneY - 0.10 * bs) - B.baseY : 0;
        B.dy += (tgtDy - B.dy) * Math.min(1, dt * GAME.SWOOP_RATE); B.y = B.baseY + B.dy;
        if (B.fired < B.shots.length && B.t >= B.shots[B.fired]) {
          const sx = B.x - 0.30 * bs, sy = B.y + 0.10 * bs + (B.yb || 0), T = rand(GAME.PROJ_TIME);
          if (B.flat) game.proj.push({ x: sx, y: sy, vx: (body.x - sx) / T, vy: 0, tx: body.x, t0: game.clock, T, done: false, flat: true });
          else game.proj.push({ x: sx, y: sy, vx: (body.x - sx) / T, vy: (body.y - sy) / T, tx: body.x, t0: game.clock, T, done: false });
          B.fired++; B.windup = 0; B.flat = false;
        }
        if (B.t >= B.stay) { B.state = 'exit'; B.t = 0; }
      } else if (B.state === 'defeat') {   // KO: spins and tumbles off the top-right
        B.x += 900 * dt * W / 1920; B.y -= (500 - 1400 * B.t) * dt * H / 1080; B.spin = (B.spin || 0) + dt * 14;
        if (B.t > 1.6) { B.state = 'away'; B.next = rand(GAME.BOSS_EVERY); B.spin = 0; }
      } else if (B.state === 'exit') { B.x += (400 + 2600 * B.t) * dt * W / 1920; if (B.x > W * 1.2) { B.state = 'away'; B.next = rand(GAME.BOSS_EVERY); } }
    }
    updateJet(dt, W, H, rail, line, body, sprH, live);
    // --- projectiles ---
    for (let i = game.proj.length - 1; i >= 0; i--) {
      const p = game.proj[i]; p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.done && p.x <= p.tx) { p.done = true; }
      if (Math.hypot(p.x - body.x, p.y - body.y) < body.r + GAME.PROJ_R * H) { onHit(p.x, p.y, W, H); game.proj.splice(i, 1); continue; }
      if (p.x < -50 || p.y > H + 50 || p.y < -50) game.proj.splice(i, 1);
    }
    // --- pickups (strings on the face, arcs over the lip) ---
    if (live) game.nextPick -= dt;
    if (game.nextPick <= 0 && !noSpawn && live) { spawnPicks(); game.nextPick = rand(GAME.PICK_GAP); }
    const ps = GAME.PICK_SIZE * sprH, peakY = PHYS.AIR_PEAK_Y * H + 0.25 * sprH;
    for (let i = game.picks.length - 1; i >= 0; i--) {
      const q = game.picks[i];
      if (q.air) {   // arc above the lip: reachable only from a jump
        q.x -= 0.30 * W * dt;
        const cr = crestAt(q.x, W, rail, line), u = q.n > 1 ? q.i / (q.n - 1) : 0.5;
        q.y = cr - 0.35 * sprH - (cr - 0.35 * sprH - peakY) * 0.85 * Math.sin(Math.PI * (0.15 + 0.7 * u));
      } else {
        q.x -= flowAt(q.h) * GAME.PICK_SPEED * W * dt;
        q.y = yTr - q.h * (yTr - crestAt(q.x, W, rail, line)) - 0.30 * sprH;   // float above the water
      }
      q.y += Math.sin(game.clock * 3 + q.ph) * 4 * H / 1080;
      if (Math.hypot(q.x - body.x, q.y - body.y) < body.r + 0.45 * ps) {
        if (game.clip.length < GAME.CLIP_MAX) game.clip.push(q.type);
        game.collected++; game.pops.push({ x: q.x, y: q.y, t: 0, type: q.type });
        if (q.type === 'special') { game.specials++; game.score += RUN.SPECIAL_PTS; } else { game.stars++; game.score += RUN.STAR_PTS; }
        game.picks.splice(i, 1); continue;
      }
      if (q.x < -ps) game.picks.splice(i, 1);
    }
    for (let i = game.pops.length - 1; i >= 0; i--) { game.pops[i].t += dt; if (game.pops[i].t > 0.45) game.pops.splice(i, 1); }
    // --- firing: only while airborne, 4/s, from the FRONT of the clip, at the boss ---
    const bossUp = B.state === 'enter' || B.state === 'hover';
    const J = game.jet, jetUp = J.state === 'enter' || J.state === 'ride' || J.state === 'exit';
    const ko = () => { game.bossKills++; game.score += RUN.BOSS_KO_PTS; };
    const tgt = bossUp ? { x: B.x, y: B.y + (B.yb || 0), r: 0.38 * bs, hit: dmg => { B.hp -= dmg; B.flash = 0.12; if (B.hp <= 0) { B.state = 'defeat'; B.t = 0; ko(); burst(B.x, B.y, 40, 900, W, H); } } }
              : jetUp ? { x: J.cx, y: J.cy, r: 0.40 * GAME.JET_SIZE * sprH, hit: dmg => { J.hp -= dmg; J.flash = 0.12; if (J.hp <= 0) { J.state = 'defeat'; J.t = 0; ko(); burst(J.cx, J.cy, 40, 900, W, H); } } } : null;
    game.fireCd = Math.max(0, game.fireCd - dt);
    if (air && game.clip.length && game.fireCd === 0 && (tgt || !GAME.FIRE_NEEDS_BOSS)) {
      const type = game.clip.shift(), sp = GAME.SHOT_SPEED * W * (type === 'special' ? 0.75 : 1);
      const tx = tgt ? tgt.x : W * 1.2, ty = tgt ? tgt.y : body.y - 0.2 * H;
      const flat = body.y < GAME.FLAT_ZONE * H && ty < GAME.FLAT_ZONE * H;   // both up high: straight 0 deg, no homing -> time your height
      const d = Math.hypot(tx - body.x, ty - body.y) || 1, sx0 = body.x + 0.2 * sprH, sy0 = body.y - 0.1 * sprH;
      if (flat) game.shots.push({ type, x: sx0, y: sy0, vx: Math.sign(tx - body.x || 1) * sp, vy: 0, rot: 0, flat: true });
      else game.shots.push({ type, x: sx0, y: sy0, vx: (tx - body.x) / d * sp, vy: (ty - body.y) / d * sp, rot: 0 });
      game.fireCd = 1 / GAME.FIRE_RATE;
    }
    const shotR = GAME.PICK_SIZE * sprH / 2 * GAME.SHOT_SIZE;
    for (let i = game.shots.length - 1; i >= 0; i--) {
      const sh = game.shots[i];
      if (tgt && !sh.flat) {   // light homing so an aimed throw still connects
        const dx = tgt.x - sh.x, dy = tgt.y - sh.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(sh.vx, sh.vy);
        sh.vx += (dx / d * sp - sh.vx) * Math.min(1, dt * 4); sh.vy += (dy / d * sp - sh.vy) * Math.min(1, dt * 4);
      }
      sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.rot += dt * (sh.type === 'special' ? 12 : 18);
      if (tgt && Math.hypot(sh.x - tgt.x, sh.y - tgt.y) < tgt.r + 0.5 * shotR) {
        tgt.hit(sh.type === 'special' ? GAME.SPECIAL_DMG : 1); game.bossHits++;
        burst(sh.x, sh.y, sh.type === 'special' ? 22 : 10, 500, W, H);
        game.shots.splice(i, 1); continue;
      }
      if (sh.x > W + 80 || sh.x < -80 || sh.y < -80 || sh.y > H + 80) game.shots.splice(i, 1);
    }
    B.flash = Math.max(0, (B.flash || 0) - dt);
    debugText = `hits ${game.hits}   dodged ${game.dodged}   ammo ${game.clip.length}/${GAME.CLIP_MAX}   boss ${B.state}${B.state === 'away' ? ' (' + B.next.toFixed(0) + 's)' : ' hp ' + Math.max(0, B.hp)}${GAME.JET_ENABLED ? '   jet ' + J.state + (J.state === 'away' ? '' : ' hp ' + Math.max(0, J.hp)) : ''}   KOs ${game.bossKills}   [B] boss${GAME.JET_ENABLED ? ' [N] jetski' : ''}`;
  }

  function updateJet(dt, W, H, rail, line, body, sprH, live) {
    const J = game.jet, P = PHYS, yTr = rail.yTrough, js = GAME.JET_SIZE * sprH;
    if (J.state === 'away') {
      if (!GAME.JET_ENABLED || game.boss.state !== 'away') return;  // disabled for now / one boss at a time
      if (live) J.next -= dt; if (J.next > 0) return;
      J.state = 'enter'; J.t = 0; J.x = W * 1.2; J.tx = rand(GAME.JET_X) * W; J.s = 0.35; J.v = 0; J.air = false; J.hp = GAME.BOSS_HP; J.spin = 0;
      J.stay = rand([GAME.BOSS_STAY[0] + 2, GAME.BOSS_STAY[1] + 4]); const n = Math.round(rand([GAME.BOSS_SHOTS[0] + 1, GAME.BOSS_SHOTS[1] + 1.99]));
      J.shots = []; let ts = 1.6; for (let k = 0; k < n; k++) { J.shots.push(ts); ts += (J.stay - 2.4) / n; } J.fired = 0; J.windup = 0;
    }
    J.t += dt;
    if (J.state === 'defeat') {
      J.x += 700 * dt * W / 1920; J.cy -= (300 - 1300 * J.t) * dt * H / 1080; J.spin += dt * 10;
      if (J.t > 1.6) { J.state = 'away'; J.next = rand(GAME.BOSS_EVERY) + 8; }
      return;
    }
    if (J.state === 'enter') { const k = Math.min(1, J.t / 1.3); J.x = W * 1.2 + (J.tx - W * 1.2) * (1 - Math.pow(1 - k, 3)); if (k >= 1) { J.state = 'ride'; J.t = 0; } }
    else if (J.state === 'ride') { J.x = J.tx + Math.sin(J.t * 0.5) * 0.04 * W; if (J.t >= J.stay && !J.air) { J.state = 'exit'; J.t = 0; } }
    else if (J.state === 'exit') { J.x += (300 + 2200 * J.t) * dt * W / 1920; if (J.x > W * 1.25) { J.state = 'away'; J.next = rand(GAME.BOSS_EVERY) + 8; return; } }
    // --- AI input: wander up and down the face; if a shot is coming and the player is up high, ride up and launch to fire flat ---
    const nextShot = J.fired < J.shots.length ? J.shots[J.fired] : 1e9;
    const playerHigh = body.y < GAME.FLAT_ZONE * H;
    J.tgtT -= dt; if (J.tgtT <= 0) { J.tgt = 0.1 + Math.random() * 0.75; J.tgtT = 1.2 + Math.random() * 1.8; }
    const goLaunch = J.state === 'ride' && playerHigh && nextShot - J.t < 2.4 && nextShot - J.t > 0;
    const hold = J.state !== 'enter' && (goLaunch ? true : J.s < J.tgt);
    // --- same integrator as the player (incl. ramp + locked jump) ---
    const crX = crestAt(J.x, W, rail, line);
    if (!J.air) {
      J.holdT = hold ? J.holdT + dt : 0; const rp = 1 + (P.RAMP || 0) * Math.min(1, J.holdT / (P.RAMP_T || 1));
      J.v += (-P.GRAVITY + (hold ? P.THRUST * rp : 0) - P.DAMP * J.v) * dt; J.s += J.v * dt;
      if (J.s <= 0) { J.s = 0; J.v = Math.max(0, J.v); }
      if (J.s >= 1) { J.s = 1;
        if (J.v > P.LAUNCH_MIN_V && goLaunch) { J.air = true; J.airT = 0; J.airH = 0; const rise = Math.max(12, crX - P.AIR_PEAK_Y * H);
          J.airG = 8 * rise / (P.AIR_TIME * P.AIR_TIME); J.airV = Math.sqrt(2 * J.airG * rise); burst(J.x, crX, 22, 900, W, H); }
        J.v = 0; }
      J.y = yTr - J.s * (yTr - crX);
    } else {
      J.airT += dt; J.airV -= J.airG * dt; J.airH += J.airV * dt;
      if (J.airH <= 0) { J.air = false; J.airH = 0; J.s = 0.97; J.v = 0; burst(J.x, crX, 22, 650, W, H); }
      J.y = crX - J.airH;
    }
    J.tilt += ((J.air ? Math.max(-P.AIR_TILT_MAX, Math.min(P.AIR_TILT_MAX, -Math.atan2(J.airV, P.AIR_VX * H / 1080))) : -J.v * P.TILT_PER_V) - J.tilt) * Math.min(1, dt * 6);
    J.cx = J.x; J.cy = J.y - 0.42 * js;   // body centre (hit + muzzle)
    if (!J.air && J.state !== 'enter') for (let k = 0; k < 2; k++) wake.push({ x: J.x + 0.42 * js * 1.35, y: J.y - 0.05 * js, vx: -W * 0.5 * (0.8 + Math.random() * 0.4), vy: 0, dir: Math.random() * 2 - 1,
      r: (5 + Math.random() * 6) * H / 1080, age: 0, life: 0.45, g: 0 });
    // --- shooting: same rules as the flying boss ---
    if (J.state === 'ride' && J.fired < J.shots.length) {
      if (J.t >= nextShot - GAME.WINDUP) J.windup = Math.min(1, (J.t - (nextShot - GAME.WINDUP)) / GAME.WINDUP); else J.windup = 0;
      if (J.t >= nextShot && (!goLaunch || J.air)) {
        const sx = J.cx - 0.45 * js, sy = J.cy - 0.12 * js, T = rand(GAME.PROJ_TIME);
        if (J.air || playerHigh) game.proj.push({ x: sx, y: sy, vx: (body.x - sx) / T, vy: 0, tx: body.x, t0: game.clock, T, done: false, flat: true });
        else game.proj.push({ x: sx, y: sy, vx: (body.x - sx) / T, vy: (body.y - sy) / T, tx: body.x, t0: game.clock, T, done: false });
        J.fired++; J.windup = 0;
      }
    }
    J.flash = Math.max(0, J.flash - dt);
  }

  function drawJet(H) {
    const J = game.jet; if (J.state === 'away') return;
    const im = sprImg(SPR.jet), hgt = GAME.JET_SIZE * H / 1080 * 205, wdt = hgt * im.width / im.height;
    ctx.save(); ctx.translate(J.x, J.state === 'defeat' ? J.cy + 0.42 * hgt : J.y); ctx.rotate(J.tilt + J.spin);
    ctx.drawImage(im, -wdt / 2, -hgt * 0.86, wdt, hgt);   // waterline ~86% down the jetski image
    if (J.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = J.flash / 0.12; ctx.drawImage(im, -wdt / 2, -hgt * 0.86, wdt, hgt); }
    ctx.restore();
    if (J.windup > 0) {   // telegraph at the blaster
      const hx = J.cx - 0.45 * hgt, hy = J.cy - 0.12 * hgt, r = GAME.PROJ_R * H * (0.5 + J.windup);
      ctx.fillStyle = `rgba(0,255,30,${0.25 + 0.5 * J.windup})`; ctx.beginPath(); ctx.arc(hx, hy, r * 1.8, 0, 7); ctx.fill();
      ctx.font = `900 ${Math.round(hgt * 0.3)}px system-ui`; ctx.fillStyle = '#ffd400'; ctx.strokeStyle = INK; ctx.lineWidth = 6;
      ctx.strokeText('!', J.cx + hgt * 0.1, J.cy - hgt * 0.55); ctx.fillText('!', J.cx + hgt * 0.1, J.cy - hgt * 0.55);
    }
    if (J.state !== 'defeat') { const bw = hgt * 0.8, bh = Math.max(8, hgt * 0.06), bxx = J.cx - bw / 2, byy = J.cy - hgt * 0.62;
      ctx.fillStyle = INK; ctx.fillRect(bxx - 3, byy - 3, bw + 6, bh + 6); ctx.fillStyle = '#3a2a4a'; ctx.fillRect(bxx, byy, bw, bh);
      ctx.fillStyle = '#d60f0f'; ctx.fillRect(bxx, byy, bw * Math.max(0, J.hp) / GAME.BOSS_HP, bh); }
  }
  function drawObstacles() {
    for (const o of game.obst) {
      const sp = SPR[o.type], im = sprImg(sp), hgt = o.size, wdt = hgt * im.width / im.height;
      // waterline inside the image: obstacle_a has its foam ring baked in (~88% down), obstacle_b is cut flat at the bottom
      const wl = sp.img ? (o.type === 'a' ? 0.88 : 1.0) : 0.92;
      if (sp.img && o.type === 'a') { ctx.drawImage(im, o.x - wdt / 2, o.y - hgt * wl, wdt, hgt); continue; }
      ctx.save(); ctx.beginPath(); ctx.rect(o.x - wdt, 0, wdt * 2, o.y + 3); ctx.clip();    // cut at the waterline: poking out of the water
      ctx.drawImage(im, o.x - wdt / 2, o.y - hgt * wl, wdt, hgt); ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(o.x, o.y + 2, wdt * 0.62, hgt * 0.07, 0, 0, Math.PI * 2); ctx.fill();   // foam ring
      ctx.fillStyle = '#d9f5fc'; ctx.beginPath(); ctx.ellipse(o.x + wdt * 0.25, o.y + 4, wdt * 0.28, hgt * 0.045, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 4; k++) { const a = game.clock * 3 + o.ph + k * 1.6; ctx.beginPath(); ctx.arc(o.x + Math.cos(a) * wdt * 0.55, o.y - Math.abs(Math.sin(a)) * hgt * 0.12, hgt * 0.025, 0, 7); ctx.fill(); }   // splash flecks
    }
  }
  function drawBoss(H) {
    const B = game.boss; if (B.state === 'away') return;
    const im = sprImg(SPR.boss), hgt = GAME.BOSS_SIZE * H / 1080 * 205, wdt = hgt * im.width / im.height;
    const shake = B.windup > 0 ? Math.sin(game.clock * 60) * 4 * B.windup : 0;
    const x = B.x + shake, y = B.y + (B.yb || 0);
    if (B.windup > 0) {   // telegraph: glowing charge at his hand + "!"
      const hx = x - 0.30 * hgt, hy = y + 0.10 * hgt, r = GAME.PROJ_R * H * (0.5 + B.windup);
      ctx.fillStyle = `rgba(0,255,30,${0.25 + 0.5 * B.windup})`; ctx.beginPath(); ctx.arc(hx, hy, r * 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#00ff1e'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = `900 ${Math.round(hgt * 0.32)}px system-ui`; ctx.fillStyle = '#ffd400'; ctx.strokeStyle = INK; ctx.lineWidth = 6;
      ctx.strokeText('!', x + hgt * 0.30, y - hgt * 0.42); ctx.fillText('!', x + hgt * 0.30, y - hgt * 0.42);
    }
    ctx.save(); ctx.translate(x, y); if (B.spin) ctx.rotate(B.spin);
    ctx.drawImage(im, -wdt / 2, -hgt / 2, wdt, hgt);
    if (B.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = B.flash / 0.12; ctx.drawImage(im, -wdt / 2, -hgt / 2, wdt, hgt); }
    ctx.restore();
    if (B.state !== 'defeat') {   // hp bar
      const bw = hgt * 0.9, bh = Math.max(8, hgt * 0.06), bxx = x - bw / 2, byy = y - hgt * 0.62;
      ctx.fillStyle = INK; ctx.fillRect(bxx - 3, byy - 3, bw + 6, bh + 6);
      ctx.fillStyle = '#3a2a4a'; ctx.fillRect(bxx, byy, bw, bh);
      ctx.fillStyle = '#d60f0f'; ctx.fillRect(bxx, byy, bw * Math.max(0, B.hp) / GAME.BOSS_HP, bh);
    }
  }
  function drawPicks(H) {
    const r = GAME.PICK_SIZE * H / 1080 * 205 / 2;
    for (const q of game.picks) {
      ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.18, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();   // yellow token disc
      drawAmmo(q.type, q.x, q.y, q.type === 'special' ? r * 1.15 : r, q.type === 'special' ? Math.sin(game.clock * 3 + q.ph) * 0.5 : game.clock * 2.2 + q.ph);
    }
  }
  function drawShotsAndPops(H) {
    const r = GAME.PICK_SIZE * H / 1080 * 205 / 2;
    for (const sh of game.shots) drawAmmo(sh.type, sh.x, sh.y, r * GAME.SHOT_SIZE, sh.rot);
    for (const p of game.pops) {   // collect pop: ring
      const k = p.t / 0.45; ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + 1.4 * k), 0, 7); ctx.stroke(); ctx.restore();
    }
  }
  // Ammo clip, top centre: front (next to fire) on the left. The prototype sat it
  // at y 92 px (1080p) to clear its level buttons; those are gone, so it moves up
  // into the top strip, level with the X and the gear.
  function drawClip(W, H) {
    const r = Math.max(14, 20 * H / 1080), gap = r * 2.5, x0 = W / 2 - (GAME.CLIP_MAX - 1) * gap / 2, y0 = 12 + r * 1.4;
    ctx.save();
    ctx.fillStyle = 'rgba(18,10,30,0.72)'; ctx.beginPath(); ctx.roundRect(x0 - r * 1.4, y0 - r * 1.4, GAME.CLIP_MAX * gap + r * 0.3, r * 2.8, 10); ctx.fill();
    for (let i = 0; i < GAME.CLIP_MAX; i++) {
      const x = x0 + i * gap;
      if (i < game.clip.length) drawAmmo(game.clip[i], x, y0, game.clip[i] === 'special' ? r * 1.1 : r, game.clip[i] === 'special' ? 0.3 : 0.2);
      else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y0, r * 0.55, 0, 7); ctx.stroke(); }
    }
    if (air && game.clip.length && (game.boss.state === 'enter' || game.boss.state === 'hover')) {   // FIRE! cue
      ctx.font = `900 ${Math.round(r * 1.1)}px system-ui`; ctx.fillStyle = '#ffd400'; ctx.fillText('FIRE!', x0 + GAME.CLIP_MAX * gap + r * 0.4, y0 + r * 0.4);
    }
    ctx.restore();
  }
  function drawProjectiles(H) {
    const r = GAME.PROJ_R * H;
    for (const p of game.proj) {
      if (SPR.proj.img) {   // projectile art: ball at ~(0.33, 0.5) of the image, radius ~0.25 of its width, tail pointing right
        const im = SPR.proj.img, k = r / (0.25 * im.width);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx) - Math.PI); ctx.scale(k, k);
        ctx.drawImage(im, -0.33 * im.width, -0.5 * im.height); ctx.restore(); continue;
      }
      const sp = Math.hypot(p.vx, p.vy) || 1;
      ctx.strokeStyle = 'rgba(0,255,30,0.45)'; ctx.lineWidth = r; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / sp * r * 4, p.y - p.vy / sp * r * 4); ctx.stroke();
      ctx.drawImage(SPR.proj.ph, p.x - r, p.y - r, r * 2, r * 2);
    }
  }

  function stepPhysics(dt, W, H) {
    if (mode === 'Direct') {
      const k = directKeys(); directT += dt;
      if (k.up || k.dn || performance.now() - k.lastKey < 2000) h = Math.min(1, Math.max(0, h + ((k.up ? 1 : 0) - (k.dn ? 1 : 0)) * dt * DIRECT_RATE));
      else h = 0.5 + 0.5 * Math.sin(directT * 0.9);
      sPos = h; air = false; return;
    }
    const P = PHYS;
    if (!air) {
      holdT = holding() ? holdT + dt : 0;
      const ramp = 1 + (P.RAMP || 0) * Math.min(1, holdT / (P.RAMP_T || 1));
      const a = -P.GRAVITY + (holding() ? P.THRUST * ramp : 0) - P.DAMP * sVel;
      sVel += a * dt; sPos += sVel * dt;
      if (sPos <= 0) { sPos = 0; sVel = sVel < -0.3 ? -sVel * P.BOUNCE : 0; }
      if (sPos >= 1) {
        sPos = 1;
        if (sVel > P.LAUNCH_MIN_V) {      // off the lip!
          air = true; airT = 0; airH = 0;
          const r = railNow;
          // LOCKED jump: the board always peaks exactly at AIR_PEAK_Y (screen fraction) and stays up AIR_TIME, whatever the launch speed
          const rise = Math.max(12, (r ? r.yCrest : H * 0.3) - P.AIR_PEAK_Y * H);
          const T = P.AIR_TIME;
          airG = 8 * rise / (T * T); airV = Math.sqrt(2 * airG * rise);
          airTilt0 = Math.max(-PHYS.AIR_TILT_MAX, Math.min(PHYS.AIR_TILT_MAX, tilt)); airTp = airV / airG;   // take-off angle + time to the top
          if (r) burst(r.x1, r.yCrest, 26, 900, W, H);
          for (const p of wake) if (!p.burst) p.life = Math.min(p.life, p.age + 0.12);   // old trail fades fast after take-off
        }
        sVel = 0;
      }
    } else {
      airT += dt; airV -= airG * dt; airH += airV * dt;
      if (airH <= 0) {                     // landing back on the face just below the lip
        air = false; airH = 0; sPos = 0.97; const rl = railNow; sVel = (airV / Math.max(40, rl ? rl.yTrough - rl.yCrest : H * 0.6)) * P.LAND_KEEP;
        if (rl) burst(rl.x1, rl.yCrest, 30, 650, W, H);
      }
    }
    h = Math.min(1, Math.max(0, sPos));
  }

  function clipBehindCurtain(curtain, W, H) {
    if (!curtain || curtain.length < 2) return;
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(curtain[0][0], 0);
    for (const [x, y] of curtain) ctx.lineTo(x, y);
    ctx.lineTo(curtain[curtain.length - 1][0], H); ctx.lineTo(W, H); ctx.closePath(); ctx.clip();
  }
  function drawShadow(x, y, rx, ry, alpha) {
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(8,20,45,${alpha})`); g.addColorStop(0.6, `rgba(8,20,45,${alpha * 0.6})`); g.addColorStop(1, 'rgba(8,20,45,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function speedLines(dt, W, H) {
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(235,255,250,0.55)'; ctx.lineWidth = Math.max(1.5, H / 540);
    for (const L of lines) {
      L.x -= L.v * (0.7 + (L.y - 0.58) * 1.2) * dt;
      if (L.x + L.len < 0) { L.x = 1 + Math.random() * 0.3; L.y = 0.58 + Math.random() * 0.4; L.len = 0.05 + Math.random() * 0.09; }
      ctx.beginPath(); ctx.moveTo(L.x * W, L.y * H); ctx.lineTo((L.x + L.len) * W, L.y * H); ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * One frame: physics -> wave (renders the 3D layer) -> gameplay -> 2D draw.
   * @param {number} dt     seconds, already clamped
   * @param {number} waveT  the wave's clock
   * @param {boolean} live  spawning and scoring on (false during the countdown)
   */
  function frame(dt, W, H, waveT, live) {
    lastW = W;
    stepPhysics(dt, W, H);
    const { riderScreen: rs, rail, curtain, crestLine } = wave.update(waveT, h);
    ctx.clearRect(0, 0, W, H);
    // occlusion: wake, speed lines and shadow live BEHIND the falling curtain -> clip to the region right of it
    ctx.save(); clipBehindCurtain(curtain, W, H);
    railNow = rail;
    speedLines(dt, W, H);
    if (!rs || !rail || !img.complete || !img.naturalWidth) { ctx.restore(); return; }
    const railPx = Math.max(40, rail.yTrough - rail.yCrest);
    const s = (H / 1080) * 205 / img.height;   // ~205 px tall at 1080p
    // board contact point: on the face, or above the lip in the air
    let bx = rs.x, by = rs.y;
    if (air) { bx = rail.x1; by = rail.yCrest - airH;
      const minY = ANCHOR.y * img.height * s + PHYS.AIR_TOP_MARGIN * H / 1080;   // keep the sprite on screen
      if (by < minY + 40) by = minY + 40 * Math.exp((by - minY - 40) / 40); }
    // tilt: follows vertical speed, nose-down clamped; gentle rotation in the air
    let target;
    if (mode === 'Physics' && !air) target = -sVel * PHYS.TILT_PER_V;
    else if (!air) { if (lastY !== null && dt > 0) vyScreen = vyScreen * 0.85 + ((rs.y - lastY) / dt) * 0.15; target = (vyScreen / railPx) * PHYS.TILT_PER_V; }
    else target = -Math.atan2(airV, PHYS.AIR_VX * H / 1080);
    lastY = rs.y;
    target = air ? Math.max(-PHYS.AIR_TILT_MAX, Math.min(PHYS.AIR_TILT_MAX, target)) : Math.max(-PHYS.TILT_NOSE_UP, Math.min(PHYS.TILT_NOSE_DOWN, target));
    if (air && mode === 'Physics') {
      // scripted air rotation: start at the take-off angle, ease (slowing) to level at the top of the jump,
      // then accelerate through the mirrored angle (nose down) into the landing
      const u = airT / Math.max(0.05, airTp);
      tilt = u < 1 ? airTilt0 * (1 - u) * (1 - u) : PHYS.AIR_LAND_TILT * Math.min(1, (u - 1) * (u - 1));
    } else tilt += (target - tilt) * Math.min(1, dt * 8);
    // rider body hit circle + game update (obstacles, boss, projectiles)
    const body = { x: bx - 0.05 * img.width * s, y: by - 0.45 * img.height * s, r: 0.27 * img.height * s };
    updateGame(dt, W, H, rail, crestLine, body, live);
    if (live) {   // distance surfed + airtime
      game.dist += RUN.DIST_PER_SEC * dt; game.score += RUN.DIST_PER_SEC * dt;
      if (air) { game.airTime += dt; game.score += RUN.AIR_PER_SEC * dt; }
    }

    // ---- shadow on the face under the board ----
    const shX = air ? rail.x1 : bx, shY = air ? rail.yCrest : by;
    const k = air ? 1 / (1 + 3 * airH / railPx) : 1;
    drawShadow(shX - 4 * H / 1080, shY + 16 * H / 1080, 0.44 * img.width * s * k, 0.065 * img.height * s * (0.6 + 0.4 * k), 0.30 * k);

    // ---- wake: emitted from the board tail every frame, along the path since last frame ----
    const ca = Math.cos(tilt), sa = Math.sin(tilt);
    const ox = (TAIL.x - ANCHOR.x) * img.width * s, oy = (TAIL.y - ANCHOR.y) * img.height * s;
    const tail = { x: bx + ox * ca - oy * sa, y: by + ox * sa + oy * ca };
    if (!air) {
      const n = WAKE.RATE * dt;
      const from = trailPrev || tail;
      for (let i = 0; i < n; i++) {
        const f = (i + Math.random()) / n;
        wake.push({ x: from.x + (tail.x - from.x) * f, y: from.y + (tail.y - from.y) * f,
          vx: -W * WAKE.FLOW * (0.85 + Math.random() * 0.3), vy: 0, dir: Math.random() * 2 - 1,
          r: (5 + Math.random() * 7) * H / 1080, age: -dt * (1 - f), life: WAKE.LIFE * (0.7 + Math.random() * 0.6), g: 0 });
      }
      trailPrev = tail;
    } else trailPrev = null;
    for (let i = wake.length - 1; i >= 0; i--) {
      const p = wake[i]; p.age += dt; if (p.age > p.life) { wake.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += (p.vy + p.dir * WAKE.SPREAD * (H / 1080) * (p.age / p.life)) * dt; p.vy += p.g * dt;
    }
    ctx.save();
    for (const p of wake) {
      const a = 1 - p.age / p.life;
      const r = p.burst ? p.r * (0.4 + 0.6 * a) : p.r * (1 + WAKE.GROW * (p.age / p.life));   // spray droplets shrink, wake foam spreads
      if (p.burst) { ctx.globalAlpha = a > 0.25 ? 1 : a * 4; ctx.fillStyle = a > 0.5 ? '#ffffff' : '#c9f4ff'; }
      else { ctx.globalAlpha = Math.min(1, 1.6 * a * a); ctx.fillStyle = a > 0.5 ? '#ffffff' : '#e4f7fc'; }
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.5, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    drawObstacles();   // inside the clip: they pass BEHIND the curtain
    drawPicks(H);

    ctx.restore();   // end curtain clip
    // ---- rider sprite (always in front) ----
    ctx.save(); ctx.translate(bx, by); ctx.rotate(tilt + game.knockTilt * Math.sin(game.clock * 40)); ctx.scale(s, s);   // stagger wobble on hit
    if (game.invuln > 0 && Math.floor(game.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.45;                      // invulnerability flicker
    ctx.drawImage(img, -ANCHOR.x * img.width, -ANCHOR.y * img.height);
    if (game.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, game.flash / 0.14); ctx.drawImage(img, -ANCHOR.x * img.width, -ANCHOR.y * img.height); }   // white flash
    ctx.restore();
    drawBoss(H); drawJet(H); drawProjectiles(H); drawShotsAndPops(H); drawClip(W, H);
  }

  return {
    frame,
    reset,
    get game() { return game; },
    get debugText() { return debugText; },
    get mode() { return mode; },
    setMode(m) { mode = m; sVel = 0; air = false; },
    // dev tools only
    dev: { summonBoss, summonJet, spawnObstacle, spawnPicks, setNoSpawn: v => { noSpawn = !!v; },
      rider: () => ({ mode, h, sPos, sVel, air, airH, airV, tilt }) },
  };
}
