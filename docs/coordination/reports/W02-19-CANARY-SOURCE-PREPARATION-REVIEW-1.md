# W02-19 Canary Source-Preparation — distinct exact-commit review 1 (OFFLINE)

Reviewer: Hermes, distinct actual W19 review (not the author/owner session, not a resume).
Verdict: **ACCEPT — bounded OFFLINE source-preparation scope only**, with explicit unaccepted holds.
Report-only; no source/oracle edit, no network/cloud/native/install/background/delegation/push/amend.

Candidate (HEAD): `9f51fd3e45f1ddf33c7bb83d5c76720d12cea83c`
Parent: `b9eb95842174124104863b5d7119352a29c6b7ef`
Integration base: `77dcd1644221c14dbdb19aa9574a456b9df4b21a`
Branch: `task/w02-native-canary-profile-review-1` — clean at review start (porcelain empty), HEAD/parent verified.
Node: v24.19.0 (owner-observed version; single use, no version loop).

## 1. Input verification (completed BEFORE any source/evaluator use)
| Input | Expected bytes / SHA256 | Observed | Result |
|---|---|---|---|
| Root allocation `W02-19-REVIEW-1-ALLOCATION.md` | 13986 / cc068e6d…9de3ff | match | VERIFIED |
| Root supplement `allocation-supplement.md` | 6625 / 9ab05248…4eed96c9 | match | VERIFIED |
| Manifest v2 `W02-19-review-inputs-and-source-manifest-v2.json` | 179039 / c6b06558…cdc1c335 | match | VERIFIED |
| Chained original manifest | 144831 / 7277a552…505f6352 | match | VERIFIED |

v2 manifest read in full: `originalInputCount`162 + `newSupplementCount`16 = `totalInputCopies`178; 13 raw-Git source pins; 10 Git readbacks; `transferReadManifestLocalMap`52; flags `conditionalTransferOnlyRootAdopted:true`, `sourceAcceptance:false`, `distinctActualReviewLaunched:false`, `W18FullEightClosureStillRequired:true`. Copied supplement scripts (audit/adoption/readiness) read as SOURCE/DATA only — never executed or imported; embedded absolute paths treated as provenance.

## 2. Frozen source pins (13/13 match v2 manifest, pre == post for every fresh check)
probe-profiles.mjs 67dff6ff…; task-definition.mjs 3d45d054…; binding.mjs 8df3f2f0…; expressions.mjs 933dcca5…; workflow.mjs 09171cbc…; infrastructure.mjs c0ddb78c…; app.mjs e03076ac…; canary-task-definition.mjs 524135d0…; test-native-canary-profile.mjs eae1b945…; test-native-enforcement.mjs d294a963…; test-native-run-shape.mjs 9a1fbbe4…; README.md c602d1f3…; W02-19-CANARY-SOURCE-PREPARATION.md a2d141b5….

## 3. Native preservation — mechanical, not narration
Read the complete old shared validator (`W02-19-old-task-definition.mjs`, 7965B/fbe77091…) and the current private body. Mechanical line comparison of the two 43-line bodies (42 non-empty each) found **exactly 2 differing lines**, both the closed invocation-selection substitutions:
- `ordered(c.entryPoint,['node'],'entryPoint')` → `ordered(c.entryPoint,mode===INVOCATION_CANARY?['/usr/bin/sleep']:['node'],'entryPoint')`
- `ordered(c.command,[expect.command],'command')` → `ordered(c.command,mode===INVOCATION_CANARY?['1200']:[expect.command],'command')`

All other statements and their order are byte-identical; the native wrapper (`validateTaskDefinition`) selects `INVOCATION_NATIVE` internally so native entryPoint `['node']` and command `[expect.command]` are unchanged. Method stated: line-level diff of function bodies (not an AST/statement count). Native A/B binding/definition/template remain byte-identical to their own frozen baselines — corroborated by the fresh focused run (binding 7133 / definition 112210 / template 115766, both A and B).

