// BEAM QA — the curtains, and the one claim they have to make good on.
//
// `beams.js` exists because every other threat in this mode tracks the rider
// faster than the board can move, so nothing the player did changed anything.
// A curtain does not track. The claim is therefore simple and testable:
// AIMING FOR THE GAP MUST BEAT NOT AIMING FOR IT, by a lot.
//
// Two riders down the same seeded slope, health pinned so neither dies early:
//   gap    steers for the hole in the next curtain
//   wall   steers for the curtain itself, well off the hole
//
// If those two come out close, the hole is not doing anything and the whole
// file is scenery.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(process.env.SHOTS ?? path.join(here, 'shots'), 'beams');
fs.mkdirSync(SHOTS, { recursive: true });
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=createServer(async(req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html';try{const b=await readFile(path.join(here,'dist',rel));res.writeHead(200,{'content-type':TYPES[path.extname(rel)]??'application/octet-stream'});res.end(b);}catch{res.writeHead(404).end('x');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0; const check=(n,ok,d='')=>{ok?(pass++,console.log(`PASS  ${n}${d?'  '+d:''}`)):(fail++,console.log(`FAIL  ${n}${d?'  '+d:''}`));};

const run = async (aim, shot) => {
  const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--mute-audio','--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width:1320,height:800});
    await page.goto(`${base}/index.html?all=1`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body.dataset.state==='title',{timeout:60000,polling:100});
    await page.click('[data-act="start"][data-mode="shoulder"]');
    await page.waitForSelector('[data-act="place"][data-place="needles"]',{timeout:20000});
    await page.click('[data-act="place"][data-place="needles"]');
    await page.waitForSelector('[data-act="stance-ok"]',{visible:true,timeout:20000});
    await page.click('[data-act="stance-ok"]');
    await page.waitForFunction(()=>window.CARVE?._game?.state==='play',{timeout:60000,polling:100});
    const ev=(f,...a)=>page.evaluate(f,...a);

    // THE LEAN SIGN, PROBED ON A PLANTED RIDER. Measured on a drifting one it
    // comes back inverted, which has already cost this project one wrong
    // finding -- a steering test that steers the wrong way measures nothing.
    const sign = await ev(async()=>{
      const g=CARVE._game;
      g.rider.x=g.terrain.centerX(g.rider.z); g.rider.yaw=0;
      const u0=g.terrain.offsetOf(g.rider.x,g.rider.z);
      // HELD, NOT SET ONCE. The lean is re-read from the input every frame,
      // so a single call decays to nothing before the rider has moved and the
      // probe comes back with the sign of the drift instead of the sign of the
      // steering -- which is how this harness reported a working mechanic as
      // broken the first time it ran.
      for (let i=0;i<24;i++){ CARVE.lean(1,0); await new Promise(r=>setTimeout(r,20)); }
      const u1=g.terrain.offsetOf(g.rider.x,g.rider.z);
      CARVE.lean(0,0);
      return Math.sign(u1-u0)||1;
    });

    await ev(()=>{
      const g=CARVE._game, f=g.roster.fighters[0];
      g.rider.x=g.terrain.centerX(g.rider.z); g.rider.yaw=0;
      // Curtains only. The drones are a separate argument and their bolts
      // would land in this sample as noise the curtains get blamed for.
      g.combat.setEnabled(false);
      g.beams.stats.crossed=0; g.beams.stats.clipped=0;
      window.__pin=setInterval(()=>{f.hp=f.maxHp;},100);
    });
    await sleep(300);
    const start=await ev(()=>CARVE._game.rider.p);
    let s=null; const until=Date.now()+180000;
    while(true){
      s=await ev((a,sg)=>{
        const g=CARVE._game, f=g.roster.fighters[0];
        const u=g.terrain.offsetOf(f.x,f.z);
        // The next curtain ahead, which is the only one worth steering for.
        let next=null;
        for(const b of g.beams.beams){ if(!b||b.dead) continue;
          const d=b.p-f.p; if(d>0&&d<170&&(!next||d<next.p-f.p)) next=b; }
        let want=0;
        if(next){
          const mid=(next.gapLo+next.gapHi)/2;
          // 'wall' aims a clear 13 m off the hole -- into the curtain, but not
          // so far out that it rides round the end of it.
          want = a==='gap' ? mid : Math.max(-22,Math.min(22, mid + (mid>0?-13:13)));
        }
        CARVE.lean(Math.max(-1,Math.min(1,(want-u)*0.22))*sg, 0);
        return {p:f.p,state:g.state,crossed:g.beams.stats.crossed,clipped:g.beams.stats.clipped};
      }, aim, sign);
      if(s.state!=='play')break;
      if(s.p-start>=2200)break;
      if(Date.now()>until)break;
      await sleep(50);
    }
    if(shot) await page.screenshot({path:path.join(SHOTS,shot)});
    return {...s, errors, metres:Math.round(s.p-start)};
  } finally { await browser.close(); }
};

console.log('');
console.log('  steering for |  curtains met   clipped   hit rate');
console.log('  -------------+-----------------------------------');
const gap  = await run('gap','gap.png');
const wall = await run('wall','wall.png');
const rate = r => r.crossed ? Math.round(100*r.clipped/r.crossed) : 0;
for(const [n,r] of [['the gap',gap],['the wall',wall]])
  console.log(`  ${n.padEnd(12)} | ${String(r.crossed).padStart(9)} ${String(r.clipped).padStart(9)} ${String(rate(r)).padStart(9)}%`);
console.log('');

check('no page errors', gap.errors.length===0 && wall.errors.length===0,
  [...gap.errors,...wall.errors].slice(0,2).join(' | '));
check('curtains are actually being met', gap.crossed>=8 && wall.crossed>=8,
  `gap ${gap.crossed}  wall ${wall.crossed}`);
if(gap.crossed>=8 && wall.crossed>=8){
  check('riding the wall gets you clipped', rate(wall)>=50, `${rate(wall)}%`);
  check('riding the gap mostly does not', rate(gap)<=25, `${rate(gap)}%`);
  check('and the gap is worth at least 40 points', rate(wall)-rate(gap)>=40,
    `${rate(wall)-rate(gap)} points`);
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);
server.close();
process.exit(fail?1:0);
