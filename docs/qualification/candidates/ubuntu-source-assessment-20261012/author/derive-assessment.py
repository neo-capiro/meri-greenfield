#!/usr/bin/env python3
"""Offline metadata derivation; no solver, install, artifact execution or network."""
import collections
import functools
import hashlib
import json
import lzma
from pathlib import Path
import subprocess
from urllib.parse import parse_qs, unquote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
PRIOR = ROOT / 'docs/qualification/candidates/linux-alternatives-20261012/upstream'
BASELINE = ROOT / 'docs/qualification/candidates/image-patch-20261012/upstream/upstream-matrix.json'
REF = '6609070af95e04758e8895a14e22e292b8ebc587'

def read(path):
    return json.loads(path.read_bytes())

def write(name, value):
    (HERE / name).write_text(json.dumps(value, indent=2, sort_keys=True) + '\n')

def stanzas(body):
    for para in body.split('\n\n'):
        result, key = {}, None
        for line in para.splitlines():
            if line.startswith(' ') and key:
                result[key] += '\n' + line
            elif ': ' in line:
                key, value = line.split(': ', 1)
                result[key] = value
        if result:
            yield result

def compare(a, b):
    if a['Version'] == b['Version']:
        return 0
    result = subprocess.run(['/usr/bin/dpkg', '--compare-versions', a['Version'], 'lt', b['Version']], capture_output=True, timeout=2)
    if result.returncode not in (0, 1):
        raise ValueError('version comparison failed')
    return -1 if result.returncode == 0 else 1

def purl_source(product, source):
    prefix, query = product.split('?', 1)
    package = unquote(prefix.split('/')[-1].split('@')[0])
    fields = parse_qs(query)
    return package == source and fields.get('arch') == ['source'] and fields.get('distro') == ['resolute']

def matched_statements(document, source):
    matched = []
    for index, statement in enumerate(document['statements']):
        products = [p['@id'] for p in statement['products'] if purl_source(p['@id'], source)]
        if products:
            matched.append({'statementIndex': index, 'status': statement['status'], 'statusNotes': statement.get('status_notes'), 'justification': statement.get('justification'), 'impactStatement': statement.get('impact_statement'), 'sourcePurls': products})
    return matched

