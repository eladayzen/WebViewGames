// Gadget check: autopilot with one gadget kept on, god mode OFF (so the shield's damage block is
// measured), screenshots, and the gadget's own counters plus popup labels.
//   node tools/gadgets.mjs [port] [outDir] [shield|nitro|harpoon|saws] [secs]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', kind = 'shield', secs = '12'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1&dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate((kind) => {
  const g = window.__game; document.querySelector('.lil-gui')?.remove();
  window.__labels = {}; window.__hp0 = g.G.hp;
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { const t = (n.textContent || '').replace(/[+\-]?\d+/g, '').trim(); if (t) window.__labels[t] = (window.__labels[t] || 0) + 1; } })
    .observe(document.getElementById('popups'), { childList: true, subtree: true });
  const keep = () => { if (!g.G.gadget || g.G.gadget.kind !== kind) g.startGadget(kind); };
  keep(); setInterval(keep, 300);
}, kind);
for (let i = 0; i < 6; i++) {
  await new Promise((r) => setTimeout(r, +secs * 1000 / 6));
  await p.screenshot({ path: `${out}/${kind}_${i}.jpg`, type: 'jpeg', quality: 85 });
}
console.log(await p.evaluate(() => {
  const G = window.__game.G;
  return JSON.stringify({ wrecks: G.wrecks, hpLost: window.__hp0 - G.hp, shotsFired: G.shotsFired || 0, shotsHit: G.shotsHit || 0, bounced: G.bounced || 0, hooks: G.hooks || 0, labels: window.__labels });
}), 'errors', errs.slice(0, 3));
await b.close();
