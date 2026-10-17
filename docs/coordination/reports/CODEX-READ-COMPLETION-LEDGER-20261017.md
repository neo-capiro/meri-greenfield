# Existing-route read completion ledger increment

Base: `a945196efcd417a2ed09bcbacfae876acbefd2c3`, tree `2826443929c4ef797ff52e15e0bb4b296eb4e678`, branch `codex/meri-read-completion-next-20261017`. This lane owns only curated adapter metadata, focused source-exposure tests, generated ledger JSON/Markdown and this report. Source, current authority, SDK policy, coherent integration and independent acceptance remain with their allocated owners. No Core, contract, startup, lockfile, deployment, credential or live changes are included.

Implementation outline: promote only the two complete business-development reads after the existing native personal-owner and preserved closed-client authority paths were accepted; retain the evidence sibling as absent. Keep compatible legal citation support partial because names, folders and parser-dependent requests still lack complete coverage. Reuse the existing reconciliation states and generator, add exact subset/completion and preservation checks, then refresh source provenance only after the parent confirms final production freeze.

## Current accounting

| Measure | Result |
| --- | --- |
| Selected source reads | **58 complete + 13 partial + 11 absent = 82** |
| Reads lacking complete coverage | **24 across 15 families**; 16 skill-declared, eight without a declaration |
| Complete adapters without SDK exposure | 0 |
| Partial adapters withheld from SDK exposure | 13 across seven families |
| Single SDK read registry | **60 operations / 36 families**: 58 selected source reads, one product-state read and one historical contract |
| Continued exclusions | 43 |
| Pinned actual producer mappings | 63; mapping is not qualification |
| Passive family constructors | 42, unchanged; parent-owned census/integration |
| Qualified/live claimed by this increment | **0** |

The exact remaining family/operation inventory is generated in [the ledger](../ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md). Business-development evidence remains one of the 11 absent adapters. The two legal-legislation operations remain among the 13 partial adapters; the compatible citation increment does not change either full-operation count. All five funding reads remain partial and SDK-withheld pending the separately owned verified Core bridge/server qualification. No Core allocation, installed bridge or additional Core wire is inferred here.

## Canonical metadata and authority

`scripts/general-reads/adapters.json` removes `partialOperations` only from `get_business_development_context` and `get_business_development_recent_changes`. Their metadata now records the actual two authority paths. A canonical personal actor needs nonempty coherent tenant/private-user scopes, and native `authorizeScope` checks the current actor-owned active explicit Core conversation and persisted prospect scope before basic domain content/history/alerts. A client task retains its exact native identity/context receipt, current visible one-client subject, revision/expiry vector and whole-output linked-client check. There is no client-to-personal downgrade, broad conversation GET, invented receipt, consumed-revision claim or stronger native snapshot guarantee.

The exact two-operation SDK subset excludes `get_business_development_evidence`. Focused accounting checks prove both promoted rows are complete/exposed, evidence has neither adapter nor SDK route, and registering the entire family without an evidence adapter refuses. No reconciliation algorithm, renderer policy, historical CSV or general-read inventory change was necessary.

Retained research portfolio, portfolio changes and Florida budget project reads stay canonical implemented and SDK-eligible. Their live/qualification status remains unclaimed. Existing mixed-family economic/graph subsets, product/governed separation and all excluded capabilities retain their prior boundaries.

## Verification actually run

After the parent explicitly confirmed final production freeze, the following commands passed with Node 24.19.0 and borrowed existing dependencies:

```text
node --preserve-symlinks --max-old-space-size=256 scripts/scope-ledger/cli.mjs --refresh-exposure
node --preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=20000 scripts/scope-ledger/source-exposure.test.mjs
node --preserve-symlinks --max-old-space-size=256 scripts/scope-ledger/cli.mjs --check-exposure
git --no-optional-locks diff --check -- scripts/general-reads/adapters.json scripts/scope-ledger/source-exposure.test.mjs docs/coordination/ledgers/scope-ledger.json docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md
```

The focused suite passed **26/26 on its first run**, with zero skipped/cancelled cases. It retains the 25 prior checks, updates derived counts and adds the two-operation BD completion guard. Historical preservation now also directly checks Markdown outside current source exposure and unchanged CSV/inventory bytes. `--check-exposure` confirms exact generated JSON/Markdown reproduction. Every current measured provenance entry is rehashed from source; no fixture or mapping is treated as live qualification.

All eight historical JSON fields compare identically, including serialization, against bases `a945196efcd417a2ed09bcbacfae876acbefd2c3`, `615a5467ffa555f913ad49258b3919723ecf207d`, `e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce` and `08f65a79b99e5b269a8c7f7e82b6b8de225caae8`: `capabilities`, `ownerDirection`, `coverageOrigin`, `provenance`, `counts`, `gates`, `excludedReferences`, `ownershipGraph`. The same four bases have byte-equal historical CSV/inventory and Markdown outside the current exposure section. All 43 exclusions remain selected-scope exclusions and absent from registration. The broad historical inventory/parser failure was not rerun or relaxed.

## Frozen provenance for independent review

| File | SHA256 |
| --- | --- |
| `scripts/general-reads/adapters.json` | `c2b550caa58a448878586cf393e7a3fd350ae36d29be210587f7ad6bd3f3ea71` |
| `scripts/scope-ledger/source-exposure.test.mjs` | `e5b6212a5e32fbcf29cf7b849a594302f949a25939bf2a18e4e9bd43d2eee2e1` |
| `docs/coordination/ledgers/scope-ledger.json` | `31a5764bc3dcee4b60b44ff3ac9d655ec6f3fba01e4c076b127d8008dacb6c53` |
| `docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md` | `63c24452eadb999664f2b753e1db6534d4a966ea3ae59cb5c50a3ad2a730e14e` |

Measured production references include BD request-context `a5a4ae4cf61b3001fa9b6c78ac017a13baa002b09cea1e7f6d506cf62f844b16`, BD handler `1b01f1881ed3708aa46a3cb4ad9197e30b717769b3860a703f9dc8a1325bee4e`, legal request-context `e1b9f927b372add3c65d7be078951eac8bb5940c7514f07f12bb26cd33a63614` and SDK family policy `64fed993299072d2c72679e535aba2208dff71e04301b87ac04777feaab137bc`. These hashes identify the frozen source measured by this increment; they do not replace current runtime authority or source/server qualification.

After independent manifest review, root added exactly three changed static-import modules to the integration COMMON measurement: the BD handler, BD request-context helper and legal request-context helper. Existing source-label deduplication remains in place. The change adds measurement only; loader/runtime behavior, counts and historical accounting remain unchanged. Final `apps/gateway/general-reads/integration.mjs` SHA256 is `980e0f0f4777b768c80ae844cf9fdda32283a2afea00977a50bd0aa7494bc141`.

One final provenance-only `--refresh-exposure` followed by one `--check-exposure` passed after that freeze. The JSON hash above replaces the earlier `591aa031462343519d318424da2c7125d1ce0d1c1b3f26ae97d4e1622257d483`; Markdown, adapter metadata and focused test bytes are unchanged. No second full suite was run in this lane; root's coherent integration includes the 26 ledger cases.

Disposition: **ledger source increment complete; focused checks PASS; independent parent review and coherent integration pending**. No commit/staging, dependency installation, background process, live call or external mutation occurred in this lane.
