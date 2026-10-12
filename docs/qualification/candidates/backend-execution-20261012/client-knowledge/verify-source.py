"""Offline identity/projection audit. Never executes private producer code."""
import hashlib,json,pathlib,subprocess,os,re
root=pathlib.Path(__file__).resolve().parents[5]
evidence=pathlib.Path(__file__).resolve().parent
checks=[]
def check(ok,label):
 checks.append({'label':label,'pass':bool(ok)})
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd)
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
refs=json.loads((evidence/'reference-identities.json').read_text())
for ref in refs:
 for version in ref['versions']:
  result=subprocess.run(['git','show',version['commit']+':'+ref['path']],cwd='/workspace/capirov2',capture_output=True)
  if version.get('unavailable'):
   check(result.returncode!=0,'preserved missing locator '+ref['path']);continue
  check(result.returncode==0,'readable '+ref['path'])
  check(len(result.stdout)==version['bytes'] and hashlib.sha256(result.stdout).hexdigest()==version['sha256'],'reference bytes '+ref['path'])
  check(git('rev-parse',version['commit']+':'+ref['path'],cwd='/workspace/capirov2').decode().strip()==version['blob'],'reference blob '+ref['path'])
 before,after=ref['versions'];check(ref['drift']==(before.get('blob')!=after.get('blob')),'drift observation '+ref['path'])
originals={p:(mode,kind,obj) for mode,kind,obj,p in (line.split(None,3) for line in git('ls-tree','-r',base).decode().splitlines())}
current={p:(mode,kind,obj) for mode,kind,obj,p in (line.split(None,3) for line in git('ls-tree','-r','HEAD').decode().splitlines())}
check(all(current.get(p)==v for p,v in originals.items()),f'all {len(originals)} base paths unchanged')
changed=git('diff','--name-only',base,'HEAD').decode().splitlines()
check(all(p.startswith(('packages/contracts/retrieval-0.2/client-knowledge','packages/contracts/test/retrieval-client-knowledge','docs/qualification/candidates/backend-execution-20261012/client-knowledge/')) or p in ['docs/coordination/tasks/CODEX-CLIENT-KNOWLEDGE-20261012.md','docs/coordination/reports/CODEX-CLIENT-KNOWLEDGE-20261012.md'] for p in changed),'exclusive allocated paths')
check(not any('-independent' in p for p in changed),'independent tests untouched')
for p in sorted((root/'packages/contracts/retrieval-0.2').glob('client-knowledge*-validation.mjs')):
 text=p.read_text();check("snapshotOperationData" in text,'canonical inert boundary '+p.name)
 check(not re.search(r"from ['\"](?:@capiro|[^'\"]*apps/api|node:(?:fs|child_process|net|http|https))",text),'no private/runtime imports '+p.name)
 check('return page;' in text,'detached result return '+p.name)
inventory=json.loads((evidence/'profile-scalar-inventory.json').read_text());schema=json.loads((root/'packages/contracts/retrieval-0.2/client-knowledge-profile.schema.json').read_text())
check(inventory['count']==150==len(inventory['fields']),'150 profile scalar fields retained')
for model in {x['model'] for x in inventory['fields']}:
 fields={x['field']for x in inventory['fields']if x['model']==model};actual=schema['$defs']['Profile'+model]
 check(fields==set(actual['properties'])==set(actual['required']),'complete scalar model '+model)
for receipt in evidence.glob('*.json'):
 data=json.loads(receipt.read_text())
 if not isinstance(data,dict) or 'ownedPidAndPgid'not in data:continue
 check(data['ownedProcessGroupAbsent']and not data['timedOut'],'bounded captured exit '+receipt.name)
 for stream in data['streams']:
  blob=(root/stream['path']).read_bytes();check(len(blob)==stream['bytes']and hashlib.sha256(blob).hexdigest()==stream['sha256'],'raw output '+stream['path'])
 try:os.killpg(data['ownedPidAndPgid'],0)
 except ProcessLookupError:absent=True
 except PermissionError:absent=False
 else:absent=False
 check(absent,'owned group still absent '+str(data['ownedPidAndPgid']))
result={'sourceHead':git('rev-parse','HEAD').decode().strip(),'base':base,'passed':sum(x['pass']for x in checks),'total':len(checks),'checks':checks,'scope':'OFFLINE_SOURCE_ONLY'}
(evidence/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k]for k in ['sourceHead','passed','total','scope']}))
raise SystemExit(0 if all(x['pass']for x in checks)else 1)
