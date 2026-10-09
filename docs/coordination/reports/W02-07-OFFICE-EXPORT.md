# W02-07 bounded synthetic Office evidence export — Hermes implementation report

Status: **repair-2 implemented, offline qualification PASS; native NOT RUN; ready for re-review**.
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

## Repair-2 fixes (every Codex-reported gap)

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

## Owner-audit reproduction (this repair)

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

## Checks (separate outcomes / counts)

- `node --test apps/worker/qualification/probes/office-export.test.mjs` — **47 pass / 0 fail / 0
  skipped** (47 filtered tests; the suite is the same file that previously reported 47, updated and
  extended with the owner-audit reproductions and a complete faithful positive fixture).
- Worker existing suite `npm test` (apps/worker/qualification) — **81 pass / 0 fail** (unchanged).
- Root `npm run check` (contracts + evals) — **15 pass / 0 fail** (contracts unchanged).
- `git diff --check` — clean.

## Remaining bounds (honest, fail-closed)

- The audited accepted fixture omits `recalc.file`, so `newFile` is validated as a well-typed
  `null | non-empty string` rather than required truthy — a required-truthy check would reject the
  owner's accepted baseline fixture. The complete faithful fixture here sets it truthy. (Disclosed,
  not relaxed elsewhere.)
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
