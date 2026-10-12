# Selected read contracts after PR22

Authority: Neo's autonomous source continuation and the parent's request for
concrete capability closeout alongside the native RC1 owner. Base:
`4cdabab9ae3ef5f44e2a1eb10ae1a8a6622fa640`, accepted PR22. Worktree:
`/workspace/meri-capability-next-20261012`; branch:
`task/meri-capability-next-20261012`. Preserve RC1, PR22 and their evidence.

## Scope and implementation outline

The canonical inventory remains 139 originals, 96 selected, 43 deferred;
14 originals mapped to unavailable contracts and 82 unmapped. The additional
client-scoped action-item binding is partial and does not change those counts.
New mappings require complete coverage of the selected read boundary and
independent source acceptance. No mapping is runtime qualification.

Prioritize the frozen, explicit output projections for
`lookup_client_registry`, then the three selected business-development reads.
A named TypeScript DTO is useful but not mandatory: the existing source rules
also permit immutable producer projections and imported types. Do not invent
fields or infer runtime guarantees from those projections. The first discovery
pass was too restrictive in treating missing DTO declarations as blockers;
the report must distinguish corrected findings from remaining interface gaps.

Canonical boundaries remain the private 0.2 schema loader, operation binding
registry, resolver and catalog. Each domain owns its own schema and validator
factory. The resolver owns inert JSON admission, canonical argument hashing and
immutable snapshots; the gateway owns authorization and execution. New modules
must not load a source, construct an adapter or decide current grants. Reuse
pinned Ajv and existing test/capture conventions; no dependency or public 0.1
change, migration, new framework, or copied Capiro implementation.

- Root authors `client-registry.schema.json`,
  `client-registry-validation.mjs`, and its new contract test. The frozen lookup
  returns a tenant-client projection, an exact LDA projection, up to five nearby
  projections and compatibility guidance. Guidance is inert reported text;
  it grants no creation/update authority and cannot establish absence.
- Memory author owns new `business-development.schema.json`,
  `business-development-validation.mjs`, its new contract test, and its author
  report/evidence only, in a separately allocated worktree. Its three operations
  remain distinct. Preserve source qualifiers, permissions and provider-call
  caveats; a legacy description is not proof that a producer cannot call SAM.
- Root exclusively owns `validate.mjs`, `catalog-validation.mjs`, `catalog.json`,
  required operation-count assertions and integration tests/docs. Authors may
  use a test-only Ajv harness before loader integration. No second production
  compiler, registry or authorization implementation.
- Gateway reviewer independently reviews registry source; memory reviewer
  independently reviews business-development source. A third reviewer reviews
  the combined candidate. Reviewers own new tests/evidence/reports only and
  return ACCEPT_SOURCE or HOLD at exact commits; authors repair defects.

Source references are immutable Capiro
`fd8765ec01d292013758606204f2c9d886cd31c1`. Compare relevant blob IDs to observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace` only to disclose drift. Record paths,
blob IDs and derived boundary findings; never publish private bodies. No Capiro
imports, execution, queries, source copies or edits. Record additional inspected
types/policies in each source report.

## Verification and limits

Exercise actual canonical normalization/output dispatch, exact schema hashes,
default/boundary behavior, null versus omitted fields, variant discrimination,
unsupported arguments/fields, candidate identity, mutation/getter resistance and
source truth limits. Preserve original tests and every failed check. Verify
all original IDs/dispositions/boundaries, prior descriptors, public exports,
disabled connectivity, null handlers and unavailable qualification. Run relevant
local source tests and public distribution check after integration. Capture
checks with the existing Linux subreaper and verify owned process exit.

Initial author/reviewer turn allocations are 45 minutes each; report blockers
promptly and do not recursively delegate or start background jobs. Root may
renew an allocation. Every author/reviewer uses an isolated pinned worktree.
Evidence lanes live below
`docs/qualification/candidates/capability-next-20261012/`; reports use distinct
`CODEX-CAPABILITY-NEXT-*` names. Publish a new draft continuation PR after review.

Reserve `apps/proxy/**`, `scripts/qualification/**`, worker/runtime/infra and
all frontend paths for their owners. Do not duplicate the native owner's
approved 33-case RC1 fixture sequence. No paid models, source/customer access,
cloud/image/resource/credential action, security/network/database change,
deployment or main merge. G1 stays OPEN and G2–G7 unentered. Memory approval
semantics remain unresolved. Source connectivity stays disabled.
