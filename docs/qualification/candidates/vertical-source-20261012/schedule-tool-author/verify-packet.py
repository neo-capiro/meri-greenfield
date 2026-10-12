"""Verify retained local bytes only; does not invoke services or dependencies."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
manifest=json.loads((E/'manifest.json').read_text())
for item in manifest['members']:
 p=ROOT/item['path'];data=p.read_bytes()
 assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256'],item['path']
for item in json.loads((E/'audit.json').read_text())['sourceIdentities']:
 data=subprocess.check_output(['git','show',manifest['sourceFreeze']+':'+item['path']],cwd=ROOT)
 assert hashlib.sha256(data).hexdigest()==item['sha256'],item['path']
print(json.dumps({'manifestMembersVerified':len(manifest['members']),'sourceIdentitiesVerified':8,'sourceFreeze':manifest['sourceFreeze']}))
