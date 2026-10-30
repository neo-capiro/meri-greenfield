#!/usr/bin/env python3
"""PPTX embedded chart-workbook fidelity check (SCRIUM-241 / cool#16243).

Resolves the real package graph for every chart on every slide:

    ppt/slides/slideN.xml
      --ppt/slides/_rels/slideN.xml.rels--> chart part
        --ppt/charts/_rels/chartN.xml.rels--> package target (embedded .xlsx)
          --> cells, formulas and shared strings read out of that workbook

Chart parts are matched across the original and the saved package by
(slide part, document order of the chart relationships), never by chart file
name and never by cached values: saving renumbers the chart parts and keeps
identical caches, so neither name nor cache identifies a chart's data.

The check fails on the retained pre-fix saves because the chart loses its
externalData element, its package relationship and its workbook part, and
because the exported series formulas degrade to LibreOffice-internal names
("label 0", "categories", "0") while the cached values stay identical.

Pure standard library. Reads packages read-only; writes only the requested
JSON report.
"""
import argparse
import hashlib
import io
import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

RELS = "{http://schemas.openxmlformats.org/package/2006/relationships}"
CT = "{http://schemas.openxmlformats.org/package/2006/content-types}"
CHART = "{http://schemas.openxmlformats.org/drawingml/2006/chart}"
SML = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

PACKAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/package"
CHART_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart"
WORKBOOK_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

CHART_KINDS = {
    "barChart", "lineChart", "pieChart", "areaChart", "scatterChart",
    "doughnutChart", "radarChart", "bubbleChart", "surfaceChart",
    "stockChart", "ofPieChart", "bar3DChart", "pie3DChart", "line3DChart",
    "area3DChart", "surface3DChart", "hierarchColorChart",
}


def sha256(payload):
    return hashlib.sha256(payload).hexdigest()


def rels_path(part):
    head, name = posixpath.split(part)
    return posixpath.join(head, "_rels", name + ".rels")


def resolve_target(source_part, target):
    """Resolve an OPC relationship target to a package part name."""
    if target.startswith("/"):
        return posixpath.normpath(target[1:])
    return posixpath.normpath(posixpath.join(posixpath.dirname(source_part), target))


def read_rels(zf, part):
    path = rels_path(part)
    if path not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(path))
    return [
        {"id": rel.get("Id"), "type": rel.get("Type"), "target": rel.get("Target"),
         "mode": rel.get("TargetMode")}
        for rel in root.findall(RELS + "Relationship")
    ]


def read_content_types(zf):
    overrides, defaults = {}, {}
    if "[Content_Types].xml" in zf.namelist():
        root = ET.fromstring(zf.read("[Content_Types].xml"))
        for node in root.findall(CT + "Override"):
            overrides[node.get("PartName", "").lstrip("/")] = node.get("ContentType")
        for node in root.findall(CT + "Default"):
            defaults[node.get("Extension", "").lower()] = node.get("ContentType")
    return overrides, defaults


def slide_number(part):
    match = re.search(r"(\d+)\.xml$", part)
    return int(match.group(1)) if match else 0


