"""Verify the current review packet; historical manifest remains historical."""
from pathlib import Path
import json,hashlib
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
m=json.loads((HERE/'canonical-followup-manifest.json').read_bytes());rows=m['files'];bad=[]
for r in rows:
 b=(ROOT/r['path']).read_bytes()
 if len(b)!=r['bytes'] or hashlib.sha256(b).hexdigest()!=r['sha256']:bad.append(r['path'])
actual={str(p.relative_to(ROOT)) for p in HERE.iterdir() if p.is_file() and p.name not in ['canonical-followup-manifest.json','canonical-verification.json']}|set(m['outsideEvidence'])
if actual!={r['path'] for r in rows}:bad.append('membership')
print(json.dumps({'checks':len(rows)+1,'passed':len(rows)+1-len(bad),'failed':len(bad),'failures':bad},indent=2));raise SystemExit(bool(bad))
