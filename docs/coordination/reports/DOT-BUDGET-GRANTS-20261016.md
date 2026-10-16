# Budget and model-grant source candidate

Base `eca78d458acb46cbfd54a94cf870841d999ef6b1`; prior audit `f8d1816eda48347eeca4c0c25308870f2885c1f5`, SEC-REL-02. **SEC-REL-02 remains HOLD** until canonical issuer/peer/TLS/runtime composition and real combined-ledger qualification exist.

## Canonical ownership and changes

- The existing gateway `PostgresBudgetStore` remains the product ledger/transaction owner. `tenant/postgres-store.mjs` can join a borrowed native admission transaction, with no second BEGIN, COMMIT, pool or client disposal. The existing tenant policy kernel is reused unchanged.
- `native-allocation-admission.mjs` reserves the tenant hold before run/allocation/grant installation. Revocation releases concurrency and retains UNKNOWN financial liability; once combined model/tool liabilities are all resolved, measured usage settles the reservation. Repeated canonical revoke can reconcile a later settlement. Legacy missing tenant metadata does not block grant cleanup and never implies a settled/zero-cost account. New admission always requires tenant policy/schema.
- Python `state/namespace.py` admits only fixed trusted qualification/product choices. Existing admission and ledger use the same selected schema; product mode requires an allocation before model reservation. The existing global lock and combined model/tool view remain authoritative. Product mode cannot mutate grants through qualification `Grants` or execute qualification migrations.
- `runtime/product.py` composes the retained ingress and ledger from one product store and peer-bound grant. It preserves the exact pinned CLI query. It supplies no peer observation, TLS/server, provider or credential lifecycle itself.
- `runtime/run-model-grant.mjs` admits only a durable issuer's exact run intent, original expiry, digest and model capability distinct from task/control. `prepared-run-bindings.mjs` uses that capability and includes its grant in the existing activation/revocation set. Missing model issuer fails `MODEL_GRANT_UNAVAILABLE`; static proxy material is no substitute. The actual durable model issuer remains unallocated/unimplemented.

The authored product-budget 0002 migration is byte-unchanged and unapplied. No new provider, credential, SQL, lockfile or frozen contract was created. The full outline and owner map are [DOT-BUDGET-PLANNER-OUTLINE-20261016.md](DOT-BUDGET-PLANNER-OUTLINE-20261016.md). Exact port/DDL/terminal reconciliation decisions are [DOT-BUDGET-PLANNER-PORTS-20261016.md](../proposals/DOT-BUDGET-PLANNER-PORTS-20261016.md), BG-1 through BG-3.

## Evidence and limitations

All controls are synthetic/static and run serially, with Node heap 128 MiB, test isolation disabled (one process) and a 30-second owned-process deadline. Final sampled working set peaked below 58 MiB. No npm, compiler, browser, database, SDK/model or provider suite ran.

| Controls | Result |
| --- | --- |
| Retained Python synchronous admission/tool-budget plus new product tests | 23/23 pass |
| Original qualification ledger/admission against two product regressions | 0/2 pass, 2 expected failures |
| Tenant gate and same-transaction composition | 17/17 pass |
| UNKNOWN-barrier ablation | 0/1 pass, 1 expected failure |
| Per-run model-grant admission | 8/8 pass |
| Historical source proof | 5/5 pass; zero changed h rows |

Evidence: `docs/qualification/candidates/dot-budget-planner-20261016/controls.json`, individual logs, negative source-restoration hashes and reproducible runner. The product-store configuration test stubs the driver **without connecting**; SQL tests script a database, and model-grant tests script an issuer. They do not establish PostgreSQL isolation, genuine issuer durability, peer identity or real model charging. An earlier full async ingress attempt returned no output and was explicitly interrupted (owned exec session 80204, exit 1); no success or failure count is inferred. It was not retried. A setup-only harness path error is preserved under `setup-attempt-1`; preliminary successful process-isolated controls are retained separately. The final runner uses one process per control.

**UNRUN:** dependency-backed native allocation/prepared-run integration regressions (their fixtures were updated); full typechecking; real PostgreSQL model/tool concurrency, tenant migration/commit-loss/late settlement; actual CLI→product proxy→provider cancellation; genuine model issuer and current peer observation; Temporal terminal reconciliation. Shipping has not granted a heavy/dependency-materialization slot. No heavy job was launched. The source branch is not ready for release integration without these owner decisions and checks.

New test paths are covered by existing suite globs. No manifest was created or repinned. The source proof's unchanged 45 rows do not establish complete source/image closure for the new modules.
