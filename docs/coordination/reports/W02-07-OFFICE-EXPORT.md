# W02-07 bounded synthetic Office evidence export — Hermes implementation report

Status: **implemented, offline qualification PASS; native NOT RUN; ready for independent review**.
No gate passed, no deployment/push, no cutover, no W03 promotion. Codex owns acceptance and a
separate real Hermes exact-commit review precedes the owner's build and any native/browser
execution. This is evidence-export preparation only — not native revision/editor fidelity,
publication, auth, recovery or G1 acceptance. Genuine revision remains a later bounded task.

- Pinned base (exact launcher allocation commit): `d5849941126f226828f006a5301c12aea220ddeb`
- Branch: `hermes/w02-office-export`; worktree `C:\dev\main\meri-greenfield-worktrees\w02-office-export`
- Session: `20261009_183026_e5b164` (one bounded real Hermes session)
- Bounds: <=40 turns / <=3600s; no self-resume, no retry, no recursive delegation, no global
  settings, no push, no amend.
- Dependencies: accepted worker `797da3a`/code `577e8f0`, mechanically passing baseline `3`.

## Owned paths (exactly four, all new)

- `apps/worker/qualification/probes/office-export.mjs`
- `apps/worker/qualification/probes/office-reconstruct.mjs`
- `apps/worker/qualification/probes/office-export.test.mjs`
- `docs/coordination/reports/W02-07-OFFICE-EXPORT.md` (this file)

No change to any existing probe, `artifacts.mjs`, the Dockerfile, package/lock, contracts, infra,
task brief or other report. `artifacts.mjs` is spawned UNCHANGED, exactly once. The existing Docker
`COPY probes/ ./probes/` already includes the new `.mjs` files, so the owner can build with the
accepted SDK capture later without a Dockerfile edit.

## What was implemented

### `office-export.mjs` (opt-in Linux Office-only wrapper)

- Spawns the unchanged `artifacts.mjs` exactly once as a child of `process.execPath`, in a fresh
  output root `<base>/office-export-<uuid>` under `/workspace/qualification-artifacts`, with
  `MERI_ARTIFACTS_RENDER=required` so the probe's own `probe-<uuid>` subtree is generated.
- Parses the child's single structured JSON object (`parseStructuredOutput`) and requires a clean
  exit AND `native.status==='pass'` AND `render.status==='pass'` AND `recalc.status==='pass'` AND
  the numeric cached recalc value `6` AND PDF page counts docx/xlsx/pptx `1/1/2` with matching PNG
  counts. Any error/signal/timeout/unparseable/missing fact fails — a good-looking nested payload
  after a failed child can never pass.
- Bounded child stdout (4 MiB) / stderr (64 KiB) and a <=120s generation deadline. It does **not**
  accept a kill signal as confirmation of exit: `runArtifactsChild` resolves only on the child
  `close` event (stdio drained AND process reaped); if close never arrives within a small grace
  after `SIGKILL` it fails as uncertain.
- Scans exactly the eleven allowlisted files (never a recursive walk), rejecting a missing file, a
  symlink, a hard link (`nlink>1`), a non-regular/special file, a cap breach and any escape from
  the run root; then revalidates descriptor/stat identity (`dev/ino/size`) after an `O_NOFOLLOW`
  open and requires a full-length read. The eleven-file cap hit is disclosed, never truncated.
- Emits each file as indexed raw chunks of 6144 bytes -> base64, one record per line, every line
  prefixed with the fixed marker `MERI_OFFICE_EXPORT_V1`, each line asserted <=12KiB, aggregate
  <=1500 chunks. Writes with an async stdout callback/drain and aborts on a stream error or the
  <=120s export deadline instead of letting `process.exit` truncate pending writes. A failed
  generation or a truncated export emits a single `error` record and exits nonzero, so no
  capture/end (and therefore no accepted payload) is ever produced after failure.
- Record kinds (stable field sets): `capture` (uuid, protocol, counts, limits, bounded
  native/convert/recalc/page facts, generation/export elapsed timings, optional read-only
  cgroup-wide observations accurately scoped), `chunk`, `end` (counts + `manifestSha256` binding),
  and `error`. Arbitrary subprocess stderr/env values are never emitted.

### `office-reconstruct.mjs` (pure decoder/reconstructor + CLI)

