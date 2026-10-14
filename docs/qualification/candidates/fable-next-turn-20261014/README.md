# Follow-up turns, slice A: next-run reservation journal and owner over real PostgreSQL (dot's corrected design)

Base `c6053e24b465be677cc5980533009b4aab03beab` (PR86). Author: Fable. Status: source candidate for dot's review (ACCEPT_SOURCE requested); no infrastructure, no provisioning, no migration execution against any product database, no deployment. Dot HELD the original follow-up turns proposal as written (source review at `7f7ee02`) and set a corrected design; dot stated that Fable may implement the source work without waiting for infrastructure and that source approval does not authorize provisioning. This candidate is the first bounded slice of that corrected design.

## Corrected design as implemented

| Dot's requirement | Where it is implemented |
| --- | --- |
| A new prompt is distinct from recovery of an old prompt; the existing `resume` (original prompt, paused/approval-wait only) is untouched | `next-run-journal.mjs` reserves a target run that carries no prompt; the prompt arrives only through `submit` on a session bound to the target (`service.mjs`); the source run's request id is refused on the target (`STALE_WRITER`/`REQUEST_REPLAY_REFUSED` control) |
| The completed turn's checkpoint is captured before disposal, and a checkpoint cannot replace verified task retirement and grant revocation | `reserve` requires, in SQL, a checkpoint row for the source run and a `RETIRED` native allocation with `physicalStopProven: true`; the owner additionally requires `retirement.verifyRetired` and `revocation.verifyRevoked` receipts and stores them as reservation facts (`NEXT_RUN_CHECKPOINT_REQUIRED`, `NEXT_RUN_RETIREMENT_REQUIRED`) |
| Select the latest owned run under the conversation lock; reserve one immutable next-run mapping; recover the same target after lost acknowledgements | `listRuns` and `reserve` run inside the store's `tx` with the per-conversation advisory lock; `next_runs` has one row per source run (primary key) and one per target run (unique), with a `BEFORE UPDATE OR DELETE` trigger refusing deletion, identity change and state regression; a replayed reservation returns the stored target and changed facts refuse (`NEXT_RUN_REPLAY_REFUSED`); concurrent selections yield one row |
| Issue a fresh target-bound session | `createNextRunOwner.selectRun` returns the reserved target binding for session issuance; `currentRun` joins a session-bound binding to the reserved target or the live latest run and refuses anything else (`NEXT_RUN_NOT_LATEST`) |
| Preserve conversation-wide event ordering and reconnect across runs | `runs.sequence_base` records where each run's events sit in the conversation-wide order (`accept` sets it to the source's `sequence_base + last_sequence`); `listRuns` verifies contiguity in fence order. The per-run wire sequence still restarts at 1 because the frozen public receiver (`packages/contracts/conversation-application/receive.mjs`, package 0.1.3) requires it; a conversation-wide cursor is proposed to Codex in `FABLE-FOLLOWUP-TURNS-PROPOSAL-20261014.md`, not made |
| Keep issuance within the existing admission, allocation and budget owners | Not in this slice. The owner consumes `retirement`/`revocation` ports and reads the native allocation journal; it issues no allocation, grant, capability or task. That is slice B |

## Files

- `apps/control/conversations/migrations/0009_next_runs.sql` (new, source only): `runs.sequence_base`, the `next_runs` table and its immutability trigger. Additive. The migration ID needs confirmation by the central allocation owner (HANDOFF §9); it was applied only to the three disposable local PostgreSQL 16 databases of the baseline runner and is listed in `provision-postgres.sh`.
- `apps/control/conversations/next-run-journal.mjs` (new): `createNextRunJournal({tx,rowRun})` with `listRuns`, `latestCheckpoint`, `reserve`, `readTarget`, `accept`.
- `apps/control/conversations/next-run.mjs` (new): `createNextRunOwner({store,retirement,revocation,versions,now,newId})` with `selectRun` and `currentRun`.
- `apps/control/conversations/postgres-store.mjs` (proof row, enumerated in `candidate-manifest-fable-20261014.json`): exports the `nextRuns` journal composed on the store's own transaction and lock; nothing else in the store changed.
- `apps/control/conversations/service.mjs`: `submit` accepts through `nextRuns.accept` when the session's binding is a reserved target, otherwise through the unchanged `accept`.
- `apps/control/conversations/test/store-fixture.mjs`: the scripted fixture models `next_runs` and `sequence_base` so the 147 existing conversation and worker controls keep running unchanged.
- `apps/control/conversations/test/next-run-pg.test.mjs` (new, 6 controls, real PostgreSQL): two prompts in one conversation with continued sequence base and wire sequence 1; pending reservation and lost acknowledgement recover the same target while changed facts refuse; completed, captured and retired source required, cancelled and failed sources refuse, foreign actor refused, the journal verifies retirement itself; the old prompt cannot be recovered through the next run, a completed run takes no new prompt, the stale session cannot write, an accepted next run makes its source not latest; concurrent selection under the lock yields one reservation; SQL immutability and no state regression.
- `scripts/qualification/local-baseline/provision-postgres.sh`: migration 0009 added to the local list.

## Receipt

`RESULTS-touched-suites.json`: local baseline runner, non-root (uid 30033), head `a010ba4` plus the uncommitted slice files (10 paths), clusters from `provision-postgres.sh start`, credential-shaped variables scrubbed, secret scan 0.

| Suite | Result |
| --- | --- |
| `source-proof` | 4/4 (historical manifest preserved; candidate manifest enumerates 5 changed proof rows, 40 unchanged) |
| `conversations-typecheck` | pass |
| `conversations-tests` | 153/153 (147 existing plus the 6 new real-PG controls) |
| `worker-conversation` | 135/135 |
| `runtime-tests` | 119/120 (the one failure is the Docker image-closure control, host fact, unchanged) |
| `scripts-local` | 27/27 |

## Slice B (not delivered here)

1. Per-run issuance inside the existing owners: a per-run `original`, allocation, grant intents and task capability for the reserved target through `createNativeAllocationAdmission` and the prepared runtime, never through a fixture initializer.
2. Completion checkpoint capture through the lifecycle owner at `run.status: completed` before the task is disposed, so `latestCheckpoint` finds the row without a manual capture.
3. The prepared-candidate identity/context join calling `createNextRunOwner.currentRun` instead of the single configured binding, and session issuance calling `selectRun`.
4. The conversation-wide cursor and run-listing contract changes, frozen by Codex before any public wire change.
5. A composed rehearsal of two consecutive prompts with the real CLI over the local clusters once 1–3 exist.
