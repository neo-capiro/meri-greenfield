# W02-18 TestState planner — distinct actual Hermes REVIEW 1

Status: **SOURCE-ONLY PASS (with disclosed ACCEPTED LIMITATIONS)** for the four adopted
repairs F1–F4 and the frozen local contract, at exact candidate
`64d39dbcbbbd27f5dd6f7e6093ba169f7109cc1f`. This is a source-only review: it edits no
source/test/doc, performs no acceptance, and promotes no gate. Codex independently decides
acceptance; this report and any process exit never promote. Future decoder / pagination /
task-ENI / role / live-adapter / managed-cleanup remain separate gates.

Reviewer session: `20261010_042520_1484b1` (never author `20261010_034137_572412`).
Branch: `task/w02-initial-teststate-planner-review-1`.
Worktree: `C:\dev\main\meri-greenfield-worktrees\w02-initial-teststate-planner-review-1`.

## 1. Base / provenance verification (all exact)

- Clean HEAD == allocation base: `git rev-parse HEAD` = `64d39dbcbbbd27f5dd6f7e6093ba169f7109cc1f`; `git status --porcelain` clean before this review.
- Diff `36c61071c5f6424c082c48ab7889a2af344792ac..64d39db` is EXACTLY the seven allocated
  NEW paths (all `A`): the two docs, `scripts/prepare-native-teststate.mjs`, the three
  `scripts/native-teststate/*.mjs`, and `scripts/test-native-teststate.mjs`.
- Input manifest `.task-inputs/W02-18-review-input-manifest.json` SHA256
  `bf52c861b9c480accedcf87baba1f4c86395e726b92358d69a5516e2d1d5d812` (verified). All nine
  recorded raw inputs verified byte+hash exact BEFORE use:
  candidate-manifest `b550fed9…4e2ec8` (3188 B); brief `b9a42c8c…956d6` (11756 B); repair
  `249bc525…7563d6` (8753 B); final-static-audit `b3c3f270…8655f` (9458 B);
  owner-counterexamples `49b28455…c6d67` (57616 B); static-pins `fc9f1beb…6591cc`
  (10904 B); definition `2c962d23…f51eac3` (112210 B); README `d3978992…be688` (8880 B);
  owner-inputs/manifest `20a7fb01…c4b02` (2426 B).
- Candidate manifest `b550fed9…4e2ec8`: 7 owned + 8 read-only dependency records. Every
  record's raw byte length AND sha256 match the working-tree file and are present as Git
  blobs at HEAD (`git rev-parse HEAD:<path>`); only the 7 owned paths are new vs base.

## 2. What was FULL-read before execution

All seven owned files read in full: `scripts/prepare-native-teststate.mjs`,
`scripts/native-teststate/{binding,requests,files}.mjs`, `scripts/test-native-teststate.mjs`,
`docs/qualification/NATIVE-TESTSTATE-REQUESTS.md`,
`docs/coordination/reports/W02-18-TESTSTATE-PLANNER.md`. Read-only dependencies read:
`infra/native-enforcement/lib/binding.mjs` (compiler/pins shape),
`scripts/sdk-capture/{json-records,protocol}.mjs` (scanner). Controlling brief + repair +
static audit + owner inputs read as DATA only.

## 3. Repair verification (F1–F4)

**F1 — raw input identity before import: VERIFIED (source-inspected ordering).**
`composeFixedBinding` (binding.mjs:180–266) snapshots caller buffers synchronously
(`Buffer.from`, lines 187–188), then checks exact raw length+sha256 against `STATIC_PINS_RAW`
(10904/`fc9f1beb…`) and `GRAPH_RAW` (112210/`2c962d23…`) BEFORE the fixed dynamic import
(lines 191–194), strictly parses both (195–198), reads+verifies the six fixed W14 source
records internally (201), THEN `importFixedApp()` (206), compiles with
`{executeAdmitted:false}` (213), asserts `runtimeEnabled===false` + exact `staticBindingId`,
rebuilds the graph and requires `graphJson === parsedGraph.text` plus pinned hash/length
(229–230), asserts `GuardInput` inert (232–236), and re-reads the six sources post-compile
(239). No caller `sourceReader`/import path/import function is consulted; `readFixedSource`
and `importFixedApp` resolve only internal constants (`REPO_ROOT` two levels up). The suite's
"caller-supplied source reader" test passes `sourceReader` and still succeeds with 6 real
records — i.e. an unknown reader option is ignored, not treated as refusing the whole input,
which matches the brief. `parseStrictJson` reuses the accepted `scanJsonKeys` (which throws
`DuplicateKeyError`) and a lexical `node:util` `TextDecoder({fatal:true})` (immune to a
poisoned global), plus depth/non-finite/reserved-member bounds. Import order is
source-inspected only (not instrumentable), labelled as such in the suite and docs; the
pre/post read is a trusted-checkout check, not an atomic hostile-FS boundary (disclosed).

