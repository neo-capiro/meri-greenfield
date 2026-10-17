"""Offline source-pin/blob verifier. No installs, imports, cloud calls or writes."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[4]
PACKET = Path(__file__).resolve().parent
ENV = dict(os.environ, GIT_NO_LAZY_FETCH="1", GIT_TERMINAL_PROMPT="0")

def git(*args):
    p = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, env=ENV)
    if p.returncode:
        raise SystemExit("VERIFY_REFUSED: required authenticated Git object unavailable; fetch the exact documented ref first")
    return p.stdout

def main():
    if not __debug__:
        raise SystemExit("VERIFY_REFUSED: Python assertion optimization is enabled")
    source = json.loads((PACKET / "ROOT-SOURCE.json").read_text(encoding="utf-8"))
    pin = source["sourceCommit"]
    assert git("rev-parse", pin + "^{tree}").decode().strip() == source["sourceTree"]
    git("merge-base", "--is-ancestor", pin, "HEAD")
    for item in source["changedFiles"]:
        blob = git("rev-parse", pin + ":" + item["path"]).decode().strip()
        assert blob == item["gitBlob"], item["path"]
        data = git("cat-file", "blob", blob)
        assert len(data) == item["bytes"] and hashlib.sha256(data).hexdigest() == item["sha256"], item["path"]
    receiving = json.loads((PACKET / "ISSUER130-RECEIVING.json").read_text(encoding="utf-8"))
    for item in receiving["files"]:
        assert git("rev-parse", pin + ":" + item["path"]).decode().strip() == item["sha"], item["path"]
        assert hashlib.sha256(git("cat-file", "blob", item["sha"])).hexdigest() == item["sha256"], item["path"]
    required = ["README.md", "ARCHITECTURE-AND-RESUME.md", "STATE-AND-GATES.md", "CHECKS.json",
                "LANES.md", "LANE-SUPPLEMENTS.json", "REMOTE-PRS.json", "PROXY-REVIEW.md"]
    for name in required:
        assert (PACKET / name).is_file(), name
    print(json.dumps({"state":"PASS_SOURCE_OBJECTS_ONLY", "sourceCommit":pin,
                      "sourceFiles":len(source["changedFiles"]), "issuerFiles":len(receiving["files"]),
                      "applicationTestsRun":False, "liveActions":0}))

if __name__ == "__main__":
    main()
