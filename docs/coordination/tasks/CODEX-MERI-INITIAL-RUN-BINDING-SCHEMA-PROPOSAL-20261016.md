# Dynamic first-run binding journal: source proposal

Status: source only, unmounted. No product migration ID, database change, deployment, or live first-chat acceptance is claimed.

## Ownership and interface

Core owns creation and current authorization of a `ClioConversation`. The Meri native authority adapter independently verifies the current Clerk identity, Core conversation ownership, selected client, and identity/context SHA joins before it calls the journal. The journal owns one durable original Meri `RunBinding` for that verified tenant and Core conversation UUID. It never accepts browser identity as authority or stores a bearer, identity receipt, prompt, or credential. Existing conversation input, run, event, issuance, and next-run owners remain the only owners of their respective states.

`createInitialRunBindingJournal({pool,now})` borrows a PostgreSQL-compatible pool. `claim({principal,conversationId,selectedClientId,policyRevision,versions,configurationSha256,proposedExpiresAtMs},check)` creates one writer-fence-1 binding on the first verified call and returns `{record,created}`. A retry returns the exact stored record and expiry. It refuses expired or changed principal, client, policy, versions, or configuration. `read({binding},check)` returns the full exact record, including an expired record, so the caller can fail closed without synthesizing a replacement. `readConversation({principal,conversationId,selectedClientId},check)` reads that same record before the run ID is known, checking actor and client; it also works after a successor run becomes current. All methods require the caller's cancellation/deadline check. The journal uses the canonical contract validators and SHA helper; there is no parallel identity protocol.

The single transaction holds a tenant/conversation advisory lock, checks for an existing row, and uses insert-on-conflict/readback. The first write refuses an existing run, initial-input allocation, or next-run reservation. A replay checks that the original persisted run and initial-input allocation, when present, match the saved binding; subsequent valid next-run state does not replace the original. Commit acknowledgment loss is uncertain; the caller retries the same verified operation and recovers the saved row. SQL failures never grant a session.

## Schema request for central allocation

The source references proposed `meri_conversations.initial_run_bindings`. A migration owner must allocate an ID and review/qualify the following additive schema before composition. In particular, immutability must hold against writers outside this adapter. This is a proposal, not a migration file to execute.

```sql
CREATE TABLE meri_conversations.initial_run_bindings (
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
 conversation_id uuid NOT NULL,
 run_id uuid NOT NULL,
 record jsonb NOT NULL CHECK ((jsonb_typeof(record) = 'object') IS TRUE),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id,conversation_id),
 UNIQUE (tenant_id,run_id),
 CHECK ((record ?& ARRAY['schemaVersion','state','binding','selectedClientId',
                         'policyRevision','versions','configurationSha256',
                         'createdAtMs','expiresAtMs']) IS TRUE),
 CHECK (((record - ARRAY['schemaVersion','state','binding','selectedClientId',
                          'policyRevision','versions','configurationSha256',
                          'createdAtMs','expiresAtMs']) = '{}'::jsonb) IS TRUE),
 CHECK ((jsonb_typeof(record->'binding') = 'object') IS TRUE),
 CHECK (((record->'binding') ?& ARRAY['tenantId','actorId','conversationId',
                                      'runId','attemptId','workerId','writerFence']) IS TRUE),
 CHECK ((((record->'binding') - ARRAY['tenantId','actorId','conversationId',
                                       'runId','attemptId','workerId','writerFence'])
          = '{}'::jsonb) IS TRUE),
 CHECK ((jsonb_typeof(record->'versions') = 'object') IS TRUE),
 CHECK (((record->'versions') ?& ARRAY['imageDigest','sdk','cli','contracts',
                                       'skillsDigest','checkpointFormat']) IS TRUE),
 CHECK ((((record->'versions') - ARRAY['imageDigest','sdk','cli','contracts',
                                        'skillsDigest','checkpointFormat'])
          = '{}'::jsonb) IS TRUE),
 CHECK ((record->'schemaVersion' = '1'::jsonb) IS TRUE),
 CHECK ((jsonb_typeof(record->'state') = 'string'
         AND record->>'state' = 'ADMITTED') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,tenantId}') = 'string'
         AND record#>>'{binding,tenantId}' = tenant_id) IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,actorId}') = 'string'
         AND length(record#>>'{binding,actorId}') BETWEEN 1 AND 128) IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,conversationId}') = 'string'
         AND record#>>'{binding,conversationId}' = conversation_id::text) IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,runId}') = 'string'
         AND record#>>'{binding,runId}' = run_id::text) IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,attemptId}') = 'string'
         AND record#>>'{binding,attemptId}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,workerId}') = 'string'
         AND record#>>'{binding,workerId}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE),
 CHECK ((record#>'{binding,writerFence}' = '1'::jsonb) IS TRUE),
 CHECK ((jsonb_typeof(record->'selectedClientId') = 'string'
         AND record->>'selectedClientId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE),
 CHECK ((jsonb_typeof(record->'policyRevision') = 'string'
         AND length(record->>'policyRevision') BETWEEN 1 AND 256) IS TRUE),
 CHECK ((jsonb_typeof(record->'configurationSha256') = 'string'
         AND record->>'configurationSha256' ~ '^[a-f0-9]{64}$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,imageDigest}') = 'string'
         AND record#>>'{versions,imageDigest}' ~ '^sha256:[a-f0-9]{64}$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,sdk}') = 'string'
         AND record#>>'{versions,sdk}' ~ '^[0-9]+[.][0-9]+[.][0-9]+$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,cli}') = 'string'
         AND record#>>'{versions,cli}' ~ '^[0-9]+[.][0-9]+[.][0-9]+$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,contracts}') = 'string'
         AND record#>>'{versions,contracts}' = '0.1.0') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,skillsDigest}') = 'string'
         AND record#>>'{versions,skillsDigest}' ~ '^[a-f0-9]{64}$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,checkpointFormat}') = 'string'
         AND record#>>'{versions,checkpointFormat}' = '0.1.0') IS TRUE),
 CHECK (CASE
         WHEN jsonb_typeof(record->'createdAtMs') = 'number'
          AND jsonb_typeof(record->'expiresAtMs') = 'number'
         THEN (record->>'createdAtMs')::numeric BETWEEN 0 AND 9007199254740991
          AND (record->>'createdAtMs')::numeric = trunc((record->>'createdAtMs')::numeric)
          AND (record->>'expiresAtMs')::numeric BETWEEN 1 AND 9007199254740991
          AND (record->>'expiresAtMs')::numeric = trunc((record->>'expiresAtMs')::numeric)
          AND (record->>'expiresAtMs')::numeric > (record->>'createdAtMs')::numeric
         ELSE false
        END)
);
CREATE FUNCTION meri_conversations.reject_initial_run_binding_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'INITIAL_RUN_BINDING_IMMUTABLE';
END $$;
CREATE TRIGGER immutable_initial_run_binding BEFORE UPDATE OR DELETE ON meri_conversations.initial_run_bindings
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_initial_run_binding_change();
CREATE TRIGGER immutable_initial_run_binding_truncate BEFORE TRUNCATE ON meri_conversations.initial_run_bindings
 FOR EACH STATEMENT EXECUTE FUNCTION meri_conversations.reject_initial_run_binding_change();
-- PostgreSQL 16 SELECT ... FOR UPDATE requires UPDATE privilege on at least one
-- column. Grant the app role SELECT, INSERT, and UPDATE(record_sha256) only;
-- the UPDATE trigger rejects actual mutations. Never grant DELETE, TRUNCATE,
-- table ownership, or schema DDL to the app role.
-- Reconcile preexisting conversations before mounting; never backfill invented bindings.
```

