-- Source-only allocation: occurrence UNKNOWN barrier, P-R4-1. Requires 0001_schedule_owner.sql.
-- Operator-applied only. This file authorizes no SQL execution or live schedule activation.
BEGIN;
CREATE TABLE meri_schedules.occurrences (
 tenant_id text NOT NULL,
 occurrence_key text NOT NULL CHECK (occurrence_key ~ '^[a-f0-9]{64}$'),
 schedule_id uuid NOT NULL,
 generation bigint NOT NULL CHECK (generation >= 1),
 occurrence jsonb NOT NULL,
 effect jsonb NOT NULL,
 effect_sha256 text NOT NULL CHECK (effect_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('OPEN','DISPATCHED','REFUSED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id, occurrence_key),
 FOREIGN KEY (tenant_id, schedule_id) REFERENCES meri_schedules.projections(tenant_id, schedule_id)
);
-- An unresolved occurrence blocks every later occurrence of its schedule, across generations and workflow timeouts.
CREATE UNIQUE INDEX occurrences_one_open ON meri_schedules.occurrences(tenant_id, schedule_id) WHERE state = 'OPEN';
COMMIT;
