#!/usr/bin/env python3
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[5]
manifest=json.loads(Path(__file__).with_name('manifest.json').read_text())
for member in manifest['members']:
 data=(root/member['path']).read_bytes()
 assert len(data)==member['bytes'] and hashlib.sha256(data).hexdigest()==member['sha256'],member['path']
print(json.dumps({'passed':len(manifest['members']),'failed':0}))
