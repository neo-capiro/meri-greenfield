#!/usr/bin/env python3
"""PPTX embedded chart-workbook fidelity check (SCRUM-241 / cool#16243).

Chart identity starts at the document: every ``c:chart`` node in each slide's
shape tree, in slide document order, resolved through that slide's relationship
table by its ``r:id``.  A relationship record that no slide references is not a
displayed chart, and the order of records inside the relationship part is not
chart identity.  The slot identity is (slide part, ordinal of the ``c:chart``
node), so chart part renumbering on save (chart2/chart3 -> chart1/chart2) and
relationship reordering cannot change the semantic mapping.

Each slot resolves chart part -> ``c:externalData`` r:id -> chart relationship
-> package target -> embedded workbook, and the following are validated against
real data rather than counts or caches:

* every series role (name, category, value) that referenced a sheet range still
  does, with a non-empty formula;
* that range resolves to a sheet and cells that exist in the connected
  workbook;
* the chart's cached points equal the values those cells actually hold, so a
  stale cache and a wrong chart-to-workbook association both fail;
* without an expected edit, workbook cells and formulas, series ranges and
  caches all equal the original;
* with an expected edit bound to a slot, sheet and cell, the edited cell holds
  the expected value, the chart cache reflects it, and every other cell and
  every other chart stay unchanged.

Pure standard library. Reads packages read-only; writes only the requested JSON
report.
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
C = "{http://schemas.openxmlformats.org/drawingml/2006/chart}"
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
ROLE_ORDER = ("name", "cat", "val")
ROLE_TAGS = {"name": ("tx",), "cat": ("cat", "xVal"), "val": ("val", "yVal", "bubbleSize")}
REF_TAGS = ("strRef", "numRef", "multiLvlStrRef")
CACHE_TAGS = ("strCache", "numCache", "multiLvlStrCache")
CELL = re.compile(r"^\$?([A-Z]{1,3})\$?(\d+)$")
RANGE = re.compile(r"^(?P<sheet>'(?:[^']|'')+'|[^!]+)!"
                   r"(?P<start>\$?[A-Z]{1,3}\$?\d+)"
                   r"(?::(?P<end>\$?[A-Z]{1,3}\$?\d+))?$")


def sha256(payload):
    return hashlib.sha256(payload).hexdigest()


def rels_path(part):
    head, name = posixpath.split(part)
    return posixpath.join(head, "_rels", name + ".rels")


def resolve_target(source_part, target):
    if target.startswith("/"):
        return posixpath.normpath(target[1:])
    return posixpath.normpath(posixpath.join(posixpath.dirname(source_part), target))


def read_rels(zf, part):
    path = rels_path(part)
    if path not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(path))
    return [{"id": rel.get("Id"), "type": rel.get("Type"),
             "target": rel.get("Target"), "mode": rel.get("TargetMode")}
            for rel in root.findall(RELS + "Relationship")]


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


def slide_chart_nodes(zf, slide):
    """The c:chart nodes a slide actually displays, in slide document order."""
    root = ET.fromstring(zf.read(slide))
    owners = {}
    for frame in root.iter():
        if frame.tag.split("}")[-1] != "graphicFrame":
            continue
        name = None
        for prop in frame.iter():
            if prop.tag.split("}")[-1] == "cNvPr":
                name = prop.get("name")
                break
        for node in frame.iter(C + "chart"):
            owners[id(node)] = name
    return [{"ordinal": ordinal, "rId": node.get(R + "id"),
             "shapeName": owners.get(id(node))}
            for ordinal, node in enumerate(root.iter(C + "chart"))]


def chart_kind(root):
    plot = root.find(C + "chart/" + C + "plotArea")
    scope = plot if plot is not None else root
    for node in scope:
        local = node.tag.split("}")[-1]
        if local in CHART_KINDS:
            return local
    return None


def parse_cell(ref):
    match = CELL.match(ref.strip())
    if not match:
        return None
    letters, row = match.group(1), int(match.group(2))
    column = 0
    for char in letters:
        column = column * 26 + (ord(char) - ord("A") + 1)
    return column, row


def column_name(index):
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(ord("A") + remainder) + name
    return name


def expand_range(start, end):
    first, last = parse_cell(start), parse_cell(end or start)
    if not first or not last:
        return None
    (c1, r1), (c2, r2) = sorted((first, last))
    return ["%s%d" % (column_name(column), row)
            for row in range(r1, r2 + 1)
            for column in range(c1, c2 + 1)]


def parse_range(formula):
    """'Sheet1!$B$2:$B$4' -> resolved sheet, refs and normalised range."""
    if not formula:
        return None
    match = RANGE.match(formula.strip())
    if not match:
        return None
    sheet = match.group("sheet")
    if sheet.startswith("'") and sheet.endswith("'"):
        sheet = sheet[1:-1].replace("''", "'")
    refs = expand_range(match.group("start"), match.group("end"))
    if not refs:
        return None
    end = match.group("end")
    return {"sheet": sheet, "refs": refs,
            "range": "%s!%s%s" % (sheet, match.group("start"), (":" + end) if end else "")}


def inner_rels(zf, part):
    path = rels_path(part)
    if path not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(path))
    return [{"id": rel.get("Id"), "type": rel.get("Type"), "target": rel.get("Target")}
            for rel in root.findall(RELS + "Relationship")]


def read_workbook(zf, part):
    """Cells and formulas of every sheet in an embedded workbook package."""
    inner = zipfile.ZipFile(io.BytesIO(zf.read(part)))
    names = inner.namelist()
    shared = []
    if "xl/sharedStrings.xml" in names:
        for si in ET.fromstring(inner.read("xl/sharedStrings.xml")).findall(SML + "si"):
            shared.append("".join(node.text or "" for node in si.iter(SML + "t")))
    sheets = {}
    if "xl/workbook.xml" in names:
        workbook = ET.fromstring(inner.read("xl/workbook.xml"))
        rels = {rel["id"]: rel for rel in inner_rels(inner, "xl/workbook.xml")}
        for sheet in workbook.iter(SML + "sheet"):
            target = rels.get(sheet.get(R + "id"), {}).get("target")
            if not target:
                continue
            path = posixpath.normpath(posixpath.join("xl", target))
            if path not in names:
                continue
            cells = {}
            for cell in ET.fromstring(inner.read(path)).iter(SML + "c"):
                ref = cell.get("r")
                kind = cell.get("t")
                value_node = cell.find(SML + "v")
                formula_node = cell.find(SML + "f")
                raw = value_node.text if value_node is not None else None
                if kind == "s" and raw is not None:
                    index = int(raw)
                    value = shared[index] if index < len(shared) else raw
                elif kind == "inlineStr":
                    value = "".join(n.text or "" for n in cell.iter(SML + "t"))
                else:
                    value = raw
                entry = {"value": value, "type": kind}
                if formula_node is not None:
                    entry["formula"] = formula_node.text or ""
                cells[ref] = entry
            sheets[sheet.get("name")] = cells
    return {"sheets": sheets, "sha256": sha256(zf.read(part))}


def cache_values(node):
    """Cached points of a reference, including multi-level (hierarchical) caches."""
    for cache_tag in CACHE_TAGS:
        cache = node.find(C + cache_tag)
        if cache is not None:
            points = {}
            for point in cache.iter(C + "pt"):
                index = int(point.get("idx", "0"))
                points.setdefault(index, "".join(
                    child.text or "" for child in point.iter(C + "v")))
            return [points[index] for index in sorted(points)]
    return []


def series_roles(ser):
    roles = {}
    for role in ROLE_ORDER:
        node = None
        for tag in ROLE_TAGS[role]:
            found = ser.find(C + tag)
            if found is not None:
                node = found
                break
        if node is None:
            continue
        reference = None
        for tag in REF_TAGS:
            reference = node.find(C + tag)
            if reference is not None:
                formula = reference.find(C + "f")
                roles[role] = {
                    "formula": (formula.text or "").strip() if formula is not None else None,
                    "cache": cache_values(reference), "source": tag}
                break
        if reference is not None:
            continue
        for tag in ("strLit", "numLit"):
            if node.find(C + tag) is not None:
                roles[role] = {"formula": None, "cache": cache_values(node),
                               "source": "literal"}
                break
    return roles


def chart_series(root):
    plot = root.find(C + "chart/" + C + "plotArea")
    if plot is None:
        return []
    series = []
    for kind in plot:
        if kind.tag.split("}")[-1] not in CHART_KINDS:
            continue
        for ser in kind.findall(C + "ser"):
            series.append(series_roles(ser))
    return series


def resolve_slot(zf, slide, node, content_types):
    """One displayed c:chart node -> chart part -> relationship -> workbook."""
    record = {"slide": slide, "ordinal": node["ordinal"], "shapeName": node["shapeName"],
              "rId": node["rId"]}
    if not node["rId"]:
        record["failure"] = "chartNodeHasNoRelationshipId"
        return record
    rel = {r["id"]: r for r in read_rels(zf, slide)}.get(node["rId"])
    if rel is None:
        record["failure"] = "chartRelationshipMissing"
        return record
    if rel["type"] != CHART_REL:
        record["failure"] = "chartRelationshipWrongType"
        return record
    chart_part = resolve_target(slide, rel["target"])
    record["chartPart"] = chart_part
    if chart_part not in zf.namelist():
        record["failure"] = "chartPartMissing"
        return record
    root = ET.fromstring(zf.read(chart_part))
    record["kind"] = chart_kind(root)
    record["series"] = chart_series(root)
    external = None
    for element in root.iter(C + "externalData"):
        external = element.get(R + "id")
        break
    record["externalDataRId"] = external
    if not external:
        return record
    package = {r["id"]: r for r in read_rels(zf, chart_part)}.get(external)
    if package is None:
        record["failure"] = "externalDataRelationshipMissing"
        return record
    record["relationshipType"] = package["type"]
    workbook_part = resolve_target(chart_part, package["target"])
    record["workbookPart"] = workbook_part
    if workbook_part not in zf.namelist():
        return record
    record["workbook"] = read_workbook(zf, workbook_part)
    overrides, defaults = content_types
    extension = posixpath.splitext(workbook_part)[1].lstrip(".").lower()
    record["workbookContentType"] = overrides.get(workbook_part, defaults.get(extension))
    return record


def chart_records(zf):
    """Displayed charts only: the c:chart nodes the slides actually reference."""
    content_types = read_content_types(zf)
    records = []
    for slide in slide_parts(zf):
        for node in slide_chart_nodes(zf, slide):
            records.append(resolve_slot(zf, slide, node, content_types))
    return records


def normalise(value):
    if value is None:
        return None
    text = str(value).strip()
    try:
        return ("number", float(text))
    except ValueError:
        return ("text", text)


def normalise_range(formula):
    target = parse_range(formula)
    return (target["sheet"], tuple(target["refs"])) if target else None


def role_expectation(record, role):
    """Resolve one series role's formula against the connected workbook."""
    entry = record["series"][role]
    formula = entry.get("formula")
    target = parse_range(formula)
    if not target:
        return {"resolved": False, "reason": "formula is not a sheet range",
                "formula": formula}
    workbook = record.get("workbook")
    if not workbook:
        return {"resolved": False, "reason": "no connected workbook",
                "formula": formula, "range": target["range"]}
    sheet = workbook["sheets"].get(target["sheet"])
    if sheet is None:
        return {"resolved": False, "reason": "sheet %r is not in the workbook"
                % target["sheet"], "formula": formula, "range": target["range"]}
    missing = [ref for ref in target["refs"] if ref not in sheet]
    if missing:
        return {"resolved": False, "reason": "cells missing from workbook: %s"
                % ",".join(missing[:5]), "formula": formula, "range": target["range"]}
    return {"resolved": True, "formula": formula, "range": target["range"],
            "sheet": target["sheet"], "refs": target["refs"],
            "values": [sheet[ref]["value"] for ref in target["refs"]]}


