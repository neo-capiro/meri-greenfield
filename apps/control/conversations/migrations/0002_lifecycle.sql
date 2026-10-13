-- Centrally allocated product controls; no native/qualification state changes.
BEGIN;
ALTER TABLE meri_conversations.runs ADD COLUMN hold_control_id uuid;
ALTER TABLE meri_conversations.runs ADD COLUMN continuation jsonb;
ALTER TABLE meri_conversations.runs ADD COLUMN continuation_sha256 text;
CREATE TABLE meri_conversations.controls (
 tenant_id text NOT NULL, control_id uuid NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 control_sequence bigserial NOT NULL, projection jsonb NOT NULL, projection_sha256 text NOT NULL,
 PRIMARY KEY(tenant_id,control_id), UNIQUE(tenant_id,conversation_id,run_id,control_sequence),
 FOREIGN KEY(tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs
);
CREATE TABLE meri_conversations.checkpoints (
 tenant_id text NOT NULL, checkpoint_id uuid NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 control_id uuid NOT NULL, proof jsonb NOT NULL, proof_sha256 text NOT NULL,
 PRIMARY KEY(tenant_id,checkpoint_id),
 FOREIGN KEY(tenant_id,control_id) REFERENCES meri_conversations.controls,
 FOREIGN KEY(tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs
);
COMMIT;
