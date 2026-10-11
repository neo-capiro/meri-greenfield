# Prospect proposal contract candidate

Status: **inactive design candidate, not an existing endpoint or implementation**. Contract marker `portfolio-proposal-candidate-1` intentionally does not claim the frozen Meri 0.1.0 contract. No frontend adapter, route, feature public export, admission handler, registration, migration or capability enables this candidate.

## Ownership and first deliverable

Portfolio owns the prospect proposal record, its source/input lineage and read projection. Workspace owns document generation, editing, private-draft ACL, immutable versions and export. The existing Workspace editor remains the only editor. Meri owns orchestration; this candidate must use its approved public generation boundary once the owner identifies it. The older File01 owner is paused and is not the new greenfield Meri owner. Root owns this coordination.

Implement PROS-028 first: choose an explicit published blueprint version, review inputs, authorize and pin the prospect and saved brief, durably bind one Workspace draft/job, display actual generation state, open the existing editor and reload the saved proposal from its prospect. Send, stage undo and no-reply reminders are separate dependencies below. No mail or charge occurs during creation.

## Proposed public HTTP surface

These route names are proposals, not callable APIs:

| Method / route under `/api/business-development/prospects/:prospectId` | Purpose                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /proposals`                                                       | Authorized saved proposal list, stable cursor, exact tenant/prospect identity and `nextCursor`; omit inaccessible drafts without leaking their titles/counts.                                                   |
| `POST /proposals`                                                      | Strict `ProposalCreateCandidate` body; authenticated tenant/actor come only from trusted context. Return 202 only after the required Workspace binding, source receipt and durable job are verified and stored. |
| `GET /proposal-requests/:requestId`                                    | Owner-scoped durable admission recovery; return exact admitted receipt or explicit `binding_unknown`/known rejection. No provider or generation dispatch.                                                       |
| `GET /proposals/:proposalId`                                           | Authorize both prospect and private Workspace draft; return exact lineage, approved inputs, current saved version and actual generation state.                                                                  |

No default-enabled capability is proposed. Missing generation/Workspace binding, unverified source consumption, unavailable prospect scope or absent commercial-terms policy must return **503 `proposal_binding_unavailable`** with a concrete reason. No fake queued job, generic draft fallback or Meri auto-send prompt is allowed. A rejected admission may leave an audited rejected request record; it must not create a proposal, document, provider job or charge.

## Candidate request and receipt

Strict runtime shapes and inferred TypeScript types live in `apps/portfolio-web/src/features/prospects/proposals/persistence-contract.ts`. They are intentionally unimported by product code.

- `requestId`: one UUID for this reviewed request, retained across a lost response. Server uniqueness is `(tenant_id, actor_user_id, request_id)`. Canonical input hash includes all pins and exact inputs; replay with any changed field returns 409, not the prior success.
- `expectedProspect`: exact `updatedAt` plus server-defined identity hash. Under the same prospect lock, recheck tenant, active membership/BD flag and role, current identity and lifecycle. Converted, dismissed or conflict-excluded admission rules require owner agreement; no new rule is silently inferred from general prospect PATCH behavior.
- `blueprint`: explicit blueprint ID, published version ID/number and definition hash. Server re-fetches the exact tenant/global published version. No mapping from mutable template ID, product or display name. Never silently take latest.
- `brief`: exact BD brief/version ID/number, sections hash and source snapshot hash. Required when scope or appendix is selected. Re-fetch the saved version for this exact tenant/prospect; preserve every section, citation and original source snapshot. A refreshed/current brief must not replace the reviewed version mid-flight. This is not a Workspace draft ID.
- `inputs.fee`: nullable for a draft; when supplied, preserve decimal string, explicit currency and monthly/fixed frequency exactly. No float conversion, rounding, arithmetic, default price, charge or billing request. The lexical validator is not financial authorization: the owning service must supply approved currencies, precision and valid commercial terms before admission.
- `inputs.startDate`: nullable date-only value; never converted through UTC to a different calendar date. Required fields must be resolved before send; draft placeholders are not sendable values.
- `inputs.team`: either excluded, or exact selected member IDs plus reviewed text. Recheck same-tenant active membership; pin text and source membership observation. Do not generate or infer team roles/availability.
- Successful admission returns exact tenant/prospect/initiating actor, proposal/operation IDs, the reviewed request and typed `workspace_draft` binding with draft/run/source-receipt IDs and input/source hashes. Frontend validates exact scope and every reviewed field before showing queued. Schema validation alone does not prove the backend consumed those sources; acceptance must test that port.

## Required Workspace port

New proposal code cannot write Workspace/Meri tables or copy its generation loop. A reviewed public port, implemented by that owner, must provide:

1. `admitProposal(context, operationKey, authoritativeSnapshot)`: validate tenant/actor and private-draft ownership; idempotently create one draft plus one durable generation job; bind published blueprint, exact BD brief evidence, source snapshot and unchanged commercial/team inputs. The immutable snapshot is server-fetched. Browser-authored source bodies and `clientId = prospectId` are forbidden.
2. Return an authenticated, exact operation/input/source receipt only after durable binding. Its worker must **actually consume the pinned snapshot and blueprint**, initialize declared sections, and reject unavailable consumption rather than merely persist unused JSON. Actual source/version hashes used must be visible in the generation result. Empty sections cannot become a successful generated proposal.
3. `observeProposal(operationKey)`: fresh authorized GET-only observation of this exact draft/run/source receipt, including known rejection or unknown outcome. Tenant-only run lookup is insufficient for a private draft. Retry of failed sections requires fresh ACL and exact previous run/content revision; never automatically repeat admission or unknown generation.
4. `snapshotProposal(draftId, expectedRevision)`: lock and create one immutable Workspace version with content hash and source lineage, without modifying unrelated content. A version ID must refer to this draft and tenant. This is the reviewed export/send basis.
5. `exportProposalVersion(draftId, versionId, expectedHash)`: server-render exactly that immutable version, returning content hash, byte size, media type and a version-bound attachment receipt. Never render the mutable working draft after review or silently attach a newer version.

The candidate read states distinguish queued/active, partial/failed/cancelled/needs-input and complete. Complete requires a durable immutable version and hash. Retained older content on partial failure remains visibly partial. Warnings remain visible. A run's string status or generic draft UUID alone proves none of these conditions.

Canonical editor target is typed `{kind:'workspace_draft',draftId}` and uses the separately validated application destination plus `/workspace/:draftUuid`. Preserve actual kind/ID; `/workspace/documents/:documentId` is HillDay. Current source also supports legacy `/workspace/draft/:draftId`; no new route or editor is needed. Do not put IDs or prompt text into `meriPrompt` launch URLs: the identified current entry auto-sends and is not an editable-starter contract.

## Smallest backend module/storage allocation proposal

New files only, pending root/owner approval:

- `apps/api/src/business-development/proposals/proposal.contracts.ts`: strict HTTP boundary and actor-free request/receipt types.
- `proposal-admission.service.ts`: prospect/source authorization and input validation, durable admission state transitions; no provider/model loop.
- `proposal.repository.ts`: same-tenant locking, canonical hash and idempotency, exact proposal/operation/source records.
- `proposal-workspace.port.ts`: mandatory owner-provided interface, no default success adapter. Missing adapter returns 503.
- Focused candidate tests for authorization, concurrency, changed-input replay, source/version drift and lost cross-service acknowledgement. No current controller/module/service/Prisma schema is edited by this discovery slice.

Proposed **UNALLOCATED / UNAPPLIED** durable storage: proposal identity scoped by `(tenant_id, prospect_id, id)`; immutable request/source snapshot and hash; actor-scoped request/operation state with unique idempotency key; exact Workspace binding/version receipts. All references are typed and tenant-bound. Do not fake cross-service foreign keys or bypass the Workspace owner's persistence. Cross-service admission uses a durable request/outbox and provider-authoritative observation; an unknown acknowledgement freezes redispatch until reconciled. A 404/empty list is not proof that nothing was created.

No migration IDs, deployment, auth/CORS settings, new Meri scope enum or Workspace table changes are allocated here. Root must establish the canonical Workspace/generation owner and bridge API before registration.

## Separate dependencies for PROS-029 / 030 / 031

**PROS-029: reviewed send.** Dedicated server operation binds exact proposal + immutable version/PDF hash, optional exact brief appendix, current authorized prospect contacts/recipient addresses and an explicitly selected connected mailbox owned by the initiating user. Recheck these before dispatch. Generic `mail/send` accepts ClientPerson/client IDs and selects the most recently updated owned mailbox; it has no prospect/version/request binding. Reusing its provider adapters requires owner allocation and provider-specific receipts, not a frontend sequence of unrelated calls.

The send operation must persist the full reviewed request before dispatch. Known refusal differs from `sending`/`outcome_unknown`; no blind resend after timeout. Persist provider/message/thread correlation and original mailbox. If provider delivery succeeds and local stage/history storage fails, reconcile local state without resending. An explicit retry may reuse the same durable send operation only when the authoritative provider outcome permits it. No claim of a database transaction around a remote email send.

**PROS-030: stage/history and Undo.** Confirmed send commits one prospect send-history event and a stage transition to the current catalog's exact Proposal identity. Keep prior stage plus a monotonic transition revision. Undo is scoped to that send's transition with compare-and-set against the current revision; refuse intervening moves/conversion/lifecycle changes. Undo changes the stage only; it never unsends the message or deletes send history. Current versionless prospect PATCH cannot provide that guarantee. Pending Figma-stage mapping/deployment remains separately owned by root.

**PROS-031: reply-aware reminder.** Needs a durable reminder keyed to the confirmed send, exact owned mailbox and provider conversation/message correlation, plus authoritative incoming reply observation. Define five calendar days versus elapsed 120 hours, user's time zone, trigger delivery, cancellation and sync-lag behavior with the product/backend owner. Do not use generic nextActionDueAt or schedule a new email as a conditional no-reply reminder. Missing/delayed mailbox sync cannot prove no reply; expose unknown coverage and hold the conditional action.

## Acceptance gates before activation

- Exact source/blueprint/brief and approved input consumption demonstrated through the owner port, not fixtures alone.
- Tenant/prospect/draft ACL, departed membership, missing flags, changed identity, wrong receipt, stale version, concurrency and duplicate/lost requests tested against real persistence.
- Restart and cross-service timeout recovery verified; unknown operations never dispatch again automatically.
- Complete/partial/failure/edit race and exact immutable version/PDF bytes demonstrated; placeholders cannot be sent.
- Provider sandbox evidence for send/status/history/Undo and correlated reply/reminder semantics; no customer sends for validation.
- Existing Workspace editor deep link and isolated signed-in browser verified. No product completion claim until these gates pass.
