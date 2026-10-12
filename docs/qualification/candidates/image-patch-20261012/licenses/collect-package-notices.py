"""Bounded stdlib-only exact public package inspection; never executes packages."""
import base64
from concurrent.futures import ThreadPoolExecutor
import email
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile
import time
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
SCRATCH = Path('/tmp/meri-image-license-evidence-20261012')
SCRATCH.mkdir(exist_ok=True)
(OUT / 'metadata').mkdir(exist_ok=True)
(OUT / 'notices').mkdir(exist_ok=True)
START = time.monotonic()
MAX_ARCHIVE = 120 * 1024 * 1024
MAX_TOTAL = 260 * 1024 * 1024
sha = lambda value: hashlib.sha256(value).hexdigest()

def safe(value):
    return re.sub(r'[^a-zA-Z0-9_.-]', '_', value)

def fetch(url, maximum):
    request = urllib.request.Request(url, headers={'User-Agent': 'Meri-source-license-evidence/1'})
    with urllib.request.urlopen(request, timeout=15) as response:
        declared = int(response.headers.get('Content-Length', '0'))
        if declared > maximum:
            raise ValueError(f'declared download {declared} exceeds bound {maximum}')
        data = response.read(maximum + 1)
        if len(data) > maximum:
            raise ValueError('download exceeded byte bound')
        return data, {'url': url, 'finalUrl': response.url, 'status': response.status,
                      'bytes': len(data), 'sha256': sha(data)}

lock = json.loads((ROOT / 'apps/worker/qualification/package-lock.json').read_text())
pins = json.loads((ROOT / 'apps/worker/qualification/component-pins.json').read_text())
locations = []
artifacts = {}
for path, item in lock['packages'].items():
    if not path:
        continue
    eligible = all(key not in item or target in item[key]
                   for key, target in [('os', 'linux'), ('cpu', 'x64'), ('libc', 'glibc')])
    row = {'path': path, 'version': item.get('version'), 'registryLicenseLabel': item.get('license'),
           'targetEligible': eligible, 'resolved': item.get('resolved'), 'integrity': item.get('integrity'),
           'hasInstallScript': item.get('hasInstallScript', False)}
    locations.append(row)
    if eligible and str(item.get('resolved', '')).startswith('https://registry.npmjs.org/'):
        name = path.rsplit('node_modules/', 1)[-1]
        key = f'{name}@{item["version"]}'
        artifacts.setdefault(key, {'kind': 'npm', 'name': name, 'version': item['version'],
                                  'url': item['resolved'], 'integrity': item['integrity'],
                                  'metadataUrl': f'https://registry.npmjs.org/{urllib.parse.quote(name, safe="")}/{item["version"]}'})
for item in pins['pypi'] + pins['pypiTransitive']:
    artifacts[item['name'] + '@' + item['version']] = {
        'kind': 'wheel', 'name': item['name'], 'version': item['version'], 'wheel': item['wheel'],
        'expectedSha256': item['sha256'],
        'metadataUrl': f'https://pypi.org/pypi/{item["name"]}/{item["version"]}/json'}

def metadata(pair):
    key, item = pair
    try:
        data, receipt = fetch(item['metadataUrl'], 8 * 1024 * 1024)
        filename = safe(key) + '.json'
        (OUT / 'metadata' / filename).write_bytes(data)
        item['metadataReceipt'] = receipt
        item['metadataFile'] = 'metadata/' + filename
        meta = json.loads(data)
        if item['kind'] == 'npm':
            item['registryLicenseLabel'] = meta.get('license')
            item['registryDist'] = meta.get('dist')
            item['engines'] = meta.get('engines')
            item['dependencies'] = meta.get('dependencies', {})
            if meta['dist']['integrity'] != item['integrity'] or meta['dist']['tarball'] != item['url']:
                raise ValueError('registry dist differs from exact lock')
        else:
            item['registryLicenseLabel'] = meta['info'].get('license_expression') or meta['info'].get('license')
            item['requiresPython'] = meta['info'].get('requires_python')
            item['requiresDist'] = meta['info'].get('requires_dist')
            target = next(value for value in meta['urls'] if value['filename'] == item['wheel'])
            if target['digests']['sha256'] != item['expectedSha256']:
                raise ValueError('wheel registry digest differs from pin')
            item['url'] = target['url']
            item['declaredBytes'] = target['size']
        item['metadataStatus'] = 'VERIFIED'
    except Exception as error:
        item['metadataStatus'] = 'FAILED'
        item['error'] = f'{type(error).__name__}: {error}'
    return key, item

artifacts = dict(ThreadPoolExecutor(max_workers=8).map(metadata, artifacts.items()))
(OUT / 'lock-target-inventory.json').write_text(json.dumps({'locations': locations}, indent=2) + '\n')
(OUT / 'package-metadata.json').write_text(json.dumps(artifacts, indent=2) + '\n')
print(json.dumps({'metadataArtifacts': len(artifacts), 'verified': sum(v['metadataStatus']=='VERIFIED' for v in artifacts.values())}), flush=True)

