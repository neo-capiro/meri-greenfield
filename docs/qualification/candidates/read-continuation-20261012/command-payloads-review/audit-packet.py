"""Verify frozen author packet as Git data; never execute author/private producers."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
head='844b9b00639d3fa712e15ed5e0872702ee1a974d'; source='bdbb14603cfab0d52d483956f7f1a7e373abb3cb';base='cff71e1ba8ca8dea8970ad0c778b580a73f84815'
folder='docs/qualification/candidates/read-continuation-20261012/command-payloads-author/'
def raw(path,ref=head):return subprocess.check_output(['git','show',ref+':'+path],cwd=root)
checks=[]
def check(n,c):checks.append({'name':n,'pass':bool(c)})
manifest_raw=raw(folder+'manifest.json');m=json.loads(manifest_raw)
check('source_freeze',m['sourceFreeze']==source and m['base']==base)
seen=set()
for row in m['entries']:
 p=row['path'];check('unique:'+p,p not in seen);seen.add(p)
 b=raw(p);check('integrity:'+p,len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
 if p.startswith('packages/'):
  check('final_source_exact:'+p,b==raw(p,source))
paths=set(subprocess.check_output(['git','diff','--name-only',base,head],cwd=root,text=True).splitlines())
check('complete_manifest_self_excluded',seen|{folder+'manifest.json'}==paths)
for p in sorted(seen):
 if p.startswith(folder) and p.endswith('.json'):
  v=json.loads(raw(p))
  if isinstance(v,dict) and 'ownedProcessGroupAbsent' in v:
   check('author_cleanup:'+p,v['ownedProcessGroupAbsent'] and not v['timedOut'] and not v['ownedGroupKillRequired'])
   for stream in v['streams']:
    b=raw(stream['path']);check('author_raw_capture:'+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
check('final_author_test_count','pass 50' in raw(folder+'final-source.stdout.bin').decode() and 'fail 0' in raw(folder+'final-source.stdout.bin').decode())
check('wrong_source_classification_failure_preserved','43' in raw(folder+'source-audit.stdout.bin').decode())
report=raw('docs/coordination/reports/CODEX-COMMAND-PAYLOADS-AUTHOR-20261012.md').decode()
for phrase in ['actual source misunderstanding','lacking bytes/media type is failed','pending comes from persisted quarantine','No earlier pass certifies','canonical private loader/integration','source truth or delivery']:
 check('report_disclosure:'+phrase,phrase in report)
print(json.dumps({'packet':head,'source':source,'manifestSha256':hashlib.sha256(manifest_raw).hexdigest(),'entries':len(m['entries']),'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'runtimeAccepted':False},indent=2));raise SystemExit(any(not c['pass'] for c in checks))
