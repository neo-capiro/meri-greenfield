"""Focused tests for the fixed native upload extraction child.

Most of these run with the standard library only and with no native tools installed, which is the point: a missing tool
or missing input must stay unavailable/partial and never be reported as successful extraction. The limit tests build
real over-limit images with a real Pillow encoder, so the real decoder is exercised, and the recording shim proves the
decoder boundary is never crossed. Real tool, corpus and ARM-image behaviour remains a Release qualification, not
something these tests can establish.
"""
import hashlib
import importlib.util
import contextlib
import io
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

HERE = Path(__file__).resolve().parent
SCRIPT = HERE.parent / "extract.py"


def load_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location("meri_upload_extract", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ExtractionAccounting(unittest.TestCase):
    def setUp(self):
        self.extract = load_module()

    def test_text_is_truncated_at_the_utf16_limit_and_reported(self):
        out = self.extract.Extraction()
        out.add("a" * (self.extract.MAX_TEXT + 5))
        self.assertEqual(out.characters, self.extract.MAX_TEXT)
        self.assertIn("TEXT_LIMIT", out.limitations)
        self.assertEqual(len(out.segments[0]["text"]), self.extract.MAX_TEXT)

    def test_empty_text_adds_nothing(self):
        out = self.extract.Extraction()
        out.add("")
        self.assertEqual(out.segments, [])

    def test_limitations_are_deduplicated(self):
        out = self.extract.Extraction()
        out.limited("OCR_PAGE_LIMIT")
        out.limited("OCR_PAGE_LIMIT")
        self.assertEqual(out.limitations, ["OCR_PAGE_LIMIT"])

    def test_segment_location_shape_is_fixed(self):
        out = self.extract.Extraction()
        out.add("hello", "native", page=3)
        self.assertEqual(list(out.segments[0]), ["ordinal", "text", "method", "confidence", "location"])
        self.assertEqual(out.segments[0]["location"], {"page": 3, "slide": None, "sheet": None,
                                                      "rowStart": None, "rowEnd": None})


class ColumnGeometry(unittest.TestCase):
    """A read-only sheet may omit its dimension; unknown geometry must be named, not assumed small."""

    def setUp(self):
        self.extract = load_module()

    def test_unknown_geometry_is_reported_and_bounded(self):
        class Sheet:
            max_column = None
        columns, geometry = self.extract.declared_columns(Sheet())
        self.assertEqual(columns, self.extract.MAX_COLUMNS)
        self.assertEqual(geometry, "COLUMN_DIMENSION_UNKNOWN")

    def test_geometry_above_the_cap_is_reported_and_clamped(self):
        class Sheet:
            max_column = self.extract.MAX_COLUMNS + 1
        columns, geometry = self.extract.declared_columns(Sheet())
        self.assertEqual(columns, self.extract.MAX_COLUMNS)
        self.assertEqual(geometry, "COLUMN_LIMIT")

    def test_declared_geometry_within_the_cap_needs_no_limitation(self):
        class Sheet:
            max_column = 7
        self.assertEqual(self.extract.declared_columns(Sheet()), (7, None))


class BoundedChildOutput(unittest.TestCase):
    """The OCR child's stdout is capped before allocation, and the child is always reaped."""

    def setUp(self):
        self.extract = load_module()

    def test_output_over_the_cap_stops_the_child(self):
        argv = [sys.executable, "-c", "import sys; sys.stdout.write('x' * 200000)"]
        with self.assertRaises(self.extract.Limited) as caught:
            self.extract.bounded_output(argv, 1024, 30)
        self.assertEqual(str(caught.exception), "OCR_OUTPUT_LIMIT")

    def test_output_under_the_cap_is_returned(self):
        argv = [sys.executable, "-c", "import sys; sys.stdout.write('ok')"]
        self.assertEqual(self.extract.bounded_output(argv, 1024, 30), b"ok")

    def test_a_failing_child_is_reported_as_a_subprocess_error(self):
        argv = [sys.executable, "-c", "raise SystemExit(3)"]
        with self.assertRaises(subprocess.CalledProcessError):
            self.extract.bounded_output(argv, 1024, 30)

    def test_the_child_is_reaped_even_when_the_cap_trips(self):
        argv = [sys.executable, "-c", "import sys; sys.stdout.write('y' * 200000)"]
        with self.assertRaises(self.extract.Limited):
            self.extract.bounded_output(argv, 1024, 30)
        self.assertEqual(subprocess.run([sys.executable, "-c", "print('alive')"],
                                        capture_output=True).stdout.strip(), b"alive")


class ScriptContract(unittest.TestCase):
    """End-to-end runs of the real script with no native tools present."""

    def run_script(self, argv, cwd):
        return subprocess.run([sys.executable, str(SCRIPT), *argv], cwd=cwd, capture_output=True, timeout=60)

    def test_missing_input_stays_unavailable_and_never_extracted(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_script(["txt"], directory)
        self.assertEqual(result.returncode, 0)
        payload = json.loads(result.stdout.decode("utf-8"))
        self.assertEqual(payload["status"], "unavailable")
        self.assertEqual(payload["segments"], [])
        self.assertIn("NATIVE_EXTRACTION_UNAVAILABLE", payload["limitations"])

    def test_an_unsupported_format_is_refused_before_any_work(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "input.zip").write_bytes(b"PK\x03\x04")
            result = self.run_script(["zip"], directory)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Fixed format required", result.stderr.decode("utf-8"))

    def test_a_missing_format_argument_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_script([], directory)
        self.assertNotEqual(result.returncode, 0)

    def test_the_format_allowlist_matches_the_host_sandbox(self):
        host = HERE.parents[3] / "runtime" / "uploads" / "native-sandbox.mjs"
        if not host.is_file():
            self.fail("host sandbox source is missing: %s" % host)
        text = host.read_text(encoding="utf-8")
        allow = ("txt", "md", "pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg")
        self.assertIn("UPLOAD_EXTRACT_FORMATS", text)
        for name in allow:
            self.assertIn("'%s'" % name, text)
        self.assertIn('TESSERACT = "/usr/bin/tesseract"', SCRIPT.read_text(encoding="utf-8"))
        self.assertIn('"/usr/bin/tesseract"', text.replace("'", '"'))
        self.assertIn('"/usr/bin/pdftoppm"', text.replace("'", '"'))


BOUNDARY_SHIM = r'''
import json, os
RECORD = os.environ.get("MERI_BOUNDARY_RECORD")
def note(kind, detail=""):
    if RECORD:
        with open(RECORD, "a", encoding="utf-8") as handle:
            handle.write(json.dumps({"kind": kind, "detail": detail}) + "\n")
def record_load(original):
    def load(self, *args, **kwargs):
        note("pixel_decode", str(getattr(self, "format", "")))
        return original(self, *args, **kwargs)
    return load
try:
    from PIL import Image, ImageFile
    for owner in (Image.Image, ImageFile.ImageFile):
        owner.load = record_load(owner.load)
except Exception:
    pass
try:
    import subprocess
    class RecordingPopen(subprocess.Popen):
        def __init__(self, argv, *args, **kwargs):
            note("child_spawn", " ".join(str(item) for item in (argv if isinstance(argv, (list, tuple)) else [argv])))
            super().__init__(argv, *args, **kwargs)
    subprocess.Popen = RecordingPopen
except Exception:
    pass
'''

FAKE_PYPDF = r'''
import json, os
RECORD = os.environ.get("MERI_BOUNDARY_RECORD")
def note(kind, detail=""):
    if RECORD:
        with open(RECORD, "a", encoding="utf-8") as handle:
            handle.write(json.dumps({"kind": kind, "detail": detail}) + "\n")
class _Page:
    def __init__(self, number):
        self.number = number
        note("page_constructed", str(number))
    def extract_text(self):
        note("page_extract", str(self.number))
        return "PAGE201-MARKER" if self.number == 201 else "page %d text" % self.number
class _Pages:
    def __init__(self, count):
        self.count = count
    def __len__(self):
        return self.count
    def __getitem__(self, item):
        if isinstance(item, slice):
            return [_Page(number + 1) for number in range(*item.indices(self.count))]
        return _Page(item + 1)
class PdfReader:
    def __init__(self, path, strict=True):
        self.is_encrypted = False
        self.pages = _Pages(201)
'''


class NativeLimitBoundaries(unittest.TestCase):
    """Over-limit geometry is refused before any decode, rasterize or OCR child.

    The over-limit images are real files written by a real Pillow encoder and read by the real decoder; the recording
    shim proves the decoder boundary is never crossed (no pixel load, no child process). The page-cap test uses a
    recording `pypdf` double because pypdf is not installed in this authoring environment: it is a boundary proof that
    the cap is applied before any page object is opened, not a pypdf decoder qualification.
    """

    def shim(self, directory):
        path = Path(directory, "shim")
        path.mkdir()
        Path(path, "sitecustomize.py").write_text(BOUNDARY_SHIM, encoding="utf-8")
        return path

    @staticmethod
    def records(path):
        if not path.is_file():
            return []
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]

    def run_script(self, argv, directory, shim, record):
        env = dict(os.environ, PYTHONPATH=str(shim), MERI_BOUNDARY_RECORD=str(record))
        return subprocess.run([sys.executable, str(SCRIPT), *argv], cwd=directory, capture_output=True, timeout=300,
                              env=env)

    @unittest.skipUnless(importlib.util.find_spec("PIL") is not None, "Pillow builds the real over-limit image")
    def test_an_over_limit_jpeg_is_refused_before_pixels_are_decoded_or_ocr_runs(self):
        from PIL import Image
        for size, why in [((9000, 4600), "over the 40,000,000 pixel cap"), ((14000, 6000), "over twice the cap")]:
            with tempfile.TemporaryDirectory() as directory:
                Image.new("L", size, 0).save(Path(directory, "input.jpg"), quality=1)
                shim, record = self.shim(directory), Path(directory, "record.jsonl")
                result = self.run_script(["jpg"], directory, shim, record)
                self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))
                payload = json.loads(result.stdout.decode("utf-8"))
                self.assertEqual(payload["status"], "unavailable", why)
                self.assertEqual(payload["segments"], [], why)
                self.assertEqual(payload["limitations"], ["IMAGE_PIXEL_LIMIT"], why)
                entries = self.records(record)
                self.assertEqual([entry for entry in entries if entry["kind"] == "pixel_decode"], [],
                                 "an over-limit image is never decoded: %s" % why)
                self.assertEqual([entry for entry in entries if entry["kind"] == "child_spawn"], [],
                                 "no OCR child is started: %s" % why)

    @unittest.skipUnless(importlib.util.find_spec("PIL") is not None, "Pillow builds the real at-cap image")
    @unittest.skipIf(Path("/usr/bin/tesseract").is_file(),
                     "this host has the OCR tool, so the at-cap case would run real OCR")
    def test_a_jpeg_at_exactly_the_pixel_cap_is_not_refused_as_over_limit(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as directory:
            Image.new("L", (8000, 5000), 0).save(Path(directory, "input.jpg"), quality=1)
            shim, record = self.shim(directory), Path(directory, "record.jsonl")
            result = self.run_script(["jpg"], directory, shim, record)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))
            payload = json.loads(result.stdout.decode("utf-8"))
            self.assertNotIn("IMAGE_PIXEL_LIMIT", payload["limitations"], "the cap is inclusive")
            self.assertEqual(payload["segments"], [])

    @unittest.skipIf(importlib.util.find_spec("pypdf") is not None,
                     "real pypdf is installed here, so the recording double is not used")
    def test_the_page_cap_is_applied_before_page_two_hundred_and_one_is_opened(self):
        with tempfile.TemporaryDirectory() as directory:
            shim = self.shim(directory)
            fake = Path(directory, "fake")
            (fake / "pypdf").mkdir(parents=True)
            (fake / "pypdf" / "__init__.py").write_text(FAKE_PYPDF, encoding="utf-8")
            Path(directory, "input.pdf").write_bytes(b"%PDF-1.7 recording-double fixture\n")
            record = Path(directory, "record.jsonl")
            env = dict(os.environ, PYTHONPATH=os.pathsep.join([str(shim), str(fake)]),
                       MERI_BOUNDARY_RECORD=str(record))
            result = subprocess.run([sys.executable, str(SCRIPT), "pdf"], cwd=directory, capture_output=True,
                                    timeout=300, env=env)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))
            payload = json.loads(result.stdout.decode("utf-8"))
            entries = self.records(record)
            expected = [str(number) for number in range(1, 201)]
            self.assertEqual([entry["detail"] for entry in entries if entry["kind"] == "page_constructed"], expected,
                             "page 201 is never opened")
            self.assertEqual([entry["detail"] for entry in entries if entry["kind"] == "page_extract"], expected,
                             "page 201 is never extracted")
            self.assertIn("PAGE_LIMIT", payload["limitations"], "the truncation is reported, not silent")
            self.assertEqual(payload["status"], "partial", "the pages inside the cap are still reported")
            self.assertEqual([segment["location"]["page"] for segment in payload["segments"]], list(range(1, 201)))
            self.assertNotIn("PAGE201-MARKER", json.dumps(payload), "content past the cap is never read")

    def test_the_geometry_guard_precedes_the_tool_check_and_the_cap_precedes_the_page_loop(self):
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertLess(source.index("image.width * image.height > MAX_PIXELS"),
                        source.index("if not Path(TESSERACT).is_file():"),
                        "geometry is refused before OCR tool availability is consulted")
        self.assertIn("if len(reader.pages) > MAX_PAGES:", source)
        self.assertIn("reader.pages[:MAX_PAGES]", source)


