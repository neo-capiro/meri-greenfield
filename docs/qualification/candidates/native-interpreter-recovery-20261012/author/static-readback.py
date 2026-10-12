"""Read source/AST as data only; never import or execute runner modules."""
import ast
import hashlib
import json
from pathlib import Path
import stat

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
NAMES = ['scripts/qualification/worker_runner_capture.py',
         'scripts/qualification/worker_runner_inventory.py',
         'scripts/qualification/worker_build_binding.py',
         'scripts/qualification/worker_image_build.py',
         'docs/qualification/candidates/native-ancestor-diagnosis-20261012/inspect-ancestor-metadata.py']
texts = {p: (ROOT / p).read_text() for p in NAMES}
trees = {p: ast.parse(text) for p, text in texts.items()}

def function(path, name):
    return next(n for n in trees[path].body if isinstance(n, ast.FunctionDef) and n.name == name)

def calls(node):
    return sorted(set(ast.unparse(n.func) for n in ast.walk(node) if isinstance(n, ast.Call)))

capture, inventory, binding, builder, diagnostic = NAMES
assert "runtime['version'] != [3, 11, 15]" in texts[capture]
assert "sys.version_info[:3] != (3, 11, 15)" in texts[diagnostic]
assert 'sys.version_info[:3] == (3, 12, 14)' in texts[builder]
assert 'Path(sys.executable) == PYTHON' in texts[builder]
assert 'builder.pins' not in calls(function(capture, 'capture'))
assert 'filesystem.inventory' in calls(function(capture, 'capture'))
assert 'getattr(info, \'st_file_attributes\', 0) & 0x400' in texts[inventory]
assert 'info.st_nlink != 1' in texts[inventory]
assert 'sys.executable' not in texts[diagnostic]
assert "'basePrefix'" in texts[diagnostic]
assert 'worker_build_binding.validate_proposal' in calls(function(builder, 'main'))
assert 'worker_build_binding.validate_review' not in calls(function(builder, 'main'))
assert 'worker_build_binding.require_observed_binding' not in calls(function(builder, 'main'))
assert "'prepare takes no runner override'" in texts[builder]
assert "'execute takes no runner override'" in texts[builder]
helpers = next(n for n in trees[builder].body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HELPERS' for t in n.targets))
helper_count = len(ast.literal_eval(helpers.value))
assert helper_count == 9
raw = (ROOT / diagnostic).read_bytes()
assert len(raw) == 6297 and hashlib.sha256(raw).hexdigest() == '9514b8e8ad0aff24e1eea7e782dd32178d856011fafcb750ce2c0f9a715c6efd'
assert stat.S_ISDIR(16895) and not stat.S_ISLNK(16895)
assert 1040 == 0x410 and 1040 & 0x400 and hex(2684354563) == '0xa0000003'
records=[]
for path in NAMES:
 raw=(ROOT/path).read_bytes()
 records.append({'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                 'functions':[{'name':n.name,'firstLine':n.lineno,'lastLine':n.end_lineno}
                              for n in trees[path].body if isinstance(n,ast.FunctionDef)]})
result={'result':'PASS_STATIC_SOURCE_ONLY','baseCommit':'690bac4cd44112b161d8e02818aeae7639ce237a',
        'sources':records,'captureRuntimeVersion':[3,11,15], 'historicalBuilderRuntimeVersion':[3,12,14],
        'captureInvokesLegacyPins':False,'diagnosticCoversExecutable':False,
        'baseBuilderHelpers':helper_count,'captureHelperCount':helper_count+3,
        'inspectBindingExpectedHelperCount':helper_count+1,
        'reportedNumericDecode':{'directory':True,'symbolicLink':False,'reparseAttribute':True,'attributesHex':'0x410','tagHex':'0xa0000003'},
        'targetModulesImported':False,'nativeCollectorExecuted':False,'nativeIdentityVerified':False}
print(json.dumps(result,indent=2))
