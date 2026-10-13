# Qualified application source assembly — 13 October 2026

Base: PR48 `3d34bf42983824327c63f96419abcfea8a587407`. Source-only work in isolated branches; no cloud, database or container execution is authorized by this source task. Parent coordinates the exact owned-worker/native database fixture. Native receipts and pins stay private with their owner.

## Outline before implementation

- Keep all six existing migration files unchanged. The schema author owns an explicit disposable-database verifier/once-only installer; no new schema or reset.
- The lifecycle author owns the fixed Node/Python bridge to existing `PostgresStore`, `Grants` and `GrantAdmission`, plus a concrete read-only worker observer evaluating the existing native-enforcement predicates. Original deadlines cover all operations; failed/ambiguous setup cannot retry or reseed. Scripted observations are synthetic evidence only.
- Root owns the specific action fixture dispatcher and application composition. Extract only the shared existing actions.query dispatcher and persisted application graph. Existing production mount remains fixed source-disabled. A separate qualification entry accepts only the owned synthetic source adapter and uses the same persisted currentRun reader for session, lookup and command authority.
- Root's assembly coordinates schema verification, canonical lifecycle activation, two canonical grant-budget bindings, and persisted admission before exposing the enabled fixture host. Reconstruction verifies schema, observes/admit-reads the worker/run and opens fresh graph owners without migration, seeding, grant rebinding, allocation reset or proposal regeneration.
- Trusted server configuration owns credentials, run/worker binding, immutable allocation, selected client and policy. Browser hints cannot set them. Ports remain fixed typed owners, not a generic dispatcher or second model loop. Claude Agent SDK ownership is unchanged.
- Keep borrowed pools, lifecycle/worker readers and native resources owned by callers. Close only locally created session/HTTP/process owners. No ambient credentials or secret output.

## Exclusive paths and verification

Schema author: `apps/control/qualified-application/schema*.mjs`, schema README/tests/evidence. Lifecycle author: `infra/native-enforcement/worker-observer.mjs`, Python qualification assembly lifecycle/bridge, Node lifecycle bridge and focused tests/contracts. Root: fixture gateway extraction, `apps/control/admitted-runs/mount*.mjs`, qualified application mount/assembly and tests/docs. Separate reviewer receives frozen source commits and owns independent tests/evidence.

Verify existing source-off behavior, real typed fixture read/draft/prepare/approval/execute/replay/revocation through public receiver, one allocation/two grants, no authority before activation, retained reconstruction, original cutoff expiry/parked ports, foreign/replaced worker, partial activation/unknown acknowledgement, schema identity mismatch and immutable migration hashes. Preserve raw failures and original tests. Scripted SQL and worker tests do not establish PostgreSQL durability, exact live worker or Clerk authority. Native owner runs supplied executable assembly against its admitted disposable engine and exact owned worker; G1 remains OPEN.
