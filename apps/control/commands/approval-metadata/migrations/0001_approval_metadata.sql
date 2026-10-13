-- Explicit source-only migration. No apply, role, permission or connection owner.
-- Append-only through this API; existing approval/execution journals are separate.
CREATE TABLE meri_approval_metadata (
 tenant_id text NOT NULL,
 actor_id text NOT NULL,
 proposal_id uuid NOT NULL,
 command_id uuid NOT NULL,
 idempotency_key varchar(128) NOT NULL CHECK(length(idempotency_key)>0),
 command_sha256 char(64) NOT NULL CHECK(command_sha256 ~ '^[0-9a-f]{64}$'),
 payload_sha256 char(64) NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'),
 payload jsonb NOT NULL,
 PRIMARY KEY(tenant_id,actor_id,proposal_id),
 UNIQUE(tenant_id,command_id),
 UNIQUE(tenant_id,actor_id,idempotency_key)
);
