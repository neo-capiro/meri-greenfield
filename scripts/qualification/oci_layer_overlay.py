"""Offline OCI overlay DATA. Never materializes archive paths or native links."""
import gzip
import hashlib
import tarfile
import time
from dataclasses import dataclass


class Refusal(ValueError):
    """Bounded malformed or unsupported inventory input."""


class BoundedTarInfo(tarfile.TarInfo):
    """Bound stdlib extension-header allocation before its payload is parsed."""
    def _proc_member(self, archive):
        if self.type == tarfile.XGLTYPE:
            raise Refusal('global PAX state unsupported')
        if self.type in (tarfile.XHDTYPE, tarfile.XGLTYPE) and self.size > 65536:
            raise Refusal('PAX header byte limit')
        if self.type in (tarfile.GNUTYPE_LONGNAME, tarfile.GNUTYPE_LONGLINK) and self.size > 8192:
            raise Refusal('GNU long header byte limit')
        if self.type == tarfile.GNUTYPE_SPARSE:
            raise Refusal('sparse entry unsupported')
        return super()._proc_member(archive)


@dataclass(frozen=True)
class Limits:
    layer: int = 2 * 1024**3
    expanded: int = 4 * 1024**3
    members: int = 200000
    member: int = 128 * 1024**2
    selected: int = 512 * 1024**2

    def __post_init__(self):
        ceilings = (2*1024**3, 4*1024**3, 200000, 128*1024**2, 512*1024**2)
        for value, ceiling in zip((self.layer, self.expanded, self.members, self.member, self.selected), ceilings):
            if type(value) is not int or not 0 < value <= ceiling:
                raise Refusal('invalid inventory limit')


def path_name(value, directory=False):
    if not isinstance(value, str) or len(value) > 4096 or any(c in value for c in ('\x00', '\\', ':')):
        raise Refusal('unsafe archive path')
    while value.startswith('./'):
        value = value[2:]
    if directory:
        value = value.rstrip('/')
    if value in ('', '.') and directory:
        return ''
    if value.startswith('/') or any(p in ('', '.', '..') for p in value.split('/')):
        raise Refusal('unsafe archive path')
    return value


def selected(name):
    exact = {'app/schema.prisma', 'app/.venv/bin/prisma', 'etc/os-release',
             'usr/lib/os-release', 'lib/apk/db/installed', 'usr/bin/node', 'usr/bin/nodejs'}
    prefixes = ('app/.venv/lib/python3.13/site-packages/prisma/',
                'app/.venv/lib/python3.13/site-packages/prisma-0.11.0.dist-info/', 'opt/prisma/')
    if name in exact or name.startswith(prefixes):
        return True
    # Notices/ABI not in the fixed first-stage byte set remain a separately frozen second stage.
    return False


class Counted:
    def __init__(self, raw, overlay):
        self.raw, self.overlay = raw, overlay
        self.bytes, self.digest = 0, hashlib.sha256()

    def read(self, amount=65536):
        self.overlay.check_time()
        if amount < 0 or amount > 1024**2:
            raise Refusal('unbounded expanded read')
        data = self.raw.read(amount)
        self.bytes += len(data)
        self.overlay.expanded += len(data)
        if self.bytes > self.overlay.limits.layer or self.overlay.expanded > self.overlay.limits.expanded:
            raise Refusal('expanded byte limit')
        self.digest.update(data)
        return data


