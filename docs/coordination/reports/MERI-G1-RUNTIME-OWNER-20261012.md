# Runtime-owner discovery — 12 October 2026

Read-only discovery at `1e6d430cf9c239caca4198aea42a762f13021cd5` identifies `apps/control/qualification-sdk-fixture/service/control.mjs` as the useful existing integration point. Its owner-visible registry admits/replaces runs and its tracked handlers serve the four private operations. `close()` closes ingress, waits on `Promise.allSettled`, then releases the object client. It does not call `revokeRun`; a settled rejected handler disappears from the in-flight set, and the all-settled results are discarded. Thus the control owner has no preserved source status for a settled `CommitUncertain` and no automatic durable grant revocation on close. These are source findings, not observed live authority leakage.

`FixtureRegistry.revokeRun` is consumed only by tests at this base. There is no non-test caller of `createFixtureControl`, `createNativeEvidenceOwner` or `runInterruptionPhase`. The native evidence owner binds observer/signing/publication for one phase; it is not a run lifecycle owner. The phase driver owns its Query/native child cleanup and explicitly requires a separate owner to stop A before fresh B. Its stale challenge adapter keeps A's credential outside B and does not own task admission or teardown.

`apps/control/qualification-temporal/workflow.ts` and `activities.ts` explicitly remain inert compatibility fixtures: deterministic stage/continuation examples and heartbeat/echo activities, with no registry, SDK task broker or cancellation activity integration. Wiring qualification registry effects into that demonstration would invent a production path. Current owner integration must accurately remain source preparation pending a separately qualified runtime broker/Temporal activity.

The proposed bounded owner stop API and unresolved shutdown breadth are recorded in the task brief and sent to root for allocation. No production source was edited and no database, listener, process/native SDK, model or provider was started. Baseline tests are not claimed: discovery used reads and exact call-site searches only. Independent reviewer corroborated the missing caller and discarded uncertainty behavior. No runtime gate is accepted.

## Implemented owner integration

Root allocated the explicit per-run stop scope. `service/control.mjs` now consumes
new `service/run-stop.mjs` directly for handler admission/tracking, stop/status,
and shutdown. `stopRun({context,peer})` closes the exact full-binding gate and
cancels matching request-context/authenticated-peer signals synchronously, then
invokes the original FixtureRegistry.revokeRun once. The existing raw registry
API is preserved; no owner facade or automatic close-all revocation exists.
Status is exactly the frozen four-field interface recorded in the task brief.
No contracts, migrations, locks, budget/gateway source, native evidence owner,
phase driver or Temporal source changed.

Repeated stop calls, including synchronous reentry from an abort listener,
receive the reserved original promise. A timeout does not delete an issued
revocation; late completion updates its status, without retrying the attempt or
returning late success. Original cleanup time and a60-second ceiling bound
waiting. The local gate remains closed on failure. Current registry identity
checks remain canonical. Unknown publication/revocation stays owner-visible
instead of disappearing when handlers settle; close refuses clean client release
while unresolved liability remains. The owner must explicitly stop each admitted
run; there is no enumeration, restart recovery or uncertainty-clearing API in
this slice. Raw registry readback remains available for separately qualified
owner reconciliation.

## Verification and failures retained

Author first6 source controls PASS. Independent review reproduced an effectful
outer-input getter: parameter destructuring preceded snapshotting. Added author
controls also exposed reentrant abort listeners starting a second stop attempt.
The pre-repair run retained6 PASS/2 FAIL. Both entrypoints now snapshot and
validate the entire closed input before accessing its fields; the stop promise
is reserved before abort callbacks. Rerun8/8 PASS.

Final focused64/64 PASS: new owner8, preserved cancellation16, original handler6,
revocation6 and private fixture contract/wire28. Root244/244 PASS. Source/doc
whitespace PASS. Author owner tests exercise the actual control.stopRun→canonical
registry with a scripted PostgresStore transaction subclass, plus isolated local
tracking controls. HTTPS createServer is temporarily replaced with an inert
EventEmitter; listen is forbidden and no credential is generated/read. The
independent reviewer separately exercises actual control→ingress→handlers→registry
with scripted SQL and fake S3, preserving any harness/candidate failures separately.
Local dependency directories were copied from prior owned exact-lock installs
after byte comparisons; no dependency or lock updates occurred.

No PostgreSQL engine/connection, native SDK process, task, listener, credential,
cloud resource, provider/model/paid action or frontend/capirov2 change occurred.
All owned test commands were foreground and awaited. Source acceptance belongs
to independent review and root; database durability, real task revocation,
physical teardown, native recovery, deployed Temporal/broker wiring and G1 runtime
remain HOLD.
