"""Real XML entry/output tests; resource limits are stubbed, not OS qualification."""
import base64
from contextlib import chdir
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location('xml_entry', Path(__file__).parents[1] / 'python' / 'entry.py')
entry = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {'resource': SimpleNamespace(
        setrlimit=lambda *args: None, RLIMIT_CPU=0, RLIMIT_FSIZE=1, RLIMIT_NOFILE=2)}):
    spec.loader.exec_module(entry)


class XmlEntry(unittest.TestCase):
    def run_entry(self, text, form='xml', base=None, max_bytes=1048576):
        data = {'request': {'operation': 'create_word', 'format': form, 'title': 'XML',
                            'content': {'text': text}}, 'assets': [], 'base': base, 'maxBytes': max_bytes}
        output = io.StringIO()
        with patch.object(sys, 'stdin', SimpleNamespace(buffer=io.BytesIO(json.dumps(data).encode()))), \
                patch.object(sys, 'stdout', output):
            entry.main()
        return json.loads(output.getvalue())

    def test_original_utf8_bytes_and_inspection_survive_create_and_revision(self):
        text = '\ufeff<?xml version="1.0" encoding="UTF-8"?>\r\n<bill xmlns="urn:fixture">α &amp; β</bill>\r\n'
        original = text.encode('utf8')
        with tempfile.TemporaryDirectory() as directory, chdir(directory):
            inspection = self.run_entry(text)
            self.assertEqual(Path('artifact.xml').read_bytes(), original)
            self.assertEqual(inspection, {
                'sha256': hashlib.sha256(original).hexdigest(), 'bytes': len(original),
                'format': 'xml', 'nativeOpened': False, 'rendered': False, 'recalculated': False,
                'members': [], 'details': {'encoding': 'UTF-8', 'whitespace': 'unchanged', 'wellFormed': True}})
            Path('artifact.xml').unlink()
            parent = {'request': {'format': 'xml'}, 'base64': base64.b64encode(original).decode()}
            revised = text.replace('α', 'γ')
            self.run_entry(revised, base=parent)
            self.assertEqual(Path('artifact.xml').read_bytes(), revised.encode('utf8'))
            self.assertEqual(base64.b64decode(parent['base64']), original)

    def test_unsafe_malformed_empty_and_non_utf8_declarations_refuse_before_output(self):
        invalid = ['', ' \r\n', '<a>', '<a/><b/>', '<a>&unknown;</a>',
                   '<!DOCTYPE a [<!ENTITY x "expanded">]><a>&x;</a>',
                   '<!DOCTYPE a SYSTEM "file:///no-read"><a/>',
                   '<!DOCTYPE a SYSTEM "https://example.invalid/no-fetch"><a/>',
                   '<?xml version="1.0" encoding="ISO-8859-1"?><a>α</a>', '<a>\x00</a>', '<p:a/>']
        for text in invalid:
            with self.subTest(text=text), tempfile.TemporaryDirectory() as directory, chdir(directory):
                with self.assertRaises(Exception):
                    self.run_entry(text)
                self.assertEqual(list(Path('.').iterdir()), [])

    def test_wrong_or_malformed_parent_and_output_bound_refuse_before_output(self):
        for form, raw in [('txt', b'<old/>'), ('xml', b'bad'), ('xml', b'\xff'),
                          ('xml', b'<!DOCTYPE a><a/>')]:
            with self.subTest(form=form, raw=raw), tempfile.TemporaryDirectory() as directory, chdir(directory):
                base = {'request': {'format': form}, 'base64': base64.b64encode(raw).decode()}
                with self.assertRaises(Exception):
                    self.run_entry('<new/>', base=base)
                self.assertEqual(list(Path('.').iterdir()), [])
        with tempfile.TemporaryDirectory() as directory, chdir(directory):
            with self.assertRaises(ValueError):
                self.run_entry('<new/>', max_bytes=1)
            self.assertEqual(list(Path('.').iterdir()), [])

    def test_empty_and_nonempty_txt_bytes_remain_unchanged(self):
        for text in ['', '\ufeffα\r\n']:
            with self.subTest(text=text), tempfile.TemporaryDirectory() as directory, chdir(directory):
                inspection = self.run_entry(text, form='txt')
                self.assertEqual(Path('artifact.txt').read_bytes(), text.encode('utf8'))
                self.assertEqual(inspection['details'], {'encoding': 'UTF-8', 'whitespace': 'unchanged'})

    def test_xml_grammar_matches_admission_and_does_not_impose_xml_id_validity(self):
        for text in ['<r xml:id="not an ID"/>', '<r><a xml:id="same"/><b xml:id="same"/></r>',
                     '<r>' * 256 + '</r>' * 256]:
            with self.subTest(text=text), tempfile.TemporaryDirectory() as directory, chdir(directory):
                self.run_entry(text)
                self.assertEqual(Path('artifact.xml').read_bytes(), text.encode('utf8'))
        for text in ['\ufeff\ufeff<r/>', '<?xml version="1.1"?><r/>',
                     '<?xml version="1.1"?><r>&#x1;</r>', '<r>' * 257 + '</r>' * 257]:
            with self.subTest(text=text), tempfile.TemporaryDirectory() as directory, chdir(directory):
                with self.assertRaises(Exception):
                    self.run_entry(text)
                self.assertEqual(list(Path('.').iterdir()), [])
        for uri in ['http://a b', 'http://%zz', 'urn:α', 'http://a{b}', 'http://a&quot;b']:
            with self.subTest(uri=uri), tempfile.TemporaryDirectory() as directory, chdir(directory):
                with self.assertRaises(Exception):
                    self.run_entry(f'<r xmlns:x="{uri}"><x:a/></r>')
                self.assertEqual(list(Path('.').iterdir()), [])


if __name__ == '__main__':
    unittest.main()
