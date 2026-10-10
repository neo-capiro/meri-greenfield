"""Read-only v1/v2 representation comparison; data/AST only, no helper import."""
from pathlib import Path
import ast,hashlib,io,json,re,tokenize
HERE=Path(__file__).resolve().parent
V1=HERE.parent/'worker-build-v1'
sha=lambda b:hashlib.sha256(b).hexdigest()
PINS={
 'start-reviewed-worker-build.py':('c905283c7606daeb1cc3fb6369a935f3db5d3d32d9a86d9d406e180a890a2ca5','6b4b17a3531ea190d3abf1402a99c06e2a2d99009b90a0dc027c1d85d757905b'),
 'test_start_reviewed_worker_build.py':('35c2200137b390cd8852bf02e27bb45128fe3d154571371316fe0b6090be0830','4484d845620b9d02887bee742ed723309da35cc0ccb4cf52b4581f41c14924f2'),
 'worker-buildspec.json':('e055dff0860fa465087050fc2a9c7c6c318f94927fb4c16ac1115a89830cb356','cdd6edb8282f3fbf931162451493ee13e11d74e59fff0523cdd1f084609edd9c')}
for name,(old,new) in PINS.items():
 assert sha((V1/name).read_bytes())==old,name
 assert sha((HERE/name).read_bytes())==new,name
old=json.loads((V1/'worker-buildspec.json').read_bytes())
new=json.loads((HERE/'worker-buildspec.json').read_bytes())
a=old['phases']['build']['commands'][0];b=new['phases']['build']['commands'][0]
raw=(HERE/'worker-buildspec.json').read_bytes()
assert raw==(json.dumps(new,ensure_ascii=True,separators=(',',':'))+'\n').encode('ascii')
assert len(raw)==len(raw.decode('ascii'))==25592<=25600
pattern=re.compile(r"<<'PY'\n(.*?)\nPY(?:\n|$)",re.S)
aa=pattern.findall(a);bb=pattern.findall(b)
assert len(aa)==len(bb)==5
def dump(n):return ast.dump(n,include_attributes=False)
def semantic_tokens(code):
 return [(t.type,t.string) for t in tokenize.generate_tokens(io.StringIO(code).readline) if t.type!=tokenize.NL]
programs=[]
for n,(x,y) in enumerate(zip(aa,bb),1):
 ax=dump(ast.parse(x,type_comments=True));ay=dump(ast.parse(y,type_comments=True))
 assert ax==ay and semantic_tokens(x)==semantic_tokens(y)
 assert ''.join(x.split())==''.join(y.split())
 programs.append(dict(index=n,originalBytes=len(x),candidateBytes=len(y),astSha256=sha(ax.encode()),semanticTokenSha256=sha(json.dumps(semantic_tokens(x)).encode()),astEqual=True,semanticTokensEqual=True,onlyWhitespaceEdited=True))
def outside(code):return pattern.sub("<<'PY'\n<PROGRAM>\nPY\n",code)
oa,ob=outside(a),outside(b)
assert re.sub(r'(?m)^ +','',oa)==re.sub(r'(?m)^ +','',ob)
assert len(oa)-len(ob)==40 and not re.search(r'(?m)^ +',ob)
inline=re.compile(r"^bound 15 python3 -I -c '([^'\n]*)'$",re.M)
ia,ib=inline.findall(a),inline.findall(b)
assert len(ia)==len(ib)==3 and ia==ib
old['phases']['build']['commands'][0]=b
assert old==new
def node_map(path):
 values={}
 for n in ast.parse(path.read_bytes()).body:
  if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):key=n.name
  elif isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name):key=n.targets[0].id
  else:key=dump(n)
  assert key not in values;values[key]=n
 return values
before=node_map(V1/'start-reviewed-worker-build.py')
after=node_map(HERE/'start-reviewed-worker-build.py')
assert set(after)-set(before)=={'INLINE_BUILDSPEC_MAX_BYTES','checked_inline_buildspec'}
assert not set(before)-set(after)
changed=[k for k in before if dump(before[k])!=dump(after[k])]
assert changed==['expected_content','build_input_for']
assert after['INLINE_BUILDSPEC_MAX_BYTES'].value.value==25600
# Normalize precisely the newly added validator call, then require old AST.
class RemoveSizeWrapper(ast.NodeTransformer):
 def visit_Call(self,node):
  node=self.generic_visit(node)
  if isinstance(node.func,ast.Name) and node.func.id=='checked_inline_buildspec':
   assert len(node.args)==1 and isinstance(node.args[0],ast.Name) and node.args[0].id=='raw'
   return node.args[0]
  return node
assert dump(RemoveSizeWrapper().visit(after['expected_content']))==dump(before['expected_content'])
actual=after['build_input_for']
assert isinstance(actual.body[0],ast.Expr) and isinstance(actual.body[0].value,ast.Call) and actual.body[0].value.func.id=='require'
assert isinstance(actual.body[1],ast.Expr) and isinstance(actual.body[1].value,ast.Call) and actual.body[1].value.func.id=='checked_inline_buildspec'
actual.body=actual.body[2:]
assert dump(actual)==dump(before['build_input_for'])
# Unchanged prepare/execute ASTs retain their reviewed guard/transaction order.
helper=(HERE/'start-reviewed-worker-build.py').read_text(encoding='utf-8')
assert helper.index('content = expected_content(commit)  #')<helper.index('archive, count = archive_bytes(commit, content)')
execute=helper[helper.index('def execute('):]
assert execute.index('content = expected_content(commit)')<execute.index("save(evidence / 'execution-reserved.json'")<execute.index("identity('upload-identity')")
assert execute.index('start = build_input_for(')<execute.index("identity('start-identity')")<execute.index("build = aws('start-build'")
tests=(HERE/'test_start_reviewed_worker_build.py').read_text(encoding='utf-8')
assert "HELPER = TOOL_DIR / 'start-reviewed-worker-build.py'" in tests
assert "SPEC_BYTES = (TOOL_DIR / 'worker-buildspec.json').read_bytes()" in tests
assert "ROOT / '.task-inputs/worker-buildspec.json'" not in tests
print(json.dumps(dict(schema='worker-build-v2-read-only-comparison/1',candidateBytes=len(raw),candidateASCIICharacters=len(raw),maxInlineBytes=25600,margin=8,programs=programs,outerBashOnly40LeadingSpacesRemoved=True,inlineIdentityProgramsByteIdentical=3,otherBuildspecFieldsEqual=True,existingHelperFunctionsChanged=changed,newHelperNodes=['INLINE_BUILDSPEC_MAX_BYTES','checked_inline_buildspec'],remainingHelperASTEqual=True,prepareExecuteASTUnchanged=True,sizeGuardBeforePreparationAndReservation=True,dispatchInputRevalidationPreserved=True,testsUseAdjacentCandidate=True,sourceOnly=True,helperInvoked=False,awsCalls=0),indent=2,sort_keys=True))
