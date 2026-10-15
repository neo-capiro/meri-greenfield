-- DRAFT, UNALLOCATED. Not a migration: no number is assigned and nothing under migrations/ references this file.
-- The central owner allocates the product (proposed 0010) and artifacts (proposed 0002) migrations; until then this draft is applied
-- only to a test-scoped schema in a local cluster. The authoritative transition history lives in the retention ledger outside the
-- database (see apps/control/retention/ledger.mjs); these tables are the restorable, reconcilable projection of it.
CREATE SCHEMA IF NOT EXISTS meri_retention_draft;
CREATE TABLE meri_retention_draft.subjects (
 tenant_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('conversation','artifact')), subject_id uuid NOT NULL, owner_actor_id text NOT NULL,
 state text NOT NULL CHECK (state IN ('SUPPRESSED','RELEASED')),
 suppressed_at timestamptz, released_at timestamptz,
 ledger_sequence bigint NOT NULL CHECK (ledger_sequence >= 1), entry_sha256 text NOT NULL,
 authorization jsonb NOT NULL, outstanding_access jsonb,
 PRIMARY KEY (tenant_id, kind, subject_id)
);
CREATE TABLE meri_retention_draft.purges (
 workflow_id text PRIMARY KEY, tenant_id text NOT NULL, kind text NOT NULL, subject_id uuid NOT NULL,
 class text NOT NULL, object_id uuid NOT NULL, version_id text NOT NULL, sha256 text NOT NULL,
 plan_sha256 text NOT NULL, policy_sha256 text NOT NULL,
 state text NOT NULL CHECK (state IN ('PLANNED','BLOCKED','UNKNOWN','EXECUTED')),
 receipt jsonb, ledger_sequence bigint NOT NULL CHECK (ledger_sequence >= 1),
 FOREIGN KEY (tenant_id, kind, subject_id) REFERENCES meri_retention_draft.subjects
);
-- Trigger amendment (to be written against the allocated migration): the immutability triggers on sdk_session_entries,
-- sdk_session_batches and meri_artifacts.versions admit a DELETE only inside a transaction holding a matching purges row in state
-- PLANNED for the same tenant and subject; every other DELETE and every UPDATE stays refused.
