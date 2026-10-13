import hashlib,json,pathlib,re,subprocess
ROOT=pathlib.Path.cwd();HERE=ROOT/'docs/qualification/candidates/durable-skills-20261013/source-independent'
BASE='a337ef93e386f5eb646e85f89f26b425546b1222';SOURCE='123767d120e7286d0550fb8ba63166ea4ffcbd34';ART='14f2e2eaff45e520727ba2b0eb7398daf0cf3a38';checks=[]
def git(*args):return subprocess.check_output(['git',*args])
def entries(commit):
 rows={}
 for s in git('ls-tree','-rz',commit).split(b'\0'):
  if s:
   meta,path=s.split(b'\t',1);rows[path.decode()]=meta.decode()
 return rows
old,new=entries(BASE),entries(SOURCE)
def check(name,condition,**fields):assert condition,name;checks.append({'name':name,'pass':True,**fields})
check('Exact final pin/tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='a8a558d8b84b04e4f3bd2091223324f28393a907')
allowed={'apps/control/conversations/postgres-store.mjs','apps/control/conversations/temporal-dispatch.mjs','apps/control/conversations/test/application-fixture.mjs','apps/control/conversations/test/store-fixture.mjs','apps/control/conversations/tsconfig.json','apps/control/conversations/workflow.ts','apps/control/document-application/local/fixture.mjs','apps/worker/conversation/activity.mjs','apps/worker/conversation/options.mjs','docs/coordination/tasks/CODEX-DURABLE-SKILLS-20261013.md','packages/skills/commitments/evidence.mjs'}
changed={p for p,v in old.items() if new.get(p)!=v};check('Exactly eleven authorized existing path changes',changed==allowed,changed=sorted(changed));check('Every other original base entry preserved',all(new.get(p)==v for p,v in old.items() if p not in allowed),exactEntries=len(old)-len(allowed),baseEntries=len(old))
for prefix in ['packages/contracts/dist/','packages/skills/originals/','infra/','apps/artifacts/','apps/worker/qualification/','apps/control/qualification-sdk-fixture/','apps/control/document-application/research-brief/','apps/control/document-application/mail-history/']:
 paths={p:v for p,v in old.items() if p.startswith(prefix)};check('Protected prefix exact '+prefix,bool(paths) and all(new.get(p)==v for p,v in paths.items()),entries=len(paths))
for path in ['packages/contracts/package.json','packages/contracts/package-lock.json','packages/contracts/meri.schema.json','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/catalog-validation.mjs','packages/contracts/generate.mjs','packages/contracts/generate-documents.mjs','packages/contracts/generate-conversations.mjs','packages/contracts/generate-actions.mjs','apps/control/conversations/service.mjs','apps/control/conversations/http.mjs','apps/control/conversations/events.mjs','apps/control/conversations/migrations/0001_conversations.sql']:
 if path in old:check('Protected preimage exact '+path,new.get(path)==old[path])
check('All original schemas exact',all(new.get(p)==v for p,v in old.items() if p.endswith('.schema.json')))
check('Public package remains0.1.3',json.loads(git('show',SOURCE+':packages/contracts/package.json'))['version']=='0.1.3')
check('Only authorized new product migration0002',sorted(p for p in set(new)-set(old) if '/migrations/' in p and p.endswith('.sql'))==['apps/control/conversations/migrations/0002_lifecycle.sql'])
previous=entries('347c0278bd206246afe75b6dbaca1782c9e39da2');delta={p for p in previous if new.get(p)!=previous[p]};check('Only binder existing delta from typed freeze',delta=={'apps/control/document-application/relationship-brief/binding.mjs'},changed=sorted(delta))
for prefix in ['apps/control/document-application/relationship-brief/local/','apps/control/document-application/commitments-audit/local/']:
 pinned={p:v for p,v in entries(ART).items() if p.startswith(prefix)};check('All already rendered synthetic artifact receipts/bytes retained '+prefix,all(new.get(p)==v for p,v in pinned.items()),entries=len(pinned))
check('Staging source exact independently revieweda078',new['apps/control/staging-e2e/client.mjs']==entries('a0783b147b1439cf4fb4767e841cabd1ce6e7fa3')['apps/control/staging-e2e/client.mjs'])
check('No reviewer executable modification',not git('diff','--name-only',SOURCE,'HEAD','--','apps','packages','infra').strip())
selection=json.loads((HERE/'owner-selection-audit.json').read_text());check('Actual owner selectors all exist; omitted typo is disclosed',selection['allActualExecutedSelectorsExist'] and len(selection['unexecutedNonexistentSelector'])==1)
for label,wanted in [('accepted-independent45',45),('accepted-binding2',2),('final-owner-focused',261)]:
 record=json.loads((HERE/(label+'.json')).read_text());text=(HERE/(label+'.stdout.txt')).read_text();counts={k:int(v)for k,v in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$',text,re.M)}
 check('Captured pass/reaping/absence '+label,record['returncode']==0 and not record['timedOut'] and record['processReaped'] and record['ownedProcessGroupAbsent'] and counts['tests']==counts['pass']==wanted and all(counts[k]==0 for k in ['fail','cancelled','skipped','todo']),counts=counts,sourceCommit=record['reviewedCommit'])
 for stream in ['stdout','stderr']:check('Raw capture hash '+label+' '+stream,hashlib.sha256((HERE/(label+'.'+stream+'.txt')).read_bytes()).hexdigest()==record[stream+'Sha256'])
asts=json.loads((HERE/'post-e0-ast-details.json').read_text());check('Both post-e0 runtime option semantic ASTs exact',all(r['semanticAstEqual']for r in asts['results']))
out={'decision':'ACCEPT_SOURCE','sourceCommit':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'assertionsPassed':len(checks),'checks':checks,'sourceOnly':True,'nativeRuntimeAndWholePlanAcceptance':False};(HERE/'accepted-preservation-details.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'decision':'ACCEPT_SOURCE','assertionsPassed':len(checks),'retainedBaseEntries':len(old)-11}))
