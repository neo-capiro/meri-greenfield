"""Independent source/data audit. Never import or execute candidate definitions."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import sys

root, candidate, output = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
review = Path(__file__).resolve().parent
base = 'e8d2c0d0e5db8fb01ba2df26c4eb3f79b296c0b5'
prefix = 'docs/qualification/candidates/native-supervisor-20261012/author/'
report = 'docs/coordination/reports/MERI-NATIVE-SUPERVISOR-20261012.md'
task = 'docs/coordination/tasks/MERI-NATIVE-SUPERVISOR-20261012.md'
facts = []

def check(name, predicate, detail=None):
    facts.append({'case': name, 'passed': bool(predicate), 'detail': detail})

def git(*args):
    return subprocess.check_output(['git', '-C', str(root), *args])

def blob(path):
    return git('show', candidate + ':' + path)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

actual_head = git('rev-parse', 'HEAD').decode().strip()
check('exact-candidate-head', actual_head == candidate, {'expected': candidate, 'actual': actual_head})
check('candidate-worktree-clean', git('status', '--porcelain') == b'')
changes = [line.split('\t') for line in git('diff', '--name-status', base, candidate).decode().splitlines()]
check('only-allocated-new-files', all(row[0] == 'A' and (row[1].startswith(prefix) or row[1] in (report, task)) for row in changes), changes)
check('original-application-and-guards-unmodified', all(row[0] == 'A' for row in changes))
for protected in json.loads((review / 'frozen-criteria.json').read_text())['protectedOriginals']:
    path = protected['path']; current = blob(path)
    check('protected-original:' + path, current == git('show', base + ':' + path) and len(current) == protected['bytes'] and digest(current) == protected['sha256'])

manifest = json.loads(blob(prefix + 'freeze-receipt.json'))
followup = json.loads(blob(prefix + 'late-read-fix-receipt.json'))
previous = followup['previousFreeze']
member_names = set()
for row in manifest['files']:
    name = row['path']; member_names.add(name); raw = git('show', previous + ':' + prefix + name)
    check('historical-author-manifest:' + name, len(raw) == row['bytes'] and digest(raw) == row['sha256'])
overrides = {row['path']: row for row in followup['files']}
for row in manifest['files']:
    if row['path'] not in overrides:
        raw = blob(prefix + row['path'])
        check('historical-evidence-unchanged:' + row['path'], len(raw) == row['bytes'] and digest(raw) == row['sha256'])
for name, row in overrides.items():
    member_names.add(name); raw = blob(prefix + name)
    check('followup-author-manifest:' + name, len(raw) == row['bytes'] and digest(raw) == row['sha256'] and raw == (root / prefix / name).read_bytes())
tracked = {row[1][len(prefix):] for row in changes if row[1].startswith(prefix)}
check('author-combined-manifest-complete-self-exclusion', tracked == member_names | {'freeze-receipt.json', 'late-read-fix-receipt.json', 'current-manifest.json'} and len(overrides) == len(followup['files']))
check('historical-freeze-receipt-unchanged', blob(prefix + 'freeze-receipt.json') == git('show', previous + ':' + prefix + 'freeze-receipt.json'))
current_manifest = json.loads(blob(prefix + 'current-manifest.json'))
for row in current_manifest['files']:
    raw = blob(row['path'])
    check('complete-packet-manifest:' + row['path'], len(raw) == row['bytes'] and digest(raw) == row['sha256'])
check('complete-packet-membership', {row[1] for row in changes} == {row['path'] for row in current_manifest['files']} | {current_manifest['selfExcluded']} and len(current_manifest['files']) == 20)
check('packet-only-adds-complete-manifest-to-source-freeze', git('diff', '--name-only', current_manifest['sourceFreeze'], candidate).decode().splitlines() == [prefix + 'current-manifest.json'])

source_rows = []
trees = {}
for name in ('run-supervised.py', 'supervision.py', 'source-checks.py'):
    raw = blob(prefix + name); trees[name] = ast.parse(raw)
    source_rows.append({'path': prefix + name, 'bytes': len(raw), 'sha256': digest(raw)})
    check('syntax-and-exact-current-bytes:' + name, raw == (root / prefix / name).read_bytes())

wrapper = trees['run-supervised.py']
functions = {n.name: n for n in wrapper.body if isinstance(n, ast.FunctionDef)}
constants = {n.targets[0].id: ast.literal_eval(n.value) for n in wrapper.body if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name)}
check('unresolved-immutable-pins-refuse', all(constants[n] is None for n in ('SOURCE_VERIFICATION_SHA256', 'PRIOR_MANIFEST_SHA256', 'GIT_EXECUTABLE', 'GIT_EXECUTABLE_SHA256', 'GIT_EXECUTABLE_BYTES')))
check('exact-selected-executable-pin', constants['EXECUTABLE_BYTES'] == 91648 and constants['EXECUTABLE_SHA'] == 'f1d8d2aa2a8ad7c74b6c6300b29cfdbcb484fc7ffad99b7fbfe1e31c048343b9')
diagnostic = blob('docs/qualification/candidates/native-ancestor-diagnosis-20261012/inspect-ancestor-metadata.py')
check('canonical-diagnostic-pin', constants['SCRIPT_BYTES'] == len(diagnostic) and constants['SCRIPT_SHA'] == digest(diagnostic))
check('admission-does-not-use-assert', not any(isinstance(n, ast.Assert) for n in ast.walk(wrapper)))
check('top-level-safe-declarations', all(isinstance(n, (ast.Import, ast.ImportFrom, ast.Assign, ast.FunctionDef)) or isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant) or isinstance(n, ast.If) and ast.unparse(n.test) == "__name__ == '__main__'" and len(n.body) == 1 and isinstance(n.body[0], ast.Raise) for n in wrapper.body))
check('cli-explicit-hold', 'HOLD: source review only' in ast.unparse(wrapper.body[-1]))
entry = ast.unparse(functions['run_supervised'])
check('refusal-before-all-future-ports', entry.index('HOLD_unresolved_exact_preservation_records') < entry.index('inventory.Filesystem') and entry.index('HOLD_unresolved_native_git_identity') < entry.index('inventory.Filesystem'))
check('one-budget-no-phase-reset', entry.count('lifecycle.Budget(') == 1 and 'budget = lifecycle.Budget(time.monotonic)' in entry)
check('selected-and-git-hash-before-native-verification', entry.index('executable_before = checked_file') < entry.index('source_before = verify_original_source') and entry.index('git_before = checked_file') < entry.index('source_before = verify_original_source'))
native = ast.unparse(functions['native_spawn'])
check('fixed-native-adapter-only', 'subprocess.Popen' in native and 'stdin=subprocess.DEVNULL' in native and 'stdout=subprocess.PIPE' in native and 'stderr=subprocess.PIPE' in native and 'shell=False' in native and 'bufsize=0' in native)
check('actual-diagnostic-uses-lifecycle', 'result = lifecycle.capture(argv,' in entry and 'make_thread=native_thread' in entry)
fixed_git = ast.unparse(functions['fixed_git'])
check('git-no-ambient-fallback', 'capture([GIT_EXECUTABLE,' in fixed_git and "['git'" not in fixed_git)
read = ast.unparse(functions['read_json'])
check('json-no-second-unbounded-path-read', '.read_bytes(' not in ast.unparse(wrapper) and 'fs.open_read(path)' in read and 'min(65536, 1048577 - count)' in read)
check('json-brackets-growth-and-deadline', all(label in read for label in ('json_open_identity_changed', 'json_growing_file_refused', 'json_opened_file_changed', 'json_named_file_changed')) and read.count('budget.check(') >= 4)
bind = ast.unparse(functions['bind'])
check('exact-receipt-and-private-action-binding', 'original_receipt_identity' in bind and 'original_repository_output_unchanged' in bind and 'set(action) == names' in bind and 'fresh_destination_separation' in bind)
check('fresh-exclusive-destination-precedes-diagnostic', entry.index('inventory.ancestors(destination.parent, fs)') < entry.index('destination.mkdir(exist_ok=False)') < entry.index('result = lifecycle.capture'))
check('exclusive-artifact-files-and-destination-check', "open('xb')" in entry and 'owned_destination_substituted' in entry)
check('publication-not-overclaimed', "'evidencePublicationVerified': False" in entry and "'externalFinalTimeAndExitReceiptRequired': True" in entry and 'retainedSha256=hashlib.sha256(raw).hexdigest()' in entry)
check('native-admission-false', all("'" + name + "': False" in entry for name in ('runtimeAccepted', 'buildAccepted', 'g1Accepted', 'hardTotalProven', 'historicalSupervisorIdentityEstablished', 'priorCandidateFullBracketAccepted')))
lifecycle = trees['supervision.py']
check('lifecycle-only-isolated-definitions', {n.name for n in lifecycle.body if isinstance(n, (ast.FunctionDef, ast.ClassDef))} == {'Refusal', 'Budget', 'capture'} and not any(isinstance(n, (ast.Import, ast.ImportFrom)) for n in ast.walk(lifecycle)))
capture = next(n for n in lifecycle.body if isinstance(n, ast.FunctionDef) and n.name == 'capture')
check('required-injected-ports-no-native-defaults', [n.arg for n in capture.args.kwonlyargs] == ['spawn', 'make_thread', 'sleep'] and capture.args.kw_defaults == [None, None, None])
text_capture = ast.unparse(capture)
check('retained-caps-and-literal-eof', "('stdout', 32768)" in text_capture and "('stderr', 65536)" in text_capture and "content == b''" in text_capture)
check('structured-reader-status-refusal', 'def reader_alive' in text_capture and 'reader_state:' in text_capture and 'return True' in text_capture)
check('no-physical-tree-or-hard-time-claim', all("'" + n + "': False" in text_capture for n in ('hardTotalProven', 'descendantTeardownQualified', 'runtimeAccepted')))

result = {'candidate': candidate, 'tree': git('rev-parse', candidate + '^{tree}').decode().strip(), 'base': base, 'changedFiles': len(changes), 'manifestMembers': len(member_names), 'sources': source_rows, 'facts': facts, 'passed': sum(x['passed'] for x in facts), 'failed': sum(not x['passed'] for x in facts), 'candidateImported': False, 'candidateDefinitionsExecuted': False, 'nativeOperations': False, 'runtimeAccepted': False, 'scope': 'source and AST data only; missing bindings/publication/native identity remain HOLD'}
output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
raise SystemExit(0 if result['failed'] == 0 else 1)
