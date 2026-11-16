// One screenshot after N seconds, with optional page-side setup code.
//   node tools/shot.mjs <port> <out.jpg> [secs=6] [js-to-eval-before]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = 'shot.jpg', secs = '6', pre = ''] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state !== 'loading', { timeout: 60000 });
if (pre) await p.evaluate(pre);
await new Promise((r) => setTimeout(r, +secs * 1000));
if (process.env.EVAL) console.log(await p.evaluate(process.env.EVAL));
await p.screenshot({ path: out, type: 'jpeg', quality: 85 });
console.log('errors', errs.slice(0, 6));
await b.close();
