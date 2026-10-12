"""Offline author packet/source verifier; never starts a source service."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[5]
EVIDENCE = Path(__file__).resolve().parent
CHECKS = []

def check(label, ok):
    CHECKS.append({'check': label, 'pass': bool(ok)})

def sha(value):
    return hashlib.sha256(value).hexdigest()

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def read(name):
    return json.loads((EVIDENCE / name).read_text())

def tree(commit):
    return {row.split('\t', 1)[1]: row.split()[2]
            for row in git('ls-tree', '-r', commit).decode().splitlines()}

manifest = read('manifest.json')
for entry in manifest['files']:
    data = (ROOT / entry['path']).read_bytes()
    check('manifest:' + entry['path'], len(data) == entry['bytes'] and sha(data) == entry['sha256'])
expected_members = {x['path'] for x in manifest['files']}
actual_members = {str(p.relative_to(ROOT)) for p in EVIDENCE.rglob('*') if p.is_file()
                  and p.name not in {'manifest.json', 'verification.json'}}
actual_members.add(manifest['report'])
check('complete packet membership', actual_members == expected_members)
preserved = read('source-preservation.json')
base, source = preserved['base'], preserved['sourceFreeze']
before, after = tree(base), tree(source)
check('source tree', git('rev-parse', source + '^{tree}').decode().strip() == preserved['sourceTree'])
check('all original blobs preserved', len(before) == 5651 and all(after.get(p) == b for p, b in before.items()))
check('exactly five new source paths', set(after) - set(before) == {x['path'] for x in preserved['added']} and len(preserved['added']) == 5)
for entry in preserved['added']:
    data = git('show', source + ':' + entry['path'])
    check('source identity:' + entry['path'], after[entry['path']] == entry['gitBlob']
          and len(data) == entry['bytes'] and sha(data) == entry['sha256']
          and data == (ROOT / entry['path']).read_bytes())
dep = preserved['sharedDependency']
check('shared helper identity', git('show', dep['originalCommit'] + ':' + dep['path']) == (ROOT / dep['path']).read_bytes())
test = 'packages/contracts/test/retrieval-bill-text.test.mjs'
check('original author tests retained as prefix', git('show', source + ':' + test).startswith(git('show', preserved['initialSourceFreeze'] + ':' + test)))
patches = {sha(p.read_bytes()): p for p in EVIDENCE.glob('*.patch')}
negative = {'selector-negative', 'date-admission-negative', 'revision-uuid-negative'}
expected_counts = {
 'focused-initial': (24, 0), 'root-source-check': (952, 0), 'public-distribution': (7, 0),
 'selector-negative': (24, 2), 'selector-repair-focused': (26, 0), 'repaired-root-check': (954, 0),
 'date-admission-negative': (26, 1), 'date-admission-repaired': (27, 0), 'final-root-check': (955, 0),
 'revision-uuid-negative': (27, 1), 'revision-uuid-repaired': (28, 0),
}
results = read('results.json')
check('all eleven captures represented', {x['label'] for x in results['receipts']} == set(expected_counts))
for receipt in results['receipts']:
    label = receipt['label']
    raw = read(label + '.json')
    check('capture outcome:' + label, raw['exitCode'] == (1 if label in negative else 0)
          and not raw['timedOut'] and raw['ownedProcessGroupAbsent'] and not raw['ownedGroupKillRequired'])
    check('capture helper:' + label, raw['captureSha256'] == sha((EVIDENCE / 'capture-reaped.py').read_bytes()))
    check('capture test count:' + label, (receipt['counts']['pass'], receipt['counts']['fail']) == expected_counts[label])
    check('capture tracked diff:' + label, raw['sourceDiffSha256'] == sha(b'') if raw['sourceDiffBytes'] == 0
          else raw['sourceDiffSha256'] in patches and patches[raw['sourceDiffSha256']].stat().st_size == raw['sourceDiffBytes'])
    for stream in raw['streams']:
        data = (ROOT / stream['path']).read_bytes()
        check('raw bytes:' + stream['path'], len(data) == stream['bytes'] and sha(data) == stream['sha256'])
for start, end, patch in [
 ('03db5092332f61d4e9c509d14957be35ed122173', '0bdd1ce12b9263ad522e87e5f6f5105dee16dade', 'focused-initial-source.patch'),
 ('0bdd1ce12b9263ad522e87e5f6f5105dee16dade', '7caaac302ac90090cd34f9f23cda78eb0a0de69e', 'selector-repair-source.patch'),
 ('7caaac302ac90090cd34f9f23cda78eb0a0de69e', '4980080fc19315559de322e9010f16db7f4fea23', 'date-admission-repair-source.patch'),
 ('4980080fc19315559de322e9010f16db7f4fea23', source, 'revision-uuid-repaired-source.patch'),
]:
    check('captured patch binds commit:' + patch, git('diff', '--binary', start, end) == (EVIDENCE / patch).read_bytes())
refs = read('reference-identities.json')
check('ten immutable metadata references', len(refs['references']) == 10 and not refs['privateBodiesPublished'] and not refs['sourceExecuted'])
for ref in refs['references']:
    check('no observed reference drift:' + ref['path'], ref['blob'] == ref['observedBlob']
          and ref['frozenBytes'] == ref['observedBytes'] and ref['frozenSha256'] == ref['observedSha256'] and ref['unchanged'])
check('independent source acceptance exact', results['reviewerAcceptance']['source'] == source
      and results['reviewerAcceptance']['disposition'] == 'ACCEPT_SOURCE')
passed = sum(x['pass'] for x in CHECKS)
result = {'checks': len(CHECKS), 'passed': passed, 'failed': len(CHECKS) - passed,
          'sourceFreeze': source, 'scope': 'OFFLINE_PACKET_AND_SOURCE_ONLY', 'results': CHECKS}
(EVIDENCE / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'results'}))
raise SystemExit(0 if passed == len(CHECKS) else 1)
