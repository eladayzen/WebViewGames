// Body roll vs input: tap / short hold / long hold of the right arrow, peak roll in degrees for
// each, plus a mid-turn screenshot with Raph on the roof (to see the hatch roll with the body).
//   node tools/roll.mjs [port] [outDir]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => { window.__game.G.god = true; document.querySelector('.lil-gui')?.remove(); window.__game.startBuff('raph'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const watch = () => p.evaluate(() => { window.__pk = 0; const f = () => { window.__pk = Math.max(window.__pk, Math.abs(window.__game.player.roll)); window.__rf = requestAnimationFrame(f); }; f(); });
const peak = () => p.evaluate(() => { cancelAnimationFrame(window.__rf); return (window.__pk * 180 / Math.PI).toFixed(1); });
for (const [name, ms, key] of [['tap 0.15s', 150, 'ArrowRight'], ['hold 0.5s', 500, 'ArrowLeft'], ['hold 2s', 2000, 'ArrowRight']]) {
  await sleep(1500);
  await watch();
  await p.keyboard.down(key);
  if (name === 'hold 2s') { await sleep(1700); await p.screenshot({ path: `${out}/roll_hold.jpg`, type: 'jpeg', quality: 85 }); await sleep(300); } else await sleep(ms);
  await p.keyboard.up(key);
  await sleep(900);
  console.log(name, 'peak roll', await peak(), 'deg');
}
console.log('errors', errs.slice(0, 3));
await b.close();
