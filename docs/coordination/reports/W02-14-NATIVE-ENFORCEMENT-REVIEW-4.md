# W02-14 distinct ACTUAL review 4 - native-enforcement phase-7 launch-shape guard (SOURCE-ONLY)

Reviewer session `review4` (distinct from author session `20261010_023359_6413e7` and from all prior
reviews `review/review-2/review-3`). Review target is the exact clean commit only. No acceptance is
claimed or implied; the primary (Codex) owns acceptance.

- Pinned base (exact, reviewed): `3da63e67ba94c361070e5997c9bd21a816546610`
- Parent: `280a2a222d4443a03e96c7cd3c17571fa4329163`
- Branch: `review/w02-native-enforcement-4` (clean at start and end; only the owned report is added)
- Packaging commit is Codex-authored; the implementation itself is actual Hermes output, packaged
  closed by the owner after two explicit caps. This review does not treat any author report as
  evidence and makes no acceptance claim from it.

## Verdict

**SOURCE-ONLY: PASS for the single reviewed claim**, with explicit limits below and **no acceptance**.

The reviewed claim is narrow: the phase-7 `RunShape` immediate-member guard closes the measured
fail-open where a malformed singleton `tasks:[{taskArn:[oneARN]}]` (and nested / five-ARN shapes)
made JSONata property traversal flatten the ARNs so a top-level `count(tasks)<=4` did not bound the
direct set and a singleton ARN array could set `launchCertain:true`. All 13 malformed / foreign /
wrong-type / oversized shapes now route `LaunchUncertain`; the two valid controls behave as required
(one may be certain; four must fail qualification); the empty case may pass the guard but never gains
certainty. No `$ctx` key, byte cap, IAM policy or deadline changed.

**No blocking source finding was established.** One unchanged pre-existing observation is recorded
(absent-`failures` certainty) and is not a phase-7 regression.

## Pins verified before any evaluation

- Task input `HASHES.json` SHA256 = `2ae33f9f5ec134470a816fbf5d6f5d266a9a57b94e5ab90dbce7556c010a59b3`
  (required value) - MATCH.
- `candidate-manifest.json` raw SHA256 = `9d9057fc8a76c6e06a5db04dea737de39e96b5cdbd0e62dd86d9cf5068dc0baa`
  (matches its own `HASHES.json` entry) - MATCH.
- **All 11 candidate-manifest source entries**: raw-file SHA256 == manifest SHA256 == Git BASE
  (`3da63e6`) blob SHA256, and byte length == manifest `bytes`. Each of app.mjs, binding.mjs,
  expressions.mjs, workflow.mjs, infrastructure.mjs, task-definition.mjs, README.md,
  test-native-enforcement.mjs, W02-14-NATIVE-ENFORCEMENT.md, test-native-run-shape.mjs,
  W02-14-RUN-SHAPE-REPAIR.md - ALL MATCH (11/11).
- Retained JSONata runtime `C:/dev/main/meri-greenfield-kickoff-20261009/.task-inputs/jsonata-2.0.6-runtime/jsonata.js`
  SHA256 = `8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b` (required value), 291449 bytes,
  node v24.19.0 - MATCH. Verified again inside the promoted test before `require`.
- Bundled support (read-only, conditional, copied from `280a`): `BOUND-PROOF.md`
  (`3d0902de…`), `BOUND-ARITHMETIC.json` (`943835b0…`), `derive.py` (`059d27a0…`). `derive.py` pins
  the OLD `280a` workflow SHA `884b1107…` and was **read only, never executed** (running it against
  the new pin would abort on its `assert actual == expected`).

## Full 280a -> BASE diff (5 paths, inspect per owned path)

`git diff --stat 280a2a2 3da63e6`: workflow.mjs 15/-2 (one hunk), README.md +6,
test-native-enforcement.mjs +29, test-native-run-shape.mjs +107 (new), RUN-SHAPE-REPAIR.md +44 (new).
`git diff --check` exit 0. `node --check` exit 0 on workflow.mjs / test-native-enforcement.mjs /
test-native-run-shape.mjs.

