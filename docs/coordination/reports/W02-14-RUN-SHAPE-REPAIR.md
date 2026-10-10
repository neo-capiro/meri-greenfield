# W02-14 phase 7 RunShape launch-shape guard repair (Hermes source-only)

Base `280a2a222d4443a03e96c7cd3c17571fa4329163`; session `20261010_023359_6413e7`; branch `task/w02-native-enforcement`. Phase 7. Status: **SOURCE-ONLY, UNACCEPTED**. No gate advanced.

## Measured blocker (from phase 7 owner input, read-only)

`.task-inputs/W02-14-phase7-inputs/REPORT.md` (SHA `fdec544c…`) with `result-1.json` (SHA `dbb3cfa9…`) measured that the current `RunShape` admits `tasks:[{taskArn:[oneARN]}]` and `RetainRun` then sets `launchCertain:true`/`qualificationFailed:false`. Nested/five-ARN shapes flatten the direct/queue projection to 5 despite a top-level count of 1, because JSONata property traversal `$raw.tasks.taskArn` flattens nested arrays before any validation. The 32,768-byte raw-record bound passes for all shapes. Fresh ownership still rejects a foreign cluster; no StopTask bypass was demonstrated. Source remained UNACCEPTED despite prior source-only harness passes.

## Repair (owned source only)

`infra/native-enforcement/lib/workflow.mjs` — before `RetainRun`, an immediate-member typed predicate now requires EVERY immediate `$raw.tasks` element to be an object whose `taskArn` is a scalar string passing the existing reviewed exact task namespace test (`$count($filter($raw.tasks, $type($t)='object' and taskArnTest($t.taskArn))) = $count($raw.tasks)`). `direct` is projected with `$map` from those same validated immediate members, replacing the flattening `$raw.tasks.taskArn` path, so the eligible direct count is bounded by the immediate count. Retained unchanged: top-level `tasks` array type, `$count($raw.tasks)<=4`, failures-array check, raw byte bound, all containment/IAM/deadline structure, one dynamic `RunTask`, no Retry/Map/Parallel. Empty `tasks` may still pass `RunShape`, but `RetainRun` then keeps `launchCertain:false`/`qualificationFailed:true`; malformed/incomplete/mixed results route to `LaunchUncertain`. No ARN truncation into success, no retry, no re-launch, no ownership/IAM broadening.

`scripts/test-native-enforcement.mjs` — the permanent exported synthetic fixture set `runShapeFixtures(pins)` (16 cases) was kept. The one-line implementation-mirroring canonical test added during the stopped session was REMOVED; all original canonical cases are unchanged.

`scripts/test-native-run-shape.mjs` — NEW focused qualification test (owner-approved scope extension). Promoted from the checked private `h7-runsense.mjs` with candidate imports resolved relative to `import.meta.url` (no hardcoded worktree/root/session) and explicit CLI args `<jsonata.js> <fresh-output.json>`; it verifies the retained runtime SHA before `require` and writes one `wx` capture with no other IO. It evaluates only the actual candidate `RunShape`/`RetainRun`/`LaunchUncertain`/`StartScan` expressions — no copied JS validator.

`infra/native-enforcement/README.md` — appended a short phase 7 candidate/test-invocation/limits note.

## Exact owned source (recomputed after repair)

| path | bytes | sha256 |
| --- | ---: | --- |
| `infra/native-enforcement/lib/workflow.mjs` | 23805 | `4dfca118e7ea7c5f59ff684f9a9301fbd8e96cccb9eaf6b187403fb7b5ecdc19` |
| `scripts/test-native-run-shape.mjs` | 8884 | `9a1fbbe47131765fe38055f5e21ba0fc49b77de09d3df15e849f6635bd3286be` |
| `scripts/test-native-enforcement.mjs` | 21460 | `d294a9635f8ad17c6c73071e106dd95ae17bd732115d9fb18022348f7ff5978e` |
| `infra/native-enforcement/README.md` | 16300 | `9d99625df554cf55a37b6746528405935dc788a46a45bd507de43c27331ee250` |

