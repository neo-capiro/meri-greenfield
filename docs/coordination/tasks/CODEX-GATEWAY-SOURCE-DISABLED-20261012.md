# Source-disabled trusted dispatch core — 12 October 2026 UTC

Exact base `0eb81023343fcfd2d5129a09c0048371cc9ccaa2`, tree `383fe7567aaf95cb18408dd5b2cb9c557a3ec897`. Dedicated worktree `meri-gateway-source-disabled-20261012`, branch `task/gateway-source-disabled-20261012`. Root released this implementation lane after the runner author closed. No recursive workers.

## Outline and ownership

- `apps/gateway/catalog/runtime-catalog.mjs`: immutable accepted catalog/operation-contract lookup; no duplicate operation registry or dynamic handler imports. Depends on the catalog author's frozen private resolver interface.
- `apps/gateway/authorization/current-tool-authority.mjs`: fresh opaque-capability, current run/fence and business/source-policy port composition; reusable frozen 0.1 shapes and private R2 subject assertions; no fixture registry as authority.
- `apps/gateway/dispatch/dispatch-lifetime.mjs`: preallocation deadline checks, owned cancellation/timer cleanup, unsettled-operation tracking and bounded uncertainty settlement. No physical-stop or refund claim.
- `apps/gateway/dispatch/operation-result.mjs`: bounded raw-JSON request/output parsing, operation-specific validation and safe errors; no introspection/stringification of external objects or fabricated evidence envelope.
- `apps/gateway/dispatch/tool-dispatch.mjs`: thin execution order; fresh authorization before effect and release, absolute deadline and mandatory budget bookkeeping. Production pending descriptors cannot execute.
- `apps/gateway/index.mjs`: import-safe source-disabled composition. No source-enabled switch, listener, live auth adapter, database, source adapter, migration or provider/model loop.
- Tests under `apps/gateway/test/`; this task, matching report and candidate evidence are the only other owned paths. Shared contracts, packages and locks remain owned elsewhere.

Current pending/null-handler catalog must expose zero tools and execute zero handlers. Explicit internal synthetic construction may exercise control flow in unit tests; it never changes the production catalog or creates an activation mechanism. Mandatory trusted ports are configuration contracts, not implemented authentication or persistence.

Verification: adversarial raw-boundary/getter refusal, defaults-before-digest, current binding/policy/source denial, revocation races before effects and result release, absolute deadline/cancellation, uncertain reservation bookkeeping, output lineage/byte bounds, no config-time allocation, import safety, existing contracts and immutable source/package preservation. External calls are limited to seeded in-process fake ports. No AWS, SQL, live auth, source, provider, network Git, publication or runtime admission.
