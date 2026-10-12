"""Independent offline source/receipt audit; no native source or transport invocation."""
from pathlib import Path
import hashlib
import json
import subprocess
ROOT=Path(__file__).resolve().parents[5]
HERE=Path(__file__).resolve().parent
BASE='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
SOURCE='4834dc4af368fe99675bd4fad3005e8b6b9d6c62'
checks=[]
def check(name,ok):checks.append({'check':name,'pass':bool(ok)})
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd,timeout=30)
def tree(ref):return {line.split(b'\t')[1].decode():line.split(b'\t')[0] for line in git('ls-tree','-rz',ref).split(b'\0') if line}
before,after=tree(BASE),tree(SOURCE)
check('all original files byte/mode preserved',all(after.get(p)==v for p,v in before.items()))
added=sorted(set(after)-set(before))
check('exact4 allocated new implementation/test files',added==sorted(['apps/gateway/sources/memory-proposals/'+name+'.mjs' for name in ['handler','http-adapter','request-context']]+['apps/gateway/test/memory-proposal-source.test.mjs']))
identities=[]
for path in added:
 raw=git('show',SOURCE+':'+path);check('tested exact source '+path,(ROOT/path).read_bytes()==raw);identities.append({'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
for ref in json.loads((HERE/'reference-identities.json').read_bytes())['files']:
 for pin in ref['identities']:
  raw=git('show',pin['ref']+':'+ref['path'],cwd='/workspace/capirov2');check('pinned private identity '+ref['path']+' '+pin['ref'],len(raw)==pin['bytes'] and hashlib.sha256(raw).hexdigest()==pin['sha256'])
 check('pinned/current metadata unchanged '+ref['path'],ref['unchanged'])
for label in ['first-source','corrected-controls']:
 r=json.loads((HERE/(label+'.json')).read_bytes())
 for stream in r['streams']:
  raw=(ROOT/stream['path']).read_bytes();check('raw receipt '+stream['path'],len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256'])
 check('owned group cleanup '+label,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 check('clean measured source '+label,r['sourceDiffBytes']==0)
check('first retained23/2',b'pass 23' in (HERE/'first-source.stdout.bin').read_bytes() and b'fail 2' in (HERE/'first-source.stdout.bin').read_bytes())
check('final25/25',b'pass 25' in (HERE/'corrected-controls.stdout.bin').read_bytes() and b'fail 0' in (HERE/'corrected-controls.stdout.bin').read_bytes())
result={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'originalFiles':len(before),'addedFiles':added,'sourceIdentities':identities,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks,'bodyPublication':False,'runtimeAccepted':False}
print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
