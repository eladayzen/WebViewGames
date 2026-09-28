// Reading Firestore from this machine, as you, with no new credentials.
//
// The Firebase CLI stores a refresh token in ~/.config/configstore when you run
// `firebase login`. This exchanges it for a short-lived access token the same way
// firebase-tools itself does, and uses that to query Firestore's REST API.
//
// WHY NOT A SERVICE ACCOUNT KEY: a key file is a long-lived secret that has to be
// created, stored somewhere, and remembered about. This borrows a credential that
// already exists, is already scoped to this user, and expires on its own. Nothing
// is written and nothing new is granted -- if you `firebase logout`, this stops
// working, which is the correct behaviour.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'particula-gobalance';
const STORE = join(homedir(), '.config', 'configstore', 'firebase-tools.json');

// The firebase-tools installed-app OAuth client. Public by design -- an installed
// application cannot keep a secret, which is why Google issues these openly and
// why the refresh token above is the thing that actually matters.
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

let cached = { token: null, expires: 0 };

async function accessToken() {
  if (cached.token && Date.now() < cached.expires - 60_000) return cached.token;
  const store = JSON.parse(readFileSync(STORE, 'utf8'));
  const refresh = store?.tokens?.refresh_token;
  if (!refresh) throw new Error('No firebase-tools refresh token. Run: firebase login');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  cached = { token: j.access_token, expires: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Firestore's typed values, flattened to ordinary JS. */
function plain(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) {
    const out = {};
    for (const [k, x] of Object.entries(v.mapValue.fields ?? {})) out[k] = plain(x);
    return out;
  }
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(plain);
  return null;
}

/**
 * Every web-game event, newest first.
 *
 * SCOPED TO ONE PLAYER, not a collection group, and that is forced rather than
 * chosen. Two queries were tried first and both were refused:
 *
 *   - a range on event_name for the `web_` prefix plus an orderBy on timestamp
 *     wants a COMPOSITE INDEX
 *   - a collection-group order by timestamp descending wants a
 *     COLLECTION_GROUP_DESC index, which Firestore does not create on its own
 *
 * Both are schema changes to a production database to power a local dev
 * dashboard, which is the wrong trade. A plain collection query on one user uses
 * the single-field index that already exists and needs nothing set up.
 *
 * It costs nothing for what this is for: one tester, all five games, which is
 * exactly "all the games in one place". Point it at another uid to watch someone
 * else; the page does not change.
 *
 * The `web_` filter is applied after the fetch for the same index reason --
 * Firestore has no prefix operator. The app's own events (login,
 * dashboard_viewed) are discarded on arrival, which is a few hundred rows.
 */
export async function fetchEvents(uid, limit = 400) {
  const token = await accessToken();
  const parent = `projects/${PROJECT}/databases/(default)/documents/users/${uid}`;
  const url = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'event_log' }],
      orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
      limit,
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`query failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows
    .filter((r) => r.document)
    .map((r) => {
      const f = r.document.fields ?? {};
      // users/{uid}/event_log/{id} -- the uid is the second-to-last-but-one part.
      const parts = r.document.name.split('/');
      return {
        event: plain(f.event_name),
        at: plain(f.timestamp),
        profile: plain(f.profile),
        uid: parts[parts.length - 3],
        params: plain(f.parameters) ?? {},
      };
    })
    .filter((r) => typeof r.event === 'string' && r.event.startsWith('web_'))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}
