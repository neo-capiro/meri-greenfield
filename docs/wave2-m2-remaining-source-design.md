# Remaining M2 owner work and proposed allocations

These are reviewable source proposals, not enabled capabilities. No new migration ID, public endpoint, issuer, purge job or production placement is claimed by this document.

## Managed Trash finalization

Existing owners are `apps/control/retention/{inventory,purge,postgres-journal,reconciliation}.mjs`, the canonical ledger and suppression owner, Core `apps/api/src/meri/conversation-management/service.ts`, and its bootstrap/management receipts. The current PostgreSQL row-purge adapter supports SDK entries and artifact versions; the narrowly gated `conversation` route only covers memory proposal contexts. It explicitly refuses the other conversation content targets. Therefore neither a 30-day eligible plan nor a successfully deleted object proves permanent chat deletion.

Proposed allocation:

- R: existing inventory snapshot/row-target registration, PostgreSQL row-purge adapter, purge/recovery finalization and `conversation-management-composition.mjs`, plus focused cross-owner tests. Inventory must cover exact events, controls, run requests, next-run/checkpoint/native journals and retained object references; existing retention policies remain additive. Allocate one forward Meri migration to record exact deletion targets and amend only the corresponding immutability guards. Reuse existing class names and inventory vocabulary; do not register a second purge family.
- U/Core: a cohesive `conversation-management/retention.ts` module exported through the same canonical metadata owner, plus a centrally allocated forward receipt/schema migration. The owner needs `readConversationRetentionState`, `claimConversationFinalization`, `finalizeConversation`, and `readConversationFinalization` methods. The stored consumed receipt contains immutable tenant, actor, conversation, original bootstrap identity, client/kind, Core revision/deadline, suppression generation and complete plan digest; it contains no title, prompt or transcript. It survives the actual row deletion. The existing bootstrap receipt stays consumed and the management receipt's actual-delete trigger erases its title-bearing payload.

Protocol:

1. The existing purger validates every ordinary retention duration, hold, liability, shared holder and storage permission, then obtains fresh canonical Core owner/binding/status/revision/30-day facts. No work begins without complete inventory and supported row targets. An expired deadline alone grants nothing.
2. Hold the existing retention transition before the Meri conversation exclusion; retain the relevant row locks. No Core callback reacquires that lock. The Core finalization claim uses a transaction and row lock to compare the exact immutable bootstrap proof/revision and deadline against database time. Scheduled execution is authorized by the existing trusted purger, not by the departed owner's interactive membership or current client wall. The immutable consumed receipt pins one plan/generation; retries of different bytes refuse. This is a retention command on the existing owner, never an HTTP-deserialized fence.
3. The existing purge ledger records UNKNOWN before effects. Its canonical object and Meri content-row steps delete only recorded exact targets. Content deletion preserves the content-free retention identity/projection and consumed request/binding facts required to refuse re-admission and reconcile unknown results. An immutable journal containing prompt bytes must gain a guarded purge rule; it cannot simply be left behind and called deleted.
4. Core finalization is the last content step. Under its row transaction it rechecks the exact consumed claim, current proof and deadline, deletes the canonical conversation row, lets the existing FK/actual-delete guards tombstone bootstrap/management receipts, and marks its content-free finalization receipt committed atomically. Loss of the response is resolved by that receipt and absence readback, never a new request or permissive missing-row result.
5. Recovery reads both canonical owners' consumed receipts and exact target absence. It cannot use a missing Core conversation as fresh ownership or as deletion success. An already committed Core tombstone can certify only the exact pinned deletion; it is not a current chat grant. Missing/inconsistent evidence leaves UNKNOWN and serving suppressed. Restored data must still reconcile against the external ledger before serving.

Required adversarial gates: restart/lost reply before and after each owner commits; one side deleted/other side unavailable; exact repeat execution; stale revision or suppression generation; restore then re-Trash; grant/member revocation; changed owner/kind/client; legal hold after planning and immediately before effects; shared references; restored rows after deletion; title-bearing receipt erasure; no re-bootstrap/admission under consumed keys. All permanent-deletion activation remains off until this entire chain is implemented and reviewed. A single cross-database transaction is not assumed.

### Retention authority and exact proposed owner boundary

Source evidence: `retention/suppression.mjs` authorizes an initial suppression/release with the trusted subject owner or the existing owner-mediated receipt. `retention/startup.mjs` composes physical deletion only with an explicit enabled switch and every existing owner; control currently supplies `enabled:false`. `retention/purge.mjs` `authorize(plan)` has no interactive actor input: it checks the recovered serving barrier, current SUPPRESSED ledger generation and a fresh complete policy/inventory/hold/liability/shared-reference digest. `retention/policy.mjs` requires explicit policy, cooling and each class's retention interval; it has no membership predicate. These checks, including administrative policy and legal holds, continue to own scheduled deletion.

