# W02-19 canary source preparation — implementation report

Status: PARTIAL / UNACCEPTED. SOURCE-ONLY. No deployment, IAM change, security disposition,
image admission, resource/task/role/machine creation, execution or acceptance. This report is
attribution and evidence, not a review or acceptance. Distinct actual exact-commit review and
independent owner checks remain required.

## Continuation 2 amendment (F1/F2 narrow repairs)
- Launch HEAD b9eb95842174124104863b5d7119352a29c6b7ef; original base 77dcd1644221c14dbdb19aa9574a456b9df4b21a.
  This amendment is delivered as an ordinary scoped child commit on task/w02-native-canary-profile
  (its SHA is returned in the session handoff, not embedded here). Two narrow source API repairs
  (F1 in `lib/binding.mjs`, F2 in `lib/task-definition.mjs`), focused negative/getter controls in
  `scripts/test-native-canary-profile.mjs`, and corrections in this report and the README.
- Only `lib/binding.mjs`, `lib/task-definition.mjs`, `scripts/test-native-canary-profile.mjs`,
  `infra/native-enforcement/README.md` and this report changed. `app.mjs`, `lib/probe-profiles.mjs`,
  `lib/expressions.mjs`, `lib/workflow.mjs`, `lib/infrastructure.mjs` and
  `canary-task-definition.mjs` are read-only at b9eb958 and remain byte-unchanged.

### F1 — missing/falsy static pins no longer bypass outer option validation
`buildCanaryEnforcementAdmission` now validates the outer argument object, the allowed own
enumerable key set (`staticPins`, `executeAdmitted`) and the `executeAdmitted` type BEFORE the
intentional missing-pins return. Permitted absence (no argument, `{}`, supported missing-pins
`executeAdmitted:true/false`) stays refusing/inert. Explicitly present falsy `staticPins`
(`null`/`false`/`0`/`''`/`[]`/`undefined`) are refused as invalid present values. Unknown
`profile`/`command`/`entryPoint`/`duration`/other keys are refused even when `staticPins` is
absent/falsy, and `null`/array/primitive/number outer inputs are refused rather than dereferenced.
The native factory is unchanged.

### F2 — native validator reads `expect.command` only at the original command position
`validateTaskDefinition(t,expect)` (unchanged public arity/signature) selects a private closed
invocation mode; the shared validator reads native `expect.command` ONLY at
`ordered(c.command,[expect.command],'command')` — after the definition-object, schema, roles,
resources, runtime/volume, single-container and entryPoint guards — exactly as the frozen original.
The canary wrapper uses fixed literals `/usr/bin/sleep` and `1200` and never reads `expect.command`.
No eager command read, getter callback, broader catch or changed failure order. The shared validator
body is otherwise order-identical to the frozen original `.task-inputs/W02-19-old-task-definition.mjs`
(7965B/SHA256 fbe770912afaa119c50a9e1681a691a605b94c8a6f9ebd686e3555ab9e9a36ad): independent
extraction compared 43 body statements and matched except the two invocation lines.

## Scope, base and allocation
- Launch HEAD b9eb95842174124104863b5d7119352a29c6b7ef; original base
  77dcd1644221c14dbdb19aa9574a456b9df4b21a; branch task/w02-native-canary-profile; worktree
  C:\dev\main\meri-greenfield-worktrees\w02-native-canary-profile.
- Eleven allocated paths for the W19 task; the continuation-2 amendment changes only the two
  repaired library files, the focused test, the README and this report. The eleven-record input
  freeze (adopted brief e5695bbb…, manifest 375619a9…) is unchanged.
- Out of scope and untouched: the original fixture scripts/test-native-enforcement.mjs,
  scripts/test-native-run-shape.mjs, the W18 planner/teststate sources, all shared ROOT paths,
  prior private evidence, and current Meri/Capiro.

## Implementation attribution
- Implementation: actual Hermes session 20261010_044624_9325bd — original 40-turn invocation
  (exit 0, no commit, 09:03:49Z), owner-allocated continuation-1 (commit b9eb958), and this
  owner-allocated continuation-2 (F1/F2 repairs).
