// Checks pause freezes the run, mute toggles, resume continues. Needs the
// preview server running: node tools/pausetest.mjs <port> <shot.jpg>
import puppeteer from 'puppeteer-core';
const [port = '8142', shot = 'paused.jpg'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html`);
await p.waitForFunction(() => window.__game && window.__game.G.state !== 'loading');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(4000);
const s = () => p.evaluate(() => window.__game.player.s.toFixed(1));
await p.click('#pause-btn');
const a = await s();
await wait(1000);
const b2 = await s();
await p.click('#mute-btn');
await p.screenshot({ path: shot });
const muted = await p.evaluate(() => document.getElementById('mute-btn').classList.contains('muted'));
await p.click('#resume-button');
await wait(500);
const c = await s();
console.log({ pausedFrom: a, after1s: b2, afterResume: c, muted, errs });
await b.close();
