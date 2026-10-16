# L3 conversation discovery, transcript and turn proposal

**LOCAL PROPOSAL, pending independent review and parent acceptance.** No export was added to frozen `@capiro/meri-contracts` 0.1.5 or its closed 0.1.0 Run/UIEvent contracts. The source-local names below are `apps/control/conversations/history/protocol.mjs`: `HISTORY_PATHS`, `DISCOVERY_SCHEMA`, `HISTORY_SCHEMA`, `TURN_SCHEMA`, `listRequest`, `transcriptRequest`, `turnRequest`. The frontend must keep truthful unavailable states until a reviewed public version/export is allocated. Proposed public subpath: `@capiro/meri-contracts/conversation-history`, with the exact shapes below and frozen Run/Conversation/UIEvent references; version allocation belongs to the parent.

All three routes are mounted on the existing control host only when trusted startup supplies `conversationMembership` (the canonical membership gate's `admit`/`recheck`), plus the canonical conversation store. `conversationTurns.admitTurn` is additionally required for admission. Prepared-candidate startup exposes the existing next-run owner only in declared multi-run mode; genuine membership and model-grant owners remain absent, so this source does not establish production availability. Trusted supplemental factories now compose with canonical prepared ports and cannot replace them.

Transport for all routes: POST, no query/hash, `Content-Type: application/json` (optional UTF-8 charset), no content encoding, `Authorization: Bearer <native identity token>`. This is the canonical product membership credential, not an old run's action session. The identity verifier and Core's current membership directory establish tenant, actor, active membership, permitted clients and revision. Neither a body field nor a conversation selector grants authority. Results undergo membership recheck. Existing retention serving, when configured, gates transcript/turn access and filters suppressed discovery entries; unavailable retention refuses rather than assuming unsuppressed. Every response is no-store/nosniff. Request maximum 131072 bytes; runtime's configured smaller limit still applies. Limits below are integer values without coercion.

## POST /api/conversations/list

Closed request:

```json
{"before":{"createdAt":"2026-10-16T12:00:00.000Z","conversationId":"<uuid>"},"limit":50}
```

Both fields optional; before defaults to null, limit to 50 (1–100). Explicit null is allowed only for before; null limit/after values are refused rather than normalized. A non-null cursor contains exactly an ISO UTC `createdAt` and lower-case UUID `conversationId`. Tenant/actor/client fields are refused.

Response:

```text
{
  schema: "meri.conversation-list/1",
  conversations: Conversation[],
  nextBefore: null | {createdAt: ISOInstant, conversationId: UUID}
}
```

Only this actor's conversations in the current tenant and permitted client scopes are discoverable. Ordering is createdAt descending, then conversation UUID descending; the cursor is exclusive. Suppression can produce a short/empty page with a non-null nextBefore; clients follow that cursor rather than infer exhaustion from array length.

## POST /api/conversations/transcript

Closed request: `{conversationId: UUID, after?: nonnegative safe integer, limit?: 1..100}`. Defaults: after=0, limit=50.

Response:

```text
{
  schema: "meri.conversation-transcript/1",
  conversation: Conversation,
  latestRun: Run,
  latestSequenceBase: nonnegative safe integer,
  turns: [{run: Run, request: StoredConversationRequest,
           promptLineage: {kind: "submission" | "resume" | "fork",
                           logicalRequestId: UUID,
                           sourceBinding: null | RunBinding,
                           sourceRequestId: null | UUID},
           sequenceBase: nonnegative safe integer,
           sequenceEnd: null | nonnegative safe integer,
           lastSequence: positive safe integer}],
  events: [{sequence: positive safe integer, event: UIEvent}],
  nextSequence: nonnegative safe integer,
  lastSequence: nonnegative safe integer,
  hasMore: boolean,
  pendingTurn: null | {sourceBinding: RunBinding, targetBinding: RunBinding, state: "RESERVED"}
}
```

`StoredConversationRequest` is the original immutable stored `{requestId, prompt, skill, window, windowRequest?}`; skill is the existing SkillPin or null, window the existing normalized window or null, windowRequest the existing request or null when present. `turns` contains only runs touched by this page. The actual stored requestId remains the exact submit/ACK recovery identity. A resumed run has a generated requestId, so render/deduplicate user prompts by **(conversationId, promptLineage.logicalRequestId)** and runs by binding. Do not deduplicate by prompt text or requestId alone, and do not regenerate identity on reload.

For a genuine submission (including a next turn), kind is submission, logicalRequestId is that requestId, and both source fields are null. A resume inherits its canonical source run's logicalRequestId recursively and records its immediate checkpoint source binding/requestId. A fork starts a new conversation-local logicalRequestId equal to its own stored requestId while recording the immediate external source binding/requestId. Later resumes inherit that fork identity. The reader verifies stored continuation hashes, canonical envelope, source request/context correlation, and an earlier matching same-conversation source for resume. It exposes no checkpoint payload, opaque data or credential. A new submission with identical text remains a distinct prompt.

`events[].sequence` is the conversation cursor: sealed run sequenceBase plus the original `event.sequence`. UIEvent itself stays byte/identity-equivalent to its frozen per-run wire shape. Pages must be contiguous; gaps, overlaps, altered bindings/scopes or corrupt row hashes fail closed. `nextSequence` is the last returned conversation sequence (or after when empty); `lastSequence` is the current conversation tail. An exact-tail reload returns no events with the same cursor. A cursor beyond the tail is 400. Resume/fork retains the canonical sealed ranges; a fork has its own conversation and zero base. Historical read admission never changes writer fences.

Reconnect by POSTing transcript with the retained conversation `nextSequence`. Existing `/api/conversations/history`, `/events` and `/events/<conversationId>/stream` remain frozen, **run-local** APIs using the current action session. Their cursor is the UIEvent sequence, not this transcript's conversation sequence. For the latest run, translate by `conversationSequence = latestSequenceBase + event.sequence`; never send a conversation cursor to a run-local stream. This proposal adds no second stream/model loop.

## POST /api/conversations/next-turn

Closed request: `{conversationId: UUID, sourceRunId: UUID}`. The source run is the immutable admission command identity.

Response:

```text
{
  schema: "meri.conversation-turn/1",
  sourceBinding: RunBinding,
  targetBinding: RunBinding,
  state: "RESERVED" | "ACCEPTED",
  replayed: boolean
}
```

This reserves or reads the existing unique source→target mapping in conversation migration 0009. It does not submit a prompt, issue a credential, dispatch a model or make an old run writable. New admission reuses canonical checkpoint/physical-retirement/revocation/no-authority proofs. Repeating the same source after lost ACK returns the same target, even after that target is accepted or historical; it never allocates a later target. To write the admitted current target, request the existing action session with exact conversation/run hints, then use existing submit with the retained immutable requestId/prompt. Current-authority session issuance and store fences still refuse historical targets. Reload recovers accepted prompt identity from transcript and a still-reserved mapping from pendingTurn. No additional migration is requested.

## Errors and recovery

Standard product envelope `{error:{code, outcome?, field?}}`. 400 request/cursor invalid; 401 malformed/missing Bearer; 403 unverified token/access denial or removed membership; 404 conversation absent or outside tenant/actor/client walls; 405 method; 409 `MEMBERSHIP_CHANGED` for a changed revision/rights/client set and `CONVERSATION_TURN_CONFLICT` when the named latest source is nonterminal (NOT_DISPATCHED); 413 size; 415 media; 408 deadline; 499 cancellation; 500 `CONVERSATION_STORE_CORRUPT` for pure canonical row/shape/hash/lineage failures; 503 conversation/turn owner or underlying storage unavailable. Missing native owner is `CONVERSATION_TURN_UNAVAILABLE` with NOT_DISPATCHED. An unmapped foreign failure outside domain normalization is the existing generic 502 product-unavailable response.

Transcript and next-turn authorize the stored subject's tenant, actor and permitted client scopes before any subject-specific retention check. Foreign actors/excluded clients receive the same404 for suppressed and unsuppressed subjects; no retention observation occurs. Authorized reads still pass retention before release, and membership is rechecked by the canonical product HTTP owner after the route returns.

A next-turn deadline/cancellation after the effect route starts, a reservation COMMIT uncertainty or an indeterminate admission is explicitly UNKNOWN. An acknowledged result withheld by a later membership/retention check is RESULT_NOT_RELEASED. Recover by reading/replaying the **same sourceRunId**, never by inventing a new command, source, prompt or safe-retry assumption. Membership admission cancelled before route invocation has no effect-start marker. Read-only transcript/discovery errors carry no effect claim. Error bodies never carry underlying database/Core text.

## Unresolved startup contracts

Canonical native lifecycle admission/retirement, current transition authority and approval/decision bindings remain named trusted ports; there is no implementation of those native routes in prepared startup. Artifacts/actions/tasks retain their existing compiled-owner seams. Prepared SDK persistence now delegates to the same remote controller owner, refusing until real allocation/registration. Source installation and the budget lane's proposed model-grant issuer remain uncomposed. Schedule placement is approved as a separately supervised Temporal worker in the control-service domain; registration remains source work, with no live activation. `/health/ready` names the full-product gaps and returns503; the separate minimal first-chat status is proposed in `DOT-FIRST-CHAT-STARTUP-20261016.md` and cannot be inferred from optional feature presence. This lane neither invents Core endpoints nor supplies a second authorization/model loop. The additive public conversation-history export is centrally reserved, conditional on this corrected source/wire acceptance; actual owner bindings and exact frontend artifact adoption remain required.
