# W02-01 worker image and offline qualification preparation — report

Status: `ready-for-review` (not accepted)
Task: W02-01 Worker image and offline qualification preparation
Explicit Hermes session ID: `20261009_152136_008131` (stage 1 partial; stage 2
interrupted on a test hang; stage 3 repaired the hang and committed
`bf72484d4c19461b58fa2287c9993926cf8bc100`; this is the stage-4 review-repair
continuation of the same session)
Branch/worktree (cwd): `hermes/w02-image` at `C:\dev\main\meri-greenfield-worktrees\w02-image`
Base commit: `bf72484d4c19461b58fa2287c9993926cf8bc100` (parent `07652e874d061a29e92843798e5445d7a6f1d71d`)
Result: HEAD of this task commit (full SHA returned in the handoff message)

Preparation only. Green offline checks prove local structural/path/parsing
boundaries, not live image build, browser sandbox, Office rendering, durable
sessions or Fargate isolation. G1 remains incomplete and W03 stays blocked.

## Stage-4 review repairs (Codex findings, all addressed)

1. **Snapshot trust + CA bootstrap.** Both fixed deb822 snapshot sources now carry
   source-scoped `Check-Valid-Until: no` (Debian's documented setting for
   historical snapshots), retaining `Signed-By` and package hashes/signatures, no
   `trusted=yes`/unauthenticated/TLS bypass. The slim Node image ships without
   `ca-certificates`, so apt bootstraps the exact resolved
   `ca-certificates=20230311+deb12u1` over HTTP from the same fixed signed
   snapshot, then both sources switch to HTTPS with normal CA verification for all
   subsequent downloads. `ca-certificates` was verified against the same snapshot
   in owned scratch and recorded in `component-pins.json`.
2. **Setuid helper ownership.** The browser tree is no longer chowned to 10001;
   only `/workspace`, `/tmp` and `/opt/meri-worker` are reassigned. A final RUN
   asserts `chrome-sandbox` is root-owned, mode 4755, setuid, and that the browser
   tree remains root-owned after all ownership operations.
3. **MCP Result parsing.** Added a fail-closed `extractResultSection` parser for
   the exact `### Result` Markdown section emitted by playwright-core
   `Response.serialize` (other sections such as `### Ran Playwright code` are
   ignored; an `Error` section fails; missing/duplicate/empty/malformed Result
   fails). `decodeToolResult` prefers `structuredContent` then the Result section.
   Regression fixtures use real framing with JSON-escaped newlines.
4. **Sandbox verdict.** Rewritten to parse exact known rows
   (`Namespace Sandbox`, `SUID Sandbox`, `Seccomp-BPF Sandbox`); requires
   (Namespace OR SUID) affirmative AND Seccomp-BPF affirmative (a disabled unused
   alternative layer is allowed); ambiguous/duplicate/absent rows cannot pass; the
   `SUID No + Namespace Yes + Seccomp-BPF Yes` case now passes. Evidence is all
   actual `/proc` Chromium processes (browser vs renderer distinguished) with
   `--no-sandbox`, `--disable-namespace-sandbox`, `--disable-seccomp-filter-sandbox`
   rejected anywhere; requested config alone is never accepted.
5. **Browser diagnostics.** The MCP stderr listener attaches immediately after
   constructing the transport and BEFORE connect; any navigation/evaluation error
   or client-close uncertainty forces final `ok:false`; the verdict is simply
   `reasons.length === 0`. Structured stdout now carries uid, server version,
   actual Chromium version (`chrome://version`), tool list, resolved config,
   effective source, all process argv with types, `/proc` status/namespace
   evidence, the sandbox row map and bounded raw responses, so Fargate exit does
   not erase evidence.
6. **Office render/recalc.** `recalcXlsx` now uses distinct source (`recalc-in/`)
   and output (`recalc-out/`) directories, requires a successful conversion
   (status 0, no signal/error) and a NEW file, then reopens A4=6. PDF conversion,
   `pdftoppm` and Python PDF inspection all keep authoritative
   status/signal/error and nested `ok`; page counts are accepted only when the PDF
   inspection passed. Disabled rendering (`MERI_ARTIFACTS_RENDER=off`) is a
   visible NOT-PASSED result and can never report qualification `ok:true`.
   Pure decision helpers (`classifySubprocess`, `decideNative`, `decideRecalc`,
   `decideRender`) are covered by offline regressions.

## Changed files (the fifteen owned tracked paths)

