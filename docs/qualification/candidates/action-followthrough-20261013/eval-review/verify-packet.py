"""Hash-only verification of this review packet; source execution is not repeated."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[5];evidence=Path(__file__).resolve().parent
manifest=json.loads((evidence/'manifest.json').read_text());checks=[]
for row in manifest['members']:
 p=root/row['path'];data=p.read_bytes();ok=len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'];checks.append({'path':row['path'],'passed':ok})
 if not ok:raise AssertionError(row['path'])
actual={p.relative_to(root).as_posix() for p in evidence.iterdir() if p.is_file() and p.name not in ['manifest.json','verification.json']}
listed={r['path'] for r in manifest['members'] if r['path'].startswith(evidence.relative_to(root).as_posix()+'/')}
assert actual==listed
checks.append({'check':'exact evidence membership','passed':True})
result={'verdict':'ACCEPT_SOURCE','source':manifest['source'],'checks':checks,'passed':len(checks),'failed':0,'runtimeQualified':False,'qualifiedRealRequests':0}
(evidence/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':len(checks),'failed':0}))
