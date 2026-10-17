"""Offline, streaming, deterministic packer for one Temporal derivative image (D3) build input.

Writes a ZIP with exactly:
  repo/<path>                    exact Git blobs of COMMIT for MEMBERS (each blob SHA-1 re-verified)
  inputs/temporal-issuer-ca.pem  the public issuer CA PEM baked into the image (bytes as given)
  context-manifest.json          commit, SHA-256 of every other member, base pins, issuer CA SHA-256

Streaming: blobs are piped from `git cat-file blob` in 1 MiB blocks, twice (hash pass, then
write pass, compared); neither a blob nor the ZIP is ever held whole in memory.
Deterministic: sorted members, fixed 1980-01-01 timestamps, Unix create_system and modes,
DEFLATE level 6, no comment and no data descriptors (seekable output). DEFLATE bytes depend
on the zlib build, so seal with `python3` (CPython 3.14, zlib-ng) for a reproducible SHA-256;
the result records the zlib runtime used.
No network, Docker, AWS or credential use. Refuses an existing output path; removes a partial one.
Usage: python3 -I -B temporal-image-context.py --repository . --commit FULL_SHA \
         --issuer-ca CA.pem --output NEW.zip
"""
import argparse, hashlib, json, re, subprocess, sys, zipfile, zlib
from pathlib import Path

D = "infra/product-preview/"
BUILD_SCRIPT = D + "temporal-image-build.sh"
DOCKERFILE = D + "temporal-launch.Dockerfile"
LOCK = D + "runtime-packages.lock.json"
INDEX = D + "runtime-packages/x86_64/APKINDEX.tar.gz"
LIBSTDCXX = D + "runtime-packages/x86_64/libstdc++-16.2.0-r1.apk"
MEMBERS = sorted([DOCKERFILE, BUILD_SCRIPT, LOCK, INDEX, LIBSTDCXX, D + "temporal-launch.sh",
                  D + "temporal-launch-main.mjs", D + "temporal-launch-render.mjs", D + "temporal-migration-plan.mjs"])
CA_MEMBER = "inputs/temporal-issuer-ca.pem"
BASES = {
    "nodeBinary": "public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63",
    "glibcRuntime": "cgr.dev/chainguard/wolfi-base@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4",
    "temporalServer": "temporalio/server@sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e",
}
STAMP = (1980, 1, 1, 0, 0, 0)
BLOCK = 1024 ** 2
LIMIT = 64 * 1024 ** 2


class Refused(Exception):
    pass


def need(ok, code):
    if not ok:
        raise Refused("TEMPORAL_CONTEXT_" + code)


def git(repository, *args):
    r = subprocess.run(["git", "-C", str(repository), *args], capture_output=True, timeout=60)
    need(r.returncode == 0, "GIT")
    return r.stdout


def entries(repository, commit):
    need(git(repository, "rev-parse", "--verify", commit + "^{commit}").decode().strip() == commit, "COMMIT")
    rows = {}
    for row in git(repository, "ls-tree", "-lz", "--full-tree", commit, "--", *MEMBERS).split(b"\0"):
        if not row:
            continue
        header, path = row.split(b"\t", 1)
        mode, kind, oid, size = header.decode().split()
        need(kind == "blob" and mode in ("100644", "100755") and re.fullmatch(r"[0-9a-f]{40}", oid)
             and size.isdecimal() and int(size) <= LIMIT, "MEMBER_TYPE")
        rows[path.decode()] = (mode, oid, int(size))
    need(sorted(rows) == MEMBERS, "MEMBER_SET")
    return rows


