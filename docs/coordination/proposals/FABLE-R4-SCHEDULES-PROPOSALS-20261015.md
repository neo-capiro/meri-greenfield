# Proposals for dot: schedule correctness follow-up (package-three review)

Fable, 15 October 2026, branch `fable/r4-schedules-20261015` from `81e20025`. These accompany
[FABLE-R4-SCHEDULES-20261015.md](../reports/FABLE-R4-SCHEDULES-20261015.md) and refine
[FABLE-L6-SCHEDULES-PROPOSALS-20261015.md](FABLE-L6-SCHEDULES-PROPOSALS-20261015.md). Nothing here edits a frozen contract, applies
a migration, registers a worker, changes placement or grants activation. Each item says exactly what stays unwired until decided.

## P-R4-1 Migration request: durable occurrence barrier (resolves P-L6-4 with its option 2)

**Why.** The dispatch workflow's open run was the only thing that kept an UNKNOWN occurrence blocking later firings. Its run
timeout comes from `projection.maxRuntimeSeconds` (retried `retryLimit` times), so an UNKNOWN could outlive it and later firings
were then admitted. This branch moves the barrier into the schedule owner: every occurrence writes one row before its first effect
(the conversation acceptance), and no other occurrence of the same schedule may open while a row is `OPEN`. The row also binds the
occurrence to its exact conversation run, request, first event and native conversation workflow ID, so a later firing reconciles
the predecessor's real run, not a re-derived guess.

**Proposed DDL** (product namespace `meri_schedules`; ID to be allocated centrally; not applied anywhere):

```sql
CREATE TABLE meri_schedules.occurrences (
 tenant_id text NOT NULL,
 occurrence_key text NOT NULL CHECK (occurrence_key ~ '^[a-f0-9]{64}$'),
 schedule_id uuid NOT NULL,
 generation bigint NOT NULL CHECK (generation >= 1),
 occurrence jsonb NOT NULL,
 effect jsonb NOT NULL,
 effect_sha256 text NOT NULL CHECK (effect_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('OPEN','DISPATCHED','REFUSED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id, occurrence_key),
 FOREIGN KEY (tenant_id, schedule_id) REFERENCES meri_schedules.projections(tenant_id, schedule_id)
);
-- At most one unresolved occurrence per schedule, independently of the advisory lock.
CREATE UNIQUE INDEX occurrences_one_open ON meri_schedules.occurrences(tenant_id, schedule_id) WHERE state = 'OPEN';
```

**Owner operations already written against it** (`apps/control/schedules/postgres-schedule-owner.mjs`):

- `openOccurrence({tenantId, scheduleId, generation, occurrenceKey, occurrence, effect})`, under the same
  `pg_advisory_xact_lock(hashtextextended('<tenant>:<schedule>',0))` as intent claims: the same key returns its stored state (a
  different stored effect is `SCHEDULE_OCCURRENCE_CONFLICT`); otherwise another `OPEN` row returns `BLOCKED` with that row; otherwise
  it inserts `OPEN`.
- `settleOccurrence({tenantId, occurrenceKey, effectSha256, state})`, row `FOR UPDATE`: `OPEN` → `DISPATCHED` or `REFUSED`, and
  `REFUSED` → `DISPATCHED` when the run is later observed started. Nothing reopens. A missing row is reported (`ABSENT`), never
  created.

`effect` is `{binding, requestId, eventId, workflowId}` where `binding` is the run binding derived from the occurrence and
`workflowId` is the conversation dispatcher's `meri:<tenant>:<conversation>:<run>`.

**Unwired until allocation.** The SQL runs only against the scripted fixture. Without the table every well-formed dispatch answers
UNKNOWN (opening the row fails before acceptance or start, and settling a refusal or an observed start fails too), so nothing new
is admitted or started: fail-closed. The scheduled workflow is
still unregistered (P-L6-2), so no production path reaches this code.

## P-R4-2 Recording proven non-effect for an occurrence (decision needed; mirrors P-L6-1)

An `OPEN` row whose run is absent, or admitted but never started, is cleared today only by the occurrence's own workflow
completing it (reconcile, then dispatch the same identity) or by a fenced refusal of that occurrence. After the workflow has ended,
such a row blocks the schedule indefinitely: safe, not recovered availability. Proposed rule for review, not implemented:

