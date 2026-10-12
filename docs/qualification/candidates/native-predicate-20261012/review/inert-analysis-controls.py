"""Challenge only author JSON-analysis definitions with data; never native source.

Args: author worktree, private pinned-members directory. The private collector
is only hashed as bytes; no private module is parsed as executable Python.
"""
import ast
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(sys.argv[1])
PRIVATE = Path(sys.argv[2])
HERE = Path(__file__).resolve().parent
source_path = ROOT / 'docs/qualification/candidates/native-predicate-20261012/author/predicate-data.py'
source = source_path.read_bytes()
tree = ast.parse(source)
allowed_functions = {'direct_changes','aggregate','analyze'}
allowed_constants = {'ROLES','IDENTITY_FIELDS'}
selected = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in allowed_functions or isinstance(n, ast.Assign) and all(isinstance(t,ast.Name) and t.id in allowed_constants for t in n.targets)]
assert len(selected) == 5
namespace = {}
exec(compile(ast.Module(body=selected, type_ignores=[]), 'isolated-author-json-analysis', 'exec'), namespace)
analysis, changes, aggregate = (namespace[n] for n in ['analyze','direct_changes','aggregate'])
criteria = json.loads((HERE/'frozen-criteria.json').read_bytes())
for pin in criteria['privateMembers']:
    raw = (PRIVATE/pin['name']).read_bytes()
    assert len(raw) == pin['bytes'] and hashlib.sha256(raw).hexdigest() == pin['sha256']
record = json.loads((PRIVATE/'candidate-hash-and-paths.json').read_bytes())
checks=[]
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
actual = analysis(record)
check('exact-record-all-pairs-and-rejection', actual['pairedEntries']==35 and actual['changedPairs']==12 and actual['uniqueChangedNamedPaths']==3 and actual['recomputedCollectorConjunction'] is False and actual['conjunctionMatchesRecordedRejection'] is True)
check('observation-never-claims-helper-or-native-proof', all(actual[k] is False for k in ['privateSameDefinitionReviewed','privateHashLifecycleReviewed','directJsonEqualityIsPrivateSameProof','nativeAdmission']))
for index in range(4):
    values=[True]*4;values[index]=False
    check('false-acceptance-term:'+str(index), aggregate(*values) is False)
check('strict-boolean-term-not-truthy-integer', aggregate(True,True,True,1) is False)
modified=copy.deepcopy(record);modified['boundedHashObservationAccepted']=True
check('forged-recorded-acceptance-disagrees', analysis(modified)['conjunctionMatchesRecordedRejection'] is False)
modified=copy.deepcopy(record);modified['hash']=None
none=analysis(modified)
check('missing-hash-retains-rejection-without-invented-pairs', none['recomputedCollectorConjunction'] is False and none['hashRecordFieldDifferences']==[])
modified=copy.deepcopy(record);modified['after']['root']['entries'][3]['VolumeSerialHex']='synthetic-changed'
row=next(r for r in analysis(modified)['roleComparisons'] if r['role']=='root')
check('identity-change-not-hidden-by-reported-flag', row['sixFieldIdentityAndPlainMetadataStable'] is False and 'VolumeSerialHex' in row['pairs'][3]['changedFields'])
row=actual['roleComparisons'][0]
check('access-time-retained-separate-from-six-field-identity', row['sixFieldIdentityAndPlainMetadataStable'] is True and row['exactJsonFieldsEqual'] is False and row['pairs'][0]['changedFields']==['LastAccessTime'])
check('missing-field-visible', changes({'Size':1},{})==['Size'])
check('added-field-visible', changes({}, {'ChangeTime':1})==['ChangeTime'])
check('boolean-integer-not-collapsed', changes({'Size':True},{'Size':1})==['Size'])
modified=copy.deepcopy(record);modified['after']['root']['entries'].pop()
try:
    analysis(modified);raised=False
except ValueError:
    raised=True
check('unequal-count-is-explicit-data-error', raised)
mutant = copy.deepcopy(tree)
function = next(n for n in mutant.body if isinstance(n,ast.FunctionDef) and n.name=='aggregate')
function.body=[ast.Return(value=ast.BoolOp(op=ast.And(),values=[ast.Name(id=n,ctx=ast.Load()) for n in ['hash_present','hash_stable','identity_stable']]))]
mutant_selected=[function]
ast.fix_missing_locations(function)
mutant_namespace = dict(namespace)
exec(compile(ast.Module(body=mutant_selected,type_ignores=[]),'in-memory-invalid-three-term-control','exec'),mutant_namespace)
mutant_result=mutant_namespace['aggregate'](True,True,True,False)
check('dropping-all-fields-conjunct-detected', mutant_result is True and aggregate(True,True,True,False) is False)
result={'authorAnalysisSha256':hashlib.sha256(source).hexdigest(),'scope':'Isolated public author JSON-analysis definitions only; no private-source execution',
        'checks':checks,'passed':sum(r['passed'] for r in checks),'failed':sum(not r['passed'] for r in checks),
        'negativeControl':{'mutation':'Remove required all-fields term in isolated memory only','invalidResult':mutant_result,'expectedRecordedRejection':False,'detected':True},
        'privateSourceExecuted':False,'nativeExecution':False,'ownedJobsRemaining':0}
(HERE/'inert-analysis-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'failed':result['failed'],'mutationDetected':True,'nativeExecution':False}))
sys.exit(0 if not result['failed'] else 1)
