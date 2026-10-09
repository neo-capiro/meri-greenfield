# W02-07 bounded synthetic Office evidence export — Hermes implementation report

Status: **repair implemented, offline qualification PASS; native NOT RUN; ready for
re-review**. The initial candidate `89a36bf0e8ae515468c39738f4e8d3874dce7617` was **REJECTED**
by the owner's independent audit (`.task-inputs/office-audit-89a36bf`, 39 pass / 1 skip + 81 + 15).
This document covers that initial implementation AND the bounded same-session repair that fixes every
reported defect. No gate passed, no deployment/push, no cutover, no W03 promotion. Codex owns
acceptance; a separate real Hermes exact-commit review precedes the owner's build and any native/
browser execution. This is evidence-export preparation only — not native revision/editor fidelity,
publication, auth, recovery or G1 acceptance.

- Repair base (rejected initial candidate): `89a36bf0e8ae515468c39738f4e8d3874dce7617`
  (original pinned allocation base: `d5849941126f226828f006a5301c12aea220ddeb`)
- Branch: `hermes/w02-office-export`; worktree `C:\dev\main\meri-greenfield-worktrees\w02-office-export`
- Session: `20261009_183026_e5b164` (one bounded real Hermes session, explicit same-session repair)
- Bounds: <=40 turns / <=3600s; no self-resume, no retry, no recursive delegation, no global
  settings, no push, no amend.
- Dependencies: accepted worker `797da3a`/code `577e8f0`, mechanically passing baseline `3`.

## Owned paths (exactly four, all new)

- `apps/worker/qualification/probes/office-export.mjs`
- `apps/worker/qualification/probes/office-reconstruct.mjs`
- `apps/worker/qualification/probes/office-export.test.mjs`
- `docs/coordination/reports/W02-07-OFFICE-EXPORT.md` (this file)

No change to any existing probe, `artifacts.mjs`/`artifacts.py`, the Dockerfile, package/lock,
contracts, infra, task brief or other report. `artifacts.mjs` is spawned UNCHANGED, exactly once.
The existing Docker `COPY probes/ ./probes/` already includes the new `.mjs` files.

## What the initial candidate implemented (retained)

An opt-in Linux `office-export.mjs` that runs the unchanged `artifacts.mjs` once with REQUIRED
rendering in a fresh `/workspace/qualification-artifacts` subtree, verifies the structured verdict,
and streams the exact eleven allowlisted files as marker-prefixed (`MERI_OFFICE_EXPORT_V1`), indexed
6144-byte base64 chunk records plus a `capture` manifest and an `end` record; and a pure
`office-reconstruct.mjs` decoder that validates the bounded protocol before writing to a NEW
directory, with a CLI. The eleven files are `native/{qualification.docx,qualification.xlsx,
qualification.pptx}`, `render/{docx,xlsx,pptx}/qualification.pdf`, `render/{docx,xlsx}/page-1.png`,
`render/pptx/{page-1,page-2}.png`, `render/recalc-out/qualification-copy.xlsx`.

## Repair (same session) — every audited defect fixed

The owner audit (pure/fake reproductions, no native/Office execution) reported six concrete defects;
each is now fixed and covered by a regression test:

1. **Unbounded pending writes.** `streamRecords` awaited a write callback that could never fire, and
   a late final write falsely passed. Now every write is raced against the remaining **absolute**
   deadline (`writeBounded` with a timer + stream `error` + callback + throw, each settling exactly
   once), stream listeners/timers are always cleaned up, the deadline is re-checked absolutely after
   the last write, and `normalizeDeadlineMs` rejects NaN/Infinity/non-positive/over-120 s values
   (used for the generation deadline, the export deadline and abort emission). Audit results flipped
   to `{ok:false}` for stuck-write, error-during-pending, late-final-write.
2. **Unclean child exit.** `runArtifactsChild` now spawns the probe in its own **owned Linux detached
   process group**, kills ONLY that validated group (`defaultGroupKill` / injectable `groupKill`),
   and resolves only after the child `close` event AND a confirmed absent process group/descendants
   within a bounded grace (`defaultProbeGroup` / injectable `probeGroup`). A kill request, a false
   kill result or an error is NOT confirmation of exit; uncertainty fails closed
   (`cleanupConfirmed:false` + `error`), and `verifyArtifactsVerdict` requires cleanup. Full
   structured child/native/convert/png/pdf/recalc facts are retained; raw stderr is never emitted.
3. **File-boundary gaps.** `inspectExpectedFiles` now validates EVERY real-directory ancestor of each
   file (rejecting an internal `native/` junction/symlink), the leaf type/linkcount/cap, real-path
   containment, and descriptor identity/linkcount/type/size/timestamp **before AND after** the read
   (`O_NOFOLLOW` on Linux). The reconstructor acquires the output **exclusively** with `mkdir`
   (`EEXIST` loses; an existing dir/file is never reused), creates files exclusively (`flag:'wx'`),
   validates everything BEFORE output, and removes the fresh directory on any write failure so no
   partial artifact remains. Audit `ancestorJunction` flipped to `false`.
