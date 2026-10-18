# Prepared approval facts for Core (registered source, 18 October 2026)

**Status:** Source-only allocated migration, based on Meri PR157 `ab83ee97e9cb88b4727291284da9e2485157c309`. The parent reserved `read-delegation/migrations/0002_prepared_approval_facts.sql` in the read-delegation family, and its reviewed bytes are pinned in the `first-chat-migrate.mjs` integration PLAN after 0001 and before grants. It is **not applied**. No live SQL, grant, or deployment action is authorized by this file. The Meri receiving owner must qualify the apply and restricted-role readback before Core can use it.

## Ownership and shape

Meri owns `meri_commands.approval_metadata` and the existing `meri_read_delegation_facts.run_facts_v1` view through `meri_product_migrator`. Core's restricted runtime role already has SELECT on that view and has no direct metadata-table privilege. The source proposal appends two columns to the view, preserving its existing columns, one row per run, and the original admission predicate unchanged:

- `prepared_approvals`: ordered JSON array of at most 64 entries. Each entry contains independent relational `proposal_id`, `command_id`, `idempotency_key`, `command_sha256` and a narrow `record` with exactly the original `proposalId`, `commandId`, `idempotencyKey`, `createdAt`, `expiresAt`, `requiredApprover`, `binding`, `scopes` fields.
- `prepared_approvals_overflow`: true when a 65th matching row exists. Core must refuse the entire projection on overflow; it must never treat the truncated array as proof of absence.

Rows are correlated by relational tenant and actor, plus the stored original binding's conversation and run against the run's relational IDs. The current run binding supplies the actor ID, but the projected record retains its original attempt, worker and fence. Core compares the full original binding to the requested proposal and independently compares relational entry fields to the record and proposal. Tenant/actor values inside the stored binding are deliberately not used as additional SQL filters: a mismatch remains visible to Core's verifier and is refused there. No command arguments, attachments, request or full owner payload are projected. The owner payload SHA is not exposed because Core cannot verify it from the narrow projection; source integrity rests on Meri's table ownership and append-only runtime privileges plus Core's independent correlation checks.

The migration uses a correlated 65-row candidate scan and a scoped expression index; it retains `CREATE OR REPLACE VIEW` security barrier and existing view grants. It does not edit `current_admission_v1`, whose transaction lock and original ADMITTED grant set remain the authority for issuance. It does not add a raw table grant or a new role/function.

## Implementation handoff

1. Meri receiving owner: source allocation and integration-stage PLAN pin are prepared. Preserve existing migration bytes and the four-view privilege allowlist. Review index lock time and plan phase before any apply, then independently read back the exact migration SHA and resulting view.
2. Core owner: consume only `run_facts_v1` with bound tenant, actor, conversation, run and proposal; require one run row, valid exact shape, no overflow, one matching proposal, original binding and metadata agreement. Use the same verifier in the proposal-locked issuance transaction. Missing projection or permission is unavailable, never an absent approval.
3. Deployment owner: read back the applied migration SHA, view definition and capiro_app view-only permission under the actual runtime role, then run authenticated record, decision, revoke and issuance checks. The source proposal alone enables none of these.

## Focused evidence and remaining gates

The committed source test compares the pre-existing view columns and admission SQL byte-for-byte against `0001`, checks the bounded narrow projection shape, and checks the integration PLAN position and content SHA. A separate local PGlite execution of this exact SQL checked zero, one, two, 64 and 65 matching proposals, one row per run, tenant/actor/conversation/run exclusions, original binding retention, exact entry/record keys, overflow and inherited view-only SELECT without raw table access.

An independent disposable **localhost PostgreSQL 16.15** control applied approval-metadata 0001, read-delegation 0001 and allocated 0002 in order. It passed original 16-expression/admission-lateral equivalence, security-barrier/18-column view, ADMITTED continuity and revoked-grant refusal, 0/1/2/64/65 ordered proposal and overflow cases, identity exclusion, original binding, the composite index, and view-only runtime-role SELECT with raw-table SELECT denied. This was local qualification only. The live Meri apply, actual runtime role/RLS and query timing, active proposal lifecycle, migration readback and Core deployment remain unverified.
