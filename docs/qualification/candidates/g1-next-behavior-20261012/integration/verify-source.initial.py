"""Local Git-byte preservation check. No execution or cloud authority."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[5]
base = '690bac4cd44112b161d8e02818aeae7639ce237a'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)

def entries(ref):
    result = {}
    for raw in git('ls-tree', '-r', '-z', ref).split(b'\0'):
        if raw:
            meta, path = raw.split(b'\t', 1)
            result[path.decode()] = meta.decode()
    return result

old, new = entries(base), entries('HEAD')
changes = [p for p in old if new.get(p) != old[p]]
expected = {
    'apps/worker/qualification/probes/image-inventory.test.mjs',
    'scripts/qualification/worker_image_collect.py',
    'scripts/qualification/test_worker_image_build.py',
    'apps/control/qualification-sdk-fixture/state/registry.mjs',
    'apps/control/qualification-sdk-fixture/state/README.md',
    'apps/control/qualification-sdk-fixture/service/handlers.mjs',
    'apps/control/qualification-sdk-fixture/service/README.md',
}
assert set(changes) == expected
accepted = {
    '0ea9b778c983108f664455e7fc4e195a0a33148a': [
        'apps/worker/qualification/probes/image-inventory.test.mjs'],
    '9ee511d0db08ade12650b9c0e0679a0a2842de08': [
        'scripts/qualification/worker_image_collect.py',
        'scripts/qualification/test_worker_image_build.py'],
    '4c1c6c7e382d3bab6aa32c0ea1dfd228482c7dee': [
        'apps/control/qualification-sdk-fixture/state/registry.mjs',
        'apps/control/qualification-sdk-fixture/state/README.md',
        'apps/control/qualification-sdk-fixture/state/revocation.mjs',
        'apps/control/qualification-sdk-fixture/state/test/revocation.test.mjs',
        'apps/control/qualification-sdk-fixture/state/test/revocation-postgres.test.mjs',
        'apps/control/qualification-sdk-fixture/service/handlers.mjs',
        'apps/control/qualification-sdk-fixture/service/README.md',
        'apps/control/qualification-sdk-fixture/service/test/cancellation.test.mjs'],
}
records = []
for ref, paths in accepted.items():
    snapshot = entries(ref)
    for path in paths:
        assert new[path] == snapshot[path], path
        raw = (root / path).read_bytes()
        assert raw == git('show', 'HEAD:' + path), path
        records.append({'path': path, 'acceptedAuthor': ref, 'gitEntry': new[path],
                        'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
sys.path.insert(0, str(root / 'scripts/qualification'))
import worker_image_build as build
stable = [p for p in build.ORIGINAL if p not in build.PACKAGING_CHANGES]
reference = entries(build.REFERENCE)
assert all(new[p] == reference[p] for p in stable)
value = {'base': base, 'candidate': git('rev-parse', 'HEAD').decode().strip(),
         'baseTrackedFiles': len(old), 'unchangedOriginalFiles': len(old) - len(changes),
         'onlyChangedOriginalFiles': sorted(changes), 'acceptedSourceRecords': records,
         'stableHistoricalWorkerContextReference': build.REFERENCE,
         'stableHistoricalMembersUnchanged': len(stable),
         'canonicalContractsRegistryLocksMigrationsUnchanged': True,
         'fixtureProductionInventoryUnchanged': True,
         'newBuildAuthority': False, 'newRuntimeAcceptance': False}
Path(__file__).with_name('source-preservation.json').write_text(json.dumps(value, indent=2) + '\n')
print(json.dumps({key: val for key, val in value.items() if key != 'acceptedSourceRecords'}, indent=2))
