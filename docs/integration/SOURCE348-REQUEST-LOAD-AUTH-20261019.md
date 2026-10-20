# Request-scoped runner load authorization repair — 2026-10-19

Base: `a16cc40d2a7ca3695eb6cc5a8d45440d0c40d040`. Dedicated branch: `repair/source348-request-load-auth-20261019`. This source repair preserves the a16 image/source and PR175. Fable's reported runner18 attempt `f5e465ba` ended with `RUNNER_RUNTIME_FAILED stage=activity-load code=DEADLINE`; that identifies the failed load deadline, not a particular Core request. Aggregate Core traffic is not per-attempt attribution.

## Implementation outline

The existing action-session owner remains the canonical owner of fresh identity, membership and selected run/client resolution. The worker HTTP boundary still checks the task capability before and after the service. The conversation service retains every load freshness and retention checkpoint, lifecycle journal verification and stored run/request comparison.

The owner gains an internal resolver that returns the existing authentication and hash-bound current-state receipts from one fresh canonical resolution. A module-private WeakMap associates the exact owner object with this resolver function; it retains no authority facts or receipts. This preserves the public owner shape required by the existing strict HTTP adapter. Only runner load opts into this resolver, once at each existing authentication/current-state pair. The ordinary public session methods and other conversation operations retain their existing paths. There is no authorization cache across checkpoints, requests, sessions or processes; a later checkpoint resolves authority again. The resolver preserves the owner's cancellation, expiry, revision, membership, revocation and receipt checks. No timeout changes are planned.

Owned production files are `apps/control/action-host/session/owner.mjs`, `apps/control/conversations/service.mjs` and `apps/runtime/worker-http.mjs`. Focused verification extends the existing load-amplification fixture and adds an owner-level atomic receipt test. No public wire contract, migration, frontend, deployment or image-build file changes are required.

## Source call graph before repair

| Checkpoint | Fixed-context Core calls | Dynamic-context Core calls |
| --- | ---: | ---: |
| Three worker task-authority verifications | 6 | 6 |
| Opaque session issuance | 5 | 6 |
| Worker authentication/current-state pair | 8 | 10 |
| Four service authentication/current-state pairs | 32 | 40 |
| Total | 51 | 62 |

Each pair performs the full session resolution twice with no intervening business work. Combining the two receipts at the five existing boundaries reduces the measured totals to 31 fixed and 37 dynamic calls. Every boundary still performs a new resolution; the final worker task-authority check remains independent. This removes source amplification implicated by the failed load stage, but does not establish the live latency of individual Core calls or database work.

## Verification plan

Verify exact fixed/dynamic counts and successful load at conservative per-route Core delays, with the same 23-second load ceiling. Retain failures for deadline/cancellation, parked Core/store completion, mid-journal membership/client/policy/tenant/request changes, retention suppression and ambiguous lineage. Add coverage for the private owner method's forged/revoked session, identity changes, expiry, cancellation, fresh revalidation on each invocation and unchanged public session behavior. Independently review the final diff before commit/push.

Static render grant expiry is audited separately from dynamic issued authority. Qualification evidence and any remaining limitations will be recorded below after checks complete. No AWS mutation, paid build, live SQL, credential read or new chat is part of this task.

## Static and dynamic expiry

The public C handoff at `5a42ec962677e70e76db5433330b52fd34db5bcd` records bundle expiry `2026-10-26T17:46:23Z` and a maximum run duration of 900 seconds. Its documented render command supplies no validity override. From the renderer's seven-day default validity and 900-second static grant window, the static deadline is inferred as `2026-10-19T18:01:23Z`, to the public timestamp's second precision. The actual rendered grant timestamp is not included in this public packet. The reported 18:13 rollout therefore follows the inferred static deadline.

