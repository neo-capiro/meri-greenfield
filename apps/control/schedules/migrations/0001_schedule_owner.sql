-- Product schedule ownership. Explicit operator-applied migration only; never run on import.
CREATE SCHEMA IF NOT EXISTS meri_schedules;
CREATE TABLE meri_schedules.projections (
 tenant_id text NOT NULL, schedule_id uuid NOT NULL, temporal_schedule_id text NOT NULL UNIQUE,
 owner_actor_id text NOT NULL, generation bigint NOT NULL CHECK(generation >= 0),
 projection jsonb NOT NULL, projection_sha256 text NOT NULL,
 active_intent uuid, PRIMARY KEY(tenant_id,schedule_id)
);
CREATE TABLE meri_schedules.intents (
 tenant_id text NOT NULL, intent_id uuid NOT NULL, schedule_id uuid NOT NULL,
 intent_sha256 text NOT NULL, binding_sha256 text NOT NULL, intent jsonb NOT NULL,
 state text NOT NULL CHECK(state IN ('CLAIMED','DISPATCHING','ACKNOWLEDGED','UNKNOWN')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,intent_id),
 FOREIGN KEY(tenant_id,schedule_id) REFERENCES meri_schedules.projections(tenant_id,schedule_id)
);
CREATE INDEX schedule_owner_page ON meri_schedules.projections(tenant_id,owner_actor_id,schedule_id);
