# Native ARM64 runtime image

`apps/runtime/Dockerfile` builds the ordinary runtime image on native Linux
ARM64. The builder is official Node 24.22.1 on Debian trixie; the final base is
Wolfi with its native CPython 3.13.16 packages. Both are pinned to complete ARM64
child-manifest digests in `infra/product-preview/runtime-packages.lock.json`.
The Node image uses the public ECR Docker Library mirror; Wolfi uses Chainguard's
public registry. Node's GNU/Linux binary and the retained native modules require
the actual final-image compatibility probes on Wolfi's glibc.
The Dockerfile rejects a different architecture or runtime version. It retains
the repository's npm locks, Agent SDK 0.3.295 and its CLI 2.1.295. Bedrock uses the
task role through the SDK; no credentials or model endpoint are baked into this image.

Ordinary signed `apk add` installs the exact Bash, native libraries, Python and
pip versions. The package lock records their ARM64 hashes and upstream URLs.
The configured Wolfi repository resolves transitive system dependencies; this
is not a repository snapshot or a custom APK installer. The build retains the
installed package inventory and final image digest. System CA trust is checked
by the actual Python interpreter. npm 12.2.1 is installed from its complete
official hash-pinned tarball; both npm and npx remain available and are probed.
That upstream npm release still bundles vulnerable undici 6.29.0. The build
replaces only that complete package with the checksum-pinned official 6.29.1
tarball for GHSA-xjj6-f33q-929c. It compares all other npm files against the
original tarball and every replacement file against the official undici tarball.
Ordinary tar extraction preserves the package exactly, without npm install's
generated internal `.bin` entries or platform-specific npmrc. The two standard
npm/npx launch symlinks are set explicitly outside the npm package.
Both build and final-image probes verify node-gyp resolves that version within
its existing dependency range. This is an explicit image packaging correction,
not a claim that npm has published a fixed release.

Python uses standard offline pip installation with `--require-hashes`,
`--only-binary=:all:` and `pip check`. The 22 retained PyPI wheels total
57,939,153 bytes. All compiled wheels are CPython 3.13 manylinux AArch64;
universal wheels are architecture independent. The wheel lock records the
upstream URL, size and SHA256 of every archive. The set retains the former
image's Python libraries and adds the pandas/pypdf dependencies already used
by the canonical artifact source and worker requirements. It supports document,
spreadsheet, presentation, chart and typed table-analysis generation. Pillow is
13.0.0; pypdf 6.21.2 includes the upstream PDF parsing fixes. pip installs these
application libraries in the image's standard
`/usr/lib/python3.13/site-packages`; `--break-system-packages` explicitly permits
that build-time installation into Wolfi's managed interpreter. The pinned set
does not replace pip or its distribution dependencies. Native probes check the
installation path, exact library versions and every import. PptxGenJS retains
its canonical generator with a scoped image-size 2.0.4 dependency override.

The old x86 Wolfi APK installation helpers and tracked payload are retired.
Historical receipts in `infra/product-preview/runtime-packages` remain history;
they do not qualify this image. SWC's actual upstream loader materializes its
native addon at build time, then verifies a second load without an executable
runtime cache. The extracted addon is root-owned and mode `0444`, so the final
UID1000 process can read it without gaining write access. The final-image probe
must pass under that UID on the read-only root. There is no launch descriptor or
custom runtime measurement.

Source checks, without containers or model calls:

```sh
node --test apps/runtime/build/runtime-base-probe.test.mjs apps/runtime/build/runtime-packages.test.mjs apps/runtime/build/npm-bundle.test.mjs
```

Root schedules the native build and final-image checks. Build on a native ARM64
worker; `--platform` alone is not evidence of native execution:

```sh
docker build --platform linux/arm64 -f apps/runtime/Dockerfile -t meri-runtime:arm64 .
docker run --rm --platform linux/arm64 --read-only --user 1000:1000 \
  --network none --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 256 --memory 2g \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=256m,mode=1777 \
  --tmpfs /workspace:rw,nosuid,nodev,noexec,size=64m,uid=1000,gid=1000,mode=0700 \
  --tmpfs /run/meri:rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=0700 \
  --tmpfs /run/meri-temporal:rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=0700 \
  --entrypoint node meri-runtime:arm64 apps/runtime/build/runtime-base-probe.mjs --check
```

Run the same container command with the final argument replaced by
`infra/product-preview/runtime-packages/executor-generation-smoke.mjs` (without
`--check`). This executes the real fixed artifact executor for TXT, DOCX, XLSX,
PPTX and analysis ZIP, including charts, tables, formulas and speaker notes. It
checks the real UID/GID and read-only mount before generation. Neither check
starts a service, connects a database or makes a model query. Import checks
exercise the real SWC, Temporal bridge, SDK, CLI, all locked Python packages,
NumPy/pandas computation and system CA store. Node's standard trust is extended
with the existing pinned Amazon RDS public bundle.

Office/PDF rendering is still the existing separate `officeTransformer`
service; this image neither replaces nor silently disables that integration.
Generating OOXML does not establish native Office rendering, recalculation or
visual correctness. Those require the existing renderer and application gates.

Release qualification also requires the final installed ARM64 image's ECR and
Trivy results, with **zero HIGH/CRITICAL findings and no exclusions**, plus the
current runtime/application gates. Windows source checks, base metadata and
older x86 receipts are insufficient. A failing installed-image scan requires
repair before deployment; no package metadata is removed or findings excluded.

Primary provenance: [Node image source](https://github.com/nodejs/docker-node),
[Wolfi](https://edu.chainguard.dev/open-source/wolfi/),
[pip secure installs](https://pip.pypa.io/en/stable/topics/secure-installs/),
[Wolfi ARM64 package index](https://packages.wolfi.dev/os/aarch64/APKINDEX.tar.gz).
Exact base tag metadata URLs and retrieval date are retained in the package lock;
each wheel's original PyPI URL and hash are retained in the wheel lock.
