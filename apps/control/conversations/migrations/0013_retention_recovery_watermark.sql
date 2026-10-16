-- Source-only allocation: central record at 641f298025c4c9f344d9d16f852cb6eb62b21906,
-- docs/coordination/tasks/CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md.
-- The single watermark restores together with the database projection. The authoritative ledger remains outside it.
-- Reconciliation records the exact recovered head; ordinary writers compare their minimum known sequence under
-- the canonical recovery/watermark lock before advancing. This table grants no serving, purge or application authority.
BEGIN;
CREATE TABLE meri_conversations.retention_recovery_watermark (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 sequence bigint NOT NULL CHECK (sequence BETWEEN 0 AND 9007199254740991),
 entry_sha256 text CHECK (entry_sha256 IS NULL OR entry_sha256 ~ '^[a-f0-9]{64}$'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