- New state `NOT_DISPATCHED` with `resolution_sha256` (same pattern as P-L6-1).
- Allowed only when the row is quiescent on the database clock (`clock_timestamp() > updated_at + interval '5 minutes'`, longer than
  the 2-minute settle plus the 1-minute activity bound and request bounds) **and** the canonical store's locked read proves the run
  absent, or proves it `queued` with Temporal's typed `WorkflowNotFoundError` for the exact `workflowId` in `effect`.
- An admitted-but-unstarted run stays `queued` and visible; a cancellation event for it belongs to the conversation owner.

## P-R4-3 Actual-job lifecycle owner for scheduled runs (decision needed)

The schedule wrapper ends at DISPATCHED, so schedule overlap, cancellation, runtime/retry/cost limits and delivery do not govern
the issued conversation run. Proposed ownership, using the occurrence row as the single association:

1. **Overlap.** Keep the occurrence row `DISPATCHED` but add a second barrier phase: a later occurrence of a schedule whose overlap is
   not `ALLOW_ALL` is refused (`SKIP`) or left for the next firing (`BUFFER_*`) while the predecessor's conversation run is not
   terminal. "Terminal" is read from the conversation store's run state for `effect.binding`, never from the wrapper.
2. **Cancellation and physical stop.** `cancel_scheduled_task` with `running:'request_cancel'` should list the conversation runs named
   by `OPEN`/`DISPATCHED` occurrence rows (their `effect.workflowId`), not the wrapper workflows, and drive them through the existing
   conversation lifecycle cancel/retire path. Physical-stop evidence stays the conversation owner's retirement receipt; the schedule
   mutation keeps reporting `physicalStopProven:false`.
3. **Limits and destination.** `ScheduleProjection.maxCostMicrousd`, `maxRuntimeSeconds`, `retryLimit` and `destinationId` must reach
   the issued run. This needs a frozen-contract change (exact text for dot): add an optional run-admission field
   `schedule: {scheduleId, occurrenceKey, maxCostMicrousd, maxRuntimeSeconds, retryLimit, destinationId}` that the conversation
   store persists with the run and the conversation dispatcher/runtime enforce (budget allocation, run deadline, attempt count,
   result delivery). Until then the wrapper's `workflowRunTimeout`/`retry` bound only dispatch.
4. **Wrapper timeout.** With P-R4-1 the wrapper's run timeout no longer carries the UNKNOWN barrier, so it can be decoupled from the
   task runtime (P-L6-4 option 1) in a later change to `scheduleSdkOptions` and the reviewed intent shape.

## P-R4-4 Current schedule authority and approved-instruction store (refines P-L6-3)

Interfaces are unchanged from P-L6-3; both are consumed through injected ports and answer UNKNOWN when absent.

- **Authority:** derive from the same current principal/role/tenant-policy owner the gateway's current-tool authority uses
  (`apps/gateway/authorization/current-tool-authority.mjs`), evaluated for the schedule's original owner at `before_admission` and
  `before_start`, with `expiresAtMs` no later than the owner's current grant expiry. A deactivated owner, a revoked scope or a
  disabled tenant schedule policy is an explicit `{authorized:false}`; an unreachable policy owner throws.
- **Instructions:** persist the approved instruction text with the schedule approval in the command/approval journal, keyed by
  `(tenant_id, intent_id)` and immutable; `read({tenantId, scheduleId, generation, task, instructionSha256})` looks up the
  acknowledged intent for that generation and returns the text only when `canonicalSha256(text)` equals the digest. Retention and
  purge of this text join the schedule's retention lifecycle.

## Local wire shapes (not contracts)

- Dispatch outcome codes added: `SCHEDULE_OCCURRENCE_UNRESOLVED` (REFUSED: another occurrence of the schedule is unresolved),
  `SCHEDULE_OCCURRENCE_SETTLED` (REFUSED: this occurrence was already settled), `SCHEDULE_OCCURRENCE_CONFLICT` and
  `SCHEDULE_OCCURRENCE_RECEIPT` (UNKNOWN).
- Intent reconciliation code added: `SCHEDULE_INTENT_EFFECT_NOT_COMPARABLE` (UNRESOLVED; the approved create/update cannot be read
  back faithfully).
- No frozen schema was edited.
