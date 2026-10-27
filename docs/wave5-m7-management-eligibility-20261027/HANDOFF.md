# W5-M7-02 — routine management after an image change

An already-issued exact native session can list its routines and explicitly approve pausing or deleting future firings when its persisted run has a different image digest from the current runtime. Creation, update and cancellation of current work still require the configured image. This is the image-change portion of MR-03, following W5-M7-01; it does not complete MR-03.

## Ownership and source

- Author: Wave 5 M7 subagent; allocation and checkout retention owner: Wave 5 orchestrator. Hermes owns independent review and deployed acceptance. Existing root/Release owns integration and target operations.
- New isolated checkout: this chat's `work/m7-management-eligibility`; branch `codex/wave5-m7-management-eligibility-20261027`.
- Base: Meri main `337e54b3ad92bd80eb65eefc72b4245c4f9ff50d`, tree `d631bdf6a3d1b22e6a0a6fa4e30018f49e65f481`, including merged PR296.
- Prerequisite: clean cherry-pick `496fb270fe43595218f6ff2abb1561fc7a6ea20b` of PR295 source `b61d69426a14e323f5f025ad0238a39a1edd27c5`. The original PR295 branch and checkout remain unchanged.
- Parent-supplied read-only dependencies: frontend `d0a5707eedf269ae7294b45b33ee2e75833d336a`; Core `c5b99db7238a5e29600e5c976806b0d1d1802f6d`. No frontend or Core change is included.

## Implementation and boundaries

The existing canonical schedule validator identifies list or `cancel_scheduled_task` with `running=leave` and no selected running work. For a persisted run only, this management path validates the historical `RuntimeVersions` shape and permits its image digest while requiring all other configured versions to match. SDK, CLI, contracts, skills digest and checkpoint format still match exactly. Initial bindings and execution operations retain their original version checks.

The authenticated identity, General/client scope, current unreserved exact head, policy revision and fresh Core policy, schedule ownership/generation, retention, explicit approval and replay owners remain in place. Future firings stopped and current work physically retired remain distinct; the successful pause/delete receipts do not claim physical stop.

Only `apps/runtime/native-authority/routines-owner-composition.mjs`, its adjacent test, `apps/runtime/test/native-schedule-intents.test.mjs` and this handoff changed. No contracts, generated artifacts, catalog, locks, configuration or framework changed. No existing owner was replaced. The local eligibility variable was renamed from `terminalManagement` to `managementOnly` to reflect its image-change use; no old executable reference remains. Six tests were added, and the former blanket image-mismatch assertion was replaced by positive management and negative execution/version tests. No temporary diagnostics remain.

## Verification

Author evidence collected 27 October 2026 around 15:06 UTC. Node `v24.22.1`; reused pinned dependencies match current locks: AJV `8.20.0`, canonicalize `5.1.0`, Temporal client `1.24.0`, AI SDK `7.0.137`, Temporal polyfill `0.5.1`. Ignored junctions in this checkout reuse existing caches; no installation or cache mutation occurred. The application contracts link points to this checkout's current contracts `0.1.21`. The ui-stream lock change inherited from main changes package/contract metadata, not the reused AI SDK version.

Command: `node --experimental-test-module-mocks --test --test-concurrency=1 apps/runtime/native-authority/test/routines-owner-composition.test.mjs apps/runtime/test/native-schedule-intents.test.mjs` — **31 passed, 0 failed, 0 skipped**, exit 0.

The existing real public Fetch routes, opaque session/context, intent journal and schedule owners are exercised with scripted Core/SQL boundaries and the Temporal client/protobuf codec. Positive cases cover client/General list and completed/failed/cancelled exact sessions after an image change; public prepare/approve pause and delete remain explicit, with one provider effect on ACK replay. Negative cases retain execution eligibility, all other versions, malformed image rejection, current policy/owner/head, retention/revocation and stale generation.

With the new positive tests and untouched prerequisite implementation, five selected tests failed as expected, exit 1; the public list cases returned `503 ROUTINES_CONTEXT_UNAVAILABLE`. Pattern: `survives a changed image|and a changed image`. A mutation applying the relaxed image comparison to execution operations was killed by the focused `changed image does not enable` test: create preparation unexpectedly returned 200, exit 1. Source was restored byte-for-byte. `git diff --check` passed.

Private author logs: `work/m7-image-base-witness.txt`, `work/m7-image-focused-tests.txt`, `work/m7-image-mutation.txt`. No broad suite, build, database gate, live Temporal action, paid model call, browser exercise, target change or formal acceptance was run or claimed. Dependency junctions are retained with the isolated checkout for review.

## Remaining limits and next owner

Model-policy/budget requirements are unchanged. `apps/control/schedules/runtime-context.mjs` requires positive execution limits at construction even for list/cancel; removing that dependency safely requires its shared owner. The native owner still reads current valid tenant model settings, requires positive `maxBudgetMicroUsd`, and refuses drift within an operation. `readModelPolicy` does not query monthly spend; cap consumption is checked on model admission. These results do not demonstrate a cap-exhaustion failure or recovery.

Fresh-page/restart bootstrap and successor selection were not changed or newly qualified. W5-M7-01 recorded that frontend routine bootstrap can select the generic successor path rather than the existing exact run; current continuation/bootstrap work remains with its owner. Other version changes still refuse management. Stop, firing, consent, runtime cleanup, artifact restore and Research Portfolio remain outside this allocation.

Next: parent coordinates Hermes review at the exact committed source, then integration and eventual deployed acceptance through the existing owners. This source result does not close Wave 4, MR-03, or the remaining M7 requirements.
