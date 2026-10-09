# W02-01 worker image and offline qualification preparation — report

Status: `ready-for-review` (not accepted)
Task: W02-01 Worker image and offline qualification preparation
Explicit Hermes session ID: `20261009_152136_008131` (stage 1 partial; stage 2
interrupted on a test hang; stage 3 fixed the hang and committed `bf72484`; stage
4 applied review repairs and committed `a5d6f0e`; stage 5 corrected pinned-browser
handling and committed `3d85f4a`; stage 6 fixed the first-build apt poppler pin
(`4f69d68`, integrated; the probe-only candidate then built and was ECR-scanned);
stage 7 refreshed the security recipe (`e68c796`); stage 8 hardened build
evidence (`f01d6be`); this is the stage-9 runtime-probe-repair continuation of
the same session)
Branch/worktree (cwd): `hermes/w02-image` at `C:\dev\main\meri-greenfield-worktrees\w02-image`
Base commit: `f01d6be6296fa1f533cfa56d2376e488cea007fe`
Result: HEAD of this task commit (full SHA returned in the handoff message)

Preparation only. Green offline checks prove local structural/path/parsing
boundaries, not live image build, browser sandbox, Office rendering, durable
sessions or Fargate isolation. G1 remains incomplete and W03 stays blocked.

## Stage-5 pinned-browser corrections (Codex findings, all addressed)

1. **chrome://sandbox is a two-cell table (Chromium 155.0.8059.12).** Confirmed
   from the exact source
   `chrome/browser/resources/sandbox_internals/sandbox_internals.ts` (lines
   131–164: `Layer 1 Sandbox` = Namespace/SUID/None; `PID namespaces`,
   `Network namespaces`, `Seccomp-BPF sandbox`, `Seccomp-BPF sandbox supports
   TSYNC` = Yes/No) and `.html` (`table#sandbox-status`, `#evaluation`). The
   browser probe now evaluates
   `{text, rows, evaluation}` and parses exact unique known label/value cells:
   requires Layer 1 Sandbox = Namespace or SUID AND Seccomp-BPF sandbox = Yes;
   missing/None/ambiguous/unknown fails; PID/network/TSYNC rows are retained for
   review. Old invented colon-line positive fixtures were replaced with
   source-faithful two-cell fixtures; negative/malformed/duplicate tests retained.
2. **Real process identification.** `/proc/<pid>/exe` realpath under
   `/opt/meri-browsers` (not argv) rejects the MCP Node launcher whose args say
   `--browser chromium`; the browser must carry THIS run's exact `profileDir` and
   the renderer is associated through real PPid ancestry. The verdict requires an
   identified browser AND renderer. Namespace symlink targets, status
   (Uid/Gid/CapEff/NoNewPrivs/Seccomp/Seccomp_filters/NSpid) and uid/gid_maps are
   captured for self/browser/renderer as corroborating evidence (never a Chrome
   sandbox pass by themselves). Full bounded argv/PID/PPid/exe/type preserved.
3. **Chrome-for-Testing archive + helper.** Debian12 maps to
   `builds/cft/155.0.8059.12/linux64/chrome-linux64.zip` (307 →
   `storage.googleapis.com/chrome-for-testing-public/...`). The archive was
   downloaded to owned scratch and inspected WITHOUT launching: 198,335,306
   bytes, SHA-256 `a24546e0e6c763bf864861ce50498f38783663e24cd2af2a16798c25dc3a9489`;
   the helper is `chrome_sandbox` (underscore) at
   `chromium-1247/chrome-linux64/chrome_sandbox`; executable
   `chromium-1247/chrome-linux64/chrome`. The Dockerfile now finds/asserts
   `chrome_sandbox` OR `chrome-sandbox` (root, 4755, setuid) after all ownership
   operations and keeps the browser tree root-owned. Scratch archive removed
   after inspection; hash recorded in `component-pins.json`.
