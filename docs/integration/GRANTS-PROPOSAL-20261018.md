# Least-privilege grants for the new Meri schemas (read-only analysis)

Analyzed tree: `C:\dev\fable\wt-meri-integration` at `7f275833` (the branch advanced from `4bde2b0d` while I worked; I re-checked every file I cite against the newer commits). All paths below are relative to the repo root. "Production" excludes `*/test/*`, `*.test.mjs`, `*fixture*`, `*/local-integration/*`, `*int-test*`, `apps/control/qualified-application/*` (an "owned fixture graph" qualification harness) and `apps/control/action-application/local/demo.mjs`.

## 0. Two facts to read first

1. **Do not edit `first-chat-database.sql`.** The file's sha256 is pinned in `PLAN` at `first-chat-migrate.mjs:52`, and a changed pin is refused with `MERI_D2_SOURCE_CHANGED` (`:64`). If you re-pin it instead, the recorded ledger row is refused with `MERI_D2_APPLIED_FILE_CHANGED` (`:228`). The precedent is `first-chat-database-temporal.sql`, which superseded a section of that file without touching it (`first-chat-migrate.mjs:22-23`). Put the block below in a **new psql file**, for example `infra/product-preview/first-chat-database-integration.sql`, with its own plan entry `['phase:integration_grants', <file>, <sha>]` after the 11 packet migrations. A `phase:*` kind other than `temporal_grants` gets stage `meri` (`:56`). The runner passes only `phase_<name>=1` to a non-bootstrap phase (`:284`). Whether ledger row 20 is actually recorded live is **unverified**. The ledger G5 and the comment at `:22` both say it is.
2. **No store below runs in production yet.** Production control does receive a `productPortsFactory` now (`apps/runtime/cli.mjs:35-36`), but `PRODUCT_FAMILIES` is empty (`apps/runtime/product-ports/index.mjs:12`). The prepared candidate supplies only the identity, membership, currentness, turns and SDK-session ports (`prepared-candidate.mjs:104-106`). The rendered control config has no `userPreferences` or `retention` key (`render-material.mjs:326-331`). Every grant below is therefore latent until its family is composed. Families compose over the trusted control context `{configuration, pool, …}` (`product-ports/index.mjs:2-3`), which is the control pool.

## 1. Which process connects as which role

| Process | DB login | Evidence |
|---|---|---|
| control | `meri_control_runtime` (pool max 10) | `render-material.mjs:337,383`; `control.mjs:130` |
| model-owner | `meri_model_budget_owner` | `:338,390`. Runs none of these stores. |
| temporal-issuer | `meri_temporal_issuer_service` | `:339,387`. Runs none of these stores. |
| temporal-worker, model-proxy | **no database file** | `:386,392`. No store may run in either process. |
| schedule-worker | **no role** | Not in `ROLES` (`:55`). Refused under preview (`cli.mjs:20`). It would open its own pool from `database.connectionFile` (`schedule-service.mjs:52,60`). |

## 2. Statements per table

Built-ins used along the way (`pg_advisory_xact_lock[_shared]`, `hashtextextended`, `to_regclass`, `set_config`, `clock_timestamp`) need no grant. No production `TRUNCATE` exists. `settings_audit.sequence` is an IDENTITY column, so no sequence grant is needed. No other sequences exist. A row lock (`FOR UPDATE/SHARE/KEY SHARE`) needs UPDATE on at least one column (PostgreSQL 16 SELECT docs, as already applied in `EXISTING-DATABASE-GRANTS-20261016.md:52`).

**meri_settings**: `apps/control/settings/postgres-store.mjs`, constructed by `control.mjs:80` → `user-preferences.mjs:21` → `user-application/feature.mjs:14` (control).

| Table | Role | Verbs | Evidence |
|---|---|---|---|
| user_preferences | control | SELECT; INSERT…ON CONFLICT DO NOTHING RETURNING; SELECT…FOR UPDATE; UPDATE(revision,document,document_sha256,updated_at,updated_by) | :21, :31, :34, :36 (user-service.mjs:11,18) |
| settings_audit | control | INSERT only (no RETURNING) | :43 |
| tenant_settings, settings_audit SELECT | none today | kind `tenant` :21/:32/:36 and listAudit :50 are reached only through `createSettingsService` (`service.mjs:13,22,46,54`), which has no production composer. The `settingsApplication` port is routed but never supplied. | deferred (§4) |

