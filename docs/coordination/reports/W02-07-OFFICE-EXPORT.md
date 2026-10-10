# W02-07 bounded synthetic Office evidence export — Hermes report and Codex owner correction

Current status: **Codex owner correction implemented; 55 offline tests pass; native NOT RUN;
pending independent exact-commit review and owner acceptance**. The final addendum supersedes the
incomplete claims in the historical Hermes repair account below. No deployment gate is promoted.

Historical Hermes status: repair-2 implemented, offline qualification PASS; native NOT RUN; ready for re-review.
The candidate `d10424b6ac6fbb34e33f3ef9f69427aae9ccc059` was **REJECTED** by the Codex independent
audit (`docs/coordination/reports/W02-07-OFFICE-CODEX-REPAIR-2.md`, reproduction
`.task-inputs/office-audit-d10424b`). This document covers the whole chain (initial `89a36bf`, the
`d104` repair and this repair-2) and the fixes for every reported gap. No gate passed, no deployment/
push, no cutover, no W03 promotion. Codex owns acceptance; a separate real Hermes exact-commit review
precedes any build/native probe. This is evidence-export preparation only — not native revision/
editor fidelity, publication, auth, recovery or G1 acceptance.

- Repair base (rejected `d104`): `d10424b6ac6fbb34e33f3ef9f69427aae9ccc059`
  (initial pinned base `d5849941126f226828f006a5301c12aea220ddeb`; rejected initial `89a36bf0e8ae515468c39738f4e8d3874dce7617`)
- Branch: `hermes/w02-office-export`; worktree `C:\dev\main\meri-greenfield-worktrees\w02-office-export`
- Session: `20261009_183026_e5b164` (bounded remediation of the rejected repair-2)
- Bounds: <=40 turns / <=3600s; no self-resume, no retry, no recursive delegation, no global
  settings, no push, no amend.
- Dependencies: accepted worker `797da3a`/code `577e8f0`, mechanically passing baseline `3`.

## Owned paths (exactly four, all new)

- `apps/worker/qualification/probes/office-export.mjs`
- `apps/worker/qualification/probes/office-reconstruct.mjs`
- `apps/worker/qualification/probes/office-export.test.mjs`
- `docs/coordination/reports/W02-07-OFFICE-EXPORT.md` (this file)

No change to the unchanged `artifacts.mjs`/`artifacts.py`, the Dockerfile, package/lock, contracts,
infra, task brief or other report. `artifacts.mjs` is spawned UNCHANGED, exactly once; the existing
Docker `COPY probes/ ./probes/` already includes the new `.mjs` files.

## Design (retained)

An opt-in Linux `office-export.mjs` runs the unchanged `artifacts.mjs` once with REQUIRED rendering in
a fresh exclusive `/workspace/qualification-artifacts` subtree, verifies the authoritative structured
verdict AND the exact retained nested observations, then streams the exact eleven allowlisted files
as marker-prefixed (`MERI_OFFICE_EXPORT_V1`), indexed 6144-byte base64 chunk records plus a `capture`
manifest and an `end` record. `office-reconstruct.mjs` is a pure decoder that validates the bounded
protocol before writing to a NEW directory, with a CLI. Files: `native/{qualification.docx,xlsx,
pptx}`, `render/{docx,xlsx,pptx}/qualification.pdf`, `render/{docx,xlsx}/page-1.png`,
`render/pptx/{page-1,page-2}.png`, `render/recalc-out/qualification-copy.xlsx`.

## Historical Hermes repair-2 account (subsequently found incomplete)

1. **Authoritative observations were discarded.** `buildGenerationFacts`/`validateGenerationFacts`
   now carry and strictly require the exact retained facts of the unchanged probe (shape modelled on
   `artifacts.py` and cross-checked against the captured baseline-3 run summary): native
   `generate.parseOk:true` **and** `parsed.ok:true` with **exactly two** results and the exact DOCX
   `reopened.headings`/`tableText`/`tableCount` and `word/document.xml`, the exact XLSX
   `reopened.inputs`/`a4Formula` with a **blank** `a4GeneratedCachedValue` (distinct from recalc 6),
   PPTX **exactly 2 slides / 2 notes** with the required slide/notes parts, per-format PDF
   `parsed.ok`/`result.ok`/`pageCount` == 1/1/2 and `pngCount`, and recalc
   `inspected:true`, **exact** inputs `[1,2,3]` (never sliced), `formula`, numeric `6`, and a child
   whose nested observed facts must match the selected observations. Nested `status:'pass'` alone is
   never trusted. The encoder verdict and the decoder share this validator.
