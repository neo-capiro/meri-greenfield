"""Inspect immutable author packet as Git data only."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
packet='af46a9904167731ebb80039347ae0d033f2c9e3c';source='8a3643e3564f676b66edc6b4cc220fb1c4193098';prefix='docs/qualification/candidates/action-host-20261013/local-author/'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def blob(path):return git('show',packet+':'+path)
checks=[]
def check(name,ok):
 checks.append({'name':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
manifest=json.loads(blob(prefix+'manifest.json'))
check('exact source freeze',manifest['sourceFreeze']==source)
check('unique manifest20',len(manifest['members'])==20 and len({r['path'] for r in manifest['members']})==20)
for row in manifest['members']:
 data=blob(row['path']);check(row['path'],len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'])
for name in ['fixture.mjs','recovery.mjs','local.test.mjs']:
 path='apps/control/action-host/local/'+name;check('frozen source '+name,blob(path)==git('show',source+':'+path))
check('frozen CLI',blob('scripts/local-followthrough/host-run.mjs')==git('show',source+':scripts/local-followthrough/host-run.mjs'))
for label,exitcode in [('initial-direct',1),('missing-approval-fact',0),('repaired-cli',0)]:
 r=json.loads(blob(prefix+label+'.json'));check(label+' outcome+cleanup',r['exitCode']==exitcode and r['ownedProcessGroupAbsent'] and not r['timedOut'])
 for row in r['streams']:
  data=blob(row['path']);check(label+' stream',len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'])
 check(label+' capture producer',r['captureSha256']==hashlib.sha256(blob(prefix+'capture-reaped.py')).hexdigest())
 if label=='missing-approval-fact':
  diff=git('diff',r['sourceHead'],source,'--','apps','packages','scripts','package.json','package-lock.json');check('precommit delta exactly frozen repair',len(diff)==r['sourceDiffBytes'] and hashlib.sha256(diff).hexdigest()==r['sourceDiffSha256'])
 if label=='repaired-cli':check('exact CLI capture',r['sourceHead']==source and r['sourceDiffBytes']==0)
print(json.dumps({'packet':packet,'source':source,'manifestSha256':hashlib.sha256(blob(prefix+'manifest.json')).hexdigest(),'checks':checks,'passed':len(checks),'failed':0},indent=2))
