# REL-02 federal-market canonical composition

Owner: Codex worker `trusted_runtime_composition_plan`; parent Codex owns
independent review and integration. Exact base:
`32709fd72b895cdd27ebeac0ac617ed21cd6721a`. Dedicated branch:
`task/rel02-federal-composition-20261011`; worktree:
`/workspace/scratch/853fba62b1f1/meri-g1-federal-composition`.
Started 11 October 2026 at 21:38 UTC; bounded source turn deadline 22:30 UTC.

## Allocation and coordination

Write only:

- `packages/contracts/retrieval-0.2/validate.mjs`.
- `packages/contracts/retrieval-0.2/federal-market-validation.mjs`.
- `packages/contracts/test/retrieval-federal-market.test.mjs`.
- This task and
  `docs/coordination/reports/CODEX-G1-REL02-FEDERAL-COMPOSITION-20261011.md`.

The parent allocated these paths. Current agent inventory has no other active
retrieval writer; prior mail, federal-input and canonical meeting/operational
claims are historical completed work. Git worktree/HEAD/status discovery
confirmed the exact clean base before creating this new worktree. No shared
signature for another family may change. Preserve other worktrees and authors.

## Implementation outline

The existing private `retrieval-0.2/validate.mjs` owns schema loading, one Ajv
instance and definition lookup. Register the existing federal schema there
and compose an injected federal factory, using the already accepted mail,
meeting and operational composition pattern.

The cohesive federal module retains ownership of closed operation IDs,
operation-specific input definitions/defaults/normalization, client-scope
nonauthority and narrow output paging consistency. It receives the canonical
`validateShape` collaborator and the already-loaded federal schema. It no
longer reads/compiles a second Ajv instance. The dependency points from the
canonical owner to this factory, never back from the factory to the owner.
Expose the existing five federal names and operation-ID constant through the
private canonical owner; the factory module's private direct-call interface
intentionally becomes a factory. Its only observed caller was this test file.

Keep federal schema bytes, catalog, public 0.1.0 distribution, source pins,
image/build authority and unrelated families unchanged. No new operation,
handler, authorization, source connection, availability or product loop is
created. No production/network/cloud/native/Docker action is authorized by
this allocation; no recursive worker or background job is permitted.

## Verification and completion

Preserve 17 existing domain test bodies byte-for-byte. Narrowly adapt the
18th pure-import test's module/import/export expectations to the factory and
canonical composition, retaining its behavioral network, created-file and
stray-output assertions. Add real canonical-definition and paging-boundary
cases, including family-specific refusal of unrelated definitions.

Run focused federal tests, root checks and public generated-byte, TypeScript
and package tests. Verify definition uniqueness, immutable schema/catalog/
public bytes and the 17 preserved bodies. Keep raw finite captures under
ignored `.task-inputs/rel02-federal-composition-20261011/`; report failures
and rerun reasons. No assertions/gates may be weakened. Return a reviewable
commit with the source-only limitations; parent independently verifies it.

REL-02 and G1 stay OPEN. Live source serialization, eligibility, authorization,
coverage/freshness/pagination and connected retrieval remain separate work.
The latest resume handover does not require 75 existing user requests for G1;
the later real-request baseline requirement remains.
