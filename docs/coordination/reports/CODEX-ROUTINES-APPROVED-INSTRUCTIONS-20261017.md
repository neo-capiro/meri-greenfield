# Routines instruction custody — task 6

## Implementation outline

Base: published combined task/preferences PR117 `444ddc223b7a467cbb2771b6ecbc05e8153e3f97`, tree `a17c4770ef289ec0da99ec10a09dfdb58f23992d` (local equivalent `1e0b0cba4f2c3845eb0df92c248896c0c3a12807`). Separate task-owned branch: `codex/meri-routines-approved-instructions-task6-20261017`.

The existing schedule owner retains the canonical acknowledged intent and instruction digest; the existing preparation journal retains the prepared proposal's instruction text. A bounded instruction reader will correlate these records for the current generation and recheck generation before returning `{instruction}` to the existing scheduled-dispatch port. It does not grant firing authority or treat PREPARED custody as approval. Original preparation release expiry is historical custody, never a renewed capability.

Proposed modules and ownership:

- `apps/control/schedules/approved-instructions.mjs` and its focused tests: task 6 owns exact schedule/proposal/hash correlation, deadline and cancellation behavior. Reuse canonical lifecycle/tool validators and operation lifetime; do not add a parallel schema or authorization system.
- `apps/control/intents/postgres-journal.mjs` and `apps/control/intents/test/prepared-schedule-reader.test.mjs`: Dot later allocated this lane the narrow canonical adapter extension against the verified current B source. Expose `readPreparedSchedule({tenantId,proposalId,intentSha256,signal})` through a separate reader factory. Preserve the existing closed `{claim,settle}` return interface: adding a method breaks `createIntentJournal`. Reuse the existing `meri_intents.preparations` table and borrowed-pool transaction owner. No parallel adapter or DDL/index/table allocation is proposed.
- `apps/control/intents/test/prepared-schedule-fixture.mjs`: a pure shared SQL double for the reader tests and actual existing-dispatch composition tests. It registers no tests or services. Production validation and transaction behavior remain in the canonical adapter.
- Report and existing smoke-discovery seam: task 6 records actual focused checks, source acceptance and remaining integration owners.

Verification will exercise exact current acknowledged generation/task/intent/projection/instruction correlations, malformed and ambiguous custody, tenant isolation, legitimate delegated preparation, generation changes during lookup, deadlines, cancellation and resource handling. SQL doubles supply source behavior evidence only; real PostgreSQL qualification remains separately held.

## Existing placement and unresolved integrations

The central allocation ledger at `082eb9f24b61c0813044fcf3a1b9a4cb41999a3c` already selects a separately supervised Temporal schedule worker in the control-service domain, never the HTTP thread. C has authored `apps/runtime/schedule-worker.mjs` and reserved `apps/control/schedules/migrations/0002_occurrences.sql` at `5aa13719e8706704785d142ad903fb42db51220e`. These are receiving/coordination dependencies; this task does not duplicate the worker, occurrence schema or modern first-chat CLI.

Required owner allocations remain genuine unattended original-owner firing authority; trusted schedule task/workflow/destination/effective-limit context; mutation approver-policy decisions; and actual-job overlap, cancellation, retry/budget and destination semantics. Existing run-bound gateway capability checks cannot authorize a future run before its admission.

The exact existing seams to allocate are:

| Existing owner seam | Required producer responsibility |
| --- | --- |
| `schedule-preparer.mjs` → `resolveContext({operation,request,deliveryId,signal})` | Trusted `{scheduleContext}` with current projection/generation, canonical intent identity, task/workflow and instruction resolution, destination, effective limits and caller identity. Prepare-only context retains `approval:null`; model arguments never supply these facts. |
| Schedule tool/lifecycle `authorize({phase,binding,signal,limitDeadline})` | Existing `{authorized:true,bindingSha256,callerIdentity,expiresAtMs}` receipt backed by current owner/delegation, scopes and actual schedule approver policy. Canonical approval digest/time validation alone does not decide who may approve. |
| `scheduled-dispatch.mjs` → `authority.authorize({phase,occurrence,occurrenceKey,projection,signal,limitDeadline})` | Original-owner policy checks at `before_admission` and `before_start`, returning the existing exact denial or `{authorized:true,occurrenceKey,owner,scopes,checkedAtMs,expiresAtMs}`. This producer must work before the new run exists; an old initiating gateway token is insufficient. |
| Existing conversation/Temporal actual-job integration (P-R4-3) | Enforce issued-run overlap, cancellation, budget/runtime/retry limits and destination semantics against the actual work, beyond the already retained dispatch occurrence barrier. |

Storage for instruction custody is completed by this increment. Existing C worker/occurrence0002 receiving, the producers above and any real qualification remain separate; there is no new schema or subsystem allocation request.

No worker activation, provisioning, credential work, SQL execution, deployment or Core edits are authorized by this increment. The repaired disposable PG retry and exact Core memory parser publication remain held for their pending approvals.

## Coordination readback

The current B journal pin is `cf639d4707df0060524218c65d941834ed7ea2e3`, blob `9270882c925144f672476fb0b6f881425e6b26ec`, identical to the combined base. B's thread is `01a14242-1d17-77a6-aad8-34c9c6ebe0c4`; C's thread is `01a14241-cbba-7531-9aba-71299cd430d7`. Direct ownership requests and the parent relay both returned `invalid turn/start params: AbsolutePathBuf deserialized without a base path` before delivery. Dot then explicitly allocated the narrow journal source extension and tests to this lane; the old B/C sessions are no longer a dependency for this limited source change. A fresh branch read before editing confirmed B's current upstream still equals `cf639d4707df0060524218c65d941834ed7ea2e3`. Coordinated receiving of C's worker/schema remains separate; no alternate adapter or transport retry is attempted.

