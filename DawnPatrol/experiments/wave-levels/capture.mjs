// usage: node capture.mjs <page.html> <tag> [timesMs comma list]
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const [page, tag, timesArg] = process.argv.slice(2);
const times = (timesArg || '1500,4000,7000').split(',').map(Number);
const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const dport = 9300 + Math.floor(Math.random() * 500);
const udd = fs.mkdtempSync(path.join(dir, '.chrome-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--mute-audio', `--remote-debugging-port=${dport}`, `--user-data-dir=${udd}`,
  '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run', '--use-angle=metal', '--enable-gpu',
  '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' });
const cleanup = async () => { const ex = new Promise(r => chrome.once('exit', r)); try { chrome.kill('SIGKILL'); } catch {} await ex; server.close(); await new Promise(r => setTimeout(r, 300)); try { fs.rmSync(udd, { recursive: true, force: true, maxRetries: 5 }); } catch (e) { console.log('rm warn', e.code); } };
try {
  let ws;
  for (let i = 0; i < 50; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${dport}/json`)).json();
      const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') console.log('[console]', m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') console.log('[exception]', JSON.stringify(m.params.exceptionDetails).slice(0, 600)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const t0 = Date.now();
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/${page}` });
  for (let i = 0; i < times.length; i++) {
    const wait = times[i] - (Date.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const ev = (process.env.EVALS || '').split('|')[i]; if (ev) { await send('Runtime.evaluate', { expression: ev }); await new Promise(r => setTimeout(r, 600)); }
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const out = path.join(dir, 'shots', `${tag}-${i + 1}.png`);
    fs.writeFileSync(out, Buffer.from(s.result.data, 'base64')); console.log('shot', out);
  }
  const st = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__stats||null)', returnByValue: true });
  console.log('stats', st.result.result.value);
} finally { await cleanup(); }
