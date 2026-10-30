#!/usr/bin/env python3
"""Equivalent-number-format check for the currency case (SCRUM-241).

The retained native save of xlsx-02 changes cell B5's format code from
``$#,##0.00`` to ``\\$#,##0.00``.  In Excel/ODF number-format syntax a
backslash escapes the next character, so ``\\$`` and ``$`` are both the literal
currency symbol and render identically.  The value 1234.567 is untouched.

This check keeps the raw strict difference visible and adds a semantic
equivalence proof:

* resolves each cell's effective number format through
  cell ``s`` -> ``cellXfs`` -> ``numFmts`` (with the builtins),
* canonicalises the format (escapes, quoted literals, ``[$SYM-LOC]``,
  colours, percent, grouping, precision) into comparable structure,
* renders the actual cell value through the format for both sides,
* rejects materially changed currency symbol, precision, grouping, sign
  section, literal text, numeric value or formula.

Pure standard library.  ``--self-test`` runs the rejection controls against
in-memory mutations of the real retained codes.
"""
import argparse
import decimal
import hashlib
import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

SML = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
RELS = "{http://schemas.openxmlformats.org/package/2006/relationships}"

BUILTIN = {
    0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00",
    9: "0%", 10: "0.00%", 11: "0.00E+00", 12: "# ?/?", 13: "# ??/??",
    14: "mm-dd-yy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy",
    18: "h:mm AM/PM", 19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss",
    22: "m/d/yy h:mm", 37: "#,##0 ;(#,##0)", 38: "#,##0 ;[Red](#,##0)",
    39: "#,##0.00;(#,##0.00)", 40: "#,##0.00;[Red](#,##0.00)",
    45: "mm:ss", 46: "[h]:mm:ss", 47: "mmss.0", 48: "##0.0E+0", 49: "@",
}
CURRENCY = set("$€£¥₽₹₩₪₫฿₴₦₱R$")
DATE_TOKENS = set("ymdhsYMDHS")
NUM_PLACEHOLDERS = set("0#?")


def sha256(payload):
    return hashlib.sha256(payload).hexdigest()


def rels_path(part):
    head, name = posixpath.split(part)
    return posixpath.join(head, "_rels", name + ".rels")


def read_rels(zf, part):
    path = rels_path(part)
    if path not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(path))
    return [{"id": n.get("Id"), "type": n.get("Type"), "target": n.get("Target")}
            for n in root.findall(RELS + "Relationship")]


def split_sections(code):
    sections, current, quote, bracket = [], [], False, False
    index = 0
    while index < len(code):
        char = code[index]
        if quote:
            current.append(char)
            if char == '"':
                quote = False
        elif bracket:
            current.append(char)
            if char == "]":
                bracket = False
        elif char == '"':
            quote = True
            current.append(char)
        elif char == "[":
            bracket = True
            current.append(char)
        elif char == "\\" and index + 1 < len(code):
            current.append(char)
            current.append(code[index + 1])
            index += 1
        elif char == ";":
            sections.append("".join(current))
            current = []
        else:
            current.append(char)
        index += 1
    sections.append("".join(current))
    return sections


def tokenise(section):
    """Canonical token list: ('lit', text) | ('currency', sym) | ('digit', ch)
    | ('group',) | ('decimal',) | ('percent',) | ('bracket', content) | ('skip', ch)."""
    tokens, index = [], 0
    while index < len(section):
        char = section[index]
        if char == "\\" and index + 1 < len(section):
            escaped = section[index + 1]
            # A backslash only escapes a literal: "\$" and "$" are the same symbol.
            tokens.append(("currency", escaped) if escaped in CURRENCY else ("lit", escaped))
            index += 2
            continue
        if char == '"':
            end = section.find('"', index + 1)
            end = len(section) if end < 0 else end
            text = section[index + 1:end]
            tokens.append(("currency", text) if len(text) == 1 and text in CURRENCY
                          else ("lit", text))
            index = end + 1
            continue
        if char == "[":
            end = section.find("]", index + 1)
            end = len(section) if end < 0 else end
            content = section[index + 1:end]
            if content.startswith("$"):
                # [$SYM-LOCALE] names a currency; keep the symbol only
                tokens.append(("currency", content[1:].split("-")[0]))
            else:
                tokens.append(("bracket", content.lower()))
            index = end + 1
            continue
        if char == "_":
            tokens.append(("skip", section[index + 1:index + 2]))
            index += 2
            continue
        if char == "*":
            index += 2
            continue
        if char in CURRENCY:
            tokens.append(("currency", char))
        elif char in NUM_PLACEHOLDERS:
            tokens.append(("digit", char))
        elif char == ",":
            tokens.append(("group",))
        elif char == ".":
            tokens.append(("decimal",))
        elif char == "%":
            tokens.append(("percent",))
        else:
            tokens.append(("lit", char))
        index += 1
    return tokens


