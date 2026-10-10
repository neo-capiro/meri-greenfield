#!/usr/bin/env python3
"""Finite offline v2 regressions. Real fixture bytes; guest ownership is FAKE.

No Docker/AWS/host commands. Main-path tests run the actual entry through runpy
with only stat ownership/mode observations faked in a child. This is not native
Linux, protected-root, sandbox, hostile-root or process-descendant proof.
"""
import ast
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

INFRA = Path(__file__).resolve().parent
PATHS = (
    'bootstrap.sh', 'host-evidence.py', 'host_evidence/__init__.py',
    'host_evidence/admission.py', 'host_evidence/browser_capture.py',
    'host_evidence/classification.py', 'host_evidence/cli.py',
    'host_evidence/collection.py', 'host_evidence/config.py',
    'host_evidence/evidence_io.py', 'host_evidence/export_protocol.py',
    'host_evidence/poll.py', 'host_evidence/source_binding.py', 'seccomp.json',
)
MANIFEST = 'source-manifest.v2.json'
sys.dont_write_bytecode = True
sys.path.insert(0, str(INFRA))
spec = importlib.util.spec_from_file_location('asset_fixture_entry', INFRA / 'host-evidence.py')
entry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(entry)
from host_evidence import source_binding as sb, collection as col


def canonical(data):
    return (json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=True) + '\n').encode('ascii')


