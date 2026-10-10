"""Git-only preparation of the fixed D006 v2 support package. No cloud or runtime execution."""
from pathlib import Path
import hashlib
import io
import json
import os
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
GIT = r'C:\Program Files\Git\cmd\git.exe'
SOURCE_REFERENCE = 'e23667a351ed3daaac9b2f95219e9c06f0510027'
# Literal independently frozen records from the reviewed source reference. A later
# integration commit is eligible only when all 27 public blobs remain identical.
PINS = (
    ('infra/browser-qualification/bootstrap.sh', 13205, 'e7034a9a40824b5af02ac898bb68b66d3c1dcc54af670418319d4636e806fb2a'),
    ('infra/browser-qualification/host-evidence.py', 8933, 'e5210fb57fde6a9083285c285bf9915ba0f63d3e80bda330e2d675ec62c92396'),
    ('infra/browser-qualification/host_evidence/__init__.py', 432, 'd1f277344c9e72675e21e7c288dde1e0225c8c5e9eeb69ad700f353671dfb184'),
    ('infra/browser-qualification/host_evidence/admission.py', 19738, 'a9c1b7f53185c62760a468ee04c59eff120a11d884b912ebf518b4d55a6d5aa2'),
    ('infra/browser-qualification/host_evidence/browser_capture.py', 5179, '1b7d7e5e3ec3bde295435125bbed9ccb155bbf68be1a716241aee1e140590f74'),
    ('infra/browser-qualification/host_evidence/classification.py', 16753, 'a9b05cc2caed38c8d4b74a9cac816fe5fd189f31d48a1f4e707272d37190c17a'),
    ('infra/browser-qualification/host_evidence/cli.py', 8707, '1fbf9a5918f03c4431f25de0825c541ba485977386b59f89b75c3cfff5c8210c'),
    ('infra/browser-qualification/host_evidence/collection.py', 19858, 'bbcd697aaca5cbcaadaae052629d82ceb02c3cd36512057780984b648411dbce'),
    ('infra/browser-qualification/host_evidence/config.py', 4708, '1f6724c3b0b4037cd674ce89b25ec5b859a228c767fbb659ec992a4795e21c54'),
    ('infra/browser-qualification/host_evidence/evidence_io.py', 3577, 'c9cf64b93422d9d7b89ac413233d33e802fd3f68957f1e4e9b3d3f6e99ca03aa'),
    ('infra/browser-qualification/host_evidence/export_protocol.py', 11050, 'df036706c05d8243f125c6a0734b06222d0b1997626f820a1f609aff2e64c284'),
    ('infra/browser-qualification/host_evidence/poll.py', 4284, '8868ff3145083848b7524a4e91914ddfb122075c63ce462df4afc61ebaa9d336'),
    ('infra/browser-qualification/host_evidence/source_binding.py', 6116, '6190d3ee9c34fbfe61ca6aa5ad0e945cc202ad5d73bbb9601a98db1f16cae3c7'),
    ('infra/browser-qualification/seccomp.chromium-155-amd64.json', 17188, 'e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6'),
    ('infra/browser-qualification/app.mjs', 909, '7ed1409f6f536bff34bf52dce870da522f8aef38b6d8c9aa0fb5634217721f20'),
    ('infra/browser-qualification/js/asset-loader.mjs', 8549, '6211b12ffa663ec37a27dd5a5c79c39c5ad269505042d68d3d969313701f6c08'),
    ('infra/browser-qualification/js/asset-sources.mjs', 3600, '2100d93d76e4e22055af16159fbc79f717b98498147122d4f51044c0d71c5ecd'),
    ('infra/browser-qualification/js/asset-verifier.mjs', 3647, '501ec21f803b36646ad18a12d5406e2c89c605a7bf5e4a29a30ffb451de540e2'),
    ('infra/browser-qualification/js/cli.mjs', 1178, '18b47bf597f9cf1d683feca39bb43f4cfc45aa6975d53e8243965f91563864c5'),
    ('infra/browser-qualification/js/config.mjs', 3710, '78bedcdb059a1a43f17f149593e4fa05fb117f091102255425d870f0c485705a'),
    ('infra/browser-qualification/js/legacy-classifier.mjs', 6064, '06837cf61b2054571918a7b81b8b79e4b8c5909ef8a4aedf8008c725691ffede'),
    ('infra/browser-qualification/js/stack.mjs', 6680, 'dc156f9f740e1ec07c17d81e569124213b9c5a1971d96a7c0ec694559df4c1b7'),
    ('infra/browser-qualification/js/user-data.mjs', 1834, '62dbe0128791eab734d405abee177db2212afd2fc2bc9fd282056eb4d031864e'),
    ('infra/browser-qualification/component-pins.json', 18623, '07836ed02f8f23f72b9c70ea01d13286bb42ac3c9b1a11f2026b814a6c4d4af0'),
    ('infra/qualification/host-assets.Dockerfile', 1992, '112a3f9a1e9596e07a3487811765f7cbc9981bd3ab07d46d1d34fea5d7f84428'),
    ('infra/qualification/host-assets.buildspec.json', 13650, '227f20e6111656d748a3b69e470110fc1aaf346e0f87ca4a1552d2a1a46a32c2'),
    ('infra/qualification/app.mjs', 13676, 'a866b68fda76cf3bf09636909d62d7dbee646ed396a7879052be63ee60a0442f'),
)
ASSET_PATHS = ('bootstrap.sh', 'host-evidence.py', 'host_evidence/__init__.py',
               'host_evidence/admission.py', 'host_evidence/browser_capture.py',
               'host_evidence/classification.py', 'host_evidence/cli.py',
               'host_evidence/collection.py', 'host_evidence/config.py',
               'host_evidence/evidence_io.py', 'host_evidence/export_protocol.py',
               'host_evidence/poll.py', 'host_evidence/source_binding.py', 'seccomp.json')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=True) + '\n').encode('ascii')


