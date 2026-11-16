// While hugging the right-hand buildings: where are the live additive particles relative to the
// wagon (in the wagon's frame: x right, z back), and how many are there?
//   node tools/scrape-probe.mjs [port]
import puppeteer from 'puppeteer-core';
const [port = '8155'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 960, height: 540 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
await p.evaluate(() => { window.__game.G.god = true; });
await p.keyboard.down('ArrowRight');
await new Promise((r) => setTimeout(r, 3000));
console.log(await p.evaluate(() => {
  const g = window.__game, P = g.fx.add, pl = g.player.group, V = pl.position.constructor;
  const rows = [];
  for (let i = 0; i < P.n; i++) if (P.life[i] > 0) {
    const w = new V(P.p[i * 3], P.p[i * 3 + 1], P.p[i * 3 + 2]);
    const l = pl.worldToLocal(w.clone());
    if (Math.abs(l.x) < 12 && Math.abs(l.z) < 30) rows.push(`x ${l.x.toFixed(1)} y ${l.y.toFixed(1)} z ${l.z.toFixed(1)} size ${P.sz[i].toFixed(2)} a ${P.c[i * 4 + 3].toFixed(2)}`);
  }
  return `near wagon: ${rows.length}  scrapes ${g.G.scrapes}  stagePos ${JSON.stringify(g.stage.position)}\n` + rows.slice(0, 12).join('\n');
}));
console.log('errors', errs.slice(0, 3));
await b.close();