def slide_parts(zf):
    found = [n for n in zf.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
    return sorted(found, key=slide_number)


def chart_kind(root):
    for node in root.iter():
        local = node.tag.split("}")[-1]
        if local in CHART_KINDS:
            return local
    return None


def series_formulas(root):
    series = []
    for ser in root.iter(CHART + "ser"):
        formulas = [(node.text or "").strip() for node in ser.iter(CHART + "f")]
        cached = [(node.text or "").strip() for node in ser.iter(CHART + "v")]
        series.append({"formulas": formulas, "cached": cached})
    return series


SHEET_QUALIFIED = re.compile(r"^(?:'[^']+'|[^!]+)!")


def formula_is_range(value):
    """A series formula must name a sheet range, not an internal model name."""
    if not value or "!" not in value:
        return False
    return bool(SHEET_QUALIFIED.match(value)) and bool(
        re.search(r"\$?[A-Z]{1,3}\$?\d+", value)
    )


def read_workbook(zf, part):
    """Cells and formulas of every sheet in an embedded workbook package."""
    inner = zipfile.ZipFile(io.BytesIO(zf.read(part)))
    names = inner.namelist()
    shared = []
    if "xl/sharedStrings.xml" in names:
        for si in ET.fromstring(inner.read("xl/sharedStrings.xml")).findall(SML + "si"):
            shared.append("".join(node.text or "" for node in si.iter(SML + "t")))
    sheet_paths = {}
    if "xl/workbook.xml" in names:
        wb = ET.fromstring(inner.read("xl/workbook.xml"))
        rels = {rel["id"]: rel for rel in read_rels_inner(inner, "xl/workbook.xml")}
        for sheet in wb.iter(SML + "sheet"):
            rid = sheet.get(R + "id")
            target = rels.get(rid, {}).get("target")
            if target:
                sheet_paths[sheet.get("name")] = posixpath.normpath(
                    posixpath.join("xl", target)
                )
    sheets = {}
    for name, path in sheet_paths.items():
        if path not in names:
            continue
        root = ET.fromstring(inner.read(path))
        cells = {}
        for cell in root.iter(SML + "c"):
            ref = cell.get("r")
            kind = cell.get("t")
            value_node = cell.find(SML + "v")
            formula_node = cell.find(SML + "f")
            raw = value_node.text if value_node is not None else None
            if kind == "s" and raw is not None:
                value = shared[int(raw)] if int(raw) < len(shared) else None
            elif kind == "inlineStr":
                value = "".join(n.text or "" for n in cell.iter(SML + "t"))
            else:
                value = raw
            entry = {"value": value, "type": kind}
            if formula_node is not None:
                entry["formula"] = formula_node.text or ""
                entry["formulaShared"] = formula_node.get("t")
            cells[ref] = entry
        sheets[name] = cells
    return {"sheets": sheets, "sha256": sha256(zf.read(part))}


def read_rels_inner(zf, part):
    path = rels_path(part)
    if path not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(path))
    return [
        {"id": rel.get("Id"), "type": rel.get("Type"), "target": rel.get("Target")}
        for rel in root.findall(RELS + "Relationship")
    ]


def chart_records(zf):
    """Every chart, resolved slide -> chart -> relationship -> workbook part."""
    overrides, defaults = read_content_types(zf)
    records = []
    for slide in slide_parts(zf):
        charts = [rel for rel in read_rels(zf, slide) if rel["type"] == CHART_REL]
        for ordinal, rel in enumerate(charts):
            chart_part = resolve_target(slide, rel["target"])
            record = {
                "slide": slide,
                "ordinal": ordinal,
                "chartPart": chart_part,
                "chartRelId": rel["id"],
                "chartPresent": chart_part in zf.namelist(),
            }
            if not record["chartPresent"]:
                records.append(record)
                continue
            root = ET.fromstring(zf.read(chart_part))
            record["kind"] = chart_kind(root)
            record["series"] = series_formulas(root)
            external = None
            for node in root.iter(CHART + "externalData"):
                external = node.get(R + "id")
                break
            record["externalDataRId"] = external
            if external:
                chart_rels = {r["id"]: r for r in read_rels(zf, chart_part)}
                package_rel = chart_rels.get(external)
                if package_rel:
                    record["relationshipType"] = package_rel["type"]
                    workbook_part = resolve_target(chart_part, package_rel["target"])
                    record["workbookPart"] = workbook_part
                    record["workbookPresent"] = workbook_part in zf.namelist()
                    ext = posixpath.splitext(workbook_part)[1].lstrip(".").lower()
                    record["workbookContentType"] = overrides.get(
                        workbook_part, defaults.get(ext)
                    )
                    if record["workbookPresent"]:
                        record["workbook"] = read_workbook(zf, workbook_part)
            records.append(record)
    return records


def index(records):
    return {(r["slide"], r["ordinal"]): r for r in records}