def record_member(item, key, name, data):
    row = {'member': name, 'bytes': len(data), 'sha256': sha(data)}
    proprietary = item['name'].startswith('@anthropic-ai/claude-agent-sdk')
    if proprietary:
        row['retention'] = 'HASH_ONLY_COMMERCIAL_COMPONENT_NO_APPROVAL'
    else:
        filename = safe(key) + '__' + sha(name.encode())[:12] + '__' + safe(Path(name).name)
        (OUT / 'notices' / filename).write_bytes(data)
        row['retainedFile'] = 'notices/' + filename
    item.setdefault('notices', []).append(row)

total = 0
ordered = sorted(artifacts.items(), key=lambda pair: (pair[1]['kind'] != 'wheel',
                  not pair[1]['name'].startswith('@anthropic-ai/claude-agent-sdk'), pair[0]))
for key, item in ordered:
    if item['metadataStatus'] != 'VERIFIED':
        continue
    if time.monotonic() - START > 240:
        item['archiveStatus'] = 'UNRUN_TIME_BOUND'
        continue
    try:
        data, receipt = fetch(item['url'], min(MAX_ARCHIVE, MAX_TOTAL - total))
        total += len(data)
        item['archiveReceipt'] = receipt
        if item['kind'] == 'npm':
            algorithm, expected = item['integrity'].split('-', 1)
            if base64.b64encode(hashlib.new(algorithm, data).digest()).decode() != expected:
                raise ValueError('tarball integrity mismatch')
        elif sha(data) != item['expectedSha256']:
            raise ValueError('wheel digest mismatch')
        archive = SCRATCH / (safe(key) + ('.whl' if item['kind']=='wheel' else '.tgz'))
        archive.write_bytes(data)
        item['archiveLocalPath'] = str(archive)
        item['notices'] = []
        if item['kind'] == 'npm':
            with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as bundle:
                members = bundle.getmembers()
                if len(members) > 10000 or sum(m.size for m in members) > 512 * 1024 * 1024:
                    raise ValueError('tar declared member bound exceeded')
                item['memberCount'] = len(members)
                item['nativeMembers'] = [{'member': m.name, 'bytes': m.size} for m in members if m.name.endswith(('.node', '.so')) or m.name=='package/claude']
                for member in members:
                    if not member.isfile():
                        continue
                    if re.search(r'(licen[cs]e|notice|copying|copyright)', Path(member.name).name, re.I) and member.size <= 4 * 1024 * 1024:
                        record_member(item, key, member.name, bundle.extractfile(member).read())
                    if member.name in ['package/package.json', 'package/browsers.json'] and member.size <= 512 * 1024:
                        item['packageData' if member.name.endswith('package.json') else 'browsersData'] = json.loads(bundle.extractfile(member).read())
                    if member.name == 'package/claude':
                        digest = hashlib.sha256()
                        with bundle.extractfile(member) as source:
                            for block in iter(lambda: source.read(1024 * 1024), b''):
                                digest.update(block)
                        item['binarySha256'] = digest.hexdigest()
        else:
            with zipfile.ZipFile(io.BytesIO(data)) as bundle:
                members = bundle.infolist()
                if len(members)>10000 or sum(m.file_size for m in members)>512*1024*1024:
                    raise ValueError('zip declared member bound exceeded')
                item['memberCount'] = len(members)
                item['nativeMembers'] = [{'member': m.filename, 'bytes': m.file_size} for m in members if m.filename.endswith('.so')]
                for member in members:
                    if member.file_size > 4 * 1024 * 1024:
                        continue
                    name = member.filename
                    if re.search(r'(licen[cs]e|notice|copying|copyright)', Path(name).name, re.I):
                        record_member(item, key, name, bundle.read(member))
                    if name.endswith(('.dist-info/METADATA', '.dist-info/WHEEL')):
                        content = bundle.read(member)
                        filename = safe(key) + '__' + Path(name).name + '.txt'
                        (OUT / 'metadata' / filename).write_bytes(content)
                        item.setdefault('wheelMetadata', []).append({'member':name,'file':'metadata/'+filename,'sha256':sha(content)})
        item['archiveStatus'] = 'INTEGRITY_VERIFIED_DATA_INSPECTED'
    except Exception as error:
        item['archiveStatus'] = 'FAILED_OR_BOUNDED'
        item['archiveError'] = f'{type(error).__name__}: {error}'
    print(key, item.get('archiveStatus'), 'notices', len(item.get('notices', [])), flush=True)

(OUT / 'package-inspection.json').write_text(json.dumps({'compressedBytes':total,'maxCompressedBytes':MAX_TOTAL,
    'durationSeconds':round(time.monotonic()-START,3),'artifacts':artifacts,'noPackageExecution':True},indent=2)+'\n')
print(json.dumps({'archiveBytes':total,'inspected':sum(v.get('archiveStatus')=='INTEGRITY_VERIFIED_DATA_INSPECTED' for v in artifacts.values())}),flush=True)
