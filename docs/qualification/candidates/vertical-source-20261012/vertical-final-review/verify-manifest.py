"""Read-only checksum verification of this self-excluding independent review packet."""
from pathlib import Path
import hashlib,json
P=Path(__file__).resolve().parent;R=P.parents[4]
m=json.loads((P/'manifest.json').read_text());checks=[]
for row in m['members']:
 b=(R/row['path']).read_bytes();checks.append({'path':row['path'],'passed':len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']})
result={'verdict':m['verdict'],'source':m['source'],'members':len(checks),'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'runtimeAccepted':False}
print(json.dumps(result));print(json.dumps([x for x in checks if not x['passed']]));raise SystemExit(bool(result['failed']))