def role_cache_matches(role_entry, expectation):
    if not expectation["resolved"]:
        return False
    cached = [normalise(value) for value in role_entry.get("cache") or []]
    return cached == [normalise(value) for value in expectation["values"]]


def expected_hits_role(role_entry, expected):
    target = parse_range(role_entry.get("formula"))
    if not target:
        return False
    return any(sheet == target["sheet"] and cell in target["refs"]
               for sheet, cell in expected)


def parse_intent(text):
    """'ppt/slides/slide1.xml#1:Sheet1!B2=11' -> slot key and one edit."""
    slot, _, assignment = text.partition(":")
    slide, _, ordinal = slot.partition("#")
    cell, _, value = assignment.partition("=")
    sheet, _, reference = cell.rpartition("!")
    if not slide or not ordinal.isdigit() or not reference:
        raise argparse.ArgumentTypeError(
            "expected '<slide>#<ordinal>:<Sheet>!<Cell>=<value>', got %r" % text)
    return (slide, int(ordinal)), {"sheet": sheet or "Sheet1",
                                   "cell": reference, "value": value}


def build_expectations(intents):
    expectations = {}
    for key, edit in intents:
        expectations.setdefault(key, {})[(edit["sheet"], edit["cell"])] = edit["value"]
    return expectations


