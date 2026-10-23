# Wave 1 hand-off (Fable → Wave 2 orchestrator), 2026-10-23

**Stopping point.** Neo asked Fable to find a stopping point and hand over ("find a stopping point and lets do the hand over for wave 2"). Wave 1 stops with chat working end to end on preview, but slow and heavy, and with the architecture around the Agent SDK marked for deletion (Wave 2 item 0). Read `STANDING-REQUIREMENTS.md` and `WAVE-2-HANDOVER.md` first; this file says exactly where things stopped.

## 1. What Wave 1 delivered (all on preview)

- **Meri runtime on the new-stack clone database**, released as meri-greenfield `main` `05d588c7`: control :60, temporal-worker :59, temporal-issuer :59, owner :58, proxy :58, runner :45. Turns are admitted, run in a Fargate runner, produce a model answer from Bedrock and finish as **completed**.
- **Core on the clone** (`capiro-preview-first-chat-core:9`) with every GET admitted by the preview read gate, plus **api-strategy, workspace and intel-api** services on the clone. Portfolio, a client's Overview, Work and Bill Tracker show real data (see `WAVE-2-HANDOVER.md` §1).
- **Observability:** P0 telemetry (`meri.turn.*`, `meri.model.request`) and the session-refusal alarm (MX-01, #212).
- **Consolidation:** PR197 (reads, writes, documents and memory source, all off) and C12 (conversations that never started recover) are merged and live.
- **A2 backend #111 and A1 frontend** are merged; A1 is live.
- Decisions O48–O239: `decision-log/DECISION-LOG.md`.

## 2. Acceptance status (the S2 packet, #202 comment 6355731525)

| Row | Result on `05d588c7` |
|---|---|
| **T3** first turn in a new conversation completes | **Pass:** one simple question in a new conversation streamed a full answer and ended **completed**, with no cut and no "attempt lost". The answer was not grounded in Capiro data (reads are off) |
| T3's telemetry limits (≤ 30 Core calls, ≤ 3 s Core time per turn) | **Fail:** 372 Core `/current` calls, Core time 20.6 s, about 800 ECS describes, about 73,000 DB statements (owner: 8 Core calls; proxy: one model request, input 552 and output 283 tokens, stream 4.7 s, settled in 25 ms). Timeline from submit: run started at 61 s (Fargate cold start), first text at 81 s, terminal at 217 s |
| T4 follow-up in the same conversation | **Not run** on this release. After T3, re-opening the conversation from the sidebar (after a page reload) loaded its full transcript with status Completed and every call 200, so the follow-up path looks reachable; see the observations in §4 |
| T5 reload while streaming reconnects | **Not run** |
| T6 Stop mid-stream ends cleanly | **Not run** |
| H1 history list and transcript load | **Not run** |
| H2 history filter menus (#121 deferred check) | **Not run** |
| R1 revocation within 30 s | **Not run** (needs Neo to arrange) |

Wave 2 item 0 re-runs all of them on the new architecture (its acceptance section).

## 3. How the last day went (so nobody repeats it)

The chat was broken by a chain of failures that only appeared live, each one hidden behind the previous. Every fix was correct locally and exposed the next, because each layer re-verified what the layer below already guaranteed. The series, all merged:

| PR | Fixed |
|---|---|
| #213 | S2: bounded current-authority reuse and originating intent sessions (the planned Wave 1 change) |
| #214, #217, #219 | Task bootstrap 403, no-origin reads, and a runner bootstrap 409: each a different mismatch in how authority receipts were pinned to sessions |
| #220, #221, #222 | Receipts outliving the original lease; launcher and continuation using a ~120 s receipt; the execution broker rejecting a valid receipt |
| #224 | The proxy kept a cached connection to the owner after the owner had closed it, so the next request failed with no reply |
| #226 | The task verifier re-borrowed the browser session after the model answered, so publishing failed |
| #227 | The proxy's 10 s admission lease expired mid-stream and cut the answer; a cut request's reservation stayed UNKNOWN and denied every later request in the run |
| #216, #218, #223, #225 | Temporary diagnostics (content-free refusal and trace lines). They were removed by #227 |

**Lesson, and the reason for item 0:** the failures came from the layers around the SDK (the owner/proxy pair, per-operation authority, leases and receipts, reservations), not from the SDK. A standard design (SDK to Bedrock directly, one access check per turn, Core as gatekeeper) has none of those failure modes. Neo's decision follows from that.

## 4. Open at the stopping point

- **Per-turn overhead (the T3 limits above).** FINAL-PLAN's agreed limits are unmet. A fix existed in progress when Fable stopped: runner operations proven once per run, run currentness in memory, one Core `/current` per turn, batched delta saves. See §5 for its exact state.
- **meri-greenfield #200 (P1) and #203 (C9): open, do not merge.** They belong to the layers item 0 deletes. Close them when item 0 step 2 lands (or now, with a pointer to `source-of-truth/SUPERSEDED-BY-ITEM-0.md`). No merge-with-main work for them was kept.
- **capiro-backend #115** (the missing `ws_draft.client_id` migration; already applied to the clone) and **#116** (the saved-layout lock fix, live as Core `:9`): open. Merging them is a separate decision from deploying them to live Core.
- **meri-greenfield #206**: this handover package (docs only). Merge it when reviewed.
- **Wave 2 PRs from the agents, open and not reviewed or gated by Fable:** capiro-frontend #123 (M2 UI), #124 (A2 UI); capiro-backend #112 (image hardening), #113 (M2 Core), #114 (A2 backend); meri-greenfield #215 (General conversations source), #211 (Codex coordination docs).
- **About 70 older PRs** (meri-greenfield #164–#188, capiro-backend #74–#100, capiro-frontend #75–#112) are donor and lineage PRs from before the consolidation. None is on the Wave 2 path. The Phase 0 housekeeping to close the superseded ones was never finished. Don't merge any without checking it against the register; closing them is Neo's or the orchestrator's call.
- **Observed during the acceptance run, not investigated further (Neo: "let the next wave handle this").**
  - During T3 on `05d588c7`, `GET /api/conversations/events/<run>/stream` and `POST /api/conversations/events` returned **503 on every attempt**. The page fell back to polling `history` (200) and still showed the answer building up, ending Completed. `conversations/list`, `history`, `transcript` and `action-followthrough/session` also returned 503 or 404 on some calls early in the page's life. Control's logs show only three `CONTROL_SESSION_REFUSED step=initial-binding` lines in that hour and no storm, so the 503s are not control session refusals; the public history deliberately returns a content-free 503 on any adapter failure (O216). The cause was not found. This is the likely reason T5 (reload while streaming) needs the streaming work in item 0 step 5.
  - A tab left open for about an hour then showed "Conversation access unavailable" and a disabled composer. `POST /api/action-followthrough/session` returned **401 `SESSION_REFUSED`**, and "Check access again" did not recover it. A page reload did, and after it the T3 conversation opened normally. Whether the browser's Clerk token or the Meri action session expired is unknown. It belongs with MF-02 (session renewal), and it means any live check must start from a freshly loaded tab.
- **The first control task after the release exited once**, about 5 minutes after it started (exit code 3, cause not proven). The replacement stayed up for more than 35 minutes.
- **Temporary AWS diagnostics, to delete once nobody needs them** (they only exist to trace the owner/proxy sockets that item 0 removes): VPC flow logs `fl-0205e8e1894d75953`, `fl-041c649f19df761de`, `fl-075eb9e3771714eef` (subnets `subnet-06db79cd21239de19`, `subnet-0920665f91c905f01`, `subnet-0e38bd390f8961fef`), log group `/meri/preview/flowlogs` (7-day retention) and IAM role `meri-preview-flowlogs`.
- **Known product gaps on preview** are listed in `WAVE-2-HANDOVER.md` §1 (placeholder panels, empty Objectives, `clients.list`, onboard-api and engagement-api).

## 5. Per-turn overhead fix: exact state

**Not shipped, not merged, and not needed for item 0.** The work is committed locally as `5e8a5ccee`, one commit on branch `fable/runner-ops-per-run` on top of `05d588c7` (on neomart, in `C:\devable\wt-per-run`). **It has not been pushed:** publishing it needs Neo's yes. If that branch is gone, the findings below are what is kept.

**Where T3's overhead came from.** This is from reading the code against the live counts; nothing was instrumented live.

1. **Per runner operation.** The receiver's `fresh()` asked control to verify, which ran `prepared-runtime current()`: a task-verifier snapshot transaction (about 11 SQL statements), an allocation read, and `verifyTask` (2 `DescribeTasks`, 1 `DescribeTaskDefinition`, and a hash of the runner file). The 253 `DescribeTaskDefinition` calls match one `verifyTask` per receiver operation.
2. **Per router exchange.** Each exchange did 3 authority joins (issuance, allocation, admission reads), 3 task and network-interface observations, and a TLS connect.
3. **Core `/current`.** It was read fresh for every publish, session issue and recheck, and read again for every tool read and intent port.
4. **Delta publishing.** One durable publish per SDK message while the previous one was in flight.

**What the branch does about it.** The receiver re-asks control at most every 20 s, the ECS task is proven once per run, and the verifier reads the run row at most every 20 s. Router authority is read once per 20 s per original, operation and credential, and the network is observed once per original task. There is one Core receipt per credential, conversation and client, shared for 20 s (concurrent callers share the read; failures are never cached). Delta publishing is at most one per 250 ms (`DELTA_PUBLISH_INTERVAL_MS`). It removes the session fence, the `fresh` flag, the sequence/epoch bookkeeping, the router's recheck-after phases and `pinSha256`.

**What it did not show.** The numbers are from unit tests only: 5 receiver operations make 0 control verifies; one router exchange pair makes 1 authority read and 1 network observation (3 and 3 on `origin/main`); 30 deltas over 600 ms make at most about 5 publishes. There are no live "after" numbers, and the first-turn rehearsal can't show the effect (it uses a stub verifier and no router, receiver or `prepared-runtime`), so **the ≤ 30 Core-call target is not demonstrated.** The once-per-run ECS proof has no unit test, and the PostgreSQL-backed `prepared-runtime` tests were not run.

**Still polling every 100 ms, the likely remaining DB and AWS sources:** kickoff readiness during the Fargate start (one router exchange and one `DescribeTasks` per attempt), the runner controls, and the browser stream poll. Item 0 should not recreate any 100 ms polling.

**A separate real bug, in the proxy that item 0 deletes.** The proxy logged the one T3 model request as `outcome: failed` although it settled normally. After a complete response, an `http.disconnect` was treated as `CLIENT_DISCONNECTED`, which cancelled the request, and `InferenceApp` then recorded `failed` (`apps/proxy/qualification/runtime/server.py`). It is not the `meri.proxy.abandon/1` path (that is a no-op once a request has settled). The branch fixes it with a unit test that fails before and passes after; it was reproduced in a unit test only.

**Tests on the branch.** Passing: `run-current-authority` 7/7, `s2-session` 7/7, `rehearsal-support` 5/5, `current-authority-adapters` 7/7 (3 tests updated), `task-router` 11/11, `activity-delta-coalescing` 8/8, and, in the proxy image, `test_server` 14/14. Of 95 affected files run on Windows against `origin/main`, 90 have identical counts. The inherited failures match `origin/main`: the Windows and PostgreSQL environment (`pipeline`, `next-run-pg`, `prepared-kickoff-pg`, `prepared-runtime-pg`, `read-composer`, `remote-task`) and the in-image D3 live-tail "double submit and Stop" cases (408 `DEADLINE`). Not run: the first-turn and D3 rehearsals on the branch, the in-image Linux runs of `remote-task`, `native-start-router-budget` and `capture-self-stop`, and the full unit-suite comparison.

**What survives item 0:** the **batched delta saves** (`apps/worker/conversation/activity.mjs`) belong in item 0 step 5, and the lesson about 100 ms polling. The rest edits `apps/runtime/native-authority`, which step 4 deletes, so don't merge it unless item 0 is delayed and chat speed matters in the meantime.

## 6. First actions for the orchestrator

1. Read `STANDING-REQUIREMENTS.md`, this file, `WAVE-2-HANDOVER.md` and the item 0 spec. Set up the machine (`WAVE-2-HANDOVER.md` §3).
2. Review and merge #206 so the handover, `AGENTS.md` and the PR template are on `main`. **#211 (the Codex environment's draft) also edits `AGENTS.md`** and adds `infra/product-preview/AGENTS.md` and three Codex docs, pinned to the handover at `90c25028`. Reconcile the two: keep the READ FIRST block of `STANDING-REQUIREMENTS.md` at the top of `AGENTS.md`, and re-pin to the merged handover. Add the four standing rules to the persistent instructions of `capiro-backend` and `capiro-frontend` too (only `meri-greenfield`'s `AGENTS.md` was updated).
3. Close meri-greenfield #200 and #203 as superseded.
4. Start item 0, step 1 (the spike; nothing merges). Don't send MP, or anything that touches the runner, proxy or authority, before it.
5. In parallel, if wanted: M2 (#123 gate and merge), A2 (deploy Core from `:9`), image hardening.
6. Delete the temporary AWS diagnostics in §4 when the spike no longer needs them.
