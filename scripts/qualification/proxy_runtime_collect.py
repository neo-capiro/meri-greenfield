"""Fixed never-started proxy runtime body measurement; no build or admission.

The trusted builder pins this module and worker_image_collect before import.
An injected transport is a test/composition seam, never an authority proof.
"""
import argparse
import io
import math
from pathlib import Path, PurePosixPath
import re
import tarfile
import time
import uuid


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(argv)
    parser.error('trusted builder callable only; no direct operational collection')


if __name__ == '__main__':
    main()  # Help/missing invocation never imports even the sibling helper.

import worker_image_collect as common

EXPECTED = {
    'schema': {'path': '/opt/meri-proxy/schema.prisma', 'bytes': 74271,
               'sha256': 'dbb02f20858ed397ea83b0dfabe2d3cfe59ef658976fdcde373c5baad33df387'},
    'cli': {'path': '/opt/prisma/binaries/node_modules/prisma/build/index.js', 'bytes': 5313425,
            'sha256': '436b50dff9395975439cfd017420c9693ae058f6fc5a412d584bca1ec9d6f127'},
    'engine': {'path': '/opt/prisma/binaries/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x',
               'bytes': 20263736, 'sha256': '75b9d65536770c48da858d2f563b5b0bf8274faa07366c78dc5c5a8bbf260f02'},
    'views': {'path': '/opt/meri-proxy-venv/lib/python3.13/site-packages/litellm/proxy/db/create_views.py',
              'bytes': 10443, 'sha256': '6118f5eba52c8e3a56accc8973b80b44d53e87f90e7d578ca14be0e8b39c66ad'},
}
SOURCES = {'proxy_runtime_collect.py': Path(__file__), 'worker_image_collect.py': Path(common.__file__)}
AGGREGATE_CAP = 32 * 1024 * 1024
LABEL = 'meri.proxy.runtime4'
ENTRY = ['/opt/meri-proxy-venv/bin/python', '-I', '-B', '/opt/meri-proxy/import-probe.py']


def validate(binding_raw, expected_sha, context_raw, recipe_raw, deadline):
    common.need(type(binding_raw) is bytes and len(binding_raw) <= 16384
                and type(expected_sha) is str and common.SHA.fullmatch(expected_sha)
                and common.digest(binding_raw) == expected_sha, 'external binding pin')
    b = common.loads(binding_raw)
    common.need(type(b) is dict and set(b) == {'schema', 'runId', 'sourceCommit', 'contextSha256',
                'recipeSha256', 'imageId', 'sources', 'bodies'}
                and b['schema'] == 'meri.proxy.runtime4.collect-input/1', 'closed binding')
    common.need(type(b['sourceCommit']) is str and re.fullmatch('[a-f0-9]{40}', b['sourceCommit'])
                and type(b['imageId']) is str and common.IID.fullmatch(b['imageId']), 'commit/IID')
    common.need(type(b['runId']) is str and str(uuid.UUID(b['runId'])) == b['runId']
                and uuid.UUID(b['runId']).version == 4, 'root-issued run ID')
    for key, raw, cap in [('contextSha256', context_raw, 2*1024*1024), ('recipeSha256', recipe_raw, 65536)]:
        common.need(type(raw) is bytes and 0 < len(raw) <= cap and type(b[key]) is str
                    and common.SHA.fullmatch(b[key]) and common.digest(raw) == b[key], 'context/recipe pin')
    context = common.loads(context_raw)
    common.need(type(context) is dict and set(context) == {'schema', 'sourceCommit', 'files'}
                and type(context['schema']) is str and context['sourceCommit'] == b['sourceCommit']
                and type(context['files']) is list and 1 <= len(context['files']) <= 512, 'context manifest')
    names = set(); recipe_seen = False
    for row in context['files']:
        common.need(type(row) is dict and set(row) == {'path', 'bytes', 'sha256'}, 'context row')
        name = row['path']
        common.need(type(name) is str and not name.startswith('/') and '\\' not in name
                    and all(p not in ('', '.', '..') for p in name.split('/')) and name not in names
                    and type(row['bytes']) is int and 0 <= row['bytes'] <= 512*1024*1024
                    and type(row['sha256']) is str and common.SHA.fullmatch(row['sha256']), 'context record')
        names.add(name)
        if name == 'Dockerfile':
            common.need(row['bytes'] == len(recipe_raw) and row['sha256'] == b['recipeSha256'], 'recipe membership')
            recipe_seen = True
    common.need(recipe_seen and b['bodies'] == EXPECTED, 'fixed recipe/four body expectations')
    for row in b['bodies'].values():
        common.need(type(row) is dict and set(row) == {'path', 'bytes', 'sha256'}
                    and type(row['path']) is str and type(row['bytes']) is int
                    and type(row['sha256']) is str, 'primitive body record fields')
    common.need(type(b['sources']) is dict and set(b['sources']) == set(SOURCES), 'complete collector closure')
    source_check(b)
    common.need(type(deadline) in (int, float) and math.isfinite(deadline)
                and 30 < deadline-time.monotonic() <= 180, 'absolute collector deadline/cleanup reserve')
    return b


