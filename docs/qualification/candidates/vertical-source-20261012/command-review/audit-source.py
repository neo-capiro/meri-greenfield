"""Offline exact-source/preservation audit. No project execution or private body output."""
import hashlib,json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[5]
HERE=pathlib.Path(__file__).resolve().parent
BASE='e5fb3963de787bbd7b7663316c368f15814897da'
SOURCE='ca506ba1591b35eae5d389e551787017328eea73'
AUTHORITY='50576f78db514dbd09de2d4b34f1ef82e1d18967'
checks=[]
def check(label,condition):
 checks.append({'check':label,'pass':bool(condition)})
def git(*args,root=ROOT):return subprocess.check_output(['git','-C',str(root),*args])
def blob(ref,path):return git('show',f'{ref}:{path}')
def tree(ref):
 return {row.split(b'\t',1)[1].decode():row.split(b'\t',1)[0].decode() for row in git('ls-tree','-rz',ref).split(b'\0') if row}
old,new=tree(BASE),tree(SOURCE)
allowed={'apps/gateway/authorization/current-tool-authority.mjs','apps/gateway/index.mjs','apps/gateway/budget/postgres-tool-budget.mjs','apps/gateway/budget/tool-budget-dispatch.mjs','packages/contracts/commands-0.2/artifact-file-validation.mjs','packages/contracts/test/command-artifact-file.test.mjs'}
actual={p for p,v in old.items() if new.get(p)!=v}
check('exact six allocated original-file changes',actual==allowed)
for p in sorted(set(old)-allowed):check('original preserved: '+p,new.get(p)==old[p])
check('8678 base entries retained',len(old)==8678)
check('root authority source exact',blob(SOURCE,'apps/gateway/authorization/current-tool-authority.mjs')==blob(AUTHORITY,'apps/gateway/authorization/current-tool-authority.mjs'))
index_extra=b'\n/** Trusted application composition; this export does not activate any source. */\nexport {createPostgresBudgetExecution} from \'./budget/postgres-tool-budget.mjs\';\n'
check('root index plus sole public trusted-budget export',blob(SOURCE,'apps/gateway/index.mjs')==blob(AUTHORITY,'apps/gateway/index.mjs')+index_extra)
p='packages/contracts/commands-0.2/artifact-file-validation.mjs'
check('artifact source exact single predicate repair',blob(BASE,p).replace(b"||Object.hasOwn(file,'reason')",b'')==blob(SOURCE,p))
p='packages/contracts/test/command-artifact-file.test.mjs';before=blob(BASE,p);after=blob(SOURCE,p)
removed=b",x=>x.reason='contradiction'"
check('one original assertion correction with exact inverse',before.count(removed)==1 and before.replace(removed,b'')==after and after.replace(b"x=>x.indexingStatus='not_indexed']",b"x=>x.indexingStatus='not_indexed'"+removed+b']')==before)
(HERE/'original-test-inverse.json').write_text(json.dumps({'path':p,'base':BASE,'source':SOURCE,'beforeSha256':hashlib.sha256(before).hexdigest(),'afterSha256':hashlib.sha256(after).hexdigest(),'removedLiteral':removed.decode(),'reason':'Native saved truncated-extraction projection legitimately retains reason; all other original assertions remain.'},indent=2)+'\n')
source_paths=[p for p in new if (p.startswith('apps/control/commands/') or p in allowed or p in ['apps/gateway/budget/tool-budget-execution.mjs','packages/contracts/commands-0.2/execution-boundary.mjs','packages/contracts/commands-0.2/execution-intent.mjs','packages/contracts/commands-0.2/task-update-validation.mjs','packages/contracts/commands-0.2/task-update.schema.json'])]
identities=[]
for p in sorted(source_paths):
 b=blob(SOURCE,p);identities.append({'path':p,'blob':new[p].split()[-1],'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 check('tested working source matches exact freeze: '+p,(ROOT/p).read_bytes()==b)
(HERE/'tested-source-identities.json').write_text(json.dumps({'source':SOURCE,'tree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'files':identities},indent=2)+'\n')
for item in json.loads((HERE/'reference-identities.json').read_text())['references']:
 values=[]
 for v in item['versions']:
  b=git('show',v['commit']+':'+item['path'],root='/workspace/capirov2');values.append(hashlib.sha256(b).hexdigest())
  check('private reference identity only: '+item['path']+'@'+v['commit'],len(b)==v['bytes'] and values[-1]==v['sha256'])
 check('private pinned/current unchanged: '+item['path'],values[0]==values[1])
for p in HERE.glob('*.json'):
 try:r=json.loads(p.read_text())
 except (ValueError,UnicodeError):continue
 if isinstance(r,dict) and 'ownedPidAndPgid' in r and 'streams' in r:
  check('capture process group absent: '+p.name,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
  for s in r['streams']:
   b=(ROOT/s['path']).read_bytes();check('raw stream hash: '+p.name+':'+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
result={'base':BASE,'source':SOURCE,'baseEntries':len(old),'unchangedOriginalEntries':len(old)-len(actual),'allocatedOriginalChanges':sorted(actual),'sourceFiles':len(source_paths),'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'runtime':'UNRUN; no SQL engine/provider/native action'}
print(json.dumps(result,indent=2));sys.exit(bool(result['failed']))
