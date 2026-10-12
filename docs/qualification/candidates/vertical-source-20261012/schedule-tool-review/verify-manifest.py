"""Verify the self-excluding independent review packet without target imports."""
from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parents[5];O=Path(__file__).resolve().parent
m=json.loads((O/'manifest.json').read_bytes());checks=[]
for item in m['members']:
 b=(R/item['path']).read_bytes();checks.append({'path':item['path'],'passed':len(b)==item['bytes'] and hashlib.sha256(b).hexdigest()==item['sha256']})
expected={str(p.relative_to(R)) for p in O.rglob('*') if p.is_file() and p.name!='manifest.json'}
expected.update(['packages/contracts/test/schedule-tool-independent.test.mjs','docs/coordination/reports/CODEX-SCHEDULE-TOOL-INTERFACE-REVIEW-20261012.md'])
assert expected=={i['path'] for i in m['members']}
print(json.dumps({'members':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'manifestSha256':hashlib.sha256((O/'manifest.json').read_bytes()).hexdigest(),'source':m['sourceFreeze'],'runtimeAccepted':False}))
assert all(c['passed'] for c in checks)
