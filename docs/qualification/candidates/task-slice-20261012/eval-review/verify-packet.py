"""Verify local review evidence and immutable reviewed source using hashes only."""
from pathlib import Path
import json,hashlib,subprocess
root=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent;m=json.loads((e/'manifest.json').read_text());checks=[]
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
for row in m['members']:
 p=root/row['path'];b=p.read_bytes();check(row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
 if p.suffix=='.json':
  value=json.loads(b)
  if isinstance(value,dict) and 'streams' in value:
   for stream in value['streams']:
    raw=(root/stream['path']).read_bytes();check('capture '+stream['path'],len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256'])
for row in m['reviewedSourceFiles']:
 b=subprocess.check_output(['git','show',m['source']+':'+row['path']],cwd=root);check('source '+row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
result={'source':m['source'],'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'scope':'OFFLINE_METADATA_ONLY'}
print(json.dumps(result,indent=2));raise SystemExit(0 if all(c['passed'] for c in checks) else 1)