Prior owner/source/report evidence is preserved unchanged; the phase 7 input `REPORT.md` and `BOUND-PROOF.md` remain read-only conditional support.

## Actual commands, exits and counts

1. `node --check` on `workflow.mjs`, `test-native-enforcement.mjs`, `test-native-run-shape.mjs` — exit 0 (three OK).
2. `node scripts/test-native-run-shape.mjs C:/dev/main/meri-greenfield-kickoff-20261009/.task-inputs/jsonata-2.0.6-runtime/jsonata.js .task-inputs/W02-14-hermes-repair-7/h7-promoted-run-shape-result.json` — exit 0, ~0.27s (<=120s), 81 expression evaluations. Runtime SHA verified `8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b`. Private capture SHA `7475866de138b03b8c69dc0e23a7ae780f7fc36cabff43337e97b18729946c72`.
3. `git diff --check` — no whitespace errors.

Earlier claims qualified: the stopped session's "canonical 48" is an author-reported capture only; after removing the mirror test the original canonical set is 47 cases and was NOT replayed this session. The private 16 fixtures are 2 valid + 13 malformed + 1 empty (NOT 14 malformed). The earlier private harness recorded the empty-tasks disposition and overflow net pins but did not explicitly assert them; the promoted test now asserts both.

## Coverage (promoted test, exit 0)

2 valid controls: `valid-one-scalar-object` -> `RetainRun`, `launchCertain:true`, `qualificationFailed:false`, direct 1; `valid-four-scalar-objects` -> `RetainRun`, direct 4, `launchCertain:false`/`qualificationFailed:true` (`count!=1`). 13 malformed/foreign/oversized/wrong-type shapes (`malformed-singleton-arn-array`, `malformed-multiple-arn-array`, `malformed-nested-task-records`, `malformed-mixed-immediate`, `primitive-task-member`, `null-task-member`, `missing-taskarn`, `numeric-taskarn`, `object-taskarn`, `foreign-namespace-arn`, `malformed-namespace-arn`, `tasks-wrong-type`, `tasks-too-many`) all route `LaunchUncertain` with `launchCertain:false`/`qualificationFailed:true` after the actual uncertain assign. 1 `empty-tasks-uncertain` passes `RunShape` but its disposition stays `launchCertain:false`/`qualificationFailed:true`. Every case preserves `attemptConsumed:true`, the seeded owned and overflow `netId`/`netIp` pins and `stopAttempted:true`; `StartScan` stays reachable and, on the uncertain route, its queue still contains the original positive ledgers (independent discovery). The exact phase-7 fail-open (singleton ARN array yielding `launchCertain:true`) is closed.

## Limits and open evidence

This is a selected-expression synthetic-fixture qualification test only. It does not exercise GuardInput, complete Step Functions execution, AWS wire/serialization, IAM/tag propagation, outages, ENI lifecycle, deadline behaviour, StopTask or STOPPED confirmation, and it establishes no acceptance. `Fixture` compilation stays `runtimeEnabled:false`. The copied `BOUND-PROOF.md` bound is conditional arithmetic support from `280a` and is not acceptance; the stricter guard restores direct `<=4`, but the new source hash requires its own distinct exact-commit owner review and delta verification. Still open: whole-variable/fallback proof, service/IAM/transport survival, terminal/physical cleanup, distinct exact-commit review and primary/service replay. No native/AWS/network/Docker/model/build/install/deploy/push/amend/shared/current-Meri/cutover/security-waiver action occurred. 49 findings (22 severe) remain OPEN, Office DEFERRED, G1 OPEN, paid Bedrock 0. This candidate remains SOURCE-ONLY UNACCEPTED pending a NEW exact commit, distinct actual review and primary/service validation.
