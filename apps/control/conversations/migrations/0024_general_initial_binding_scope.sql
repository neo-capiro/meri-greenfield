-- General binds to the actor's private-user scope and stores an explicit JSON null.
-- 0017 predates that contract; keep its ledgered bytes and every other guard intact.
BEGIN;
ALTER TABLE meri_conversations.initial_run_bindings
 DROP CONSTRAINT initial_run_bindings_record_check15,
 ADD CONSTRAINT initial_run_bindings_selected_client_scope_check
 CHECK ((record->'selectedClientId' = 'null'::jsonb
         OR (jsonb_typeof(record->'selectedClientId') = 'string'
             AND record->>'selectedClientId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) IS TRUE);
COMMIT;
