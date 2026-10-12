"""Offline byte preservation and captured-check audit; no private source body output."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
BASE='ec960fa92ad01836a5df8f6220e67a88a657eab1'
SOURCE='fbe72ed67b953a991f590ed40767e27c17ee114b'
FAMILY=['packages/contracts/retrieval-0.2/acquisition-personnel.schema.json','packages/contracts/retrieval-0.2/acquisition-personnel-validation.mjs','packages/contracts/test/retrieval-acquisition-personnel.test.mjs']
checks=[]
def check(name,actual,expected=True):checks.append(dict(name=name,passed=actual==expected,actual=actual,expected=expected))
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def tree(ref):
 out={}
 for line in git('ls-tree','-rz','--full-tree',ref).split(b'\0'):
  if line:
   descriptor,path=line.split(b'\t',1);out[path.decode()]=descriptor.split()[2].decode()
 return out
base=tree(BASE);source=tree(SOURCE)
changed=[p for p,b in base.items() if source.get(p)!=b]
check('all-original-paths-unchanged',changed,[])
added=sorted(set(source)-set(base));check('exact-three-new-family-files',added,sorted(FAMILY))
files=[]
for p in FAMILY:
 raw=(ROOT/p).read_bytes();frozen=git('show',SOURCE+':'+p)
 check('exact-source:'+p,raw==frozen)
 files.append(dict(path=p,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
refs=json.loads((E/'reference-identities.json').read_text())
for r in refs['references']:
 check('reference-drift-accounted:'+r['path'],r['unchanged'],r['blob']==r['observedBlob'])
check('source-not-executed',refs['sourceExecuted'],False);check('private-bodies-not-published',refs['privateBodiesPublished'],False)
for label,total in [('initial-independent',(21,20,1)),('repaired-independent',(21,21,0)),('expanded-independent',(25,25,0)),('full-source',(877,877,0)),('public-distribution',(7,7,0))]:
 r=json.loads((E/(label+'.json')).read_text());check(label+':exit',r['exitCode'],1 if total[2] else 0)
 check(label+':cleanup',r['ownedProcessGroupAbsent']);check(label+':timeout',r['timedOut'],False);check(label+':kill',r['ownedGroupKillRequired'],False)
 text=(E/(label+'.stdout.bin')).read_text()
 check(label+':counts',all(f'ℹ {key} {n}' in text for key,n in zip(['tests','pass','fail'],total)))
 for stream in r['streams']:
  b=(ROOT/stream['path']).read_bytes();check(label+':stream:'+Path(stream['path']).suffix,hashlib.sha256(b).hexdigest(),stream['sha256'])

check('exact-three-current-reference-drifts',sum(not r['unchanged'] for r in refs['references']),3)
initial='2a35e072d13fe93e3b57a9d47544df472cdcd8d4'
oldschema=json.loads(git('show',initial+':'+FAMILY[0]));newschema=json.loads((ROOT/FAMILY[0]).read_text())
newschema['$defs']['AcquisitionPersonnelSearchInput']['properties'].pop('q')
newschema['$defs']['AcquisitionPersonnelSearchInput']['properties']['query']={'type':'string'}
check('schema-repair-only-query-alias',newschema,oldschema)
oldmodule=git('show',initial+':'+FAMILY[1]).decode();newmodule=(ROOT/FAMILY[1]).read_text()
start=newmodule.index('   // The established wrapper prefers');end=newmodule.index('   for(const [key,cap]',start)
check('validator-repair-only-alias-normalization',newmodule[:start]+newmodule[end:],oldmodule)
oldtest=git('show',initial+':'+FAMILY[2]).decode();newtest=(ROOT/FAMILY[2]).read_text()
prefix=newtest.split('\n// Added after independent review preserved')[0]
prefix=prefix.replace("{query_alias:'unknown selector'}","{q:'hidden alias'}")
check('original-author-assertions-recovered',prefix.rstrip('\n'),oldtest.rstrip('\n'))
independent='packages/contracts/test/retrieval-acquisition-personnel-independent.test.mjs'
originalcontrols=git('show','7a58c32:'+independent)
check('original-review-controls-unchanged-prefix',(ROOT/independent).read_bytes().startswith(originalcontrols))

result=dict(status='PASS' if all(x['passed'] for x in checks) else 'FAIL',sourceCommit=SOURCE,sourceTree=git('rev-parse',SOURCE+'^{tree}').decode().strip(),base=BASE,originalPaths=len(base),unchangedOriginalPaths=len(base)-len(changed),sourceFiles=files,checks=checks,passed=sum(x['passed'] for x in checks),failed=sum(not x['passed'] for x in checks),runtimeAccepted=False)
(E/'source-preservation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));raise SystemExit(bool(result['failed']))
