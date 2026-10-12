"""Offline exact-freeze metadata/preservation audit; no network or target imports."""
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime
import hashlib
import json
import subprocess
import sys

ROOT = Path(sys.argv[1]).resolve()
COMMIT = sys.argv[2]
BASE = '15f671a65365e3401f0ce07b46deb4cf63538346'
HERE = Path(__file__).resolve().parent
AUTHOR = ROOT / 'docs/qualification/candidates/pgdg-metadata-20261012/author'
checks = []


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()


def check(name, result):
    checks.append({'name': name, 'passed': bool(result)})


def load(path):
    return json.loads(path.read_text())


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


check('exact clean author freeze', git('rev-parse', 'HEAD') == COMMIT and git('status', '--porcelain') == '')
changed = git('diff', '--name-only', BASE, COMMIT).splitlines()
allowed = {'docs/coordination/tasks/MERI-PGDG-METADATA-20261012.md',
           'docs/coordination/reports/MERI-PGDG-METADATA-20261012.md'}
check('only allocated author additions', all(p in allowed or p.startswith('docs/qualification/candidates/pgdg-metadata-20261012/author/') for p in changed))
check('all original files preserved', all(p.startswith('A\t') for p in git('diff', '--name-status', BASE, COMMIT).splitlines()))
check('accepted prior author is in ancestry', subprocess.run(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor', '05b297923791e434c52aa63eca6d3752d21af54e', COMMIT]).returncode == 0)
check('accepted prior reviewer is in ancestry', subprocess.run(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor', 'bf701db3389067de5c6aa503ff2698595b53289f', COMMIT]).returncode == 0)

receipt = load(AUTHOR / 'retrievals.json')
records = receipt['records']
suite = 'https://apt.postgresql.org/pub/repos/apt/dists/trixie-pgdg/'
expected = {
    suite + 'InRelease', suite + 'Release', suite + 'Release.gpg',
    'https://www.postgresql.org/media/keys/ACCC4CF8.asc',
    suite + 'main/binary-amd64/Packages.bz2', suite + '17/binary-amd64/Packages.bz2',
    suite + 'main/source/Sources.bz2',
    'https://apt.postgresql.org/pub/repos/apt/pool/main/p/postgresql-17/postgresql-17_17.11-1.pgdg13+2.dsc'
}
check('exact eight distinct official metadata locations', len(records) == len(expected) and {r['url'] for r in records} == expected)
check('bounded recorded concurrency', receipt['maxConcurrentRequests'] == 4)
check('socket timeout not misrepresented as total watchdog', 'not hard total watchdog' in receipt['timeoutScope'])
for row in records:
    path = AUTHOR / row['path']
    raw = path.read_bytes()
    check('retained bytes/hash: ' + row['name'], len(raw) == row['bytes'] and digest(raw) == row['sha256'])
    check('proxy failure retained: ' + row['name'], len(raw) == 0 and 'Tunnel connection failed: 403 Forbidden' in row.get('error', '') and not row.get('status'))
    check('finite recorded metadata limits: ' + row['name'], row['kind'] == 'OFFICIAL_METADATA_ONLY' and row['perResponseCapBytes'] == 1500000 and row['socketTimeoutSeconds'] == 10)
    check('ordered completed observation: ' + row['name'], datetime.fromisoformat(row['endedAt']) >= datetime.fromisoformat(row['startedAt']))
    check('no target payload endpoint: ' + row['name'], urlparse(row['url']).hostname in {'apt.postgresql.org', 'www.postgresql.org'} and not urlparse(row['url']).path.endswith(('.deb', '.whl', '.tar.gz', '.tar.xz')))

web = load(AUTHOR / 'web-fallback.json')
check('web text explicitly not exact origin bytes', web['kind'] == 'SUPPORTED_WEB_TOOL_RENDERED_OUTPUT_NOT_ORIGIN_BYTES')
check('web fallback retains key/source failures', 'Internal Error' in web['result'] and 'ACCC4CF8.asc' in web['result'] and 'Sources' in web['result'])
notes = load(AUTHOR / 'collection-notes.json')
check('archival collector transcription hash preserved', digest((AUTHOR / notes['collectionSource']).read_bytes()) == notes['sourceSha256'])
check('archival script not represented as pre-execution pin', 'not a pre-execution pinned collector' in notes['classification'] and notes['targetRuntimeProvenanceClaimed'] is False)

packet = load(AUTHOR / 'decision-package.json')
prior = load(ROOT / 'docs/qualification/candidates/native-prefix-20261012/author/assessment.json')
check('packet uses exact base', packet['baseCommit'] == BASE and packet['baseTree'] == git('rev-parse', BASE + '^{tree}'))
check('setup remains non-executable external-input hold', packet['decision'] == 'HOLD_EXTERNAL_INPUT' and packet['executionStatus'] == 'NOT_EXECUTABLE')
check('selected package leads unchanged and unauthenticated', packet['selectedLead']['packages'] == prior['packageLeads'] and all(p['sha256'] is None for p in packet['selectedLead']['packages']))
delta = packet['researchDelta']
check('new raw observations accurately totalled', delta['rawAttempts'] == len(records) == delta['rawProxy403'] == 8 and delta['rawResponseBytes'] == sum(r['bytes'] for r in records) == 0)
check('signature and support gaps remain explicit', delta['signatureVerification'] == 'UNRUN_MISSING_RAW_INPUTS_AND_TRUST' and delta['newBuildOrPrefixSupport'] == 'NONE_ESTABLISHED' and delta['furtherRetrievalStopped'])
next_setup = packet['nextSetupDecision']
check('no setup approval or command', next_setup['status'] == 'DEFERRED_UNTIL_EVIDENCE' and next_setup['setupApprovalRequested'] is False and next_setup['setupCommand'] is None)
for key in ['targetPayloadAcquired', 'targetPayloadHeadersAcquired', 'targetMaterializedInstalledImportedExecuted', 'hostChanged', 'databaseOrNativeActions', 'cloudProviderPaidActions']:
    check('no authority advancement: ' + key, packet[key] is False)
handoff = packet['externalDecisionPackage']
check('proposed transfer metadata locations match narrow scope', {url for group in handoff['rawMetadataGroups'] for url in group['urls']} == expected)
check('finite proposed handoff ceilings', handoff['maxRawMetadataMembers'] == 7 and handoff['maxTotalMembersIncludingProvenanceAndSupportProfile'] == 9 and handoff['maxDecodedTransferBytes'] == 4194304 and handoff['maxIndividualMetadataBytes'] == 1500000)
check('bounds not promoted to granted transfer authority', 'not observed' in handoff['boundsMeaning'] and 'granted transfer authority' in handoff['boundsMeaning'] and 'Stop if exceeded' in handoff['boundsMeaning'])
groups = {g['id']: g for g in handoff['rawMetadataGroups']}
check('release alternative and coherent fresh snapshot explicit', 'ONE alternative' in groups['signed-release']['choice'] and 'never mixed with old indices' in groups['signed-release']['required'])
check('key signature alone not trusted', 'validity/revocation' in groups['signing-key-and-trust']['required'] and 'solely because it verifies' in groups['signing-key-and-trust']['required'])
check('dsc location not invented as existing artifact', '403 establishes neither current existence nor content' in groups['selected-dsc']['required'] and 'only if selected Sources binds' in groups['selected-dsc']['required'])
check('support independent of generic extraction or approval', 'approval alone does not establish support' in handoff['supportProfileMember'])
for row in packet['preservedSourceBindings']:
    raw = (ROOT / row['path']).read_bytes()
    check('bound original source: ' + row['path'], len(raw) == row['bytes'] and digest(raw) == row['sha256'])

manifest = load(AUTHOR / 'manifest.json')
members = []
for row in manifest['files']:
    raw = (ROOT / row['path']).read_bytes()
    check('manifest member: ' + row['path'], len(raw) == row['bytes'] and digest(raw) == row['sha256'])
    members.append(row['path'])
check('manifest members unique', len(members) == len(set(members)))
excluded = {str((AUTHOR / p).relative_to(ROOT)) for p in manifest['excludes']}
check('complete author manifest coverage with declared exclusions', set(changed) == set(members) | excluded)
source_files = []
for path in changed:
    raw = (ROOT / path).read_bytes()
    source_files.append({'path': path, 'bytes': len(raw), 'sha256': digest(raw), 'gitBlob': git('rev-parse', COMMIT + ':' + path)})

out = {'baseCommit': BASE, 'authorCommit': COMMIT, 'authorTree': git('rev-parse', COMMIT + '^{tree}'),
       'authorManifestSha256': digest((AUTHOR / 'manifest.json').read_bytes()),
       'checks': checks, 'passed': sum(c['passed'] for c in checks),
       'failed': [c['name'] for c in checks if not c['passed']],
       'sourceFiles': source_files,
       'originalTrackedFilesPreserved': len(git('ls-tree', '-r', '--name-only', BASE).splitlines()),
       'targetActions': 0, 'authentication': 'UNRUN_MISSING_RAW_BYTES_AND_TRUST',
       'scope': 'Offline integrity/preservation only. Setup/support disposition is in the independent review report.'}
(HERE / 'audit-author-result.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps({k: out[k] for k in ['authorCommit', 'authorTree', 'passed', 'failed', 'originalTrackedFilesPreserved']}))
raise SystemExit(0 if not out['failed'] else 1)
