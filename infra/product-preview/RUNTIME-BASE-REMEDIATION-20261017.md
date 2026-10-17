# Runtime base remediation evidence — 2026-10-17

## Status and scope

**HOLD for image qualification and activation.** This report classifies the three HIGH operating-system findings in the previous worker image and records a concrete GNU runtime candidate. It does not claim that the candidate image exists, that its native checks passed, or that ECR has reported a clean scan. The acceptance rule remains scan `COMPLETE` with **zero HIGH and zero CRITICAL**, without exceptions, package relabeling, or version substitutions.

Source baseline: `6fd48c9c3d49962a111e7f801f9f71ad06a7f1c9` on draft PR #101. The failed image was built from `38f52df94b1738649776792b2a28aac743801c19`:

- Repository: `meri-greenfield/qualification-worker`.
- Image identity: `sha256:e318ab002a9f1dfb86245c352d2f521f09c66086f31d9ffd92f08cbf39f0b236`.
- Complete scan: HIGH 3, MEDIUM 9, LOW 3. Its three HIGH attributes name the source package versions below. The basic scan does not supply a fixed-version attribute or an exact binary-package dependency graph.

Implementation outline: retain the exact official Node builder and binary provenance; place the owned application and Node `/usr/local` in a separately pinned GNU runtime; install only the four locked additions through an authenticated offline repository; bind both base identities and the raw package lock into source/build/receipt verification; then qualify actual native behavior and the exact final image scan. The root owner implements and reviews those source changes. This report does not authorize publication, another paid build, or activation.

## Classification of the three findings

| Finding | Failed image package | Distribution fix evidence | Actual candidate package and conclusion |
| --- | --- | --- | --- |
| CVE-2026-85091, HIGH, CVSS 4 score 8.3 | `zlib` `1.3.dfsg+really1.3.1-1` | Debian stable Bookworm/Trixie remain vulnerable; no stable fixed package is listed. Wolfi's x86_64 advisory records fixed `1.3.2.1_rc20260601-r0`. Upstream fix is `df84af25dc1942490e1d1c899a07619152a46148`. | The pinned base actually contains `zlib` `1.3.2.1_rc20260921-r0`. Its SBOM source `767c4c947852e143f582c85f14cf573411df1b35` is 23 commits ahead of, and zero behind, that exact upstream fix; the merge base is the fix itself. This is concrete package/source remediation evidence, pending final image qualification. |
| CVE-2026-19499, HIGH, CVSS 3 score 7.7 | `glibc` `2.41-12+deb13u4` | Debian stable remains vulnerable; its tracker records first fixed unstable version `2.43-5`. Wolfi's x86_64 `glibc-2.44` advisory records fixed `2.44-r4`. | The pinned base actually contains `glibc-2.44`, its loader, POSIX locale and `libcrypt1-2.44` at `2.44-r8`. That is after the recorded Wolfi fix. Its recipe/source pins are recorded below. |
| CVE-2026-5435, HIGH, CVSS 3 score 7.3 | `glibc` `2.41-12+deb13u4` | Debian stable remains vulnerable; its tracker records first fixed unstable version `2.43-3`. Upstream commit `ca44a6609c29a683b03575fa035c6d17aa591e72` removes the buggy TSIG implementation and identifies bug 34033/CVE-2026-5435. GNU's 2.44 release announcement lists bug 34033 as resolved. | Actual `glibc-2.44` `2.44-r8` is built from stable source `34106fee698c83eb0af71d4d0381e66b399be746`. An accepted OpenEmbedded patch pins that exact same source and records this CVE fixed in the used hash. No exact Wolfi first-fixed revision for this CVE was independently established; none is invented here. Direct `ca44…` to `34106…` Git ancestry was not independently measured. |

Primary evidence:

