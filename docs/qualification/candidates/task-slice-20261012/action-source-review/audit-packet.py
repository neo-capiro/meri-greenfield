import hashlib,json,subprocess,os
from pathlib import Path
root=Path(__file__).resolve().parents[5];author='baadc33c95205b169a24994c00f302119e25a48b';packet='docs/qualification/candidates/task-slice-20261012/action-source-author/'
def blob(ref,path):return subprocess.check_output(['git','show',ref+':'+path],cwd=root)
def j(path):return json.loads(blob(author,path))
checks=0
def check(ok,label):
 global checks
 checks+=1
 if not ok:raise AssertionError(label)
m=j(packet+'manifest.json');check(len(m['members'])==43,'43 member manifest')
for row in m['members']:
 b=blob(author,row['path']);check(len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],'manifest '+row['path']);check(b==blob('HEAD',row['path']),'integrated exact '+row['path'])
receipts=[]
for row in m['members']:
 if not row['path'].endswith('.json'):continue
 r=j(row['path'])
 if isinstance(r,dict) and 'ownedPidAndPgid' in r:
  check(r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'],'author cleanup')
  for s in r['streams']:
   data=blob(author,s['path']);check(len(data)==s['bytes'] and hashlib.sha256(data).hexdigest()==s['sha256'],'author stream hash')
  receipts.append({'path':row['path'],'exitCode':r['exitCode'],'sourceHead':r['sourceHead']})
r=j(packet+'final-source.json');check(r['exitCode']==0 and r['sourceDiffBytes']==0,'exact final source run');text=blob(author,packet+'final-source.stdout.bin').decode();check('tests 22' in text and 'pass 22' in text and 'fail 0' in text,'author22 tests')
checks_data=j(packet+'final-audit-checks.json');check(len(checks_data['checks'])==64,'64 author audit declarations');check(all(x['pass'] is True for x in checks_data['checks']),'64 author audit results')
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();check(subprocess.check_output(['git','diff','4c214f7b','HEAD','--','apps','packages'],cwd=root)==b'','metadata merge no tested code changes')
print(json.dumps({'checksPassed':checks,'authorPacket':author,'manifestMembers':len(m['members']),'manifestSha256':hashlib.sha256(blob(author,packet+'manifest.json')).hexdigest(),'reviewHead':head,'authorReceipts':receipts,'runtimeAccepted':False},indent=2))
