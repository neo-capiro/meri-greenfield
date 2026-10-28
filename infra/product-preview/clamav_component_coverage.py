"""Documented source-range coverage check for the source-built ClamAV component.

The retained image scan reports the seven HIGH advisories of the pinned Wolfi clamav-1.5 1.5.2
packages and records no fixed-version metadata, and the vendor feed's declared fixed revision
(clamav-1.5 1.5.4-r2) is not published in any apk repository. This check supplies the explicit
evidence path for that gap: for every advisory in the retained table it compares a ClamAV release
against the per-advisory documented affected range and against the fixed release the primary
sources name, and it reports which of four outcomes applies:

  fixed         the release is at or above a fixed release of its own series
  affected      the release is inside the documented affected range
  not-affected  the release is documented as outside the affected range
  unknown       the table documents no affected range or fixed release for that series

Only "fixed" and "not-affected" pass. "affected" and "unknown" both fail closed, so a release the
table cannot describe is never reported as covered.

Binding (--bind) is the mode the image build uses: it reads the version from the actual binary in
the built image, verifies the recorded inventory against the files installed in that image, and
checks the provenance record against both, so an absent, empty, forged or mismatched record cannot
pass. It is a documented source-range check, not scanner detection, and it does not replace or
weaken the retained ECR HIGH==0 CRITICAL==0 gate.

Usage:
  python3 clamav_component_coverage.py --bind                # actual binary + installed inventory + provenance
  python3 clamav_component_coverage.py --bind --clamscan <path> --inventory <file> --provenance <file>
  python3 clamav_component_coverage.py                        # coverage of the pinned component version
  python3 clamav_component_coverage.py --version 1.5.2-r0      # coverage of any candidate version
  python3 clamav_component_coverage.py --selftest              # bounded vulnerable/fixed/binding controls
  python3 clamav_component_coverage.py --inventory <file>      # verify an inventory's listed bytes
"""
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

TABLE = Path(__file__).resolve().parent / "clamav-source-advisories.json"
PINNED_VERSION = "1.5.4"
DEFAULT_CLAMSCAN = "/usr/bin/clamscan"
DEFAULT_INVENTORY = "/usr/share/meri/clamav-component-inventory.txt"
DEFAULT_PROVENANCE = "/usr/share/meri/clamav-component-provenance.json"
OUTCOMES = ("fixed", "affected", "not-affected", "unknown")
PASSING_OUTCOMES = ("fixed", "not-affected")
VERSION_RE = re.compile(r"ClamAV\s+(\d+\.\d+\.\d+)")


def _parse(text):
    """Numeric release ordering for ClamAV versions, ignoring any -rN package revision.

    Two-component releases are accepted because the sources document ranges by them ("0.90 through
    1.5.3"); a missing third component reads as zero.
    """
    match = re.match(r"^(\d+)\.(\d+)(?:\.(\d+))?", str(text).strip())
    if not match:
        return None
    return tuple(int(part or 0) for part in match.groups())


def _series(version):
    return "%d.%d" % version[:2]


def _range_bounds(entry):
    return _parse(entry.get("from")), _parse(entry.get("to"))


def _in_range(installed, entry):
    low, high = _range_bounds(entry)
    if low is None or high is None:
        return False
    return low <= installed <= high


def load_advisories(path=TABLE):
    return json.loads(Path(path).read_text(encoding="utf-8"))["advisories"]


