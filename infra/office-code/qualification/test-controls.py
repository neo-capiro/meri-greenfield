#!/usr/bin/env python3
"""Durable controls for the Office241 fidelity checkers (SCRUM-241).

Every case builds a real ZIP package from the retained corpus originals in a
task scratch directory and runs the actual checker over it. Nothing here
mirrors a private helper: the mutations go through package bytes, and the
verdicts come from ``chart.check`` / ``currency.compare``.

Usage:
    python test-controls.py --corpus <corpus inputs dir> [--scratch <dir>]

Exit codes: 0 all controls behave, 1 a control regressed, 2 corpus not supplied
(never a silent pass). The corpus and retained artifacts are read-only.
"""
import argparse
import copy
import io
import os
import posixpath
import shutil
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util  # noqa: E402


def load(name, filename):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot import %s" % path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


chart = load("office241_chart", "chart-workbook-fidelity.py")
currency = load("office241_currency", "currency-semantics-check.py")

C = "{http://schemas.openxmlformats.org/drawingml/2006/chart}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
RELS = "{http://schemas.openxmlformats.org/package/2006/relationships}"
SML = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
CT = "{http://schemas.openxmlformats.org/package/2006/content-types}"
PACKAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/package"
CHART_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart"


class Package:
    """Ordered ZIP parts, editable in memory."""

    def __init__(self, path=None, payload=None):
        self.names = []
        self.data = {}
        if path is not None:
            with zipfile.ZipFile(path) as archive:
                for info in archive.infolist():
                    self.names.append(info.filename)
                    self.data[info.filename] = archive.read(info.filename)
        elif payload is not None:
            with zipfile.ZipFile(io.BytesIO(payload)) as archive:
                for info in archive.infolist():
                    self.names.append(info.filename)
                    self.data[info.filename] = archive.read(info.filename)

    def set(self, name, payload):
        if name not in self.data:
            self.names.append(name)
        self.data[name] = payload

    def rename(self, old, new):
        self.names[self.names.index(old)] = new
        self.data[new] = self.data.pop(old)

    def to_bytes(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for name in self.names:
                archive.writestr(name, self.data[name])
        return buffer.getvalue()

    def save(self, path):
        with open(path, "wb") as handle:
            handle.write(self.to_bytes())


def xml_patch(pkg, name, mutate):
    root = ET.fromstring(pkg.data[name])
    mutate(root)
    pkg.set(name, ET.tostring(root, encoding="utf-8", xml_declaration=True))


# ---------------------------------------------------------------- mutations

def set_workbook_cell(pkg, part, sheet_part, ref, value, formula=None):
    inner = Package(payload=pkg.data[part])
    def mutate(root):
        for cell in root.iter(SML + "c"):
            if cell.get("r") != ref:
                continue
            cell.attrib.pop("t", None)
            node = cell.find(SML + "v")
            if node is None:
                node = ET.SubElement(cell, SML + "v")
            node.text = str(value)
            if formula is not None:
                formula_node = cell.find(SML + "f")
                if formula_node is None:
                    formula_node = ET.SubElement(cell, SML + "f")
                formula_node.text = formula
    xml_patch(inner, sheet_part, mutate)
    pkg.set(part, inner.to_bytes())


def set_chart_role_cache(pkg, chart_part, role, index, value):
    tags = {"name": ("tx",), "cat": ("cat",), "val": ("val", "yVal")}
    def mutate(root):
        for ser in root.iter(C + "ser"):
            node = None
            for tag in tags[role]:
                node = ser.find(C + tag)
                if node is not None:
                    break
            if node is None:
                continue
            for point in node.iter(C + "pt"):
                if int(point.get("idx", "0")) == index:
                    for text in point.iter(C + "v"):
                        text.text = str(value)
                    return
    xml_patch(pkg, chart_part, mutate)


def disconnect_slide_chart(pkg, slide="ppt/slides/slide1.xml"):
    def mutate(root):
        for node in root.iter(C + "chart"):
            node.set(R + "id", "rIdMissingFromRelationshipTable")
    xml_patch(pkg, slide, mutate)


def remove_chart_formulas(pkg, part):
    def mutate(root):
        for parent in root.iter():
            for child in list(parent):
                if child.tag == C + "f":
                    parent.remove(child)
    xml_patch(pkg, part, mutate)


def foreign_chart_formulas(pkg, part):
    def mutate(root):
        for node in root.iter(C + "f"):
            node.text = "NonexistentWorksheet!$Z$999"
    xml_patch(pkg, part, mutate)


def reorder_relationship_table(pkg, part):
    def mutate(root):
        records = list(root)
        for record in records:
            root.remove(record)
        for record in reversed(records):
            root.append(record)
    xml_patch(pkg, part, mutate)


def renumber_chart_parts(pkg, mapping, slide="ppt/slides/slide1.xml"):
    """Rename chart parts and their rels, updating slide targets and content types."""
    for old, new in mapping.items():
        pkg.rename(old, new)
        old_rels, new_rels = chart.rels_path(old), chart.rels_path(new)
        if old_rels in pkg.data:
            pkg.rename(old_rels, new_rels)

    def mutate_slide_rels(root):
        for rel in root.findall(RELS + "Relationship"):
            target = rel.get("Target", "")
            base = posixpath.basename(target)
            full = posixpath.normpath(posixpath.join("ppt/slides", target)).lstrip("/")
            if full in mapping:
                replacement = posixpath.basename(mapping[full])
                rel.set("Target", posixpath.join(posixpath.dirname(target), replacement))
    xml_patch(pkg, "ppt/slides/_rels/slide1.xml.rels", mutate_slide_rels)

    def mutate_types(root):
        for node in root.findall(CT + "Override"):
            name = node.get("PartName", "").lstrip("/")
            if name in mapping:
                node.set("PartName", "/" + mapping[name])
    xml_patch(pkg, "[Content_Types].xml", mutate_types)


def repoint_package(pkg, chart_part, new_target, media_type=None):
    pkg.set(new_target, pkg.data[new_target])  # ensure part exists
    rels_name = chart.rels_path(chart_part)
    def mutate(root):
        for rel in root.findall(RELS + "Relationship"):
            if rel.get("Type") == PACKAGE_REL:
                rel.set("Target", posixpath.relpath(new_target,
                                                    posixpath.dirname(chart_part)))
    xml_patch(pkg, rels_name, mutate)
    if media_type is None:
        return

    def mutate_types(root):
        for node in root.findall(CT + "Override"):
            if node.get("PartName", "").lstrip("/") == new_target:
                node.set("ContentType", media_type)
    xml_patch(pkg, "[Content_Types].xml", mutate_types)


def set_relationship_mode(pkg, rels_part, type_suffix, mode):
    """Mark every relationship of a type as External (or Internal)."""
    def mutate(root):
        touched = 0
        for rel in root.findall(RELS + "Relationship"):
            if rel.get("Type", "").endswith(type_suffix):
                if mode == "Internal":
                    rel.attrib.pop("TargetMode", None)
                else:
                    rel.set("TargetMode", mode)
                touched += 1
        if not touched:
            raise AssertionError("no %s relationship in %s" % (type_suffix, rels_part))
    xml_patch(pkg, rels_part, mutate)


def workbook_with_values(source_pkg, source_part, replacements):
    """A copy of an embedded workbook whose cells carry different values."""
    inner = Package(payload=source_pkg.data[source_part])
    for ref, value in replacements.items():
        def mutate(root, ref=ref, value=value):
            for cell in root.iter(SML + "c"):
                if cell.get("r") != ref:
                    continue
                cell.attrib.pop("t", None)
                node = cell.find(SML + "v")
                if node is None:
                    node = ET.SubElement(cell, SML + "v")
                node.text = str(value)
        xml_patch(inner, "xl/worksheets/sheet1.xml", mutate)
    return inner.to_bytes()


# ---------------------------------------------------------------- harness

RESULTS = []


def record(name, expected, actual, detail=""):
    ok = expected == actual
    RESULTS.append({"control": name, "expected": expected, "actual": actual,
                    "pass": ok, "detail": detail})
    print("%s %-58s expected=%-11s actual=%-11s %s"
          % ("PASS" if ok else "FAIL", name, expected, actual, detail))
    return ok


def outcome(result):
    return result["outcome"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus")
    parser.add_argument("--scratch")
    parser.add_argument("--saved-dir",
                        help="retained pre-fix saved artifacts, for the sensitivity control")
    args = parser.parse_args()
    corpus = args.corpus or os.environ.get("OFFICE241_CORPUS")
    if not corpus or not os.path.isdir(corpus):
        print("SKIPPED: --corpus (or OFFICE241_CORPUS) must name the retained "
              "corpus inputs directory; no control is claimed without it")
        return 2
    scratch = args.scratch or tempfile.mkdtemp(prefix="office241-controls-")
    os.makedirs(scratch, exist_ok=True)
    slide = "ppt/slides/slide1.xml"

    p3 = os.path.join(corpus, "pptx-03.pptx")
    p4 = os.path.join(corpus, "pptx-04.pptx")
    x2 = os.path.join(corpus, "xlsx-02.xlsx")
    for required in (p3, p4, x2):
        if not os.path.isfile(required):
            print("SKIPPED: missing retained corpus file %s" % required)
            return 2

    def saved(name, package):
        path = os.path.join(scratch, name + ".pptx")
        package.save(path)
        return path

    def run_chart(original, saved_path, expectations=None):
        with zipfile.ZipFile(original) as left, zipfile.ZipFile(saved_path) as right:
            return chart.check(left, right, expectations)

    # 1. identity control
    record("chart identity control pptx-03", "PASS", outcome(run_chart(p3, p3)))
    record("chart identity control pptx-04", "PASS", outcome(run_chart(p4, p4)))

    # 2. disconnected slide r:id is not a displayed chart
    pkg = Package(p4)
    disconnect_slide_chart(pkg)
    record("disconnected slide c:chart r:id", "DIFFERENCE",
           outcome(run_chart(p4, saved("disconnected", pkg))))

    # 3. removed series formulas
    pkg = Package(p4)
    remove_chart_formulas(pkg, "ppt/charts/chart2.xml")
    record("removed series formulas", "DIFFERENCE",
           outcome(run_chart(p4, saved("no-formulas", pkg))))

    # 4. formulas pointing at a sheet that is not in the workbook
    pkg = Package(p4)
    foreign_chart_formulas(pkg, "ppt/charts/chart2.xml")
    record("nonexistent workbook range", "DIFFERENCE",
           outcome(run_chart(p4, saved("foreign-range", pkg))))

    # 5. reordered relationship table keeps the same semantic mapping
    pkg = Package(p4)
    reorder_relationship_table(pkg, "ppt/slides/_rels/slide1.xml.rels")
    reorder_relationship_table(pkg, "ppt/charts/_rels/chart2.xml.rels")
    record("reordered relationship table", "PASS",
           outcome(run_chart(p4, saved("reordered-rels", pkg))))

    # 6. orphan relationship record that no slide displays
    pkg = Package(p4)
    def add_orphan(root):
        orphan = ET.SubElement(root, RELS + "Relationship")
        orphan.set("Id", "rId99")
        orphan.set("Type", CHART_REL)
        orphan.set("Target", "/ppt/charts/chart3.xml")
    xml_patch(pkg, "ppt/slides/_rels/slide1.xml.rels", add_orphan)
    record("orphan chart relationship record", "PASS",
           outcome(run_chart(p4, saved("orphan-rel", pkg))))

    # 7. chart part renumbering must not change the mapping
    pkg = Package(p4)
    renumber_chart_parts(pkg, {"ppt/charts/chart2.xml": "ppt/charts/chart9.xml",
                               "ppt/charts/chart3.xml": "ppt/charts/chart10.xml"})
    record("renumbered chart parts", "PASS",
           outcome(run_chart(p4, saved("renumbered", pkg))))

    # 8. wrong chart-to-workbook association (chart 0 -> a workbook with other data)
    pkg = Package(p4)
    pkg.set("ppt/embeddings/Microsoft_Excel_Worksheet9.xlsx",
            workbook_with_values(pkg, "ppt/embeddings/Microsoft_Excel_Worksheet2.xlsx",
                                 {"B2": 90, "B3": 80, "B4": 70}))
    repoint_package(pkg, "ppt/charts/chart2.xml",
                    "ppt/embeddings/Microsoft_Excel_Worksheet9.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    record("wrong chart-to-workbook association", "DIFFERENCE",
           outcome(run_chart(p4, saved("wrong-association", pkg))))

    # 8b. an external workbook edge is not an embedded part of this package
    pkg = Package(p4)
    set_relationship_mode(pkg, "ppt/charts/_rels/chart2.xml.rels", "/package", "External")
    record("external workbook relationship edge", "DIFFERENCE",
           outcome(run_chart(p4, saved("external-workbook", pkg))))

    # 8c. an external slide -> chart edge is not a chart in this package
    pkg = Package(p4)
    set_relationship_mode(pkg, "ppt/slides/_rels/slide1.xml.rels", "/chart", "External")
    record("external chart relationship edge", "DIFFERENCE",
           outcome(run_chart(p4, saved("external-chart", pkg))))

    # 9. intended single-chart edit, workbook and cache coherent
    def edited(pkg, slot_map):
        """slot_map: chart part -> (cache index value, workbook B2 value)."""
        for chart_part, (cache_value, cell_value) in slot_map.items():
            set_workbook_cell(pkg, "ppt/embeddings/"
                              + ("Microsoft_Excel_Worksheet2.xlsx"
                                 if chart_part.endswith("chart2.xml")
                                 else "Microsoft_Excel_Worksheet3.xlsx"),
                              "xl/worksheets/sheet1.xml", "B2", cell_value)
            set_chart_role_cache(pkg, chart_part, "val", 0, cache_value)

    pkg = Package(p3)
    set_workbook_cell(pkg, "ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx",
                      "xl/worksheets/sheet1.xml", "B2", 9)
    set_chart_role_cache(pkg, "ppt/charts/chart1.xml", "val", 0, 9)
    single = saved("single-edit", pkg)
    record("intended single-chart edit (coherent)", "PASS",
           outcome(run_chart(p3, single, {(slide, 0): {("Sheet1", "B2"): "9"}})))
    record("coherent edit without the bound expectation", "DIFFERENCE",
           outcome(run_chart(p3, single)))

    # 10. stale cache after the same edit
    pkg = Package(p3)
    set_workbook_cell(pkg, "ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx",
                      "xl/worksheets/sheet1.xml", "B2", 9)
    record("stale cache after workbook edit", "DIFFERENCE",
           outcome(run_chart(p3, saved("stale-cache", pkg),
                             {(slide, 0): {("Sheet1", "B2"): "9"}})))

    # 11. cache changed without the workbook
    pkg = Package(p3)
    set_chart_role_cache(pkg, "ppt/charts/chart1.xml", "val", 0, 9)
    record("cache changed without workbook", "DIFFERENCE",
           outcome(run_chart(p3, saved("cache-only", pkg),
                             {(slide, 0): {("Sheet1", "B2"): "9"}})))

    # 12. pptx-04 two charts, distinct edits 9 and 11
    pkg = Package(p4)
    edited(pkg, {"ppt/charts/chart2.xml": (9, 9),
                 "ppt/charts/chart3.xml": (11, 11)})
    both = {(slide, 0): {("Sheet1", "B2"): "9"},
            (slide, 1): {("Sheet1", "B2"): "11"}}
    record("pptx-04 distinct per-chart edits 9/11", "PASS",
           outcome(run_chart(p4, saved("both-edits", pkg), both)))
    record("pptx-04 one edit applied, two expected", "DIFFERENCE",
           outcome(run_chart(p4, saved("both-edits", pkg), {(slide, 0): {("Sheet1", "B2"): "9"}})))

    # 13. wrong slot binding for the same workbook edit
    record("edit bound to the wrong slot", "DIFFERENCE",
           outcome(run_chart(p4, saved("both-edits", pkg),
                             {(slide, 0): {("Sheet1", "B2"): "11"}})))

    # 14. other chart cache disturbed while only one chart is edited
    pkg = Package(p4)
    edited(pkg, {"ppt/charts/chart2.xml": (9, 9)})
    set_chart_role_cache(pkg, "ppt/charts/chart3.xml", "val", 0, 55)
    record("unedited chart cache disturbed", "DIFFERENCE",
           outcome(run_chart(p4, saved("other-chart-cache", pkg),
                             {(slide, 0): {("Sheet1", "B2"): "9"}})))

    # 15. retained pre-fix behavior stays rejected
    prefix_03 = os.path.join(args.saved_dir, "pptx-03.pptx") if args.saved_dir else ""
    if prefix_03 and os.path.isfile(prefix_03):
        record("retained pre-fix save pptx-03", "DIFFERENCE",
               outcome(run_chart(p3, prefix_03)))
    else:
        print("NOT RUN retained pre-fix save pptx-03: pass --saved-dir")

    # ------------------------------------------------------------ currency
    def currency_mutation(name, mutate_numfmt, value=None, formula=None):
        target = os.path.join(scratch, name + ".xlsx")
        with zipfile.ZipFile(x2) as original, zipfile.ZipFile(target, "w") as out:
            for info in original.infolist():
                payload = original.read(info.filename)
                if info.filename == "xl/styles.xml":
                    root = ET.fromstring(payload)
                    mutate_numfmt(root)
                    payload = ET.tostring(root, encoding="utf-8", xml_declaration=True)
                if info.filename == "xl/worksheets/sheet1.xml" and (value or formula):
                    root = ET.fromstring(payload)
                    for cell in root.iter(SML + "c"):
                        if cell.get("r") != "B5":
                            continue
                        if value is not None:
                            cell.attrib.pop("t", None)
                            node = cell.find(SML + "v")
                            if node is None:
                                node = ET.SubElement(cell, SML + "v")
                            node.text = value
                        if formula is not None:
                            node = cell.find(SML + "f")
                            if node is None:
                                node = ET.SubElement(cell, SML + "f")
                            node.text = formula
                    payload = ET.tostring(root, encoding="utf-8", xml_declaration=True)
                out.writestr(info, payload)
        return target

    def set_code(old, new):
        def mutate(root):
            touched = 0
            for fmt in root.iter(SML + "numFmt"):
                if fmt.get("formatCode") == old:
                    fmt.set("formatCode", new)
                    touched += 1
            if touched != 1:
                raise AssertionError("expected exactly one %r format code" % old)
        return mutate

    left = currency.compare(x2, x2, {"B5"})
    record("currency identical codes", "PASS", left["outcome"])
    record("currency identical strict raw formats", True, left["strictRawFormatEqual"])

    escaped = currency.compare(x2, currency_mutation("escaped", set_code(
        "$#,##0.00", "\\$#,##0.00")), {"B5"})
    record("escaped-dollar equivalence", "PASS", escaped["outcome"])
    record("escaped-dollar keeps strict difference", False, escaped["strictRawFormatEqual"])

    for name, mutation in [
        ("material fill directive", set_code("$#,##0.00", "$#,##0.00*x")),
        ("material symbol change", set_code("$#,##0.00", "€#,##0.00")),
        ("material precision change", set_code("$#,##0.00", "$#,##0.0")),
        ("material grouping removal", set_code("$#,##0.00", "$0.00")),
        ("material sign section change", set_code("$#,##0.00", "$#,##0.00;($#,##0.00)")),
        ("material bracket currency", set_code("$#,##0.00", "[$€-407]#,##0.00")),
        ("unsupported escaped control char", set_code("$#,##0.00", "\\$#,##0.00\\#")),
        ("wholly quoted currency literal", set_code("$#,##0.00", '"$#,##0.00"')),
    ]:
        record(name, "DIFFERENCE",
               currency.compare(x2, currency_mutation(name.replace(" ", "-"), mutation),
                                {"B5"})["outcome"])

    quoted_currency = currency.compare(
        x2, currency_mutation("quoted-currency", set_code('$#,##0.00', '"$"#,##0.00')), {"B5"})
    record("quoted single currency sign is equivalent", "PASS", quoted_currency["outcome"])
    record("quoted single sign keeps strict difference", False,
           quoted_currency["strictRawFormatEqual"])

    escaped_date = currency.compare(
        x2, currency_mutation("escaped-date-token", set_code("yyyy-mm-dd", "yyyy\\m\\m-dd")),
        {"B7"})
    record("escaped date token is not equivalent", "DIFFERENCE", escaped_date["outcome"])

    record("material value change", "DIFFERENCE",
           currency.compare(x2, currency_mutation("value", set_code(
               "$#,##0.00", "\\$#,##0.00"), value="1234.5"), {"B5"})["outcome"])
    record("material formula change", "DIFFERENCE",
           currency.compare(x2, currency_mutation("formula", set_code(
               "$#,##0.00", "\\$#,##0.00"), formula="B4*2"), {"B5"})["outcome"])

    failed = [result for result in RESULTS if not result["pass"]]
    print("\n%d controls, %d failed" % (len(RESULTS), len(failed)))
    if failed:
        for result in failed:
            print("  FAILED: %s (expected %s, got %s)"
                  % (result["control"], result["expected"], result["actual"]))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
