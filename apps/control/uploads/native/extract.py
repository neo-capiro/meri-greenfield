"""Fixed native upload extraction child. No model, network, scripts, macros or uploaded configuration.

The qualified host supplies only input.<format> in this private working directory. Limits are product constants,
not request options. Native stdout is a bounded result; the host binds it to verified original bytes/tool/image.
"""
import csv
import io
import json
from pathlib import Path
import posixpath
import re
import subprocess
import sys
import threading
import time
import warnings
import zipfile
from urllib.parse import unquote, urlsplit

MAX_TEXT = 2_000_000
MAX_PAGES = 200
MAX_OCR_PAGES = 40
MAX_SLIDES = 200
MAX_SHEETS = 50
MAX_ROWS = 100_000
MAX_COLUMNS = 1024
MAX_PIXELS = 40_000_000
MAX_OCR_OUTPUT = 16 * 1024 * 1024
PARSE_SECONDS = 30
OCR_SECONDS = 90
TESSERACT = "/usr/bin/tesseract"
PDFTOPPM = "/usr/bin/pdftoppm"


class Limited(Exception):
    pass



def bounded_output(argv, limit, timeout, cwd=None):
    """Run one fixed native child and stream its stdout under a hard byte cap.

    The child is always this process's own child: it is waited on, or killed and reaped, so cancellation,
    overflow and timeout never leave an orphan. Output over the cap stops the child instead of buffering it.
    """
    process = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, cwd=cwd)
    stream = process.stdout
    assert stream is not None  # stdout=PIPE always yields a readable stream
    chunks, total, overflow = [], 0, []

    def pump():
        nonlocal total
        while True:
            chunk = stream.read(65536)
            if not chunk:
                return
            total += len(chunk)
            if total > limit:
                overflow.append(True)
                process.kill()
                return
            chunks.append(chunk)

    reader = threading.Thread(target=pump, daemon=True)
    reader.start()
    try:
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            raise Limited("OCR_TIME_LIMIT")
        reader.join(timeout=10)
        if overflow:
            raise Limited("OCR_OUTPUT_LIMIT")
        if code != 0:
            raise subprocess.CalledProcessError(code, argv)
        return b"".join(chunks)
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        stream.close()


def declared_columns(sheet):
    """Resolve a read-only worksheet's column geometry honestly.

    read_only workbooks may omit the stored dimension, in which case openpyxl reports max_column as None.
    That is unknown geometry, not a small sheet: it is reported and the scan is bounded by the fixed cap.
    """
    declared = sheet.max_column
    if not isinstance(declared, int) or declared < 1:
        return MAX_COLUMNS, "COLUMN_DIMENSION_UNKNOWN"
    if declared > MAX_COLUMNS:
        return MAX_COLUMNS, "COLUMN_LIMIT"
    return declared, None


def rasterize(path, index, out):
    """One bounded pdftoppm child writing a single private page image; no uploaded page range or DPI."""
    if out.ocr_started is None:
        out.ocr_started = time.monotonic()
    remaining = OCR_SECONDS - (time.monotonic() - out.ocr_started)
    if remaining <= 0:
        raise Limited("OCR_TIME_LIMIT")
    began = time.monotonic()
    try:
        subprocess.run([PDFTOPPM, "-f", str(index), "-l", str(index), "-scale-to", "5000", "-singlefile",
                        "-png", str(path), "ocr-page"], check=True, stdin=subprocess.DEVNULL,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       timeout=min(PARSE_SECONDS, remaining))
    finally:
        out.ocr_seconds += time.monotonic() - began


