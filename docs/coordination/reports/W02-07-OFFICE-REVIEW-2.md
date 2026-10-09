# W02-07 repair — second independent Hermes review (d10424b)

Reviewer: separate real Hermes reviewer session `20261009_190910_ed9911` (never the
implementation writer). Candidate under review: exact commit
`d10424b6ac6fbb34e33f3ef9f69427aae9ccc059` on `review/w02-office-export-repair-2`,
dedicated worktree `C:\dev\main\meri-greenfield-worktrees\w02-office-review-2`
(clean, HEAD == candidate). Review scope: the four owned files only. This document is
the ONLY file this review writes/commits. No implementation/shared/dependency file was
edited. Codex independently accepts or rejects; this review carries no acceptance,
G1, host, browser or Office-deployment authority.

Historical context: the initial candidate `89a36bf` was ACCEPTed by a prior Hermes
reviewer but REJECTED by the integration owner (Codex) with six concrete reproduced
defects; that owner report is preserved at
`C:/dev/main/meri-greenfield-kickoff-20261009/docs/coordination/reports/W02-07-OFFICE-CODEX-FIRST.md`
and the prior ACCEPT review is preserved unchanged on its own branch. This review
independently re-derives the repair; it does not rely on the repair report's claims.

## Exact artifacts (SHA256 of the reviewed bytes)

- `apps/worker/qualification/probes/office-export.mjs` — `986973ac12903cf435210e7b25819464f6e872d317dde62b9e4394303c444331`
- `apps/worker/qualification/probes/office-reconstruct.mjs` — `7211a3c4041b818b71ed47ca9e8e535fc082e36076b97efa52ba8b2cefbcbb0d`
- `apps/worker/qualification/probes/office-export.test.mjs` — `b5484a8c7820ec15f572831c106f4492fd285360ab0d753701ddc3b5bc59956b`
- `docs/coordination/reports/W02-07-OFFICE-EXPORT.md` — `74401cc8f6bdb8d45e8bf688a0c1361d03840c54fd4b00b53c12c664c03fd471`

Authoritative, UNCHANGED inputs inspected to test that the retained facts reflect real
output rather than only matching fixtures:

- `apps/worker/qualification/probes/artifacts.mjs` — `3155bd31447f37b27c512cc2522a46947241c0f3fd74d738bed54920486757d6`
- `apps/worker/qualification/probes/artifacts.py` — `b75d7eacc12c88fc87b23c7aab6bfa22adbb22eee99b4236f01ac90bde858d15`
- `git diff 89a36bf d10424b -- artifacts.mjs artifacts.py` is EMPTY (both unchanged).

## Scope / hygiene

- `git diff --name-only 89a36bf d10424b` → exactly the four owned files. No other path.
- `git diff --check 89a36bf d10424b` → clean (no whitespace errors).
- `git status --short` → clean at HEAD `d10424b`.
- No install, no network, no native Office/LibreOffice/PythonOffice/pdftoppm/browser/SDK/
  socket/server/provider/model/cloud/AWS/credential/private-source call, no recursive
  delegation, no background scheduler, no global Hermes change, no amend/push.
  Scratch confined to ignored `.task-inputs/`.

## Checks run (independently reproduced)

