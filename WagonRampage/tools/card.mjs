// A level's title card: open the level, press SKIP, screenshot the card.
//   node tools/card.mjs [port] [outFile] [level]
import puppeteer from 'puppeteer-core';
const [port = '8155', outFile = 'card.jpg', level = '1'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?level=${level}`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'story', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));
await p.evaluate(() => document.getElementById('story-skip').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
await new Promise((r) => setTimeout(r, 900));
await p.screenshot({ path: outFile, type: 'jpeg', quality: 85 });
console.log('errors', errs.slice(0, 3));
await b.close();
