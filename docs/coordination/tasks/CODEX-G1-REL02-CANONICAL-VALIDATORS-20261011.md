# REL-02 canonical validator integration

Base: `8d045221aa314871edf214deb2c9f1800fde6b17`.
Branch: `task/codex-g1-rel02-validators-20261011`.
The human authorized independent continuation. This is source-only work;
no AWS, provider, source connection, customer SQL, shared Capiro change,
merge, deployment or gate acceptance belongs to this allocation.

## Outline and ownership

Integrate previously accepted inert meeting and operational-read schemas
through the existing private `retrieval-0.2/validate.mjs` owner. Reuse its
Ajv shape validator and subject, window, source-inventory and uniqueness
collaborators. Do not build another registry or validation framework.

One bounded Codex writer owns only:

- `packages/contracts/retrieval-0.2/validate.mjs`.
- `packages/contracts/test/retrieval-meeting-source.test.mjs`.
- `packages/contracts/test/retrieval-operational-reads.test.mjs`.

Codex owns this outline, the completion report, commits and independent
verification. The four existing meeting/operational schema and validation
factory files are read-only. Preserve their exact bytes and meaningful
domain differences. Preserve factory dependency-injection negative tests.

## Behavior and checks

Register the existing definitions and export the factories' private named
assertions. Replace duplicate test collaborators with canonical imports;
preserve existing fixtures and assertions unless a malformed synthetic
fixture violates the already canonical contract. Document any such repair.
Add meaningful cases for canonical single-subject cardinality, timezone
and calendar windows, and source observation timestamps.

Public 0.1.0 distribution, catalog counts/mappings, availability, pending
status, null handlers, disabled sources and `evidenceReady:false` remain
unchanged. No operation becomes callable. Unscoped action-item mode
remains pending; do not create false absence assertions or live contracts.

Run the two focused suites, `npm run check`, public distribution checks,
and diff checks. Keep failures and rerun reasons visible. The parent
independently reviews the exact commit before source acceptance. Work is
bounded to this task and a 20-minute implementation window; no recursive
delegation or background jobs. If a change beyond these paths is needed,
propose it before editing. G1 runtime remains OPEN.

## Concurrent work

The latest handoff differs from a5dc95c only in its handover document.
The native-evidence worktree changes the separate qualification-sdk
validator, not this retrieval validator. There is no observed path overlap.
All frontend code belongs in `neo-capiro/capiro-frontend`; this task creates
no frontend code. Portfolio and Modules existing backends remain in
`neo-capiro/capirov2`.