4. **Download qualification by bytes.** The probe compares the downloaded file's
   SHA-256 against the known fixture payload hash (filename presence is not
   enough). Version is checked from `navigator.userAgent` via `chrome://version`
   against pinned `155.0.8059.12`. Raw bounded navigation/version/download/
   sandbox results are preserved; complete (not first-N) argv/process evidence is
   emitted to structured stdout.
5. **Network positive control.** `checkNetworkDenial` now requires the expected
   DNS denial class (`ENOTFOUND`/`EAI_NONAME`/`ENODATA`) for example.com and
   api.anthropic.com (arbitrary resolver failures are not a pass) plus a positive
   control: `logs.us-east-1.amazonaws.com` must resolve inside 10.80.0.0/16 and a
   connect on 443 must succeed. A missing/incorrect positive control or unknown
   error fails visibly. Pure `classifyNetworkResults`/`addressIn10_80` are covered
   offline.

## Stage-6 first-build apt fix (Codex build evidence)

The first real isolated CodeBuild (`meri-greenfield-qualification-build:7464da9b-af57-4481-b4a4-959b9789e7ec`,
2026-10-09T20:15:15Z–20:15:54Z) failed during **apt dependency resolution, BEFORE
any npm/browser/runtime execution**. The signed HTTP CA bootstrap and the
subsequent verified HTTPS snapshot apt update both succeeded. Exact error:

```
poppler-utils : Depends: libpoppler126 (= 22.12.0-2+deb12u2) but 22.12.0-2+deb12u3 is to be installed
E: Unable to correct problems, you have held broken packages.
```

Cause: `bookworm-security` in the fixed snapshot `20260901T000000Z` updates
`libpoppler126` to `22.12.0-2+deb12u3`, while `poppler-utils` was pinned to the
older main version `22.12.0-2+deb12u2`. Fix: pin `poppler-utils` to the
security-updated `22.12.0-2+deb12u3` (libpoppler126 resolves to the matching
`deb12u3`); the security library is NOT downgraded.

Coherence scan against primary package metadata for BOTH `bookworm/main` and
`bookworm-security` (same snapshot): every other pinned package's exact-version
(`=`) Dependency resolves to the snapshot version — `python3`→`libpython3-stdlib`,
`python3-venv`→`python3`, `libreoffice-impress`→`libreoffice-core`/`libreoffice-draw`
— with no other mismatch. `libnss3`, `libexpat1` and `ca-certificates` were left
at their resolved versions (no exact-dependency conflict; changing them would be
unrelated scope). Signature/HTTPS verification and the scoped snapshot
`Check-Valid-Until: no` handling are unchanged; no repository/tag move, sandbox
weakening, host switch or retry loop. Docker is unavailable here; no local/cloud
build was attempted. `assembledImageDigest` stays null.

## Stage-7 security recipe refresh (Codex build/scan evidence)

The prior probe-only candidate built by Codex (CodeBuild
`aaec4b57-0bb1-4a80-a464-21d364be6465`, ECR
`sha256:f669d3602892c36c7a829bc3e2747124fa2e1dd5397af193f7b893afdd19b837`) is
NOT application/G1 accepted. Its ECR basic scan was COMPLETE with 12 CRITICAL /
64 HIGH / 70 MEDIUM / 16 LOW / 3 UNDEFINED. `assembledImageDigest` stays null and
now records that THIS refreshed recipe is a SEPARATE, NOT-YET-BUILT candidate
(`priorBuiltCandidate` preserves the old digest/build/scan; the old digest must
not be applied to the new recipe).

Refresh (keeping Debian bookworm / Python 3.11 / Node 24, and all app/SDK/MCP/
Chromium/Python-library pins):
- Base moved to Node LTS `node:24.21.0-bookworm-slim` at the independently
  observed index digest `sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20`
  (linux/amd64 manifest `sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd`).
