# Migration request: retention recovered watermark and row-class deletion amendments

Requested by Fable on 16 October 2026, lane RETENTION (`fable/live-retention-20261016`, base `48a27c8d`). Migration IDs are allocated centrally; no ID is allocated to this lane. This document proposes DDL and asks dot to allocate the IDs and review the DDL. Nothing in this repository applies it. The source that targets it fails closed until it exists:

- `apps/control/retention/postgres-watermark.mjs` reads and writes the proposed watermark table. Until the table exists, declared retention readiness fails with `RETENTION_SCHEMA_UNAVAILABLE`, because the control readiness check lists the table among the retention projections.
- `apps/control/retention/postgres-journal.mjs` refuses every row class other than `sdkSession` and `artifactVersions` at preflight with `RETENTION_ROW_CLASS_UNSUPPORTED`. A complete conversation purge therefore refuses with zero effects until amendment B exists and its routing is added.

## A. Recovered watermark (conversations family, next ID to be allocated)

The watermark is the ledger position through which the restorable projection holds every acknowledged retention transition. It has to live inside the restored database so that a restore rolls it back together with the projection. Ordinary writes only advance it. A completed reconciliation records the exact ledger head (sequence and entry hash), reads it back, and only then reopens serving.

```sql
BEGIN;
CREATE TABLE meri_conversations.retention_recovery_watermark (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 sequence bigint NOT NULL CHECK (sequence >= 0),
 entry_sha256 text CHECK (entry_sha256 IS NULL OR entry_sha256 ~ '^[a-f0-9]{64}$'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
```

Access pattern, all through the retention journal's bounded transaction owner (`journal.tx`, DA-4 lease rules):

| Operation | Statement | When | Recovery lock |
|---|---|---|---|
| read | `SELECT sequence,entry_sha256 ... WHERE singleton` | every served read | shared |
| advance | `INSERT ... ON CONFLICT (singleton) DO UPDATE SET sequence=GREATEST(...)`, which clears `entry_sha256` when the position moves | after every projection write | shared; recovery writes take none, because recovery already holds the exclusive lock on its own session |
| record | the same upsert with the exact `entry_sha256` | at the end of a settled reconciliation pass | exclusive |

A missing row reads as position 0.

Possible improvement for dot to decide: advance the watermark inside the projection's own transaction (in `retention_subjects` writes), so that projection and watermark commit atomically. The current source advances it in a separate transaction. If that advance's outcome is unknown, the fence closes (`RETENTION_WATERMARK_UNKNOWN`) and serving waits for reconciliation. That is safe, but it costs availability.

## B. Row-class deletion amendments (one ID per family, to be allocated)

The data-class registry (`apps/control/retention/data-classes.mjs`) now emits an exact row target for every row of every retained row class. The applied schema admits purge DELETEs only for `sdk_session_entries` (conversations 0010) and `meri_artifacts.versions` (artifacts 0002). To admit the remaining classes, each needs the same three parts:

1. A recorded exact target.
2. A DELETE admitted only inside the transaction that recorded a matching PLANNED target, while the subject is SUPPRESSED.
3. UPDATE still refused.

Proposed shape, mirroring `retention_purge_targets`:

```sql
-- Generic exact row targets for the conversation-scoped classes; one row per (class, key) a plan may delete.
CREATE TABLE meri_conversations.retention_row_targets (
 workflow_id text PRIMARY KEY CHECK (workflow_id ~ '^[a-f0-9]{64}$'),
 tenant_id text NOT NULL, conversation_id uuid NOT NULL,
 class text NOT NULL CHECK (class IN ('conversation','events','lifecycle','completionCheckpoints','nextRuns','selectedOutputs','nativeJournals','receipts')),
 target_key uuid NOT NULL,
 plan_sha256 text NOT NULL CHECK (plan_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('PLANNED','EXECUTED','UNKNOWN')),
 ledger_sequence bigint NOT NULL CHECK (ledger_sequence >= 1),
 FOREIGN KEY (tenant_id, conversation_id) REFERENCES meri_conversations.retention_subjects
);
-- Per table: a BEFORE DELETE trigger that returns OLD only when a PLANNED target for (tenant, conversation, class, key) was recorded
-- by the current transaction (t.xmin = pg_current_xact_id()::xid) and the subject is SUPPRESSED; otherwise it raises, as in 0010.
```

The routing to define per table is listed below. The registry keys come from the snapshot producer's identifiers. The adapter author must confirm each key against the table's primary key when writing the routing.

| Class | Tables | Primary key found | Inventory key |
|---|---|---|---|
| conversation | `conversations`, `runs`, `controls` | `(tenant_id, conversation_id)`, `(…, run_id)`, `(tenant_id, control_id)` | subject id; run id |
| events | `events` | `(tenant_id, conversation_id, run_id, sequence)` | subject id (every event of the subject) |
| lifecycle | `checkpoints` | `(tenant_id, checkpoint_id)` | checkpoint id |
| completionCheckpoints | `completion_checkpoints` | `(tenant_id, conversation_id, run_id)` | needs a run id key; snapshot currently names the checkpoint id |
| nextRuns | `next_runs` | `(tenant_id, conversation_id, source_run_id)` | target run id; confirm the column |
| selectedOutputs | `selected_outputs`, `selected_reads` | `(…, run_id)`, `(…, run_id, delivery_sha256)` | output id; confirm, the tables key by run |
| nativeJournals | `native_executions`, `native_allocations`, `native_restorations` | `(…, run_id)` | run id |
| receipts | `meri_command_journal`, `meri_approval_metadata`, `run_issuances`, `meri_task_lookup.*` | actor-keyed | receipt id; the subject-to-receipt link needs the producer |

Ordering constraint:

- `meri_conversations.retention_subjects` has a foreign key to `conversations`. Deleting the conversation row would either remove the retention projection or be refused.
- Proposed fix: drop that foreign key so the retention subject row stays as a tombstone that records the purge after the conversation row is gone, and delete the conversation row last inside the same row-purge transaction.
- Recovery must then treat a purged subject row as `EXECUTED`, not as a missing subject.

Schedules are not in this table. They are actor-owned, and every firing runs in its own derived conversation, so the registry gives them their own subject kind (`schedule`). That kind has no retention journal yet: no `retention_subjects` table, no read gate and no row routing. A conversation or artifact plan that carries schedule rows is therefore BLOCKED as a subject mismatch. Adding the `schedule` subject kind needs its own design and table pair. That is a follow-up request, not part of this one.

## Not requested

- No role, grant or seed row.
- No change to applied migrations 0001–0011 or artifacts 0001–0002.
- No execution of any migration.
- No product purge activation: runtime configuration still accepts only `retention.purge.enabled:false`.
- The ledger sink binding (the write-once store owned by the shipping owner) is a separate deployment input, not a migration.
