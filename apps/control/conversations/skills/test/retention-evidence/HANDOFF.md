# Selected original output retention

Exact base `88b5c4453adfa53631417474829ee38137f0bee3`. Dedicated branch `codex/selected-output-retention-20261013`, worktree `/workspace/meri-selected-output-retention`. Owned product changes are new `skills/retention.mjs`, the canonical store's two-line journal composition, and centrally allocated `apps/control/conversations/migrations/0003_selected_outputs.sql`. New tests/evidence are in this namespace. Original source adapters, prepared compilers, skill assets, shared DTOs, native qualification DB pins and other migration owners remain unchanged.

The implementation proposal was sent before coding and approved by root. The conversation store owns its borrowed pool, locked transaction, run decoder and session/run facts. The selected-output journal owns immutable pending projection persistence in that same schema and transaction. The retention owner calls the actual existing compiler WeakMap guard, validates exact pending/spec/context/provenance/request/selection/input/SDK and compiler read pins, and privately brands admitted journal candidates. Direct journal calls cannot bypass that guard. The current configured output/session/resource owner retains all native authorization and approval duties. This code creates no grant, artifact, credentials, provider loop or competing store.

## Interfaces

`createPostgresConversationStore({pool}).selectedOutputs` is the co-located journal. Its `tx` and `rowRun` dependencies are private; the pool remains borrowed. The table permits one pending preparation per source run. Exact JSON replay returns the existing projection; changed preparation, source run, request, scopes or SDK ledger refuses. Retain requires the current source projection to be `running`, with no held control, and the exact conversation owner/request/skill/scopes and full binding. Load requires the source run to be `completed` with no held control; queued, starting, running, paused, approval-wait, failed and cancelled sources are unavailable. A completed source's old read grant and original context deadline do not become current output authority.

```js
const retention = createSelectedOutputRetention({
  journal: store.selectedOutputs,
  currentOutputAccess, // trusted, opaque-session-bound control owner
  now,
  maxRequestMs: 3000,
});
await retention.retain({pending: output, request: storedRequest, reads: sdkReceipts, signal});
const loaded = await retention.load({sourceBinding, preparationSha256, signal});
// Existing bridge keeps its original compiler admission first and can use:
const retainedSource = {admit: retention.admit, sourceCall: retention.sourceCall};
```

`load` returns `{prepared,pending,request,reads,pins,access}` after two canonical completed-run reads and fresh before/after current owner checks. Only that exact returned prepared object has this owner's private WeakMap brand. A clone or an object loaded by another owner cannot use it. `admitRetained`/`admit(prepared,context)` synchronously returns a guard accepting only exact `{request,context,baseVersionId}`. `sourceCall(prepared)` returns the exact stored deliver envelope `{prepared,binding,requestSha256,selectionSha256,inputSha256,preparationSha256,reads}`. Both check current load-access expiry, clock validity and complete prepared hash; neither accepts model-selected hashes or booleans. Original observed source context/deadline, skill pins, prose/manifest/catalog, selection/window, source proof and read data remain unchanged.

`currentOutputAccess` receives `{sourceBinding,preparationSha256,pins,sourceEvidence,reads,phase,deadlineMs,signal}`. The closed return shape is:

```text
sourceBinding, requestSha256, selectionSha256, inputSha256,
preparationSha256, artifactRequestSha256, sourceContextSha256,
compilerReadsSha256, readsSha256, sourceEvidenceSha256, sourceScopes,
outputBinding, outputContextSha256, outputScopes, policyRevision,
outputAllocationSha256, outputGrantId, approvalReceiptId,
sourceAccessReceiptId, sessionReceiptId, checkedAtMs, expiresAtMs
```

Every source pin matches the immutable journal. Output run/attempt/worker must be distinct and tenant/actor/conversation must match; scopes remain exact. Current policy, output context/allocation, grant, approval, source access and session selectors remain stable across both checks, with fresh timestamps and nonexpired access. The callback must actually verify current approved native output admission/session and recheck every exact source evidence/read resource identity, version, content hash and scope. UUIDs, hashes and data shapes alone are not authentication. No such native callback was executed here. Existing bridge sourceAccess effect/release checks remain separate and mandatory. Native owner diagnostics are mapped to a content-free access refusal.

The journal deliberately uses the existing canonical 2 MiB result/data ceiling and selected manifest's read-call ceiling. Oversized complete projections fail safely rather than truncating source data. `credential`, bearer/service secrets, opaque sessions and provider control data are refused. No new dependencies or native resources are allocated, and migration 0003 was not applied.

## Verification and remaining gates

Final combined local checks: **85/85 passed**, including 22 new retention controls and existing store/application/lifecycle cases. Tests exercise actual Commitments and Relationship compiler WeakMap guards, actual canonical conversation store/transaction/run decoder, JSON owner reconstruction/restart, exact immutable replay, concurrent retention, tamper, source state/hold barriers, changed request/skill/scopes, fresh output/session/resource denial, expired original source context with current output access, private/opaque data refusal, cancellation, parked access deadline, exact retained guard/sourceCall and unknown COMMIT reconciliation. PostgreSQL is a synthetic protocol fixture only; no native DB/server/cloud/model/auth network or artifact generation ran.

Initial 29/29 checks passed. Expanded suites first failed before loading on absent existing `@js-temporal/polyfill`, then `ai`, then `@temporalio/client`; all raw failures are retained. Existing pinned dependencies 0.5.1, 7.0.137 and 1.24.0 were borrowed through owned links for verification, without install or donor modification. The final check passed once the intended existing package dependencies were exposed. All capture receipts report owned process groups absent. Borrowed links are removed on completion; old failures and evidence remain intact.

Root service/publisher integration, output bridge integration, independently verified native current output/session/resource/approval ports, real PostgreSQL migration/durability/concurrency/transport retirement, qualified original source admission and actual protected artifact release remain unverified gates. The local fixture does not establish native authorization, live durability or deployment acceptance.
