// Find the wheels in the (single-mesh) car models: vertices within a few cm of the ground are
// the tyre contact patches. Per corner: contact z range, outer x, and a radius guess from the
// lowest outer-edge vertices' height profile. In the car's own frame (x right, z back, y up).
//   node tools/wheel-probe.mjs [port]
import puppeteer from 'puppeteer-core';
const [port = '8155'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage();
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.player && window.__game.enemies.length, { timeout: 60000 });
const out = await p.evaluate(() => {
  const g = window.__game, res = {};
  const cars = [['wagon', g.player], ...['racer', 'truck'].map((k) => [k, g.enemies.find((e) => e.kind === k)])];
  for (const [kind, car] of cars) {
    if (!car) continue;
    const V = car.group.position.constructor;
    car.body.updateMatrixWorld(true);
    const inv = car.body.matrixWorld.clone().invert();
    const pts = [];
    car.body.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.position || o.material.isMeshBasicMaterial) return;
      const a = o.geometry.attributes.position, m = inv.clone().multiply(o.matrixWorld), v = new V();
      for (let i = 0; i < a.count; i += 1) { v.fromBufferAttribute(a, i).applyMatrix4(m); pts.push([v.x, v.y, v.z]); }
    });
    const minY = Math.min(...pts.map((q) => q[1]));
    const rows = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const low = pts.filter((q) => q[1] < minY + 0.06 && Math.sign(q[0]) === sx && Math.sign(q[2]) === sz);
      if (!low.length) { rows.push({ sx, sz, n: 0 }); continue; }
      const zs = low.map((q) => q[2]), xs = low.map((q) => Math.abs(q[0]));
      const zc = (Math.min(...zs) + Math.max(...zs)) / 2, xo = Math.max(...xs);
      // radius: on the outer face (|x| > xo - 0.15), the highest vertex within the contact z-range-ish
      const face = pts.filter((q) => Math.sign(q[0]) === sx && Math.abs(q[0]) > xo - 0.15 && Math.abs(q[2] - zc) < 0.08 && q[1] < 1.6);
      const top = face.length ? Math.max(...face.map((q) => q[1])) : NaN;
      // circle fit from the outer face: half-width w of the tyre at height h -> r = (w^2 + h^2) / 2h
      const fit = (h) => {
        const band = pts.filter((q) => Math.sign(q[0]) === sx && Math.abs(q[0]) > xo - 0.3 && Math.abs(q[1] - h) < 0.025 && Math.abs(q[2] - zc) < 0.9);
        if (!band.length) return NaN;
        const w = Math.max(...band.map((q) => Math.abs(q[2] - zc)));
        return (w * w + h * h) / (2 * h);
      };
      rows.push({ sx, sz, n: low.length, zc: +zc.toFixed(2), zlen: +(Math.max(...zs) - Math.min(...zs)).toFixed(2), xo: +xo.toFixed(2), r10: +fit(0.1).toFixed(2), r20: +fit(0.2).toFixed(2), r30: +fit(0.3).toFixed(2) });
    }
    res[kind] = { minY: +minY.toFixed(3), W: +car.W.toFixed(2), L: +car.L.toFixed(2), H: +car.H.toFixed(2), rows };
  }
  return res;
});
for (const [k, v] of Object.entries(out)) { console.log(k, `W ${v.W} L ${v.L} H ${v.H} minY ${v.minY}`); console.table(v.rows); }
await b.close();