- Owner support/adoption (not implementation, not acceptance): adopted brief e5695bbb…,
  dependency hold e09d06e8…, partial audit 3f3290b8…, candidate-1 audit 636cbc91…,
  W18 literal-B manifest 34d9ffc6….

## What was implemented (native preserved, canary closed)
1. `lib/probe-profiles.mjs` (NEW) — dependency-free leaf: closed deep-frozen mode profiles
   (native exact fragments; canary), canary literals, four-key `CANARY_PROFILE` marker, and a
   frozen reviewed snapshot `CANARY_TARGET/NETWORK/ROLE_PINS/LIMITS/EVIDENCE_KINDS`.
2. `lib/task-definition.mjs` — private shared validator; unchanged native `validateTaskDefinition`
   and fixed `validateCanaryTaskDefinition`.
3. `lib/binding.mjs` — unchanged `buildNativeEnforcementAdmission`; new
   `buildCanaryEnforcementAdmission`, `isCanaryBinding`, `assertCanaryBoundary`.
4. `lib/expressions.mjs` — fixed one-argument native `buildPredicates` plus fixed
   `buildCanaryPredicates`; a private `buildPredicateSet` selects the closed mode.
5. `lib/workflow.mjs` — private `buildStateMachine(binding, profile)`; public native/canary
   wrappers brand-check provenance; native graph rejects canary and vice versa.
6. `lib/infrastructure.mjs` — public `buildNativeEnforcementTemplate` and
   `buildCanaryEnforcementTemplate` (one-revision canary policy scope).
7. `app.mjs` — retains all native exports; adds only canary factory/template exports.
8. `canary-task-definition.mjs` (NEW) — pure no-argument one-resource CFN builder.
9. `scripts/test-native-canary-profile.mjs` (NEW) — focused source fixtures (no framework).
10. `infra/native-enforcement/README.md` — appended source-only contract/bounds/gaps.
11. `docs/coordination/reports/W02-19-CANARY-SOURCE-PREPARATION.md` — this report.

## Native byte equivalence
Raw UTF8 (`JSON.stringify`, no sort/normalization/final LF) against the owner-frozen originals.
Original fixture A (the original guarded suite is not run as main):

| Output | Bytes | SHA256 | Result |
|---|---:|---|---|
| binding.json | 7133 | 19dfb84639bad374aa8e38c255512d1a1cc76eb0843c3d2d5929d8a4a4d671c5 | BYTE-IDENTICAL |
| definition.json | 112210 | 2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3 | BYTE-IDENTICAL |
| template.json | 115766 | 6a8c3255737fc3d9dc0153241fd3af49ad7d186607f7a3d6b371d2881561b4c7 | BYTE-IDENTICAL |

Distinct owner W18 literal input B (`.task-inputs/W02-19-w18-literal-baseline-1/`, static-pins
10904/fc9f1beb…, compile-input 7712/3733f6d1…): the same compiler reproduces binding
7133/9b9b77832b482e2d70f096326aa5c50cac60dbb1a37187bbb68cb6d20af654c1, definition
112210/2c962d23… (graph identical), template 115766/c2de9e54… BYTE-IDENTICAL. A and B are
distinct (verified); neither baseline was sorted/normalized/replaced.

## New canary artifacts (synthetic canary:7 fixture)
- Canary graph 111719B / b2b1004559c74d63e4d5f604f184c39b8f517f2c4b06073604f09cf215a1e3be.
- Canary enforcement template (IAM role + state machine) 115198B / 60fa0762fc97ea8a94767a9279786f154effe7b0c9418ac82e918802b1336c44.
- One-resource task-definition template 2000B / 39cd589630baf398460967adf0d2ed46edc8e5c5560678f742c35d715ee3724d.
- Canary binding id 12457a5fcc883c382df1301801133e89cac5c6959e790ceea520db91326ead69.
These are author-result values; complete artifact bodies were not separately exported. Canary graph
= same 91 states as native; Initialize ctx byte-identical to native; one RunTask; no Retry/Map/
Parallel; PassRole and current-tag StopTask conditions structurally unchanged; no CANARY_PASS/
CANARY_ACCEPTED field.

