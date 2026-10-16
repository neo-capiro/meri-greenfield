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

## Integration ownership still pending

The shared runtime mount, worker startup transport and frontend contract package/export are not changed by this feature subtree.
The source-only integration proposal is in the task-6 report. The frontend must consume a reviewed public task-update contract export;
it must not copy these private DTOs. Runtime/frontend shared-file ownership coordination is pending because both cross-thread messaging
attempts returned `thread not found`. No route is active in PR98 or PR60 and no live acceptance is claimed.