def derive():
    records, index_evidence = [], []
    for suite in ('resolute', 'resolute-updates', 'resolute-security'):
        release = (HERE / 'raw/resolute-base-inrelease.body') if suite == 'resolute' else PRIOR / f'metadata-transport/{suite}-inrelease.body.bin'
        text = release.read_text()
        for component in ('main', 'universe'):
            if suite == 'resolute':
                path = HERE / f'raw/resolute-base-{component}-packages.body'
            elif suite == 'resolute-security':
                path = HERE / f'raw/resolute-security-{component}-packages.body'
            else:
                path = PRIOR / f'metadata-transport/{suite}-{component}-Packages.xz'
            blob = path.read_bytes()
            digest = hashlib.sha256(blob).hexdigest()
            wanted = f'{component}/binary-amd64/Packages.xz'
            expected = next(line.split() for line in text.splitlines() if len(line.split()) == 3 and len(line.split()[0]) == 64 and line.split()[2] == wanted)
            assert digest == expected[0] and len(blob) == int(expected[1])
            index_evidence.append({'suite': suite, 'component': component, 'path': str(path.relative_to(ROOT)), 'sha256': digest, 'bytes': len(blob), 'inRelease': str(release.relative_to(ROOT)), 'hashBinding': 'PASS', 'signatureAuthentication': 'UNRUN'})
            for item in stanzas(lzma.decompress(blob).decode()):
                records.append(dict(suite=suite, component=component, **item))
    by_name = collections.defaultdict(list)
    for item in records:
        by_name[item['Package']].append(item)
    latest = {}
    def package(name):
        if name not in latest:
            choices = by_name[name]
            if not choices:
                raise ValueError('missing package ' + name)
            latest[name] = max(choices, key=functools.cmp_to_key(compare))
        return latest[name]
    proposal = read(PRIOR / 'composition-proposals.json')['options'][0]
    direct = []
    fields = ('Package', 'Source', 'Version', 'Architecture', 'Depends', 'Pre-Depends', 'Recommends', 'Conflicts', 'Breaks', 'Provides', 'Filename', 'Size', 'SHA256', 'suite', 'component')
    def metadata(name):
        return {key: value for key, value in package(name).items() if key in fields}
    for original in proposal['directPackageMapping']:
        direct.append({'originalName': original['currentName'], 'originalVersion': original['currentVersion'], 'proposedName': original['proposedName'], 'functionDisposition': original['role'], 'functionalRequirement': original['reason'], 'latestObservedMetadata': metadata(original['proposedName']), 'immutableSelectedVersion': None, 'runtimeQualification': 'UNRUN'})
    key_packages = set(proposal['playwright']['nativeDependencies']) | {'libstdc++6', 'libgcc-s1', 'python3-lxml', 'python3.14', 'python3.14-venv', 'libxml2-16', 'libxslt1.1', 'libgnutls30t64', 'libavahi-client3', 'libgssapi-krb5-2', 'zlib1g', 'libcurl4t64', 'libcurl3t64-gnutls', 'libsasl2-2', 'libnghttp2-14', 'gnupg', 'util-linux', 'libreoffice-common', 'libreoffice-draw-nogui', 'libreoffice-base-core', 'uno-libs-private', 'ure'}
    package_assessment = {'executionAdmission': 'NOT_EXECUTABLE', 'baseCommit': '1e6d430cf9c239caca4198aea42a762f13021cd5', 'indices': index_evidence, 'directMappings': direct, 'supportingPackages': [metadata(name) for name in sorted(key_packages)], 'counts': {'directFunctions': len(direct), 'indices': len(index_evidence)}, 'dependencySolver': 'UNRUN', 'payloadDownloadCount': 0, 'recipeWritten': False, 'notes': ['All versions are observations from retained live indices, not pins selected for a recipe.', 'No dependency solution, dpkg installed inventory, ABI acceptance or snapshot replay is claimed.', 'dpkg --compare-versions is used only for offline version ordering. No apt install/update/build command is executed.']}
    write('package-function-assessment.json', package_assessment)
    receipts = {r['cve']: r for r in read(HERE / 'vex-read-results.json')['rows']}
    previous = {r['cve']: r for r in read(PRIOR / 'alternative-obligations.json')['rows']}
    rows = []
    for original in read(BASELINE)['rows']:
        cve = original['cve']; receipt = receipts[cve]
        source = original['sourcePackage']
        if cve == 'CVE-2026-95619':
            source = package('libstdc++6')['Source'].split(' ', 1)[0]
            path = HERE / 'raw/gcc-vex-complete.body'
            git_blob = '10de893863b34c6cfb4d497f8d60039420962e18'
        elif receipt['result'] == 'BODY_RETURNED':
            path = HERE / receipt['localPath']; git_blob = receipt['gitBlob']
        else:
            path = None; git_blob = None
        matched = matched_statements(read(path), source) if path else []
        if path:
            data = path.read_bytes()
            assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == git_blob
        statuses = sorted({m['status'] for m in matched})
        status = statuses[0] if len(statuses) == 1 else 'VENDOR_STATUS_UNRESOLVED'
        reason = 'Exact resolute source package/version VEX statement; installed/bundled-copy identity and archive authentication remain unqualified.' if matched else 'No resolute source statement for the actual Ubuntu provider; absence does not establish not-affected.'
        if path is None:
            reason = 'Pinned Canonical VEX exact-path read returned 404; supported API fallback did not establish a resolute package disposition.'
        action = f'Canonical/security owner: obtain released fix or explicit resolute/{source} scoped adjudication for {cve}; then authenticate one-suite package closure and inspect every installed/bundled copy.'
        if status in ('fixed', 'not_affected'):
            action = f'Source owner: bind exact {source} VEX version to authenticated immutable resolute package closure; preserve rationale and prove every installed/bundled copy before independent acceptance.'
        row = {'cve': cve, 'cohort': original['cohort'], 'scannerSeverity': original['scannerSeverity'], 'originalSourcePackage': original['sourcePackage'], 'originalSourceVersion': original['scannerSourceVersion'], 'ubuntuSourceProvider': source, 'ubuntuVendorStatus': status, 'matchedStatements': matched, 'reason': reason, 'previousUbuntu26Observation': previous[cve]['ubuntu']['26.04'], 'heldTrixieDisposition': original['debianTrixie'], 'acceptedImageDisposition': 'OPEN', 'candidateDisposition': 'OPEN', 'nextDependency': action, 'vexEvidence': {'url': f'https://github.com/canonical/ubuntu-security-notices/blob/{REF}/vex/cve/{cve.split("-")[1]}/{cve}.json', 'commit': REF, 'gitBlob': git_blob, 'localPath': str(path.relative_to(HERE)) if path else None, 'initialReadResult': receipt['result']}, 'snapshotVersionAuthenticated': False, 'bundledCopiesAdjudicated': False}
        if cve == 'CVE-2026-85091':
            row['interpretation'] = 'KNOWN_VULNERABLE_DEFERRED: official mapping converts deferred to under_investigation; this is consistent with the retained web status, not a downgrade.'
        if cve == 'CVE-2026-95619':
            row['interpretation'] = 'Actual libstdc++6/libgcc-s1 provider is gcc-16; gcc-12/13 not_affected statements do not apply to gcc-16. Original gcc-14 finding retained.'
        if cve == 'CVE-2026-52490':
            row['apiObservation'] = 'Official API returned an active CVE with packages=[] and patches={}; no Ubuntu package fix or applicability is established.'
        rows.append(row)
    write('obligations-54.json', {'baseCommit': '1e6d430cf9c239caca4198aea42a762f13021cd5', 'executionAdmission': 'NOT_EXECUTABLE', 'sourceCandidateViability': 'NOT_YET_DEMONSTRABLE', 'securityAdmission': 'HOLD', 'counts': dict(collections.Counter(r['ubuntuVendorStatus'] for r in rows)), 'rows': rows})

if __name__ == '__main__':
    derive()
