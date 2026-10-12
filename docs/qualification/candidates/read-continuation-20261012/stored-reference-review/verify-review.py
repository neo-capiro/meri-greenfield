"""Verify exact review packet membership and bytes without source execution."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
manifest = json.loads((HERE / 'manifest.json').read_text())
checks = []
for member in manifest['files']:
    data = (ROOT / member['path']).read_bytes()
    checks.append({'name': member['path'], 'pass': len(data) == member['bytes'] and hashlib.sha256(data).hexdigest() == member['sha256']})
actual = {str(p.relative_to(ROOT)) for p in HERE.iterdir() if p.is_file() and p.name not in {'manifest.json', 'verification.json'}} | set(manifest['outsideEvidence'])
expected = {m['path'] for m in manifest['files']}
checks.append({'name': 'exact unique safe membership', 'pass': actual == expected and len(expected) == len(manifest['files']) and all(not Path(p).is_absolute() and '..' not in Path(p).parts for p in expected)})
result = {'source': manifest['source'], 'checks': len(checks), 'passed': sum(c['pass'] for c in checks), 'failed': sum(not c['pass'] for c in checks), 'results': checks}
(HERE / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k:v for k,v in result.items() if k != 'results'}))
raise SystemExit(1 if result['failed'] else 0)