- `infra/native-enforcement/lib/workflow.mjs` - **the only functional source change**, single hunk.
  `RunShape` now additionally requires `$count($filter($raw.tasks,fn($t){$type($t)='object' and
  taskArnTest($t.taskArn)})) = $count($raw.tasks)`, and `direct` becomes
  `$map(immediateTaskArns, fn($t){$t.taskArn})` instead of the flattening property path
  `$raw.tasks.taskArn`. Retained unchanged: `$type($raw)='object'`, `$type($raw.tasks)='array'`,
  `$count($raw.tasks)<=4`, failures-array tolerance, `safeRaw` before-write byte bound, and the
  `RetainRun` `launchCertain`/`qualificationFailed` formula (verified character-identical to `280a`).
- `scripts/test-native-enforcement.mjs` - adds the exported permanent synthetic fixture set
  `runShapeFixtures(pins)` (16 cases). No existing canonical case changed; the previously added
  one-line implementation-mirroring test is gone (this is why the canonical set is 47, not 48).
- `scripts/test-native-run-shape.mjs` - NEW focused test (candidate imports resolved relative to
  `import.meta.url`; no hardcoded worktree/root/session; explicit CLI args; verifies runtime SHA
  before `require`; one `wx` capture; evaluates only the ACTUAL candidate `RunShape`/`RetainRun`/
  `LaunchUncertain`/`StartScan` expressions, no copied JS validator).
- `infra/native-enforcement/README.md` - documentation note only.
- `docs/coordination/reports/W02-14-RUN-SHAPE-REPAIR.md` - author report (not treated as evidence).

**No `$ctx`-key / cap / policy change**: `binding.mjs`, `infrastructure.mjs`, `task-definition.mjs`,
`expressions.mjs`, `app.mjs` are byte-identical between `280a` and BASE (diff empty), so `LIMITS`
(recordBytes 32768, ledgerBytes 16384, ctxBytes 196608, owned 4, overflow 6, ...), the Initialize
31-key shape, and the exact IAM/StopTask/PassRole policies are unchanged. `workflow.mjs` is the only
functional delta and it is confined to `RunShape`/`direct`.

## Independent execution (commands, exits, counts, raw captures)

1. `node scripts/test-native-enforcement.mjs` (canonical, run ONCE) -> **exit 0**, `tests 47 /
   pass 47 / fail 0`, ~1s. Confirms the canonical graph/expression/IAM/task-definition set still
   passes against the reviewed source.
2. `node scripts/test-native-run-shape.mjs <jsonata.js> .task-inputs/W02-14-review-4-out/run-shape-result.json`
   (promoted 16-case test, run ONCE, fresh private `wx` output) -> **exit 0**, ~1s, **81 expression
   evaluations**, 16 cases. Capture SHA256
   `17cc69c79ad395269634e034e010103f07fb37ce727fbd5179f7a29f151bbd9b`.
3. Reviewer-owned independent probe `.task-inputs/W02-14-review-4-out/probe-cases.mjs`
   (10 reviewer-authored edge cases + raw-runtime semantics, fresh private `wx` output) -> **exit 0**,
   **49 evaluations**. Capture SHA256
   `833019ef6826cd3e2f98e222e8fa9fe7c3e5e70d9054cc1439d3eee57a989862`.
4. Raw-runtime semantics on retained JSONata 2.0.6: `$raw.tasks.taskArn` flattens
   `tasks:[{taskArn:["a","b","c","d","e"]}]` to a 5-element array; `$count(undefined-key) = 0`;
   `$count('x') = 1`; `$count([]) = 0`; `$type(null) = 'null'`; `$filter` over the object/string
   predicate returns 0 for that nested-array member. This is the exact flattening that justified the
   repair.

### Promoted 16-case coverage (exit 0)

