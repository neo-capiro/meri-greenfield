# REL-02 federal-market canonical composition — worker handoff

11 October 2026 UTC. **SOURCE ONLY, ready for parent independent review.
REL-02 and G1 remain OPEN; image/build/runtime authority is unchanged.**
Base `32709fd72b895cdd27ebeac0ac617ed21cd6721a`; branch
`task/rel02-federal-composition-20261011`; dedicated worktree
`/workspace/scratch/853fba62b1f1/meri-g1-federal-composition`.
The [allocated outline](../tasks/CODEX-G1-REL02-FEDERAL-COMPOSITION-20261011.md)
records ownership, coordination, boundaries and the bounded deadline.

## Canonical owners and intentional interface change

The accepted federal candidate used its own Ajv instance and schema read.
The existing private `retrieval-0.2/validate.mjs` now loads the unchanged federal
schema alongside its seven existing groups, compiles it through its existing
Ajv instance, and composes `createFederalMarketValidators({ validateShape,
schema })`. No other family collaborator signature changed.

The cohesive federal module retains its closed operation IDs and per-operation
input definitions/defaults/normalization, inert-input guard, nonauthoritative
client scope and exact paging consistency. Its schema-derived definition set
keeps the family wrapper closed even when the canonical structural owner knows
unrelated definitions. Output paging rules still run after structural checks;
the generic structural validator intentionally does not apply domain rules.
No copied validator, new registry, authorization system or orchestration loop
was introduced. The federal module remains 144 lines; the canonical composition
is 236 lines.

The private family module intentionally changes from standalone named callable
exports to a factory plus its existing operation-ID constant. Its only observed
caller was the federal test file, which now uses the canonical composition.
The five previous federal names remain available through the private canonical
owner: `federalMarketSchemaId`, `FEDERAL_MARKET_OPERATION_IDS`,
`federalMarketInputDefinition`, `validateFederalMarketShape` and
`normalizeFederalMarketInput`. No public package export changed.

## Preserved behavior and availability

All 17 existing domain test bodies are byte-identical. The 18th pure-import
test changes only module/import/export expectations and exercises the canonical
composition in its fresh child. Its no-network, no-created-file, bounded-child
and no-stray-output assertions remain. The two added cases verify actual
canonical federal definition resolution, unrelated/unknown family refusal,
and structurally valid but domain-inconsistent page-10000 continuation refusal.

All other tracked source bytes remain unchanged, including the federal schema,
catalog, other family modules, public 0.1.0 distribution, package metadata,
source pins and image/build authority. A separate preservation diagnostic
confirmed eight representative immutable files and 117 unique definition names
across the eight schema groups. Catalog counts remain 139 originals, 96 selected
and 43 deferred. All five federal originals remain `pending` with null
replacements. No handler, live source, catalog entry or availability was added.
Historical comments/reports describing these candidates as uncomposed are
superseded only for this private validator seam; their runtime limitations stand.

## Actual local checks and retained failures

Node 24.19.0 with the already-restored locked dependencies. No network package
installation, lifecycle script or external call was needed.

| Check | Result |
| --- | --- |
| Original federal suite before edits | 18/18 passed |
| Composed federal suite before new cases | 18/18 passed |
| Final focused federal suite | 20/20 passed |
| Final root checks | 184/184 passed |
| Public generated-byte check and TypeScript | PASS |
| Public package tests | 7/7 passed |
| Existing domain-body preservation | 17 byte-identical; one documented import-test adaptation |
| Immutable bytes and schema uniqueness | PASS; eight groups, 117 unique definitions |
| Diff whitespace and allocated source paths | PASS |

The first broader checks failed: root 182/184 with generated `browser.mjs`
drift and the data-search permission-restricted child refusing an external
dependency path; the public distribution command stopped at generated drift.
These followed temporary dependency symlinks pointing into the parent's
worktree. Replacing only this worker's ignored symlinks with physical copies
of the same restored dependencies resolved both failures. No production,
generated output or assertion was changed between those failures and the
successful reruns. The first failures remain retained, not replaced by passes.

Seven finite stdout/stderr pairs, baseline and final preservation records,
source hashes and the command/exit-code manifest are under ignored
`.task-inputs/rel02-federal-composition-20261011/`; manifest
`source-checks.json`. The parent must preserve these with its review handoff.
Suites overlap; counts are not independent integration scenarios. All local
commands and their bounded test children returned; no listener, worker session
or background job was started by this allocation.

## Remaining work

No live federal producer serialization, current actor/tenant/client grant,
source eligibility/access, coverage/freshness, cursor authenticity or measured
retrieval was exercised. Input-length compatibility and exact emitted-row
qualification remain unresolved. The previous declared-type result review and
its explicit limitations still apply. This change does not complete REL-02.

No AWS/Docker/native SDK/provider request, source connection, image repin,
frontend change or remote Git mutation occurred. Existing image findings and
all G1 runtime holds remain. The latest resume handover does not require 75
existing user requests as a G1 input; later real-request baseline work remains.
Parent Codex independently reviews the exact returned commit before acceptance.
