-- MB-05 source events (additive; local schedule migration 0007).
-- A producer event is NOT a scheduled firing and NOT an authority grant: these two tables
-- carry only the approved binding and the inbound event's metadata/hashes. No prompt, body,
-- destination, budget, limit or run identifier has a column here by construction, so none can
-- be persisted even by accident.
CREATE TABLE meri_schedules.source_event_bindings (
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 256),
 schedule_id uuid NOT NULL,
 generation bigint NOT NULL CHECK (generation >= 1),
 intent_sha256 text NOT NULL CHECK (intent_sha256 ~ '^[a-f0-9]{64}$'),
 projection_sha256 text NOT NULL CHECK (projection_sha256 ~ '^[a-f0-9]{64}$'),
 temporal_schedule_id text NOT NULL CHECK (length(temporal_schedule_id) BETWEEN 1 AND 256),
 owner_actor_id text NOT NULL CHECK (length(owner_actor_id) BETWEEN 1 AND 256),
 producer text NOT NULL CHECK (length(producer) BETWEEN 1 AND 128),
 source_family text NOT NULL CHECK (length(source_family) BETWEEN 1 AND 32),
 resource_key text NOT NULL CHECK (length(resource_key) BETWEEN 1 AND 256),
 task jsonb NOT NULL CHECK (jsonb_typeof(task) = 'object'),
 scopes jsonb NOT NULL CHECK (jsonb_typeof(scopes) = 'array'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 -- APPEND-ONLY index keyed by GENERATION: a later approved generation appends its own row
 -- instead of retargeting the pair, and the trigger below leaves no UPDATE/DELETE path. The
 -- exact acknowledged generation is therefore always readable back after a crash or a lost
 -- acknowledgement, and the pair index supports reading the candidates for that confirmation.
 PRIMARY KEY (tenant_id, producer, source_family, resource_key, schedule_id, generation),
 FOREIGN KEY (tenant_id, schedule_id) REFERENCES meri_schedules.projections(tenant_id, schedule_id),
 CHECK (task ?& ARRAY['taskId','manifestSha256','version'] AND
        task - ARRAY['taskId','manifestSha256','version'] = '{}'::jsonb AND
        (task->>'manifestSha256') ~ '^[a-f0-9]{64}$')
);
-- The binding is the approval; it is written once and never retargeted. A later generation
-- approval cannot silently re-point an already-approved producer/resource pair.
CREATE FUNCTION meri_schedules.guard_source_event_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'SOURCE_EVENT_BINDING_FENCE_REQUIRED'; END IF;
 RAISE EXCEPTION 'SOURCE_EVENT_BINDING_IMMUTABLE';
END $$;
CREATE TRIGGER immutable_source_event_binding BEFORE UPDATE OR DELETE ON meri_schedules.source_event_bindings
 FOR EACH ROW EXECUTE FUNCTION meri_schedules.guard_source_event_binding();
CREATE INDEX source_event_binding_pair ON meri_schedules.source_event_bindings(tenant_id, producer, source_family, resource_key);
CREATE TABLE meri_schedules.source_events (
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 256),
 producer text NOT NULL CHECK (length(producer) BETWEEN 1 AND 128),
 event_id uuid NOT NULL,
 event_key text NOT NULL CHECK (event_key ~ '^[a-f0-9]{64}$'),
 event_hash text NOT NULL CHECK (event_hash ~ '^[a-f0-9]{64}$'),
 schedule_id uuid,
 generation bigint CHECK (generation >= 1),
 occurrence_key text CHECK (occurrence_key IS NULL OR occurrence_key ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('ACCEPTED','QUEUED','DISPATCHED','SKIPPED','REFUSED','UNKNOWN')),
 code text CHECK (code IS NULL OR code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
 occurred_at timestamptz NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id, producer, event_id)
);
CREATE INDEX source_event_schedule ON meri_schedules.source_events(tenant_id, schedule_id, accepted_at);
CREATE FUNCTION meri_schedules.guard_source_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'SOURCE_EVENT_FENCE_REQUIRED'; END IF;
 -- Identity and bytes are the dedup contract: neither may be rewritten, and accepted work
 -- may not be quietly discarded by returning a settled row to an earlier state.
 IF (NEW.tenant_id,NEW.producer,NEW.event_id,NEW.event_key,NEW.event_hash,NEW.occurred_at,NEW.accepted_at)
    IS DISTINCT FROM (OLD.tenant_id,OLD.producer,OLD.event_id,OLD.event_key,OLD.event_hash,OLD.occurred_at,OLD.accepted_at)
 THEN RAISE EXCEPTION 'SOURCE_EVENT_IMMUTABLE'; END IF;
 IF OLD.state NOT IN ('ACCEPTED','QUEUED') THEN RAISE EXCEPTION 'SOURCE_EVENT_TERMINAL'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_source_event BEFORE UPDATE OR DELETE ON meri_schedules.source_events
 FOR EACH ROW EXECUTE FUNCTION meri_schedules.guard_source_event();