def structure(code):
    """Semantic attributes of a format code."""
    sections = split_sections(code)
    parsed = [tokenise(section) for section in sections]
    primary = parsed[0]
    integer, fraction, seen_decimal, integer_digits = [], [], False, []
    for kind, *rest in primary:
        if kind == "decimal":
            seen_decimal = True
            continue
        if kind == "digit":
            (fraction if seen_decimal else integer).append(rest[0])
        if kind == "group":
            (fraction if seen_decimal else integer).append(",")
    integer_digits = [c for c in integer if c in NUM_PLACEHOLDERS]
    return {
        "sections": len(parsed),
        "tokens": parsed,
        "currencies": sorted({rest[0] for kind, *rest in primary if kind == "currency"}),
        "grouping": "," in integer,
        "minIntegerDigits": integer.count("0"),
        "minDecimals": fraction.count("0"),
        "maxDecimals": len([c for c in fraction if c in NUM_PLACEHOLDERS]),
        "percent": any(kind == "percent" for kind, *_ in primary),
        "general": code.strip().lower() == "general",
        "date": any(
            kind == "lit" and rest and set(rest[0]) & DATE_TOKENS
            for kind, *rest in primary
        ),
    }


def render(code, value):
    """Render a numeric value through the format, or None if unsupported."""
    if value is None:
        return None
    try:
        number = decimal.Decimal(str(value))
    except (decimal.InvalidOperation, ValueError):
        return None
    info = structure(code)
    if info["general"]:
        return "%s" % value
    if info["date"] or info["sections"] > 2:
        return None
    sections = split_sections(code)
    section = sections[0]
    negative = number < 0
    if negative and len(sections) > 1:
        section = sections[1]
    magnitude = abs(number) if len(sections) > 1 else number
    tokens = tokenise(section)
    local = structure(section)
    if local["date"]:
        return None
    if local["percent"]:
        magnitude = magnitude * 100
    digits = local["maxDecimals"]
    quant = decimal.Decimal(1).scaleb(-digits)
    rounded = magnitude.quantize(quant, rounding=decimal.ROUND_HALF_UP)
    text = ("%." + str(digits) + "f") % rounded if digits else "%d" % int(rounded)
    int_part, _, frac_part = text.partition(".")
    if local["grouping"]:
        int_part = "{:,}".format(int(int_part)) if int_part else int_part
    int_part = int_part.rjust(local["minIntegerDigits"], "0")
    rendered = int_part + ("." + frac_part if frac_part else "")

    out, replaced = [], False
    for kind, *rest in tokens:
        if kind in ("digit", "group", "decimal"):
            if not replaced:
                out.append(rendered)
                replaced = True
            continue
        if kind == "currency":
            out.append(rest[0])
        elif kind == "lit":
            out.append(rest[0])
        elif kind == "percent":
            out.append("%")
        elif kind == "skip":
            out.append(" ")
    return "".join(out)


def material_differences(original, saved):
    """Reasons the two format codes are not semantically equivalent."""
    if original == saved:
        return []
    left, right = structure(original), structure(saved)
    reasons = []
    if left["currencies"] != right["currencies"]:
        reasons.append("currency symbol %s -> %s"
                       % (left["currencies"] or None, right["currencies"] or None))
    if left["minDecimals"] != right["minDecimals"] or \
            left["maxDecimals"] != right["maxDecimals"]:
        reasons.append("precision %d/%d -> %d/%d decimals"
                       % (left["minDecimals"], left["maxDecimals"],
                          right["minDecimals"], right["maxDecimals"]))
    if left["grouping"] != right["grouping"]:
        reasons.append("grouping %s -> %s" % (left["grouping"], right["grouping"]))
    if left["minIntegerDigits"] != right["minIntegerDigits"]:
        reasons.append("minimum integer digits %d -> %d"
                       % (left["minIntegerDigits"], right["minIntegerDigits"]))
    if left["percent"] != right["percent"]:
        reasons.append("percent %s -> %s" % (left["percent"], right["percent"]))
    if left["sections"] != right["sections"]:
        reasons.append("sections %d -> %d" % (left["sections"], right["sections"]))
    if left["tokens"] != right["tokens"]:
        literals = lambda parsed: [
            rest[0] for section in parsed for kind, *rest in section if kind == "lit"
        ]
        if literals(left["tokens"]) != literals(right["tokens"]):
            reasons.append("literal text %s -> %s"
                           % (literals(left["tokens"]), literals(right["tokens"])))
        elif not reasons:
            reasons.append("format tokens differ")
    return reasons


