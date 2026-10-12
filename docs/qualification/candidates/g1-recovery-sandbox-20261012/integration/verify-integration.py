"""Read-only integrated Git/source identities; no product/native imports."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = '14be9fc614568a74133b89f2b229e50c9b030322'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)
def sha(raw):
    return hashlib.sha256(raw).hexdigest()
def tree(ref):
    rows = git('ls-tree', '-r', '-z', ref).rstrip(b'\0').split(b'\0')
    return {p.decode(): h.split()[2].decode() for h, p in (r.split(b'\t') for r in rows)}

head = git('rev-parse', 'HEAD').decode().strip()
before, after = tree(BASE), tree(head)
modified = sorted(p for p in before if before[p] != after.get(p))
allowed = {
    'apps/control/qualification-temporal/README.md',
    'apps/control/qualification-temporal/package.json',
    'apps/control/qualification-temporal/tsconfig.json',
    'apps/worker/qualification/README.md',
    'apps/worker/qualification/package.json',
    'apps/worker/qualification/probes/browser.mjs',
    'apps/worker/qualification/probes/runtime.mjs',
    'apps/worker/qualification/probes/office-export.mjs',
    'apps/worker/qualification/probes/office-export.test.mjs',
    'scripts/qualification/worker_context.py',
    'scripts/qualification/worker_context_test.py',
    'scripts/qualification/worker_image_build.py',
    'scripts/qualification/worker_image_collect.py',
    'scripts/qualification/test_worker_image_build.py',
}
assert set(modified) == allowed, modified
assert not (set(before) - set(after)), 'original file removed'
assert not git('diff', 'HEAD', '--', 'apps', 'packages', 'scripts', 'package.json', 'package-lock.json'), 'uncommitted source drift'
added_source = sorted(p for p in after.keys() - before.keys() if p.startswith(('apps/', 'packages/', 'scripts/')))
assert set(added_source) == {
    'apps/control/qualification-temporal/recovery-activities.mjs',
    'apps/control/qualification-temporal/recovery-workflow.ts',
    'apps/control/qualification-temporal/recovery-types.ts',
    'apps/control/qualification-temporal/recovery.test.mjs',
    'apps/worker/qualification/probes/owned-probe-child.mjs',
    'apps/worker/qualification/probes/owned-probe-child.test.mjs',
    'apps/worker/qualification/probes/browser-lifetime.mjs',
    'apps/worker/qualification/probes/browser-lifetime.test.mjs',
}, added_source
prefix = ROOT / 'docs/qualification/candidates'
temporal = json.loads((prefix / 'temporal-recovery-20261012/author/source-manifest.json').read_text())
sandbox = json.loads((prefix / 'sandbox-lifecycle-20261012/author/source-freeze.json').read_text())
identities = [{'path': p, **row} for p, row in temporal['source'].items()] + sandbox['sourceFiles']
assert len(identities) == 19
for row in identities:
    raw = (ROOT / row['path']).read_bytes()
    assert len(raw) == row['bytes'] and sha(raw) == row['sha256'], row['path']
preserved_pg = 'apps/proxy/qualification/test/test_postgres_state.py'
assert before[preserved_pg] == after[preserved_pg]
packet = {
    'base': BASE, 'integrationSourceCommit': head,
    'integrationTree': git('rev-parse', head+'^{tree}').decode().strip(),
    'originalFiles': len(before), 'originalFilesUnchanged': len(before)-len(modified),
    'changedOriginalPaths': modified, 'addedSourcePaths': added_source,
    'exactAcceptedAuthorSourceFiles': len(identities),
    'temporalAuthor': '9a9d52ee2686346e3549e53a707aaccc5e8fbed6',
    'sandboxAuthorSource': sandbox['sourceCommit'],
    'rootPinPatchRequiresSeparateIndependentReview': True,
    'originalRealPostgresTestFileByteIdentical': True,
    'nativeRuntimeChecks': 'UNRUN', 'sourceConnectivityEnabled': False,
}
(Path(__file__).parent / 'integration-preservation.json').write_text(json.dumps(packet, indent=2)+'\n')
print(json.dumps(packet, indent=2))
