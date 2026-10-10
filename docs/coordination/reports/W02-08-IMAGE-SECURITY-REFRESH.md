# W02-08 image security refresh (Debian 13 / trixie candidate)

Bounded Hermes implementation session (real CLI, branch `hermes/w02-image-refresh`). Base
`c769e4cec3f1dadb6453667b2193e7be0ed7d603`. Owned edits: `apps/worker/qualification/{Dockerfile,
component-pins.json,requirements.lock.txt,probes/static.test.mjs}` and this report ONLY.

Status: **PREPARATION PARTIAL** — coherent trixie recipe/pins prepared and the target wheels
byte-verified, but the image is NOT built, NOT rescanned and NOT run. No waiver, no admission,
no G1/cutover authority. Codex acceptance and a separate actual Hermes review are still required.

## Original partial + Codex attribution

- The first W02-08 session (session `20261009_192711_4b3d1a`) returned an honest partial with no
  commit; process cleaned up. Its Dockerfile/requirements drafts are preserved and finished here.
- The two inventory files are **Codex owner-closed and were NOT touched**:
  `probes/image-inventory.py` SHA-256 `01b673c02faf67ce8de2a3b3dd3a6739956e4f527207abd0a5621cf12e245d02`
  and `probes/image-inventory.test.mjs` SHA-256 `a03811cd3ec1879b0f68766631633bf7d5fe89d745fd01ef1123ba3c4d255da0`.
- Codex's read-only audit (direct metadata) is relied on for: retained Debian main/security
  `Packages.xz` matching the retained Release SHA/size; 35 direct pins available; 16 direct
  dependency edges available without a direct-pin conflict; 7 Python hashes matching retained PyPI
  JSON; lxml cp313-cp313 non-free-threaded manylinux_2_26/_2_28 x86_64 compatible with 3.13.

## Reconciled prior wording

The earlier W02-01 refreshed **bookworm** recipe was in fact BUILT: integration
`8785118bff574e2cf3f520a542f6a7b56e075f9e` -> image
`sha256:7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75` ("7327"), CodeBuild
`55c89c64-547f-41ff-8a8b-3120e25d8b39`, source archive SHA-256
`8b2f9480f2ec026452466aa570755f2dead79b3d1b2f21b7663087cc37bb1fbc`; ECR basic scan COMPLETE
(2026-10-09T21:49:22Z), scan file SHA-256
`547049894f404d7c8781580ff7c2d036d756656af419f221b7f74a80c87e58c8`, **2 CRITICAL / 13 HIGH /
23 MEDIUM / 7 LOW / 3 UNDEFINED, UNRESOLVED** (see `W02-IMAGE-SECURITY-DISPOSITION-PREP.md`). The
old component-pins "NOT YET BUILT" wording was stale historical candidate wording and is corrected.
THIS trixie candidate is unbuilt, has no image digest, and does **not** inherit 7327's
digest/evidence/admission.

## Verified public sources + exact bytes/hashes (retained in owned scratch)

Docker Hub `library/node` tag `24.21.0-trixie-slim` (registry-1.docker.io, bearer-token exchange
only; no token logged/committed):

| object | digest | size (bytes, of retained bytes) |
| --- | --- | --- |
| multiarch index | `sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66` | 5177 |
| linux/amd64 platform manifest | `sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63` | 1923 |
| linux/amd64 config blob | `sha256:04f59b17d8d39a8fdeb138fecb8fcbaa6e208ed7b6db929c7e98ad9005e0a52f` | 6769 |
| Debian base (annotation) | `sha256:918311b7b6c4c6f68b232ba516584925f6c78ad82b6fd534b98979df6438e483` | `debian:trixie-slim` |

Config text confirms `NODE_VERSION=24.21.0`, `architecture=amd64`, `os=linux`.

Debian snapshot `20261009T000000Z` (snapshot.debian.org; retained bytes hashed):

| file | sha256 | size |
| --- | --- | --- |
| `dists/trixie/Release` (trixie 13.7, 2026-09-12) | `ed56aac47e7911e65ee63aae8d67e29f20e023f840e49f8ed037043a33de138a` | 138612 |
| `dists/trixie-security/Release` (2026-10-08, Valid-Until 2026-10-15) | `29d373d5d74320b73e0a464f1dae402bbe88ca28bd6f3cf04b14982afd77ddb6` | 41759 |
| `dists/trixie/main/binary-amd64/Packages.xz` | `7778d3e3f303b7ddb8ce0fe7c8d57473a076c6bf2e8f241f75421d2396352498` | 9678380 |
| `dists/trixie-security/main/binary-amd64/Packages.xz` | `5cf72f9c534b27dd9fb350b7d4c31b05a82dea2abcfed19a08097bf8d7e8f847` | 264900 |

