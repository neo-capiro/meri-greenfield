# Tenant budget migration 0002: central source allocation

15 October 2026 UTC. This record transcribes the explicit direction of parent integration coordinator `01a0ff18-26cd-7609-beba-87726d0300c6` to inspect p1b's actual product-budget proposal, check current remote/central collisions and reserve one unused path. Fable owns implementation. The delegated reviewer supplies only this documentation and readback evidence.

| Namespace | Exact reserved path | Sole source author | Scope |
| --- | --- | --- | --- |
| `meri_product_budget` | `apps/gateway/budget/migrations/0002_tenant_budgets.sql` | **Fable** | **RESERVED, source authoring only**, for the tenant-budget policy and per-run reservation tables requested by p1b, after the existing product-budget 0001. |

The [actual proposal at exact p1b](https://github.com/neo-capiro/meri-greenfield/blob/06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40/docs/coordination/proposals/FABLE-MIGRATION-REQUEST-TENANT-BUDGETS-20261015.md) names `meri_product_budget.tenant_budgets` and `meri_product_budget.tenant_run_reservations`. Its Git blob is `bb5c242f51ce4db371ec03a475fa02324c81868c`. This allocation supplies the missing number/path; it does **not** approve or reproduce the proposed DDL, state transitions, locks, policy defaults, financial accounting or integration. No SQL file is created. Preserve `apps/gateway/budget/migrations/0001_product_budget.sql` unchanged.

## Collision evidence and separate namespaces

The [current inspection](CODEX-TENANT-BUDGET-0002-COLLISION-20261015.json), observed `2026-10-15T18:17:18.8464817Z`, records all 19 fetched remote `dot/*` and `fable/*` heads and exact trees. Seventeen expose only product-budget 0001, identical blob `bc0ff007fe38606463a2613904930f9dc5bfe5f0`; two have no product-budget migration directory. No product-budget 0002 path or tenant-table reservation appears in the inspected central task records. Main `8b123bea4c90794dc2d766814b6ddbdbfe0928bc` has no product-budget migration directory. This is a remote source/record check, not proof about unpublished work or a database. Recheck owner and register heads immediately before authoring; report a collision rather than choosing another number silently.

The latest inspected register copy is [the register at a631e22f](https://github.com/neo-capiro/meri-greenfield/blob/a631e22f6f8e2283c40140dd5fec147f1a487fa7/docs/coordination/tasks/CODEX-CENTRAL-MIGRATION-ALLOCATION-20261015.md), which already preserves conversation 0011 and conditional result-custody 0012. Conversation migration IDs are a separate family: **do not use conversation 0012/0013 for tenant budgets**. The current p1a/p1b/p1c source heads have conversation 0011 blob `57a32381c2f97161274f04ef8609ac33eb9d2853` and no 0012 SQL. Source presence of 0011 does not establish frozen binding acceptance. [Conditional custody 0012](CODEX-STRATEGY-RESULT-STORE-0012-CONDITIONAL-ALLOCATION-20261015.md) retains its own authoring hold and all release conditions. No existing reservation or condition changes here.

## Acceptance and execution boundary

P1b implementation remains **HOLD** under the coordinator's independent review: releasing the entire cost hold before usage is known can admit replacement liability, then late settlement can exceed the tenant cap. Fable must resolve that financial-liability finding and return reviewable evidence. Numbering is not acceptance of the existing implementation or a direction to copy its current proposed state machine into SQL. This record does not independently re-review p1b or close any review finding.

No schema invention, runtime mounting, grant/role/seed/default cap, credential issuance, database inspection, migration execution, deployment, AWS or model call is authorized. The tenant gate and signed links remain unmounted. Native database, concurrency, durability, effective privileges and live policy qualification remain separate owner-controlled gates. The reviewed source and central decision must precede any separately authorized execution.

## Documentation verification

The bounded change is this allocation, the collision inventory and an appended register entry; all prior register content is preserved. Verify the final diff is documentation-only, the reserved SQL remains absent, prior 0011/conditional 0012 records are unchanged, and remote publication matches the exact committed bytes. Preserve the stopped discovery candidate and every other worktree. No qualification is run by this allocation.
