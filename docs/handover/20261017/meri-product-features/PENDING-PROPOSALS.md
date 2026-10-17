# Pending Meri product proposals - safe-stop handoff

These are unimplemented follow-ups, source observations and remaining qualification holds. They authorize no source change, merge, activation, test run, service, credential, database operation, migration or deployment. Use the sibling [Fable handoff](FABLE-HANDOFF.md) for the source/evidence inventory and the [preferences PostgreSQL qualification handoff](../../../qualification/user-preferences-20261017/README.md) for the failed window, cleanup, denial and portable-wrapper record. Later owners must review exact source and obtain the approvals required for their proposed action.

## Memory-review consumer - unimplemented and stopped

Read-only source inspection used actual Core commit `635486fd21f0fb0f6893241f47dbfef7d343d849` and the canonical PR40 checkpoint `5b3955b7c357f727835386b09db181125367a51f`. These pins are source references, not deployment or live-endpoint evidence. Relevant owners are under `apps/api/src/memory/`: `memory-review.controller.ts`, `memory-review-inbox.controller.ts`, `memory-review-summary.controller.ts`, `memory-candidate-review.service.ts`, `memory-review-inbox.service.ts`, `memory-review-workflow.service.ts`, `memory-review-switch.ts`, `memory-settings-review-readiness.service.ts` and `memory-review-admin-policy.ts`.

Core has API-private review interfaces, including `ReviewableMemoryCandidate`, `MemoryReviewDecisionResult`, `MemoryReviewInboxPage` and `MemoryReviewDetail`. No public `@capiro/shared` review DTO is available for this proposed consumer. Do not import private Core implementation or copy its DTOs into Meri/frontend as a replacement contract. Core owner `01a14534-418c` explicitly **canceled the proposed additive public DTO before worktree creation, branching, edits, installation, testing or pushing**. That canceled request produced no new contract or implementation authority. Restarting it requires new owner coordination; this handoff does not resume it.

### Existing native Core surface

Core's HTTP bootstrap applies the `/api` prefix. These are native authenticated Core routes, separate from standalone Meri's POST-only proposal surface and from task/gateway command transport:

| Route | Existing behavior to preserve in a future consumer |
| --- | --- |
| `GET /api/memory/review/candidates` | `{enabled,candidates}` pending-review projection, with workflow, unapproved proposal content and server-computed action capabilities. |
| `GET /api/memory/review/inbox?view=&cursor=&limit=` | Paged work queue; supported views are `needs_my_review`, `submitted_by_me`, `all_pending`, `blocked`, `history`. Preserve `nextCursor`; an empty or disabled page does not prove absence. |
| `GET /api/memory/review/inbox/summary` | Inbox counts with `enabled` and `truncated`; do not turn truncated counts into exhaustive claims. |
| `GET /api/memory/review/summary` | Separate Settings review-readiness summary. Do not assume it has the inbox-summary DTO. |
| `GET /api/memory/review/inbox/candidates/:id` and `/api/memory/review/inbox/requests/:id` | Protected detail, proposal, feedback visibility, timeline, eligible reviewers and controlling-memory metadata. Broad inbox/notification routes do not supply the proposal body. |
| `POST /api/memory/review/candidates/:id/approve` | Existing current-authority decision owner; success wraps `{ok:true,...decisionResult}`. |
| `POST /api/memory/review/candidates/:id/reject` | Same owner, with a required nonblank normalized `reason`; success wraps `{ok:true,...decisionResult}`. |
| `POST /api/memory/review/candidates/:id/request-changes`, `/assign`, `/revise`, `/resolve-conflict` | Distinct workflow/revision/conflict operations. They must not be approximated by approve/reject or exposed from guessed payloads. |

The controllers use Nest `@Post` without a `@HttpCode(200)` override: successful POSTs use **201**, while GETs use 200. A future receiver must preserve actual statuses and variant bodies rather than reuse a 200-only Meri success assumption. Decision results differ for standard candidates, immutable correction/restore/contradiction candidates and learning-signal conflicts. There is no basis here to invent an approval endpoint, idempotency protocol or generic normalized decision DTO.

### Gates and current authority

