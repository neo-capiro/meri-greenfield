from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5];ep=Path(__file__).resolve().parent
ref='2549eca01ae567bb931a685b5d52ae42d2f92c74';prefix='docs/qualification/candidates/action-host-20261013/durable-author/'
def blob(p,r=ref):return subprocess.check_output(['git','show',r+':'+p],cwd=root)
checks=[]
def check(n,b):checks.append({'name':n,'pass':bool(b)})
raw=blob(prefix+'manifest.json');check('manifest-pin',hashlib.sha256(raw).hexdigest()=='47ff021371000b9e28863e21208600643a2f92df807b7fd0ef5eff1248dd9a2e');m=json.loads(raw)
for row in m['members']:
 b=blob(row['path']);check('member:'+row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
p='apps/control/action-host/durable/index.mjs';check('comment-only-source-change',blob(p).split(b'\n',1)[1]==blob(p,'218379df28f2804342809fa484b6538ec028573b').split(b'\n',1)[1])
for name in ['initial','read-clock-repair']:
 r=json.loads(blob(prefix+name+'.json'));check('owned-exit:'+name,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for s in r['streams']:
  b=blob(s['path']);check('raw:'+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
check('initial-author-failure-retained',json.loads(blob(prefix+'initial.json'))['exitCode']==1)
check('corrected-author-pass',json.loads(blob(prefix+'read-clock-repair.json'))['exitCode']==0)
check('own-final-pass',json.loads((ep/'final.json').read_text())['exitCode']==0)
for p in ['apps/control/action-host/durable/index.mjs','apps/control/action-host/durable/test/durable.test.mjs','apps/control/action-host/durable/test/fixture.mjs']:
 check('final-capture-source:'+p,blob(p)==blob(p,json.loads((ep/'final.json').read_text())['sourceHead']))
report={'authorPacket':ref,'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':[c for c in checks if not c['pass']],'checksDetail':checks};print(json.dumps(report,indent=2));raise SystemExit(bool(report['failed']))