class Overlay:
    def __init__(self, limits=Limits(), deadline=None):
        self.limits, self.deadline = limits, deadline
        self.entries, self.objects, self.layers = {}, {}, []
        self.expanded = self.member_count = self.selected_bytes = 0
        self.metadata_chars = 0

    def check_time(self):
        if self.deadline is not None and time.monotonic() >= self.deadline:
            raise Refusal('inventory deadline')

    def add_layer(self, compressed, expected_diff, index):
        """Caller has independently pinned compressed bytes. Verify full tar including its tail."""
        self.check_time()
        staged, removed, opaque = {}, [], []
        with gzip.GzipFile(fileobj=compressed, mode='rb') as gz:
            counted = Counted(gz, self)
            with tarfile.open(fileobj=counted, mode='r|', tarinfo=BoundedTarInfo) as archive:
                for member in archive:
                    self.check_time()
                    self.member_count += 1
                    if self.member_count > self.limits.members:
                        raise Refusal('member count limit')
                    name = path_name(member.name, member.isdir())
                    self.metadata_chars += len(name)+len(member.linkname)
                    if self.metadata_chars > 32*1024**2:
                        raise Refusal('path/link metadata limit')
                    if not name:
                        continue
                    if member.size < 0:
                        raise Refusal('negative member size')
                    if name in staged:
                        raise Refusal('duplicate normalized layer entry')
                    if member.issparse() or any(k.startswith('GNU.sparse') for k in member.pax_headers):
                        raise Refusal('sparse entry unsupported')
                    base = name.rsplit('/', 1)[-1]
                    parent = name.rsplit('/', 1)[0] if '/' in name else ''
                    if base.startswith('.wh.'):
                        if not member.isfile() or member.size != 0:
                            raise Refusal('malformed whiteout')
                        if base == '.wh..wh..opq':
                            opaque.append(parent)
                        elif base.startswith('.wh..wh.') or base == '.wh.':
                            raise Refusal('unsupported whiteout')
                        else:
                            removed.append(path_name((parent+'/' if parent else '')+base[4:]))
                        # Track markers separately from their target names for duplicate detection.
                        staged[name] = {'kind': 'whiteout'}
                        continue
                    if member.isfile():
                        kind = 'file'
                    elif member.isdir():
                        kind = 'directory'
                    elif member.issym():
                        kind = 'symlink'
                    elif member.islnk():
                        kind = 'hardlink'
                    else:
                        kind = 'special'
                    row = {'kind': kind, 'mode': member.mode, 'size': member.size, 'layer': index}
                    if kind in ('symlink', 'hardlink'):
                        if not isinstance(member.linkname, str) or len(member.linkname) > 4096 or '\x00' in member.linkname:
                            raise Refusal('malformed inert link metadata')
                        row['target'] = member.linkname
                    if selected(name):
                        if kind == 'special':
                            raise Refusal('unsupported selected entry')
                        if kind == 'file':
                            if not 0 <= member.size <= self.limits.member:
                                raise Refusal('selected member byte limit')
                            self.selected_bytes += member.size
                            if self.selected_bytes > self.limits.selected:
                                raise Refusal('selected byte limit')
                            stream = archive.extractfile(member)
                            body = stream.read(member.size+1)
                            if len(body) != member.size:
                                raise Refusal('selected file size mismatch')
                            digest = hashlib.sha256(body).hexdigest()
                            row['sha256'] = digest
                            self.objects[digest] = body
                    staged[name] = row
            # tarfile may stop at its end marker; drain gzip to bind padding/trailing bytes too.
            while counted.read(65536):
                pass
            if 'sha256:'+counted.digest.hexdigest() != expected_diff:
                raise Refusal('expanded diff_id mismatch')
        # Whiteouts affect lower layers only, irrespective of their tar ordering.
        result = dict(self.entries)
        def remove_tree(target, descendants_only=False):
            self.check_time()
            if not target:
                result.clear()
                return
            if target not in result:
                return
            if result[target]['kind'] != 'directory':
                if not descendants_only:
                    result.pop(target)
                return
            for path in list(result):
                if (not descendants_only and path == target) or path.startswith(target+'/'):
                    del result[path]
        for target in removed:
            remove_tree(target)
        for parent in opaque:
            remove_tree(parent, descendants_only=True)
        additions = {p:r for p,r in staged.items() if r['kind'] != 'whiteout'}
        for name in sorted(additions, key=lambda p:(p.count('/'), p)):
            self.check_time()
            row = additions[name]
            parts = name.split('/')
            for length in range(1, len(parts)):
                ancestor = '/'.join(parts[:length])
                if ancestor in result and result[ancestor]['kind'] != 'directory':
                    raise Refusal('ambiguous non-directory ancestor')
                if ancestor not in result:
                    if len(result) >= self.limits.members:
                        raise Refusal('virtual entry limit')
                    result[ancestor] = {'kind':'directory', 'mode':None, 'size':0,
                                        'layer':index, 'implicit':True}
            if name in result and (row['kind'] != 'directory' or result[name]['kind'] != 'directory'):
                remove_tree(name)
            if name not in result and len(result) >= self.limits.members:
                raise Refusal('virtual entry limit')
            result[name] = row
        self.entries = result
        self.layers.append({'index':index, 'expandedBytes':counted.bytes, 'diffId':expected_diff,
                            'whiteouts':removed, 'opaqueDirectories':opaque})

    def inventory(self):
        rows = [{'path':p, **r} for p,r in sorted(self.entries.items()) if selected(p)]
        holds = [{'path':r['path'], 'reason':'INERT_LINK_IDENTITY_NOT_RESOLVED'} for r in rows
                 if r['kind'] in ('symlink', 'hardlink')]
        for required in ('app/schema.prisma', 'app/.venv/lib/python3.13/site-packages/prisma/client.py',
                         'opt/prisma/binaries/node_modules/prisma/build/index.js'):
            if not any(r['path'] == required and r['kind'] == 'file' for r in rows):
                holds.append({'path':required, 'reason':'REQUIRED_SELECTED_REGULAR_FILE_MISSING'})
        if not any(r['path'] in ('usr/bin/node', 'usr/bin/nodejs') and r['kind'] == 'file' for r in rows):
            holds.append({'path':'usr/bin/node', 'reason':'NODE_REGULAR_BYTES_NOT_ESTABLISHED'})
        return {'status':'HOLD' if holds else 'SELECTED_BYTES_INVENTORIED_NOT_ADMITTED',
                'selected':rows, 'holds':holds, 'layers':self.layers,
                'enterprisePaths':[p for p in sorted(self.entries) if p == 'app/enterprise' or p.startswith('app/enterprise/')],
                'expandedBytes':self.expanded, 'members':self.member_count,
                'limits':self.limits.__dict__, 'nativeExecution':False,
                'noticeAndAbiSecondStage':'UNQUALIFIED_REQUIRES_EXACT_MEMBER_FREEZE',
                'communityImageAdmitted':False}
