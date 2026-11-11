import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.ttf':'font/ttf','.png':'image/png'};
const server=createServer(async(req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html';try{const b=await readFile(path.join(here,'dist',rel));res.writeHead(200,{'content-type':TYPES[path.extname(rel)]??'application/octet-stream'});res.end(b);}catch{res.writeHead(404).end('x');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--mute-audio','--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage();
const errs=[]; page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text());});
await page.setViewport({width:1320,height:800});
await page.goto(`${base}/index.html`,{waitUntil:'load',timeout:60000});
await page.waitForFunction(()=>document.body.dataset.state==='title',{timeout:45000,polling:100});
await page.click('[data-act="start"][data-mode="shoulder"]');
await page.waitForSelector('[data-act="place"][data-place="needles"]',{timeout:20000});
await page.click('[data-act="place"][data-place="needles"]');
await page.waitForSelector('[data-act="stance-ok"]',{visible:true,timeout:20000});
await page.click('[data-act="stance-ok"]');
await page.waitForFunction(()=>window.CARVE?._game?.state==='play',{timeout:45000,polling:100});
await page.evaluate(()=>{const f=CARVE._game.roster.fighters[0];setInterval(()=>{f.hp=f.maxHp;},100);});
for(let i=0;i<70;i++){ await page.evaluate(()=>CARVE.lean(0,0)); await sleep(60); }
await page.screenshot({path:'shots/site.png'});
const st=await page.evaluate(()=>{const g=CARVE._game,m=g.mood;
  const hex=c=>'#'+c.getHexString();
  const mm=g.mountain?.material?.uniforms;
  return {override:!!m.override, snow:hex(m.uSnowColor), fog:hex(m.uFogColor),
    mountainSnow: mm?.uSnowColor? hex(mm.uSnowColor.value):'(none)',
    mountainRock: mm?.uRockColor? hex(mm.uRockColor.value):'(none)',
    mountainStyle: g.mountain?.style ?? '?',
    bound: m._bound.length,
    sparkle:m.uSparkle, exposure:+m.exposure.toFixed(2), bloom:+m.bloom.toFixed(2),
    label:m.label};});
console.log(JSON.stringify({...st,errs:errs.slice(0,3)},null,1));
}finally{await browser.close(); server.close();}
