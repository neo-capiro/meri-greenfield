# Conversational write producer map and Core dependencies

Status: **read-only dependency handoff; no new authority or production qualification**.

Meri exact inspection base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`.
Report branch base: `19569ab611391d725705018ddb3af64a97565657`, verified descendant of that base. The memory producer, filing resolver, execution-composition and command contract files discussed below are unchanged between those commits.
Core exact source: `138c04373b18bb730b1ad0f8f9338342f628b8c6` (combined middleware commit).
Frontend UI source: PR98 frozen `5c784e3e46114816ba57db17ad7a2c2013a8d81a`.
Do not infer current frontend behavior from its older default branch.

Owned change: this report and its source-reference manifest only. Core, frontend, shared Meri implementation, frozen build inputs and infrastructure were not changed. No API action, provider, live database, image build or deployment was run.

## Findings that determine integration order

1. **PowerPoint draft generation can reuse Core's existing generic artifact authority.** The Core authority route does not restrict format to Word/Excel. Its `artifact.generate` permission is draft generation authority, not document filing or arbitrary analysis qualification.
2. **Memory has a real pending-only Core producer.** Reuse W8 `/api/clio/memory/review/submit`; every scope stays pending. The new conversational action must never call personal legacy `save_memory`, which can publish inline.
3. **Native command approval and execution remain task-create-only in actual services.** Broader action enums in a parser are not support. Memory and filing need an explicit coordinated Core extension and Meri preparation/execution composition.
4. **Generated artifact filing lacks a production exact-version registration/custody producer.** A generic legacy attachment upload does not satisfy the existing filing resolver or the native source's sent-user-message requirement.
5. **Frontend PR98 displays conversation approvals but cannot decide them.** The separate follow-through UI is task-specific. Reuse Meri's existing list/decide intent API through a new display adapter, without moving approval authority into UI.

## Existing approval and execution contracts

All four Core routes below use an attended approver's live native session bearer, a verified internal service identity and at least standard-user role. A marked control credential or model-supplied actor is not a substitute.

| Fixed Core POST | Exact body | Result and current implementation |
| --- | --- | --- |
| `/api/clio/approvals/native/record` | `{proposal,decision,approver,binding}` | `{decision,checkedAtMs,revoked}`. `NativeApprovalService.record` checks authenticated actor equals required approver and command actor, full original binding, expiry, a single policy revision and Meri's prepared metadata. **Line67 rejects action other than task.create.** |
| `/api/clio/approvals/native/decision` | `{proposalId,commandSha256,binding}` | Same receipt; absent/foreign/mismatched stable tenant/actor/conversation/run returns `decision:null`. Stored decision is immutable. |
| `/api/clio/approvals/native/revoke` | `{proposalId,commandSha256,approver,binding}` | Append-only revocation under proposal execution lock; decision row retained; repeat is idempotent. |
| `/api/clio/approvals/native/execution` | `{proposal,executorBinding,requestId,allocation,allocationSha256,qualification,runDeadlineMs}` | `{execution,credential,checkedAtMs,expiresAtMs}`. Issuance reads actual admitted run/allocation, current stored decision/revocation, member and current client wall, stores issuance then signs. **Only task.create with no attachments and closed task arguments.** |

`proposal` is closed: `{proposalId,command,commandSha256,createdAt,expiresAt,requiredApprover}`.
`command` is closed: `{contractVersion:'0.1.0',commandId,binding,action,arguments,attachments,scopes,idempotencyKey}`.
Binding includes tenant, actor, conversation, run, attempt, worker and writer fence. The decision includes proposal/hash, decision, decidedAt, expiresAt, approver and policyRevision.

The metadata owner is `NativeApprovalMetadataVerifier` (`native-approval-metadata.ts`). It reads the Meri-owned `meri_read_delegation_facts.run_facts_v1` projection; requires exactly one current run, at most 64 prepared approvals and no overflow; selects by proposal ID; compares exact command ID/hash/idempotency key and original metadata's created/expires/approver/binding/scopes. A request body alone cannot prepare an approval.

The actual execution receiver in `meri-execution-receiver.service.ts` has `MERI_EXECUTION_TOOL='create_task'`. It rechecks issuance ledger, newest attempt, decision/revocation, admitted run/budget grant, membership, scopes/client wall and exact signed source body. Task effect and `clioMeriExecutionConsumption` completion result commit atomically; retries return the stored result after current checks.

Meri has matching task-only restrictions:
- `native-authority/execution-capability.mjs:34`: `EXECUTION_COMMAND_ACTIONS=['task.create']`.
- `native-authority/execution-composition.mjs:61-62`: one task-create descriptor and task-create options.
- `commands/approval-metadata/task-kind.mjs` and `owner.mjs`: task metadata owners, no memory/file metadata owner.
- `execution-issuance.mjs` verifies the Core token, current decision and exact allocation/qualification, then installs its execution grant before returning a receipt.
- `commands/durable-executor.mjs` and command journal own claim, budget, current authority and durable outcome. A new source must use those owners, not bypass them.

## memory.propose / save_memory

Canonical Meri contracts already exist in `packages/contracts/commands-0.2/{memory-propose.schema.json,memory-propose-validation.mjs}`. Raw content is trimmed, nonempty and at most 4000 characters, key at most 120 characters, scope personal/client/firm (user_private aliases personal), TTL capped at 365 days; client scope must equal the current selected conversation client. Result is exactly `{candidateId,commandSha256,status:'pending'}`; it is not publication proof.

The genuine Meri producer is `apps/control/memory/producer.mjs`, composed by `product-ports/memory.mjs` with `createMemoryCommandSource`. It journals one immutable sourced candidate in `meri_memory.candidates`; replays the same idempotency key/candidate/hash; reads status to reconcile uncertainty; reports unknown/unavailable honestly. Conversation-origin retention is checked. Keyed proposals can become review-only corrections of a pinned existing target.

Existing Core W8 routes:
- `POST /api/clio/memory/review/submit` body `{candidate,candidateSha256}`; receipt `{candidateId,candidateSha256,reviewId,accepted:true}`.
- `POST /api/clio/memory/review/status` body `{candidates:[{candidateId,candidateSha256}]}`; receipt `{reviews,checkedAt}`, with per-candidate pending/approved/rejected/withdrawn/not_found status and scoped publishedMemoryId.
- `POST /api/clio/memory/read_target` and `/find_by_key` preserve scoped target/hash semantics.

Core `meri-memory-receiving.service.ts:112-165` verifies service identity, authenticated tenant/proposer, candidate hash and reserved keys; current client wall for client scope; duplicate ID/hash replay; same transaction inserts the **pending** candidate and submission. Additions never inline-publish at any scope. Corrections use the existing immutable-version owner, recheck exact scoped target under row lock and reject unsupported correction TTL. Candidate origin accepts a conversation UUID as provenance; W8 does not claim that UUID is a native legacy clioConversation.

A candidate contains schema/candidateId/tenant/proposer/kind/scope/client/content/key/ttl/corrects/reason/sources/origin/idempotency/createdAt. Conversational origin pins `{kind:'conversation',conversationId,runId,commandId,commandSha256}`. The current Meri memory broker uses the member's **attended live action-session native bearer**, bounded by session/credential expiry and exact selected client, plus rotated service identity. W8 is not currently an approved-execution-capability receiver.

Core publication remains a separate memory review decision:
- Own personal addition: `POST /api/memory/candidates/:id/owner-decision` `{decision:'approve'|'reject'}`.
- Shared additions: current Core authorized review workflow, not ordinary proposer self-publication.
- Corrections: existing `/api/memory/version-candidates/:id/approve` or `/reject` (reason for rejection); lifecycle gate and current owner policy apply.
Meri rereads status before claiming a published memory ID. A native command approval to **submit** a pending candidate must not stand in for memory publication review.

**Do not route the new action to legacy save_memory.** `meri-tools.service.ts:3038-3079` can auto-commit personal memory. The legacy HTTP command adapter refuses personal proposals for this reason, but no production native execution composition currently selects the genuine memory command source.

### Smallest explicit Core proposal for memory

Extend existing native record/issuance/receiver policy with a finite memory-propose action; do not merely remove task-only guards. Reuse W8 for the pending effect and acknowledgement. Agree the signed source correlation before implementation:
- The current execution token's source-body digest is derived from legacy `save_memory` projection; W8 instead receives an immutable candidate and candidate hash. Those bytes are different.
- Add a versioned, finite action-to-receiver mapping for W8 (fixed path, never model URL), and bind exact candidate ID/hash plus origin command hash to the approved immutable command and selected scope.
- Require current approved decision, revocation, admitted run/fence/policy, active member/client wall, reservation/budget and idempotency before candidate insertion/release; reuse existing W8 transaction and submission deduplication.
- Preserve pending result semantics and subsequent publication review. If Core elects to retain the attended bearer W8 path, formally bind it behind the same approved command executor with no substitute direct SDK write path.

This is a contract proposal for dot; no action was enabled.

## artifact.file / save_chat_attachments

Contracts `commands-0.2/artifact-file*` already pin a trusted destination client/conversation and 1–10 immutable ObjectReferences. Destination conversation must equal command binding; no cross-tenant refs or duplicate object IDs; result files correspond exactly to selected object/hash/version. Persisted files need documentId/location/indexingStatus/reused; partial/failed/pending states retain reasons.

Existing Core native effect:
`POST /api/clio/tools/save_chat_attachments` flat `{clientId,conversationId,attachmentIds}` -> `MeriClientFilingService.saveAttachments`.
- Destination checks exact current client (nonarchived + memory wall) and native owned/unarchived clioConversation; a non-null native conversation client must match.
- Each attachment must belong to the actor/tenant and an **existing live role=user clioMessage in that native conversation** (`meri-client-filing.service.ts:118-140`). Guessed IDs, unsent uploads and orphaned edit attachments refuse.
- Canonical `ClientDocumentWriterService` -> Engagement owner retains runtime policy, bytes/storage, lifecycle/scanning/indexing, idempotent `meri-chat-attachment:<nativeAttachmentId>`, and per-file result.
- Result: tool/status/generatedAt/clientId/clientName/location, saved/pending/failed counts and files with attachmentId/fileName/status plus persisted metadata. Partial results are real; do not collapse them to success.
This legacy effect is not a native approved-execution receiver and is absent from Option B read authority.

Meri `apps/artifacts/filing.mjs` already resolves exact versions from its canonical version store, uses current authorized download bytes, checks whole ObjectReference, calls an injected `attachments.register`, verifies `{attachmentId,sha256,bytes,expiresAtMs}`, then re-inspects every version/current retention before release. Once any registration attempt starts, failure is `ARTIFACT_EFFECT_UNKNOWN`, not a no-effect refusal.

There is no production `attachments.register` owner in the inspected composition. Existing native multipart `POST /api/clio/attachments` uploads an unbound clioAttachment and returns extraction metadata; it does **not** return the required digest/version/destination custody receipt or attach the row to a sent native user message. Do not fake a message or equate greenfield and legacy conversation IDs to make the save source accept it.

### Smallest explicit Core proposal for filing

Extend native approval metadata/record/issuance with an explicit artifact-file action and its exact immutable refs/destination. Allocate with dot a server-owned exact-version registration/custody contract using the existing canonical document writer; endpoint naming is intentionally not invented here.
- Registration must bind authenticated tenant/actor, approved command/proposal/idempotency, exact destination, immutable artifact object/version/hash/size and bytes.
- Return a verifiable exact receipt and retain a durable mapping for retries; mapping is a selector, never access authority.
- Either supply genuine native attachment/conversation custody accepted by the existing source, or add a capability-only filing branch that reuses the canonical writer without fabricating native user-message rows.
- Bind the actual post-registration source body to the execution grant. Existing `executionBodyBinding(command)` hashes `commandSourceBody(command,[])`; that cannot bind the final nonempty native attachment IDs. A typed registration digest or deterministic server custody lookup must be signed/rechecked.
- Recheck current object/retention/destination rights at effect and result release. Maintain per-file idempotency and durable partial/unknown reconciliation for S3/database work. Never automatically rerun successful siblings after a partial response.

## PPTX and analysis draft authority

Current Core `POST /api/clio/application-authority/artifact` is mounted, bearer+verified service identity+standard-user gated. Body is closed:
`{contract:'capiro.meri-artifact-authority.v1',observationId,conversationId,clientId,intent,requestSha256}`.
It verifies current native identity, owned conversation, prospect scope, selected client visibility/current context and rereads; receipt pins identity/context/authority revisions, exact principal/client/intent/request digest and at most 60 seconds expiry.

`application-authority.ts:273-310` returns generic allowed artifact.download/generate/inspect/preview-publish/revise operations; it does not inspect file format or restrict PPTX/analysis. Its request digest is echoed, so Meri must still bind/check the actual request locally. Draft authority is not source/evidence qualification or filing authority.

Meri presently restricts public document run options to create_word/create_excel (`artifacts/run-options.mjs:40`). Local PPTX and declarative ZIP analysis engines/contracts already exist. PPTX can use generic draft authority when the approved Meri document bridge admits the operation. General sandbox analysis separately requires its real manifest/image/admission/isolation qualification; a generic artifact permission is insufficient. Do not route new analysis to unrestricted Core legacy code/datasets sandbox or represent it as the same contract.

## Frontend review contract at PR98 frozen source

- `features/meri/conversation/ConversationTurn.tsx` renders approval-required notices with expiry and explicitly says decisions cannot be made there.
- `features/meri/actions/ProposalPanel.tsx` and `shared/meri-actions/workflow-port.ts` are task-specific: title/dueDate/taskTitle, request execution, no approval authority.
- Meri already owns `POST /api/conversations/intents/list` and `/decide`; the latter exact body is `{conversationId,deliveryId,proposalId,commandSha256,decision:'approved'|'rejected'}`. UI can present the exact retained proposal and submit that explicit decision through current session authorization. It must preserve decision/execution uncertainty and selected-client lifetime; UI hints do not establish grants.

Coordinate frontend edits with its owner. Source UI evidence is not a live browser test.

## Acceptance needed for coordinated implementation

Focused tests should exercise real producers/contracts with deterministic transport/DB stand-ins, then actual integration at one receiving point:
- wrong/foreign client, conversation, actor, ref/version/hash; changed prepared metadata; unapproved/rejected/revoked/expired decision; stale attempt/fence/policy/allocation; missing authority; budget denial;
- memory: pending for all scopes, W8 legacy-body rejection, exact candidate replay/conflict, unavailable review and correction target drift, publication remains separate;
- filing: no registration before command claim, exact bytes receipt, refusal of unsent/native-mismatched custody, revocation during registration, per-file saved/pending/failed and unknown-effect replay;
- draft artifacts: unchanged authority binding across create/revise/download, draft status/preview truth; PPTX output rendering; qualified analysis branch only;
- UI: exact proposed command display and hash, explicit decision submission, no duplicate request after uncertainty, current context disposal.

This lane ran source inspections and documentation validation only. No production tests, provider/database execution, build, deployment or UI E2E qualification is asserted.
