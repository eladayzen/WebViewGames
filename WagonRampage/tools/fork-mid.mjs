// The fork choice is read at the END of the divider (FORK_MID m into the junction), not before.
// Level 1 under autopilot: hold one side, switch sides `switchAt` metres past the junction start,
// and log which way the wagon went, plus the biggest per-frame jump in its world position and yaw
// around the lock (a pop would show up there). Screenshots on the way through.
//   node tools/fork-mid.mjs [port] [outDir] [switchAt]   (switchAt < 0: never switch)
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', switchAt = '14'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1&level=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate((sw) => {
  const g = window.__game; g.G.god = true; window.__noOrbs = true; g.G.autoFork = 1;
  const J = g.path.junction; window.__J = J; window.__trace = [];
  const tick = () => {
    const pl = g.player, d = pl.s - J.s;
    if (sw >= 0 && d > sw && g.G.autoFork === 1) g.G.autoFork = -1;
    const q = pl.group.position;
    window.__trace.push({ d: +d.toFixed(2), u: +pl.u.toFixed(2), x: q.x, z: q.z, yaw: pl.group.rotation.y, dec: J.decided, cx: g.camera.position.x, cz: g.camera.position.z });
    if (d < 80) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, +switchAt);
const shots = [40, 6, -12, -21, -30];
for (const at of shots) {
  await p.waitForFunction((a) => window.__J.s - window.__game.player.s < a, { timeout: 120000, polling: 16 }, at)
    .catch(async (e) => { console.log('stuck', JSON.stringify(await p.evaluate(() => ({ st: window.__game.G.state, s: window.__game.player.s, J: window.__J.s, vs: window.__game.player.vs })))); throw e; });
  await p.screenshot({ path: `${out}/fork_${switchAt}_${at < 0 ? 'past' + -at : 'to' + at}.jpg`, type: 'jpeg', quality: 80 });
}
await p.waitForFunction(() => window.__game.player.s - window.__J.s > 70, { timeout: 60000 });
const r = await p.evaluate(() => {
  const t = window.__trace; let jump = 0, jumpAt = 0, yawJ = 0, yawAt = 0, camJ = 0, lockAt = null;
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1], c = t[i];
    if (c.d < -40 || c.d > 60) continue; // only around the fork
    const step = Math.hypot(c.x - a.x, c.z - a.z), ds = Math.max(0.01, c.d - a.d);
    const ex = Math.abs(step - ds); // movement beyond what forward speed explains
    if (ex > jump) { jump = ex; jumpAt = c.d; }
    const dy = Math.abs(c.yaw - a.yaw); if (dy > yawJ) { yawJ = dy; yawAt = c.d; }
    camJ = Math.max(camJ, Math.hypot(c.cx - a.cx, c.cz - a.cz) - ds);
    if (lockAt == null && c.dec) lockAt = { d: c.d, u: c.u, uBefore: a.u };
  }
  const li = t.findIndex((c) => c.dec);
  window.__around = t.slice(li - 3, li + 4).map((c) => [c.d, c.u, +c.x.toFixed(2), +c.z.toFixed(2), +c.yaw.toFixed(3)]);
  return { around: window.__around, went: window.__J.decided, lockAt, frames: t.length, maxExtraStep: +jump.toFixed(3), at: jumpAt, maxYawStep: +yawJ.toFixed(4), yawAt, camExtra: +camJ.toFixed(3) };
});
console.log('switchAt', switchAt, JSON.stringify(r), 'errors', errs.slice(0, 3));
await b.close();
