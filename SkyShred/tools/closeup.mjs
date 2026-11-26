// Close-up shots of the rider (run pose, wing deploy sequence, glide pose) from a few angles.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const out = process.argv[2] || 'shots/close'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1100,720'] });
const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 720 });
const logs = []; page.on('pageerror', (e) => logs.push(e.message));
await page.goto('http://127.0.0.1:8141/?start=1&mode=path', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.G.phase !== 'loading', { timeout: 40000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cam = (o) => page.evaluate((o) => { window.__camOff = o; }, o);
const shot = async (n) => { await wait(120); await page.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 85 }); };
await wait(1500); await cam([2.4, 1.0, 3.4]); await shot('run-side');
await cam([0, 1.2, 4.2]); await shot('run-back');
await page.evaluate(() => window.__game.startGlide());
for (let i = 0; i < 4; i++) { await cam([2.2, 1.0, 4.6]); await wait(150); await shot('deploy-' + i); }
await wait(900);
await cam([0, 1.6, 6]); await shot('glide-back');
await cam([4.5, 1.0, 1.5]); await shot('glide-side');
await cam([0.5, 4.5, 3.5]); await shot('glide-top');
console.log(logs.join('\n') || 'no page errors');
await browser.close();
