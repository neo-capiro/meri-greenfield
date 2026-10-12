"""Offline author packet integrity and original-source preservation checks."""
import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
BASE = '5b1b5985bc73cbfe901c17e65acf9fd50b3d7e33'
SOURCE = '8c4ec8dc2a9caad8640eb9f4741f5de2d7696887'
SOURCE_PATHS = {
    'apps/gateway/dispatch/mail-read-context.mjs',
    'apps/gateway/dispatch/operation-context.mjs',
    'apps/gateway/dispatch/tool-dispatch.mjs',
    'apps/gateway/test/mail-context.test.mjs',
}
checks = []


def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, timeout=10)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


manifest = json.loads((HERE / 'manifest.json').read_bytes())
check('manifest pins exact base and source', manifest['baseCommit'] == BASE and manifest['sourceCommit'] == SOURCE)
for entry in manifest['entries']:
    path = ROOT / entry['path']
    check('manifest local path: ' + entry['path'], path.resolve().is_relative_to(ROOT))
    raw = path.read_bytes()
    check('manifest bytes: ' + entry['path'], len(raw) == entry['bytes'] and sha(raw) == entry['sha256'])

changed = set(git('diff', '--name-only', BASE, SOURCE).decode().splitlines())
check('exact four allocated source paths', changed == SOURCE_PATHS)
check('base is source ancestor', subprocess.run(['git', 'merge-base', '--is-ancestor', BASE, SOURCE], cwd=ROOT, timeout=10).returncode == 0)
check('source tree pinned', git('rev-parse', SOURCE + '^{tree}').decode().strip() == '24115292d908255c5f794fe216040158c0fdd955')
for path in SOURCE_PATHS:
    check('working source equals freeze: ' + path, (ROOT / path).read_bytes() == git('show', SOURCE + ':' + path))
for path in ['operation-context.mjs', 'tool-dispatch.mjs']:
    check('original preserved: ' + path, (HERE / 'baseline' / path).read_bytes() == git('show', BASE + ':apps/gateway/dispatch/' + path))

# Git object identities preserve every pre-existing assertion, public/private
# contract, catalog, lock and unrelated source byte, except the two allocated
# existing composition modules.
def tree(commit):
    result = {}
    for row in git('ls-tree', '-r', '-z', commit).split(b'\0'):
        if row:
            metadata, path = row.split(b'\t', 1)
            result[path.decode()] = metadata.decode()
    return result

old, current = tree(BASE), tree(SOURCE)
allowed_existing = {p for p in SOURCE_PATHS if p in old}
unchanged = sum(current.get(p) == identity for p, identity in old.items())
check('all originals except two allocated modules unchanged', unchanged == len(old) - 2 and all(
    current.get(p) == identity for p, identity in old.items() if p not in allowed_existing))
check('no original test changed', all(current.get(p) == identity for p, identity in old.items() if '/test/' in p or p.endswith('.test.mjs')))

for label, passed, failed, exit_code in [
    ('gateway-source', 281, 1, 1), ('root-source', 244, 0, 0), ('public-distribution', 7, 0, 0),
]:
    receipt = json.loads((HERE / (label + '.json')).read_bytes())
    text = (HERE / (label + '.stdout.bin')).read_text()
    check(label + ' frozen source', receipt['sourceHead'] == SOURCE and receipt['sourceDiffBytes'] == 0)
    check(label + ' counts', f'ℹ pass {passed}\n' in text and f'ℹ fail {failed}\n' in text)
    check(label + ' exited and group absent', receipt['exitCode'] == exit_code and receipt['ownedProcessGroupAbsent'] is True and receipt['timedOut'] is False)
    for stream in receipt['streams']:
        raw = (ROOT / stream['path']).read_bytes()
        check(label + ' stream ' + stream['path'], len(raw) == stream['bytes'] and sha(raw) == stream['sha256'])
for label, exit_code in [('baseline-connected', 1), ('connected-after', 0), ('focused-first', 0)]:
    receipt = json.loads((HERE / (label + '.json')).read_bytes())
    check(label + ' direct child reaped only', receipt['exitCode'] == exit_code and receipt['reaped'] is True and receipt['timedOut'] is False)
    for name, stream in receipt['streams'].items():
        raw = (HERE / (label + '.' + name)).read_bytes()
        check(label + ' ' + name, len(raw) == stream['bytes'] and sha(raw) == stream['sha256'])
check('accepted subreaper copied unchanged', (HERE / 'capture-reaped.py').read_bytes() == (ROOT / 'docs/qualification/candidates/native-helper-integration-20261012/integration/capture-reaped.py').read_bytes())
result = {'scope': 'OFFLINE_SOURCE_AND_PACKET_ONLY', 'baseCommit': BASE, 'sourceCommit': SOURCE,
          'originalPaths': len(old), 'unchangedOriginalPaths': unchanged, 'checks': checks,
          'passed': sum(item['passed'] for item in checks), 'failed': sum(not item['passed'] for item in checks)}
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['failed'] == 0 else 1)
