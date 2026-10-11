"""Finite synthetic ABI DATA controls; no native tools/real image scans."""
import gzip
import hashlib
import io
import json
import pathlib
import struct
import sys
import tarfile
import tempfile
import unittest
from unittest import mock


def deny(event,args):
    if event.startswith('socket.') or event in ('subprocess.Popen','os.system','os.posix_spawn'):
        raise RuntimeError('native/transport dispatch denied')
sys.addaudithook(deny)
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
import elf_inventory as elf
import oci_layer_overlay as layer
import proxy_oci_abi_inventory as abi


def binary():
    raw=bytearray(1024);raw[:16]=b'\x7fELF\x02\x01\x01'+b'\0'*9
    struct.pack_into('<HHIQQQIHHHHHH',raw,16,3,62,1,0,64,0,0,64,56,3,0,0,0)
    struct.pack_into('<IIQQQQQQ',raw,64,1,5,0,0x400000,0,1024,4096,4096)
    struct.pack_into('<IIQQQQQQ',raw,120,2,4,512,0x400200,0,64,64,8)
    interpreter=b'/lib64/ld-linux-x86-64.so.2\0'
    struct.pack_into('<IIQQQQQQ',raw,176,3,4,256,0x400100,0,len(interpreter),len(interpreter),1)
    raw[256:256+len(interpreter)]=interpreter
    strings=b'\0libc.so.6\0';raw[768:768+len(strings)]=strings
    for i,pair in enumerate([(5,0x400300),(10,len(strings)),(1,1),(0,0)]):struct.pack_into('<qQ',raw,512+16*i,*pair)
    return bytes(raw)


def large_string_table(size, count=15):
    """Synthetic measured-size layout, never a copied/native Node executable."""
    names=[f'libfixture{i}.so' for i in range(count)]
    table=b'\0';offsets=[]
    for name in names:
        offsets.append(len(table));table+=name.encode()+b'\0'
    if len(table)>size:raise ValueError('synthetic table too small')
    base=8192;raw=bytearray(binary());raw.extend(b'\0'*(base+size-len(raw)))
    raw[base:base+len(table)]=table
    struct.pack_into('<Q',raw,96,len(raw));struct.pack_into('<Q',raw,104,len(raw))
    dynamic=[(5,0x400000+base),(10,size),*[(1,i) for i in offsets],(0,0)]
    struct.pack_into('<Q',raw,152,len(dynamic)*16);struct.pack_into('<Q',raw,160,len(dynamic)*16)
    for i,pair in enumerate(dynamic):struct.pack_into('<qQ',raw,512+16*i,*pair)
    return bytes(raw),names


def archive(rows):
    out=io.BytesIO()
    with tarfile.open(fileobj=out,mode='w') as tar:
        for name,body in rows:
            m=tarfile.TarInfo(name);m.size=len(body);tar.addfile(m,io.BytesIO(body))
    raw=out.getvalue();return gzip.compress(raw),'sha256:'+hashlib.sha256(raw).hexdigest()