class Extraction:
    def __init__(self):
        self.started = time.monotonic()
        self.ocr_started = None
        self.ocr_seconds = 0
        self.characters = 0
        self.segments = []
        self.limitations = []

    def limited(self, reason):
        if reason not in self.limitations:
            self.limitations.append(reason)

    def check(self):
        if time.monotonic() - self.started - self.ocr_seconds > PARSE_SECONDS:
            raise Limited("PARSER_TIME_LIMIT")
        if time.monotonic() - self.started > PARSE_SECONDS + OCR_SECONDS:
            raise Limited("EXTRACTION_TIME_LIMIT")

    def add(self, text, method="native", confidence=None, **location):
        self.check()
        if not text or not text.strip():
            return
        remaining = MAX_TEXT - self.characters
        if remaining <= 0:
            raise Limited("TEXT_LIMIT")
        encoded = text.encode("utf-16-le")
        if len(encoded) // 2 > remaining:
            text = encoded[:remaining * 2].decode("utf-16-le", errors="ignore")
            self.limited("TEXT_LIMIT")
        self.characters += len(text.encode("utf-16-le")) // 2
        self.segments.append({"ordinal": len(self.segments), "text": text, "method": method,
                              "confidence": confidence, "location": {name: location.get(name) for name in
                              ("page", "slide", "sheet", "rowStart", "rowEnd")}})

    def ocr(self, path, page):
        self.check()
        if page > MAX_OCR_PAGES:
            self.limited("OCR_PAGE_LIMIT")
            return
        # Geometry is refused before any decode and before the OCR tool is consulted: an image over the pixel cap is
        # never rasterized or decoded, and that refusal does not depend on whether the OCR engine happens to be
        # installed. Image.open reads only the header, so the geometry is known without loading pixels; Pillow's own
        # decompression-bomb guard is mapped onto the same limitation instead of escaping as a decoder error.
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = MAX_PIXELS
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(path) as image:
                    if image.width * image.height > MAX_PIXELS:
                        raise Limited("IMAGE_PIXEL_LIMIT")
                    image.verify()
        except (Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise Limited("IMAGE_PIXEL_LIMIT") from None
        except SyntaxError:
            # Pillow's verify() reports malformed image chunks/CRCs this way. Restrict the mapping to this parser call;
            # unrelated filesystem/tool failures remain unavailable in main().
            raise Limited("PARSER_ERROR") from None
        if not Path(TESSERACT).is_file():
            self.limited("OCR_UNAVAILABLE")
            return
        if self.ocr_started is None:
            self.ocr_started = time.monotonic()
        remaining = OCR_SECONDS - (time.monotonic() - self.ocr_started)
        if remaining <= 0:
            raise Limited("OCR_TIME_LIMIT")
        # TSV keeps confidence. No uploaded language/config/command option reaches this invocation, and the
        # child's stdout is streamed under a hard cap so an oversized result can never be fully allocated.
        began = time.monotonic()
        try:
            output = bounded_output([TESSERACT, str(path), "stdout", "-l", "eng", "tsv"],
                                    MAX_OCR_OUTPUT, remaining)
        finally:
            self.ocr_seconds += time.monotonic() - began
        rows = csv.DictReader(io.StringIO(output.decode("utf-8", errors="strict")), delimiter="\t")
        words, confidences = [], []
        for row in rows:
            if row["level"] != "5" or not row["text"].strip():
                continue
            confidence = float(row["conf"]) / 100
            if not 0 <= confidence <= 1:
                raise ValueError("Invalid native confidence")
            words.append(row["text"])
            confidences.append(confidence)
        if words:
            self.add(" ".join(words), "ocr", min(confidences), page=page)
            if min(confidences) < 0.8:
                self.limited("OCR_LOW_CONFIDENCE")
        else:
            self.limited("OCR_NO_TEXT")


def xml(bytes_):
    from lxml import etree
    root = etree.fromstring(bytes_, etree.XMLParser(resolve_entities=False, load_dtd=False,
                                                   no_network=True, huge_tree=False))
    if root.getroottree().docinfo.doctype:
        raise ValueError("DTD refused")
    return root


OPC_RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships"
OFFICE_RELATIONSHIPS = ("http://schemas.openxmlformats.org/officeDocument/2006/relationships/",
                        "http://purl.oclc.org/ooxml/officeDocument/relationships/")
PRESENTATION_NAMESPACES = ("http://schemas.openxmlformats.org/presentationml/2006/main",
                          "http://purl.oclc.org/ooxml/presentationml/main")


def package_relationships(package, source):
    """Read inert OPC metadata only. No relationship can cause a filesystem or network read."""
    part = (posixpath.join(posixpath.dirname(source), "_rels", posixpath.basename(source) + ".rels")
            if source else "_rels/.rels")
    try:
        root = xml(package.read(part))
    except KeyError:
        raise Limited("PARSER_ERROR") from None
    if root.tag != "{%s}Relationships" % OPC_RELATIONSHIPS:
        raise Limited("PARSER_ERROR")
    relationships = {}
    for node in root:
        if not isinstance(node.tag, str):  # XML comments are not relationships.
            continue
        rid, kind, target = (node.get(key) for key in ("Id", "Type", "Target"))
        if (node.tag != "{%s}Relationship" % OPC_RELATIONSHIPS or not rid or rid in relationships
                or not kind or not target or node.get("TargetMode", "Internal") not in ("Internal", "External")):
            raise Limited("PARSER_ERROR")
        relationships[rid] = node
    return relationships


def package_target(package, source, relationship):
    """Resolve one internal package part, including root-relative/escaped OPC names, without opening links."""
    target = relationship.get("Target")
    if (relationship.get("TargetMode", "Internal") != "Internal" or not target or "\\" in target
            or re.search(r"%(?![0-9a-fA-F]{2})", target)):
        raise Limited("PARSER_ERROR")
    try:
        uri = urlsplit(target)
        path = unquote(uri.path, errors="strict")
    except (ValueError, UnicodeError):
        raise Limited("PARSER_ERROR") from None
    if uri.scheme or uri.netloc or uri.query or uri.fragment or "?" in target or "#" in target or "\\" in path:
        raise Limited("PARSER_ERROR")
    part = posixpath.normpath(path.lstrip("/") if path.startswith("/")
                              else posixpath.join(posixpath.dirname(source), path))
    if part in ("", ".", "..") or part.startswith("../") or part not in package.namelist():
        raise Limited("PARSER_ERROR")
    return part


def presentation_slides(package, out):
    """Presentation order owns slide numbers; part filenames and unreferenced ZIP members do not."""
    office = [r for r in package_relationships(package, "").values()
              if r.get("Type") in tuple(base + "officeDocument" for base in OFFICE_RELATIONSHIPS)]
    if len(office) != 1:
        raise Limited("PARSER_ERROR")
    main = package_target(package, "", office[0])
    root = xml(package.read(main))
    ns = next((ns for ns in PRESENTATION_NAMESPACES if root.tag == "{%s}presentation" % ns), None)
    if ns is None:
        raise Limited("PARSER_ERROR")
    lists = root.findall("{%s}sldIdLst" % ns)
    if len(lists) > 1:
        raise Limited("PARSER_ERROR")
    slides = list(lists[0]) if lists else []
    slides = [node for node in slides if isinstance(node.tag, str)]
    if len(slides) > MAX_SLIDES:
        out.limited("SLIDE_LIMIT")
    if not slides:
        return
    relationships = package_relationships(package, main)
    for node in slides[:MAX_SLIDES]:
        out.check()
        ids = [node.get("{%s}id" % base[:-1]) for base in OFFICE_RELATIONSHIPS]
        ids = [rid for rid in ids if rid is not None]
        relationship = relationships.get(ids[0]) if len(ids) == 1 else None
        if (node.tag != "{%s}sldId" % ns or relationship is None
                or relationship.get("Type") not in tuple(base + "slide" for base in OFFICE_RELATIONSHIPS)):
            raise Limited("PARSER_ERROR")
        yield package_target(package, main, relationship)


def extract(path, format_, out):
    if format_ in ("txt", "md"):
        out.add(path.read_text(encoding="utf-8-sig", errors="strict"))
    elif format_ == "docx":
        with zipfile.ZipFile(path) as package:
            root = xml(package.read("word/document.xml"))
            # Paragraph order includes table cells. Text only, never field evaluation or external resolution.
            paragraphs = root.xpath("//*[local-name()='p']")
            out.add("\n".join("".join(p.xpath(".//*[local-name()='t']/text()")) for p in paragraphs))
    elif format_ == "pptx":
        with zipfile.ZipFile(path) as package:
            for index, name in enumerate(presentation_slides(package, out), 1):
                slide = xml(package.read(name))
                if slide.tag not in tuple("{%s}sld" % ns for ns in PRESENTATION_NAMESPACES):
                    raise Limited("PARSER_ERROR")
                out.add("\n".join(slide.xpath("//*[local-name()='t']/text()")), slide=index)
    elif format_ == "xlsx":
        import openpyxl
        values = openpyxl.load_workbook(path, read_only=True, data_only=True, keep_links=False)
        formulas = openpyxl.load_workbook(path, read_only=True, data_only=False, keep_links=False)
        try:
            if len(values.worksheets) > MAX_SHEETS:
                out.limited("SHEET_LIMIT")
            total_rows = 0
            for sheet_index, sheet in enumerate(values.worksheets[:MAX_SHEETS], 1):
                columns, geometry = declared_columns(sheet)
                if geometry is not None:
                    out.limited(geometry)
                rows, row_characters = [], 0
                formula_rows = formulas.worksheets[sheet_index - 1].iter_rows(max_col=columns)
                for row in sheet.iter_rows(max_col=columns):
                    total_rows += 1
                    if total_rows > MAX_ROWS:
                        raise Limited("ROW_LIMIT")
                    authored = next(formula_rows, None)
                    if authored is not None and any(formula.data_type == "f" and value.value is None
                                                    for value, formula in zip(row, authored)):
                        out.limited("FORMULA_VALUE_UNAVAILABLE")
                    rows.append("\t".join("" if cell.value is None else str(cell.value) for cell in row))
                    row_characters += len(rows[-1].encode("utf-16-le")) // 2 + 1
                    if row_characters + out.characters > MAX_TEXT:
                        out.add("\n".join(rows), sheet=sheet_index, rowStart=1, rowEnd=len(rows))
                        raise Limited("TEXT_LIMIT")
                    out.check()
                if rows:
                    out.add("\n".join(rows), sheet=sheet_index, rowStart=1, rowEnd=len(rows))
        finally:
            values.close()
            formulas.close()
    elif format_ == "pdf":
        from pypdf import PdfReader
        reader = PdfReader(path, strict=True)
        if reader.is_encrypted:
            raise Limited("ENCRYPTED_DOCUMENT")
        if len(reader.pages) > MAX_PAGES:
            out.limited("PAGE_LIMIT")
        # The cap is applied by slicing before any page is used, so a document past the cap is never opened, parsed,
        # extracted or rasterized beyond its two-hundredth page, and the truncation is reported rather than silent.
        for index, page in enumerate(reader.pages[:MAX_PAGES], 1):
            out.check()
            text = page.extract_text()
            if text and text.strip():
                out.add(text, page=index)
                continue
            if index > MAX_OCR_PAGES:
                out.limited("OCR_PAGE_LIMIT")
            elif not Path(PDFTOPPM).is_file():
                out.limited("PDF_RASTERIZER_UNAVAILABLE")
            else:
                try:
                    rasterize(path, index, out)
                except subprocess.SubprocessError:
                    out.limited("PDF_RASTERIZER_UNAVAILABLE")
                    continue
                try:
                    out.ocr(Path("ocr-page.png"), index)
                finally:
                    Path("ocr-page.png").unlink(missing_ok=True)
    elif format_ in ("png", "jpg", "jpeg"):
        out.ocr(path, 1)
    else:
        raise ValueError("Unsupported format")


# The pinned parser libraries the upload formats require, each with the exact exception it raises for a malformed
# container or document. They are pinned dependencies (infra/product-preview/runtime-wheels.lock.json), so an
# importable library that does not expose its exception is a defect of the installed image rather than a document
# refusal, and must never be swallowed into a quietly smaller mapping.
PINNED_PARSERS = (("lxml.etree", "XMLSyntaxError"), ("pypdf.errors", "PdfReadError"),
                  ("openpyxl.utils.exceptions", "InvalidFileException"), ("PIL", "UnidentifiedImageError"))


class ExtractorConfiguration(Exception):
    """An importable pinned parser library does not expose the exception this extractor has to map."""


def _load_symbol(library, name):
    return getattr(__import__(library, fromlist=[name]), name)


def _parser_load(importer=None):
    return importer if importer is not None else _load_symbol


def parser_library_state(importer=None):
    """Report every pinned parser library as required-present, absent-library or broken-symbol.

    A library that cannot be imported at all is honestly absent: the host reports that format as unavailable and the
    qualification run records an explicit skip. An importable library whose expected exception is missing or mistyped is
    a defect of the installed image, not a document refusal, and is reported as such instead of dropping the mapping.
    """
    load = _parser_load(importer)
    state = []
    for library, name in PINNED_PARSERS:
        try:
            value = load(library, name)
        except ImportError:
            state.append({"module": library, "symbol": name, "state": "absent-library"})
            continue
        except AttributeError:
            state.append({"module": library, "symbol": name, "state": "broken-symbol"})
            continue
        if isinstance(value, type) and issubclass(value, BaseException):
            state.append({"module": library, "symbol": name, "state": "required-present"})
        else:
            state.append({"module": library, "symbol": name, "state": "broken-symbol"})
    return state


def library_errors(importer=None):
    """The library-level refusals a malformed or hostile document produces, built strictly.

    These are the exceptions the pinned parser libraries raise for a bad container or a malformed document:
    zipfile.BadZipFile for a broken docx/xlsx/pptx package, lxml.etree.XMLSyntaxError for malformed XML, pypdf's
    PdfReadError for a malformed PDF, openpyxl's InvalidFileException for an unreadable workbook and Pillow's
    UnidentifiedImageError for unrecognized image bytes. The latter subclasses OSError, so it must be caught before
    generic filesystem/tool unavailability. zipfile is stdlib and always required. Every pinned library that IS importable
    must contribute its exception: one that imports without exposing it raises ExtractorConfiguration, so a mistyped or
    absent expected exception fails loudly instead of silently disappearing from the mapping.
    """
    report = parser_library_state(importer)
    broken = [entry for entry in report if entry["state"] == "broken-symbol"]
    if broken:
        raise ExtractorConfiguration("pinned parser library does not expose the expected exception: " + ", ".join(
            "%s.%s" % (entry["module"], entry["symbol"]) for entry in broken))
    load = _parser_load(importer)
    types = [zipfile.BadZipFile]
    for entry in report:
        if entry["state"] == "required-present":
            types.append(load(entry["module"], entry["symbol"]))
    return tuple(types)


def main():
    format_ = sys.argv[1] if len(sys.argv) == 2 else ""
    if format_ not in ("txt", "md", "pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg"):
        raise ValueError("Fixed format required")
    out = Extraction()
    try:
        errors = library_errors()
    except ExtractorConfiguration as error:
        # An importable pinned library that does not expose the exception this mapping needs is a defect of the installed
        # image: it keeps its own code and a non-zero exit so it can never silently degrade into
        # NATIVE_EXTRACTION_UNAVAILABLE, while the payload and stderr preserve the exact reason for the caller and for the
        # qualification check.
        out.limited("NATIVE_EXTRACTOR_CONFIGURATION")
        print(json.dumps({"status": "unavailable", "segments": [], "limitations": out.limitations,
                          "detail": str(error)}, ensure_ascii=True))
        print("extractor configuration: %s" % error, file=sys.stderr)
        raise SystemExit(3)
    try:
        extract(Path("input." + format_), format_, out)
    except Limited as error:
        out.limited(str(error))
    except errors:
        # A library-level parse refusal (a bad container or a malformed XML/PDF/Office document) is a coded limitation
        # of this document, not an outage of the extractor: it keeps the distinguishing reason instead of escaping as a
        # traceback that the host could only report as NATIVE_EXTRACTION_UNAVAILABLE.
        out.limited("PARSER_ERROR")
    except (subprocess.SubprocessError, OSError, ValueError, ImportError):
        out.limited("NATIVE_EXTRACTION_UNAVAILABLE")
    if not out.segments and not out.limitations:
        out.limited("NO_TEXT_EXTRACTED")
    if "ENCRYPTED_DOCUMENT" in out.limitations:
        status = "blocked"
    elif out.limitations:
        status = "partial" if out.segments else "unavailable"
    else:
        status = "available"
    print(json.dumps({"status": status, "segments": out.segments, "limitations": out.limitations}, ensure_ascii=True))


if __name__ == "__main__":
    main()