F1/F2 (from source): `buildCanaryEnforcementAdmission` validates outer object/keys/boolean **before** the missing-`staticPins` inert return; present-falsy pins refused; unknown command/profile/entryPoint/duration options refused. `expect.command` is read only inside the shared validator at the original ordered command position (after schema/security/entryPoint guards); the canary path uses fixed literals and never reads it.

## 4. Fresh checks — each ONCE, binary-captured, 13 pre/post pins unchanged
Thin stdlib wrapper (reviewer-local scratch): child `spawnSync` with external timeout, raw binary stdout/stderr, argv/cwd/UTC/monotonic elapsed/rc/signal/timeout, 13 pre/post source pins.

| Check | Command | Envelope | Exit | stdout bytes / SHA256 |
|---|---|---|---|---|
| Canonical 47 | `node scripts/test-native-enforcement.mjs` | `.task-inputs/W02-19-review-1/canonical47/envelope.json` (348dcb7f…) | 0 (no signal, no timeout) | 2884 / f9a32542…1ea7e |
| Focused canary | `node scripts/test-native-canary-profile.mjs <pinned jsonata.js> <fresh result.json>` | `.task-inputs/W02-19-review-1/focused-canary/envelope.json` (cc1e021c…) | 0 (no signal, no timeout) | 8734 / 3d45c76b…3010af |

- Canonical 47: node test summary `tests 47 / pass 47 / fail 0 / cancelled 0 / skipped 0` — original canonical 47 reproduced.
- Focused canary: **120 PASS labels**; runtime `evaluations:73`; RunShape/RetainRun **3 retain / 13 uncertain over 16 fixtures**; `result.json` f016312a… (1732B) records `checks:120`, `evaluations:73`, `canaryGraphBytes:111719`, `canaryEnforcementTemplateBytes:115198`, `canaryTaskTemplateBytes:2000`, `canaryBindingId:12457a5f…`, `runtimeEvaluation:true`. JSONata runtime SHA re-checked inside the child = `8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b` (matches pin). Its own `limitsOfEvidence` state the fixture stays `runtimeEnabled:false` and no AWS/workflow/cleanup/IAM proof is claimed.
- Corroboration: the fresh focused stdout is **byte-identical** (8734B, SHA 3d45c76b…) to the owner's copied `W02-19-owner-suites-1/canary-stdout.bin` — the fresh run independently reproduces the owner canary envelope.

Reviewer setup corrections (disclosed, preserved, not source defects):
- Focused attempt-1 (`.task-inputs/W02-19-review-1/focused-canary.attempt-1-setup-path/`): POSIX `$(pwd)` path passed to node resolved as `C:\c\dev\…` → ENOENT at the runtime section (structural checks had already printed PASS). Re-run with the native `C:/dev/…` path exited 0.
- Control attempt-1 (`.task-inputs/W02-19-review-1/control.attempt-1-oracle/`): reviewer oracle case 6 used a native expect whose arn/family/revision did not match the canary record, so the binding guard fired first. Corrected oracle (match arn/family/revision so the ordered entryPoint guard is first) exited 0.

## 5. Independent control (ONE) — pure production calls, own literal oracle
`.task-inputs/W02-19-review-1/w19-control.mjs` (reviewer-authored; imports only production `validateTaskDefinition`/`validateCanaryTaskDefinition`; own literal DATA + oracle; no candidate fixture imports). Envelope `control/envelope.json` (f3358f9c…), exit 0, stdout 896B / 8d7d1168…, external timeout 30000ms. `CONTROL_RESULT` = 12 checks, ordering table `{nullDefinition:0, badEntryPoint:0, validNative:1, wrongCommand:1, canary:0, crossModeNative:0}`:
- null definition refuses `definition object` before any command read (reads 0);
- bad entryPoint refuses `entryPoint` before the later command getter is touched (reads 0) — **ordering preserved**;
- valid native record reads `expect.command` exactly once (reads 1); wrong command consumes the getter once and fails at `command` (reads 1);
- canary record validates with an arbitrary `expect.command` getter that throws if touched (reads 0) — the closed canary path never consults it;
- native cross-mode refusal of the canary sleep record fails at `entryPoint` (reads 0).
This adds ordering evidence beyond copying candidate/owner getter fixtures. No source patch was used, so no finally-restoration was required (none observed).

