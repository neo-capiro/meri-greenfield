"""Offline metadata audit only; never imports or executes private source."""
import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[5]
ev=pathlib.Path(__file__).resolve().parent
base='a3e946c1fa264ae7b33205f5b87804ee1ef75773'
checks=[]
def check(label,ok):
 checks.append({'label':label,'pass':bool(ok)})
 if not ok: raise AssertionError(label)
def load(p):return json.loads(p.read_text())
m=load(ev/'reference-identities.json'); matrix=load(ev/'command-boundaries.json'); ids={r['id'] for r in matrix['records']}
expected={'save_memory','save_chat_attachments','schedule_task','cancel_scheduled_task','update_scheduled_task','create_task','update_task','create_word','create_excel','create_powerpoint','run_analysis'}
check('exact eleven unique selected operation records',len(matrix['records'])==11 and ids==expected)
prior=load(root/'docs/qualification/candidates/read-continuation-20261012/remaining-discovery/selected-command-boundaries.json')
prior_ids=set()
for r in prior['records']:prior_ids.update(r.get('ids',[r.get('id')]))
check('eleven match previous discovery',ids==prior_ids)
pending=load(root/'docs/qualification/candidates/read-continuation-20261012/remaining-discovery/pending-disposition.json')
check('eleven retained in pending disposition',ids<={r['id'] for r in pending['entries']})
catalog=load(root/'packages/contracts/retrieval-0.2/catalog.json')
for id in sorted(ids):
 row=next(r for r in catalog['originals'] if r['id']==id)
 check(id+' selected/pending/null unchanged',row['disposition']=='selected' and row['state']=='pending' and row['replacement'] is None)
for r in m['references']:
 for role in ['pinned','observed']:
  identity=r[role];ref=identity['commit']+':'+r['path']
  data=subprocess.check_output(['git','-C','/workspace/capirov2','show',ref]);blob=subprocess.check_output(['git','-C','/workspace/capirov2','rev-parse',ref],text=True).strip()
  check(role+':'+r['path'],len(data)==identity['bytes'] and hashlib.sha256(data).hexdigest()==identity['sha256'] and blob==identity['blob'])
 check('drift:'+r['path'],r['unchanged'] and r['pinned']['blob']==r['observed']['blob'])
schema=load(root/'packages/contracts/meri.schema.json')['$defs']
check('canonical command action enum unchanged',schema['Command']['properties']['action']['enum']==['memory.propose','task.create','artifact.file'])
for k in ['ApprovalProposal','ApprovalDecision','CommandExecutionRequest','CommandReceipt','ArtifactVersion','ScheduleProjection']:
 check('existing canonical '+k,k in schema)
check('explicit checkpoint/no source activation',matrix['allUnavailable'] and matrix['sourceConnectivityEnabled'] is False)
check('immutable old files preserved',not subprocess.check_output(['git','diff',base,'--name-only','--diff-filter=DMRTUXB'],cwd=root))
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=root,text=True).splitlines()
for path in tracked:
 expected_bytes=subprocess.check_output(['git','show',base+':'+path],cwd=root)
 if (root/path).read_bytes()!=expected_bytes:raise AssertionError('base preservation:'+path)
check('all base tracked bytes preserved',True)
result={'scope':'OFFLINE_METADATA_ONLY','checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':0,'baseFilesByteIdentical':len(tracked),'sourceReferences':len(m['references']),'sourceDrift':0,'privateSourceExecuted':False,'nativeRuntimeQualified':False,'checksDetail':checks}
(ev/'metadata-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='checksDetail'}))
