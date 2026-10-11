# Portfolio follow-up tasks: contract checkpoint

## Verdict and source binding

**BLOCKED for the retained Quick log task promise.** No task controls or new task panel were implemented. ENG-tasks_create, ENG-tasks_list and ENG-tasks_update remain unresolved implementation rows; historical API availability is not frontend acceptance.

- Frontend isolated branch: `codex/portfolio-tasks-20261011`, checkout `C:/dev/meri-portfolio-tasks-20261011`, starting commit `560939590894a1f3bc2c75f3c2fb4ea30ebc1678`.
- Authoritative backend: freshly fetched `origin/main` at `fd8765ec01d292013758606204f2c9d886cd31c1`. Reads used Git objects, preserving the unrelated dirty primary checkout.
- Shared policy: `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, contains fetched remote `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; machine-map date 2026-09-30. BOOTSTRAP, AGENTS and frontend implementation standards read.
- Baseline IDs preserved from the read-only audit copy; no original workbook/matrix changed.

## Current Figma evidence

The design-to-code skill was loaded before design-context calls. Full design context and screenshots were inspected on Prototype — Capiro 3.1 in file `Zc2dEN5aLU47dVdsewDmiJ`.

| Node | Current behavior | Task implication |
| --- | --- | --- |
| 411:42992; focused child 411:43158 | Quick log Commitment + task: “Add a follow-up task to the Planner”; “Internal only. Never shown to the client”; task, assignee, due, optional strategy-step link | Explicit Planner and strategy promise; Engagement CRUD alone does not satisfy it |
| 411:64383 desktop Debrief | Recap, Action items, Intelligence gathered; regenerate/edit/export/approve | Action items are paragraph text, including literal square characters, with no task identity/status control |
| 411:64274 mobile Debrief | Same action-item content as text | No separate follow-up CRUD panel |
| 680:142817 Edit debrief | One free-text saved Debrief field; approval/sharing separate | Do not parse prose into invented task receipts |
| 679:142610 meeting detail/Prep | Follow-ups section is paragraph content | No task creation control |
| 411:64308 source chooser; 682:142797 manual source; 689:142613 debrief PDF | Source/review/document presentation | No independent task form found in these inspected roots |

This is evidence for the inspected roots, not a claim that every Figma node was searched. A whole-page metadata attempt failed with `Transport closed`; that failed call is not absence evidence.

Screenshots are preserved under task outputs `evidence/portfolio-task-contract-20261011/`: `figma-quicklog-followup-411-43158.png`, `figma-desktop-debrief-411-64383.png`, `figma-mobile-debrief-411-64274.png`, `figma-edit-debrief-680-142817.png`.

## Verified Engagement CRUD

Source: `apps/api/src/engagement/engagement.controller.ts` CreateTaskDto/UpdateTaskDto, handlers at 2828–2844; `engagement.service.ts` listTasks at 4891, createTask at 5629, updateTask at 5676.

| Method/path | Accepted input | Receipt/behavior |
| --- | --- | --- |
| GET `/api/engagement/tasks?clientId=UUID` | Controller forwards only optional clientId | Unpaginated array; excludes canceled by default; dueDate ascending, createdAt descending; includes client summary and meeting ID/subject. No total/cursor. Internal status/openOnly/dueBefore/limit options are not forwarded by this handler |
| POST `/api/engagement/tasks` | Optional UUID clientId, meetingId, contactId, mailThreadId, ownerUserId; title string 1–240; optional description string and ISO date dueDate | Created EngagementTask row. Title/description trimmed; blank description becomes null; creator comes from actor context |
| PATCH `/api/engagement/tasks/:id` | Optional title, nullable description/ownerUserId/dueDate; status todo/in_progress/done/blocked/canceled | Updated row. No expected revision or public operation key |

`dueDate` persists as PostgreSQL DATE (`apps/api/prisma/schema.prisma` EngagementTask). The DTO accepts IsDateString and service parses Date; a frontend date-only field would avoid inventing time/zone semantics. There is no objectiveId, activityId, strategyStepId, Planner task ID or Quick log operation receipt in these contracts. The internal sourceType/sourceId uniqueness is restricted to trusted internal creation and is not public REST idempotency.

### Authorization evidence and limits

The controller requires RolesGuard/standard_user and verified tenant context. The task handlers have no external-action decorator or runtime registry entry; the EngagementRuntimeGuard permits handlers with no external metadata. These are database task operations, not provider writes.