- Sources moved to the current fixed snapshot `20261009T000000Z` (main +
  security). Security `InRelease` Date `Thu, 08 Oct 2026 23:02:21 UTC`;
  `Packages.xz` SHA256 `d97872da3ff1a60952a9bf64d2c908b1275b32f67a73beb20ae455dc5bcd8137`
  (349348 bytes) matched by-hash. Signature/HTTPS verification and scoped
  `Check-Valid-Until: no` are unchanged.
- Direct OS pins set to the highest snapshot candidates (notably libnss3
  `2:3.87.1-1+deb12u4`, libexpat1 `2.5.0-1+deb12u4`, poppler-utils
  `22.12.0-2+deb12u3`, ca-certificates `20250419~deb12u1`; libreoffice
  `4:7.4.7-1+deb12u14` and libglib2.0-0 `2.74.6-2+deb12u9` kept as the higher of
  main/security), then `apt-get -y --no-remove dist-upgrade` refreshes ALL
  inherited packages from the signed fixed sources (no-removal; fails rather than
  silently removing).
- Pending real build/rescan (NOT yet verified): the refreshed pins + no-removal
  dist-upgrade are EXPECTED to carry current bookworm fixes for 10 of 12 critical
  findings: perl 5.36.0-7+deb12u4 (CVE-2026-12087/-13221/-57433/-8376/-42496;
  -8376 is 32-bit specific), libnss3 2:3.87.1-1+deb12u4 (CVE-2026-16389),
  libgnutls30 3.7.9-2+deb12u7 (CVE-2026-33845/-42010), python3.11 3.11.2-6+deb12u9
  (CVE-2026-19445; server-SNI specific), libssl3/openssl 3.0.22-1~deb12u1
  (CVE-2026-75803). Still open: CVE-2026-95210 (GnuTLS) and CVE-2026-52490
  (tiff/tiffcrop 4.5.0-6+deb12u4) — recorded, not suppressed, not called
  unreachable. Package metadata is not a completed security audit and does not
  establish zero vulnerabilities; the refreshed candidate is UNBUILT and the
  prior candidate's 12 CRITICAL / 64 HIGH findings remain outstanding until a
  targeted real build and rescan.
- Build-time byte/version evidence: full `dpkg-query` inventory written and then
  emitted to real build stdout (fail-closed; no unchecked pipeline), Node/Python
  versions captured with checked commands and LibreOffice `--version` captured
  with `HOME=/tmp`, stderr preserved and a nonempty `LibreOffice <n>` required
  (no placeholder counts as success), the pinned SDK Linux binary SHA256 verified
  against `4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`, and
  the installed CFT chrome/chrome_sandbox byte-verified against the
  independently inspected per-file pins (chrome `adf078f8...`, chrome_sandbox
  `be9f5d4b...`) at `/opt/meri-browsers/chromium-1247/chrome-linux64/`.

Docker is unavailable here; no build/scan was attempted. The known missing
direct-IP egress probe remains a separate, later gap; no browser/Office/network/
session/proxy code was rewritten.

## Stage-8 evidence repair (build-output hardening + CFT per-file pins)

Narrow repair at base `e68c796`; only Dockerfile, component-pins.json,
probes/static.test.mjs and this report changed (README already correct).
- Dockerfile now writes the complete `dpkg-query` inventory and then emits it to
  real build stdout, failing closed on dpkg-query error or empty output (the old
  `dpkg-query | sort` pipeline masked its status).
- Runtime versions are captured with checked commands: `node --version` and
  `python3 --version` fail the build if they fail; `HOME=/tmp soffice --version`
  captures stdout and stderr, and a nonempty `LibreOffice <n>` is required. The
  old silent `2>/dev/null | head` with an "unavailable" fallback (which could
  count as success) is removed. Exact collected versions are printed.