def classify(version, advisory):
    """One advisory's outcome for one ClamAV release, with the reason it was reached."""
    installed = _parse(version)
    if installed is None:
        return "unknown", "the version is not a parsable ClamAV release"
    series = _series(installed)
    for named in advisory.get("fixedReleases", []):
        fixed = _parse(named)
        if fixed is not None and _series(fixed) == series and installed >= fixed:
            return "fixed", "at or above %s, the fixed release the sources name for this series" % named
    for entry in advisory.get("affectedRanges", []):
        if _in_range(installed, entry):
            return "affected", "inside the documented affected range %s through %s" % (entry["from"], entry["to"])
    if series in advisory.get("documentedUnaffectedSeries", []):
        return "not-affected", "the %s series is documented as outside the affected range" % series
    for entry in advisory.get("affectedRanges", []):
        low, high = _range_bounds(entry)
        if series in [_series(bound) for bound in (low, high) if bound is not None]:
            return "not-affected", "outside the documented affected range %s through %s" % (entry["from"], entry["to"])
    return "unknown", "the retained table documents no affected range or fixed release for the %s series" % series


def coverage(version, advisories=None):
    """Per-advisory outcome for one ClamAV release."""
    advisories = load_advisories() if advisories is None else advisories
    rows = []
    for advisory in advisories:
        outcome, reason = classify(version, advisory)
        rows.append({"id": advisory["id"], "installedVersion": str(version), "outcome": outcome,
                     "fixedInUpstream": advisory["fixedInUpstream"], "reason": reason,
                     "affectedRanges": advisory.get("affectedRanges", []),
                     "flagged": outcome not in PASSING_OUTCOMES})
    return rows


def summarise(rows):
    flagged = [row["id"] for row in rows if row["flagged"]]
    outcomes = {name: [row["id"] for row in rows if row["outcome"] == name] for name in OUTCOMES}
    return {"advisories": len(rows), "outcomes": outcomes, "flagged": flagged,
            "recognisedFixed": len(outcomes["fixed"]), "notAffected": len(outcomes["not-affected"])}


def parse_observed_version(raw):
    """The version an actual ClamAV binary reports, or None when its output carries none."""
    match = VERSION_RE.search(str(raw))
    return match.group(1) if match else None


def observe_version(clamscan=DEFAULT_CLAMSCAN):
    """Run the actual binary and read its version. Returns (version|None, raw output or error)."""
    try:
        done = subprocess.run([clamscan, "--version"], capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.SubprocessError) as exc:
        return None, "cannot execute %s: %s" % (clamscan, exc)
    raw = ((done.stdout or "") + (done.stderr or "")).strip()
    if done.returncode != 0:
        return None, "the binary exited %d: %s" % (done.returncode, raw)
    return parse_observed_version(raw), raw


def _sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_inventory(path):
    """Read an inventory of installed bytes: '<sha256>  <path>' lines."""
    entries = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        fields = line.split()
        if len(fields) == 2 and re.fullmatch(r"[0-9a-f]{64}", fields[0]):
            entries[fields[1]] = fields[0]
    return entries


def verify_inventory(path, root="/"):
    """Verify every listed path against its recorded sha256. Returns (entries, problems).

    ``root`` is the filesystem the inventory's relative paths are resolved against: the image root
    for the binding, and the fixture directory for the bounded controls.
    """
    try:
        text = Path(path).read_text(encoding="utf-8")
    except OSError as exc:
        return {}, ["the inventory %s cannot be read: %s" % (path, exc)]
    entries = read_inventory(path)
    if not entries:
        return {}, ["the inventory %s lists no installed file with a sha256" % path]
    problems = []
    listed = set()
    for line in text.splitlines():
        fields = line.split()
        if len(fields) == 2:
            listed.add(fields[1])
        elif fields:
            problems.append("the inventory line %r is not '<sha256>  <path>'" % line)
    for relative, recorded in sorted(entries.items()):
        target = Path(root) / relative
        if not target.is_file():
            problems.append("the inventory names %s, which is not installed" % target)
            continue
        actual = _sha256(target)
        if actual != recorded:
            problems.append("the installed bytes of %s do not match the inventory record (recorded %s, installed %s)"
                            % (target, recorded[:16], actual[:16]))
    for relative in sorted(listed - set(entries)):
        problems.append("the inventory names %s without a valid sha256" % relative)
    return entries, problems


