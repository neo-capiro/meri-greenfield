# W02-07 bounded synthetic Office evidence export — independent real-Hermes exact-commit review (review-4)

Reviewer: separate real Hermes session (NOT the implementation writer).
Candidate under review: **`8eacd0f3eda4de8c15262973ab1eddc7207cdc2e`** on
`review/w02-office-export-owner-4` at worktree
`C:\dev\main\meri-greenfield-worktrees\w02-office-review-4`.
Candidate chain: real-Hermes repair-3 `e82923dc5b1057e79acc99e28d3d9f5b0553773a` plus the explicitly
attributed **Codex owner correction `8eacd0f`**. Pinned base `d5849941126f226828f006a5301c12aea220ddeb`.

Scope reviewed (exact source, not merely tests):
`apps/worker/qualification/probes/office-export.mjs`,
`apps/worker/qualification/probes/office-reconstruct.mjs`,
`apps/worker/qualification/probes/office-export.test.mjs`,
`docs/coordination/reports/W02-07-OFFICE-EXPORT.md`.
Cross-read as authoritative unchanged inputs: `probes/artifacts.mjs`, `probes/artifacts.py`,
`probes/runtime.mjs`, and the read-only captured oracle
`C:/dev/main/meri-greenfield-kickoff-20261009/docs/coordination/private-evidence/W02-fargate-baseline-3-run/runtime-summary.json`.

Reviewer writable/committed path: THIS FILE ONLY. Scratch under ignored `.task-inputs/`. No accept/
deploy authority; Codex independently accepts or rejects.

## Recorded hashes (sha256, this checkout)

- `apps/worker/qualification/probes/office-export.mjs` = `78a3526f0e7ea738f675433a5289c49552011cef7267a2c9057827fb42ab5156`
- `apps/worker/qualification/probes/office-reconstruct.mjs` = `133d8c5adbfae930aa5e59d7d633e73482994106382cebef35b065d059303205`
- `apps/worker/qualification/probes/office-export.test.mjs` = `da1087cd155c64a85a5d9dd818db275688f6e8610719d665007a8649e3423dde`
- `docs/coordination/reports/W02-07-OFFICE-EXPORT.md` = `07725ad89490cb47bdbcb3f97a5f5a6fcb37ab0cd1db281ed0af238ef716693d`

All four match the hashes supplied in the review brief exactly. `git diff --check` clean.
Scope diff `d584994..HEAD` adds exactly these four paths (A); `8eacd0f^..8eacd0f` touches exactly
these four (M). No unchanged sibling, Dockerfile, package/lock, contract or task-brief file changed.

## What was independently executed (pure, offline, no deps installed)

1. `node --test apps/worker/qualification/probes/office-export.test.mjs` — **55 pass / 0 fail / 0 skipped**
   (Node v24.19.0). The suite imports the candidate unchanged; because this fresh checkout has no
   `node_modules`, the one transitively-required bare package (`@anthropic-ai/claude-agent-sdk`, pulled
   only through `runtime.mjs`→`sdk-options.mjs`, unused by these cases) was satisfied by a review-only
   ESM resolve hook and stub under ignored `.task-inputs/` — **no dependency install, no network, no
   candidate edit**. Disclosed: the production checkout installs the real pinned SDK.
2. Independent adversarial harness (reviewer-authored, `.task-inputs/review4-adversarial.mjs`) driving
   the REAL candidate exports with a **fresh baseline-derived faithful payload** (built from the
   actual `artifacts.py`/`runtime-summary.json` shapes, `recalc.file` present and **no fabricated
   `recalc.newFile` field**): baseline accepted by BOTH `verifyArtifactsVerdict` and `validateCapture`.
   **59 fresh should-reject mutations (42 encoder + 6 child-result + 11 decoder) → 0 wrongly accepted**,
   every decoder rejection carried a non-empty reason. Examples beyond the shipped suite:
   `xlsx cache 0`, `0`/string/object cache, docx structure missing/duplicated `word/document.xml`,
   PPTX missing `slide2` part, PDF two results, PNG docx=2 / pptx=1, relative/traversal/wrong-suffix
   `recalc.file`, child file disagreement, evidencePaths objects/too-many/too-long, generation
   `resultCount`=3, decoder `cache 0`, dropped last chunk, end `chunkCount`/`manifestSha256` tamper,
   truncated manifest (10 files), per-chunk byte-flip with matching length.
