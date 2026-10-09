# W02-07 bounded Office evidence export — independent exact-commit review

Status: **PREPARATION REVIEW ACCEPT (offline)**. Native/NOT RUN; no gate promoted; Codex owns
acceptance. This review is by a separate real Hermes session (not the implementation session) and
does not self-approve, deploy, push, amend or resume.

## Reviewed artifacts

- Reviewed implementation commit (HEAD): `89a36bf0e8ae515468c39738f4e8d3874dce7617`
- Pinned launcher allocation / diff base: `d5849941126f226828f006a5301c12aea220ddeb`
- Branch: `review/w02-office-export`; worktree `C:\dev\main\meri-greenfield-worktrees\w02-office-review`
- Reviewer session: `20261009_184812_ef55b8` (separate reviewer session)
- Reviewed diff `d584994..89a36bf` — exactly four new files (name-status all `A`):
  - `apps/worker/qualification/probes/office-export.mjs` (525 lines)
  - `apps/worker/qualification/probes/office-export.test.mjs` (649 lines)
  - `apps/worker/qualification/probes/office-reconstruct.mjs` (382 lines)
  - `docs/coordination/reports/W02-07-OFFICE-EXPORT.md` (127 lines)
- No existing probe, `artifacts.mjs`, Dockerfile, package/lock, contract, infra, task brief or other
  report is touched. `git status` clean at base; no implementation edits made by this review.

## Checks actually run (real, this host)

| Check | Command | Result | Exit |
|---|---|---|---|
| Root contracts/evals | `npm run check` | 15 pass / 0 fail (15 tests) | 0 |
| Worker existing suite | `npm test` (apps/worker/qualification) | 81 pass / 0 fail (81 tests) | 0 |
| New probe tests | `node --test apps/worker/qualification/probes/office-export.test.mjs` | 40 tests: 39 pass / 0 fail / 1 skipped | 0 |
| Whitespace/conflict | `git diff --check d584994 89a36bf` | clean | 0 |
| Reviewer negative harness | `node .task-inputs/ox-neg.mjs` (ignored scratch) | 27 pass / 0 fail / 1 observe / 1 skip | 0 |

All counts match the implementation report (15 / 81 / 39+1). Node `v24.19.0`.

### The one skip (disclosed, not hidden)
`inspectExpectedFiles rejects a symlink where a regular file is required` is skipped on this Windows
authoring host because `symlinkSync` fails with `EPERM` (no developer mode). The reviewer harness's
sibling case `checkDestination` symlink-ancestor also skipped for the same reason. The symlink
rejection CODE PATHS were read and are correct by inspection (`lstatSync().isSymbolicLink()`,
`O_NOFOLLOW`, `realpath` containment); the specific fixture executes on the owner's Linux host.
This is a platform-skipped fixture — NOT a native Office/render/visual result.

## Extra negative/edge cases exercised (pure/injected fakes, no native tooling)

Real parsing/validation/streaming/FS boundaries only, synthetic bytes. All rejected unless noted:

- `__proto__` as an own JSON key on a chunk record and on a manifest entry -> rejected (unknown
  fields); a lone `ok:true` field -> rejected.
- Identical duplicate capture / chunk records -> tolerated; conflicting capture / conflicting end
  records -> rejected; mixed capture ids -> rejected.
- Truncated chunk data, out-of-range `seq`, `total` mismatch, unknown chunk path, `bytes >
  CHUNK_BYTES` -> rejected; duplicate manifest index -> rejected; float index -> rejected;
  capture `chunkCount` mismatch -> rejected; wrong end `manifestSha256` -> rejected; chunks+end
  without capture -> rejected; empty input -> rejected; non-canonical base64 (`AAA`, `AB==`) ->
  rejected; JSON array record -> rejected.
- Destination with a file-as-ancestor -> rejected.
- Export side: page count OK but short `pngCount` -> rejected; nested `ok:true` behind stdout noise
  -> rejected.
- Observation (strict, acceptable): reordering the capture manifest ARRAY (records untouched) is
  rejected by the `manifestSha256` binding. A faithful exporter emits a deterministic array order,
  so this is fail-closed tamper detection, not a false rejection of a valid capture.

## Implementation vs report

The report is accurate on substance: 120s generation deadline and 120s export deadline; bounded
child stdout 4 MiB / stderr 64 KiB; resolves only on child `close` (kill signal is not exit); async
stdout callback/drain with stream-error and deadline abort; eleven-file non-recursive scan with
`O_NOFOLLOW` + dev/ino/size revalidation and full-length read; `nlink>1` hardlink rejection; realpath
containment; single `error` record + nonzero exit on any failure; pure decoder validating
version/capture identity/exact 11-file set/canonical base64/chunk coverage/end+manifest hash
BEFORE writing; new-directory destination with real-directory ancestors and `wx` no-overwrite.