- Debian: [zlib tracker](https://security-tracker.debian.org/tracker/CVE-2026-85091), [glibc 19499 tracker](https://security-tracker.debian.org/tracker/CVE-2026-19499), [glibc 5435 tracker](https://security-tracker.debian.org/tracker/CVE-2026-5435). A newer unstable fixed package is not a stable-image patch.
- Vendor records: [Wolfi zlib x86_64 record](https://api.osv.dev/v1/vulns/CGA-6ph6-75jp-484p), [Wolfi glibc-2.44 x86_64 record](https://api.osv.dev/v1/vulns/CGA-mmr3-52h6-3hmm). Their affected records explicitly name ecosystem Wolfi and x86_64 package URLs.
- Upstream zlib: [exact fix](https://github.com/madler/zlib/commit/df84af25dc1942490e1d1c899a07619152a46148), [fix-to-selected-source comparison](https://api.github.com/repos/madler/zlib/compare/df84af25dc1942490e1d1c899a07619152a46148...767c4c947852e143f582c85f14cf573411df1b35).
- GNU glibc: [2.44 release announcement, resolved bug 34033](https://sourceware.org/pipermail/libc-alpha/2026-July/179159.html), [upstream fix mirrored at its exact commit](https://github.com/bminor/glibc/commit/ca44a6609c29a683b03575fa035c6d17aa591e72).
- Distribution source corroboration: [accepted OpenEmbedded stable 2.44 update](https://patchwork.yoctoproject.org/project/oe-core/patch/20261008061136.6429-1-peter.marko%40siemens.com/) pins `34106fee…` and records 5435 fixed in that used source. This is maintainer evidence, not a locally executed reproducer.

The system zlib finding and any zlib bundled into Node are separate evidence questions. Tagged Node v24.21.0 source declares bundled `1.3.2.1-motley`; the inspected gzwrite source does not show the exact upstream pointer-reset correction. Actual inclusion/reachability in the selected Node executable has not been established here. This is an unresolved native source/build closure question for the source/security owner, **not** a proven additional image vulnerability, a waiver, or an automatic instruction to upgrade Node. See [Node's pinned zlib header](https://github.com/nodejs/node/blob/v24.21.0/deps/zlib/zlib.h) and [gzwrite source](https://github.com/nodejs/node/blob/v24.21.0/deps/zlib/gzwrite.c).

## Two immutable bases; Node 24.21.0 retained

Builder and Node provenance remain:

`public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63`

The candidate runtime is Linux amd64:

`cgr.dev/chainguard/wolfi-base@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4`

Public manifest/config bytes were hash checked. The multi-platform index is `sha256:256c88bb066424045021090932d50be93c8e3f2ce3586707702a401b146f3e43`; amd64 config is `sha256:5e6dc9eae7ee10765abf01a6a6c23ca43b988b85289ef69e08e04462befa4f8b`. The SPDX envelope blob is `sha256:de2ae061360f188f8c05c598ad03ce72a49e0c772a62adb0d279af6896b4f59f`, and its decoded subject matches the selected amd64 digest. The DSSE/cosign signature was not independently verified by this research. The parent separately read the actual pinned-base APK database and confirmed its 19 package pairs match the SBOM inventory.

GNU compatibility is required by `apps/runtime/build/materialize-swc.mjs`: it intentionally selects exact `@swc/core-linux-x64-gnu` 1.16.18 and production Node v24.21.0. Temporal core bridge 1.24.0 is also native. The proposal preserves those selected components and `/usr/local/bin/node`; it does not substitute Node 26 or a musl runtime. Preserve UID/GID 1000, the owned application, `/run/meri` ownership/mode, read-only runtime, and the existing noexec temporary filesystem checks.

The closed recipe/request/source verifier must distinguish the original Node builder digest from the new final runtime digest. Both identities and the exact raw lock SHA must be bound into build inputs, provenance labels, producer receipts and the comparator. The final package-set hash must be measured from the final image's installed name/version pairs, not merely copied from this document or the lock.

Frozen raw package lock: `runtime-packages.lock.json`, SHA-256 **`5c7724e6c9837dabc3146256aa55b3dce2230d10de5a2ff7c479f519aafb3ac9`**. No APK package names or versions are to be changed to influence scan matching.

## Actual pinned runtime inventory

The base supplies these exact 19 APK pairs:

| Package | Version |
| --- | --- |
| apk-tools | 2.14.10-r17 |
| busybox | 1.38.0-r3 |
| ca-certificates-bundle | 20260909-r2 |
| glibc-2.44 | 2.44-r8 |
| glibc-2.44-locale-posix | 2.44-r8 |
| ld-linux-2.44 | 2.44-r8 |
| libbrotlicommon1 | 1.2.0-r6 |
| libbrotlidec1 | 1.2.0-r6 |
| libbrotlienc1 | 1.2.0-r6 |
| libcrypt1-2.44 | 2.44-r8 |
| libgcc | 16.2.0-r1 |
| libxcrypt | 4.5.2-r6 |
| openssl-4.0-libcrypto | 4.0.3-r6 |
| openssl-4.0-libssl | 4.0.3-r6 |
| openssl-provider-legacy-allowed | 4.0.3-r1 |
| wolfi-base | 1-r7 |
| wolfi-baselayout | 20230201-r30 |
| wolfi-keys | 1-r13 |
| zlib | 1.3.2.1_rc20260921-r0 |

SBOM recipe commits: glibc `3f73ace7dd5a203b7d080fd633d056d763e6760c`, upstream `34106fee698c83eb0af71d4d0381e66b399be746`; zlib `75278be0abfe311aedfbf7c3933f6f0b819980e6`, upstream `767c4c947852e143f582c85f14cf573411df1b35`.

The base lacks bash and libstdc++. The exact available additions, verified from the same public index and downloaded without installation, are:

| APK filename | Bytes | SHA-256 |
| --- | ---: | --- |
| bash-5.3-r14.apk | 784966 | `28274b1abce489dd947e0b517935992a3b069647b7f3a4d8eb95bb262c0751d1` |
| libstdc++-16.2.0-r1.apk | 1260650 | `fc233c091aa551d6ba6da3e444d99a94e9947d53814d20183a0a7ded9a668f80` |
| ncurses-6.6.20261010-r0.apk | 625682 | `475d8c2ec463637844149030a9cc3fc607782cfe681e3c16f80d2a6bc940bb63` |
| ncurses-terminfo-base-6.6.20261010-r0.apk | 119342 | `fac2c47f1e85175a8cb6842c374b5462aa8a10d548b5d602d28ee7829b00a751` |

Public download prefix: `https://packages.wolfi.dev/os/x86_64/`. Total addition bytes: 2,790,640. Expected final installed set: **23** exact APK pairs. Bash needs the base loader/libc/merged layout and libtinfo; ncurses provides libtinfo and requires the exact terminfo-base version; libstdc++ needs the base loader/libc/libm/libgcc_s. Those dependencies resolve to the base or these four additions. This closure does not claim that untested SDK behavior needs no other utility.

Recipe/source and license evidence from the authenticated index and matching APK metadata:

- bash: recipe `ac7b15dc2695924986372a27cd7d6c4e029c5efa`, GPL-3.0-or-later.
- libstdc++: GCC recipe `794cf72f88e1b408eca5da0dbf5c5ed25543606d`, GPL-3.0-or-later WITH GCC-exception-3.1.
- ncurses and terminfo: recipe `a8ea2f5f5980ccf40a6f6f34c6aeb358dfccc815`, MIT.

## Authenticated offline package closure

Exact public [APKINDEX](https://packages.wolfi.dev/os/x86_64/APKINDEX.tar.gz): 10,635,138 bytes, SHA-256 `01398efd4ae98d03bf5cb2c9c5fe397399bca61b81c8cb0cb36bd90e230137c6`.

The 512-byte `.SIGN.RSA256.wolfi-signing.rsa.pub` signature **verified** with Node crypto RSA-SHA256 over the exact second compressed gzip member. The trusted public key was read from the exact pinned base at `/etc/apk/keys/wolfi-signing.rsa.pub`, SHA-256 `f0031424cf46f7db780ce63a45f0fd6aa6f85f601e6bb3b7a91fe3d4d5b7d2cc`.

Each additional APK has no individual `.SIGN` member. All four compressed control-member SHA1 values match their signed-index `Q1` checksums; each compressed data-member SHA-256 matches its `.PKGINFO` datahash; identity, architecture, dependencies and source recipe commit match the index. Full-file SHA-256 values are additionally pinned above.

Use the full unmodified signed index and only the four matching APKs in an offline repository's `x86_64/` directory. The candidate plan uses exact version arguments, `--repositories-file /dev/null`, a local `--repository` path, and `--no-network`. Do not synthesize an unsigned index, install untrusted local files, or use `--allow-untrusted`.

Matching primary apk-tools v2.14.10 source establishes the authentication chain: [repository layout](https://raw.githubusercontent.com/alpinelinux/apk-tools/v2.14.10/doc/apk-repositories.5.scd), [database loader/installer](https://raw.githubusercontent.com/alpinelinux/apk-tools/v2.14.10/src/database.c), [control/data verification](https://raw.githubusercontent.com/alpinelinux/apk-tools/v2.14.10/src/package.c). A local repository is supported with networking disabled; the index is authenticated against trusted keys; package installation verifies the index-selected control identity and its datahash. **Actual apk installation under the final base remains UNRUN.**

## Required acceptance before another image attempt

Source review must cover Docker stage/copy boundaries, exact package/index/key pins, final package inventory measurement, source allowlists, two-base recipe/request fields, provenance labels, producer/comparator bindings, and preservation of the existing scan gate. The root owner also has a separate scan-poll correction; source review must establish it is ready before an attempt is allocated.

Actual runtime/native checks remain **UNRUN** for this proposed final base:

1. Exact Node v24.21.0, process-reported glibc 2.44, final loader and required shared-library resolution; exact 23-package inventory; bash/sh, CA bundle, and the selected SDK tool behavior.
2. Exact GNU SWC materialization and a real TypeScript transform; fresh-process reload under the existing noexec temporary mount. No source-tree or temporary-cache substitute for the owned native binary.
3. Temporal 1.24.0 core bridge load and the existing workflow/bundling checks.
4. Existing worker startup, smoke, sandbox/user/ownership checks, including read-only filesystem, capability restrictions and `/tmp` noexec. Retain full accepted capability scope.
5. Build/source/image provenance comparison followed by the exact final image's **fresh** ECR scan: `COMPLETE`, HIGH 0, CRITICAL 0. [AWS documents Wolfi/Chainguard scanning support](https://docs.aws.amazon.com/inspector/latest/user/supported.html), but that is not a clean-scan result.

No additional paid image attempt is allocated by this report. No deployment or activation is authorized. No package was installed or executed during this research; no source was committed or published by this report owner.

## Derived evidence hashes

Private raw scan/SBOM/registry records remain outside source. These public-safe hashes allow the parent to compare retained evidence without copying those records into Git:

| Derived or public evidence | SHA-256 |
| --- | --- |
| Raw failed-image scan readback | `0c2092d66113367c683d00b255cc7c5c32186f4d63f1c0771f73f76c6715697e` |
| GNU 2.44 release HTML | `84912cf8c256f1ac509b8bfa513e293288d8d1955680315f116612423ffa0b18` |
| Exact upstream 5435 commit API response | `083e6df29cbbb99a634f289812f9d7e3c42a6398a293f23eb6edf0cf6fb8264c` |
| Accepted OpenEmbedded exact-source patch HTML | `5106d1f649ab272be992794e3d98626520ab2015f92d42c6ff801bec83ea66b0` |
| zlib upstream ancestry API response | `de501c227b83c61d2a72d36e71ae27cf591ded3ee1461cf2152082205bcdacd2` |
| Wolfi glibc-2.44 fixed-version advisory | `08fbd5d97125b048a12074dc9be36dca838105839f4b8eecd1567279888bb2e4` |
| Wolfi zlib fixed-version advisory | `a2e6d9cebb4990400e542c17320f86b58b6b29b04416bf8a97db08b56a2ece56` |
| Four APK metadata/checksum closure | `3663a6035814c5ac05312dbd68d2387d8c4f8dad8e6dc2166bf1a65b309703e8` |

Read limitation: GNU's direct Git/bug endpoint presented an Anubis access denial. The denial was not bypassed. Public GNU release mail and the upstream exact-fix mirror were available; the newer exact stable hash was absent from that mirror. The distinction is retained above.