CANONICAL_FIXTURE = HERE / "canonical-limits.fixture.json"
CANONICAL_OWNER_SHA256 = "bf457c9049ec6b026e83fd438a2600d026d6d4ce212c43ca93250227e288e37b"
CONTRACT_OVERRIDE = "MERI_UPLOAD_CONTRACT_SOURCE"
# Recorded read-only source dependency: A5 owns this contract, and it is NOT part of this checkout. HERE is the test
# directory, so parents[4] is the repository root and its parent is the work tree that holds the sibling checkouts.
CONTRACT_OWNER = (HERE.parents[4].parent / "wave5-upload-input-20261028" / "packages" / "contracts"
                  / "uploads-application" / "protocol.mjs")
_CONTRACT_LIMITS = re.compile(r"export const UPLOAD_LIMITS=Object\.freeze\(\{(?P<body>.*?)\}\);", re.S)
_CONTRACT_TERM = re.compile(r"\A[0-9*.+()\s]+\Z")
# The extractor bounds that must agree exactly with the contract. Only the numbers this child itself enforces are
# listed: the original-bytes, zip-entry, expanded-bytes and ratio limits belong to A5's policy module.
EXTRACTOR_BOUNDS = {
    "pdfPages": lambda module: module.MAX_PAGES,
    "slides": lambda module: module.MAX_SLIDES,
    "sheets": lambda module: module.MAX_SHEETS,
    "rows": lambda module: module.MAX_ROWS,
    "columns": lambda module: module.MAX_COLUMNS,
    "textCharacters": lambda module: module.MAX_TEXT,
    "imagePixels": lambda module: module.MAX_PIXELS,
    "ocrPages": lambda module: module.MAX_OCR_PAGES,
    "parseMs": lambda module: module.PARSE_SECONDS * 1000,
    "ocrMs": lambda module: module.OCR_SECONDS * 1000,
}