def source_check(b):
    for name, path in SOURCES.items():
        row = b['sources'][name]
        common.need(type(row) is dict and set(row) == {'bytes', 'sha256'}
                    and type(row['bytes']) is int and 0 < row['bytes'] <= 65536
                    and type(row['sha256']) is str and common.SHA.fullmatch(row['sha256']), 'source record')
        raw = common.read(path.absolute(), 65536)
        common.need(len(raw) == row['bytes'] and common.digest(raw) == row['sha256'], 'collector source drift')


def image(value, iid):
    common.need(type(value) is list and len(value) == 1 and type(value[0]) is dict, 'one image')
    v = value[0]; c = v.get('Config', {})
    common.need(v.get('Id') == iid and v.get('Os') == 'linux' and v.get('Architecture') == 'amd64'
                and type(c) is dict and c.get('User') == '10001:10001' and c.get('WorkingDir') == '/tmp'
                and c.get('Entrypoint') == ENTRY and c.get('Cmd') in (None, [], ['node'])
                and c.get('Volumes') in (None, {}), 'proxy image/config/no declared volumes')
    env = c.get('Env'); common.need(type(env) is list and len(env) <= 64, 'image environment')
    mapped = {}
    for entry in env:
        common.need(type(entry) is str and '=' in entry and len(entry) <= 8192, 'image environment entry')
        key, val = entry.split('=', 1)
        common.need(key not in mapped and not re.search('AWS|SECRET|TOKEN|PASSWORD|CREDENTIAL|DATABASE_URL|API_KEY', key, re.I),
                    'credential-bearing image environment')
        mapped[key] = val
    common.need(all(mapped.get(k) == val for k, val in {'PYTHONDONTWRITEBYTECODE': '1', 'PIP_NO_INDEX': '1',
                'PIP_DISABLE_PIP_VERSION_CHECK': '1', 'LITELLM_LOCAL_MODEL_COST_MAP': 'True',
                'HOME': '/tmp/meri-home', 'TMPDIR': '/tmp'}.items()), 'proxy required environment')
    common.need(c.get('Labels') in (None, {}) or type(c.get('Labels')) is dict, 'image labels')
    return c


def owned(value, iid, name, run_id, image_config):
    common.need(type(value) is list and len(value) == 1 and type(value[0]) is dict, 'one owned container')
    v = value[0]; c = v.get('Config', {}); state = v.get('State', {}); host = v.get('HostConfig', {})
    common.need(type(v.get('Id')) is str and re.fullmatch('[a-f0-9]{64}', v['Id'])
                and v.get('Name') == '/'+name and v.get('Image') == iid
                and c.get('Labels') == {**(image_config.get('Labels') or {}), LABEL: run_id}
                and c.get('User') == '10001:10001' and c.get('WorkingDir') == '/tmp'
                and all(c.get(key) == image_config.get(key) for key in ('Env', 'Cmd', 'Volumes'))
                and c.get('Entrypoint') == ['/meri-runtime4-never-start']
                and state.get('Status') == 'created' and state.get('Running') is False
                and state.get('StartedAt') == '0001-01-01T00:00:00Z', 'positive never-started ownership')
    common.need(host.get('NetworkMode') == 'none' and host.get('ReadonlyRootfs') is True
                and host.get('CapDrop') == ['ALL'] and host.get('SecurityOpt') == ['no-new-privileges']
                and host.get('Binds') in (None, []) and host.get('Mounts') in (None, [])
                and host.get('Privileged') is False and not host.get('Devices') and not host.get('VolumesFrom')
                and v.get('Mounts') == [], 'owned container has no mounts/volumes')
    return v['Id']


