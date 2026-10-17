# Lane 3: conversation write intents

| | |
|---|---|
| Owner | Fable, lane-3 session |
| meri-greenfield branch | `fable/meri-lane3-write-intents-20261017`, base `ce2da186` (PR #133 head; root `59856683`) |
| Draft PR | [#137](https://github.com/neo-capiro/meri-greenfield/pull/137) into `fable/meri-first-chat-receiving-20261017`; held out of integration until the first shipment is live (as lanes 2 and 5) |
| Source commit | `c7ef9e9b` (code and tests; this file is updated after it) |
| Status vocabulary | as in `../BACKLOG.md`. Everything here is **source**. Nothing is integrated, qualified, deployed or live-verified by this lane. |

## Scope

Conversation write intents end to end: the model prepares a proposal (or a draft), the user approves it in Meri, the approved
command executes under fresh authority, and the proposal, decision and result are durable and readable as conversation history.
Lane 6 owns `apps/control/intents/document-preparer.mjs` and its test. Lane 1 owns runtime composition
(`apps/runtime/**`, pinned `conversation-runner.mjs`), infra and the material/issuer files.

## Inventory at `ce2da186` (before this lane's changes)

All paths are in meri-greenfield. "Complete" means complete as source with focused synthetic tests; none of it runs anywhere.

### Proposal (prepare-only) path

| Capability | Status | Evidence |
|---|---|---|
| `meri_intents` SDK server: one tool per intent name, PreToolUse correlation, one-time token bound to operation + argument hash, per-run ceiling 8, never `readOnlyHint` | complete | `apps/worker/conversation/intents/server.mjs:43-98` (hook 54-64, handler 66-86), `tools.mjs:9,22-28` |
| Intent catalog (11 ledger rows; 6 owner-backed, 5 unavailable with reasons; `list_scheduled_tasks` excluded as a read) | complete | `apps/worker/conversation/intents/catalog.mjs:22-36,51-57` |
| Delivery identity (tenant, actor, conversation, SDK session, tool use; not run/attempt) | complete | `server.mjs:30` |
| Worker admission of prepared results (prepare-only shapes, same tenant/actor/conversation, current scopes, unexpired) | complete | `apps/worker/conversation/intents/prepared.mjs:25-48` |
| Closed result texts, UNKNOWN never retryable | complete | `apps/worker/conversation/intents/results.mjs:7-37` |
| Runtime entry gated by policy flag `governedIntents` (default off) and port availability | complete | `intents/runtime.mjs:35-61`, `capabilities/policy.mjs:17-19`, `activity.mjs:36,56`, `options.mjs:49` |
| Control intent mount: availability, journal-first prepare, result release under fresh authority | complete | `apps/control/intents/mount.mjs:26-74`, `result-release.mjs:27-60` |
| Replay journal (claim before owner call; PREPARED/FAILED/UNKNOWN; CONFLICT) | complete | `apps/control/intents/journal.mjs:16-46` |
| PostgreSQL journal store `meri_intents.preparations` (claim/settle) | partial: no read-by-key or per-conversation list | `apps/control/intents/postgres-journal.mjs:34-61`; DDL `apps/control/intents/migrations/0001_intent_preparations.sql` (source only, centrally allocated, **not applied**) |
| Command preparer (`create_task` only) | complete | `apps/control/intents/command-preparer.mjs:17-44` |
| Schedule preparer | partial: no trusted schedule-context owner (P-INT-6) | `apps/control/intents/schedule-preparer.mjs:14-36` |
| Document preparer (Word/Excel immutable drafts) | complete, **lane 6** | `apps/control/intents/document-preparer.mjs:14-32` |
| Production port: runner → control transport for `readAvailability`/`prepare`, and per-run mount composition | **absent** (P-INT-9) | `apps/runtime/conversation-runner.mjs:76` passes no `governedIntents`; no runtime file imports `apps/control/intents` |
| Approval-metadata owners for task.update / memory.propose / artifact.file | absent (P-INT-7) | only `apps/control/commands/approval-metadata/owner.mjs:12` (`createTaskCreateApprovalMetadataOwner`) |

### Approval, execution and durable result

| Capability | Status | Evidence |
|---|---|---|
| Approval guard: current `ApprovalDecision` for the exact `commandSha256`, approver = required approver, policy revision = current authority, unrevoked, unexpired | complete | `apps/control/commands/approval-context.mjs:4-16` |
| Command executor: fresh `command.execute` authority and approval at first check, before effect, at effect, release, settlement and final; journal claim; budget reserve/settle; UNKNOWN on loss | complete | `apps/control/commands/executor.mjs:28-73` |
| `executeApproved` (metadata re-read, then executor) | complete | `apps/control/commands/tool-interface.mjs:46-64` |
| Durable command result (`meri_command_journal`: CLAIMED/UNKNOWN/OUTCOME) | complete as source | `apps/control/commands/postgres-command-journal.mjs:22-71`; DDL `apps/control/commands/migrations/0001_commands.sql` (**not applied**) |
| Core command source (`POST /clio/tools/{create_task,...}`) | complete as source | `apps/control/commands/source-http.mjs:13,56`; Core route `POST /api/clio/tools/:name` exists in capiro-backend |
| HTTP approve/execute route **for conversation intents** | **absent** | the only execute route is the action-followthrough one (`apps/control/action-application/index.mjs:38-44`, `/api/action-followthrough/execute`), which takes a browser-held proposal for its own follow-through session, not a conversation intent |
| Recording the user's approval decision | **absent in Meri and in Core** | nothing in Meri mints or forwards a decision; lifecycle only reads one (`apps/control/conversations/lifecycle/service.mjs:26,56-57`, port `approvals:{read,readDecision}` in `apps/runtime/product-applications.mjs:32`). Runtime README lists native `approval/read`, `approval/decision` (`apps/runtime/README.md:47`) as **required provider contracts**; capiro-backend has no implementation of either (searched `feat/core-preview-cleanup-integration-20261017`, `feat/core-preview-native-gets-20261017`, `dot/app-remaining-deployment-plan-20261017`). |
| Fresh execution capability for an approved conversation intent | absent for intents | the action host has `issueExecution` (`apps/control/action-host/index.mjs:6`, `admitted-runs/mount-core.mjs:46`), bound to its own session; no conversation-intent broker |
| Prepared-proposal surfacing to the UI (P-INT-8) | absent | UIEvent 0.1.0 is frozen; worker receipts (`server.mjs:77,83`) are never published |
| History of intents, decisions and results | absent | no read over `meri_intents.preparations`; no join to decisions or the command journal |
| Gateway write adapters | none for intents | `apps/gateway/local-action/**` is the synthetic-local action gateway (`gateway.mjs:7`); command writes go through the control command source above, not the gateway |

### Migrations relevant to this lane

`apps/control/intents/migrations/0001_intent_preparations.sql`, `apps/control/commands/migrations/0001_commands.sql`,
`apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql`: all source-only, **none applied** (applied are
conversations 0001–0011, 0013, 0015–0017 and budget 0001–0002). The write path cannot be durable in capiro-dev until all three are
applied under lane 1's approved change.

## What this lane built (source)

The missing Meri half of the path is now source with focused tests: the user's decision on a prepared proposal, its approved
execution under the existing approval control and fresh authority, and a history read over the durable owners. **No new migration,
contract, lockfile or shared file was needed or changed**: the decision lives with Core, the result in the existing command journal,
the proposal in the existing intent journal.

```
model --meri_intents tool--> worker server --port--> control mount --> command preparer --> approval-metadata owner
                                                       (journal PREPARED)                     (immutable proposal, unchanged)
user --POST /api/conversations/intents/decide--> approval owner   (membership gate: fresh admission, recheck before release)
   1 read the PREPARED proposal under the caller's own tenant/actor/conversation
   2 exact ids, unexpired, client scopes still visible, approver = requiredApprover
   3 Core approval/record (Meri never writes an ApprovalDecision)
   4 rejected: stop.  approved: issueExecution (fresh capability, same run)
   5 executeApproved -> executor: CURRENT decision (Core approval/decision) + fresh command.execute authority at every phase
   6 result = meri_command_journal OUTCOME (durable)
user --POST /api/conversations/intents/list--> preparations + Core decision + command journal -> phase per intent
```

| File | Change |
|---|---|
| `apps/control/intents/approval.mjs` (new) | `createIntentApprovalOwner({journal,decisions,issueExecution,commandOptionsFor,outcomes,now,limits,enabled})` returns `{decide,list}`. Every refusal before an owner call is `NOT_DISPATCHED`; a lost decision ACK is `APPROVAL_DECISION_UNKNOWN`/`UNKNOWN`; executor failures are mapped by where they happened (before the executor; inside it before its claim; `COMMAND_OUTCOME_UNKNOWN`; or after it returned, `RESULT_NOT_RELEASED`). Disabled by default. |
| `apps/control/intents/http.mjs` (new) | Two routes on the existing membership-gated product HTTP owner (`product-access/http.mjs`): `POST /api/conversations/intents/list` and `POST /api/conversations/intents/decide` (effect route). Identity, tenant and clients come only from the gate. |
| `apps/control/intents/native-approvals.mjs` (new) | `createNativeIntentApprovals({call})`: `record` calls native `approval/record`; `readDecision`/`getCurrent` call native `approval/decision`, so the executor's approval guard and the lifecycle's approval-wait read the same Core decision. `createCommandJournalOutcomes({journal,contextFor})`: read-only command-journal result per proposal. |
| `apps/control/intents/compose.mjs` (new) | `composeIntentApprovals(...)`: inert production wiring (PostgreSQL intent journal store, native decisions, outcomes, HTTP app, and the `approvalStore` the executor must use) for lane 1's control startup. |
| `apps/control/intents/postgres-journal.mjs` | `read({key})` (one delivery or null, never claims) and `list({conversation,after,limit})` (creation order, keyset cursor, at most 50) on `meri_intents.preparations`. |
| `apps/control/intents/journal.mjs` | The store port admits the optional `read`/`list` methods (one line). |
| `apps/control/intents/test/fixture.mjs` | Memory store `read`/`list`; `commandComposition` takes `approverActorId` and `approvalStore`; the synthetic result-release authority now expires relative to the caller's clock. It used the command fixture's `NOW`, which made `schedule-preparer.test.mjs` fail 0/7 at base. |
| `apps/control/intents/test/approval.test.mjs` (new), `postgres-journal.test.mjs` | 10 new cases plus 2 new store cases (see Tests). |

Not touched: `document-preparer.mjs` and its test (lane 6), `apps/runtime/**`, infra, material/issuer files, contracts, migrations,
lockfiles and frontend.

## Capability status after this branch

| Capability | Source | Integrated | Qualified | Live |
|---|---|---|---|---|
| Prepare (`create_task` proposal; Word/Excel draft) | complete | no (PR held) | no | no |
| Decide route (approve/reject, own conversation) | complete | no | no | no |
| Approved execution under the current decision and fresh authority | complete (the existing executor, now reachable from a conversation intent) | no | no | no |
| Durable result | complete (existing command journal) | no | no (migration unapplied) | no |
| History of intents, decisions and results | complete (list route) | no | no | no |
| Schedule intents | preparer only; no approval/execution path (P-INT-6) | no | no | no |
| task.update / memory / attachment-filing intents | absent (P-INT-7) | | | |
| Independent-reviewer approval (approver is not the conversation owner) | refused (`APPROVER_REFUSED`) by design | | | |
| Approval after the preparing run ended, executed in a successor run | refused (`INTENT_CROSS_RUN`): the command journal binds a command to its original run | | | |

## Core dependencies (dot), exact

None of these exists in capiro-backend today (checked `feat/core-preview-cleanup-integration-20261017`,
`feat/core-preview-native-gets-20261017` and `dot/app-remaining-deployment-plan-20261017`). Nothing here is stubbed as live: without
them the routes answer `APPROVAL_OWNER_UNAVAILABLE` or `EXECUTION_OWNER_UNAVAILABLE` with `NOT_DISPATCHED`.

1. **P-INT-10: `approval/record` (new native provider operation).** Input `{proposal: ApprovalProposal, decision: "approved" or
   "rejected", approver: Identity, binding: RunBinding}`; output `{decision: ApprovalDecision, checkedAtMs, revoked: false}`. Core must:
   - verify that the approver is the authenticated current user and an eligible approver under current policy;
   - verify the proposal against the stored approval metadata (`meri_approval_metadata`, by `proposalId` and `commandSha256`);
   - set `policyRevision` to the current command policy revision (the executor's guard compares it with the fresh `command.execute`
     authority);
   - be **idempotent per proposal**: a repeat answers the stored decision, never a second or flipped one.
2. **`approval/decision`** (already a required provider contract, `apps/runtime/README.md:47`). Input `{proposalId, commandSha256,
   binding}`; output `{decision: ApprovalDecision or null, checkedAtMs, revoked}`. The executor's approval guard reads it at every
   phase; the lifecycle's approval-wait and the history route read it too.
3. **Execution broker for conversation intents (`issueExecution`).** `({proposal, principal})` returns `{execution:
   CommandExecutionRequest, credential, checkedAtMs, expiresAtMs}`. The `executorBinding` must be on the proposal's own
   tenant/actor/conversation/run (a fresh attempt and fence are allowed), with a current `command.execute` capability for exactly that
   proposal. The semantics match the action host's `issueExecution` (`apps/control/action-host/README.md`), but for the conversation
   owner rather than an action session.
4. **Existing:** `POST /api/clio/tools/create_task` (the Core route exists) behind `commands/source-http.mjs`, and the current-authority
   ports the executor already requires (`verifyCapability`, `currentRun`, `authorizeBusiness`, `authorizeSources`).

## Other dependencies

- **Lane 1 (composition, live):**
  - call `composeIntentApprovals` in the control startup and mount `app` on the application origin;
  - give the command executor `intents.approvalStore`;
  - build the per-run intent mount and the runner-to-control port for `readAvailability`/`prepare` (P-INT-9). This is lane 1's change
    because `apps/runtime/conversation-runner.mjs` is pinned;
  - turn on `governedIntents` per tenant;
  - apply `intents/0001`, `commands/0001` and `approval-metadata/0001` under the approved change (all centrally allocated, none applied).
- **dot (frontend):** the approval card and history UI against the two routes (wire shapes in `apps/control/intents/http.mjs`, local
  proposal P-INT-11), and the frontend proxy allow-list for `/api/conversations/intents/*`. UIEvent surfacing (P-INT-8) remains an
  option, but the card no longer needs it: the list route provides the proposals.
- **Migrations:** none requested; this lane allocated no migration ID.

## Tests

Host: Windows 11, Node 24, no PostgreSQL; node_modules via junctions to `C:\dev\fable\meri-source`. One file at a time:
`MERI_REVIEW_SOURCE_ROOT=<worktree> node --test --test-concurrency=1 <file>`. All synthetic: no PostgreSQL, Core, SDK or network.

| File | Base `ce2da186` | This branch |
|---|---|---|
| `apps/control/intents/test/approval.test.mjs` (new) | — | 10/10 |
| `apps/control/intents/test/postgres-journal.test.mjs` | 8/8 | 10/10 |
| `apps/control/intents/test/mount.test.mjs` | 10/10 | 10/10 |
| `apps/control/intents/test/result-release.test.mjs` | not run | 13/13 |
| `apps/control/intents/test/schedule-preparer.test.mjs` | 0/7 (fixture clock) | 7/7 |
| `apps/control/intents/test/migration-source.test.mjs` | not run | 2/2 |
| `apps/control/intents/test/document-preparer.test.mjs` (lane 6) | 2/4 | 3/4 (the remaining failure is lane 6's and unrelated) |
| `apps/worker/conversation/intents/test/intents.test.mjs` (uses the control fixture) | not run | 10/10 |

`approval.test.mjs` covers:
- **Approved end to end:** one Core record; the executor re-reads the current decision at every phase; one effect; the durable result
  appears in history; a repeat replays with no second effect.
- **Rejected:** no execution, and the decision cannot be flipped.
- **No execution without an approved, current authority:** no decision owner, revoked decision, revoked capability, stale fence and
  broker refusal each leave zero fetches and zero journal rows.
- **Refusals before any owner call:** wrong ids; another actor, tenant or conversation; identity in the body; expired; another
  approver; disabled; not prepared.
- **Cross-run** execution is refused.
- **UNKNOWN handling:** a lost decision ACK is UNKNOWN, then exactly one effect; an indeterminate executor is UNKNOWN and history still
  shows the durable result.
- **History:** paging, an unavailable decision owner, and content withheld after lost client access.
- **HTTP:** gate, content-free errors and the UNKNOWN outcome.
- **Composition:** inert and disabled by default; the native adapter refuses foreign or absent decisions.

Reverted-guard proofs (guard removed, `approval.test.mjs` fails; restored, 10/10): cross-run guard 9/10, approver guard 9/10,
exact proposal-id/hash guard 9/10.

## Acceptance (live gate, lane 1 / dot)

1. With `governedIntents` on for one tenant, ask Meri to create a task. The reply says a proposal awaits approval; no task exists.
2. After a reload, the list route shows the proposal as `awaiting_approval`.
3. Reject it: no task, and history shows `rejected`. Approve a second proposal: exactly one task in Capiro, and history shows
   `completed` with the receipt.
4. Approve again, or retry after a dropped reply: still one task.
5. Revoke the user's client access between prepare and approve: approval is refused and no task is created.

## Remaining tasks

1. Core (dot): P-INT-10 `approval/record`, `approval/decision`, and the conversation-intent execution broker.
2. Lane 1: composition and port (P-INT-9), migrations, the policy flag, then the acceptance above.
3. dot: approval card and history UI, proxy allow-list.
4. Later source:
   - schedule approval path (P-INT-6);
   - metadata owners for task.update, memory and filing (P-INT-7);
   - independent-reviewer approval;
   - cross-run approval (needs a command-journal binding change, so a migration and dot's review).

## Status

**Source complete** on the Meri side for proposal → decision → approved execution → durable result → history. Not integrated (the PR
is held until the first shipment is live), not qualified, not deployed, not live-verified.
