"""Linux worker image evidence and gated publication. Never starts a container."""
import argparse
import datetime as dt
import hashlib
import io
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import selectors
import signal
import shutil
import stat
import subprocess
import sys
import tarfile
import time
import uuid

if __name__ == '__main__':
    # Only this fixed CLI's sibling modules are needed under Python -I -S.
    sys.path.insert(0, str(Path(__file__).resolve().parent))

import worker_image_manifest as manifest_owner

SCHEMA = 'meri-worker-image-input/1'
PUBLISH_SCHEMA = 'meri-worker-image-input/2'
ASSEMBLER = manifest_owner.ASSEMBLER
COLLECTOR = manifest_owner.COLLECTOR
PUBLISHER = manifest_owner.PUBLISHER
CLEANER = manifest_owner.CLEANER
CONTEXT_SHA = '0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903'
ASSEMBLER_SHA = '48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851'
ARTIFACTS = {
    'image-inventory.json': 32*1024*1024, 'os-installed-packages.txt': 4*1024*1024,
    'runtime-versions.txt': 65536, 'libreoffice-version.err': 65536,
    'cft-hashes.txt': 65536, 'suid-sgid-reduced.txt': 4*1024*1024,
    'package-lock.json': 1024*1024,
    'node_modules/@anthropic-ai/claude-agent-sdk/package.json': 131072,
    'node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/package.json': 131072,
    'node_modules/playwright/package.json': 131072,
}
REQUIRED_ROOTS = {'/opt/meri-worker', '/opt/meri-venv', '/opt/meri-browsers', '/usr', '/etc',
                  '/var/lib/dpkg', '/bin', '/sbin', '/lib', '/lib64', '/root', '/home', '/scripts', '/packages'}
HELPERS = {'/opt/meri-browsers/chromium-1247/chrome-linux64/'+n for n in ('chrome_sandbox', 'chrome-sandbox')}
SHA = re.compile(r'[a-f0-9]{64}')
IID = re.compile(r'sha256:[a-f0-9]{64}')


def need(ok, message):
    if not ok:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def loads(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            need(key not in result, 'duplicate JSON'); result[key] = value
        return result
    def finite_float(value):
        number = float(value)
        need(math.isfinite(number), 'nonfinite JSON')
        return number
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: need(False, 'nonfinite JSON'),
                      parse_float=finite_float)


def encoded(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=True, allow_nan=False, indent=2)+'\n').encode('ascii')


def write(path, raw):
    with Path(path).open('xb') as stream:
        stream.write(raw); stream.flush(); os.fsync(stream.fileno())


def save(path, value):
    write(path, encoded(value))