**meri_intents**: `apps/control/intents/postgres-journal.mjs`

| Table | Role | Verbs | Evidence |
|---|---|---|---|
| preparations | control | INSERT…ON CONFLICT DO NOTHING RETURNING; SELECT; UPDATE(state,outcome,settled_at) | :53; :56,:64,:74,:76,:122; :90. Constructed by `intents/compose.mjs:27`, `task-command-application/feature.mjs:18` and `runtime/routines.mjs:24`. |
| preparations | schedule-worker | SELECT | :122, via `schedule-worker.mjs:24` |

A DELETE is refused by the trigger (`0001_intent_preparations.sql:43,50`).

**meri_commands** (line numbers refer to today's `public.*` text; the R0 move is assumed)

| Table | Role | Verbs | Evidence |
|---|---|---|---|
| command_journal | control | INSERT…RETURNING *; SELECT…FOR UPDATE; UPDATE(state,outcome,updated_at); UPDATE(state,updated_at) | `commands/postgres-command-journal.mjs:45-47; :40,:70; :59; :66`. Constructed by `action-host/durable/index.mjs:22` and `intents/task-update-services.mjs:28`. |
| approval_metadata | control | INSERT…RETURNING; SELECT | `commands/approval-metadata/postgres-store.mjs:26; :33`. Constructed by `durable/index.mjs:21` and `task-update-services.mjs:25`. |

**meri_schedules**: `apps/control/schedules/postgres-schedule-owner.mjs`. On the control side the owner is used by routines (`routines.mjs:24`, `schedule-lifecycle.mjs:21`, `application.mjs:21,97`, `scheduled-conversation-currentness.mjs:29`, `scheduled-run-cancellation.mjs:15`). On the worker side it is used by `schedule-worker.mjs:23` and `scheduled-dispatch.mjs:37`.

| Table | Role | Verbs | Evidence |
|---|---|---|---|
| projections | control | SELECT (incl. FOR UPDATE); INSERT; UPDATE(active_intent); UPDATE(generation,projection,projection_sha256,active_intent) | :29,:64,:170; :32; :35; :52 |
| projections | schedule-worker | SELECT | :64 |
| intents | control | SELECT (incl. FOR UPDATE); INSERT; UPDATE(state,updated_at) | :28,:44,:64,:75,:86; :37; :46,:88 |
| intents | schedule-worker | SELECT | :64 |
| occurrences | control | SELECT (incl. FOR UPDATE); UPDATE(state,updated_at) | :116,:130,:157; :163 |
| occurrences | schedule-worker | SELECT…FOR UPDATE; INSERT; UPDATE(state,updated_at) | :143,:145,:157; **:147**; :163 |

**meri_task_lookup**: `apps/control/task-lookup/postgres-results.mjs`, constructed by `action-host/durable/index.mjs:20`. That file is reached only from `admitted-runs/mount-core.mjs:7`, which only the qualification harness and the local demo import.

| Table | Role | Verbs | Evidence |
|---|---|---|---|
| lookups | control (unverified) | INSERT…ON CONFLICT DO NOTHING RETURNING; SELECT…FOR UPDATE; SELECT; UPDATE(state); UPDATE(state,record) | :24; :19; :41; :30,:38; :33 |
| events | control (unverified) | INSERT; UPDATE(event) with WHERE on tenant_id/lookup_id/kind/event (needs SELECT) | :26; :34,:39 |

**meri_objective_source**: `apps/runtime/objective-source/postgres-custody.mjs`. It has no production constructor; tests only. "Trusted control composition" is stated in `native-authority.mjs:1-3`.

| Table | Role | Verbs | Evidence |
|---|---|---|---|
| custody | control (unverified) | INSERT…ON CONFLICT DO NOTHING RETURNING; SELECT (FOR UPDATE when locking); UPDATE(state,version,committed_at) RETURNING | :24/:152; :103,:140,:181; :25/:166 |

The store also runs `meri_conversations.runs`/`run_issuances … FOR UPDATE` (:96, :98). The existing control column-UPDATE grants already cover these (`first-chat-database.sql:251-259`). DELETE and TRUNCATE are refused by its triggers (`0001_objective_custody.sql:91,113-116`).

**meri_artifacts**: `createRuntimeArtifactStorage` (`runtime/artifacts/composition.mjs:11`) is not imported anywhere. The versions store does no SQL without the retention journal (`storage/postgres-versions.mjs:11`), so it runs only when `retention` is composed (`control.mjs:59-64`). Abbreviations in the table: V=`storage/postgres-versions.mjs`, P=`storage/postgres-publication-projection.mjs`, C=`preview/postgres-custody.mjs`, S=`preview/postgres-store.mjs`, J=`control/retention/postgres-journal.mjs`.

| Table | Role | Verbs | Evidence |
|---|---|---|---|
| versions | control | SELECT; INSERT…ON CONFLICT DO NOTHING; lock-only UPDATE(1 col) for trigger `guard_preview_attempt`'s `FOR KEY SHARE`, which runs as the invoker | V:20,27,34,56; P:5,22; P:21; `0003_previews.sql:125-127` |
| heads | control | SELECT (incl. FOR SHARE); INSERT; UPDATE(version_id,projection,projection_sha256) | V:22,56; P:5; J:134; P:26; P:25 |
| preview_attempts | control | INSERT…ON CONFLICT DO NOTHING; SELECT…FOR UPDATE; SELECT; UPDATE(object_reference,object_reference_sha256,object_version_id) | C:21; C:22,27; S:32; C:26 |
| previews | control | INSERT…ON CONFLICT DO NOTHING; SELECT. Trigger lock on preview_attempts is covered by the grant above. | C:31; C:32, S:32; `0003:165-166` |
| preview_custody (view) | none | no production reader | n/a |
| retention_subjects | control, **deferred** | SELECT…FOR UPDATE, SELECT; INSERT; UPDATE(8 cols) | J:46,53,88; J:75; J:74 |
| retention_purges | control, **deferred** | DELETE (projection rewrite); INSERT. Purge-only: INSERT…ON CONFLICT DO UPDATE, UPDATE(state). | J:76; J:82; J:107, J:126 |

## 3. SQL for the new psql file (exact text; it can also be pasted into a phase body without the wrapper)

```sql
-- Meri integration grants (phase_integration_grants only), run by first-chat-migrate.mjs stage 'meri' after the
-- integration packet migrations (docs/integration/MIGRATION-PACKET-20261018.md #1-#11, #3/#4 moved to meri_commands).
-- first-chat-database.sql stays byte-identical: its phase_meri_grants sha256 is recorded in meri_migration_ledger.
-- Same rules as phase_meri_grants: runtime logins get schema USAGE, SELECT/INSERT and column UPDATE only, each derived
-- from a production statement; no DELETE, TRUNCATE, table-wide UPDATE, default privilege or grant option.
-- Retention-projection and purge privileges are withheld: control composes no retention serving and purge is disabled.
\set ON_ERROR_STOP on
SELECT CASE WHEN (:{?phase_integration_grants})::int = 1 THEN 'ok'
            ELSE (SELECT 'MERI_D2_INTEGRATION_GRANTS_PHASE_REQUIRED'::text)::int::text END AS phase_guard;

\if :{?phase_integration_grants}
-- ===================================================================== INTEGRATION GRANTS (after the packet migrations)
-- Runs as the schema owner. Every object below was created by the ordered migrations under this role.
SET ROLE meri_product_migrator;
DO $$
DECLARE missing text;
BEGIN
 IF current_database() <> 'capiro' THEN RAISE EXCEPTION 'MERI_D2_RUN_ON_DATABASE_CAPIRO'; END IF;
 IF to_regclass('public.meri_command_journal') IS NOT NULL OR to_regclass('public.meri_approval_metadata') IS NOT NULL THEN
  RAISE EXCEPTION 'MERI_D2_COMMANDS_IN_PUBLIC';
 END IF;
 SELECT string_agg(s, ', ') INTO missing FROM unnest(ARRAY[
  'meri_settings','meri_intents','meri_commands','meri_schedules','meri_task_lookup','meri_objective_source','meri_artifacts']) AS s
  WHERE NOT EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = s AND pg_get_userbyid(n.nspowner) = 'meri_product_migrator');
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_MIGRATED_SCHEMA_MISSING_OR_FOREIGN %', missing; END IF;
 SELECT string_agg(t, ', ') INTO missing FROM unnest(ARRAY[
  'meri_settings.tenant_settings','meri_settings.user_preferences','meri_settings.settings_audit',
  'meri_intents.preparations','meri_commands.command_journal','meri_commands.approval_metadata',
  'meri_schedules.projections','meri_schedules.intents','meri_schedules.occurrences',
  'meri_task_lookup.lookups','meri_task_lookup.events','meri_objective_source.custody',
  'meri_artifacts.versions','meri_artifacts.heads','meri_artifacts.retention_subjects','meri_artifacts.retention_purges',
  'meri_artifacts.preview_attempts','meri_artifacts.previews','meri_artifacts.preview_custody']) AS t
  WHERE to_regclass(t) IS NULL
     OR (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass(t)) <> 'meri_product_migrator';
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_MIGRATED_RELATION_MISSING_OR_FOREIGN %', missing; END IF;
END $$;

REVOKE ALL ON SCHEMA meri_settings, meri_intents, meri_commands, meri_schedules, meri_task_lookup,
 meri_objective_source, meri_artifacts FROM PUBLIC;
GRANT USAGE ON SCHEMA meri_settings, meri_intents, meri_commands, meri_schedules, meri_task_lookup,
 meri_objective_source, meri_artifacts TO meri_control_runtime;

-- Control: personal preferences (user-preferences.mjs). The audit row is insert-only; tenant settings stay ungranted.
GRANT SELECT, INSERT ON TABLE meri_settings.user_preferences TO meri_control_runtime;
GRANT UPDATE (revision,document,document_sha256,updated_at,updated_by) ON meri_settings.user_preferences TO meri_control_runtime;
GRANT INSERT ON TABLE meri_settings.settings_audit TO meri_control_runtime;

-- Control: intent preparation journal. Rows are immutable except the single PENDING settle (trigger-enforced).
GRANT SELECT, INSERT ON TABLE meri_intents.preparations TO meri_control_runtime;
GRANT UPDATE (state,outcome,settled_at) ON meri_intents.preparations TO meri_control_runtime;

-- Control: command journal and approval metadata (approval metadata is append-only).
GRANT SELECT, INSERT ON TABLE meri_commands.command_journal, meri_commands.approval_metadata TO meri_control_runtime;
GRANT UPDATE (state,outcome,updated_at) ON meri_commands.command_journal TO meri_control_runtime;

-- Control: routines foreground schedule owner. Opening an occurrence belongs to the schedule worker (no role yet).
GRANT SELECT, INSERT ON TABLE meri_schedules.projections, meri_schedules.intents TO meri_control_runtime;
GRANT SELECT ON TABLE meri_schedules.occurrences TO meri_control_runtime;
GRANT UPDATE (generation,projection,projection_sha256,active_intent) ON meri_schedules.projections TO meri_control_runtime;
GRANT UPDATE (state,updated_at) ON meri_schedules.intents, meri_schedules.occurrences TO meri_control_runtime;

-- Control: task lookup results.
GRANT SELECT, INSERT ON TABLE meri_task_lookup.lookups, meri_task_lookup.events TO meri_control_runtime;
GRANT UPDATE (state,record) ON meri_task_lookup.lookups TO meri_control_runtime;
GRANT UPDATE (event) ON meri_task_lookup.events TO meri_control_runtime;

-- Control: Objective source custody, CLAIMED -> COMMITTED only (trigger-enforced; no DELETE or TRUNCATE).
GRANT SELECT, INSERT ON TABLE meri_objective_source.custody TO meri_control_runtime;
GRANT UPDATE (state,version,committed_at) ON meri_objective_source.custody TO meri_control_runtime;

-- Control: artifact versions, heads and preview custody. versions UPDATE(record_sha256) is lock-only for the
-- guard_preview_attempt FOR KEY SHARE read; immutable_artifact_versions already rejects every row UPDATE
-- (same treatment as initial_run_bindings in EXISTING-DATABASE-GRANTS-20261016.md).
GRANT SELECT, INSERT ON TABLE meri_artifacts.versions, meri_artifacts.heads,
 meri_artifacts.preview_attempts, meri_artifacts.previews TO meri_control_runtime;
GRANT UPDATE (record_sha256) ON meri_artifacts.versions TO meri_control_runtime;
GRANT UPDATE (version_id,projection,projection_sha256) ON meri_artifacts.heads TO meri_control_runtime;
GRANT UPDATE (object_reference,object_reference_sha256,object_version_id) ON meri_artifacts.preview_attempts TO meri_control_runtime;

-- Readback: no runtime login holds a table-wide write, DDL-like or grant-option privilege on any new relation, only
-- control holds USAGE on the new schemas, and withheld relations/verbs carry no control privilege.
DO $$
DECLARE bad text;
BEGIN
 SELECT string_agg(DISTINCT r.rolname || ' ' || priv || ' ' || c.oid::regclass::text, ', ') INTO bad
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('meri_control_runtime'),('meri_model_budget_owner'),('meri_temporal_issuer_service')) AS r(rolname)
  CROSS JOIN (VALUES ('UPDATE'),('DELETE'),('TRUNCATE'),('TRIGGER'),('REFERENCES'),
                     ('SELECT WITH GRANT OPTION'),('INSERT WITH GRANT OPTION')) AS p(priv)
  WHERE n.nspname IN ('meri_settings','meri_intents','meri_commands','meri_schedules','meri_task_lookup',
                      'meri_objective_source','meri_artifacts')
    AND c.relkind IN ('r','v','p') AND has_table_privilege(r.rolname, c.oid, priv);
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_EXCESS_TABLE_PRIVILEGE %', bad; END IF;
 IF EXISTS (SELECT 1 FROM unnest(ARRAY['meri_settings','meri_intents','meri_commands','meri_schedules',
             'meri_task_lookup','meri_objective_source','meri_artifacts']) AS s
             CROSS JOIN (VALUES ('meri_model_budget_owner'),('meri_temporal_issuer_service')) AS r(rolname)
             WHERE has_schema_privilege(r.rolname, s, 'USAGE')) THEN
  RAISE EXCEPTION 'MERI_D2_CROSS_SCHEMA_USAGE';
 END IF;
 IF EXISTS (SELECT 1 FROM unnest(ARRAY['meri_settings.tenant_settings','meri_artifacts.retention_subjects',
             'meri_artifacts.retention_purges','meri_artifacts.preview_custody']) AS t
             WHERE has_any_column_privilege('meri_control_runtime', t, 'SELECT, INSERT, UPDATE, REFERENCES'))
    OR has_any_column_privilege('meri_control_runtime', 'meri_settings.settings_audit', 'SELECT, UPDATE, REFERENCES')
    OR has_table_privilege('meri_control_runtime', 'meri_schedules.occurrences', 'INSERT') THEN
  RAISE EXCEPTION 'MERI_D2_WITHHELD_PRIVILEGE_PRESENT';
 END IF;
END $$;
RESET ROLE;
\endif
```

## 4. Withheld, deferred, missing roles and unattributed statements

**Withheld: purge-only (purge is composed `{enabled:false}`, `control.mjs:62`).** Do not grant any of these now:
- `DELETE meri_artifacts.heads` (J:123)
- `DELETE meri_artifacts.versions` (J:125; the trigger admits it only next to a same-transaction PLANNED purge row, `0002_retention.sql:53-63`)
- `UPDATE(state)` (J:126) and `UPDATE(state,plan_sha256,ledger_sequence)` via ON CONFLICT DO UPDATE (J:107) on `retention_purges`

**Deferred: a DELETE that is *not* purge-only.** `J:76 DELETE FROM meri_artifacts.retention_purges` runs on every `journal.set()`. Its callers are reconciliation (`reconciliation.mjs:25`), suppression (`suppression.mjs:35`) and the watermark (`recovery-watermark.mjs:48`), so retention *serving* needs it even with purge off. I withheld the whole artifact retention half for three reasons:
- control renders no `retention` key;
- `first-chat-database.sql` grants none of the `meri_conversations.retention_*` tables either, so a half grant cannot work;
- this DELETE would need a named exception to the readback.

Grant this block only together with the conversations half:

```sql
GRANT SELECT, INSERT ON TABLE meri_artifacts.retention_subjects, meri_artifacts.retention_purges TO meri_control_runtime;
GRANT UPDATE (owner_actor_id,state,suppressed_at,released_at,ledger_sequence,entry_sha256,projection,projection_sha256)
 ON meri_artifacts.retention_subjects TO meri_control_runtime;
GRANT DELETE ON TABLE meri_artifacts.retention_purges TO meri_control_runtime;  -- J:76 projection rewrite
```

Until retention is composed, the artifact grants in §3 are inert, because the versions store refuses without the journal.

**Deferred: tenant settings.** Add these when a family supplies `settingsApplication` (paths are already routed, `tenant-application/protocol.mjs:3`):

```sql
GRANT SELECT, INSERT ON TABLE meri_settings.tenant_settings TO meri_control_runtime;
GRANT UPDATE (revision,document,document_sha256,updated_at,updated_by) ON meri_settings.tenant_settings TO meri_control_runtime;
GRANT SELECT ON TABLE meri_settings.settings_audit TO meri_control_runtime;  -- listAudit postgres-store.mjs:50
```

**Missing role: the schedule worker.** It has no login, and `INSERT meri_schedules.occurrences` (:147) is its alone. I recommend not reusing `meri_control_runtime`. Instead, when routines activation is approved, add a role following the bootstrap pattern:

```sql
CREATE ROLE meri_schedule_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
COMMENT ON ROLE meri_schedule_runtime IS 'meri-first-chat-d2';
SELECT format('ALTER ROLE meri_schedule_runtime WITH LOGIN NOINHERIT CONNECTION LIMIT 10 PASSWORD %L', :'schedule_password') \gexec
GRANT CONNECT ON DATABASE capiro TO meri_schedule_runtime;
GRANT USAGE ON SCHEMA meri_schedules, meri_intents TO meri_schedule_runtime;
GRANT SELECT ON TABLE meri_schedules.projections, meri_schedules.intents, meri_intents.preparations TO meri_schedule_runtime;
GRANT SELECT, INSERT ON TABLE meri_schedules.occurrences TO meri_schedule_runtime;
GRANT UPDATE (state,updated_at) ON meri_schedules.occurrences TO meri_schedule_runtime;
```

Four things go with that role:
- The connection limit of 10 matches the pool max (`schedule-service.mjs:60`).
- Bootstrap lives in the ledgered file and only bootstrap receives passwords (`first-chat-migrate.mjs:194,280`), so this needs a runner change. Collision and readback lists need the role added too.
- The role also needs `meri_conversations` grants for `createPostgresConversationStore` (`schedule-worker.mjs:25`; the relations it checks are at `schedule-service.mjs:15-17`). I did **not derive these here**.
- The `requestMs ≤ 3000` gate (`schedule-service-configuration.mjs:10`) still blocks preview use.

**Unattributed or unverified:**
- `native-authority/scheduled-admission.mjs:33` (`openOccurrence`, INSERT occurrences) and `scheduled-run-profile.mjs:32` have no composer. If scheduled admission is hosted in control, control would also need `INSERT` on `occurrences`. That is unverified.
- The control attribution is unverified for task lookup, command journal and approval metadata (only harness, demo or the unimported `createTaskUpdateFeature` reach them). It is also unverified for objective custody, which has no constructor.
- The approval-metadata store refuses a pool with `connectionTimeoutMillis > 5000` or `query_timeout > 6000` (`approval-metadata/postgres-store.mjs:13`). Control's pool uses `requestMs`, which is 25000 in the preview (`control.mjs:130`), so it needs its own pool. Same role assumed; unverified.
- The temporal-worker, model-owner, issuer and proxy processes get nothing.

**Hygiene notes:**
- The trigger functions created by these migrations keep PostgreSQL's default PUBLIC EXECUTE, as the existing `meri_conversations` triggers do. This is harmless: PUBLIC has no schema USAGE, and trigger functions cannot be called directly. Revoking is optional.
- The bootstrap schema-collision list (`first-chat-database.sql:57-58`) does not cover the new schemas, and two migrations use `CREATE SCHEMA IF NOT EXISTS`. The owner pre-check above covers that gap.
- `preview_custody` (a view) and `tenant_settings` intentionally receive no grant.
