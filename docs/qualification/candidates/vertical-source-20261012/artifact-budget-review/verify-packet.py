"""Verify this review packet as data; never imports product code."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5]
e=Path(__file__).resolve().parent
m=json.loads((e/'manifest.json').read_bytes())
rows=[]
for item in m['members']:
 data=(root/item['path']).read_bytes()
 rows.append({'path':item['path'],'pass':len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256']})
for item in m['reviewedSourceFiles']:
 data=subprocess.check_output(['git','show',m['source']+':'+item['path']],cwd=root)
 rows.append({'path':item['path'],'pass':len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256']})
result={'checks':len(rows),'passed':sum(r['pass'] for r in rows),'failed':sum(not r['pass'] for r in rows),'rows':rows,'source':m['source'],'manifestSha256':hashlib.sha256((e/'manifest.json').read_bytes()).hexdigest()}
(e/'packet-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='rows'}))
raise SystemExit(bool(result['failed']))
