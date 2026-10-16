# Separately supervised schedule worker — source registration

Base `a3e1afc8be840049bd07dd6fbb2410f189e98e6c`; isolated `dot/meri-startup-history-20261016`. Parent approved control-domain placement as a separately supervised Temporal worker, never an HTTP request thread; central record `0b0b7abd536a27a74e3b1077ae71eed6e0ba275b` / tree `79e4989d27d9a0c3079ca1b795751813a01128dd` records the release. Existing occurrence source0002 is separately authored at `83f1c6bec804271f049a2d54cc925456ede05ee5`; neither SQL nor a worker was executed here.

Outline: reuse canonical schedule owner/barrier, conversation store/dispatcher and Temporal run evidence; register existing scheduled workflow and activity bindings in a separate explicit role; borrow original authority/instruction owners; retain bounded startup/shutdown and truthful absent-owner refusal. No new scheduler/model loop or alternate journal.

## Source composition and configuration

`apps/runtime/schedule-worker.mjs` provides:

- `assembleScheduleDispatch({configuration,pool,client,authority,taskInstructions,now?})`: same canonical `createPostgresScheduleOwner`, `createPostgresConversationStore`, `createTemporalConversationDispatcher` (lifecycle enabled), `createTemporalRunEvidence`, and `createScheduledDispatch`. Pool/client/authority/instruction resources are borrowed and stay caller-owned.
- `scheduleWorkerOptions({configuration,connection,dispatch,context?})`: registers existing `meriScheduledDispatchWorkflow` source and only `dispatchScheduledOccurrence`/`reconcileScheduledOccurrence`, preserving activity cancellation and immutable occurrence identity.
- `startScheduleWorker(configuration,{signal?,dispatch})`: owns its Temporal native connection/poller and health listener, uses existing TLS/token rotation/fail-closed authorization helpers and worker readiness. Missing/malformed dispatch refuses before TLS secrets or any resource. HTTP answers404 for application routes. Startup failure and repeated close clean up owned resources; no borrowed dispatch/DB owner is closed.

The explicit `schedule-worker` role is discoverable in existing runtime CLI help. It requires the existing version/profile/sourceEnabled=false/limits/http/temporal/versions configuration and adds exactly:

```json
{"scheduledDispatch":{"enabled":true,"conversationTaskQueue":"meri-conversations","maxConcurrentActivities":1}}
```

`temporal.taskQueue` is the schedule-dispatch queue (for example `meri-schedules`); it must differ from the conversation queue. Concurrency is1–10. Native task/provider/DB credentials are not part of this poller configuration. This role is opt-in; no existing conversation-worker registration changes. The CLI deliberately cannot synthesize the compiled dispatch owner from a JSON name: absent trusted startup binding exits unavailable. The remaining production bootstrap must supply genuine original-owner `authority.authorize` and approved immutable `taskInstructions.read`, plus its canonical pool/client. No Core transport or authority receipt is invented. Source registration does not activate a schedule or qualify dispatch.

Control's full-product census now calls the separate schedule process **unobserved**, reflecting approved placement/source registration without pretending that another process is running. No global readiness/release gate is lowered, and the first-chat requirements remain separate.

## Focused checks and limits

Fresh memory checks at batch starts: total33,632,079,872 bytes, free12,453,769,216 then11,640,463,360 bytes; no observed pressure. Node128MiB V8 heap, one process/test isolation none, concurrency1, owned45s HARD watchdog. Seven startup/config/registration/cleanup/readiness/CLI synthetic controls pass, exit0, elapsed1.47s, sampled peak working set141,582,336 bytes. Canonical runtime-factory control over existing scripted SQL/Temporal fixtures: one pass, exit0, elapsed5.68s, sampled peak198,791,168 bytes. These are sampled working sets rather than a guaranteed peak; V8 heap is not total process memory. Earlier five worker controls also passed before the final raw-options guard/readiness-state amendment. All task test processes exited. No real Temporal poller, PostgreSQL, daemon, SDK query, provider, browser, compiler, install or cloud effect.

The factory control accepts/replays one immutable occurrence through the actual canonical runtime composition, producing exactly one stored run and one lifecycle workflow and a settled barrier. It does not claim PostgreSQL locking/constraints, Temporal durable scheduling or physical-stop qualification. The existing source-only migration/barrier9control evidence is separate and retained.

Commands: `node --max-old-space-size=128 --experimental-test-module-mocks --test --test-isolation=none --test-concurrency=1 apps/runtime/test/schedule-worker.test.mjs apps/runtime/test/product-readiness.test.mjs`; `node --max-old-space-size=128 --test --test-isolation=none --test-concurrency=1 apps/runtime/test/schedule-dispatch-composition.test.mjs`.

## Current proof-row delta, no historical repin

Source-proof control: **4pass/1FAIL**, exit1,54ms, owned30s watchdog. Expected failure remains the current source differing from preserved candidate h. An exhaustive45row comparison finds the following7differences, other38equal. Historical manifests, Dockerfile, frozen contracts and every lock are byte-unchanged. No candidate pin or image acceptance transferred.

| Path | h SHA-256 | This source SHA-256 |
|---|---|---|
| `apps/control/conversations/postgres-store.mjs` | `2de6bce64ace8a6d2b5d0ed205f9ffb5b7ac2884d6109df19bc629b13d48c1cb` | `d385fd62d5cfb26bc184d26c2659298fde1ba8ba9c2d5ca3210429a8a3d03420` |
| `apps/runtime/config.mjs` | `9558183a7eab179d3b66d2b1d65707a0f495f882b3aa03e8b04b029942c6685d` | `ecca580b264be40a715c393bbc23e84cbe684421b302cdb3f5b289909ef0919f` |
| `apps/runtime/control.mjs` | `ec63730199cbc092042dab6b6694506087530ee85572e1daadfb478bf76c5757` | `6c37a0eac4aa47f2555a2a70fe2613f7448ac39b109c3fd51904f2b73fe59c14` |
| `apps/runtime/conversation-runner.mjs` | `9b6ac5506161513caab33a41c547b634dc314426b51e274f376340556a1ba26d` | `4afd72fb8605bc557343d18b55c920c04e7299e40890612352484cc971356a3d` |
| `apps/runtime/native-authority/remote-composition.mjs` | `2c4162da6af533902090d7aa2861278c892335a90b4e4a75cbae99b80ba5ab4b` | `c6fa03643c633c59b019c2c220696ebaa28ce7e35405dfb34b3b52a4b26c2028` |
| `apps/runtime/prepared-candidate.mjs` | `56a56689f2bf0ee365f9f1b7e479f5f5e693ae05998d9e80057c3e8da278b603` | `a3bf05a5e96683b0ea8e536b98935192c36322b07e457dc6816f0d72fa2fef40` |
| `apps/runtime/remote-conversation-runner.mjs` | `830775231cd1a96bce6fc8c5d81a2092be883712080655163270149032dd45ec` | `f945a77f0b215db5ff52bdc467339f0b930133a7a740dc389627ab82ce6be15d` |

These supersede the earlier report's two-row count for its older exact source; those reports/manifests remain historical evidence. Startup model-grant signature/helper lines were narrowly released to budget B at exact83 source and are not edited in this batch. No whole-head integration. Corrected L3 `5abfa6535263e2a8d2a7cd8cacadd86305227844` and its reserved public export still need exact parent acceptance before freeze/adoption. Comprehensive typing/build/browser/image/real DB/Temporal qualification waits for the single coordinated checkpoint. No main merge or deployment occurred.