- Controllers require server-resolved native tenant context and `RolesGuard` minimum `standard_user` access. A future adapter must use the approved native credential path and current Core identity; browser/model-supplied tenant, actor, role, client or capability hints cannot supply authority.
- The review decision surface requires the exact `MEMORY_CLIENT_REVIEW=enforce` parser plus governed lifecycle and authorization enforcement. The Settings/inbox owner additionally evaluates lifecycle/enforcement for the exact tenant through `MEMORY_GOVERNANCE_TENANTS`. These are existing gates, not switches this handoff permits changing. Disabled lists explicitly report `enabled:false`; protected detail can return 404, and disabled decision handling refuses with service-unavailable behavior.
- The inbox re-reads active tenant membership and role from Core in its transaction. Candidate/detail/action owners enforce tenant, current grant/revocation/expiry, ethical-wall, client state, assignment, revision lineage and applicable segregation-of-duties policy. Standard reviewers require their current assignment and grants and cannot review their own proposal. The existing admin policy permits an active authorized `user_admin` or `capiro_admin` to decide, including their own proposal; assignment is routing, not a new admin authorization prerequisite.
- Render the exact response's server-computed capabilities (`open`, `approve`, `reject`, `requestChanges`, `revise`, `reassign`, `withdraw`, and the applicable conflict capability) and re-read them after changes. Capability sets and projections differ by route. Do not derive permissions from a role label, carry a flag across owner/candidate/context changes, or treat an old visible button as execution authority. Decision owners recheck authority themselves.

### Partial decisions and proposed unknown fence

`MemoryCandidateReviewService.approve`/`reject` invokes the canonical candidate/version effect and then separately awaits `workflow.completeDecision`. These calls do not establish one encompassing transaction. An effect may have completed before a later workflow error or missing HTTP acknowledgement. HTTP failure therefore cannot establish rollback, and disappearance from a pending-only list cannot establish approval.

A future consumer needs an explicit unknown state tied to the captured current owner, candidate and requested decision. After dispatch without a trustworthy correlated result, fence repeat approve/reject actions and use protected, read-only current detail/history to reconcile; do not automatically repeat a mutation or silently claim success. Preserve terminal/revision distinctions and show an unresolved outcome when the available reads cannot prove it. This client fence and public receiving/correlation contract are **proposals only**, not implemented features or new approval authority.

This is a review-consumer gap, not proof of a standalone Meri M2 producer. Existing Core review rows/routes, own-pending-proposal reads, Settings submissions or Meri's local proposal journal do not establish that a new Meri `memory.propose`/correction reached the canonical Core producer with matching actor, scope, lineage and durable receipt. Keep producer wiring/qualification and review-consumer work separate; infer neither from the other.

## Other proposals and holds

| Follow-up | Current boundary and required next decision |
| --- | --- |
| Preferences PostgreSQL fixture correction | **NOT APPLIED.** Propose replacing `inet_server_addr()::text AS address` with `host(inet_server_addr()) AS address`, keeping the exact host/port/database guard. PostgreSQL inet-to-text includes the netmask. The original before-hook failure is consistent with this definite comparison defect; the scrubbed diagnostic did not independently isolate every setup failure. No real PG case passed. Review a new exact source checkpoint and resolve the recorded approval-review denial before any retry. The portable wrapper refuses the known original expression; it does not repair or run it. |
| Task-update activation | The reviewed opt-in source is not activation authority. `sourceEnabled` remains **false** and task source activation remains held. Preserve shipping candidates, current authority/approval owners and explicit source gate; do not change a deployment value or add credentials from this document. |
| Independent task/preferences stacks | Review and deliberately compose the independent task-update stack (Meri PR100/102 and frontend PR61) with the preferences stack (Meri PR108/111 and frontend PR62 follow-up). Do not assume separate branch acceptance proves a merged candidate, shared-runtime compatibility, contract/vendor provenance, build output or live behavior. Preserve exact shipping pins until the responsible owner selects and reviews integration. |
| Schedules/routines | Existing intent/tool/workflow pieces do not complete scheduled-run authority or runtime operation. Trusted schedule context/proposal ownership, durable occurrence persistence/dispatch, approved worker/runtime composition and recovery/qualification remain explicit gaps. No scheduler, background job or automation is started by this handoff. |
| Appearance, notifications and default client | Saved personal preference values and local appearance/density preview are distinct from global application theming/density, notification delivery and default-client auto-selection. Those consumers and behavior decisions remain future work. Do not describe persisted controls as proof those downstream behaviors are active. |
| Document lifecycle | Existing lifecycle/artifact source requires its own integration and qualification of immutable versions, previews/download serving, filing, retention/recovery and authorization. Later lifecycle qualification must follow accepted scope and exact owner boundaries. It does not authorize a full Office editor, authenticated third-party workflow, browser takeover or device bridge. |

## Stop boundary

This file records pending work only. No memory-review consumer, public Core DTO, PG fixture correction, task activation, stack merge, routine dispatch or additional lifecycle behavior was implemented while preparing it. No Core/source production file, test, service, database or shipping setting was changed or exercised. The destination handoff owner must reconcile source pins and historical claims in the linked evidence before proposing the next bounded action.