def check(original_pkg, saved_pkg, expected_edits):
    original = index(chart_records(original_pkg))
    saved = index(chart_records(saved_pkg))
    results, differences = [], []

    if not original:
        differences.append("original package exposes no slide chart relationships")
    if set(original) != set(saved):
        differences.append(
            "chart slots differ: original=%s saved=%s"
            % (sorted(original), sorted(saved))
        )

    for key in sorted(original):
        orig, savec = original[key], saved.get(key, {})
        checks = {}
        checks["chartResolved"] = bool(savec.get("chartPresent"))
        checks["chartKindPreserved"] = savec.get("kind") == orig.get("kind")
        checks["externalDataPresent"] = bool(savec.get("externalDataRId"))
        checks["relationshipTypePackage"] = savec.get("relationshipType") == PACKAGE_REL
        checks["workbookPartPresent"] = bool(savec.get("workbookPresent"))
        checks["workbookContentType"] = savec.get("workbookContentType") == WORKBOOK_CT

        saved_series = savec.get("series")
        if saved_series is None:
            checks["seriesFormulasAreRanges"] = False
            checks["seriesCachedValuesPreserved"] = False
        else:
            formulas_ok = bool(saved_series) and all(
                formula_is_range(f)
                for ser in saved_series
                for f in ser["formulas"]
            )
            checks["seriesFormulasAreRanges"] = formulas_ok
            checks["seriesCachedValuesPreserved"] = [
                ser["cached"] for ser in saved_series
            ] == [ser["cached"] for ser in orig["series"]]
            checks["seriesCountPreserved"] = len(saved_series) == len(orig["series"])

        orig_sheets = orig.get("workbook", {}).get("sheets", {})
        saved_sheets = savec.get("workbook", {}).get("sheets", {})
        edits = dict(expected_edits)
        data_ok = saved_sheets == orig_sheets
        edit_findings = {}
        if expected_edits:
            data_ok = True
            for ref, (value, sheet) in edits.items():
                original_cell = orig_sheets.get(sheet, {}).get(ref)
                saved_cell = saved_sheets.get(sheet, {}).get(ref)
                if original_cell is None or saved_cell is None:
                    data_ok = False
                    edit_findings[ref] = "cell missing"
                    continue
                expected_cell = dict(original_cell)
                expected_cell["value"] = value
                if saved_cell.get("formula") != expected_cell.get("formula"):
                    data_ok = False
                    edit_findings[ref] = "formula changed unexpectedly"
                if saved_cell.get("value") != value:
                    data_ok = False
                    edit_findings[ref] = "value is %r, expected %r" % (
                        saved_cell.get("value"), value)
            # every other cell must still match the original exactly
            reduced = {name: dict(cells) for name, cells in saved_sheets.items()}
            for ref, (value, sheet) in edits.items():
                if ref in reduced.get(sheet, {}):
                    original_cell = orig_sheets[sheet][ref]
                    restored = dict(original_cell)
                    reduced[sheet][ref] = restored
            data_ok = data_ok and reduced == orig_sheets
        checks["workbookDataAndFormulasPreserved"] = data_ok
        if edit_findings:
            checks["intentionalEdit"] = edit_findings

        failed = sorted(name for name, ok in checks.items()
                        if name not in ("intentionalEdit",) and ok is not True)
        results.append({
            "slide": key[0],
            "ordinal": key[1],
            "original": {
                "chartPart": orig.get("chartPart"),
                "kind": orig.get("kind"),
                "workbookPart": orig.get("workbookPart"),
                "workbookSha256": orig.get("workbook", {}).get("sha256"),
            },
            "saved": {
                "chartPart": savec.get("chartPart"),
                "kind": savec.get("kind"),
                "externalDataRId": savec.get("externalDataRId"),
                "relationshipType": savec.get("relationshipType"),
                "workbookPart": savec.get("workbookPart"),
                "workbookSha256": savec.get("workbook", {}).get("sha256"),
                "seriesFormulas": [s["formulas"] for s in (saved_series or [])],
            },
            "checks": checks,
            "outcome": "PASS" if not failed else "DIFFERENCE",
            "failedChecks": failed,
        })
        for name in failed:
            differences.append("%s#%d %s" % (key[0], key[1], name))

    outcome = "PASS" if results and not differences and all(
        r["outcome"] == "PASS" for r in results) else "DIFFERENCE"
    return {"outcome": outcome, "charts": results, "differences": differences}


def parse_edits(values):
    edits = {}
    for item in values or []:
        ref, _, rest = item.partition("=")
        sheet, _, cell = ref.rpartition("!")
        edits[cell or ref] = (rest, sheet or "Sheet1")
    return edits


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--original", required=True)
    parser.add_argument("--saved", required=True)
    parser.add_argument("--expect-edit", action="append", default=[],
                        help="Sheet1!B2=99 for an intentional chart-data edit")
    parser.add_argument("--json")
    args = parser.parse_args()

    with zipfile.ZipFile(args.original) as original, zipfile.ZipFile(args.saved) as saved:
        report = check(original, saved, parse_edits(args.expect_edit))
        report["original"] = {
            "path": args.original,
            "sha256": sha256(open(args.original, "rb").read()),
        }
        report["saved"] = {
            "path": args.saved,
            "sha256": sha256(open(args.saved, "rb").read()),
        }
    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
            handle.write("\n")
    for chart in report["charts"]:
        print(json.dumps({
            "slide": chart["slide"],
            "ordinal": chart["ordinal"],
            "outcome": chart["outcome"],
            "workbookPart": chart["original"]["workbookPart"],
            "savedWorkbookPart": chart["saved"]["workbookPart"],
            "failedChecks": chart["failedChecks"],
        }))
    print("OUTCOME", report["outcome"])
    return 0 if report["outcome"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
