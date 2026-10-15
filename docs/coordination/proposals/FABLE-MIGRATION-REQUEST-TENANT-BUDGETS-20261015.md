# Migration request: tenant budgets and concurrency (product namespace)

Requested by Fable on 15 October 2026 at base `ba40647`. Migration IDs are allocated centrally; this document proposes DDL and asks
dot/Codex to allocate the next product-namespace ID. Nothing in the source applies it; `apps/gateway/budget/tenant/postgres-store.mjs`
targets these tables and is exercised against a real engine only when `MERI_TENANT_BUDGET_PG_SOCKET` is set.

## Proposed DDL and allocation

**Proposed allocation (dot, 15 Oct 2026): `meri_product_budget`, `apps/gateway/budget/migrations/0002_tenant_budgets.sql`.** The DDL
now lives in that source file. This is source numbering only: the central migration publication is still pending, so the allocation is
recorded as **proposed, not published**, and nothing in this repository executes it.

Correction after dot's HOLD of `06b2f49` (p1b): the first proposal let `RELEASED` free both the concurrency slot and the cost hold, so
a cancelled run could be followed by a second full reservation and then settle the first (reserve 100, release, reserve 100, settle 70
under a cap of 100). Concurrency and liability are now separate. States: `HELD` (slot and hold), `RELEASED` (slot freed by
cancellation, hold still liable), `SETTLED` (measured usage replaces the hold), `NOT_DISPATCHED` (authoritative no-dispatch proof drops
the hold without a charge). The table gains `not_dispatched_at` and the four-state check constraint; the aggregate counts `HELD` and
`RELEASED` holds as liability.

## Access pattern

Every operation is one transaction: `SELECT ... FROM tenant_budgets WHERE tenant_id=$1 FOR UPDATE` first (the tenant lock), then the
aggregate over `tenant_run_reservations` (HELD count across all months; HELD and RELEASED holds and SETTLED charges for the admission
month), then
the per-run row `FOR UPDATE`, then one INSERT or one compare-and-set UPDATE on `state`. The existing `budget` row lock is not taken, so
tenant admission does not serialize with per-run accounting; the admission owner must call the tenant gate before, not inside, the
allocation install transaction.

## Not requested

No role, grant, seed row, trigger, view change, change to `0001_product_budget.sql`, or execution of any migration. No cross-schema
reference to `meri_product_budget.runs` is added so that a tenant reservation can precede the run row.