Core `readManagedConversationOwner` already proves tenant, actor, client, explicit kind and bootstrap identity without checking active membership. `readManagedConversationMetadata` also applies `assertManagedMembership` and `visibleBinding`'s client wall, which is correct for interactive management/admission but unsuitable for scheduled retention. The current `withManagedConversationTrashFacts` call to that interactive reader must change to the separate retention reader after allocation. It must never gain a fallback to a stale plan or to a missing row. Interactive management, metadata reads and restore keep their current membership/wall requirements.

Proposed internal types (UUID/digest/date strings use closed validators; no title, prompt, transcript, bearer or user-provided authority):

```ts
type RetentionIdentity = {
  tenantId: UUID; conversationId: UUID; ownerActorId: UUID;
  bootstrapRequestId: UUID;
  scope: { kind: 'general'; clientId: null } | { kind: 'client'; clientId: UUID };
};
type RetentionState = {
  version: 'meri.conversation-retention.v1'; identity: RetentionIdentity;
  status: 'active' | 'archived' | 'trashed'; revision: DecimalRevision;
  trashedAt: ISODate | null; restoreUntil: ISODate | null;
};
type FinalizationInput = {
  version: 'meri.conversation-finalization.v1';
  identity: RetentionIdentity;
  metadata: { revision: DecimalRevision; trashedAt: ISODate; restoreUntil: ISODate };
  suppression: { ledgerSequence: PositiveSafeInteger; entrySha256: SHA256 };
  planSha256: SHA256; policySha256: SHA256; inventorySha256: SHA256;
  targetsSha256: SHA256; // canonical complete target manifest already held by the existing purger
};
type FinalizationReceipt = {
  input: FinalizationInput; inputSha256: SHA256;
  state: 'CLAIMED' | 'FINALIZED'; claimedAt: ISODate; finalizedAt: ISODate | null;
};
interface CoreConversationRetentionOwner {
  readState(input: { tenantId: UUID; conversationId: UUID }): Promise<RetentionState>;
  claim(input: FinalizationInput): Promise<FinalizationReceipt>;
  finalize(input: FinalizationInput): Promise<FinalizationReceipt>;
  readFinalization(input: FinalizationInput): Promise<FinalizationReceipt | null>;
}
interface CanonicalConversationPurgePort {
  withCurrentPlan<T>(input: FinalizationInput, phase: 'claim' | 'finalize',
    work: () => Promise<T>): Promise<T>;
}
```

The Core module captures its Prisma owner and a trusted in-process retention port at construction, before receiving requests. No controller mounts these methods; no request may supply or replace that port. The port binds `claim`/`finalize` to the existing purge executor's current-plan validation and held transition/conversation exclusion. `withCurrentPlan` resolves the already-recorded canonical plan by its digest, compares every input field, refreshes all existing retention facts and runs the callback exactly once within the lock lifetime; finalize additionally requires the exact consumed Meri content-deletion receipt/readback. Nested use may reuse only the same currently active subject/plan scope. No Core callback reacquires the Meri lock, and escaped callbacks refuse. It is not a second issuer, signed token or deletion job. Plain `FinalizationInput` bytes are only correlation, never permission. Missing trusted composition returns unavailable. `readState` is a content-free tenant-scoped RLS query over the actual conversation plus matching bootstrap, deliberately without membership/client-wall checks; unknown, legacy-unbound or conflicting identity refuses. `readFinalization` compares the entire input digest and stored original identity, never infers a prior success from absence.

`claim` row-locks the canonical Core conversation, compares all immutable binding fields, current status/revision and exact 30-day interval, and checks database time >= restoreUntil. It inserts one content-free consumed record for `(tenantId, conversationId)` with the full input digest and CLAIMED state. It can replay only identical bytes; another generation/plan never overwrites the consumed claim. A failed transaction creates no claim; a lost acknowledgement is resolved only by readback. Claim does not delete or release suppression. Before any effects, a fresh ordinary retention policy/hold/liability/shared check still applies; a claim is not an irrevocable exemption from future holds.

