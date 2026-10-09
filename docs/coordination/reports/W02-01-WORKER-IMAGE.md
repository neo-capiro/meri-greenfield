# W02-01 worker image and offline qualification preparation — report

Status: `ready-for-review` (not accepted)
Task: W02-01 Worker image and offline qualification preparation
Explicit Hermes session ID: `20261009_152136_008131` (stages 1–2 partial, interrupted; this is the stage-3 focused continuation of the same session)
Branch/worktree (cwd): `hermes/w02-image` at `C:\dev\main\meri-greenfield-worktrees\w02-image`
Base commit: `07652e874d061a29e92843798e5445d7a6f1d71d`
Result: HEAD of this task commit (full SHA returned in the handoff message; not embedded here to avoid a self-referential hash)

Preparation only. A green offline suite proves local structural/path/parsing
boundaries, not live image build, browser sandbox, Office rendering, durable
sessions or Fargate isolation. G1 remains incomplete and W03 stays blocked.

## Changed files (the fifteen owned tracked paths)

| Path | SHA-256 |
| --- | --- |
| apps/worker/qualification/package.json | 1908a7b5b022a60a8e75488945517784be52e54e0eeff31feac7d052819323d2 |
| apps/worker/qualification/package-lock.json | ed0c7329cd1cd24487848f4bf6fcf5cfd97f877f17b25240fd4c255d385f58b4 |
| apps/worker/qualification/.gitignore | 69f504fac53d1b2ff914d4f3c297f638bfad612e3080a8e070a9c20b02581536 |
| apps/worker/qualification/.dockerignore | 1bb5cd790f07faeec7b85b5b9fc2291d6461b82fe0d1150e1085f971c6eccfda |
| apps/worker/qualification/Dockerfile | d9659eaf2494f659a39703a5385e1c7de7fa58c5bf6dcdeb692a43ccc934fffa |
| apps/worker/qualification/requirements.lock.txt | dc9723a2b883277483f960ad4251ff79b140cab15fdadae198ea222866488564 |
| apps/worker/qualification/component-pins.json | a13172eb699cfc1937a5c60a758271414bc6755e18975e5e8fdf4d4c93c5dc6d |
| apps/worker/qualification/sdk-options.mjs | 174efdfcf4731845d65c1f32de4c73e8a9032ccf1522022ab7675ccc7e6a5d9e |
| apps/worker/qualification/probes/static.test.mjs | fb826c6bfe94eef975444b51abc135f905424238860db89ea7321df11e2f18e0 |
| apps/worker/qualification/probes/runtime.mjs | c956d57196a439c0e86f20d1df3a33f280c68229cc1b32ec8122e36e118c61e0 |
| apps/worker/qualification/probes/browser.mjs | 7c2ff6e3d5636be3fa0d0aa60bd419703276d606ff69fd3e2a5de8a012ec1bf0 |
| apps/worker/qualification/probes/artifacts.mjs | 4b41dc549b7551ba41d31ca199d3c84ad3fc12b2b3bf4f0ca2794c0cf3e47167 |
| apps/worker/qualification/probes/artifacts.py | 2adf78dbc3728393c62c9472c437e5caf725e79c988b7354eebba9fe2ed33bef |
| apps/worker/qualification/README.md | e815db5dec427af2579647459b9048848a8926fe37a76d3efaca065eccf9ec3a |
| docs/coordination/reports/W02-01-WORKER-IMAGE.md | this file |

No other tracked path was modified. No contract, root lockfile, migration, plan
or existing Meri/Capiro file was touched.

## The stage-2 hang: exact defect and repair

Stage 2 was interrupted because the offline suite repeatedly hung. The defect was
in `probes/runtime.mjs` `parseStructuredOutput`: the loop update
`start = trimmed.lastIndexOf('{', start - 1)` clamps a negative position to 0, so
any malformed input beginning with `{` revisited index 0 forever. Reproduced by
Codex's isolated subprocess on `parseStructuredOutput('{ broken')` (terminated
after 3s).

Repair: the function now requires the COMPLETE trimmed stdout to be exactly one
JSON object. Prefix/suffix noise, a non-object, or malformed JSON all fail closed
(`ok:false`); there is no backward scan, so a nested `ok:true` can never satisfy
an outer failed verdict. Logs belong on stderr. Regression tests cover `{ broken`,
`{ broken }`, prefix noise, suffix noise, `[1,2,3]`, `42`, valid pretty
multi-line JSON, and an outer `ok:false` with a nested `ok:true`. The nested
`test` script is now the explicit cross-shell `node --test probes/static.test.mjs`.
The suite completes in ~0.3s with no hang.