def contract_source():
    return Path(os.environ.get(CONTRACT_OVERRIDE, CONTRACT_OWNER))


def parse_contract_limits(text):
    """Read the owner's numeric bounds without executing the module.

    Only digits, arithmetic operators, parentheses and whitespace are evaluated, asserted first, so an unexpected term
    fails the test instead of running anything.
    """
    match = _CONTRACT_LIMITS.search(text)
    if match is None:
        raise AssertionError("the owner no longer exposes UPLOAD_LIMITS in the recorded shape")
    limits = {}
    for field in match.group("body").replace("\n", " ").split(","):
        if not field.strip():
            continue
        key, _, value = field.partition(":")
        value = value.strip()
        if not _CONTRACT_TERM.match(value):
            raise AssertionError("unexpected UPLOAD_LIMITS term for %s: %r" % (key.strip(), value))
        limits[key.strip()] = eval(value)  # noqa: S307 - digits and arithmetic only, asserted immediately above
    return limits


class CanonicalLimitAgreement(unittest.TestCase):
    """The extractor's numeric bounds must agree EXACTLY with the upload contract A5 owns, never with a re-derived copy.

    The contract is a read-only source dependency in a sibling checkout this tree does not contain, so the always-run
    authority is the frozen canonical record beside this test, which names the owner path and the exact sha256 of the
    revision it was read from. When that owner file IS reachable (the sibling checkout, or an explicit
    MERI_UPLOAD_CONTRACT_SOURCE) the live values and the live revision hash are compared as well, so a divergence fails
    loudly. A missing owner is never a silent pass: the frozen record is asserted either way, and the live comparison
    reports the exact path it could not reach.
    """

    def setUp(self):
        self.extract = load_module()

    def test_extractor_bounds_equal_the_frozen_canonical_record(self):
        fixture = json.loads(CANONICAL_FIXTURE.read_text(encoding="utf-8"))
        self.assertEqual(fixture["sourceSha256"], CANONICAL_OWNER_SHA256,
                         "the frozen record names the reviewed owner revision")
        limits = fixture["limits"]
        for key, read in EXTRACTOR_BOUNDS.items():
            self.assertEqual(read(self.extract), limits[key], "%s must equal the contract value exactly" % key)

    def test_extractor_bounds_equal_the_live_owner_contract(self):
        source = contract_source()
        if not source.is_file():
            self.skipTest("owner contract not reachable at %s; the frozen record (sha256 %s) is the recorded authority"
                          % (source, CANONICAL_OWNER_SHA256))
        limits = parse_contract_limits(source.read_text(encoding="utf-8"))
        for key, read in EXTRACTOR_BOUNDS.items():
            self.assertEqual(read(self.extract), limits[key], "%s diverges from %s" % (key, source))

    def test_the_frozen_record_names_the_revision_it_was_read_from(self):
        source = contract_source()
        if not source.is_file():
            self.skipTest("owner contract not reachable at %s" % source)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        self.assertEqual(digest, CANONICAL_OWNER_SHA256,
                         "the owner revision changed: re-record the frozen limits deliberately")


