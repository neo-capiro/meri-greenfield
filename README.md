# Meri greenfield

Independent Meri build using the Claude Agent SDK, AI Elements, Playwright, Temporal, PostgreSQL and S3. Current Capiro implementation code and infrastructure are not imported. Canonical Capiro identity, data and institutional memory remain external dependencies behind newly implemented authorization-aware connectors.

The owner approved private `neo-capiro/meri-greenfield` and independent resources in AWS account `967807252336`, region `us-east-1`, on 9 October 2026. This checkout contains the new application only. Existing Meri remains available; cutover requires an independently verified release candidate and explicit authorization.

Start with `docs/coordination/STATUS.md`, the supplied plans in `docs/plans/`, and `packages/contracts/README.md`. Codex owns implementation, independent verification, shared contracts, acceptance and deployments; G0/G1 is Codex-only with no Hermes. Apply `docs/IMPLEMENTATION-STANDARDS.md` in dedicated branches/worktrees. Local Git worktrees provide editing separation, not an OS sandbox.

Product UI belongs to the new private [capiro-frontend](https://github.com/neo-capiro/capiro-frontend) repository, which will also host Portfolio, Modules and Settings. This repository owns the Meri backend/runtime, trusted event production and public shared contracts. D014 records the human's decision and the required qualified UI migration; current backend UI qualification packages remain active until their exact coverage is migrated and accepted.