13 malformed/foreign/wrong-type/oversized: `malformed-singleton-arn-array`,
`malformed-multiple-arn-array`, `malformed-nested-task-records`, `malformed-mixed-immediate`,
`primitive-task-member`, `null-task-member`, `missing-taskarn`, `numeric-taskarn`, `object-taskarn`,
`foreign-namespace-arn`, `malformed-namespace-arn`, `tasks-wrong-type`, `tasks-too-many` -> all
`runShape:false` -> `LaunchUncertain` -> `launchCertain:false` / `qualificationFailed:true`.
2 valid controls: `valid-one-scalar-object` -> `RetainRun`, `direct` 1, `launchCertain:true`,
`qualificationFailed:false`; `valid-four-scalar-objects` -> `RetainRun`, `direct` 4,
`launchCertain:false`/`qualificationFailed:true` (`count!=1`). 1 empty: `empty-tasks-uncertain` ->
`runShape:true` (documented) but `launchCertain:false`/`qualificationFailed:true`, `direct` 0.

### Reviewer independent probe (exit 0) - cases the promoted set does not cover

- `nested-single-immediate-array` (`tasks:[[obj]]`) -> guard false -> `LaunchUncertain`.
- `nested-many-immediate-array` (`tasks:[[obj x5]]`) -> guard false -> `LaunchUncertain`.
- `valid-plus-foreign-scalar` and `swapped-mixed-valid-invalid` -> guard false -> `LaunchUncertain`.
- `duplicate-valid-scalar-arns` (`tasks:[obj,obj]`) -> guard true, `direct` distinct 1, but
  `launchCertain:false` / `qualificationFailed:true` (`count(tasks)!=1`); no false certainty.
- `valid-one-nonarray-failures` and `valid-one-null-failures` -> guard false -> `LaunchUncertain`.
- `valid-one-nonempty-failures` -> guard true -> `RetainRun`, `launchCertain:false` /
  `qualificationFailed:true` (`count(failures)>0`).
- `valid-one-absent-failures` and `valid-one-empty-failures-control` -> `RetainRun`,
  `launchCertain:true` / `qualificationFailed:false` (see observation below).
- In every probe case `attemptConsumed:true` and the seeded owned/overflow `netId`/`netIp` pins
  survive; `StartScan` stays reachable and (on the uncertain route) its queue still contains the
  original positive ledgers. No ARN truncation into success; no ownership/IAM widening.

## Preserved-behavior checks

- Uncertainty/discovery preserved: malformed routes to `LaunchUncertain` -> `StartScan`; the
  original positive ledgers, net pins and `stopAttempted` survive all 26 evaluated cases combined.
- One-attempt semantics: `ConsumeAttempt`/`attemptConsumed` untouched.
- Sticky failure: `qualificationFailed` never cleared; every non-clean case is `true`.
- Bounded counts retained: top-level `count<=4`, failures-array tolerance, `$distinct` on `direct`,
  and the existing OwnedCapacity 4+6 overflow ledger are unchanged.
- No ARN truncation, no retry, no re-launch, no deadline change (timeout/`$ctx.D`/`$ctx.C` lines
  untouched).

## Bound-delta verdict

**RunShape/direct only; the old aggregate bound remains conservative; no ctx-key/cap/policy change.**

The `280a` proof (`BOUND-PROOF.md` "Important correction" + `BOUND-ARITHMETIC.json`) already replaced
the broken `direct<=4` premise with an **aggregate** one: valid `direct` strings are a
non-duplicating selection from the byte-bounded raw response, so `direct` serialized bytes `<= 5461`
*regardless of count*. The new `direct = $map(validated immediate objects, $t.taskArn)` yields only
canonical ASCII ARN strings drawn from that same bounded raw, so it is a **subset** of the previously
bounded selection and adds the stronger `count(canonical direct)<=4` (bounded by the immediate task
count). The `280a` arithmetic (normalVars 153940, fallbackVars 170543, largestRecord 108135,
normalFinal 130924, fallbackFinal 117716 actual UTF-8) therefore still upper-bounds the new source;
the "6x predicate" figure is not the derived bound. `derive.py` and `ARITHMETIC.json` pin `280a`
hashes and were not executed against the new pin.

