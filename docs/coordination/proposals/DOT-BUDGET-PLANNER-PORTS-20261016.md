# Proposed canonical bindings: budget, intent release and Planner

**HOLD / local proposals, not frozen contracts or deployment approval.** Base `eca78d458acb46cbfd54a94cf870841d999ef6b1`. Qualification coordinator `01a14243-40ec-7321-b8f4-1cf827a7f0c1` forwards decisions to parent. No SQL, migration ID, role, credential or frozen wire is allocated by this document.

## IR-1: canonical intent result-release owner

`createIntentMount` accepts a trusted `resultRelease` owner with one method:

```js
check({selection, selectionSha256, signal, limitDeadline})
// -> {authorized:true, selectionSha256, binding, scopes, checkedAtMs, expiresAtMs}
```

Closed selection:

```js
{
 binding,                       // current RunBinding supplied by trusted startup
 operation,                     // exact {id, version}
 deliveryId, argumentsSha256,    // original immutable preparation request
 original: null | {binding, scopes, expiresAtMs},
 resultSha256: null | sha256
}
```

Before preparation, `original` and `resultSha256` are null. The canonical owner must check the **current** caller/run authority and return the exact current scopes and original authority expiry. This receipt captures a ceiling; it is never a permission inferred from listing availability. The mount journals `{result, release:{binding,scopes,expiresAtMs}}` as one PREPARED outcome. After settlement and on every retained read, it invokes the owner again with the exact stored result hash and original authority. Checks bind the entire selection, current RunBinding and fresh timestamp. Scope release is the intersection of result scopes, original grant scopes and current scopes, including resource identity and policy revision. Original authority expiry and command proposal expiry can only narrow release.

The owner must reuse current canonical authorization; a callback that merely echoes the request is insufficient. The existing command metadata owner's `read` / `read_release` remains the canonical same-run command check. Cross-run result release requires the current authority owner to admit the immutable original result for the current actor/tenant/conversation and scopes. Schedule/document current-read owners must likewise be bound. No execution, approval or replacement proposal is allowed from this port.

Missing owner is UNAVAILABLE before any preparation. Retained pre-repair outcomes without an original authority receipt are withheld; there is no inferred expiry and no redispatch. A refused post-settlement release leaves PREPARED custody unchanged. The worker independently intersects result scopes with its validated current run scopes. These local shapes do not edit UIEvent, Run or `packages/contracts/**`.

**Parent decision needed:** accept this local owner seam and its canonical authorization adapter/composition. Subsequent central source allocation `641f298025c4c9f344d9d16f852cb6eb62b21906` reserves `apps/control/intents/migrations/0001_intent_preparations.sql` and the sole table `meri_intents.preparations`; exact intent DDL authoring/design release remains pending. The original unqualified P-INT-M1 proposal is preserved byte-for-byte. The existing JSON outcome can hold the receipt without a second table. A focused `postgres-journal.mjs` store adapter is proposed behind the existing journal; no intent SQL or startup mounting was authored. See [the bounded design](../reports/DOT-CANONICAL-INTENT-JOURNAL-20261016.md).

## BG-1: one product ledger

The retained Python proxy now supports only the closed trusted namespace values `qualification` (unchanged default) and `product` (`meri_product_budget`). Product configuration names `meri_product` or `meri_product_*`, preserving verified TLS requirements for non-loopback hosts. No HTTP/model input selects a namespace. All model reservation/settlement/admission queries use the same selected store, global lock, product grant rows and combined model/tool liability view. Product reservations require an installed per-run allocation. Qualification grant mutation helpers refuse product mode: native allocation admission remains the only product grant writer. Product mode cannot call qualification migration helpers.

`runtime/product.py:product_request_owners` binds existing ingress and ledger to one product store and independently observed `PeerLease`. It requires the retained AWS CountTokens origin; it performs no observation, credential issuance, TLS setup, listener startup or provider request. The exact pinned `POST /v1/messages?beta=true` contract is unchanged.

**Owner inputs needed:** same approved product DB binding/driver, real peer/task observation, model-grant material lookup and trusted upstream lifetime/usage composition. No new provider or second ledger is proposed.

## BG-2: tenant reservation and terminal accounting

Native admission joins the canonical tenant store to its existing global-lock transaction. Tenant policy/hold admission precedes all run/allocation/grant inserts. Missing policy, cap or concurrency refuses the whole admission. Grant revocation releases concurrency in that transaction. UNKNOWN model/tool liabilities retain the original monthly hold; once all are resolved, measured combined usage replaces it. An idempotent repeated canonical revoke can reconcile later settlement. It never infers NOT_DISPATCHED from expiry, timeout or cancellation.

Legacy cleanup can revoke a pre-0002 run when the tenant table/reservation is absent; it does not assert a zero charge or settled tenant account. Every new admission requires the tenant schema/policy. Proposed/allocated source `apps/gateway/budget/migrations/0002_tenant_budgets.sql` is preserved unchanged and unapplied.

**Parent decision needed:** accept the existing product-budget 0002 DDL through its existing allocation, then allocate a durable trusted terminal/late-settlement reconciliation caller. No new migration number is requested for the code here. Real PostgreSQL combined model/tool concurrency, commit-loss and late reconciliation remain unqualified.

