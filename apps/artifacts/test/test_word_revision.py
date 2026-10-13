"""Native retained-base revision properties, without network or source access."""
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest

from docx import Document
from docx.shared import Inches

spec = importlib.util.spec_from_file_location('meri_office', Path(__file__).parents[1] / 'python' / 'office.py')
office = importlib.util.module_from_spec(spec)
spec.loader.exec_module(office)


class WordRevision(unittest.TestCase):
    def test_native_base_styles_sections_and_original_survive_body_replacement(self):
        original = Document()
        original.sections[0].left_margin = Inches(1.3)
        original.styles['Normal'].font.name = 'Liberation Serif'
        original.add_paragraph('Original text')
        original.add_table(rows=1, cols=1).cell(0, 0).text = 'Original table'
        raw = io.BytesIO()
        original.save(raw)
        before = raw.getvalue()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'revision.docx'
            result = office.word({'blocks': [{'kind': 'paragraph', 'runs': [{'text': 'Revised text'}]}]}, {}, output,
                                {'request': {'format': 'docx'}, 'bytes': before})
            revised = Document(output)
            self.assertEqual([p.text for p in revised.paragraphs], ['Revised text'])
            self.assertEqual(len(revised.tables), 0)
            self.assertEqual(revised.sections[0].left_margin, Inches(1.3))
            self.assertEqual(revised.styles['Normal'].font.name, 'Liberation Serif')
            self.assertEqual(result, {'paragraphs': 1, 'tables': 0, 'pictures': 0})
        reopened = Document(io.BytesIO(before))
        self.assertEqual(reopened.paragraphs[0].text, 'Original text')
        self.assertEqual(reopened.tables[0].cell(0, 0).text, 'Original table')
        self.assertEqual(raw.getvalue(), before)

    def test_invalid_selected_base_cannot_be_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(Exception):
                office.word({'blocks': [{'kind': 'paragraph', 'runs': [{'text': 'Replacement'}]}]}, {},
                            Path(directory) / 'refused.docx', {'bytes': b'not a DOCX'})
            self.assertFalse((Path(directory) / 'refused.docx').exists())


if __name__ == '__main__':
    unittest.main()