def read_provenance(path):
    """Read the provenance record the build stage writes. Returns (record|None, problem|None)."""
    try:
        text = Path(path).read_text(encoding="utf-8")
    except OSError as exc:
        return None, "the provenance %s cannot be read: %s" % (path, exc)
    try:
        record = json.loads(text)
    except ValueError as exc:
        return None, "the provenance %s is not valid JSON: %s" % (path, exc)
    if not isinstance(record, dict):
        return None, "the provenance %s is not a JSON object" % path
    return record, None


CONTROLS = [
    # (label, version, expected flagged ids, expected non-empty outcome counts)
    ("the retained vulnerable Wolfi scanner build", "1.5.2-r0",
     ["CVE-2026-20337", "CVE-2026-20338", "CVE-2026-20339", "CVE-2026-20345", "CVE-2026-20346",
      "CVE-2026-20347", "CVE-2026-20348"], {"affected": 7}),
    ("the retained vulnerable Wolfi engine build", "1.5.2-r7",
     ["CVE-2026-20337", "CVE-2026-20338", "CVE-2026-20339", "CVE-2026-20345", "CVE-2026-20346",
      "CVE-2026-20347", "CVE-2026-20348"], {"affected": 7}),
    ("predecessor of the fixed 1.5 release", "1.5.3",
     ["CVE-2026-20337", "CVE-2026-20338", "CVE-2026-20339", "CVE-2026-20345", "CVE-2026-20346",
      "CVE-2026-20347", "CVE-2026-20348"], {"affected": 7}),
    ("the source-built component", PINNED_VERSION, [], {"fixed": 7}),
    ("a series this table does not describe fails closed", "1.6.0",
     ["CVE-2026-20337", "CVE-2026-20338", "CVE-2026-20339", "CVE-2026-20345", "CVE-2026-20346",
      "CVE-2026-20347", "CVE-2026-20348"], {"unknown": 7}),
    ("the 1.4 LTS below its fixed release", "1.4.5",
     ["CVE-2026-20339", "CVE-2026-20345", "CVE-2026-20346", "CVE-2026-20347", "CVE-2026-20348"],
     {"affected": 5, "not-affected": 2}),
    ("the 1.4 LTS at its fixed release for the five it names", "1.4.6", [],
     {"fixed": 5, "not-affected": 2}),
    # 0.98.0 sits above the 0.90 lower bound of 20339 and inside "1.4.5 and earlier" for 20346/20347;
    # it is below the documented 0.98.1/0.98.2 bounds of 20348/20345 (not affected) and the table
    # documents nothing about the 0.98 series for 20337/20338, which therefore stays fail-closed.
    ("a release before most documented affected ranges", "0.98.0",
     ["CVE-2026-20337", "CVE-2026-20338", "CVE-2026-20339", "CVE-2026-20346", "CVE-2026-20347"],
     {"affected": 3, "not-affected": 2, "unknown": 2}),
    ("an unparsable version fails closed", "unknown", ["CVE-2026-20337", "CVE-2026-20338",
      "CVE-2026-20339", "CVE-2026-20345", "CVE-2026-20346", "CVE-2026-20347", "CVE-2026-20348"],
     {"unknown": 7}),
]

# The binding must fail closed on an absent, empty, tampered or contradictory record, and must pass
# only when every part of the record agrees with the files actually present.
BINDING_CONTROLS = [
    # (label, mutation, expected to bind)
    ("an intact record for the source-built version", None, True),
    ("no inventory at all", "missing-inventory", False),
    ("an empty inventory", "empty-inventory", False),
    ("a listed file whose bytes were changed", "tampered-file", False),
    ("a listed file that is not installed", "missing-file", False),
    ("an inventory line that is not a checksum record", "malformed-line", False),
    ("a provenance for a different version", "provenance-version", False),
    ("a provenance that does not cover the inventory's bytes", "provenance-inventory", False),
    ("a binary that reports no parsable version", "unrecognised-version", False),
]


