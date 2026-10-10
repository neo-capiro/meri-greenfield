"""Synthetic offline OCI tests. Patched synthetic pins never confer real-image acceptance."""
import gzip
import hashlib
import io
import json
import pathlib
import sys
import tarfile
import tempfile
import unittest
from unittest import mock


def deny_external(event, args):
    if event in ('socket.__new__', 'subprocess.Popen', 'os.system', 'os.posix_spawn'):
        raise RuntimeError('external execution forbidden in synthetic OCI tests')


sys.addaudithook(deny_external)
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import oci_layer_overlay as layer
import proxy_oci_inventory as inventory

SCHEMA = 'app/schema.prisma'
sha = lambda b: hashlib.sha256(b).hexdigest()


def archive(rows, tail=b''):
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode='w', format=tarfile.PAX_FORMAT) as tar:
        for name, kind, body in rows:
            info = tarfile.TarInfo(name)
            if kind == 'dir':
                info.type = tarfile.DIRTYPE
            elif kind in ('symlink', 'hardlink'):
                info.type = tarfile.SYMTYPE if kind == 'symlink' else tarfile.LNKTYPE
                info.linkname = body
            elif kind == 'fifo':
                info.type = tarfile.FIFOTYPE
            else:
                info.size = len(body)
            tar.addfile(info, io.BytesIO(body) if kind == 'file' else None)
    raw = out.getvalue()+tail
    return gzip.compress(raw), 'sha256:'+sha(raw)


def add(overlay, rows, tail=b''):
    compressed, diff = archive(rows, tail)
    overlay.add_layer(io.BytesIO(compressed), diff, len(overlay.layers)+1)
    return compressed, diff