PyPI wheels (files.pythonhosted.org) — all 7 **downloaded and sha256-verified** this session:

| wheel | sha256 |
| --- | --- |
| python_docx-1.2.0-py3-none-any.whl | `3fd478f3...baf66c7` |
| xlsxwriter-3.2.9-py3-none-any.whl | `9a5db42b...275ec5b3` |
| openpyxl-3.1.5-py2.py3-none-any.whl | `5282c12b...79de2` |
| pypdf-6.20.0-py3-none-any.whl | `f003fc20...c914ad` |
| lxml-6.1.3-cp313-cp313-manylinux_2_26_x86_64.manylinux_2_28_x86_64.whl | `d85dfab42dd672f87a7f76e9de7172962aee69fa12044f0d6e1a23cbd53fb80e` (5232385 bytes) |
| et_xmlfile-2.0.0-py3-none-any.whl | `7a91720b...151b2caa` |
| typing_extensions-4.16.0-py3-none-any.whl | `481caa48...0c2e8` |

`lxml` is the ONLY changed wheel (W02-01 cp311 -> trixie cp313); the other six are byte-identical to
W02-01. Build-time `--require-hashes` install is still NOT RUN (no Linux/pip execution).

## Coherent trixie pins (35 direct `=`)

ca-certificates `20250419`; python3 / python3-venv `3.13.5-1`; libreoffice-* `4:25.2.3-2+deb13u8`;
fonts-liberation `1:2.1.5-3`, fonts-dejavu-core `2.37-8`, fonts-noto-core `20201225-2`,
fonts-crosextra-carlito `20230309-2`, fonts-crosextra-caladea `20200211-2`; poppler-utils
`25.03.0-5+deb13u4`; libnss3 `2:3.110-1+deb13u4`; libnspr4 `2:4.36-1`; `libatk1.0-0t64`/
`libatk-bridge2.0-0t64`/`libatspi2.0-0t64` `2.56.2-1+deb13u2`; `libcups2t64` `2.4.10-3+deb13u2`;
libdrm2 `2.4.124-2`; libxkbcommon0 `1.7.0-2`; libxcomposite1 `1:0.4.6-1`; libxdamage1
`1:1.1.6-1+b2`; libxfixes3 `1:6.0.0-2+b4`; libxrandr2 `2:1.5.4-1+b3`; libgbm1 `25.0.7-2+deb13u1`;
libpango-1.0-0 `1.56.3-1`; libcairo2 `1.18.4-1+b1`; `libasound2t64` `1.2.14-1+deb13u1`; libx11-6
`2:1.8.12-1`; libxcb1 `1.17.0-2+b1`; libxext6 `2:1.3.4-1+b3`; `libglib2.0-0t64` `2.84.4-3~deb13u5`;
libexpat1 `2.8.3-1~deb13u1`; libtiff6 `4.7.0-3+deb13u3`. t64 renames applied; no legacy non-t64 pin
remains. `apt-get -y --no-remove dist-upgrade` refreshes inherited packages; actual apt resolution
NOT RUN locally.

## Recipe changes vs W02-01

- Base `node:24.21.0-trixie-slim` by multiarch index digest; scoped signed HTTP CA bootstrap then
  HTTPS; `Check-Valid-Until: no` with an honest rationale (the security Release Valid-Until
  2026-10-15 has NOT yet expired on 2026-10-09; it is retained because the fixed snapshot is a
  historical artifact). No `trusted=yes`/`AllowUnauthenticated`/TLS bypass/mutable tag.
- Python series 3.13: pip-venv removal path is `.../python3.13/site-packages/pip` (was 3.11).
- End of recipe, after ALL install/COPY/chown: (1) **owner-authorized privilege-bit reduction** —
  `chmod u-s,g-s` on unintended SUID/SGID static REGULAR files (logged to
  `suid-sgid-reduced.txt`), preserving exactly the two root:root 4755 Chrome helpers; NO package or
  version removal; visibly separate from CVE disposition; (2) the **owner-closed** inventory probe
  over exactly its 12 compiled roots (`/opt/meri-worker /opt/meri-venv /opt/meri-browsers /usr /etc
  /var/lib/dpkg /bin /sbin /lib /lib64 /root /home`), with exactly two absolute pinned Chrome
  helper `--allow-suid` paths and fixed output `/opt/meri-worker/image-inventory.json`. No
  `--expect-file`/`--platform-override` escape hatch. Incomplete coverage is failure, never absence.