`finalize` is the final Core content step, after the Meri owner confirms exact content deletion/readback for the same input. The captured port revalidates the current ledger generation, policy and holds and the Meri consumed target receipt. The Core transaction then checks the CLAIMED record, current row binding/status/revision/deadline and database time, deletes the actual row, lets the existing actual-delete FK guards tombstone bootstrap and management receipts, and updates its claim to FINALIZED atomically. An absent row without that matching FINALIZED record refuses. An identical FINALIZED retry reads the committed record and exact row/receipt absence; it makes no new deletion decision. A restored title-bearing row behind a FINALIZED receipt is inconsistent and remains suppressed until recovery, rather than silently certified.

The existing purge executor retains its complete original manifest and per-target UNKNOWN/EXECUTED records across both owners. After partial deletion, current rows must equal the exact still-pending targets and every executed target must remain absent; additions, changed hashes or missing unacknowledged rows refuse. Do not recompute a smaller inventory and call it the original plan, or demand that deleted rows still supply a fresh inventory hash. Existing policy/hold/shared/liability sources remain freshly checked for any remaining effect. When Core is already gone, its exact FINALIZED receipt plus the retained Meri subject/plan and absence readbacks may certify prior effects; they cannot authorize a different plan or resurrect an interactive grant. Only both owners' confirmed content absence allows PURGE_EXECUTED. Any missing receipt or unknown commit remains UNKNOWN.

Owner-departure controls must show that deactivating/removing membership or revoking a client wall after a valid Trash does not alone block scheduled finalization when immutable binding and all retention rules remain valid. Equivalent interactive read/manage/restore calls must still refuse. Changing bootstrap actor/tenant/client/kind, restoring or re-Trashing, changing policy, legal hold, shared reference or unresolved liability must prevent the next effect. Test each side's lost response and crash, exact retry after either side deleted, changed digest, fabricated absence and title-bearing receipt resurrection.

### Proposed Meri migration split and exact targets

At inspected main `4f8725b826a48c046a49e8d8d11babe188515894` and this pinned branch, the highest conversation migration is `0020_initial_generations.sql`. The central allocation record still reserves absent `0012_strategy_operation_results.sql` and `0014_retention_row_targets.sql`; neither is a free gap. No `0021` reservation was found in the inspected central record/current dispatch. The next candidate is **`0021_conversation_retention_identity.sql`**, subject to root's active-lane collision check and explicit reservation. No SQL is authored here.

Keep 0021 cohesive: add `meri_conversations.retention_identities`, keyed by tenant/conversation, with immutable owner and an optional verified Core bootstrap binding; repoint only the existing `retention_subjects` FK from the content conversation row to that identity. Add a content-free `retention_finalizations` consumed record keyed by the same subject, pinning the exact input/target hashes, original suppression generation and monotone UNKNOWN/CONTENT_DELETED/FINALIZED state. It survives content deletion. Legacy rows are backfilled solely from their existing real Meri conversation and remain explicitly unverified for managed Trash until the trusted Core bootstrap owner supplies a matching binding. No legacy null row is relabeled General. The verified binding must agree with the immutable existing owner; conflicts refuse. The anchor is never a Run/Conversation projection or a serving/admission grant. This migration adds no DELETE exception for content tables.

Empty Core-only Trash creates the same anchor from a verified Core bootstrap **under the existing conversation advisory lock**, then suppresses and commits Core metadata using the current ordering. First-input admission and retention finalization both take that same exclusion and compare the anchor: active unconsumed identity may admit; trashed/claimed/finalized identity refuses. A concurrent first input can therefore neither appear after a successful empty-chat purge nor be mistaken for empty. Missing source owner or mismatched anchor remains unavailable; do not manufacture run scope or insert a blank Meri conversation.

Actual content deletion needs a separate reviewed forward content-target/guard migration, provisionally `0022_conversation_content_finalization.sql`, plus central resolution of the historical 0014 authoring hold. It must not silently reuse or supersede 0014. Its exact target mapping must cover the existing registry classes below, with row hashes/keys bound to the suppression generation and canonical plan in the same transaction:

| Existing class | Canonical content targets / guarded dependencies |
|---|---|
| conversation | conversations, runs (including request/continuation), controls, memory_proposal_contexts; keep consumed request IDs and hashes in content-free tombstones |
| events | events; `reject_closed_range_event` requires an exact DELETE-only purge exception, retaining all insert/update range checks |
| lifecycle / completionCheckpoints / nextRuns | checkpoints, completion_checkpoints, next_runs; `preserve_completion_identity` and `preserve_next_run_identity` need exact DELETE-only exceptions; delete FK children first |
| sdkSession | existing sdk_session_entries targets plus sdk_session_streams/batches/session custody where content-bearing; preserve originating identity tombstone; amend only exact SDK guards after source review |
| selectedOutputs | selected_outputs, selected_reads and their canonical retained object versions; shared artifact ownership remains separate |
| nativeJournals | native_executions, native_allocations, native_restorations; preserve run/fence/digest consumption, redact or remove only target-bound content under reviewed native guard amendments |
| receipts / pre-input state | initial_inputs, initial_run_bindings, run_issuances, model_run_issuances and external command/approval/task-lookup receipts require per-owner content audit; identifier-only material stays consumed, never reminted; model/P1 and other owners' guards are not implicitly allocated |

