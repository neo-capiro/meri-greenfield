"""Exact twentieth-file correction audit, preserving the earlier nineteen."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *args: subprocess.check_output(['git', *args], cwd=root)
old = json.loads((packet / 'test-author-nineteen-expectation-updates.json').read_text())
current = json.loads((packet / 'test-expectation-updates.json').read_text())
checks = []
def check(label, value):
    checks.append({'check': label, 'passed': bool(value)})
check('twenty exact original paths', len(current['changes']) == 20)
check('historical nineteen records unchanged', current['changes'][:19] == old['changes'])
check('historical nineteen manifest exact committed preimage', (packet / 'test-author-nineteen-expectation-updates.json').read_bytes() == git('show', '36af89b9:docs/qualification/candidates/backend-execution-20261012/integration/test-expectation-updates.json'))
check('historical script exact committed preimage', (packet / 'test-author-nineteen-update-script.py').read_bytes() == git('show', '36af89b9:docs/qualification/candidates/backend-execution-20261012/integration/update-test-expectations.py'))
for row in current['changes']:
    before = git('show', current['base'] + ':' + row['path'])
    after = (root / row['path']).read_bytes()
    check(row['path'] + ': predecessor digest', sha(before) == row['beforeSha256'])
    check(row['path'] + ': final digest', sha(after) == row['afterSha256'])
    forward = before.decode()
    for edit in row['replacements']:
        if edit.get('wholeFileStep'):
            assert forward == edit['old']
            forward = edit['new']
        else:
            for pos in reversed(edit['positionsBefore']):
                assert forward[pos:pos + len(edit['old'])] == edit['old']
                forward = forward[:pos] + edit['new'] + forward[pos + len(edit['old']):]
    check(row['path'] + ': exact forward', forward.encode() == after)
    inverse = after.decode()
    for edit in reversed(row['replacements']):
        if edit.get('wholeFileStep'):
            assert inverse == edit['new']
            inverse = edit['old']
        else:
            positions = [pos + index * (len(edit['new']) - len(edit['old'])) for index, pos in enumerate(edit['positionsBefore'])]
            for pos in reversed(positions):
                assert inverse[pos:pos + len(edit['new'])] == edit['new']
                inverse = inverse[:pos] + edit['old'] + inverse[pos + len(edit['new']):]
    check(row['path'] + ': exact inverse', inverse.encode() == before)
    if row['path'] != 'packages/contracts/test/retrieval-operational-reads.test.mjs':
        check(row['path'] + ': accepted test bytes unchanged', after == git('show', '36af89b9:' + row['path']))
changes = git('diff', '--name-only', '36af89b9', 'HEAD', '--', 'apps', 'packages').decode().splitlines()
check('only new allocated test changed', changes == ['packages/contracts/test/retrieval-operational-reads.test.mjs'])
for file in ['backend-execution-connected.test.mjs', 'backend-execution-expectations.mjs']:
    name = 'packages/contracts/test/' + file
    check(file + ': exact accepted bytes', (root / name).read_bytes() == git('show', '36af89b9:' + name))
for row in json.loads((packet / 'test-author-root-failure-provenance.json').read_text())['paths']:
    retained = (root / row['retainedPath']).read_bytes()
    check(row['sourcePath'] + ': root failure exact bytes', retained == git('show', 'e0e9130a:' + row['sourcePath']) and sha(retained) == row['sha256'])
result = {'checks': checks, 'passed': sum(row['passed'] for row in checks), 'total': len(checks), 'scope': 'Read-only test inversion and source preservation, no runtime qualification'}
(packet / 'test-author-operational-audit-results.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'passed': result['passed'], 'total': result['total'], 'failures': [row['check'] for row in checks if not row['passed']]}))
raise SystemExit(0 if result['passed'] == result['total'] else 1)
