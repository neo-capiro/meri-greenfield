"""Immutable Git and packet audit only; imports no target module or database API."""
from pathlib import Path
import hashlib,json,os,re,subprocess
ROOT=Path.cwd();E=ROOT/'docs/qualification/candidates/action-followthrough-20261013/metadata-review'
BASE='158fa00828cd46864c20f481a998c9d3e9cc236a';SOURCE='924979b527b1b8c7f3f7883ceddd2cf78eebd63f';INITIAL='e56c4bca8f16abd026e9f18396e72d4334346477';PACKET='6800a9d9fe62e3536764ccf9e2f49cf6cecf686c';checks=[]
def git(*args):return subprocess.check_output(['git',*args])
def blob(ref,path):return git('show',ref+':'+path)
def sha(v):return hashlib.sha256(v).hexdigest()
def check(name,v):checks.append({'name':name,'pass':bool(v)})
def tree(ref):
 d={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:a,p=row.split(b'\t',1);d[p.decode()]=a.decode()
 return d
b,s,p,h=map(tree,[BASE,SOURCE,PACKET,'HEAD']);changed=[x for x,v in b.items() if s.get(x)!=v]
check('all original entries preserved at source',not changed);check('all originals preserved at packet',all(p.get(x)==v for x,v in b.items()));check('author packet unchanged in review branch',all(h.get(x)==v for x,v in p.items()))
paths=sorted(x for x in s if x.startswith('apps/control/commands/approval-metadata/'));check('seven approved source/migration/test files',len(paths)==7);sources=[]
check('no additions to other app/package paths',all(x in paths for x in s.keys()-b.keys() if x.startswith(('apps/','packages/'))))
for path in paths:
 data=blob(SOURCE,path);sources.append({'path':path,'bytes':len(data),'sha256':sha(data)})
 check('packet source identity '+path,blob(PACKET,path)==data);check('worktree source identity '+path,(ROOT/path).read_bytes()==data)
mp='docs/qualification/candidates/action-followthrough-20261013/metadata-author/manifest.json';mb=blob(PACKET,mp);m=json.loads(mb)
check('author manifest hash',sha(mb)=='5d731df875e693d1666c9410f560afe5e0c2f5633fe22583e6419124b2da6505');check('author manifest unique paths',len(m['entries'])==len({r['path'] for r in m['entries']}));check('author manifest source',m['source']==SOURCE)
for row in m['entries']:
 data=blob(PACKET,row['path']);check('manifest '+row['path'],len(data)==row['bytes'] and sha(data)==row['sha256'])
prefix='apps/control/commands/approval-metadata/'
check('original author test bytes retained',blob(SOURCE,prefix+'test/metadata.test.mjs').startswith(blob(INITIAL,prefix+'test/metadata.test.mjs')))
check('one author fixture selector correction only',blob(SOURCE,prefix+'test/fixture.mjs').replace(b'TaskCreateToolResult',b'TaskCreateToolOutput')==blob(INITIAL,prefix+'test/fixture.mjs'))
check('binding/index/DDL unchanged through repair',all(blob(INITIAL,prefix+n)==blob(SOURCE,prefix+n) for n in ['binding.mjs','index.mjs','migrations/0001_approval_metadata.sql']))
owner=blob(SOURCE,prefix+'owner.mjs').decode();binding=blob(SOURCE,prefix+'binding.mjs').decode();store=blob(SOURCE,prefix+'postgres-store.mjs').decode();ddl=blob(SOURCE,prefix+'migrations/0001_approval_metadata.sql').decode()
for token in ['createOperationLifetime','l.limitDeadline','STORED_NOT_RELEASED','UNKNOWN','READ_UNAVAILABLE','NOT_STORED','newId()','preparePolicy({phase,selection,selectionSha256,signal,limitDeadline:l.limitDeadline})']:check('owner boundary '+token,token in owner)
for token in ['normalizeTaskCreateInput','assertTaskCreateCommand','assertProposalIntegrity','canonicalSha256','scopes,payload.record.scopes','requiredApprover,payload.record.requiredApprover','r.proposalExpiresAt!==payload.record.expiresAt']:check('canonical immutable guard '+token,token in binding)
check('no approval decision minted',"decision:'approved'" not in owner+binding and "decision: 'approved'" not in owner+binding)
check('fixed parameterized tenant actor proposal read','WHERE tenant_id=$1 AND actor_id=$2 AND proposal_id=$3' in store)
check('single autocommit store no transaction/retry/destructive SQL',not re.search(r"['\"](?:BEGIN|COMMIT|ROLLBACK|UPDATE |DELETE |DROP |ALTER |TRUNCATE )",store))
check('borrowed pool never ended','pool.end' not in store and 'pool.close' not in store)
check('shorter configured statement bound retained',"Math.min(field(settings,'query_timeout'),5000)" in store)
check('metadata uniqueness constraints','PRIMARY KEY(tenant_id,actor_id,proposal_id)' in ddl and 'UNIQUE(tenant_id,command_id)' in ddl and 'UNIQUE(tenant_id,actor_id,idempotency_key)' in ddl)
expect={'initial-independent':(33,13),'signal-corrected':(46,0),'timeout-error-baseline':(45,3),'repaired-composed':(76,0)};groups=[]
for name,counts in expect.items():
 r=json.loads((E/(name+'.json')).read_text());out=(E/(name+'.stdout.bin')).read_text()
 check(name+' exact counts',all(re.search(r'\b'+k+' '+str(v)+r'\b',out) for k,v in zip(['pass','fail'],counts)))
 check(name+' no uncommitted source',r['sourceDiffBytes']==0);check(name+' no timeout/kill',not r['timedOut'] and not r['ownedGroupKillRequired'] and r['ownedProcessGroupAbsent'])
 for stream in r['streams']:
  raw=(ROOT/stream['path']).read_bytes();check(name+' raw '+stream['path'],len(raw)==stream['bytes'] and sha(raw)==stream['sha256'])
 pg=r['ownedPidAndPgid'];groups.append(pg)
 try:os.killpg(pg,0);absent=False
 except ProcessLookupError:absent=True
 check(name+' owned group absent',absent)
for name in ['initial','fixture-corrected','boundary-before','boundary-repaired']:
 rp='docs/qualification/candidates/action-followthrough-20261013/metadata-author/'+name+'.json';r=json.loads(blob(PACKET,rp))
 for stream in r['streams']:
  data=blob(PACKET,stream['path']);check('author stream '+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
 check('author '+name+' finite exited capture',not r['timedOut'] and not r['ownedGroupKillRequired'] and r['ownedProcessGroupAbsent'])
for name in ['signal-fixture-correction','timeout-expectation-correction']:
 r=json.loads((E/(name+'.json')).read_text());path='owner-before-signal-fixture.mjs.txt' if name.startswith('signal') else 'postgres-before-timeout-correction.mjs.txt';check(name+' preimage hash',sha((E/path).read_bytes())==r['beforeSha256'])
out={'base':BASE,'source':SOURCE,'authorPacket':PACKET,'authorManifestSha256':sha(mb),'originalEntries':len(b),'changedOriginals':changed,'sources':sources,'checks':checks,'pass':sum(r['pass'] for r in checks),'fail':sum(not r['pass'] for r in checks),'capturedGroups':groups,'nativePostgreSQL':'UNRUN','policyProducerQualified':False,'runtimeAccepted':False};(E/'audit.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:out[k] for k in ['pass','fail','originalEntries']}));raise SystemExit(bool(out['fail']))
