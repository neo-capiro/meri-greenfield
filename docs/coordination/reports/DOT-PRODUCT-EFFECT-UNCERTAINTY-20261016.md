# Product effect timeout repair

Base: `eca78d458acb46cbfd54a94cf870841d999ef6b1`; lane `dot/meri-startup-history-20261016`.

The product HTTP lifetime can end while a settings COMMIT or memory Core submission is still pending. The old `handled` flag was set only after the raced await returned, losing uncertainty. This focused repair records route invocation inside the lifetime callback and route completion inside the handler await. An interrupted pending effect returns the existing error code with `outcome: UNKNOWN`; a completed result withheld at release remains `RESULT_NOT_RELEASED`. Explicit domain outcomes remain owned by their domain. Admission failures never mark the route started. A timeout is no rollback, physical-stop or safe-retry proof; reconcile the original revision/idempotency identity.

Ownership stays in the existing HTTP effect route descriptor; settings persistence and memory review retain their canonical transaction and immutable-candidate journals. No contract, migration, lock, runtime composition or manifest was edited. Neither changed source nor added test is a candidate-h hashed row.

Synthetic checks on Node 24.19.0, one process at a time, 192 MiB V8 heap:

`node --max-old-space-size=192 --test --test-concurrency=1 apps/control/product-access/test/effect-uncertainty.test.mjs apps/control/product-access/test/http.test.mjs`

Result: **13 passed, 0 failed**. Seven new cases exercise delayed settings COMMIT, delayed memory propose/correct Core submit, deadline/cancel, late success, and admission cancellation with zero route calls. Real service, PostgreSQL transaction and Core-review code run against scripted SQL/Core ports. Existing membership-removal, validation, cross-tenant and content-free-error assertions still pass.

Reverted-fix proof: restored `http.mjs` to the base bytes temporarily, ran the seven new cases, then restored the repair. **6 failed, 1 passed**, exit 1: pending-effect responses lacked UNKNOWN; pre-dispatch cancellation passed. The delayed doubles were released in finally and observed settling. No test-owned listener or external process remains.

UNRUN: real PostgreSQL, Core/provider, browser, compiler and broad suites. Heavy suites await coordinator allocation. Local synthetic evidence is not deployment or live durability acceptance. Offline dependency installation failed for an uncached locked package; ordinary locked `npm ci --ignore-scripts --no-audit --no-fund` then succeeded. Lockfiles are unchanged.
