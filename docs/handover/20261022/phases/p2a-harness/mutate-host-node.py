#!/usr/bin/env python3
"""Review mutation runner, Node on the WSL host (not for commit). The runtime image has no openssl CLI, which
owner-https-tls.test.mjs needs (P2-PLAN §13.4), so the Node mutations run on a scratch copy of the installed head tree.
Each mutation edits exactly one line, runs its tests, then the file is restored.
Usage: mutate-host-node.py SCRATCH_TREE SPEC_JSON OUT_JSON"""
import json, os, shutil, subprocess, sys

root, spec_path, out_path = sys.argv[1:4]
specs = [s for s in json.load(open(spec_path)) if s["lang"] == "node"]

def execute(tests):
    r = subprocess.run(["timeout", "900", "node", "--experimental-test-module-mocks", "--test", "--test-concurrency=1",
                        "--test-reporter=tap", *tests], cwd=root, capture_output=True, text=True)
    out = r.stdout + r.stderr
    failed = [l.strip() for l in out.splitlines() if l.lstrip().startswith("not ok ")]
    return r.returncode, sorted(set(failed)), out[-1500:]

results = []
tests_all = sorted({t for s in specs for t in s["tests"]})
code, failed, tail = execute(tests_all)
results.append({"id": "UNMUTATED-baseline", "exit": code, "failed": failed, "tail": tail if code else ""})
for s in specs:
    path = os.path.join(root, s["file"])
    shutil.copy2(path, path + ".orig")
    lines = open(path).read().split("\n")
    if lines[s["line"] - 1].count(s["old"]) != 1:
        results.append({"id": s["id"], "error": "mutation not applied", "detail": lines[s["line"] - 1][:300]})
    else:
        lines[s["line"] - 1] = lines[s["line"] - 1].replace(s["old"], s["new"])
        open(path, "w").write("\n".join(lines))
        code, failed, tail = execute(s["tests"])
        results.append({"id": s["id"], "file": s["file"], "line": s["line"], "edit": f"{s['old']} -> {s['new']}",
                        "exit": code, "killed": code != 0 and bool(failed), "failed": failed[:12]})
    shutil.move(path + ".orig", path)
    json.dump(results, open(out_path, "w"), indent=1)
code, failed, tail = execute(tests_all)
results.append({"id": "RESTORED-final", "exit": code, "failed": failed})
json.dump(results, open(out_path, "w"), indent=1)
print(json.dumps([{k: r.get(k) for k in ("id", "exit", "killed", "failed", "error")} for r in results], indent=1))