- CFT per-file pins added and byte-verified at the established image paths:
  `/opt/meri-browsers/chromium-1247/chrome-linux64/chrome` =
  `adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0` and
  `.../chrome_sandbox` =
  `be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314`, from the
  archive `chrome-linux64.zip` (`a24546e0...`, 198335306 bytes) independently
  inspected by Codex + subagent (provenance: integration-repo report
  `docs/coordination/reports/W02-01-BUILD-ACCEPTANCE.md`). Root ownership, mode
  4755 helper, read-only/nonroot/dropALL and all app/browser pins are preserved;
  no browser execution on the authoring host.
- Handoff corrected to current adopted values (Node 24.21.0, snapshot
  `20261009T000000Z`, CA `20250419~deb12u1`), the "10 of 12 fixes applied" claim
  replaced with targeted pending real build/rescan language, and an official base
  license/source reference added (license audit honestly INCOMPLETE).
- Prior runtime-probe evidence recorded (runtime code unchanged this stage): task
  `cfcc4a32e3ea45a7be898d322f663411` started in isolated Fargate after the exact
  DNS repair and STOPPED exit 1 at 2026-10-09T20:57:40Z. Identity/mounts/
  read-only-root/SDK-static/DNS controls PASSED; browser `--sandbox` failed
  FATAL No usable sandbox and XLSX recalc returned null. These are FAILED G1
  probes under the OLD recipe, NOT proof of universal Fargate incompatibility;
  sandbox is not weakened and failures are not hidden. Independent diagnosis and
  a separate runtime-probe repair follow.

## Stage-9 runtime-probe repair (helper alias, diagnostics, Office facts, direct-IP)

Narrow repair at base `f01d6be`. Runtime evidence: task `cfcc4a32e3ea45a7be898d322f663411`
stopped exit 1 at 20:57:40Z; four probes passed (identity, mounts, read-only
root, SDK static, DNS negative+positive) and browser+Office failed. These are
failed G1 probes under the OLD recipe, NOT proof of universal Fargate
incompatibility; sandbox is not weakened and failures are not hidden.
- A. Browser helper discovery/diagnostics: `browser.mjs` reports bounded
  prelaunch diagnostics — pinned `chrome_sandbox` + adjacent `chrome-sandbox`
  alias with path/realpath/uid/gid/mode/sha256 (Chromium 155.0.8059.12
  `setuid_sandbox_host.cc` expects the hyphen name; the underscore helper is
  never auto-discovered and the CHROME_DEVEL_SANDBOX fallback is ignored for a
  root-owned chrome with non-root UID 10001) — plus `/proc/self` Cap*/NoNewPrivs/
  TracerPid/Seccomp and UID/GID maps, the helper/root mount flags (nosuid/ro/
  noexec relevant), read-only sysctls and a simple non-root
  `libc.unshare(CLONE_NEWUSER)` child diagnostic (labelled NOT Chromium's full
  predicate; not a standalone required pass). The Dockerfile creates a
  root-owned adjacent `chrome-sandbox` alias (cp -a of the pinned helper, mode
  4755, byte-identical, original preserved) and byte-verifies it at the
  established paths. The browser-dependent sequence STOPS after the FIRST fatal
  launch/navigation result; remaining steps are recorded not-run; independent
  Office/runtime probes continue.
- B. Office evidence: `artifacts.py` uses the documented XlsxWriter blank cache
  (`write_formula(3,0,formula,None,"")`, never seeding 6) and reports observed
  inputs/formula/cached value separately from the verdict plus bounded A4 XML and
  calcPr facts and file hashes; `artifacts.mjs` preserves each child's status/
  signal/error/parse-status and bounded stdout/stderr, emits per-format
  convert/PDF/page/PNG facts and the recalc observed value even on failure, and
  requires original inputs [1,2,3], the retained SUM formula and a numeric cached
  6 (constant 6 without the formula fails). Actual Office output is unavailable
  on the authoring host, so a target rerun is needed. Visual acceptance is NOT
  claimed (pixels are not exported).
