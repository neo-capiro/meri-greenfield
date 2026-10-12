"""Own offline source/data/receipt audit. No private implementation execution."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
BASE='c1c9bfde7dd466a0474589a224a99b44277adbc9';SOURCE='d48c9620e30c3686217095cb45b24f1b0c8218a2'
files=['packages/contracts/retrieval-0.2/intelligence-summary.schema.json','packages/contracts/retrieval-0.2/intelligence-summary-validation.mjs','packages/contracts/test/retrieval-intelligence-summary.test.mjs']
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(c,p):return git('show',c+':'+p)
def sha(v):return hashlib.sha256(v).hexdigest()
def tree(c):return {r.split('\t',1)[1]:r.split()[2] for r in git('ls-tree','-r',c).decode().splitlines()}
checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
a,b=tree(BASE),tree(SOURCE)
check('all6528 originals unchanged',len(a)==6528 and all(b.get(p)==v for p,v in a.items()))
check('only three source additions plus prior outline',set(b)-set(a)==set(files+[str((HERE/'outline.md').relative_to(ROOT))]))
check('exact source tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='ec6f6d798d428578219aa6f3e4fa9493ae204d92')
for p in files:check('working source matches freeze:'+p,(ROOT/p).read_bytes()==blob(SOURCE,p))
refs=json.loads((HERE/'reference-identities.json').read_bytes());check('eight reference pairs',len(refs['references'])==8)
for r in refs['references']:
 for version in r['versions']:
  data=subprocess.check_output(['git','show',version['commit']+':'+r['path']],cwd='/workspace/capirov2')
  check('independent pin:'+version['commit'][:8]+':'+r['path'],len(data)==version['bytes'] and sha(data)==version['sha256'])
 check('reference drift absent:'+r['path'],r['unchanged'] and r['versions'][0]['blob']==r['versions'][1]['blob'])
byname={(r['path'],s['name']):s for r in refs['references'] for s in r['symbols']}
wrapper=byname[('apps/api/src/meri/meri-tools.service.ts','queryIntelligence')]
check('exact optional selector and bills arguments',wrapper['selectors']==[{'call':'optionalString','args':['input','clientName',200]},{'call':'this.ldaIntel.getCongressBills','args':['undefined','undefined','undefined',1,15]}])
check('eight stored count owners',len([x for x in wrapper['calls'] if x.startswith('tx.') and x.endswith('.count')])==8)
check('projected exact three keys',wrapper['objectKeys'][-1]['keys']==['tool','generatedAt','data'])
for path,name in [('apps/api/src/lobby-intel/lobby-intel.service.ts','surgingIssuesRows'),('apps/api/src/federal-spending/federal-spending.service.ts','lookupByClientName')]:
 s=byname[(path,name)];check('downstream read SQL:'+name,len(s['sql'])==1 and s['sql'][0]['statement']=='SELECT' and not s['sql'][0]['mutatingVerbPresent'])
s=byname[('apps/api/src/prisma/prisma.service.ts','withSystem')]
check('system transaction configuration disclosed',any('$transaction' in x for x in s['calls']) and any(x['transactionConfiguration'] for x in s['sql']))
for path,name in [('apps/api/src/lobby-intel/lobby-intel.service.ts','mapIssueRow'),('apps/api/src/lobby-intel/lobby-intel.service.ts','mapLegacyIssue'),('apps/api/src/federal-spending/federal-spending.service.ts','decToNumber')]:
 check('local numeric helper traced:'+name,(path,name) in byname and not byname[(path,name)]['sql'])
r=json.loads((HERE/'focused.json').read_bytes())
check('focused exact source',r['sourceHead']==SOURCE and r['sourceDiffBytes']==0)
check('bounded focused exit and owned group absent',r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
for row in r['streams']:
 v=(ROOT/row['path']).read_bytes();check('focused raw stream:'+row['path'],len(v)==row['bytes'] and sha(v)==row['sha256'])
out=(ROOT/r['streams'][0]['path']).read_text();check('actual21 focused pass','ℹ pass 21\n' in out and 'ℹ fail 0\n' in out and 'ℹ skipped 0\n' in out)
code=blob(SOURCE,files[1]).decode();check('canonical JSON owner only import',[l for l in code.splitlines() if l.startswith('import ')]==["import {snapshotOperationData} from './operation-contracts.mjs';"])
check('no runtime/native/provider/SQL implementation',not any(x in code for x in ['fetch(', 'require(', 'import(', 'process.', 'child_process', '$queryRaw', 'set_config']))
result={'source':SOURCE,'base':BASE,'originalBlobsPreserved':len(a),'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'results':checks,'sourceIdentities':[{'path':p,'bytes':len(blob(SOURCE,p)),'sha256':sha(blob(SOURCE,p))} for p in files],'scope':'SOURCE_ONLY_NOT_RUNTIME_OR_CURRENT_AUTHORITY'}
print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