def parse_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate JSON key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs)


def write_new(path, data):
    with Path(path).open('xb') as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())


def save_new(path, value):
    write_new(path, json_bytes(value))


def git_read(repo, arguments, label, capture_dir, stdin=b''):
    """Fixed Git, explicit argument arrays, no external filters/hooks or ambient GIT overrides."""
    environment = {key: value for key, value in os.environ.items() if not key.upper().startswith('GIT_')}
    environment.update(GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0',
                       GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='NUL')
    argv = [GIT, '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
            '-c', 'core.hooksPath=NUL', '-C', str(repo), *arguments]
    try:
        result = subprocess.run(argv, input=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                env=environment, timeout=45, shell=False)
        stdout, stderr, code, timed_out = result.stdout, result.stderr, result.returncode, False
    except subprocess.TimeoutExpired as error:
        stdout, stderr, code, timed_out = error.stdout or b'', error.stderr or b'', None, True
    if capture_dir is not None:
        capture_dir = Path(capture_dir)
        write_new(capture_dir / (label + '.stdout.bin'), stdout)
        write_new(capture_dir / (label + '.stderr.bin'), stderr)
        save_new(capture_dir / (label + '.json'), {'argv': argv, 'exitCode': code, 'timedOut': timed_out,
                 'timeoutSeconds': 45, 'stdoutBytes': len(stdout), 'stdoutSha256': sha(stdout),
                 'stderrBytes': len(stderr), 'stderrSha256': sha(stderr),
                 'limits': 'Direct-child timeout; PIPE has no memory byte cap; trusted local Git repository.'})
    require(code == 0 and not timed_out, 'Git read failed; retain raw evidence: ' + label)
    return stdout


def snapshot(repo, commit, capture_dir=None):
    """Read only immutable Git blobs, never worktree source or an all-repository archive."""
    require(isinstance(commit, str) and re.fullmatch('[a-f0-9]{40}', commit), 'exact 40-hex commit required')
    require(git_read(repo, ['cat-file', '-t', commit], 'commit', capture_dir).strip() == b'commit', 'not a commit')
    tree = git_read(repo, ['ls-tree', '-r', '-z', '-l', commit, '--', *[p[0] for p in PINS]], 'tree', capture_dir)
    entries = {}
    for entry in tree.rstrip(b'\0').split(b'\0'):
        header, path = entry.split(b'\t', 1)
        mode, kind, oid, size = header.split()
        path = path.decode('ascii')
        require(path not in entries and kind == b'blob' and mode in (b'100644', b'100755'), 'nonregular/duplicate source')
        require(re.fullmatch(b'[a-f0-9]{40}', oid), 'invalid Git object ID')
        entries[path] = (mode, oid, int(size))
    require(set(entries) == {p[0] for p in PINS}, 'missing fixed public source')
    for path, size, digest in PINS:
        require(entries[path][2] == size and 0 < size <= 2 * 1024 * 1024, 'fixed source size drift: ' + path)
    request = b''.join(entries[p[0]][1] + b'\n' for p in PINS)
    raw = git_read(repo, ['cat-file', '--batch'], 'blobs', capture_dir, request)
    cursor, files = 0, {}
    for path, size, digest in PINS:
        end = raw.index(b'\n', cursor)
        require(raw[cursor:end] == entries[path][1] + b' blob ' + str(size).encode(), 'Git batch header mismatch')
        data = raw[end + 1:end + 1 + size]
        require(raw[end + 1 + size:end + 2 + size] == b'\n' and sha(data) == digest, 'fixed source hash drift: ' + path)
        cursor = end + 2 + size
        files[path] = data
    require(cursor == len(raw), 'extra Git batch data')
    content = content_for(commit)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_STORED) as archive:
        for path, _, _ in PINS:
            item = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
            item.create_system = 3
            item.external_attr = int(entries[path][0], 8) << 16
            archive.writestr(item, files[path])
    packed = buffer.getvalue()
    require(0 < len(packed) < 2 * 1024 * 1024, 'fixed archive size bound')
    return content, packed, files
def content_for(commit):
    require(isinstance(commit, str) and re.fullmatch('[a-f0-9]{40}', commit), 'exact 40-hex commit required')
    records = [{'path': path, 'bytes': size, 'sha256': digest} for path, size, digest in PINS]
    return {'schema': 'meri-host-assets-build-input/2', 'sourceCommit': commit,
            'sourceFiles': [dict(record, assetPath=ASSET_PATHS[i]) for i, record in enumerate(records[:14])],
            'ownerFiles': records[14:24], 'dockerfile': records[24], 'buildspec': records[25],
            'builderAuthority': records[26]}