## Checks run (from the assigned worktree, after the final edit)

| # | Command | Exit | Result |
| --- | --- | --- | --- |
| 1 | `npm run check` (root canonical contract/H00) | 0 | tests 15 / pass 15 / fail 0 |
| 2 | `npm --prefix apps/worker/qualification test` | 0 | tests 38 / pass 38 / fail 0 |
| 3 | `git diff --check` | 0 | no whitespace/conflict errors |

Root check (15) and nested check (38) are distinct, non-vacuous suites. No
unconditional success echo; counts and exit codes are the actual observed output.

## Adopted versions, licenses and integrity

- npm (exact, locked): `@anthropic-ai/claude-agent-sdk` 0.3.295
  (sha512-GaLZbMAq…, bundled CLI 2.1.295, linux-x64 binary checksum
  4503bfe11a6c…, proprietary "SEE LICENSE IN README.md"); `@modelcontextprotocol/sdk`
  1.32.1 (MIT, diagnostic MCP client within MCP's published dev range ^1.25.2);
  `@playwright/mcp` 0.0.83 (Apache-2.0, sha512-oNcl+Ae2…); `playwright` and
  `playwright-core` 1.64.0-alpha-1790635538000 (Apache-2.0); `pptxgenjs` 4.0.1
  (MIT); `pdfjs-dist` 6.4.299 (Apache-2.0, preview candidate only).
- Chromium: revision 1247 / version 155.0.8059.12 (from the downloaded
  `playwright-core/browsers.json`); installed via the adopted Playwright CLI.
- Python (hash-pinned): python-docx 1.2.0, XlsxWriter 3.2.9, openpyxl 3.1.5,
  pypdf 6.20.0; transitives lxml 6.1.3, et_xmlfile 2.0.0,
  typing_extensions 4.16.0.
- OS: base `node:24.9.0-bookworm-slim@sha256:3e69116c…`; Debian repositories
  pinned to snapshot `20260901T000000Z` (main + security) with signed-by
  keyring verification; all 34 candidate packages resolved to exact versions
  (e.g. libreoffice-core 4:7.4.7-1+deb12u14, libnss3 2:3.87.1-1+deb12u2).
- License files inspected with per-file SHA-256 recorded in
  `component-pins.json` (licenseFiles). This is NOT a completed license audit.

## Native Office generation/render results

NOT RUN in this continuation. `probes/artifacts.py` (native DOCX heading/table,
XLSX formula + known values, PPTX structure inspection, pypdf) and
`probes/artifacts.mjs` (three-format PDF export, PNG render, LibreOffice XLSX
recalculation asserting A4=6, unique LibreOffice profile) are prepared and
statically exercised, but were not executed here. LibreOffice/fonts/exact native
bytes and visual render review remain live gates. Cached XLSX values alone do not
prove recalculation; that assertion is implemented and awaits a LibreOffice run.

## Unfinished stage-2 requirements (carried forward, visible)

- Native Office generation/render execution and visual render review (above).
- Local `probe:browser` / `probe:runtime` execution on the target Linux image.
- Codex's `apps/worker/qualification/.runtime` scratch subtree was not committed
  (ignored); all authoring caches/downloads remained there.

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
settings/profiles changed. One writer maintained on the worktree. No prior commit
amended, no push, no recursive delegation, no background scheduler.

## Remaining risks

- DNS-denial and read-only-root checks are implemented but unproven live.
- Volume-initialisation ownership (`VOLUME ["/workspace","/tmp"]`) requires live
  verification; it is documented as an assumption.
- The SDK reference store does NOT deduplicate UUIDs (measured); a production
  durable adapter must dedup separately and is out of scope.
- `@modelcontextprotocol/sdk` tool schemas for the bundled MCP server are
  discovered at runtime (`listTools`); `browser_get_config` availability and the
  `browser_evaluate` `function` argument are handled defensively rather than
  assumed.

## Process / checkpoint state

Single writer for this worktree. Stage 1 exited 0 (partial, no commit); stage 2
was interrupted while hunting the hang (no commit); this continuation repaired
the defect, finished the README and this report, and ran the three canonical
checks green. Working tree contains only the fifteen owned paths (plus the
ignored `.runtime/` scratch and nested `node_modules/`).

## Next action

Commit the fifteen owned paths; Codex inspects the exact commit, commissions an
independent read-only Hermes review, then builds the image and runs the isolated
Fargate evidence for the NOT RUN gates above.
