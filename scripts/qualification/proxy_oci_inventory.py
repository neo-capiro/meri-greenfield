"""Fixed proxy Linux OCI selected-byte inventory, offline only.

Usage: --manifest FILE --config FILE --blobs DIRECTORY --output NEW_DIRECTORY
Exit 0: inert DATA written (inspect HOLDs); 2: handled refusal; no runtime admission.
Blob names are lowercase <sha256>.blob. No network, executables or archive extraction.
"""
import argparse
import hashlib
import json
import os
import pathlib
import shutil
import stat
import sys
import tarfile
import time
import zlib

if __package__:
    from .oci_layer_overlay import Limits, Overlay, Refusal
else:
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from oci_layer_overlay import Limits, Overlay, Refusal

MANIFEST = 'ff11074add7b1cee63759b90eb2a9e4072763e520297761ea05a911b4a5b251d'
CONFIG = 'db4055eec62df7f5f23828795de317b1856275178688ce1735ca16e1b343044c'
COMPRESSED = 401268538
META_CAP = 2 * 1024**2


def parse(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise Refusal('duplicate JSON key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(Refusal('nonfinite JSON')))


def signature(s):
    # Windows executable permission bits differ between lstat and fstat; this reader
    # compares each API to itself below, and shared stable file identity across them.
    mode = s.st_mode & ~0o111 if os.name == 'nt' else s.st_mode
    return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_nlink, mode)


def within_api(s):
    return (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)


def open_regular(path):
    path = pathlib.Path(path).absolute()
    for ancestor in [path, *path.parents]:
        value = ancestor.lstat()
        if stat.S_ISLNK(value.st_mode) or getattr(value, 'st_file_attributes', 0) & 0x400:
            raise Refusal('link/reparse input refused')
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
        raise Refusal('nonregular/nonsingleton input')
    handle = path.open('rb')
    try:
        if signature(before) != signature(os.fstat(handle.fileno())):
            raise Refusal('input open identity drift')
    except BaseException:
        handle.close()
        raise
    return handle, before


def pinned_read(path, expected, cap, deadline):
    handle, before = open_regular(path)
    digest, raw, length = hashlib.sha256(), [], 0
    try:
        fd_before = os.fstat(handle.fileno())
        while True:
            if time.monotonic() >= deadline:
                raise Refusal('inventory deadline')
            body = handle.read(65536)
            if not body:
                break
            length += len(body)
            if length > cap:
                raise Refusal('compressed/input byte limit')
            digest.update(body)
            if cap == META_CAP:
                raw.append(body)
        fd_after = os.fstat(handle.fileno())
        if within_api(fd_before) != within_api(fd_after) or within_api(before) != within_api(pathlib.Path(path).lstat()):
            raise Refusal('input changed while reading')
        if digest.hexdigest() != expected or length != before.st_size:
            raise Refusal('input hash/size mismatch')
        return b''.join(raw), {'bytes':length, 'sha256':digest.hexdigest()}
    finally:
        handle.close()


def apply_pinned_layers(manifest, config, blob_dir, new_output):
    """Only the fixed23-layer image; all file inputs pinned before output allocation."""
    deadline = time.monotonic()+1200
    output = pathlib.Path(new_output).absolute()
    if output.exists() or output.is_symlink() or not output.parent.is_dir():
        raise Refusal('output must be new with existing parent')
    for ancestor in [output.parent, *output.parent.parents]:
        value = ancestor.lstat()
        if stat.S_ISLNK(value.st_mode) or getattr(value, 'st_file_attributes', 0) & 0x400:
            raise Refusal('output ancestor link/reparse refused')
    if shutil.disk_usage(output.parent).free < 2*1024**3:
        raise Refusal('free disk floor')
    mr, manifest_record = pinned_read(manifest, MANIFEST, META_CAP, deadline)
    cr, config_record = pinned_read(config, CONFIG, META_CAP, deadline)
    m, c = parse(mr), parse(cr)
    layers = m['layers']
    if (m['schemaVersion'] != 2 or len(layers) != 23 or
        m['config']['digest'] != 'sha256:'+CONFIG or m['config']['size'] != len(cr) or
        c['os'] != 'linux' or c['architecture'] != 'amd64' or
        c['rootfs']['type'] != 'layers' or len(c['rootfs']['diff_ids']) != 23 or
        c['config']['Labels']['org.opencontainers.image.revision'] != 'fc3920bf403124ad075bc04990f999f7e0612e12' or
        sum(r['size'] for r in layers) != COMPRESSED):
        raise Refusal('fixed image binding mismatch')
    paths, records = [], []
    for row in layers:
        if row['mediaType'] != 'application/vnd.oci.image.layer.v1.tar+gzip':
            raise Refusal('unsupported fixed layer media type')
        digest = row['digest'].removeprefix('sha256:')
        path = pathlib.Path(blob_dir)/(digest+'.blob')
        _, record = pinned_read(path, digest, row['size'], deadline)
        if record['bytes'] != row['size']:
            raise Refusal('compressed descriptor size mismatch')
        paths.append(path); records.append(record)
    overlay = Overlay(Limits(), deadline)
    for index, (path, row, record) in enumerate(zip(paths, layers, records), 1):
        handle, before = open_regular(path)
        try:
            fd_before = os.fstat(handle.fileno())
            overlay.add_layer(handle, c['rootfs']['diff_ids'][index-1], index)
            if within_api(fd_before) != within_api(os.fstat(handle.fileno())) or within_api(before) != within_api(path.lstat()):
                raise Refusal('layer changed during scan')
        finally:
            handle.close()
        # Rebind complete compressed bytes after parsing; never trust stat equality alone.
        _, after = pinned_read(path, record['sha256'], row['size'], deadline)
        if after != record:
            raise Refusal('layer post-hash mismatch')
    pinned_read(manifest, MANIFEST, META_CAP, deadline)
    pinned_read(config, CONFIG, META_CAP, deadline)
    overlay.check_time()
    result = overlay.inventory()
    result.update(manifest=manifest_record, config=config_record, compressedLayers=records,
                  sourceRevision='fc3920bf403124ad075bc04990f999f7e0612e12',
                  scope='PRISMA_FIRST_STAGE_ONLY_NOT_COMPLETE_LINUX_DEPENDENCIES',
                  trustedFilesystemLimit='No hostile filesystem/atomic snapshot guarantee')
    # All archive validation precedes this exclusive allocation. No rollback/retry path.
    output.mkdir(exist_ok=False)
    objects = output/'objects'; objects.mkdir()
    referenced = {r['sha256'] for r in result['selected'] if 'sha256' in r}
    for digest in sorted(referenced):
        overlay.check_time()
        with (objects/digest).open('xb') as stream:
            stream.write(overlay.objects[digest])
    with (output/'inventory.json').open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(result, stream, indent=2); stream.write('\n')
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('manifest', 'config', 'blobs', 'output'):
        parser.add_argument('--'+name, required=True)
    args = parser.parse_args(argv)
    try:
        result = apply_pinned_layers(args.manifest, args.config, args.blobs, args.output)
    except (ValueError, OSError, KeyError, TypeError, EOFError, tarfile.TarError, zlib.error) as exc:
        print('REFUSED: '+type(exc).__name__, file=sys.stderr)
        return 2
    print(json.dumps({'status':result['status'], 'selected':len(result['selected']),
                      'runtimeAdmitted':False}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