## App import closure (8 production files, acyclic; inspected)
- app -> binding, expressions, workflow, infrastructure, canary-task-definition
- binding -> task-definition, probe-profiles, node:crypto
- expressions -> binding, probe-profiles
- workflow -> binding, expressions, probe-profiles
- infrastructure -> binding, workflow, probe-profiles
- canary-task-definition -> probe-profiles
- task-definition, probe-profiles -> no imports
Only builtin dependency is node:crypto; no production filesystem/process/network import or
import-time IO. Because the F1/F2 amendment changed binding/task-definition, the current raw pins
are:

| Path | Bytes | SHA256 |
|---|---:|---|
| infra/native-enforcement/app.mjs | 618 | e03076acb2ccda59bd38c2e2763f94af0d057f6c6c1bd3e699e25c72314ab1ed |
| infra/native-enforcement/lib/probe-profiles.mjs | 4920 | 67dff6ffb4025e1767226a5bb330998ad78bd9d76083319adb910a22e3397660 |
| infra/native-enforcement/lib/binding.mjs | 16458 | 8df3f2f02e23a4f3587a342dcb882404c7c0f70be6e57b84b9d1b0af0eaea35a |
| infra/native-enforcement/lib/task-definition.mjs | 8996 | 3d45d054150c5e7706253694a725761afb96abe5a39d1a3ecc0bfb1adb686436 |
| infra/native-enforcement/lib/expressions.mjs | 13776 | 933dcca53027688be2e6373bed818890882f239bc5da5af1af827277213b87aa |
| infra/native-enforcement/lib/workflow.mjs | 25002 | 09171cbc66ce0efbd643969d92c92c742f89d0b41804eefd65064f2175aa39ca |
| infra/native-enforcement/lib/infrastructure.mjs | 4780 | c0ddb78cbfb28ed0fd3360b0dec86d12371240fb7d87c0452dec0408454a53af |
| infra/native-enforcement/canary-task-definition.mjs | 2612 | 524135d00aec413a6393e69a7d22974160109b01cc4ced71d35f26440d3e4df5 |
| scripts/test-native-canary-profile.mjs | 43621 | eae1b945f943d1a9979bac7c0126c26192ec2e4b4f80a3270049276aa2aae35d |

### W18 integration hold (distinction corrected)
W18 pins SIX COMPILER SOURCES — `infra/native-enforcement/app.mjs`, `lib/binding.mjs`,
`lib/expressions.mjs`, `lib/workflow.mjs`, `lib/infrastructure.mjs`, `lib/task-definition.mjs` —
all of which are CHANGED by this candidate (raw source pins differ even though native outputs are
byte-identical). What is actually outside this worktree's ownership and untouched is the W18
PLANNER/TESTSTATE source and its request contract. The two new imports (`lib/probe-profiles.mjs`,
`canary-task-definition.mjs`) do not inherit the old six-file authentication. ROOT integration
therefore remains HELD until a separately allocated, distinctly reviewed and owner-verified
COMPLETE eight-file W18 closure-pin advancement preserves the original literal 10904 input, graph
and request bytes. No sourceReader/bypass/hash-disable/fallback is authorized.

## Exact-source conditional bounds delta
Actual generated-graph source inventory: 31 `pass` states, 7 `prepare` states (implemented via
`pass`), 9 record states, 10 Task states. Initialize adds one direct Pass-with-`Assign.ctx`, hence
39 total Pass-with-`Assign.ctx`. Initialize has 31 keys; only `launchObservedEnd`/`overflowed` can
add to 33. Task success/Catch use the unchanged seven extra variable names
`raw`/`rawOver`/`callOk`/`callError`/`observedMs`/`enteredMs`/`createdMs`. Records assign no
variables; Choice/Wait states assign nothing. Pass/Task/Catch Outputs are empty except the nine
bounded record outputs and two explicit finals. No new persistent ctx/ledger/state/final-output
field is introduced.