def stream_blob(repository, oid, size, sink=None):
    """Stream one blob; return its SHA-256 after proving length and Git SHA-1."""
    git1, sha = hashlib.sha1(b"blob %d\0" % size), hashlib.sha256()
    total = 0
    p = subprocess.Popen(["git", "-C", str(repository), "cat-file", "blob", oid],
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        while block := p.stdout.read(BLOCK):
            total += len(block)
            need(total <= size, "BLOB_BYTES")
            git1.update(block); sha.update(block)
            if sink is not None:
                sink(block)
    finally:
        p.stdout.close()
        code = p.wait(timeout=60)
    need(code == 0 and total == size and git1.hexdigest() == oid, "BLOB_BYTES")
    return sha.hexdigest()


def read_ca(path):
    data = Path(path).read_bytes() if Path(path).stat().st_size <= 32768 else b""
    text = data.decode("ascii", "replace")
    need(80 <= len(data) <= 32768 and data.isascii() and text.startswith("-----BEGIN CERTIFICATE-----\n")
         and text.rstrip().endswith("-----END CERTIFICATE-----") and text.count("-----BEGIN ") == 1, "ISSUER_CA")
    return data


def seal(repository, commit, issuer_ca, output):
    need(re.fullmatch(r"[0-9a-f]{40}", commit) is not None, "COMMIT")
    out = Path(output)
    need(not out.exists(), "OUTPUT_EXISTS")
    rows = entries(repository, commit)
    ca = read_ca(issuer_ca)
    small, files = {}, {}
    for path in MEMBERS:
        mode, oid, size = rows[path]
        # Only the two small text files are retained for checks; never the APK inputs.
        chunks = [] if path in (DOCKERFILE, LOCK) else None
        need(chunks is None or size <= 1024 ** 2, "MEMBER_BOUND")
        files["repo/" + path] = stream_blob(repository, oid, size, None if chunks is None else chunks.append)
        if chunks is not None:
            small[path] = b"".join(chunks)
    lock = json.loads(small[LOCK])
    lib = [p for p in lock["additionalPackages"] if p["file"] == Path(LIBSTDCXX).name]
    need(lock["repositoryIndex"]["sha256"] == files["repo/" + INDEX] and len(lib) == 1
         and lib[0]["sha256"] == files["repo/" + LIBSTDCXX], "LOCK_PIN")
    dockerfile = small[DOCKERFILE].decode("utf-8")
    froms = [line.split()[2] for line in dockerfile.splitlines() if line.startswith("FROM ")]
    need(froms == [BASES["nodeBinary"], BASES["glibcRuntime"], BASES["temporalServer"]], "BASE_PIN")
    need(all(h in dockerfile for h in (files["repo/" + INDEX], files["repo/" + LIBSTDCXX])), "LOCK_PIN")
    files[CA_MEMBER] = hashlib.sha256(ca).hexdigest()
    manifest = {"schemaVersion": 1, "commit": commit, "bases": BASES, "issuerCaSha256": files[CA_MEMBER],
                "files": dict(sorted(files.items()))}
    manifest_bytes = (json.dumps(manifest, sort_keys=True, indent=1) + "\n").encode()

    def info(name, mode):
        z = zipfile.ZipInfo(name, STAMP)
        z.create_system = 3
        z.external_attr = (0o100000 | mode) << 16
        z.compress_type = zipfile.ZIP_DEFLATED
        z._compresslevel = 6  # explicit; a ZipInfo does not inherit the archive level
        return z

    try:
        with open(out, "xb") as f, zipfile.ZipFile(f, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for name in sorted(["context-manifest.json", CA_MEMBER, *("repo/" + p for p in MEMBERS)]):
                if name == "context-manifest.json":
                    z.writestr(info(name, 0o644), manifest_bytes)
                elif name == CA_MEMBER:
                    z.writestr(info(name, 0o644), ca)
                else:
                    mode, oid, size = rows[name[5:]]
                    member = info(name, 0o755 if mode == "100755" else 0o644)
                    member.file_size = size
                    with z.open(member, "w") as w:
                        need(stream_blob(repository, oid, size, w.write) == files[name], "BLOB_CHANGED")
    except BaseException:
        out.unlink(missing_ok=True)
        raise
    with open(out, "rb") as f:
        zip_sha = hashlib.file_digest(f, "sha256").hexdigest()
    return {"status": "TEMPORAL_CONTEXT_SEALED", "commit": commit, "zipBytes": out.stat().st_size, "zipSha256": zip_sha,
            "members": len(files) + 1, "buildScriptSha256": files["repo/" + BUILD_SCRIPT],
            "issuerCaSha256": files[CA_MEMBER], "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
            "bases": BASES, "zlibRuntime": zlib.ZLIB_RUNTIME_VERSION, "python": sys.version.split()[0]}


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--repository", required=True); a.add_argument("--commit", required=True)
    a.add_argument("--issuer-ca", required=True); a.add_argument("--output", required=True)
    o = a.parse_args()
    try:
        print(json.dumps(seal(o.repository, o.commit, o.issuer_ca, o.output), sort_keys=True))
    except Refused as e:
        sys.exit(str(e))
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        sys.exit("TEMPORAL_CONTEXT_REFUSED")


if __name__ == "__main__":
    main()
