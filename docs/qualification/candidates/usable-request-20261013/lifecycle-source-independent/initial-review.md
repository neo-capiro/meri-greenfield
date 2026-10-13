# Initial independent lifecycle review — HOLD

Exact reviewed source `c985c5fc7eda55689f9e3d256c9576b8c43c74b2`, tree `3844ffee89651af09150e95a65f7fa664ab4cbf8`. **HOLD** pending the seven concrete independent controls below. Existing 42 owner controls and upstream SDK-options/Temporal workflow typecheck pass; this does not negate the failed adversarial behavior.

| Control | Observed failure at this exact source | Required behavior |
| --- | --- | --- |
| Fresh current scope | A newly issued canonical opaque session has policy2 scopes with the same binding. Worker publication throws `SCOPE_REFUSED` after events advance 1→2 and run becomes starting. | Reject mismatched retained/current scope before durable append. |
| Competing SDK activities | Both load queued behind a preparation barrier. Losing starting admission writes failed in its catch, poisoning the winning run. Both reject, zero queries start and run becomes failed. | Only acknowledged legitimate starting ownership may terminalize; winner completes with one query. |
| Calendar idempotency | Same request ID/body crosses New York's Monday boundary. Repeat resolves another last-week window and throws `REQUEST_REPLAY_REFUSED`. | Replay immutable original resolution rather than resolving a new clock. |
| Outer HTTP deadline | HTTP 10ms invokes a service taking 35ms; response is 200. | Bound borrowed service awaiting with original HTTP lifetime and signal. |
| Failure cleanup | SDK failure observer append waits on a controlled unresolved promise. At 100ms, activity remains pending and SDK close count is 0 despite 40ms original deadline. Test then releases the promise for cleanup. | Close SDK promptly and bound failure observation; preserve original deadline. |
| Sequence column alias | Stored relational sequence changed to 99 while original event JSON/hash remain intact. History releases transcript. | Bind raw sequence to immutable event sequence; refuse corrupt identity. |
| Event-ID column alias | Stored relational event ID changed while original event JSON/hash remain intact. History releases transcript. | Bind raw event ID to immutable event ID; refuse corrupt identity. |

The seven assertions remain in `independent.test.mjs`, resolving production and fixture imports only from `MERI_REVIEW_SOURCE_ROOT`. Raw TAP/exit/hash/physical process evidence is retained in `initial-independent.*`: 0/7 pass, exit 1, no timeout, process reaped and owned group absent. `initial-owner42.*` records 42/42 pass; `initial-typecheck.*` records exit 0. All captures are bounded to 240 seconds and completed in under 3 seconds. Tests use scripted SQL, synthetic identity and scripted SDK messages, without a native database or model call.

Focused production source whitespace passes (`initial-source-whitespace.*`). Reviewer raw failed TAP whitespace check returns exit2 (`initial-raw-whitespace.*`) because Node retains indented blank lines in assertion diagnostics. Those exact failed diagnostics remain unchanged; no whole-repository whitespace claim is made.

Source owners remain cohesive: Fetch transport, session/current-policy control, PostgreSQL record/event persistence, subscription, Temporal dispatch/workflow and one SDK consumer with options/text projection. Claude Agent SDK remains the only model loop; Temporal dispatches one activity with retry maximum 1. No source activation or public contract change follows. Root is repairing the reported behavior and will provide a new exact source pin for unchanged-assertion replay. General steering/fork, verified checkpoint/workspace resume, approval-wait, native identity/worker/Temporal/model proxy/storage and frontend integration remain separate requirements.

No implementation edit, native DB, provider/model, cloud, credential, private transfer, production or publication action was performed by this reviewer. Review scope is source/local behavior only and closes no full W05 or other whole-plan requirement.