- Pass names: ConsumeAttempt, RetainRun, LaunchUncertain, StartScan, RetainPage, NextInventory,
  DiscoveryError, PickCandidate, RetainCandidate, BindOwned, BindOverflow, OverflowExhausted,
  ForeignOrAmbiguous, CandidateError, EvaluateTask, RetainENI, ENIMismatch, ENIContradiction,
  NetworkUnknown, SelectOwned, RetainPreStop, PreStopReadUnknown, MarkStopAttempt,
  RecordStopTiming, PickConfirm, RetainFreshTerminal, TerminalReadUnknown, RetainTerminal,
  BumpProbe, PrepareFinal, PickFinal.
- Prepare: PrepareDispatchIdentity, PrepareListFirst, PrepareListNext, PrepareENI,
  PreparePreStopDescribe, PrepareStopIdentity, CountTerminal.
- Records: AdmissionRecord, LaunchAttemptRecord, RunResultRecord, PageRecord, OwnershipRecord,
  ObservedRecord, PreStopRecord, StopResultRecord, TerminalRecord.
- Tasks: DispatchIdentity, RunTask, ListFirst, ListNext, DescribeCandidate, DescribeENI,
  PreStopDescribe, StopIdentity, StopOwned, TerminalDescribe.

Measured literal ASCII widths (ordinary data arithmetic): kind `canary`=6 equals the old office
kind 6; group `meri-greenfield-qualification:canary`=36 equals old office group 36; execution name
`meri-canary-<UUID>`=48 is below the native office execution-name allowance 55; family
`meri-greenfield-qualification-canary`=36 equals the old office family 36. The canary MACHINE NAME
(50), MANAGED-ROLE NAME (48) and complete managed IAM role ARN (79; quoted 81) are LONGER than the
old synthetic fixture values (42/40/71; quoted 73); a blanket "shorter or equal" claim is FALSE.
They fit the ORIGINAL ABSOLUTE bounds: machine suffix ≤35 (full name ≤70), managed-role ≤61 (quoted
ARN ≤94), kind/group/family match the old office maxima, execution name 48 ≤55. Because the canary
substitutions stay inside those unchanged absolute envelopes and add no new field, the historical
conditional bounds remain valid and are NOT repinned or loosened: normal complete variables 153940,
fallback ctx 147675, fallback complete variables 170543, largest record 108135, normal finals
130924/130922, fallback final 117716. All caps are unchanged (owned4 + overflow6, recordBytes32768,
ledgerBytes16384, ctxBytes196608, outputBytes131072, refBytes16384, tokenChars2048, D720000/C900000,
containment D-155000). The `canaryProfile` marker and fixed `canaryEvidencePins` remain
binding/template-only, never ctx/record data. The old proof files (280a PROOF/ARITHMETIC/derive)
and the phase7 delta are preserved unchanged and were not re-run or repinned; this is a source delta
only. Static/source inventory is NOT a generated-graph, service-payload/history, evaluation-
allocation, arbitrary-input or physical-cleanup proof.

## Checks and first-failure history
- This amendment ran the focused suite exactly once via a stdlib subprocess with a 120-second
  whole-process timeout:
  `node .task-inputs/W02-19-narrow-repair-1/run-envelope.mjs <jsonata-2.0.6.js> .task-inputs/W02-19-narrow-repair-1/result.json`.
  Envelope: exit 0, timedOut false, signal null, elapsed 211 ms, configuredTimeoutMs 120000,
  source/baseline pins stable; separate stdout (8734 B) / stderr (0 B); Node v24.19.0. Result:
  120 PASS labels, 73 selected JSONata evaluations (3 retain / 13 uncertain of the 16 RunShape
  fixtures); native A lengths 7133/112210/115766 and the canary graph/task-template hashes
  unchanged. Captures: `result.json` SHA256 921e9719a68727ef55a2bdc3d2856940b98ac4aadec670586e3cc5461654041e;
  `stdout.txt` 3d45c76b5b4ab89e39f031675f8856df7e9b9e00dec1c6c82ca5264d843010af;
  `envelope.json` 915099f9d747ab6cf7444d35e4546a36acb6386725be83ad8e675ddb1129c9f8.