class ElfTests(unittest.TestCase):
    def test_reported_node_string_table_size_and_fixed_boundary(self):
        for size in (1412444,2*1024**2):
            raw,names=large_string_table(size)
            self.assertEqual(elf.inspect_elf(raw)['needed'],names)
        raw,_=large_string_table(2*1024**2+1)
        with self.assertRaisesRegex(elf.ElfRefusal,'string table identity/limit'):elf.inspect_elf(raw)
        raw,_=large_string_table(16384,257)
        with self.assertRaisesRegex(elf.ElfRefusal,'string table identity/limit'):elf.inspect_elf(raw)

    def test_real_fields_from_synthetic_headers(self):
        value=elf.inspect_elf(binary());self.assertEqual(value['needed'],['libc.so.6']);self.assertEqual(value['interpreter'],'/lib64/ld-linux-x86-64.so.2');self.assertEqual(value['machine'],62)

    def test_header_type_machine_and_ranges(self):
        for offset,value,fmt in [(4,1,'B'),(5,2,'B'),(18,183,'H'),(32,2**63,'Q'),(54,55,'H'),(56,513,'H')]:
            raw=bytearray(binary());struct.pack_into('<'+fmt,raw,offset,value)
            with self.subTest(offset=offset),self.assertRaises(elf.ElfRefusal):elf.inspect_elf(bytes(raw))
        for raw in (b'',binary()[:60],b'x'*64):
            with self.assertRaises(elf.ElfRefusal):elf.inspect_elf(raw)

    def test_dynamic_offset_string_termination_and_duplicate_table(self):
        for off,tag,value in [(544,1,9999),(560,1,1),(544,5,0x400300),(512,5,0x500000)]:
            raw=bytearray(binary());struct.pack_into('<qQ',raw,off,tag,value)
            with self.subTest(off=off,tag=tag),self.assertRaises(elf.ElfRefusal):elf.inspect_elf(bytes(raw))
        raw=bytearray(binary());raw[778]=ord('x')
        with self.assertRaises(elf.ElfRefusal):elf.inspect_elf(bytes(raw))

    def test_interpreter_absolute_and_terminated(self):
        for change in (b'../bad\0',b'/a/../b\0',b'/a\\b\0',b'/a\nb\0'):
            raw=bytearray(binary());raw[256:256+len(change)]=change
            struct.pack_into('<Q',raw,208,len(change));struct.pack_into('<Q',raw,216,len(change))
            with self.assertRaises(elf.ElfRefusal):elf.inspect_elf(bytes(raw))

    def test_virtual_links_truthful_and_no_host_lookup(self):
        entries={'usr/lib/libc.so.6':{'kind':'file'},'lib/libc.so.6':{'kind':'symlink','target':'../usr/lib/libc.so.6'},'a':{'kind':'symlink','target':'b'},'b':{'kind':'symlink','target':'a'}}
        self.assertEqual(elf.resolve_virtual('lib/libc.so.6',entries)['path'],'usr/lib/libc.so.6')
        self.assertEqual(elf.resolve_virtual('a',entries)['reason'],'LINK_CYCLE')
        entries['escape']={'kind':'symlink','target':'../../outside'}
        self.assertEqual(elf.resolve_virtual('escape',entries)['reason'],'LINK_ESCAPES_IMAGE')
        self.assertEqual(elf.resolve_virtual('../x',entries)['reason'],'INVALID_VIRTUAL_PATH')
        self.assertEqual(elf.resolve_virtual('missing',entries)['reason'],'TARGET_MISSING')

    def test_directory_symlinks_relative_absolute_and_nested(self):
        entries={'lib64':{'kind':'symlink','target':'usr/lib'},
                 'usr/lib':{'kind':'directory'},'usr/lib/loader':{'kind':'file'},
                 'alias':{'kind':'symlink','target':'/lib64'},
                 'relative':{'kind':'symlink','target':'usr'},
                 'usr/lib/z':{'kind':'symlink','target':'loader'}}
        for path in ('lib64/loader','alias/loader','relative/lib/z'):
            value=elf.resolve_virtual(path,entries)
            self.assertEqual(value['status'],'REGULAR_VIRTUAL_TARGET')
            self.assertEqual(value['path'],'usr/lib/loader')
            self.assertEqual(value['chain'][0],path)
        # Directory aliases cannot manufacture bytes for absent descendants.
        self.assertEqual(elf.resolve_virtual('lib64/absent',entries)['reason'],'TARGET_MISSING')

    def test_ancestor_cycle_depth_escape_and_nondirectory_refusals(self):
        examples=[({'a':{'kind':'symlink','target':'b'},'b':{'kind':'symlink','target':'a'}},'a/x','LINK_CYCLE'),
                  ({'a':{'kind':'symlink','target':'../../outside'}},'a/x','LINK_ESCAPES_IMAGE'),
                  ({'a':{'kind':'file'},'a/x':{'kind':'file'}},'a/x','ANCESTOR_NOT_DIRECTORY'),
                  ({'a':{'kind':'hardlink','target':'b'},'a/x':{'kind':'file'}},'a/x','AMBIGUOUS_HARDLINK_PARENT')]
        for entries,path,reason in examples:
            with self.subTest(reason=reason):self.assertEqual(elf.resolve_virtual(path,entries)['reason'],reason)
        chain={f'a{i}':{'kind':'symlink','target':f'a{i+1}'} for i in range(33)}
        chain['a33/x']={'kind':'file'}
        self.assertEqual(elf.resolve_virtual('a0/x',chain)['reason'],'LINK_DEPTH')

    def test_hardlink_final_map_ambiguity_stays_hold(self):
        entries={'usr/lib/regular':{'kind':'file'},'lib':{'kind':'symlink','target':'usr/lib'},
                 'direct':{'kind':'hardlink','target':'usr/lib/regular'},
                 'alias':{'kind':'hardlink','target':'lib/regular'},
                 'link':{'kind':'symlink','target':'usr/lib/regular'},
                 'indirect':{'kind':'hardlink','target':'link'}}
        self.assertEqual(elf.resolve_virtual('direct',entries)['path'],'usr/lib/regular')
        self.assertEqual(elf.resolve_virtual('alias',entries)['reason'],'AMBIGUOUS_HARDLINK_PARENT')
        self.assertEqual(elf.resolve_virtual('indirect',entries)['reason'],'AMBIGUOUS_HARDLINK_TARGET')

    def test_parent_traversal_never_collapses_through_observed_link_or_file(self):
        for kind in ('symlink','hardlink','file'):
            entries={'a':{'kind':kind,'target':'elsewhere'},
                     'link':{'kind':'symlink','target':'a/../regular'},'regular':{'kind':'file'}}
            self.assertEqual(elf.resolve_virtual('link',entries)['reason'],'AMBIGUOUS_LINK_PARENT_TRAVERSAL')
        entries={'a':{'kind':'directory'},'link':{'kind':'symlink','target':'a/../regular'},'regular':{'kind':'file'}}
        self.assertEqual(elf.resolve_virtual('link',entries)['path'],'regular')