def check(original_zf, saved_zf, expectations=None):
    """Compare displayed chart slots.

    ``expectations`` maps (slide, ordinal) to {(sheet, cell): value} for the
    intentional chart-data edits the flow performed.
    """
    expectations = expectations or {}
    original = {(r["slide"], r["ordinal"]): r for r in chart_records(original_zf)}
    saved = {(r["slide"], r["ordinal"]): r for r in chart_records(saved_zf)}
    results, differences = [], []

    if not original:
        differences.append("original package displays no slide chart")
    for key in sorted(set(original) ^ set(saved)):
        differences.append("%s#%d is not displayed by %s" % (
            key[0], key[1],
            "the saved package" if key in original else "the original package"))
    for key in sorted(set(expectations) - set(original)):
        differences.append("%s#%d expected edit targets a chart that does not exist" % key)

    for key in sorted(set(original) & set(saved)):
        orig, savec = original[key], saved[key]
        checks, detail = {}, {}
        checks["chartNodeResolved"] = "failure" not in savec
        detail["failure"] = savec.get("failure")
        checks["shapeNamePreserved"] = savec.get("shapeName") == orig.get("shapeName")
        checks["chartKindPreserved"] = savec.get("kind") == orig.get("kind")
        checks["seriesCountPreserved"] = len(savec.get("series") or []) == \
            len(orig.get("series") or [])
        checks["externalDataPresent"] = bool(savec.get("externalDataRId"))
        checks["relationshipTypePackage"] = savec.get("relationshipType") == PACKAGE_REL
        checks["workbookPartPresent"] = savec.get("workbook") is not None
        checks["workbookContentType"] = savec.get("workbookContentType") == WORKBOOK_CT

        expected = expectations.get(key, {})
        roles_ok = ranges_ok = cache_ok = cache_kept = True
        role_detail = {}
        saved_series = savec.get("series") or []
        if not saved_series:
            roles_ok = ranges_ok = cache_ok = cache_kept = False
        for index, orig_series in enumerate(orig.get("series") or []):
            if index >= len(saved_series):
                roles_ok = ranges_ok = cache_ok = cache_kept = False
                break
            saved_roles = saved_series[index]
            for role in ROLE_ORDER:
                if role not in orig_series:
                    continue
                saved_role = saved_roles.get(role)
                entry = {"formula": (saved_role or {}).get("formula")}
                role_detail["%d.%s" % (index, role)] = entry
                if not saved_role or not saved_role.get("formula"):
                    entry["reason"] = "role missing" if not saved_role else \
                        "formula removed or empty"
                    roles_ok = ranges_ok = cache_ok = cache_kept = False
                    continue
                probe = {"series": {role: saved_role}, "workbook": savec.get("workbook")}
                expectation = role_expectation(probe, role)
                matched = role_cache_matches(saved_role, expectation)
                entry.update({"range": expectation.get("range"),
                              "resolved": expectation.get("resolved"),
                              "cacheMatchesWorkbook": matched,
                              "reason": expectation.get("reason")})
                ranges_ok = ranges_ok and expectation.get("resolved", False)
                cache_ok = cache_ok and matched
                if normalise_range(orig_series[role].get("formula")) != \
                        normalise_range(saved_role.get("formula")):
                    entry["rangeChanged"] = True
                    ranges_ok = False
                if not expected_hits_role(saved_role, expected):
                    kept = saved_role.get("cache") == orig_series[role].get("cache")
                    entry["cachePreserved"] = kept
                    cache_kept = cache_kept and kept
        checks["seriesRolesComplete"] = roles_ok
        checks["rangesResolvedInWorkbook"] = ranges_ok
        checks["cacheMatchesWorkbook"] = cache_ok
        checks["cachePreservedOutsideEdit"] = cache_kept
        detail["roles"] = role_detail

        original_sheets = (orig.get("workbook") or {}).get("sheets", {})
        saved_sheets = (savec.get("workbook") or {}).get("sheets", {})
        reduced = {name: dict(cells) for name, cells in saved_sheets.items()}
        applied, edit_detail = True, {}
        for (sheet, cell), value in expected.items():
            original_cell = original_sheets.get(sheet, {}).get(cell)
            saved_cell = saved_sheets.get(sheet, {}).get(cell)
            if original_cell is None or saved_cell is None:
                applied = False
                edit_detail["%s!%s" % (sheet, cell)] = "cell missing"
                continue
            if normalise(saved_cell.get("value")) != normalise(value):
                applied = False
                edit_detail["%s!%s" % (sheet, cell)] = "value is %r, expected %r" % (
                    saved_cell.get("value"), value)
            if saved_cell.get("formula") != original_cell.get("formula"):
                applied = False
                edit_detail["%s!%s" % (sheet, cell)] = "formula changed"
            if cell in reduced.get(sheet, {}):
                reduced[sheet][cell] = original_cell
        checks["intendedEditApplied"] = applied if expected else "not applicable"
        checks["workbookDataAndFormulasPreserved"] = reduced == original_sheets
        detail["edit"] = edit_detail

        failed = sorted(name for name, value in checks.items()
                        if value not in (True, "not applicable"))
        results.append({
            "slide": key[0], "ordinal": key[1], "shapeName": orig.get("shapeName"),
            "original": {"chartPart": orig.get("chartPart"), "kind": orig.get("kind"),
                         "workbookPart": orig.get("workbookPart"), "rId": orig.get("rId")},
            "saved": {"chartPart": savec.get("chartPart"), "kind": savec.get("kind"),
                      "workbookPart": savec.get("workbookPart"), "rId": savec.get("rId"),
                      "series": [{"roles": [
                          {"role": role,
                           "formula": (series.get(role) or {}).get("formula"),
                           "cache": (series.get(role) or {}).get("cache")}
                          for role in ROLE_ORDER if role in series]}
                          for series in saved_series]},
            "expectedEdits": {"%s!%s" % cell: value for cell, value in expected.items()},
            "checks": checks, "detail": detail,
            "outcome": "PASS" if not failed else "DIFFERENCE",
            "failedChecks": failed,
        })
        for name in failed:
            differences.append("%s#%d %s" % (key[0], key[1], name))

    outcome = "PASS" if results and not differences else "DIFFERENCE"
    return {"outcome": outcome, "charts": results, "differences": differences}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--original", required=True)
    parser.add_argument("--saved", required=True)
    parser.add_argument("--expect-edit", action="append", default=[], type=parse_intent,
                        help="'<slide>#<ordinal>:<Sheet>!<Cell>=<value>'")
    parser.add_argument("--json")
    args = parser.parse_args()

    with zipfile.ZipFile(args.original) as original, zipfile.ZipFile(args.saved) as saved:
        report = check(original, saved, build_expectations(args.expect_edit))
        report["original"] = {"path": args.original,
                              "sha256": sha256(open(args.original, "rb").read())}
        report["saved"] = {"path": args.saved,
                           "sha256": sha256(open(args.saved, "rb").read())}
    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
            handle.write("\n")
    for chart in report["charts"]:
        print(json.dumps({
            "slide": chart["slide"], "ordinal": chart["ordinal"],
            "outcome": chart["outcome"],
            "workbookPart": chart["original"]["workbookPart"],
            "savedWorkbookPart": chart["saved"]["workbookPart"],
            "failedChecks": chart["failedChecks"],
        }))
    print("OUTCOME", report["outcome"])
    return 0 if report["outcome"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
