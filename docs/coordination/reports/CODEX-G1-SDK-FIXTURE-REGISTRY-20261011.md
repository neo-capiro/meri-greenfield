# G1 SDK fixture registry — Codex independent review

Decision: **ACCEPT as a partial source candidate; HOLD G1.** This report covers the bounded H3 registry assignment only. It does not accept a live channel, storage readback, worker behavior or the G1 gate.

## Source and policy

- Shared Capiro policy: `neo-capiro/capiro-agent-ops` checkout `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; `origin/main` is an ancestor; worktree clean. Windows machine map `machine-paths.local.yaml` last modified 2026-09-30 00:21:48 UTC. Read `BOOTSTRAP.md`, `AGENTS.md`, `hermes/OPERATING.md`, Meri repository `AGENTS.md`, implementation standards, continuation plan and private fixture contract.
- Source base: `0c6a37608805937154620eba3c62e8b50820c58f`, dedicated worktree `C:/dev/meri-greenfield-sdk-fixture-registry-20261011`, branch `task/remote-sdk-fixture-registry-20261011`.
- Worker session `20261011_151304_e3d92b` stopped at its 30-turn cap without a commit or tests. Codex retained its source, inspected every new module, corrected faults and independently tested. The worker's report that PostgreSQL/Node 24 were unavailable was disproved by local executable checks. Worker physical closure was verified separately; no Hermes worker process was left for this assignment.

## Reviewed implementation

- `state/migrations/0001_qualification_sdk_fixture_state.sql`: new qualification-only run, grant and immutable commit tables. No DROP, reset, role grants or product/Temporal migration. A run retains original T0/D/C; one active grant per run; grant identity can only make a one-time revoke transition; commit rows cannot update/delete. No worker key/URL/storage privilege is stored.
- `state/binding.mjs` and `receipt.mjs`: canonical private fixture shape/integrity, current binding and authenticated peer comparison, exact old-grant stale denial, original receipt/reference and independently verified readback comparison. Canonical validators do not provide authentication.
- `state/registry.mjs`: serializes each operation on the run row, then locks the relevant grant(s), then uses database time for expiry. B admission atomically revokes A and advances attempt/fence. Publication checks the current A binding and stores one immutable receipt identity; duplicate and lost-ACK outcomes are explicit. Load/verify bind B to committed A.
- `state/store.mjs`: one owned PostgreSQL connection/transaction per operation, bounded statement/lock/connect timeouts, no retry or in-memory fallback. Once COMMIT is dispatched, an unobserved acknowledgement is `CommitUncertain` and must be reconciled by an internal read.
- `state/README.md`: caller interfaces, authority boundaries, initialization and remaining gates. `pg@8.23.1` is pinned in a private package/lockfile. No public 0.1 contract was changed.

Codex found and repaired an undefined commit column constant, database time read before locks, stale denial that rejected the authentic old peer, missing publication peer binding, and missing SQL protection for policy/grant rebinding. These were not accepted on the worker's claims.

## Actual verification

- Installed PostgreSQL 16.15 in a task-owned cluster under ignored `.task-inputs/sdk-fixture-registry-1/pgdata`, bound to `127.0.0.1:55439`; created `meri_qualification_sdk_fixture_test1`, applied the migration once, and exercised the real database. This is local transaction evidence, not live qualification infrastructure. The cluster was stopped and its listener verified absent after the final run.
- Node 24.19.0, `node --test apps/control/qualification-sdk-fixture/state/test/*.test.mjs`: **5/5 PASS, exit 0**. Cases cover current A and B grants, exact authenticated stale denial, old-task commit refusal after replacement, same-identity duplicate, lost COMMIT acknowledgement/read reconciliation, readback/reference mismatch, policy mismatch, unchanged T0/D/C, expiry after a real row-lock wait, and SQL immutability guards.
- Node 24.19.0, canonical private contract/wire tests: **24/24 PASS, exit 0**.
- `registry.mjs` static check/import: **PASS, exit 0** after local offline installation of canonical validator dependencies. Initial import failed because this new worktree lacked `ajv`; this was setup, resolved with an offline dependency install. No network install.
- `git diff --check` of the staged candidate: **PASS, exit 0**. Exact committed SHA and final status are recorded in the Git commit and handoff after staging.

## Remaining gates and coordination

No live TLS ingress, authenticated ECS task credential evidence, actual object-store reread, native process/quiescence evidence, two-task Fargate interruption/resume, physically verified old-task revocation, or full product recovery has been exercised. The registry must be composed with those separately owned capabilities and the full image/source closure before G1 can pass. Deterministic conversation-state Promptfoo/DeepEval and integrated end-to-end checks remain for the composed candidate. No AWS build, push, merge or deployment occurred in this assignment. Active Cleanup1 work is on another remote server and has no verified boundary agreement; shared integration remains held.
