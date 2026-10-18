# Prepared approval facts for Core (source proposal, 18 October 2026)

**Status:** Proposal only, based on Meri PR157 `ab83ee97e9cb88b4727291284da9e2485157c309`. The SQL lives under `read-delegation/proposals/`, is absent from `first-chat-migrate.mjs` `PLAN`, and has no allocated migration identifier. No live SQL, grant, or deployment action is authorized by this file. The Meri migration owner must reserve the identifier, move and pin the exact reviewed SQL into `migrations/`, and qualify the apply before Core can use it.

## Ownership and shape

Meri owns `meri_commands.approval_metadata` and the existing `meri_read_delegation_facts.run_facts_v1` view through `meri_product_migrator`. Core's restricted runtime role already has SELECT on that view and has no direct metadata-table privilege. The source proposal appends two columns to the view, preserving its existing columns, one row per run, and the original admission predicate unchanged:

- `prepared_approvals`: ordered JSON array of at most 64 entries. Each entry contains independent relational `proposal_id`, `command_id`, `idempotency_key`, `command_sha256` and a narrow `record` with exactly the original `proposalId`, `commandId`, `idempotencyKey`, `createdAt`, `expiresAt`, `requiredApprover`, `binding`, `scopes` fields.
- `prepared_approvals_overflow`: true when a 65th matching row exists. Core must refuse the entire projection on overflow; it must never treat the truncated array as proof of absence.

Rows are correlated by relational tenant and actor, plus the stored original binding's conversation and run against the run's relational IDs. The current run binding supplies the actor ID, but the projected record retains its original attempt, worker and fence. Core compares the full original binding to the requested proposal and independently compares relational entry fields to the record and proposal. Tenant/actor values inside the stored binding are deliberately not used as additional SQL filters: a mismatch remains visible to Core's verifier and is refused there. No command arguments, attachments, request or full owner payload are projected. The owner payload SHA is not exposed because Core cannot verify it from the narrow projection; source integrity rests on Meri's table ownership and append-only runtime privileges plus Core's independent correlation checks.

The proposal uses a correlated 65-row candidate scan and a scoped expression index; it retains `CREATE OR REPLACE VIEW` security barrier and existing view grants. It does not edit `current_admission_v1`, whose transaction lock and original ADMITTED grant set remain the authority for issuance. It does not add a raw table grant or a new role/function.

## Implementation handoff

1. Meri receiving owner: review the proposal and allocate an additive integration-stage migration after `0001_read_delegation_facts.sql` and before `phase:integration_grants`. Pin its SHA in `first-chat-migrate.mjs` only after allocation. Preserve existing migration bytes and the four-view privilege allowlist. Review index lock time and plan phase before applying.
2. Core owner: consume only `run_facts_v1` with bound tenant, actor, conversation, run and proposal; require one run row, valid exact shape, no overflow, one matching proposal, original binding and metadata agreement. Use the same verifier in the proposal-locked issuance transaction. Missing projection or permission is unavailable, never an absent approval.
3. Deployment owner: read back the applied migration SHA, view definition and capiro_app view-only permission under the actual runtime role, then run authenticated record, decision, revoke and issuance checks. The source proposal alone enables none of these.

## Focused evidence and remaining gates

The committed source test compares the pre-existing view columns and admission SQL byte-for-byte against `0001`, and checks the bounded, narrow projection shape (2/2). A separate local PGlite execution of this exact SQL checked zero, one, two, 64 and 65 matching proposals, one row per run, tenant/actor/conversation/run exclusions, original binding retention, exact entry/record keys, overflow and inherited view-only SELECT without raw table access. It was an in-memory simulation, not a live PostgreSQL role or migration readback. The Meri allocation/install, real role/RLS behavior, index timing, active proposal lifecycle and Core deployment remain unverified.
