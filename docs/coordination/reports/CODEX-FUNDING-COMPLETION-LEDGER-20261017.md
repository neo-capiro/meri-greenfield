# Funding completion ledger increment

Disposition: **source accounting complete; focused checks PASS; final independent review and coherent integration remain parent-owned. Qualified/live remain zero.**

Task-owned branch `codex/meri-funding-completion-20261017`, local base `6104c2c1edb9be1a1353a94552fef28e6b63b2e5`, public PR112 tree `e1a6cc9b55501191f56142bf684e3782d94534cd`. This lane owns only adapter metadata, focused source-exposure tests, generated ledger JSON/Markdown and this report. Source, SDK policy, Core implementation and current qualification have separate owners. The implementation outline and initial HOLD were recorded before promotion.

## Accepted source dependency and qualification boundary

Root explicitly accepted the corrected Core PR52 source and confirmed the final Meri production freeze before authorizing promotion. Exact dependency: Core head `51c157444ac43035eeb489ff46aee5a4e89ba3ac`, tree `54af881dddef397db0ff215d6eb2a72d74c0d1bd`, parent `6bb17c00b610334e1aa354496d8a3acd152907d0`. Independent remote review provisionally accepted the strict canonical-original-body correction, resolving the earlier non-finite/Unicode HOLD. Root reports all-five literal goldens matched, 109 isolated Core Jest cases passed and focused TypeScript exited zero. Those Core checks were not rerun in this ledger lane; no full-repository, deployed-native or live qualification is inferred.

Only the five funding `partialOperations` declarations were removed. Adapter checks now record the exact reviewed Core dependency, original fixed POST/raw body hash, once-captured trusted `asOf`, all-five producer consumption, current explicit one-client authority and required-client SDK policy. Complete source registration does not qualify an installed server. The trusted qualification issuer must bind reviewed Core source to the actual build, origin/configuration and all-five consumption, and withhold/revoke availability on unqualified source/server drift. An opaque qualification receipt does not automatically detect Core protocol/build compatibility. No acknowledgement or new qualification owner was invented.

## Current source accounting

| Measure | Preserved base snapshot | Current accepted source |
| --- | --- | --- |
| Selected source reads | 82 | 82 |
| Complete / partial / absent | 58 / 13 / 11 | **63 / 8 / 11** |
| Incomplete reads / families | 24 / 15 | **19 / 14** |
| Incomplete skill-declared / undeclared | 16 / 8 | 11 / 8 |
| SDK operations / families | 60 / 36 | **65 / 37** |
| Passive constructors | 42 | 42, parent-owned census |
| Continued exclusions | 43 | 43 |
| Qualified/live claimed | 0 | **0** |

All five funding reads were skill-declared, so their completion removes five declared gaps. The eight remaining partial operations span six families:

| Family | Count | Remaining partial operations |
| --- | --- | --- |
| `state-status-votes` | 2 | `get_state_bill_status`, `search_state_floor_votes` |
| `research-legal-legislation` | 2 | `search_legislative_research`, `get_legal_reference` |
| `tracked-bills` | 1 | `search_tracked_bills` |
| `public-domain-hearings` | 1 | `search_committee_hearings` |
| `research-legal-news` | 1 | `search_legiwatch_news` |
| `outreach-query` | 1 | `query_outreach` |

The 11 absent operations remain unchanged across eight further families: business-development evidence (one), certification status (one), semantic client knowledge search (one), program elements (three), federal grants/awards (two), research legal candidates (one), rule status (one) and SAM opportunities (one). Retained research portfolio, portfolio changes and Florida budget project reads remain complete and SDK-exposed as source only.

## Focused checks and preservation

After root's GO/freeze signal, one targeted refresh, one focused suite execution and the scoped drift check passed:

```text
node --preserve-symlinks --max-old-space-size=256 scripts/scope-ledger/cli.mjs --refresh-exposure
node --preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=20000 scripts/scope-ledger/source-exposure.test.mjs
node --preserve-symlinks --max-old-space-size=256 scripts/scope-ledger/cli.mjs --check-exposure
```

**27/27 passed**, zero failures/skips/cancellations, Node 24.19.0. The actual funding guard directly proves all five rows complete and SDK-exposed, real required-client policy, exact five registered IDs, unchanged `{asOf}` requirements, finite DTO/helper measurement and the exact Core/qualification metadata. Per-operation and whole-family partial claims still refuse SDK exposure. The separate in-memory projection preserves every other row and cannot substitute for those actual-source assertions. Owned-file whitespace checking passed; no reconciliation algorithm or renderer policy changed.

All eight historical JSON fields remain identical, including serialization: `capabilities`, `ownerDirection`, `coverageOrigin`, `provenance`, `counts`, `gates`, `excludedReferences`, `ownershipGraph`. Preservation checks compare the public PR112 tree and retain the four legacy baselines `a945196efcd417a2ed09bcbacfae876acbefd2c3`, `615a5467ffa555f913ad49258b3919723ecf207d`, `e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce` and `08f65a79b99e5b269a8c7f7e82b6b8de225caae8`. Markdown outside current exposure, historical CSV and inventory bytes are unchanged. Both old PR110 handoff snapshots compare byte-identically using `git show e1a6cc9b55501191f56142bf684e3782d94534cd:<path>`; no new local-only Git commit is required. Their old source accounting stays immutable. All43 exclusions, 63 historical pinned producer records and existing skill/product boundaries remain intact. The broad historical inventory/parser failure was not rerun or relaxed.

## Preserved initial precondition evidence

The initial targeted projection attempt was **PRECONDITION_BLOCKED before any test body**, not an assertion failure. The prepared future SDK funding policy was present while metadata was intentionally partial, and strict reconciliation refused module initialization with `SOURCE_EXPOSURE_INVALID`. No working policy was temporarily changed and no failure-state rerun occurred. The exact original command, exit1, combined console, capture kind and no-truncation record remain in [the transcript](funding-completion-20261017/ledger-projection-initial.txt) and [metadata](funding-completion-20261017/ledger-projection-initial.json).

Those evidence bytes were rechecked unchanged: TXT SHA256 `21bd0810e7083663e540d9029b771fea2a86b7d3ff09cdae53246c0149082e47`; JSON SHA256 `c66ce52ec7d1afa9c804a5165740d59e834da38855bd1ec745d0e62207761e0e`.

## Frozen accounting hashes

| File | SHA256 |
| --- | --- |
| `scripts/general-reads/adapters.json` | `5187d08c2f0fb4583b654def701bcc3d43ecfad306b3001d176765a62e377f97` |
| `scripts/scope-ledger/source-exposure.test.mjs` | `db8bfcd83b765c83b6c58713e12e1b64a518c64344ad5383be1811a4bbe7d2be` |
| `docs/coordination/ledgers/scope-ledger.json` | `ed5939e52f256e1fac82cd1c813e3a7b7dc28e699aaef9ec57cc8d1dbbaa0fb0` |
| `docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md` | `a47d3a2c9d27b8ad77f58898674fd5600d0d88e775b82277477bff4234c29da1` |

No commit/staging, dependency installation, Core/config/contract/lock change, credentials, provider/database/AWS call or deployment occurred in this lane. Current installation/server qualification and independent final source acceptance remain separate gates.
