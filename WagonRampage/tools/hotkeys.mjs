// Press the dev hotkeys Z X C V in turn and report what each one started.
//   node tools/hotkeys.mjs [port] [outDir]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
for (const key of ['z', 'x', 'c', 'v']) {
  await p.keyboard.press(key);
  await new Promise((r) => setTimeout(r, 1200));
  const s = await p.evaluate(() => { const G = window.__game.G; return `power ${G.power} strike ${!!G.strike} buff ${G.buff?.kind ?? JSON.stringify(Object.keys(G).filter((k) => /buff/i.test(k)).map((k) => [k, typeof G[k] === 'object' ? G[k]?.kind : G[k]]))}`; });
  console.log(key, s);
  await p.screenshot({ path: `${out}/hk_${key}.jpg`, type: 'jpeg', quality: 75 });
}
console.log('errors', errs.slice(0, 3));
await b.close();
