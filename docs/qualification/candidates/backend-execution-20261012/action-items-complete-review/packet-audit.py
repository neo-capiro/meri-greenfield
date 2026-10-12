import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
AUTHOR='cecffb15a7a4ca8974ac818fa0ec45b9f46e0c88';SOURCE='d0eee05150e25c11971f27709a1e2604d12a1fbd'
P='docs/qualification/candidates/backend-execution-20261012/action-items-complete/'
def blob(path,ref=AUTHOR):return subprocess.check_output(['git','show',ref+':'+path],cwd=ROOT)
checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
m=json.loads(blob(P+'manifest.json'));check('exact source',m['sourceCommit']==SOURCE);check('25 members',len(m['members'])==25)
for e in m['members']:
 b=blob(e['path']);check(e['path'],len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256'])
for label in ['initial-author','exact-source','metadata-audit','whitespace']:
 r=json.loads(blob(P+label+'.json'));check(label+' absent no timeout/kill',r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for e in r['streams']:
  b=blob(e['path']);check(label+' raw '+e['path'].split('.')[-2],len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256'])
for label,count in [('initial-author',29),('exact-source',51)]:
 out=blob(P+label+'.stdout.bin').decode();check(label+' exact tests','pass '+str(count) in out and 'fail 0' in out and 'skipped 0' in out)
for p in ['packages/contracts/retrieval-0.2/action-items-complete.schema.json','packages/contracts/retrieval-0.2/action-items-complete-validation.mjs','packages/contracts/test/retrieval-action-items-complete.test.mjs']:
 check(p+' source/packet unchanged',blob(p)==blob(p,SOURCE))
report={'authorPacket':AUTHOR,'members':len(m['members']),'manifestSha256':hashlib.sha256(blob(P+'manifest.json')).hexdigest(),'passed':len(checks),'failed':0,'checks':checks}
(HERE/'packet-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':len(checks),'failed':0,'members':len(m['members'])}))
