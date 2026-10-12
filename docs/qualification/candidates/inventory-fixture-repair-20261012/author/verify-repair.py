"""Bounded evidence controls; production bytes remain unchanged."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
BASE = '690bac4cd44112b161d8e02818aeae7639ce237a'
TEST = 'apps/worker/qualification/probes/image-inventory.test.mjs'
PROBE = 'apps/worker/qualification/probes/image-inventory.py'
sha = lambda raw: hashlib.sha256(raw).hexdigest()
original = subprocess.check_output(['git', 'show', BASE + ':' + TEST], cwd=ROOT)
source = (ROOT / TEST).read_bytes()
setup = b"  // Finish fixture membership before comparing full directory metadata.\n  // The result is excluded, but creating its directory entry changes the root.\n  write(dir, 'inventory-result.json', '{}');\n"
assert source.count(setup) == 1
prefix = source.split(b"\ntest('directory sizes remain captured and size-only changes before descent fail closed'")[0]
assert prefix.replace(setup, b'') == original
assert (OUT / 'image-inventory.original.test.mjs').read_bytes() == original
production = (ROOT / PROBE).read_bytes()
assert production == subprocess.check_output(['git', 'show', BASE + ':' + PROBE], cwd=ROOT)
# A size-blind identity mutant is isolated to an owned temporary copy. The new
# regression must reject it; its failure is retained, not counted as a product pass.
needle = b'st.st_mode, st.st_uid, st.st_gid, st.st_size,'
assert production.count(needle) == 1
mutant = production.replace(needle, b'st.st_mode, st.st_uid, st.st_gid, 0,')
with tempfile.TemporaryDirectory(prefix='meri-inventory-size-control-') as scratch:
    scratch = Path(scratch)
    (scratch / 'image-inventory.py').write_bytes(mutant)
    (scratch / 'image-inventory.test.mjs').write_bytes(source)
    command = ['node', '--test', '--test-reporter=tap', '--test-name-pattern=directory sizes remain captured', str(scratch / 'image-inventory.test.mjs')]
    result = subprocess.run(command, env={**os.environ, 'PYTHON': 'python3'}, capture_output=True, timeout=30)
    (OUT / 'size-blind-mutant.stdout.bin').write_bytes(result.stdout)
    (OUT / 'size-blind-mutant.stderr.bin').write_bytes(result.stderr)
    assert result.returncode == 1
    assert b'not ok 1 - directory sizes remain captured' in result.stdout
    assert b'0 !== 1' in result.stdout
    mutant_result = {'command': command, 'exitCode': result.returncode, 'expectedExitCode': 1,
                     'result': 'NEGATIVE_CONTROL_REJECTED', 'mutation': 'Only _identity directory/file st_size is replaced with zero in a temporary copy.',
                     'mutantSha256': sha(mutant), 'productionSha256': sha(production),
                     'temporaryCopyRemoved': True}
(OUT / 'size-blind-mutant.json').write_text(json.dumps(mutant_result, indent=2) + '\n')

spec = importlib.util.spec_from_file_location('worker_context', ROOT / 'scripts/qualification/worker_context.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory(prefix='meri-inventory-source-context-') as scratch:
    scratch = Path(scratch)
    manifests = []
    for index in range(2):
        target = scratch / str(index)
        manifest = module.assemble_context(target)
        assert module.verify_context(target) == manifest
        raw = (target / 'manifest.json').read_bytes()
        (OUT / f'context-manifest-{index + 1}.json').write_bytes(raw)
        manifests.append(raw)
    assert manifests[0] == manifests[1]
    context = {'status': 'SOURCE_ONLY_NOT_ADMISSION', 'members': len(manifest['members']),
               'totalBytes': manifest['totalBytes'], 'contextManifestSha256': sha(manifests[0]),
               'testSha256': sha(source), 'testBytes': len(source),
               'assemblerSha256': sha((ROOT / 'scripts/qualification/worker_context.py').read_bytes()),
               'productionProbeSha256': sha(production), 'twoAssembliesByteIdentical': True,
               'temporaryContextsRemoved': True}
(OUT / 'context-identity-proposal.json').write_text(json.dumps(context, indent=2) + '\n')
print(json.dumps({'result': 'PASS', 'original25TestsPreservedExceptThreeSetupLines': True,
                  'allOriginalAssertionsAndNegativeControlsUnchanged': True,
                  'productionProbeByteIdentical': True,
                  'sizeBlindMutantRejected': True, 'context': context}, indent=2))
