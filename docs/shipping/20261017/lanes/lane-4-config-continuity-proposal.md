# Proposal: saved conversations across a configuration change (config A → config B)

Lane 4, Fable, 17 October 2026. Base `0e38ef49` (root `59856683`). **Status: proposal for review. No source in this file is applied.** It changes the rollout procedure and adds one refusal code, so it needs Neo's approval, and dot's review for the shared contract code, before any change.

## The risk, with evidence

A "configuration" here is the control's `RuntimeVersions` (`imageDigest`, `sdk`, `cli`, `contracts`, `skillsDigest`, `checkpointFormat`) and the prepared-run `configurationSha256` (`apps/runtime/prepared-run-configuration.mjs:7`). Every run row pins the versions it was admitted under. A new image changes at least `imageDigest`, so every deploy is a configuration change.

When control B serves a conversation whose runs were admitted under A:

| Operation | What B does today | Evidence |
|---|---|---|
| List, transcript, run history, reconnect | Works. Reads compare stored rows, not the current configuration. | `history/store.mjs` (no versions check), `service.mjs` `history` |
| Next turn | Refused **inside the reservation transaction** with `NEXT_RUN_SCOPE_REFUSED`, because the source run's versions differ from B's. The history facade maps that to `CONVERSATION_UNAVAILABLE` / `UNKNOWN`, so the UI shows an uncertain turn forever. | `next-run-journal.mjs` `reserve` (`same(latest.versions,versions)`), `history/service.mjs` `nextTurn` |
| Exact replay of an A request | Refused, `REQUEST_REPLAY_REFUSED` / `INITIAL_INPUT_CONFLICT`. | `service.mjs` `acceptInput`, `allocateInput` |
| Stop of a live A run after a control restart | The stop-only rebuild for a dynamic first run requires the **same** `configurationSha256`, so B cannot rebuild A's retirement port. The stop answers `PREPARED_KICKOFF_UNKNOWN`. | `apps/runtime/prepared-run-registry.mjs` `admittedRecord` (`r.configurationSha256!==c.configurationSha256`) |
| Stop of an A run on B's lifecycle route | Writes the durable `cancelled` fence and asks Temporal to cancel. The worker's later `execution/kickoff/stop` reaches B's registry and hits the row above. | `lifecycle/service.mjs` `cancel`, `apps/runtime/temporal-worker.mjs` `stopOriginal` |

So the documented risk in `STATE-AND-GATES.md` ("ConfigB may reject configA-pinned saved conversation continuation even after task drain") is real in source, and there is a second, more serious part: B also cannot stop A's dynamic first runs after a restart.

## Options

1. **Pin routing.** Keep an A controller (image, task definition, config) running and route each A-pinned conversation's writes to it until it is closed. This needs a pin-aware router in front of control, a second control service per live configuration, and Temporal task-queue separation per configuration. It is a placement and component change, with a lasting operating cost for each configuration kept alive.
2. **Explicit read-only closure (recommended for the preview).** A-pinned conversations stay fully readable under B and can no longer take a turn. B says so with a definite code instead of `UNKNOWN`, and the UI offers "Start a new chat" (optionally quoting the old conversation). Live A runs are drained by A before A is decommissioned.
3. **Compatible-forward successor.** Allow B to reserve a successor for an A source when only `imageDigest`/`skillsDigest` differ and `checkpointFormat`, `contracts`, `sdk`, `cli` are equal; the successor would be pinned to B. This weakens a deliberate integrity invariant (`same(latest.versions,versions)`) and needs a reviewed compatibility table and cross-version checkpoint restore tests. Not proposed now; listed so the trade-off is visible.

## Recommended rule (option 2)

1. **Drain before decommission.** A rollout from A to B first fences new admissions on A (no new first runs or reservations), then waits until every A run is terminal **and** its original is recorded `RETIRED` (or `FORECLOSED`) in the canonical allocation journal, then stops A. "Zero tasks" alone is not enough; the journal is the authority. The existing reconcile route (`apps/runtime/reconcile-run.mjs`) on A settles stragglers. A is kept (image, task definition, config, materials) until this proof exists, as the rollback section of `STATE-AND-GATES.md` already requires.
2. **Definite closure code.** B refuses an explicit next turn on a source pinned to other versions **before** the reservation transaction, with a new domain code `CONVERSATION_CLOSED` (HTTP 409, outcome `NOT_DISPATCHED`). The check is the same versions equality the journal enforces, read from the transcript's `latestRun.versions`, so nothing is reserved. The journal check stays as the authority; the facade check only makes the refusal definite.
   - Shared contract change: add `CONVERSATION_CLOSED:409` to `historyDomainErrorStatuses` in `packages/contracts/conversation-history/protocol.mjs` (package slot `0.1.6`). This needs a coordination comment to dot on PR #121 before editing.
3. **UI.** The transcript response already carries `latestRun.versions`. The frontend shows a closed conversation as read-only ("This conversation was saved by an earlier Meri version. Start a new chat to continue.") when next-turn answers `CONVERSATION_CLOSED`. No new endpoint.
4. **Stop custody.** Under rule 1, B never needs to stop an A run. As defence in depth, the stop-only rebuild in `prepared-run-registry.mjs` should accept a record whose `configurationSha256` differs from the current one **only for the stop-only path**, rebuilding retirement from the exact durable allocation facts it already uses (it never allocates). That is a change to the runtime registry, owned by lane 1's shipping composition; proposed here, not made.

## Acceptance for the change, once approved

- Source: an A-pinned completed conversation under B answers next-turn `409 CONVERSATION_CLOSED / NOT_DISPATCHED` with no `next_runs` row; transcript and reconnect still serve it; a B conversation is unaffected.
- Source: the stop-only path rebuilds an A dynamic original under B and records `RETIRED`, with a configuration-hash mismatch on the ordinary kickoff path still refused.
- Live (lane 1, dot): one rollout A → B with an A conversation open; drain proof (journal rows) captured before A stops; the A conversation reloads read-only under B.
