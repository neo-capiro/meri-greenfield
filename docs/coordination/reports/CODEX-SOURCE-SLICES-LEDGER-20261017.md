# Source-slice ledger accounting - 17 October 2026

Base: `08f65a79b99e5b269a8c7f7e82b6b8de225caae8` (PR105 source tree). Owned work is limited to the curated adapter inventory, source-exposure reconciliation/tests, source-exposure Markdown renderer, refreshed JSON/Markdown ledger, and this report. No backend, shared contract, SDK policy, source adapter, credential, startup or deployment change is allocated here.

Implementation outline: add eight curated family rows for ten implemented operation paths; mark the eight restricted operations explicitly as partial. Reconciliation will distinguish complete, partial-input and absent adapters, validate partial declarations and exact SDK operation subsets, and refuse partial SDK exposure. Loading must use only SDK-selected operations for an unlisted composition and must never augment an existing curated adapter with undeclared siblings. Preserve the historical eight ledger fields and all 43 exclusions. Render separate complete and partial accounting, then run only targeted exposure refresh and focused offline checks. An independent source reviewer owns acceptance; local fixtures do not establish live availability.

Final source accounting: 82 selected source reads = 56 complete + 8 partial-input + 18 absent; 26 still lack complete adapters across 15 families. All 56 complete reads are SDK-exposed; eight partial reads are unexposed. SDK registry: 58 operations across 35 families; gateway family constructors: 40. Live remains zero. The coordinator added exact-news/explicit-year-personnel and explicit-client outreach campaign-list slices while this accounting work was in progress. Candidate search remains absent.

## Accounting changes

The curated [adapter inventory](../../../scripts/general-reads/adapters.json) records exact operations and a `partialOperations` subset. It measures the actual handler, finite native-operation declaration and applicable context/composition modules. The finite source declaration is included because native route tables use object keys, while inventory evidence requires literal operation IDs in a declared source file.

[Source reconciliation](../../../scripts/scope-ledger/source-exposure.mjs) validates nonempty unique operation lists and partial flags belonging to their adapter. A partial row becomes `adapter-partial`, retains its source evidence, stays in the missing-complete inventory, and cannot enter SDK registration. Added counts distinguish `completeSourceAdapters`, `partialSourceAdapters`, `absentSourceAdapters` and `partialSourceAdaptersWithoutGeneralExposure`. Existing `missingSourceAdapters` explicitly means lacking complete coverage, including partial rows. `partialAdapterFamilies` supplies the separate renderer table.

SDK registration now honors each family's explicit `operationIds`; unknown, foreign, duplicate, nonstring, empty or malformed lists refuse. Loader augmentation uses the selected subset and does not add undeclared siblings to a curated source adapter. Economic and graph therefore cannot manufacture grants, awards or semantic-search coverage merely by sharing a family. Runtime SDK policy and family construction are coordinator-owned; this lane changes only their offline accounting.

The [Markdown renderer](../../../scripts/scope-ledger/markdown.mjs) says "complete adapter", shows the complete/partial/absent equation, lists withheld partial operations separately, and includes them in the missing-complete table. [Research portfolio, portfolio changes and Florida budget project source rows](../ledgers/scope-ledger.json) remain implemented/exposed. No historical scope decision, exclusion, gate or producer pin is weakened.

| New adapter family | Exact operation(s) | Coverage counted |
| --- | --- | --- |
| public-data | `query_economic_data` | Complete operation; grants and awards remain absent |
| client-knowledge-search | `query_knowledge_graph` | Complete operation; semantic knowledge search remains absent |
| state-status-votes | `get_state_bill_status`, `search_state_floor_votes` | Partial input: canonical stored bill keys; designation/live resolver remains unavailable |
| tracked-bills | `search_tracked_bills` | Partial input: exact current one-client UUID; names remain unavailable |
| public-domain-hearings | `search_committee_hearings` | Partial input: absent client or current visible UUID; names remain unavailable |
| research-legal-legislation | `search_legislative_research`, `get_legal_reference` | Partial input: no selected client/folder, no reference citation string |
| research-legal-news | `search_legiwatch_news` | Partial input: typed exact source ID or explicit-year personnel, no selected client/truthy folder; default news, monitors and implicit year remain unavailable |
| outreach-query | `query_outreach` | Partial input: explicit-UUID client campaign list only; any `outreachId` key, names, unscoped list and owned detail remain unavailable |

These ten source operations add two complete reads and eight restricted reads to the base accounting. Source paths and constructors do not establish installation, usable current credentials, runtime resource grants, qualification or live availability. Full-operation scope remains accepted; unsupported branches remain explicit unfinished work.

## Verification record

- Initial focused run after the first accounting change: 14/17 passed. The three failures were stale pre-increment assertions (`58` versus `56` registry operations, `26` versus `28` missing-complete reads) and the not-yet-refreshed committed exposure. Expected accounting was updated and the targeted refresh performed; the next run passed 23/23.
- A narrow curated-literal audit found the news operation was represented as a bare handler route key, without a quoted ID in the originally declared files. Adding the actual finite native-operation declaration to the new curated rows satisfied the evidence rule; the check was retained, not relaxed.
- After adding the curation regression, one run passed 23/24: only committed provenance drift failed because the news author changed `research-legal-news/request-context.mjs` while finishing its canonical preflight. The source author subsequently confirmed frozen producer bytes. No stale hash was accepted.
- Final `--refresh-exposure` completed. The serial `scripts/scope-ledger/source-exposure.test.mjs` run passed **24/24**, followed by a clean `--check-exposure`. The final narrow census verified eight new curated families, ten exact operations, eight partial markers, and 40 distinct constructor imports. Complete adapters lacking SDK exposure: zero; partial adapters withheld: eight; missing complete coverage: 26 operations across 15 families (17 skill-declared, nine without a skill declaration). All 63 existing producer mappings remain pinned and live remains zero.
- Final historical verification passed against exact base `08f65a79b99e5b269a8c7f7e82b6b8de225caae8`: deep equality of `capabilities`, `ownerDirection`, `coverageOrigin`, `provenance`, `counts`, `gates`, `excludedReferences`, `ownershipGraph`; all 43 exclusions preserved. Markdown outside the current source-exposure section is byte-equal to that base.

Only `--refresh-exposure` / `--check-exposure` are allocated for ledger generation. Broad historical inventory regeneration and unrelated baseline fixture/parser changes remain outside this lane. Tests run serially with the shared Node24 runtime, `--preserve-symlinks` and a 256 MiB heap; no dependency tree is installed. Disk checked before work: approximately 2.57 GiB free. All commands exit; no background process or scheduler is created.

Final disposition: **IMPLEMENTED; FOCUSED VERIFICATION PASS**. The assigned independent reviewer owns source acceptance. No live qualification is asserted. No commits or edits outside the seven allocated accounting/report files were made by this lane.