2. **Cleanup was not strict or complete.** `verifyArtifactsVerdict` now requires
   `cleanupConfirmed === true` (missing/undefined fails). `defaultProbeGroup` uses `kill(-pid,0)` and
   treats **only** a definite `ESRCH` as absent (alive/`EPERM`/unknown/non-Linux/malformed →
   uncertain, never confirmed). `defaultGroupKill` validates PID ownership (`pid>1`, owned group
   only; never an unrelated/system group). On a normal close with a **live** owned group the runner
   kills that group and bounded-confirms absence + close; it no longer cancels the deadline and polls
   without killing. no-close / false-exit and error/timeout/signal paths stay fail-closed with zero
   live owned descendants required for success.
3. **Source filesystem checks were incomplete.** `inspectExpectedFiles` now validates **every path
   component from the filesystem root through the supplied run root** (rejecting a junction/symlink
   even ABOVE the run root) plus each internal ancestor, and `readRegularFileVerified` compares the
   caller's `lstat` to the **pre-read** `fstat` on identity/type/linkcount/size/**mtime/ctime** as
   well as the post-read `fstat` and the actual read length, so an already-changed mtime is rejected
   before reading. Exclusive output acquisition and validation-before-write are retained; destination
   ancestors are validated too.
4. **Decoder bounds followed allocation.** `extractRecordLines` now bounds line count/budget **while
   scanning** (no full split before the `MAX_LINES` check) and every complete protocol line is still
   enforced `<=12KiB` before parsing. The CLI no longer uses unbounded `readFileSync`; `readBoundedText`
   does a descriptor `fstat` + 32 MiB cap **before allocation**, an incremental read, and a post-read
   identity check. Exact limits, canonical UUID identity, and all nested fields (including a bounded
   `evidencePaths` string array, known `cgroup` fields only, and a finite generation `elapsedMs`
   within the 120 s stage) are enforced; unknown fields/objects/absurd values are rejected. The eleven
   files / 12 KiB line / chunk caps / end hashes are unchanged and no cap was auto-increased.

## Historical Hermes reproduction account (superseded by owner addendum)

Re-running the Codex harness (`.task-inputs/office-audit-d10424b/audit.mjs`, pure fakes) now yields:
`baselineVerdict:true`; all **10** contradictory nested-fact mutations `accepted:false`
(native parse false/nested failure/wrong or absent DOCX structure/PPTX 0 slide+notes/PDF nested
failure/page 99/recalc not inspected/child cached 99/fourth input 999); `missingCleanupAccepted:false`;
all **5** decoder mutations `false` (native parse false/absent, evidence-path objects, unknown cgroup,
over-deadline elapsed); `sourceAncestorJunction.accepted:false`; `stalePreReadTimestamp.accepted:false`
(`mtime/ctime changed before read`); `closeWithRemainingGroup` `killCalls:1`,
`cleanupConfirmed:false`; `unknownGroupProbe` `accepted:false`; `recordBounds`
`allocatedLines:0`/`collectRejected:true`; `invalidBeforeWrite` leaves no destination; roundtrip
succeeds and a repeated acquisition is refused. The earlier `office-audit-89a36bf` harness also still
flips every defect fail-closed.

## Historical Hermes checks (before owner correction)

- `node --test apps/worker/qualification/probes/office-export.test.mjs` — **47 pass / 0 fail / 0
  skipped** (47 filtered tests; the suite is the same file that previously reported 47, updated and
  extended with the owner-audit reproductions and a complete faithful positive fixture).
- Worker existing suite `npm test` (apps/worker/qualification) — **81 pass / 0 fail** (unchanged).
- Root `npm run check` (contracts + evals) — **15 pass / 0 fail** (contracts unchanged).
- `git diff --check` — clean.

## Remaining bounds (honest, fail-closed)

- Superseded claim: the earlier ad-hoc audit fixture omitted `recalc.file`; that fixture was
  incomplete. The actual baseline-3 native payload contains the real `recalc.file` path, and the
  owner correction requires it and the matching inspection-child file. No source `newFile:true`
  field is invented or required.
- Provisional native 512 KiB / PDF 1 MiB / PNG 2 MiB / total 8 MiB caps (baseline had no sizes).
- The detached process-group kill and `kill(-pid,0)` absence probe are Linux-only (the export
  platform); the non-Linux/authoring-host path is exercised via injected fakes.
- Drain = LOCAL WRITE ONLY (not CloudWatch delivery); cgroup observations are cgroup-wide, not
  per-child.

## Native NOT RUN (explicit)

The real `artifacts.mjs`, LibreOffice/`soffice`, `pdftoppm`, Python native generators, pptxgenjs, the
Playwright/browser probe, any AWS/CloudWatch/Fargate/ECR action, any socket/server and any provider/
model/source/credential call are **NOT RUN**. The export child and filesystem subtrees are injected
fakes over synthetic bytes and the captured baseline-3 summary was read only. No native Office/render/
recalc/visual QA, no image build, no deployment, no actual artifact bytes, no CloudWatch delivery.

