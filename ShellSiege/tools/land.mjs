// LAND THE BUILD IN UNITY: dist/ -> gobalance/Assets/StreamingAssets/TurtlesActionGame/, WITH its .meta files.
//
// Why this exists: the old drop was `rsync -a --delete --exclude='*.meta'`, which leaves every new file bare
// (Unity makes a GUID on its next import, and a commit made before that churns GUIDs on every machine) and
// leaves the metas of deleted files behind as orphans. Same approach as Rooftop Run's land.py:
//
//   - the destination content is replaced by dist (manifest.txt written first, listing content only);
//   - every file, every sub-folder and the game's own folder get a .meta;
//   - a .meta that already exists for an unchanged path is kept BYTE FOR BYTE (the GUID is stable);
//   - new GUIDs are random and checked unique against every .meta under the Unity project's Assets/;
//   - orphan .meta files are removed;
//   - the result is verified both ways, and the script exits non-zero if anything is off.
//
// It never runs git, and never touches anything outside the destination folder.
//
//   node tools/land.mjs                      build is NOT run; run `npm run build` first (or pass --build)
//   node tools/land.mjs --build              npm run build, then land
//   node tools/land.mjs --dest <dir>         land somewhere else (tests / a copy). Folder name must still be
//                                            TurtlesActionGame: it is the permanent SAVE KEY, never rename it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const game = path.resolve(here, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const DEST = path.resolve(arg('--dest') || path.join(process.env.HOME, 'UnityProjects/gobalance/Assets/StreamingAssets/TurtlesActionGame'));
const DIST = path.join(game, 'dist');

if (path.basename(DEST) !== 'TurtlesActionGame') throw new Error(`the folder name is the save key and must stay TurtlesActionGame, got ${path.basename(DEST)}`);
if (process.argv.includes('--build')) execFileSync('npm', ['run', 'build'], { cwd: game, stdio: 'inherit' });
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('no dist/: run `npm run build` first');
execFileSync('node', [path.join(here, 'manifest.mjs'), DIST], { stdio: 'inherit' });

const FILE_META = (g) => `fileFormatVersion: 2\nguid: ${g}\nDefaultImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`;
const DIR_META = (g) => `fileFormatVersion: 2\nguid: ${g}\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`;

const walk = (dir, base = '') => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) { out.push({ rel, dir: true }); out.push(...walk(path.join(dir, e.name), rel)); }
    else if (!e.name.endsWith('.meta')) out.push({ rel, dir: false });
  }
  return out;
};

// 1. remember every existing .meta (by the path it belongs to), and the folder's own
const keep = new Map();
if (fs.existsSync(DEST)) {
  const all = (dir, base = '') => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const rel = base ? `${base}/${e.name}` : e.name; if (e.isDirectory()) all(path.join(dir, e.name), rel); else if (e.name.endsWith('.meta')) keep.set(rel.slice(0, -5), fs.readFileSync(path.join(dir, e.name), 'utf8')); } };
  all(DEST);
}
const topMeta = fs.existsSync(DEST + '.meta') ? fs.readFileSync(DEST + '.meta', 'utf8') : null;

// 2. every GUID already used under the Unity project's Assets/ (so a new one cannot collide)
let assetsRoot = DEST;
for (let d = DEST; d !== path.dirname(d); d = path.dirname(d)) if (path.basename(d) === 'Assets') { assetsRoot = d; break; }
const used = new Set();
const scan = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') scan(p); } else if (e.name.endsWith('.meta')) { const m = /guid: ([0-9a-f]{32})/.exec(fs.readFileSync(p, 'utf8')); if (m) used.add(m[1]); } } };
scan(assetsRoot);
const fresh = () => { for (;;) { const g = crypto.randomBytes(16).toString('hex'); if (!used.has(g)) { used.add(g); return g; } } };

// 3. replace the content with dist
fs.mkdirSync(DEST, { recursive: true });
for (const e of fs.readdirSync(DEST)) fs.rmSync(path.join(DEST, e), { recursive: true, force: true });     // content AND old metas; the kept ones are rewritten below
fs.cpSync(DIST, DEST, { recursive: true });

// 4. a .meta for every file, every sub-folder, and the game's own folder
const items = walk(DEST);
let made = 0, kept = 0;
for (const { rel, dir } of items) {
  const old = keep.get(rel);
  fs.writeFileSync(path.join(DEST, rel) + '.meta', old ?? (dir ? DIR_META(fresh()) : FILE_META(fresh())));
  old ? kept++ : made++;
}
fs.writeFileSync(DEST + '.meta', topMeta ?? DIR_META(fresh()));

// 5. verify, both ways
const files = items.filter((i) => !i.dir).map((i) => i.rel).filter((r) => r !== 'manifest.txt').sort();
const manifest = fs.readFileSync(path.join(DEST, 'manifest.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).sort();
const problems = [];
if (JSON.stringify(files) !== JSON.stringify(manifest)) problems.push('manifest.txt does not match the files on disk');
if (manifest.includes('manifest.txt') || manifest.some((m) => m.endsWith('.meta'))) problems.push('manifest lists itself or a .meta');
const chk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.name.endsWith('.meta')) { if (!fs.existsSync(p.slice(0, -5))) problems.push(`orphan ${p}`); } else { if (!fs.existsSync(p + '.meta')) problems.push(`missing meta ${p}`); if (e.isDirectory()) chk(p); } } };
chk(DEST);
if (!fs.existsSync(DEST + '.meta')) problems.push('missing folder meta');
const seen = new Map();
const guids = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) guids(p); else if (e.name.endsWith('.meta')) { const g = /guid: ([0-9a-f]{32})/.exec(fs.readFileSync(p, 'utf8'))?.[1]; if (!g) problems.push(`no guid in ${p}`); else if (seen.has(g)) problems.push(`duplicate guid in ${p}`); else seen.set(g, p); } } };
guids(DEST);

if (problems.length) { console.error('LAND FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`landed ${files.length} files in ${DEST}: ${kept} metas kept, ${made} new; manifest == disk; no orphans, none missing, GUIDs unique.`);