Every table/row with content must appear in the canonical inventory and target manifest before eligibility. Initial-input/session/issuance rows that are proven identifier-only can remain only with explicit evidence and their existing policy classification; do not infer this from a table name. Command/approval/task-lookup amendments retain their separate historical allocations. External memory proposals and artifact/shared references keep their existing blocking/deletion owners. The existing purger remains unable to certify complete conversation deletion until all applicable targets and guard owners are qualified. General inventory's control decoder currently assumes a nonnull client; that needs an explicit General binding test/fix within the inventory allocation, not a malformed-row bypass.

## Empty Core-only conversations

Current behavior safely refuses Trash before the callback/ledger when no Meri conversation exists. Core bootstrap is not a Meri transcript. Checking absence without the canonical advisory lock would race first input creation; the new guard checks under that lock. Archive/rename remain possible through the Core metadata owner, and new input sees their status under the same exclusion.

Proposed canonical solution: extend the existing retention owner with a durable, content-free subject identity sourced from Core's immutable bootstrap receipt. It must be a real retention identity, not a fabricated Run/Conversation or guessed private scope. Core's trusted owner would return exact bootstrap request identity, tenant/actor/client/kind and current metadata; an approved Meri migration would make retention projections reference that identity instead of requiring a transcript row. Existing rows need verified backfill, not blanket legacy-null conversion. Bootstrap, first-input admission and deletion must compare the same immutable identity under the conversation exclusion. The anchor survives content deletion for recovery and never authorizes serving. This shares the finalization tombstone requirement above; allocation/review is still required.

## MG02 availability and lifecycle closure

The published catalog derives 14 identities/15 versioned assets and hashes from `packages/skills`; every public entry is unavailable until qualified. `runtimeSupported` describes implementation only. Existing `createOriginalSkillAdmissionOwner` in `apps/control/conversations/skills/admission.mjs` is the sole current selection owner: it verifies fresh context, canonical selection/window, exact installation, the admitted run allocation and a second fresh context/installation read. It currently admits the two installed client-bound original skills only.

Proposed read-only availability receipt belongs on that owner, with its pure prerequisite checks factored once into a nearby cohesive module. Inputs are the authenticated conversation/session and exact selected skill/version/window draft; a preview never allocates a run, starts a workflow or expands prompt text. Outputs pin the canonical asset/manifest hashes, normalized selection/window, current context revision, installation/catalog digest, checked/expiry times and a closed unavailable reason. A positive preview is not an execution grant: actual submit must repeat `admitSelection` against the admitted run's allocation. Unsupported assets stay explicitly held; General cannot acquire a client-only skill merely because the catalog lists it.

Before extending the public package, R/U must agree the generated receipt receiver and exact route owner. The immutable contracts 0.1.11 artifact must not be overwritten. U can retain typed draft ID/version/window now. Remaining tests must cover all 14 identities and 15 versions through submit, uncertain response/reload/reconnect, steer, resume and fork, including manifest changes, grant loss, DST/week/FY boundaries and explicit reviewed goal/version changes. Existing lifecycle support and the catalog alone do not meet that matrix.

## MG05 trusted delivery and MF19/PF02

The source packet assembler validates all six canonical `get_client_context@0.3.0` sections, exact source/client identity, coverage/sample semantics and final context revision. It never changes a journaled request or its UUID. No existing separately bound model-context seam was found. After P1/C9 authorization, the smallest required source handoff is an explicit trusted-context digest/bytes input in the existing SDK startup proof, with its exact source/request/authority revision and expiry bound before the first model call. It cannot be relabeled as user text. Real rich/sparse/corrections/subject-ambiguity acceptance, token/call/latency measurements and actual delivery remain outstanding.

U owns the canonical PF02/MF19 entry DTO/receiver and ordinary UI draft handling. R must finish source-level lifecycle/revision checks for any newly published object handoff. No sensitive source text goes in URLs; current authority is re-read, unsent context stays a draft, and a client switch cannot reuse the prior proposal. Actual authorized service receipts and frozen first-chat gateway integration remain activation evidence, not fixture success.
