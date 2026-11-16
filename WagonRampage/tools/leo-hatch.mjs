// Hatch lid vs Leo's strike: sample lid openness (0 shut .. 1 open) and strike phase over time.
//   node tools/leo-hatch.mjs [port]
import puppeteer from 'puppeteer-core';
const [port = '8155'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 960, height: 540 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
const log = await p.evaluate(async () => {
  const g = window.__game; g.G.god = true; g.G.power = 'leo'; g.G.powerAt = -10;
  const out = [], t0 = performance.now();
  await new Promise((done) => {
    const f = () => {
      const t = (performance.now() - t0) / 1000;
      const st = g.G.strike;
      out.push(`${t.toFixed(2)}s  ${st ? (st.back ? 'returning' : 'hop ' + (st.i + 1)) : 'no strike'}  lid ${g.hatchS.open.toFixed(2)}`);
      if (t > 5) done(); else setTimeout(f, 150);
    };
    f();
  });
  return out;
});
console.log(log.join('\n'), '\nerrors', errs.slice(0, 3));
await b.close();
