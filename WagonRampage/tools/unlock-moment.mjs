// The NEW POWER UNLOCKED moment: open a level, SKIP the talk, and screenshot the moment at set
// times (slam-in, full reveal, the icon flying into its chip, the card after).
//   node tools/unlock-moment.mjs [port] [outDir] [level]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', level = '3'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?level=${level}`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'story', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 700));
await p.evaluate(() => document.getElementById('story-skip').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
const t0 = Date.now();
for (const [ms, name] of [[150, 'a_slam'], [1100, 'b_reveal'], [3750, 'c_fly'], [4600, 'd_card']]) {
  await new Promise((r) => setTimeout(r, Math.max(0, ms - (Date.now() - t0))));
  await p.screenshot({ path: `${out}/unlock_L${level}_${name}.jpg`, type: 'jpeg', quality: 82 });
}
console.log('errors', errs.slice(0, 3));
await b.close();
