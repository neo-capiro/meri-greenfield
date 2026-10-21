# Conversational write dependency contracts for dot

These are **proposals requiring the existing owners**, not implemented routes, permissions or migrations. Verified producer source is Core `138c04373b18bb730b1ad0f8f9338342f628b8c6`; UI inspection pin is frontend `5c784e3e46114816ba57db17ad7a2c2013a8d81a`. Exact source references and current DTOs are in `../coordination/reports/CONVERSATIONAL-WRITE-PRODUCER-MAP-20261019.md` and its reference manifest. Meri's new codecs/preparers reuse current contracts; native approval/issuance and discovery holds remain closed.

## Current artifact authority for greenfield conversations

The existing generic artifact endpoint supports PowerPoint and typed ZIP formats. Its current `ApplicationAuthorityController.contextPorts().conversation` delegates to `loadOwnedActiveClioConversation`, which queries `tx.clioConversation` for the authenticated tenant/user and a nonarchived row. It does not read Meri's conversation journal. A greenfield conversation UUID alone cannot satisfy this custody. The same `/context` lookup underlies the current authority and action-session rechecks; a healthy artifact endpoint is therefore insufficient live proof.

Smallest Core change: reuse dot's existing Meri identity/admission helpers to resolve authoritative greenfield conversation custody for these existing authority routes, retaining the current request/response DTOs and authenticated principal. The owner must prove the exact conversation, tenant/actor, selected client, active/nonarchived state and current run/policy/fence from the authoritative Meri journal/admission snapshot; then preserve current prospect, client visibility, portfolio and security-wall checks before and after async reads. Do not synthesize native conversation rows, accept model membership, or bypass current artifact checks. Ambiguous, absent, revoked, archived or unsupported custody must refuse. This is a read-only authority extension; no artifact effect or approval is inferred from it.

Affected Core files: `auth/application-authority.controller.ts`, `context/application-authority-resource.helpers.ts`, the already owned Meri identity/admission helpers and their tests. Existing `/api/clio/application-authority/{context,artifact}` bodies and receipt correlation remain unchanged unless dot explicitly versions the contract. No mutation/migration is proposed for this authority lookup; if the current snapshot lacks required fields, its owner must supply a reviewed projection rather than guessed data. The complete history-release route is separate and is not duplicated here.

## Pending memory submission

Operation: approved `memory.propose`, preparing `save_memory`. Keep the existing Meri approval proposal and Core `/api/clio/approvals/native/{record,decision,revoke,execution}` DTOs. Extend their finite action policy only after agreeing the source binding below. The current Core parser enum alone is insufficient: record, issuance and receiver services actually reject non-task commands.

Approved arguments are the existing closed `MemoryProposeArguments`; no tenant, actor, permissions, scopes, URL or arbitrary destination is admitted from model input. Context is exactly `{binding,conversationClientId}`, selected by the trusted conversation owner. Scope/client/key/TTL normalization and `commandSha256` come from the canonical command codec. Firm proposals require the current canonical firm-proposal authority; selected-client membership is insufficient.

The only acceptable effect producer is existing W8:

```text
POST /api/clio/memory/review/submit
request  = {candidate: MemoryCandidate, candidateSha256: SHA256}
response = {candidateId: UUID, candidateSha256: SHA256, reviewId: UUID, accepted: true}
```

`MemoryCandidate` is the existing governed candidate schema, including origin `{kind:'conversation',conversationId,runId,commandId,commandSha256}` and its durable idempotency key. Meri's command result stays `{candidateId,commandSha256,status:'pending'}`. Saving does not publish memory: owner/shared/correction review remains separate.

**Required binding decision:** the existing rev3 execution token hashes the legacy `save_memory` tool body. That body is not W8's candidate. Dot must define an action-specific signed correlation to the approved canonical command and W8 candidate origin/content/scope/key/TTL, verified by the producer at its transaction boundary. The exact candidate bytes, assigned identity and idempotency must remain owned and durable, not synthesized by an SDK tool. This is a contract extension; Meri does not accept a task token or ordinary bearer as substitute approval. After agreement, extend Meri `executionBodyBinding`/issuance correlation and action routing together with the Core receiver. Do not simply widen the action allowlist.

Identity: current authenticated tenant/actor, approved original run and exact executor attempt/fence/policy/allocation, selected client, current decision and revocation/expiry. W8's attended bearer plus verified service identity are already composed by `memoryComposition(context).commandSourceFor`; no marked candidate bearer or legacy HTTP fallback is permitted.

Idempotency: native issuance replays its durable issuance; Meri claims the command and reserves budget before the pending producer. W8 replays exact candidate ID/hash/idempotency. Conflicting payload, stale/revoked decision, foreign client/scope, expired authority or changed target refuses. A lost acknowledgement remains UNKNOWN and is reconciled through existing candidate status and journals; it is never resubmitted as a new candidate.

Affected Core owners: `native-approval.service.ts`, `native-approval-metadata.ts`, `native-execution.service.ts`, `meri-execution-capability.ts`, `meri-execution-receiver.service.ts`, `meri-memory-receiving.service.ts`, and the existing admission/consumption DTOs/tests. Meri receiving owners: `native-authority/execution-{capability,issuance,composition}.mjs`, `current-authority-adapters.mjs`, intent approval/discovery and the existing governed memory composition. The metadata projector must admit the new canonical command while preserving exact original hashes and all current admission checks.

Migration: none for Meri's new metadata codec/preparer; existing journal schemas suffice. Core must determine whether its task-specific consumption schema needs a reviewed additive discriminator/result representation. If so, central migration allocation and a concrete schema review are required; no migration ID is allocated here.

