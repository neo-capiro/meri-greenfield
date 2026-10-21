# C12 unstarted original recovery

Implementation base: `bce707763f2cbabe1a73a99aee7b7ec206fa6996`. Continues the partial, untested handover `0b6737d5ed525169e19a85696ed585cadf442094` on `codex/c12-unstarted-original`.

## Implementation outline

- The existing initial-run binding journal owns immutable generations under the conversation advisory lock. Migration 0020 changes binding and input keys while preserving the existing triggers and grants. The first-chat PLAN appends the migration without renumbering applied ledger entries.
- Fresh session issuance may replace an expired or obsolete unstarted original. Exact-run selection and session rechecks are read-only with respect to generations. The same tenant, actor, client and policy must be proven again; started runs retain their prior lifecycle behavior.
- The original-input journal uses the run key and verifies the latest original under the same transaction lock before reservation or acceptance. Superseded RESERVED inputs remain immutable history.
- Existing registry and proxy currentness owners continue to compare the full binding. No proxy production change or new authority path is planned. Objective run-start occupancy remains conversation-scoped: any binding generation occupies the conversation.
- Verification covers fake-clock expiry, release changes, retry after reservation, ownership/policy negatives, independent started markers, concurrent issuance, stale kickoff/currentness, migration upgrade/immutability, and mutation checks. Real PostgreSQL, migration lock timing, Docker image qualification and live checks remain Fable validation gates if unavailable locally.

## Interpretation of policy pin

The brief mentions stale policy as a recovery cause but its negative acceptance case, and Option A's security invariant, require a different policy to be refused. Core's identity/context receipts do not carry a policy revision that authorizes a transition. This implementation therefore preserves the policy pin and refuses a mismatch; it does not silently adopt a new policy. Configuration and runtime-version changes can supersede an unstarted original under that same policy.

## Validation

### Exact-run requests and rolling deployment

The updated handover permits recovery when an exact run hint names the dead original. The existing session contract cannot do that successfully: issuance and rechecks share the same context port, rechecks inject a bound run hint, and the session owner requires the returned run to equal that hint. Appending a replacement would therefore change the journal and then return `SESSION_REFUSED`. C12 narrows recovery to fresh issuance **without a run hint**. Exact-run selection and rechecks cannot claim or rebind, including when no original exists.

During a rolling deployment, fresh issuances served alternately by renders A and B may still append alternating unstarted generations. Nothing started can be rebound. Claude's release validation must cover this existing handover caveat; C12 does not add a cross-render preference or change session authority.

### Request ownership through migration-first rollout

Run-keyed inputs allow the same request ID to retry against a replacement run in the same conversation. They must not let another conversation or tenant capture that request ID. The input journal takes a request advisory lock after its conversation lock and verifies ownership. Migration 0020 adds a matching `BEFORE INSERT` guard so older binaries also enforce that invariant during migration-first rollout. The trigger is `SECURITY INVOKER`, uses existing SELECT/INSERT grants, and leaves all immutability triggers unchanged. It fails closed outside READ COMMITTED, where its post-lock ownership read could otherwise use a stale snapshot. No path holding a request lock acquires another conversation lock.

### Executed checks

All checks used synthetic inputs and local protocol fixtures. They do not establish PostgreSQL, deployment, or live authority acceptance.

| Check | Result |
| --- | --- |
| Binding/input journals, expiry/release recovery, reserved-input retry, stale registry/proxy boundaries, C11 regressions, diagnostics, registry, objective occupancy, owner entrypoint/currentness, migration PLAN | **170/170 pass** |
| Objective / scheduled / routine admission after generation-aware fixture repairs | **3/3, 55/55, 8/8 pass** |
| Lifecycle continuation after generation-aware fixture repair | **8/8 pass** |
| Other caller/startup suites in the 108-test regression sweep | **33/34 pass**; one existing mount assertion below |
| Proxy Python native auth, owner admission, refusal diagnostics | **32/32 pass** on unchanged rerun after four timing failures under host load |
| Runtime TypeScript check | Pass |
| JavaScript syntax for all three changed real-PG suites; whitespace check | Pass |
| Base `bce70776` recovery proof, with SQL fixtures compatible with both query signatures | All three recovery cases fail with **SESSION_REFUSED**: expiry, release A→B, reserved-input retry |
| Targeted mutations in isolated source copies | Five journal mutations, eight composed/diagnostic mutations, and one latest-generation reader mutation all killed; source restored |

