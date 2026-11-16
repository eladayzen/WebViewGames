// SAW BLADES check: autopilot (which rams Foot cars) with the saws power kept on; screenshots,
// and how many wrecks were labelled SAWED (counted from the popups).
//   node tools/saws.mjs [port] [outDir] [secs]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', secs = '12'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1&dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => {
  const g = window.__game; g.G.god = true; document.querySelector('.lil-gui')?.remove();
  window.__sawed = 0;
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (/SAWED/.test(n.textContent || '')) window.__sawed++; })
    .observe(document.getElementById('popups'), { childList: true, subtree: true });
  const keep = () => { if (!g.G.buff || g.G.buff.kind !== 'saws') g.startBuff('saws'); };
  keep(); setInterval(keep, 500);
});
for (let i = 0; i < 6; i++) {
  await new Promise((r) => setTimeout(r, +secs * 1000 / 6));
  await p.screenshot({ path: `${out}/saw_${i}.jpg`, type: 'jpeg', quality: 85 });
}
console.log(await p.evaluate(() => `wrecks ${window.__game.G.wrecks}  sawed ${window.__sawed}`), 'errors', errs.slice(0, 3));
await b.close();