def _write_fixture(root):
    """A small installed-file set with its inventory and provenance, shaped as the build stage writes them."""
    installed = root / "usr" / "bin"
    installed.mkdir(parents=True)
    for name in ("clamscan", "sigtool"):
        (installed / name).write_bytes(b"fixture %s payload\n" % name.encode())
    inventory = root / "clamav-component-inventory.txt"
    inventory.write_text("".join("%s  usr/bin/%s\n" % (_sha256(installed / name), name)
                                 for name in ("clamscan", "sigtool")), encoding="utf-8")
    provenance = root / "clamav-component-provenance.json"
    provenance.write_text(json.dumps({"component": "clamav", "upstreamVersion": PINNED_VERSION,
                                      "installedInventorySha256": _sha256(inventory)}), encoding="utf-8")
    return inventory, provenance


def _binding_fixture_case(root, mutation, version=PINNED_VERSION):
    """Run the binding over a fixture with one property broken, observing no real binary."""
    inventory, provenance = _write_fixture(root)
    observed = version
    if mutation == "missing-inventory":
        inventory = root / "absent.txt"
    elif mutation == "empty-inventory":
        inventory.write_text("", encoding="utf-8")
    elif mutation == "tampered-file":
        (root / "usr" / "bin" / "clamscan").write_bytes(b"tampered payload\n")
    elif mutation == "missing-file":
        (root / "usr" / "bin" / "sigtool").unlink()
    elif mutation == "malformed-line":
        inventory.write_text(inventory.read_text(encoding="utf-8") + "not-a-checksum-line\n", encoding="utf-8")
    elif mutation == "provenance-version":
        record = json.loads(provenance.read_text(encoding="utf-8"))
        record["upstreamVersion"] = "1.5.2"
        provenance.write_text(json.dumps(record), encoding="utf-8")
    elif mutation == "provenance-inventory":
        record = json.loads(provenance.read_text(encoding="utf-8"))
        record["installedInventorySha256"] = "0" * 64
        provenance.write_text(json.dumps(record), encoding="utf-8")
    elif mutation == "unrecognised-version":
        observed = "no parsable version here"
    report = binding(clamscan=DEFAULT_CLAMSCAN, inventory=str(inventory), provenance=str(provenance),
                     observed=observed, out=lambda *_: None, root=str(root))
    return report["passed"]


def binding(clamscan=DEFAULT_CLAMSCAN, inventory=DEFAULT_INVENTORY, provenance=DEFAULT_PROVENANCE,
            observed=None, out=print, root="/"):
    """Bind the coverage result to the actual built image. Returns a report and prints it through ``out``.

    ``observed`` is the version read from the actual binary. Only the bounded controls below supply
    it, and they run where no ClamAV binary exists; --bind always reads the binary itself.
    """
    checks = []
    if observed is None:
        observed, raw = observe_version(clamscan)
        checks.append(("the actual binary reports a parsable version (%s)" % clamscan, observed is not None,
                       "reported %r" % raw))
    else:
        checks.append(("an observed version was supplied by a bounded control", _parse(observed) is not None,
                       "observed %r" % observed))
    entries, problems = verify_inventory(inventory, root=root)
    checks.append(("the recorded inventory lists installed files", bool(entries),
                   "%d files recorded" % len(entries)))
    checks.append(("every listed file matches its recorded sha256", not problems,
                   "; ".join(problems) if problems else "%d files verified" % len(entries)))
    record, problem = read_provenance(provenance)
    checks.append(("the provenance record is readable JSON", record is not None, problem or provenance))
    if record is not None:
        declared = record.get("upstreamVersion")
        checks.append(("the provenance declares the version the binary reports", declared == observed,
                       "provenance %r, observed %r" % (declared, observed)))
        recorded_bytes = record.get("installedInventorySha256")
        actual_bytes = _sha256(inventory) if Path(inventory).is_file() else None
        checks.append(("the provenance covers the inventory's bytes", recorded_bytes == actual_bytes,
                       "provenance %r, inventory %r" % (recorded_bytes, actual_bytes)))
    rows = coverage(observed) if _parse(observed) else []
    summary = summarise(rows)
    checks.append(("every retained advisory is fixed or documented as not affected", not summary["flagged"],
                   "flagged %r" % (summary["flagged"],) if summary["flagged"] else "no advisory flagged"))
    passed = all(check[1] for check in checks)
    out("ClamAV component coverage binding (documented source-range check, not scanner detection)")
    out("  version observed from the built image: %s" % observed)
    for label, ok, detail in checks:
        out("  %-7s %s -- %s" % ("ok" if ok else "FAILED", label, detail))
    for row in rows:
        out("  %-16s %-13s %s" % (row["id"], row["outcome"], row["reason"]))
    out("binding: %s (%d files, %d advisories, %d flagged)"
        % ("PASS" if passed else "FAIL", len(entries), summary["advisories"], len(summary["flagged"])))
    return {"passed": passed, "checks": checks, "rows": rows, "summary": summary, "observed": observed}


