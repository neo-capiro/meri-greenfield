"""Adversarial offline scan preparation tests; no AWS/image/native execution."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import worker_image_scan as scan

IMAGE = 'sha256:' + 'a' * 64
ROOT = Path(__file__).resolve().parent


def finding(name='CVE-2026-00001', severity='CRITICAL', package='libexample1', version='1.2-3'):
    return {'name': name, 'severity': severity, 'description': 'Synthetic retained description.',
            'uri': 'https://example.invalid/advisory',
            'attributes': [{'key': 'package_name', 'value': package},
                           {'key': 'package_version', 'value': version},
                           {'key': 'vendor_detail', 'value': 'retain this exact field'}]}


def response():
    # Expected severities are explicit test data, not computed by the subject.
    return {'registryId': '967807252336', 'repositoryName': 'meri-greenfield/qualification-worker',
            'imageId': {'imageDigest': IMAGE, 'imageTag': 'synthetic-review-only'},
            'imageScanStatus': {'status': 'COMPLETE', 'description': 'Synthetic complete scan'},
            'imageScanFindings': {
                'findings': [finding(), finding('CVE-2026-00002', 'UNDEFINED', 'other1')],
                'findingSeverityCounts': {'CRITICAL': 1, 'UNDEFINED': 1},
                'imageScanCompletedAt': '2026-10-11T18:17:54+00:00',
                'vulnerabilitySourceUpdatedAt': 1791730000.5},
            'nextToken': None}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')


def analyze(value, **kwargs):
    raw = encoded(value)
    return scan.analyze_basic_scan(raw, expected_sha256=hashlib.sha256(raw).hexdigest(),
                                   image_digest=IMAGE, **kwargs)


class BasicScan(unittest.TestCase):
    def test_retains_every_row_attribute_and_exact_evidence_identity(self):
        value = response(); raw = encoded(value)
        report = analyze(value)
        self.assertEqual(report['evidence'], {
            'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
            'registryId': '967807252336', 'repositoryName': 'meri-greenfield/qualification-worker',
            'imageDigest': IMAGE})
        self.assertEqual(report['findingCount'], 2)
        self.assertEqual(report['severityCounts'], {'CRITICAL': 1, 'HIGH': 0, 'MEDIUM': 0,
                                                  'LOW': 0, 'INFORMATIONAL': 0, 'UNDEFINED': 1})
        self.assertEqual([row['rawFinding'] for row in report['findings']],
                         value['imageScanFindings']['findings'])
        self.assertEqual(report['scanMetadata'], {
            'findingSeverityCounts': {'CRITICAL': 1, 'UNDEFINED': 1},
            'imageScanCompletedAt': '2026-10-11T18:17:54+00:00',
            'vulnerabilitySourceUpdatedAt': 1791730000.5})
        self.assertEqual(report['rawResponseMetadata']['imageId'], value['imageId'])
        self.assertEqual(report['findings'][0]['observedProvider'], {'name': 'libexample1', 'version': '1.2-3'})
        self.assertEqual(report['findings'][0]['disposition'], {
            'status': 'OPEN', 'vendorApplicability': None, 'supportedFix': None,
            'embeddedCopyCoverage': None, 'ownerDecision': None})
        self.assertTrue(report['scanEvidenceComplete'])
        self.assertEqual(report['status'], 'SOURCE_ONLY_HOLD')
        for flag in ('scanAdmitted', 'runtimeAdmitted', 'g1Admitted'):
            self.assertIs(report[flag], False)

    def test_output_is_deterministic(self):
        first = analyze(response()); second = analyze(response())
        self.assertEqual(scan.evidence.encoded(first), scan.evidence.encoded(second))

    def test_zero_findings_never_admit_security_runtime_or_g1(self):
        value = response(); value['imageScanFindings']['findings'] = []
        value['imageScanFindings']['findingSeverityCounts'] = {}
        value['imageScanFindings']['enhancedFindings'] = []
        report = analyze(value)
        self.assertEqual(report['findingCount'], 0)
        self.assertEqual(report['findings'], [])
        self.assertEqual(report['status'], 'SOURCE_ONLY_HOLD')
        for flag in ('scanAdmitted', 'runtimeAdmitted', 'g1Admitted'):
            self.assertIs(report[flag], False)

    def test_all_severities_are_retained_and_counted(self):
        value = response()
        value['imageScanFindings']['findings'] = [
            finding('CVE-2026-' + str(index), severity, 'provider' + str(index))
            for index, severity in enumerate(('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'UNDEFINED'))]
        value['imageScanFindings']['findingSeverityCounts'] = {
            'CRITICAL': 1, 'HIGH': 1, 'MEDIUM': 1, 'LOW': 1, 'INFORMATIONAL': 1, 'UNDEFINED': 1}
        report = analyze(value)
        self.assertEqual(report['findingCount'], 6)
        self.assertEqual([row['rawFinding']['severity'] for row in report['findings']],
                         ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'UNDEFINED'])

    def test_same_cve_distinct_providers_are_not_deduplicated(self):
        value = response()
        value['imageScanFindings']['findings'] = [finding(package='libcurl-variant-one'),
                                                  finding(package='libcurl-variant-two')]
        value['imageScanFindings']['findingSeverityCounts'] = {'CRITICAL': 2}
        report = analyze(value)
        self.assertEqual(report['findingCount'], 2)
        self.assertEqual([row['observedProvider']['name'] for row in report['findings']],
                         ['libcurl-variant-one', 'libcurl-variant-two'])

    def test_missing_optional_metadata_is_retained_without_guesses(self):
        value = response()
        value['imageScanFindings']['findings'] = [{'severity': 'HIGH'}]
        value['imageScanFindings']['findingSeverityCounts'] = {'HIGH': 1}
        report = analyze(value)
        self.assertEqual(report['findings'][0]['rawFinding'], {'severity': 'HIGH'})
        self.assertEqual(report['findings'][0]['observedProvider'], {'name': None, 'version': None})
        self.assertIsNone(report['findings'][0]['disposition']['supportedFix'])

    def test_wrong_registry_repository_digest_and_status_refuse(self):
        changes = [('registryId', '000000000000'), ('repositoryName', 'unapproved/repository')]
        for name, replacement in changes:
            with self.subTest(name=name):
                value = response(); value[name] = replacement
                with self.assertRaises(ValueError): analyze(value)
        for digest in ('sha256:' + 'b' * 64, None, 1):
            with self.subTest(digest=digest):
                value = response(); value['imageId']['imageDigest'] = digest
                with self.assertRaises(ValueError): analyze(value)
        for status in ('IN_PROGRESS', 'FAILED', 'ACTIVE', None, True):
            with self.subTest(status=status):
                value = response(); value['imageScanStatus']['status'] = status
                with self.assertRaises(ValueError): analyze(value)

    def test_pagination_tokens_refuse_even_if_counts_match(self):
        for key in ('nextToken', 'NextToken'):
            for token in ('remaining-page', '', False, 0, []):
                with self.subTest(key=key, token=token):
                    value = response(); value[key] = token
                    with self.assertRaises(ValueError): analyze(value)

    def test_count_truncation_invalid_types_and_unknown_severities_refuse(self):
        for counts in ({'CRITICAL': 1}, {'CRITICAL': 2, 'UNDEFINED': 1},
                       {'CRITICAL': True, 'UNDEFINED': 1}, {'CRITICAL': 1.0, 'UNDEFINED': 1},
                       {'CRITICAL': -1, 'UNDEFINED': 1}, {'ALIEN': 1}, [], None,
                       {'CRITICAL': 10001, 'UNDEFINED': 1}):
            with self.subTest(counts=counts):
                value = response(); value['imageScanFindings']['findingSeverityCounts'] = counts
                with self.assertRaises(ValueError): analyze(value)
        for severity in ('UNKNOWN', None, 1):
            with self.subTest(severity=severity):
                value = response(); value['imageScanFindings']['findings'][0]['severity'] = severity
                with self.assertRaises(ValueError): analyze(value)

    def test_duplicate_json_and_nonfinite_numbers_refuse(self):
        for raw in (b'{"registryId":"x","registryId":"y"}', b'{"value":NaN}',
                    b'{"value":Infinity}', b'{"value":1e9999}'):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    scan.analyze_basic_scan(raw, expected_sha256=hashlib.sha256(raw).hexdigest(), image_digest=IMAGE)

    def test_duplicate_attribute_keys_and_rows_refuse(self):
        value = response(); original = value['imageScanFindings']['findings'][0]
        original['attributes'].append({'key': 'package_name', 'value': 'ambiguous'})
        with self.assertRaises(ValueError): analyze(value)
        value = response(); row = copy.deepcopy(value['imageScanFindings']['findings'][0])
        row['attributes'].reverse()
        value['imageScanFindings']['findings'] = [value['imageScanFindings']['findings'][0], row]
        value['imageScanFindings']['findingSeverityCounts'] = {'CRITICAL': 2}
        with self.assertRaises(ValueError): analyze(value)

    def test_enhanced_malformed_and_unknown_fields_refuse(self):
        for enhanced in ([{'severity': 'HIGH'}], None, {}):
            with self.subTest(enhanced=enhanced):
                value = response(); value['imageScanFindings']['enhancedFindings'] = enhanced
                with self.assertRaises(ValueError): analyze(value)
        for owner in ('response', 'scan', 'finding'):
            with self.subTest(owner=owner):
                value = response()
                target = value if owner == 'response' else value['imageScanFindings']
                if owner == 'finding': target = target['findings'][0]
                target['unqualifiedFutureField'] = []
                with self.assertRaises(ValueError): analyze(value)
        for findings in ({}, None):
            value = response(); value['imageScanFindings']['findings'] = findings
            with self.assertRaises(ValueError): analyze(value)

    def test_bounds_and_invalid_string_shapes_refuse(self):
        for mutation in ('attributes', 'description', 'uri', 'name', 'attribute-type', 'surrogate'):
            with self.subTest(mutation=mutation):
                value = response(); row = value['imageScanFindings']['findings'][0]
                if mutation == 'attributes': row['attributes'] = [{'key': str(i), 'value': 'x'} for i in range(51)]
                elif mutation == 'attribute-type': row['attributes'][0]['value'] = []
                elif mutation == 'surrogate': row['description'] = '\ud800'
                else: row[mutation] = 'x' * (scan.STRING_BOUNDS[mutation] + 1)
                if mutation == 'surrogate':
                    raw = json.dumps(value).encode('ascii')
                    with self.assertRaises(UnicodeEncodeError):
                        scan.analyze_basic_scan(raw, expected_sha256=hashlib.sha256(raw).hexdigest(), image_digest=IMAGE)
                else:
                    with self.assertRaises(ValueError): analyze(value)
        with patch.object(scan, 'MAX_FINDINGS', 1):
            with self.assertRaises(ValueError): analyze(response())
        raw = b' ' * (scan.MAX_SCAN_BYTES + 1)
        with self.assertRaises(ValueError):
            scan.analyze_basic_scan(raw, expected_sha256=hashlib.sha256(raw).hexdigest(), image_digest=IMAGE)
        with patch.object(scan, 'MAX_REPORT_BYTES', 1):
            with self.assertRaises(ValueError): analyze(response())

    def test_external_hash_is_required_and_verified(self):
        raw = encoded(response())
        for pin in ('f' * 64, '', 'sha256:' + 'a' * 64, None, True):
            with self.subTest(pin=pin):
                with self.assertRaises(ValueError):
                    scan.analyze_basic_scan(raw, expected_sha256=pin, image_digest=IMAGE)

    def test_cli_bindings_validate_before_canonical_file_read(self):
        with patch.object(scan.evidence, 'read', side_effect=AssertionError('unexpected I/O')) as reader:
            for kwargs in ({'expected_sha256': '', 'image_digest': IMAGE},
                           {'expected_sha256': 'a' * 64, 'image_digest': 'latest'},
                           {'expected_sha256': 'a' * 64, 'image_digest': IMAGE}):
                with self.subTest(kwargs=kwargs):
                    with self.assertRaises(ValueError): scan.prepare_file('relative.json', **kwargs)
            reader.assert_not_called()

    def test_stable_regular_file_reader_rejects_links_and_hardlinks(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root / 'scan.json'; raw = encoded(response()); source.write_bytes(raw)
            pin = hashlib.sha256(raw).hexdigest()
            self.assertEqual(scan.prepare_file(str(source), expected_sha256=pin, image_digest=IMAGE)['findingCount'], 2)
            link = root / 'link.json'; link.symlink_to(source)
            with self.assertRaises(ValueError): scan.prepare_file(str(link), expected_sha256=pin, image_digest=IMAGE)
            hardlink = root / 'hardlink.json'; hardlink.hardlink_to(source)
            with self.assertRaises(ValueError): scan.prepare_file(str(source), expected_sha256=pin, image_digest=IMAGE)
            parent_link = root / 'parent'; parent_link.symlink_to(root, target_is_directory=True)
            with self.assertRaises(ValueError): scan.prepare_file(str(parent_link / 'scan.json'), expected_sha256=pin, image_digest=IMAGE)

    def test_cli_help_missing_flags_refusal_and_hold_have_no_writes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); raw = encoded(response()); source = root / 'scan.json'; source.write_bytes(raw)
            base = [sys.executable, '-I', '-B', '-S', str(ROOT / 'worker_image_scan.py')]
            before = {path.name for path in root.iterdir()}
            help_result = subprocess.run(base + ['--help'], cwd=root, capture_output=True, timeout=10)
            self.assertEqual(help_result.returncode, 0)
            self.assertIn(b'--scan-sha256', help_result.stdout)
            missing = subprocess.run(base, cwd=root, capture_output=True, timeout=10)
            self.assertEqual(missing.returncode, 2)
            self.assertEqual(missing.stdout, b'')
            valid_args = ['--scan-response', str(source), '--scan-sha256', hashlib.sha256(raw).hexdigest(),
                          '--image-digest', IMAGE]
            passed = subprocess.run(base + valid_args, cwd=root, capture_output=True, timeout=10)
            self.assertEqual(passed.returncode, 0, passed.stderr)
            self.assertEqual(passed.stderr, b'')
            self.assertEqual(json.loads(passed.stdout)['status'], 'SOURCE_ONLY_HOLD')
            invalid = subprocess.run(base + valid_args[:-1] + ['latest'], cwd=root, capture_output=True, timeout=10)
            self.assertEqual(invalid.returncode, 2)
            self.assertEqual(invalid.stdout, b'')
            self.assertEqual(invalid.stderr, b'Basic scan preparation refused; retain original evidence. No admission granted.\n')
            abbreviated = subprocess.run(base + ['--scan-resp', str(source)], cwd=root, capture_output=True, timeout=10)
            self.assertEqual(abbreviated.returncode, 2)
            self.assertEqual({path.name for path in root.iterdir()}, before)

    def test_import_is_inert_without_configuration_or_resources(self):
        code = """import sys, socket, subprocess
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, sys.argv[1])
with patch.object(socket, 'socket', side_effect=AssertionError('network')), \\
     patch.object(subprocess, 'Popen', side_effect=AssertionError('process')), \\
     patch.object(Path, 'open', side_effect=AssertionError('file')), \\
     patch.object(Path, 'lstat', side_effect=AssertionError('file')):
    import worker_image_scan
print('inert')
"""
        result = subprocess.run([sys.executable, '-I', '-B', '-S', '-c', code, str(ROOT)],
                                capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, b'inert\n')
        self.assertEqual(result.stderr, b'')


if __name__ == '__main__':
    unittest.main()