**F2 — immutable authority + no reader bypass: VERIFIED.**
The branded binding exposes a primitive `graphText` string (authoritative definition),
`graphBytesLength`/`graphSha256` numbers/strings, and deep-frozen `graph`, `pins`,
`authorityReferences`, `sourceRecords`, `postCompileRecords`, `memberHashes`,
`inputProvenance` (247–263). No public Buffer is exposed. `deepFreeze` recurses plain
objects/arrays (skipping typed-array views). Requests/definition/`selectedMemberHash`/
`target`/provenance all derive from the same frozen snapshot (requests.mjs:96–175). The
compiler's `pins` (`structuredClone` of static pins minus evidence bodies, all strings) and
`authorityReferences` are plain data — no reachable mutable Buffer. Branding uses a private
`WeakSet`; a spread/JSON clone/unbranded object is refused (`forged or unbranded binding
refused`). The `FIXED_SOURCE_PINS` array and each record object are recursively frozen.

**F3 — bounded file closure: VERIFIED.**
`files.mjs` wraps every IO in `call()` → constant codes only (no message/stack/input
excerpt), closes every opened handle on every branch, records `handleClosed`/`closeFailed`,
and never reports closed when `close` threw (160–187). A close failure cannot erase an
earlier refusal (184). `observe` compares initial path / initial FD / final FD / final path
consistently for identity (dev/ino), regular/non-link type, hard-link policy, bounded size,
total bytes and available mtime/ctime, with ancestor link checks and chunked reads
(93–151). Windows `O_NOFOLLOW`/reparse and same-user TOCTOU limits are disclosed honestly.

**F4 — assertion/claim honesty: VERIFIED.**
The suite replaces the old self-overwriting noninert fixture with a direct pure
`isInertAdmission` predicate check (true non-inert) distinct from brand rejection
(test:265–276). Import ordering is labelled "source-inspected only"; the import test is
labelled "(no IO instrumented)"; the no-write CLI check is scoped to input-directory names +
original graph bytes. No claim of comprehensive no-IO/no-write proof remains.

## 4. Independent counterexamples (147 checks, literal oracles)

Scratch `node .task-inputs/W02-18-review-1/independent-checks.mjs` → EXIT 0, **pass=147
fail=0** (~593 ms). Written independently (literal oracles, not candidate internals):
raw static-pins/graph bytes+hash recomputed from disk; six W14 files' on-disk hashes vs the
pins; `staticBindingId`/91 states/`RunTask`+`StopOwned` mutators; member hashes recomputed
from the frozen graph; the exact seven-key request/`requestBytes`/`requestSha256`/`input`
provenance/timeout/seed-hash rebuilt from literal oracles for all four cases and compared;
banned-token scan; bad raw pins (trailing space, truncation, equal-length change), graph
drift/truncation, missing inputs; bad seeds (extra/forbidden keys, run-task case, t0>planning,
stale deadline, unsafe int, non-v4, wire==run, wrong run, duplicate JSON member); forged
(spread/JSON/unbranded) bindings; nested mutation of the ACTUAL branded object (11 sites,
incl. `defineProperty`) all throw with authority unchanged; and effective FD fakes (read
throw → bounded `io-error` + closed; close throw → `close-failed`; close throw after an
earlier refusal → earlier code preserved + `closeFailed`; final-FD dev/ino, same-size
timestamp and nlink changes → `changed-during-read`/`multiple-hard-links`; relative path and
bad bound refused). No W14 source was modified; only reads.

## 5. Canonical suite (once) + syntax/diff

- `node --test scripts/test-native-teststate.mjs` (whole process, captured):
  EXIT 0, `tests 37 / pass 37 / fail 0 / skipped 0 / todo 0`, `duration_ms 797.7692`
  (< 120 s), stderr empty. stdout `.task-inputs/W02-18-review-1/review1-test.out`
  SHA256 `1dbc43284d1f1a1f315107bf016b2101f25e9d9463abab312e4d0c3d42ee94bf`; stderr
  `.task-inputs/W02-18-review-1/review1-test.err` SHA256 `e3b0c442…b855` (empty).
  All 37 test names read; no warning/skip. Node v24.19.0 (`C:\Program Files\nodejs\node.exe`),
  existing node_modules junction, no install.
- `node --check` on the five owned `.mjs` files: all OK (once). `git diff --check`: EXIT 0.
- Source stability: every candidate-manifest record re-hashed after the run — unchanged.
  `git status --porcelain` shows only the new untracked report; no tracked source change.