class ParserRefusals(unittest.TestCase):
    """A malformed document is a coded limitation of that document, and an Office hyperlink stays inert text."""

    def setUp(self):
        self.extract = load_module()

    def child(self, directory, format_, payload):
        (Path(directory) / ("input." + format_)).write_bytes(payload)
        return subprocess.run([sys.executable, str(SCRIPT), format_], cwd=directory, capture_output=True, timeout=60)

    def test_a_broken_container_is_a_coded_parser_refusal_not_a_library_traceback(self):
        self.assertIn(zipfile.BadZipFile, self.extract.library_errors(),
                      "the broken-container refusal is mapped instead of escaping as a traceback")
        for error in self.extract.library_errors():
            if error.__name__ == "UnidentifiedImageError":
                self.assertTrue(issubclass(error, OSError), "Pillow's specific refusal must precede the generic IO handler")
            else:
                self.assertFalse(issubclass(error, (OSError, ValueError)),
                                 "%s must be a library refusal, not something the host can only report as an outage"
                                 % error.__name__)
        with tempfile.TemporaryDirectory() as directory:
            result = self.child(directory, "docx", b"this is not an Office package at all")
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))
            payload = json.loads(result.stdout.decode("utf-8"))
            self.assertIn("PARSER_ERROR", payload["limitations"])
            self.assertEqual(payload["status"], "unavailable")
            self.assertEqual(payload["segments"], [], "a refused document yields no fabricated content")
            self.assertNotIn("NATIVE_EXTRACTION_UNAVAILABLE", payload["limitations"])

    def test_a_legitimate_office_hyperlink_is_inert_text_and_never_resolved(self):
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("urlopen", source)
        self.assertNotIn("import requests", source)
        self.assertIn('package.read("word/document.xml")', source, "only the document part is read")
        self.assertNotIn("document.xml.rels", source, "relationships are never resolved")
        if importlib.util.find_spec("lxml") is None:
            self.skipTest("lxml is not installed on this authoring host, so the docx text path cannot be exercised here; "
                          "the inertness assertions above still ran")
        with tempfile.TemporaryDirectory() as directory:
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as package:
                package.writestr(
                    "word/document.xml",
                    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
                    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                    '<w:body><w:p><w:r><w:t>hello</w:t></w:r>'
                    '<w:hyperlink r:id="rId9"><w:r><w:t>link text</w:t></w:r></w:hyperlink></w:p></w:body></w:document>')
                package.writestr(
                    "word/_rels/document.xml.rels",
                    '<Relationships><Relationship Id="rId9" TargetMode="External" '
                    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" '
                    'Target="http://example.invalid/never-fetched"/></Relationships>')
            result = self.child(directory, "docx", buffer.getvalue())
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))
            payload = json.loads(result.stdout.decode("utf-8"))
            self.assertEqual(payload["status"], "available")
            rendered = json.dumps(payload)
            self.assertIn("hello", rendered)
            self.assertIn("link text", rendered, "hyperlink text is preserved as inert text")
            self.assertNotIn("example.invalid", rendered, "the external target is never resolved or echoed")

    def test_the_parser_mapping_is_complete_whenever_a_pinned_library_is_importable(self):
        """A pinned library that IS installed must contribute its exception; none may quietly fall out of the mapping."""
        state = {entry["module"]: entry for entry in self.extract.parser_library_state()}
        self.assertEqual(sorted(state), sorted(module for module, _ in self.extract.PINNED_PARSERS),
                         "every pinned parser library is reported, present or honestly absent")
        for module, name in self.extract.PINNED_PARSERS:
            self.assertIn(state[module]["state"], ("required-present", "absent-library"),
                          "%s must either expose %s or be honestly absent" % (module, name))
        errors = self.extract.library_errors()
        present = [entry for entry in state.values() if entry["state"] == "required-present"]
        self.assertEqual(len(errors), 1 + len(present),
                         "BadZipFile plus exactly one exception per importable pinned library")
        for entry in present:
            symbol = getattr(__import__(entry["module"], fromlist=[entry["symbol"]]), entry["symbol"])
            self.assertIn(symbol, errors, "%s.%s must be in the mapping" % (entry["module"], entry["symbol"]))
        self.assertIn(zipfile.BadZipFile, errors)

    @unittest.skipIf(importlib.util.find_spec("PIL") is None, "Pillow is unavailable on this source-test host")
    def test_unidentified_images_and_broken_png_crc_are_parser_refusals_before_ocr(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as directory:
            for format_ in ("png", "jpg", "jpeg"):
                result = self.child(directory, format_, b"not an image")
                self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))
                payload = json.loads(result.stdout)
                self.assertEqual(payload["segments"], [])
                self.assertEqual(payload["limitations"], ["PARSER_ERROR"])
            buffer = io.BytesIO()
            Image.new("RGB", (2, 2), "white").save(buffer, format="PNG")
            broken = bytearray(buffer.getvalue())
            kind = broken.index(b"IDAT")
            length = int.from_bytes(broken[kind - 4:kind], "big")
            broken[kind + 4 + length] ^= 1
            result = self.child(directory, "png", broken)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))
            payload = json.loads(result.stdout)
            self.assertEqual(payload["limitations"], ["PARSER_ERROR"])
            self.assertEqual(payload["segments"], [])

    def test_filesystem_failure_remains_unavailable_and_missing_pillow_symbol_is_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, str(SCRIPT), "txt"], cwd=directory,
                                    capture_output=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))
            self.assertEqual(json.loads(result.stdout)["limitations"], ["NATIVE_EXTRACTION_UNAVAILABLE"])
        def missing_pillow(module, name):
            if module == "PIL":
                raise AttributeError(name)
            raise ImportError(module)
        with self.assertRaises(self.extract.ExtractorConfiguration) as caught:
            self.extract.library_errors(importer=missing_pillow)
        self.assertIn("PIL.UnidentifiedImageError", str(caught.exception))

    def test_an_importable_library_without_its_expected_exception_fails_loudly(self):
        """Controlled missing-symbol case: importable-but-mistyped must fail, honestly-absent must stay acceptable."""
        class FakeException(Exception):
            pass

        def mistyped(module, name):
            if module == "pypdf.errors":
                raise AttributeError("module 'pypdf.errors' has no attribute %r" % name)
            if module == "openpyxl.utils.exceptions":
                raise ImportError("No module named 'openpyxl'")
            return FakeException

        with self.assertRaises(self.extract.ExtractorConfiguration) as caught:
            self.extract.library_errors(importer=mistyped)
        self.assertIn("pypdf.errors.PdfReadError", str(caught.exception),
                      "the defect names the exact library and exception")
        states = {entry["module"]: entry["state"] for entry in self.extract.parser_library_state(importer=mistyped)}
        self.assertEqual(states["openpyxl.utils.exceptions"], "absent-library",
                         "a library that cannot be imported at all is honest unavailability, not a mapping defect")

        def only_absent(module, name):
            if module == "openpyxl.utils.exceptions":
                raise ImportError("No module named 'openpyxl'")
            return FakeException

        errors = self.extract.library_errors(importer=only_absent)
        self.assertEqual([error.__name__ for error in errors], ["BadZipFile", "FakeException", "FakeException", "FakeException"],
                         "an honestly absent library never thins the mapping of the libraries that are installed")

    def test_a_broken_installed_mapping_is_reported_with_its_own_code_and_exit(self):
        """The child must not present an image defect as a document refusal or as an extractor outage."""
        module = load_module()
        original = module.library_errors
        setattr(module, "library_errors", lambda importer=None: (_ for _ in ()).throw(
            module.ExtractorConfiguration("pypdf.errors.PdfReadError is missing from an importable library")))
        argv, cwd = sys.argv, os.getcwd()
        try:
            with tempfile.TemporaryDirectory() as directory:
                (Path(directory) / "input.txt").write_text("hello", encoding="utf-8")
                os.chdir(directory)
                sys.argv = [str(SCRIPT), "txt"]
                buffer = io.StringIO()
                try:
                    with contextlib.redirect_stdout(buffer):
                        with self.assertRaises(SystemExit) as exit_:
                            module.main()
                    self.assertEqual(exit_.exception.code, 3, "a broken mapping must not exit like a normal refusal")
                finally:
                    # Restored inside the temporary-directory block: a Windows authoring host cannot delete a directory
                    # that is still the process working directory.
                    os.chdir(cwd)
                    sys.argv = argv
        finally:
            module.library_errors = original
        payload = json.loads(buffer.getvalue())
        self.assertEqual(payload["status"], "unavailable")
        self.assertIn("NATIVE_EXTRACTOR_CONFIGURATION", payload["limitations"])
        self.assertNotIn("NATIVE_EXTRACTION_UNAVAILABLE", payload["limitations"],
                         "a configuration defect is never reported as an outage")
        self.assertIn("PdfReadError", payload["detail"])


if __name__ == "__main__":
    unittest.main()