def effective_formats(zf):
    """cell reference -> {sheet, format code, numFmtId, xf}"""
    styles = ET.fromstring(zf.read("xl/styles.xml")) if "xl/styles.xml" in zf.namelist() else None
    formats, xfs = {}, []
    if styles is not None:
        for node in styles.iter(SML + "numFmt"):
            formats[int(node.get("numFmtId"))] = node.get("formatCode")
        cell_xfs = styles.find(SML + "cellXfs")
        if cell_xfs is not None:
            xfs = cell_xfs.findall(SML + "xf")
    result = {}
    if "xl/workbook.xml" not in zf.namelist():
        return result, formats, xfs
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = {rel["id"]: rel for rel in read_rels(zf, "xl/workbook.xml")}
    for sheet in workbook.iter(SML + "sheet"):
        target = rels.get(sheet.get(R + "id"), {}).get("target")
        if not target:
            continue
        part = posixpath.normpath(posixpath.join("xl", target))
        if part not in zf.namelist():
            continue
        root = ET.fromstring(zf.read(part))
        shared = []
        if "xl/sharedStrings.xml" in zf.namelist():
            for si in ET.fromstring(zf.read("xl/sharedStrings.xml")).findall(SML + "si"):
                shared.append("".join(n.text or "" for n in si.iter(SML + "t")))
        for cell in root.iter(SML + "c"):
            ref = cell.get("r")
            style = int(cell.get("s", "0"))
            num_fmt_id = 0
            if style < len(xfs):
                num_fmt_id = int(xfs[style].get("numFmtId", "0"))
            code = formats.get(num_fmt_id, BUILTIN.get(num_fmt_id, "General"))
            value_node = cell.find(SML + "v")
            formula_node = cell.find(SML + "f")
            raw = value_node.text if value_node is not None else None
            if cell.get("t") == "s" and raw is not None:
                index = int(raw)
                value = shared[index] if index < len(shared) else raw
            elif cell.get("t") == "inlineStr":
                value = "".join(n.text or "" for n in cell.iter(SML + "t"))
            else:
                value = raw
            result[(sheet.get("name"), ref)] = {
                "numFmtId": num_fmt_id,
                "format": code,
                "value": value,
                "formula": formula_node.text if formula_node is not None else None,
            }
    return result, formats, xfs