## BG-3: per-run model grant issuance

Prepared multi-run bindings require a trusted `modelGrants` owner. They no longer substitute the configured static proxy secret when retargeting runs. Proposed local port:

```js
modelGrants.issue({intent:{issuanceKey,binding,requestSha256,expiresAtMs},signal})
// -> {issuanceKey,binding,requestSha256,expiresAtMs,
//     grantId,capabilitySha256,proxyCredential}
```

The owner must durably claim the exact intent **before** creating material, recover the same protected material on identical replay, preserve original expiry and treat uncertain issuance as UNKNOWN. It must never mint replacement material on lost acknowledgement. The candidate checks the complete original intent, credential digest, original expiry, cancellation and separation from task/control capabilities. The model grant enters the existing canonical `grantIntents` set and is activated/revoked with that run. No raw credential enters immutable facts, journals or receipts. Existing prepared-run fact hashing and source-grant reuse checks remain in force.

**Parent disposition:** separate durable model-record architecture accepted for source, with exact central allocation `0b0b7abd536a27a74e3b1077ae71eed6e0ba275b`: `apps/control/conversations/migrations/0015_model_run_issuance.sql`, sole table `meri_conversations.model_run_issuances`. The new facade reuses canonical prepared issuance; model material uses a distinct directory and purpose-prefixed references because task/model share the binding-derived key. Claim precedes material, completion requires fence/version CAS, exact retries resolve identical material, and UNKNOWN never remints. A narrowly released startup successor supplies the model owner. Source and synthetic checks are detailed in [DOT-MODEL-GRANT-IMPLEMENTATION-20261016.md](../reports/DOT-MODEL-GRANT-IMPLEMENTATION-20261016.md). Missing owner still fails closed. No actual credential generation or SQL/provider execution is authorized. Independent integration, real peer/TLS/provider binding and release qualification remain pending; this does not close SEC-REL-02.

## PL-1: common server-owned Objective continuation protocol

Verified Core source-only candidate: `neo-capiro/capiro-backend` `622905839c7a510ab01a512ef8012926b2e1b4ce`, tree `90503a35520425ccd20fdccd44380940fd826d0f`, owned by `01a13d85-a042-7236-b84f-a797c4cd3030`. Native/full typing qualification is not established. Do not duplicate its schema or materialization.

Reuse `reserveCanonicalObjectivePlan` / `requireCanonicalObjectiveFence` and this **existing reservation token**:

```text
canonicalPlanId, tenantId, clientId, objectiveId,
canonicalStrategyId, canonicalProjectId,
bindingVersion, epoch,
requestedIntentId, requestedObjectiveRevisionId, requestedObjectiveVersion, snapshotHash
```

UUIDs, lower-hex SHA-256 and positive int32 versions; initial epoch is 1. Stable IDs survive ordinary regeneration. They reserve an association; they prove neither an existing Strategy/project nor a Core application effect. Manual multi-group/shared-task associations retain their independent semantics.

The existing explicit-browser StrategyVersion→Planner materialization owner (`apps/api-strategy/src/planner/strategy-materialization.ts`) supplies same-request idempotency, exact output IDs, current authority and human-edit preservation. It is the owner to reuse for application; Meri must never manufacture its receipt from a model result.

**Required allocations/decisions before implementation:**

1. A Core authenticated stage-publication adapter and **actual exported** receipt protocol. The broader association/composite/authority schemas in `docs/objective-workload-authority-20261015/` are proposals only. Do not invent endpoints or assume those ports exist.
2. Define a Core application receipt carrying the complete reservation/fence token, requested source identity, **applied** source identity, immutable result hash/reference, exact canonical StrategyVersion/project output identities and idempotency request identity. A receipt must be obtained by authenticated Core read/application, with current authority; `model.completed` and reserved IDs are insufficient.
3. Define conflict behavior for concurrent Objective revisions: stale epochs/revisions never publish or trigger Planner. Explicit replacement requires separate owner allocation; do not retarget an old command or result. Current grant revocation withholds release/dispatch.
4. Allocate a durable Meri continuation journal and its migration owner. One Objective workflow identity, immutable Strategy result custody, an application receipt fence before Planner admission, immutable Planner result custody and actual Planner application receipt. Lost ACK reads the same authoritative application receipt; UNKNOWN never redispatches a model query or product effect.
5. Choose an existing Temporal workflow/task-queue composition after protocol acceptance. Dispatch both stages through the existing canonical run creation/admission/issuance owners with fresh current authority. A browser may observe state but may not own continuation. Do not register a speculative dispatcher or use a second model loop.

**Acceptance required:** close/reopen, control/worker crash, lost model/application/ACK responses, concurrent revision, authority revocation, exact source/output identity, no duplicate model query and no duplicate application. Use real Core receipts in integration qualification. Synthetic receipts are test doubles, not proof of Core application.

Planner source implementation is **blocked pending these canonical publication/receipt and journal decisions**. No unaccepted Core source was integrated, no Core public seam edited, and no replacement workflow framework or speculative SQL was created.
