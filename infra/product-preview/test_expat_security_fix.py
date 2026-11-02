"""Bounded source regression for CVE-2026-113351 and CVE-2026-115506; physical ARM/scan gates remain required."""
import copy
import tarfile
import unittest

from test_native_apk_index import DOCKERFILE, LOCK, PIP_REPO_DIR, REPO_DIR, ROOT, STAGED_NAMES


def require_fixed_expat(lock):
    rows = [p for p in lock['systemPackages'] if p['name'] == 'libexpat1']
    assert len(rows) == 1
    version = rows[0]['version']
    upstream, release = version.rsplit('-r', 1)
    assert tuple(map(int, upstream.split('.'))) >= (2, 10, 0), 'CVE-2026-113351/CVE-2026-115506 affected expat'
    return rows[0]


def index_record(path, name, version):
    with tarfile.open(ROOT / path) as tar:
        member = [item for item in tar.getmembers() if item.name.endswith('APKINDEX')][0]
        body = tar.extractfile(member).read().decode('utf-8', 'replace')
    for chunk in body.split('\n\n'):
        fields = dict((line[0], line[2:]) for line in chunk.splitlines() if len(line) > 2 and line[1] == ':')
        if fields.get('P') == name and fields.get('V') == version:
            return fields
    return None


class ExpatSecurityFix(unittest.TestCase):
    def test_the_fixed_library_is_staged_and_advertised_by_the_second_signed_index(self):
        row = require_fixed_expat(LOCK)
        correction = LOCK['uploadNativeProvenance']['expatSecurityCorrection']
        self.assertEqual({k: correction['package'][k] for k in ('name', 'version', 'sha256', 'bytes')},
                         {k: row[k] for k in ('name', 'version', 'sha256', 'bytes')})
        filename = 'libexpat1-%s.apk' % row['version']
        self.assertIn((row['source'], '%s/aarch64/%s' % (PIP_REPO_DIR, filename)), STAGED_NAMES)
        self.assertIn('ADD --checksum=sha256:%s %s ' % (row['sha256'], row['source']), DOCKERFILE)
        record = index_record(LOCK['uploadNativeProvenance']['fixedPipIndex']['path'], 'libexpat1', row['version'])
        self.assertIsNotNone(record, 'the second signed index does not advertise the fixed libexpat1')
        self.assertEqual(int(record['S']), row['bytes'])
        self.assertEqual(record['C'], correction['package']['indexChecksum'])

    def test_the_vulnerable_revision_is_no_longer_staged_for_the_runtime_image(self):
        runtime = [dest for _src, dest in STAGED_NAMES
                   if dest.startswith((REPO_DIR + '/', PIP_REPO_DIR + '/')) and '/libexpat1-' in dest]
        self.assertEqual(runtime, ['%s/aarch64/libexpat1-2.10.0-r0.apk' % PIP_REPO_DIR])

    def test_the_first_runtime_install_names_the_fixed_library_and_the_staged_bzip2(self):
        runtime = DOCKERFILE.split(' AS runtime\n', 1)[1].replace(chr(92) + '\n', ' ')
        install = next(line for line in runtime.splitlines() if 'apk add ' in line)
        version = require_fixed_expat(LOCK)['version']
        self.assertIn(' libexpat1=%s ' % version, install)
        self.assertIn('apk info -v | grep -qx libexpat1-%s ' % version, install)
        # The refreshed index also advertises libbz2-1 1.0.8-r29, which is not staged.
        self.assertIn(' libbz2-1=1.0.8-r28 ', install)
        self.assertIsNotNone(index_record(LOCK['uploadNativeProvenance']['fixedPipIndex']['path'],
                                          'libbz2-1', '1.0.8-r29'))
        self.assertIn('libbz2-1-1.0.8-r28.apk', [dest.rsplit('/', 1)[-1] for _src, dest in STAGED_NAMES
                                                 if dest.startswith(REPO_DIR + '/')])

    def test_the_failed_version_is_rejected(self):
        old = copy.deepcopy(LOCK)
        for p in old['systemPackages']:
            if p['name'] == 'libexpat1':
                p['version'] = '2.9.0-r0'
        with self.assertRaisesRegex(AssertionError, 'CVE-2026-113351'):
            require_fixed_expat(old)


if __name__ == '__main__':
    unittest.main()
