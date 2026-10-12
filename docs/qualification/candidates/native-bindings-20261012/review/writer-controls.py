"""Run only AST-isolated new writer definitions against memory-only ports."""
import ast
import hashlib
import json
from pathlib import Path
import runpy
import stat
import sys

raw = Path(sys.argv[1]).read_bytes()
tree = ast.parse(raw)
selected = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in {'Refusal', 'write_reserved'}]
assert {n.name for n in selected} == {'Refusal', 'write_reserved'}
for node in ast.walk(ast.Module(body=selected, type_ignores=[])):
    assert not isinstance(node, (ast.Import, ast.ImportFrom))
    if isinstance(node, ast.Name):
        assert node.id not in {'os', 'subprocess', 'threading', 'socket', 'ctypes', '__import__', 'eval', 'exec', 'open'}
cap_node = next(n.value for n in tree.body if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and n.targets[0].id == 'CAPS')
env = {'hashlib': hashlib, 'Path': Path, 'stat': stat, 'CAPS': ast.literal_eval(cap_node)}
exec(compile(ast.Module(body=selected, type_ignores=[]), '<isolated-new-evidence-writer>', 'exec'), env)
storage = runpy.run_path(str(Path(__file__).with_name('inert-storage.py')))
Memory, SLOT = storage['Memory'], storage['SLOT']
write = env['write_reserved']
facts = []

def check(name, value, detail=None):
    facts.append({'case': name, 'passed': bool(value), 'detail': detail})

def run(name, mode='valid', artifacts=None, owner=(1, 2), initial=0):
    m = Memory(mode=mode); m.clock.now = initial
    supplied = {'command-receipt.json': b'{"synthetic":true}', 'stdout.bin': b'abc', 'stderr.bin': b''} if artifacts is None else artifacts
    try:
        result = write(SLOT, owner, supplied, budget=m.budget, inventory=m, fs=m, writes=m)
    except Exception as error:
        check(name + '-structured-result', False, {'escapedClass': type(error).__name__})
        return None, m
    check(name + '-no-native-promotion', result['nativePublicationQualified'] is False and result['hardTotalProven'] is False and result['runtimeAccepted'] is False)
    check(name + '-partial-preservation-and-no-close-retry', result['partialFilesPreserved'] is True and len(m.closed) == len(set(m.closed)))
    return result, m

for mode in ('valid', 'short-write'):
    r, m = run(mode, mode)
    check(mode + '-exact-data-and-complete-observation', r is not None and r['readbackAndMembershipMatched'] and bytes(m.files['command-receipt.json']) == b'{"synthetic":true}' and bytes(m.files['stdout.bin']) == b'abc' and bytes(m.files['stderr.bin']) == b'' and len(m.closed) == 3 and m.readbacks == 6)

for mode in ('foreign-directory', 'symlink-member', 'hardlink-member', 'foreign-opened-file', 'zero-write', 'boolean-write', 'negative-write', 'oversized-write', 'error-open', 'error-write', 'error-fsync', 'error-fstat', 'error-close', 'error-readback', 'error-children-close', 'late-open', 'late-write', 'late-fsync', 'late-fstat', 'late-close', 'late-readback', 'late-final-membership', 'extra-member', 'duplicate-member', 'foreign-child', 'wrong-hash', 'wrong-size', 'substitute-after-readback'):
    r, m = run(mode, mode)
    check(mode + '-refuses', r is not None and not r['readbackAndMembershipMatched'])
    if mode in ('late-open', 'late-write', 'late-fsync', 'late-fstat', 'late-close', 'late-readback'):
        label = mode.removeprefix('late-'); index = m.calls.index(label)
        check(mode + '-no-further-material-ports', not any(x in ('open', 'write', 'fsync', 'readback') for x in m.calls[index + 1:]))
    if mode in ('late-open', 'late-write', 'late-fsync', 'late-fstat', 'late-close', 'error-write', 'error-fsync', 'error-fstat', 'error-close'):
        check(mode + '-owned-partial-kept-and-close-attempted', bool(m.files) and len(m.closed) == 1)

bad_artifacts = [({}, 'empty'), ({'stdout.bin': b'x'}, 'missing-receipt'), ({'command-receipt.json': b''}, 'empty-receipt'), ({'command-receipt.json': 'text'}, 'text'), ({'command-receipt.json': bytearray(b'x')}, 'mutable-bytes'), ({'command-receipt.json': b'x' * 262145}, 'receipt-cap'), ({'command-receipt.json': b'{}', 'stdout.bin': b'x' * 32769}, 'stdout-cap'), ({'command-receipt.json': b'{}', 'stderr.bin': b'x' * 65537}, 'stderr-cap'), ({'command-receipt.json': b'{}', '../foreign': b'x'}, 'traversal'), ({'command-receipt.json': b'{}', 'STDOUT.BIN': b'x'}, 'case-alias')]
for artifacts, name in bad_artifacts:
    r, m = run('input-' + name, artifacts=artifacts)
    check('input-' + name + '-zero-acquisition', r is not None and not r['readbackAndMembershipMatched'] and not m.opened and not m.files)
for owner, name in [([1, 2], 'mutable-owner'), ((True, 2), 'boolean-owner'), ((1, 9), 'wrong-owner')]:
    r, m = run(name, owner=owner)
    check(name + '-zero-acquisition', r is not None and not r['readbackAndMembershipMatched'] and not m.opened)
r, m = run('expired-before-entry', initial=15)
check('expired-entry-no-ports', r is not None and not r['readbackAndMembershipMatched'] and not m.calls)
r, m = run('reuse-first')
before = {name: bytes(value) for name, value in m.files.items()}; acquired = len(m.opened)
r = write(SLOT, (1, 2), {'command-receipt.json': b'changed'}, budget=m.budget, inventory=m, fs=m, writes=m)
check('occupied-slot-not-overwritten', not r['readbackAndMembershipMatched'] and {name: bytes(value) for name, value in m.files.items()} == before and len(m.opened) == acquired)
m = Memory(); original_remaining = m.budget.remaining; final_observations = [0]
def advancing_final_remaining(phase):
    if m.enumerations >= 6:
        final_observations[0] += 1
        if final_observations[0] >= 2:
            m.clock.now = 16.0
    return original_remaining(phase)
m.budget.remaining = advancing_final_remaining
r = write(SLOT, (1, 2), {'command-receipt.json': b'{}', 'stdout.bin': b'a', 'stderr.bin': b''}, budget=m.budget, inventory=m, fs=m, writes=m)
check('final-return-no-contradictory-expired-success', not (r['readbackAndMembershipMatched'] and r['remainingTotalSeconds'] <= 0), {'matched': r['readbackAndMembershipMatched'], 'remaining': r['remainingTotalSeconds'], 'clock': m.clock.now})
result = {'sourceSha256': hashlib.sha256(raw).hexdigest(), 'isolatedDefinitions': ['Refusal', 'write_reserved'], 'nativeAdapterExecuted': False, 'targetImported': False, 'nativeFilesystemOperations': 0, 'facts': facts, 'passed': sum(row['passed'] for row in facts), 'failed': sum(not row['passed'] for row in facts)}
Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
raise SystemExit(0 if result['failed'] == 0 else 1)
