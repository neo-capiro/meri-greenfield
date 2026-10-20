-- Meri model budget owner conversation reads (phase_owner_conversation_reads only), run by first-chat-migrate.mjs stage 'meri'
-- at ordinal 22, after phase_temporal_grants and before the held integration entries. first-chat-database.sql stays
-- byte-identical: its phase_meri_grants sha256 is recorded in meri_migration_ledger.
--
-- The owner's proxy placement (product-owner-placement.mjs) and native currentness (owner-native-currentness.mjs) join a
-- dynamic conversation to its initial run binding, initial-run-binding-journal.mjs readConversation:
--   SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE
-- and the currentness join reads the conversation's next-run state, next-run-journal.mjs current:
--   SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3
-- phase_meri_grants gave the owner neither table. On 20 Oct 12:16:07Z the first proxied send of a dynamic conversation was
-- refused with "permission denied for table initial_run_bindings".
--
-- Same rules as phase_meri_grants: SELECT and one lock-only column UPDATE. FOR UPDATE needs UPDATE on a column, and the
-- immutable_initial_run_binding trigger rejects every row change, exactly as for control's UPDATE (record_sha256).
-- No INSERT, DELETE, TRUNCATE, table-wide UPDATE, default privilege or grant option.
\set ON_ERROR_STOP on
SELECT CASE WHEN (:{?phase_owner_conversation_reads})::int = 1 THEN 'ok'
            ELSE (SELECT 'MERI_D2_OWNER_CONVERSATION_READS_PHASE_REQUIRED'::text)::int::text END AS phase_guard;

\if :{?phase_owner_conversation_reads}
-- ===================================================================== OWNER CONVERSATION READS
-- Runs as the schema owner. Both tables and the trigger were created by the ordered migrations under this role.
SET ROLE meri_product_migrator;
DO $$
DECLARE missing text;
BEGIN
 IF current_database() <> 'capiro' THEN RAISE EXCEPTION 'MERI_D2_RUN_ON_DATABASE_CAPIRO'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meri_model_budget_owner') THEN
  RAISE EXCEPTION 'MERI_D2_MODEL_OWNER_ROLE_MISSING';
 END IF;
 SELECT string_agg(t, ', ') INTO missing FROM unnest(ARRAY['meri_conversations.initial_run_bindings','meri_conversations.next_runs']) AS t
  WHERE to_regclass(t) IS NULL
     OR (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass(t)) <> 'meri_product_migrator';
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_MIGRATED_RELATION_MISSING_OR_FOREIGN %', missing; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'immutable_initial_run_binding' AND NOT tgisinternal
                 AND tgrelid = 'meri_conversations.initial_run_bindings'::regclass) THEN
  RAISE EXCEPTION 'MERI_D2_INITIAL_RUN_BINDING_TRIGGER_MISSING';
 END IF;
END $$;

GRANT SELECT ON TABLE meri_conversations.initial_run_bindings, meri_conversations.next_runs TO meri_model_budget_owner;
GRANT UPDATE (record_sha256) ON meri_conversations.initial_run_bindings TO meri_model_budget_owner;

-- Readback: the owner can read both tables and lock a binding row, and holds no write on either.
DO $$
BEGIN
 IF NOT (has_table_privilege('meri_model_budget_owner', 'meri_conversations.initial_run_bindings', 'SELECT')
         AND has_table_privilege('meri_model_budget_owner', 'meri_conversations.next_runs', 'SELECT')
         AND has_column_privilege('meri_model_budget_owner', 'meri_conversations.initial_run_bindings', 'record_sha256', 'UPDATE')) THEN
  RAISE EXCEPTION 'MERI_D2_OWNER_CONVERSATION_READS_MISSING';
 END IF;
 IF has_table_privilege('meri_model_budget_owner', 'meri_conversations.initial_run_bindings', 'INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES')
    OR has_table_privilege('meri_model_budget_owner', 'meri_conversations.next_runs', 'INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES')
    OR has_any_column_privilege('meri_model_budget_owner', 'meri_conversations.next_runs', 'UPDATE, REFERENCES') THEN
  RAISE EXCEPTION 'MERI_D2_OWNER_CONVERSATION_WRITE_PRESENT';
 END IF;
END $$;
RESET ROLE;
\endif
