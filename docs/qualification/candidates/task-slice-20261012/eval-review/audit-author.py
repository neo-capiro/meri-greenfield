"""Read immutable Git packet bytes only; does not run author code."""
import json,hashlib,subprocess,os
from pathlib import Path
root=Path(__file__).resolve().parents[5]
packet='a581f8a7b0024e7a29dd90253598051024f1fd9c';source='a57f5cf0e2345975ec11a3c2f43157c6e6769a73'
prefix='docs/qualification/candidates/task-slice-20261012/eval-author/'
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def data(p):return git('show',packet+':'+p)
raw=data(prefix+'manifest.json');m=json.loads(raw);checks=[]
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
check('exact author manifest identity',hashlib.sha256(raw).hexdigest()=='59f56adea20a0cc6b9264dc97dd5cea81ca558f3f8e11808097445383e2aefda')
check('accepted source identity',m['source']==source)
paths=[x['path'] for x in m['members']];check('35 unique member paths',len(paths)==35 and len(set(paths))==35)
for row in m['members']:
 b=data(row['path']);check('member '+row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
 if row['path'].startswith('evals/task-lookup/'):
  check('reviewed product '+row['path'],b==git('show',source+':'+row['path']))
actual=set(git('ls-tree','-r','--name-only',packet,'--',prefix,'evals/task-lookup','docs/coordination/tasks/CODEX-TASK-LOOKUP-EVAL-20261012.md','docs/coordination/reports/CODEX-TASK-LOOKUP-EVAL-20261012.md').decode().splitlines())
check('exact packet membership',actual==set(paths)|{prefix+'manifest.json',prefix+'verify-result.json'})
review=json.loads((Path(__file__).parent/'repaired.json').read_text());check('our consolidated replay success',review['exitCode']==0 and review['sourceDiffBytes']==0 and review['ownedProcessGroupAbsent'])
for p in paths:
 if not p.startswith(prefix) or not p.endswith('.json'):continue
 r=json.loads(data(p))
 if not isinstance(r,dict):continue
 group=r.get('ownedPidAndPgid',r.get('ownedPgid',r.get('processGroup')))
 if not isinstance(group,int):continue
 try:os.killpg(group,0);absent=False
 except ProcessLookupError:absent=True
 check('author group absent '+str(group),absent)
result={'packet':packet,'tree':git('rev-parse',packet+'^{tree}').decode().strip(),'source':source,'manifestSha256':hashlib.sha256(raw).hexdigest(),'members':len(paths),'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'scope':'GIT_METADATA_ONLY_NO_AUTHOR_CODE_EXECUTED'}
print(json.dumps(result,indent=2));raise SystemExit(0 if all(x['passed'] for x in checks) else 1)
