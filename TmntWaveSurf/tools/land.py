#!/usr/bin/env python3
"""Land a built TmntWaveSurf dist into gobalance StreamingAssets (files only, never git).

usage (from TmntWaveSurf/, after npm run build): python3 tools/land.py [dist_dir] [--dry]

- replaces Assets/StreamingAssets/TmntWaveSurf/ contents with dist (old files + their .meta removed)
- writes manifest.txt: index.html first, then every other file individually (no folder entries,
  not itself, no .meta), sorted
- writes a .meta beside every file and every sub-folder, plus TmntWaveSurf.meta for the folder;
  existing .meta files are kept byte for byte for paths that are unchanged, new ones get random GUIDs
- verifies: manifest == files on disk (both directions), every file has a .meta, no orphan .meta,
  GUIDs unique across the whole Assets tree
The gobalance repo is never committed from here: the lead session commits.
"""
import os, sys, shutil, uuid, re

ROOT = os.path.expanduser('~/UnityProjects/gobalance/Assets')
DEST = os.path.join(ROOT, 'StreamingAssets', 'TmntWaveSurf')
FILE_META = ("fileFormatVersion: 2\nguid: {g}\nDefaultImporter:\n  externalObjects: {{}}\n"
             "  userData: \n  assetBundleName: \n  assetBundleVariant: \n")
DIR_META = ("fileFormatVersion: 2\nguid: {g}\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {{}}\n"
            "  userData: \n  assetBundleName: \n  assetBundleVariant: \n")


def old_metas():
    g = {}
    if os.path.isdir(DEST):
        for dp, _, fs in os.walk(DEST):
            for f in fs:
                if f.endswith('.meta'):
                    p = os.path.join(dp, f)
                    g[os.path.relpath(p[:-5], DEST)] = open(p).read()
    return g


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dist = os.path.abspath(args[0] if args else os.path.join(os.path.dirname(__file__), '..', 'dist'))
    dry = '--dry' in sys.argv
    assert os.path.isfile(os.path.join(dist, 'index.html')), 'dist has no index.html'
    keep = old_metas()
    files = sorted(os.path.relpath(os.path.join(dp, f), dist) for dp, _, fs in os.walk(dist) for f in fs
                   if not f.endswith('.meta') and not f.startswith('.'))
    dirs = sorted({os.path.dirname(f) for f in files if os.path.dirname(f)})
    manifest = ['index.html'] + [f for f in files if f not in ('index.html', 'manifest.txt')]
    print(f'{len(files)} files, {len(dirs)} sub-folders -> {DEST}')
    if dry:
        print('\n'.join(manifest)); return
    if os.path.isdir(DEST): shutil.rmtree(DEST)          # only our own game folder
    os.makedirs(DEST)
    for f in files:
        os.makedirs(os.path.dirname(os.path.join(DEST, f)) or DEST, exist_ok=True)
        shutil.copy2(os.path.join(dist, f), os.path.join(DEST, f))
    open(os.path.join(DEST, 'manifest.txt'), 'w').write('\n'.join(manifest) + '\n')

    def meta(rel, isdir):
        out = keep.get(rel) or (DIR_META if isdir else FILE_META).format(g=uuid.uuid4().hex)
        open(os.path.join(DEST, rel) + '.meta', 'w').write(out)
    for f in files + ['manifest.txt']: meta(f, False)
    for d in dirs: meta(d, True)
    top = DEST + '.meta'
    if not os.path.exists(top): open(top, 'w').write(DIR_META.format(g=uuid.uuid4().hex))
    verify()


def verify():
    on_disk = sorted(os.path.relpath(os.path.join(dp, f), DEST) for dp, _, fs in os.walk(DEST) for f in fs
                     if not f.endswith('.meta') and f != 'manifest.txt')
    m = [l for l in open(os.path.join(DEST, 'manifest.txt')).read().split('\n') if l]
    assert m[0] == 'index.html', 'manifest does not start with index.html'
    assert sorted(m) == on_disk, f'manifest/disk mismatch: {set(m) ^ set(on_disk)}'
    assert all(not os.path.isdir(os.path.join(DEST, l)) for l in m), 'folder entry in manifest'
    for dp, ds, fs in os.walk(DEST):
        for f in fs:
            p = os.path.join(dp, f)
            if f.endswith('.meta'): assert os.path.exists(p[:-5]), f'orphan meta {p}'
            else: assert os.path.exists(p + '.meta'), f'missing meta {p}'
        for d in ds: assert os.path.exists(os.path.join(dp, d) + '.meta'), f'missing folder meta {d}'
    assert os.path.exists(DEST + '.meta'), 'missing TmntWaveSurf.meta'
    seen = {}
    for dp, _, fs in os.walk(ROOT):
        for f in fs:
            if f.endswith('.meta'):
                mm = re.search(r'guid: ([0-9a-f]{32})', open(os.path.join(dp, f), errors='ignore').read())
                if mm:
                    assert mm.group(1) not in seen, f'GUID clash {mm.group(1)}: {seen[mm.group(1)]} vs {os.path.join(dp, f)}'
                    seen[mm.group(1)] = os.path.join(dp, f)
    print(f'OK: manifest {len(m)} entries == {len(on_disk)} files; every file/folder has a .meta; '
          f'no orphans; {len(seen)} GUIDs unique across Assets')


if __name__ == '__main__':
    main()
