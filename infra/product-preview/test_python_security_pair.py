"""Bounded source regression for CVE-2026-115557; physical ARM/scan gates remain required."""
import copy
import json
import re
import unittest
from pathlib import Path

from test_native_apk_index import DOCKERFILE, LOCK, ROOT, STAGED, STAGED_NAMES, _retained_index


def require_fixed_pair(lock):
    pair = [p for p in lock['systemPackages'] if p['name'] in ('python-3.13', 'python-3.13-base')]
    assert len(pair) == 2
    assert len({p['version'] for p in pair}) == 1
    for package in pair:
        release = re.fullmatch(r'(3\.13\.\d+)_git\d{8}-r\d+', package['version'])
        assert release and tuple(map(int, release[1].split('.'))) >= (3, 13, 18), 'CVE-2026-115557 affected Python'
        assert release[1] == lock['pythonVersion']
    return pair


class PythonSecurityPair(unittest.TestCase):
    def test_both_installed_packages_are_fixed_and_declared_consistently(self):
        pair = require_fixed_pair(LOCK)
        for package in pair:
            filename = package['name']+'-'+package['version']+'.apk'
            self.assertEqual(STAGED[filename], package['sha256'])
            self.assertIn((package['source'], '/tmp/meri-native-pip-repo/aarch64/'+filename), STAGED_NAMES)
        probe = (ROOT/'apps/runtime/build/runtime-base-probe.mjs').read_text()
        self.assertIn('assert sys.version_info[:3]==('+','.join(LOCK['pythonVersion'].split('.'))+')', probe)

    def test_actual_failed_version_is_rejected_without_changing_scan_policy(self):
        old = copy.deepcopy(LOCK)
        old['pythonVersion'] = '3.13.16'
        for p in old['systemPackages']:
            if p['name'] in ('python-3.13', 'python-3.13-base'):
                p['version'] = '3.13.16_git20261016-r2'
        with self.assertRaisesRegex(AssertionError, 'CVE-2026-115557'):
            require_fixed_pair(old)
        recipe = (ROOT/'infra/product-preview/image-build.sh').read_text()
        self.assertIn("assert counts.get('HIGH',0)==counts.get('CRITICAL',0)==0", recipe)

    def test_security_pair_preserves_the_existing_library_abi_closure(self):
        entries, _ = _retained_index()
        old = entries['python-3.13-base-3.13.16_git20261016-r2']
        pair = require_fixed_pair(LOCK)
        version = pair[0]['version']
        new = entries['python-3.13-base-'+version]
        self.assertEqual(set(new['depends']), set(old['depends']))
        self.assertEqual(entries['python-3.13-'+version]['depends'], ['python-3.13-base='+version])
        self.assertEqual([p for p in STAGED if 'python-3.13' in p and '3.13.16' in p], [])

    def test_initial_runtime_install_pins_the_existing_uuid_provider(self):
        # The new signed index also advertises libuuid r2, which is not staged. Name the
        # unchanged r1 in this first transaction instead of leaving an unversioned choice.
        entries, _ = _retained_index()
        self.assertIn('so:libuuid.so.1', entries['python-3.13-base-'+require_fixed_pair(LOCK)[0]['version']]['depends'])
        self.assertIn('libuuid-2.42.4-r2', entries)
        runtime = DOCKERFILE.split(' AS runtime\n', 1)[1].replace('\\\n', ' ')
        install = next(line for line in runtime.splitlines() if 'apk add ' in line)
        required = ' libuuid=2.42.4-r1 '
        self.assertIn(required, install)
        self.assertNotIn(required, install.replace(required, ' '))
        self.assertIn('libuuid-2.42.4-r1.apk', STAGED)


if __name__ == '__main__':
    unittest.main()
