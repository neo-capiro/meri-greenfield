# Lane 3: conversation write intents

| | |
|---|---|
| Owner | Fable, lane-3 session |
| meri-greenfield branch | `fable/meri-lane3-write-intents-20261017`, base `ce2da186` (PR #133 head; root `59856683`) |
| Draft PR | into `fable/meri-first-chat-receiving-20261017`; held out of integration until the first shipment is live (as lanes 2 and 5) |
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
