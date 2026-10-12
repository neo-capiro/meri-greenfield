"""Independent AST/Git/data inspection; never import candidate modules."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import sys

root, freeze, output = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
base = '263d0d174f9924a6030bb1c20100ff1115ffcda0'
wrapper_path = 'docs/qualification/candidates/native-supervisor-20261012/author/run-supervised.py'
prefix = 'docs/qualification/candidates/native-bindings-20261012/author/'
facts = []

def git(*args):
    return subprocess.check_output(['git', '-C', str(root), *args])

def read(path, ref=freeze):
    return git('show', ref + ':' + path)

def check(name, value, detail=None):
    facts.append({'case': name, 'passed': bool(value), 'detail': detail})

def dump(node):
    return ast.dump(node, include_attributes=False)

check('exact-clean-freeze', git('rev-parse', 'HEAD').decode().strip() == freeze and git('status', '--porcelain') == b'')
changes = [line.split('\t') for line in git('diff', '--name-status', base, freeze).decode().splitlines()]
check('one-existing-path-only', [r for r in changes if r[0] != 'A'] == [['M', wrapper_path]], changes)
check('all-new-paths-allocated', all(r[1].startswith(prefix) or r[1] in ('docs/coordination/tasks/MERI-NATIVE-BINDINGS-20261012.md', 'docs/coordination/reports/MERI-NATIVE-BINDINGS-20261012.md') for r in changes if r[0] == 'A'))
for anchor in json.loads(Path(__file__).with_name('frozen-criteria.json').read_text())['originalAnchors']:
    path = anchor['path']
    if path == wrapper_path:
        continue
    raw = read(path)
    check('protected-original:' + path, raw == read(path, base) and len(raw) == anchor['bytes'] and hashlib.sha256(raw).hexdigest() == anchor['sha256'])
old, current = ast.parse(read(wrapper_path, base)), ast.parse(read(wrapper_path))
old_functions = {n.name: n for n in old.body if isinstance(n, ast.FunctionDef)}
functions = {n.name: n for n in current.body if isinstance(n, ast.FunctionDef)}
check('same-wrapper-function-owners', set(old_functions) == set(functions))
for name, node in functions.items():
    if name not in ('fixed_git', 'run_supervised'):
        check('unchanged-wrapper-function:' + name, dump(node) == dump(old_functions[name]))
check('all-old-constants-and-imports-unchanged', [dump(n) for n in current.body if not isinstance(n, ast.FunctionDef)] == [dump(n) for n in old.body if not isinstance(n, ast.FunctionDef)])
capture_call = functions['fixed_git'].body[0].value
check('exact-readonly-git-argv', ast.unparse(capture_call.args[0]) == "[GIT_EXECUTABLE, '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-C', repository, *args]")
check('git-same-clock-and-capture-ports', ast.unparse(capture_call.func) == 'capture' and [ast.unparse(n) for n in capture_call.args[1:]] == ['repository', 'budget'] and [(k.arg, ast.unparse(k.value)) for k in capture_call.keywords] == [('spawn', 'native_spawn'), ('make_thread', 'native_thread'), ('sleep', 'time.sleep')])
check('git-full-status-preserved', "['status', '--porcelain', '--untracked-files=all']" in ast.unparse(functions['verify_original_source']) and '--ignore-submodules=all' not in ast.unparse(current))
entry = functions['run_supervised']
check('writer-explicit-trusted-dependency', [a.arg for a in entry.args.kwonlyargs] == ['lifecycle', 'inventory', 'evidence_writer'] and entry.args.kw_defaults == [None, None, None])

def prefix_before_artifact(node):
    nodes = []
    for n in node.body[1:]:
        nodes.append(n)
        if isinstance(n, ast.Assign) and ast.unparse(n.targets[0]) == "artifacts['command-receipt.json']":
            break
    return ast.Module(body=nodes, type_ignores=[])

old_prefix = prefix_before_artifact(old_functions['run_supervised'])
for node in ast.walk(old_prefix):
    if isinstance(node, ast.Dict):
        for index, key in enumerate(node.keys):
            if isinstance(key, ast.Constant) and key.value == 'publicationHold':
                node.values[index] = ast.Constant('native publication unqualified; final observations returned to external owner')
check('all-prepublication-statements-preserved', dump(old_prefix) == dump(prefix_before_artifact(entry)))
tail = entry.body[-3:]
check('exact-writer-composition-tail', ast.unparse(tail[0]) == 'publication = evidence_writer.write_reserved(destination, owned, artifacts, budget=budget, inventory=inventory, fs=fs, writes=evidence_writer.NativeWrites())' and ast.unparse(tail[1]) == "receipt['publicationObservation'] = publication" and ast.unparse(tail[2]) == 'return receipt')
text_entry = ast.unparse(entry)
check('immutable-missing-pins-still-before-ports', text_entry.index('HOLD_unresolved_exact_preservation_records') < text_entry.index('inventory.Filesystem') and text_entry.index('HOLD_unresolved_native_git_identity') < text_entry.index('inventory.Filesystem'))
check('native-publication-and-runtime-flags-false', all("'" + key + "': False" in text_entry for key in ('evidencePublicationVerified', 'hardTotalProven', 'runtimeAccepted', 'buildAccepted', 'g1Accepted')))
writer_raw = read(prefix + 'evidence-writer.py'); writer = ast.parse(writer_raw)
check('writer-top-level-no-effects', all(isinstance(n, (ast.Import, ast.ImportFrom, ast.Assign, ast.ClassDef, ast.FunctionDef)) or isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant) for n in writer.body))
caps = next(ast.literal_eval(n.value) for n in writer.body if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name) and n.targets[0].id == 'CAPS')
check('exact-three-artifact-caps', caps == {'stdout.bin': 32768, 'stderr.bin': 65536, 'command-receipt.json': 262144})
native = next(n for n in writer.body if isinstance(n, ast.ClassDef) and n.name == 'NativeWrites')
native_text = ast.unparse(native)
check('native-exclusive-adapter-mode', all(value in native_text for value in ('os.O_WRONLY | os.O_CREAT | os.O_EXCL', 'O_NOFOLLOW', 'O_BINARY', 'os.open(path, flags, 384)', 'os.write(', 'os.fsync(', 'os.fstat(', 'os.close(')))
check('no-delete-rename-replace-or-retry-port', not any(isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in {'unlink', 'rmdir', 'remove', 'replace', 'rename', 'rmtree'} for n in ast.walk(writer)))
body = next(n for n in writer.body if isinstance(n, ast.FunctionDef) and n.name == 'write_reserved')
check('writer-required-ports', [a.arg for a in body.args.kwonlyargs] == ['budget', 'inventory', 'fs', 'writes'] and body.args.kw_defaults == [None] * 4)
text_body = ast.unparse(body)
check('canonical-readback-and-same-deadline', 'inventory.hash_file(' in text_body and 'clock=budget.clock' in text_body and 'end=budget.total_end' in text_body and 'budget = ' not in text_body)
check('source-observation-only', all("'" + name + "': False" in text_body for name in ('nativePublicationQualified', 'hardTotalProven', 'runtimeAccepted')))
check('fixed-grammar-precedes-first-filesystem-port', text_body.index('fixed_artifact_names_required') < text_body.index('inventory.ancestors(destination, fs)'))
check('old-historical-check-retained', read('docs/qualification/candidates/native-supervisor-20261012/author/source-checks.py') == read('docs/qualification/candidates/native-supervisor-20261012/author/source-checks.py', base))
sources = []
for path in (wrapper_path, prefix + 'evidence-writer.py', prefix + 'source-checks.py'):
    raw = read(path); ast.parse(raw)
    sources.append({'path': path, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    check('current-bytes-match-freeze:' + path, raw == (root / path).read_bytes())
result = {'freeze': freeze, 'tree': git('rev-parse', freeze + '^{tree}').decode().strip(), 'base': base, 'changes': changes, 'sources': sources, 'facts': facts, 'passed': sum(r['passed'] for r in facts), 'failed': sum(not r['passed'] for r in facts), 'candidateModulesImported': False, 'nativeCalls': 0, 'runtimeAccepted': False}
output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
raise SystemExit(0 if result['failed'] == 0 else 1)