def selftest():
    failures = []
    for label, version, expected, counts in CONTROLS:
        summary = summarise(coverage(version))
        observed_counts = {name: len(ids) for name, ids in summary["outcomes"].items() if ids}
        verdict = "ok" if summary["flagged"] == expected and observed_counts == counts else "MISMATCH"
        if verdict != "ok":
            failures.append("%s (%s): flagged %r, outcomes %r, expected %r / %r"
                            % (label, version, summary["flagged"], observed_counts, expected, counts))
        print("  %-8s %-54s version=%-8s flagged=%d outcomes=%s"
              % (verdict, label, version, len(summary["flagged"]), observed_counts or "{}"))
    with tempfile.TemporaryDirectory() as scratch:
        for index, (label, mutation, should_bind) in enumerate(BINDING_CONTROLS):
            root = Path(scratch) / ("case%d" % index)
            root.mkdir()
            bound = _binding_fixture_case(root, mutation)
            verdict = "ok" if bound == should_bind else "MISMATCH"
            if verdict != "ok":
                failures.append("%s: binding %s, expected %s" % (label, bound, should_bind))
            print("  %-8s %-54s bound=%-5s expected=%s" % (verdict, label, bound, should_bind))
    print("selftest: %d version controls, %d binding controls, %d failures"
          % (len(CONTROLS), len(BINDING_CONTROLS), len(failures)))
    for failure in failures:
        print("  FAIL %s" % failure)
    return 1 if failures else 0


def _argument(argv, name, default):
    return argv[argv.index(name) + 1] if name in argv else default


def main(argv):
    if "--selftest" in argv:
        return selftest()
    if "--bind" in argv:
        report = binding(clamscan=_argument(argv, "--clamscan", DEFAULT_CLAMSCAN),
                         inventory=_argument(argv, "--inventory", DEFAULT_INVENTORY),
                         provenance=_argument(argv, "--provenance", DEFAULT_PROVENANCE))
        return 0 if report["passed"] else 1
    version = _argument(argv, "--version", PINNED_VERSION)
    rows = coverage(version)
    summary = summarise(rows)
    print("ClamAV component coverage (documented source-range check, not scanner detection)")
    print("installed version: %s   advisories: %d   fixed: %d   not affected: %d   flagged: %d"
          % (version, summary["advisories"], summary["recognisedFixed"], summary["notAffected"],
             len(summary["flagged"])))
    for row in rows:
        print("  %-16s %-13s %s" % (row["id"], row["outcome"], row["reason"]))
    status = 0
    if "--inventory" in argv:
        entries, problems = verify_inventory(_argument(argv, "--inventory", DEFAULT_INVENTORY))
        print("inventory: %d installed files verified" % len(entries))
        for problem in problems:
            print("  FAIL %s" % problem)
        status = 1 if problems else 0
    return 1 if summary["flagged"] else status


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
