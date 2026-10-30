#!/usr/bin/env python3
"""Fetch only the pinned upstream inputs into a new build directory. No compilation."""
import base64
import hashlib
import json
from pathlib import Path
import os
import platform
import shutil
import subprocess
import urllib.parse
import urllib.request

RECIPE = Path('/recipe')
BUILD = Path('/build')
SOURCE = BUILD / 'online'
EVIDENCE = BUILD / 'evidence'


def checked_bytes(payload, expected):
    if hashlib.sha256(payload).hexdigest() != expected:
        raise RuntimeError('Pinned input checksum mismatch')
    return payload


def download(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def git(*args, capture=False):
    result = subprocess.run(['git', '-C', str(SOURCE), *args], check=True,
                            text=True, capture_output=capture)
    return result.stdout.strip() if capture else None


def main():
    # Fail before fetching the large monorepo. Release also checks the host before
    # Docker starts, since an emulated container can report the target architecture.
    if platform.machine() != 'aarch64' or (os.cpu_count() or 0) < 24:
        raise RuntimeError('Requires a native ARM64 builder with at least 24 CPUs')
    if shutil.disk_usage(BUILD).free < 160 * 1024**3:
        raise RuntimeError('Requires at least 160 GiB free on the actual Docker build filesystem')
    available = int(next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines()
                         if line.startswith('MemAvailable:'))) * 1024
    maximum = Path('/sys/fs/cgroup/memory.max')
    current = Path('/sys/fs/cgroup/memory.current')
    if maximum.exists() and current.exists() and maximum.read_text().strip() != 'max':
        available = min(available, int(maximum.read_text()) - int(current.read_text()))
    if available < 50 * 1024**3:
        raise RuntimeError('Requires at least 50 GiB available RAM including any cgroup ceiling')
    pins = json.loads((RECIPE / 'source/inputs.json').read_text())
    source, fix = pins['source'], pins['fix']
    if SOURCE.exists():
        raise RuntimeError('Source directory must be new; existing work is never reset')
    SOURCE.mkdir(parents=True)
    EVIDENCE.mkdir(exist_ok=True)
    git('init', '--quiet')
    git('remote', 'add', 'origin', source['repository'])
    git('fetch', '--depth=1', 'origin', 'refs/tags/' + source['tag'])
    git('checkout', '--detach', 'FETCH_HEAD')
    if git('rev-parse', 'HEAD', capture=True) != source['commit']:
        raise RuntimeError('Stable source commit mismatch')
    for path, digest in [('engine/download.lst', source['engineDownloadsSha256']),
                         ('browser/npm-shrinkwrap.json.in', source['npmShrinkwrapSha256'])]:
        checked_bytes((SOURCE / path).read_bytes(), digest)
        shutil.copyfile(SOURCE / path, EVIDENCE / Path(path).name)
    checked_bytes((RECIPE / 'meri-font-preservation.xcd').read_bytes(), pins['fontOverlaySha256'])
    patch_url = f"https://gerrit.collaboraoffice.com/changes/{fix['change']}/revisions/{fix['commit']}/patch"
    patch = checked_bytes(base64.b64decode(b''.join(download(patch_url).split()), validate=True), fix['patchSha256'])
    patch_path = EVIDENCE / 'upstream-13516.patch'
    patch_path.write_bytes(patch)
    fixtures = []
    for fixture in fix['fixtures']:
        name = fixture['path']
        url = (f"https://gerrit.collaboraoffice.com/projects/online/commits/{fix['commit']}/files/"
               + urllib.parse.quote(name, safe='') + '/content')
        payload = checked_bytes(base64.b64decode(b''.join(download(url).split()), validate=True), fixture['sha256'])
        if (SOURCE / name).exists():
            raise RuntimeError('Upstream fixture already exists on selected base')
        fixtures.append((name, payload))
    # Gerrit's email patch does not carry full Git binary indices. Verify/apply all
    # text hunks, and materialize only the two exact upstream binary fixtures above.
    exclusions = ['--exclude=' + fixture['path'] for fixture in fix['fixtures']]
    git('apply', '--check', *exclusions, str(patch_path))
    git('apply', *exclusions, str(patch_path))
    for name, payload in fixtures:
        (SOURCE / name).write_bytes(payload)
    git('diff', '--check')
    startup = pins['startup']
    startup_url = f"https://raw.githubusercontent.com/{startup['repository']}/{startup['commit']}/{startup['path']}"
    (BUILD / 'start-collabora-online.sh').write_bytes(checked_bytes(download(startup_url), startup['sha256']))
    shutil.copyfile(RECIPE / 'source/inputs.json', EVIDENCE / 'inputs.json')
    (EVIDENCE / 'source-date-epoch.txt').write_text(git('show', '-s', '--format=%ct', 'HEAD', capture=True) + '\n')
    (EVIDENCE / 'source-status.txt').write_text(git('status', '--short', capture=True) + '\n')
    (EVIDENCE / 'source-diff-stat.txt').write_text(git('diff', '--stat', capture=True) + '\n')
    print('Pinned stable source, chart patch, fixtures, dependency locks and font overlay verified.')


if __name__ == '__main__':
    main()
