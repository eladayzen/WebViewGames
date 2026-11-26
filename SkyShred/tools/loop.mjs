// Jumps to just before the first loop power-up and screenshots the manoeuvre every 300 ms.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const out = 'shots/loop'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
const logs = []; page.on('console', (m) => logs.push(m.text())); page.on('pageerror', (e) => logs.push('ERR ' + e.message));
await page.goto('http://127.0.0.1:8141/?auto=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.G.phase === 'glide', { timeout: 60000 });
await page.evaluate(() => { const { G } = window.__game; G.s = 1380; });   // chase section starts at 1270; first orb at ~1411
await page.waitForFunction(() => window.__game.G.loopOn, { timeout: 30000 });
for (let i = 0; i < 9; i++) { await page.screenshot({ path: `${out}/l${i}.jpg`, type: 'jpeg', quality: 78 }); console.log(i, await page.evaluate(() => { const { G } = window.__game; return JSON.stringify({ th: +G.loopTh.toFixed(2), pitch: +G.pitch.toFixed(2), on: G.loopOn, y: +G.pos.y.toFixed(1), by: +G.base.y.toFixed(1) }); })); await new Promise((r) => setTimeout(r, 280)); }
console.log(logs.filter((l) => !/PropertyBinding|vite|GPU stall|ReadPixels/.test(l)).join('\n') || '(clean)');
await browser.close();