- C. Network: `probe:runtime` extends the opt-in probe with a bounded direct TCP
  443 to the fixed public `1.1.1.1` (no DNS/provider/model/source HTTP). It
  requires the positive private Logs-endpoint control plus DNS negatives plus a
  direct-IP denial; CONNECTED fails; ambiguous/other results fail closed. A
  timeout/ENETUNREACH/EHOSTUNREACH establishes only that the measured attempt was
  denied under the reviewed SG/routes. No route/SG/IAM change here.

## Changed files (the fifteen owned tracked paths)

| Path | SHA-256 |
| --- | --- |
| apps/worker/qualification/package.json | 1908a7b5b022a60a8e75488945517784be52e54e0eeff31feac7d052819323d2 |
| apps/worker/qualification/package-lock.json | ed0c7329cd1cd24487848f4bf6fcf5cfd97f877f17b25240fd4c255d385f58b4 |
| apps/worker/qualification/.gitignore | 69f504fac53d1b2ff914d4f3c297f638bfad612e3080a8e070a9c20b02581536 |
| apps/worker/qualification/.dockerignore | 1bb5cd790f07faeec7b85b5b9fc2291d6461b82fe0d1150e1085f971c6eccfda |
| apps/worker/qualification/Dockerfile | 5e19c6aa5829221ea61f09a3df82cff5414c53b24119edd004c2cec367842c2c |
| apps/worker/qualification/requirements.lock.txt | dc9723a2b883277483f960ad4251ff79b140cab15fdadae198ea222866488564 |
| apps/worker/qualification/component-pins.json | a793b7ba2a28e82a4057815ed9bb79a8e800e6ab0cea4c89c2e9fe1af9b82b79 |
| apps/worker/qualification/sdk-options.mjs | 174efdfcf4731845d65c1f32de4c73e8a9032ccf1522022ab7675ccc7e6a5d9e |
| apps/worker/qualification/probes/static.test.mjs | 55e8e2e7cfdafa6074e4b472cb26685d4e0b87a62e1c91477f40bf0179ee132f |
| apps/worker/qualification/probes/runtime.mjs | 586f400d957ab2518009b40b63ed3d2ad86d9a1cf9ccf15d4ab9b59fc981ef55 |
| apps/worker/qualification/probes/browser.mjs | f3f3b8856141947c7053ed71eab9aea9c23bae150613bce955a5e835a31d759a |
| apps/worker/qualification/probes/artifacts.mjs | 557b9372e6221d986b2e9850ac1d9a46c2057adc3860a3cf3f5b529cd204480d |
| apps/worker/qualification/probes/artifacts.py | b75d7eacc12c88fc87b23c7aab6bfa22adbb22eee99b4236f01ac90bde858d15 |
| apps/worker/qualification/README.md | fd47fc3e65cf2524ceb100f9d650a9ab3944c95e5672523ad58a2b1187881076 |
| docs/coordination/reports/W02-01-WORKER-IMAGE.md | this file |

No other tracked path was modified. No contract, root lockfile, migration, plan
or existing Meri/Capiro file was touched.

## Checks run (from the assigned worktree, after the final edit)

| # | Command | Exit | Result |
| --- | --- | --- | --- |
| 1 | `npm run check` (root canonical contract/H00) | 0 | tests 15 / pass 15 / fail 0 |
| 2 | `npm --prefix apps/worker/qualification test` | 0 | tests 69 / pass 69 / fail 0 |
| 3 | `git diff --check` | 0 | no whitespace/conflict errors |

Nested suite grew 61 → 69 (stage-9 helper-discovery, unshare/mount, stop-sequence,
Office observed-value and direct-IP fixtures). All non-vacuous.

## Adopted versions, licenses and integrity

