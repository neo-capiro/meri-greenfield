"""Offline packer for one Meri proxy image qualification input.

Writes a deterministic ZIP with:
  repo/<path>              exact Git blobs of COMMIT for apps/proxy/** and the build script
  artifacts/<path>         the 331 assembly-pins.json artifacts, each byte/SHA-256 verified
  context-manifest.json    commit plus SHA-256 of every repo/ member
No network, Docker, AWS or credential use. Refuses an existing output path.
Usage: python -I -B proxy-image-context.py --repository . --commit FULL_SHA --artifacts DIR --output NEW.zip
"""
import argparse, hashlib, io, json, subprocess, sys, tarfile, zipfile
from pathlib import Path

PATHS = ["apps/proxy", "infra/product-preview/proxy-image-build.sh"]
STAMP = (1980, 1, 1, 0, 0, 0)


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--repository", required=True); a.add_argument("--commit", required=True)
    a.add_argument("--artifacts", required=True); a.add_argument("--output", required=True)
    o = a.parse_args()
    if len(o.commit) != 40 or any(c not in "0123456789abcdef" for c in o.commit):
        sys.exit("PROXY_CONTEXT_COMMIT")
    out = Path(o.output)
    if out.exists():
        sys.exit("PROXY_CONTEXT_OUTPUT_EXISTS")
    tar = subprocess.run(["git", "-C", o.repository, "archive", "--format=tar", o.commit, "--", *PATHS],
                         check=True, capture_output=True).stdout
    repo = {}
    with tarfile.open(fileobj=io.BytesIO(tar)) as t:
        for m in t.getmembers():
            if m.isfile():
                repo["repo/" + m.name] = (t.extractfile(m).read(), 0o755 if m.mode & 0o111 else 0o644)
            elif not m.isdir():
                sys.exit("PROXY_CONTEXT_MEMBER_TYPE")
    pins = json.loads(repo["repo/apps/proxy/qualification/linux/assembly-pins.json"][0])
    art = {}
    for p in pins["artifacts"]:
        data = (Path(o.artifacts) / p["path"]).read_bytes()
        if len(data) != p["bytes"] or hashlib.sha256(data).hexdigest() != p["sha256"]:
            sys.exit("PROXY_CONTEXT_ARTIFACT " + p["path"])
        art["artifacts/" + p["path"]] = (data, 0o644)
    extra = [f for f in Path(o.artifacts).rglob("*") if f.is_file()
             and "artifacts/" + f.relative_to(o.artifacts).as_posix() not in art]
    if len(art) != 331 or extra:
        sys.exit("PROXY_CONTEXT_ARTIFACT_SET")
    manifest = {"schemaVersion": 1, "commit": o.commit,
                "files": {k: hashlib.sha256(v[0]).hexdigest() for k, v in sorted(repo.items())}}
    members = {**repo, **art, "context-manifest.json": ((json.dumps(manifest, sort_keys=True, indent=1) + "\n").encode(), 0o644)}
    with open(out, "xb") as f, zipfile.ZipFile(f, "w", zipfile.ZIP_DEFLATED) as z:
        for name in sorted(members):
            info = zipfile.ZipInfo(name, STAMP); info.external_attr = members[name][1] << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, members[name][0])
    data = out.read_bytes()
    print(json.dumps({"status": "PROXY_CONTEXT_SEALED", "commit": o.commit, "zipBytes": len(data),
                      "zipSha256": hashlib.sha256(data).hexdigest(), "repoFiles": len(repo), "artifacts": len(art),
                      "buildScriptSha256": manifest["files"]["repo/infra/product-preview/proxy-image-build.sh"]}))


if __name__ == "__main__":
    main()
