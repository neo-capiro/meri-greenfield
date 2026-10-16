import base64
import hashlib
import io
import json
import subprocess
import tarfile
from pathlib import Path, PurePosixPath

root = Path(__file__).parent / 'meri-qualification'
pin = '5aa13719e8706704785d142ad903fb42db51220e'
accepted = 'b8322cdc86e4b113b326e357acdb148394ee39c3'
base = 'eca78d458acb46cbfd54a94cf870841d999ef6b1'
prefix = 'packages/contracts/'
evidence = prefix + 'conversation-history/evidence/'
def raw(ref, path):
    return subprocess.check_output(['git', 'show', ref + ':' + path], cwd=root)
def paths(ref):
    return subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', ref], cwd=root, text=True).splitlines()
def sha(data):
    return hashlib.sha256(data).hexdigest()
provenance = json.loads(raw(pin, evidence + 'PROVENANCE.json'))
archive = raw(pin, evidence + 'capiro-meri-contracts-0.1.6.tgz')
assert len(archive) == provenance['archive']['bytes'] == 467014
assert sha(archive) == provenance['archive']['sha256'] == '050ce4a5a0facb0c3df4dbc14c2dedb5b49bfdfe618c4f88148f7779300313a4'
integrity = 'sha512-' + base64.b64encode(hashlib.sha512(archive).digest()).decode()
assert integrity == provenance['archive']['integrity']
rows = []
with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
    members = tar.getmembers()
    assert len(members) == 31
    assert len({m.name for m in members}) == len(members)
    assert sum(m.size for m in members) == provenance['archive']['unpackedBytes']
    for member in members:
        path = PurePosixPath(member.name)
        assert member.isfile() and path.parts[0] == 'package' and '..' not in path.parts
        relative = str(PurePosixPath(*path.parts[1:]))
        data = tar.extractfile(member).read()
        assert data == raw(pin, prefix + relative), relative
        rows.append({'path': relative, 'bytes': len(data), 'sha256': sha(data)})
package = json.loads(raw(pin, prefix + 'package.json'))
assert package['name'] == '@capiro/meri-contracts' and package['version'] == '0.1.6'
assert package['exports']['./conversation-history']['default'] == './dist/conversation-history.mjs'
assert package['exports']['./conversation-history']['types'] == './dist/conversation-history.d.ts'
assert package['exports']['./conversation-history/schema'] == './dist/conversation-history.schema.json'
for row in provenance['outputs']:
    data = raw(pin, prefix + row['path'])
    assert len(data) == row['bytes'] and sha(data) == row['sha256']

unchanged = []
for path in paths(base):
    if path.startswith(prefix + 'dist/') or path in ['package-lock.json', prefix + 'package-lock.json', prefix + 'meri.schema.json']:
        assert raw(base, path) == raw(pin, path), path
        unchanged.append(path)
# Only generated artifacts/evidence and the diagnosed fixture/report may differ
# from the exact accepted generator/server source.
diff = subprocess.check_output(['git', 'diff', '--name-only', accepted, pin, '--', prefix], cwd=root, text=True).splitlines()
allowed = {prefix + 'test/conversation-history-public-types.ts'}
for path in diff:
    assert path in allowed or path.startswith(evidence) or path.startswith(prefix + 'dist/conversation-history.'), path
for stage in provenance['stages']:
    assert stage['primaryExit'] == stage['cleanupExit'] == 0
    assert stage['preservedBytes'] and stage['ownedExited'] and not stage['timedOut']
assert provenance['failedTypeAttempt']['primaryExit'] == 2
result = {'schema': 'meri.history.independent-artifact-check/1', 'artifactSource': pin,
          'acceptedGeneratorSource': accepted, 'sha256': sha(archive), 'integrity': integrity,
          'archiveBytes': len(archive), 'entries': rows, 'preservedBaseInputs': unchanged,
          'generatorInputsUnchanged': True, 'allSixStageReceiptsSuccessful': True,
          'failedTypeAttemptRetained': True,
          'independentCheckAttempt1': {'exit': 1, 'reason': 'Inspector assumed an import condition; package deliberately uses the existing default condition convention. Archive hashes and 31 exact source-byte comparisons had passed before this diagnostic assumption failed. Inspector corrected to check actual default/types exports; artifact unchanged.'},
          'evidenceClass': 'Independent Python stdlib archive/hash/source check; author generated-byte/type tests attributed, no compiler/browser/DB/provider rerun',
          'disposition': 'No archive/source custody blocker found; parent exact-artifact acceptance remains required before frontend adoption'}
target = root / 'docs/coordination/audits/meri-package4-qualification-20261016/history-artifact-independent.json'
target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'source': pin, 'archiveSha256': sha(archive), 'archiveEntries': len(rows),
                  'preservedBaseInputs': len(unchanged), 'generatorInputsUnchanged': True,
                  'disposition': result['disposition']}))
