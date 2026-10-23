# Native ARM64 runtime image

`apps/runtime/Dockerfile` builds the ordinary runtime image on native Linux
ARM64. The builder is official Node 24.22.1 on Debian trixie; the final base is
official CPython 3.13.16 on the same distribution. Both are pinned to complete
ARM64 child-manifest digests in `infra/product-preview/runtime-packages.lock.json`.
The default pulls use the public ECR Docker Library mirror with those same child
digests; the upstream tag metadata remains the recorded source provenance.
The Dockerfile rejects a different architecture or runtime version. It retains
the repository's npm locks, Agent SDK 0.3.295 and its CLI 2.1.295. Bedrock uses the
task role through the SDK; no credentials or model endpoint are baked into this image.

The three explicit Debian runtime packages use exact versions. Their ARM64
package hashes and upstream URLs are recorded in the package lock. The final
image retains `ca-certificates` from its digest-pinned Python base: the former
explicit `20250419` pin was older than that base's installed package and caused
APT to refuse a downgrade. No downgrade is enabled. The existing final-image
probe checks the system CA store. Apt still
resolves their system dependencies against the configured Debian repository;
this is not a snapshot of the entire Debian repository. Preserve the installed
package inventory and exact image digest with each qualification result.

Python uses standard offline pip installation with `--require-hashes`,
`--only-binary=:all:` and `pip check`. The 22 retained PyPI wheels total
57,680,925 bytes. All compiled wheels are CPython 3.13 manylinux AArch64;
universal wheels are architecture independent. The wheel lock records the
upstream URL, size and SHA256 of every archive. The set retains the former
image's Python libraries and adds the pandas/pypdf dependencies already used
by the canonical artifact source and worker requirements. It supports document,
spreadsheet, presentation, chart and typed table-analysis generation.

The old x86 Wolfi APK installation helpers and tracked payload are retired.
Historical receipts in `infra/product-preview/runtime-packages` remain history;
they do not qualify this image. SWC's actual upstream loader materializes its
native addon at build time, then verifies a second load without an executable
runtime cache. There is no launch descriptor or custom runtime measurement.

Source checks, without containers or model calls:

```sh
node --test apps/runtime/build/runtime-base-probe.test.mjs apps/runtime/build/runtime-packages.test.mjs
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
older x86 receipts are insufficient. A failing Debian scan requires an image
repair or a new base selection before deployment.

Primary provenance: [Node image source](https://github.com/nodejs/docker-node),
[Python image source](https://github.com/docker-library/python),
[pip secure installs](https://pip.pypa.io/en/stable/topics/secure-installs/),
[Debian ARM64 package index](https://deb.debian.org/debian/dists/trixie/main/binary-arm64/Packages.xz).
Exact base tag metadata URLs and retrieval date are retained in the package lock;
each wheel's original PyPI URL and hash are retained in the wheel lock.