def read(path, cap):
    path = Path(path)
    need(path.is_absolute() and '..' not in path.parts, 'absolute plain path')
    for part in (path, *path.parents):
        s = part.lstat()
        need(not stat.S_ISLNK(s.st_mode) and not getattr(s, 'st_file_attributes', 0)&0x400, 'link/reparse')
    before = path.stat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and 0 <= before.st_size <= cap, 'bounded regular file')
    key = lambda s: (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
    with path.open('rb') as stream:
        opened = os.fstat(stream.fileno())
        need((opened.st_dev, opened.st_ino, opened.st_size, opened.st_nlink) ==
             (before.st_dev, before.st_ino, before.st_size, before.st_nlink), 'open drift')
        raw = stream.read(cap+1)
        need(key(os.fstat(stream.fileno())) == key(opened), 'read drift')
    need(key(path.stat()) == key(before) and len(raw) == before.st_size, 'path drift')
    return raw


def validate_input(root, manifest_raw, expected_sha):
    need(type(expected_sha) is str and SHA.fullmatch(expected_sha) and digest(manifest_raw) == expected_sha, 'external input pin')
    value = loads(manifest_raw)
    need(type(value) is dict and value.get('schema') in (SCHEMA, PUBLISH_SCHEMA), 'worker input schema')
    publish = value['schema'] == PUBLISH_SCHEMA
    need(set(value) == ({'schema', 'sourceCommit', 'runUuid', 'members', 'contextManifestSha256'} |
         ({'publication'} if publish else set())) and type(value['sourceCommit']) is str
         and re.fullmatch('[a-f0-9]{40}', value['sourceCommit'])
         and value['contextManifestSha256'] == CONTEXT_SHA, 'worker input schema')
    need(type(value['runUuid']) is str and str(uuid.UUID(value['runUuid'])) == value['runUuid']
         and uuid.UUID(value['runUuid']).version == 4, 'fixed run UUID')
    rows = value['members']
    manifest_owner.require_source_membership(rows, publish)
    names = set()
    for row in rows:
        need(type(row) is dict and set(row) == {'path', 'bytes', 'sha256'}, 'source record')
        name = row['path']
        need(type(name) is str and not name.startswith('/') and '\\' not in name
             and all(x not in ('', '.', '..') for x in name.split('/')) and name not in names, 'source path')
        need(type(row['bytes']) is int and 0 <= row['bytes'] <= 2*1024*1024
             and type(row['sha256']) is str and SHA.fullmatch(row['sha256']), 'source pin')
        raw = read(root/name, 2*1024*1024)
        need(len(raw) == row['bytes'] and digest(raw) == row['sha256'], 'source drift')
        names.add(name)
    need(digest(read(root/ASSEMBLER, 65536)) == ASSEMBLER_SHA, 'canonical assembler')
    if publish:
        from worker_image_publish import validate_publication
        validate_publication(value['publication'], value['sourceCommit'], value['runUuid'])
    return value


class Commands:
    """Fixed Linux process-group capture. Docker daemon work is not a child."""
    def __init__(self, output, end):
        self.output, self.end = Path(output), end

    def __call__(self, label, argv, seconds=60, cap=32*1024*1024):
        need(re.fullmatch('[a-z0-9-]{1,80}', label) and 0 < cap <= 33*1024*1024, 'command capture bounds')
        remaining = min(seconds, self.end-time.monotonic())
        need(remaining > 0, 'whole-operation deadline')
        folder = self.output/label; folder.mkdir()
        streams = {n: (folder/(n+'.bin')).open('xb') for n in ('stdout', 'stderr')}
        facts = {n: {'observedBytes': 0, 'retainedBytes': 0} for n in streams}
        receipt = {'argv': argv, 'timeoutSeconds': remaining, 'exitCode': None,
                   'complete': False, 'reason': None, 'streams': facts,
                   'startedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
        child = None; selector = selectors.DefaultSelector(); start = time.monotonic()
        try:
            child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, shell=False, start_new_session=True)
            for name, pipe in [('stdout', child.stdout), ('stderr', child.stderr)]:
                os.set_blocking(pipe.fileno(), False); selector.register(pipe, selectors.EVENT_READ, name)
            while selector.get_map():
                if time.monotonic()-start >= remaining:
                    receipt['reason'] = 'DEADLINE'; break
                for key, _ in selector.select(min(.1, remaining-(time.monotonic()-start))):
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        selector.unregister(key.fileobj); key.fileobj.close(); continue
                    info = facts[key.data]; info['observedBytes'] += len(chunk)
                    limit = cap if key.data == 'stdout' else 32*1024*1024
                    keep = chunk[:max(0, limit-info['retainedBytes'])]
                    streams[key.data].write(keep); info['retainedBytes'] += len(keep)
                    if len(keep) != len(chunk): receipt['reason'] = 'STREAM_CAP'
                if receipt['reason']: break
            if not receipt['reason']:
                child.wait(timeout=max(.01, remaining-(time.monotonic()-start)))
                receipt['complete'] = True
        except BaseException as error:
            receipt['reason'] = type(error).__name__
        finally:
            if child is not None:
                if child.poll() is None or selector.get_map():
                    try: os.killpg(child.pid, signal.SIGKILL)
                    except ProcessLookupError: pass
                try: child.wait(timeout=max(.01, min(5, self.end-time.monotonic())))
                except subprocess.TimeoutExpired: receipt['reason'] = 'CHILD_CLEANUP_UNKNOWN'
                receipt['exitCode'] = child.poll()
            for key in list(selector.get_map().values()): key.fileobj.close()
            selector.close()
            for handle in streams.values(): handle.close()
            for name in streams:
                data = read(folder/(name+'.bin'), 33*1024*1024)
                facts[name]['sha256'] = digest(data)
            receipt['elapsedSeconds'] = time.monotonic()-start
            receipt['endedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
            save(folder/'process.json', receipt)
        need(receipt['complete'] and receipt['exitCode'] == 0 and receipt['reason'] is None, 'command failed; retained raw evidence')
        return read(folder/'stdout.bin', cap)


def unpack_artifact(raw, name):
    cap = ARTIFACTS[name]
    need(len(raw) <= cap+10240, 'tar stream bound')
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        items = []
        for item in archive:
            need(len(items) == 0 and item.name == PurePosixPath(name).name and item.isfile()
                 and not item.issparse() and not item.linkname and item.size <= cap, 'one exact regular artifact')
            need(not item.pax_headers, 'unsupported tar metadata')
            stream = archive.extractfile(item); need(stream is not None, 'artifact data')
            data = stream.read(cap+1); need(len(data) == item.size, 'complete artifact')
            items.append(data)
        need(len(items) == 1, 'missing artifact')
        return items[0]


def validate_inventory(raw, source_rows, component):
    value = loads(raw); summary = value.get('summary', {})
    need(value.get('schema') == 'meri.qualification.image-inventory/1' and value.get('ok') is True
         and value.get('refused') is False and value.get('truncated') is False
         and value.get('coverage', {}).get('complete') is True
         and set(summary.get('roots', [])) == REQUIRED_ROOTS
         and summary.get('errors') == 0 and summary.get('expectationFailures') == 0
         and summary.get('unexpectedPrivilegeEntries') == 0 and summary.get('limitsExceeded') is None
         and value.get('errors') == [] and value.get('unexpectedPrivilegeFiles') == [], 'complete canonical inventory')
    entries = value.get('entries'); need(type(entries) is list and len(entries) <= 300000, 'inventory entries')
    by_path = {}
    for entry in entries:
        need(type(entry) is dict and type(entry.get('path')) is str and entry['path'] not in by_path, 'unique inventory entry')
        by_path[entry['path']] = entry
    expectations = value.get('expectations')
    need(type(expectations) is list and len(expectations) == 4
         and all(r.get('status') == 'match' for r in expectations), 'four canonical binary expectations')
    expected = {r['path']: r['expected'] for r in expectations}
    need(set(expected) == HELPERS | {
        '/opt/meri-worker/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude',
        '/opt/meri-browsers/chromium-1247/chrome-linux64/chrome'}, 'canonical binary scope')
    sdk = next(r for r in component['npm'] if r['name'] == '@anthropic-ai/claude-agent-sdk')
    browser = component['chromium']
    pins = {browser['installedPaths']['chrome']: {'sha256': browser['perFilePins']['chrome-linux64/chrome']},
            '/opt/meri-worker/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude':
            {'sha256': sdk['bundledCli']['linuxX64BinaryChecksum']}}
    pins.update({p: {'sha256': browser['perFilePins']['chrome-linux64/chrome_sandbox'],
                     'mode': '4755', 'uid': 0, 'gid': 0} for p in HELPERS})
    need(expected == pins, 'expectations bound to frozen component source')
    for path, pin in expected.items():
        entry = by_path.get(path, {})
        need(entry.get('type') == 'file' and all(entry.get(k) == v for k, v in pin.items()), 'binary observation')
    need({r['path'] for r in value.get('privilegeFiles', [])} == HELPERS, 'two helpers only')
    # Use the canonical context rows rather than a second source inventory.
    for row in source_rows:
        if row['contextPath'] in ('.dockerignore', 'Dockerfile', 'README.md', 'component-pins.json'):
            continue  # Build-only files are not copied into the image.
        context_path = row['contextPath']
        if context_path.startswith('build-dependencies/contracts/'):
            path = '/packages/contracts/' + context_path.removeprefix('build-dependencies/contracts/')
        elif context_path.startswith('build-dependencies/sdk-capture/'):
            path = '/scripts/sdk-capture/' + Path(context_path).name
        elif context_path.startswith('build-dependencies/'):
            raise ValueError('unknown staged image source')
        else:
            path = '/opt/meri-worker/' + context_path
        entry = by_path.get(path, {})
        need(entry.get('type') == 'file' and entry.get('size') == row['bytes']
             and entry.get('sha256') == row['sha256'], 'image source byte binding')
    return value


def validate_image(value, iid):
    need(type(value) is list and len(value) == 1, 'single image inspect')
    image = value[0]; config = image.get('Config', {})
    need(image.get('Id') == iid and image.get('Os') == 'linux' and image.get('Architecture') == 'amd64'
         and config.get('User') == '10001:10001' and config.get('WorkingDir') == '/workspace/conversation'
         and config.get('Entrypoint') == ['node', '/opt/meri-worker/probes/runtime.mjs']
         and config.get('Volumes') == {'/workspace': {}, '/tmp': {}}, 'fixed worker image config')
    env = config.get('Env'); need(type(env) is list and len(env) == len({s.split('=', 1)[0] for s in env}), 'image env')
    variables = dict(s.split('=', 1) for s in env)
    need(variables.get('MERI_QUALIFICATION_ONLY') == 'true' and variables.get('MERI_SOURCES_ENABLED') == 'false'
         and variables.get('CHROMIUM_SANDBOX_REQUIRED') == 'true', 'fixture image flags')
    need(not any(k.startswith(('AWS_', 'ANTHROPIC_', 'OPENAI_')) or k in ('DATABASE_URL', 'LITELLM_MASTER_KEY') for k in variables), 'credential image env')
    layers = image.get('RootFS', {})
    need(layers.get('Type') == 'layers' and type(layers.get('Layers')) is list
         and 0 < len(layers['Layers']) <= 128 and all(IID.fullmatch(x) for x in layers['Layers']), 'image rootfs')
    return image


def owned_container(value, iid, name, token, image_labels=None):
    need(type(value) is list and len(value) == 1, 'single owned container')
    container = value[0]; config = container.get('Config', {}); state = container.get('State', {})
    need(re.fullmatch('[a-f0-9]{64}', container.get('Id', '')) and container.get('Name') == '/'+name
         and container.get('Image') == iid and config.get('Labels') == dict(image_labels or {}, **{'meri.worker.collector': token})
         and config.get('User') == '10001:10001' and config.get('Entrypoint') == ['/__meri_never_started__']
         and state.get('Status') == 'created' and state.get('Running') is False
         and state.get('StartedAt') == '0001-01-01T00:00:00Z', 'never-started exact owner')
    host = container.get('HostConfig', {})
    need(host.get('NetworkMode') == 'none' and host.get('ReadonlyRootfs') is True
         and host.get('CapDrop') == ['ALL'] and host.get('SecurityOpt') in (['no-new-privileges'], ['no-new-privileges=true'])
         and host.get('Binds') in (None, []) and host.get('Mounts') in (None, [])
         and not host.get('Privileged') and not host.get('Devices') and not host.get('VolumesFrom'), 'restricted inert container')
    mounts = container.get('Mounts')
    need(type(mounts) is list and len(mounts) == 2 and {x.get('Destination') for x in mounts} == {'/workspace', '/tmp'}
         and all(x.get('Type') == 'volume' and re.fullmatch('[a-f0-9]{64}', x.get('Name', '')) for x in mounts)
         and len({x['Name'] for x in mounts}) == 2, 'owned anonymous volumes')
    return container['Id'], [x['Name'] for x in mounts]


def collect(root, manifest, context, output, call, end, *, record_result=True):
    """One fixed build/never-started extraction. Adapter is private test seam."""
    commit = manifest['sourceCommit']; token = manifest['runUuid']
    tag = 'meri-sdk-interruption:'+token
    name = 'meri-worker-evidence-'+token
    iid_path = output/'image.iid'; created = False; cid = None; volumes = []
    result = {'schema': 'meri-worker-image-evidence/1', 'status': 'FAILED_OR_UNKNOWN',
              'sourceCommit': commit, 'runtimeAdmitted': False, 'physicalCleanupConfirmed': False,
              'containerStarted': False, 'ecrPublished': False, 'providerCalls': 0, 'artifacts': []}
    try:
        need(time.monotonic()+60 < end, 'cleanup budget')
        call('docker-build', ['docker', 'build', '--pull', '--platform', 'linux/amd64', '--iidfile', str(iid_path),
             '-f', str(context/'context/Dockerfile'), '-t', tag, str(context/'context')], min(1200, end-time.monotonic()-60))
        iid = read(iid_path, 80).decode('ascii').strip(); need(IID.fullmatch(iid), 'immutable image IID')
        image = validate_image(loads(call('image-inspect', ['docker', 'image', 'inspect', iid], 60, 8*1024*1024)), iid)
        result['image'] = image
        need(time.monotonic()+360 < end, 'create plus cleanup reserve')
        save(output/'create-attempt.json', {'name': name, 'iid': iid, 'retryAllowed': False})
        created = True  # Lost ACK still requires exact-name read-only reconciliation.
        try:
            ack = call('container-create', ['docker', 'create', '--name', name, '--label', 'meri.worker.collector='+token,
                '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                '--user', '10001:10001', '--entrypoint', '/__meri_never_started__', iid])
            need(re.fullmatch(b'[a-f0-9]{64}\n?', ack), 'create ACK')
        finally:
            observed = loads(call('container-inspect', ['docker', 'container', 'inspect', name], 60, 8*1024*1024))
            cid, volumes = owned_container(observed, iid, name, token, image['Config'].get('Labels'))
            save(output/'owned-container.json', {'id': cid, 'volumes': volumes, 'inspect': observed})
        need(ack.rstrip(b'\n').decode('ascii') == cid, 'create ACK/container identity')
        destination = output/'artifacts'; destination.mkdir()
        total = 0
        for number, (path, cap) in enumerate(ARTIFACTS.items()):
            remaining = min(60, end-time.monotonic()-300); need(remaining > 0, 'owned cleanup reserve')
            blob = unpack_artifact(call('artifact-'+str(number), ['docker', 'cp', cid+':/opt/meri-worker/'+path, '-'], remaining, cap+10240), path)
            total += len(blob); need(total <= 64*1024*1024, 'artifact aggregate')
            filename = str(number)+'.bin'; write(destination/filename, blob)
            result['artifacts'].append({'imagePath': '/opt/meri-worker/'+path, 'file': 'artifacts/'+filename,
                                        'bytes': len(blob), 'sha256': digest(blob)})
        blobs = {r['imagePath']: read(output/r['file'], 33*1024*1024) for r in result['artifacts']}
        component = loads(read(context/'context/component-pins.json', 1024*1024))
        validate_inventory(blobs['/opt/meri-worker/image-inventory.json'], loads(read(context/'manifest.json', 65536))['members'], component)
        for path in ('package-lock.json',):
            need(blobs['/opt/meri-worker/'+path] == read(context/'context'/path, 1024*1024), 'copied source identity')
        for path, version in [('node_modules/@anthropic-ai/claude-agent-sdk/package.json', '0.3.295'),
                              ('node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/package.json', '0.3.295'),
                              ('node_modules/playwright/package.json', next(r['version'] for r in component['npm'] if r['name'] == 'playwright'))]:
            need(loads(blobs['/opt/meri-worker/'+path]).get('version') == version, 'installed package version')
        result['status'] = 'BUILD_ONLY_STATIC_EVIDENCE'
    except BaseException as error:
        result['failureClass'] = type(error).__name__
    finally:
        if created and cid is not None:
            try:
                # Re-prove immutable owner just before removal; never remove a foreign handle.
                cleanup_cid, cleanup_volumes = owned_container(loads(call('cleanup-inspect', ['docker', 'container', 'inspect', cid], 60, 8*1024*1024)), result['image']['Id'], name, token, image['Config'].get('Labels'))
                need(cleanup_cid == cid and set(cleanup_volumes) == set(volumes), 'cleanup identity drift')
                call('container-remove', ['docker', 'rm', '-v', cid])
                remaining = call('container-absence', ['docker', 'container', 'ls', '-a', '--no-trunc', '--filter', 'id='+cid, '--format', '{{.ID}}'])
                need(remaining == b'', 'container absence')
                for index, volume in enumerate(volumes):
                    rows = call('volume-absence-'+str(index), ['docker', 'volume', 'ls', '--filter', 'name=^'+volume+'$', '--format', '{{.Name}}'])
                    need(rows == b'', 'owned volume absence')
                result['physicalCleanupConfirmed'] = True
            except BaseException as error: result['cleanupFailureClass'] = type(error).__name__
        result['captureComplete'] = bool(result['status'] == 'BUILD_ONLY_STATIC_EVIDENCE' and result['physicalCleanupConfirmed']
                                         and time.monotonic() < end)
        if record_result: save(output/'result.json', result)
    return result


def bundle(output, destination, *, file_limit=128, byte_limit=128*1024*1024, member_limit=33*1024*1024):
    """Bounded failure delivery; charge budget before copy and disclose prefixes."""
    files = sorted(p for p in output.rglob('*') if not p.is_dir())
    files.sort(key=lambda p: (p.suffix != '.json', p.as_posix()))
    budget, records = byte_limit, []
    with tarfile.open(destination, 'x:gz') as archive:
        for path in files[:file_limit]:
            row = {'path': path.relative_to(output).as_posix(), 'complete': False}
            try: size = path.lstat().st_size
            except OSError as error:
                row['errorClass'] = type(error).__name__; records.append(row); continue
            cap = min(size, budget, member_limit)
            budget -= cap
            row['budgetCharged'] = cap; raw = b''
            try:
                # A partial prefix is still retained on a later metadata failure.
                for part in (path, *path.parents):
                    st = part.lstat(); need(not stat.S_ISLNK(st.st_mode) and not getattr(st, 'st_file_attributes', 0)&0x400, 'bundle link')
                before = path.lstat(); need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1, 'bundle regular')
                with path.open('rb') as stream:
                    opened = os.fstat(stream.fileno())
                    need((opened.st_dev, opened.st_ino, opened.st_size) == (before.st_dev, before.st_ino, before.st_size), 'bundle open drift')
                    raw = stream.read(cap)
                    after_fd = os.fstat(stream.fileno())
                after = path.lstat()
                identity = lambda s: (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
                row['sourceStable'] = identity(before) == identity(after) and identity(opened) == identity(after_fd)
                row['complete'] = row['sourceStable'] and len(raw) == size
            except (OSError, ValueError) as error: row['errorClass'] = type(error).__name__
            item = tarfile.TarInfo(row['path']); item.size = len(raw)
            archive.addfile(item, io.BytesIO(raw))
            row.update(bytes=len(raw), sha256=digest(raw)); records.append(row)
        data = encoded({'files': records, 'excluded': [p.relative_to(output).as_posix() for p in files[file_limit:]],
                        'allFilesIncluded': len(files) <= file_limit,
                        'complete': len(files) <= file_limit and all(r['complete'] for r in records)})
        item = tarfile.TarInfo('capture-manifest.json'); item.size = len(data); archive.addfile(item, io.BytesIO(data))


def main():
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument('--collect', action='store_true'); args = parser.parse_args()
    need(args.collect and sys.platform == 'linux', 'explicit Linux worker collector required')
    root = Path(__file__).resolve().parents[2]
    need(Path(os.environ.get('CODEBUILD_SRC_DIR', '')).absolute() == root, 'fixed CodeBuild root')
    manifest_raw = read(root/'worker-image-input.json', 2*1024*1024)
    manifest = validate_input(root, manifest_raw, os.environ.get('INPUT_MANIFEST_SHA256'))
    need(os.environ.get('SOURCE_COMMIT') == manifest['sourceCommit'], 'source commit environment')
    need(SHA.fullmatch(os.environ.get('SOURCE_ARCHIVE_SHA256', ''))
         and re.fullmatch('[A-Za-z0-9._~+/=-]{1,1024}', os.environ.get('SOURCE_S3_VERSION', ''))
         and os.environ['SOURCE_S3_VERSION'] != 'null'
         and os.environ.get('RESULT_KEY') == 'results/sdk-worker-image-'+manifest['runUuid']+'/evidence.tar.gz', 'fixed source version/result environment')
    publish = manifest['schema'] == PUBLISH_SCHEMA
    if publish: need(os.environ.get('WORKER_IMAGE_MODE') == 'publish', 'explicit worker image mode')
    import worker_context
    manifest_owner.require_source_membership(manifest['members'], publish)
    output = root/'.meri-worker-evidence'; need(not output.exists(), 'exclusive collector output')
    need(shutil.disk_usage(root).free >= 2*1024*1024*1024, '2GiB free disk floor')
    output.mkdir(); end = time.monotonic()+(1620 if publish else 1500)
    call = Commands(output, end); context = root/'.meri-worker-context'; result = None
    try:
        save(output/'source-before.json', {'sourceCommit': manifest['sourceCommit'], 'runUuid': manifest['runUuid'],
             'sourceVersion': os.environ['SOURCE_S3_VERSION'], 'sourceArchiveSha256': os.environ['SOURCE_ARCHIVE_SHA256'],
             'inputManifestSha256': digest(manifest_raw), 'sourceFiles': manifest['members']})
        call('assemble-context', ['timeout', '--signal=TERM', '--kill-after=5s', '45s', 'python3', '-I', '-B', '-S', ASSEMBLER, '--output', str(context)], 50)
        worker_context.verify_context(context)
        need(digest(read(context/'manifest.json', 65536)) == CONTEXT_SHA, 'accepted context manifest')
        result = collect(root, manifest, context, output, call, end, record_result=not publish)
        try:
            validate_input(root, manifest_raw, os.environ['INPUT_MANIFEST_SHA256'])
            source_post = {'sourceStable': True, 'inputManifestSha256': digest(manifest_raw)}
            if publish:
                worker_context.verify_context(context)
                need(digest(read(context/'manifest.json', 65536)) == CONTEXT_SHA, 'post-build context drift')
                source_post['contextManifestSha256'] = CONTEXT_SHA
            save(output/'source-post.json', source_post)
        except BaseException as error:
            save(output/'source-post.json', {'sourceStable': False, 'errorClass': type(error).__name__})
            if publish:
                result['status'] = 'FAILED_OR_UNKNOWN'
                result['captureComplete'] = False
            raise
        if publish:
            result['scanAdmitted'] = False
            result['runtimeAdmitted'] = False
            result['g1Admitted'] = False
            if result['captureComplete'] and result['physicalCleanupConfirmed'] and not result['containerStarted']:
                import worker_image_publish
                publication = worker_image_publish.execute(output, manifest, result, call, end)
                result['publication'] = publication
                if publication['status'] == 'PUBLISHED_NOT_ADMITTED':
                    result['ecrPublished'] = True
                    result['status'] = 'PUBLISHED_NOT_ADMITTED'
                    result['imageDigest'] = publication['imageDigest']
            save(output/'result.json', result)
    finally:
        if publish and result is not None and not (output/'result.json').exists():
            result['scanAdmitted'] = False
            result['runtimeAdmitted'] = False
            result['g1Admitted'] = False
            save(output/'result.json', result)
        if publish:
            partial = root/'worker-image-result.partial.tar.gz'
            bundle(output, partial)
            partial.replace(root/'worker-image-result.tar.gz')
        else:
            bundle(output, root/'worker-image-result.tar.gz')
    return 0 if result and result['captureComplete'] and (not publish or result['ecrPublished']) else 1


if __name__ == '__main__':
    try: raise SystemExit(main())
    except Exception:
        print('Worker image evidence refused/failed; preserve outputs, never retry.', file=sys.stderr)
        raise SystemExit(2) from None
