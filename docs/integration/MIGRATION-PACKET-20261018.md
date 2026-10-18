# Meri integration migration packet (proposal, 18 October 2026)

Status: **proposal for Neo's decision; nothing here is executed or authorized.** Prepared for PR #121 (dot's review 6245606528). Source tree: `fable/meri-integration-20261018`.

## Target

- Cluster `capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv` (Aurora PostgreSQL 16.11, 14-day backup retention). This is the shared live `capiro` database, the same one used by the Stage 1 first-chat apply (snapshot `meri-first-chat-pre-20261017` was taken from it).
- Database `capiro`.
- Runner: `infra/product-preview/first-chat-migrate.mjs meri`, the Stage 1 migrate task.
  - Each file runs in one transaction as the NOLOGIN owner `meri_product_migrator`, via `SET LOCAL ROLE`, with `statement_timeout 300s` and `lock_timeout 10s`.
  - The file's sha256 is recorded in `meri_migration_ledger.applied`.
  - A file whose bytes changed after it was applied is refused, and an unchanged applied file is skipped.
- Mechanism precedent: D015 #13, which approved the artifacts migrations through the same task.

## Files

| # | File | Objects created | Non-CREATE operations | Outside its own schema |
|---|---|---|---|---|
| 1 | `apps/control/settings/migrations/0001_settings.sql` | schema `meri_settings`; tables `tenant_settings`, `user_preferences`, `settings_audit`; append-only audit function and trigger; one index | none | none |
| 2 | `apps/control/intents/migrations/0001_intent_preparations.sql` | schema `meri_intents`; table `preparations`; immutability function and trigger | none | none |
| 3 | `apps/control/commands/migrations/0001_commands.sql` | table **`public.meri_command_journal`** | none | **creates in `public` (blocker 1)** |
| 4 | `apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql` | table **`public.meri_approval_metadata`** | none | **creates in `public` (blocker 1)** |
| 5 | `apps/control/schedules/migrations/0001_schedule_owner.sql` | schema `meri_schedules`; tables `projections`, `intents`; one index | none | none |
| 6 | `apps/control/schedules/migrations/0002_occurrences.sql` | table `meri_schedules.occurrences`; one unique index | none | none |
| 7 | `apps/control/task-lookup/migrations/0001_task_lookup.sql` | schema `meri_task_lookup`; tables `lookups`, `events` | none | none |
| 8 | `apps/runtime/objective-source/migrations/0001_objective_custody.sql` | schema `meri_objective_source`; table `custody`; immutability function and two triggers | none | **FKs to `meri_conversations.run_issuances(issuance_key)` and `meri_conversations.runs(tenant_id,conversation_id,run_id)` (blocker 3)** |
| 9 | `apps/artifacts/migrations/0001_versions.sql` (D015 #13) | schema `meri_artifacts`; tables `versions`, `heads`; mutation-reject function and trigger; one index | none | none |
| 10 | `apps/artifacts/migrations/0002_retention.sql` (D015 #13) | tables `retention_subjects`, `retention_purges`; one index | `CREATE OR REPLACE FUNCTION meri_artifacts.reject_version_mutation` (its own function from #9) | none |
| 11 | `apps/artifacts/migrations/0003_previews.sql` (D015 #13) | tables `preview_attempts`, `previews`; two guard functions and triggers; view `preview_custody` | `ALTER TABLE meri_artifacts.versions ADD CONSTRAINT` (its own table from #9, still empty at apply) | none |

sha256 of each file at `291ff5d7` (the runner pins these):

```
7243fe1e45b4890fc36eeb5c96a6ec493bd92cb8572de11b8d6bae5f06d976e1  apps/control/settings/migrations/0001_settings.sql
108b26fbb30d1e7aa2d38942ed5099413a09d7919f5e7fbf2c541ab92f9c68bc  apps/control/intents/migrations/0001_intent_preparations.sql
252683e2db8ffd36dbc7b3cfdada9a28f59a0f192522253a852686369560704b  apps/control/commands/migrations/0001_commands.sql
3270e42c779bbe5a367506142a45b31ed3d9ccbe90b88658d52ba3bcf5543e3b  apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql
bf8c593de97dcdae728765ecd90dac6696b290028d4ffb0586bdae0fe87d91c7  apps/control/schedules/migrations/0001_schedule_owner.sql
6a8369dc45e2bc330425550583daceb706652698ebbdecee1f5a1f2202a07242  apps/control/schedules/migrations/0002_occurrences.sql
ae3197c4f898c5a8a493b2bee4cd6c5da16c62730ad3447e4f07ebfeaf1c100f  apps/control/task-lookup/migrations/0001_task_lookup.sql
1e22b44fcc59ae88e593f6d15f63083bdff0c3421584646fc7a357e7f67b9b34  apps/runtime/objective-source/migrations/0001_objective_custody.sql
d654a24aa4f45c4b3c43d927263f96b8b2f406af509840819feda36c5f2dee19  apps/artifacts/migrations/0001_versions.sql
8212082ea875117afb2ba129474ba5f6ba4f937c3d0192ca07267738cd73cba6  apps/artifacts/migrations/0002_retention.sql
d1eb7ea68a150f60e7fb63e654a0892044bf24840a785fcff58dded59129b300  apps/artifacts/migrations/0003_previews.sql
```

Data backfill: **none**; every file creates empty objects. Destructive operations: **none on any existing object.** The only `ALTER` (#11) and `CREATE OR REPLACE` (#10) touch objects that #9 in this same packet creates.

## Blockers to fix in source before any apply

1. **#3 and #4 create tables in `public` of the shared `capiro` database.**
   - `public` belongs to Core's Prisma schema. The code also reads and writes `public.meri_command_journal` (`apps/control/commands/postgres-command-journal.mjs:40-59`) and `public.meri_approval_metadata` (`apps/control/commands/approval-metadata/postgres-store.mjs:26-33`).
   - On PostgreSQL 16, `public` grants no CREATE to PUBLIC, and the Stage 1 bootstrap grants `meri_product_migrator` only `CREATE ON DATABASE capiro` (that is, schemas), not CREATE on `public`. As written, these two files are therefore expected to fail with a permission error. This is unverified: the live ACL of `capiro.public` has not been read.
   - **Proposed source fix (R0):** move both tables into a Meri-owned schema `meri_commands`. That means changing the two migration files, the two stores, `apps/control/intents/{approval,native-approvals}.mjs`, and the schema contract and fixtures under `apps/control/qualified-application/`.
   - Neither file has been applied anywhere, so the change involves no data migration. New sha256 values replace rows 3 and 4.
2. **The plan and grants are not authored yet.**
   - `first-chat-migrate.mjs` pins only conversations 0001–0017, budget 0001–0002, issuer 0001 and the seed. The `first-chat-database.sql` `meri_grants` phase grants only `meri_conversations`, `meri_product_budget` and `meri_service_identity`. Even the D015 #13 artifacts files have no plan entry or runtime grant yet.
   - **Source task (R0):**
     - Add `['migration', path, sha256]` plan entries in the order above.
     - Add a `meri_grants` section that revokes PUBLIC on each new schema and grants `USAGE` only to the role whose store runs there: `meri_control_runtime`, plus the worker or schedule role where applicable.
     - Grant table privileges derived from each store's own statements: INSERT/SELECT on append-only tables, UPDATE only where the store issues it, and never DELETE/TRUNCATE.
     - This changes the `phase:meri_grants` digest. The exact grant text is published with that commit for review.
3. **#8 adds foreign keys onto live Meri tables** (`meri_conversations.runs`, `.run_issuances`). Creating them takes a brief `SHARE ROW EXCLUSIVE` lock on each referenced table, bounded by `lock_timeout 10s`, and the transaction aborts rather than waits. Separately, if #8 is not the D7-4 run-start migration (D015 #12), it needs its own decision from Neo.

## Snapshot and restore

- **Before apply:** take a manual cluster snapshot, `aws rds create-db-cluster-snapshot --db-cluster-identifier capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv --db-cluster-snapshot-identifier meri-integration-pre-<UTC timestamp>`. Wait for `available`, then record its identifier in the release record. Point-in-time recovery (14 days) remains as a second line.
- **Logical rollback** (the preferred path; it touches only this packet's objects), run as the admin login in one transaction:
  - `DROP SCHEMA meri_settings, meri_intents, meri_schedules, meri_task_lookup, meri_objective_source, meri_artifacts, meri_commands CASCADE;`
  - Delete this packet's rows from `meri_migration_ledger.applied`.
  - Nothing outside these schemas is created, so nothing else needs reverting. The #8 FKs are dropped along with `meri_objective_source`.
- **Snapshot restore** would restore the whole shared database, Core data included. It is only for disaster recovery and is never used to undo this packet.

## What it enables once applied and composed

| Families | Migrations |
|---|---|
| User preferences and tenant settings | #1 |
| Write intents | #2–#4 |
| Schedules and routines | #5–#6 |
| Tasks | #7 (+ #3) |
| Objective source custody | #8 |
| Documents and artifacts | #9–#11 |

Applying the migrations alone enables nothing: each family also needs its composer wiring and render key, tracked in ledger §5. Control readiness must check only the tables of families that are actually composed, so an absent table never stops startup for a disabled family.