class OverlayTests(unittest.TestCase):
    def test_path_refusals(self):
        for name in ('../escape', '/absolute', 'a/../b', 'a\\b', 'C:stream', 'a//b', 'a/./b'):
            with self.subTest(name=name), self.assertRaises(layer.Refusal):
                add(layer.Overlay(), [(name, 'file', b'x')])
        # Raw tar names terminate at NUL. Use PAX to deliver an actual embedded-NUL path.
        with self.assertRaises(layer.Refusal): layer.path_name('a\x00b')
        out = io.BytesIO()
        with tarfile.open(fileobj=out, mode='w', format=tarfile.PAX_FORMAT) as tar:
            info = tarfile.TarInfo('placeholder'); info.pax_headers = {'path':'a\x00b'}
            tar.addfile(info)
        raw = out.getvalue()
        with self.assertRaises(layer.Refusal):
            layer.Overlay().add_layer(io.BytesIO(gzip.compress(raw)), 'sha256:'+sha(raw), 1)

    def test_whiteout_same_layer_additions_both_orders(self):
        for rows in ([(SCHEMA, 'file', b'new'), ('app/.wh.schema.prisma', 'file', b'')],
                     [('app/.wh.schema.prisma', 'file', b''), (SCHEMA, 'file', b'new')]):
            overlay = layer.Overlay(); add(overlay, [(SCHEMA, 'file', b'old')]); add(overlay, rows)
            self.assertEqual(overlay.objects[overlay.entries[SCHEMA]['sha256']], b'new')

    def test_opaque_preserves_same_layer_children_both_orders(self):
        for rows in ([('opt/prisma/.wh..wh..opq', 'file', b''), ('opt/prisma/new', 'file', b'n')],
                     [('opt/prisma/new', 'file', b'n'), ('opt/prisma/.wh..wh..opq', 'file', b'')]):
            overlay = layer.Overlay(); add(overlay, [('opt/prisma/old', 'file', b'o')]); add(overlay, rows)
            self.assertNotIn('opt/prisma/old', overlay.entries)
            self.assertIn('opt/prisma/new', overlay.entries)

    def test_directory_to_file_removes_lower_descendants(self):
        overlay = layer.Overlay(); add(overlay, [('opt/prisma/dir/a', 'file', b'a')])
        add(overlay, [('opt/prisma/dir', 'file', b'f')])
        self.assertNotIn('opt/prisma/dir/a', overlay.entries)

    def test_explicit_file_to_directory_replacement(self):
        overlay = layer.Overlay(); add(overlay, [('opt/prisma/dir', 'file', b'f')])
        add(overlay, [('opt/prisma/dir/a', 'file', b'a'), ('opt/prisma/dir', 'dir', None)])
        self.assertEqual(overlay.entries['opt/prisma/dir']['kind'], 'directory')
        self.assertIn('opt/prisma/dir/a', overlay.entries)

    def test_ambiguous_ancestor_and_same_layer_conflict_refused(self):
        overlay = layer.Overlay(); add(overlay, [('opt/prisma/dir', 'symlink', '/outside')])
        with self.assertRaises(layer.Refusal): add(overlay, [('opt/prisma/dir/a', 'file', b'a')])
        with self.assertRaises(layer.Refusal):
            add(layer.Overlay(), [('opt/prisma/dir', 'file', b'f'), ('opt/prisma/dir/a', 'file', b'a')])

    def test_duplicate_normalized_path(self):
        with self.assertRaises(layer.Refusal):
            add(layer.Overlay(), [(SCHEMA, 'file', b'a'), ('./'+SCHEMA, 'file', b'b')])

    def test_malformed_whiteouts(self):
        for row in [('app/.wh.schema.prisma', 'file', b'x'), ('app/.wh.', 'file', b''),
                    ('app/.wh..wh.plnk', 'file', b''), ('app/.wh.schema.prisma', 'symlink', 'x')]:
            with self.subTest(row=row), self.assertRaises(layer.Refusal): add(layer.Overlay(), [row])

    def test_selected_member_and_aggregate_bounds(self):
        with self.assertRaises(layer.Refusal):
            add(layer.Overlay(layer.Limits(member=2)), [(SCHEMA, 'file', b'123')])
        with self.assertRaises(layer.Refusal):
            add(layer.Overlay(layer.Limits(selected=3)), [(SCHEMA, 'file', b'12'), ('opt/prisma/x', 'file', b'34')])

    def test_expanded_and_member_bounds(self):
        with self.assertRaises(layer.Refusal): add(layer.Overlay(layer.Limits(layer=1024)), [(SCHEMA, 'file', b'x')])
        overlay = layer.Overlay(layer.Limits(expanded=15000)); add(overlay, [(SCHEMA, 'file', b'x')])
        with self.assertRaises(layer.Refusal): add(overlay, [(SCHEMA, 'file', b'y')])
        with self.assertRaises(layer.Refusal):
            add(layer.Overlay(layer.Limits(members=1)), [(SCHEMA, 'file', b'x'), ('opt/prisma/y', 'file', b'y')])

    def test_full_tar_tail_bound_and_hash(self):
        compressed, diff = archive([(SCHEMA, 'file', b'x')], b'TAIL_AFTER_TAR_ZERO_BLOCKS')
        overlay = layer.Overlay(); overlay.add_layer(io.BytesIO(compressed), diff, 1)
        self.assertEqual(overlay.layers[0]['expandedBytes'], len(gzip.decompress(compressed)))
        without_tail = 'sha256:'+sha(gzip.decompress(compressed)[:-25])
        with self.assertRaises(layer.Refusal): layer.Overlay().add_layer(io.BytesIO(compressed), without_tail, 1)

    def test_corrupt_gzip_refused(self):
        compressed, diff = archive([(SCHEMA, 'file', b'x')])
        with self.assertRaises((OSError, EOFError)):
            layer.Overlay().add_layer(io.BytesIO(compressed[:-6]), diff, 1)

    def test_inert_links_hold_and_enterprise_not_extracted(self):
        overlay = layer.Overlay()
        add(overlay, [('opt/prisma/link', 'symlink', '../../outside'), ('opt/prisma/hard', 'hardlink', SCHEMA),
                      ('app/enterprise/private.py', 'file', b'not-adopted')])
        result = overlay.inventory()
        self.assertEqual(len([r for r in result['holds'] if r['reason']=='INERT_LINK_IDENTITY_NOT_RESOLVED']), 2)
        self.assertEqual(overlay.objects, {})
        self.assertIn('app/enterprise/private.py', result['enterprisePaths'])

    def test_selected_special_refusal_and_missing_hold(self):
        with self.assertRaises(layer.Refusal): add(layer.Overlay(), [(SCHEMA, 'fifo', None)])
        self.assertEqual(layer.Overlay().inventory()['status'], 'HOLD')

    def test_extension_header_bomb_and_sparse(self):
        for kind, size in [(tarfile.XHDTYPE, 65537), (tarfile.XGLTYPE, 0),
                           (tarfile.GNUTYPE_LONGNAME, 8193), (tarfile.GNUTYPE_SPARSE, 0)]:
            header = tarfile.TarInfo('extension'); header.type = kind; header.size = size
            raw = header.tobuf()+b'\x00'*1024
            with self.subTest(kind=kind), self.assertRaises(layer.Refusal):
                layer.Overlay().add_layer(io.BytesIO(gzip.compress(raw)), 'sha256:'+sha(raw), 1)

    def test_typed_limits_and_original_deadline(self):
        for kwargs in ({'members':True}, {'layer':0}, {'selected':513*1024**2}):
            with self.assertRaises(layer.Refusal): layer.Limits(**kwargs)
        with self.assertRaises(layer.Refusal): add(layer.Overlay(deadline=0), [(SCHEMA, 'file', b'x')])

    def test_implicit_directory_index_and_subtree_deletion(self):
        overlay = layer.Overlay()
        add(overlay, [('opt/prisma/data/'+str(i), 'file', b'x') for i in range(2000)])
        self.assertEqual(overlay.entries['opt/prisma']['kind'], 'directory')
        add(overlay, [('opt/.wh.prisma', 'file', b'')])
        self.assertFalse(any(p.startswith('opt/prisma') for p in overlay.entries))
        with self.assertRaises(layer.Refusal):
            add(layer.Overlay(layer.Limits(members=2)), [('a/b/c', 'file', b'x')])


class PinnedIOTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix='meri-proxy-oci-')
        self.root = pathlib.Path(self.scratch.name)

    def tearDown(self):
        self.scratch.cleanup()

    def fixture(self):
        compressed, diff = archive([(SCHEMA, 'file', b'synthetic schema')])
        row = {'digest':'sha256:'+sha(compressed), 'size':len(compressed),
               'mediaType':'application/vnd.oci.image.layer.v1.tar+gzip'}
        c = {'os':'linux', 'architecture':'amd64', 'rootfs':{'type':'layers','diff_ids':[diff]*23},
             'config':{'Labels':{'org.opencontainers.image.revision':'fc3920bf403124ad075bc04990f999f7e0612e12'}}}
        cr = json.dumps(c).encode()
        m = {'schemaVersion':2,'config':{'digest':'sha256:'+sha(cr),'size':len(cr)},'layers':[row]*23}
        mr = json.dumps(m).encode()
        (self.root/'manifest').write_bytes(mr); (self.root/'config').write_bytes(cr)
        (self.root/(sha(compressed)+'.blob')).write_bytes(compressed)
        return mr, cr, compressed

    def synthetic_pins(self, mr, cr, compressed):
        return mock.patch.multiple(inventory, MANIFEST=sha(mr), CONFIG=sha(cr), COMPRESSED=23*len(compressed))

    def run_fixture(self):
        return inventory.apply_pinned_layers(self.root/'manifest', self.root/'config', self.root, self.root/'out')

    def test_unpinned_input_refuses_before_output(self):
        self.fixture()
        with self.assertRaises(layer.Refusal): self.run_fixture()
        self.assertFalse((self.root/'out').exists())

    def test_synthetic_io_and_exclusive_cas(self):
        mr, cr, compressed = self.fixture()
        with self.synthetic_pins(mr, cr, compressed):
            result = self.run_fixture()
            self.assertEqual(result['selected'][0]['path'], SCHEMA)
            files = list((self.root/'out/objects').iterdir())
            self.assertEqual(len(files), 1); self.assertEqual(files[0].read_bytes(), b'synthetic schema')
            with self.assertRaises(layer.Refusal): self.run_fixture()

    def test_bad_compressed_hash_and_missing_preallocate(self):
        mr, cr, compressed = self.fixture(); path = self.root/(sha(compressed)+'.blob')
        with self.synthetic_pins(mr, cr, compressed):
            path.write_bytes(compressed[:-1]+b'!')
            with self.assertRaises(layer.Refusal): self.run_fixture()
            self.assertFalse((self.root/'out').exists())
            path.unlink()
            with self.assertRaises(OSError): self.run_fixture()
            self.assertFalse((self.root/'out').exists())

    def test_post_scan_input_drift_no_output(self):
        mr, cr, compressed = self.fixture(); original = layer.Overlay.add_layer
        def change_after(overlay, handle, diff, index):
            original(overlay, handle, diff, index)
            if index == 1:
                (self.root/(sha(compressed)+'.blob')).write_bytes(compressed+b'changed')
        with self.synthetic_pins(mr, cr, compressed), mock.patch.object(layer.Overlay, 'add_layer', change_after):
            with self.assertRaises(layer.Refusal): self.run_fixture()
        self.assertFalse((self.root/'out').exists())

    def test_duplicate_json_and_no_external_execution(self):
        with self.assertRaises(layer.Refusal): inventory.parse(b'{"x":1,"x":2}')
        with self.assertRaises(layer.Refusal): inventory.parse(b'{"x":NaN}')
        import socket
        with self.assertRaises(RuntimeError): socket.socket()


if __name__ == '__main__':
    unittest.main(verbosity=2)
