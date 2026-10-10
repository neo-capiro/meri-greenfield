# W02-22 independent compiler-closure review — report

STATUS: COMPLETE (review scope). A process/model verdict does NOT establish owner acceptance. This is a
distinct actual review — not the integration owner's oracle/exporter run, not source acceptance, and not a
promotion of any kind. Observed results below are from THIS review worktree only.

## 0. Scope, authority, pins and method

- Candidate under review: `593ab1cb3e99c87a732661525e022dcd733d8693`
  (staging parent `8221ed1762ce0c85691e79bb41e75043a8c72425`, parent `d271c6c88272bcd0e00d097bfca1ffd2448766f7`).
- Review WT: `C:/dev/main/meri-greenfield-worktrees/w02-native-teststate-closure-review-1`,
  branch `review/w02-native-teststate-closure-1`. HEAD at start = exact candidate; working tree clean.
- Fixed manifest `.task-inputs/W02-22-review-1/manifest.json` **80201 B /
  `5a9e4516d3b57186ae8c325ca28290527b8a9dc64a1b772185f387dbac560a89`** — MATCH (checked against the
  ROOT-supplied fixed hash, not recomputed from contents). `MANIFEST-PIN.md` read; no fallback/repin.
- Owned new tracked path: this file only. Scratch only under `.task-inputs/W02-22-review-checks-1/`.
- Skeleton committed early (turn 3): commit `f65d88c92ea35cb05e1f49f389504e3cde24358f`
  (report-only descendant of the candidate; only descendant difference is this report file).
- Pinned runtimes: Node `C:/Program Files/nodejs/node.exe` **92825416 B /
  `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`** (v24.19.0) — MATCH; bundled
  Python `C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`
  **106448 B / `10d845f50a2af64e3500bb2fcb348b5bc98a75d8ddada63e45ba1da6a1fc79d1`** — MATCH; Git cmd
  `C:/Program Files/Git/cmd/git.exe` **46920 B /
  `7b7971dd13f0c3a284e538601f2f9770b3a87dfaccb5fb52d68141c67ed22364`** — located and MATCH.
- Pin verification (`verify_pins.py`, run with the pinned Python): **source21 = 21, input66 = 66,
  supplements = 47, failures = 0**, run before checks, after the canonical run, after the control, and
  again before the final commit (all four invocations `ALL-PINS-OK`). Each source21 row was checked
  against BOTH the current WT bytes AND the candidate Git blob (`git cat-file blob 593ab1c:<path>`),
  and against its recorded size/sha256.
- Exact author diff (`git diff --name-only 8221ed1 593ab1c`) is exactly four paths:
  `scripts/native-teststate/binding.mjs`, `scripts/test-native-teststate.mjs`,
  `docs/qualification/NATIVE-TESTSTATE-REQUESTS.md`, `docs/coordination/reports/W02-18-W19-SOURCE-PIN-ADVANCEMENT.md`.
  Three modified allocated paths + one new author report — matches the brief.

All 21 current source files, the canonical test, the CLI/planner/files/requests imports, the scanner two,
and all eight compiler members were FULL-read before any candidate invocation. No candidate/owner-helper/
evaluator was imported or executed except the two authorized invocations below. No AWS/network/provider/
TestState/decoder/native/synthesis/build/Docker/host/browser action; no installs/npm/junction; no push/amend.

## 1. Source closure — independent reconciliation of the literal eight records

