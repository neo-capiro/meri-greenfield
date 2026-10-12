#!/usr/bin/env python3
"""Verify retained evidence as data. No downloads, imports or package execution."""
import base64
import hashlib
import json
import subprocess
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
BASE = '90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def verify_file(path, sha256, size=None):
    data = path.read_bytes()
    assert digest(data) == sha256, str(path)
    if size is not None:
        assert len(data) == size, str(path)
    return data

inspection = json.loads((HERE / 'package-inspection.json').read_text())
artifacts = inspection['artifacts']
counts = {'artifacts': 0, 'compressedBytes': 0, 'npm': 0, 'wheels': 0,
          'actualPackageNoticeFiles': 0, 'retainedPackageNoticeCopies': 0,
          'commercialHashOnly': 0, 'excludedDirectoryPlaceholders': 0,
          'directPinnedLicenseChecks': 0}
for key, record in artifacts.items():
    receipt = record['archiveReceipt']
    data = verify_file(Path(record['archiveLocalPath']), receipt['sha256'], receipt['bytes'])
    counts['artifacts'] += 1
    counts['compressedBytes'] += len(data)
    if record['kind'] == 'npm':
        counts['npm'] += 1
        algo, expected = record['integrity'].split('-', 1)
        assert base64.b64encode(hashlib.new(algo, data).digest()).decode() == expected, key
        assert record['registryDist']['integrity'] == record['integrity'], key
    else:
        counts['wheels'] += 1
        assert digest(data) == record['expectedSha256'], key
    verify_file(HERE / record['metadataFile'], record['metadataReceipt']['sha256'], record['metadataReceipt']['bytes'])
    for notice in record['notices']:
        if notice['member'].endswith('/'):
            assert notice['bytes'] == 0
            counts['excludedDirectoryPlaceholders'] += 1
        else:
            counts['actualPackageNoticeFiles'] += 1
            if notice.get('retainedFile'):
                counts['retainedPackageNoticeCopies'] += 1
            else:
                assert key.startswith('@anthropic-ai/claude-agent-sdk')
                counts['commercialHashOnly'] += 1
        if notice.get('retainedFile'):
            verify_file(HERE / notice['retainedFile'], notice['sha256'], notice['bytes'])
    for wheel_metadata in record.get('wheelMetadata', []):
        verify_file(HERE / wheel_metadata['file'], wheel_metadata['sha256'])

pins = json.loads((REPO / 'apps/worker/qualification/component-pins.json').read_text())
for pin in pins['npm']:
    if pin['name'] == '@capiro/meri-contracts':
        data = verify_file(REPO / 'apps/worker/qualification' / pin['archive']['path'], pin['archive']['sha256'], pin['archive']['bytes'])
        assert 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode() == pin['integrity']
        continue
    artifact = artifacts[pin['name'] + '@' + pin['version']]
    for license_pin in pin.get('licenseFiles', []):
        notices = [n for n in artifact['notices'] if n['member'] == 'package/' + license_pin['path']]
        assert len(notices) == 1 and notices[0]['sha256'] == license_pin['sha256'], pin['name']
        counts['directPinnedLicenseChecks'] += 1
for pin in pins['pypi'] + pins['pypiTransitive']:
    assert artifacts[pin['name'] + '@' + pin['version']]['expectedSha256'] == pin['sha256']
for filename in ['upstream-documents.json', 'gap-followup.json']:
    for row in json.loads((HERE / filename).read_text()):
        if row.get('retainedFile'):
            verify_file(HERE / row['retainedFile'], row['sha256'], row['bytes'])
        for notice in row.get('notices', []):
            verify_file(HERE / notice['retainedFile'], notice['sha256'], notice['bytes'])
scope = json.loads((HERE / 'standardwebhooks-license-scope.json').read_text())
verify_file(Path(scope['artifact']), scope['archiveSha256'])
with tarfile.open(scope['artifact'], 'r:gz') as archive:
    package = archive.extractfile(scope['packageMember']).read()
    assert digest(package) == scope['packageMemberSha256']
    assert json.loads(package)['license'] == 'MIT'
    assert digest(archive.extractfile(scope['nearestAncestorLicenseMember']).read()) == scope['nearestAncestorLicenseSha256']

assert counts['artifacts'] == 133 and counts['npm'] == 126 and counts['wheels'] == 7
assert counts['compressedBytes'] == 156633085
assert counts['actualPackageNoticeFiles'] == 153
assert counts['retainedPackageNoticeCopies'] == 151 and counts['commercialHashOnly'] == 2
assert counts['excludedDirectoryPlaceholders'] == 1
assert subprocess.run(['git', 'diff', BASE, '--', 'apps', 'packages', 'AGENTS.md', 'docs/COMPONENTS.md', 'docs/IMPLEMENTATION-STANDARDS.md', 'docs/plans'], cwd=REPO, check=True, capture_output=True).stdout == b''
print(json.dumps({'result': 'PASS', 'base': BASE, 'checks': counts,
                  'scope': 'archive hashes, metadata, retained notices, exact pins, private local vendor archive, Standard Webhooks scope, unchanged existing source',
                  'notEstablished': ['license approval', 'security approval', 'assembled image attribution', 'runtime qualification']}, indent=2))
