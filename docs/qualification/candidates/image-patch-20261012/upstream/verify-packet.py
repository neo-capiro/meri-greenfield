"""Offline consistency checks; never fetch, install, build, launch or import product code."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
BASE = '90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73'
SCAN_REF = '28fbfc7e40799fdb4e59eabd35c5b9bf80f117d9'
SCAN_PATH = 'docs/qualification/aws-shipper-20261011-r1/captures/ecr-canonical-repaired-scan/stdout.bin'
SCAN_SHA = '3e7a92a7e8a876b5468b5495f3b415c8d0728ee8b28af69f21b175f60ea4e127'
OLDER = {'CVE-2026-' + n for n in ('95619', '78410', '78408', '76642', '78409')}
OMITTED = {'CVE-2026-107708', 'CVE-2026-107778'}


def read(name):
    return json.loads((HERE / name).read_text(encoding='utf-8'))


def pinned(ref, path):
    return subprocess.check_output(['git', 'show', ref + ':' + path], cwd=REPO)


def require(condition, label):
    if not condition:
        raise ValueError(label)
    return label


def verify():
    checks = []
    matrix = read('upstream-matrix.json')
    rows = matrix['rows']
    scan_bytes = pinned(SCAN_REF, SCAN_PATH)
    checks.append(require(len(scan_bytes) == 59680 and hashlib.sha256(scan_bytes).hexdigest() == SCAN_SHA, 'pinned_original47_bytes_and_hash'))
    original = json.loads(scan_bytes)['imageScanFindings']['findings']
    current = [r for r in rows if r['cohort'] == 'CURRENT_47']
    checks.append(require(len(rows) == len({r['cve'] for r in rows}) == 54, 'unique54_obligations'))
    checks.append(require(dict(Counter(r['cohort'] for r in rows)) == {'CURRENT_47': 47, 'OLDER_FIVE': 5, 'HISTORICAL_OMITTED_TWO': 2}, '47_plus5_plus2'))
    checks.append(require({r['cve'] for r in rows if r['cohort'] == 'OLDER_FIVE'} == OLDER and {r['cve'] for r in rows if r['cohort'] == 'HISTORICAL_OMITTED_TWO'} == OMITTED, 'all_omitted_obligations_preserved'))
    for actual, row in zip(original, current, strict=True):
        attrs = {a['key']: a['value'] for a in actual['attributes']}
        checks.append(require((row['cve'], row['scannerSeverity'], row['scannerSourcePackage'], row['scannerSourceVersion']) == (actual['name'], actual['severity'], attrs['package_name'], attrs['package_version']), 'original_row_' + actual['name']))
    checks.append(require(dict(Counter(r['scannerSeverity'] for r in current)) == {'CRITICAL': 5, 'HIGH': 17, 'MEDIUM': 17, 'LOW': 7, 'UNDEFINED': 1}, 'original_severity_counts_including22_critical_high'))
    checks.append(require(all(r['acceptedImageDisposition'] == 'OPEN' and r['debianTrixie']['fixedVersionVerified'] is None and r['signedSnapshotCompatibility'] == 'UNVERIFIED' for r in rows), 'no_image_waiver_or_snapshot_admission'))
    checks.append(require(matrix['executionAdmission'] == 'NOT_EXECUTABLE' and matrix['approvedRecipeDelta'] is None and matrix['approvedSnapshotDelta'] is None, 'no_executable_recipe_or_snapshot_delta'))
    families = read('package-release-leads.json')['observations']
    checks.append(require({r['sourcePackage'] for r in rows} == set(families) and len(families) == 15, 'all15_source_families_covered'))
    for e in read('source-evidence.json')['preservedSources']:
        raw = pinned(e['commit'], e['path'])
        checks.append(require(len(raw) == e['bytes'] and hashlib.sha256(raw).hexdigest() == e['sha256'], 'pinned_source_' + e['path']))
    for path in ('apps/worker/qualification/Dockerfile', 'apps/worker/qualification/component-pins.json'):
        checks.append(require((REPO / path).read_bytes() == pinned(BASE, path), 'unchanged_' + path))
    requests = read('fetch-requests.json')
    results = read('fetch-results.json')
    checks.append(require(len(requests) == len(results) == 70 and {r['id'] for r in requests} == {r['id'] for r in results}, 'all70_fetch_results_preserved'))
    request_by_id = {r['id']: r for r in requests}
    for r in results:
        raw = (HERE / r['body']).read_bytes()
        checks.append(require(r['url'] == request_by_id[r['id']]['url'] and r['outcome'] == 'TRANSPORT_FAILURE' and r['bytes'] == len(raw) == 0 and r['responseStatus'] is None and hashlib.sha256(raw).hexdigest() == r['sha256'], 'failure_bytes_' + r['id']))
    checks.append(require(len((HERE / 'fetch.stdout').read_text().splitlines()) == 70 and (HERE / 'fetch.stderr').stat().st_size == 0, 'fetch_streams_preserved'))
    return {'schema': 'MeriUpstreamOfflineVerification.v1', 'status': 'PASS_SOURCE_CONSISTENCY_ONLY', 'checksPassed': len(checks), 'checks': checks, 'notVerified': ['remote original HTTP bytes or freshness', 'vendor-adjudicated runtime nonapplicability', 'signed InRelease/Sources/Packages dependency chain', 'patched image or complete new scan', 'any G1 runtime gate'], 'networkOperations': 0, 'imageOrRuntimeOperations': 0}


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2, sort_keys=True))
