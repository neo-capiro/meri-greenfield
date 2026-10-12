"""Offline complete packet verification, no target module imports."""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
m=json.loads((HERE/'manifest.json').read_bytes());checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
rows=m['files'];names=[r['path'] for r in rows]
check('unique safe relative members',len(names)==len(set(names)) and all(not Path(p).is_absolute() and '..' not in Path(p).parts for p in names))
for row in rows:
 b=(ROOT/row['path']).read_bytes();check('member:'+row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
actual={str(p.relative_to(ROOT)) for p in HERE.iterdir() if p.is_file() and p.name not in ['manifest.json','verification.json']}|set(m['outsideEvidence']);check('complete packet membership',actual==set(names))
for label,code in [('focused',1),('focused-notes-repaired',0),('metadata-audit',0)]:
 r=json.loads((HERE/(label+'.json')).read_bytes());check('owned exit:'+label,r['exitCode']==code and r['ownedProcessGroupAbsent'] and not r['timedOut'])
 for row in r['streams']:
  b=(ROOT/row['path']).read_bytes();check('raw:'+row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
result={'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'results':checks};print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
