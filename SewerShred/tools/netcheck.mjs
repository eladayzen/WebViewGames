// Load dist/ in muted headless Chrome and list every request that did not return 2xx/3xx,
// plus which font the title actually rendered with. --offline blocks every non-local request.
//   node tools/netcheck.mjs [--offline]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const offline = process.argv.includes('--offline');
const ROOT = path.resolve('dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--mute-audio'],
});
const page = await browser.newPage();
await page.setRequestInterception(true);
const bad = [], blocked = [], all = [];
page.on('request', (r) => {
  if (offline && !r.url().startsWith(origin) && !r.url().startsWith('data:')) { blocked.push(r.url()); return r.abort(); }
  r.continue();
});
page.on('response', (r) => { all.push(r.url()); if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', (r) => { if (!blocked.includes(r.url())) bad.push(`FAILED ${r.url()} ${r.failure()?.errorText}`); });
await page.goto(`${origin}/index.html`, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
const font = await page.evaluate(async () => {
  await document.fonts.ready;
  return { bangersLoaded: [...document.fonts].some((f) => f.family.replace(/['"]/g, '') === 'Bangers' && f.status === 'loaded'), titleFont: getComputedStyle(document.querySelector('.logo')).fontFamily, faces: [...document.fonts].map((f) => `${f.family} ${f.status}`) };
});
console.log(JSON.stringify({ offline, requests: all.length, bad, blockedExternal: blocked, font }, null, 1));
await browser.close(); server.close();
