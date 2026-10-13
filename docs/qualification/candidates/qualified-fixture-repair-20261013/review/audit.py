"""Read-only exact Git/source/receipt audit. No candidate imports or service calls."""
import hashlib,json,os,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
OUT=Path(__file__).resolve().parent
BASE='b5243ae164f68c7591b039e8365d9897390543d2'
SOURCE,PACKET=sys.argv[1:]
checks=[]
def git(*args):return subprocess.check_output(['git','-c','gc.auto=0',*args],cwd=ROOT)
def blob(ref,path):return git('show',ref+':'+path)
def tree(ref):
 out={}
 for raw in git('ls-tree','-rz',ref).split(b'\0'):
  if raw:
   facts,path=raw.split(b'\t',1);out[path.decode()]=facts.decode()
 return out
def check(name,value):checks.append({'name':name,'passed':bool(value)})
def sha(value):return hashlib.sha256(value).hexdigest()
a=tree(BASE);b=tree(SOURCE);p=tree(PACKET);head=tree('HEAD')
prefix='apps/control/qualified-application/'
existing=set(prefix+x for x in ['README-schema.md','application.fixture.mjs','independent/schema-independent.test.mjs','lifecycle-bridge.mjs','lifecycle-bridge.test.mjs','schema-contract.mjs','schema-independent/fixture.mjs','schema.fixture.mjs','schema.mjs'])|{'apps/proxy/qualification/assembly/lifecycle.py','apps/proxy/qualification/assembly/test_lifecycle.py'}
changed={x for x in a if a[x]!=b.get(x)}
check('exact eleven allocated existing paths only',changed==existing)
check('no original deletion',set(a)<=set(b))
check('all other originals exact',all(a[x]==b[x] for x in set(a)-existing))
check('packet apps packages source exact',all(p.get(x)==b[x] for x in b if x.startswith(('apps/','packages/','scripts/'))))
check('review tested production exact',all(head.get(x)==b[x] for x in b if x.startswith(('apps/','packages/','scripts/'))))
# Original assertion ownership: prefixes remain intact or an exact fixture-only inverse.
for path in [prefix+'schema.test.mjs',prefix+'schema-independent/schema-independent.test.mjs',prefix+'application.test.mjs']:
 check('original complete tests exact '+path,a[path]==b[path])
path=prefix+'lifecycle-bridge.test.mjs';check('old fixed-child test prefix exact',blob(SOURCE,path).startswith(blob(BASE,path)))
path=prefix+'independent/schema-independent.test.mjs';old=blob(BASE,path);new=blob(SOURCE,path);addition=b'host:fixture.host,port:fixture.port,database:fixture.database,user:fixture.user,'
check('old boundary exact inverse of pool options only',new.replace(addition,b'',1)==old)
path='apps/proxy/qualification/assembly/test_lifecycle.py';old=blob(BASE,path);new=blob(SOURCE,path)
check('old Python exact inverse fixture server fallback only',new.replace(b"f.get('serverAddress', f['host'])",b"f['host']").replace(b"f.get('serverPort', f['port'])",b"f['port']")==old)
# Existing six migrations and canonical lifetime/transaction owners stay byte-exact.
protected=[x for x in a if '/migrations/' in x]+['apps/gateway/budget/postgres-budget-store.mjs','packages/runtime/operation-lifetime.mjs','apps/proxy/qualification/assembly/bridge.py']
check('all migration files and lifetime/transaction/bridge owners unchanged',all(a[x]==b[x] for x in protected))
contract=blob(SOURCE,prefix+'schema-contract.mjs').decode();schema=blob(SOURCE,prefix+'schema.mjs').decode();bridge=blob(SOURCE,prefix+'lifecycle-bridge.mjs').decode();pres=blob(SOURCE,prefix+'schema-preservation.mjs').decode()
for name,needle in [('60s original operation cutoff','c.deadlineMs-began<=60000'),('connection5s and query6s ceiling','connectionTimeout<=5000'),('query ceiling','queryTimeout<=6000'),('shorter timeout','Math.min(queryTimeout,5000)')]:check(name,needle in contract)
check('actual exact six migration sources still pinned',blob(BASE,prefix+'schema-contract.mjs').split(b'export const migrations=data([')[1].split(b']);')[0]==blob(SOURCE,prefix+'schema-contract.mjs').split(b'export const migrations=data([')[1].split(b']);')[0])
check('shared fixture admission owner','const fixtureInput=fixtureDescriptor;' in bridge)
check('full descriptor remains canonical admission member','admission=data({fixture,binding:' in bridge.replace(' ',''))
check('namespace OID bounded positive32bit',"BigInt(r.oid)<=4294967295n" in pres)
check('fixed metadata only no data rows or reset',not re.search(r'\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b',pres))
# Pinned author manifest verified from Git objects, including failure bytes.
mp='docs/qualification/candidates/qualified-fixture-repair-20261013/author/manifest.json';m=json.loads(blob(PACKET,mp));check('author manifest source',m['source']==SOURCE)
for row in m['members']:
 value=blob(PACKET,row['path']);check('author member '+row['path'],len(value)==row['bytes'] and sha(value)==row['sha256'])
# Independent raw streams, exact replay source equality, exit/cleanup and initial failures.
receipt_names=['first','baseline-corrected','repaired-node','independent-python','repaired-python','regclass-before','final-node']
if (OUT/'cast-type-before.json').exists():receipt_names+=['cast-type-before']
if (OUT/'final-qualified-node.json').exists():receipt_names+=['final-qualified-node']
for name in receipt_names:
 r=json.loads((OUT/(name+'.json')).read_text())
 check(name+' retained tracked source diff zero',r['sourceDiffBytes']==0)
 check(name+' owned group absence',r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  raw=(ROOT/stream['path']).read_bytes();check(name+' '+Path(stream['path']).name,len(raw)==stream['bytes'] and sha(raw)==stream['sha256'])
 try:os.killpg(r['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check(name+' group remains absent',absent)
check('Node72 final pass',b'\xe2\x84\xb9 pass 72' in (OUT/('final-qualified-node.stdout.bin' if (OUT/'final-qualified-node.stdout.bin').exists() else 'final-node.stdout.bin')).read_bytes())
check('Python33 pass',b'Ran 33 tests' in (OUT/'repaired-python.stderr.bin').read_bytes() and (OUT/'repaired-python.stderr.bin').read_bytes().rstrip().endswith(b'OK'))
# Python code unchanged after its final exact-source replay.
r=json.loads((OUT/'repaired-python.json').read_text());pt=tree(r['sourceHead']);check('all Python runtime source unchanged since33 pass',all(pt.get(x)==b[x] for x in b if x.endswith('.py') and not x.endswith('test_compatibility_independent.py')))
identities=[{'path':x,'blob':b[x].split()[-1],'bytes':len(blob(SOURCE,x)),'sha256':sha(blob(SOURCE,x))} for x in sorted(existing|{prefix+'schema-preservation.mjs'})]
report={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'packet':PACKET,'testedHead':git('rev-parse','HEAD').decode().strip(),'originalEntries':len(a),'exactOriginalEntries':len(a)-len(changed),'changedOriginals':sorted(changed),'protectedCount':len(protected),'authorManifestSha256':sha(blob(PACKET,mp)),'authorManifestMembers':len(m['members']),'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'sourceIdentities':identities,'nativeSqlExecuted':False}
(OUT/'audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ('source','packet','originalEntries','passed','failed')}))
for c in checks:
 if not c['passed']: print('FAILED: '+c['name'])
raise SystemExit(0 if report['failed']==0 else 1)
