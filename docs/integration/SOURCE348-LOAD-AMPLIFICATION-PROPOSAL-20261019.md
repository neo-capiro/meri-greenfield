# Source348 runner load amplification proposal — 2026-10-19

Source base: `34851020aa0d73fead4db59ba6e26a098e2d0313`. This is a separate source proposal. The frozen source and PR #175 are unchanged. No live AWS, database, model, credential, deployment, or retry action was used to qualify it.

## Observed local behavior

An instrumented in-process Core authority fixture executes the real worker HTTP load application, action sessions, basic and lifecycle services, and native client. It replaces the task verifier's grant and SQL checks. One successful load on the base source issued 83 serial Core requests with fixed context or 102 with dynamic first-conversation context. At a uniform 35 ms per Core response, the dynamic base load hit its three-second deadline before finishing. This proves the source can amplify bounded latency into a deadline failure; it does not identify the historical live bottleneck.

The load shares a three-second activity preparation window with runtime preparation. The native client independently caps its HTTP request at three seconds. Raising only the activity window cannot make a slow native load succeed. A later 50 ms/Core fixture still hit the three-second cap after fanout fell to 62 calls.

## Proposed change

The lifecycle service uses a private, load-only callback to perform its read-only execution journal verification inside the basic load's operation. The basic operation checks current identity, membership, binding, selected client, and retention before the initial read, immediately before and after the journal read, and before release. It independently checks that the stored run binding matches the requested binding and that the selected client belongs to the client scopes. It compares a post-journal store read with the initial run binding, scopes, versions, and request. Existing public load shape, lineage ambiguity refusal, and other lifecycle operations stay on their current paths. There is no cross-request authorization cache.

The successor repair gives only `runner/load` a longer runner budget. The source-rendered preview control request limit is 25,000 ms and its HTTP listener request timeout is 26,000 ms; pinned HTTPS transport has a 30,000 ms hard ceiling. The runner's load budget is `min(23,000 ms, configured control request limit - 2,000 ms)`, then clipped again to `original execution expiry - configured shutdown allowance - 8,000 ms`. Runtime preparation has a fresh three-second lifetime and must also finish by that lease cutoff. A successful preparation therefore leaves at least eight seconds for first publication and local startup before the configured shutdown allowance; the eight seconds conservatively account for three seconds of runtime preparation, three of publication, and two of margin. The rendered shutdown allowance is 10,000 ms. The native client allows the same longer bound only for `runner/load`; all other operations retain its default three-second cap. The load lifetime's signal continues through native transport and control. No control, Core, SQL, or global timeout is raised.

| Local fixture | Base source | Proposed source |
| --- | ---: | ---: |
| Fixed-context Core calls | 83 | 51 |
| Dynamic first-chat Core calls | 102 | 62 |
| Dynamic load at 35 ms/Core call | `DEADLINE` at about 3.0 s | HTTP 200 at about 2.3 s |
| Dynamic load at 50 ms/Core call | `DEADLINE` | `DEADLINE` at about 3.0 s |
| Dynamic load at 300 ms/Core call, with load-only budget | `DEADLINE` | HTTP 200 in 18.73 s |

These are uniform synthetic delays with stubbed SQL/grant work, not live Core timing. At 300 ms, 62 serial calls consume at least 18.6 seconds; the 23-second load cap leaves about 4.4 seconds for other load work and 2 seconds before the source-rendered control ceiling. Runtime preparation uses its own three-second allowance after load. The exact viable threshold depends on real Core, SQL, and transport tails.

Focused regressions verify mid-journal membership revocation, selected-client drift, policy drift, retention suppression, tenant drift, saved-request drift, a consistently foreign stored run, an out-of-scope selected client, and ambiguous next-turn/continuation lineage all withhold the load receipt. Additional checks verify revocation during a 300 ms journal delay, parked Core and store reads released after cancellation or deadline, no late successful control response, original-lease clipping, a fresh three-second runtime-preparation cap, nested runner activity wiring, the non-load native timeout, and the 62-call load at 300 ms/Core. The 300 ms case composes worker HTTP and native client; activity and nested runner budget wiring are checked separately with a synthetic clock. The fixture substitutes task-verifier grant/SQL work and the SDK import; it cannot verify deployed pool waits or a real Core latency distribution.

The focused local suite passed 22/22 on Node 22 using import-only stubs for missing local SDK, AWS, Temporal, and runtime-config dependencies. No model, AWS, or database call was made. An independent source review found the original five-second lease reserve insufficient for runtime preparation and first publication; the reserve is now eight seconds and the preparation lifetime also ends at that cutoff. This is a source proposal, not a built or deployed image.

## Live discriminator and alternatives

Fable's aggregate 14:03 private ALB readback reports 86 requests, 69 target 2xx, 16 target 4xx, one ELB 4xx, and a 1.90-second maximum among completed target responses. It has no path/correlation, so the 4xx could include an early load refusal and the completed-response maximum does not rule out a client-aborted three-second load. Performance Insights found no meaningful sustained DB lock or saturation; brief pool acquisition or a per-conversation lock remains possible. The ordinary load source has no intrinsic nested SQL deadlock, but its first task-verifier admission snapshot waits for a pool connection before any Core call.

Use an existing correlated control span or bounded log for `/internal/conversations/load` and `/v1/worker/authorize`, plus Core identity/context/membership counts and latency in the actual load window. If the load never reaches control, investigate pinned transport. If authorization starts without Core calls, inspect the initial admission read/pool wait. Before a build, verify the deployed control request limit is at least 25 seconds and the original execution lease and current Core/session receipts leave the bounded window; the source-rendered values alone are not a live readback. A shorter limit or receipt must refuse the load. Keep DB pool/lock investigation independent of authority amplification.

The runner was physically stopped at 14:16:04. Terminal state and grant retirement still need authorized readback. The recovery workflow already schedules a bounded stop call after execute loss; a stopped ECS task alone does not prove settlement. No manual reconciliation or retry is implied by this source proposal.
