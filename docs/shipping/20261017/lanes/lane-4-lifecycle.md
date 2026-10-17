# Lane 4: conversation lifecycle

| | |
|---|---|
| Owner | Fable, lane-4 session |
| meri-greenfield branch | `fable/meri-lane4-lifecycle-20261017`, base `0e38ef49` (PR #133 head; root `59856683`) |
| Draft PR | into `fable/meri-first-chat-receiving-20261017` (linked on PR #121) |
| capiro-frontend branch | `fable/meri-lane4-lifecycle-ui-20261017` (own worktree), see "Frontend" |
| Status vocabulary | as in `../BACKLOG.md`: everything here is **source** unless marked; nothing is integrated, qualified, deployed or live-verified by this lane |

## Scope and priority

History and paging, transcript, reconnect/resume/replay, next turn and successor run, pause/resume, cancel/Stop (original and successor custody), recovery after a control restart, and continuity across a configuration change. **Second turn and Stop are part of the first shipment's acceptance** (steps 8 and 9 of `ARCHITECTURE-AND-RESUME.md`'s acceptance sequence) and were done first.

## Canonical owners (inventory)

meri-greenfield, all paths under `apps/control/conversations/` unless stated.

| Owner | Responsibility |
|---|---|
| `service.mjs` | Authenticated per-run session operations: `allocateInput` (writer fence 1, 0016), `admitInput`, `submit` (accept + Temporal start), `history`, basic `cancel`, worker `loadForExecution`/`publish` |
| `postgres-store.mjs`, `migrations/0001–0011,0013,0015–0017` | Canonical rows: conversations, runs (`sequence_base`/`sequence_end` from 0009), events, controls/checkpoints (0002), native allocations (0007), next runs (0009), retention (0010/0013), issuances (0011/0015), initial inputs (0016), initial-run bindings journal (0017). 0012 and 0014 stay held. |
| `history/{store,service,http,lineage,protocol}.mjs` + `packages/contracts/conversation-history` (1.0.0, package slot 0.1.6) | Conversation list (`before` keyset), conversation-global transcript (`after`/`limit`, `hasMore`, `pendingTurn`, prompt lineage), explicit `next-turn` |
| `next-run.mjs`, `next-run-journal.mjs`, `next-run-reservation.mjs` | Successor selection under the conversation lock: one immutable `RESERVED` mapping per source, `writerFence+1`, lost-ack replay, accept on submit, execution lineage |
| `lifecycle/{service,journal,http,workflow.ts,worker-owner}.mjs` + `packages/contracts/conversation-lifecycle` | `POST /api/conversations/control` (steer, pause, approval.wait, resume, fork), production Stop (`cancel`), checkpoints, worker control claim/ack |
| `run-reconciler.mjs`, `recovery-workflow.ts` | Original retirement and `failed/ATTEMPT_LOST` settlement after a lost attempt; no redispatch |
| `temporal-dispatch.mjs`, `workflow.ts` | Exact workflow ID `meri:<tenant>:<conversation>:<run>`, start/cancel/signal |
| `http.mjs`, `events.mjs`, `packages/ui-stream` | Submit/history/cancel, `POST /events` subscribe and `GET /events/{id}/stream` reconnect with `x-meri-resume-sequence` |
| `apps/runtime/product-applications.mjs`, `control.mjs`, `prepared-candidate.mjs`, `prepared-next-run.mjs`, `prepared-run-registry.mjs` | Composition: history routes mount only with membership, currentness and store; next-run owner only in multi-run mode; lifecycle service wraps the basic service; post-restart stop-only rebuild |

capiro-frontend `apps/web/src/features/meri/conversation/**` (21 files at `fable/meri-host-archived-client-guard-20261017` `31a140cd`; identical on the PR70 branches): host, live run, history status, run status, observation loop, command journal, next-turn hook. Proxy: `app/api/conversations/[...path]/route.ts` with `shared/meri-conversations/{history-proxy,proxy,input}.ts`.

## Capability status

| Capability | Status | Evidence | Remaining |
|---|---|---|---|
| List (discovery) | source, complete | `history/store.mjs` `list` (owner + client filter, `(createdAt,id)` keyset); UI `shared/shell/ConversationRecents.tsx`, `history-queries.ts` | live only |
| Transcript and history paging | source, complete (forward) | `history/store.mjs` `transcript`: conversation-global cursor = `sequence_base + UIEvent.sequence`, `hasMore`, integrity checks; tests `history-http.test.mjs` (three-turn paging, forged cursor). UI "Load more saved turns" + latest-run tail query | Backward ("load older") paging is not in the 1.0.0 wire; forward paging plus the tail query covers the preview. A `before` cursor would be an additive contract change (dot). |
| Reconnect / resume / replay | source, complete for one run | `http.mjs` GET stream with `x-meri-resume-sequence`, immutable event-ID replay; tests `conversation-public-integration.test.mjs` (26), `application.test.mjs` "reconnect emits only new events", `stream.test.mjs`. UI `useRunObservation.ts` `resumeStream`, `observation-loop.ts` backoff | The live stream is per run; crossing to a successor reopens the session on the exact target (UI does this). |
| Next turn and successor run | source, complete | `history/service.mjs` `nextTurn` → `next-run.mjs` `admitTurn` → session reissued on target → `submit` → `nextRuns.accept` → start. Tests: `history-http`, `next-run-owner`, `next-run-recovery`, `no-authority-successor`, `input-admission` (successor case), **new** `turn-settlement.test.mjs` | **Fixed here:** a source not yet settled (completion cleanup still retiring the original, revocation pending) was answered `UNKNOWN`; now `409 CONVERSATION_TURN_CONFLICT / NOT_DISPATCHED`, retryable, nothing reserved. Frontend bounded retry: see Frontend. |
| Cancel / Stop, original and successor custody | source, complete | Production route is `lifecycle/service.mjs` `cancel`: durable `cancelled/USER_CANCELLED` fence first, then Temporal cancel; a stale session bound to an earlier run is refused by `currentRun` (`NEXT_RUN_NOT_LATEST`), so Stop always targets the latest run; successor workflow IDs are per run. Tests: `application.test.mjs`, `no-authority-successor`, `next-run-recovery`, **new** `stop-races.test.mjs` | **Fixed here:** (1) Stop racing a natural completion errored; now answers the terminal state with no second write. (2) A committed cancel behind a lost ack is reported once. (3) Temporal `NOT_FOUND` (never started, or already closed) was `UNKNOWN` forever; now definitive, so Stop of a queued never-started run and repeat Stop of a finished run succeed. (4) Lifecycle composition now requires `journal.cancel` and `dispatcher.cancel`. |
| Pause / resume / fork | source, **blocked in production** | `lifecycle/service.mjs` + journal + `workflow.ts` `condition`; tests `lifecycle*.test.mjs` | Exact blocker: no production supplier for `transitionAuthority`, `continuationAdmission`, `approvals`, `sessions.verifyTransition` (`prepared-candidate.mjs:98` supplies none), so resume/fork answer `LIFECYCLE_OWNER_UNAVAILABLE` and approval.wait `APPROVAL_OWNER_UNAVAILABLE`. Steer and pause signals are wired. A public `/control` client is a separate contract gate; the frontend proxy does not allow `/control` (`input.ts`). Needs a per-run continuation admission owner within the existing allocation/budget owners (lane 1 composition) before UI. |
| Recovery after a control restart | source | Stop-only rebuild for dynamic first runs and successors (`prepared-run-registry.mjs`), reconcile activity, operator `apps/runtime/reconcile-run.mjs`; pending reservation recovered through `transcript.pendingTurn`; exact submit replay restarts the same workflow ID | A queued successor whose start was lost and whose browser lost its retained prompt stays queued; Stop (now definitive on `NOT_FOUND`) cancels it and the next prompt is admitted on the no-authority evidence. No background sweeper (by design). |
| Continuity across a configuration change | **proposal** | [lane-4-config-continuity-proposal.md](lane-4-config-continuity-proposal.md) | B refuses A conversations' next turns as `UNKNOWN` and cannot stop A's dynamic first runs after restart. Recommended: drain-before-decommission plus explicit read-only closure (`CONVERSATION_CLOSED`, shared contract code, needs dot). Awaiting Neo's approval. |

## Changes on this branch

Source (meri-greenfield):

- `apps/control/conversations/temporal-dispatch.mjs`: `cancel` maps the installed client's `WorkflowNotFoundError` to `{workflow:'NOT_FOUND'}`; every other failure stays `TEMPORAL_DISPATCH_UNKNOWN`. Returns `{workflow:'CANCEL_REQUESTED'}` otherwise.
- `apps/control/conversations/lifecycle/service.mjs`: Stop re-reads after a refused cancel write and answers the run's terminal state when it turned terminal meanwhile; configuration requires `journal.cancel` and `dispatcher.cancel`.
- `apps/control/conversations/next-run.mjs`: settlement facts gathered in one function; the explicit `admitTurn` path reports a refusal there as `NEXT_RUN_SOURCE_UNSETTLED` (with the original as `cause`); session selection keeps the precise codes.
- `apps/control/conversations/history/service.mjs`: `NEXT_RUN_SOURCE_UNSETTLED` and `NEXT_RUN_SOURCE_NOT_TERMINAL` become `CONVERSATION_TURN_CONFLICT` / `NOT_DISPATCHED` (existing 409 code; no wire change).

Tests: new `test/stop-races.test.mjs` (8) and `test/turn-settlement.test.mjs` (4), one new case in `history-http.test.mjs`. Fixture repairs for the 0016 writer-fence-1 initial-input allocation that the root integration added without updating fixtures: shared `allocatedApplicationFixture` in `test/application-fixture.mjs`, and `allocateInput` before the first submit in the next-run, hold, terminal-settlement and input-admission fixtures. No contract, migration, lockfile or shared file changed.

## Tests

Host: Windows 11, Node 24.19, no PostgreSQL (needs Neo's approval), so `*-pg` suites and `native-preparation` (POSIX socket) fail before any code runs. Compared by test name against the untouched base.

- Base `0e38ef49`, `apps/control/conversations` `node --test --test-concurrency=1 test/*.test.mjs`: 446 run, 257 pass, 189 fail.
- This branch, same command: 460 run, 348 pass, 111 fail (counting `lifecycle-transition.test.mjs` from its standalone rerun, below). **No test that passed on the base fails**; 78 base failures now pass; 12 new behavior tests. 8 of the new tests fail on the base source and pass with the fix (checked by restoring the four source files to `0e38ef49`).
- The 111: 96 need PostgreSQL or a POSIX socket (`sequence-range-migration-pg` 39, `store-pg` 14, `next-run-pg` 8, `lifecycle-hold-composition-pg` 8, `initial-run-binding-migration-pg` 8, `prepared-execution-claim-pg` 7, `native-preparation` 6, `read-optional-pg` 4, `retention-serving-pg` 1, `native-prepared-launch-pg` 1) and 15 are the `input-admission` cases below.
- Still failing, pre-existing, not lane 4: PG/POSIX suites (`*-pg`, `native-preparation`); 15 `input-admission` writer-fence-1 cases that still assert pre-0016 first-run semantics (`REQUEST_REPLAY_REFUSED` where the initial-input owner now answers `INITIAL_INPUT_CONFLICT`/`EXPIRED`). That is first-run debt for lane 1's owner of 0016.
- One full run hit a native Node crash on `lifecycle-transition.test.mjs` under host memory pressure; the file passes 20/20 alone.
- Runtime composition selection (`apps/runtime`, `--experimental-test-module-mocks`, 12 files: control/first-run/input-admission/product mounts, prepared candidate, startup history, dynamic identity, lifecycle, remote runner, runtime): 77 run, 57 pass, 20 fail on both base and branch, identical names. Causes: POSIX secret-file permission checks (`RUNTIME_SECRET_FILE`) and runtime fixtures without the 0016 table (`STORE_UNAVAILABLE`); lane 1 composition owners.

## Dependencies and acceptance

- Lane 1 receives this branch into PR #133. No AWS or live action belongs to this lane.
- dot: review of the `CONVERSATION_CLOSED` contract code if Neo approves the continuity proposal; public `/control` client gate for pause/resume UI.
- Acceptance for the first shipment (lane 1 / dot, live): second prompt in the same conversation after reload; immediate send right after completion either reserves or answers a retryable conflict, never an uncertain turn; Stop during streaming, Stop repeated after a reply loss, and Stop of a queued run all end with one `USER_CANCELLED` and a reconciled original.

## Remaining tasks

1. Frontend: bounded automatic retry of next-turn on `CONVERSATION_TURN_CONFLICT / NOT_DISPATCHED`, and treat a Stop receipt for an already terminal run as settled (own worktree, draft PR).
2. Continuity: implement the approved option (after Neo's decision).
3. Pause/resume: continuation admission owner in the production composition (with lane 1), then the public `/control` contract and UI.
4. Backward transcript paging, if wanted, as an additive history contract change.
