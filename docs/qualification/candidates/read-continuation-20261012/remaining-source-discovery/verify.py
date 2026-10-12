"""Offline discovery packet checks. Reads Git objects; never executes producer code."""
import hashlib
import json
import pathlib
import re
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
SOURCE = pathlib.Path('/workspace/capirov2')
REPORT = 'docs/coordination/reports/CODEX-REMAINING-SOURCE-DISCOVERY-20261012.md'
PREFIX = 'docs/qualification/candidates/read-continuation-20261012/remaining-source-discovery/'
BASE = 'a3e946c1fa264ae7b33205f5b87804ee1ef75773'
checks = []

def check(name, value):
    checks.append({'check': name, 'passed': bool(value)})

def read(name):
    return json.loads((HERE / name).read_text())

def git(repo, *args):
    return subprocess.run(['git', '-C', str(repo), *args], check=True,
                          capture_output=True, timeout=20).stdout

inv = read('inventory.json')
cat = json.loads((ROOT / 'packages/contracts/retrieval-0.2/catalog.json').read_text())
originals = cat['originals']
selected = {x['id'] for x in originals if x['disposition'] == 'selected'}
pending = {x['id'] for x in originals if x['state'] == 'pending'}
check('original139', len(originals) == inv['original'] == 139)
check('selected96', len(selected) == inv['selected'] == 96)
check('deferred43', sum(x['disposition'] == 'deferred' for x in originals) == inv['deferred'] == 43)
check('pending51', len(pending) == inv['pending'] == 51)
a, c = set(inv['excludedAllocated']), set(inv['excludedCommands'])
r = {x['id'] for x in inv['remaining']}
check('exclusion_counts', (len(a), len(c), len(r)) == (10, 11, 30))
check('disjoint_partition', not (a & c or a & r or c & r) and a | c | r == pending)
check('original_rows_exact', all(x in originals for x in inv['remaining']))
check('catalog_identical_to_base', git(ROOT, 'show', BASE + ':packages/contracts/retrieval-0.2/catalog.json') == (ROOT / 'packages/contracts/retrieval-0.2/catalog.json').read_bytes())
slate = read('contract-ready.json')
ops = [op for family in slate['families'] for op in family['operations']]
check('slate12_unique', len(ops) == len(set(ops)) == slate['recommendationCount'] == 12)
check('slate_is_remaining_subset', set(ops) <= r)
check('ten_cohesive_families', len(slate['families']) == 10)
check('first_three_exist', len(slate['firstFamilies']) == 3 and all(x in {f['family'] for f in slate['families']} for x in slate['firstFamilies']))
disposition = read('disposition.json')
check('all30_retained', len(disposition['rows']) == 30 and {x['operation'] for x in disposition['rows']} == r)
check('12_recommended18_others', sum(x['status'] == 'RECOMMENDED_FOR_CONTRACT_AUTHORSHIP' for x in disposition['rows']) == 12 and len(r - set(ops)) == 18)
check('all_pending_unqualified', all(x['catalogState'] == 'pending' and x['runtimeAccepted'] is False for x in disposition['rows']))
check('named_temporal_replacement_owner', [x['operation'] for x in disposition['rows'] if x['status'] == 'REPLACEMENT_OWNER_CONTRACT_REQUIRED'] == ['list_scheduled_tasks'])
refs = read('reference-identities.json')
check('34_reference_pairs', len(refs['references']) == 34)
check('source_pins_exact', refs['inventoryPin'] == 'fd8765ec01d292013758606204f2c9d886cd31c1' and refs['observedPin'] == '4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace')
for ref in refs['references']:
    for key, pin in [('frozen', refs['inventoryPin']), ('observed', refs['observedPin'])]:
        locator = pin + ':' + ref['path']
        body = git(SOURCE, 'show', locator)
        blob = git(SOURCE, 'rev-parse', locator).decode().strip()
        check('identity:' + key + ':' + ref['path'], ref[key] == {'blob': blob, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()})
    check('drift:' + ref['path'], ref['unchanged'] is True and ref['frozen'] == ref['observed'])
changes = git(ROOT, 'diff', '--name-status', BASE, '--').decode().splitlines()
check('only_owned_new_tracked_paths', all(line.startswith('A\t') and (line[2:] == REPORT or line[2:].startswith(PREFIX)) for line in changes))
untracked = git(ROOT, 'ls-files', '--others', '--exclude-standard').decode().splitlines()
check('only_owned_untracked_paths', all(x == REPORT or x.startswith(PREFIX) for x in untracked))
check('no_private_bodies_claim', refs['privateBodiesRetained'] is False and refs['sourceExecuted'] is False)
check('explicit_unfinished_work', len(read('checkpoint.json')['unfinished']) == 4)
report = (ROOT / REPORT).read_text()
for link in re.findall(r'\]\(([^)]+)\)', report):
    check('report_link:' + link, ((ROOT / REPORT).parent / link).is_file())
manifest = HERE / 'manifest.json'
if manifest.exists():
    for member in json.loads(manifest.read_text())['members']:
        body = (ROOT / member['path']).read_bytes()
        check('packet:' + member['path'], len(body) == member['bytes'] and hashlib.sha256(body).hexdigest() == member['sha256'])
failed = [c['check'] for c in checks if not c['passed']]
print(json.dumps({'scope': 'OFFLINE_METADATA_AND_PRESERVATION_ONLY', 'passed': len(checks) - len(failed), 'failed': len(failed), 'checks': checks}, indent=2))
raise SystemExit(1 if failed else 0)
