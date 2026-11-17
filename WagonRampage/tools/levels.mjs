// The two-level loop, end to end, headless and muted.
//   node tools/levels.mjs [port] [outDir] [mode]
// mode:
//   intro  — level 1 from boot: the talking scene (screenshots per line + the card), then the
//            tutorial under autopilot: Foot arrival lines, the pickup lesson, the fork lesson,
//            until the level ends. Logs the script flags, wrecks, end title.
//   april  — level 2 (?level=2&auto=1, scenes skipped) under autopilot following April's
//            blinker until the timer runs out. Logs April's health, forks, shots at her, result.
//   wrong  — level 2, autopilot takes the OTHER fork at the first junction. Expects
//            YOU LOST APRIL! a few seconds after the fork.
import puppeteer from 'puppeteer-core';
const [port = '8155', out = '.', mode = 'intro'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => p.screenshot({ path: `${out}/lv_${mode}_${n}.jpg`, type: 'jpeg', quality: 80 });
const state = () => p.evaluate(() => {
  const g = window.__game, G = g.G;
  return { state: G.state, level: g.LV.n, t: +G.time.toFixed(1), left: +G.left.toFixed(1), wrecks: G.wrecks, hp: Math.round(G.hp), april: Math.round(g.april.hp), forks: G.forks || 0,
    off: !!g.april.off, script: Object.keys(G.script || {}).join(','), over: document.getElementById('over-title').textContent,
    overShown: !document.getElementById('gameover-overlay').classList.contains('hidden'), say: document.getElementById('say').textContent, hint: document.getElementById('hint').textContent };
});

if (mode === 'intro') {
  await p.goto(`http://127.0.0.1:${port}/index.html?dev=1`);
  await p.waitForFunction(() => window.__game && window.__game.G.state === 'story', { timeout: 60000 });
  await p.evaluate(() => document.querySelector('.lil-gui')?.remove());
  await wait(900); await shot('scene1');
  await wait(3600); await shot('scene2');
  await wait(4200); await shot('card');
  await p.waitForFunction(() => window.__game.G.state !== 'story', { timeout: 20000 });
  await p.evaluate(() => { window.__autopilot = true; });
  const marks = {};
  for (let i = 0; i < 160; i++) {
    await wait(500);
    const s = await state();
    for (const k of ['foot', 'pickup', 'fork']) if (s.script.includes(k) && !marks[k]) { marks[k] = s.t; await wait(900); await shot(k); }
    if (i % 10 === 0) console.log(JSON.stringify(s));
    if (s.state === 'over') { await wait(2500); await shot('end'); console.log('END', JSON.stringify(await state())); break; }
  }
  console.log('marks', JSON.stringify(marks));
} else {
  await p.goto(`http://127.0.0.1:${port}/index.html?dev=1&auto=1&level=2`);
  await p.waitForFunction(() => window.__game && window.__game.G.state === 'play', { timeout: 60000 });
  await p.evaluate((wrong) => { document.querySelector('.lil-gui')?.remove(); window.__wrongFork = wrong; }, mode === 'wrong');
  let shotTurn = false, shotOff = false;
  for (let i = 0; i < 180; i++) {
    await wait(mode === 'wrong' ? 250 : 500);
    const s = await state();
    const near = await p.evaluate(() => { const J = window.__game.path.junction; return J ? Math.round(J.s - window.__game.player.s) : null; });
    if (!shotTurn && near !== null && near < 120) { shotTurn = true; await shot('fork'); }
    if (i === 6) await shot('chase');
    if (s.off && mode === 'wrong' && !shotOff) { shotOff = true; await wait(1800); await shot('wrong'); }
    if (i % 10 === 0) console.log(JSON.stringify(s), 'toFork', near);
    if (s.state === 'over') { await wait(1500); await shot('end'); console.log('END', JSON.stringify(await state())); break; }
  }
  console.log('shots', JSON.stringify(await p.evaluate(() => ({ fired: window.__game.G.shotsFired, lifts: window.__game.G.lifts || 0 }))));
}
console.log('errors', errs.slice(0, 5));
await b.close();
