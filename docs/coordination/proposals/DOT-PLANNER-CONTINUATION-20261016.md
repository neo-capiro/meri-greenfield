# Planner successor: ownership and exact receiving requirements

Base `cf639d4707df0060524218c65d941834ed7ea2e3`; branch `dot/live-planner-successor-20261016`. Meri owns only new `apps/control/objective-planner/`, targeted synthetic controls and this outline. Core receiver owner is `01a13d85-a042-7236-b84f-a797c4cd3030`; qualification is the sole integration owner. No Core/Shared, frozen contract, runtime entrypoint, lockfile or migration claim. Accepted model/intent/startup pins remain separate. No new sessions or heavy stages.

## Persistence and execution owners

**No new Meri SQL proposed.** Held `conversations/0012_strategy_operation_results.sql` stays unused/unauthored. Core retains actual ObjectiveReceipt, saved StrategyVersion, immutable materialization creation receipt and current read projection. Proposed future Temporal continuation retains identity/phase, not a second content corpus. Canonical Meri run creation/admission owns the sole SDK model attempt; selected-output skill rows are not Objective result custody.

Core agrees: after actual Strategy application, use its deterministic saved-version materializer. No second Planner model loop. Unknown Core effects must be reconciled at that effect owner; a new Meri journal cannot prove absence.

## Verified existing Core source

Backend `622905839c7a510ab01a512ef8012926b2e1b4ce`, tree `90503a35520425ccd20fdccd44380940fd826d0f`. References are ObjectiveReceipt in `apps/api-strategy/src/meri/objective-generation.types.ts` and MaterializationInput/Source/Result in `apps/api-strategy/src/planner/strategy-materialization.ts`. These are read-only references, not copied Core implementation. New accepted-source-only context slice `5afc530a6907c74b21db3ea59103def6cb5a20a5` adds no authority, receipt or receiving route.

A completed job is Strategy application evidence only when its Core receipt transactionally binds actual saved Strategy/StrategyVersion and requested Objective revision with complete correlated context and no failure. Receipt shape alone authenticates nothing; Meri model completion proves no Core application. Context sourceDigest, saved Strategy snapshotDigest and canonical Objective snapshotHash remain distinct.

Existing `POST /planner/strategy-materializations` and `GET /planner/strategy-materializations/:requestId` use browser guards. They are not background workload delegation endpoints. Input is requestId, generationJobId, expected{strategyId,strategyVersionId,objectiveRevisionId}, optional groups. Preserve actual project/task IDs, original/current groups, availability and versions, linked context/dependencies, exclusions/issues/counts.

**Receiving-owner correction:** public GET is a mutable current projection and revalidates current Objective revision. It may return SOURCE_STALE after a prior commit when the Objective advances. Its full-result SHA is not an immutable creation ACK/custody hash. Neither 404 nor SOURCE_STALE proves absence. Recovery after uncertain application requires a separate stored-creation-receipt read under fresh current read authority, independent of eligibility for another effect.

## Exact remaining Core allocation

The Core owner is preparing a Git-bound request/ACK/read and association-persistence proposal. Parent must allocate the actual issuer/audience/current actor-delegation verifier (or retained current-user authorization owner), original expiry/action/source binding, and immutable stored ACK lookup. Existing application-authority identity/context receipts are digest facts over a live Clerk request/session context, not credentials. InternalServiceGuard generic secret does not delegate an actor. Meri gateway audience meri-gateway and tool.read/command.execute, task material and model material cannot be repurposed for Core publication. No credential, new endpoint, verifier or schema is invented here.

Proposed private Meri work facts: full CanonicalObjectivePlanToken, original actorId, generationJobId, generationRequestId, actual strategyId/strategyVersionId, strategyReceiptSha256, saved snapshotDigest and deterministic plannerRequestId. Stable request/workflow identity binds the original full canonical token + original actor only. A changed job/version under the same intent conflicts; it does not acquire a new effect ID. Actor identity is Core's original actor string, including Clerk lineage, not a caller-supplied UUID assumption. Caller selection allows only canonicalPlanId/requestedIntentId/generationJobId.

Actual Strategy application must bind canonicalStrategyId. canonicalProjectId remains a reservation until a Core Planner transaction creates/publishes it. Existing legacy materializer output IDs differ. Core proposes the automatic default-group path use reserved canonicalProjectId as its actual row ID through one shared creation/receipt-check resolver. This direction is not implemented/accepted by this Meri slice. Arbitrary/manual groups retain their actual IDs; no first-project mapping or alias. Core separately owns exact association receipt and persistence allocation.

## Implemented independent source and dependent work

Implemented: closed selection/work identity validation; actual ObjectiveReceipt correlation decoder; closed mutable MaterializationResult observation decoder; fixed-route compatibility client with bounded borrowed transport, owned deadline/abort lifetime and no automatic retry. Constructors are inert; no ambient identity/credentials, network calls or runtime composition. POST response/transport uncertainty remains UNKNOWN. GET returns only a current observation, never immutable ACK or canonical completion. Current human edits and unavailable/archived outputs stay intact. Shape/hash checks do not authenticate a receiving owner.

Not implemented or claimed: a Core workload issuer/verifier, immutable Planner creation ACK transport, authenticated background receiving application, canonical association publication or server Temporal continuation. These dependent pieces must match the exact actual Core request/ACK/read after allocation. Missing Core authority remains unavailable before future workflow/effect dispatch. Writing a fake receiver or a Temporal workflow around legacy browser routes would bypass that boundary. No second Planner model query, arbitrary group/task cap or new queue/placement is introduced.

Targeted controls cover source/revision/digest mismatches, model-only result refusal, stable original identity, closed selection, precise existing materializer input, fresh mutable human edits, partial output truthfulness, revoked read, ACK loss, no automatic POST retry and bounded cancellation/deadline cleanup. These use fixed synthetic receipts and transport plus a hash-only dependency stub; real canonicalize/Ajv, Core authority/SQL/stored custody, Temporal, provider and end-to-end close/reopen/crash are UNRUN. Failed runs remain in the candidate evidence directory.
