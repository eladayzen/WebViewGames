// Holds ArrowRight for a while (full circles) and screenshots, to check the free-heading mode.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const out = 'shots/c1'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
const logs = []; page.on('console', (m) => logs.push(m.text())); page.on('pageerror', (e) => logs.push('ERR ' + e.message));
await page.goto('http://127.0.0.1:8141/?start=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.G.phase === 'open', { timeout: 40000 });
const st = () => page.evaluate(() => { const { G, ow } = window.__game; return { hdg: +G.hdg.toFixed(2), x: +G.pos.x.toFixed(0), z: +G.pos.z.toFixed(0), y: +G.y.toFixed(1), v: +G.v.toFixed(1), structs: ow.structs.length, rings: ow.rings.length }; });
console.log('start', JSON.stringify(await st()));
await page.keyboard.down('ArrowRight');
for (let i = 1; i <= 6; i++) { await new Promise((r) => setTimeout(r, 1500)); await page.screenshot({ path: `${out}/turn${i}.jpg`, type: 'jpeg', quality: 78 }); console.log('turn' + i, JSON.stringify(await st())); }
await page.keyboard.up('ArrowRight');
await page.keyboard.down('ArrowLeft'); await new Promise((r) => setTimeout(r, 2500)); await page.keyboard.up('ArrowLeft');
console.log('after-left', JSON.stringify(await st()));
console.log(logs.filter((l) => !/PropertyBinding|vite|GPU stall|ReadPixels/.test(l)).join('\n') || '(clean)');
await browser.close();
