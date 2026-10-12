"""Offline exact-byte composition audit; source is read as data, never executed."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

lane = Path(__file__).resolve().parent
root = lane.parents[4]
candidate = '4aaba8adeef8543548bfed15cf82b26e1afcc6bd'
prior = 'fd78590bff1b8551b145a7eafa0ed5f8e23d7bcc'
checks = []
source_files = []


def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)


def check(name, actual):
    checks.append({'name': name, 'passed': bool(actual)})


def tree(commit):
    result = {}
    for entry in git('ls-tree', '-rz', commit).split(b'\0'):
        if not entry:
            continue
        meta, path = entry.split(b'\t', 1)
        result[path.decode()] = meta.split()[2].decode()
    return result


old, current = tree(prior), tree(candidate)
prior_tests = ['retrieval-action-item-binding', 'retrieval-action-item-independent',
               'retrieval-catalog-bindings', 'retrieval-mail', 'retrieval-memory-binding',
               'retrieval-next-bindings', 'retrieval-next-integration-independent']
allowed = {f'packages/contracts/test/{name}.test.mjs' for name in prior_tests}
allowed.update('packages/contracts/retrieval-0.2/' + name for name in
               ['catalog.json', 'catalog-validation.mjs', 'validate.mjs'])
for path, blob in old.items():
    if path.startswith(('apps/', 'infra/', 'scripts/', 'evals/', 'packages/')) or path in ['package.json', 'package-lock.json']:
        if path not in allowed:
            check('prior-protected:' + path, current.get(path) == blob)
    if path.startswith('docs/qualification/'):
        check('prior-evidence:' + path, current.get(path) == blob)

families = [
    ('funding', '256248fee5be45e5f203bbc74cc5b0c0e2f738f7', ['funding-opportunities.schema.json', 'funding-opportunities-validation.mjs', 'funding-envelope-validation.mjs', 'funding-requirements-validation.mjs']),
    ('documents', '6e37343', ['client-documents.schema.json', 'client-documents-validation.mjs']),
    ('public-data', '31093cd5b6aaaf246a870eb4f473a6639cc2a7df', ['public-data.schema.json', 'public-data-validation.mjs', 'public-data-deadlines.mjs']),
    ('district', 'c651a0ab', ['district-nexus.schema.json', 'district-nexus-validation.mjs']),
    ('state', '3444e7fd48fe07a9df23fe5ee460cea22f886012', ['state-legislation.schema.json', 'state-legislation-validation.mjs']),
    ('reports', 'd86c0710b534fad7626856075bb873715e54b596', ['public-reports.schema.json', 'public-reports-validation.mjs']),
]
for family, commit, paths in families:
    full = git('rev-parse', commit).decode().strip()
    for name in paths:
        path = 'packages/contracts/retrieval-0.2/' + name
        accepted = git('show', f'{full}:{path}')
        expected = accepted
        guards = name in ['public-data-validation.mjs', 'state-legislation-validation.mjs']
        if guards:
            for before, after in [
                (b'if (!Object.hasOwn(families, id))', b"if (typeof id !== 'string' || !Object.hasOwn(families, id))"),
                (b'if (!Object.hasOwn(schema.$defs, name))', b"if (typeof name !== 'string' || !Object.hasOwn(schema.$defs, name))"),
            ]:
                check('single-repair-target:' + name + ':' + before.decode(), expected.count(before) == 1)
                expected = expected.replace(before, after)
        actual = (root / path).read_bytes()
        check('accepted-family:' + path, actual == expected)
        check('exact-candidate:' + path, actual == git('show', f'{candidate}:{path}'))
        source_files.append({'family': family, 'path': path, 'acceptedCommit': full,
                             'acceptedSha256': hashlib.sha256(accepted).hexdigest(),
                             'candidateSha256': hashlib.sha256(actual).hexdigest(), 'bytes': len(actual),
                             'delta': 'two-non-string-selector-guards-only' if guards else 'none'})

for name in prior_tests:
    path = f'packages/contracts/test/{name}.test.mjs'
    before, after = git('show', f'{prior}:{path}'), (root / path).read_bytes()
    check('historical-literal-hashes:' + name, set(re.findall(rb'[a-f0-9]{64}', before)).issubset(set(re.findall(rb'[a-f0-9]{64}', after))))
    check('no-new-test-skip:' + name, after.count(b'.skip(') == before.count(b'.skip('))

for group in ['public-data', 'state-legislation']:
    path = f'packages/contracts/test/retrieval-{group}.test.mjs'
    delta = git('diff', '--numstat', 'd34b1544aa448006786cbe341f1ea276eb9256f6', candidate, '--', path).decode().strip().split('\t')
    check('selector-regressions-preserve-old-lines:' + path, len(delta) == 3 and delta[1] == '0')

defs = {}
for path in (root / 'packages/contracts/retrieval-0.2').glob('*.schema.json'):
    for name in json.loads(path.read_text()).get('$defs', {}):
        check('definition-unique:' + name, name not in defs)
        defs[name] = path.name

manifest_members = 0
for directory in ['funding-review', 'documents-review', 'public-data-review', 'district-review', 'state-review', 'public-reports-review']:
    for manifest in (lane.parent / directory).glob('*manifest*.json'):
        packet = json.loads(manifest.read_text())
        entries = packet.get('members', packet.get('entries', packet.get('files', [])))
        for entry in entries:
            raw = (root / entry['path']).read_bytes()
            check('domain-packet:' + entry['path'], len(raw) == entry['bytes'] and hashlib.sha256(raw).hexdigest() == entry['sha256'])
            manifest_members += 1

expected_exits = {'independent-first': 1, 'selector-before': 1, 'selector-after-first-repair': 1,
                  'independent-repaired': 0, 'full-source': 1, 'public-distribution': 1,
                  'full-source-repaired': 0, 'public-distribution-repaired': 0}
for label, expected in expected_exits.items():
    receipt = json.loads((lane / f'{label}.json').read_text())
    check(label + ':exit', receipt['exitCode'] == expected and not receipt['timedOut'])
    check(label + ':cleanup', receipt['ownedProcessGroupAbsent'])
    check(label + ':clean-source', receipt['sourceDiffBytes'] == 0)
    for stream in receipt['streams']:
        raw = (root / stream['path']).read_bytes()
        check(stream['path'] + ':integrity', len(raw) == stream['bytes'] and hashlib.sha256(raw).hexdigest() == stream['sha256'])

summary = {'scope': 'OFFLINE_EXACT_SOURCE_AND_EVIDENCE_AUDIT', 'candidate': candidate,
           'candidateTree': git('rev-parse', candidate + '^{tree}').decode().strip(), 'priorPublication': prior,
           'passed': sum(x['passed'] for x in checks), 'total': len(checks), 'privateDefinitionCount': len(defs),
           'domainReviewManifestMembers': manifest_members, 'sourceFiles': source_files,
           'failed': [x for x in checks if not x['passed']],
           'checksSha256': hashlib.sha256(json.dumps(checks, sort_keys=True).encode()).hexdigest()}
print(json.dumps(summary, indent=2))
raise SystemExit(0 if all(x['passed'] for x in checks) else 1)
