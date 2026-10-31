"""Actual passive file bytes through the fixed extractor; no provider or Office engine claims."""
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / "extract.py"
OPC = "http://schemas.openxmlformats.org/package/2006/relationships"
OFFICE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
STRICT = "http://purl.oclc.org/ooxml/officeDocument/relationships/"
PRESENTATION = "http://schemas.openxmlformats.org/presentationml/2006/main"
DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/main"


def presentation(*, strict=False, main="ppt/presentation.xml", target="slides/slide2.xml",
                 relation_type="slide", mode="Internal", missing=False, duplicate=False,
                 empty=False, order=("rSecond", "rFirst"), extra_slides=0):
    """Renumbered/reordered slide parts and an orphan distinguish order from a ZIP filename census."""
    rel = STRICT if strict else OFFICE
    p = "http://purl.oclc.org/ooxml/presentationml/main" if strict else PRESENTATION
    a = "http://purl.oclc.org/ooxml/drawingml/main" if strict else DRAWING
    folder = main.rsplit("/", 1)[0]
    parts = {
        "_rels/.rels": f'<Relationships xmlns="{OPC}"><Relationship Id="main" Type="{rel}officeDocument" Target="/{main}"/></Relationships>',
        main: f'<p:presentation xmlns:p="{p}" xmlns:r="{rel[:-1]}"><p:sldIdLst>' +
              "".join(f'<p:sldId id="{256 + i}" r:id="{rid}"/>' for i, rid in enumerate(order)) +
              '</p:sldIdLst></p:presentation>',
        folder + "/_rels/" + main.rsplit("/", 1)[1] + ".rels":
            f'<Relationships xmlns="{OPC}"><Relationship Id="rFirst" Type="{rel}slide" Target="slides/slide1.xml"/>' +
            ("" if missing else f'<Relationship Id="rSecond" Type="{rel}{relation_type}" Target="{target}" TargetMode="{mode}"/>') +
            (f'<Relationship Id="rSecond" Type="{rel}slide" Target="slides/slide1.xml"/>' if duplicate else "") +
            "".join(f'<Relationship Id="r{n}" Type="{rel}slide" Target="slides/slide{n}.xml"/>' for n in range(3, 3 + extra_slides)) +
            '</Relationships>',
    }
    slides = [(1, "Conclusion"), (2, "Introduction"), (3, "ORPHAN MUST NOT APPEAR")]
    if extra_slides:
        slides = slides[:2] + [(n, f"Slide {n}") for n in range(3, 3 + extra_slides)]
    for number, text in slides:
        parts[f"{folder}/slides/slide{number}.xml"] = (
            f'<p:sld xmlns:p="{p}" xmlns:a="{a}"><p:cSld><p:spTree><p:sp><p:txBody>'
            f'<a:p><a:r><a:t>{"  " if empty else text}</a:t></a:r></a:p>'
            '</p:txBody></p:sp></p:spTree></p:cSld></p:sld>')
    overrides = "".join(f'<Override PartName="/{name}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.{"presentation.main+xml" if name == main else "slide+xml"}"/>'
                        for name in parts if name.endswith(".xml"))
    parts["[Content_Types].xml"] = ('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' + overrides + '</Types>')
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_STORED) as package:
        for name, value in parts.items():
            package.writestr(name, value)
    return output.getvalue()


