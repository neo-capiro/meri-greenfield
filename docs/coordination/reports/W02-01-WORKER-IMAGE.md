# W02-01 worker image and offline qualification preparation — report

Status: `ready-for-review` (not accepted)
Task: W02-01 Worker image and offline qualification preparation
Explicit Hermes session ID: `20261009_152136_008131` (stage 1 partial; stage 2
interrupted on a test hang; stage 3 fixed the hang and committed `bf72484`; stage
4 applied review repairs and committed `a5d6f0e`; stage 5 corrected pinned-browser
handling and committed `3d85f4a`; this is the stage-6 first-build apt-fix
continuation of the same session)
Branch/worktree (cwd): `hermes/w02-image` at `C:\dev\main\meri-greenfield-worktrees\w02-image`
Base commit: `3d85f4ae9fed85956a2cc1afd9cce4c13e8bcefd`
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

## Changed files (the fifteen owned tracked paths)

| Path | SHA-256 |
| --- | --- |
| apps/worker/qualification/package.json | 1908a7b5b022a60a8e75488945517784be52e54e0eeff31feac7d052819323d2 |
| apps/worker/qualification/package-lock.json | ed0c7329cd1cd24487848f4bf6fcf5cfd97f877f17b25240fd4c255d385f58b4 |
| apps/worker/qualification/.gitignore | 69f504fac53d1b2ff914d4f3c297f638bfad612e3080a8e070a9c20b02581536 |
| apps/worker/qualification/.dockerignore | 1bb5cd790f07faeec7b85b5b9fc2291d6461b82fe0d1150e1085f971c6eccfda |
| apps/worker/qualification/Dockerfile | d4508c8428eccb5294b669e14820e9dad7734f1ce52503f4ea66019357561867 |
| apps/worker/qualification/requirements.lock.txt | dc9723a2b883277483f960ad4251ff79b140cab15fdadae198ea222866488564 |
| apps/worker/qualification/component-pins.json | cb8b863b2fee1ae659408607394db6666acb81560ddcef63e27bf188ff6a7dbe |
| apps/worker/qualification/sdk-options.mjs | 174efdfcf4731845d65c1f32de4c73e8a9032ccf1522022ab7675ccc7e6a5d9e |
| apps/worker/qualification/probes/static.test.mjs | 9e42026b722f42b24f6485fee3390d2ffbab5d828f8e421617863d295a0c983c |
| apps/worker/qualification/probes/runtime.mjs | d52d3812eda58eacc6a516fc9c78b90bcd95b3886583a5d2883ce5189092b64a |
| apps/worker/qualification/probes/browser.mjs | c4e6f59d8f11e6f465c136d045ab9701d257fbd5fa27d8c9a118a04c61841324 |
| apps/worker/qualification/probes/artifacts.mjs | 2fe50c87d727b95e3a37341e375c0e467af6a26582859d1b684b5ea5ff7b37ed |
| apps/worker/qualification/probes/artifacts.py | 2adf78dbc3728393c62c9472c437e5caf725e79c988b7354eebba9fe2ed33bef |
| apps/worker/qualification/README.md | cfee3e9e5bdf72cf799b7086494be9a412629adfc839e6abff5f4b82d93b7bac |
| docs/coordination/reports/W02-01-WORKER-IMAGE.md | this file |

No other tracked path was modified. No contract, root lockfile, migration, plan
or existing Meri/Capiro file was touched.

## Checks run (from the assigned worktree, after the final edit)

| # | Command | Exit | Result |
| --- | --- | --- | --- |
| 1 | `npm run check` (root canonical contract/H00) | 0 | tests 15 / pass 15 / fail 0 |
| 2 | `npm --prefix apps/worker/qualification test` | 0 | tests 56 / pass 56 / fail 0 |
| 3 | `git diff --check` | 0 | no whitespace/conflict errors |

Nested suite grew 49 → 56 (stage 5 two-cell sandbox/process/network tests plus a
stage-6 Dockerfile↔component-pins pin-drift test). All non-vacuous.

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
- OS: base `node:24.9.0-bookworm-slim@sha256:3e69116c…`; Debian repositories
  pinned to snapshot `20260901T000000Z` (main + security) with signature
  verification and source-scoped `Check-Valid-Until: no`; candidate packages plus
  `ca-certificates=20230311+deb12u1` resolved to exact versions.
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
