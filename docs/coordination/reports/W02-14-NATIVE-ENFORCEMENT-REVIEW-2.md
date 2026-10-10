# W02-14 native enforcement — distinct actual review 2

**Verdict: SOURCE_PREPARATION_REPAIR_VERIFIED_AT_SOURCE_LEVEL (reviewer 2), with one LOW fail-closed gap and two INFO observations. This is NOT native/security/service acceptance and promotes no gate. G1 stays OPEN; no admission.**

Reviewer: distinct actual Hermes session `20261010_012844_ba1b1c` (not author `20261010_001742_5efe2a`, not prior reviewer `20261010_010457_186e99`).
Worktree `C:/dev/main/meri-greenfield-worktrees/w02-native-enforcement-review-2`, branch `review/w02-native-enforcement-2`.
Exact base `c0623278707b033beec8e4e4640324d0fb3df9a1`. `git rev-parse HEAD` == base; worktree clean at start.

## Subject pins (independently recomputed)

- `git hash-object <file>` == `git rev-parse HEAD:<file>` for all nine candidate paths — raw working-tree bytes are byte-identical to the exact base commit. No source/test/README/prior-report/contract/dependency was edited.
- Retained runtime `C:/dev/main/meri-greenfield-kickoff-20261009/.task-inputs/jsonata-2.0.6-runtime/jsonata.js` SHA256 `8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b` (hash asserted in-harness before use).
- Root closed manifest `.task-inputs/W02-14-owner-candidate-snapshot-4/manifest.json` SHA256 `0233676faeabb3c33d217ca9d5ca921d72217e6dbe3653e4e52cfd742206c567` (matches brief); repair-4 input manifest `.task-inputs/W02-14-repair-4-inputs/manifest.json` recomputes exactly.
- Actual cached task-definition payloads (raw bytes, not re-serialized): SDK SHA256 `40f6b4a70ebf9558dbcb724ab969a332104b85bf97cf181490308f524597f0a0`, Office `355b1beb670a1364ea5d1f53c53042113f09a39bfe274b6406a5d3a9315f598b` (both match brief). Author private evidence in `.task-inputs/W02-14-author-phase4/` preserved unchanged: `traces.mjs` `9cc3722570e17341ad049053cad29d6c411fb6000e307b2c94ffb0522f86a366`, `traces-final.json` `e1fc31cdf6fbdf96c02e73b52e0ce04f87e2807b2ce9bbb55c4d62ea3fd79d88`, `check.mjs` `d7f6adfb8023cff710511f8ff26cbda1b503a695fefdc2509d79a45ee1ec4956`.

| path | SHA256 | bytes | gitBlob |
|---|---|---|---|
| infra/native-enforcement/app.mjs | 813a912999253b147d3d88ac50d24fbe7dd063aa98c3453a9e5e825d3fe7f70c | 422 | 09fc6209010693ca0bb315e0c80d79058bb23dcf |
| infra/native-enforcement/lib/binding.mjs | a14cea09763f44cd727857b2031700b4cadc9f9b53ba049e3b0ba237207db007 | 7772 | aa6f90e2b772bc82cdbecb462164028fde580b18 |
| infra/native-enforcement/lib/expressions.mjs | bdb6cd531774b2b27283e71cc79734f52dbf07de742f18194cef6a83ebccc91b | 10875 | 34ab645f3ae8e570d56e3bc2495c0d5a026b7846 |
| infra/native-enforcement/lib/workflow.mjs | 3f90a7a4bdfcb0795eb63af3b0a85cceb8589e08b34fbe0ba164340a9bdd6b47 | 22577 | 2ce3c8222112039225dcae2d99b64ca0d4f08cd8 |
| infra/native-enforcement/lib/infrastructure.mjs | 6e57537dfbb675a8bc7673e26185cd4df0f769637ac3b783c4cca02681b95ae0 | 3625 | 40a9e812f818fbbfc25b0e267c8c2fafe6ff4fda |
| infra/native-enforcement/lib/task-definition.mjs | 8348de2677c32423461319d51e303faaf688c5deb0441248953695b59d1447cf | 6728 | a7d9f0e31f9200f17cac01ec420fdaa3dd1eae6e |
| infra/native-enforcement/README.md | dcbf72265b632a253af044b61941b1d70940b42059d494c9d6651587aebca6be | 13652 | f4bc0d26914db9f71591aa146ae69d4f7f9b6569 |
| scripts/test-native-enforcement.mjs | 1ca0d5efd3f41d2431c9e3cda7124a90b3138f77b40691a8d66deb9ab0ece857 | 17311 | 97d3752d2b170fe148dd9f7b8f168806bad0ba04 |
| docs/coordination/reports/W02-14-NATIVE-ENFORCEMENT.md | 94cf45aa60dfffe83240afc2df470fecc184bd926a333a888f6ef410fccc100a | 9382 | 9cda17ba28d87d96c0c818bfdc7d716b305b7b3c |

