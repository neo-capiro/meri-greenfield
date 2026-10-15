-- Product namespace DDL ONLY. PROPOSED allocation meri_product_budget/0002 (dot, 15 Oct 2026); central publication pending.
-- Source numbering only: not published, not applied by runtime/import, never executed by this source or its tests.
-- Tenant-level cost and concurrency caps above the per-run allocations in 0001. No data, roles, grants or seeds.
-- Per-tenant monthly cost cap and concurrent-run cap. Operator-managed policy rows; no default cap.
CREATE TABLE meri_product_budget.tenant_budgets (
  tenant_id varchar(128) PRIMARY KEY,
  monthly_cap_micro_usd bigint NOT NULL CHECK (monthly_cap_micro_usd>0),
  max_concurrent_runs integer NOT NULL CHECK (max_concurrent_runs>0 AND max_concurrent_runs<=10000)
);
-- One reservation per run. Concurrency and liability are separate: only HELD occupies a concurrent-run slot; the hold counts against
-- the reservation's own UTC calendar month while HELD or RELEASED (slot released by cancellation, cost unresolved). SETTLED replaces
-- the hold with measured usage (also after a release). NOT_DISPATCHED drops the hold on authoritative no-dispatch proof.
CREATE TABLE meri_product_budget.tenant_run_reservations (
  tenant_id varchar(128) NOT NULL REFERENCES meri_product_budget.tenant_budgets,
  run_id uuid NOT NULL,
  month char(7) NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  hold_micro_usd bigint NOT NULL CHECK (hold_micro_usd>0),
  settled_micro_usd bigint CHECK (settled_micro_usd>=0),
  state text NOT NULL CHECK (state IN ('HELD','RELEASED','SETTLED','NOT_DISPATCHED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  released_at timestamptz,
  settled_at timestamptz,
  not_dispatched_at timestamptz,
  PRIMARY KEY (tenant_id, run_id),
  CHECK ((state='HELD' AND settled_micro_usd IS NULL AND released_at IS NULL AND settled_at IS NULL AND not_dispatched_at IS NULL)
      OR (state='RELEASED' AND settled_micro_usd IS NULL AND released_at IS NOT NULL AND settled_at IS NULL AND not_dispatched_at IS NULL)
      OR (state='SETTLED' AND settled_micro_usd IS NOT NULL AND settled_at IS NOT NULL AND not_dispatched_at IS NULL)
      OR (state='NOT_DISPATCHED' AND settled_micro_usd IS NULL AND settled_at IS NULL AND not_dispatched_at IS NOT NULL))
);
CREATE INDEX tenant_run_reservations_tenant_month ON meri_product_budget.tenant_run_reservations(tenant_id, month, state);
