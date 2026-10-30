#!/usr/bin/env python3
"""Equivalent number-format check for the currency case (SCRUM-241).

The retained native save of xlsx-02 changes cell B5's format code from
``$#,##0.00`` to ``\\$#,##0.00``.  A backslash escapes the next character, so
``\\$`` and ``$`` are both the literal currency symbol and render identically.
The value 1234.567 is untouched.

Equivalence here is deliberately narrow and conservative:

* only escapes (``\\X``) and quoted literals (``"..."``) are removed, and only
  when the escaped character is an ordinary literal.  Escaping a control
  character (``*``, ``_``, ``[``, ``]``, ``?``, digits, separators, ``%``,
  ``@``, ``;``) is not proven equivalent, because there it carries meaning;
* everything else is compared verbatim: fill (``*x``) and spacing (``_x``)
  directives, colour/condition/currency brackets, digits, separators, percent,
  date tokens and section separators all have to match exactly.

There is no format renderer, so no unsupported syntax is silently dropped: an
unknown construct keeps its literal characters and can only compare equal to
the same construct on the other side.  The strict raw-format difference is
always reported separately, and cell values and formulas are compared exactly.

Pure standard library.
"""
import argparse
import hashlib
import json
import posixpath
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
# Escaping or quoting one of these changes meaning, so such a pair is never
# called equal. Letters are excluded too, because date/time/exponent tokens
# (y m d h s E, AM/PM) only carry meaning when they are not escaped or quoted.
CONTROL_CHARS = set("*_[]?0#,.;%@")
PROVABLE_LITERAL = set(
    chr(code) for code in range(32, 127)
    if chr(code).isprintable()
    and not chr(code).isalnum()
    and chr(code) not in CONTROL_CHARS
    and chr(code) != '"'
) | {"€", "£", "¥", "₽", "₹", "₩", "₪", "₫", "฿", "₴", "₦", "₱"}
CURRENCY = set("$€£¥₽₹₩₪₫฿₴₦₱")


def sha256(payload):
    return hashlib.sha256(payload).hexdigest()


def canonical(code):
    """Unescape literals only.

    A segment is unwrapped only when every character in it is a character that
    means the same thing quoted/escaped and bare: punctuation, space, currency
    signs. Quoting a whole format (``"$#,##0.00"``) turns digits and separators
    into constant text and is therefore never equivalent, and escaping a letter
    (``\\m``) turns a date token into a literal, so both return None.
    """
    if code is None:
        return None
    out, index = [], 0
    while index < len(code):
        char = code[index]
        if char == "\\":
            if index + 1 >= len(code):
                return None
            escaped = code[index + 1]
            if escaped not in PROVABLE_LITERAL:
                return None
            out.append(escaped)
            index += 2
            continue
        if char == '"':
            end = code.find('"', index + 1)
            if end < 0:
                return None
            text = code[index + 1:end]
            if not text or any(char not in PROVABLE_LITERAL for char in text):
                return None
            out.append(text)
            index = end + 1
            continue
        out.append(char)
        index += 1
    return "".join(out)


def traits(code):
    """Literal facts used to describe why two codes differ."""
    text = canonical(code) or ""
    currencies = sorted({char for char in text if char in CURRENCY})
    integer, fraction, seen = [], [], False
    for char in text:
        if char == ".":
            seen = True
            continue
        if char == ",":
            (fraction if seen else integer).append(char)
        elif char in "0#?":
            (fraction if seen else integer).append(char)
    return {
        "currencies": currencies,
        "grouping": "," in integer,
        "minDecimals": fraction.count("0"),
        "maxDecimals": len([char for char in fraction if char in "0#?"]),
        "minIntegerDigits": integer.count("0"),
        "percent": "%" in text,
        "sections": text.count(";") + 1,
        "fill": "*" in text,
        "spacing": "_" in text,
    }


