"""Offline source/receipt preservation; no service or database access."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='b5243ae164f68c7591b039e8365d9897390543d2'
source='e14f3fc704adde3819088b0587f91c81be5e1ad0'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def blob(ref,path):return git('show',f'{ref}:{path}')
def sha(value):return hashlib.sha256(value).hexdigest()
changed=git('diff','--name-only',base,source).decode().splitlines()
allowed=['apps/control/qualified-application/'+x for x in ['schema.mjs','schema-contract.mjs','schema-preservation.mjs','schema.fixture.mjs','schema-compatibility.test.mjs','lifecycle-bridge.mjs','lifecycle-bridge.test.mjs','application.fixture.mjs','schema-independent/fixture.mjs','independent/schema-independent.test.mjs','README-schema.md']]+['apps/proxy/qualification/assembly/'+x for x in ['lifecycle.py','test_lifecycle.py','test_fixture_compatibility.py']]
checks=[]
def check(name,condition):
 checks.append({'name':name,'passed':bool(condition)})
 if not condition:raise AssertionError(name)
check('exclusive allocated source paths',set(changed)==set(allowed))
entries={}
for raw in git('ls-tree','-r','-z',base).split(b'\0'):
 if raw:
  meta,path=raw.split(b'\t',1);entries[path.decode()]=meta.decode()
current={}
for raw in git('ls-tree','-r','-z',source).split(b'\0'):
 if raw:
  meta,path=raw.split(b'\t',1);current[path.decode()]=meta.decode()
check('every unallocated original Git entry exact',all(current.get(p)==v for p,v in entries.items() if p not in allowed))
for path in ['apps/control/qualified-application/schema.test.mjs','apps/control/qualified-application/application.test.mjs','apps/control/qualified-application/schema-independent/schema-independent.test.mjs']:
 check('original assertions exact '+path,blob(base,path)==blob(source,path))
p='apps/control/qualified-application/lifecycle-bridge.test.mjs';check('original lifecycle test prefix exact',blob(source,p).startswith(blob(base,p)))
p='apps/proxy/qualification/assembly/test_lifecycle.py';fixed=blob(source,p).replace(b"'address': f.get('serverAddress', f['host']), 'port': f.get('serverPort', f['port'])",b"'address': f['host'], 'port': f['port']");check('Python original assertions exact inverse fixture change',fixed==blob(base,p))
p='apps/control/qualified-application/independent/schema-independent.test.mjs';fixed=blob(source,p).replace(b'options:{host:fixture.host,port:fixture.port,database:fixture.database,user:fixture.user,connectionTimeoutMillis:5000,query_timeout:6000}',b'options:{connectionTimeoutMillis:5000,query_timeout:6000}');check('independent boundary assertions exact inverse fixture change',fixed==blob(base,p))
for p in [p for p in entries if p.endswith('.sql') and 'migrations/' in p]:check('migration preserved '+p,entries[p]==current.get(p))
receipts=[]
for p in sorted(evidence.glob('*.json')):
 if p.name in ('audit.json','manifest.json'):continue
 r=json.loads(p.read_text())
 if 'streams' not in r:continue
 check(p.stem+' bounded group cleanup',r['ownedProcessGroupAbsent'] and not r['timedOut'])
 for stream in r['streams']:check(p.stem+' stream '+stream['path'].split('.')[-2],sha((root/stream['path']).read_bytes())==stream['sha256'])
 receipts.append({'label':p.stem,'exitCode':r['exitCode'],'ownedProcessGroupAbsent':r['ownedProcessGroupAbsent']})
check('initial compatibility failures retained',any(r['label']=='initial-regressions' and r['exitCode']==1 for r in receipts))
check('namespace identity failure retained',any(r['label']=='namespace-identity-before' and r['exitCode']==1 for r in receipts))
check('sequence precision failure retained',any(r['label']=='sequence-before' and r['exitCode']==1 for r in receipts))
check('fixture failure retained',any(r['label']=='source-focused' and r['exitCode']==1 for r in receipts))
check('regclass namespace shadowing failure retained',any(r['label']=='regclass-before' and r['exitCode']==1 for r in receipts))
check('environment setup failure retained',any(r['label']=='original-lifecycle' and r['exitCode']==1 for r in receipts))
result={'base':base,'source':source,'originalEntries':len(entries),'unchangedOriginalEntries':sum(p not in allowed for p in entries),'checks':checks,'passed':len(checks),'failed':0,'sourceFiles':[{'path':p,'blob':git('rev-parse',f'{source}:{p}').decode().strip(),'sha256':sha(blob(source,p))} for p in changed],'receipts':receipts,'nativeExecution':False}
(evidence/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':len(checks),'failed':0,'originalEntries':len(entries),'source':source}))
