#!/usr/bin/env python3
"""Review mutation runner (not for commit). One container per language; the tree is copied in once (root-owned, go-w),
each mutation edits exactly one line as root, the tests run as the image user, then the file is restored.
Usage: mutate.py {py|node} IMAGE SOURCE_DIR SPEC_JSON OUT_JSON"""
import json, subprocess, sys

lang, image, source, spec_path, out_path = sys.argv[1:6]
specs = [s for s in json.load(open(spec_path)) if s["lang"] == lang]
name = f"p2a-mut-{lang}"
sh = lambda *a, **k: subprocess.run(a, capture_output=True, text=True, **k)
sh("docker", "rm", "-f", name)
if lang == "py":
    sh("docker", "run", "-d", "--name", name, "--network", "none", "--user", "0", "--entrypoint", "sleep", image, "14400", check=True)
    archive = subprocess.Popen(["git", "-C", source, "-c", "tar.umask=0022", "archive", "HEAD"], stdout=subprocess.PIPE)
    subprocess.run(["docker", "exec", "-i", "--user", "0", name, "sh", "-c",
                    "mkdir -p /src && cd /src && tar -xf - && chown -R root:root /src && chmod -R go-w /src"], stdin=archive.stdout, check=True)
    root, user = "/src", "10001"
    run = lambda tests: ["timeout", "900", "/opt/meri-proxy-venv/bin/python", "-B", "-m", "unittest", *tests]
    env = ["--env", "AWS_EC2_METADATA_DISABLED=true"]
else:
    sh("docker", "run", "-d", "--name", name, "--network", "none", "--memory", "3g", "--user", "0", "--entrypoint", "sh", image, "-c", "sleep 14400", check=True)
    archive = subprocess.Popen(["git", "-C", source, "-c", "tar.umask=0022", "archive", "HEAD"], stdout=subprocess.PIPE)
    subprocess.run(["docker", "exec", "-i", "--user", "0", name, "sh", "-c", "cd /opt/meri && tar -xf -"], stdin=archive.stdout, check=True)
    sh("docker", "exec", "--user", "0", name, "sh", "-c",
       "find /opt/meri/apps /opt/meri/packages /opt/meri/infra /opt/meri/docs /opt/meri/scripts -name node_modules -prune -o -exec chown 1000:1000 {} +")
    root, user = "/opt/meri", "1000"
    run = lambda tests: ["timeout", "900", "node", "--experimental-test-module-mocks", "--test", "--test-concurrency=1", "--test-reporter=tap", *tests]
    env = ["--env", f"MERI_REVIEW_SOURCE_ROOT={root}"]

def execute(tests):
    r = sh("docker", "exec", "--user", user, "--workdir", root, *env, name, *run(tests))
    out = r.stdout + r.stderr
    if lang == "py":
        failed = [l.split(" ... ")[0].strip() for l in out.splitlines() if l.endswith(("FAIL", "ERROR")) and " ... " in l]
        failed += [l.strip() for l in out.splitlines() if l.startswith(("FAIL: ", "ERROR: "))]
    else:
        failed = [l.strip() for l in out.splitlines() if l.lstrip().startswith("not ok ")]
    return r.returncode, sorted(set(failed)), out[-1500:]

results = []
tests_all = sorted({t for s in specs for t in s["tests"]})
code, failed, tail = execute(tests_all)
results.append({"id": "UNMUTATED-baseline", "exit": code, "failed": failed, "tail": tail if code else ""})
for s in specs:
    path = f"{root}/{s['file']}"
    edit = ("import sys;p,l,o,n=sys.argv[1],int(sys.argv[2]),sys.argv[3],sys.argv[4];L=open(p).read().split(chr(10));"
            "assert L[l-1].count(o)==1,('anchor',L[l-1]);L[l-1]=L[l-1].replace(o,n);open(p,'w').write(chr(10).join(L))")
    py = "/opt/meri-proxy-venv/bin/python" if lang == "py" else "python3"
    sh("docker", "exec", "--user", "0", name, "cp", path, path + ".orig")
    if lang == "node":
        applied = sh("docker", "exec", "--user", "0", name, "node", "-e",
                     "const fs=require('fs');const [p,l,o,n]=process.argv.slice(1);const L=fs.readFileSync(p,'utf8').split('\\n');"
                     "if(L[l-1].split(o).length!==2){console.error('anchor',L[l-1]);process.exit(9);}L[l-1]=L[l-1].replace(o,n);fs.writeFileSync(p,L.join('\\n'));",
                     path, str(s["line"]), s["old"], s["new"])
    else:
        applied = sh("docker", "exec", "--user", "0", name, py, "-c", edit, path, str(s["line"]), s["old"], s["new"])
    if applied.returncode != 0:
        results.append({"id": s["id"], "error": "mutation not applied", "detail": applied.stderr[-400:]})
    else:
        code, failed, tail = execute(s["tests"])
        results.append({"id": s["id"], "file": s["file"], "line": s["line"], "edit": f"{s['old']} -> {s['new']}",
                        "exit": code, "killed": code != 0 and bool(failed), "failed": failed[:12]})
    sh("docker", "exec", "--user", "0", name, "mv", path + ".orig", path)
    json.dump(results, open(out_path, "w"), indent=1)
code, failed, tail = execute(tests_all)
results.append({"id": "RESTORED-final", "exit": code, "failed": failed})
json.dump(results, open(out_path, "w"), indent=1)
sh("docker", "rm", "-f", name)
print(json.dumps([{k: r.get(k) for k in ("id", "exit", "killed", "failed", "error")} for r in results], indent=1))
