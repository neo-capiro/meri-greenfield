# Runtime image dependency trace and base-variant candidates (slice 5 preparation, HANDOFF §5 item 1)

Base `c6053e24b465be677cc5980533009b4aab03beab` (PR86). Author: Fable. Status: ANALYSIS, no build, no package change, no AWS action, no Dockerfile change. The PR86 runtime image is scan-blocked (2 Critical, 48 High per the public-safe SCAN-STATUS); the private finding table has not been handed to Fable. This note records everything about the image's actual OS dependencies that can be derived from the source tree, the locally installed artifacts and public registry metadata, so that the remediation candidate can be chosen the moment the table arrives, and it states one consequence the table will not change. Nothing here is a passing scan or an admission claim.

## 1. What the runtime recipe installs

`apps/runtime/Dockerfile` (27 lines, proof row): `FROM ${NODE_IMAGE}`, seven `npm ci --ignore-scripts` layers from locked package files, `COPY apps` and `COPY packages`, `RUN --network=none node apps/runtime/build/materialize-swc.mjs`, three `node_modules` links, `USER node`, `ENTRYPOINT ["node","apps/runtime/cli.mjs"]`. There is no `apt-get`, `pip`, `curl` or any other OS-level installation. Every OS package in the runtime image, and therefore every OS-package finding in its scan, comes from `NODE_IMAGE` unchanged.

`scripts/qualification/assembled-image/meri_image_build.py` builds with `NODE_IMAGE=public.ecr.aws/docker/library/node@sha256:9af606de2e947cfb3f276633b7c5130c4cd22365aa10f5a647b7675d5cfce0c0` (the public mirror of the Docker library image; the reference is already in the source tree).

## 2. What the runtime binaries need from the OS

The image installs exactly the artifacts that are installed on this host from the same locks, so their shared-library needs were read here with `ldd`:

| Artifact | Shared libraries required | Note |
| --- | --- | --- |
| Native CLI 2.1.295 (`@anthropic-ai/claude-agent-sdk-linux-x64/claude`, sha256 `4503bfe1…`) | `libc.so.6`, `libm.so.6`, `libpthread.so.0`, `libdl.so.2`, `librt.so.1`, `ld-linux-x86-64.so.2` | glibc only; dynamically linked ELF, not stripped |
| Node 24.21.0 official binary | `libc.so.6`, `libm.so.6`, `libdl.so.2`, `libpthread.so.0`, `libstdc++.so.6`, `libgcc_s.so.1` | the official build bundles its own zlib, OpenSSL, ICU and the rest statically; no `libz`, `libssl` or `libcrypto` from the OS |
| SWC native binding (`@swc/core-linux-x64-gnu`, materialized by the recipe) | `libc.so.6`, `libdl.so.2`, `libgcc_s.so.1`, `librt.so.1`, `libpthread.so.0` | Rust binding; glibc and libgcc only |
| Everything else (`pg`, Temporal client, Hono adapter, AI SDK, contracts) | pure JavaScript | TLS through Node's bundled OpenSSL, which reads the system CA store (`ca-certificates`) |

Runtime roles spawn only `node` (supervisor, Temporal worker, runner) and the native CLI. The runtime image contains no Python and no LibreOffice: `apps/artifacts/local-executor.mjs` takes explicit absolute `pythonExecutable` and `nodeExecutable` paths, and the Office/Python/browser executor is the separate qualification worker image (`apps/worker/qualification/Dockerfile`, `node:24.21.0-trixie-slim` plus pinned `python3`, `libreoffice-*` and the matched Chromium). HANDOFF §8 leaves the actual executor paths to the owner, so no document capability of the runtime image depends on OS packages beyond glibc.

Conclusion from the source: the runtime image's executable needs from the OS are glibc (`libc6`), `libstdc++6`, `libgcc-s1`, the dynamic loader, `ca-certificates` for outbound TLS, and the `node` user (uid 1000, created by every official Node variant). No runtime path needs Python, TIFF, ImageMagick, HEIF, OpenEXR, librsvg, MariaDB/MySQL client libraries, Cyrus SASL, curl, Perl, GnuPG or any `-dev` package.

## 3. What the base digest is

Public registry metadata for the pinned digest was read anonymously (manifest only): a single-platform OCI image manifest with 8 layers totalling 411,895,592 compressed bytes. The config and history blob is served through a CloudFront host that this container's egress policy denies, so the variant is an inference, not a read: the official `node:24` full Debian variant (buildpack-deps lineage) has 8 layers and roughly 400 MB compressed, while the `-slim` variants have 5 layers and roughly 75 MB. The inference matches SCAN-STATUS, whose advisories (TIFF, Python 3.11, Cyrus SASL, util-linux, zlib) and the handoff's HEIF/OpenEXR/MariaDB/RSVG rows are packages of the buildpack-deps tree (ImageMagick development libraries, `default-libmysqlclient-dev`, `libglib2.0-dev` pulling `python3`, LDAP/Kerberos through libcurl), none of which a slim image contains. Shipping confirms the variant with one read of the image history (`docker history` or the config blob) before any decision.

