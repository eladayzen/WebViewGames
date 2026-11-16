// How much of the run is frozen (hit-stop) and how hard the camera shakes, during a power.
//   node tools/juice.mjs [port] [buff] [secs]
import puppeteer from 'puppeteer-core';
const [port = '8155', buff = 'mike', secs = '25'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage();
await p.setViewport({ width: 960, height: 540 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
const r = await p.evaluate(async (buff, secs) => {
  const g = window.__game, G = g.G;
  let n = 0, frozen = 0, shakeSum = 0, shakeMax = 0, buffAt = 0;
  const t0 = performance.now();
  await new Promise((done) => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      if (t - buffAt > 8.5) { g.startBuff(buff); buffAt = t; }
      n++; if (G.hitStop > 0) frozen++;
      shakeSum += G.shake; shakeMax = Math.max(shakeMax, G.shake);
      if (t > secs) done(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return { frames: n, frozenPct: (100 * frozen / n).toFixed(1), shakeAvg: (shakeSum / n).toFixed(3), shakeMax: shakeMax.toFixed(2), wrecked: G.wrecked ?? G.kills };
}, buff, +secs);
console.log(r, 'errors', errs.slice(0, 3));
await b.close();