3. `git diff --check` clean; scope enumerated above.
4. Read-only cross-check of the optional owner harness
   `C:/dev/main/meri-greenfield-worktrees/w02-office-export/.task-inputs/office-audit-owner-final/`
   (`audit.mjs`, `results.json`) — **corroboration only, not treated as proof**: actual baseline-3
   payload accepted by verdict+decoder; 20 payload + 6 decoder mutations rejected; base-junction
   rejects with exit 1 and zero spawns; input junction rejected; invalid/missing PID and EPERM all
   `UNKNOWN`. Matches the owner's described counts.

## Source findings (exact, with lines)

- **Authoritative facts, not summary/nested status.** `buildGenerationFacts` (office-export.mjs:203-305)
  retains only bounded typed observations and `validateGenerationFacts` (347-399) is shared by encoder
  verdict and decoder (office-reconstruct.mjs:236). `validateGenerate` (401-432) requires
  `generate.parseOk:true` **and** `parsed.ok:true`, exactly 2 results, exact DOCX
  `reopened.headings`/`tableText`/`tableCount`/`word/document.xml`, exact XLSX `inputs`/`a4Formula`,
  `a4CachedValue === null`, and `validStructure` (335-340) rejects absent/`{}`/duplicate/`..`/absolute
  part arrays. `validatePptx` (434-450) requires 2 slides / 2 notes and the required slide/notes parts.
  A lone nested `status:'pass'` never satisfies this. Confirmed faithful to unchanged
  `artifacts.py` and the baseline-3 `childResult` (docx `headings:["Meri qualification heading"]`,
  xlsx `a4GeneratedCachedValue:null`, pptx `slideCount:2/notesCount:2`, PDF 1/1/2, PNG 1/1/2).
- **Initial blank cache vs numeric recalc 6.** `xlsx.a4CachedValue` is required `=== null` (427);
  recalc `cachedValue` must be numeric `6` (459) and the child's observed facts must be byte-equal
  (477-481). Directly matches the unchanged probe (blank XlsxWriter cache; `xlsxrecalc` numeric 6).
- **Real `recalc.file` binding, no fabricated `newFile`.** Encoder maps the payload's real
  `recalc.file` into the bounded `generation.recalc.newFile` slot and the inspection child's `file`
  (285,291); decoder requires an absolute, bounded, suffix-anchored path inside the reported fresh run
  root (460-464) and `child.file === newFile` (477). `main` additionally binds that path to the
  discovered exclusive run directory and freshly verified file (852-854). No source `newFile:true`
  field is invented or demanded (verified: payload has none).
- **Structure/cache/PNG types.** DOCX/XLSX ZIP member arrays are retained as bounded typed string
  arrays with the matching summary flags (`hasDocumentXml` 254/419, `hasSheetXml` 262/429); PNG counts
  are exact integers 1/1/2 in encoder (368) and decoder (618).
- **Filesystem safe through root, no junction above run.** `assertPathChainIsRealDirectories` (527-542)
  walks every component from filesystem root down, rejecting symlink/junction/non-dir at ANY level;
  `inspectExpectedFiles` calls it on the run root (563) plus `assertRealDirectoryAncestors` (545-557)
  per internal ancestor, and real-path containment (565,578-579). `main` preflights `baseRoot` with
  `allowMissing` **before** any mkdir/spawn (837-838) and rechecks the created root/base (840,843).
  `checkDestination` (office-reconstruct.mjs:302-318) rejects missing/non-dir/symlink ancestors.
