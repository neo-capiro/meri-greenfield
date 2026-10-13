"""Read-only exact-source/package audit; no application, build or network execution."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[5];evidence=Path(__file__).resolve().parent
base='afcdd9312f3ccdf60a9b7fdb0fa0a42509224707';source='3a6e3391b8fb3bb8113496c897f997683a27da2d'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def blob(ref,p):return git('show',f'{ref}:{p}')
def tree(ref):
 result={}
 for item in git('ls-tree','-rz',ref).split(b'\0'):
  if item:
   metadata,path=item.split(b'\t',1);result[path.decode()]=metadata.decode()
 return result
checks=[]
def check(name,ok):
 checks.append({'name':name,'pass':bool(ok)})
 if not ok:raise AssertionError(name)
a,b=tree(base),tree('HEAD');allowed=['packages/contracts/'+p for p in ['README.md','package.json','package-lock.json']]
changed=[p for p,v in a.items() if b.get(p)!=v];check('exact three authorized original files changed',sorted(changed)==sorted(allowed))
prefix='packages/contracts/'
old=json.loads(blob(base,prefix+'package.json'));new=json.loads(blob(source,prefix+'package.json'))
check('version0.1.1',new['version']=='0.1.1')
check('all old exports unchanged',all(new['exports'].get(k)==v for k,v in old['exports'].items()))
check('exact additive exports',set(new['exports'])-set(old['exports'])=={'./action-application','./action-application/schema'})
check('other package fields unchanged',{k:v for k,v in new.items() if k not in ['version','exports','scripts']}=={k:v for k,v in old.items() if k not in ['version','exports','scripts']})
expected={**old['scripts'],'build':old['scripts']['build']+' && node generate-actions.mjs','check:generated':old['scripts']['check:generated']+' && node generate-actions.mjs --check','typecheck':old['scripts']['typecheck']+' test/action-application-public-types.ts','test:public':old['scripts']['test:public']+' test/action-application-public.test.mjs'}
check('original checks retained additively',new['scripts']==expected)
lock=json.loads(blob(source,prefix+'package-lock.json'));prior=json.loads(blob(base,prefix+'package-lock.json'));lock['version']=prior['version'];lock['packages']['']['version']=prior['packages']['']['version'];check('lock only root package version changes',lock==prior)
check('README preserved and appended',blob(source,prefix+'README.md').startswith(blob(base,prefix+'README.md')))
files=[prefix+p for p in ['action-application/receive.mjs','action-application/schema.mjs','generate-actions.mjs','dist/action-application.mjs','dist/action-application.d.ts','dist/action-application.schema.json','dist/action-application.metadata.json']]
identities=[]
for p in files:
 raw=blob(source,p);check('tested source exact '+p,raw==(root/p).read_bytes());identities.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
meta=json.loads((root/prefix/'dist/action-application.metadata.json').read_text());raw=(root/prefix/'dist/action-application.schema.json').read_bytes();check('receiving schema hash',hashlib.sha256(raw).hexdigest()==meta['schemaSha256'])
for s in meta['sources']:
 raw=(root/prefix/s['path']).read_bytes();check('canonical source '+s['path'],len(raw)==s['bytes'] and hashlib.sha256(raw).hexdigest()==s['sha256'])
check('browser graph only generated/runtime dependencies',all(not any(x in p for x in ['apps/','node:','commands-0.2','retrieval-0.2']) for p in meta['browserInputs']))
pgs=[]
for name in ['independent-first','independent-types','independent-generation','independent-artifact']:
 r=json.loads((evidence/f'{name}.json').read_text());check('bounded check '+name,r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
 for s in r['streams']:
  raw=(root/s['path']).read_bytes();check('raw stream '+s['path'],len(raw)==s['bytes'] and hashlib.sha256(raw).hexdigest()==s['sha256'])
 try:os.killpg(r['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('fresh owned group absence '+name,absent);pgs.append(r['ownedPidAndPgid'])
result={'base':base,'source':source,'originalEntries':len(a),'unchangedOriginalEntries':len(a)-len(changed),'authorizedChangedOriginals':changed,'sourceIdentities':identities,'ownedGroupsFreshlyAbsent':pgs,'passed':len(checks),'failed':0,'checks':checks}
(evidence/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['checks','sourceIdentities']}))