Each record below was reconciled independently from three agreeing sources: (a) the raw current WT bytes
+ candidate Git blob (hashed in `verify_pins.py`), (b) the `FIXED_SOURCE_PINS` table in
`scripts/native-teststate/binding.mjs`, and (c) the raw files re-read by this review's own control
(`control.mjs`, hard-coded literals — NOT read from the candidate's exported table). Fixed order:

| # | repository path | bytes | sha256 |
| -: | --- | ---: | --- |
| 1 | infra/native-enforcement/app.mjs | 618 | e03076acb2ccda59bd38c2e2763f94af0d057f6c6c1bd3e699e25c72314ab1ed |
| 2 | infra/native-enforcement/lib/binding.mjs | 16458 | 8df3f2f02e23a4f3587a342dcb882404c7c0f70be6e57b84b9d1b0af0eaea35a |
| 3 | infra/native-enforcement/lib/expressions.mjs | 13776 | 933dcca53027688be2e6373bed818890882f239bc5da5af1af827277213b87aa |
| 4 | infra/native-enforcement/lib/workflow.mjs | 25002 | 09171cbc66ce0efbd643969d92c92c742f89d0b41804eefd65064f2175aa39ca |
| 5 | infra/native-enforcement/lib/infrastructure.mjs | 4780 | c0ddb78cbfb28ed0fd3360b0dec86d12371240fb7d87c0452dec0408454a53af |
| 6 | infra/native-enforcement/lib/task-definition.mjs | 8996 | 3d45d054150c5e7706253694a725761afb96abe5a39d1a3ecc0bfb1adb686436 |
| 7 | infra/native-enforcement/lib/probe-profiles.mjs | 4920 | 67dff6ffb4025e1767226a5bb330998ad78bd9d76083319adb910a22e3397660 |
| 8 | infra/native-enforcement/canary-task-definition.mjs | 2612 | 524135d00aec413a6393e69a7d22974160109b01cc4ced71d35f26440d3e4df5 |

The production diff is comments plus the six→eight literal table only; no other production behavior
changed (verified by reading the full binding and comparing against the pre-import/import/post-compile
code retained). The eight records equal the accepted W19 raw bytes; positions 1–6 preserve the original
W14/W18 order, 7–8 appended.

## 2. Finite graph — edges, reachability, acyclicity

Read from the actual import statements of the eight FULL-read members (not from a parser), and cross-checked
against `inputs.json.literalEdges`:

- `app.mjs` → lib/binding, lib/expressions, lib/workflow, lib/infrastructure, canary-task-definition (5)
- `lib/binding.mjs` → node:crypto (builtin), lib/task-definition, lib/probe-profiles (2 repo + 1 builtin)
- `lib/expressions.mjs` → lib/binding, lib/probe-profiles (2)
- `lib/workflow.mjs` → lib/binding, lib/expressions, lib/probe-profiles (3)
- `lib/infrastructure.mjs` → lib/binding, lib/workflow, lib/probe-profiles (3)
- `canary-task-definition.mjs` → lib/probe-profiles (1)

Total **16 repository edges + 1 `node:crypto` builtin edge**. All eight members are reachable from `app`
(binding/expressions/workflow/infrastructure/canary directly; task-definition and probe-profiles
transitively). No cycles: leaves are `probe-profiles` and `task-definition`; every other member depends
only on strictly-lower members. No dynamic `import()`/`require()` appears in these eight bytes; every
specifier is a literal static `import`/`export … from`. This is a finite literal inspection, not a general
JS parser or an import-time-side-effect proof.

## 3. `composeFixedBinding` trace and integrity limits

Traced in the actual bytes of `scripts/native-teststate/binding.mjs` (`composeFixedBinding`, lines 185–271):

1. Synchronous caller-Buffer snapshots (`Buffer.from`) BEFORE any dynamic import (lines 192–193).
2. Exact raw input byte identity for static-pins (10904/`fc9f1beb…`) and graph (112210/`2c962d23…`)
   BEFORE strict parsing and before the import (lines 196–199).
3. Strict JSON: byte bound, lexical `node:util` `TextDecoder(fatal)` (immune to a poisoned global),
   duplicate-key scan via `scanJsonKeys` BEFORE `JSON.parse`, depth bound, finite-number and
   `__proto__`/`prototype`/`constructor` rejection (lines 200–203, 115–140).
4. Eight fixed source records read+verified via the internal reader BEFORE the import (line 206).
5. Sole fixed compiler import `pathToFileURL(join(REPO_ROOT, APP_RELATIVE_PATH))` — no caller import path
   or import function accepted (lines 168–171, 211).
6. Inert admission (`runtimeEnabled === false`) + exact `staticBindingId` (`0599b1c8…`) match (lines 222–223).
7. Graph rebuild, exact equality to the supplied graph bytes, and hash/length re-check (lines 231–235);
   `GuardInput` must be an inert `Choice` whose first condition starts with `{% false and ` (lines 237–241).
8. Post-compile full-eight re-read (line 244), then a deep-frozen, privately-branded output with primitive
   `graphText`, `sourceRecords`/`postCompileRecords`, `inputProvenance`, `memberHashes` (lines 247–270).

The unknown `sourceReader` input property is ignored and never invoked (confirmed: the control passed a
throwing `sourceReader` and its call counter stayed **0**). `sourceReader` is therefore NOT an accepted
integrity seam. `isOwnedBinding` is a `WeakSet` brand check (`branded`); a spread copy is refused.

Honest limits: pre/post source matching is a trusted-checkout TOCTOU check, not an atomic hostile-FS
boundary; ESM module caching means the fixed import is cached for the process (a post-import on-disk
change is caught only by the post-compile re-read, and only within this process's view). `files.mjs`
performs bounded reads with identity/type/link/size/timestamp re-checks and closes every handle on every
branch; on Windows `O_NOFOLLOW` is undefined and junction/reparse ancestors are only detected when `lstat`
reports them as symlinks — an offline bound, not hostile-FS proof.

## 4. Canonical suite result (ONE invocation)

Command (exactly once): `C:/Program Files/nodejs/node.exe --test scripts/test-native-teststate.mjs`,
cwd = this review WT, `shell=false`, array argv, stdin DEVNULL, external cap 120 s, child
`TMP`/`TEMP`/`TMPDIR` confined to an exclusive scratch dir, env stripped (loader + provider names removed —
see §6).

- UTC start/end `2026-10-10T11:58:24Z` → `2026-10-10T11:58:29Z`, elapsed **3407 ms**, cap 120 s,
  `timedOut=false`, **exit 0**.
- Raw stdout `…/canonical-20261010T115824Z/canonical.stdout.bin` 5769 B /
  `373388e8bd3388940f01e2abd28fc4ed5512332caeb6201d5fdb8f3d805ec9c0`; raw stderr 0 B.
- Summary from the raw capture: **tests 62 / pass 62 / fail 0 / skipped 0 / cancelled 0 / todo 0**
  (suite `duration_ms 3325.7153`). All four retained-plan cases (`identity`, `list-started-by`,
  `list-running`, `list-stopped`) passed, as did the pristine clone, the eight missing, eight drift,
  two post-await and two mixed-version cases.
- Pre/post pins `ALL-PINS-OK`; runtime identity stable pre/post.

Wrapper caveat (honest): my supervisor parsed counts with a `# `-prefixed regex, but Node v24.19 emits
`ℹ tests 62` (info symbol). The envelope therefore mis-set `canonicalPass=false` while the child actually
exited 0 with 62/62/0/0. This is a limitation of MY parser, not a candidate failure; the true counts are
read from the raw capture above. Per the brief, no rerun was performed to "fix" the flag.

## 5. Independent finite composed control (ONE invocation)

`control.mjs` (in scratch) imports ONLY the public production surface (`composeFixedBinding`,
`isOwnedBinding`, `buildRequestPlan`) by absolute WT path, plus Node stdlib. It does NOT import the
canonical test or any owner helper, and its eight records and expected facts are independent literals
(not read from the candidate's exported table, not recomputed from candidate fields).

- Command: `<pinned node> control.mjs`, cwd scratch, `shell=false`, stdin DEVNULL, cap 30 s. UTC
  `2026-10-10T11:59:50Z` → `2026-10-10T11:59:51Z`, elapsed **94 ms**, exit 0.
- Raw stdout `…/control-20261010T115950Z/control.stdout.bin` 67 B /
  `38f56ab27d97be66451f32a3ced8ef9e50a0f1ee0fe66370f29345223cc9ad99`:
  `{"total":39,"pass":39,"fail":0,"failures":[],"sourceReaderCalls":0}`. Raw stderr 0 B.
- Assertions (39, independent): alias byte/hash identity for both inputs; `composeFixedBinding` ok;
  private brand accepts the genuine object; **sourceReader call counter == 0**; `runtimeEnabled === false`;
  pre-compile `sourceRecords == literal8`; post-compile `postCompileRecords == literal8`; graph
  provenance; **spread copy of the binding refused (`unbranded`)**; **raw static-pins whitespace
  corruption refused before import (`static pins raw identity`)**; plan ok; `status == REQUEST_PLAN_ONLY`
  (inert); provenance synthetic/inert/notExecuted with runtimeEnabled/executeAdmitted false;
  `stateName == DispatchIdentity`; `resource == arn:aws:states:::aws-sdk:sts:getCallerIdentity`;
  **`expectedTimeoutSeconds == 29`** (independent literal); `selectedDeadline == D`;
  `selectedDeadlineMs == 1760000720000`; `request.variables == '{"ctx":{"D":1760000720000}}'` and parses to
  the minimal `{ctx:{D:1760000720000}}`; `expectedArguments == {}`; `request.input == '{}'`;
  `inspectionLevel == DEBUG`; `revealSecrets == false`; `staticBindingId == 0599b1c8…`; full graph/input/
  source provenance equality; `requestBytes == JSON.stringify(request)` and matching `requestSha256`.
  The graph was also confirmed to still contain the `RunTask` and `StopOwned` mutator members.
- NEW independent seed used (literal, not candidate-derived):
  `{schemaVersion:'meri-native-teststate-initial-seed/1',case:'identity',
  wireCaptureId:'33333333-3333-4333-8333-333333333333',
  runUuid:'87890e41-3f88-4b4d-b1d3-aaa9b85aaa9b',t0Ms:1760000000000,planningTimeMs:1760000690500}`.
  Expected timeout 29 = `min(30, floor((1760000720000 − 1760000690500)/1000))` computed independently.

This checks local request PLANNING only — no JSONata evaluation, no AWS reply, no decode, no identity verdict.

## 6. Author report / evidence reconciliation and limitations

Author report `docs/coordination/reports/W02-18-W19-SOURCE-PIN-ADVANCEMENT.md`: actual **11091 B /
`a6515feec5b415ed3376291366d0242aaeec37b2a169920c01b0de2c2c184a37`** — its own table row claims
`aef23f83…`, which is a **stale/incorrect self-hash**; preserved, not edited. (The review does not edit the
author report.)

Two author runs (kept separate):
- **First failure**: `…/author-checks/canonical.stdout.txt` (14770 B), exit 1, `tests 62 / pass 51 /
  fail 11`. Independently confirmed: **8 `ReferenceError`** occurrences (the drift fixtures) plus **3
  `source unreadable:`** cases (`app.mjs` from the old-six-loader/new-eight-compiler mismatch, and
  `probe-profiles` + `canary-task-definition` post-await) = 11 failures. The 8 ReferenceErrors do NOT
  establish loader behavior; only the 3 readcap/refusal mismatches concern real bounded-reader semantics.
- **Repaired FULL run**: `…/author-checks/replay/canonical.stdout.txt` (5769 B), exit 0, `62 / 62 / 0 / 0`.
  "Targeted replay" was in fact a FULL 62-suite rerun after an in-scope repair (removed a missing test
  import; switched drift to a length-preserving in-place mutation; accepted the loader's exact
  `source drift`/`source unreadable` phrasing), not a narrow subset.

Evidence qualifications preserved:
- Both envelopes record `"shell": false`, but the actual outer invocation is `run-check.sh`: **Bash → env
  → GNU `timeout` → pinned Node**. `shell:false` describes only the inner Node `spawnSync` children, not
  the outer wrapper. The outer wrapper does NOT redirect stdin to DEVNULL, does not set outer
  `TMP`/`TEMP`/`TMPDIR`, writes captures with nonexclusive `>` redirection, runs its snapshot/hash/version
  commands OUTSIDE the 120 s bound, and its JSON does not fail closed on snapshot inequality (a trailing
  `tail` can exit 0 even when Node failed). No runtime rehash, no per-case retained clone captures, and no
  process-tree/descendant-cleanup proof is in the wrapper.
- **Removed-AWS-names contradiction**: both author envelopes list three removed names
  (`AWS_CONFIG_FILE`, `AWS_EC2_METADATA_DISABLED`, `AWS_SHARED_CREDENTIALS_FILE`), yet the author report
  §6 states "observed removed: none in this shell". The report statement is false. (This review's own two
  runs independently removed the same three names.)
- Canonical coverage caveats: the eight drift tests accept `source drift OR source unreadable`, so they do
  not each strictly assert the advertised phase/reason (drift-OR-unreadable is weaker than a strict-phase
  assertion); the pristine control runs once, not before every negative; compiler-path iteration derives
  from the candidate's own table (so independent literal-eight reconciliation, provided in §1 above, is
  still required); `after` cleanup removes temporary clones and `runClone` does not retain each child's
  full stdout/stderr/provenance; the retained aggregate capture cannot recreate per-case clone bytes.
- The rejected relative patch against an immutable-pack path produced NO write; current raw pack pins
  independently verify unchanged (this review re-verified the pack bytes).

## 7. Failures, limitations, unresolved items, and source defects

- No candidate source defect was established. The only defects found are in the author's METHOD/report:
  the stale self-hash, the false "removed: none" claim, and the `shell:false` misdescription of the outer
  Bash wrapper — all preserved above without editing the author report.
- Unresolved / not performed by this review (explicitly OUT of this allocation): Native A/B literal
  products and the full new owner 22-grid / 34-expression oracle/exporter were NOT run; later ROOT-only
  results are not supplied as control expectations and are not characterised here. Import-ordering phase
  refusal is established by inspected control order plus the exact refusal message, not by measured
  zero-import instrumentation. Local clone checks do not prove hostile-FS safety, comprehensive
  import-time-IO absence, or live policy. A bounded direct-child timeout is not proof of descendant-tree
  cleanup.
- Git nuance: pin verification used the PATH `git` (`/mingw64/bin/git`, 4422544 B /
  `cab4c4eea1d869cf9f7be73868dc9a90ad2df1b1b673e5f8c8714a576c25ea96`), not the pinned `cmd/git.exe`
  (46920 B / `7b7971dd…`, which was located and hash-matched separately). Git blob content hashes are
  binary-independent, so the pin verification is unaffected.
- No live authority/runtime/security/G1 promotion: the graph still CONTAINS mutators (`RunTask`,
  `StopOwned`); only the fixed selected request DATA is read-only. 49 scan findings / 22 severe OPEN;
  Office DEFERRED; paid Bedrock $0; sources disabled; current Meri/Capiro untouched. No TestState/IAM/
  PassRole/registration/RunTask/response-decoder/AWS/native/browser/provider call; no build/Docker/host
  admission; cutover not performed. ROOT owns acceptance/integration.

## 8. Return

- Review-only commit(s): skeleton `f65d88c92ea35cb05e1f49f389504e3cde24358f` (early) and the final
  report-only commit (see the final message; this file's own SHA256 is computed AFTER the final write and
  is reported there rather than embedded here as if current).
- Working tree clean; only this report is committed; no push/amend; no candidate/input/evidence edits.
- Evidence paths (all under this review WT):
  - `.task-inputs/W02-22-review-checks-1/verify_pins.py` (pin verifier)
  - `.task-inputs/W02-22-review-checks-1/run_canonical.py` + `canonical-20261010T115824Z/{canonical.stdout.bin,canonical.stderr.bin,envelope.json}`
  - `.task-inputs/W02-22-review-checks-1/control.mjs`, `run_control.py` + `control-20261010T115950Z/{control.stdout.bin,control.stderr.bin,envelope.json}`
- Result summary: canonical **PASS** (62/62/0/0, exit 0); independent control **PASS** (39/39,
  sourceReaderCalls 0). All source21/input66/supplement pins verified pre/post. No source defect found;
  author-report method defects recorded. Owner acceptance is NOT granted by this review.
