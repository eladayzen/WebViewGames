// Measure where Raph's body points (shoulder line -> facing) vs the direction to the Foot car
// he's throwing at, during his roof power. Prints the angle error over time.
//   node tools/raph-facing.mjs [port]
import puppeteer from 'puppeteer-core';
const [port = '8155'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage();
await p.setViewport({ width: 960, height: 540 });
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => window.__game.startBuff('raph'));
for (let i = 0; i < 16; i++) {
  await new Promise((r) => setTimeout(r, 300));
  console.log(await p.evaluate(() => {
    const g = window.__game, R = g.raphTop, V = R.holder.position.constructor;
    const L = new V(), Rs = new V(), hips = new V();
    R.model.getObjectByName('mixamorigLeftShoulder').getWorldPosition(L);
    R.model.getObjectByName('mixamorigRightShoulder').getWorldPosition(Rs);
    R.model.getObjectByName('mixamorigHips').getWorldPosition(hips);
    const fwd = new V(0, 1, 0).cross(Rs.clone().sub(L)); fwd.y = 0; fwd.normalize();
    const foot = g.enemies.filter((e) => e.active && e.alive && e.s - g.player.s > -8 && e.s - g.player.s < 80)
      .sort((a, b) => a.group.position.distanceTo(hips) - b.group.position.distanceTo(hips))[0];
    if (!foot) return 'no target';
    const to = foot.group.position.clone().sub(hips); to.y = 0; to.normalize();
    const err = Math.atan2(fwd.clone().cross(to).y, fwd.dot(to)) * 180 / Math.PI;
    const cur = R.cur >= 0 ? R.throws[R.cur] : null;
    return `facing err ${err.toFixed(0)}°  holderYaw ${(R.holder.rotation.y * 180 / Math.PI).toFixed(0)}°  clip ${cur ? cur.act.getClip().name + ' t' + cur.act.time.toFixed(2) : '-'}`;
  }));
}
await b.close();
