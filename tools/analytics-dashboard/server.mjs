// A local dashboard for the web games' analytics.
//
//     node tools/analytics-dashboard/server.mjs
//     -> http://localhost:7788
//
// WHY A SERVER AND NOT A STATIC PAGE. Firestore will not talk to a file:// page,
// and the credential that reads it lives on this machine rather than in the
// browser. This is the smallest thing that bridges the two: one endpoint that
// runs the query, one page that draws it. No dependencies, no build step.
//
// WHAT IT IS FOR. Watching a play session while it happens -- did the events
// arrive, from which game, with what in them. It is NOT a reporting tool: GA4 is
// that, once the APK lands. The two answer different questions and this one dies
// the day the other works.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchEvents } from './firestore.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 7788);

/**
 * Whose events to show.
 *
 * Defaults to the account used for Editor testing. Override with UID=... when
 * watching someone else. Named here rather than discovered, because "the most
 * recently active user" is a query that needs its own index and this is a dev
 * tool, not a product.
 */
const UID = process.env.UID || 'AOI0S0W3XBV6LQILCb7ylTPatTg1';

createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/events')) {
      const events = await fetchEvents(UID, 400);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ uid: UID, fetchedAt: new Date().toISOString(), events }));
      return;
    }
    if (req.url.startsWith('/charts.js')) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(readFileSync(join(HERE, 'charts.js')));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(readFileSync(join(HERE, 'index.html')));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}).listen(PORT, () => {
  console.log(`\n  analytics dashboard  ->  http://localhost:${PORT}`);
  console.log(`  reading events for   ->  ${UID}\n`);
});
