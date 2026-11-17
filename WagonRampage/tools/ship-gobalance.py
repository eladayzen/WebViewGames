"""Land a verified build into the gobalance Unity project's StreamingAssets (never commits).

  python3 tools/ship-gobalance.py <clean dist> <gobalance>/Assets/StreamingAssets/WagonRampage

Build <clean dist> from a CLEAN export of origin/all-games and byte-diff it first (root
CLAUDE.md). This script then:
  - copies every file in, and deletes files (and their .meta) the new build no longer has;
  - writes manifest.txt: index.html first, then every other content file sorted, no .meta,
    not itself (WebGameController reads it on Android and gives up without it);
  - writes a Unity .meta next to every file and folder (incl. the game folder itself) in the
    exact StreamingAssets format, trailing spaces included. An existing .meta keeps its guid,
    so a re-ship doesn't churn GUIDs;
  - checks .meta pairing in BOTH directions and prints the counts.
"""
import os, sys, shutil, uuid

src, dst = sys.argv[1].rstrip('/'), sys.argv[2].rstrip('/')
FILE_META = 'fileFormatVersion: 2\nguid: {g}\nDefaultImporter:\n  externalObjects: {{}}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n'
DIR_META = 'fileFormatVersion: 2\nguid: {g}\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {{}}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n'

def rel_files(root):
    out = []
    for d, _, fs in os.walk(root):
        for f in fs:
            if f.endswith('.meta') or f == '.DS_Store': continue
            out.append(os.path.relpath(os.path.join(d, f), root))
    return out

new = set(rel_files(src))
os.makedirs(dst, exist_ok=True)
# sweep files the new build doesn't have (manifest.txt is ours, kept)
removed = 0
for r in rel_files(dst):
    if r not in new and r != 'manifest.txt':
        os.remove(os.path.join(dst, r)); removed += 1
        if os.path.exists(os.path.join(dst, r) + '.meta'): os.remove(os.path.join(dst, r) + '.meta')
for r in sorted(new):
    os.makedirs(os.path.dirname(os.path.join(dst, r)) or dst, exist_ok=True)
    shutil.copyfile(os.path.join(src, r), os.path.join(dst, r))
# empty folders left by the sweep
for d, ds, fs in sorted(os.walk(dst), key=lambda t: -len(t[0])):
    if d != dst and not [f for f in os.listdir(d) if not f.endswith('.meta')]:
        shutil.rmtree(d)
        if os.path.exists(d + '.meta'): os.remove(d + '.meta')

files = sorted(new - {'index.html'})
with open(os.path.join(dst, 'manifest.txt'), 'w') as f:
    f.write('\n'.join(['index.html'] + files) + '\n')

def meta(path, tmpl):
    m = path + '.meta'
    if os.path.exists(m): return 0
    with open(m, 'w') as f: f.write(tmpl.format(g=uuid.uuid4().hex))
    return 1
made = meta(dst, DIR_META)
for d, ds, fs in os.walk(dst):
    for x in ds: made += meta(os.path.join(d, x), DIR_META)
    for x in fs:
        if not x.endswith('.meta') and x != '.DS_Store': made += meta(os.path.join(d, x), FILE_META)

# pairing, both directions
bare, orphan = [], []
for d, ds, fs in os.walk(dst):
    names = set(fs) | set(ds)
    for x in names:
        p = os.path.join(d, x)
        if x.endswith('.meta'):
            if x[:-5] not in names: orphan.append(p)
        elif x != '.DS_Store' and x + '.meta' not in names: bare.append(p)
if not os.path.exists(dst + '.meta'): bare.append(dst)
print(f'copied {len(new)} files, removed {removed} stale, wrote {made} new .meta')
print(f'manifest.txt: {len(files) + 1} entries')
print(f'bare (no .meta): {len(bare)}  orphan .meta: {len(orphan)}')
for p in bare + orphan: print('  ', p)
