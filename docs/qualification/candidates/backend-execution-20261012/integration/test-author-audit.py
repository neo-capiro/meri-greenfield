"""Read-only exact test inversion, source preservation and owned capture audit."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
dependency = 'ea94aff840424843b4b6efbfc21fb9d195f7ff54'
source = '60ef3f099107886565d2f20723ce0a01fcb9ca82'
manifest = json.loads((packet / 'test-expectation-updates.json').read_text())
rows = []
sha = lambda data: hashlib.sha256(data).hexdigest()
def check(name, passed):
    rows.append({'check': name, 'passed': bool(passed)})
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)

check('exact19 predecessor paths', len(manifest['changes']) == 19)
check('exact13 newly bound operations', len(manifest['explicitNewOperations']) == 13)
check('exact31 raw request schema repairs', len(manifest['rawRequestRepairs']) == 31)
for row in manifest['changes']:
    current = (root / row['path']).read_bytes()
    before = git('show', manifest['base'] + ':' + row['path'])
    check(row['path'] + ': final digest', sha(current) == row['afterSha256'])
    check(row['path'] + ': immutable predecessor digest', sha(before) == row['beforeSha256'])
    inverse = current.decode()
    for item in reversed(row['replacements']):
        if item.get('wholeFileStep'):
            if inverse != item['new']:
                raise AssertionError((row['path'], 'whole-file inverse precondition'))
            inverse = item['old']
        else:
            delta = len(item['new']) - len(item['old'])
            positions = [p + i * delta for i, p in enumerate(item['positionsBefore'])]
            for pos in reversed(positions):
                if inverse[pos:pos + len(item['new'])] != item['new']:
                    raise AssertionError((row['path'], pos))
                inverse = inverse[:pos] + item['old'] + inverse[pos + len(item['new']):]
    check(row['path'] + ': exact inverse', inverse.encode() == before)
    check(row['path'] + ': original test declaration count', len(re.findall(r'\btest\(', current.decode())) == len(re.findall(r'\btest\(', before.decode())))
    check(row['path'] + ': assertion calls retained or added', len(re.findall(r'\bassert\.', current.decode())) >= len(re.findall(r'\bassert\.', before.decode())))
    check(row['path'] + ': no skip/only added', not re.search(r'\btest\.(skip|only)\(', current.decode()))

owned_tests = {row['path'] for row in manifest['changes']} | {
    'packages/contracts/test/backend-execution-connected.test.mjs',
    'packages/contracts/test/backend-execution-expectations.mjs',
}
changed = set(git('diff', '--name-only', dependency, source, '--', 'apps', 'packages').decode().splitlines())
check('source delta contains only21 allocated test/helper paths', changed == owned_tests)
current_changed = set(git('diff', '--name-only', source, '--', 'apps', 'packages').decode().splitlines())
check('reviewed test source freeze remains exact', current_changed == set())
fixture_changes = git('diff', '--name-only', dependency, source, '--', 'docs/qualification/candidates').decode().splitlines()
check('historical fixture evidence unchanged', all('/backend-execution-20261012/integration/' in name for name in fixture_changes))

receipts = []
for path in sorted(packet.glob('test-author-*.json')):
    record = json.loads(path.read_text())
    if not isinstance(record, dict) or 'ownedPidAndPgid' not in record:
        continue
    check(path.name + ': child exited and was reaped', record['ownedProcessGroupAbsent'] and not record['timedOut'] and not record['ownedGroupKillRequired'])
    try:
        os.killpg(record['ownedPidAndPgid'], 0)
        absent = False
    except ProcessLookupError:
        absent = True
    check(path.name + ': owned group remains absent', absent)
    for stream in record['streams']:
        data = (root / stream['path']).read_bytes()
        check(path.name + ': ' + stream['path'].split('.')[-2], len(data) == stream['bytes'] and sha(data) == stream['sha256'])
    receipts.append({'path': path.relative_to(root).as_posix(), 'exitCode': record['exitCode'], 'ownedPidAndPgid': record['ownedPidAndPgid'], 'groupAbsent': absent})
check('predecessor final source receipt pins exact immutable candidate', json.loads((packet / 'test-author-predecessor-final.json').read_text())['sourceHead'] == '5c87a258caf638738de45ef3b5a05310ea20f75e')
check('connected final source receipt pins repaired immutable candidate', json.loads((packet / 'test-author-connected-final.json').read_text())['sourceHead'] == source)

report = {'dependency': dependency, 'source': source, 'checks': rows, 'passed': sum(row['passed'] for row in rows), 'total': len(rows), 'captures': receipts,
          'limits': 'Lexical declaration/assertion counts are supplementary, not an AST semantic proof. Exact inverse and passing behavioral checks remain separate evidence. No native/runtime claim.'}
(packet / 'test-author-audit-results.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'passed': report['passed'], 'total': report['total'], 'failed': [row['check'] for row in rows if not row['passed']]}))
raise SystemExit(0 if report['passed'] == report['total'] else 1)
