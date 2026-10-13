"""Read-only Git/data audit. Never imports or invokes the database runner."""
from pathlib import Path
import hashlib,json,re,subprocess,os
ROOT=Path.cwd(); E=ROOT/'docs/qualification/candidates/action-local-20261013/persistence-review'
BASE='d68615c9861315ac1c6ee616697f7ad0093d9192'; SOURCE='bd3de7dd9f522ef1da8bc055b9f9147e3c9d8dda'; PACKET='3e62a3a97c887044e0d2ef70248f5ddb38b7e84a'; INITIAL='cd5c16c8f09f25da1ce9d11583cae6c9d9f5084f'
checks=[]
def check(name,ok):
 checks.append({'name':name,'pass':bool(ok)})
def git(*args):return subprocess.check_output(['git',*args])
def blob(ref,path):return git('show',ref+':'+path)
def sha(v):return hashlib.sha256(v).hexdigest()
def tree(ref):
 out={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:
   a,p=row.split(b'\t',1);out[p.decode()]=a.decode()
 return out
b,s,p,h=map(tree,[BASE,SOURCE,PACKET,'HEAD'])
changed=[x for x in b if b[x]!=s.get(x)];check('all PR39 original entries preserved at source',not changed)
check('all PR39 original entries preserved at packet',all(p.get(x)==v for x,v in b.items()))
sourcePaths=sorted(x for x in s if x.startswith('apps/control/task-lookup/local-integration/'))
check('exact six source/test/readme additions',len(sourcePaths)==6)
check('no added app/package files outside approved local module',all(x in sourcePaths for x in s.keys()-b.keys() if x.startswith(('apps/','packages/'))))
sourceRows=[]
for path in sourcePaths:
 data=blob(SOURCE,path);sourceRows.append({'path':path,'bytes':len(data),'sha256':sha(data)})
 check('source packet identity '+path,blob(PACKET,path)==data)
 check('review worktree identity '+path,(ROOT/path).read_bytes()==data)
check('only reviewer-owned additions outside author packet',all(x.startswith(('apps/control/task-lookup/local-integration/','docs/qualification/candidates/action-local-20261013/persistence-review/')) or x in ['docs/coordination/tasks/CODEX-ACTION-LOCAL-PERSISTENCE-REVIEW-20261013.md','docs/coordination/reports/CODEX-ACTION-LOCAL-PERSISTENCE-REVIEW-20261013.md'] for x in h.keys()-p.keys()))
check('no review modifications to author or originals',all(h.get(x)==v for x,v in p.items()))
manifestPath='docs/qualification/candidates/action-local-20261013/persistence-author/manifest.json';mb=blob(PACKET,manifestPath);m=json.loads(mb)
check('author exact manifest hash',sha(mb)=='bc7093756e04fc383dd440874f1f7a2e405a085fbf92c0bd9c924aa2844da620')
check('author manifest source',m['sourceCommit']==SOURCE)
check('author manifest unique paths',len(m['members'])==len({r['path'] for r in m['members']}))
for row in m['members']:
 data=blob(PACKET,row['path']);check('author manifest '+row['path'],len(data)==row['bytes'] and sha(data)==row['sha256'])
initial=blob(INITIAL,'apps/control/task-lookup/local-integration/run-persistence.test.mjs').decode()
final=blob(SOURCE,'apps/control/task-lookup/local-integration/run-persistence.test.mjs').decode()
addedImports="import {assertLocalResultRows} from './run-persistence.mjs';\nimport {fixture,envelope,NOW,id} from '../fixtures.mjs';\nimport {prepare,event,canonicalSha256} from '../binding.mjs';\n"
check('original author test bytes intact with only three imports plus append',final.replace(addedImports,'',1).startswith(initial))
runner=blob(SOURCE,'apps/control/task-lookup/local-integration/run-persistence.mjs').decode();fixture=blob(SOURCE,'apps/control/task-lookup/local-integration/fixture-checks.mjs').decode()
for text in ['createTaskLookupDelivery({','createPostgresTaskLookupStore({','createCommitAckFault({','createFreshPoolOwner({',"method(c.gateway,'readInvocationOutcome')","runtimeQualified:false","databaseRestartTested:false","ownedRowsDeleted:false","physicalStopProven:false"]:check('actual runner boundary '+text,text in runner)
check('fixed SQL readback provenance columns','completion,delivery,facts,raw_request_sha256,operation FROM' in fixture)
check('source-only migration identity disclaimer','installationProvenanceVerified:false' in fixture)
check('no schema/destructive SQL statements',not re.search(r"(?:query\(|=>query\()['\"](?:CREATE|ALTER|DROP|TRUNCATE|DELETE|GRANT|REVOKE)\b",runner+fixture,re.I))
fault=blob(SOURCE,'apps/control/task-lookup/local-integration/commit-ack-fault.mjs').decode()
check('real query resolved before fault decision',fault.index('const result=await query(...args);')<fault.index("if(sql==='COMMIT')"))
check('fault not retrying or closing pool','return result;' in fault and 'pool.end' not in fault and 'setTimeout' not in fault)
owner=blob(SOURCE,'apps/control/task-lookup/local-integration/fresh-pool.mjs').decode()
check('owned close retained before strict wrapper admission',owner.index('acquired={pool:')<owner.index("const checked=options(value"))
check('preexpired acquisition before factory',owner.index('Date.now()>=deadlineMs')<owner.index('await openFreshPool()'))
check('borrowed refusal before owned assignment',owner.index("throw failure('LOCAL_BORROWED_POOL')")<owner.index('acquired={pool:'))
check('shared lifetime reused',"createOperationLifetime" in owner and "setTimeout" not in owner)
expect={'fault-initial':(13,0),'ownership-evidence-initial':(6,6),'admission-initial':(10,0),'first-repair':(35,0),'final-behavior':(72,1),'final-behavior-corrected':(73,0)}
groups=[]
for name,counts in expect.items():
 receipt=json.loads((E/(name+'.json')).read_text());out=(E/(name+'.stdout.bin')).read_text()
 check(name+' exact counts',all(re.search(r'\b'+k+r' '+str(v)+r'\b',out) for k,v in zip(['pass','fail'],counts)))
 check(name+' raw source diff empty',receipt['sourceDiffBytes']==0)
 check(name+' capture no timeout/kill',not receipt['timedOut'] and not receipt['ownedGroupKillRequired'] and receipt['ownedProcessGroupAbsent'])
 for row in receipt['streams']:
  data=(ROOT/row['path']).read_bytes();check(name+' raw stream '+row['path'],len(data)==row['bytes'] and sha(data)==row['sha256'])
 pg=receipt['ownedPidAndPgid'];groups.append(pg)
 try:os.killpg(pg,0);absent=False
 except ProcessLookupError:absent=True
 check(name+' current group absent',absent)
realm=json.loads((E/'realm-correction.json').read_text());before=(E/'row-checker-before-realm-correction.mjs.txt').read_text();after=(ROOT/'apps/control/task-lookup/local-integration/result-rows-independent.test.mjs').read_text()
check('realm correction before hash',sha(before.encode())==realm['beforeSha256'])
check('realm correction after hash',sha(after.encode())==realm['afterSha256'])
check('realm correction preserves all fixtures/assertions',before[before.index('function values()'):]==after[after.index('function values()'):])
check('pure exported assertion loaded not runner invoked',"import {assertLocalResultRows as assertRows}" in after and 'runLocalActionPersistence(' not in after)
report={'schema':'meri.independent-source-audit/1','base':BASE,'source':SOURCE,'authorPacket':PACKET,'authorManifestSha256':sha(mb),'originalEntries':len(b),'changedOriginals':changed,'sources':sourceRows,'checks':checks,'pass':sum(c['pass'] for c in checks),'fail':sum(not c['pass'] for c in checks),'independentControls':42,'authorControls':31,'capturedGroups':groups,'realPostgreSQLCases':'UNRUN','runtimeAccepted':False}
(E/'audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'pass':report['pass'],'fail':report['fail'],'originalEntries':len(b),'groupsAbsent':len(groups)}))
raise SystemExit(bool(report['fail']))