## Exact-version client filing

Operation: approved `artifact.file`, preparing `save_chat_attachments`. The existing `ArtifactFileContext`, `ArtifactFileArguments`, `ObjectReference` and result schemas remain canonical. Source and destination are current owner selections; model URLs, filesystem paths, guessed native conversations and bare attachment IDs never establish custody.

The missing owner is the production adapter for the existing Meri `attachments.register` port. Proposed **internal owner operation**, with endpoint/transport naming left to Core:

```text
registerApprovedArtifactVersion request = {
  approval: {proposalId, commandId, commandSha256, idempotencyKey},
  binding: RunBinding,
  destination: ArtifactFileDestination,
  versionId: UUID,
  object: ObjectReference,
  filename: string,
  mimeType: allowed ArtifactVersion MIME,
  bytes: exact binary bytes
}
existing Meri port response = {attachmentId: UUID, sha256: SHA256, bytes: positive integer, expiresAtMs: integer}
```

The registration owner authenticates identity and verifies the current approved command itself; `approval` and `binding` are correlation inputs, not authority. It checks destination client/conversation, exact immutable version/object/hash/size, MIME and filename against authorized artifact custody; it reuses the existing canonical storage/document writer. The returned digest and size must describe the actual stored bytes. Preserve a durable command/object-version mapping so an uncertain registration can be read back without uploading again. The current Meri port lacks approval identity in its input, so composition must bind that exact approved command in its trusted closure after the durable claim; do not add model fields to bypass it.

Core must choose a genuine custody mapping accepted by the existing filing source, or a capability-only branch through the same canonical document writer. Generic `/api/clio/attachments` is insufficient: it creates an unbound upload. Existing `save_chat_attachments` requires owned native conversation and a live user message containing the attachment. Do not manufacture those rows or equate native and greenfield conversation UUIDs.

**Required signed correlation:** actual attachment IDs are assigned after the command claim. The current task-era `commandSourceBody(command,[])` hash cannot bind their nonempty final body. Agree and verify a durable registration mapping/digest against the exact approved immutable references and destination, and bind the actual effect to it. Update Core and Meri correlation together; signing an empty attachment list is not acceptance.

Idempotency: claim and budget precede registration. Each approved object/version maps to one durable registered source object, then one canonical destination document. Same key with different bytes/destination conflicts. A lost registration/source/settlement acknowledgement remains UNKNOWN; successful siblings are not silently repeated. Existing per-file `saved|pending|failed` and `pending|partial|indexed` results must remain distinct. A durable document ID/location/indexing receipt is required for saved state; HTTP acknowledgement alone is insufficient.

Refusal cases: unapproved/changed/expired/revoked command; inactive tenant/actor/client; changed source/destination or version/hash/size/MIME; missing/archived/suppressed custody; unsupported content; unavailable store; conflicting duplicate; partial effect; uncertain receipt. Existing canonical error domains should be retained; new transport error names require owner agreement.

Affected Core owners: native approval/issuance/receiver files above, `meri-client-filing.service.ts`, `client-document-writer.service.ts`, attachment custody/storage and their controllers/DTOs/tests. Meri: the existing artifact resolver/source plus an owner-bound registration adapter and the agreed execution correlation. No storage implementation is duplicated. A durable registration mapping may need an additive Core migration; dot must assess existing attachment/document idempotency columns and allocate any required migration centrally. No Meri DDL is added by this lane.

## General immutable-program analysis

Typed table analysis is connected through the existing product-budget artifact path and returns an immutable ZIP draft. It accepts only the existing declarative pipeline schema. It does not accept code, host paths or arbitrary URLs.

General `format:'sandbox'` still needs the accepted native owner's actual `{port.execute,verifyAdmission}` and immutable admission `{receiptSha256,manifestSha256,imageDigest}` for the exact program/input/output/binding/scope/deadline/byte intent. The existing boundary request/response schemas and manifest/image checks remain authoritative. The executor now accepts explicit `namespace:'product'`; qualification remains its historical default. No production runtime binding or admission receipt is manufactured. Outputs remain inspection/publication pending until their respective owners provide durable evidence.

Acceptance: qualified sandbox/image/isolation and resource limits, immutable object fetch/output custody, deny host shell/network escape, current scope/expiry/revocation, cancellation/process cleanup, product-budget settlement and uncertain acknowledgement replay. Native analysis and exact-image checks remain unrun.

## Conversation approval UI

Frontend PR98's conversation notice is informational and cannot submit a decision. Dot must add the presentation adapter to the existing Meri intent list/decide routes, rendering the exact retained action/content/scope/destination/expiry/hash and an explicit user decision. Request remains `{conversationId,deliveryId,proposalId,commandSha256,decision:'approved'|'rejected'}` under current authenticated identity. Neither display nor model text may approve.

Show awaiting approval, rejected, expired/revoked, executing, durable completed/pending and indeterminate/UNKNOWN distinctly. Reconnect reads the durable list; an uncertain acknowledgement does not create a second proposal or execute a new command. Memory submission must be labelled pending review; attachment partial/indexing states and artifact draft/pending states must remain truthful.

Affected frontend files: `features/meri/conversation/ConversationTurn.tsx`, the conversation transport/state adapter and shared write display components, coordinated by dot. Existing task-specific `ProposalPanel.tsx`/`workflow-port.ts` are not generic native approval owners. No frontend files were edited. Real authenticated browser acceptance remains required after separate authorized integration.
