// Hold one lean for a long run so the wagon rides the sidewalk against the buildings (through
// junctions too): screenshot every few seconds and log lateral position and speed.
//   node tools/hug-wall.mjs [port] [outDir] [ArrowRight|ArrowLeft] [secs] [everyMs]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', key = 'ArrowRight', secs = '25', every = '2500'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => { window.__game.G.god = true; document.querySelector('.lil-gui')?.remove(); });
await p.keyboard.down(key);
const n = Math.floor(+secs * 1000 / +every);
for (let i = 0; i < n; i++) {
  await new Promise((r) => setTimeout(r, +every));
  await p.screenshot({ path: `${out}/hug_${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 });
  console.log(await p.evaluate(() => { const g = window.__game, P = g.player; return `scrapes ${g.G.scrapes || 0}  u ${P.u.toFixed(2)}  vs ${P.vs.toFixed(1)}  onWalk ${!!P.onWalk}  state ${g.G.state}`; }));
}
await p.keyboard.up(key);
console.log('errors', errs.slice(0, 3));
await b.close();
