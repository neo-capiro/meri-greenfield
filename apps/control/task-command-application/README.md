# Governed task updates

`createTaskUpdateFeature` is an explicit, default-off-by-caller opt-in composition for a trusted run. `enabled:false` returns `null`
without constructing services or touching session, journal or source owners. When enabled it composes the actual PostgreSQL metadata
and intent journals, durable budget executor, fixed Core HTTP source, prepare-only worker intent port and Fetch API.
The existing session/approval authorities remain responsible for native identity, current membership/run, capability issuance and approval.
No second approval store or decision API exists here.

The composition returns `{application, intents, commandExecutor}`. Bind the current trusted grant through
`commandExecutor.bindTrustedGrant` before execution. Supply `intents` as the existing worker's `governedIntents` port; its capability
policy must also permit `governedIntents`. The SDK tool is `mcp__meri_intents__propose_task_update`. Its result is an immutable
`approval_required` proposal; it never calls Core. Approval is recorded by the existing canonical approval owner.

The session resolver accepts `{credential,intent,signal,deadlineMs}` and returns fresh
`{binding,authorizeExecution,checkedAtMs,expiresAtMs}`. The browser credential must be checked by that existing trusted owner;
the factory adds only its own exact command options. `authorizeExecution({proposal,signal,deadlineMs})` returns current
`{execution,credential}` for the canonical executor. The immutable proposal retains its original binding; an executing session may
have a fresh attempt/worker/fence for the same tenant, actor, conversation and run. Preparation requires the exact current binding.

For the existing opaque native session owner, supply `sessions`, trusted `selectedClientId` and `authorizeExecution` directly to
the feature. The native adapter reuses the action host's current-session correlator and checks current identity, session revision,
binding, scopes and selected client before and after capability issuance, metadata access and command execution. Revocation after a
metadata acknowledgement withholds the proposal as `STORED_NOT_RELEASED`; revocation after an observed effect withholds the result
as `RESULT_NOT_RELEASED`. These outcomes do not invite another mutation. The selected client comes from trusted host composition.

| Route | POST JSON | Result |
| --- | --- | --- |
| `/api/task-commands/prepare` | `{arguments:{taskId,title?,status?,dueDate?}}` | `{status:'approval_required',proposal}` |
| `/api/task-commands/execute` | `{proposal}` | existing `TaskUpdateToolResult` (`observed` or `indeterminate`) |

Both routes require a native session bearer. Request bodies are closed; no tenant, actor, binding, approval decision or capability can
be supplied as top-level authority. Requests require bounded identity-encoded JSON and an exact route with no query. Responses are
`no-store`/`nosniff`. The host must retain its existing origin check. Request, session, metadata, proposal, approval and capability
deadlines all bound the operation. Borrowed pools and ports are never closed.

The normalized command uses `contractVersion:'0.2.0'`, action `task.update` and
`{taskId,mode:'unconditional_patch',patch:{...}}`. Blank/null fields are omitted; an empty patch fails. `open` normalizes to `todo`.
Dates must be UTC midnight. This is an unconditional patch: no stale-write comparison is implied. Approved execution posts
only `{taskId,...patch}` to the existing fixed `POST /clio/tools/update_task` source, with fresh native credentials, authority,
approval, budget reservation and durable command identity. Lost native acknowledgement returns `COMMAND_OUTCOME_UNKNOWN` /
`outcome:'UNKNOWN'`; replay remains indeterminate and never redispatches. A proposal stored but withheld is also reported explicitly.

## Host integration

The runtime accepts one optional `taskCommandApplication` owner and mounts its two exact paths only with source access enabled.
Absent or source-disabled composition returns `TASK_COMMAND_UNAVAILABLE` with no dispatch. The additive public export is
`@capiro/meri-contracts/task-command-application`; desktop callers receive that generated module with immutable provenance.
The task-6 integration report records the reviewed source and frontend pins. Host composition, credentials and live qualification
remain with release owners; these changes do not activate a route in the shipment candidates or deploy a service.

## Per-session composition (multi-run control)

`createTaskUpdateFeature` binds one run. A control that serves many runs uses `createPerSessionTaskUpdateApplication`
(`per-session.mjs`): for each request it selects the session's current run binding and selected client from the canonical
session owner (selection only), asks the trusted grant owner `servicesFor({binding,selectedClientId,signal,deadlineMs})` for
that run's `createTaskUpdateServices` result, and resolves the request with the existing native correlator over exactly those
services. Services for another run are refused before any metadata, capability or Core call; prepare still requires the exact
binding and execute the same tenant, actor, conversation and run. The runtime family `apps/runtime/product-ports/tasks.mjs`
composes it only when `sourceEnabled` is true and a Core grant owner exists (neither holds today, so it reports `disabled`).
