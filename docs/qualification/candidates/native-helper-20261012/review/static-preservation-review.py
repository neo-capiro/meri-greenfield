"""Read-only source and Git preservation audit; no target imports or execution."""
import ast
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(sys.argv[1]); CANDIDATE=sys.argv[2]; LABEL=sys.argv[3]
BASE='bf41cf69ebe892705cdd6f041dd2f1fb323048f5'
HERE=Path(__file__).resolve().parent
PATH='scripts/qualification/worker_runner_inventory.py'
rows=[]
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args])
def check(name,value):rows.append({'name':name,'passed':bool(value)})
def dump(node):return ast.dump(node,include_attributes=False)
before=git('show',BASE+':'+PATH);after=git('show',CANDIDATE+':'+PATH)
check('worktree-source-equals-exact-freeze',(ROOT/PATH).read_bytes()==after)
check('original-baseline-byte-pin',len(before)==13224 and hashlib.sha256(before).hexdigest()=='7615e26a5d038ff2fa054cde3cdb04077def5636874f848c97e050dae9df03e9')
old=ast.parse(before);new=ast.parse(after)
old_fn={n.name:n for n in old.body if isinstance(n,ast.FunctionDef)}
new_fn={n.name:n for n in new.body if isinstance(n,ast.FunctionDef)}
check('same-top-level-functions',set(old_fn)==set(new_fn))
check('only-two-authorized-top-level-nodes-change',[dump(n) for n in old.body if not (isinstance(n,ast.FunctionDef) and n.name in {'ancestors','hash_file'})]==[dump(n) for n in new.body if not (isinstance(n,ast.FunctionDef) and n.name in {'ancestors','hash_file'})])
check('hash-file-signature-unchanged',dump(old_fn['hash_file'].args)==dump(new_fn['hash_file'].args))
a=new_fn['ancestors'].args
check('ancestor-pair-is-keyword-only',[x.arg for x in a.args]==['path','fs'] and [x.arg for x in a.kwonlyargs]==['clock','end'] and all(isinstance(x,ast.Constant) and x.value is None for x in a.kw_defaults))

class Normalize(ast.NodeTransformer):
    def __init__(self,kind):self.kind=kind;self.saved={}
    def visit_Expr(self,node):
        if isinstance(node.value,ast.Constant) and isinstance(node.value.value,str):return None
        if isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Name) and node.value.func.id=='check_deadline':return None
        return self.generic_visit(node)
    def visit_Assign(self,node):
        if self.kind=='hash_file' and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in {'opened_after','after','result'}:
            self.saved[node.targets[0].id]=copy.deepcopy(node.value);return None
        return self.generic_visit(node)
    def visit_Name(self,node):
        if isinstance(node.ctx,ast.Load) and node.id in self.saved:return copy.deepcopy(self.saved[node.id])
        return node
    def visit_Call(self,node):
        node=self.generic_visit(node)
        if isinstance(node.func,ast.Name) and node.func.id=='ancestors':node.keywords=[]
        return node
    def visit_If(self,node):
        if self.kind=='ancestors' and isinstance(node.test,ast.Compare):
            # Only remove the exact allocated pair refusal; assert its form separately.
            if ast.unparse(node.test)=='(clock is None) != (end is None)':return None
        node=self.generic_visit(node)
        if not node.body and not node.orelse:return None
        return node

pair=new_fn['ancestors'].body[1]
check('explicit-incomplete-pair-refusal',ast.unparse(pair)=="if (clock is None) != (end is None):\n    raise ValueError('runner ancestor deadline pair required')")
for kind in ['hash_file','ancestors']:
    left=Normalize(kind).visit(copy.deepcopy(old_fn[kind]));right=Normalize(kind).visit(copy.deepcopy(new_fn[kind]));right.args=copy.deepcopy(left.args)
    check('original-'+kind+'-predicates-order-and-result-preserved',dump(left)==dump(right))
check('named-opened-identity-predicate-unchanged',dump(old_fn['identity'])==dump(new_fn['identity']))
check('plain-file-hardlink-symlink-reparse-predicates-unchanged',dump(old_fn['plain'])==dump(new_fn['plain']))
check('deadline-exact-boundary-comparator-unchanged',dump(old_fn['check_deadline'])==dump(new_fn['check_deadline']))
status=git('diff','--name-status',BASE,CANDIDATE).decode().splitlines()
existing=[line.split('\t')[-1] for line in status if not line.startswith('A\t')]
check('only-one-existing-file-changed',existing==[PATH])
added=[line.split('\t')[-1] for line in status if line.startswith('A\t')]
allowed=lambda p:p=='scripts/qualification/test_worker_runner_hash_deadline.py' or p.startswith('docs/qualification/candidates/native-helper-20261012/author/') or p in {'docs/coordination/tasks/MERI-NATIVE-HELPER-SOURCE-20261012.md','docs/coordination/reports/MERI-NATIVE-HELPER-SOURCE-20261012.md'}
check('all-added-files-within-author-allocation',all(allowed(p) for p in added))
check('maintained-inert-regression-added','scripts/qualification/test_worker_runner_hash_deadline.py' in added)
base_names=git('ls-tree','-r','--name-only',BASE).decode().splitlines()
check('all-original-tests-byte-preserved',all(p not in existing for p in base_names if '/test' in p or p.endswith('_test.py')))
anchors=json.loads((HERE/'frozen-criteria.json').read_text())['sourceAnchors'][1:]
check('supervisor-lifecycle-writer-anchors-unchanged',all(hashlib.sha256(git('show',CANDIDATE+':'+v['path'])).hexdigest()==v['sha256'] for v in anchors))
check('all-other-baseline-tracked-files-preserved',len(existing)==1 and existing[0]==PATH)
result={'base':BASE,'candidate':CANDIDATE,'candidateTree':git('rev-parse',CANDIDATE+'^{tree}').decode().strip(),'inventory':{'path':PATH,'bytes':len(after),'sha256':hashlib.sha256(after).hexdigest()},'baselineTrackedFiles':len(base_names),'existingChanged':existing,'addedFiles':added,'checks':rows,'passed':sum(r['passed'] for r in rows),'failed':sum(not r['passed'] for r in rows),'targetImports':False,'nativeExecution':False}
(HERE/(LABEL+'.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'failed':result['failed']}))
sys.exit(0 if result['failed']==0 else 1)