This static deadline does not cap a different dynamic binding. `prepared-run-registry.mjs` selects the static path only for exact original-binding equality. Dynamic admission in `prepared-run-bindings.mjs` proposes `min(now + runWindowMs, schedule expiry)`, persists it in the initial-binding journal, and prepares against that saved expiry. It issues task/model credentials for that exact binding and replaces the runtime deadline and grant intents. Production `prepared-candidate.mjs` does not pass the optional static `maximumExpiresAtMs` ceiling used by a test helper. The public packet has no multi-run override, so its derived dynamic window is 900,000 ms and schedule expiry is the bundle expiry above.

Existing issued authority is never renewed by deployment: expired, revoked, absent or unknown issued material refuses. The live runner's actual admitted expiry is not available from the public packet. Its load is bounded by both the unchanged 23-second cap and its issued original lease's startup reserve; no attribution to static expiry is justified.

## Focused verification and limitations

Tests use Node 24.19.0 with existing local dependencies and the load fixture's explicit import-only stubs (`MERI_DIAGNOSTIC_IMPORT_STUBS=1`). The fixture composes the real worker HTTP boundary, native transport, canonical session owner, basic and lifecycle services. Task-verifier SQL/grant work and provider imports are substituted; it does not prove real database, pool, transport or deployed latency.

- The new atomic-owner cases and existing independent owner suite passed 46/46. The public owner shape and HTTP-adapter construction remain valid; ordinary authentication/current-state methods still resolve separately.
- The full load suite initially passed 36/36. Two added cases passed 2/2, then the exact count, legacy fallback and non-load publication subset passed 3/3 after restoring explicit no-write assertions for loads. All three task checks, two stored reads, one lifecycle read and four retention checks remain. Dynamic Core counts are now identity 10, context 15, membership 12.
- At 500 ms per Core reply, the repaired dynamic path completed in 18.551 seconds with 37 calls; the legacy paired path hit the same 23-second deadline in 23.002 seconds. No timeout was increased.
- One additional per-route latency case passed 1/1 in 18.234 seconds. It cycles `[mean, p95, mean, maximum, p95]` using the reported Core bounds: identity 119/193/579 ms, context 341/653/1,201 ms and membership 300/535/1,002 ms. Its 37 calls schedule 18.152 seconds of latency. This is a conservative tail-heavy stress profile, not a reconstructed live distribution or attribution of aggregate traffic to the failed run. The 500 ms and mixed cases retain 3 task checks, 4 retention checks, 2 stored reads, 1 lifecycle read and 0 writes.
- An independent adversarial subset passed 20/20, including forged/cross-session receipts, pending revocation/close, final-store identity/member/client/policy/retention changes and final worker task refusal. Independent review found no blocking issue in the isolated production change.
- The existing public session/HTTP suites passed 22/24. Two local graph query tests returned 502 after successful issuance; both reproduced on the unchanged baseline at `c46003b6b7912a154bad160d45f6bc448a1474ae`, whose relevant session/host paths are identical to a16. Those failures remain visible and were not repaired or weakened here. An initial invocation omitted the fixture-required `MERI_REVIEW_SOURCE_ROOT`; rerunning with the exact worktree exposed these two baseline failures.

## Shared-file integration gate

The parent reported a simultaneous session403 repair in `apps/control/action-host/session/owner.mjs`. This change had already refactored the ordinary authentication method, so further owner edits were frozen immediately. Its existing `remove(r); deny()` catches retain a16 semantics. The cancellation lane must be integrated into the renamed internal `authenticate(value, includeCurrent)` catch and the standalone `readCurrentState` catch. The new atomic-owner cancellation test currently retains the baseline session-removal expectation and must be reviewed against that fix.

This is an isolated source pin for coordinated integration. Combined owner behavior and its relevant tests must be reviewed before a build. The local app's parent-thread messaging call returned `thread not found`; the overlap and exact affected methods are therefore reported in the task handoff as a pending coordination dependency. No shared cancellation behavior was silently included.
