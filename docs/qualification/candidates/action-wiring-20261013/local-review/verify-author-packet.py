import hashlib,json,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[5]
ref='22d291f904bce5455f3f3334d4c1cb61f21fe566'
prefix='docs/qualification/candidates/action-wiring-20261013/local-author/'
def blob(p):return subprocess.check_output(['git','show',ref+':'+p],cwd=root)
checks=[]
def check(name,value):checks.append({'name':name,'pass':bool(value)})
raw=blob(prefix+'manifest.json');manifest=json.loads(raw)
check('exact-manifest-sha',hashlib.sha256(raw).hexdigest()=='2dbc3c2a4fcfc14285165af78b8895b067d8756b3267a8fa6cf47ea5bf037e89')
check('26-unique-members',len(manifest['entries'])==len({r['path'] for r in manifest['entries']})==26)
for r in manifest['entries']:
 b=blob(r['path']);check('member:'+r['path'],len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'])
local=json.loads((Path(__file__).parent/'final-audit.json').read_bytes())
for r in local['sourceIdentities']:
 b=blob(r['path']);check('source-unchanged:'+r['path'],hashlib.sha256(b).hexdigest()==r['sha256'])
for name in ['initial','cli-initial','dependency-final','cli-final']:
 r=json.loads(blob(prefix+name+'.json'));check('capture:'+name,r['exitCode']==0 and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  b=blob(stream['path']);check('raw:'+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
report=json.loads(blob(prefix+'audit.json'));check('author-audit-28-pass',len(report['checks'])==28 and all(c['pass'] for c in report['checks']))
check('base-count',report['originalCount']==10378)
result={'packet':ref,'manifestSha256':hashlib.sha256(raw).hexdigest(),'members':26,'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':[c for c in checks if not c['pass']],'sourceAcceptance':'bbd4908edbf0a875966d9bd914a6bd382cfd9f39','nativeExecution':False}
print(json.dumps(result,indent=2));sys.exit(bool(result['failed']))
