#!/usr/bin/env python3
"""Review run (not for commit): every proxy Python module, ONE PROCESS PER MODULE, in a given image, as uid 10001 on a
root-owned go-w copy of the committed tree (same as the P0 harness), with AWS_EC2_METADATA_DISABLED=true (ECS sets it at
the task level). Usage: proxy-modules.py IMAGE SOURCE_DIR OUT_JSON"""
import json, re, subprocess, sys

image, source, out = sys.argv[1:4]
name = "p2a-proxy-modules"
sh = lambda *a, **k: subprocess.run(a, capture_output=True, text=True, **k)
sh("docker", "rm", "-f", name)
sh("docker", "run", "-d", "--name", name, "--network", "none", "--user", "0", "--entrypoint", "sleep", image, "14400", check=True)
archive = subprocess.Popen(["git", "-C", source, "-c", "tar.umask=0022", "archive", "HEAD"], stdout=subprocess.PIPE)
subprocess.run(["docker", "exec", "-i", "--user", "0", name, "sh", "-c",
                "mkdir -p /src && cd /src && tar -xf - && chown -R root:root /src && chmod -R go-w /src"], stdin=archive.stdout, check=True)
files = sh("git", "-C", source, "ls-files", "apps/proxy/product/test/test_*.py", "apps/proxy/product/test_*.py",
           "apps/proxy/qualification/test/test_*.py").stdout.split()
result = {"image": image, "modules": {}}
for path in files:
    module = path[:-3].replace("/", ".")
    r = sh("docker", "exec", "--user", "10001", "--workdir", "/src", "--env", "AWS_EC2_METADATA_DISABLED=true", name,
           "timeout", "600", "/opt/meri-proxy-venv/bin/python", "-B", "-m", "unittest", "-v", module)
    text = r.stdout + r.stderr
    ran = re.search(r"^Ran (\d+) tests?", text, re.M)
    skipped = re.search(r"skipped=(\d+)", text)
    bad = sorted(set(m.group(1) for m in re.finditer(r"^(?:ERROR|FAIL): (.+)$", text, re.M)))
    result["modules"][module] = {"exit": r.returncode, "ran": int(ran.group(1)) if ran else None,
                                 "skipped": int(skipped.group(1)) if skipped else 0, "failed": bad,
                                 "tail": "" if r.returncode == 0 else text[-600:]}
    json.dump(result, open(out, "w"), indent=1)
sh("docker", "rm", "-f", name)
mods = result["modules"].values()
print(json.dumps({"modules": len(result["modules"]), "ran": sum(m["ran"] or 0 for m in mods),
                  "failedModules": sum(1 for m in mods if m["exit"] != 0), "failedTests": sum(len(m["failed"]) for m in mods),
                  "skipped": sum(m["skipped"] for m in mods)}))
