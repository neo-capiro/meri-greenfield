"""Verify local receipts and exact reviewed source; emit an integration manifest."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
BASE = '1e6d430cf9c239caca4198aea42a762f13021cd5'
SOURCE = '1355c0ab9b0cb6162efef3b9d8ba4e3230a16ed9'
AUTHORS = {
    'owner': '357251ee531bf4da9778116090ec22a4a8ee27a3',
    'budget': 'd58a2b1c51c43420fa64c1036c509ab14d872996',
}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def record(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}


source_matches = {}
for lane, freeze in AUTHORS.items():
    paths = git('diff', '--name-only', BASE, freeze, '--', 'apps').decode().splitlines()
    for path in paths:
        assert (ROOT / path).read_bytes() == git('show', freeze + ':' + path), path
        assert git('show', SOURCE + ':' + path) == git('show', freeze + ':' + path), path
    source_matches[lane] = {'author': freeze, 'exactSourceFiles': len(paths)}

receipts = []
for path in sorted(HERE.glob('*.json')):
    data = json.loads(path.read_bytes())
    if 'captureSha256' not in data:
        continue
    assert data['sourceDiffBytes'] == 0, path
    assert data['ownedProcessGroupAbsent'] and not data['timedOut'], path
    assert not data['ownedGroupKillRequired'], path
    expected = 2 if path.name == 'whitespace-all.json' else 0
    assert data['exitCode'] == expected, path
    for stream in data['streams']:
        assert record(ROOT / stream['path']) == stream, stream['path']
    receipts.append({'path': path.relative_to(ROOT).as_posix(),
                     'exitCode': data['exitCode'], 'sourceHead': data['sourceHead'],
                     'reapedDescendants': len(data['reapedDescendants'])})

catalog = json.loads((ROOT / 'packages/contracts/retrieval-0.2/catalog.json').read_bytes())
dispositions = Counter(row['disposition'] for row in catalog['originals'])
states = Counter(row['state'] for row in catalog['originals'])
assert len(catalog['originals']) == 139 and dispositions == {'selected': 96, 'deferred': 43}
assert states == {'pending': 82, 'deferred': 43, 'mapped': 14}
assert len(catalog['operations']) == 14
assert all(row['handler'] is None and row['availability'] == 'unimplemented'
           and row['qualification'] == 'pending' for row in catalog['operations'])

preserved = json.loads((HERE / 'source-preservation.stdout.bin').read_bytes())
assert preserved['verdict'] == 'PASS' and preserved['sourceHead'] == SOURCE
files = [record(path) for path in sorted(HERE.iterdir())
         if path.is_file() and path.name != 'integration-manifest.json']
result = {
    'decision': 'ACCEPT_SOURCE_ONLY', 'base': BASE, 'sourceCommit': SOURCE,
    'sourceTree': git('rev-parse', SOURCE + '^{tree}').decode().strip(),
    'exactAuthorSourceMatches': source_matches,
    'scopeLedger': {'original': 139, 'selected': 96, 'deferred': 43,
                    'boundUnavailable': 14, 'selectedUnmapped': 82},
    'preservation': {'originalFiles': preserved['originalFiles'],
                     'unchangedOriginalFiles': preserved['unchangedOriginalFiles'],
                     'originalPostgresTestBodies': preserved['originalPostgresTestBodiesPreserved']},
    'receipts': receipts, 'files': files,
    'rawEvidenceWhitespace': 'FULL_DIFF_EXIT_2_PRESERVED; source/report check PASS',
    'runtime': 'HOLD', 'database': 'UNRUN', 'native': 'UNRUN', 'image': 'HOLD',
}
output = HERE / 'integration-manifest.json'
output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'manifest': record(output), 'receipts': len(receipts),
                  'sourceMatches': source_matches, 'preservation': result['preservation']}))
