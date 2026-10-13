-- Source-only application result retention. Apply only through an authorized owner.
-- Not a budget/invocation ledger, authorization grant or global event allocator.
CREATE SCHEMA meri_task_lookup;
CREATE TABLE meri_task_lookup.lookups (
 tenant_id text NOT NULL,
 lookup_id uuid NOT NULL,
 result_reference uuid NOT NULL,
 payload jsonb NOT NULL,
 state text NOT NULL CHECK (state IN ('CLAIMED','DISPATCHING','RESULT','ERROR')),
 record jsonb,
 PRIMARY KEY(tenant_id,lookup_id),
 UNIQUE(tenant_id,result_reference),
 CHECK ((state='RESULT')=(record IS NOT NULL))
);
CREATE TABLE meri_task_lookup.events (
 tenant_id text NOT NULL,
 run_id uuid NOT NULL,
 sequence bigint NOT NULL CHECK(sequence>0),
 event_id uuid NOT NULL,
 lookup_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('started','terminal')),
 event jsonb,
 PRIMARY KEY(tenant_id,run_id,sequence),
 UNIQUE(tenant_id,event_id),
 UNIQUE(tenant_id,lookup_id,kind),
 FOREIGN KEY(tenant_id,lookup_id) REFERENCES meri_task_lookup.lookups(tenant_id,lookup_id)
);
