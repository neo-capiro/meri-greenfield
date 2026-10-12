# Private command payload author — 12 October 2026

Base `cff71e1ba8ca8dea8970ad0c778b580a73f84815`. Exclusive two new private command families and focused tests/report/evidence only. No canonical loader/public contract/catalog/action vocabulary change.

## Outline before implementation

Reuse canonical public Command/ObjectReference/ApprovalProposal/execution/CommandReceipt/ArtifactVersion and canonicalSha256. Pure private modules consume injected private/public shape validators and the existing snapshotOperationData admission; do not duplicate approval, authorization, object storage or effect accounting.

Task-create normalizes title/client/due-date using explicit trusted binding/client-resolution context and checks exactly six projected source result fields. No unadvertised description or invented owner. Filing binds1–10 exact immutable object references and selected trusted destination/conversation. Per-object saved/pending/failed and indexing are separate from public aggregate command receipt. Root approved the aggregate-neutral API before implementation. No per-object result infers a public receipt outcome, persistence, current authority or retry permission.

Trusted context is server-owned but shape alone proves no current permission. Ordinary task rights, task.update/Temporal actions and memory producer integration remain external gates; the approved administrator memory exception is unchanged. Both families are unavailable source contracts, never handlers.

Read pinned Capiro projection/policy metadata at fd8765ec and compare observed4be13; no private bodies or implementation import/execution. Focused tests use test-only Ajv until root loader allocation. Preserve initial failure/control evidence and owned capture exit; no DB, provider, renderer, native or source access.


## Frozen API and deliberate admission

Factories accept `{validateShape,validatePublicShape,canonicalSha256}`. Task methods are `normalizeTaskCreateInput(raw,context)`, `assertTaskCreateCommand(command,context)`, `assertTaskCreateResult(result,command,context)`. Context is `{binding,clientResolution:null|{reference,clientId}}`; binding means original producer provenance, not recovered executor identity. Names require a trusted resolution assertion; UUID selectors must match it. Title trim then reject above240UTF16; client reference trim then reject above80UTF16. Missing/null/trimmed-blank client or date normalizes to null; nonblank dates trim before admission. Blank client requires null trusted resolution. Dates deliberately admit only canonical four-digit UTC midnight ISO or YYYY-MM-DD interpreted at UTC midnight for the stored @db.Date column, with finite roundtrip checking; no ambient timezone or broad Date.parse syntax. This narrows the source parser and avoids silent truncation. Raw strings have an explicit16384-character transport ceiling in addition to canonical snapshot limits.

Filing methods are `normalizeArtifactFileInput`, `assertArtifactFileCommand`, `assertArtifactFileResult`, `assertArtifactFileReceipt`, `assertArtifactFileVersion`. Context is `{binding,destination:{clientId,conversationId}}`; raw is `{clientId,conversationId,objects}`. Normalization yields `{arguments:{clientId,conversationId},attachments}`. One version per selected object identity is admitted; duplicate identities, including an alternate version of the same object, refuse rather than silently deduplicate. Per-file result `{commandSha256,files}` includes each exact object plus projected source observation fields. The optional public receipt helper correlates identity/hash/idempotency/scopes and stable tenant/actor/conversation/run; recovered attempt/worker/fence may differ. Optional ArtifactVersion checks its `object` against a selected reference, not equality between the two distinct versionId fields; generated origin is not required for chat attachments.

All bindings/resolution/destination fields are server-only structural context, not a new permission engine. Exact public proposal/execution semantics remain owned by the existing validators. Source methods and their database/provider effects are never invoked.


## Repairs and owner decisions

Root explicitly kept effective scope containment/computation with the canonical authorization owner: no scope-set inclusion or inferred destination grant is added. All scope tenant fields and receipt-command scope equality are checked; exact object scope values remain immutable in the command hash. This structural completeness does not authorize filing.

Initial author check41/42 failed because its public recovery execution fixture omitted contractVersion. That fixture-only correction is retained. The42/44 source countercontrol run combined a real @db.Date admission defect with an incorrect expectation that missing bytes produce pre-storage pending; the42/45 run additionally exposed direct-entry UUID resolution inconsistency. Both initial source and all original tests/raw failures remain preserved. The first repair therefore included an incorrect pending branch, which the later pin audit exposed and the final source removes. No earlier pass certifies that superseded projection.

The metadata audit initially passed43/45: one failure was a checker requiring adjacent DateTime/@db.Date despite an intervening @map annotation; the other exposed the actual source misunderstanding. Fresh exact-Git tracing and independent review agree: missing attachment is failed with null filename; found attachment lacking bytes/media type is failed with its stored string filename; pending comes from persisted quarantine. The earlier "checker-only" explanation is superseded. The original audit, checker, misleading report/test preimages, and49/50 negative replay at8c1f4a5 are retained. Final pending observations again require the complete persisted tuple. No private producer body is published.

Independent compatibility controls also exposed blank optional strings, whitespace around dates, null found filenames and empty caught Error.message. Author controls reproduced45/49 at0565003 before the8c1f4a5 repair. Found saved/pending and persisted-failed observations require a string filename, including the valid empty string; missing-row failed may have null. Failed reason must be present but may be empty. Source results cannot imply aggregate success or current authority.

## Exact source and checks

Final source commit `bdbb14603cfab0d52d483956f7f1a7e373abb3cb`, after preserved `0565003a32a7311658a86cfc7689036b6b450f57` and `8c1f4a5f4287b282f478f3e18aeb376573e53ddd`. Six allocated new source/test files only. Public0.1, canonical loaders, catalog, locks, runtime and all6947 base Git entries are unchanged.

At the exact final source, `final-source` passes50/50 focused tests and `source-audit-repaired` passes45/45 source/pin checks. The six pinned reference pairs are unchanged from fd8765ec01d292013758606204f2c9d886cd31c1 to observed4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace. Every capture retains command, source identity, raw stdout/stderr, hashes, exit and owned process-group cleanup. All12 captured check groups exited and are absent; no timeout or group kill was required. These are local source tests and static metadata audits, not native or service qualification.

## Remaining gates

Root owns canonical private loader/integration and independent review acceptance. No production command handler, trusted context producer, ordinary task authorizer, object fetch/write/index adapter, durable idempotency/reconciliation path or aggregate receipt policy is connected by this work. Current tenant/client/wall rights, effective scope containment, execution-time expiry/revocation and recovery ownership remain canonical owner obligations. Filing result identity/digest correlation does not establish actual persistence, indexing completeness, source truth or delivery. Proposal review and execution remain public0.1 responsibilities; administrator memory self-review policy is unchanged.

Actual SQL date behavior, storage effects, attachment lookup, native rendering/sandbox, providers, cloud, task creation and filing are UNRUN. There is no new action vocabulary, task.update/Temporal decision, source enablement or runtime acceptance.
