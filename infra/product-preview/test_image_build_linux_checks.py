"""Offline exact source and shell isolation controls. No Docker or AWS clients."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('source',Path(__file__).with_name('image-build-source.py'))
source=importlib.util.module_from_spec(spec); spec.loader.exec_module(source)
spec=importlib.util.spec_from_file_location('build_fixture',Path(__file__).with_name('test_image_build_diagnostics.py'))
fixture=importlib.util.module_from_spec(spec); spec.loader.exec_module(fixture)

class SourceControls(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix='meri-source-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root=Path(self.temporary.name); self.repo=self.root/'repo'; self.repo.mkdir()
        for name in [source.RDS_CA_BUNDLE,source.RDS_CA_LOCK]:
            path=self.repo/name; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes((ROOT/name).read_bytes())
        (self.repo/'main.mjs').write_bytes(b'export const value=1;\n')
        self.git('init','--quiet'); self.git('add','.')
        self.git('-c','user.name=Fixture','-c','user.email=fixture@invalid.example','-c','commit.gpgsign=false','commit','--quiet','-m','synthetic')
        self.commit=self.git('rev-parse','HEAD').strip()
        self.archive=self.root/'source.zip'; self.manifest=self.root/'members.json'
        self.pin=source.seal(self.repo,self.commit,self.archive,self.manifest)

    def git(self,*args):
        return subprocess.check_output(['git','-C',str(self.repo),*args],stderr=subprocess.PIPE,text=True,timeout=15)

    def verify(self):
        return source.verify(self.archive,self.manifest,self.commit,source.file_sha(self.archive,1024**3),source.file_sha(self.manifest,32*1024**2))

    def repack(self,mutate):
        with zipfile.ZipFile(self.archive) as archive: rows=[(copy.copy(info),archive.read(info)) for info in archive.infolist()]
        rows=mutate(rows)
        with zipfile.ZipFile(self.archive,'w') as archive:
            for info,data in rows: archive.writestr(info,data)

    def test_seal_uses_git_bytes_even_when_worktree_is_dirty(self):
        (self.repo/'main.mjs').write_bytes(b'dirty-private-value')
        archive=self.root/'again.zip'; manifest=self.root/'again.json'
        second=source.seal(self.repo,self.commit,archive,manifest)
        self.assertEqual(second,self.pin)
        self.assertEqual(self.verify()['fileCount'],3)
        with self.assertRaises(ValueError): source.seal(self.repo,self.commit,archive,manifest)

    def test_archive_bytes_members_and_modes_refuse_changed_content(self):
        original=self.archive.read_bytes()
        changes=[lambda rows:rows[:-1],lambda rows:rows+[(zipfile.ZipInfo('extra.txt'),b'extra')],
                 lambda rows:[(i,b'changed' if i.filename=='main.mjs' else b) for i,b in rows],
                 lambda rows:rows+[rows[-1]]]
        for change in changes:
            with self.subTest(change=changes.index(change)):
                self.archive.write_bytes(original); self.repack(change)
                with self.assertRaises(ValueError): self.verify()
        self.archive.write_bytes(original)
        def mode(rows):
            rows[-1][0].external_attr=0o100755<<16
            return rows
        self.repack(mode)
        with self.assertRaises(ValueError): self.verify()

    def test_unsafe_private_and_symlink_members_refuse(self):
        original=self.archive.read_bytes()
        names=['../escape','/absolute','x\\escape','x:stream','.aws/credentials','.env','a/.env.local','a/private.key','a/private.pem','node_modules/x','MAIN.MJS','main.mjs/child']
        for name in names:
            with self.subTest(name=name):
                self.archive.write_bytes(original)
                self.repack(lambda rows:rows+[(zipfile.ZipInfo(name),b'private-value')])
                with self.assertRaises(ValueError): self.verify()
        self.archive.write_bytes(original)
        info=zipfile.ZipInfo('symlink'); info.create_system=3; info.external_attr=(stat.S_IFLNK|0o777)<<16
        self.repack(lambda rows:rows+[(info,b'main.mjs')])
        with self.assertRaises(ValueError): self.verify()

    def test_archive_and_manifest_digest_and_commit_are_required(self):
        with self.assertRaises(ValueError): source.verify(self.archive,self.manifest,self.commit,'0'*64,self.pin['sourceManifestSha256'])
        with self.assertRaises(ValueError): source.verify(self.archive,self.manifest,self.commit,self.pin['archiveSha256'],'0'*64)
        with self.assertRaises(ValueError): source.verify(self.archive,self.manifest,'0'*40,self.pin['archiveSha256'],self.pin['sourceManifestSha256'])
        original=self.manifest.read_bytes(); value=json.loads(original)
        for change in [lambda v:v['files'].reverse(),lambda v:v['files'][0].update(bytes=True),lambda v:v.update(extra=1),lambda v:v['files'].append(v['files'][0])]:
            candidate=copy.deepcopy(value); change(candidate); self.manifest.write_bytes(json.dumps(candidate).encode())
            with self.assertRaises(ValueError): self.verify()
        self.manifest.write_bytes(original+b' ')
        with self.assertRaises(ValueError): source.read_manifest(self.manifest,self.commit,self.pin['sourceManifestSha256'])

    def test_public_ca_refuses_private_material_and_mismatched_lock(self):
        bundle=(self.repo/source.RDS_CA_BUNDLE).read_bytes(); lock=(self.repo/source.RDS_CA_LOCK).read_bytes()
        self.assertGreater(source.rds_ca_lock(lock,bundle)['certificateCount'],0)
        for value in [b'-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY-----\n',bundle+b'private',bundle.replace(b'\n',b'\r\n')]:
            with self.assertRaises(ValueError): source.certificate_count(value)
        value=json.loads(lock); value['sha256']='0'*64
        with self.assertRaises(ValueError): source.rds_ca_lock(json.dumps(value).encode(),bundle)

    def test_extracted_tree_requires_exact_bytes_members_and_no_symlinks(self):
        tree=self.root/'tree'; tree.mkdir()
        with zipfile.ZipFile(self.archive) as archive: archive.extractall(tree)
        def verify(): return source.verify_tree(tree,self.manifest,self.commit,self.pin['sourceManifestSha256'])
        self.assertEqual(verify()['fileCount'],3)
        path=tree/'main.mjs'; original=path.read_bytes(); path.write_bytes(b'changed')
        with self.assertRaises(ValueError): verify()
        path.write_bytes(original); (tree/'extra').write_bytes(b'extra')
        with self.assertRaises(ValueError): verify()
        (tree/'extra').unlink(); path.unlink()
        with self.assertRaises(ValueError): verify()
        # Windows symlink privilege is not assumed; ZIP symlinks are tested on every host.
        if os.name!='nt':
            path.symlink_to(self.repo/'main.mjs')
            with self.assertRaises(ValueError): verify()

    def test_git_adapter_bounds_live_output_timeout_and_private_failures(self):
        real_popen=subprocess.Popen
        programs=[('import sys; sys.stdout.buffer.write(b"x"*(20*1024**2))',30),
                  ('import sys; sys.stderr.buffer.write(b"x"*(20*1024**2))',30),
                  ('import time; time.sleep(30)',0.1),
                  ('import sys; print("private-value"); sys.exit(7)',30)]
        for program,timeout in programs:
            with self.subTest(program=program):
                children=[]
                def start(args,**kwargs):
                    child=real_popen([sys.executable,'-I','-B','-S','-c',program],**kwargs)
                    children.append(child)
                    return child
                with patch.object(source.subprocess,'Popen',side_effect=start):
                    with self.assertRaises(ValueError) as error: source.run(['git','synthetic'],timeout=timeout)
                self.assertNotIn('private-value',str(error.exception))
                self.assertTrue(all(child.poll() is not None for child in children))

    def test_zip_size_and_count_bounds_precede_payload_reads(self):
        class Archive:
            def stat(self): return type('Stat',(),{'st_size':1024**3+1})()
        with self.assertRaises(ValueError): source.archive_members(Archive())
        original=self.manifest.read_bytes(); value=json.loads(original); value['files'][0]['bytes']=128*1024**2+1
        self.manifest.write_bytes(json.dumps(value).encode())
        with self.assertRaises(ValueError): self.verify()

class ShellIsolation(unittest.TestCase):
    def test_all_probes_and_inventories_are_readonly_nonroot_networkless_and_bounded(self):
        with fixture.build_fixture() as (root,result):
            self.assertEqual(result.returncode,0,result.stderr)
            records=[part.splitlines() for part in (root/'calls').read_text().split('BEGIN ')[1:]]
            runs=[r[1:-1] for r in records if r[0].endswith('/docker') and r[1]=='run']
            self.assertEqual(len(runs),8)
            for args in runs:
                for value in ['--rm','--read-only','1000:1000','none','ALL','no-new-privileges','256','2g']:
                    self.assertIn(value,args)
                self.assertEqual(args[args.index('--platform')+1],'linux/arm64')
                self.assertFalse(any(x in args for x in ['-v','--volume','--env-file','--privileged']))
            joined='\n'.join('\n'.join(x) for x in runs)
            self.assertTrue(any(args[-2:]==['apps/runtime/agentcore-entrypoint.mjs','--help'] for args in runs))
            self.assertTrue(any(args[-2:]==['apps/runtime/cli.mjs','--help'] for args in runs))
            self.assertIn("import('./apps/runtime/agentcore-entrypoint.mjs')",joined)
            self.assertIn('runtime-base-probe.mjs',joined); self.assertIn('executor-generation-smoke.mjs',joined)
            self.assertIn('apk\n',joined); self.assertIn('info\n-vv',joined)
            self.assertIn('python3.13\n',joined); self.assertIn('-m\npip\nlist\n--format=json',joined)
            self.assertNotIn('image_probe',joined); self.assertNotIn('native-cli.mjs',joined)

    @unittest.skipIf(os.name=='nt','Git Bash cannot enforce Linux RLIMIT_FSIZE; native Linux check remains required')
    def test_linux_timeout_and_live_file_limit(self):
        text=fixture.BUILD.read_text(); function=text[text.index('run() {'):text.index('cleanup() {')]
        with tempfile.TemporaryDirectory(prefix='meri-shell-limit-') as temp:
            env={**os.environ,'evidence':temp}
            for command in ['run 1 timeout.log sleep 30', "run 10 output.log python3 -c 'import sys; sys.stdout.buffer.write(b\"x\" * (40*1024**2))'"]:
                result=subprocess.run([fixture.BASH,'-c',function+'\n'+command],env=env,capture_output=True,timeout=15)
                self.assertNotEqual(result.returncode,0)
            self.assertLessEqual((Path(temp)/'output.log').stat().st_size,32*1024**2)

if __name__=='__main__': unittest.main()