- npm (exact, locked): `@anthropic-ai/claude-agent-sdk` 0.3.295 (bundled CLI
  2.1.295, linux-x64 binary checksum 4503bfe1…, proprietary "SEE LICENSE IN
  README.md"); `@modelcontextprotocol/sdk` 1.32.1 (MIT; diagnostic MCP client
  within MCP's published dev range ^1.25.2); `@playwright/mcp` 0.0.83
  (Apache-2.0); `playwright`/`playwright-core` 1.64.0-alpha-1790635538000
  (Apache-2.0); `pptxgenjs` 4.0.1 (MIT); `pdfjs-dist` 6.4.299 (Apache-2.0,
  preview candidate only).
- Chromium: revision 1247 / Chrome-for-Testing 155.0.8059.12; archive
  `chrome-linux64.zip`, SHA-256 `a24546e0…`, helper `chrome_sandbox`.
- Python (hash-pinned): python-docx 1.2.0, XlsxWriter 3.2.9, openpyxl 3.1.5,
  pypdf 6.20.0; transitives lxml 6.1.3, et_xmlfile 2.0.0, typing_extensions 4.16.0.
- OS: base `node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20`
  (linux/amd64 manifest `sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd`);
  Debian repositories pinned to snapshot `20261009T000000Z` (main + security) with
  signature verification and source-scoped `Check-Valid-Until: no`; direct pins at
  the highest snapshot candidates plus `ca-certificates=20250419~deb12u1`, then a
  no-removal `apt-get -y --no-remove dist-upgrade`. Base license/source:
  https://raw.githubusercontent.com/nodejs/node/v24.21.0/LICENSE ,
  https://nodejs.org/en/blog/release/v24.21.0 ,
  https://raw.githubusercontent.com/docker-library/official-images/master/library/node ;
  license audit INCOMPLETE (links recorded, notice files/full audit not retained).
- Per-file license SHA-256 recorded in `component-pins.json` `licenseFiles`.
  This is NOT a completed license audit.

## Native Office generation/render results

NOT RUN. Probes and pure decision helpers are prepared and offline-tested; no
converter/render was executed here. Actual rendering and visual review remain
live gates.

## Unbuilt / unrun status

Image NOT built; `assembledImageDigest` = null. Docker daemon absent; no cloud
build attempted. No SDK/model/browser/Office/cloud call was made; no credentials,
provider calls, deployments, pushes or out-of-scope temp writes. The CfT archive
was downloaded to owned scratch, hashed/inspected without launching, then removed.

## Live gates that remain NOT RUN (G1 incomplete; W03 blocked)

Image build and immutable assembled digest; target Linux SDK executable and
query/stream; non-root sandbox-enabled MCP Chromium plus real download;
LibreOffice/fonts/native export and visual render review; uploaded
configuration/instructions inert; curated original skill pack; model proxy and
denied direct provider/source/internet paths; real isolated Fargate IAM/read-only
mounts/task separation/capabilities; verified remote opaque-session plus
workspace snapshots; interrupt/resume/replacement-task restoration and
stale-fence rejection; SDK mirror_error handling; Temporal production
topology/backups/restore; measured startup, peak memory/disk, export/restore
timing and usage/cost. Local offline results cannot pass these gates.

## Scope / policy / migration effects

None. No migration IDs allocated. No source connectivity enabled. No global
settings/profiles changed. One writer maintained. No prior commit amended, no
push, no recursive delegation, no background scheduler.

## Remaining risks

- The live chrome://sandbox row set, /proc evidence and network positive control
  are prepared but unproven live; volume-initialisation ownership remains an
  assumption to verify live.
- The SDK reference store does NOT deduplicate UUIDs (measured).
- MCP tool schemas are discovered at runtime (`listTools`); `browser_get_config`
  availability and the `browser_evaluate` function argument are handled
  defensively.

## Process / checkpoint state

Single writer. Stages 1–5 as above; this continuation applied the pinned-browser
corrections and reran the three canonical checks green. Working tree contains only
the fifteen owned paths (plus ignored `.runtime/` and nested `node_modules/`).

## Next action

Commit the fifteen owned paths; Codex reruns checks, commissions a separate
read-only Hermes review on the exact SHA, then builds the image and runs the
isolated Fargate evidence for the NOT RUN gates.
