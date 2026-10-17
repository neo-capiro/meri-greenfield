# Read resolution ledger delta - 17 October 2026

Base: `e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce` (PR106 source). This lane owns only the curated adapter metadata, source-exposure expected/state tests, refreshed ledger JSON/Markdown, and this report. The separate observation-seam audit report is frozen. Runtime/source/backend/contracts/SDK logic is owned by the allocated authors and coordinator.

Outline: add the two-operation partial-resource business-development adapter row, recording its actual handler, selector helper, finite native-operation declaration and thin family. Update the existing state/legal/news metadata to reflect the new supported source branches while keeping partial status. Extend the focused accounting assertions to 56 complete + 10 partial + 16 absent = 82 selected source reads; missing complete coverage remains 26 operations across 15 families. SDK remains 58 operations / 35 families; constructors become 41; live remains zero. Preserve all eight historical ledger fields and 43 exclusions against both PR106 and the earlier `08f65a79` base.

The coordinator confirmed the final production-source freeze before refresh, including the reader-authority expiry correction. No complete adapter or SDK promotion is allocated; no source-exposure reconciliation/renderer logic change was needed.

## Curated changes

| Family | Recorded capability gain | Remaining boundary |
| --- | --- | --- |
| business-development | `get_business_development_context` and `get_business_development_recent_changes`, with an explicit native Core conversation owned by the current user and linked to the exact current task client | `PARTIAL_RESOURCE`; private canonical native identity/context HTTP proves and rechecks that conversation/client resource; no greenfield conversation substitution. `get_business_development_evidence` stays absent and all three stay outside SDK exposure |
| state-status-votes | Canonical stored bill keys plus `search_state_floor_votes` without a selected bill, preserving native stored state/chamber/query filters | `PARTIAL_INPUT`; designation fallback still cannot run; status still requires a canonical key |
| research-legal-legislation | Existing search/reference slices now allow an explicit UUID client with exact current subject, resource and membership visibility | No folder, named client or reference citation parser; current native ResearchService wall/feature/member owners remain decisive; partial status and SDK withholding remain |
| research-legal-news | Existing exact-source and explicit-year personnel slices now allow an explicit current UUID client without a folder | No names/folders, default news clock, implicit year or private monitor branch; partial status and SDK withholding remain |

The [adapter inventory](../../../scripts/general-reads/adapters.json) measures the actual business-development handler, request-context helper, finite native declaration and thin family. State metadata additionally measures its new pure request helper. Canonical contexts, raw source DTOs and private current-resource proof are implemented by the allocated source/runtime owners; this lane neither creates their authority nor counts a proposal as implementation.

The [focused exposure assertions](../../../scripts/scope-ledger/source-exposure.test.mjs) retain the prior mixed-family and no-partial-SDK guards, add the two business-development partial rows, explicitly keep evidence absent, and compare historical fields against both pinned bases. The existing generic `adapter-partial` accounting covers restricted input and restricted resource branches; no new accounting state or registration policy is introduced.

## Final verification

The targeted `--refresh-exposure` completed after source freeze. The serial Node 24 source-exposure suite passed **24/24** on its first run, and `--check-exposure` reported the ledger current. There were no failed checks in this ledger delta. A separate narrow census confirmed the actual constructor imports, finite SDK registration, partial business-development paths and held evidence state.

| Current accounting | Verified result |
| --- | --- |
| Selected source reads | 82 = 56 complete + 10 partial + 16 absent |
| Missing complete implementation | 26 operations across 15 families |
| Complete adapters without SDK exposure | 0 |
| Partial adapters withheld from SDK | 10 operations across 7 families |
| SDK registration | 58 operations across 35 families |
| General family constructors | 41 |
| Live qualification | 0 |

All eight historical ledger fields (`capabilities`, `ownerDirection`, `coverageOrigin`, `provenance`, `counts`, `gates`, `excludedReferences`, `ownershipGraph`) retain both deep equality and exact serialized values against PR106 base `e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce` and earlier base `08f65a79b99e5b269a8c7f7e82b6b8de225caae8`. All 43 exclusions remain unchanged, and the Markdown outside its current source-exposure section is byte-equivalent to both bases. Retained research portfolio, portfolio changes and Florida budget project reads remain selected. `git diff --check` passed for the owned files.

The refreshed non-report artifacts have these SHA-256 values; the coordinator and independent reviewer receive this report's final hash separately:

| Artifact | SHA-256 |
| --- | --- |
| `scripts/general-reads/adapters.json` | `89e4d43527512af2f4d5dd5cdfeabdec65980cbfc7108c26dcd14077d75aae90` |
| `scripts/scope-ledger/source-exposure.test.mjs` | `f631bde460fa3b9df106bdc5dbdc29137b9c2f6f8610713a26c549698e03efec` |
| `docs/coordination/ledgers/scope-ledger.json` | `3319e7c07699f3d47aabaef562c9e249d9b27f7a86dde613c561f6fc0e7b10b5` |
| `docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md` | `22a9f0deeee9cbeb7ebe0f10c5860b5c6ebcc377e5544089d255db760604d66c` |

This lane did not rerun settled SDK, source, integration or historical-inventory suites. No dependencies, archives, new worktree, credentials or live source calls were created. The ten partial and sixteen absent operations remain incomplete product scope; this source accounting does not establish live qualification or publication acceptance. Independent source review and the coordinator's integrated acceptance remain separate steps.
