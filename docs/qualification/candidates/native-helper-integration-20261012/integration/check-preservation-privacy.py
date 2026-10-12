"""Check public source/evidence preservation; treat private members only as data."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path.cwd()
HERE = Path(__file__).resolve().parent
BASE = "bf41cf69ebe892705cdd6f041dd2f1fb323048f5"
AUTHOR = "c67558c211ede5a41e903f09e73666b43867301b"
REVIEWER = "1d8f0220ca46934f20c57244e673cf1aa6884f22"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def sha(data):
    return hashlib.sha256(data).hexdigest()


base_files = set(git("ls-tree", "-r", "--name-only", BASE).decode().splitlines())
all_files = set(git("ls-files", "--cached", "--others", "--exclude-standard").decode().splitlines())
existing_changes = []
for name in sorted(base_files):
    path = ROOT / name
    if not path.is_file() or path.read_bytes() != git("show", f"{BASE}:{name}"):
        existing_changes.append(name)
expected_changes = ["docs/plans/MERI-G1-SOURCE-TO-NATIVE.md", "scripts/qualification/worker_runner_inventory.py"]
assert existing_changes == expected_changes, existing_changes

preserved = {}
for label, commit, prefix, report in [
    ("author", AUTHOR, "docs/qualification/candidates/native-helper-20261012/author/", "docs/coordination/reports/MERI-NATIVE-HELPER-SOURCE-20261012.md"),
    ("reviewer", REVIEWER, "docs/qualification/candidates/native-helper-20261012/review/", "docs/coordination/reports/MERI-NATIVE-HELPER-SOURCE-REVIEW-20261012.md"),
]:
    names = git("ls-tree", "-r", "--name-only", commit).decode().splitlines()
    selected = [n for n in names if n.startswith(prefix) or n == report]
    assert selected
    for name in selected:
        assert (ROOT / name).read_bytes() == git("show", f"{commit}:{name}"), name
    preserved[label] = {"commit": commit, "exactFiles": len(selected)}
for name in ["scripts/qualification/worker_runner_inventory.py", "scripts/qualification/test_worker_runner_hash_deadline.py"]:
    assert (ROOT / name).read_bytes() == git("show", f"{AUTHOR}:{name}"), name

copied_controls = {}
for name in ["hash-deadline-controls.py", "hash-preservation-controls.py"]:
    public = ROOT / "docs/qualification/candidates/native-helper-20261012/review" / name
    assert (HERE / name).read_bytes() == public.read_bytes()
    copied_controls[name] = sha(public.read_bytes())

captures = []
for label in ["maintained", "captured-deadline", "captured-preservation", "helper-data"]:
    data = json.loads((HERE / f"{label}.json").read_text())
    assert data["exitCode"] == 0 and not data["timedOut"]
    assert data["ownedProcessGroupAbsent"]
    try:
        os.killpg(data["ownedPidAndPgid"], 0)
    except ProcessLookupError:
        pass
    else:
        raise AssertionError("owned check group remains")
    for stream in data["streams"]:
        body = (ROOT / stream["path"]).read_bytes()
        assert len(body) == stream["bytes"] and sha(body) == stream["sha256"]
    captures.append({"label": label, "exitCode": 0, "streamHashesVerified": True, "ownedProcessGroupAbsent": True})

private_dir = Path(os.environ["MERI_PRIVATE_MEMBERS"])
private_bodies = [(private_dir / n).read_bytes() for n in ["candidate-hash-and-paths.json", "collect.ps1", "NativeMetadata.cs"]]
candidate = json.loads(private_bodies[0])
personal_paths = set()


def walk(value):
    if isinstance(value, dict):
        for item in value.values():
            walk(item)
    elif isinstance(value, list):
        for item in value:
            walk(item)
    elif isinstance(value, str) and "\\users\\" in value.casefold():
        personal_paths.add(value)


walk(candidate)
assert personal_paths
needles = set()
for path in personal_paths:
    needles.add(path.encode().lower())
    needles.add(json.dumps(path)[1:-1].encode().lower())
changed = sorted((all_files - base_files) | set(existing_changes))
hits = []
for name in changed:
    path = ROOT / name
    if not path.is_file():
        continue
    body = path.read_bytes()
    if any(private in body for private in private_bodies) or any(needle in body.lower() for needle in needles):
        hits.append(name)
assert not hits, hits
diff = subprocess.run(["git", "diff", "--check", BASE], cwd=ROOT, capture_output=True)
assert diff.returncode == 0, "diff whitespace check failed"
receipt = {
    "base": BASE,
    "baseTrackedFiles": len(base_files),
    "baseFilesUnchanged": len(base_files) - len(existing_changes),
    "changedExistingFiles": existing_changes,
    "newFilesAtCheck": len(all_files - base_files),
    "acceptedFilesPreserved": preserved,
    "acceptedSourceAndMaintainedTestExact": True,
    "copiedControls": copied_controls,
    "captureChecks": captures,
    "privacy": {"privateBodiesChecked": len(private_bodies), "personalPathValuesChecked": len(personal_paths), "publicFilesChecked": len(changed), "hits": []},
    "diffCheckPassed": True,
    "scope": "SOURCE_AND_DATA_ONLY_NO_NATIVE_ADMISSION",
}
(HERE / "root-preservation-privacy.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt, indent=2))
