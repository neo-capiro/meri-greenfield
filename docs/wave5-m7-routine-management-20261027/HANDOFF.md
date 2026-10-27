# W5-M7-01 — existing-session routine management

An already-issued native session now keeps routine list and explicitly approved future-only pause/delete available when its source run becomes failed or cancelled. Previously the native routine context refused these operations before reaching the persisted schedule owner. This is a finite MR-03 change, not full routine-management completion.

## Ownership and source

- Author: Wave 5 M7 subagent; allocation/cleanup owner: Wave 5 orchestrator.
- Repository/base: `neo-capiro/meri-greenfield`, main `d4c37cb06b3d845fbf1f94dbc083cf53ecc15bb7`.
- Branch: `codex/wave5-m7-routine-management-20261027`; isolated checkout: this chat's `work/m7-routine-management`.
- Read-only dependencies: frontend `050df52492a912be004877a857d4b2db13c60713`, backend `c5b99db7238a5e29600e5c976806b0d1d1802f6d`.
- Hermes owns independent exact-head review and later deployed acceptance. Existing root/Release owns integration, build, deployment and rollback. No target operation was performed.

## Implementation and boundaries

The existing native routine context uses the canonical schedule request validator to identify list or `cancel_scheduled_task` with `running=leave` and no running-work selectors. Only these operations may use a failed/cancelled source run. The existing session, current Core policy, exact current head, tenant/client scopes, image versions, model budget, schedule ownership/generation, retention and approval checks remain required. Creation/update and cancellation of running work keep their previous eligibility.

The runtime context, schedule journal, explicit approval and Temporal lifecycle remain their existing owners. No new mechanism, public contract, schema, catalog, migration, package, configuration or resource was introduced. No replacement owner was needed. The source change is in `apps/runtime/native-authority/routines-owner-composition.mjs`; affected tests are its adjacent owner test and `apps/runtime/test/native-schedule-intents.test.mjs`.

No executable owner or resource was replaced, so identifier/resource deletion is not applicable. The obsolete test expectations that failed/cancelled runs always refuse list were replaced by positive client/General list checks. Other refusal cases remain, an image mismatch assertion was added, and seven named tests were added overall. No temporary diagnostics remain.

## Verification

Node `v24.22.1`; borrowed pinned dependencies: Temporal client `1.24.0`, AJV `8.20.0`, canonicalize `5.1.0`, AI SDK `7.0.137`, Temporal polyfill `0.5.1`. Task-owned ignored junctions reuse existing caches without installing or changing shared dependencies; the app package junction points at this checkout's current contracts.

Command: `node --experimental-test-module-mocks --test --test-concurrency=1 apps/runtime/native-authority/test/routines-owner-composition.test.mjs apps/runtime/test/native-schedule-intents.test.mjs` — **25 passed, 0 failed, 0 skipped**, exit 0.

The route tests use actual opaque session/context, intent journal, schedule owner and public Fetch transport, with scripted Core/SQL edges and the real Temporal client/protobuf codec. They establish list, reviewed future pause/delete, unchanged physical-stop claim, one effect on ACK replay, and denial of create/update/current-work cancellation after failed/cancelled runs. Current owner/policy/head and stale generation negatives remain covered. These fixtures do not establish actual database, live Temporal, browser or deployment acceptance.

Failure witness: with the new positive tests and untouched base source, four selected tests failed as expected; the two public list cases returned `503 ROUTINES_CONTEXT_UNAVAILABLE`. After implementation all four pass. Mutation: removing the management-only condition from terminal eligibility caused both execution-denial tests to fail because creation preparation returned 200. The mutation was restored exactly. Private ordinary command logs are `work/m7-base-failure.txt`, `work/m7-focused-tests.txt`, and `work/m7-mutation.txt`. `git diff --check` passed. Initial dependency-resolution failures were corrected by read-only cache reuse before collecting the behavioral witness.

No build, image scan, database gate, shared target change, paid model call, live Temporal action, browser test or formal acceptance was run. They are not claimed. No new operational cleanup is necessary; task-owned dependency junctions are retained with this checkout for review.

## Remaining MR-03 boundary

The current frontend routine bootstrap passes conversation/client to the generic session issuer without an exact run selector. After a terminal conversation that owner can reserve a successor; fixing this requires coordination with the existing continuation/recovery owner. This patch deliberately does not change frontend bootstrap, successor selection, image/model-budget eligibility, Stop, firing or consent. Fresh-page/restart behavior, image changes and complete MR-03 acceptance remain open. Wave 4 and all Research Portfolio work retain Fable/root/Hermes ownership.