- Owned suite: `node --test apps/worker/qualification/probes/office-export.test.mjs`
  → **47 tests, 47 pass, 0 fail, 0 skipped** (matches the report's 47; not merely trusted).
- NEW independent adversarial battery (17 injected-fake cases, `.task-inputs/adversarial.mjs`)
  → **17 pass, 0 fail**. Cases: exact/over-12KiB line boundary before parse; chunk
  `bytes > CHUNK_BYTES`; malformed cgroup (array / bad scope) rejected while a genuine
  readCgroup-shaped cgroup is accepted; `end.files` missing field / duplicate index;
  already-past and non-finite absolute `deadlineAt`; `writeBounded` listener cleanup
  (0 leaked listeners) + single-settle; symlinked run root rejected; unknown nested
  generation field rejected; genuine full capture validates with per-file hash match;
  injected error record rejected; 120000/120001 deadline boundary; canonical-base64 edges.

### Environmental blockers (dependency availability, NOT candidate defects)

- Root `npm run check` → `ERR_MODULE_NOT_FOUND` (root deps absent; this dedicated
  worktree has no `node_modules`). Per brief the parent root-15 already passed; I did
  NOT install dependencies and do NOT claim a pass here. **BLOCKED (environmental).**
- Worker `npm test` (`probes/static.test.mjs`) → `ENOENT ... node_modules/@anthropic-ai/
  claude-agent-sdk/manifest.json` (worktree-local dep absent). Not independently
  reproduced; static.test.mjs is unchanged and outside the four-file scope.
  **BLOCKED (environmental).**
- The owned 47 were run by reusing the already-installed sibling worktree tree via a
  scratch ESM resolve hook kept entirely under ignored `.task-inputs/` (no install, no
  network, no change to this worktree). This is a resolution aid only; the module bytes
  executed are the exact candidate bytes.

## Verdict on the six owner-reproduced defects (each independently checked)

1. **Unbounded pending writes / late final write** — FIXED. `writeBounded`
   (office-export.mjs:740-764) races the write callback against a timer and a stream
   `error` event, settles once, and always clears its timer/listener; `streamRecords`
   (772-803) enforces an ABSOLUTE deadline, re-checks it after the last write, and
   `normalizeDeadlineMs` (135-141) rejects NaN/Infinity/non-positive/>120000. Abort
   emission is bounded via `ABORT_DEADLINE_MS` (main:829-834). Reproduced: stuck-write,
   error-pending and late-final-write all fail closed; deadlineAt-in-past fails at once.
2. **Unclean child exit / false cleanup** — FIXED. `runArtifactsChild` (602-711) spawns
   in an owned Linux detached group, kills only the validated group, and resolves only
   after `close` AND a confirmed absent group within bounded grace; a kill request, a
   `false` kill or an error is NOT exit (`cleanupConfirmed:false` + error), and
   `verifyArtifactsVerdict` requires cleanup (424). Reproduced with the owned
   noexit/no-close/groupremaining/overflow fakes.
3. **File-boundary gaps (junction/ancestor/FD identity)** — FIXED.
   `inspectExpectedFiles` (467-512) + `assertRealDirectoryAncestors` (515-531) reject
   every symlink/junction ancestor and the leaf; `readRegularFileVerified` (545-570)
   uses O_NOFOLLOW and re-checks descriptor dev/ino/type/nlink/size/mtime before AND
   after the read. Reproduced: internal `native/` junction, leaf symlink, hard link and
   symlinked run root all rejected.
4. **Exclusive fresh output** — FIXED. `writeReconstruction` (361-383) acquires the
   destination exclusively with `mkdir` (EEXIST loses, never reused), creates files with
   `flag:'wx'`, and removes the fresh dir on any write failure; `checkDestination`
   (325-348) rejects missing/symlink/non-dir ancestors. Reproduced: existing destination
   refused and untouched; second writer loses the race.
5. **False wrapper verdict** — FIXED. `buildGenerationFacts` (271-319) +
   `validateGenerationFacts` (353-410) require clean exit + `cleanupConfirmed`, `ok:true`,
   native generate/pptx child status0/no-signal/no-error/parseOk, per-format convert/PNG/
   PDF-inspection statuses, `pages`/`pngCount` exactly 1/1/2, recalc child
   ok/status0/parseOk/nestedOk, formula `=SUM(A1:A3)`, inputs `[1,2,3]`, numeric 6;
   `end.elapsedMs` is measured (main:844-868). A good-looking nested payload after a
   failed child cannot pass. Reproduced against the audit mutations.
6. **Loose decoder** — FIXED. `collectRecords`/`extractRecordLines` (office-reconstruct.mjs
   96-168) bound input (32 MiB), lines (20000), records (20000) and per-line bytes
   (>12 KiB) BEFORE parsing; `UUID_RE` (51) enforces a UUID capture id; `sameLimits`
   (186-191) demands the exact limits (no expanded caps); `validateManifestEntry` (171-184)
   is strict; chunk/coverage/hash/end bindings (283-321) are enforced; malformed input
   writes nothing. Reproduced across the owned rejector battery plus the new cases above.

Compatibility check against the unchanged authoritative probe: the encoder/decoder's
eleven relative paths, page/PNG counts (docx 1/1, xlsx 1/1, pptx 2/2), the
`=SUM(A1:A3)`/`[1,2,3]`/`6` recalc facts, the `parsed.results[0]` shapes and the
`{probe,ok,...}` stdout contract all match what `artifacts.mjs`/`artifacts.py` actually
emit on a complete run. A genuine complete run satisfies the validator; incomplete or
failed facts (failed child, wrong value, missing child, wrong counts, non-UUID, oversized
line) are rejected.

## Residual observations (hardening / limitations — NOT reproduced defects, no false accept on genuine output)

- **O1 (defense-in-depth):** `genSub` (260-264) / `buildGenerationFacts` retain the
  child's own `ok`/`parseOk` booleans and do NOT re-derive them from the nested
  `parsed.ok`. Independently reproduced: a structurally valid payload with
  `nativeFacts.generate.ok:true` but `parsed.ok:false` is ACCEPTED
  (`verifyArtifactsVerdict.ok === true`). This is NOT reachable from a genuine
  `artifacts.mjs` run — its `gen.ok` already requires `parsed.value.ok === true`
  (artifacts.mjs:115,117) — so it is not a false pass on real output; but the "strict
  facts" are a faithful projection of the child's self-report, not an independent
  re-derivation. Worth closing if a future encoder/probe variant could misreport.
- **O2 (TOCTOU):** ancestor validation uses `lstat` (485-486, 515-531) and then opens
  the leaf with O_NOFOLLOW (547). O_NOFOLLOW protects only the final component, so a
  concurrent swap of an INTERMEDIATE directory between lstat and open is not fully
  closed. The threat model is a synthetic probe output dir, not a hostile concurrent
  writer; noted, not blocking.
- **O3 (Linux-only):** `defaultProbeGroup` (586-592) returns `false` off Linux, so there
  `cleanupConfirmed` can be set on `close` alone; `defaultGroupKill` (577-583) safety
  relies on `detached:true` (the Linux default) so `-pid` is the owned pgid. Real Linux
  process-group semantics are NOT RUN in this review (Windows host).
- **O4 (compat, fail-closed):** `artifacts.mjs` (273-274) writes pretty JSON then calls
  `process.exit()`; over a pipe Node may truncate a large stdout. The wrapper parses via
  `parseStructuredOutput` (runtime.mjs:64-81) and would then FAIL CLOSED (reject) — a
  production false-NEGATIVE risk, never a false accept. `artifacts.mjs` is unchanged and
  unowned.
- **O5 (compat):** `parseRecordLine` requires `MARKER` at index 0 (127); any CloudWatch
  prefix on a line would silently drop that record and the decode would fail closed.
  Real `awslogs` delivery is unprefixed, but exact CloudWatch chunking/ordering remains
  unverified here.
- **O6 (encoder bound gap):** `planExport` bounds only chunk lines (191); the `capture`
  record line (generation + manifest) is not encoder-size-checked. With bounded genuine
  generation facts the capture line is ~2 KB, so not reachable; the decoder rejects
  >12 KiB capture lines regardless.

## Remaining NOT RUN (explicit)

Native Office / LibreOffice `soffice` / `pdftoppm` / Python generators / pptxgenjs /
Playwright-browser; AWS / CloudWatch / Fargate / ECR; Linux detached process-group and
negative-pgid semantics; real captured CloudWatch bytes, exact chunking/ordering; image
build; human visual review; any deployment. Synthetic fakes are NOT native proof.

## Verdict

**OFFLINE / INJECTED-FAKE REVIEW: PASS.** The repair closes all six owner-reproduced
defects and no new false-accept counterexample was found against the exact candidate
bytes; the authoritative probe outputs are faithfully modelled. Residual items above are
hardening/limitation notes, not blockers for the offline scope. This is not G1/host/
Office/native/CloudWatch acceptance — Codex independently accepts or rejects.

## Process state

One reviewer; no recursive delegation; no background scheduler; no global settings
change; no approval bypass; no native binary/service execution; no browser/socket/server;
no model/provider call; no credentials/cloud/private-source access; no dependency install
in this session (existing sibling tree reused only as a module-resolution aid). REPORT
ONLY committed; no amend, no push, no integration.
