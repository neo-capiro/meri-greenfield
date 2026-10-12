"""Independent source-only controls. No Docker, AWS or image execution."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(os.environ.get('IMAGE_REVIEW_ROOT', Path(__file__).resolve().parents[5]))
sys.path.insert(0, str(ROOT/'scripts/qualification'))
import worker_context as context
import worker_image_scan as scan
import worker_image_collect as collect
BASE = '90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73'
SCAN_REF = '28fbfc7e40799fdb4e59eabd35c5b9bf80f117d9'
SCAN_PATH = 'docs/qualification/aws-shipper-20261011-r1/captures/ecr-canonical-repaired-scan/stdout.bin'
SCAN_HASH = '3e7a92a7e8a876b5468b5495f3b415c8d0728ee8b28af69f21b175f60ea4e127'
IMAGE = 'sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac'
RAW = subprocess.check_output(['git','show',f'{SCAN_REF}:{SCAN_PATH}'],cwd=ROOT)
PINS = json.loads((ROOT/'apps/worker/qualification/component-pins.json').read_bytes())
DOCKER = (ROOT/'apps/worker/qualification/Dockerfile').read_text()

class ScanControls(unittest.TestCase):
    def test_exact_held47_never_admitted(self):
        value=scan.analyze_basic_scan(RAW,expected_sha256=SCAN_HASH,image_digest=IMAGE)
        self.assertEqual(value['findingCount'],47)
        self.assertEqual(value['severityCounts'],{'CRITICAL':5,'HIGH':17,'MEDIUM':17,'LOW':7,'INFORMATIONAL':0,'UNDEFINED':1})
        self.assertEqual(value['status'],'SOURCE_ONLY_HOLD')
        for name in ['scanAdmitted','runtimeAdmitted','g1Admitted']:self.assertIs(value[name],False)
        self.assertTrue(all(r['disposition']['status']=='OPEN' for r in value['findings']))

    def test_changed_scan_bytes_and_image_cannot_reuse_original_pin(self):
        for raw,image in [(RAW+b' ',IMAGE),(RAW,'sha256:'+'1'*64)]:
            with self.assertRaises(Exception):scan.analyze_basic_scan(raw,expected_sha256=SCAN_HASH,image_digest=image)

    def test_dropped_finding_cannot_disappear_under_original_digest(self):
        value=json.loads(RAW);row=value['imageScanFindings']['findings'].pop()
        value['imageScanFindings']['findingSeverityCounts'][row['severity']]-=1
        raw=json.dumps(value).encode()
        with self.assertRaises(Exception):scan.analyze_basic_scan(raw,expected_sha256=SCAN_HASH,image_digest=IMAGE)

    def test_paginated_duplicate_or_count_mismatch_refused_even_with_new_byte_pin(self):
        changes=[lambda x:x.update(nextToken='not-complete'),lambda x:x.update(NextToken='not-complete'),
            lambda x:x['imageScanFindings']['findingSeverityCounts'].update(CRITICAL=0),
            lambda x:x['imageScanFindings']['findings'].append(x['imageScanFindings']['findings'][0])]
        for change in changes:
            value=json.loads(RAW);change(value);raw=json.dumps(value).encode()
            with self.assertRaises(Exception):scan.analyze_basic_scan(raw,expected_sha256=hashlib.sha256(raw).hexdigest(),image_digest=IMAGE)

    def test_zero_current_findings_cannot_grant_admission(self):
        value=json.loads(RAW);value['imageScanFindings']['findings']=[];value['imageScanFindings']['findingSeverityCounts']={}
        raw=json.dumps(value).encode();result=scan.analyze_basic_scan(raw,expected_sha256=hashlib.sha256(raw).hexdigest(),image_digest=IMAGE)
        self.assertEqual(result['status'],'SOURCE_ONLY_HOLD')
        self.assertIs(result['scanAdmitted'],False);self.assertIs(result['runtimeAdmitted'],False);self.assertIs(result['g1Admitted'],False)
        self.assertTrue(any('Previously unresolved findings' in x for x in result['limitations']))

class ContextControls(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix='meri-image-independent-');self.addCleanup(self.temporary.cleanup)
        self.base=Path(self.temporary.name)

    def make(self,name='first'):
        path=self.base/name;manifest=context.assemble_context(path);return path,manifest

    def test_two_assemblies_have_identical_source_bytes_and_manifest(self):
        first,a=self.make();second,b=self.make('second')
        self.assertEqual(a,b);self.assertEqual((first/'manifest.json').read_bytes(),(second/'manifest.json').read_bytes())
        self.assertEqual(len(a['members']),len(context.MEMBERS));self.assertEqual(a['status'],'SOURCE_ONLY');self.assertIs(a['commitAuthority'],False)
        self.assertEqual(context.verify_context(first),a);self.assertEqual(context.verify_context(second),b)
        for row in a['members']:
            self.assertEqual((first/'context'/row['contextPath']).read_bytes(),(ROOT/row['sourcePath']).read_bytes())
            self.assertNotIn('.agents',row['sourcePath']);self.assertNotIn('.claude',row['sourcePath'])

    def test_existing_output_is_not_overwritten(self):
        output,_=self.make();before=(output/'manifest.json').read_bytes()
        with self.assertRaises(FileExistsError):context.assemble_context(output)
        self.assertEqual((output/'manifest.json').read_bytes(),before)

    def test_modified_context_cannot_rehash_itself_into_authority(self):
        output,manifest=self.make();row=manifest['members'][0];target=output/'context'/row['contextPath']
        target.write_bytes(target.read_bytes()+b'\nindependent mutation\n')
        row['sha256']=hashlib.sha256(target.read_bytes()).hexdigest();row['bytes']=target.stat().st_size
        manifest['totalBytes']=sum(x['bytes'] for x in manifest['members'])
        (output/'manifest.json').write_bytes(context._json_bytes(manifest))
        with self.assertRaises(ValueError):context.verify_context(output)

    def test_unexpected_context_file_refused(self):
        output,_=self.make();(output/'context'/'copied-host-skill.md').write_text('synthetic countercontrol')
        with self.assertRaises(ValueError):context.verify_context(output)

    def test_symlink_context_file_refused(self):
        output,manifest=self.make();target=output/'context'/manifest['members'][0]['contextPath'];target.unlink()
        replacement=self.base/'replacement';replacement.write_text('synthetic');target.symlink_to(replacement)
        with self.assertRaises(ValueError):context.verify_context(output)

    def test_context_manifest_cannot_claim_commit_authority(self):
        output,manifest=self.make();manifest['commitAuthority']=True
        (output/'manifest.json').write_bytes(context._json_bytes(manifest))
        with self.assertRaises(ValueError):context.verify_context(output)

class CoherenceControls(unittest.TestCase):
    def test_required_direct_packages_remain_exact_and_in_recipe(self):
        base=json.loads(subprocess.check_output(['git','show',f'{BASE}:apps/worker/qualification/component-pins.json'],cwd=ROOT))
        required=set(base['osPackages']['resolved']);actual=PINS['osPackages']['resolved']
        self.assertTrue(required<=set(actual));self.assertEqual(PINS['osPackages']['directPinCount'],len(actual))
        for name,version in actual.items():self.assertIn(f'{name}={version}',DOCKER)
        for name in ['libreoffice-writer','libreoffice-calc','libreoffice-impress','poppler-utils','python3-venv','fonts-noto-core']:
            self.assertIn(name,actual)
        self.assertIn('apt-get -y --no-remove dist-upgrade',DOCKER)

    def test_signed_fixed_sources_and_disabled_runtime_remain(self):
        body='\n'.join(line for line in DOCKER.splitlines() if not line.lstrip().startswith('#'))
        timestamp=PINS['osPackages']['snapshotTimestamp']
        self.assertRegex(timestamp,r'^\d{8}T\d{6}Z$')
        for archive in ['debian','debian-security']:self.assertIn(f'snapshot.debian.org/archive/{archive}/{timestamp}',body)
        self.assertIn('Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg',body)
        self.assertNotRegex(body,r'trusted\s*=\s*yes|AllowUnauthenticated|allow-unauthenticated|Verify-Peer.*false')
        for text in ['MERI_SOURCES_ENABLED=false','CHROMIUM_SANDBOX_REQUIRED=true','USER 10001:10001','--require-hashes']:
            self.assertIn(text,body)
        self.assertNotIn('--no-sandbox',body);self.assertNotRegex(body,r'COPY\s+\.\s')
        self.assertIsNone(PINS['assembledImageDigest'])

    def test_compiled_inventory_covers_component_binary_hashes_and_helpers(self):
        name='independent_image_inventory';spec=importlib.util.spec_from_file_location(name,ROOT/'apps/worker/qualification/probes/image-inventory.py')
        inventory=importlib.util.module_from_spec(spec);spec.loader.exec_module(inventory)
        chromium=PINS['chromium'];expected={chromium['installedPaths']['chrome']:chromium['perFilePins']['chrome-linux64/chrome']}
        for key in ['chromeSandbox','chromeSandboxAlias']:
            path=chromium['installedPaths'][key];expected[path]=chromium['perFilePins']['chrome-linux64/chrome_sandbox']
            self.assertEqual({k:inventory.PINNED_FILES[path][k] for k in ['uid','gid','mode']},{'uid':0,'gid':0,'mode':'4755'})
        sdk=next(row for row in PINS['npm'] if row['name']=='@anthropic-ai/claude-agent-sdk')
        expected['/opt/meri-worker/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude']=sdk['bundledCli']['linuxX64BinaryChecksum']
        self.assertEqual(set(expected),set(inventory.PINNED_FILES))
        for path,digest in expected.items():self.assertEqual(inventory.PINNED_FILES[path]['sha256'],digest);self.assertIn(digest,DOCKER)
        self.assertEqual(set(inventory.REQUIRED_ROOTS),collect.REQUIRED_ROOTS)

if __name__=='__main__':unittest.main(verbosity=2)
