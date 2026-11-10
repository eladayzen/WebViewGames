// Does the gun actually hit anything?
//
// Combat is the one system in this game with NO VISIBLE STATE BETWEEN EVENTS.
// A screenshot of a frame either has a bolt in it or it does not, and "was that
// drone ever acquired" looks identical in both cases — so the look harness
// (`lookqa.mjs`) cannot see this feature at all, and a gun that silently never
// fires would pass every gate this project owns. Hence an instrument of its
// own, and hence it asserts on NUMBERS read out of the running game rather than
// on pixels.
//
// Three things are measured, because three different things can be broken:
//
//   1. THE GUN FIRES AND CONNECTS. Shots, kills, sweeps and the hit rate over a
//      measured descent. The bolt is guided, so a shot taken at something the
//      board was genuinely pointed at should almost always land; a hit rate
//      down near a half means the guidance cannot turn fast enough, which is a
//      BOLT_TURN problem and not a targeting one.
//   2. THE CORRIDOR ACTUALLY CONSTRAINS. The whole design rests on the gun
//      shooting only what the board points at — so the same live drones are
//      re-tested against a heading rotated forty degrees, and the SAME drones
//      must be acquirable. The gun takes the nearest enemy and does not read
//      the heading, so a corridor creeping back in passes check 1
//      perfectly and makes the steering meaningless.
//   3. THE POOL HOLDS. Twenty-four bolts, recycled; if the live count ever
//      reaches the cap, shots are being silently dropped.
//
// EXIT CODE IS THE RESULT, and the `checked` count at the bottom is what tells
// a green exit apart from a harness that threw before it tested anything.
//
// RIDE TO A DISTANCE, NEVER FOR A DURATION — this runs on a software rasteriser
// whose frame time moves with whatever else is on the machine.
//
// The browser is MUTED. It loads the soundtrack and plays it out of whoever's
// speakers are nearby.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, 'dist');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const SHOTS = path.join(process.env.SHOTS ?? path.join(here, 'shots'), 'combat');
fs.mkdirSync(SHOTS, { recursive: true });

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary',
  '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
};
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  try {
    const body = await readFile(path.join(DIST, rel));
    res.writeHead(200, { 'content-type': TYPES[path.extname(rel)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// EVERY RIDE LOOP IS WALL-CLOCK GUARDED, and the guard is not paranoia. The
// steered phase below pushes a lean at the real sensor shim, and a lean that
// parks the rider in the trees drops the speed to nothing: `rider.p` stops
// advancing, the loop's only exit condition never arrives and the harness hangs
// for ever rather than failing. The first version did exactly that. A harness
// that cannot finish is worse than one that fails, because a failure is a
// result and a hang is a person waiting.
const RIDE_TIMEOUT_MS = 180000;

const fails = [];
let checked = 0;
const check = (name, ok, detail = '') => {
  checked++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) fails.push(name);
  return ok;
};

// Far enough to meet a dozen squads. A squad arrives every ~113 m on average
// (BAND 70, SQUAD_CHANCE 0.62), so 1000 m is ~9 formations — enough that one
// unlucky band cannot decide the result.
const RIDE = 1000;
const T = 6.0;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--mute-audio', '--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);

  await page.setViewport({ width: 1320, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${base}/index.html?all=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.state === 'title',
    { timeout: 60000, polling: 100 });
  // Chill vibe and the basin: chill returns `place.offset[0]` — 0 m — so the
  // same stretch of mountain carries the same squads every run. The race draws
  // a random offset, and would also have the drones switched off.
  await page.click('[data-act="start"][data-mode="chill"]');
  await page.waitForSelector('[data-act="place"][data-place="bowl"]', { timeout: 20000 });
  await page.click('[data-act="place"][data-place="bowl"]');
  await page.waitForSelector('[data-act="stance-ok"]', { visible: true, timeout: 20000 });
  await page.click('[data-act="stance-ok"]');
  await page.waitForFunction(() => window.CARVE?._game?.state === 'play',
    { timeout: 60000, polling: 100 });

  // Planted on the centreline, pointed straight down, with the wipeout budget
  // spent so a tree cannot end the measurement halfway through it.
  await ev((t) => {
    CARVE.debugSeek(t);
    const g = CARVE._game;
    // `rider.u` is a GETTER WITH NO SETTER — assigning to it from here is a
    // silent no-op in the page's sloppy-mode context. The centreline has to be
    // set through `x`, which is the thing `u` is derived from.
    g.rider.x = g.terrain.centerX(g.rider.z);
    g.rider.yaw = 0;
    g.rider.vh = 26;
    g.wipeouts = 3;
    g.rider.invuln = 0;
  }, T);
  await ev(() => CARVE.pinMood(0.46));
  await sleep(700);

  const start = await ev(() => CARVE._game.rider.p);

  // ── 1. ride, and watch ────────────────────────────────────────────────────
  let maxBolts = 0;
  let sawBolt = false;
  let shotFrame = false;
  let lockSeen = false;
  let stalled = false;
  const corridorSeen = new Set();
  const rideUntil = Date.now() + RIDE_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > rideUntil) { stalled = true; break; }
    // READ THE SYSTEM DIRECTLY, NOT THROUGH `CARVE.probe()`. The probe walks
    // every visible chunk's baked-shadow attribute to produce its `shade`
    // statistics — tens of thousands of floats, per call. Sampled at 16 Hz
    // that alone dominated the frame budget and the ride took longer than the
    // harness timeout: the instrument was measuring itself. Checkpoints still
    // use the probe; the inner loop reads only what it needs.
    const s = await ev(() => {
      const g = CARVE._game;
      // Held open, for the reason spelled out in the steered phase below.
      if (g.timer && g.timer.remaining < 30) g.timer.add(60);
      return {
        p: g.rider.p, state: g.state,
        bolts: g.combat.bolts.reduce((n, b) => n + (b.live ? 1 : 0), 0),
        target: g.combat.target ? +(g.combat.target.p - g.rider.p).toFixed(0) : null,
        locked: g.combat.lock.visible,
      };
    });
    maxBolts = Math.max(maxBolts, s.bolts);
    if (s.bolts > 0) sawBolt = true;
    if (s.target !== null) corridorSeen.add(String(s.target));
    if (s.locked) lockSeen = true;
    // The one frame worth keeping: a bolt in the air, with the lock on a drone
    // that is still up. That single image is the whole feature.
    if (!shotFrame && s.bolts > 0 && s.locked) {
      shotFrame = true;
      await page.screenshot({ path: path.join(SHOTS, 'bolt-in-flight.png') });
    }
    if (s.state !== 'play') { stalled = true; break; }
    if (s.p - start >= RIDE) break;
    await sleep(60);
  }
  const ride = await ev(() => CARVE.probe().combat);

  console.log(`\n  ${RIDE} m ridden from p=${Math.round(start)}`);
  console.log(`  shots ${ride.shots}  kills ${ride.kills}  sweeps ${ride.sweeps}  ` +
    `escaped ${ride.escaped}  points ${ride.points}`);
  console.log(`  hit rate ${(ride.kills / Math.max(1, ride.shots) * 100).toFixed(0)}%  ` +
    `max bolts in air ${maxBolts}/24\n`);

  check('the straight ride finished inside its budget', !stalled);
  check('the gun fires', ride.shots > 0, `${ride.shots} shots`);
  check('bolts reach drones', ride.kills > 0, `${ride.kills} kills`);
  check('no free kills', ride.kills <= ride.shots, `${ride.kills} <= ${ride.shots}`);
  // A guided bolt fired at an acquired target should land. Half is the floor
  // that catches guidance too slow to turn; it is not the number to tune to.
  check('a guided bolt connects', ride.kills / Math.max(1, ride.shots) >= 0.5,
    `${(ride.kills / Math.max(1, ride.shots) * 100).toFixed(0)}%`);
  check('the bolt pool is never saturated', maxBolts < 24, `peak ${maxBolts}`);
  check('bolts were visibly in flight', sawBolt);
  // Drones must also be able to GET AWAY, or the corridor is not constraining
  // anything and check 2 below is the only thing standing between this design
  // and a gun that clears the hill on its own.
  check('some drones escape', ride.escaped > 0, `${ride.escaped} escaped`);

  // ── 1b. CAN A SQUAD BE SWEPT AT ALL? ──────────────────────────────────────
  //
  // Not a check the straight ride above can make, and the first version of this
  // harness asked it anyway and failed: a rider going straight down the fall
  // line meets a chevron side-on and can only ever hold one or two of it in the
  // corridor, so "0 swept" was the CORRECT answer to a question about geometry
  // and told us nothing about the gun. (It did find a real bug on the way --
  // the chevron was wider than the corridor and no line through it held more
  // than two -- but that is a thing to measure deliberately, not to trip over.)
  //
  // So this phase STEERS, by pushing a lean at the real sensor shim, through
  // the same dead zone, radial gamma and 0.33 s EMA a human's board goes
  // through. It is not an autopilot standing in for a player: it is the one
  // specific condition the sweep bonus is written for -- a rider who commits a
  // line to the formation ahead -- and nothing else here is measured this way.
  //
  // THE LEAN SIGN IS DISCOVERED, NOT ASSUMED. It runs through `rotateLean` and
  // the player's stance, so which way +x turns is a property of the session
  // rather than of this file. One second of lean and a look at where `u` went.
  // A SHORT, SOFT PROBE. The first version held 0.8 for sixty frames, which on
  // a software rasteriser is seven seconds of full edge -- enough to put the
  // rider off the piste and into the margin the scatter notes call the band
  // that turns one mistake into four wipeouts. 0.45 for twenty frames moves `u`
  // several metres, which is all the sign needs, and ends with the rider still
  // on the piste.
  const sign = await ev(async () => {
    const g = CARVE._game;
    const u0 = g.rider.u;
    for (let i = 0; i < 20; i++) {
      CARVE.lean(0.45, 0);
      await new Promise((r) => requestAnimationFrame(r));
    }
    const du = g.rider.u - u0;
    CARVE.lean(0, 0);
    return du >= 0 ? 1 : -1;
  });

  const sweepStart = await ev(() => CARVE._game.rider.p);
  const sweepBase = { sweeps: ride.sweeps, kills: ride.kills, shots: ride.shots };
  const STEERED = 900;
  const steerUntil = Date.now() + RIDE_TIMEOUT_MS;
  let steerStalled = false;
  for (;;) {
    if (Date.now() > steerUntil) { steerStalled = true; break; }
    const s = await ev((sgn) => {
      const g = CARVE._game;
      const t = g.combat.target;
      // Steer at whatever the gun has found, and ride straight when it has
      // found nothing -- which is exactly the instruction a player gets from
      // the lock ring and no more.
      const want = t ? t.u : 0;
      // CAPPED WELL SHORT OF A FULL EDGE. The gun wants a line, not a carve:
      // a steering term that can reach 1.0 scrubs so much speed chasing a
      // drone eight metres off the line that the formation is gone before the
      // rider arrives, which measures the wrong thing twice over.
      const err = (want - g.rider.u) * 0.14;
      CARVE.lean(sgn * Math.max(-0.5, Math.min(0.5, err)), 0);
      // THE CLOCK IS HELD OPEN FOR THE LENGTH OF THE MEASUREMENT. Chill vibe
      // ends when it runs out, and a run that ends stops advancing `p` -- so
      // without this the harness is measuring how long the clock lasts rather
      // than what the gun does, and which of the two it measured would depend
      // on the machine's frame rate. The clock is not under test here and is
      // not read by anything this phase asserts on.
      if (g.timer && g.timer.remaining < 30) g.timer.add(60);
      return {
        p: g.rider.p, state: g.state,
        sweeps: g.combat.stats.sweeps, kills: g.combat.stats.kills,
      };
    }, sign);
    // A run that ended -- the clock ran out, say -- stops advancing `p`, and
    // waiting for a distance it can no longer reach is the hang this guard and
    // the one above exist for.
    if (s.state !== 'play') { steerStalled = true; break; }
    if (s.p - sweepStart >= STEERED) break;
    await sleep(60);
  }
  await ev(() => CARVE.lean(0, 0));
  const steered = await ev(() => CARVE.probe().combat);
  const sweeps = steered.sweeps - sweepBase.sweeps;
  const killed = steered.kills - sweepBase.kills;
  const fired = steered.shots - sweepBase.shots;
  const steeredM = Math.max(1, (await ev(() => CARVE._game.rider.p)) - sweepStart);
  console.log(`  steered ${Math.round(steeredM)} m: shots ${fired}  kills ${killed}  ` +
    `sweeps ${sweeps}  hit rate ${(killed / Math.max(1, fired) * 100).toFixed(0)}%\n`);
  check('the steered ride finished inside its budget', !steerStalled);
  // ── A CHECK THAT OUTLIVED ITS MECHANIC ────────────────────────────────
  //
  // This used to read "steering at the lock kills more than riding straight",
  // and it was the headline claim of the whole file: the gun aimed through a
  // corridor along the heading, so the ratio between a steered kilometre and a
  // straight one WAS the feature. Measured at the time: 6 kills riding
  // straight, 14 steering.
  //
  // The gun takes the nearest enemy now and does not read the heading at all,
  // so that ratio is not a claim this game makes any more. The same measurement
  // today is 15 straight against 16 steered — it still passed, by a margin
  // thinner than the run-to-run noise, which is the most dangerous state a
  // check can be in: green, and measuring nothing.
  //
  // What replaced it is the thing the new rule DOES promise, and it is the
  // inverse: A RIDER WHO NEVER TURNS STILL FIGHTS. Aim is not an input, so the
  // straight kilometre has to convert on its own, and the two rates have to be
  // close rather than far apart. If steering ever doubles the rate again, a
  // corridor has come back from somewhere.
  const straightRate = ride.kills / RIDE * 1000;
  const steeredRate = killed / steeredM * 1000;
  check('a rider who never turns still fights', straightRate > 5,
    `${straightRate.toFixed(1)} kills/km riding straight`);
  check('and steering does not change that much',
    steeredRate < straightRate * 2.2,
    `${steeredRate.toFixed(1)} steered vs ${straightRate.toFixed(1)} straight, per km`);
  check('a whole squad can be swept', sweeps > 0, `${sweeps} swept`);

  // ── 2. the acquisition rule is NEAREST, and it is bounded ─────────────────
  //
  // THIS PHASE USED TO TEST A CORRIDOR. It rotated the heading forty degrees
  // and asserted that nothing was acquirable any more, which was the right
  // test of the right mechanic right up until the mechanic changed: the gun
  // now takes the nearest enemy and does not read the heading at all
  // (`combat.js`). Left as it was, the check would have gone red on a correct
  // build and told whoever saw it nothing about what had happened.
  //
  // So it asserts the rule that IS there, and it asserts the two halves of it
  // separately, because "nearest" and "in reach" fail in different ways:
  //
  //   HEADING-INDEPENDENT. The same drones, read back through a heading turned
  //   forty degrees, must be acquirable in exactly the same way. That is the
  //   positive form of the old check and it catches a corridor coming back by
  //   accident as surely as the old one caught a sphere.
  //
  //   BOUNDED. Nothing outside the weapon's reach is ever acquirable, which is
  //   the half that carries the design now — see the note in `weapons.js` on
  //   why the reach came down to 52 m when the corridor went away.
  const rot = await ev(() => {
    const g = CARVE._game;
    const f = g.roster.fighters[0];
    // STAND THE RIDER NEXT TO A DRONE FIRST.
    //
    // The first run of this phase passed every check on an empty set — "0 in
    // reach straight, 0 turned", "furthest acquirable 0.0 m" — because at that
    // instant nothing happened to be within 52 m. A check that passes when
    // there is nothing to check is worse than no check: it is a green light
    // with no circuit behind it.
    //
    // The drone is brought to the rider rather than the rider to the drone,
    // because moving the rider moves the band ring, the camera and the
    // collision state, and this phase wants none of that — only a geometry
    // read.
    const near = g.combat._near(f.p, 0, 2);
    for (const squad of near) {
      for (const d of squad.drones) {
        if (d.dead) continue;
        d.x = f.x + 2;
        d.z = f.z - 24;
        d.y = f.y + 3;
        d.drawnY = d.y;
        break;
      }
      break;
    }
    const h = g.rider.heading;
    const keep = { x: h.x, y: h.y, z: h.z };
    const straight = g.combat.aheadOf(f);
    const a = 40 * Math.PI / 180;
    h.set(keep.x * Math.cos(a) - keep.z * Math.sin(a), keep.y,
      keep.x * Math.sin(a) + keep.z * Math.cos(a)).normalize();
    const turned = g.combat.aheadOf(f);
    h.set(keep.x, keep.y, keep.z);
    const live = straight.filter((d) => !d.dead);
    return {
      drones: straight.length,
      straightIn: straight.filter((d) => d.inReach).length,
      turnedIn: turned.filter((d) => d.inReach).length,
      reach: f.gun.rangeMax,
      // The furthest thing the gun considers acquirable, and the nearest it
      // does not. Together these say the reach is a real boundary rather than
      // a number nothing reads.
      maxIn: Math.max(0, ...live.filter((d) => d.inReach).map((d) => d.dist)),
      minOut: Math.min(1e9, ...live.filter((d) => !d.inReach && d.dist > 10)
        .map((d) => d.dist)),
    };
  });
  // THE PRECONDITION IS ITS OWN CHECK, so an empty set can never again be
  // mistaken for a pass.
  check('there is something in reach to test against',
    rot.straightIn > 0, `${rot.straightIn} in reach`);
  check('acquisition does not read the heading',
    rot.straightIn > 0 && rot.turnedIn === rot.straightIn,
    `${rot.straightIn} in reach straight, ${rot.turnedIn} turned 40 deg`);
  check('and it is bounded by the weapon reach',
    rot.maxIn > 0 && rot.maxIn <= rot.reach + 0.01,
    `furthest acquirable ${rot.maxIn.toFixed(1)} m of ${rot.reach} m`);
  check('nothing past the reach is acquirable',
    rot.minOut > rot.reach - 0.01,
    rot.minOut > 1e8 ? 'nothing out of reach nearby' : `nearest rejected ${rot.minOut.toFixed(1)} m`);
  check('drones were acquired while riding',
    corridorSeen.size > 0, `${corridorSeen.size} distinct lock ranges`);
  // The lock is the only feedback the player gets that the gun has found
  // something. If it never shows, the mechanic is invisible even when it works.
  check('the lock is drawn on an acquired target', lockSeen);

  // ── 3. the off switch ─────────────────────────────────────────────────────
  // The race turns combat off. If `setEnabled(false)` only hid the pods, a race
  // would be silently shot at by an invisible gun.
  // READ FRESH, NOT FROM `ride`. The first version took this baseline before
  // the steered phase, which then fired fourteen more bolts -- so the check
  // reported a disabled gun shooting twenty times and failed on a stale number
  // rather than on anything the game did.
  const before = (await ev(() => CARVE.probe().combat)).shots;
  await ev(() => CARVE._game.combat.setEnabled(false));
  const offStart = await ev(() => CARVE._game.rider.p);
  await page.waitForFunction((p) => {
    const g = CARVE._game;
    if (g.timer && g.timer.remaining < 30) g.timer.add(60);
    return g.rider.p >= p;
  }, { timeout: 120000, polling: 60 }, offStart + 250);
  const off = await ev(() => CARVE.probe().combat);
  check('switched off, the gun does not fire', off.shots === before,
    `${off.shots} vs ${before}`);
  check('switched off, the drones are not drawn',
    await ev(() => !CARVE._game.combat.pods.visible && !CARVE._game.combat.eyes.visible));
  await ev(() => CARVE._game.combat.setEnabled(true));

  check('no console errors, no uncaught exceptions', errors.length === 0,
    errors.slice(0, 2).join(' | '));

  fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify({
    ridden: RIDE, start: Math.round(start), ride, maxBolts, corridor: rot, errors,
    steered: { metres: Math.round(steeredM), leanSign: sign, shots: fired, kills: killed, sweeps },
  }, null, 1));
} finally {
  await browser?.close();
  server.close();
}

console.log(`\n  ${checked} checks run, ${fails.length} failed  ->  ${SHOTS}`);
if (checked < 19) { console.log('  HARNESS DID NOT FINISH'); process.exit(2); }
process.exit(fails.length ? 1 : 0);