## Process state / integrity

One owner; no recursive delegation; no background scheduler; no global settings change; no approval
bypass; no native binary/service execution; no browser/socket/server; no model/provider call; no
credentials/cloud/private-source access; no dependency install in this session (existing nested tree
reused). Committed on `hermes/w02-office-export` only (owned paths, no amend, no push). Codex plus a
separate real Hermes exact-commit review own acceptance. No G1/W03/cutover/security claim.

## Codex owner correction addendum

Codex independently rejected the closed Hermes candidate
`e82923dc5b1057e79acc99e28d3d9f5b0553773a` despite its 47 passing tests. The residuals were
discarded or coerced DOCX/XLSX structure/cache observations, nullable/foreign `recalc.file`,
noninteger retained PNG counts, unsafe base-ancestor rejection after writes, malformed Linux
PID treated as absent, decoder input through a junction, and object evidence paths stringified
into plausible metadata. This owner-attributed correction changes only the four owned paths.
The original separate Hermes ACCEPT review of initial `89a36bf` remains historical; it is not
overwritten or attributed to Codex.

- Retain and require bounded typed DOCX/XLSX ZIP member arrays and the explicit matching summary
  flags. Require the actual initial XLSX cache observation to be exactly `null`; missing, string
  and object values fail. PNG counts must be exact integers 1/1/2 in encoder and decoder.
- Retain the actual `recalc.file` path in the existing bounded `generation.recalc.newFile`
  metadata slot and the inspection child's `file`. Require matching absolute paths to the
  distinct recalculated copy within the reported run; `main` also binds that path to the newly
  discovered exclusive run directory and verified fresh file. The unchanged native probe has a
  `file` field, not a `newFile:true` field. Fake positive generation now binds its file paths to
  the synthetic run it actually creates.
- Preflight all existing base ancestors for symlinks/junctions before any mkdir/spawn, then
  recheck the created root/base. Invalid or missing Linux PID remains unknown; a permission
  error cannot prove process-group absence. Invalid cleanup grace fails before spawn. Existing
  close-plus-group-absence requirements and bounded cleanup remain.
- Validate decoder input ancestors/leaf, link count and pre-read descriptor identity/timestamps
  before bounded allocation; recheck identity/timestamps after read. Bound event/line counts before collecting/splitting messages;
  preserve uncertain partial-output cleanup. Revalidate completed generation metadata and every
  complete record against the unchanged caps before streaming. Evidence paths are not coerced.

Owner verification (pure offline checks only):

- Owned Office suite: **55 pass / 0 fail / 0 skipped**, including eight added regression tests.
- Existing worker static suite: **81 pass / 0 fail**; root contracts/evals: **15 pass / 0 fail**.
- `.task-inputs/office-audit-e82923d/audit.mjs`: actual baseline-3 payload accepted by verdict
  and decoder; all **20 payload mutations** and **6 decoder mutations** rejected. Base-junction
  reproduction: exit 1, **zero spawns and zero created entries**. Input junction rejected;
  invalid/missing PID and EPERM remain `UNKNOWN` under injected Linux process stubs.
- `.task-inputs/office-audit-owner-prior/audit.mjs`: prior d104 cases replayed using the
  **actual baseline-3 positive**, with the historical harness source untouched. All 10 nested
  negatives and 5 decoder negatives reject; stale timestamps/junctions reject; a live group
  receives one kill attempt and still fails cleanup qualification; an unknown group stays
  unconfirmed. Pending/late writes fail, invalid streams write nothing, eleven-file synthetic
  roundtrip succeeds and a repeated output-directory acquisition fails.
- `git diff --check`: clean. Protocol marker/version, fixed file set, size/chunk/deadline caps,
  shared contracts and unchanged `artifacts.mjs`/`artifacts.py` remain unchanged.

The earlier launcher closed at `2026-10-09T23:36:12.468923+00:00` with Hermes exit 0, but
terminated **two remaining descendants**; recorded status was
`descendants-terminated-unreviewed`. Tree empty, readers finished and cleanup were subsequently
confirmed. This is contained cleanup evidence, not a naturally clean child-tree result.

No native Office generation, recalculation, PDF/PNG rendering, browser, server/socket, SDK query,
AWS/provider/model/network operation, image build or artifact visual inspection ran in this owner
correction. The oracle is a read-only prior runtime summary; exported files in tests are synthetic
bytes. Local stdout completion cannot prove CloudWatch delivery. Filesystem checks do not claim
OS isolation or eliminate concurrent filesystem races. Native byte export, owner visual QA,
independent real Hermes review and deployment gates remain pending.