| Path | SHA-256 |
| --- | --- |
| apps/worker/qualification/package.json | 1908a7b5b022a60a8e75488945517784be52e54e0eeff31feac7d052819323d2 |
| apps/worker/qualification/package-lock.json | ed0c7329cd1cd24487848f4bf6fcf5cfd97f877f17b25240fd4c255d385f58b4 |
| apps/worker/qualification/.gitignore | 69f504fac53d1b2ff914d4f3c297f638bfad612e3080a8e070a9c20b02581536 |
| apps/worker/qualification/.dockerignore | 1bb5cd790f07faeec7b85b5b9fc2291d6461b82fe0d1150e1085f971c6eccfda |
| apps/worker/qualification/Dockerfile | d656734be1ffe4136c426c5daf63154c6a844fdaa9a5f913c6e0b283e340fad9 |
| apps/worker/qualification/requirements.lock.txt | dc9723a2b883277483f960ad4251ff79b140cab15fdadae198ea222866488564 |
| apps/worker/qualification/component-pins.json | 98b891a452380a6e5d06e4fded544050e617dff56bf3a086c9196baa0278450d |
| apps/worker/qualification/sdk-options.mjs | 174efdfcf4731845d65c1f32de4c73e8a9032ccf1522022ab7675ccc7e6a5d9e |
| apps/worker/qualification/probes/static.test.mjs | 83a4fbeb24c6ef772afbe25c2ded5261697cb505ff6b1b94816377f07edc452b |
| apps/worker/qualification/probes/runtime.mjs | c956d57196a439c0e86f20d1df3a33f280c68229cc1b32ec8122e36e118c61e0 |
| apps/worker/qualification/probes/browser.mjs | 6dcae9c0ffb4f989cffa66799bab32269b89ae40f5522d7f2e0c9f8a9a50db9f |
| apps/worker/qualification/probes/artifacts.mjs | 2fe50c87d727b95e3a37341e375c0e467af6a26582859d1b684b5ea5ff7b37ed |
| apps/worker/qualification/probes/artifacts.py | 2adf78dbc3728393c62c9472c437e5caf725e79c988b7354eebba9fe2ed33bef |
| apps/worker/qualification/README.md | 35c0b65d826fe4659b83047f7f5e8d3faa1de0751c780086c4f36399f4edbacd |
| docs/coordination/reports/W02-01-WORKER-IMAGE.md | this file |

No other tracked path was modified. No contract, root lockfile, migration, plan
or existing Meri/Capiro file was touched.

## Checks run (from the assigned worktree, after the final edit)

| # | Command | Exit | Result |
| --- | --- | --- | --- |
| 1 | `npm run check` (root canonical contract/H00) | 0 | tests 15 / pass 15 / fail 0 |
| 2 | `npm --prefix apps/worker/qualification test` | 0 | tests 49 / pass 49 / fail 0 |
| 3 | `git diff --check` | 0 | no whitespace/conflict errors |

The nested suite (previously 38 tests) is now 49 with the review-repair
regressions. Both suites are non-vacuous; counts and exit codes are the actual
observed output. The stage-2 hang remains fixed (`parseStructuredOutput` parses
the complete trimmed stdout as exactly one JSON object and fails closed on noise).

## Adopted versions, licenses and integrity

- npm (exact, locked): `@anthropic-ai/claude-agent-sdk` 0.3.295
  (bundled CLI 2.1.295, linux-x64 binary checksum 4503bfe1…, proprietary "SEE
  LICENSE IN README.md"); `@modelcontextprotocol/sdk` 1.32.1 (MIT; diagnostic MCP
  client within MCP's published dev range ^1.25.2); `@playwright/mcp` 0.0.83
  (Apache-2.0); `playwright`/`playwright-core` 1.64.0-alpha-1790635538000
  (Apache-2.0); `pptxgenjs` 4.0.1 (MIT); `pdfjs-dist` 6.4.299 (Apache-2.0,
  preview candidate only).
- Chromium: revision 1247 / version 155.0.8059.12; installed via the adopted
  Playwright CLI.
- Python (hash-pinned): python-docx 1.2.0, XlsxWriter 3.2.9, openpyxl 3.1.5,
  pypdf 6.20.0; transitives lxml 6.1.3, et_xmlfile 2.0.0, typing_extensions 4.16.0.
- OS: base `node:24.9.0-bookworm-slim@sha256:3e69116c…`; Debian repositories
  pinned to snapshot `20260901T000000Z` (main + security) with signature
  verification and source-scoped `Check-Valid-Until: no`; all candidate packages
  plus `ca-certificates=20230311+deb12u1` resolved to exact versions.
- Per-file license SHA-256 recorded in `component-pins.json` `licenseFiles`.
  This is NOT a completed license audit.

## Native Office generation/render results

NOT RUN. `probes/artifacts.py` and `probes/artifacts.mjs` (native DOCX heading/
table, XLSX formula + known values, two-slide PPTX, three-format PDF export, PNG
render, LibreOffice XLSX recalculation asserting A4=6 in a distinct directory) are
prepared and their decision helpers are covered by offline regressions, but no
converter/render was executed here. Actual rendering and visual review remain
live gates.

## Unbuilt / unrun status

Image NOT built; `assembledImageDigest` = null. Docker daemon absent; no cloud
build attempted. No SDK/model/browser/Office/cloud call was made; no credentials,
provider calls, deployments, pushes or out-of-scope temp writes.

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

- DNS-denial and read-only-root checks are implemented but unproven live, and
  volume-initialisation ownership (`VOLUME ["/workspace","/tmp"]`) is an
  assumption to verify live.
- The SDK reference store does NOT deduplicate UUIDs (measured); a production
  durable adapter must dedup separately and is out of scope.
- MCP tool schemas are discovered at runtime (`listTools`); `browser_get_config`
  availability and the `browser_evaluate` `function` argument are handled
  defensively rather than assumed.

## Process / checkpoint state

Single writer for this worktree. Stage 1 exited 0 (partial, no commit); stage 2
was interrupted on the hang (no commit); stage 3 repaired the defect and committed
`bf72484d4c19461b58fa2287c9993926cf8bc100`; this stage-4 continuation applied the
review repairs above and reran the three canonical checks green. Working tree
contains only the fifteen owned paths (plus ignored `.runtime/` and nested
`node_modules/`).

## Next action

Commit the fifteen owned paths; Codex reruns checks, commissions a separate
read-only Hermes review, then builds the image and runs the isolated Fargate
evidence for the NOT RUN gates.
