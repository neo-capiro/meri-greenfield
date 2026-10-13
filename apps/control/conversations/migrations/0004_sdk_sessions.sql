-- Centrally allocated product SDK mirror; no migration apply/native fixture changes.
BEGIN;
CREATE TABLE meri_conversations.sdk_sessions (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 session_id uuid NOT NULL, project_key text NOT NULL CHECK(length(project_key) BETWEEN 1 AND 256),
 owner jsonb NOT NULL, owner_sha256 text NOT NULL CHECK(owner_sha256 ~ '^[a-f0-9]{64}$'),
 entries_count bigint NOT NULL DEFAULT 0 CHECK(entries_count BETWEEN 0 AND 100000),
 bytes bigint NOT NULL DEFAULT 0 CHECK(bytes BETWEEN 0 AND 33554432),
 PRIMARY KEY(tenant_id,conversation_id,run_id,session_id),
 UNIQUE(tenant_id,conversation_id,run_id),
 FOREIGN KEY(tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs
);
CREATE FUNCTION meri_conversations.preserve_sdk_session_owner() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
 IF ROW(NEW.tenant_id,NEW.conversation_id,NEW.run_id,NEW.session_id,NEW.project_key,NEW.owner,NEW.owner_sha256)
 IS DISTINCT FROM ROW(OLD.tenant_id,OLD.conversation_id,OLD.run_id,OLD.session_id,OLD.project_key,OLD.owner,OLD.owner_sha256)
 THEN RAISE EXCEPTION 'SDK_SESSION_OWNER_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_sdk_session_owner BEFORE UPDATE ON meri_conversations.sdk_sessions
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.preserve_sdk_session_owner();
CREATE TABLE meri_conversations.sdk_session_streams (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 session_id uuid NOT NULL, subpath text NOT NULL CHECK(length(subpath)<=1024),
 last_sequence bigint NOT NULL DEFAULT 0 CHECK(last_sequence BETWEEN 0 AND 100000),
 PRIMARY KEY(tenant_id,conversation_id,run_id,session_id,subpath),
 FOREIGN KEY(tenant_id,conversation_id,run_id,session_id) REFERENCES meri_conversations.sdk_sessions
);
CREATE TABLE meri_conversations.sdk_session_entries (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 session_id uuid NOT NULL, subpath text NOT NULL, sequence bigint NOT NULL CHECK(sequence>0),
 entry_uuid text, entry jsonb NOT NULL, entry_sha256 text NOT NULL CHECK(entry_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(tenant_id,conversation_id,run_id,session_id,subpath,sequence),
 FOREIGN KEY(tenant_id,conversation_id,run_id,session_id,subpath) REFERENCES meri_conversations.sdk_session_streams
);
CREATE UNIQUE INDEX sdk_session_entry_uuid ON meri_conversations.sdk_session_entries
 (tenant_id,conversation_id,run_id,session_id,subpath,entry_uuid) WHERE entry_uuid IS NOT NULL;
CREATE TABLE meri_conversations.sdk_session_batches (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 session_id uuid NOT NULL, append_id uuid NOT NULL,
 request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
 receipt jsonb NOT NULL, receipt_sha256 text NOT NULL CHECK(receipt_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(tenant_id,conversation_id,run_id,session_id,append_id),
 FOREIGN KEY(tenant_id,conversation_id,run_id,session_id) REFERENCES meri_conversations.sdk_sessions
);
CREATE FUNCTION meri_conversations.reject_sdk_mirror_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SDK_MIRROR_IMMUTABLE'; END $$;
CREATE TRIGGER immutable_sdk_session_entries BEFORE UPDATE OR DELETE ON meri_conversations.sdk_session_entries
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_sdk_mirror_mutation();
CREATE TRIGGER immutable_sdk_session_batches BEFORE UPDATE OR DELETE ON meri_conversations.sdk_session_batches
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_sdk_mirror_mutation();
COMMIT;
