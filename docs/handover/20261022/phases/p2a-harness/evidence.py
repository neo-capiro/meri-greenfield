"""Decode existing test output and compare exact base/head evidence; no I/O on import."""
import argparse
import json
from pathlib import Path
import re


def decode_output(text, kind):
    result = {"failures": [], "tests": None, "passed": None, "failed": None, "skipped": None}
    if kind == "node":
        result["failures"] = sorted(set(re.findall(r"^\s*not ok \d+ - (.+)$", text, re.M)))
        for source, target in (("tests", "tests"), ("pass", "passed"), ("fail", "failed"), ("skipped", "skipped")):
            values = re.findall(rf"^# {source} (\d+)\s*$", text, re.M)
            if values:
                result[target] = int(values[-1])
    elif kind == "python":
        result["failures"] = sorted(set(re.findall(r"^(?:FAIL|ERROR): (.+)$", text, re.M)))
        total = re.search(r"^Ran (\d+) tests? in ", text, re.M)
        if total:
            result["tests"] = int(total[1])
        footer = re.search(r"^(?:OK|FAILED)(?: \(([^\n]+)\))?\s*$", text, re.M)
        if footer:
            counts = dict((key, int(value)) for key, value in re.findall(r"(\w+)=(\d+)", footer[1] or ""))
            result["failed"] = counts.get("failures", 0) + counts.get("errors", 0)
            result["skipped"] = counts.get("skipped", 0)
            if result["tests"] is not None:
                result["passed"] = result["tests"] - result["failed"] - result["skipped"]
    elif kind == "gate":
        verdicts = []
        for line in text.splitlines():
            try:
                value = json.loads(line)
            except (ValueError, TypeError):
                continue
            if isinstance(value, dict) and "observedCases" in value:
                verdicts.append(value)
        if len(verdicts) == 1:
            value = verdicts[0]
            result["verdict"] = value
            result["tests"] = value.get("observedCases")
            result["failures"] = value.get("failedCaseIds", [])
            result["failed"] = len(result["failures"])
            result["skipped"] = value.get("skippedCases")
            result["gateValid"] = (
                value.get("observedCases") == 24 and value.get("fileCaseCounts") == {"B": 6, "R": 6, "W": 12}
                and value.get("failedCaseIds") == [] and value.get("fileFailureIds") == []
                and all(value.get(key) == 0 for key in ("unknownFailures", "unknownOutcomes", "duplicateCases", "skippedCases"))
            )
            result["passed"] = 24 if result["gateValid"] else None
        else:
            result["gateValid"] = False
    # Rehearsal results are JSON serialized inside TAP comments. Empty arrays are normal.
    result["clockSteps"] = bool(re.search(r'"hostClockSteps"\s*:\s*\[\s*[^\]\s]', text))
    return result


def cell(value):
    return str(value).replace("|", "\\|").replace("\n", " ")


def comparison(records):
    by_key = {(record["side"], record["mode"]): record for record in records}
    lines = ["# P0 verification", "", "Runtime/proxy suites use networkless test containers; supplemental renderer checks use a hosted runner. See verdicts for checks actually run. No AWS or deployment operations ran.", ""]
    for key in sorted(by_key):
        record = by_key[key]
        lines += [f"- **{key[0]} / {key[1]}:** `{record.get('commit', 'unknown')}`; source SHA-256 `{record.get('sourceSha256', 'unavailable')}`; image `{record.get('imageId', 'unavailable')}`."]
        if record.get("pythonBaseDigest"):
            lines += [f"  Python base: `{record['pythonBaseDigest']}`."]
    lines += ["", "| Suite | Base | Head | Head tests / pass / fail / skip |", "| --- | --- | --- | --- |"]
    failures = []
    blocked = []
    missing = []
    for mode in ("runtime", "proxy", "infra"):
        for side in ("base", "head"):
            if (side, mode) not in by_key:
                missing.append(f"{side}/{mode}")
        base = {s["name"]: s for s in by_key.get(("base", mode), {}).get("checks", [])}
        head = {s["name"]: s for s in by_key.get(("head", mode), {}).get("checks", [])}
        for name in sorted(set(base) | set(head)):
            b, h = base.get(name, {}), head.get(name, {})
            counts = " / ".join(str(h.get(field, "—")) for field in ("tests", "passed", "failed", "skipped"))
            lines.append(f"| {cell(mode + '/' + name)} | {cell(b.get('status', 'not run'))} | {cell(h.get('status', 'not run'))} | {counts} |")
            for failure in h.get("failures", []):
                classification = "pre-existing (same failing case)" if failure in b.get("failures", []) else "new or unverified"
                failures.append((mode + "/" + name, failure, classification))
            if h.get("status") in ("failed", "blocked", "unverified") and not h.get("failures"):
                blocked.append((mode + "/" + name, h["status"], b.get("status", "not run")))
    lines += ["", "## Pre-existing failures and regressions", "", "| Suite | Failing case | Comparison with base |", "| --- | --- | --- |"]
    lines.extend(f"| {cell(suite)} | {cell(name)} | {status} |" for suite, name, status in failures)
    if not failures:
        lines.append("| — | No individual failing cases recorded | See blocked/unverified checks below |")
    if blocked:
        lines += ["", "## Blocked or unverified checks", ""]
        lines.extend(f"- {cell(name)}: head {status}; base {base_status}. See its log." for name, status, base_status in blocked)
    if missing:
        lines += ["", "**Missing evidence:** " + ", ".join(missing) + "."]
    lines += ["", "Skipped tests and baseline failures are not treated as proof of live acceptance. The shipper owns deployment and the live two-turn check.", ""]
    failed = bool(missing) or any(r.get("status") != "passed" for r in records)
    return "\n".join(lines), failed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    compare = commands.add_parser("compare")
    compare.add_argument("directory", type=Path)
    compare.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    records = [json.loads(path.read_text()) for path in sorted(args.directory.rglob("result.json"))]
    report, failed = comparison(records)
    args.output.write_text(report)
    print(report)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
