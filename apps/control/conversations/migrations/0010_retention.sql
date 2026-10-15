-- Conversation retention: restorable projection of the authoritative retention ledger (suppression, release, purge planning,
-- blocked, unknown and executed states) and the trigger amendment that admits a physical purge DELETE on the immutable SDK
-- mirror tables only inside a transaction holding a matching PLANNED purge row. Additive. Migration ID 0010 centrally reserved for
-- this work on 15 October 2026 (docs/coordination/tasks/CODEX-CENTRAL-MIGRATION-ALLOCATION-20261015.md); source only, no
-- application authority. The ledger outside the database (apps/control/retention/ledger.mjs) stays authoritative; after a restore
-- the reconciler rewrites these rows from it before serving resumes.
BEGIN;
CREATE TABLE meri_conversations.retention_subjects (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, owner_actor_id text NOT NULL,
 state text NOT NULL CHECK (state IN ('SUPPRESSED','RELEASED')),
 suppressed_at timestamptz, released_at timestamptz,
 ledger_sequence bigint NOT NULL CHECK (ledger_sequence >= 1),
 entry_sha256 text NOT NULL CHECK (entry_sha256 ~ '^[a-f0-9]{64}$'),
 projection jsonb NOT NULL, projection_sha256 text NOT NULL CHECK (projection_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id, conversation_id),
 FOREIGN KEY (tenant_id, conversation_id) REFERENCES meri_conversations.conversations,
 CHECK ((state = 'SUPPRESSED') = (suppressed_at IS NOT NULL))
);
CREATE TABLE meri_conversations.retention_purges (
 workflow_id text PRIMARY KEY CHECK (workflow_id ~ '^[a-f0-9]{64}$'),
 tenant_id text NOT NULL, conversation_id uuid NOT NULL,
 class text NOT NULL, object_id uuid NOT NULL, version_id text NOT NULL CHECK (length(version_id) BETWEEN 1 AND 1024),
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 plan_sha256 text NOT NULL CHECK (plan_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('PLANNED','BLOCKED','UNKNOWN','EXECUTED')),
 receipt jsonb, receipt_sha256 text CHECK (receipt_sha256 IS NULL OR receipt_sha256 ~ '^[a-f0-9]{64}$'),
 ledger_sequence bigint NOT NULL CHECK (ledger_sequence >= 1),
 FOREIGN KEY (tenant_id, conversation_id) REFERENCES meri_conversations.retention_subjects,
 CHECK ((receipt IS NULL) = (receipt_sha256 IS NULL))
);
CREATE INDEX retention_purges_subject ON meri_conversations.retention_purges(tenant_id, conversation_id, state);
-- Exact database-row purge targets: one row per SDK mirror entry a plan may delete, bound to the plan hash and the ledger sequence;
-- written by the adapter only while the subject is SUPPRESSED under the plan's suppression generation and the plan is the subject's
-- current recorded plan (review correction of 15 October: finding 5).
CREATE TABLE meri_conversations.retention_purge_targets (
 workflow_id text PRIMARY KEY CHECK (workflow_id ~ '^[a-f0-9]{64}$'),
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, class text NOT NULL CHECK (class IN ('sdkSession')),
 run_id uuid NOT NULL, session_id uuid NOT NULL, subpath text NOT NULL, sequence bigint NOT NULL CHECK (sequence > 0),
 plan_sha256 text NOT NULL CHECK (plan_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('PLANNED','EXECUTED','UNKNOWN')),
 ledger_sequence bigint NOT NULL CHECK (ledger_sequence >= 1),
 FOREIGN KEY (tenant_id, conversation_id) REFERENCES meri_conversations.retention_subjects
);
CREATE INDEX retention_purge_targets_row ON meri_conversations.retention_purge_targets(tenant_id, conversation_id, run_id, session_id, subpath, sequence);
-- Immutability amendment: an SDK mirror row may be deleted only by the transaction that recorded a PLANNED target for exactly that
-- tenant, conversation, run, session, subpath and sequence, while the subject is currently SUPPRESSED. UPDATE remains refused
-- unconditionally. Nothing here deletes anything by itself.
CREATE OR REPLACE FUNCTION meri_conversations.reject_sdk_mirror_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'sdk_session_entries' AND EXISTS (
  SELECT 1 FROM meri_conversations.retention_purge_targets t
  JOIN meri_conversations.retention_subjects s ON s.tenant_id = t.tenant_id AND s.conversation_id = t.conversation_id
  WHERE t.tenant_id = OLD.tenant_id AND t.conversation_id = OLD.conversation_id AND t.class = 'sdkSession'
    AND t.run_id = OLD.run_id AND t.session_id = OLD.session_id AND t.subpath = OLD.subpath AND t.sequence = OLD.sequence
    AND t.state = 'PLANNED' AND t.xmin = pg_current_xact_id()::xid AND s.state = 'SUPPRESSED'
 ) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'SDK_MIRROR_IMMUTABLE';
END $$;
COMMIT;
