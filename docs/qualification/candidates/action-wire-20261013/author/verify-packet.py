import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[5]
p=pathlib.Path(__file__).resolve().parent
m=json.loads((p/'manifest.json').read_text())
checks=[]
for row in m['members']:
 raw=(root/row['path']).read_bytes();checks.append({'path':row['path'],'passed':len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']})
a=json.loads((p/'source-audit.json').read_text())
for row in a['product']:
 raw=(root/row['path']).read_bytes();checks.append({'path':row['path'],'passed':hashlib.sha256(raw).hexdigest()==row['sha256']})
print(json.dumps({'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'source':a['source'],'checks':checks},indent=2))
raise SystemExit(1 if any(not c['passed'] for c in checks) else 0)
