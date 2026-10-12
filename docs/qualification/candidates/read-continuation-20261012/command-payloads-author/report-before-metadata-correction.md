# Private command payload author — 12 October 2026

Base `cff71e1ba8ca8dea8970ad0c778b580a73f84815`. Exclusive two new private command families and focused tests/report/evidence only. No canonical loader/public contract/catalog/action vocabulary change.

## Outline before implementation

Reuse canonical public Command/ObjectReference/ApprovalProposal/execution/CommandReceipt/ArtifactVersion and canonicalSha256. Pure private modules consume injected private/public shape validators and the existing snapshotOperationData admission; do not duplicate approval, authorization, object storage or effect accounting.

Task-create normalizes title/client/due-date using explicit trusted binding/client-resolution context and checks exactly six projected source result fields. No unadvertised description or invented owner. Filing binds1–10 exact immutable object references and selected trusted destination/conversation. Per-object saved/pending/failed and indexing are separate from public aggregate command receipt. Root approved the aggregate-neutral API before implementation. No per-object result infers a public receipt outcome, persistence, current authority or retry permission.

Trusted context is server-owned but shape alone proves no current permission. Ordinary task rights, task.update/Temporal actions and memory producer integration remain external gates; the approved administrator memory exception is unchanged. Both families are unavailable source contracts, never handlers.

Read pinned Capiro projection/policy metadata at fd8765ec and compare observed4be13; no private bodies or implementation import/execution. Focused tests use test-only Ajv until root loader allocation. Preserve initial failure/control evidence and owned capture exit; no DB, provider, renderer, native or source access.


## Frozen API and deliberate admission

Factories accept `{validateShape,validatePublicShape,canonicalSha256}`. Task methods are `normalizeTaskCreateInput(raw,context)`, `assertTaskCreateCommand(command,context)`, `assertTaskCreateResult(result,command,context)`. Context is `{binding,clientResolution:null|{reference,clientId}}`; binding means original producer provenance, not recovered executor identity. Names require a trusted resolution assertion; UUID selectors must match it. Title trim then reject above240UTF16; client reference trim then reject above80UTF16. Missing/null client or date normalizes to null. Dates deliberately admit only canonical four-digit UTC midnight ISO or YYYY-MM-DD interpreted at UTC midnight for the stored @db.Date column, with finite roundtrip checking; no ambient timezone or broad Date.parse syntax. This narrows the source parser and avoids silent truncation. Raw strings have an explicit16384-character transport ceiling in addition to canonical snapshot limits.

Filing methods are `normalizeArtifactFileInput`, `assertArtifactFileCommand`, `assertArtifactFileResult`, `assertArtifactFileReceipt`, `assertArtifactFileVersion`. Context is `{binding,destination:{clientId,conversationId}}`; raw is `{clientId,conversationId,objects}`. Normalization yields `{arguments:{clientId,conversationId},attachments}`. One version per selected object identity is admitted; duplicate identities, including an alternate version of the same object, refuse rather than silently deduplicate. Per-file result `{commandSha256,files}` includes each exact object plus projected source observation fields. The optional public receipt helper correlates identity/hash/idempotency/scopes and stable tenant/actor/conversation/run; recovered attempt/worker/fence may differ. Optional ArtifactVersion checks its `object` against a selected reference, not equality between the two distinct versionId fields; generated origin is not required for chat attachments.

All bindings/resolution/destination fields are server-only structural context, not a new permission engine. Exact public proposal/execution semantics remain owned by the existing validators. Source methods and their database/provider effects are never invoked.


## Repairs and owner decisions

Root explicitly kept effective scope containment/computation with the canonical authorization owner: no scope-set inclusion or inferred destination grant is added. All scope tenant fields and receipt-command scope equality are checked; exact object scope values remain immutable in the command hash. This structural completeness does not authorize filing.

Initial author check41/42 failed because its public recovery execution fixture omitted contractVersion. That fixture-only correction is retained. Independent metadata review found pending-before-storage source observations and @db.Date due-date semantics; author controls reproduced42/44 before repair. A third direct-entry UUID-resolution consistency control reproduced42/45. Initial source/schema/tests and every raw failure are retained. Repairs allow reason-only pre-storage pending, require explicit date-only/UTC-midnight admission without noon truncation, and validate trusted UUID-reference consistency in the shared context path for all task entry points. Root approved the date restriction; actual DB timezone/write behavior remains unrun.
