# Source348 runner load amplification proposal — 2026-10-19

Source base: `34851020aa0d73fead4db59ba6e26a098e2d0313`. This is a separate source proposal. The frozen source and PR #175 are unchanged. No live AWS, database, model, credential, deployment, or retry action was used to qualify it.

## Observed local behavior

An instrumented in-process Core authority fixture executes the real worker HTTP load application, action sessions, basic and lifecycle services, and native client. It replaces the task verifier's grant and SQL checks. One successful load on the base source issued 83 serial Core requests with fixed context or 102 with dynamic first-conversation context. At a uniform 35 ms per Core response, the dynamic base load hit its three-second deadline before finishing. This proves the source can amplify bounded latency into a deadline failure; it does not identify the historical live bottleneck.

The load shares a three-second activity preparation window with runtime preparation. The native client independently caps its HTTP request at three seconds. Raising only the activity window cannot make a slow native load succeed.

## Proposed change

The lifecycle service uses a private, load-only callback to perform its read-only execution journal verification inside the basic load's operation. The basic operation checks current identity, membership, binding, selected client, and retention before the initial read, immediately before and after the journal read, and before release. It independently checks that the stored run binding matches the requested binding and that the selected client belongs to the client scopes. It compares a post-journal store read with the initial run binding, scopes, versions, and request. Existing public load shape, lineage ambiguity refusal, and other lifecycle operations stay on their current paths. There is no cross-request authorization cache and no timeout increase.

| Local fixture | Base source | Proposed source |
| --- | ---: | ---: |
| Fixed-context Core calls | 83 | 51 |
| Dynamic first-chat Core calls | 102 | 62 |
| Dynamic load at 35 ms/Core call | `DEADLINE` at about 3.0 s | HTTP 200 at about 2.3 s |
| Dynamic load at 50 ms/Core call | `DEADLINE` | `DEADLINE` at about 3.0 s |

These are uniform synthetic delays with stubbed SQL/grant work, not live Core timing. At 35 ms, 62 serial calls alone consume about 2.17 seconds and leave less than one second for SQL, transport, and runtime preparation. The exact viable threshold depends on their measured tails. A server-side five-second window still fails when the native client remains at three seconds.

Focused regressions verify mid-journal membership revocation, selected-client drift, policy drift, retention suppression, tenant drift, saved-request drift, a consistently foreign stored run, an out-of-scope selected client, and ambiguous next-turn/continuation lineage all withhold the load receipt. They also verify the fixed and dynamic call counts and independent native deadline. The fixture cannot verify deployed SQL pool waits or a real Core latency distribution.

## Live discriminator and alternatives

Fable's aggregate 14:03 private ALB readback reports 86 requests, 69 target 2xx, 16 target 4xx, one ELB 4xx, and a 1.90-second maximum among completed target responses. It has no path/correlation, so the 4xx could include an early load refusal and the completed-response maximum does not rule out a client-aborted three-second load. Performance Insights found no meaningful sustained DB lock or saturation; brief pool acquisition or a per-conversation lock remains possible. The ordinary load source has no intrinsic nested SQL deadlock, but its first task-verifier admission snapshot waits for a pool connection before any Core call.

Use an existing correlated control span or bounded log for `/internal/conversations/load` and `/v1/worker/authorize`, plus Core identity/context/membership counts and latency in the actual load window. If the load never reaches control, investigate pinned transport. If authorization starts without Core calls, inspect the initial admission read/pool wait. If the fused load still exceeds three seconds at measured Core tails, qualify a **load-specific** budget consistently in the activity, native client, and control owner after checking the measured end-to-end bound; a global timeout change is not this proposal. Keep DB pool/lock investigation independent of authority amplification.

The runner was physically stopped at 14:16:04. Terminal state and grant retirement still need authorized readback. The recovery workflow already schedules a bounded stop call after execute loss; a stopped ECS task alone does not prove settlement. No manual reconciliation or retry is implied by this source proposal.
