# Prepared container budget qualification correction

Base: exact RC1 `2f06feccca731d6cd388612cd568185ecc29668f`.
Owner: sole native-runtime Codex owner; independent review owns only its separate scratch evidence directory. Prior 33-case evidence and source worktree remain immutable.

Owned source paths: `apps/gateway/test/postgres-budget-native-fixture.mjs`, new `apps/gateway/test/postgres-budget-container-fixture.mjs`, `apps/gateway/test/postgres-budget-admission.test.mjs`, new `apps/gateway/test/postgres-budget-container.test.mjs`; this candidate evidence directory. No application contract, migration, lockfile, integration case or child protocol changes.

The existing test helper owns admission, pg pool lifetime and SQL identity verification. A small qualification-only module owns the prepared container's read-only transport binding. Keep the existing direct password profile; add an explicit prepared-container descriptor requiring password null and the fixed synthetic mapped endpoint/database/owner. Inspect only local Docker public identity/mapping/purpose/volume metadata before opening a pool. The PostgreSQL system identifier, start time, version, durability, database and role remain required, while SQL server address/port match the inspected internal endpoint rather than the client mapping.

No credentials, roles, HBA, network controls, packages or services are introduced. Existing trust authentication supports functional synthetic tests only; it does not qualify production authentication or tenant network isolation. Config hashes are correlation, not operator authority. Imports remain inert. The descriptor is deeply frozen. Reuse the pinned pg 8.23.1 and existing dependency installation through local links.

Verify source admission and inert imports, refusal of wrong host/container/image/volume/mapping/database/role, and unchanged direct profile; independent review before native cases. If accepted, run the existing nine integration cases exactly once with fixed deadlines and direct platform supervision. Preserve the original schema identity/rows and all previous archives; prepare only a fresh canonical synthetic schema from unchanged migrations, archive it and restore the original. No new credentials/security changes are needed. Any additional material scope need stops for one exact approval.
