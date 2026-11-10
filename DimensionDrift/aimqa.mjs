// AIM QA — the aiming trade, measured. See `aimNear` on `star` and `turn`/`lead`
// on `blaster` in weapons.js for the design these checks are against.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(process.env.SHOTS ?? path.join(here, 'shots'), 'aim');
fs.mkdirSync(SHOTS, { recursive: true });
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=createServer(async(req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html';try{const b=await readFile(path.join(here,'dist',rel));res.writeHead(200,{'content-type':TYPES[path.extname(rel)]??'application/octet-stream'});res.end(b);}catch{res.writeHead(404).end('x');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0; const check=(n,ok,d='')=>{ok?(pass++,console.log(`PASS  ${n}${d?'  '+d:''}`)):(fail++,console.log(`FAIL  ${n}${d?'  '+d:''}`));};
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--mute-audio','--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader']});
const errors=[];
try{
const page=await browser.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
const ev=(f,...a)=>page.evaluate(f,...a);
await page.setViewport({width:1320,height:800});
await page.goto(`${base}/index.html?all=1`,{waitUntil:'load',timeout:60000});
await page.waitForFunction(()=>document.body.dataset.state==='title',{timeout:60000,polling:100});
await page.click('[data-act="start"][data-mode="shoulder"]');
await page.waitForSelector('[data-act="place"][data-place="needles"]',{timeout:20000});
await page.click('[data-act="place"][data-place="needles"]');
await page.waitForSelector('[data-act="stance-ok"]',{visible:true,timeout:20000});
await page.click('[data-act="stance-ok"]');
await page.waitForFunction(()=>window.CARVE?._game?.state==='play',{timeout:60000,polling:100});

// ── 0. the clock is gone from this mode ─────────────────────────────────
check('this mode has no clock', await ev(()=>CARVE._game._modeDef.usesClock===false));

// ── 1. the cone filters by heading ──────────────────────────────────────
// A drone placed dead ahead must acquire; the same drone placed abeam at the
// same RANGE must not. Same distance both times, so only the heading differs.
const cone = await ev(()=>{
  const g=CARVE._game, C=g.combat.constructor, f=g.roster.fighters[0];
  const w=f.gun;
  const h=f.heading, m=Math.hypot(h.x,h.z)||1;
  const hx=h.x/m, hz=h.z/m;
  const R=30;
  const ahead={x:f.x+hx*R, y:f.y+3, z:f.z+hz*R, id:'a', hp:3, inbound:0};
  // perpendicular, same range
  const abeam={x:f.x-hz*R, y:f.y+3, z:f.z+hx*R, id:'b', hp:3, inbound:0};
  return {
    ahead: !!C.acquire(f,[ahead],w),
    abeam: !!C.acquire(f,[abeam],w),
    nearerAbeam: !!C.acquire(f,[abeam,ahead],w) && C.acquire(f,[abeam,ahead],w).id,
  };
});
check('a drone dead ahead is acquired', cone.ahead===true);
check('the same drone abeam at the same range is NOT', cone.abeam===false);
check('and with both offered it takes the one in front', cone.nearerAbeam==='a', String(cone.nearerAbeam));

// ── 2. the weapon table says what the design says ───────────────────────
// `squads` is a ring with null slots, so it is filtered rather than flatMapped
// -- the first cut did `squads.flatMap(s=>s.drones)` and threw on the first
// empty band.
const live = await ev(()=>{
  const g=CARVE._game;
  const ds=(g.combat.squads||[]).filter(Boolean).flatMap(s=>s.drones||[]).filter(d=>!d.dead);
  return {drones:ds.length};
});
check('there are live drones to fight', live.drones>0, `${live.drones} up`);

// ── 3. THE DESIGN'S ONE CLAIM, A/B ──────────────────────────────────────
//
// "Being in motion makes you hard to hit; being predictable makes you a
// target." That is a COMPARISON, and it is the only thing worth asserting --
// an absolute hit rate says nothing, because the drones' damage per kilometre
// was tuned against whatever the hit rate happened to be.
//
// Both phases ride the same stretch of hill from the same p, with health
// pinned so neither dies early and skews the sample.
const phase = async (label, steer) => {
  await ev(()=>{
    const g=CARVE._game;
    g.rider.x=g.terrain.centerX(g.rider.z); g.rider.yaw=0;
    g.combat.stats.enemyShots=0; g.combat.stats.enemyHits=0;
    if(!window.__pin){ window.__pin=setInterval(()=>{const f=g.roster.fighters[0];if(f)f.hp=f.maxHp;},100); }
  });
  await sleep(500);
  const start=await ev(()=>CARVE._game.rider.p);
  let sawLaser=false, maxGap=0, s=null;
  const until=Date.now()+100000;
  while(true){
    s=await ev((st)=>{
      const g=CARVE._game, f=g.roster.fighters[0];
      CARVE.lean(st==='carve'?Math.sin((g.time||0)*0.9)*0.9:0, 0);
      const L=g.combat.lasers; let gap=0,n=0;
      if(L.visible){
        const arr=L.geometry.attributes.position.array;
        for(let i=0;i<g.combat.laserCap;i++){const o=i*6;
          if(arr[o]===0&&arr[o+3]===0)continue; n++;
          gap=Math.max(gap,Math.hypot(arr[o+3]-f.x,arr[o+5]-f.z));}
      }
      return {p:g.rider.p,state:g.state,lasers:n,gap,
        shots:g.combat.stats.enemyShots,hits:g.combat.stats.enemyHits};
    }, steer);
    if(s.lasers>0){sawLaser=true;maxGap=Math.max(maxGap,s.gap);}
    if(s.state!=='play')break;
    if(s.p-start>=900)break;
    if(Date.now()>until)break;
    await sleep(60);
  }
  await ev(()=>CARVE.lean(0,0));
  const acc=s.shots?Math.round(s.hits/s.shots*100):0;
  console.log(`  ${label.padEnd(18)} ${String(s.shots).padStart(3)} shots  ${String(s.hits).padStart(3)} hits  ${String(acc).padStart(3)}%   widest lead ${maxGap.toFixed(1)} m`);
  return {shots:s.shots,hits:s.hits,acc,sawLaser,maxGap};
};
console.log('');
const straight = await phase('straight-lining', 'straight');
const carving  = await phase('carving hard', 'carve');
console.log('');
await page.screenshot({path:path.join(SHOTS,'aiming.png')});

check('the aiming lasers are drawn', carving.sawLaser||straight.sawLaser);
check('they aim AHEAD of the rider, not at them',
  Math.max(carving.maxGap,straight.maxGap)>1.0,
  `${Math.max(carving.maxGap,straight.maxGap).toFixed(1)} m`);
check('both phases drew real fire (not a vacuous comparison)',
  straight.shots>8 && carving.shots>8, `${straight.shots} vs ${carving.shots}`);
// THE CLAIM. A margin, not a threshold: the absolute numbers move with every
// density change, the ORDERING is what the design asserts.
check('a straight-lining rider is hit more often than a carving one',
  straight.acc > carving.acc, `${straight.acc}% straight vs ${carving.acc}% carving`);
check('and by a margin worth playing for (10 points or more)',
  straight.acc - carving.acc >= 10, `${straight.acc - carving.acc} points`);
check('no page errors', errors.length===0, errors.slice(0,3).join(' | '));
}finally{await browser.close();server.close();}
console.log(`\n  ${pass+fail} checks run — ${pass} pass, ${fail} fail\n`);
process.exit(fail?1:0);
