-- Upload originals and bounded scan/extraction observations. Applied only by the existing release migration owner.
CREATE SCHEMA IF NOT EXISTS meri_uploads;
CREATE TABLE meri_uploads.originals (
 tenant_id text NOT NULL,
 owner_actor_id text NOT NULL,
 conversation_id uuid NOT NULL,
 upload_id uuid NOT NULL,
 request_id uuid NOT NULL,
 revision bigint NOT NULL CHECK (revision >= 0),
 record jsonb NOT NULL CHECK (octet_length(record::text) <= 16777216),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id, upload_id),
 UNIQUE (tenant_id, owner_actor_id, conversation_id, request_id)
);
CREATE INDEX upload_conversation_inventory ON meri_uploads.originals (tenant_id, conversation_id, upload_id);

-- Projection updates cannot replace the original identity, its declared bytes, scope or an observed native version.
CREATE FUNCTION meri_uploads.preserve_original() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.owner_actor_id IS DISTINCT FROM OLD.owner_actor_id
  OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id OR NEW.upload_id IS DISTINCT FROM OLD.upload_id
  OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.revision <> OLD.revision + 1
  OR (NEW.record - ARRAY['object','state','inspection','updatedAtMs','revision']) IS DISTINCT FROM
     (OLD.record - ARRAY['object','state','inspection','updatedAtMs','revision'])
  OR OLD.record->'object' <> 'null'::jsonb AND NEW.record->'object' IS DISTINCT FROM OLD.record->'object'
 THEN RAISE EXCEPTION 'UPLOAD_ORIGINAL_IMMUTABLE'; END IF;
 IF NOT ((OLD.record->>'state'='prepared' AND NEW.record->>'state' IN ('writing','removed'))
  OR (OLD.record->>'state'='writing' AND NEW.record->>'state'='stored')
  OR (OLD.record->>'state'='stored' AND NEW.record->>'state' IN ('stored','removing'))
  OR (OLD.record->>'state'='removing' AND NEW.record->>'state'='removed'))
 THEN RAISE EXCEPTION 'UPLOAD_TRANSITION'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER upload_original_immutable BEFORE UPDATE ON meri_uploads.originals
 FOR EACH ROW EXECUTE FUNCTION meri_uploads.preserve_original();
