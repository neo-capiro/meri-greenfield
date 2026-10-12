"""Read-only Git and receipt integrity audit; never imports product or private code."""
import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
BASE='e5fb3963de787bbd7b7663316c368f15814897da';SOURCE='814ecf1baa1b5890545576a0815257199505103a'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 result={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if not row:continue
  meta,path=row.split(b'\t',1);result[path.decode()]=meta.decode()
 return result
checks=[]
def check(name,condition):checks.append({'name':name,'pass':bool(condition)})
a,b,c=tree(BASE),tree(SOURCE),tree('HEAD')
check('all baseline modes and blobs unchanged in source',all(b.get(p)==v for p,v in a.items()))
check('all baseline modes and blobs unchanged in review',all(c.get(p)==v for p,v in a.items()))
products=[p for p in b if p not in a and p.startswith(('apps/artifacts/','packages/contracts/artifacts-0.2/'))]
check('exact14 product and author-test additions',len(products)==14)
check('author source additions allocated only',all(p in a or p in products or p=='docs/coordination/tasks/CODEX-ARTIFACT-EXECUTION-20261012.md' for p in b))
identities=[]
for p in products:
 data=git('show',SOURCE+':'+p);identities.append({'path':p,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'modeBlob':b[p]})
 check('exact source '+p,c.get(p)==b[p] and (root/p).read_bytes()==data)
for ref in json.loads((e/'baseline-identities.json').read_text())['references']:
 data=git('show',SOURCE+':'+ref['path'])
 check('reference '+ref['path'],len(data)==ref['bytes'] and hashlib.sha256(data).hexdigest()==ref['sha256'])
receipts=[]
for p in sorted(e.glob('*.json')):
 item=json.loads(p.read_text())
 if not isinstance(item,dict) or 'ownedPidAndPgid' not in item:continue
 check('receipt zero source diff '+p.name,item['sourceDiffBytes']==0)
 check('owned process absent receipt '+p.name,item['ownedProcessGroupAbsent'] and not item['timedOut'])
 try:os.killpg(item['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('owned process absent now '+p.name,absent)
 for s in item['streams']:
  data=(root/s['path']).read_bytes();check('raw stream '+s['path'],len(data)==s['bytes'] and hashlib.sha256(data).hexdigest()==s['sha256'])
 receipts.append({'path':p.relative_to(root).as_posix(),'exitCode':item['exitCode'],'sourceHead':item['sourceHead'],'ownedPidAndPgid':item['ownedPidAndPgid']})
raw=(e/'final-focused.stdout.bin').read_text();check('final exact115 no failures or skips','tests 115' in raw and 'pass 115' in raw and 'fail 0' in raw and 'skipped 0' in raw)
check('original overflow value retained',json.loads((e/'adapter-first-integer-result.json').read_text())['data'][0][2]==-2048)
check('first four actual service failures retained','pass 16' in (e/'service-corrected-oracle.stdout.bin').read_text() and 'fail 4' in (e/'service-corrected-oracle.stdout.bin').read_text())
check('original adapters6pass2fail retained','pass 6' in (e/'first-adapters.stdout.bin').read_text() and 'fail 2' in (e/'first-adapters.stdout.bin').read_text())
check('general test present and committed',c.get('packages/contracts/test/artifact-execution-independent-general.test.mjs') is not None and (root/'packages/contracts/test/artifact-execution-independent-general.test.mjs').is_file())
result={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'reviewHead':git('rev-parse','HEAD').decode().strip(),'preservedOriginalEntries':len(a),'products':identities,'receipts':receipts,'checks':checks,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'runtimeAcceptance':False}
(e/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['source','sourceTree','preservedOriginalEntries','passed','failed']}));raise SystemExit(result['failed']!=0)
