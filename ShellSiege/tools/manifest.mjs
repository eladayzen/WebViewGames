// Write `dist/manifest.txt`: one relative path per line, exactly matching what
// is in dist/.
//
// WHAT IT IS FOR. Only Android reads it, to extract the game out of the
// compressed APK before serving it (`ExtractStreamingAssets` in
// WebGameController.cs). The Editor, iOS and the desktop standalones read
// StreamingAssets directly and ignore the file entirely -- which is exactly
// why a stale manifest survives a long time: it is invisible on whatever
// platform happens to be in front of you, and then the game will not launch
// on a phone.
//
// TWO RULES THAT ARE EASY TO GET WRONG, both of them learned the hard way in
// this repo:
//   - content files ONLY, never a `.meta`. Unity writes those on import and
//     they are not part of the game.
//   - it must not list ITSELF.
//
//   node tools/manifest.mjs [dist]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const out = path.join(root, 'manifest.txt');

function walk(dir, base = '') {
  const found = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) found.push(...walk(path.join(dir, e.name), rel));
    else if (!e.name.endsWith('.meta') && rel !== 'manifest.txt') found.push(rel);
  }
  return found;
}

const files = walk(root);
fs.writeFileSync(out, files.join('\n') + '\n');
const bytes = files.reduce((n, f) => n + fs.statSync(path.join(root, f)).size, 0);
console.log(files.map((f) => '  ' + f).join('\n'));
console.log(`-> ${out}  ${files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