def body(raw, key):
    expected = EXPECTED[key]; size = expected['bytes']
    common.need(type(raw) is bytes and len(raw) <= size+10240 and len(raw) % 512 == 0, 'bounded complete tar')
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        members = []
        for item in archive:
            common.need(not members, 'exact one tar member')
            members.append(item)
        common.need(len(members) == 1, 'exact one tar member')
        item = members[0]
        common.need(item.name == PurePosixPath(expected['path']).name and item.isfile()
                    and not item.issparse() and not item.linkname and not item.pax_headers
                    and item.size == size and item.offset == 0 and item.offset_data == 512, 'fixed regular tar member')
        payload_end = 512 + ((size+511)//512)*512
        common.need(len(raw) >= payload_end+1024 and not any(raw[payload_end:]), 'complete tar terminator/no hidden tail')
        data = archive.extractfile(item).read(size+1)
    common.need(len(data) == size and common.digest(data) == expected['sha256'], 'exact runtime body mismatch')
    return data


def collect(binding_raw, expected_sha, *, context_raw, recipe_raw, output, deadline, transport=None):
    """Trusted builder API; deadline is absolute monotonic and never refreshed.

    The enclosing reviewed builder owns admission, environment, whole-operation
    containment and failure-bundle export. This callable cannot establish them.
    """
    b = validate(binding_raw, expected_sha, context_raw, recipe_raw, deadline)
    output = Path(output)
    common.need(output.is_absolute() and '..' not in output.parts and not output.exists(), 'exclusive output')
    for parent in output.parents:
        if parent.exists():
            common.need(not parent.is_symlink() and not getattr(parent.lstat(), 'st_file_attributes', 0)&0x400, 'output ancestor')
    output.mkdir(); (output/'captures').mkdir()
    common.write(output/'input-binding.json', binding_raw)
    command = transport if transport is not None else common.Commands(output/'captures', deadline)
    name = 'meri-proxy-runtime4-'+b['runId']; cid = None; image_config = {}; attempted = False
    result = {'schema': 'meri.proxy.runtime4.measurement/1', 'bindingSha256': expected_sha,
              'sourceCommit': b['sourceCommit'], 'contextSha256': b['contextSha256'], 'recipeSha256': b['recipeSha256'],
              'imageId': b['imageId'], 'bodies': {}, 'collectionPassed': False, 'cleanupConfirmed': False,
              'runId': b['runId'], 'containerName': name, 'containerId': None, 'createAttempted': False,
              'sourceStable': False, 'runtimeAdmitted': False, 'errorType': None, 'cleanupErrorType': None}
    def call(label, args, cap=1024*1024, cleanup=False):
        remaining = (deadline if cleanup else deadline-30)-time.monotonic()
        common.need(remaining > 0, 'collector deadline')
        return command(label, ['docker', *args], seconds=min(30, remaining), cap=cap)
    try:
        image_config = image(common.loads(call('image', ['image', 'inspect', b['imageId']])), b['imageId'])
        common.need(LABEL not in (image_config.get('Labels') or {}), 'reserved ownership label')
        absent = call('pre-create-absence', ['container', 'ls', '-a', '--no-trunc', '--filter',
                      'name=^/'+name+'$', '--format', '{{.ID}}'])
        common.need(absent == b'', 'collection name already exists; no adoption')
        common.save(output/'create-attempt.json', {'bindingSha256': expected_sha, 'containerName': name,
                    'imageId': b['imageId'], 'runId': b['runId'], 'state': 'ATTEMPT_BEFORE_SEND_NO_RETRY'})
        attempted = True; result['createAttempted'] = True
        try:
            ack = call('create', ['create', '--name', name, '--label', LABEL+'='+b['runId'], '--network', 'none',
                       '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                       '--entrypoint', '/meri-runtime4-never-start', b['imageId']])
        finally:
            cid = owned(common.loads(call('created', ['container', 'inspect', name], cleanup=True)),
                        b['imageId'], name, b['runId'], image_config)
            result['containerId'] = cid
        common.need(ack == (cid+'\n').encode('ascii'), 'exact create ACK')
        total = 0
        for key, expected in EXPECTED.items():
            data = body(call('body-'+key, ['cp', cid+':'+expected['path'], '-'], expected['bytes']+10240), key)
            total += len(data); common.need(total <= AGGREGATE_CAP, 'aggregate body cap')
            common.write(output/(key+'.bin'), data)
            result['bodies'][key] = {**expected, 'imageId': b['imageId']}
        result['collectionPassed'] = True
    except BaseException as error:
        result['errorType'] = type(error).__name__
    finally:
        if attempted and cid is not None:
            try:
                current = owned(common.loads(call('cleanup-owner', ['container', 'inspect', cid], cleanup=True)),
                                b['imageId'], name, b['runId'], image_config)
                common.need(current == cid, 'cleanup exact ID')
                call('remove', ['rm', '-v', cid], cleanup=True)
                raw = call('container-absence', ['container', 'ls', '-a', '--no-trunc', '--filter', 'id='+cid,
                           '--format', '{{.ID}}'], cleanup=True)
                common.need(raw == b'', 'positive container absence')
                result['cleanupConfirmed'] = True
            except BaseException as error:
                result['cleanupErrorType'] = type(error).__name__
        try:
            source_check(b); result['sourceStable'] = True
        except BaseException as error:
            result['errorType'] = type(error).__name__
        result['collectionPassed'] = (result['collectionPassed'] and result['cleanupConfirmed']
                                      and result['sourceStable'] and time.monotonic() < deadline)
        common.save(output/'result.json', result)
    return result


