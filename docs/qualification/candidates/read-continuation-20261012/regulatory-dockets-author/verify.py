"""Verify author source and evidence identities; no private/runtime execution."""
from pathlib import Path
import hashlib
import json
import subprocess
ROOT=Path(__file__).resolve().parents[5]
HERE=Path(__file__).resolve().parent
checks=[]
def check(name,ok): checks.append({'name':name,'pass':bool(ok)})
def sha(b): return hashlib.sha256(b).hexdigest()
def git(*a): return subprocess.check_output(['git',*a],cwd=ROOT)
def tree(commit): return {r.split('\t',1)[1]:r.split()[2] for r in git('ls-tree','-r',commit).decode().splitlines()}
def load(name):return json.loads((HERE/name).read_text())
m=load('manifest.json')
for member in m['files']:
 data=(ROOT/member['path']).read_bytes()
 check('member:'+member['path'],len(data)==member['bytes'] and sha(data)==member['sha256'])
actual={str(p.relative_to(ROOT)) for p in HERE.iterdir() if p.is_file() and p.name not in {'manifest.json','verification.json'}}|{m['report']}
check('exact unique safe membership',actual=={x['path'] for x in m['files']} and len(actual)==len(m['files']) and all(not Path(p).is_absolute() and '..' not in Path(p).parts for p in actual))
p=load('source-preservation.json');before,after=tree(p['base']),tree(p['sourceFreeze'])
check('source tree',git('rev-parse',p['sourceFreeze']+'^{tree}').decode().strip()==p['sourceTree'])
check('all6110 originals unchanged',len(before)==p['originalBlobs']==6110 and all(after.get(k)==v for k,v in before.items()))
check('three source files plus prior outline only',set(after)-set(before)=={x['path'] for x in p['added']} and len(p['added'])==4)
for member in p['added']:
 data=git('show',p['sourceFreeze']+':'+member['path'])
 check('source:'+member['path'],data==(ROOT/member['path']).read_bytes() and after[member['path']]==member['blob'] and len(data)==member['bytes'] and sha(data)==member['sha256'])
patch=(HERE/'focused-initial-source.patch').read_bytes();r=load('focused-initial.json')
check('focused patch exact source delta',patch==git('diff','--binary',p['outline'],p['sourceFreeze']))
check('focused source receipt',r['sourceHead']==p['outline'] and r['sourceDiffBytes']==len(patch) and r['sourceDiffSha256']==sha(patch))
check('focused bounded successful owned exit',r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'] and r['durationSeconds']<120)
check('capture helper identity',r['captureSha256']==sha((HERE/'capture-reaped.py').read_bytes())==p['captureHelperSha256'])
for stream in r['streams']:
 data=(ROOT/stream['path']).read_bytes();check('raw:'+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
stdout=(ROOT/r['streams'][0]['path']).read_text();check('23 actual focused passes','ℹ tests 23\n' in stdout and 'ℹ pass 23\n' in stdout and 'ℹ fail 0\n' in stdout)
refs=load('reference-identities.json');check('24 metadata predicates pass',refs['checks']==refs['passed']==24 and refs['failed']==0)
check('seven source references, no private body/execution',len(refs['references'])==7 and not refs['privateBodiesPublished'] and not refs['privateSourceExecuted'])
for ref in refs['references']:check('ref unchanged:'+ref['path'],ref['unchanged'] and ref['frozen']==ref['observed'])
result={'source':p['sourceFreeze'],'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'results':checks}
(HERE/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='results'}))
raise SystemExit(1 if result['failed'] else 0)
