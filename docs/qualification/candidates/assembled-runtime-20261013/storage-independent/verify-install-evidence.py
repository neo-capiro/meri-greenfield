"""Verify frozen producer npm evidence correlations; does not rehash removed tarballs."""
import hashlib
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parents[5]
evidence = root / 'apps/artifacts/storage/test/evidence'
lock = json.loads((root / 'apps/artifacts/storage/package-lock.json').read_text())
upstream = json.loads((Path(__file__).parent / 'lock-provenance.stdout.bin').read_text())
independent_metadata = {(p['name'], p['version']): p for p in upstream['packages']}
installed = json.loads((evidence / 'public-installed-integrity.json').read_text())
assert installed['packageAndLockUnchanged'] is True
assert installed['packageSha256'] == hashlib.sha256((root / 'apps/artifacts/storage/package.json').read_bytes()).hexdigest()
assert installed['lockSha256'] == hashlib.sha256((root / 'apps/artifacts/storage/package-lock.json').read_bytes()).hexdigest()
assert len(installed['installed']) == 40
expected_urls = set()
for package in installed['installed']:
    metadata = independent_metadata[(package['name'], package['version'])]
    item = lock['packages'][metadata['location']]
    assert package['nativeIntegrity'] == item['integrity']
    assert package['resolved'] == item['resolved']
    assert package['license'] == item['license']
    assert package['installedPackageMetadataSha256'] == metadata['upstreamMetadataSha256']
    assert package['cachedTarballIntegrityVerified'] is True and package['cachedRegistryTarballBytes'] > 0
    expected_urls.add(item['resolved'])
receipt = json.loads((evidence / 'npm-public-ci-tool-trust.json').read_text())
assert receipt['exitCode'] == 0 and receipt['ownedProcessGroupAbsent'] is True
assert receipt['timedOut'] is False and receipt['sourceDiffBytes'] == 0
for stream in receipt['streams']:
    data = (root / stream['path']).read_bytes()
    assert len(data) == stream['bytes']
    assert hashlib.sha256(data).hexdigest() == stream['sha256']
assert (evidence / 'npm-public-ci-tool-trust.stdout.bin').read_text().strip() == 'added 40 packages in 1s'
debug = (evidence / 'npm-public-ci-tool-trust.debug.bin').read_text()
urls = set(re.findall(r'http fetch GET 200 (https://registry\.npmjs\.org/\S+\.tgz)', debug))
assert urls == expected_urls
assert 'verbose exit 0' in debug and 'info ok' in debug
fresh_tests = json.loads((evidence / 'storage-public-installed.json').read_text())
assert fresh_tests['exitCode'] == 0 and fresh_tests['ownedProcessGroupAbsent'] is True
assert fresh_tests['sourceDiffBytes'] == 0
for stream in fresh_tests['streams']:
    data = (root / stream['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == stream['sha256']
assert 'pass 18' in (evidence / 'storage-public-installed.stdout.bin').read_text()
print(json.dumps({'verdict': 'PASS_FROZEN_PRODUCER_INSTALL_EVIDENCE', 'packages': 40,
                  'packageAndLockUnchanged': True, 'officialRegistrySuccessfulTarballURLs': len(urls),
                  'independentNativeMetadataCorrelation': True, 'freshByteProducerTests': 18,
                  'removedTarballsIndependentlyRehashed': False,
                  'reviewerNetworkCalls': False, 'nativeRuntimeAdmission': False}, indent=2))
