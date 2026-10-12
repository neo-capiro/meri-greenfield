"""Verify exact committed author packet and retained local captures without execution."""
from pathlib import Path
import hashlib,json,subprocess
r=Path(__file__).resolve().parents[5]; e=Path(__file__).resolve().parent
source='dabe2b50d94f0b12ef983292a1c18e1ef35d4675';head='e37a72402f8b4b7167e7efac9c4845caf5acef07'
prefix='docs/qualification/candidates/read-continuation-20261012/florida-budget-author/'
def git(*a):return subprocess.check_output(['git',*a],cwd=r)
def body(path):return git('show',head+':'+path)
checks=[]
def check(label,ok):checks.append({'check':label,'passed':bool(ok)})
manifestBytes=body(prefix+'manifest.json');m=json.loads(manifestBytes)
check('author manifest37 exact hash',len(m['members'])==37 and hashlib.sha256(manifestBytes).hexdigest()=='3b873a6273fc774ac67d83d4562159621c399a4befb79d4ef94474f921b4fc14')
check('manifest source pin',m['sourceFreeze']==source)
for member in m['members']:
    data=body(member['path']);check('author member '+member['path'],len(data)==member['bytes'] and hashlib.sha256(data).hexdigest()==member['sha256'])
changed=git('diff','--name-only',source,head).decode().splitlines()
check('author closeout only allocated report/evidence',all(p.startswith(prefix) or p=='docs/coordination/reports/CODEX-FLORIDA-BUDGET-AUTHOR-20261012.md' for p in changed))
for item in json.loads((e/'audit.json').read_text())['sourceFiles']:
    data=body(item['path']);check('author packet unchanged source '+item['path'],hashlib.sha256(data).hexdigest()==item['sha256'])
captures=[]
expected={'focused-initial':1,'focused-binding-repair':0,'client-cutoff-before':1,'focused-client-repair':0,'output-alias-before':1,'focused-output-repair':0,'focused-definition-alignment':0}
for label,exitCode in expected.items():
    value=json.loads(body(prefix+label+'.json'));check('author '+label+' expected exit and cleanup',value['exitCode']==exitCode and value['ownedProcessGroupAbsent'] and not value['timedOut'] and not value['ownedGroupKillRequired'])
    captures.append({'label':label,'exitCode':value['exitCode'],'group':value['ownedPidAndPgid'],'groupAbsent':value['ownedProcessGroupAbsent']})
check('final author capture exact source no diff',json.loads(body(prefix+'focused-definition-alignment.json'))['sourceHead']==source and json.loads(body(prefix+'focused-definition-alignment.json'))['sourceDiffBytes']==0)
check('final author raw30 pass',b'pass 30' in body(prefix+'focused-definition-alignment.stdout.bin') and b'fail 0' in body(prefix+'focused-definition-alignment.stdout.bin'))
for name in ['independent-before-repair','final-focused','source-audit']:
    receipt=json.loads((e/(name+'.json')).read_text());check('review '+name+' group absent',receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
    for stream in receipt['streams']:
        data=(r/stream['path']).read_bytes();check('review stream '+stream['path'],len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
check('final combined60 pass',b'pass 60' in (e/'final-focused.stdout.bin').read_bytes() and b'fail 0' in (e/'final-focused.stdout.bin').read_bytes())
result={'authorHead':head,'authorTree':git('rev-parse',head+'^{tree}').decode().strip(),'source':source,'authorManifestSha256':hashlib.sha256(manifestBytes).hexdigest(),'authorManifestMembers':len(m['members']),'authorCaptures':captures,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'limits':'Read-only exact committed evidence; no source/runtime/native execution.'}
(e/'packet-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['authorHead','authorManifestMembers','passed','failed']}));raise SystemExit(bool(result['failed']))
