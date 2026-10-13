"""Read-only independent lock provenance comparison; no package installs or application imports."""
import hashlib
import json
from pathlib import Path
import yaml

root = Path(__file__).resolve().parents[5]
native_root = Path('/workspace/capirov2')
lock_path = root / 'apps/artifacts/storage/package-lock.json'
lock = json.loads(lock_path.read_text())
manifest = json.loads((root / 'apps/artifacts/storage/package.json').read_text())
assert lock['lockfileVersion'] == 3
assert lock['name'] == manifest['name'] and lock['version'] == manifest['version']
for key in ['name', 'version', 'dependencies', 'devDependencies', 'engines']:
    assert lock['packages'][''][key] == manifest[key], key
native_path = native_root / 'pnpm-lock.yaml'
native = yaml.safe_load(native_path.read_text())['packages']
starts = [native_root / 'node_modules/.pnpm/@aws-sdk+client-s3@3.1141.0/node_modules/@aws-sdk/client-s3',
          native_root / 'node_modules/.pnpm/pg@8.23.0/node_modules/pg']
queue = starts[:]
upstream = {}
while queue:
    location = queue.pop(0).resolve()
    meta_path = location / 'package.json'
    meta = json.loads(meta_path.read_text())
    identity = (meta['name'], meta['version'])
    if identity in upstream:
        continue
    upstream[identity] = (meta, hashlib.sha256(meta_path.read_bytes()).hexdigest())
    for name in {**meta.get('dependencies', {}), **meta.get('optionalDependencies', {})}:
        for parent in [location, *location.parents]:
            candidate = parent / 'node_modules' / name
            if (candidate / 'package.json').is_file():
                queue.append(candidate)
                break
        else:
            raise AssertionError('Missing installed upstream dependency: ' + name)
assert len(upstream) == 40, len(upstream)
checked = []
for location, item in lock['packages'].items():
    if not location:
        continue
    name = location.rsplit('node_modules/', 1)[-1]
    identity = (name, item['version'])
    meta, metadata_hash = upstream[identity]
    assert item['resolved'] == f'https://registry.npmjs.org/{name}/-/{name.split("/")[-1]}-{item["version"]}.tgz'
    assert item['integrity'] == native[name + '@' + item['version']]['resolution']['integrity']
    assert item['integrity'].startswith('sha512-')
    assert item['license'] == meta.get('license', 'UNDECLARED')
    for field in ['dependencies', 'optionalDependencies', 'engines', 'peerDependencies', 'peerDependenciesMeta', 'bin']:
        assert item.get(field) == meta.get(field), (identity, field)
    assert not any(key in item for key in ['link', 'hasInstallScript'])
    checked.append({'location': location, 'name': name, 'version': item['version'], 'upstreamMetadataSha256': metadata_hash, 'license': item['license']})
assert len(checked) == 40
assert {(c['name'], c['version']) for c in checked} == set(upstream)
assert upstream[('@aws-sdk/client-s3', '3.1141.0')][0]['license'] == 'Apache-2.0'
assert upstream[('pg', '8.23.0')][0]['license'] == 'MIT'
print(json.dumps({'verdict': 'PASS_METADATA_INTEGRITY_ONLY', 'packages': checked,
                  'lockSha256': hashlib.sha256(lock_path.read_bytes()).hexdigest(),
                  'nativeLockSha256': hashlib.sha256(native_path.read_bytes()).hexdigest(),
                  'network': False, 'installedFresh': False}, indent=2))