## 6. Prioritized findings

No blocking defect found. Ordered observations / limitations:

1. **(LIMITATION) Import-order and no-IO claims are not fully measurable.** Production
   dynamic-import ordering and import-time no-IO are established by source inspection only;
   the "touches the filesystem only on invocation" test proves only that the injected ops
   object is untouched pre-invocation, and the "no-write" CLI check observes input-directory
   names + graph bytes. All are labelled honestly in the suite/doc; none is a false claim.
2. **(LIMITATION) deepFreeze skips typed-array views.** Currently no Buffer is reachable
   inside the frozen authority (W14 `pins`/`authorityReferences` are strings/numbers), so no
   authoritative mutable Buffer exists today; a future Buffer added under `pins` would not be
   frozen by this helper. Latent, not current.
3. **(LIMITATION) Pre/post source re-read is a trusted-checkout check**, not an atomic
   hostile-FS boundary; Windows lacks `O_NOFOLLOW`, junction/reparse ancestors are detected
   only when `lstat` reports a symlink, timestamp-based same-size-change detection depends on
   filesystem resolution, and same-user TOCTOU remains. Disclosed in files.mjs and the doc.
4. **(SCOPE) 37 test groups ≠ 37 unique properties.** Several groups re-assert overlapping
   facts (e.g. graph `sha256` appears in the four-case, provenance, and CLI tests); the count
   is test groups, not independent properties. The independent 147-check pass above adds
   genuinely independent coverage.
5. **(PRESERVED FAILURES) Prior-candidate counterexamples retained, not passes.**
   `.task-inputs/W02-18-owner-counterexamples-1.json` documents FOUR integrity failures on
   the REJECTED candidate `0116181`: `mutable-buffer`, `mutable-graph-member`,
   `mutable-fixed-pin-record` (`firstRecordFrozen:false`), `unpinned-static-pins-raw-bytes`
   (accepted 10905 B/`1cb3bdf5…` vs expected 10904 B/`fc9f1beb…`). These are the pre-repair
   failures; the candidate fixes them, and this review's independent checks re-confirm the
   fixed behaviour.
6. **(UNVERIFIABLE HERE) Author historical captures absent.** The report cites author
   captures `.task-inputs/scratch-w02-18/{test.out,test2.out,repair1-test.out}` (27/2 → 29/0,
   repair 37/0). That directory does not exist in this review worktree, so those specific
   captures could not be independently re-hashed here; only the final-static-audit's
   DATA-level read of them is available. This review re-ran the canonical suite fresh
   (37/37, exit 0) rather than replaying author logs.

## 7. Contract conformance (spot-verified)

- Seed: exact six keys `{schemaVersion,case,wireCaptureId,runUuid,t0Ms,planningTimeMs}`;
  four cases only; canonical lowercase v4; wire≠run; run equals fixed synthetic
  `87890e41-3f88-4b4d-b1d3-aaa9b85aaa9b`; positive safe-int times, `t0<=planning`, overflow
  safe; `D=t0+720000`, `C=t0+900000`; remaining selected deadline `>=1000`; no `Date.now`.
- Request: exactly seven keys; `definition` = complete inert graph string; `stateName` only
  `DispatchIdentity`/`ListFirst`; `roleArn` code constant
  `arn:aws:iam::967807252336:role/MeriGreenfield-TestStateReadOnly-20261010` (future,
  not created/trusted/admitted); `input` literal `"{}"`; `variables` JSON string of minimal
  ctx only; `DEBUG`; `revealSecrets false`. Envelope `REQUEST_PLAN_ONLY` with synthetic/
  inert/not-executed provenance and no acceptance tokens. The full 91-state graph CONTAINS
  `RunTask`/`StopOwned`; the planner never executes the graph or follows `nextState`.

## 8. Gates (unchanged, OPEN)

49 scan findings / 22 severe OPEN; Office DEFERRED; native/security/G1 OPEN; paid Bedrock
$0/$10; W11 unaccepted; current Meri/Capiro untouched; app/control Fargate and Temporal
unchanged; source connections disabled; no cutover. The future TestStateReadOnly role is NOT
created, trusted or authorized. Source planner stays REQUEST_PLAN_ONLY; future decoder /
pagination / task-ENI / role / live-adapter / managed-cleanup remain separate gates.

## 9. Closeout

One ordinary scoped commit of THIS report only
(`docs/coordination/reports/W02-18-TESTSTATE-PLANNER-REVIEW-1.md`). Source/tests/docs/
oracles/manifests untouched (clean diff). Scratch is new ignored `.task-inputs/W02-18-review-1/`
(only there; preserved, not committed). No push/amend/install/background/recursion. Codex
independently decides acceptance; this review's exit/report does not promote any gate.
