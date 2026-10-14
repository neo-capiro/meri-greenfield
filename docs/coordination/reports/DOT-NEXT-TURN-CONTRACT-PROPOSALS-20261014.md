# Next-turn contract proposals for root review

Status: PROPOSED, not frozen or implemented. Base pickup `700f203e7b97b64207489d29e17e00014f7ff43b`. Existing public and private lifecycle wire contracts remain unchanged.

## Bounded lifecycle transition authority

The expanded interface and independent-review corrections in `DOT-TRANSITION-AUTHORITY-REVIEW-20261014.md` supersede this initial sketch: explicit purpose/state checks, propagation of the shortest deadline into the actual effect lifetime, and deferred historical-source replay reconciliation. Use that document for root's current interface review.

The corrected current-run owner rejects historical accepted targets. That exposes a pre-existing sequencing dependency in lifecycle resume: `journal.continuation` inserts the target and seals the source range, then `service.control` calls `fresh()` through the original source-bound session before starting the target workflow. The source is now stale. The source-only regression records a persisted target, zero starts, zero continued signals and `UNKNOWN`. This safe refusal is preserved; it is not a working resume path.

Proposed canonical owners: `apps/control/action-host/session/owner.mjs` retains the native identity credential and original session expiry; `apps/control/conversations/lifecycle/service.mjs` supplies the exact committed transition; its journal validates immutable source/control/target linkage. A trusted context adapter rechecks the current target and backend context before and after the bounded effect.

Proposed internal method, subject to review: `verifyTransition({credential, controlId, sourceBinding, targetBinding, admissionReceiptId, retirementReceiptId, signal, deadlineMs})`. It is not exposed as an HTTP operation. An injected trusted transition-reader port must obtain the exact committed control from the canonical journal; browser/model arguments and cached admission receipts cannot establish the mapping.

Required behavior:

- Original opaque session must still exist, be unrevoked and within its original expiry. Preserve original principal, identity revision, tenant, client and scopes; retain its native credential only inside the existing owner.
- Exact immutable committed control must name the source session binding and target binding, admission receipt and required retirement receipt. `UNKNOWN`, missing or changed transition facts refuse.
- Reverify current native identity/backend client context and the exact current target before and after dispatch. Never repin the old session, make it generally current, or authorize old-run writes/history through this operation.
- Limit receipt expiry to the minimum original session, current identity/context, admission and target deadlines. Retry cannot extend the original authority window.
- Authorize only the original transition's target start/continued/receipt completion. Workflow ID and canonical durable effect identity remain unchanged. Uncertain dispatch stays `UNKNOWN`; do not repeat a model or physical task effect.
- Fork must prove the separately owned target conversation and fresh native admission; source retirement is required only for resume. The current fixed-conversation pilot cannot silently broaden its conversation selector to make fork pass.

Required controls: composed selector plus lifecycle pause→resume; target cancellation/revocation between commit and dispatch; source session expiry/revocation; changed principal/client/policy; changed control/target/receipt; lost workflow ACK; exact replay; fork isolation; stale run-2 session after run 3 remains refused. Root must allocate the shared session owner paths and review the interface before implementation. No alternate authority fallback is proposed.

## Conversation-wide cursor and run listing

Durable `sequence_base` and sealed `sequence_end` establish source ranges. They do not supply a public reconnect protocol. The frozen receiver still validates run-local sequences from 1; no existing events, DTOs or cursor semantics were changed.

Proposed additive operation: `POST /api/conversations/runs`, authorized by the current opaque session, with body `{afterFence?: positive integer, limit?: integer 1..100}`. The session selects the conversation; the body cannot select a tenant, actor, conversation or run. Response candidate: `{conversationId, runs:[{binding,state,sequenceBase,lastSequence,sequenceEnd}], nextAfterFence}`. Entries are ordered by writer fence. Historical ranges have immutable ends; the last range may remain open. Server validates exact canonical ownership/scopes and contiguity under the existing conversation lock.

Proposed separate stream version/endpoint for root choice: a bodyless conversation stream retaining the existing `x-meri-resume-sequence` header but interpreting it as a global conversation position only on that new version. The resolver maps position `after` to the historical run and local `after - sequenceBase`, walks sealed ranges without holes or duplicate event identity, then tails the current open range. A current owned session may read historical ranges through this dedicated owner-checked operation; it does not revive historical session authority. Cursor beyond the durable end, gap, conflicting replay, corrupt range or changed current scope refuses. Browser detach remains observation-only.

Root must choose names/version, freeze schema/receiving behavior and coordinate frontend changes. Required independent controls cover reconnect exactly at boundaries, duplicate IDs, empty/open last ranges, three turns, pause/resume ranges, fork separation, cancellation races, stale sessions and tenant/client walls. No public contract change is included in this source candidate.
