"""Hash and receipt verification of immutable author evidence, without rerunning it."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[5]
REF='ee568bef473884d930a54ab112fa32f9325eae0d'
SOURCE='4834dc4af368fe99675bd4fad3005e8b6b9d6c62'
PREFIX='docs/qualification/candidates/backend-execution-20261012/memory-proposal-source/'
def raw(path,ref=REF):return subprocess.check_output(['git','show',ref+':'+path],cwd=ROOT,timeout=30)
checks=[]
def check(name,ok):checks.append({'check':name,'pass':bool(ok)})
manifestBytes=raw(PREFIX+'manifest.json');manifest=json.loads(manifestBytes)
check('source freeze matches',manifest['sourceHead']==SOURCE)
check('30 unique members',len(manifest['members'])==30 and len({m['path'] for m in manifest['members']})==30)
for member in manifest['members']:
 b=raw(member['path']);check('member '+member['path'],len(b)==member['bytes'] and hashlib.sha256(b).hexdigest()==member['sha256'])
 if member['path'].startswith('apps/'):
  check('unchanged source closeout '+member['path'],b==raw(member['path'],SOURCE))
cleanup=json.loads(raw(PREFIX+'owned-cleanup.json'))
check('all five author groups absent',len(cleanup['checks'])==5 and cleanup['allAbsent'] and not cleanup['unownedProcessesTouched'])
for group in cleanup['checks']:
 receipt=json.loads(raw(group['capture']))
 check('owned cleanup '+group['capture'],group['captureAbsent'] and group['currentlyAbsent'] and not group['timedOut'] and not group['killRequired'] and receipt['ownedProcessGroupAbsent'])
 for stream in receipt['streams']:
  b=raw(stream['path']);check('stream '+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
check('exact34 author plus unchanged memory tests',b'pass 34' in raw(PREFIX+'exact-connected-memory.stdout.bin') and b'fail 0' in raw(PREFIX+'exact-connected-memory.stdout.bin'))
result={'author':REF,'source':SOURCE,'manifestSha256':hashlib.sha256(manifestBytes).hexdigest(),'members':30,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks,'runtimeAccepted':False}
print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
