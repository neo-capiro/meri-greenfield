"""Offline preservation and captured local-flow proof; no environment probing."""
import subprocess,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
base='f3127d742b6b4ec556b00dba939d35e5622a9ad1'
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def tree(ref):
 return {r.split(b'\t',1)[1].decode():r.split(b'\t',1)[0].decode() for r in git('ls-tree','-rz',ref).split(b'\0') if r}
checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
head=git('rev-parse','HEAD').decode().strip();old,new=tree(base),tree(head)
check('all original blobs and modes unchanged',all(new.get(p)==v for p,v in old.items()))
allowed=['apps/control/action-application/local/','scripts/local-followthrough/','docs/qualification/candidates/action-wiring-20261013/local-author/']
exact={'apps/control/action-application/'+p for p in ['index.mjs','http.mjs','session.mjs','README.md']}|{'docs/coordination/'+k+'/CODEX-ACTION-WIRING-LOCAL-20261013.md' for k in ['tasks','reports']}
check('additions stay in own paths or explicit application import',all(p in exact or any(p.startswith(a) for a in allowed) for p in set(new)-set(old)))
for p in sorted(e.glob('*.json')):
 r=json.loads(p.read_bytes())
 if 'ownedPidAndPgid' not in r:continue
 check(p.stem+' clean source',r['sourceDiffBytes']==0)
 check(p.stem+' owned process absent',r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  raw=(root/stream['path']).read_bytes();check(stream['path']+' exact bytes',len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256'])
for p in sorted(e.glob('cli-*.stdout.bin')):
 raw=p.read_text();r=json.loads(raw)
 check(p.stem+' actual full flow passed',r['status']=='PASS' and r['executed']['status']=='observed' and r['executed']==r['replay'])
 check(p.stem+' exactly one observed synthetic effect',r['stats']['taskEffects']==1 and r['stats']['metadataRows']==1 and r['stats']['commandRows']==1 and r['stats']['sourceReads']==1)
 check(p.stem+' no activation or database claim',r['nativeDatabase'] is False and r['productionActivated'] is False)
 check(p.stem+' closed with no retained approval',r['cleanup']['closed'] is True and r['cleanup']['approvals']==0)
 check(p.stem+' no credential field or known synthetic secret',not any(s in raw for s in ['Bearer ','SYNTHETIC_SOURCE','SYNTHETIC_SERVICE','lookupCredential','commandCredential','"credential":']))
report={'scope':'LOCAL_SOURCE_NOT_NATIVE','base':base,'head':head,'originalCount':len(old),'checks':checks,'passed':sum(x['pass'] for x in checks),'total':len(checks)}
(e/'audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':report['passed'],'total':report['total'],'originalCount':len(old)}));raise SystemExit(0 if all(x['pass'] for x in checks) else 1)
