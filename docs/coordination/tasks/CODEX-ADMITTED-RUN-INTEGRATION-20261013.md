# Admitted run source integration — 13 October 2026

Base: `84c2ca01d0bce025a0003b6e724d675a05f2975a` (PR47). Root branch/worktree: `task/meri-admitted-run-20261013`, `/tmp/meri-admitted-run-20261013`. Follow the user's source-only authorization and implementation standards. Author and independent reviewer have separate worktrees and exclusive paths.

The canonical lifecycle remains `apps/proxy/qualification/state/grants.py`: trusted admission/replacement, pending creation, verified-worker activation and revocation. Existing SQL budget, allocation and grant-binding records remain the persistence authority. This slice adds a bounded read owner over those records and composes that same current-run function through session, read and command authority. It creates no run identity, grant, lifecycle registry, migration, credentials or model loop. Native context, capability scopes and business authorization retain their existing owners.

The persisted schema and ECS mapping are explicitly qualification-specific. Executable source over those records is not evidence of product schema admission, verified worker activation, native database semantics, Capiro endpoint implementation or G1 runtime qualification. G1 remains OPEN; G2–G7 remain unentered.

Responsibilities and allocation:

- Author: gateway admitted-run reader, narrowly shared binding validation, deliberate gateway export, control application mount, author tests, task outline and author evidence. No existing test changes.
- Independent reviewer: new independent tests and review packet only; freeze and replay against exact source, report ACCEPT_SOURCE or HOLD.
- Root: integrated source review, relevant unchanged regressions, mounted replay, preservation/hash/process cleanup audit, report and draft continuation publication.

The reader must require exact preconfigured full binding and shared allocation for all grants, lock the canonical budget row, use database time, refuse absent/stale/inactive/revoked/mismatched/quarantined state, derive the original cutoff from persisted allocation start/runtime plus schedule/grant expiry, and never reserve, settle or reset a liability. Construction must be inert. Deadline/cancellation and lost commit acknowledgment must never publish authority; late borrowed clients must be released without ending the pool. The mounting path must wire one concrete reader through all relevant currentRun consumers, with production sources disabled.

Root checks: independent author/reviewer results; relevant existing gateway budget, action-host, session and application-adapter tests; concrete mount replay with isolated synthetic SQL/identity/source boundaries; original tree and public contract preservation; evidence manifests; owned process/symlink cleanup. Failures and corrected reruns remain visible. No paid models, cloud changes, images, live SQL, customer data or native/private receipts are authorized.
