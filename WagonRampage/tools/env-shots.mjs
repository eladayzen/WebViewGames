// One screenshot set per level's environment, plus numbers that tell the levels apart.
// For each level: boot with ?auto=1&level=N, god mode, wait for play, then shoot at
// `moments` (seconds of play) and report mean colour / brightness of the sky band and the
// building band of the last frame, any page errors, and the frame time.
//   node tools/env-shots.mjs [port] [outDir] [width] [height] [levels e.g. 1,2,3,4,5,6]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', w = '1280', h = '720', lv = '1,2,3,4,5,6'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const moments = [4, 14];
for (const L of lv.split(',').map(Number)) {
  const p = await b.newPage(); await p.setViewport({ width: +w, height: +h });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html?auto=1&level=${L}`);
  await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
  await p.evaluate(() => { window.__game.G.god = true; });
  for (const t of moments) {
    await p.waitForFunction((tt) => window.__game.G.time > tt, { timeout: 90000, polling: 100 }, t);
    await p.screenshot({ path: `${out}/env_L${L}_${t}s_${w}x${h}.jpg`, type: 'jpeg', quality: 82 });
  }
  const r = await p.evaluate(async () => {
    const g = window.__game;
    const c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const x = c.getContext('2d');
    g.renderer.render(g.scene, g.camera);
    x.drawImage(g.renderer.domElement, 0, 0, 64, 36);
    const band = (y0, y1) => { const d = x.getImageData(0, y0, 64, y1 - y0).data; let R = 0, G = 0, B = 0, n = d.length / 4; for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; } return [R / n, G / n, B / n].map(Math.round); };
    let n = 0; const t0 = performance.now(); await new Promise((res) => { const f = () => { if (++n < 60) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return { env: g.G.env && g.G.env.name, sky: band(0, 8), houses: band(10, 20), road: band(26, 36), ms: +((performance.now() - t0) / 60).toFixed(1) };
  });
  console.log('L' + L, JSON.stringify(r), 'errors', errs.slice(0, 3));
  await p.close();
}
await b.close();
