-- Centrally allocated immutable selected output, in the canonical conversation store.
-- Source-only migration candidate; never applied to native/qualification state here.
BEGIN;
CREATE TABLE meri_conversations.selected_outputs (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 preparation_sha256 text NOT NULL CHECK(preparation_sha256 ~ '^[a-f0-9]{64}$'),
 projection jsonb NOT NULL, projection_sha256 text NOT NULL CHECK(projection_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(tenant_id,conversation_id,run_id),
 FOREIGN KEY(tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs
);
COMMIT;
