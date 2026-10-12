# Gateway budget native-test source review — 2026-10-12

Reviewer: gateway_reviewer. Exact base: PR16 `e8d2c0d0e5db8fb01ba2df26c4eb3f79b296c0b5`. Isolated branch `review/meri-g1-budget-native-tests-20261012`. Status: criteria frozen before author freeze; final source verdict pending.

## Scope and implementation outline

Read AGENTS.md, implementation standards, adopted R2, canonical gateway budget store/binding/adapter/disabled factory, migration0002, and existing qualification real-PostgreSQL test conventions. No applicable repository .agents skill directory exists. Review owns only this report and the sibling `g1-budget-native-tests-20261012/review/` evidence directory. Author owns the four new test modules and narrow README/task/evidence changes. No production, schema, migration, lock, dependency or original test edits are permitted.

The canonical owner remains `PostgresBudgetStore` and `createPostgresToolBudget`. The real production gateway remains source-disabled; only its trusted bind path can exercise SQL. Integration tests may later characterize the adapter directly. SQL readback is test evidence, because the adapter exposes no outcome/readback or reconciliation API. `markUncertain` returns no outcome and does not refund/reset liability.

Only offline admission/source controls and syntax checks may execute during this review. Do not execute/import the integration entry or child mode, connect a Pool, run SQL, provision/restart a database/server, or invoke native/cloud/model/provider/customer operations. Future native tests remain UNRUN. The current first L1 action packet remains frozen and cannot automatically chain these tests.

## Frozen acceptance criteria and negative controls

1. Default-closed explicit opt-in and closed inert configuration precede native dependency loading, Pool connections, SQL and child launch. Offline admission checks import only safe source. Missing, extra, malformed or mutable identity/authority/config inputs deny before effects. A name, boolean or self-supplied digest is not admission authority.
2. Future native use explicitly requires fresh separately admitted host/executable/dependency provenance, isolated cluster and system identity, scoped role, listener/PID, externally bounded supervisor/watchdog and exact action authority. Source guards honestly record their partial limits. Do not provision, migrate, reset, truncate, delete or infer that an existing database is safe from its name. Synthetic writes require the separately admitted fresh qualification schema.
3. Use the existing pinned pg8.23.1 Pool and canonical production owners. Borrowed pools are never ended by production code. Test-owned parent/child pools have explicit cleanup on success/failure. Connection, query, lock, process, output and cleanup bounds remain finite; child errors and credentials are content-free.
4. Native cases exercise durable database outcomes: exact retained invocation replay refusal even with a new reservation UUID, shared model/tool and per-run liabilities, UNKNOWN retention, terminal settlement and no double charge/refund, stale grant rejection, historical exact settlement after revocation/expiry. Independent processes use actual independent pools. Original assertions and negative evidence remain preserved.
5. Lost acknowledgement injected after a successful real COMMIT is labelled synthetic acknowledgement loss, not demonstrated network/WAL failure. It must leave exact UNKNOWN/SETTLED database evidence; no automatic redispatch, retry, pool replacement or invented reconciliation API. Uncertain clients are evicted and definite acknowledged transactions released normally.
6. Actual `createDurableSourceDisabledGateway` binds the real pool, then execute remains UNAVAILABLE before additional SQL/authority/source work. Do not mutate catalog availability or production flags to manufacture a gateway effect path.
7. Child entry validates mode/config before resources, with explicit finite deadline/output/IPC bounds and test-owner process cleanup. Source inspection is not physical process cleanup evidence. Neither child execution nor actual process-boundary durability is qualified here.
8. Exact final author source is reviewed and hashed. Run only approved offline controls and parser checks, retain any failures and fixtures/mutants, and prove original tracked files unchanged outside allocation. Return ACCEPT_SOURCE_TESTS only for useful executable test preparation; native durability, admission, security, runtime/G1 and production connectivity remain HOLD.

## Initial source findings

The existing migration enforces one UNKNOWN tool reservation per grant, with a combined model/tool liabilities view. The adapter refuses any reused invocation ID and retains UNKNOWN under `markUncertain`; raw SQL assertions must not be described as owner reconciliation. Existing real-engine revocation tests use a weaker loopback/name opt-in, which is precedent for syntax only and does not meet this task's fresh host/cluster/action prerequisites.

No native operation or integration/child entry has been invoked in this review. Final checks, source hashes and verdict will be appended after exact author freeze.
