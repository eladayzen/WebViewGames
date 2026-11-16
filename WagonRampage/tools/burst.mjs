// A burst of screenshots after some page-side setup — for catching short moments.
//   node tools/burst.mjs <port> <outDir> <startSecs> <count> <gapMs> [js-to-eval-before]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [port = '8155', out = 'burst', start = '5', count = '8', gap = '120', pre = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state !== 'loading', { timeout: 60000 });
if (pre) await p.evaluate(pre);
await new Promise((r) => setTimeout(r, +start * 1000));
for (let i = 0; i < +count; i++) {
  await p.screenshot({ path: `${out}/b${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 });
  await new Promise((r) => setTimeout(r, +gap));
}
console.log('errors', errs.slice(0, 5));
await b.close();
