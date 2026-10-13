-- Source-only product journal. Apply only through the isolated product schema owner.
BEGIN;
CREATE TABLE meri_conversations.selected_reads (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 delivery_sha256 text NOT NULL CHECK(delivery_sha256 ~ '^[a-f0-9]{64}$'),
 selector jsonb NOT NULL,
 allocation_sha256 text NOT NULL CHECK(allocation_sha256 ~ '^[a-f0-9]{64}$'),
 stage text NOT NULL CHECK(stage IN ('PENDING','RETAINED','UNKNOWN')),
 result_text text, completion jsonb,
 PRIMARY KEY(tenant_id,conversation_id,run_id,delivery_sha256),
 FOREIGN KEY(tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs,
 CHECK ((stage='RETAINED' AND result_text IS NOT NULL AND completion IS NOT NULL)
     OR (stage IN ('PENDING','UNKNOWN') AND result_text IS NULL AND completion IS NULL)),
 CHECK(result_text IS NULL OR octet_length(result_text)<=1048576)
);
COMMIT;
