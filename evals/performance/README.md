# Performance harness

Measures the plan's two latency targets beside their thresholds and labels every number `LOCAL_FIXTURE`.

- **UI acknowledgement (p95 <= 2 s).** Each round submits 10 concurrent requests, each on a fresh synthetic conversation, through `app.handle(Request)` of the canonical conversations HTTP application composed in `evals/offline-targets` (canonical session owner, store adapter over the scripted wire fixture, service, Fetch mount; a scripted runtime dispatcher stands in for Temporal). A sample is the time until the accepted-request response resolves; model completion is never included. A replayed, mismatched or refused submission is a failure, and every accepted run must reach the scripted dispatcher.
- **Fresh-task readiness (p95 <= 90 s).** Accepted request to a new isolated worker being ready. Only a live probe can measure it, so `measureReadiness({probe})` takes an injected probe and reports `UNRUN` (`LIVE_FRESH_TASK_READINESS_PROBE_NOT_SUPPLIED`) without one. No fixture stands in for it.

Percentiles are nearest-rank over raw samples (`statistics.mjs`); nothing is interpolated or dropped.

Run `node evals/performance/run.mjs --output NEWFILE [--rounds N]` (1-50 rounds, default 3) or `node --test evals/performance/test/performance.test.mjs`. The CLI writes a new 0600 JSON report (`meri-performance-report/1`). Exit 0: acknowledgement within threshold on the local fixture; 1: exceeded or failed submissions; 2: invalid arguments or I/O.

What this does not prove: loopback latency excludes the load balancer, network, TLS, Clerk, PostgreSQL, Temporal and the deployed UI, so it is not deployed UI acknowledgement. Readiness stays `UNRUN` until a live isolated-worker probe exists on a qualified host. `qualification.state` is always `UNQUALIFIED`; neither number satisfies the plan's performance gate.
