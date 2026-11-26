// Holds ArrowRight into the edge of the path and logs lateral position / speed / roll, to check the soft tunnel wall.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const out = 'shots/wall'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
const logs = []; page.on('console', (m) => logs.push(m.text())); page.on('pageerror', (e) => logs.push('ERR ' + e.message));
await page.goto('http://127.0.0.1:8141/?start=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.G.phase === 'run', { timeout: 40000 });
await page.evaluate(() => { const g = window.__game; g.G.pz = -86; });
await page.waitForFunction(() => window.__game.G.phase === 'glide', { timeout: 20000 });
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 700)); console.log(i, await page.evaluate(() => { const { G } = window.__game; return JSON.stringify({ lat: +G.lat.toFixed(1), latV: +G.latV.toFixed(2), roll: +G.roll.toFixed(2), wall: +(G.wall || 0).toFixed(2) }); })); if (i === 6) await page.screenshot({ path: `${out}/edge.jpg`, type: 'jpeg', quality: 78 }); }
await page.keyboard.up('ArrowRight');
console.log(logs.filter((l) => !/PropertyBinding|vite|GPU stall|ReadPixels/.test(l)).join('\n') || '(clean)');
await browser.close();
