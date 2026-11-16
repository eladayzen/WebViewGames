// Headless check of the BUILT game (dist/), with no GoBalance present.
// usage: [PRELOAD=mock.js] [VW=.. VH=..] node tools/drive.mjs <steps.json> [query]   (from TmntWaveSurf/, after npm run build)
// steps: [{wait:ms} | {eval:"js"} | {shot:"name"} | {key:"Space", up?:bool} | {click:"#selector"} |
//         {press:[x,y], up?:bool} | {log:"js"}]  -- screenshots land in shots/<name>.png
// Chrome runs headless and MUTED, and is killed when the script ends.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const [stepsFile, query = ''] = process.argv.slice(2);
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const VW = +(process.env.VW || 1280), VH = +(process.env.VH || 720);
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp' };
const requests = [];
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); requests.push(u);
  const p = path.join(dist, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const dport = 9300 + Math.floor(Math.random() * 500);
const udd = fs.mkdtempSync(path.join(root, '.chrome-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--mute-audio', `--remote-debugging-port=${dport}`, `--user-data-dir=${udd}`,
  `--window-size=${VW},${VH}`, '--hide-scrollbars', '--no-first-run', '--use-angle=metal', '--enable-gpu',
  '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' });
const cleanup = async () => { const ex = new Promise(r => chrome.once('exit', r)); try { chrome.kill('SIGKILL'); } catch {} await ex; server.close(); await new Promise(r => setTimeout(r, 300)); try { fs.rmSync(udd, { recursive: true, force: true, maxRetries: 5 }); } catch {} };
try {
  let ws;
  for (let i = 0; i < 50 && !ws; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${dport}/json`)).json();
      const t = l.find(x => x.type === 'page'); if (t) ws = new WebSocket(t.webSocketDebuggerUrl); } catch {}
    if (!ws) await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') console.log('[console]', m.params.type, m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') console.log('[exception]', JSON.stringify(m.params.exceptionDetails).slice(0, 800)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.text; };
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
  // PRELOAD=<file.js>: runs before the page's own scripts (e.g. a GoBalance mock).
  if (process.env.PRELOAD) { await send('Page.enable'); await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(process.env.PRELOAD, 'utf8') }); }
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html${query}` });
  for (const s of steps) {
    if (s.wait) await new Promise(r => setTimeout(r, s.wait));
    if (s.eval) await evaluate(s.eval);
    if (s.log) console.log('[log]', s.log.slice(0, 60), '=>', JSON.stringify(await evaluate(s.log)));
    if (s.key) { const k = { Space: [' ', 32], Enter: ['Enter', 13], ArrowUp: ['ArrowUp', 38], KeyB: ['b', 66] }[s.key] || [s.key, 0];
      await send('Input.dispatchKeyEvent', { type: s.up ? 'keyUp' : 'keyDown', code: s.key, key: k[0], windowsVirtualKeyCode: k[1] }); }
    if (s.click) { const c = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(s.click)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
      for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: c[0], y: c[1], button: 'left', clickCount: 1 }); }
    if (s.press) await send('Input.dispatchMouseEvent', { type: s.up ? 'mouseReleased' : 'mousePressed', x: s.press[0], y: s.press[1], button: 'left', clickCount: 1 });
    if (s.shot) { const r = await send('Page.captureScreenshot', { format: 'png' });
      const out = path.join(root, 'shots', `${s.shot}.png`); fs.writeFileSync(out, Buffer.from(r.result.data, 'base64')); console.log('shot', out); }
  }
  const ext = [...new Set(requests)].filter(u => !u.startsWith('/assets/') && u !== '/index.html');
  console.log('requests', requests.length, 'non-asset:', JSON.stringify(ext));
} finally { await cleanup(); }
