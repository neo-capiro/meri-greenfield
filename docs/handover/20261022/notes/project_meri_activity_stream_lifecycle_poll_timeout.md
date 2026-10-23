---
name: project-meri-activity-stream-lifecycle-poll-timeout
description: "Meri first chat failed ~3 s after system/init at activity-stream (code=ERROR) because runner/next-controls had the native client's 3 s default; fixed on fable/adj-runtime-site-20261020"
metadata:
  node_type: memory
  type: project
  originSessionId: 8ea69adf-d918-4e1a-8e90-fddb5c405451
  modified: 2026-10-20T09:00:27.768Z
---

Live attempts 2026-10-20 06:37Z and 08:26Z (candidates 3dc993ef, 59c7748f) both died ~3.0 s after the SDK's `system/init` reached the runner, printing `RUNNER_FIRST_FAILURE … stage=activity-stream code=ERROR class=ERROR`.

Cause (reproduced on Linux and inside the candidate-2 image a62302c5): the lifecycle controls' first `runner/next-controls` poll went through the runner's native capability client with its **3000 ms default** (not a "startup operation"), but control's `worker-http.mjs` does 3 serial task-authority verifies + action session issue/read per call (live verify 0.8–1.35 s each). Client aborts at 3 s → `DEADLINE` → `activity-lifecycle.mjs` pump converts any error to `LIFECYCLE_EXECUTION_UNKNOWN` (was unlisted, cause dropped) → activity fails. Control logs "Client connection prematurely closed" 1 ms after the runner line — that coincidence is the tell.

Fix branch `fable/adj-runtime-site-20261020` (from 59c7748f): `2be4863a` diagnostics (`cause=`/`msg=` sha256-12/`site=` basename:line:col, lifecycle codes allowlisted, cause kept, message-hash table `docs/integration/runner-first-failure-message-hashes.json`), `1d94b357` fix (4 lifecycle control ops get the session allowance, like checkpoint capture), `a18aa09a` native-client test update. Report: `C:\dev\fable\adj-reports\adj-b-STREAM-ERROR.md`.

**Why:** "proxy/owner silent" is NOT evidence of no model call — proxy and owner log only `ready` lines. Runner→proxy reachability was still unproven as of 10-20 (never reached).

**How to apply:** if a chat dies again right after start, read the new `site=`/`cause=`/`msg=` fields first; check per-call budgets on any runner→control call made during execution. Related: [[project-meri-native-start-unknown-pinned-transport]], [[reference-meri-in-image-test-recipe]]
