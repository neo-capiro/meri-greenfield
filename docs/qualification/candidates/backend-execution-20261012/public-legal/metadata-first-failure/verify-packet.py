#!/usr/bin/env python3
"""Read-only public/legal packet verification; never imports product/private code.

Run from this repository with Python -I -B; optionally pass --capiro-repo PATH
to verify private reference object hashes. No source bodies are printed. Exit 0
means these metadata checks passed; exit 1 means a failed check. No runtime gate
is tested, and test receipts are read rather than replayed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], stderr=subprocess.PIPE)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tree(repo, ref):
    result = {}
    for row in git(repo, 'ls-tree', '-r', '-z', ref).split(b'\0'):
        if row:
            info, path = row.split(b'\t', 1)
            result[path.decode()] = info.decode()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capiro-repo', type=Path)
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    repo = Path(git(here, 'rev-parse', '--show-toplevel').decode().strip())
    checks = []

    def check(name, passed):
        checks.append({'check': name, 'passed': bool(passed)})

    def read(path):
        return json.loads(path.read_text())

    manifest = read(here / 'manifest.json')
    check('source acceptance is not runtime qualification', manifest['runtimeQualified'] is False)
    paths = [m['path'] for m in manifest['members']]
    check('unique manifest members', len(paths) == len(set(paths)))
    for item in manifest['members']:
        path = Path(item['path'])
        check('safe member ' + str(path), not path.is_absolute() and '..' not in path.parts)
        content = (repo / path).read_bytes()
        check('member bytes ' + str(path), len(content) == item['bytes'])
        check('member hash ' + str(path), sha(content) == item['sha256'])

    preservation = read(here / 'source-preservation.json')
    original = tree(repo, preservation['base'])
    source = tree(repo, preservation['source'])
    check('original count 7677', len(original) == 7677 == preservation['originalMembers'])
    for path, identity in original.items():
        check('original preserved ' + path, source.get(path) == identity)
    check('source preservation changed list empty', preservation['changedOrRemovedOriginalPaths'] == [])
    check('source paths exact', sorted(set(source) - set(original)) == preservation['newPaths'])
    for path in paths:
        if path.startswith('packages/'):
            check('product matches frozen source ' + path, (repo / path).read_bytes() == git(repo, 'show', preservation['source'] + ':' + path))
    check('both hearing schemas bound', all('packages/contracts/retrieval-0.2/' + p in paths for p in ['public-domain-hearings.schema.json', 'public-domain-hearing-records.schema.json']))
    check('dataset provider and projection bound', all('packages/contracts/retrieval-0.2/' + p in paths for p in ['public-domain-registry.mjs', 'public-domain-datasets.json']))

    ids = {'search_research_sources', 'search_legislative_research', 'get_legal_reference', 'query_global_data', 'search_committee_hearings', 'search_legiwatch_news'}
    ledger = read(here / 'operation-ledger.json')
    check('exact six allocated operations', {o['id'] for o in ledger['operations']} == ids and len(ledger['operations']) == 6)
    for op in ledger['operations']:
        check('disconnected ' + op['id'], op['sourceConnected'] is False and op['runtimeQualified'] is False)
        check('source object exists ' + op['id'], git(repo, 'cat-file', '-t', op['source']).strip() == b'commit')
        if op['independentReview']:
            check('review object exists ' + op['id'], git(repo, 'cat-file', '-t', op['independentReview']).strip() == b'commit')
    api = read(here / 'api-bindings.json')
    check('same six API operations', {op for f in api['families'] for op in f['operations']} == ids)
    check('five cohesive API groups', len(api['families']) == 5)
    for family in api['families']:
        schema = read(repo / ('packages/contracts/retrieval-0.2/' + family['module'] + '.schema.json'))
        check('request and output definitions ' + family['group'], all(n in schema['$defs'] for n in family['requestDefinitions'] + family['outputDefinitions']))
        check('caller definitions remain Request ' + family['group'], all(n.endswith('Request') for n in family['requestDefinitions']))

    reference_count = 0
    for path in sorted(here.glob('*reference-identities.json')):
        refs = read(path)
        for ref in refs:
            reference_count += 1
            check('paired refs ' + path.name + ':' + ref['path'], ref['frozen']['ref'] == 'fd8765ec01d292013758606204f2c9d886cd31c1' and ref['observed']['ref'] == '4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace')
            check('drift declaration ' + path.name + ':' + ref['path'], ref['changed'] == (ref['frozen']['blob'] != ref['observed']['blob']))
            if args.capiro_repo:
                for side in ['frozen', 'observed']:
                    item = ref[side]
                    content = git(args.capiro_repo, 'show', item['ref'] + ':' + ref['path'])
                    identity = git(args.capiro_repo, 'rev-parse', item['ref'] + ':' + ref['path']).decode().strip()
                    check('private reference hash ' + path.name + ':' + ref['path'] + ':' + side, identity == item['blob'] and len(content) == item['bytes'] and sha(content) == item['sha256'])
    check('38 paired reference records', reference_count == 38)

    expected_exits = {'candidate-focused-first': 1, 'candidate-focused-corrected': 0, 'global-focused-first': 0, 'legal-focused-first': 0, 'news-focused-first': 1, 'legal-news-repaired-second': 0, 'hearing-focused-first': 1, 'hearing-fragment-id-before': 1, 'hearing-focused-repaired': 0, 'six-operations-author-final': 0}
    for name, expected in expected_exits.items():
        directory = here / name
        receipt = read(directory / 'receipt.json')
        check('retained exit ' + name, receipt['exitCode'] == expected)
        check('source diff empty ' + name, receipt['sourceDiff'] == '')
        check('owned group absent ' + name, receipt.get('groupAbsent', receipt.get('ownedGroupAbsent')) is True and receipt['timeout'] is False)
        for stream in ['stdout', 'stderr']:
            check('raw stream hash ' + name + ':' + stream, sha((directory / (stream + '.txt')).read_bytes()) == receipt[stream + 'Sha256'])
        if receipt.get('producerSha256'):
            producer = git(repo, 'show', receipt['source'] + ':' + str((here / 'capture-focused.py').relative_to(repo)))
            check('exact capture producer ' + name, sha(producer) == receipt['producerSha256'])
    final = read(here / 'six-operations-author-final/receipt.json')
    check('final receipt source bound', final['source'] == preservation['source'] == manifest['source'])
    raw = (here / 'six-operations-author-final/stdout.txt').read_text()
    check('155 tests, no failures or skips', all(re.search(r'^# ' + text + r'$', raw, re.M) for text in ['tests 155', 'pass 155', 'fail 0', 'skipped 0']))
    check('capture failure provenance retained', (here / 'legal-news-repaired/capture-failure.json').is_file() and (here / 'legal-news-repaired/capture-preimage.py').is_file())
    check('no runtime source activation asserted', preservation['productionSourceConnected'] is False)

    failures = [item for item in checks if not item['passed']]
    print(json.dumps({'checks': len(checks), 'passed': len(checks) - len(failures), 'failed': len(failures), 'failures': failures, 'privateReferenceObjectsChecked': args.capiro_repo is not None, 'runtimeActionsExecuted': False, 'source': manifest['source'], 'manifestSha256': sha((here / 'manifest.json').read_bytes())}, indent=2))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
