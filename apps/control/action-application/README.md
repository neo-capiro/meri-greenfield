# Action application Fetch API (unactivated)

Import `createActionApplication` from `./index.mjs`. It constructs no listener and opens no pools, services or credentials. Production catalog/source availability is unchanged. Browser origins confer no identity; there is no CORS policy in this adapter.

`createActionApplication({resolveSession,now,limits:{maxRequestMs,maxRequestBytes,maxResponseBytes}})` returns `{handle(Request):Promise<Response>}`. Limits are positive safe integers, maxRequestMs <=60000, byte bounds <=16MiB. This new path is not an existing deployed endpoint.

| POST path | Exact JSON body | 200 response |
| --- | --- | --- |
| `/api/action-followthrough/query` | `{request}` (canonical action lookup intent only) | Canonical lookup read delivery, including observation/recommendations, IDs/hash/events |
| `/api/action-followthrough/draft` | `{selection,edits?}` | Canonical followthrough draft |
| `/api/action-followthrough/prepare` | `{draft}` | Approval-required wrapper with exact proposal and supporting draft |
| `/api/action-followthrough/execute` | `{proposal}` | Existing observed or indeterminate command result |

Require `Authorization: Bearer <opaque-session>` and `Content-Type: application/json` (optional charset=utf-8). No query string, compressed request, authority extras, browser capability or approval hints. Title/dueDate edits follow existing task contracts. Preparation never creates a task. Supporting recommendation evidence is not approval-bound provenance or an authenticated durable source link.

`resolveSession({credential,intent,signal,deadlineMs})` must freshly return exactly `{lookup,lookupContext,lookupCredential,readContext,commandOptions,authorizeExecution,expiresAtMs,checkedAtMs}`. Session credentials are not tool credentials. lookupContext supplies host-owned fresh query IDs/event slots and selected client. lookup/read current bindings and scopes must agree; command context/client resolution must agree with the current selected client and stable tenant/actor/conversation/run. For explicit execution, original command producer binding may differ from the fresh current executor attempt. checkedAtMs must fall between invocation and returned current time; expiry clips the original request deadline. This structural receipt does not authenticate native JWT claims; the host owns session authentication and current policy.

`authorizeExecution({proposal,signal,deadlineMs})` returns exactly `{execution,credential}` from trusted state. It creates no approval decision. The existing command interface/metadata/approval/executor still validates the proposal, fresh executor authority and current decision. No execution request, capability, tenant, actor, client selection or scope is accepted from the execute body.

All responses have JSON Content-Type, Cache-Control:no-store and nosniff. Failures are `{error:{code,outcome}}` with content-free codes. Outcomes retain NOT_DISPATCHED, UNKNOWN, RESULT_NOT_RELEASED and STORED_NOT_RELEASED, plus the metadata owner’s NOT_STORED and READ_UNAVAILABLE. NOT_STORED refers only to that metadata insertion; READ_UNAVAILABLE does not prove absence or permit retry. Known retained query/result state takes precedence over a later read-local NOT_DISPATCHED. RESULT_NOT_RELEASED also describes an acknowledged result withheld at this adapter's final expiry/body-size boundary; it does not imply rollback or redelivery permission. An issued execution with no acknowledged result remains unknown. The application performs no automatic retry/refund and never disposes borrowed owners.

Streaming input, session resolution and domain calls share one finite request lifetime. Source/metadata deadlines are clipped; final output is bounded and checked again before release. Cancellation is cooperative and does not prove a pending socket/database/metadata operation physically stopped. The separate local/ owner supplies a clearly synthetic one-shot composition, not production session/approval authority.