The first caller sweep was 79/108: 27 failures came from three older fixture row constructors omitting `generation`, one lifecycle test hit a session deadline on the heavily loaded host, and one mount assertion was already stale. After adding faithful generation fields (no assertion changes), the affected 74 tests pass. The mount assertion in `task-preferences-integration.test.mjs` expects `/api/settings/tenant/read` to return 404 but observes 503. It fails identically on the clean `bce70776` tree; this unrelated behavior is unchanged.

The proxy Python command was `python3 -m unittest apps.proxy.product.test.test_native_auth apps.proxy.product.test.test_owner_admission apps.proxy.product.test.test_refusal_diagnostics`. Adding `apps.proxy.product.test_request_admission` was blocked at import by missing `httpx`; that module and the full proxy Python/image qualification remain unverified here. No Python product code changed.

The core suite command was:

```sh
MERI_REVIEW_SOURCE_ROOT="$PWD" node --experimental-test-module-mocks --test --test-concurrency=1 \
  apps/control/conversations/test/initial-input*.test.mjs \
  apps/control/conversations/test/initial-run-binding-journal.test.mjs \
  apps/runtime/test/unstarted-original-rebind.test.mjs \
  apps/runtime/test/unstarted-original-boundaries.test.mjs \
  apps/runtime/test/conversation-survives-deploy.test.mjs \
  apps/runtime/test/dynamic-candidate-identity.test.mjs \
  apps/runtime/test/initial-run-bindings.test.mjs \
  apps/runtime/test/prepared-run-registry.test.mjs \
  apps/runtime/objective-source/postgres-run-starts.test.mjs \
  apps/control/action-host/session/refusal-diagnostics.test.mjs \
  apps/proxy/product/owner-native-currentness.test.mjs \
  apps/proxy/product/owner-entrypoint.test.mjs \
  infra/product-preview/first-chat-database.test.mjs
```

The remaining caller files were `lifecycle-continuation-servability`, `read-runtime-startup`, `control-temporal-startup`, `user-preferences-startup`, `task-preferences-integration`, `prepared-candidate-startup`, `objective-admission`, `routines-occurrence`, `scheduled-admission`, and `owner-diagnostics`. Use the same Node flags and source-root environment; `npm run typecheck --prefix apps/runtime` checks TypeScript.

### PostgreSQL and shipping validation still required

**Migration lock duration is unknown: PostgreSQL and Docker are not installed in this execution environment.** No database migration or deployment has been performed. Migration 0020 remains appended at ordinal 43 in the integration stage, with its current SHA-256 pinned by the PLAN.

The real-PG suite creates disposable databases, populates 1,000 and 100,000 original bindings with half as many reserved inputs, upgrades 0016/0017, checks row preservation/keys/immutability, races two rebinds, races accept against rebind in both lock orders, and races a legacy INSERT against a current claim for the same request in different conversations. Its diagnostic measures complete migration transaction elapsed time, an **upper bound** on lock duration including acquisition/network overhead, not an exact lock-held measurement. Claude must record timing during validation before shipping.

```sh
MERI_INSPECTION_TEST_SOCKET=/tmp/meri-prepared-kickoff-pg-20261014/socket \
MERI_INSPECTION_TEST_DATABASE=meri_inspection_final \
node --test --test-concurrency=1 \
  apps/control/conversations/test/initial-generations-migration-pg.test.mjs \
  apps/control/conversations/test/initial-run-binding-migration-pg.test.mjs \
  infra/product-preview/first-chat-owner-reads-pg.test.mjs
```

The fixture cluster must first be provisioned using the repository's local-baseline recipe. Run the historical image gate and full proxy qualification during Claude's validation. No AWS access, merges, deployments, or GitHub Actions changes are part of this PR.

New real-PG assertions have **not** been mutation-checked here. Required SQL mutants include dropping the request-owner trigger, bypassing its ownership or isolation checks, disabling immutable-row triggers, and removing the journal conversation lock. These remain explicit validation gates, not claimed passes. Executed mutation edits and baseline proof are retained in `c12-mutation-checks.json`.
