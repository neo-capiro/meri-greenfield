# Tenant budgets and concurrency

Base `ba40647`. Owned paths: this directory only (new files). Default-off: nothing composes the gate until a trusted owner wires it;
no existing allocation, grant, deadline, migration or SQL path is changed.

## Outline

- **Responsibility.** One per-tenant monthly cost cap and one per-tenant concurrent-run cap, enforced at run admission, settled from
  measured usage, released on every terminal state. The existing global cap row plus per-run allocations (`../postgres-budget-store.mjs`,
  `../native-allocation-admission.mjs`) remain the per-run owners; this is the tenant-level owner above them.
- **Modules.** `policy.mjs` is the pure rule kernel (input shapes, calendar-month key, `admitReservation`, `releaseTransition`,
  `settleTransition`, aggregation). `memory-store.mjs` and `postgres-store.mjs` implement the store port
  `{readTenantBudget, reserve, release, settle, recordNotDispatched}` and own atomicity (a store-wide mutex; a locked tenant row in one owned transaction
  of the canonical `PostgresBudgetStore`). `gate.mjs` exports `tenantBudgetGate({store, now})` with `admit`, `settle`, `release`, `read`
  and `notDispatched` for the admission owner. Refusals reuse `BudgetStateDenied`.
- **States.** Concurrency and financial liability are separate. `HELD` (slot and conservative hold counted) → `RELEASED`
  (cancellation, failure or revoke: the slot is freed, the hold stays liable against the monthly cap) → `SETTLED` (measured usage
  replaces the hold in the reservation's month) or `NOT_DISPATCHED` (authoritative no-dispatch proof drops the hold without a charge).
  `HELD` may go straight to `SETTLED` or `NOT_DISPATCHED`. A second settlement with a different amount, a settlement after
  `NOT_DISPATCHED`, and no-dispatch proof after a settlement are `TENANT_SETTLEMENT_CONFLICT`; the identical settlement replays without a
  further charge. Exact replay of a held reservation is idempotent, any other replay is `TENANT_RESERVATION_CONFLICT`. Reaching the cap
  exactly is admitted. (Corrected after dot's HOLD of `06b2f49`: release previously freed the hold too.)
- **Refusal codes.** `TENANT_BUDGET_EXCEEDED`, `TENANT_CONCURRENCY_EXCEEDED`, `TENANT_BUDGET_UNCONFIGURED` (a tenant without a policy
  row fails closed), `TENANT_RESERVATION_CONFLICT`, `TENANT_RESERVATION_UNKNOWN`, `TENANT_SETTLEMENT_CONFLICT`, `TENANT_BUDGET_INPUT`,
  `TENANT_BUDGET_STATE`, `TENANT_BUDGET_CANCELLED` (the caller's signal aborted before the store mutated), `TENANT_BUDGET_CLOCK`,
  `TENANT_BUDGET_CONFIGURATION`; PostgreSQL commit uncertainty stays `BudgetCommitUncertain`.
- **Deadlines.** Unchanged. The gate carries no deadline of its own; the caller's existing operation lifetime and cancellation signal apply.
- **Persistence.** The PostgreSQL adapter targets `meri_product_budget.tenant_budgets` and `meri_product_budget.tenant_run_reservations`
  in `../migrations/0002_tenant_budgets.sql` (centrally reserved for Fable, source authoring only, by
  `docs/coordination/tasks/CODEX-TENANT-BUDGET-0002-ALLOCATION-20261015.md` at central commit `1b61483d`; numbering, not DDL acceptance;
  see `docs/coordination/proposals/FABLE-MIGRATION-REQUEST-TENANT-BUDGETS-20261015.md`). Nothing applies DDL; the adapter's real-engine test is skipped unless `MERI_TENANT_BUDGET_PG_SOCKET` names a socket of a database an operator
  has already migrated.

## Intended call site (not wired here)

`createPostgresAdmittedRunOwner` / `createAdmittedActionHost` (`apps/control/admitted-runs`) are persisted *readers* that perform no
admission, so they cannot host the reservation without restructuring. The single writer that installs a run is
`createNativeAllocationAdmission.admit` (`../native-allocation-admission.mjs`). The intended composition is:

```js
const tenants=tenantBudgetGate({store:createPostgresTenantBudgetStore({pool}),now});
// admit(): before the allocation install transaction, in the caller's lifetime
await tenants.admit({tenantId:binding.tenantId,runId:binding.runId,holdMicroUSD:allocation.budgets.maxCostMicroUSD,signal});
// settle(): when the run's measured model/tool usage is known (requests.actual_micro_usd + tool charges)
await tenants.settle({tenantId,runId,measuredMicroUSD});
// release(): on revoke()/failure/cancellation: frees the slot only; the hold stays liable until settle() or notDispatched()
await tenants.release({tenantId,runId});
// notDispatched(): only with authoritative proof that nothing was dispatched for the run (proof producer: see the lane report)
await tenants.notDispatched({tenantId,runId,proof:{outcome:'NOT_DISPATCHED',tenantId,runId}});
```

A refused `admit` must stop the admission before any allocation or grant row is written; the hold is the run's own cost cap, so the
tenant cap is conservative pre-admission accounting, not provider pricing. Wiring it into `native-allocation-admission.mjs` is a
separate, reviewed change to that owner.

## Checks

```sh
node --test apps/gateway/budget/tenant/test/*.test.mjs
```

The gate tests cover cap and concurrency boundary values, month rollover, concurrent reservations, replay, release on failure,
the release-then-reserve liability regression, settle-after-cancel, no-dispatch proof, double settlement and hostile inputs over the
memory store. The PostgreSQL test scripts the adapter's SQL (lock order, decoding,
lost COMMIT acknowledgement) and skips the real-engine case unless `MERI_TENANT_BUDGET_PG_SOCKET` is set. Scripted SQL does not
establish PostgreSQL isolation or the unapplied migration.