- **Exclusive output + descriptor identity.** `writeReconstruction` acquires the directory exclusively
  with `mkdir` and `wx` files, removing a partial tree on failure and retaining uncertainty (331-352);
  `readRegularFileVerified` (596-615) and `readBoundedText` (365-389) compare pre-read `lstat`→`fstat`
  on dev/ino/nlink/size/**mtimeMs/ctimeMs**, read incrementally, and re-verify after read, with the
  size cap applied BEFORE allocation.
- **Child cleanup fail-closed.** `verified` requires `cleanupConfirmed === true` (496). `defaultGroupKill`
  (622-630) validates `pid>1` and kills only the owned group; `defaultProbeGroup` (637-646) treats only
  a definite non-live result (`kill(-pid,0)`→ESRCH) as absent — alive/EPERM/unknown/malformed → not
  confirmed. `runArtifactsChild` resolves only after `'close'` (stdout/stderr drained) with bounded
  grace; normal close with a live owned group kills then bounded-confirms; error/timeout/signal/overflow
  paths stay fail-closed. Invalid grace fails before spawn (662).
- **Decoder bounds before allocation.** `extractRecordLines` (100-126) bounds bytes and counts lines
  **while scanning**; `collectRecords` (144-167) enforces ≤12KiB per protocol line and record/line caps;
  `readBoundedText` caps at 32 MiB pre-allocation; end/manifest sha256 and every decoded length/hash are
  bound (264,293-294); canonical base64 (70-76); UUID identity and exact limits (230-235).

## Verdict

**PASS (independent exact-commit review)** for the reviewed offline/preparation candidate, with
explicit ACCEPTED LIMITATIONS below. The reviewed code is a faithful, bounded, fail-closed encoder/
decoder pair: it retains the exact authoritative observations of the unchanged probe, requires the
real `recalc.file` with a genuinely blank initial cache distinct from the numeric 6, validates the
filesystem from the root down before any write/spawn, confirms cleanup only on definite process-group
absence, and bounds all decoder inputs. 55 shipped pure tests pass and 59 additional independent
should-reject mutations are all rejected with zero wrong-accepts. This is a review verdict only:
Codex owns acceptance; no gate is promoted.

## ACCEPTED LIMITATIONS / notes (not defects in the Linux export path)

- `defaultProbeGroup` (office-export.mjs:637-646) returns `false` (= absent) on non-Linux hosts with a
  valid pid, confirming cleanup from direct-child close without an independent group probe, because no
  detached group is created off-Linux. The export platform is Linux (detached group + `kill(-pid,0)`
  ESRCH); the non-Linux/authoring path is exercised only via injected fakes. Disclosed in the report.
- The report cites `docs/coordination/reports/W02-07-OFFICE-CODEX-REPAIR-2.md`; that path is not in
  this branch's tree (it exists on other refs, e.g. commits `9d938b8`/`19077eb`). Documentation
  reference only; no code impact.
- The `capture` record embeds the bounded generation facts; a structurally valid but larger-than-baseline
  member set could exceed the 12 KiB line cap and abort — fail-closed, never a wrong-accept. The
  baseline-3 facts fit.
- Filesystem checks do not claim OS isolation and cannot eliminate concurrent races; local stdout
  completion proves LOCAL WRITE ONLY, not CloudWatch delivery. cgroup observations are cgroup-wide.

## NOT RUN (explicit)

Native Office/LibreOffice/soffice, `pdftoppm`, Python native generators, pptxgenjs, any browser/
Playwright probe, any AWS/CloudWatch/Fargate/ECR action, any socket/server, any provider/model/SDK
query, any dependency install or network call, image build, real artifact byte export, full
reconstruction of real bytes from a real capture, owner visual QA, Fargate/durability and G1. The
worker `static.test.mjs` suite (unchanged, outside this review's owned paths) was **NOT RUN**: this
fresh checkout lacks its required packages (`@modelcontextprotocol/sdk`, `@anthropic-ai/claude-agent-sdk`
`manifest.json`/`sdk.d.ts`, `playwright-core/browsers.json`) and no install was performed.

## Process integrity

Separate real-Hermes reviewer; one owner; no delegation, background scheduler, global settings change,
approval bypass, or self-resume. Commit is REPORT ONLY on `review/w02-office-export-owner-4`. No amend,
no push, no integration. Codex independently accepts or rejects.
