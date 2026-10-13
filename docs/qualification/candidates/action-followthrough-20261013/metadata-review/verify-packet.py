"""Review packet data verification; no imports of producer/native code."""
from pathlib import Path
import hashlib,json,subprocess
root=Path.cwd();e=root/'docs/qualification/candidates/action-followthrough-20261013/metadata-review';m=json.loads((e/'manifest.json').read_text());checks=[]
for row in m['members']:
 data=(root/row['path']).read_bytes();checks.append({'path':row['path'],'pass':len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']})
for row in m['sources']:
 data=subprocess.check_output(['git','show',m['source']+':'+row['path']]);checks.append({'path':row['path'],'pass':len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']})
r={'manifestSha256':hashlib.sha256((e/'manifest.json').read_bytes()).hexdigest(),'members':len(m['members']),'sources':len(m['sources']),'pass':sum(x['pass'] for x in checks),'fail':sum(not x['pass'] for x in checks),'checks':checks,'runtimeAccepted':False};(e/'packet-verification.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k!='checks'}));raise SystemExit(bool(r['fail']))