Path naming was independently confirmed against the UNCHANGED `artifacts.mjs`:
`native/qualification.{docx,xlsx,pptx}`, `render/{docx,xlsx,pptx}/qualification.pdf`,
`render/{docx,xlsx,pptx}/page-1.png` (+ `page-2.png` for pptx), `render/recalc-out/qualification-copy.xlsx`
exactly — `recalc-in/` and LibreOffice profiles are excluded and never recursively walked. Verdict
facts (`native/render/recalc` status, numeric cached `6`, pages `1/1/2`, PNG counts) match the probe's
emitted payload; `recalc.observed.cachedValue` is produced by `decideRecalc`.

## Findings (concrete, with lines)

- **F1 — LOW / ACCEPTED LIMITATION. No explicit input-length or record-count cap before allocation.**
  `office-reconstruct.mjs` `extractRecordLines` (77-101) reads/splits the whole input unbounded and
  the chunk gather loop (246-263) runs `isCanonicalBase64(chunk.data)` (58) and
  `Buffer.from(chunk.data,'base64')` (254) on the full `data` field BEFORE any length check; a
  single adversarially oversized operator-supplied capture allocates proportional to input, and the
  `reasons` array is likewise unbounded. Structural bounds ARE enforced (`chunk.bytes <= 6144` at
  252, declared total `<= CAPS.total` at 231, coverage before write), and the production capture path
  is bounded by the exporter (4 MiB child stdout, `<=1500` chunks), so this is a defense-in-depth gap
  on an offline operator-run tool, not a live defect. Not a rejection trigger.
- **F2 — INFO. Report says "each line asserted <=12KiB"; only chunk lines are asserted**
  (`office-export.mjs:147`). `capture`/`end` lines are built at 176-203 without a length assert. In
  practice they are far below 12 KiB (manifest ~11 small entries + bounded generation facts). Doc
  nuance only; fail-closed behaviour is unaffected (oversized chunk lines abort the export).
- **F3 — INFO / LIMITATION. Reconstruction is validate-before-write, not atomic.** On a mid-write I/O
  error `writeReconstruction` (322-331) returns `ok:false` but leaves files already written. The
  required guarantee ("no partial artifact on FAILED VALIDATION") holds — validation always precedes
  any write and returns `files:[]` on failure — but a write-time error is not rolled back. The reject
  tests cover validation failure only.
- **F4 — INFO. `streamRecords` (442-462) checks the export deadline only BETWEEN writes;** a write
  whose callback never fires would not be interrupted. `process.stdout` callbacks do resolve in
  practice, and the child side is bounded by both the 120s generation deadline and the close-based
  reaping. No observed hang.

No correctness defect was found in the required behaviours (fail-closed verdict, exact 11-path set,
page/recalc facts, child clean-exit + stdio-drained + signal-not-exit, absolute deadlines, bounded
streams, descriptor/ancestor identity, nofollow/hardlink/special/traversal rejection, non-recursive
export, bounded base64 + hash/length/total/end integrity, all-byte verification before output,
new-exclusive destination, no overwrite/partial artifact on failed validation).

## Limits / NOT RUN (explicit, not fabricated acceptance)

- Native `artifacts.mjs`, LibreOffice/`soffice`, `pdftoppm`, Python native generators, pptxgenjs, the
  Playwright/browser probe, AWS/CloudWatch/Fargate/ECR, sockets/servers and provider/credential calls
  are **NOT RUN**. No image built; nothing deployed; no visual QA.
- Draining to local stdout proves **LOCAL WRITE ONLY**; it does not prove CloudWatch delivery. The
  `awslogs mode: BLOCKING`, the separate Fargate TaskDefinition `EntryPoint:[node]` /
  `Command:[/opt/meri-worker/probes/office-export.mjs]` (readOnly/nonroot/dropALL/noTaskRole/no
  secrets, closed private network/execution role), and exact CloudWatch stream reconstruction are
  OWNER actions after review. `RunTask` command cannot replace the image ENTRYPOINT.
- Correctness is proven only against synthetic fixtures; real captured bytes, exact CloudWatch
  chunking/ordering and human visual review remain unqualified. Provisional caps (native 512 KiB /
  PDF 1 MiB / PNG 2 MiB / total 8 MiB) are fail-closed and must be confirmed against measured live
  sizes by the owner.
- Not in this ticket (correctly absent): full product-artifact revision, editor fidelity, UI,
  publication, storage or G1/W03 acceptance.

## Verdict

**PREPARATION REVIEW: ACCEPT (offline).** All four required checks pass with the reported counts; the
implementation matches the report on substance; independent negative cases (27) pass; the exact
eleven-path set and native/render/recalc/page facts match the unchanged source probe. Disclosed
limits: F1 (no hard input/record cap), F3 (non-atomic write recovery), F4 (no per-write timeout),
Windows-skipped symlink fixture, local-stdout-only proof, and native NOT RUN. No implementation
files were modified by this review. Codex owns acceptance; a later bounded task owns genuine native
revision.