The JSON checks intentionally require complete, exact top-level, binding, and version keys. Each extracted field check is explicitly true, so SQL UNKNOWN cannot admit a missing key or JSON null. Timestamp casts stay inside a CASE branch guarded by JSON number types. The digest column's pattern check does not prove that it hashes the record; the journal verifies the canonical hash when reading. PostgreSQL 16 requires UPDATE privilege on at least one column for the journal's SELECT FOR UPDATE, so the app role needs narrow column-level UPDATE plus the rejecting trigger. The app role must not own this table or have DELETE, TRUNCATE, or DDL rights.

## Isolated PostgreSQL 16 qualification to run after central allocation

1. Apply the exact preceding migration manifest and the allocated additive migration to an isolated database, both empty and with preserved preexisting conversation rows. Inspect columns, primary/unique keys, constraints, triggers, and least-privilege SELECT/INSERT/column-UPDATE grants. Prove app-role SELECT FOR UPDATE succeeds on the new table and on the existing runs, initial_inputs, and next_runs rows the journal locks, while actual UPDATE of the new table is rejected by the trigger and DELETE, TRUNCATE, and DDL are denied. Check the restored catalog and row hashes.
2. Insert one valid adapter-produced record, then attempt each missing top-level, binding, and version key, JSON null and wrong scalar/container types, numeric strings for schema version, fence, and timestamps, fractional/negative/over-safe timestamps, bad UUID/hash, and a row-column mismatch. Every malformed insert must fail. Attempt duplicate tenant/conversation and tenant/run keys, then UPDATE, DELETE, and TRUNCATE with the app role.
3. Exercise two concurrent claims for the same tenant/conversation, identical replay, changed actor/client/policy/configuration conflict, preexisting run/input/reservation refusal, expiry, and lost-COMMIT acknowledgment recovery against real PostgreSQL. Confirm no second binding or changed original expiry.
4. Restore a snapshot with an admitted binding and accepted run; verify the same parsed/canonical record and recomputed canonical hash, source rows, readback, and old rows unchanged. JSONB does not preserve original JSON bytes. Check fail-closed readiness when the table is absent and the exact SHA/order/privileges/restore steps in the deployment manifest.

These controls are prepared only; no PostgreSQL instance, migration, or live service has been run for this proposal. The current source tests use a scripted PostgreSQL protocol fixture.
