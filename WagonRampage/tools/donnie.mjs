// Donnie's THUNDER STAFF: a burst of chase-camera frames through his swings (wind-up, strike,
// a Foot car thrown up and onto another), plus the counts: swings that lifted a car, CRUSHED /
// SLAMMED labels, wrecks during the power.
//   node tools/donnie.mjs [port] [outDir] [frames] [gapMs]
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', frames = '24', gap = '140'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1&auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => {
  const g = window.__game; g.G.god = true; document.querySelector('.lil-gui')?.remove();
  g.G.script.foot = g.G.script.pickup = g.G.script.fork = true;   // no tutorial interruptions
  window.__autopilot = false;
  // a cluster of Foot cars ahead, two lanes either side, so a thrown car has somewhere to land
  g.spawnEnemy('racer', 22, -5.4); g.spawnEnemy('racer', 30, -1.8); g.spawnEnemy('truck', 40, 5.4); g.spawnEnemy('racer', 26, 9);
  window.__labels = {};
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { const t = (n.textContent || '').replace(/[+\-]?\d+/g, '').trim(); if (t) window.__labels[t] = (window.__labels[t] || 0) + 1; } })
    .observe(document.getElementById('popups'), { childList: true, subtree: true });
  window.__w0 = g.G.wrecks;
  g.startBuff('donnie');
});
for (let i = 0; i < +frames; i++) {
  await new Promise((r) => setTimeout(r, +gap));
  await p.screenshot({ path: `${out}/don_${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 });
}
// then the next hover: where the held car sits on screen (x,y in -1..1, + is right/up) and a frame
await p.evaluate(() => { const g = window.__game; if (!g.G.buff) g.startBuff('donnie'); });
for (let k = 0; k < 80; k++) {
  await new Promise((r) => setTimeout(r, 60));
  const h = await p.evaluate(() => {
    const g = window.__game, e = g.enemies.find((c) => c.lift && c.lift.ph === 'hover' && c.lift.t > 0.5);
    if (!e) return null;
    g.G.paused = true;   // frozen: the frame below and these numbers are the same moment
    g.camera.updateMatrixWorld(true);
    const v = e.group.position.clone().project(g.camera);
    const box = new (e.group.position.constructor)(), b = new (Object.getPrototypeOf(g.camera.position).constructor)();
    const bb = { minX: 1, maxX: -1 };
    e.group.updateMatrixWorld(true);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = e.group.localToWorld(box.set(sx * e.W / 2, 1, sz * e.L / 2)).project(g.camera);
      bb.minX = Math.min(bb.minX, p.x); bb.maxX = Math.max(bb.maxX, p.x);
    }
    const w = g.player.group.position.clone().project(g.camera);
    const vis = []; let q = e.body; while (q) { vis.push(q.visible ? 1 : 0); q = q.parent; }
    const meshes = []; e.body.traverse((o) => { if (o.isMesh) meshes.push([o.visible ? 1 : 0, o.material.opacity, o.material.transparent ? 1 : 0, o.frustumCulled ? 1 : 0, +o.getWorldScale(new (e.group.position.constructor)()).x.toFixed(2)]); });
    window.__dbg = { vis, inStage: e.group.parent === g.stage, meshes: meshes.slice(0, 3), alive: e.alive, active: e.active, wreck: !!e.wreck };
    console.log('DBG', JSON.stringify(window.__dbg));
    const px = (q) => [Math.round((q.x + 1) / 2 * innerWidth), Math.round((1 - q.y) / 2 * innerHeight)];
    return { carPx: px(v), wagonPx: px(w), carWorld: e.group.position.toArray().map((n) => +n.toFixed(1)), wagonWorld: g.player.group.position.toArray().map((n) => +n.toFixed(1)), x: +v.x.toFixed(2), y: +v.y.toFixed(2), widthPx: Math.round((bb.maxX - bb.minX) / 2 * innerWidth), rel: Math.round(e.s - g.player.s), h: +e.group.position.y.toFixed(1), kind: e.kind };
  });
  if (h) { await p.screenshot({ path: `${out}/don_hover.jpg`, type: 'jpeg', quality: 85 }); console.log('HOVER', JSON.stringify(h)); console.log('DBG', JSON.stringify(await p.evaluate(() => window.__dbg))); break; }
}
await new Promise((r) => setTimeout(r, 2000));
console.log(JSON.stringify(await p.evaluate(() => ({ lifts: window.__game.G.lifts || 0, wrecks: window.__game.G.wrecks - window.__w0, labels: window.__labels }))), 'errors', errs.slice(0, 3));
await b.close();
