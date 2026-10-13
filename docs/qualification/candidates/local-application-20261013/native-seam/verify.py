"""Metadata-only Git/source-identity checks. Never imports or executes target code."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5];here=Path(__file__).resolve().parent
base='73c854ea41f764eb3e3e84bfd0a0cb73fa29a329';checks=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def check(name,ok):
 checks.append({'name':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def source(path):return git('show',base+':'+path)
refs=json.loads((here/'source-identities.json').read_text());schemas=json.loads((here/'schema-inputs.json').read_text());proposal=json.loads((here/'seam-proposal.json').read_text());handoff=json.loads((here/'native-owner-handoff.json').read_text())
check('base identities exact',refs['base']==schemas['base']==base)
for row in refs['references']+list(schemas['existingMigrationPins'].values())+[schemas['driverLock']]:
 b=source(row['path']);check(row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'] and git('rev-parse',base+':'+row['path']).decode().strip()==row['blob'])
check('six exact existing migrations',len(schemas['existingMigrationPins'])==6 and len({x['path'] for x in schemas['existingMigrationPins'].values()})==6)
check('thirteen existing relations',sum(map(len,schemas['requiredObservedRelations'].values()))==13)
check('no new migration id',schemas['newMigrationIds']==[])
check('driver pin exact',json.loads(source(schemas['driverLock']['path']))['packages']['node_modules/pg']['version']=='8.23.1')
check('PR40 gateway admits only one operation at this base',b'a.manifest.allowedOperations.length!==1' in source('apps/gateway/local-action/gateway.mjs'))
check('one immutable allocation per run',b"refuse('ALLOCATION_MISMATCH')" in source('apps/gateway/budget/postgres-tool-budget.mjs') and b'WHERE run_id=$1' in source('apps/gateway/budget/postgres-tool-budget.mjs'))
check('PR44 independent budget fixtures',b'h=harness()' in source('apps/control/action-host/durable/test/fixture.mjs') and b'readH=harness()' in source('apps/control/action-host/durable/test/fixture.mjs'))
check('PR40 case empty source',b'total:0,returned:0,actions:[]' in source('apps/gateway/local-action/case.mjs'))
check('PR40 existing CLI empty prerequisite',b'verifyDatabase(opened.pool,admitted.native,{empty:true})' in source('scripts/local-action/cli.mjs'))
check('recovery synchronous graph at inspected base',b'own(openHost(),[' in source('apps/control/action-host/local/recovery.mjs'))
check('old synthetic database flag retained in source',b'nativeDatabase:false' in source('apps/control/action-host/local/recovery.mjs'))
check('proposal not implemented by discovery',proposal['implementedByThisLane'] is False)
check('native evidence ownership boundary',handoff['nativeEvidenceStatement']=='Native execution and evidence belong to the separate owner and are not inspected or accepted here.')
check('no execution actions',all(v==0 for v in handoff['actionsPerformedHere'].values()))
def tree(ref):
 out={}
 for row in git('ls-tree','-r','-z',ref).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);out[path]=meta
 return out
old,new=tree(base),tree('HEAD');check('all original tracked entries exact',all(new.get(p)==v for p,v in old.items()))
print(json.dumps({'base':base,'originalEntries':len(old),'checks':checks,'passed':len(checks),'failed':0,'scope':'Read-only source/metadata discovery; no target code imported or executed.'},indent=2))