All nine SHA256 match the author report's "fixed source bytes" table. **6 of 9 paths changed** across `234a08e..c062327`: `lib/binding.mjs` (delegates record validation to the new module), `lib/expressions.mjs` (three-way classifier), `lib/task-definition.mjs` (new), `scripts/test-native-enforcement.mjs` (+3 tests), `README.md`, report. `app.mjs`, `lib/workflow.mjs`, `lib/infrastructure.mjs` are byte-unchanged from `234a08e`. Nothing was rewritten; rejected `e6207d7`, partial `b734521`, phase-3 `032c92b` and closed `234a08e` remain in history.

## Checks actually run (local only; commands, exit, counts)

| command | result |
|---|---|
| `node --check` on app.mjs, lib/binding.mjs, lib/expressions.mjs, lib/workflow.mjs, lib/infrastructure.mjs, lib/task-definition.mjs, scripts/test-native-enforcement.mjs | all OK, exit 0 |
| `node --test scripts/test-native-enforcement.mjs` | **34 pass / 0 fail**, exit 0 (~0.35 s) — matches author `canonical-final.out` |
| author harness `W02-14-author-phase4/traces.mjs` (copied, run on unchanged bytes) | **35/35 PASS**, exit 0; 293 expressions parsed, 0 syntax failures; 145 626 evaluations |
| owner harness `W02-14-repair-4-inputs/owner-traces-3.mjs` (copied, run on unchanged bytes) | **27/27 PASS**, exit 0; 293 parsed, 0 syntax failures; 128 405 evaluations |
| reviewer-own harness `.task-inputs/W02-14-review-2/review-harness.mjs` | **94/95 PASS**, exit 1 (single failure is a genuine candidate finding, below) |
| repo-declared `npm run check` | NOT replayed — preserved pre-existing `ERR_MODULE_NOT_FOUND: 'ajv'` environment blocker (retained `npm-check.out`); the native suite is not in its scope. No install. |

The owner's own 27-case harness produced **25 PASS / 2 FAIL** on rejected `234a08e`; on exact `c062327` the same unchanged harness is **27/27 PASS** — the two measured nested-detail cases are repaired. `$(eval|parse|hash|partition)` do not appear in generated sources; importing the canonical test exposes only `{fixturePins, expressionEntries}` with no test side effects (guard `test-native-enforcement.mjs:16`). No AWS/network/native-SDK/Office/browser/Docker/provider/install/deploy/push/amend occurred. Reviewer evidence retained under ignored `.task-inputs/W02-14-review-2/` (private, not committed).

## Independent evaluation — attachment classification (FIX1)

I evaluated the ACTUAL generated classifier predicates (`buildPredicates` from `lib/expressions.mjs`, JSONata 2.0.6) directly against an 19-shape matrix, requiring exactly one of compatible/pending/absent/contradictory to hold. **19/19 PASS.** Compatible: valid ENI `ATTACHED`; valid ENI plus an extra `macAddress` detail (must not fail). Pending: `CREATED` with well-typed details; `ATTACHING` with empty details; teardown `DETACHED` with empty details. Absent: empty array. Contradictory: `CREATED` with a mismatched `subnetId` (pending status must NOT hide a present wrong subnet); `ATTACHED` with empty details; `details:'malformed'` (string); a nested entry that is not an object; a nested entry with a non-string `value`; duplicate detail names; conflicting detail names; `ATTACHED` wrong subnet; two ENI attachments; an extra unsupported non-ENI attachment; a non-array outer `attachments`; ENI-plus-ServiceConnect.