The exact C worker and its tests were read and independently hash-verified from `5aa13719e8706704785d142ad903fb42db51220e`: worker blob `b0e114cac3af3b9c1ab2b7fb26e2d2e7431fda38`, test blob `9ef13c9dbe802b66954317c771edda51f9bf5ab6`. `assembleScheduleDispatch` already accepts `taskInstructions`, so this bridge needs no worker/CLI change. The intended later composition is canonical B read facet → approved instruction reader → existing C `assembleScheduleDispatch` with genuine authority → existing supervised worker. This increment does not claim that composition is mounted.

The existing `control-schedules` smoke suite discovers `apps/control/schedules/test/*.test.mjs`; the new focused test is included automatically. No discovery file edit or dependency install is needed.

## Custody and failure boundaries

`createPostgresPreparedScheduleReader({pool})` is inert and borrows the existing pool. It selects by tenant and proposal ID with `LIMIT 2` before state, operation or digest checks, so a second same-ID record cannot disappear behind a narrower filter. Only a committed, confirmed empty read returns `null`; malformed custody, ambiguity, lost COMMIT acknowledgment or cleanup failure withholds the result. Read-only work uses the canonical bounded transaction helper and checks cancellation again after COMMIT. No pool is ended and no SQL mutation is issued by the reader.

`createApprovedScheduleInstructions({scheduleOwner,preparations,now,maxRequestMs})` validates the exact ACKNOWLEDGED generation, active projection, task, complete intent digest, retained proposal/policy and instruction digest, then rereads the current generation before returning only `{instruction}`. It snapshots inert input and output and sanitizes failures. PREPARED alone cannot supply approval. The proposal scopes must be covered by the original release's full scope hashes, including their historical policy revisions; legitimate broader historical grants, delegated preparation and expired historical release custody are preserved. Current firing policy and expiry still come from the existing separate authority port.

The source-only composition tests traverse actual journal claim/settle → canonical reader facet → instruction bridge → existing schedule/conversation owners and Temporal dispatcher over explicitly scripted SQL/Temporal boundaries. They verify retained text reaches the saved request, while absent, corrupt or uncertain custody admits and starts nothing. They do not qualify real PostgreSQL, Temporal, native authority or a deployed routine.

## Focused checks and remaining baseline failure

Explicit bundled Node24 checks:

- New canonical reader and instruction bridge: **100/100 PASS** (41 reader cases, 59 bridge/composition cases), no skips or cancellations.
- Existing schedule dispatch and occurrence barrier: **21/21 PASS**.
- Existing intent PostgreSQL journal and result release: **21/21 PASS**; the original two-method store remains compatible.
- All five authored/changed JavaScript modules pass syntax checks; staged whitespace checks pass. Existing suite globs include the two new test files without a discovery edit.

During development, an initial bridge test run passed 52/55 because the test referenced a dispatcher the existing harness does not export. The test now constructs the canonical dispatcher. An initial reader run passed 41/47: six corrupt-custody cases were withheld but classified as unavailable; the new reader decoder now consistently classifies malformed retained state as UNKNOWN. These failures and the subsequent focused reruns remain in local nonsecret evidence. Review also corrected prototype rejection and preserved canonical full-scope subset custody semantics.

A broader preparer check remains **0/7 FAIL, baseline**: `apps/control/intents/test/schedule-preparer.test.mjs` receives clock `1900000000000`, while the default test authority in `apps/control/intents/test/fixture.mjs` derives expiry `1791835260000` from the command fixture's 2026 clock. The production release guard correctly rejects it as expired before preparation. The same seven ACCESS_DENIED failures were reproduced on untouched task-owned source `be5c5b9392c8ee5afda3eeea41982a1385e264b2`; the preparer test blob `f945d74681d52d9a69740aab6f8f885effb3102f` and release guard blob `5a821974905ef996d3a2686b8d3dce46c462454a` match both roots. An independent source trace confirmed the fixture mismatch and that this memory-journal test path never uses the new reader. The future test-only repair is to derive both checkedAtMs and expiry from one injected `now()` sample. This increment leaves that shared fixture and all seven assertions unchanged; the failure remains visible rather than weakening production expiry checks.

Runtime routine activation remains HOLD on the genuine trusted context/mutation/firing authority and actual-job owners described above, plus coordinated receiving of C's existing worker/schema. Real PG/Temporal behavior is unqualified. The separate disposable preference PG retry is pending specific execution approval after the earlier diagnostic retry was denied before execution; the exact Core memory parser branch publication was also denied before execution and remains pending its producing owner's approval. No retry or alternate publication is performed here.

Independent Codex source review: **ACCEPT**. The reviewer checked the complete implementation and test diff and independently passed all 100 new cases plus 21 existing journal/release regressions, including cancellation of retained and absent reads at SELECT, COMMIT and release. The root's separate existing dispatch/barrier check passed 21 cases. All five code/test files match their frozen hashes; the final instruction bridge is `9ed473a07e3657703e17d1d561da74695fe43b9cfb377d24766bfab6ee35194c`, canonical journal adapter `e02a77443fb1266c77b2e1aa5806c9596b8879d311349344fb7582092c598509`. The unrelated seven preparer baseline failures and all runtime holds above remain visible. This is reviewed source acceptance only.
