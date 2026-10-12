"""Offline packet/source identity verification; no source runtime or private imports."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[5]
EVIDENCE = Path(__file__).resolve().parent
checks = []
def check(name, ok): checks.append({'check': name, 'pass': bool(ok)})
def sha(data): return hashlib.sha256(data).hexdigest()
def load(name): return json.loads((EVIDENCE / name).read_text())
def git(*args): return subprocess.check_output(['git', *args], cwd=ROOT)
def tree(commit):
    return {row.split('\t', 1)[1]: row.split()[2] for row in git('ls-tree', '-r', commit).decode().splitlines()}

manifest = load('manifest.json')
for member in manifest['files']:
    data = (ROOT / member['path']).read_bytes()
    check('manifest:' + member['path'], len(data) == member['bytes'] and sha(data) == member['sha256'])
expected = {member['path'] for member in manifest['files']}
actual = {str(p.relative_to(ROOT)) for p in EVIDENCE.rglob('*') if p.is_file() and p.name not in {'manifest.json', 'verification.json'}}
actual.add(manifest['report'])
check('complete packet membership', actual == expected)
preservation = load('source-preservation.json')
base, source = preservation['base'], preservation['sourceFreeze']
before, after = tree(base), tree(source)
check('exact source tree', git('rev-parse', source + '^{tree}').decode().strip() == preservation['sourceTree'])
check('all6001 originals unchanged', len(before) == 6001 and all(after.get(p) == blob for p, blob in before.items()))
check('exact six allocated source paths', set(after) - set(before) == {x['path'] for x in preservation['added']} and len(preservation['added']) == 6)
for member in preservation['added']:
    data = git('show', source + ':' + member['path'])
    check('source:' + member['path'], data == (ROOT / member['path']).read_bytes() and len(data) == member['bytes'] and sha(data) == member['sha256'] and after[member['path']] == member['blob'])
patch = (EVIDENCE / 'focused-initial-source.patch').read_bytes()
check('focused capture bound to exact source', patch == git('diff', '--binary', base, source))
for label, count in [('focused-initial', 31), ('root-source-check', 1321), ('public-distribution', 7)]:
    capture = load(label + '.json')
    check('successful source capture:' + label, capture['exitCode'] == 0 and not capture['timedOut'] and capture['ownedProcessGroupAbsent'] and not capture['ownedGroupKillRequired'])
    check('capture helper:' + label, capture['captureSha256'] == sha((EVIDENCE / 'capture-reaped.py').read_bytes()) == preservation['captureHelperSha256'])
    check('source receipt identity:' + label, capture['sourceHead'] == (base if label == 'focused-initial' else source) and capture['sourceDiffSha256'] == sha(patch if label == 'focused-initial' else b''))
    for stream in capture['streams']:
        data = (ROOT / stream['path']).read_bytes()
        check('raw:' + stream['path'], len(data) == stream['bytes'] and sha(data) == stream['sha256'])
    text = (ROOT / capture['streams'][0]['path']).read_text()
    check('test count:' + label, f'ℹ tests {count}\n' in text and f'ℹ pass {count}\n' in text and 'ℹ fail 0\n' in text)
refs = load('reference-identities.json')
check('six metadata-only references', len(refs['references']) == 6 and not refs['sourceExecuted'] and not refs['privateBodiesRetained'])
for member in refs['references']:
    check('reference no drift:' + member['path'], member['unchanged'] and member['frozen'] == member['observed'])
passed = sum(x['pass'] for x in checks)
result = {'sourceFreeze': source, 'scope': 'OFFLINE_PACKET_AND_SOURCE_ONLY', 'checks': len(checks), 'passed': passed, 'failed': len(checks) - passed, 'results': checks}
(EVIDENCE / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'results'}))
raise SystemExit(0 if passed == len(checks) else 1)
