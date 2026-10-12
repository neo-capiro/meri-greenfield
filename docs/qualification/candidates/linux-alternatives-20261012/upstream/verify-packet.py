#!/usr/bin/env python3
"""Read-only offline proposal integrity checks. Exit 0=pass, 1=failed, 2=usage."""
import argparse
import collections
import copy
import hashlib
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]

def read(name):
    return json.loads((HERE / name).read_text())

def validate_rows(rows, baseline):
    assert len(rows) == 54
    expected = {r['cve']: r for r in baseline}
    assert len({r['cve'] for r in rows}) == 54
    assert {r['cve'] for r in rows} == set(expected)
    for row in rows:
        old = expected[row['cve']]
        assert row['cohort'] == old['cohort']
        assert row['scannerSeverity'] == old['scannerSeverity']
        assert row['originalSourcePackage'] == old['sourcePackage']
        assert row['disposition'] == 'OPEN'
        assert set(row['ubuntu']) == {'26.04', '24.04'}
        for status in row['ubuntu'].values():
            assert status['authenticatedSnapshotVersion'] is None
            assert status['installedOrBundledCopyAdjudication'] == 'UNRUN'

def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    checks = []
    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        checks.append(name)
    for record in read('base-bindings.json')['bindings']:
        data = (ROOT / record['path']).read_bytes()
        check('base:' + record['path'], len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256'])
    for record in read('manifest.json')['files']:
        data = (ROOT / record['path']).read_bytes()
        check('artifact:' + record['path'], len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256'])
    baseline = json.loads((ROOT / 'docs/qualification/candidates/image-patch-20261012/upstream/upstream-matrix.json').read_text())
    matrix = read('alternative-obligations.json')
    validate_rows(matrix['rows'], baseline['rows'])
    check('54-identities-cohorts-severities-open', True)
    check('current47-severity-unchanged', collections.Counter(r['scannerSeverity'] for r in matrix['rows'] if r['cohort'] == 'CURRENT_47') == {'CRITICAL': 5, 'HIGH': 17, 'MEDIUM': 17, 'LOW': 7, 'UNDEFINED': 1})
    for kind in ['omitted-historical-krb5', 'closed-row', 'downgraded-critical']:
        bad = copy.deepcopy(matrix['rows'])
        if kind == 'omitted-historical-krb5':
            bad = [r for r in bad if r['cve'] != 'CVE-2026-107778']
        elif kind == 'closed-row':
            bad[0]['disposition'] = 'CLOSED'
        else:
            next(r for r in bad if r['scannerSeverity'] == 'CRITICAL')['scannerSeverity'] = 'LOW'
        rejected = False
        try:
            validate_rows(bad, baseline['rows'])
        except AssertionError:
            rejected = True
        check('negative-control:' + kind, rejected)
    check('all54-vendor-pages-attempted', {r['cve'] for r in read('ubuntu-cve-read-results.json')['rows']} == {r['cve'] for r in matrix['rows']})
    check('no-execution-admission', matrix['executionAdmission'] == 'NOT_EXECUTABLE' and matrix['securityAdmission'] == 'HOLD' and matrix['approvedRecipeDelta'] is None)
    for receipts in ['metadata-fetch-results.json', 'snapshot-fetch-results.json', 'current-pocket-results.json', 'package-index-results.json', 'oci-metadata-results.json', 'oci-platform-results.json']:
        for row in read(receipts)['rows']:
            data = (HERE / row['path']).read_bytes()
            check('transport:' + row['path'], len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'])
            if row.get('dockerContentDigest'):
                check('oci-digest:' + row['path'], row['dockerContentDigest'] == 'sha256:' + row['sha256'])
            if 'expectedSha256' in row:
                check('index-inrelease-hash:' + row['path'], row['expectedSha256'] == row['sha256'] and row['expectedBytes'] == row['bytes'] and row['signatureVerified'] is False)
    check('all-snapshot-failures-preserved', all(r['bytes'] == 0 and '403 Forbidden' in r['error'] for r in read('snapshot-fetch-results.json')['rows']))
    recipe = (ROOT / 'apps/worker/qualification/Dockerfile').read_text()
    segment = recipe.split('# Direct OS package pins')[1].split('WORKDIR')[0]
    direct = {'ca-certificates'} | {name for name, _ in re.findall(r'(?<![A-Za-z0-9_-])([a-z][a-z0-9+.-]*)=([0-9][^\\\s;]*)', segment)}
    for option in read('composition-proposals.json')['options']:
        check('all35-mapped:' + option['id'], len(option['directPackageMapping']) == 35 and {r['currentName'] for r in option['directPackageMapping']} == direct)
        check('browser-dependencies-retained:' + option['id'], len(option['playwright']['nativeDependencies']) == 21 and 'libcups2t64' in option['playwright']['nativeDependencies'])
        check('no-runtime-claim:' + option['id'], option['securityAdmission'] == 'HOLD' and option['layersDownloaded'] == 0 and option['playwright']['runtimeABIQualification'] == 'UNRUN')
    facts = read('exact-alpha-archive-observations.json')['facts']
    check('exact-alpha-platform-facts', facts['ubuntu24ExplicitSupportedConditional'] and facts['ubuntu26ExplicitSupportedConditional'])
    for name, expected in {'official-ubuntu-library.txt':'ce38f84575e08dbd70db4778db526df67856d405','playwright-alpha-nativeDeps.ts.txt':'1a75f17cb92d7e84469267c3454b61fc02f5abc6','playwright-alpha-hostPlatform.ts.txt':'d633ca383aee28493d4fb882064103d7a4a807a5'}.items():
        data = (HERE / name).read_bytes()
        check('upstream-git-blob:' + name, hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == expected)
    print(json.dumps({'status':'PASS','checksPassed':len(checks),'checks':checks,'scope':'OFFLINE_SOURCE_METADATA_ONLY','runtimeAdmission':'NOT_EXECUTABLE'}, indent=2))

if __name__ == '__main__':
    main()
