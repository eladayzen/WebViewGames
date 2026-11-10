import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const SHOTS=path.join(process.env.SHOTS ?? path.join(HERE,'shots'),'pipe');
fs.mkdirSync(SHOTS,{recursive:true});
const require=createRequire(import.meta.url);
const puppeteer=require('puppeteer-core');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=createServer(async(req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html';try{const b=await readFile(path.join(HERE,'dist',rel));res.writeHead(200,{'content-type':TYPES[path.extname(rel)]??'application/octet-stream'});res.end(b);}catch{res.writeHead(404).end('x');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--mute-audio','--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader']});
let pass=0,fail=0; const check=(n,ok,d='')=>{ok?(pass++,console.log(`PASS  ${n}${d?'  '+d:''}`)):(fail++,console.log(`FAIL  ${n}${d?'  '+d:''}`));};
const errors=[];
try{
const page=await browser.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
const ev=(f,...a)=>page.evaluate(f,...a);
await page.setViewport({width:1320,height:800});
await page.goto(`${base}/index.html?all=1`,{waitUntil:'load',timeout:60000});
await page.waitForFunction(()=>document.body.dataset.state==='title',{timeout:60000,polling:100});
await page.click('[data-act="start"][data-mode="tunnel"]');
await page.waitForSelector('[data-act="place"][data-place="drain"]',{timeout:20000});
await page.click('[data-act="place"][data-place="drain"]');
await page.waitForSelector('[data-act="stance-ok"]',{visible:true,timeout:20000});
await page.click('[data-act="stance-ok"]');
await page.waitForFunction(()=>window.CARVE?._game?.state==='play',{timeout:60000,polling:100});
await sleep(900);

const w=await ev(()=>{
  const g=CARVE._game;
  return {place:g._place?.id, cam:g.cameraRig.mode, combat:g.combat.enabled,
    medkits:g.medkits.enabled, boons:g.boons.enabled, obstacles:g.scatter.obstaclesPerBand,
    trees:g.scatter.treesPerBand};
});
check('the drain is loaded',w.place==='drain',w.place);
check('on the tunnel rig',w.cam==='tunnel',w.cam);
check('nothing is shooting',w.combat===false);
check('no health pickups',w.medkits===false&&w.boons===false);
check('rubble is planted on the line',w.obstacles>0,`${w.obstacles}/band`);
check('and no trees underground',w.trees===0);

// The pipe is actually a pipe: sample the cross-section.
// `crossSection`, NOT `height`. height() also carries baseHeight, the relief
// and the KICKER RAMPS, and the first version of this check sampled a p that
// happened to have a kicker on it -- reporting 3.87 m of rise where the shape
// says 1.02 and calling a flat floor lumpy. The shape is what is being tested.
const prof=await ev(()=>{
  const t=CARVE._game.terrain;
  const p=CARVE._game.rider.p;
  return [0,8,16,24,30,32].map((u)=>({u,h:+t.crossSection(u,p).toFixed(2)}));
});
console.log('  cross-section (u -> rise):', prof.map(o=>`${o.u}m:${o.h}`).join('  '));
const rim=prof[prof.length-1].h, mid=prof[1].h;
// A parabola is BOWL*t^2 = 9*0.0625 = 0.56 m here; a circle of radius HALF is
// 1.02. The pipe is DEEPER in the middle third and far steeper at the rim --
// that pair is what makes it a tube rather than a dish.
check('the floor curve is the circle, not the parabola',
  mid > 0.9 && mid < 1.2, `${mid} m at u=8`);
check('and the wall is far steeper at the rim', rim > 18, `${rim} m at u=32`);

// The signature: roll follows the rider around the tube.
const roll0=await ev(()=>CARVE._game.cameraRig.roll);
await ev(()=>{ CARVE._game.rider.x = CARVE._game.terrain.xAt(20, CARVE._game.rider.z); });
await sleep(500);
const roll1=await ev(()=>({roll:CARVE._game.cameraRig.roll,u:CARVE._game.rider.u}));
console.log(`  roll at u=0 ${roll0.toFixed(3)} rad -> at u=${roll1.u.toFixed(1)} ${roll1.roll.toFixed(3)} rad (${(roll1.roll*180/Math.PI).toFixed(0)}deg)`);
check('climbing the wall rolls the tunnel',Math.abs(roll1.roll)>0.25,`${(roll1.roll*180/Math.PI).toFixed(0)} deg`);
await page.screenshot({path:path.join(SHOTS,'pipe-wall.png')});
await ev(()=>{ CARVE._game.rider.x = CARVE._game.terrain.xAt(0, CARVE._game.rider.z); });
await sleep(600);
await page.screenshot({path:path.join(SHOTS,'pipe-floor.png')});

// Ride it.
const start=await ev(()=>CARVE._game.rider.p);
const until=Date.now()+60000; let crashes=0;
while(true){
  const s=await ev(()=>({p:CARVE._game.rider.p,state:CARVE._game.state,c:CARVE._game.stats.crashes}));
  crashes=s.c;
  if(s.state!=='play')break;
  if(s.p-start>=700)break;
  if(Date.now()>until)break;
  await sleep(60);
}
const m=Math.round((await ev(()=>CARVE._game.rider.p))-start);
console.log(`  ${m} m ridden, ${crashes} crashes into rubble`);
// A PASSIVE RIDER IS SUPPOSED TO CRASH. This mode's whole content is dodging,
// so a straight line down the middle hitting nothing would mean the rubble is
// decoration. The first cut of this check asserted the opposite -- that the
// ride reached 700 m -- which is the check a mode with no obstacles passes.
check('the rubble is actually in the way',crashes>0,`${crashes} crashes in ${m} m`);
check('and it is dense enough to be the game, not scenery',
  crashes/Math.max(1,m)*1000 >= 4, `${(crashes/Math.max(1,m)*1000).toFixed(1)} per km`);
check('no page errors',errors.length===0,errors.slice(0,3).join(' | '));
}finally{await browser.close();server.close();}
console.log(`\n  ${pass+fail} checks run — ${pass} pass, ${fail} fail\n`);
process.exit(fail?1:0);
