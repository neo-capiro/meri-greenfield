---
name: project-meri-runowner-replay
description: "Meri runner replays an unanswered runner/load or runner/publish; where the \"did not answer\" mark used to be dropped; rehearsal evidence (10-20, candidate 5 input)"
metadata:
  node_type: memory
  type: project
  originSessionId: 8ea69adf-d918-4e1a-8e90-fddb5c405451
  modified: 2026-10-20T19:20:05.002Z
---

Branch `fable/adj-runowner-retry-20261020` (meri-greenfield) = `48fba2e9` + `dbff23d8` on candidate 4 `5de48c76`. Pushed, not merged; adj-e reviews; report `C:\dev\fable\adj-reports\adj-b-RUNOWNER-RETRY.md`.

**The mark chain.** `packages/runtime/authority-availability.mjs` marks "did not answer": Core 408/429/5xx, network failure, the owner's own deadline. It was lost at:
- task-verifier, which refused everything;
- task-verifier-http, which answered 403;
- task-authority, which answered `WORKER_AUTHORITY_REFUSED`;
- session `owner.mjs` `issue()`, which turned any port error into `SESSION_REFUSED` (rechecks kept the mark);
- worker-http, which answered 403 for everything;
- the native client, which turned any non-200 into `NATIVE_UNAVAILABLE`.

All six now carry it:
- worker-http answers 503 `WORKER_AUTHORITY_UNAVAILABLE`, and the verifier 503 `NATIVE_TASK_AUTHORITY_UNAVAILABLE`.
- The native client replays only `runner/load` and `runner/publish`: at most twice (500 ms, 1500 ms), only with an absolute `deadlineMs`, and only if ≥ 1 s remains.

**Why safe.** load is a read. publish's `eventId` is deduplicated by postgres-store `appendEvent` (returns the stored event; `UNIQUE(run, event_id)`). `runner/runtime` is NOT replayed: execution-http answers refusals and unanswered failures alike as 503.

**Evidence.** adj-e's first-turn rehearsal (live median, Clerk timeout at Core call #40 answered 503):
- `dbff23d8` completes in 77.9 s;
- base and `48fba2e9` fail at 14.8 s;
- with a 401, head still fails (refusals are never replayed).

Linux shows no regressions, and the 24-case gate passes 24/24 as uid 1000.

**D3 review fix (`669b567d`).** The product transport, `pinned-native-transport.mjs`, REJECTED every non-200 head (`PINNED_NATIVE_STATUS_*`). My "transport failed after dispatch" rule therefore replayed control's 403/401/408 refusals. Tests with `Response` mocks hid it; this is the same mock-versus-product gap as the native-start UNKNOWN.

Now:
- The transport resolves a readable non-200 as a Response: status, content type, body ≤ 4 KiB.
- "No answer" means only CONNECT/TLS/SOCKET/RESPONSE rejections (`PINNED_NATIVE_UNANSWERED`), plus a fetch `TypeError`.
- Clients keep `cause=PINNED_NATIVE_STATUS_*`.
- The vocabulary lives in `runner-runtime-diagnostics.mjs`, because neither client may import the transport (the Windows CA mock needs the transport loaded last).
- **Always test replay through the real pinned transport.**

**D8 fix (`af506b8b` on `fable/adj-b-d8-local-native-20261020`, cut from candidate 6 `62a7495d`, pushed).**
- **The bug:** in the product, `control.mjs` swaps the native HTTP client for `candidate.native` (`prepared-candidate.mjs` `localNative`). So worker-http's task verify is IN PROCESS: `localNative.call('worker/authorize')` → the candidate's native application → `task-verifier-http`.
- **Where the mark died:** `localNative` refused every non-200 unmarked, so a Core/Clerk blip became a 403 and was never replayed.
- **The fix:** `localNative` uses `native-client.mjs`'s exported `unansweredNativeAnswer`. Only a marked 503 with a bounded JSON body becomes `NATIVE_UNAVAILABLE`.
- **Why the old tests missed it:** my tests and both rehearsals stubbed `native.call('worker/authorize')` directly. `prepared-native-replay.test.mjs` now runs the real chain behind `listenRuntime` + the pinned transport.
- **Test recipe:** the test reaches the lazily allocated controller by `mock.module`-ing `prepared-kickoff.mjs` to capture `lazy`, then `lazy.allocate()` with a controller whose `application` is the real task-verifier HTTP. The controller needs `supervisor:{}`.

**Candidate 6 gate (10-20) [R]:**
- **Symptom:** the image build's 24-case `LINUX_ONLY_TESTS` gate is 22/24 at `62a7495d`. `prepared-candidate-bootstrap` fails 2 cases with `REMOTE_RUNNER_CLEANUP_UNKNOWN` as uid 1000; it was 6/6 at `4797f7da`.
- **Cause (bisected):** `d234d354`, E's `http-server.mjs` keep-alive 1 s → 125 s.
- **Likely mechanism:** after `close()`, a socket keeps living for 125 s, so the listener close ends only on `shutdownMs`, together with the runner's cleanup lifetime.
- **Rule:** always run the gate as uid 1000 before calling a candidate shippable.

**Traps:**
- The real-PostgreSQL suites (`execution-broker`, `prepared-kickoff-pg`, `prepared-runtime-pg`) fail with ENOENT in my WSL clone: no postgres binary. They are environmental.
- Don't run `d3-rehearsal`/`first-turn-rehearsal` in regression sweeps: they are minutes-long latency measurements that adj-e runs in containers (`g-d3-*`), and concurrent load skews them.
- The browser issuance route (`action-host/session/http.mjs`) maps every issuance failure to 401. A distinct 503 there is still A's follow-up.
- Suites `task-verifier`, `session`, `http-independent` need `MERI_REVIEW_SOURCE_ROOT=<repo>`.
- `worker-load-retention` is flaky on base too.
- Run the gate as non-root (`setpriv --reuid=1000`); as root, 5 token-writer cases skip.

Related: [[project-meri-activity-stream-lifecycle-poll-timeout]], [[reference-meri-in-image-test-recipe]].