def compare(original_path, saved_path, cells=None):
    with zipfile.ZipFile(original_path) as left_zf, zipfile.ZipFile(saved_path) as right_zf:
        left, _, _ = effective_formats(left_zf)
        right, _, _ = effective_formats(right_zf)
    findings, differences = [], []
    keys = sorted(set(left) | set(right))
    for key in keys:
        if cells and key[1] not in cells and "%s!%s" % key not in cells:
            continue
        a, b = left.get(key), right.get(key)
        entry = {"sheet": key[0], "cell": key[1]}
        if a is None or b is None:
            # A cell the edit added is reported, never hidden; a lost cell fails.
            side = "saved" if b is not None else "original"
            entry.update(outcome="ADDED" if b is not None else "DIFFERENCE",
                         differences=["cell present only on %s" % side])
            findings.append(entry)
            if b is None:
                differences.append("%s!%s missing from saved" % key)
            continue
        reasons = material_differences(a["format"], b["format"])
        if a["value"] != b["value"]:
            reasons.append("value %r -> %r" % (a["value"], b["value"]))
        if a["formula"] != b["formula"]:
            reasons.append("formula %r -> %r" % (a["formula"], b["formula"]))
        left_preview = render(a["format"], float(a["value"])) if _is_number(a["value"]) else None
        right_preview = render(b["format"], float(b["value"])) if _is_number(b["value"]) else None
        if left_preview is not None and right_preview is not None and \
                left_preview != right_preview:
            reasons.append("display %r -> %r" % (left_preview, right_preview))
        entry.update({
            "original": {"format": a["format"], "numFmtId": a["numFmtId"],
                         "value": a["value"], "display": left_preview},
            "saved": {"format": b["format"], "numFmtId": b["numFmtId"],
                      "value": b["value"], "display": right_preview},
            "rawFormatChanged": a["format"] != b["format"],
            "semanticEquivalent": not reasons,
            "differences": reasons,
            "outcome": "PASS" if not reasons else "DIFFERENCE",
        })
        if entry["rawFormatChanged"] or reasons:
            findings.append(entry)
        for reason in reasons:
            differences.append("%s!%s %s" % (key[0], key[1], reason))
    return {
        "outcome": "PASS" if not differences else "DIFFERENCE",
        "cellsCompared": len([k for k in keys if not cells or
                              k[1] in cells or "%s!%s" % k in cells]),
        "rawFormatChanges": [f for f in findings if f.get("rawFormatChanged")],
        "addedCells": ["%s!%s" % (f["sheet"], f["cell"]) for f in findings
                       if f.get("outcome") == "ADDED"],
        "strictRawFormatEqual": not any(f.get("rawFormatChanged") for f in findings),
        "differences": differences,
        "findings": findings,
    }


def _is_number(value):
    if value is None:
        return False
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False


def self_test():
    """Rejection controls over the real retained format pair."""
    base, escaped = "$#,##0.00", "\\$#,##0.00"
    # name, original code, saved code, original value, saved value, expected
    cases = [
        ("escaped-dollar is equivalent", base, escaped, 1234.567, 1234.567, True),
        ("identical code", base, base, 1234.567, 1234.567, True),
        ("currency symbol changed", base, "€#,##0.00", 1234.567, 1234.567, False),
        ("precision reduced", base, "$#,##0.0", 1234.567, 1234.567, False),
        ("precision increased", base, "$#,##0.000", 1234.567, 1234.567, False),
        ("grouping removed", base, "$0.00", 1234.567, 1234.567, False),
        ("value changed", base, escaped, 1234.567, 1234.5, False),
        ("bracket currency changed", base, "[$€-407]#,##0.00", 1234.567, 1234.567, False),
    ]
    failures, report = [], []
    for name, left, right, left_value, right_value, expect_equivalent in cases:
        reasons = material_differences(left, right)
        if left_value != right_value:
            reasons.append("value %r -> %r" % (left_value, right_value))
        left_preview = render(left, left_value)
        right_preview = render(right, right_value)
        if left_preview != right_preview:
            reasons.append("display %r -> %r" % (left_preview, right_preview))
        equivalent = not reasons
        report.append({"case": name, "equivalent": equivalent,
                       "expected": expect_equivalent,
                       "display": [left_preview, right_preview],
                       "reasons": reasons})
        if equivalent != expect_equivalent:
            failures.append(name)
    print(json.dumps(report, indent=2))
    if failures:
        print("SELF-TEST FAILED", failures)
        return 1
    print("SELF-TEST PASS: %d controls" % len(report))
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--original")
    parser.add_argument("--saved")
    parser.add_argument("--cell", action="append", default=[],
                        help="restrict to these cell references, e.g. B5")
    parser.add_argument("--json")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if not args.original or not args.saved:
        parser.error("--original and --saved are required unless --self-test")

    report = compare(args.original, args.saved, set(args.cell) or None)
    report["original"] = {"path": args.original,
                          "sha256": sha256(open(args.original, "rb").read())}
    report["saved"] = {"path": args.saved,
                       "sha256": sha256(open(args.saved, "rb").read())}
    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
    for finding in report["findings"]:
        print(json.dumps({k: finding[k] for k in finding
                          if k in ("sheet", "cell", "outcome", "rawFormatChanged",
                                   "semanticEquivalent", "differences",
                                   "original", "saved")}, ensure_ascii=False))
    print("strictRawFormatEqual", report["strictRawFormatEqual"],
          "| semantic OUTCOME", report["outcome"])
    return 0 if report["outcome"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
