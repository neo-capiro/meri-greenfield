# Budget, Planner and intent release implementation outline

Base: `eca78d458acb46cbfd54a94cf870841d999ef6b1`, tree `af0fa89750d9ffb8a58b66dfcb6f84cf4300fd49`.
Independent audit: `f8d1816eda48347eeca4c0c25308870f2885c1f5`.
Branch: `dot/live-budget-planner-20261016`. No `.agents` directory exists at the base.

## Ownership and boundaries

- The gateway product budget store owns the ledger and transaction lock. The tenant gate owns monthly liability and concurrent-run policy. The Python retained proxy must select those same product tables through a closed trusted namespace, preserving qualification defaults and the exact pinned CLI route.
- Native allocation admission owns run/grant activation. Tenant reservation must occur in its transaction before installation. Revocation releases concurrency but retains unresolved liability. Settlement must never infer no-dispatch from cancellation, expiry or a missing ACK.
- Prepared-run issuance owns immutable issuance identity and protected capability material. `prepared-run-bindings.mjs` is claimed for model-grant integration, coordinated with startup owner `01a14241-cbba-7531-9aba-71299cd430d7`; `control.mjs`, `product-applications.mjs` and conversation activity cleanup belong to that owner.
- Core Objective owner `01a13d85-a042-7236-b84f-a797c4cd3030` retains backend `622905839c7a510ab01a512ef8012926b2e1b4ce`. Canonical plan IDs are reservations, never application receipts. Broader association/publication/composite ports remain proposals. No Core/Shared/Planner public seam or migration is transferred by that handoff.
- Parent separately assigned intent result-release repair: control intent mount and a cohesive release helper, worker prepared-result admission plus runtime/server plumbing and targeted tests. Current release authorization must be checked for both fresh and retained outcomes; PREPARED custody and original identity remain immutable after refusal. Missing canonical authorization fails closed.

## Modules and verification

Python fixed table identities belong in `apps/proxy/qualification/state/namespace.py`; the existing grant, admission and ledger modules consume them. A product-only proxy composition shares the same trusted store for admission and reservation. No second budget, provider loop or credential source is introduced.

Use built-in Node/Python synthetic tests in a single bounded process (<=256 MiB), as shipping authorized. No npm, type/compiler, browser or database suite without a bounded heavy slot. Preserve before-fix failures and negative controls. Real PostgreSQL, provider, SDK, TLS/peer observation and Temporal integration remain UNRUN until authorized and configured.

No frozen contract, migration, lockfile, image recipe, historical manifest or accepted source integration is changed. Report old/new proof-row hashes separately. Contract and migration proposals go through qualification coordinator `01a14243-40ec-7321-b8f4-1cf827a7f0c1` to parent; direct parent messaging returned `thread not found` during this turn.