4. **False wrapper verdict.** `verifyArtifactsVerdict` now builds a bounded authoritative
   generation-facts object and validates it strictly: clean exit + `cleanupConfirmed`, `ok:true`,
   native `generate`/`pptx` child `ok/status0/no signal/no error/parseOk`, per-format convert + PNG +
   PDF-inspection child statuses, `pages` and `pngCount` **exactly 1/1/2**, recalc child
   `ok/status0/parseOk/nestedOk`, formula `=SUM(A1:A3)`, inputs `[1,2,3]` and numeric `6`. It no
   longer trusts a nested `status:pass` alone. `end.elapsedMs` is now a genuinely measured export
   phase value (through the last chunk flush; the end line's own flush is excluded and scoped in
   code). Audit `badVerdicts` all flipped to `false`.
5. **Loose decoder.** The decoder now enforces input/line/record bounds BEFORE heavy work (every
   complete protocol line <=12 KiB before parsing; aggregate input <=32 MiB; <=20000 lines/records),
   requires a **UUID** capture identity, exact `limits`, strict generation facts (no failed
   generation), strict `end.files` entries (unknown nested fields rejected) and a bounded
   `end.elapsedMs`. Original exact-11-file/hash/base64/end-integrity checks are retained and the
   provisional caps are NOT expanded. Audit `decoder.*` all flipped to `false`; `invalidBeforeWrite`
   remains `{result:false, exists:false}`.

Adversarial regressions added: never-callback/error-pending/late-final-write, invalid deadlines,
no-close and false-close/descendant-remaining cleanup, an internal Windows **junction** ancestor
(not a skipped symlink), exclusive-output acquisition race, non-UUID/limits/generation/oversized-line
decoder rejections, and the audit's verdict mutations.

## Checks (separate outcomes / counts)

- `node --test apps/worker/qualification/probes/office-export.test.mjs` — **47 pass / 0 fail / 0
  skipped** (47 tests).
- Owner audit reproduction rerun (`.task-inputs/office-audit-89a36bf/audit.mjs`, fakes only) — every
  previously-failing field now demonstrates the fail-closed value (no `PENDING`, no `true` where a
  failure is required).
- Worker existing suite `npm test` (apps/worker/qualification) — **81 pass / 0 fail** (unchanged).
- Root `npm run check` (contracts + evals) — **15 pass / 0 fail** (contracts unchanged).
- `git diff --check` — clean.

## Provisional limits (fail-closed)

- Native 512 KiB each / PDF 1 MiB / PNG 2 MiB / total 8 MiB. The accepted baseline did not record
  actual sizes, so these are provisional fail-closed caps; actual bytes are measured, cap hits are
  disclosed, and the export never truncates and calls it success. The owner should confirm these
  against measured live sizes.

## Native NOT RUN (explicit)

The real `artifacts.mjs`, LibreOffice/`soffice`, `pdftoppm`, Python native generators, the pptxgenjs
writer, the Playwright/browser probe, any AWS/CloudWatch/Fargate/ECR action, any socket/server and
any provider/model/source/credential call are **NOT RUN**. The export child and filesystem subtrees
are injected fakes over synthetic bytes. No native Office/render/recalc/visual QA, no image build,
no deployment.

## Known limits / partial state

- Draining to local stdout proves LOCAL WRITE ONLY; it does not prove CloudWatch delivery.
- The CloudWatch `awslogs` `mode: BLOCKING`, the separate Fargate TaskDefinition `EntryPoint:[node]`
  / `Command:[/opt/meri-worker/probes/office-export.mjs]`, readOnly/nonroot/dropALL/noTaskRole/no
  secrets, closed private network/execution role and the exact CloudWatch stream reconstruction are
  OWNER actions after review. `RunTask` command cannot replace the image ENTRYPOINT; this recipe does
  not change the Dockerfile `ENTRYPOINT`.
- The detached process-group kill and group-absence probe are Linux-only (the platform the export
  task runs on); on the Windows authoring host the injected fake/fallback path is exercised. Correct
  fail-closed/reconstruct behaviour is proven only against synthetic fixtures; real captured bytes,
  exact CloudWatch chunking/ordering and human visual review remain unqualified.
- The cgroup observations are read-only, cgroup-wide snapshots and are not a per-child peak or cost.

## Process state / integrity

One owner; no recursive delegation; no background scheduler; no global settings change; no approval
bypass; no native binary/service execution; no browser/socket/server; no model/provider call; no
credentials/cloud/private-source access; no dependency install in this session (existing nested tree
reused). Committed on `hermes/w02-office-export` only (owned paths, no amend, no push). Codex plus a
separate real Hermes exact-commit review own acceptance. No G1/W03/cutover claim.
