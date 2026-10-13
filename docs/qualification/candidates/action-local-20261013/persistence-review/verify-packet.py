"""Verify this review packet without importing target modules or connecting services."""
from pathlib import Path
import hashlib,json,subprocess
root=Path.cwd();e=root/'docs/qualification/candidates/action-local-20261013/persistence-review';m=json.loads((e/'manifest.json').read_text());checks=[]
for row in m['members']:
 p=root/row['path'];data=p.read_bytes();checks.append({'path':row['path'],'pass':len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']})
for row in m['reviewedSources']:
 data=subprocess.check_output(['git','show',m['source']+':'+row['path']]);checks.append({'path':row['path'],'pass':len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']})
out={'manifestSha256':hashlib.sha256((e/'manifest.json').read_bytes()).hexdigest(),'members':len(m['members']),'sources':len(m['reviewedSources']),'pass':sum(r['pass'] for r in checks),'fail':sum(not r['pass'] for r in checks),'checks':checks,'runtimeAccepted':False}
(e/'packet-verification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:v for k,v in out.items() if k!='checks'}));raise SystemExit(bool(out['fail']))