End-to-end (reviewer-own compact interpreter over the real ASL, synthetic post-admission state, JSONata 2.0.6): **12/12 PASS.** My cases confirm the two owner-measured failures are now sticky `qualification FAILED` with a valid frame both before and after the bad frame and terminal confirmation still reached, while the positive identity is retained and receives exactly one scoped stop attempt: `own-badEntryType-after-valid`, `own-dupNames-after-valid`, `own-conflictNi-after-valid`, `own-dupEni-after-valid`, `own-extraUnsupported-after-valid`, `own-pendingWrongSubnet-not-hidden`, `owner-malformedDetails-after-valid`, `owner-emptyAttachedDetails-after-valid` → all `STOPPED_CONFIRMED` + `FAILED` + ≥1 stop. `own-mac-tolerated` and `own-pendingOk-reconciles` → `RUNTIME_CHECKS_ONLY_NOT_NATIVE_ACCEPTED` (no false contradiction). No foreign ARN was stopped (`baseline-foreign-always-unknown` → `CLEANUP_UNKNOWN`, `foreignStop=false`). My interpreter reproduces the retained baseline outcomes (`baseline-single` → `STOPPED_CONFIRMED`/`RUNTIME_CHECKS_ONLY`).

## Independent evaluation — task-definition validation (FIX2)

The actual cached SDK:1 / Office:1 records compile with OTHER clearly-synthetic authority and `runtimeEnabled` stays `false` (payload SHA256 re-verified). Reviewer matrix **41/42 PASS** against the actual records, raw bytes parsed once and not lossy-normalized:

- both raw records validate; environment/volume/mountPoint reorderings validate (unique-name keyed sets); ordered `command`/`entryPoint` do NOT permute (reordered/extra rejected); duplicate env/volume keys rejected; wrong types and null rejected; non-empty defaults rejected (capabilities.add, devices, secrets, portMappings, dnsServers, dockerLabels, logConfiguration.secretOptions); unknown fields rejected at task level, container level, `linuxParameters`, `capabilities`, `logConfiguration`, `logConfiguration.options`; `requiresAttributes` nested entries must be objects with a string `name`; critical drift rejected (executionRole, image, revision/ARN, `INACTIVE`, runtimePlatform, networkMode, mountPath, privileged, user, env value, capabilities.drop, two containers, `compatibilities` without FARGATE, non-empty placementConstraints).

**FINDING 1 (LOW) — unknown keys inside `ephemeralStorage` are not rejected.** `lib/task-definition.mjs:37` checks only `t.ephemeralStorage && t.ephemeralStorage.sizeInGiB===50`; unlike every other nested resource object it has no `keysOnly` guard, so `ephemeralStorage:{sizeInGiB:50, extra:true, arbitrary:1}` validates. Reproduced independently (`taskdef:unknown-ephemeralStorage-key-rejected` → "Missing expected exception"). Impact low (ECS `ephemeralStorage` exposes only `sizeInGiB`, so an extra key cannot change placement) but it is a gap in the stated fail-closed policy and in the brief's explicit "unknown fields at nested resource levels" requirement. Owner disposition; not a blocker to source-level verification. Note `runtimePlatform`, `volumes`, `mountPoints`, `environment`, `linuxParameters`, `capabilities`, `logConfiguration`/`options` and `requiresAttributes` entries ARE exact/typed-checked, so `ephemeralStorage` is the sole gap.

## Independent evaluation — byte bounds and guard

Reviewer-own negative controls (values injected, not natural fixtures):

- Task-result bound `($s:=$string($states.result);$length($s)*6<=recordBytes?…)`: oversized injected result → `null` (fails the next shape check closed); in-bound result kept. PASS.
- Catch error bound: oversized `$states.errorOutput` → `{truncated:true}`; small kept. PASS.
- Whole-context `commitCtx` fallback with an oversized injected `tokens` array (retained-variable accumulation): result serializes within `ctxBytes`, sets `overflowed`/`hold`/`qualificationFailed`, **preserves both the owned and overflow ledgers** and re-seeds `queue` from `ctx.direct`. PASS.
- Record-field `boundedExpr` with an oversized injected output → compact `{truncated:true}`. PASS.

The retained author harness measures every Pass/Task/Catch/final resolved Output and the merged persistent variables **before apply** across its 30 composed cases and reports maxima within `outputBytes`/`ctxBytes`; I reproduced those runs but did not independently re-instrument the whole-output proof. **Honest limit:** exhaustive finite-bound proof for the combined max-legal-refs/tokens/candidates/10-ledger/escaped-multibyte case is author-instrumented; my independent evidence is predicate-level plus the fallback/field controls above. No cap was raised, no assertion removed, no relabel.

