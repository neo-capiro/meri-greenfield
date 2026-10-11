# REL-02 `search_capiro_data` private contract — bounded H4 allocation

Owner Codex; implementer Hermes H4. Base `f118ff55dfb96ba4b44099953e6c9724064b723d`, branch `task/remote-rel02-data-search-20261011`, worktree `C:/dev/meri-greenfield-rel02-data-search-20261011`. One session, at most 35 turns / 35 minutes. Shared policy `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`; read current `C:/dev/capiro-agent-ops/BOOTSTRAP.md`, `AGENTS.md`, `hermes/OPERATING.md`, machine map, repository `AGENTS.md`, implementation standards, `docs/coordination/reports/CODEX-G1-REL02-FOUR-GAP-METADATA-REMOTE.md`, existing retrieval-0.2 contracts and catalog before work. Record actual policy SHA and HEAD.

## Owned source and canonical facts

Own only new `packages/contracts/retrieval-0.2/data-search.schema.json`, `data-search-validation.mjs`, `packages/contracts/test/retrieval-data-search.test.mjs`, this task brief and `docs/coordination/reports/CODEX-G1-REL02-DATA-SEARCH-20261011.md`. Do not edit `retrieval-0.2/catalog.json`, `validate.mjs`, `common.schema.json`, public 0.1 exports/schema, existing family files, package/lockfiles or any other worktree. H2 concurrently owns only new SDK ingress paths. Record a short outline here before substantial code.

Implement a private source-only **typed input and output contract candidate** for canonical selected intent `search_capiro_data`. Read only frozen Git blobs from `neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1`, never its dirty working tree. Start with `apps/api/src/meri/meri-data-search.helpers.ts`, `apps/api/src/retrieval/retrieval-v2.types.ts`, and `apps/api/src/meri/meri-context-plane.service.ts`; inspect only other frozen files needed to close the exact result shape. Record each frozen path/blob/raw SHA and line evidence. No current Capiro implementation imports/copies, handler code, gateway, source connection or runtime parity claim.

The input must preserve the 18-domain vocabulary but allow only the seven tool-selectable query classes from the frozen helper. Keep per-domain opaque cursors scoped to requested domains, bounded page/window selectors, and conditional `memoryItemId` rules. `clientId` is a selector, not authority. Distinguish advertised grammar from legacy coercions/defaults and deliberately document any stricter new boundary behavior. The output must represent the actual `RetrievalResponse` records/coverage/evidence envelope from the frozen types and `searchToolData` path without inventing per-domain record fields, cursor contents, source freshness or authorization. Reuse existing common retrieval definitions and AJV dependencies where their semantics match; avoid a second catalog or generic tool framework. If exact output fields are not provable from the frozen sources, report the gap rather than accepting arbitrary output and claiming closure.

Run meaningful positive and adversarial synthetic contract tests, exact domain/query-class/default/conditional/cursor/coverage assertions, import/no-side-effect check, `git diff --check`, changed-path review and relevant existing retrieval suite on pinned Node 24. Keep skipped/failing/unrun checks visible. Use offline dependencies only. Return commit SHA, source report and limitations. This is unregistered source, not a public export, authorization, runtime adapter or G1 acceptance.

No AWS, Docker, provider/customer data, live Capiro source, cloud/resource mutation, GitHub push/PR, merge, deployment, remote install, recursive delegation or background scheduler. End the bounded session; Codex independently reviews all work and verifies physical exit.

## Implementation outline (recorded by H4 before substantial code)

**Owned paths (only these are written):** `packages/contracts/retrieval-0.2/data-search.schema.json`,
`packages/contracts/retrieval-0.2/data-search-validation.mjs`,
`packages/contracts/test/retrieval-data-search.test.mjs`, this brief, and
`docs/coordination/reports/CODEX-G1-REL02-DATA-SEARCH-20261011.md`.

**Frozen inputs (Git objects only, `neo-capiro/capirov2@fd8765ec…`):** `meri-data-search.helpers.ts`
(input grammar + tool envelope), `retrieval-v2.types.ts` (domain/query vocabulary and
`RetrievalResponse`/`CoverageManifest`/`RetrievalObservability`), `meri-context-plane.service.ts`
(`searchToolData` return path), `meri-tools.service.ts` (advertised tool schema, for the
advertised-vs-parser distinction), `knowledge.types.ts` (`KnowledgeJsonObject`/`KnowledgeRef`).
Blob IDs, byte counts and SHA256 are recorded in the report before any fact is used.

**Design.** One private `$id` (`urn:meri:retrieval:data-search:0.2.0`) with private `$defs` for the
18-domain vocabulary, the 7 tool-selectable query classes, the 10-class retrieval vocabulary used by
`observability.queryClass`, and the frozen `RetrievalRecord` / `RetrievalSourceCoverage` /
`CoverageManifest` / `RetrievalObservability` result shapes. A standalone validator module (the
`federal-market-validation.mjs` pattern) loads only its own schema plus the existing AJV dependency;
it is deliberately **not** wired into `validate.mjs` or `catalog.json`, so nothing is registered.

**Reuse decision.** No existing shared definition matches the frozen result semantics: 0.1.0
`ObjectReference`/`SourceEvidence`/`Coverage` and 0.2.0 `retrieval.schema.json#Coverage` /
`EvidenceRecord` all carry different fields and meanings from `KnowledgeRef` / `RetrievalRecord` /
`CoverageManifest`. Reusing them would silently restate the wrong contract, so the candidate defines
its own private defs and reuses only the AJV dependency and the repository's existing
schema-loading/validation pattern. This is recorded as a finding, not as silent divergence.

**Deliberate stricter boundary.** The frozen parser ignores unknown input keys and the advertised
tool schema leaves the outer object open; the candidate refuses unknown keys. The frozen `Date`
typed result fields are modelled as JSON date-time strings (the frozen type does not state a wire
encoding). Both are documented, and no per-domain record payload fields, cursor contents, freshness
or authorization guarantees are invented.

**Gap disclosure in code.** A exported `RESULT_UNPROVEN_RELATIONS` list names the result relations
deliberately *not* asserted (for example `coverage.recordsReturned === records.length`) because the
frozen read set contains the result *types* but not the retrieval producer that builds them.

**Verification.** Positive and adversarial synthetic tests with exact domain / query-class /
default / conditional / cursor / coverage assertions, an import no-side-effect child check,
`git diff --check`, changed-path review, and the existing retrieval suite, all on pinned Node
`24.19.0` with offline dependencies borrowed read-only through an ignored junction.

## Codex completion after H4 turn cap

H4 exited without a commit, report or test run. Codex independently read the
frozen Git objects and repository standards, corrected three erroneous test
expectations/probe mechanics found on the first 10/13 run, then obtained 13/13
focused and 104/104 existing retrieval passes. The source remains a local,
unregistered private candidate. Exact evidence, gaps and decision are in
`docs/coordination/reports/CODEX-G1-REL02-DATA-SEARCH-20261011.md`.
