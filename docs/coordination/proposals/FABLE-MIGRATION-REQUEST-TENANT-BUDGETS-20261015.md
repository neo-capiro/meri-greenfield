# Migration request: tenant budgets and concurrency (product namespace)

Requested by Fable on 15 October 2026 at base `ba40647`. Migration IDs are allocated centrally; this document proposes DDL and asks
dot/Codex to allocate the next product-namespace ID. Nothing in the source applies it; `apps/gateway/budget/tenant/postgres-store.mjs`
targets these tables and is exercised against a real engine only when `MERI_TENANT_BUDGET_PG_SOCKET` is set.

## Proposed DDL (schema `meri_product_budget`, after `0001_product_budget.sql`)

```sql
-- Per-tenant monthly cost cap and concurrent-run cap. Operator-managed policy rows; no seed, no default cap.
CREATE TABLE meri_product_budget.tenant_budgets (
  tenant_id varchar(128) PRIMARY KEY,
  monthly_cap_micro_usd bigint NOT NULL CHECK (monthly_cap_micro_usd>0),
  max_concurrent_runs integer NOT NULL CHECK (max_concurrent_runs>0 AND max_concurrent_runs<=10000)
);
-- One reservation per run. HELD counts the slot and the conservative hold; RELEASED frees both; SETTLED charges measured usage
-- to the reservation's own calendar month (UTC), also after a release.
CREATE TABLE meri_product_budget.tenant_run_reservations (
  tenant_id varchar(128) NOT NULL REFERENCES meri_product_budget.tenant_budgets,
  run_id uuid NOT NULL,
  month char(7) NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  hold_micro_usd bigint NOT NULL CHECK (hold_micro_usd>0),
  settled_micro_usd bigint CHECK (settled_micro_usd>=0),
  state text NOT NULL CHECK (state IN ('HELD','RELEASED','SETTLED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  released_at timestamptz,
  settled_at timestamptz,
  PRIMARY KEY (tenant_id, run_id),
  CHECK ((state='HELD' AND settled_micro_usd IS NULL AND released_at IS NULL AND settled_at IS NULL)
      OR (state='RELEASED' AND settled_micro_usd IS NULL AND released_at IS NOT NULL AND settled_at IS NULL)
      OR (state='SETTLED' AND settled_micro_usd IS NOT NULL AND settled_at IS NOT NULL))
);
CREATE INDEX tenant_run_reservations_tenant_month ON meri_product_budget.tenant_run_reservations(tenant_id, month, state);
```

## Access pattern

Every operation is one transaction: `SELECT ... FROM tenant_budgets WHERE tenant_id=$1 FOR UPDATE` first (the tenant lock), then the
aggregate over `tenant_run_reservations` (HELD count across all months; HELD holds and SETTLED charges for the admission month), then
the per-run row `FOR UPDATE`, then one INSERT or one compare-and-set UPDATE on `state`. The existing `budget` row lock is not taken, so
tenant admission does not serialize with per-run accounting; the admission owner must call the tenant gate before, not inside, the
allocation install transaction.

## Not requested

No role, grant, seed row, trigger, view change, change to `0001_product_budget.sql`, or execution of any migration. No cross-schema
reference to `meri_product_budget.runs` is added so that a tenant reservation can precede the run row.