- No AWS client, no network, no native/probe execution and no top-level write/process on import.
- Accepts plain marker log lines OR a documented JSON array of CloudWatch-style event messages
  (`{message}` / `{events|logEvents:[...]}`), preserving embedded newlines. Non-marker lines are
  ignored (interleaved logs); a marker line with malformed JSON fails.
- Validates BEFORE writing and never trusts event ordering or a lone `ok:true`: version, unanimous
  capture id, exactly one capture + one end (byte-identical duplicates tolerated; conflicting ones
  rejected), the exact eleven-file set, allowlisted paths/kinds, per-index integer ranges and caps,
  canonical strict base64 (re-encode equality), chunk/total/seq consistency, complete chunk
  coverage, byte-identical duplicate tolerance, changed-duplicate/unknown-path/mixed-capture
  rejection, and the end/count/`manifestSha256` bindings plus every decoded hash and length. Unknown
  protocol fields are rejected.
- `reconstruct(text, out)` writes only after full validation; the destination must be a NEW
  directory with all-real-directory ancestors (no symlinks). Existing files are never overwritten
  and a failed validation writes no partial artifact. CLI: `--input <captured.ndjson> --out <new-dir>`.

## Checks (separate outcomes / counts)

- `node --test apps/worker/qualification/probes/office-export.test.mjs` — **39 pass / 1 skipped / 0
  fail** (40 tests). The one skip is the symlink-rejection case (`EPERM` creating a symlink on this
  Windows authoring host without developer mode); it executes on the owner's Linux host.
- Worker existing suite `npm test` (apps/worker/qualification) — **81 pass / 0 fail** (unchanged).
- Root `npm run check` (contracts + evals) — **15 pass / 0 fail** (contracts unchanged).
- `git diff --check` — clean.

Test coverage includes: full eleven-file byte round-trip; out-of-order delivery; byte-identical
duplicate delivery; CloudWatch-envelope input; missing end/chunk; changed duplicate; wrong
hash/length/count; non-canonical base64; mixed capture; unknown field; present `error` record;
malformed marker line; missing/directory-as-file/hard-link/symlink/special-file; decoys ignored;
cap breach with no truncation-as-success; failed/signalled/timed-out/unparseable generation cannot
export success; kill-signal-not-exit (await close) semantics; stdout overflow; stream error and
export deadline; reconstruction failure writes nothing and leaves a new destination absent; existing
destination refused and untouched; CLI paths.

## Provisional limits (fail-closed)

- Native 512 KiB each / PDF 1 MiB / PNG 2 MiB / total 8 MiB. The accepted baseline did not record
  actual sizes, so these are provisional fail-closed caps. Actual bytes are measured and any cap hit
  is disclosed; the export never truncates and calls it success. The owner should confirm the caps
  against the measured live sizes.

## Native NOT RUN (explicit)

The real `artifacts.mjs`, LibreOffice/`soffice`, `pdftoppm`, Python native generators, the
pptxgenjs writer, the Playwright/browser probe, any AWS/CloudWatch/Fargate/ECR action, any
socket/server, and any provider/model/source/credential call are **NOT RUN** by this session. The
export child and filesystem subtree are injected fakes over synthetic bytes. No native Office,
render, recalc or visual QA was performed; no image was built; nothing was deployed.

## Known limits / partial state

- Draining to local stdout proves LOCAL WRITE ONLY; it does not prove CloudWatch delivery.
- The CloudWatch `awslogs` `mode: BLOCKING`, the separate Fargate TaskDefinition `EntryPoint:[node]`
  / `Command:[/opt/meri-worker/probes/office-export.mjs]`, readOnly/nonroot/dropALL/noTaskRole/no
  secrets, closed private network/execution role and the exact CloudWatch stream reconstruction are
  OWNER actions after review. `RunTask` command cannot replace the image ENTRYPOINT; this recipe does
  not change the Dockerfile `ENTRYPOINT`.
- fail-closed/reconstruct correctness is proven only against synthetic fixtures; real captured
  bytes, exact CloudWatch chunking/ordering and human visual review remain unqualified.
- The cgroup observations are read-only, cgroup-wide snapshots and are not a per-child peak or cost.

## Process state / integrity

One owner; no recursive delegation; no background scheduler; no global settings change; no approval
bypass; no native binary/service execution; no browser/socket/server; no model/provider call; no
credentials/cloud/private-source access; no dependency install in this session (existing nested tree
reused). Committed on `hermes/w02-office-export` only (owned paths, no amend, no push). Codex plus a
separate real Hermes exact-commit review own acceptance. No G1/W03/cutover claim.