- `node --check` on the two repaired JS files, the focused test and the capture helper: clean.
- Prior retained runs (NOT re-run here; their per-command envelopes were not retained):
  original canonical `node --test scripts/test-native-enforcement.mjs` — 47 tests / 47 pass / 0
  fail, Node-reported duration 128.2799 ms, stderr 0 (Node test duration is not an externally
  enforced 120-second whole-process bound). Promoted `scripts/test-native-run-shape.mjs` — exit 0,
  81 evaluations / 16 fixtures. Continuation-1 focused run — 98 PASS labels / 73 evaluations at
  09:25:34.209Z.
- Metric distinction (not merged): the ORIGINAL session's result1 recorded 73 check labels; the
  continuation-1 result2 recorded 98 labels and 73 selected evaluations; this amendment records
  120 labels and 73 evaluations. The 16 RunShape fixtures are reused inside the focused suite and
  overlap the promoted run-shape controls; these are overlapping cases, not unique-case counts.
  Configured per-command 120-second enforcement for the OLD captures remains UNPROVEN; no contrary
  timeout value and no actual 120-second overrun was observed, and no retroactive upgrade of old
  capture supervision is claimed.

Preserved failures and deviations (not erased by green results): original Initialize 39-vs-38
Pass-with-ctx miscount; J-wrapped selected ARN compared without `JSON.stringify` quoting; ownership
fixture wired to `$states.current` instead of `$ctx.current`; a fuzzy source-patch failure on the
untouched `taskArnTest` backslash line reverted and re-applied; missed initial report-skeleton /
reserved-closure reserve; absent old per-command envelopes; and the original `/tmp/head-expr.mjs`
narrative with a failed Windows-resolved Node read. The local `.task-inputs/.head-expr.mjs` copy
(12917B / e5a1931f…) is preserved outside the permitted W02-19-* scratch prefix; the actual outside
path's existence/cleanup is UNKNOWN and no outside file was searched or deleted. Continuation-1
also recorded a W18-literal guard-assertion-order correction. No narration was converted into an
independent failure classification.

## Disclosure and limits
- The guard expression is evaluated only as an isolated synthetic predicate seed (its leading inert
  `false` replaced by `true`); it is not a source Boolean bypass or deployable admission.
- No real StopOwned, terminal 143/137 execution, complete workflow, overflow/deadline/uncertain
  discovery, IAM/current-tag propagation, physical cleanup, native wire, image admission or service
  behavior is proven; RetainTerminal/final/nonzero-exit semantics are preserved as source/body
  assertions only.
- `buildCanaryPredicates(p)` alone builds inert strings from arbitrary `p` and the shared LIMITS
  without the graph's boundary/brand check; it grants no compiled authority and is not re-exported.
  The authority-bearing graph/template paths brand-check and boundary-assert first.
- F1/F2 are API behavior regressions, not live permission claims. All 49 scan findings / 22 severe
  remain OPEN; Office DEFERRED, G1 OPEN, paid Bedrock 0. No runtime/canary/security waiver; no
  canary/live authority admission. Application/control stay on the separate isolated Fargate
  environment; source connectivity disabled; current Meri/Capiro untouched.

## Closure and remaining work
- This amendment is an ordinary scoped child commit on task/w02-native-canary-profile (no push, no
  amend) limited to the five changed files. ROOT integration remains HELD pending a separately
  allocated, distinctly reviewed and owner-verified COMPLETE eight-file W18 closure-pin advancement.
- Remaining owner work: distinct actual exact-commit review; independent source/byte/expression
  replay; the W18 closure-pin advancement; and all future runtime/IAM/network/security/wire/cleanup
  admission work. A process exit 0 does not establish acceptance.
