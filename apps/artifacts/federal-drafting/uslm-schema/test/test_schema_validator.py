import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from schema_validator import (BASE, SENATE_ALIAS, PROFILE, MANIFEST_SHA256,
    PinnedValidator, ValidationFailure, parser, digest, validate_request)


class ValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.validator = PinnedValidator()
        cls.raw = (ROOT / 'test/fixtures/BILLS-114hres99eh.xml').read_bytes()

    def rejects(self, raw, code, **kwargs):
        with self.assertRaises(ValidationFailure) as caught:
            self.validator.validate(raw, **kwargs)
        self.assertEqual(caught.exception.code, code)

    def request(self, raw=None):
        raw = self.raw if raw is None else raw
        return json.dumps({'text': raw.decode('utf-8'), 'sha256': digest(raw)}).encode()

    def test_official_valid_and_exact_bom_hash(self):
        self.assertEqual(digest(self.raw), '65d38cfd185dc6976eb85abd7bfebdef0f873d2edb313e857449b37baa4a0dc1')
        for raw in (self.raw, b'\xef\xbb\xbf' + self.raw):
            self.assertEqual(self.validator.validate(raw), {'valid': True, 'profile': PROFILE,
                'sourceSha256': digest(raw), 'bytes': len(raw), 'schemaSha256': MANIFEST_SHA256})
        self.assertIn(SENATE_ALIAS, self.validator.resolver.requests)

    def test_malformed(self):
        self.rejects(self.raw[:-15], 'MALFORMED_XML')

    def test_schema_invalid_edit(self):
        self.rejects(self.raw.replace(b'<content ', b'<unknown ').replace(b'</content>', b'</unknown>'), 'SCHEMA_INVALID')

    def test_complete_nonroot_section_deletion_is_valid(self):
        start = self.raw.index(b'<section ')
        end = self.raw.index(b'</section>', start) + len(b'</section>')
        edited = self.raw[:start] + self.raw[end:]
        self.assertTrue(self.validator.validate(edited)['valid'])
        self.assertNotEqual(digest(edited), digest(self.raw))

    def test_required_meta_deletion_invalid(self):
        start = self.raw.index(b'<meta>')
        end = self.raw.index(b'</meta>', start) + len(b'</meta>')
        self.rejects(self.raw[:start] + self.raw[end:], 'SCHEMA_INVALID')

    def test_foreign_schema_hint_never_fetches_or_selects_schema(self):
        edited = self.raw.replace(b'uslm-2.1.0.xsd', b'https://attacker.invalid/foreign.xsd')
        before = list(self.validator.resolver.requests)
        with patch('schema_validator.DenyResolver.resolve', side_effect=AssertionError('document fetch forbidden')):
            self.assertTrue(self.validator.validate(edited)['valid'])
        self.assertEqual(before, self.validator.resolver.requests)
        self.rejects(edited.replace(b'<meta>', b'<unknown>').replace(b'</meta>', b'</unknown>'), 'SCHEMA_INVALID')

    def test_unpinned_resolver_fails_closed(self):
        for url in ('https://attacker.invalid/foreign.xsd', 'file:///C:/secret.xsd', BASE + '../evil.xsd'):
            with self.assertRaises(ValidationFailure):
                etree.parse(url, parser(self.validator.resolver))

    def test_manifest_and_asset_hash_length_mismatch(self):
        with tempfile.TemporaryDirectory(prefix='uslm-validator-') as temp:
            root = Path(temp)
            manifest = (ROOT / 'manifest.json').read_bytes()
            (root / 'manifest.json').write_bytes(manifest + b' ')
            with self.assertRaisesRegex(ValidationFailure, 'MANIFEST_HASH_MISMATCH'):
                PinnedValidator(root)
            (root / 'manifest.json').write_bytes(manifest)
            for name, raw in self.validator.assets.items():
                (root / name).write_bytes(raw)
            target = root / 'uslm-2.1.0.xsd'
            original = target.read_bytes()
            for corrupted in (original + b' ', b'X' + original[1:]):
                target.write_bytes(corrupted)
                with self.assertRaisesRegex(ValidationFailure, 'ASSET_HASH_OR_LENGTH_MISMATCH'):
                    PinnedValidator(root)

    def test_dtd_entity_encoding_namespace_profile_and_size_refuse(self):
        self.rejects(b'<!DOCTYPE resolution SYSTEM "https://attacker.invalid/test.dtd">' + self.raw, 'DTD_OR_ENTITY_FORBIDDEN')
        self.rejects(b'<!ENTITY e "x">' + self.raw, 'DTD_OR_ENTITY_FORBIDDEN')
        self.rejects(self.raw + b'\xff', 'INVALID_UTF8')
        self.rejects(self.raw.replace(b'UTF-8', b'ISO-8859-1'), 'UNSUPPORTED_ENCODING')
        self.rejects(self.raw.decode().encode('utf-16'), 'INVALID_UTF8')
        self.rejects(self.raw.replace(b'http://schemas.gpo.gov/xml/uslm', b'https://wrong.invalid/uslm'), 'UNSUPPORTED_ROOT_NAMESPACE_OR_PROFILE')
        self.rejects(self.raw.replace(b'<resolution ', b'<statute ').replace(b'</resolution>', b'</statute>'), 'UNSUPPORTED_ROOT_NAMESPACE_OR_PROFILE')
        self.rejects(self.raw, 'UNSUPPORTED_PROFILE', profile='unknown')
        self.rejects(b' ' * (128 * 1024 + 1), 'INPUT_BYTE_BOUND')

    def test_request_scalar_hash_keys_and_json_bounds(self):
        self.assertTrue(validate_request(self.request())['valid'])
        probes = [
            (b'{"text":"\\ud800","sha256":"' + b'0' * 64 + b'"}', 'INVALID_UTF8_SCALARS'),
            (json.dumps({'text': 'secret input', 'sha256': '0' * 64}).encode(), 'SOURCE_HASH_MISMATCH'),
            (b'{"text":"x","text":"y","sha256":"' + b'0' * 64 + b'"}', 'INVALID_REQUEST'),
            (b'{"path":"file:///private.xml"}', 'INVALID_REQUEST'),
            (b'{"url":"https://attacker.invalid"}', 'INVALID_REQUEST'),
            (b'[]', 'INVALID_REQUEST'), (b'\xff', 'INVALID_REQUEST'),
            (b' ' * (128 * 1024 * 6 + 513), 'INPUT_BYTE_BOUND'),
        ]
        for payload, code in probes:
            with self.subTest(code=code):
                with self.assertRaises(ValidationFailure) as caught:
                    validate_request(payload)
                self.assertEqual(caught.exception.code, code)

    def test_cli_success_refusal_content_free_and_no_paths(self):
        cli = [sys.executable, str(ROOT / 'schema_validator.py')]
        valid = subprocess.run(cli, input=self.request(), capture_output=True, timeout=15)
        self.assertEqual(valid.returncode, 0)
        self.assertEqual(json.loads(valid.stdout), self.validator.validate(self.raw))
        self.assertEqual(valid.stderr, b'')
        secret = b'<resolution>PRIVATE CONTENT</resolution>'
        failed = subprocess.run(cli, input=self.request(secret), capture_output=True, timeout=15)
        self.assertEqual(failed.returncode, 1)
        self.assertEqual(json.loads(failed.stdout), {'valid': False, 'code': 'UNSUPPORTED_ROOT_NAMESPACE_OR_PROFILE'})
        self.assertEqual(failed.stderr, b'')
        argument = subprocess.run(cli + ['private.xml'], input=b'', capture_output=True, timeout=15)
        self.assertEqual(argument.returncode, 1)
        self.assertEqual(json.loads(argument.stdout), {'valid': False, 'code': 'INVALID_REQUEST'})


if __name__ == '__main__':
    unittest.main(verbosity=2)
