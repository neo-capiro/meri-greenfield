import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
AUTHOR='907e7f05aff0c5433577dace76a8fb4a3cd037e0'
P='docs/qualification/candidates/backend-execution-20261012/memory-propose/'
def blob(path):return subprocess.check_output(['git','show',AUTHOR+':'+path],cwd=ROOT)
checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
manifest=json.loads(blob(P+'manifest.json'))
check('exact source pin',manifest['sourceCommit']=='2084f947ede709dfea0705bf2b67e62c3e929438')
check('30 members',len(manifest['members'])==30)
for entry in manifest['members']:
 b=blob(entry['path']);check(entry['path'],len(b)==entry['bytes'] and hashlib.sha256(b).hexdigest()==entry['sha256'])
receipts=['initial-author','corrected-author','metadata-audit','exact-source','exact-audit','whitespace']
for label in receipts:
 r=json.loads(blob(P+label+'.json'))
 check(label+' exited/reaped',r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  b=blob(stream['path']);check(label+' raw stream '+stream['path'].split('.')[-2],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
initial=blob(P+'initial-author.stdout.bin').decode();final=blob(P+'exact-source.stdout.bin').decode()
check('original26/28 failed author fixture preserved','pass 26' in initial and 'fail 2' in initial)
check('final30/30 author checks preserved','pass 30' in final and 'fail 0' in final and 'skipped 0' in final)
for p in ['packages/contracts/commands-0.2/memory-propose-validation.mjs','packages/contracts/commands-0.2/memory-propose.schema.json']:
 check(p+' no production repair',subprocess.check_output(['git','show','d8aa806dde5a0015769af913bf4a8a4c768951c6:'+p],cwd=ROOT)==blob(p))
report={'authorPacket':AUTHOR,'manifestSha256':hashlib.sha256(blob(P+'manifest.json')).hexdigest(),'members':len(manifest['members']),'checks':checks,'passed':len(checks),'failed':0}
(HERE/'packet-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':len(checks),'failed':0,'members':len(manifest['members'])}))