## 6. Graph/IAM/binding/organization (source read, not deployed)
Read all eight production files. Observations (source-only): `buildStateMachine` selects a closed mode by private provenance (`isCompiledBinding`/`isCanaryBinding`) and refuses forged/lookalike bindings (WeakMap/WeakSet provenance; a forged object obtains only `AdmissionRefused`). One dynamic `ecs:RunTask` (no Retry/Parallel/Map); canary RunTask resource is exactly the single canary revision; managed-role trust is SourceAccount + SourceArn(stateMachine); StopTask stays conditioned on CURRENT resource tags (no permission broadening); PassRole limited to the two pinned roles; D720000/C900000/t0 and clipped waits/pages/polls/ledger/counter/literal bounds preserved; canary binding adds the deep-frozen 4-key `canaryProfile` into the binding ID before freeze. Organization: small `app.mjs` composition entry; cohesive binding/expressions/workflow/infrastructure/task-definition/probe-profiles modules; probe-profiles is a dependency-free leaf; no circular imports. These are read findings only — they do not prove deployed StepFunctions/IAM/service behavior.

## 7. Conditional bounds + DATA reconciliation (attributed DATA)
Owner DATA read and reconciled, not re-executed: transfer audit stdout `OWNER_BOUND_TRANSFER_CANDIDATE_DATA_CHECKED_NOT_ACCEPTED` (448 changed rows, 7 expression paths, 524 checks, core JSON fbabbc0c…); handoff CLOSED; `adoption.json` `ROOT_ADOPTED_CONDITIONAL_TRANSFER_ONLY` at 2026-10-10T10:43:01.089761+00:00 (52 verified read pins, 524 retained assertions, 448 changed rows, 7 expression paths, 8 unchanged native raw products); readiness REPORT (91-state / 39 context-writer / 10-Task / 20-Catch inventory; complete graph/template byte equality). Owner transfer candidate MD confirms longer canary machine/role/profile literals invalidate any blanket "everything shrinks" claim and keeps the original absolute allowances. Readiness attempt-1 support-verifier failure (missing `expectedByConstruction:true`) is preserved and disclosed; it is a support-verifier comparison defect, not a source/candidate finding. Owner 47+16+120 suites, 65 behavior rows and export envelopes remain attributed owner DATA and do not substitute for this fresh review.

## 8. Verdict and holds
**ACCEPT (bounded OFFLINE source-preparation scope).** No substantive source/bound defect was found in the reviewed scope: the native body is preserved except the two permitted invocation-selection substitutions; F1 strict-outer ordering and F2 deferred-command ordering hold under independent control; the closed canary contract is real in production (not test-only); canonical 47 and focused 120/73 reproduce; the fresh canary stdout matches the owner capture byte-for-byte.

Explicit unaccepted holds (never silently promoted):
- **W18**: ROOT integration remains HELD pending a separately allocated, distinctly reviewed and owner-verified **complete eight-file W18 compiler-closure pin advancement**; no partial repin/bypass/fallback/sourceReader.
- **Conditional bounds**: the root conditional transfer is adopted as SOURCE/DATA only; the old arithmetic stays conditional on its stated assumptions (compact JSON/JSONata strings, B≤4L, finite binary64≤25 ASCII, fixed admitted shape, bounded nonduplicating selection, successful explicit-value return). It excludes service input/context/history/logs, preprojection results and transient allocation; no liveness, universal Guard type/coercion, fallback-predicate-success or physical-cleanup guarantee.
- **Runtime/security/G1**: no task-definition registration, role/machine deployment, RunTask/StartExecution/TestState, AWS wire/service/timer/history/managed-patch/physical-cleanup proof. All 49 security findings / 22 severe remain OPEN; Office DEFERRED; native/security/G1 OPEN; paid Bedrock 0; current Meri untouched; app/control remain independent Fargate; Temporal unchanged.
- Prior author partials/failures, missing older per-command envelopes, duplicated fixture labels and outside-temp/envelope qualifiers remain visible; not erased.

Parent owns acceptance, integration and all future admission; this review does not launch, accept or deploy anything.