def differences_between(original, saved):
    """Reasons the two format codes are not proven equivalent."""
    if original == saved:
        return []
    left, right = canonical(original), canonical(saved)
    if left is None or right is None:
        return ["escape cannot be proven literal: %r vs %r" % (original, saved)]
    if left == right:
        return []
    reasons = []
    a, b = traits(original), traits(saved)
    if a["currencies"] != b["currencies"]:
        reasons.append("currency symbol %s -> %s" % (a["currencies"], b["currencies"]))
    if a["minDecimals"] != b["minDecimals"] or a["maxDecimals"] != b["maxDecimals"]:
        reasons.append("precision %d/%d -> %d/%d decimals"
                       % (a["minDecimals"], a["maxDecimals"],
                          b["minDecimals"], b["maxDecimals"]))
    if a["grouping"] != b["grouping"]:
        reasons.append("grouping %s -> %s" % (a["grouping"], b["grouping"]))
    if a["minIntegerDigits"] != b["minIntegerDigits"]:
        reasons.append("minimum integer digits %d -> %d"
                       % (a["minIntegerDigits"], b["minIntegerDigits"]))
    if a["percent"] != b["percent"]:
        reasons.append("percent %s -> %s" % (a["percent"], b["percent"]))
    if a["sections"] != b["sections"]:
        reasons.append("sections %d -> %d" % (a["sections"], b["sections"]))
    if a["fill"] != b["fill"]:
        reasons.append("fill directive %s -> %s" % (a["fill"], b["fill"]))
    if a["spacing"] != b["spacing"]:
        reasons.append("spacing directive %s -> %s" % (a["spacing"], b["spacing"]))
    if not reasons:
        reasons.append("format code %r -> %r is not a pure escaping/quoting change"
                       % (original, saved))
    return reasons


def rels_path(part):
    head, name = posixpath.split(part)
    return posixpath.join(head, "_rels", name + ".rels")


def read_rels(zf, part):
    path = rels_path(part)
    if path not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(path))
    return [{"id": rel.get("Id"), "type": rel.get("Type"), "target": rel.get("Target")}
            for rel in root.findall(RELS + "Relationship")]


def workbook_cells(zf):
    """(sheet, cell) -> numFmtId, format code, value and formula."""
    formats, xfs = {}, []
    if "xl/styles.xml" in zf.namelist():
        styles = ET.fromstring(zf.read("xl/styles.xml"))
        for node in styles.iter(SML + "numFmt"):
            formats[int(node.get("numFmtId"))] = node.get("formatCode")
        cell_xfs = styles.find(SML + "cellXfs")
        if cell_xfs is not None:
            xfs = cell_xfs.findall(SML + "xf")
    result = {}
    if "xl/workbook.xml" not in zf.namelist():
        return result
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = {rel["id"]: rel for rel in read_rels(zf, "xl/workbook.xml")}
    shared = []
    if "xl/sharedStrings.xml" in zf.namelist():
        for si in ET.fromstring(zf.read("xl/sharedStrings.xml")).findall(SML + "si"):
            shared.append("".join(node.text or "" for node in si.iter(SML + "t")))
    for sheet in workbook.iter(SML + "sheet"):
        target = rels.get(sheet.get(R + "id"), {}).get("target")
        if not target:
            continue
        part = posixpath.normpath(posixpath.join("xl", target))
        if part not in zf.namelist():
            continue
        for cell in ET.fromstring(zf.read(part)).iter(SML + "c"):
            style = int(cell.get("s", "0"))
            num_fmt_id = int(xfs[style].get("numFmtId") or "0") if style < len(xfs) else 0
            code = formats.get(num_fmt_id, BUILTIN.get(num_fmt_id, "General"))
            value_node = cell.find(SML + "v")
            formula_node = cell.find(SML + "f")
            raw = value_node.text if value_node is not None else None
            if cell.get("t") == "s" and raw is not None:
                index = int(raw)
                value = shared[index] if index < len(shared) else raw
            elif cell.get("t") == "inlineStr":
                value = "".join(node.text or "" for node in cell.iter(SML + "t"))
            else:
                value = raw
            result[(sheet.get("name"), cell.get("r"))] = {
                "numFmtId": num_fmt_id, "format": code, "value": value,
                "formula": formula_node.text if formula_node is not None else None}
    return result


