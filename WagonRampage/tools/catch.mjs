// Run the autopilot and screenshot the first moment each thing happens: a Foot shot in
// flight, a Leo/Mikey wave, Donnie's drones, a Raph strike.
//   node tools/catch.mjs <port> <outDir> [secs=70]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [port = '8155', out = 'catch', secs = '70'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
const got = {};
const t0 = Date.now();
while (Date.now() - t0 < +secs * 1000 && Object.keys(got).length < 5) {
  const k = await p.evaluate(() => {
    const g = window.__game;
    if (g.shots.length && g.shots[0].life > 0.25) return 'shot';
    const w = g.waves[0];
    if (g.G.buff && g.G.buff.kind === 'donnie' && g.zaps.length) return 'donnie';
    if (g.G.buff && g.G.buff.kind === 'mike' && g.bolts.some((d) => d.t > 0.15)) return 'mike';
    if (g.G.strike && g.G.strike.total > 0.35) return 'leo';
    if (g.G.buff && g.G.buff.kind === 'raph' && g.bolts.some((d) => d.t > 0.1)) return 'raph';
    return null;
  });
  if (k && !got[k]) { got[k] = true; await p.screenshot({ path: `${out}/${k}.jpg`, type: 'jpeg', quality: 85 }); console.log('caught', k, ((Date.now() - t0) / 1000).toFixed(1)); }
  await new Promise((r) => setTimeout(r, 60));
}
console.log('errors', errs.slice(0, 5));
await b.close();
