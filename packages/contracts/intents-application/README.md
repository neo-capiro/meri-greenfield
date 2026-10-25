# Conversation intents application contract

Proposed `urn:meri:intents-application:0.1.0` browser boundary for the two conversation write-intent routes owned by `apps/control/intents/http.mjs` and `approval.mjs` (PR190 base `29379ab1`). It is derived from those handlers' actual behavior. It grants no approval or execution authority and is not deployment, membership or runtime-mount evidence.

- `POST /api/conversations/intents/list` `{conversationId, after?, limit?}` returns `{conversationId, intents, next}`: the durable intent history of the caller's own conversation.
- `POST /api/conversations/intents/decide` `{conversationId, deliveryId, proposalId, commandSha256, decision}` returns `{status: rejected|executed|indeterminate, deliveryId, proposalId, decision, outcome?}`.
- Errors are `{error:{code, outcome?, field?}}`; statuses are the product-access vocabulary plus `INTENT_APPROVAL_ERRORS`. `outcome` is `NOT_DISPATCHED`, `UNKNOWN` or `RESULT_NOT_RELEASED`. `field` is absent on 502.

## What is derived from what

`apps/control/intents/application-protocol.mjs` re-exports the real route paths, the real intent error table, the real product error table, the journal failure codes and `APPROVABLE_ACTIONS`; the generator reads those constants, so a handler change that is not reflected in the contract fails `--check`. Canonical shapes are copied as local definitions from the frozen 0.1 schema, task-create, the explicit document-draft0.2 command schema and artifact0.2 schema. The frozen schema and historical task/memory/filing shapes stay unchanged.

## Item vocabulary (list)

Every item carries `deliveryId`, `createdAt`, `operation {id, version:'0.2.0'}` and one of:

| `state` | `kind` | extra fields |
| --- | --- | --- |
| `pending` | | |
| `unknown` | | |
| `failed` | | `code` (journal failure code) |
| `prepared` | `draft` | `versionId`, or `withheld:true` |
| `prepared` | `schedule_proposal` | `proposalId` or null |
| `prepared` | `proposal` | `withheld:true`, or `proposal`, `decision`, `execution`, `phase` |

`decision` is the canonical `ApprovalDecision`, `null` (none recorded) or `'unavailable'` (owner not readable). `execution` is `{state:'executing'}`, `{state:'unknown'}`, `{state:'completed', outcome}`, `null` or `'unavailable'`. Completed task outcomes contain the existing receipt/result; completed document outcomes contain the actual published `ArtifactCreatedResult`. `phase` is a reading of the durable owners (`awaiting_approval`, `approved`, `rejected`, `expired`, `executing`, `completed`, `unknown`, `unknown_decision`), never a decision.

## Receiver API

`receiveIntentsRequest(route, jsonText)` and `receiveIntentsResponse(route, httpStatus, jsonText, expectation)` are async; results are recursively frozen. The captured context is mandatory: `{request}` for list and `{request, proposal}` for decide, where `proposal` is the one the caller admitted from an earlier list answer. A rejected or indeterminate decide reply carries no conversation, command or binding of its own, so the retained proposal is what binds it to the request's conversation and approver. The receiver refuses, with `IntentsResponseError.code`:

- non-canonical or oversized JSON, unknown fields, wrong shapes (`INTENTS_JSON`, `INTENTS_LIMIT`, `INTENTS_SHAPE`);
- an error status that does not match the closed table, or a `field` on a 502 (`INTENTS_STATUS`);
- a response that does not answer the captured context (`INTENTS_CORRELATION`): wrong conversation, more items than `limit`, duplicate delivery ids, a cursor that is not the last full page entry, a proposal whose `commandSha256` is not the canonical hash of its command, a proposal outside the requested conversation or tenant, a task.create proposal with non-canonical arguments or attachments, a decision for another proposal or hash, a `phase` that contradicts the decision/execution evidence, a decide answer for another delivery, proposal, hash or decision, a decision by an approver other than the proposal's required approver or dated before the proposal, an approvable action the handler could not have approved, or `rejected` returned for an approval;
- an execution outcome that is not the executor's own for the retained task.create command (`commands-0.2/execution-intent.mjs` `outcome` and `task-create-validation.mjs`): receipt command id, hash, idempotency key, scopes and stable tenant/actor/conversation/run binding must match (attempt, worker and fence may differ), the receipt must be `succeeded` with no source transaction and an exactly spelled `completedAt`, and the task result's title, client and due date must equal the immutable arguments. Document outcomes instead require the actual native-document receipt, native0.2 version, same tenant/actor/conversation and scopes, requested parent, docx format/MIME, matching object/inspection bytes/hash and valid source evidence. The real output run is preserved. Source request hashes are not equated with the projected output request hash; backend preparation/approval/publication owns that correspondence.

Timestamps are read as their producers read them: historical proposal and decision times are any schema-valid date-time ending in `Z` that `Date.parse` accepts (so `â€¦:00Z` without milliseconds is admitted, as `approval.mjs` admits it); receipt/task-result times and native document proposal/version times use the canonical exact spelling.

## Deliberate limits

- The canonical owner lists approvable actions. `document.draft`0.2 carries exact selected preparation/request/context hashes, base version, title and docx format with no attachments. Approval remains the actual Core decision; only confirmed artifact publication produces an executed result. Pending/uncertain publication remains indeterminate. Memory and filing execution shapes are not invented.
- For task.create the receiver admits only a succeeded receipt (the executor's outcome check requires it); `executed` therefore means the executor's own observed success for the retained command.
- Generation output is independent of the checkout layout: the bundle is built with symlinks preserved so inputs read `node_modules/<package>/â€¦`, and the generator refuses output that embeds a parent-relative, drive-letter or home-directory path.
- The wire shapes were a local proposal in the handler; this contract freezes the shapes the handlers produce at the base commit and nothing else. Mounting, Core decision-owner wiring, membership and persistence qualification remain handoff work.
- The request ceiling (4096 bytes) is this contract's own; response and deadline ceilings are the product-access maxima, and a composition may configure lower ones.

Generation uses the canonical esbuild/json-schema-to-typescript backend (`node generate-intents.mjs`, `--check`); there is no offline backend. Existing schemas, generators, distributions and wire versions are unchanged. Adding the export is additive; whether it bumps the package version is a release decision outside this branch.

The same generated distribution exports `@capiro/meri-contracts/routines-application`, the browser receiving boundary for the existing routines prepare, approve, list and reconcile routes. A chat schedule proposal includes its original request and canonical proposal so approval never reconstructs requested choices from effective limits. Preparation and hydration do not apply a schedule. Approval is explicit and uses fresh session, current policy, model budget and retention checks; an old HTTP read deadline is not a proposal expiry. Unknown effects use the same request and existing read-only reconciliation owner. The list exposes projection and observed timing/counts, not a recoverable original policy: editing or resuming requires complete reviewed choices.
