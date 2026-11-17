// April's turn UI at a given screen size: level 2 under autopilot until the FOLLOW HER caption
// shows, then a screenshot plus how much of the screen the caption and arrow cover.
//   node tools/follow-ui.mjs [port] [outDir] [width] [height]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', w = '1280', h = '720'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: +w, height: +h });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1&level=3`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.waitForFunction(() => !document.getElementById('follow').classList.contains('hidden'), { timeout: 90000 });
await new Promise((r) => setTimeout(r, 600));
await p.screenshot({ path: `${out}/follow_${w}x${h}.jpg`, type: 'jpeg', quality: 82 });
console.log(w + 'x' + h, JSON.stringify(await p.evaluate(() => {
  const r = (id) => { const q = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height), pct: +(q.width * q.height / innerWidth / innerHeight * 100).toFixed(1) }; };
  return { caption: r('follow'), arrow: r('follow-arrow') };
})), 'errors', errs.slice(0, 3));
await b.close();
