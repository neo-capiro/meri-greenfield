"""Read-only local source identity audit. Never imports or executes producer code."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='cff71e1ba8ca8dea8970ad0c778b580a73f84815'
initial='0565003a32a7311658a86cfc7689036b6b450f57'
candidate=sys.argv[1]
checks=[]
def check(name,condition):
 checks.append({'name':name,'pass':bool(condition)})
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 result={}
 for row in git('ls-tree','-r','-z',ref).split(b'\0'):
  if row:
   identity,path=row.split(b'\t',1);result[path.decode()]=identity.decode()
 return result
before,after=tree(base),tree(candidate)
changed=[p for p,i in before.items() if after.get(p)!=i]
check('all_original_blobs_and_modes_preserved',not changed)
files=['packages/contracts/commands-0.2/'+n+s for n in ['task-create','artifact-file'] for s in ['-validation.mjs','.schema.json']]+['packages/contracts/test/command-task-create.test.mjs','packages/contracts/test/command-artifact-file.test.mjs']
check('exactly_six_new_product_or_test_files',sorted(p for p in after.keys()-before.keys() if p.startswith(('packages/','apps/','scripts/')))==sorted(files))
source=[]
for p in files:
 raw=git('show',candidate+':'+p)
 check('checkout_exact:'+p,(root/p).read_bytes()==raw)
 source.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
 if p.endswith('validation.mjs'):
  text=raw.decode();check('canonical_snapshot_owner:'+p,"import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';" in text)
  check('no_extra_imports:'+p,sum(1 for l in text.splitlines() if l.startswith('import '))==1)
 if '/test/' in p:
  old=git('show',initial+':'+p);check('original_frozen_author_test_prefix:'+p,raw.startswith(old))
for p in ['packages/contracts/meri.schema.json','packages/contracts/validate.mjs','packages/contracts/retrieval-0.2/operation-contracts.mjs','package.json','package-lock.json']:
 check('canonical_owner_unchanged:'+p,before[p]==after[p])
references=json.loads((evidence/'reference-identities.json').read_text())['references']
for r in references:
 for v in r['versions']:
  raw=subprocess.check_output(['git','-C','/workspace/capirov2','show',v['commit']+':'+r['path']])
  check('private_reference_identity:'+v['commit'][:8]+':'+r['path'],len(raw)==v['bytes'] and hashlib.sha256(raw).hexdigest()==v['sha256'])
for label in ['independent-first','independent-corrected','compatibility-negative','repaired-unchanged','independent-repaired']:
 p=evidence/(label+'.json')
 if not p.exists():continue
 receipt=json.loads(p.read_text());check('owned_group_absent:'+label,receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
 for stream in receipt['streams']:
  raw=(root/stream['path']).read_bytes();check('raw_receipt_hash:'+label+':'+stream['path'].rsplit('.',2)[-2],len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256'])
report={'base':base,'initialSource':initial,'candidate':candidate,'originalFiles':len(before),'originalChanged':changed,'sourceFiles':source,'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'privateBodiesPublished':False,'sourceConnected':False,'runtimeAccepted':False}
print(json.dumps(report,indent=2));raise SystemExit(bool(report['failed']))