def compare(original_path, saved_path, cells=None):
    """Compare two real workbooks; ``cells`` optionally restricts cell references."""
    with zipfile.ZipFile(original_path) as left_zf, zipfile.ZipFile(saved_path) as right_zf:
        left, right = workbook_cells(left_zf), workbook_cells(right_zf)
    findings, differences = [], []
    keys = sorted(set(left) | set(right))
    compared = 0
    for key in keys:
        if cells and key[1] not in cells and "%s!%s" % key not in cells:
            continue
        compared += 1
        a, b = left.get(key), right.get(key)
        entry = {"sheet": key[0], "cell": key[1]}
        if a is None or b is None:
            side = "saved" if b is not None else "original"
            entry.update(outcome="ADDED" if b is not None else "DIFFERENCE",
                         differences=["cell present only on %s" % side])
            findings.append(entry)
            if b is None:
                differences.append("%s!%s missing from saved" % key)
            continue
        reasons = differences_between(a["format"], b["format"])
        if a["value"] != b["value"]:
            reasons.append("value %r -> %r" % (a["value"], b["value"]))
        if a["formula"] != b["formula"]:
            reasons.append("formula %r -> %r" % (a["formula"], b["formula"]))
        entry.update({
            "original": {"format": a["format"], "numFmtId": a["numFmtId"],
                         "canonical": canonical(a["format"]), "value": a["value"]},
            "saved": {"format": b["format"], "numFmtId": b["numFmtId"],
                      "canonical": canonical(b["format"]), "value": b["value"]},
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
        "cellsCompared": compared,
        "rawFormatChanges": [f for f in findings if f.get("rawFormatChanged")],
        "addedCells": ["%s!%s" % (f["sheet"], f["cell"]) for f in findings
                       if f.get("outcome") == "ADDED"],
        "strictRawFormatEqual": not any(f.get("rawFormatChanged") for f in findings),
        "differences": differences,
        "findings": findings,
    }


def self_test():
    """Verdict vectors over the demonstrated pair and its material changes."""
    base, escaped = "$#,##0.00", "\\$#,##0.00"
    cases = [
        ("escaped-dollar is equivalent", base, escaped, True),
        ("identical code", base, base, True),
        ("quoted single currency sign is equivalent", base, '"$"#,##0.00', True),
        ("escaped dash in a date is equivalent", "yyyy-mm-dd", "yyyy\\-mm\\-dd", True),
        ("wholly quoted format is a constant literal", base, '"' + base + '"', False),
        ("escaped date token is a literal", "yyyy-mm-dd", "yyyy\\m\\m-dd", False),
        ("fill directive is material", base, base + "*x", False),
        ("spacing directive is material", base, base + "_x", False),
        ("currency symbol is material", base, "€#,##0.00", False),
        ("precision is material", base, "$#,##0.0", False),
        ("grouping is material", base, "$0.00", False),
        ("sign section is material", base, base + ";(" + base + ")", False),
        ("bracket currency is material", base, "[$€-407]#,##0.00", False),
        ("escaped control char is unprovable", base, base + "\\#", False),
    ]
    failures, report = [], []
    for name, left, right, expected in cases:
        equivalent = not differences_between(left, right)
        report.append({"case": name, "equivalent": equivalent, "expected": expected})
        if equivalent != expected:
            failures.append(name)
    print(json.dumps(report, indent=2))
    if failures:
        print("SELF-TEST FAILED", failures)
        return 1
    print("SELF-TEST PASS: %d vectors" % len(report))
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
        print(json.dumps({key: finding[key] for key in finding
                          if key in ("sheet", "cell", "outcome", "rawFormatChanged",
                                     "semanticEquivalent", "differences",
                                     "original", "saved")}, ensure_ascii=False))
    print("strictRawFormatEqual", report["strictRawFormatEqual"],
          "| semantic OUTCOME", report["outcome"])
    return 0 if report["outcome"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
