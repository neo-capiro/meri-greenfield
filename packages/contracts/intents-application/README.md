# Conversation intents application contract

Proposed `urn:meri:intents-application:0.1.0` browser boundary for the two conversation write-intent routes owned by `apps/control/intents/http.mjs` and `approval.mjs` (PR190 base `29379ab1`). It is derived from those handlers' actual behavior. It grants no approval or execution authority and is not deployment, membership or runtime-mount evidence.

- `POST /api/conversations/intents/list` `{conversationId, after?, limit?}` returns `{conversationId, intents, next}`: the durable intent history of the caller's own conversation.
- `POST /api/conversations/intents/decide` `{conversationId, deliveryId, proposalId, commandSha256, decision}` returns `{status: rejected|executed|indeterminate, deliveryId, proposalId, decision, outcome?}`.
- Errors are `{error:{code, outcome?, field?}}`; statuses are the product-access vocabulary plus `INTENT_APPROVAL_ERRORS`. `outcome` is `NOT_DISPATCHED`, `UNKNOWN` or `RESULT_NOT_RELEASED`. `field` is absent on 502.

## What is derived from what

`apps/control/intents/application-protocol.mjs` re-exports the real route paths, the real intent error table, the real product error table, the journal failure codes and `APPROVABLE_ACTIONS`; the generator reads those constants, so a handler change that is not reflected in the contract fails `--check`. Canonical shapes (`ApprovalProposal`, `ApprovalDecision`, `CommandReceipt`, `TaskCreateResult`) are copied from `meri.schema.json` and `commands-0.2/task-create.schema.json` as local definitions; no new command, memory or filing shape is defined here.

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

`decision` is the canonical `ApprovalDecision`, `null` (none recorded) or `'unavailable'` (owner not readable). `execution` is `{state:'executing'}`, `{state:'unknown'}`, `{state:'completed', outcome:{receipt, result}}`, `null` or `'unavailable'`. `phase` is a reading of the durable owners (`awaiting_approval`, `approved`, `rejected`, `expired`, `executing`, `completed`, `unknown`, `unknown_decision`), never a decision.

## Receiver API

`receiveIntentsRequest(route, jsonText)` and `receiveIntentsResponse(route, httpStatus, jsonText, {request})` are async; results are recursively frozen. The captured request is mandatory. The receiver refuses, with `IntentsResponseError.code`:

- non-canonical or oversized JSON, unknown fields, wrong shapes (`INTENTS_JSON`, `INTENTS_LIMIT`, `INTENTS_SHAPE`);
- an error status that does not match the closed table, or a `field` on a 502 (`INTENTS_STATUS`);
- a response that does not answer the captured request (`INTENTS_CORRELATION`): wrong conversation, more items than `limit`, duplicate delivery ids, a cursor that is not the last full page entry, a proposal whose `commandSha256` is not the canonical hash of its command, a proposal outside the requested conversation or tenant, a decision for another proposal or hash, a `phase` that contradicts the decision/execution evidence, a receipt for another command, a decide answer for another delivery, proposal, hash or decision, or `rejected` returned for an approval.

## Deliberate limits

- Only `task.create` executes (`APPROVABLE_ACTIONS`). `execution.outcome` is therefore typed `{receipt, result:TaskCreateResult}`. Memory and filing outcome shapes are not invented; widening them needs a new contract version once Core defines the native approval/receiver payloads.
- `executed` does not assert success: the caller reads `receipt.outcome`.
- The wire shapes were a local proposal in the handler; this contract freezes the shapes the handlers produce at the base commit and nothing else. Mounting, Core decision-owner wiring, membership and persistence qualification remain handoff work.
- The request ceiling (4096 bytes) is this contract's own; response and deadline ceilings are the product-access maxima, and a composition may configure lower ones.

Generation uses the canonical esbuild/json-schema-to-typescript backend (`node generate-intents.mjs`, `--check`); there is no offline backend. Existing schemas, generators, distributions and wire versions are unchanged. Adding the export is additive; whether it bumps the package version is a release decision outside this branch.
