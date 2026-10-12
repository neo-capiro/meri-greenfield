"""Verify exact retained bytes and source identities; no service or dependency loads."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
m=json.loads((E/'manifest.json').read_text())
for v in m['members']:
 b=(ROOT/v['path']).read_bytes();assert len(b)==v['bytes'] and hashlib.sha256(b).hexdigest()==v['sha256'],v['path']
for v in json.loads((E/'audit.json').read_text())['sourceIdentities']:
 b=subprocess.check_output(['git','show',m['sourceFreeze']+':'+v['path']],cwd=ROOT);assert hashlib.sha256(b).hexdigest()==v['sha256'],v['path']
print(json.dumps({'verifiedMembers':len(m['members']),'sourceIdentities':9,'sourceFreeze':m['sourceFreeze']}))