## 4. Candidates

| Candidate | Change | Proof rows | Expected effect on the finding table | What remains open |
| --- | --- | --- | --- | --- |
| A. Base-argument-only, same Debian release | `NODE_IMAGE` set to the immutable digest of `node:24.21.0-bookworm-slim` (the repository already carries a reviewed digest for that tag, `d6aa754f…`, from the worker image work) | All 45 proof bytes preserved; `source-proof` unchanged; only `meri_image_build.py`'s `NODE` value and the build receipt change | Removes the entire buildpack-deps tree: TIFF, HEIF, OpenEXR, librsvg, ImageMagick, MariaDB/MySQL client, Python 3.11, Cyrus SASL, curl, Perl, GnuPG, libxml2, Expat, every `-dev` package. Node, the CLI and SWC keep every library they need | The bookworm-slim base set stays: `libc6`, `libstdc++6`/`libgcc-s1` (gcc-12), `zlib1g`, `util-linux`/`mount`/`libmount1`/`libblkid1`, `apt` and its dependencies including `libgnutls30`, `libgcrypt20`, `libsystemd0`, `libseccomp2`, `libzstd1`, `liblz4-1`, `libbz2-1.0`, `perl-base`, `bash`, `coreutils`, OpenSSL `libssl3`, `ca-certificates`, `tzdata` (confirm from the image's dpkg inventory) |
| B. Base-argument-only, Debian 13 | `NODE_IMAGE` set to the immutable digest of `node:24.21.0-trixie-slim` (`173f1258…`, already the base of the qualification worker image) | Same as A | Same removals as A; additionally the Trixie fixes recorded in SCAN-STATUS and the earlier dispositions: util-linux CVE-2026-53615, TIFF CVE-2026-12912 (not present in slim anyway), newer gcc/libstdc++ and zlib source versions | Per the dispositions, Trixie still carries util-linux CVE-2026-76642/78408/78409/78410, zlib CVE-2026-85091 and GnuTLS CVE-2026-95210 as vulnerable with no fixed package |
| C. Recipe change (base without a package manager, for example a Debian 12 `cc` distroless base with the official Node tarball copied in a build stage) | Dockerfile change, hence the retained original receipt plus a complete fresh candidate manifest and a new 44-row pin in the proof control; `USER node` and uid 1000 need a hand-written passwd entry because the base has no shell or `useradd` | Removes `apt` and with it GnuTLS, libgcrypt, systemd and util-linux | Keeps `libc6`, `libstdc++6`, `libgcc-s1` and (in the `cc` variant) `zlib1g`; a larger change to review, test (`image-closure`, non-root, read-only root, `materialize-swc`) and qualify |

## 5. The consequence that the private table will not change

Under the admission rule of HANDOFF §4 (zero High and zero Critical, no waiver for low exploitability), every candidate above still carries at least these rows as long as Debian lists them vulnerable with no fixed package, as the earlier dispositions and SCAN-STATUS record on 14 October: `zlib` CVE-2026-85091 (High, Bookworm/Trixie/unstable vulnerable, no fixed package), `gcc-12`/`libstdc++6` CVE-2026-95619 (High, Bookworm postponed; Node itself needs `libstdc++6`), and, wherever `apt` is present, GnuTLS CVE-2026-95210 (Critical, unfixed in Bookworm, Trixie and Sid). Candidates A and B therefore reduce the table by the whole buildpack-deps tree, which is most of its 50 High and Critical rows if the variant inference holds, but cannot reach zero by themselves; candidate C removes the GnuTLS row at the cost of a recipe change and still keeps zlib and libstdc++. Reaching zero High and zero Critical on any glibc Debian base depends on Debian shipping fixes for zlib and gcc-12 libstdc++ (or on the scanner re-rating those rows), not on anything Fable can change in source. This is stated so dot and shipping can decide knowingly; it is not a request to waive rows.

## 6. What the private table must confirm, and the proposed order

1. The variant of the pinned digest (section 3) and the image's dpkg inventory.
2. That every High and Critical row except the residual set of section 5 belongs to a package absent from the chosen slim variant. If any High row belongs to a slim-base package other than zlib, gcc-12, util-linux and GnuTLS, it is listed with its Debian status before the candidate is proposed.
3. Then Fable returns the candidate as a one-value change to `meri_image_build.py` (`NODE`) with the fresh build receipt layout the assembled-image README describes, all 45 proof bytes preserved; shipping performs the separately approved build and scan. No paid build is requested by this note.

Vendor status in this note is quoted from SCAN-STATUS and the earlier image dispositions dated 11 to 14 October; it must be refreshed from the Debian tracker before any proposal is finalized, which the handoff requires and which this container's egress policy did not allow today.