class DocumentExtraction(unittest.TestCase):
    def child(self, format_, content):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "input." + format_).write_bytes(content)
            result = subprocess.run([sys.executable, str(SCRIPT), format_], cwd=directory,
                                    capture_output=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        return json.loads(result.stdout)

    def test_presentation_order_and_slide_locations_follow_relationships_not_filenames(self):
        for strict in (False, True):
            for main in ("ppt/presentation.xml", "deck/main.xml"):
                with self.subTest(strict=strict, main=main):
                    result = self.child("pptx", presentation(strict=strict, main=main))
                    self.assertEqual(result["status"], "available", result)
                    self.assertEqual(result["limitations"], [])
                    self.assertEqual([s["text"] for s in result["segments"]], ["Introduction", "Conclusion"])
                    self.assertEqual([s["location"]["slide"] for s in result["segments"]], [1, 2])

    def test_absolute_and_encoded_internal_slide_targets_stay_inside_package(self):
        for target in ("/ppt/slides/slide2.xml", "slides/slide%32.xml", "../ppt/slides/slide2.xml"):
            with self.subTest(target=target):
                result = self.child("pptx", presentation(target=target))
                self.assertEqual([s["text"] for s in result["segments"]], ["Introduction", "Conclusion"])

    def test_broken_or_external_slide_references_never_fall_back_to_filename_order(self):
        for patch in ({"missing": True}, {"duplicate": True}, {"relation_type": "hyperlink"},
                      {"mode": "External"}, {"target": "https://example.invalid/slide.xml"},
                      {"target": "../../outside.xml"}, {"target": "slides/missing.xml"},
                      {"target": "slides/slide2.xml#fragment"}, {"target": "slides/%ZZ.xml"}):
            with self.subTest(patch=patch):
                result = self.child("pptx", presentation(**patch))
                self.assertEqual(result["status"], "unavailable", result)
                self.assertEqual(result["segments"], [])
                self.assertIn("PARSER_ERROR", result["limitations"])

    def test_slide_cap_applies_to_ordered_references_and_reports_partial(self):
        order = ("rSecond", "rFirst", *(f"r{n}" for n in range(3, 202)))
        result = self.child("pptx", presentation(order=order, extra_slides=199))
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["limitations"], ["SLIDE_LIMIT"])
        self.assertEqual(len(result["segments"]), 200)
        self.assertEqual(result["segments"][0]["text"], "Introduction")
        self.assertEqual(result["segments"][-1]["location"]["slide"], 200)
        self.assertNotIn("Slide 201", [s["text"] for s in result["segments"]])

    def test_later_broken_reference_retains_only_observed_prefix_as_partial(self):
        result = self.child("pptx", presentation(missing=True, order=("rFirst", "rSecond")))
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["limitations"], ["PARSER_ERROR"])
        self.assertEqual([s["text"] for s in result["segments"]], ["Conclusion"])
        self.assertEqual(result["segments"][0]["location"]["slide"], 1)

    def test_empty_or_whitespace_extraction_is_unavailable_with_explicit_reason(self):
        for format_, content in (("txt", b""), ("md", b" \t\r\n"),
                                 ("txt", b"\xef\xbb\xbf"), ("pptx", presentation(empty=True))):
            with self.subTest(format_=format_, bytes=len(content)):
                result = self.child(format_, content)
                self.assertEqual(result["status"], "unavailable", result)
                self.assertEqual(result["segments"], [])
                self.assertEqual(result["limitations"], ["NO_TEXT_EXTRACTED"])

    def test_blank_word_and_workbook_are_not_successful_text_extraction(self):
        import openpyxl
        word = io.BytesIO()
        with zipfile.ZipFile(word, "w") as package:
            package.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/><w:p/></w:body></w:document>')
        book = openpyxl.Workbook()
        book.active["A1"] = " \t "
        workbook = io.BytesIO()
        book.save(workbook)
        book.close()
        for format_, content in (("docx", word.getvalue()), ("xlsx", workbook.getvalue())):
            with self.subTest(format_=format_):
                result = self.child(format_, content)
                self.assertEqual(result["status"], "unavailable", result)
                self.assertEqual(result["segments"], [])
                self.assertEqual(result["limitations"], ["NO_TEXT_EXTRACTED"])

    def test_meaningful_text_preserves_leading_and_trailing_whitespace(self):
        result = self.child("txt", " \tMeaningful 😀 text\n ".encode())
        self.assertEqual(result["status"], "available")
        self.assertEqual(result["segments"][0]["text"], " \tMeaningful 😀 text\n ")


if __name__ == "__main__":
    unittest.main()
