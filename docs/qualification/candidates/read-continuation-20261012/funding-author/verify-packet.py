"""Offline author packet identity checks, without source/provider/native execution."""
from pathlib import Path
import hashlib,json,subprocess
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
checks=[]
def check(label,valid):checks.append({'check':label,'passed':bool(valid)})
def sha(raw):return hashlib.sha256(raw).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,timeout=10)
manifest=json.loads((HERE/'manifest.json').read_bytes())
for row in manifest['entries']:
 path=ROOT/row['path'];raw=path.read_bytes()
 check('contained '+row['path'],path.resolve().is_relative_to(ROOT))
 check('member '+row['path'],len(raw)==row['bytes'] and sha(raw)==row['sha256'])
p=json.loads((HERE/'source-preservation.json').read_bytes())
check('source tree',git('rev-parse',p['source']+'^{tree}').decode().strip()==p['sourceTree'])
def tree(rev):
 rows={}
 for entry in git('ls-tree','-rz',rev).split(b'\0'):
  if entry:
   meta,path=entry.split(b'\t');rows[path.decode()]=meta.decode().split()[2]
 return rows
before,after=tree(p['base']),tree(p['source'])
check('all originals unchanged',len(before)==p['originalPathCount'] and all(after.get(path)==blob for path,blob in before.items()))
check('exact allocated additions',sorted(set(after)-set(before))==sorted(row['path'] for row in p['ownNewSourceFiles']))
for row in p['ownNewSourceFiles']:
 raw=git('show',p['source']+':'+row['path'])
 check('source '+row['path'],len(raw)==row['bytes'] and sha(raw)==row['sha256'] and after[row['path']]==row['gitBlob'])
 check('working source '+row['path'],(ROOT/row['path']).read_bytes()==raw)
for row in json.loads((HERE/'reference-identities.json').read_bytes())['references']:
 check('pinned reference '+row['path'],row['pinnedBlob']==row['observedBlob'] and len(row['pinnedBlob'])==40 and row['drift'] is False)
labels=[('focused-first',1,None,'focused-first.patch'),('focused-second',0,38,'focused-second.patch'),('focused-final',0,39,'focused-final.patch'),('original-contracts',0,534,None),('public-distribution',0,7,None),('requirement-repair-focused',0,40,'requirement-repair.patch'),('landscape-repair-focused',0,41,'landscape-repair.patch'),('repaired-contracts',0,536,None)]
for label,code,count,patch in labels:
 r=json.loads((HERE/(label+'.json')).read_bytes())
 check(label+' outcome',r['exitCode']==code and not r['timedOut'])
 check(label+' cleanup',r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
 check(label+' capture identity',r['captureSha256']==sha((HERE/'capture-reaped.py').read_bytes()))
 for stream in r['streams']:
  raw=(ROOT/stream['path']).read_bytes()
  check(label+' stream '+stream['path'],len(raw)==stream['bytes'] and sha(raw)==stream['sha256'])
 if count is not None:
  raw=(HERE/(label+'.stdout.bin')).read_text()
  check(label+' count',f'ℹ pass {count}\n' in raw and 'ℹ fail 0\n' in raw)
 else:check('compiler failure preserved','strictRequired' in (HERE/(label+'.stdout.bin')).read_text())
 if patch:check(label+' exact failed/passed source diff',sha((HERE/patch).read_bytes())==r['sourceDiffSha256'])
 else:check(label+' frozen source',r['sourceHead']==(p['source'] if label=='repaired-contracts' else p['initialSource']) and r['sourceDiffBytes']==0)
result={'scope':'OFFLINE_SOURCE_EVIDENCE_ONLY','source':p['source'],'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks}
print(json.dumps(result,indent=2))
raise SystemExit(0 if result['failed']==0 else 1)
