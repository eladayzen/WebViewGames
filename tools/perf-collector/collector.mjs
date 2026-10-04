// Collects perf samples from every device playing, into one place.
//
//     node tools/perf-collector/collector.mjs
//     -> listens on :5300, prints a live table
//
// WHY. A perf panel you can see on the glass is the right tool for one device.
// It stops working the moment there are two iPads and three games, because
// nobody can read six changing numbers aloud and nobody should try. The panel
// keeps drawing itself for the person holding the device; this also ships the
// same sample here, so the numbers can be compared side by side afterwards.
//
// DELIBERATELY SEPARATE from the three vite servers. One collector for all
// games means one place to look and no vite.config.js edits in three projects --
// and this file never ships, so it cannot affect a build.
//
// Every sample is appended to samples.ndjson as well as held in memory, because
// the interesting question is "what happened over five minutes of play" and
// that is a question you ask after the fact.

import { createServer } from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOG = join(HERE, 'samples.ndjson');
const PORT = 5300;

mkdirSync(HERE, { recursive: true });

/** Latest sample per device+game, for the live table. */
const latest = new Map();

function row(s) {
  const dev = String(s.device ?? '?').padEnd(14);
  const game = String(s.label ?? '?').padEnd(11);
  const mpx = `${Number(s.mpx ?? 0).toFixed(2)} Mpx`.padStart(9);
  const fps = `${Number(s.fps ?? 0).toFixed(1)} fps`.padStart(9);
  const worst = `worst ${Number(s.worst ?? 0).toFixed(0)}ms`.padStart(12);
  const extra = s.extra ? `  ${s.extra}` : '';
  return `${dev} ${game} ${mpx} ${fps} ${worst}${extra}`;
}

createServer((req, res) => {
  // The pages are served from a different port, so every request here is
  // cross-origin. Wide-open CORS is correct for a LAN dev tool and nothing else.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/s') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const s = JSON.parse(body);
        s.at = new Date().toISOString();
        // The reporting IP is the only reliable way to tell two identical iPads
        // apart -- a user agent will not, and neither will screen size.
        s.ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
        s.device = s.device || s.ip;
        latest.set(`${s.device}|${s.label}`, s);
        appendFileSync(LOG, JSON.stringify(s) + '\n');
        console.log(row(s));
      } catch { /* a malformed sample is not worth crashing the session over */ }
      res.writeHead(204); res.end();
    });
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    // A tap target per variant, because the alternative is typing a 45-character
    // URL into a tablet keyboard while standing on a balance board, and getting
    // one character wrong silently gives you the wrong measurement.
    //
    // The host is taken from the request, never hardcoded: whatever address the
    // iPad used to reach this page is an address that works from the iPad.
    const host = (req.headers.host || '').split(':')[0] || 'localhost';
    const GAMES = [
      ['Skateboard Extreme', 5200],
      ['Nova Vanguard', 5201],
      ['Rooftop Ninja', 5202],
      ['RoboRun', 5203],
    ];
    const VARIANTS = [
      ['baseline', ''],
      ['budget 2.0', '&budget=2.0'],
      ['budget 1.6', '&budget=1.6'],
      ['budget 1.2', '&budget=1.2'],
    ];
    const cards = GAMES.map(([name, port]) => `
      <section>
        <h2>${name}</h2>
        ${VARIANTS.map(([vl, q]) =>
          `<a href="http://${host}:${port}/?perf=1${q}">${vl}</a>`).join('')}
      </section>`).join('');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>perf test</title><style>
:root{color-scheme:dark}
body{margin:0;padding:20px;background:#141416;color:#e8e8e6;
     font:16px/1.4 -apple-system,system-ui,sans-serif}
h1{font-size:18px;margin:0 0 4px}
p{color:#9a9a95;font-size:13px;margin:0 0 20px}
h2{font-size:14px;margin:22px 0 8px;color:#c9c9c4;font-weight:600}
a{display:block;padding:14px 16px;margin:0 0 8px;background:#232326;
  color:#e8e8e6;text-decoration:none;border-radius:8px;font-size:15px}
a:active{background:#2e2e33}
</style></head><body>
<h1>perf test</h1>
<p>Tap a variant. The panel's 2nd line shows the pixel cost &mdash; that is how you
confirm which one you are running.</p>
${cards}
</body></html>`);
    return;
  }

  if (req.method === 'GET' && req.url === '/latest') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify([...latest.values()], null, 2));
    return;
  }

  res.writeHead(404); res.end();
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n  perf collector -> http://0.0.0.0:${PORT}   (log: ${LOG})\n`);
  console.log('  device         game          Mpx       fps        worst');
  console.log('  ' + '-'.repeat(62));
});
