"""Digest-bound scan behavior through the standard AWS CLI waiter; no network."""
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('build_fixture',Path(__file__).with_name('test_image_build_diagnostics.py'))
fixture=importlib.util.module_from_spec(spec); spec.loader.exec_module(fixture)

class ScanGate(unittest.TestCase):
    def test_waiter_failures_are_terminal_without_custom_retry_or_success(self):
        for scenario in ['scan-not-found','scan-failed','scan-timeout']:
            with self.subTest(scenario=scenario), fixture.build_fixture(scenario) as (root,result):
                self.assertNotEqual(result.returncode,0)
                self.assertFalse((root/'source/image-evidence/result.json').exists())
                calls=(root/'calls').read_text()
                self.assertEqual(calls.count('\nwait\n'),1)
                self.assertNotIn('describe-image-scan-findings',calls)
                self.assertFalse((root/'image').exists())

    def test_scan_findings_and_digest_must_match_and_be_complete(self):
        for scenario in ['high','critical','bad-count','wrong-scan','incomplete','wrong-digest']:
            with self.subTest(scenario=scenario), fixture.build_fixture(scenario) as (root,result):
                self.assertNotEqual(result.returncode,0)
                self.assertFalse((root/'source/image-evidence/result.json').exists())
                self.assertFalse((root/'image').exists())
                if scenario=='wrong-digest': self.assertNotIn('\nwait\n',(root/'calls').read_text())

if __name__=='__main__': unittest.main()
