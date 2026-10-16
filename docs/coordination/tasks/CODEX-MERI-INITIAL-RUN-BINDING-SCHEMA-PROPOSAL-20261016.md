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
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 256),
 conversation_id uuid NOT NULL,
 run_id uuid NOT NULL,
 record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id,conversation_id),
 UNIQUE (tenant_id,run_id),
 CHECK (record->>'schemaVersion' = '1'),
 CHECK (record->>'state' = 'ADMITTED'),
 CHECK (record#>>'{binding,tenantId}' = tenant_id),
 CHECK (length(record#>>'{binding,actorId}') BETWEEN 1 AND 256),
 CHECK (record#>>'{binding,conversationId}' = conversation_id::text),
 CHECK (record#>>'{binding,runId}' = run_id::text),
 CHECK (record#>>'{binding,writerFence}' = '1'),
 CHECK (record->>'selectedClientId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 CHECK (record->>'configurationSha256' ~ '^[a-f0-9]{64}$'),
 CHECK ((record->>'createdAtMs')::numeric BETWEEN 0 AND 9007199254740991),
 CHECK ((record->>'expiresAtMs')::numeric BETWEEN 1 AND 9007199254740991),
 CHECK ((record->>'expiresAtMs')::numeric > (record->>'createdAtMs')::numeric)
);
CREATE FUNCTION meri_conversations.reject_initial_run_binding_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'INITIAL_RUN_BINDING_IMMUTABLE';
END $$;
CREATE TRIGGER immutable_initial_run_binding BEFORE UPDATE OR DELETE ON meri_conversations.initial_run_bindings
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_initial_run_binding_change();
-- Reconcile preexisting conversations before mounting; never backfill invented bindings.
```

The migration review must confirm schema permissions and restore behavior. The source tests use a scripted PostgreSQL protocol fixture for atomicity, replay, corruption, conflict, and commit-unknown behavior. They do not establish a live PostgreSQL or deployment result.
