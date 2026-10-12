#!/usr/bin/env python3
"""Offline evidence verifier. This never admits an image or executes a collector."""
import collections
import hashlib
import json
from pathlib import Path
import runpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
checks = []

def read(path):
    return json.loads(path.read_bytes())

def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)

def git_blob(body):
    return hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest()

manifest = read(HERE / 'manifest.json')
for entry in manifest['files']:
    path = ROOT / entry['path']
    check('contained:' + entry['path'], path.resolve().is_relative_to(ROOT) and not path.is_symlink())
    body = path.read_bytes()
    check('hash:' + entry['path'], len(body) == entry['bytes'] and hashlib.sha256(body).hexdigest() == entry['sha256'])
baseline = read(ROOT / 'docs/qualification/candidates/image-patch-20261012/upstream/upstream-matrix.json')['rows']
matrix = read(HERE / 'obligations-54.json')
rows = matrix['rows']
check('54 unique retained IDs', len(rows) == 54 and len({r['cve'] for r in rows}) == 54)
keys = lambda rs: {(r['cve'], r['cohort'], r['scannerSeverity']) for r in rs}
check('exact original IDs cohorts severities', keys(rows) == keys(baseline))
check('all obligations remain open', all(r['acceptedImageDisposition'] == r['candidateDisposition'] == 'OPEN' and not r['snapshotVersionAuthenticated'] and not r['bundledCopiesAdjudicated'] for r in rows))
check('no executable source candidate', matrix['executionAdmission'] == 'NOT_EXECUTABLE' and matrix['securityAdmission'] == 'HOLD' and matrix['sourceCandidateViability'] == 'NOT_YET_DEMONSTRABLE')
check('status counts derive from rows', matrix['counts'] == dict(collections.Counter(r['ubuntuVendorStatus'] for r in rows)))
check('expected scoped counts', matrix['counts'] == {'fixed': 18, 'not_affected': 4, 'under_investigation': 12, 'VENDOR_STATUS_UNRESOLVED': 20})
module = runpy.run_path(str(HERE / 'derive-assessment.py'), run_name='offline_derivation_helpers')
match = module['matched_statements']
for row in rows:
    evidence = row['vexEvidence']
    if evidence['localPath']:
        body = (HERE / evidence['localPath']).read_bytes()
        check('Git blob:' + row['cve'], git_blob(body) == evidence['gitBlob'])
        check('exact scoped statements:' + row['cve'], row['matchedStatements'] == match(json.loads(body), row['ubuntuSourceProvider']))
    else:
        check('read failure stays unresolved:' + row['cve'], row['ubuntuVendorStatus'] == 'VENDOR_STATUS_UNRESOLVED' and row['matchedStatements'] == [])
by_id = {r['cve']: r for r in rows}
check('GCC actual provider remains unresolved', by_id['CVE-2026-95619']['ubuntuSourceProvider'] == 'gcc-16' and by_id['CVE-2026-95619']['ubuntuVendorStatus'] == 'VENDOR_STATUS_UNRESOLVED')
check('zlib known deferred retained', by_id['CVE-2026-85091']['interpretation'].startswith('KNOWN_VULNERABLE_DEFERRED') and 'currently deferred' in by_id['CVE-2026-85091']['matchedStatements'][0]['statusNotes'])
for name, product in [('wrong provider', 'pkg:deb/ubuntu/rsync@3.4?arch=source&distro=resolute'), ('wrong release', 'pkg:deb/ubuntu/zlib@1.3?arch=source&distro=noble'), ('wrong architecture', 'pkg:deb/ubuntu/zlib@1.3?arch=amd64&distro=resolute')]:
    synthetic = {'statements': [{'status': 'not_affected', 'products': [{'@id': product}]}]}
    check('negative control rejects ' + name, match(synthetic, 'zlib') == [])
positive = {'statements': [{'status': 'fixed', 'products': [{'@id': 'pkg:deb/ubuntu/zlib@1.3?arch=source&distro=resolute'}]}]}
check('positive scope control', len(match(positive, 'zlib')) == 1)
packages = read(HERE / 'package-function-assessment.json')
proposal = read(ROOT / 'docs/qualification/candidates/linux-alternatives-20261012/upstream/composition-proposals.json')['options'][0]
check('35 original functions preserved', len(packages['directMappings']) == 35 and {r['originalName'] for r in packages['directMappings']} == {r['currentName'] for r in proposal['directPackageMapping']})
check('no implicit pins', all(r['immutableSelectedVersion'] is None and r['runtimeQualification'] == 'UNRUN' for r in packages['directMappings']))
check('exact alpha native dependencies present', set(proposal['playwright']['nativeDependencies']).issubset({r['Package'] for r in packages['supportingPackages']}))
check('six metadata indices distinct', len(packages['indices']) == 6 and len({(r['suite'], r['component']) for r in packages['indices']}) == 6)
for entry in packages['indices']:
    body = (ROOT / entry['path']).read_bytes()
    text = (ROOT / entry['inRelease']).read_text()
    key = f"{entry['component']}/binary-amd64/Packages.xz"
    matched = [line.split() for line in text.splitlines() if len(line.split()) == 3 and line.split()[2] == key and len(line.split()[0]) == 64]
    check('InRelease hash binding:' + entry['suite'] + '/' + entry['component'], matched == [[hashlib.sha256(body).hexdigest(), str(len(body)), key]] and entry['signatureAuthentication'] == 'UNRUN')
check('package closure not overstated', packages['dependencySolver'] == 'UNRUN' and packages['payloadDownloadCount'] == 0 and packages['recipeWritten'] is False)
python = read(HERE / 'python-metadata-assessment.json')
check('seven Python pins retained', len(python['rows']) == 7 and all(r['matchingOriginalHashes'] for r in python['rows']))
check('Python runtime and lock not changed', python['runtimeCompatibility'] == 'UNRUN' and python['lockEdited'] is False)
check('metadata attribution license blob', git_blob((HERE / 'raw/VEX-LICENSE.txt').read_bytes()) == '7d4f96c54aa155a17387e64501c50b6a0469932c')
prerequisites = read(HERE / 'source-prerequisites.json')
check('no recipe and no unearned completed prerequisite', not prerequisites['immutableSourceCandidateCreated'] and not prerequisites['recipeChanged'] and all(not r['complete'] for r in prerequisites['steps']))
check('author serialization failure preserved', len(read(HERE / 'authoring-failures.json')['failures']) == 38)
print(json.dumps({'result': 'PASS', 'checksPassed': len(checks), 'checks': checks, 'executionAdmission': 'NOT_EXECUTABLE', 'runtimeEvidence': 'UNRUN'}, indent=2))