**FINDING 2 (INFO) — the GuardInput positive branch is unreachable in source.** `workflow.mjs:37` builds the guard as `false and <context checks>` because `binding.runtimeEnabled` is the literal `false` for the inert binding; a synthetic admitted-shaped context still evaluates to boolean `false` (not an error). The author's false-only guard case cannot prove the positive branch; by construction it is unprovable without a source edit. Reported precisely, not as a defect.

**FINDING 3 (INFO) — any foreign/ambiguous candidate forces `CLEANUP_UNKNOWN`.** `workflow.mjs:81` (`ForeignOrAmbiguous` sets `hold`) combined with `FinalGate` (`workflow.mjs:126`, requires `$not($ctx.hold)`) means a single unrelated swept task in the cluster yields `CLEANUP_UNKNOWN` even when every positively-owned task is confidently STOPPED (reproduced). Conservative and honest — it blocks the next admission — but worth confirming as intended.

## Preserved behaviours confirmed

Single dynamic RunTask, no Retry/Map/Parallel, no universal finally; D=720 000 / C=900 000 from immutable t0, never reset; positive call timeouts clipped 1..30 s and Wait targets < C (interpreter-asserted); bounded 3-mode paged opaque-token discovery with cycle/oversize fail-closed; 4 owned + 6 overflow = 10 honest positive maximum, an 11th → `OverflowExhausted` sticky `hold`/`owned-capacity-exhausted` → `CLEANUP_UNKNOWN`; stop dispatch precedes round-robin `probeSeq` terminal confirmation, one scoped StopTask per exact ARN, acknowledgement ≠ STOPPED; exact ownership via namespace/cluster/definition/startedBy/group/all-tags/creation-window and container-exit terminal; `FinalUnknown` is a Succeed state with explicit `cleanup: CLEANUP_UNKNOWN`; StopTask IAM stays conditioned on the **current** `QualificationRun`/`MeriComponent` resource tags (no broadening; `infrastructure.mjs` unchanged). All confirmed by retained harnesses plus reviewer-own predicate/interpreter checks.

## Module boundary assessment (focused modules / no godfiles, no quotas imposed)

Cohesive and single-responsibility: `app.mjs` (5-line pure re-export); `binding.mjs` (static pins, admission/evidence ingress bounds, delegates record validation); `task-definition.mjs` (new 70-line, self-contained fail-closed record validator, imported by `binding.mjs` with no cycle); `expressions.mjs` (JSONata helpers, predicates, three-way classifier, compact projections, bounded write); `workflow.mjs` (finite Standard ASL graph, 130 lines); `infrastructure.mjs` (IAM role + Standard machine template, unchanged). Contracts are explicit (exported builders, `isCompiledBinding` guard, frozen binding). No framework or quota is imposed; the new module improves the separation the brief asked for. No `finally`, Retry, Map or Parallel.

## Limitations (unqualified; source-level only)

- Service result/payload/runtime failure can precede any user expression or Catch projection; local bounds and Catch paths cannot guarantee finally or physical cleanup under outage, payload/history limit, `StopExecution` or administrator intervention.
- AWS transport retries are not proven absent merely because the ASL has no Retry.
- Actual Step Functions ASL validation/TestState, wire casing/`Context`/state-entry fields, deadlines/error behaviour, IAM condition/key support and real tag propagation (incl. the current-tag StopTask condition), managed-service survival under controller kill, log/artifact reconstruction, physical cleanup, payload/history limits and native SDK/Office/browser probes remain unqualified live gates. Linux platformVersion 1.4.0's managed patch revision is not pinnable.
- The reviewer interpreter, the author harness and the owner harness are all synthetic post-admission state injection with synthetic AWS fixtures; none is an AWS service emulator and none establishes IAM or service acceptance.

## Status

- Source-level PASS within the reviewed scope: the two previously-measured owner failures (nested malformed `details`, `ATTACHED` empty `details`) are repaired and independently reproduced both at the predicate level and end-to-end; the actual SDK:1/Office:1 readbacks validate with `runtimeEnabled` false. One LOW fail-closed gap (`ephemeralStorage` unknown keys) and two INFO observations reported for owner disposition — none is a blocker to source-level verification.
- Service/live gates: NOT RUN. `SOURCE_PREPARATION` only — not native, security, G1 or release acceptance. Codex owner independently verifies and owns acceptance. Only this new report was added; no source/test/README/prior-report/contract/dependency edit, no AWS/network/native-SDK/Office/browser/Docker/provider/install/deploy/push/amend.
