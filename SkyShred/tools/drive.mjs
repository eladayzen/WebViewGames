// Headless verification run against the dev server (muted Chrome): plays a whole leg on autopilot and saves screenshots
// at the interesting moments.  usage: node tools/drive.mjs [--url=http://127.0.0.1:8141] [--q=extra&query] [--out=shots] [--w=1280] [--h=720]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), ''] : [a.slice(2, i), a.slice(i + 1)]; }));
const W = +(args.w || 1280), H = +(args.h || 720);
const out = args.out || 'shots'; fs.mkdirSync(out, { recursive: true });
const url = (args.url || 'http://127.0.0.1:8141') + '/?auto=1' + (args.q ? '&' + args.q : '');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H}`],
});
const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.G.phase !== 'loading', { timeout: 40000 });
await page.evaluate(() => { let n = 0, t0 = performance.now(); (function c() { n++; const t = performance.now(); if (t - t0 > 1000) { window.__fps = Math.round(n * 1000 / (t - t0)); n = 0; t0 = t; } requestAnimationFrame(c); })(); });
const stat = () => page.evaluate(() => { const { G, combat } = window.__game; return { phase: G.phase, s: +G.s.toFixed(0), v: +G.v.toFixed(1), h: +G.h.toFixed(1), score: Math.floor(G.score), kills: combat.kills, drones: combat.drones.length, lock: +combat.lockT.toFixed(2), rings: G.rings, hp: Math.round(G.hp), loop: G.loopOn, purs: window.__game.enemy.pursuers.length, fps: window.__fps, leg: G.open ? G.level : G.legIdx, pz: +G.pz.toFixed(0) }; });
const triggers = (args.t ? JSON.parse(args.t) : [
  { n: 'run-lift', ph: 'run', pz: -2 }, { n: 'run-foes', ph: 'run', pz: -40 }, { n: 'run-edge', ph: 'run', pz: -82 },
  { n: 'dive', ph: 'glide', s: 12 }, { n: 'glide-a', ph: 'glide', s: 60 }, { n: 'fight-1', ph: 'glide', s: 150 }, { n: 'fight-2', ph: 'glide', s: 215 },
  { n: 'skim-a', ph: 'glide', s: 330 }, { n: 'skim-b', ph: 'glide', s: 380 }, { n: 'fight-3', ph: 'glide', s: 480 }, { n: 'approach', ph: 'glide', s: 620 }, { n: 'land', ph: 'land' },
]);
let ti = 0; const t0 = Date.now(); const timeout = +(args.timeout || 200) * 1000;
while (ti < triggers.length && Date.now() - t0 < timeout) {
  const st = await stat(); const tr = triggers[ti];
  const ok = st.phase === tr.ph && (tr.s === undefined || st.s >= tr.s) && (tr.pz === undefined || st.pz <= tr.pz) && (tr.lock === undefined || st.lock >= tr.lock) && (tr.leg === undefined || st.leg >= tr.leg) && (tr.loop === undefined || st.loop === tr.loop);
  if (ok) { const f = path.join(out, `${String(ti + 1).padStart(2, '0')}-${tr.n}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 80 }); console.log(tr.n, JSON.stringify(st)); ti++; }
  else await new Promise((r) => setTimeout(r, 120));
}
console.log('final', JSON.stringify(await stat()));
console.log(logs.filter((l) => !/Download the React|GPU stall|ReadPixels/.test(l)).slice(0, 25).join('\n') || '(no console output)');
await browser.close();