Ordinary task list/update/create use `PrismaService.withTenant`, which scopes the model query to tenant. The original SQL `apps/api/prisma/migrations/20260503020000_engagement_manager_core/migration.sql` has tenant-only engagement_tasks_isolation at 553; its client/meeting/contact/user foreign keys reference individual IDs, not a same-client compound association. Searching subsequent migrations did not find an ordinary-task client-wall policy. Creation has no same-client/meeting/owner-membership validation in this route path. Ordinary update returns early from the specialized research-portfolio task access helper.

The stronger `assertOwnedResearchPortfolioTask` policy applies only to sourceType `research_portfolio_action`. `readMeriTasksExact` is a distinct internal method with wall checks, not called by GET tasks. Global interceptors inspected carry tenant governance scope or persistence failure state; they do not add the missing ordinary-task client/meeting ACL. No live access test was run, so this is source verification, not a production authorization exploit or acceptance claim.

A frontend readable-client check is necessary for display but cannot repair server write authorization or establish privacy for other callers.

## Canonical Planner is a different contract

Source: `apps/api-strategy/src/planner/planner.controller.ts`, `planner.service.ts`, `planner.validation.ts`, `planner-links.service.ts`; public shape in `packages/strategy-verifier/src/planner.ts`.

- GET `/strategy-api/planner/tasks` supports projectId, mine, search, cursor, archived, parentId; returns `{items,nextCursor}` with a 100-item page. No public client/date filters. The five-item queue is not the complete feed.
- POST `/strategy-api/planner/tasks` takes `{data: Partial<PlannerTaskData>}`; PATCH adds required current `version`. Data uses name, assigneeId, dueOn (strict valid YYYY-MM-DD), optional wall-clock times/zone, memberships/collaborators, clientId/meetingId and other canonical task fields. Status is todo/in_progress/blocked/done; archive is distinct.
- Controller uses TenantGuard and PlannerContextGuard (rejects tenant impersonation). Project/task ACLs govern private/team access. A task without project memberships is accessible through its owner, assignee and collaborators; “internal” must not be relabeled creator-only/private-to-self.
- `PlannerLinksService.validate` calls canonical client and meeting GETs using the caller Bearer token, preserving those APIs' current wall/privacy decision. It validates each response status; it does not compare returned meeting.clientId to selected clientId.
- No strategy-step/objective/activity lineage field is present in PlannerTaskData. Unknown task data fields are rejected.
- The separate CSV import route has an importKey receipt bound to data/time. It is an import contract, not authority to repurpose CSV time semantics as Quick log idempotency. Ordinary POST lacks an operation key.

The Portfolio Master Agenda already reads the canonical strategy Planner task feed via `calendar/feeds.ts`; no duplicate Planner client or alternate task domain should be introduced.

## Smallest dependency to resolve with owners

Responsible canonical owners: Quick log orchestration/integration owner and Strategy Planner service owner; Engagement/security owner if the old Engagement CRUD remains exposed. Direct service ownership is not established by this discovery.

1. Confirm Quick log creates a **canonical Planner task**. Keep the existing Planner ACL; explicitly define permitted assignee/internal visibility rather than claiming ordinary Engagement rows are private.
2. Define the optional strategy-step ID and canonical authorized resolver. It must validate the selected client's current objective/strategy membership and retain typed provenance; no description-string or customValue encoding should impersonate this link.
3. Provide a reviewed Quick log orchestration operation binding actor, tenant, readable client, optional meeting/contact/mail, source record and exact task intent. Reuse canonical Planner creation, validate same-client associations, and return real `{logReceipt, taskReceipt}` with explicit partial/unknown outcomes. Decide atomic/outbox semantics across Core/Engagement and Strategy storage; a combined screen does not by itself justify a new universal endpoint.
4. Define a durable operation key/readback for this orchestration before offering retry after unknown completion. Ordinary POST should never be automatically repeated after dispatch.
5. Use existing versioned Planner PATCH for edit/complete where current product navigation is retained; establish the exact Planner destination and optional client/lineage query requirements with its owner. This task does not authorize a broader Module rollout.

If product instead wants a new meeting Engagement-task section, it needs an explicit retained design/product decision plus same-client/meeting write authorization and documented tenant-visible semantics. It cannot be introduced solely to close the three audit counts.

## Checks and delivery

- PASS: clean isolated frontend base; fresh policy/backend ref reads; current DTO/controller/service/Prisma/RLS/runtime source inspection; current Figma context and screenshot inspection.
- NOT RUN: type/lint/unit/browser/build checks, because no product source changed. No synthetic UI or fixtures were added as substitute acceptance.
- NOT RUN: live task CRUD/provider operations. No backend files, data, migrations, public contracts, Quick log code or other agents' resources changed.
- The deliverable is this dependency report. The three audit rows are **BLOCKED pending canonical orchestration/lineage/authorization decision**, not implemented.
