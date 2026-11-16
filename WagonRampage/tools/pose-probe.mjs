// Scan every frame of every Raph clip for (a) a two-handed "hold something in front of the
// chest" pose and (b) a one-hand-raised-overhead pose. Positions are in the model's own frame,
// in metres for a 2.64 m tall turtle. Prints the best few of each.
//   node tools/pose-probe.mjs [port]
import puppeteer from 'puppeteer-core';
const [port = '8155'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage();
await p.goto(`http://127.0.0.1:${port}/index.html?auto=1`);
await p.waitForFunction(() => window.__game && window.__game.raphTop, { timeout: 60000 });
const out = await p.evaluate(async () => {
  const R = window.__game.raphTop, Clip = R.ride.getClip().constructor;
  const src = { ...(await (await fetch('/models/clips.json')).json()), ...(await (await fetch('/models/throws.json')).json()) };
  const V = R.holder.position.constructor;
  const bone = (n) => R.model.getObjectByName('mixamorig' + n);
  const B = { lh: bone('LeftHand'), rh: bone('RightHand'), head: bone('Head'), chest: bone('Spine2'), hips: bone('Hips') };
  const loc = (o) => R.holder.worldToLocal(o.getWorldPosition(new V()));
  const hold = [], up = [];
  const wasVis = R.holder.visible; R.holder.visible = true;
  for (const [k, j] of Object.entries(src)) {
    const act = R.mixer.clipAction(Clip.parse(j));
    for (let t = 0; t <= j.duration; t += 1 / 30) {
      R.mixer.stopAllAction(); act.reset().play(); act.time = t; R.mixer.update(0);
      R.holder.updateMatrixWorld(true);
      const lh = loc(B.lh), rh = loc(B.rh), hd = loc(B.head), ch = loc(B.chest), hp = loc(B.hips);
      // chest-forward direction from hips->chest isn't enough; use shoulder line like the game
      const fwdZ = Math.sign(hd.z - hp.z) || 1;
      const mid = lh.clone().add(rh).multiplyScalar(0.5);
      const gap = lh.distanceTo(rh);
      const front = (mid.z - ch.z) * fwdZ;
      const hgt = mid.y - ch.y;
      const upright = hd.y - hp.y;
      hold.push({ k, t: +t.toFixed(2), score: +(-Math.abs(gap - 0.35) * 2 + Math.min(front, 0.6) - Math.abs(hgt + 0.15) + upright * 0.5).toFixed(2), gap: +gap.toFixed(2), front: +front.toFixed(2), hgt: +hgt.toFixed(2), upright: +upright.toFixed(2) });
      const hi = Math.max(lh.y, rh.y) - hd.y;
      up.push({ k, t: +t.toFixed(2), score: +(hi + upright * 0.5).toFixed(2), hand: lh.y > rh.y ? 'L' : 'R', above: +hi.toFixed(2), upright: +upright.toFixed(2) });
    }
  }
  R.mixer.stopAllAction(); R.holder.visible = wasVis;
  hold.sort((a, b) => b.score - a.score); up.sort((a, b) => b.score - a.score);
  const pick = (arr) => { const seen = new Set(), r = []; for (const x of arr) { const id = x.k + Math.round(x.t * 2); if (seen.has(id)) continue; seen.add(id); r.push(x); if (r.length >= 6) break; } return r; };
  return { hold: pick(hold), up: pick(up) };
});
console.log('HOLD (two hands in front of chest)'); console.table(out.hold);
console.log('UP (one hand overhead)'); console.table(out.up);
await b.close();