The copied proof is **conditional support, not acceptance**, and its scope is limited to the
workflow's explicit persistent variables and resolved Outputs. It does **not** cover the pre-projection
Task result, transient JSONata/merge allocations, the service execution context, event history or
transport encoding, and assumes fixed scalar owner-admitted input, finite binary64 `<=25` ASCII, and
compact serialization. A fallback can obstruct terminal availability so cleanup can remain
`CLEANUP_UNKNOWN`; no availability guarantee is established.

## Precise limits / open evidence

- Selected-expression synthetic-fixture qualification only: no GuardInput, no Step Functions
  execution, no AWS wire framing/serialization, no IAM/tag propagation, no outages, no ENI lifecycle,
  no deadline-under-latency, no StopTask/STOPPED confirmation, no physical cleanup. Fixture
  compilation stays `runtimeEnabled:false`.
- Reviewer did not replay unchanged network / item-108 / whole-workflow / broad-npm / AJV / native
  suites; those remain as previously reported. Canonical suite and the focused test were each run
  exactly once.
- **Unchanged pre-existing observation** (NOT a phase-7 regression): a valid single scalar-object
  payload with **absent** `failures` yields `launchCertain:true` because `$count(undefined)=0`. This
  is character-identical to the `280a` `RetainRun` formula and is the legitimate positive path; real
  ECS `RunTask` responses always carry a `failures` array, the immediate member must be a canonical
  same-namespace scalar ARN, and final confirmation still requires `boundCount>0`,
  `completeModes=3`, no pending/unconfirmed, and `$not($ctx.hold)`. Recorded as an accepted
  limitation of source review, not a defect introduced here.
- A genuine failed launch (`tasks:[],failures:[…]`) also passes `RunShape` -> `RetainRun` with
  `launchCertain:false`/`qualificationFailed:true` and does not add the `launch-uncertain` issue that
  `LaunchUncertain` adds; this too is unchanged from `280a`. Containment is unaffected because every
  final path still gates on `launchCertain`.
- Reviewer does not repeat the previously raised unproven claims (`review3` reported 75 vs final 77
  evaluations; a universal-guard claim applied only to a synthetic graph; a singleton `$ctx`-object
  claim not shown to be a product bug). None is reasserted here.
- Not qualified here: `$ctx` native IAM survival, TestState, deadline behaviour, controller-kill,
  physical cleanup, real guard/type coercion beyond the retained runtime, service serialization.
- Environment status unchanged: 49 findings (22 severe) OPEN, Office DEFERRED, G1 OPEN, paid Bedrock
  0. No AWS/network/Docker/browser/SDK/provider/model/build/deploy/host-launch/security-waiver/
  current-Meri/source/cutover action occurred. No source/test/README/prior-report file was edited.
  Primary owns acceptance; the owner will fresh-validate the final graph.

## Focused-organization assessment

The repair is correctly **localized**: one functional hunk in `RunShape`/`direct`, tests confined to
the focused new file plus a cleanly separated exported fixture set, documentation split out, and the
author report kept distinct. The new guard is a typed immediate-member predicate (object + scalar
string + reviewed exact task namespace) whose eligible set is projected with `$map` from the same
validated members, so the direct count is bounded by the immediate count without trusting a
flattening property path. Malformed/incomplete/mixed results fail closed to `LaunchUncertain`, the
empty case is explicitly not turned into certainty, and discovery/containment/ledgers remain intact.
The organization matches the "cohesive binding/expressions/workflow/infra/definition modules + one
new focused regression file" requirement.

Reviewed artifacts: candidate 11 source pins (manifest SHA256
`9d9057fc8a76c6e06a5db04dea737de39e96b5cdbd0e62dd86d9cf5068dc0baa`), task input `HASHES.json`
SHA256 `2ae33f9f5ec134470a816fbf5d6f5d266a9a57b94e5ab90dbce7556c010a59b3`. Focused captures:
`17cc69c7…` (promoted 16-case) and `833019ef…` (reviewer probe).
