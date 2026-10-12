"""Offline byte preservation and captured-check audit; no private source body output."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
BASE='43ae31b367c2a1df56405bc0b9b0f1a5f27eae4a'
SOURCE='d86c0710b534fad7626856075bb873715e54b596'
FAMILY=['packages/contracts/retrieval-0.2/public-reports.schema.json','packages/contracts/retrieval-0.2/public-reports-validation.mjs','packages/contracts/test/retrieval-public-reports.test.mjs']
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
 check('reference-no-drift:'+r['path'],r['unchanged'])
check('source-not-executed',refs['sourceExecuted'],False);check('private-bodies-not-published',refs['privateBodiesPublished'],False)
for label,total in [('initial-independent',(26,24,2)),('corrected-independent',(31,31,0)),('full-source',(557,557,0)),('public-distribution',(7,7,0))]:
 r=json.loads((E/(label+'.json')).read_text());check(label+':exit',r['exitCode'],1 if total[2] else 0)
 check(label+':cleanup',r['ownedProcessGroupAbsent']);check(label+':timeout',r['timedOut'],False);check(label+':kill',r['ownedGroupKillRequired'],False)
 text=(E/(label+'.stdout.bin')).read_text()
 check(label+':counts',all(f'ℹ {key} {n}' in text for key,n in zip(['tests','pass','fail'],total)))
 for stream in r['streams']:
  b=(ROOT/stream['path']).read_bytes();check(label+':stream:'+Path(stream['path']).suffix,hashlib.sha256(b).hexdigest(),stream['sha256'])
result=dict(status='PASS' if all(x['passed'] for x in checks) else 'FAIL',sourceCommit=SOURCE,sourceTree=git('rev-parse',SOURCE+'^{tree}').decode().strip(),base=BASE,originalPaths=len(base),unchangedOriginalPaths=len(base)-len(changed),sourceFiles=files,checks=checks,passed=sum(x['passed'] for x in checks),failed=sum(not x['passed'] for x in checks),runtimeAccepted=False)
(E/'source-preservation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));raise SystemExit(bool(result['failed']))