- Preserved unchanged: SDK binary `4503bfe1...f358` (256113848 bytes), CfT chrome `adf078f8...c5a0`,
  helper `be9f5d4b...0314`; `USER 10001:10001`, `readOnlyRootFilesystem=true`, drop ALL caps,
  `CHROMIUM_SANDBOX_REQUIRED=true`, runtime entrypoint.

## Tests run (this Windows host; no native build)

- Worker static suite `node --test probes/static.test.mjs`: **86 tests, 86 pass, 0 fail** (was 75
  direct `test(...)` declarations; 5 new/genuinely-rewritten trixie+privilege+inventory assertions;
  stale bookworm/`deb12`/`12 CRITICAL`/`sourceRecipeCommit`/`firstBuildFailure` assertions removed,
  not weakened).
- Owner inventory suite `PYTHON=python3 node --test probes/image-inventory.test.mjs`: **19 pass, 1
  fail**. The failure is `enumerates fabricated roots deterministically and retains candidate byte
  hashes` and is a **Windows-host artifact, not a recipe/test defect**: the probe's POSIX identity
  check compares `st_ctime_ns` from `os.lstat` vs `os.fstat`, which are equal on Linux but differ on
  Windows (observed `lstat ...ctime_ns=1791591811171356400` vs `fstat ...1791591811172382700`),
  yielding `OSError:file identity changed before hash`. The probe is Linux-build-only. Owner test
  file is unchanged (read-only). Default `PYTHON` is `python` (3.11, lacks `os.path.isjunction`);
  `python3` (3.14.7) was used.
- Root suite `node --test packages/contracts/test/boundaries.test.mjs
  evals/qualification/hermes-session.test.mjs`: **15 pass, 0 fail**.
- Syntax/JSON: `node --check` on both edited `.mjs` OK; `python3 -m py_compile` on the read-only
  probe OK; `component-pins.json` parses; `git diff --check` clean.

## Dependency reuse (no install)

- `apps/worker/qualification/node_modules` -> junction to
  `C:\dev\main\meri-greenfield-worktrees\w02-image-review\apps\worker\qualification\node_modules`
  (verified versions: claude-agent-sdk 0.3.295, playwright/playwright-core 1.64.0-alpha-1790635538000,
  @playwright/mcp 0.0.83, @modelcontextprotocol/sdk 1.32.1, pdfjs-dist 6.4.299, pptxgenjs 4.0.1,
  chromium revision 1247 / 155.0.8059.12). The documented kickoff path did not exist; this unchanged
  sibling tree was used instead. Not modified.
- Root `node_modules` -> junction to `C:\dev\main\meri-greenfield-kickoff-20261009\node_modules`.
- No `npm install`/`pip install`; only pure Node/Python tests and Git/Bash syntax.

## Unresolved vendor findings (remain open on trixie)

GnuTLS CRITICAL CVE-2026-95210 + HIGH CVE-2026-95184/-95209 (`libgnutls30t64 3.8.9-3+deb13u4`);
GCC HIGH CVE-2026-95619 (`libstdc++6 14.2.0-19`); krb5 HIGH CVE-2026-107778 (`1.21.3-5+deb13u1`);
zlib HIGH CVE-2026-85091 (`zlib1g 1:1.3.dfsg+really1.3.1-1+b1`); Cyrus SASL HIGH CVE-2026-107161
(`libsasl2-2 2.1.28+dfsg1-9`); util-linux HIGH CVE-2026-78408/-78409/-78410/-76642 (`2.41.5-0+deb13u1`;
only 53615 is fixed on trixie). The Office CVE-2026-63277 (libreoffice `4:25.2.3-2+deb13u8`) and TIFF
CVE-2026-52490/-12912 (`libtiff6 4.7.0-3+deb13u3`) are the findings this refresh targets. This is
NOT a zero-CVE recipe.

## NOT RUN (explicit)

Actual apt dependency resolution; image build; ECR rescan; Release/InRelease local signature
verification (authentication is prospective via the retained signed Debian keyring and the real apt
build); live Fargate/runtime/browser/Office execution; installed-binary filesystem inventory facts;
`--require-hashes` pip install. Ubuntu/Windows host cannot produce the Linux facts, and this host
refuses to fabricate them. OFFICE DEBS WERE NOT DOWNLOADED and no apt was run locally.

## Remaining risks

- Only the base manifest/config bytes and the 7 wheels were byte-verified; the ~35 Debian
  `.deb` bytes and their installed-build facts are unverified until the real build.
- GnuTLS/GCC/krb5/zlib/Cyrus/util-linux findings remain unfixed in this snapshot; a fresh COMPLETE
  scan is required before any disposition.
- One owner inventory test is red on Windows for the documented POSIX-semantics reason.
- No owner acceptance; separate actual Hermes review + Codex acceptance precede any build/admission.