def fixture(root, marker=None):
    for path in PATHS:
        src = INFRA / ('seccomp.chromium-155-amd64.json' if path == 'seccomp.json' else path)
        dest = root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
    if marker:
        with (root / 'host_evidence/__init__.py').open('a', encoding='utf-8', newline='\n') as out:
            out.write('\nfrom pathlib import Path\nPath(%r).write_bytes(b"imported")\n' % str(marker))
    data = {'schema': 'meri-browser-source/2', 'assets': [
        {'path': p, 'bytes': (root/p).stat().st_size, 'sha256': hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in PATHS]}
    (root / MANIFEST).write_bytes(canonical(data))
    return data


# Execute actual source and main guard. ONLY uid/mode metadata is fake; byte,
# pathname, FD identities and import sentinel are real temporary fixture facts.
CHILD = r'''
import os,runpy,stat,sys,types
old_lstat,old_fstat=os.lstat,os.fstat
def view(s):
    d={k:getattr(s,k) for k in ('st_dev','st_ino','st_nlink','st_size','st_mtime_ns','st_ctime_ns')}
    d['st_ctime_ns']=getattr(s,'st_birthtime_ns',s.st_ctime_ns) if os.name=='nt' else s.st_ctime_ns
    d['st_birthtime_ns']=d['st_ctime_ns']
    d['st_uid']=0
    d['st_mode']=stat.S_IFMT(s.st_mode)|(0o700 if stat.S_ISDIR(s.st_mode) else 0o600)
    return types.SimpleNamespace(**d)
os.lstat=lambda *a,**k:view(old_lstat(*a,**k))
os.fstat=lambda *a,**k:view(old_fstat(*a,**k))
p=sys.argv[1];sys.argv=[p,'--help']
runpy.run_path(p,run_name='__main__')
'''


class AssetBinding(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='meri-browser-v2-')
        self.root = Path(self.tmp.name) / 'install'
        self.data = fixture(self.root)
        self.addCleanup(self.tmp.cleanup)

    def source(self):
        with patch.object(sb, '_source_root', return_value=str(self.root)):
            return sb.source_manifest()

    def test_literal_paths_canonical_data_and_positive_read(self):
        self.assertEqual(tuple(sb.SOURCE_ASSET_PATHS), PATHS)
        self.assertEqual(self.source(), self.data)
        self.assertEqual((self.root/MANIFEST).read_bytes(), canonical(self.data))
        self.assertEqual(set(self.data), {'schema', 'assets'})
        self.assertEqual(entry._CANCEL, col._CANCEL)
        self.assertIs(entry._CANCEL, col._CANCEL)
        self.assertIs(entry._EXE_HASH_CACHE, col._EXE_HASH_CACHE)

    def test_total_context_and_source_refusals(self):
        run = 'b0ae553a-a4c1-44c8-93b4-45afc6ed0139'
        ctx = {'run': run, 'supportImage': entry.PINNED_IMAGE.split('@')[0]+'@sha256:'+'a'*64,
               'workerImage': entry.PINNED_IMAGE, 'profileSha': entry.EXPECTED_SECCOMP_SHA256, 'source': self.data}
        self.assertIs(sb._context_ok(ctx, run), True)
        invalid = [None, [], 1, {}, {'schema':'meri-browser-source/1','assets':self.data['assets']}]
        for key, value in [('path', []), ('path', '../x'), ('bytes', True), ('bytes', 0), ('bytes', 2097153),
                           ('sha256', 'a'*64+'\n'), ('sha256', 'A'*64), ('extra', 1)]:
            d = copy.deepcopy(self.data); d['assets'][0][key] = value; invalid.append(d)
        d = copy.deepcopy(self.data); d['assets'].reverse(); invalid.append(d)
        d = copy.deepcopy(self.data); d['assets'][-1]['sha256']='b'*64; invalid.append(d)
        for value in invalid:
            with self.subTest(value=repr(value)[:90]):
                self.assertIs(sb._source_v2_ok(value), False)
                self.assertIs(sb._context_ok(dict(ctx, source=value), run), False)
        for value in (None, [], 1, {}, dict(ctx, supportImage=[]), dict(ctx, run=[])):
            self.assertIs(sb._context_ok(value, run), False)

    def test_each_fourteen_payloads_missing_and_drift_refused(self):
        for path in PATHS:
            target = self.root / path; raw = target.read_bytes()
            with self.subTest(path=path, defect='missing'):
                target.unlink()
                with self.assertRaises((OSError, ValueError)): self.source()
                target.write_bytes(raw)
            with self.subTest(path=path, defect='drift'):
                changed = bytearray(raw); changed[len(changed)//2] ^= 1; target.write_bytes(changed)
                with self.assertRaises((OSError, ValueError)): self.source()
                target.write_bytes(raw)

    def test_manifest_refusals_and_exact_tree(self):
        good = canonical(self.data)
        for raw in (good[:-1], b'\xff', b'{"schema":"x","schema":"y"}\n', good.replace(b'"assets":',b'"assets": '), b'['*5000):
            with self.subTest(raw=raw[:30]):
                (self.root/MANIFEST).write_bytes(raw)
                with self.assertRaises((OSError, ValueError)): self.source()
        (self.root/MANIFEST).write_bytes(good)
        for extra in (self.root/'extra', self.root/'host_evidence/config.pyc'):
            extra.write_bytes(b'x')
            with self.assertRaises(ValueError): self.source()
            extra.unlink()
        (self.root/'host_evidence/__pycache__').mkdir()
        with self.assertRaises(ValueError): self.source()

    def test_actual_entry_gate_before_package_import(self):
        marker = Path(self.tmp.name)/'imported'
        self.data = fixture(self.root, marker)
        def run():
            return subprocess.run([sys.executable,'-I','-B','-c',CHILD,str(self.root/'host-evidence.py')],
                                  capture_output=True, timeout=10, cwd=self.tmp.name)
        good = run()
        self.assertEqual(good.returncode, 0, good.stderr)
        self.assertEqual(marker.read_bytes(), b'imported')
        marker.unlink()
        raw = (self.root/MANIFEST).read_bytes()
        for defect in ('missing-manifest','mutated-package','extra-pyc'):
            with self.subTest(defect=defect):
                data = fixture(self.root, marker)
                if defect=='missing-manifest': (self.root/MANIFEST).unlink()
                elif defect=='mutated-package':
                    p=self.root/'host_evidence/config.py';p.write_bytes(p.read_bytes()+b'\n')
                else: (self.root/'host_evidence/config.pyc').write_bytes(b'x')
                bad=run()
                self.assertNotEqual(bad.returncode, 0)
                self.assertIn(b'reviewed source tree refused',bad.stderr)
                self.assertFalse(marker.exists(), 'package imported before refusal')
                if defect=='extra-pyc': (self.root/'host_evidence/config.pyc').unlink()

    def test_io_errors_identity_drift_close_and_actual_length_bound(self):
        p = str(self.root/'bootstrap.sh')
        for method in ('lstat','open','read','fstat'):
            with self.subTest(method=method), patch.object(sb.os,method,side_effect=OSError('private-error-text')):
                with self.assertRaisesRegex(OSError, '^source file unavailable$'): sb._source_read(p,2097152)
        old_close = sb.os.close
        def close(fd): old_close(fd); raise OSError('private-close-text')
        with patch.object(sb.os,'close',side_effect=close):
            with self.assertRaisesRegex(OSError,'^source descriptor close refused$'): sb._source_read(p,2097152)
        before=os.stat(p); later=types.SimpleNamespace(**{k:getattr(before,k) for k in ('st_dev','st_ino','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns')})
        later.st_mtime_ns += 1
        with patch.object(sb.os,'fstat',side_effect=[before,later]):
            with self.assertRaises(ValueError): sb._source_read(p,before.st_size)
        with self.assertRaises(ValueError): sb._source_asset_read(str(self.root),'bootstrap.sh',before.st_size-1)

    def test_export_requires_external_context_matching_all_assets(self):
        run='b0ae553a-a4c1-44c8-93b4-45afc6ed0139'
        ctx={'run':run,'workerImage':entry.PINNED_IMAGE,'supportImage':entry.PINNED_IMAGE.split('@')[0]+'@sha256:'+'a'*64,'profileSha':entry.EXPECTED_SECCOMP_SHA256,'source':self.data}
        plan=entry.build_export_protocol({'a':'complete'},run,ctx,1700000000000)
        self.assertTrue(entry.validate_export(plan['events'],run,plan['stream'],ctx)['ok'])
        changed=copy.deepcopy(ctx);changed['source']['assets'][3]['sha256']='b'*64
        self.assertFalse(entry.validate_export(plan['events'],run,plan['stream'],changed)['ok'])

    def test_python39_grammar(self):
        for path in [INFRA/'host-evidence.py']+list((INFRA/'host_evidence').glob('*.py')):
            ast.parse(path.read_text(encoding='utf-8'),feature_version=(3,9))


    def test_frozen_sixty_bodies_original_bindings_and_aliases(self):
        from collections import Counter
        frozen_path=INFRA.parents[1]/'.task-inputs/W02-20-owner-inputs/frozen-source.json'
        raw=frozen_path.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),'b29707ff16557916f56b075e0ce7046f2dd481788996adf424a44a74fcdf8ec5')
        frozen=json.loads(raw)
        found={}
        for path in [INFRA/'host-evidence.py']+list((INFRA/'host_evidence').glob('*.py')):
            text=path.read_text(encoding='utf-8')
            for node in ast.parse(text).body:
                if isinstance(node,(ast.FunctionDef,ast.ClassDef)):
                    self.assertNotIn(node.name,found)
                    found[node.name]=ast.get_source_segment(text,node)
        unchanged=[r for r in frozen['earlier39']+frozen['deferred24'] if r['name'] not in ('source_manifest','_context_ok','_inspect_reasons')]
        self.assertEqual(len(unchanged),60)
        for record in unchanged:
            with self.subTest(body=record['name']):
                body=found[record['name']].encode('utf-8')
                self.assertEqual(len(body),record['bytes'])
                self.assertEqual(hashlib.sha256(body).hexdigest(),record['sha256'])
        self.assertEqual(found['_source_root'],frozen['exactNewLocator'])
        all_rows=[]
        for module in ('config','collection'):
            rows=[ast.dump(n) for n in ast.parse((INFRA/'host_evidence'/(module+'.py')).read_text()).body
                  if isinstance(n,ast.Assign) and not any(isinstance(t,ast.Name) and t.id.startswith('SOURCE_') for t in n.targets)]
            expected=[r['ast'] for r in frozen['originalAssignments38'] if
                      (any(name in r['ast'] for name in ("id='_CANCEL'", "id='_EXE_HASH_CACHE'"))) == (module=='collection')]
            self.assertEqual(rows,expected)
            all_rows.extend(rows)
        self.assertEqual(len(all_rows),38)
        self.assertEqual(Counter(all_rows),Counter(r['ast'] for r in frozen['originalAssignments38']))
        self.assertEqual(len(frozen['legacyAliases63']),63)
        for name in frozen['legacyAliases63']:
            value=getattr(entry,name)
            self.assertIs(value,getattr(sys.modules[value.__module__],name))

if __name__=='__main__': unittest.main(verbosity=2)