class ProfileTests(unittest.TestCase):
    def test_profile3_measured_node_families_and_numeric_targets(self):
        names=('libbrotlienc.so.1','libcrypto.so.4','libssl.so.4','libicui18n.so.78','libicuuc.so.78')
        for root in ('lib','lib64','usr/lib','usr/lib64'):
            for name in names:
                with self.subTest(root=root,name=name):
                    self.assertTrue(abi.selected(root+'/'+name))
                    self.assertTrue(abi.selected(root+'/'+name+'.1.2'))
                    self.assertFalse(layer.selected(root+'/'+name))
        self.assertEqual(abi.PROFILE,'meri-proxy-linux-amd64-node-prisma-abi/3')

    def test_profile3_nearby_versions_and_unrelated_paths_not_selected(self):
        for name in ('libbrotlienc.so.2','libcrypto.so.5','libssl.so.5','libicui18n.so.77',
                     'libicui18n.so.79','libicuuc.so.77','libicuuc.so.79','libicudata.so.78'):
            self.assertFalse(abi.selected('usr/lib/'+name),name)
        for name in ('usr/lib/private/libcrypto.so.4','usr/local/lib/libssl.so.4',
                     'usr/lib/libicuuc.so.78.evil','usr/lib/libcrypto.so.4x','usr/lib/libssl.so.4/escape',
                     'usr/lib/libbrotlienc.so.1'+'.1'*17,'usr/share/licenses/icu/COPYRIGHT'):
            self.assertFalse(abi.selected(name),name)
        # Earlier selected OpenSSL3 and notice ownership remain unchanged.
        self.assertTrue(abi.selected('usr/lib/libcrypto.so.3'))
        self.assertTrue(abi.selected('usr/lib/libssl.so.3'))
        self.assertNotIn('icu',abi.NOTICE_PACKAGES)

    def test_profile3_measured_five_dependency_edges_remain_data_and_hold(self):
        names=('libbrotlienc.so.1','libcrypto.so.4','libssl.so.4','libicui18n.so.78','libicuuc.so.78')
        raw=bytearray(binary());strings=b'\0';offsets=[]
        for name in names:
            offsets.append(len(strings));strings+=name.encode()+b'\0'
        raw[768:768+len(strings)]=strings
        dynamic=[(5,0x400300),(10,len(strings)),*[(1,i) for i in offsets],(0,0)]
        struct.pack_into('<Q',raw,152,len(dynamic)*16);struct.pack_into('<Q',raw,160,len(dynamic)*16)
        for i,pair in enumerate(dynamic):struct.pack_into('<qQ',raw,512+16*i,*pair)
        overlay=layer.Overlay(selection=abi.selected)
        compressed,diff=archive([('usr/bin/node',bytes(raw))]);overlay.add_layer(io.BytesIO(compressed),diff,1)
        before=abi.analyze(overlay,elf)
        self.assertEqual([h['dependency'] for h in before['holds'] if h['path']=='usr/bin/node' and h['reason']=='DEPENDENCY_BYTES_MISSING'],list(names)+['lib64/ld-linux-x86-64.so.2'])
        candidates=[('usr/lib/'+name,binary()) for name in names]
        candidates += [('usr/lib/libc.so.6',binary()),('lib64/ld-linux-x86-64.so.2',binary())]
        compressed,diff=archive(candidates);overlay.add_layer(io.BytesIO(compressed),diff,2)
        value=abi.analyze(overlay,elf);node=next(row for row in value['elf'] if row['path']=='usr/bin/node')
        self.assertEqual(node['needed'],list(names))
        for edge,name in zip(node['dependencyCandidates'],names):
            self.assertEqual(edge['needed'],name)
            self.assertEqual(edge['regularCandidates'][0]['regularTarget'],'usr/lib/'+name)
            self.assertTrue(edge['regularCandidates'][0]['hasElfMagic'])
        self.assertFalse(any(h['path']=='usr/bin/node' and h['reason']=='DEPENDENCY_BYTES_MISSING' for h in value['holds']))
        self.assertEqual(value['status'],'HOLD')
        for key in ('runtimeAdmitted','nativeExecution','originalFirstStageHoldCleared','libraryCandidatesAreLoaderProof'):
            self.assertIs(value[key],False)
        self.assertTrue(any(h['reason']=='PACKAGE_IDENTITY_AND_LICENSE_MAPPING_MISSING' for h in value['holds']))
        self.assertTrue(any(h['reason']=='NATIVE_LOADER_AND_COMPLETE_PACKAGE_NOTICE_VERIFICATION_UNQUALIFIED' for h in value['holds']))

    def test_literal_motley_target_and_alias_metadata_only(self):
        for name in (*abi.LIBRARY_ROOTS,'usr/lib/libz.so.1.3.2.1-motley'):
            self.assertTrue(abi.selected(name))
        for name in ('usr/lib/libz.so.1.3.2.2-motley','usr/lib/libz.so.1.3.2.1-motley.evil',
                     'usr/lib/private-motley.so','usr/lib64/anything'):
            self.assertFalse(abi.selected(name))
        self.assertEqual(abi.PROFILE,'meri-proxy-linux-amd64-node-prisma-abi/3')
        self.assertFalse(layer.selected('usr/lib/libz.so.1.3.2.1-motley'))

    def test_link_report_retains_original_identity_and_observed_resolution(self):
        overlay=layer.Overlay(selection=abi.selected)
        compressed,diff=archive([('usr/lib/libz.so.1.3.2.1-motley',b'zlib')])
        overlay.add_layer(io.BytesIO(compressed),diff,1)
        overlay.entries['usr/lib/libz.so.1']={'kind':'symlink','target':'libz.so.1.3.2.1-motley'}
        overlay.entries['lib64']={'kind':'symlink','target':'usr/lib'}
        value=abi.analyze(overlay,elf)
        row=next(x for x in value['links'] if x['path']=='usr/lib/libz.so.1')
        self.assertEqual(row['target'],'libz.so.1.3.2.1-motley')
        self.assertEqual(row['resolvedTarget'],'usr/lib/libz.so.1.3.2.1-motley')
        self.assertEqual(row['kind'],'symlink')
        self.assertFalse(value['runtimeAdmitted']);self.assertFalse(value['nativeExecution'])
        self.assertEqual(value['status'],'HOLD')
        # No fixture /lib64 loader bytes exist: resolution must stay missing.
        self.assertEqual(elf.resolve_virtual('lib64/ld-linux-x86-64.so.2',overlay.entries)['reason'],'TARGET_MISSING')

    def test_selection_is_finite_and_default_unchanged(self):
        for name in ('usr/lib/libc.so.6','usr/lib/libstdc++.so.6.0.34','var/lib/apk/db/installed',abi.CLI+'prisma/build/index.js'):
            self.assertTrue(abi.selected(name))
        for name in ('usr/lib/unrelated.so','usr/lib/python3.13/secret.py','app/enterprise/a.py','usr/lib/libc.so.6/escape','usr/lib/libc.so.6.evil'):
            self.assertFalse(abi.selected(name))
        self.assertFalse(layer.selected('usr/lib/libc.so.6'))
        compressed,diff=archive([('usr/lib/libc.so.6',b'lib'),('app/schema.prisma',b'schema')])
        original=layer.Overlay();original.add_layer(io.BytesIO(compressed),diff,1)
        selected=layer.Overlay(selection=abi.selected);selected.add_layer(io.BytesIO(compressed),diff,1)
        self.assertNotIn('sha256',original.entries['usr/lib/libc.so.6']);self.assertIn('sha256',selected.entries['usr/lib/libc.so.6'])
        with self.assertRaises(layer.Refusal):layer.Overlay(selection=None)

    def test_dependency_bytes_missing_and_regular_candidates(self):
        overlay=layer.Overlay(selection=abi.selected)
        compressed,diff=archive([('usr/bin/node',binary())]);overlay.add_layer(io.BytesIO(compressed),diff,1)
        first=abi.analyze(overlay,elf);self.assertTrue(any(h['reason']=='DEPENDENCY_BYTES_MISSING' for h in first['holds']))
        compressed,diff=archive([('usr/lib/libc.so.6',b'lib'),('lib64/ld-linux-x86-64.so.2',b'loader')]);overlay.add_layer(io.BytesIO(compressed),diff,2)
        result=abi.analyze(overlay,elf);self.assertFalse(any(h['reason']=='DEPENDENCY_BYTES_MISSING' for h in result['holds']));self.assertEqual(result['status'],'HOLD');self.assertFalse(result['runtimeAdmitted'])

    def test_missing_required_and_unselected_link_target_stay_hold(self):
        overlay=layer.Overlay(selection=abi.selected);overlay.entries['usr/lib/libc.so.6']={'kind':'symlink','target':'private-target'};overlay.entries['usr/lib/private-target']={'kind':'file'}
        value=abi.analyze(overlay,elf)
        self.assertTrue(any(h['reason']=='LINK_TARGET_BYTES_UNESTABLISHED' for h in value['holds']));self.assertTrue(any(h['reason']=='REQUIRED_REGULAR_BYTES_MISSING' for h in value['holds']));self.assertFalse(value['originalFirstStageHoldCleared'])

    def test_apk_duplicate_metadata_and_identity(self):
        for raw,fail in [(b'P:nodejs\nV:22\nL:MIT\n',False),(b'P:a\nP:b\n',True)]:
            overlay=layer.Overlay(selection=abi.selected);compressed,diff=archive([('var/lib/apk/db/installed',raw)]);overlay.add_layer(io.BytesIO(compressed),diff,1)
            if fail:
                with self.assertRaises(ValueError):abi.analyze(overlay,elf)
            else:self.assertEqual(abi.analyze(overlay,elf)['apkPackageMetadata'],[{'P':'nodejs','V':'22','L':'MIT'}])

    def test_changed_source_refuses_before_output(self):
        with tempfile.TemporaryDirectory() as scratch:
            out=pathlib.Path(scratch)/'out'
            with mock.patch.dict(abi.PINS,{'elf_inventory.py':'0'*64}):
                with self.assertRaises(ValueError):abi.inventory('missing','missing','missing',out)
            self.assertFalse(out.exists())

    def test_missing_inputs_and_existing_output_refuse(self):
        with tempfile.TemporaryDirectory() as scratch:
            root=pathlib.Path(scratch);out=root/'out'
            with self.assertRaises(OSError):abi.inventory(root/'missing',root/'missing',root,out)
            self.assertFalse(out.exists());out.mkdir()
            with self.assertRaises(ValueError):abi.inventory(root/'missing',root/'missing',root,out)

    def test_composed_synthetic23_output_is_inert_and_exclusive(self):
        import proxy_oci_inventory as pinned
        with tempfile.TemporaryDirectory() as scratch:
            root=pathlib.Path(scratch);out=root/'out';compressed,diff=archive([('usr/bin/node',binary()),('usr/lib/libc.so.6',b'candidate'),('lib64/ld-linux-x86-64.so.2',b'candidate')])
            sha=lambda b:hashlib.sha256(b).hexdigest()
            cr=json.dumps({'os':'linux','architecture':'amd64','rootfs':{'type':'layers','diff_ids':[diff]*23},'config':{'Labels':{'org.opencontainers.image.revision':'fc3920bf403124ad075bc04990f999f7e0612e12'}}}).encode()
            row={'digest':'sha256:'+sha(compressed),'size':len(compressed),'mediaType':'application/vnd.oci.image.layer.v1.tar+gzip'}
            mr=json.dumps({'schemaVersion':2,'config':{'digest':'sha256:'+sha(cr),'size':len(cr)},'layers':[row]*23}).encode()
            (root/'manifest').write_bytes(mr);(root/'config').write_bytes(cr);(root/(sha(compressed)+'.blob')).write_bytes(compressed)
            with mock.patch.multiple(pinned,MANIFEST=sha(mr),CONFIG=sha(cr),COMPRESSED=23*len(compressed)):
                value=abi.inventory(root/'manifest',root/'config',root,out)
                self.assertEqual(value['status'],'HOLD');self.assertFalse(value['runtimeAdmitted']);self.assertEqual(len(value['layers']),23)
                self.assertEqual(value['elf'][0]['needed'],['libc.so.6']);self.assertEqual(len(list((out/'objects').iterdir())),2)
                self.assertTrue(any(h['reason']=='DEPENDENCY_CANDIDATE_NOT_ELF' for h in value['holds']))
                with self.assertRaises(ValueError):abi.inventory(root/'manifest',root/'config',root,out)


if __name__=='__main__':unittest.main(verbosity=2)
