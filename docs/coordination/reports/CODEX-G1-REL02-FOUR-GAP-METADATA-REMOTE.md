# REL-02 four-file structural gap metadata (remote pickup)

Read-only source metadata recovery. Owner: Codex remote pickup `01a12b12-337d-7a01-9f8b-b790558c9d00`. Worker: one bounded Hermes H4 session. Repo `neo-capiro/meri-greenfield`, branch `task/remote-rel02-four-gap-20261011`, exact base `354631c2548d5702bf51fd9f4667c57f90ee8761` (allocation commit on top: `8c746b4`). Frozen reference `neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1`.

This is structural field/enum/dispatch metadata for **seven** gaps only. It is **not** a contract, handler, gateway, schema, catalog or parity deliverable. No output contract is claimed complete; no runtime authorization is claimed.

## 0. Implementation outline (recorded before extraction)

- **Canonical owners.** Scope/availability: this repo's R2 ledger (`docs/coordination/r2/capabilities.json`) and `docs/CAPABILITY-CATALOG.md`. Gap facts: the four frozen `capirov2` files (read-only, Git object reads). Contract ownership for any later family schema remains Codex-allocated under `packages/contracts/retrieval-0.2/` per the REL-02 remaining-metadata report.
- **Exact inputs.** Four frozen blobs at `fd8765ec…`: the federal-market Meri tools service, the retrieval-v2 types module, the Meri data-search helpers, and the Meri client-context helpers.
- **Exact outputs.** A reviewable, paraphrased field/enum/dispatch report separating advertised structural schema, helper defaults/coercions, and actual result/authorization unknowns; plus verification commands/exits and finite next-task proposals.
- **No runtime authority.** Reading schemas/behaviour is allowed; importing, executing, or copying current Capiro implementation is not. Nothing here grants an operation, alias, source connection or tenant access.
- **Failure / unknown boundaries.** Anything not provable from these four files is recorded as an explicit unknown rather than inferred. Result DTO shapes, per-domain descriptor values, opaque cursor contents and authorization decisions are out of scope of this read.
- **Verification.** Verify commit/blob/raw SHA256 before reading facts; focused read-only integrity/count checks; record exact commands and exits, including any failed attempt.

## 1. Frozen identity verification

Frozen commit `fd8765ec01d292013758606204f2c9d886cd31c1` confirmed present in the read-only checkout `C:\dev\capirov2` (`git cat-file -t` → `commit`). The checkout is dirty and was never modified or read from its working tree; every fact below came from `git show <commit>:<path>`.

| Frozen path | Expected blob | Measured blob | Raw bytes | Raw SHA256 | Match |
| --- | --- | --- | ---: | --- | --- |
| `apps/api/src/federal-spending/federal-market-meri-tools.service.ts` | `7c5b09c86ca519996d63cecb8c95d7b54bad5c6b` | `7c5b09c86ca519996d63cecb8c95d7b54bad5c6b` | 9418 | `a370a3289b69911263905db7cc0ddbc4afda40d9fb73a54e5991ba424908a4b5` | YES |
| `apps/api/src/retrieval/retrieval-v2.types.ts` | `71f80b0d94d78537ab6c5f150ab7960417d319d0` | `71f80b0d94d78537ab6c5f150ab7960417d319d0` | 11082 | `95f388145594c5a9052318e4fa0f215de0b10fb92757bbcca8adb17120890fb8` | YES |
| `apps/api/src/meri/meri-data-search.helpers.ts` | `3194549806fa74147ab61d2ba40ef4182bee42f7` | `3194549806fa74147ab61d2ba40ef4182bee42f7` | 5661 | `54025ffcbf917f0ebbf154a313ed53821387877bda09a319fc26ca84b47a54f1` | YES |
| `apps/api/src/meri/meri-client-context.helpers.ts` | `b35e0d20396a4a2a8764ab2c8dab4db7d7df12e4` | `b35e0d20396a4a2a8764ab2c8dab4db7d7df12e4` | 5877 | `fdc3c3ba9e1ad6d6a9ee8f4e861eb9690943361b1d3913c46cc5ae40afdff87c` | YES |

All four blob IDs equal the brief's expected values and the existing `CODEX-G1-REL02-REMAINING-CAPABILITY-METADATA.md` Priority-1 table. This is the evidence seal for the read (see §10).

## 2. The seven structural gaps and their reconciliation

The published 93-intent report names **86 literal input schemas, two partial enum imports and five absent federal-market schemas** — i.e. seven structural gaps. All seven canonical IDs are `selected`, owner lane B, `runtimeParity: NOT_QUALIFIED`, `replacementOperation: null`, `replacementState: REL-02_REQUIRED; no invented alias or handler` in `docs/coordination/r2/capabilities.json` and rows 43/44/149–152/159 of `docs/CAPABILITY-CATALOG.md`.

| # | Gap (93-intent report) | Canonical ID | Resolving frozen file | Status after this read |
| --- | --- | --- | --- | --- |
| 1 | partial: search domain enum | `search_capiro_data` | `retrieval-v2.types.ts` + `meri-data-search.helpers.ts` | Enum + input grammar recovered (§3, §4). Per-domain descriptor **values** and opaque cursor **content** are NOT in these files. |
| 2 | partial: client section enum | `get_client_context` | `meri-client-context.helpers.ts` | Section enum + paging/coverage/representation recovered (§5). Per-section record DTOs are NOT in this file. |
| 3 | absent: federal awards schema | `search_federal_contract_awards` | `federal-market-meri-tools.service.ts` | Input schema + dispatch + paging recovered (§6). Result item DTO shape NOT. |
| 4 | absent: subawards schema | `search_federal_subawards` | same | Input schema + dispatch recovered; result DTO NOT. |
| 5 | absent: contract vehicles schema | `search_contract_vehicles` | same | Input schema + dispatch + runtime rejection of `fiscalYear` recovered; result DTO NOT. |
| 6 | absent: procurement forecasts schema | `search_procurement_forecasts` | same | Input schema + global-query dispatch recovered; result DTO NOT. |
| 7 | absent: district federal market schema | `get_district_federal_market` | same | Input schema (the only `required[]`) + geography dispatch recovered; result DTO NOT. |

Note the ledger's own boundary text for these rows ("Data access included; exact read workflow unselected" for the five federal rows; "Covered family; exact contract qualification pending" for `search_capiro_data`/`get_client_context`). Recovering advertised input metadata does **not** change those dispositions.

## 3. `retrieval-v2.types.ts` — domain/query vocabulary and descriptor shape

- `RETRIEVAL_DOMAINS` (L19–38): **18** literal domains — `clients, contacts, mail, meetings, tasks, monday, action_recommendations, outreach, strategies_work, program_elements, legiwatch_bills, hearings, grants, contracts_opportunities, federal_awards, directory, district_nexus, institutional_knowledge`.
- `RETRIEVAL_QUERY_CLASSES` (L4–15): **10** literal classes — `lookup, semantic_recall, entity_history, relationship_history, temporal_state, change_detection, portfolio_scan, exhaustive_search, comparison, federal_market_analysis`.
- `SemanticDatasetDescriptor` (L85–98) declares the **shape** of per-domain source metadata: `domain, label, description, entityKinds, sourceKind ('live_structured'|'knowledge_plane'), authority, tenantScope, temporalSemantics, supportedQueryClasses, queryCapabilities, adapterKey, freshnessDescription`. This file defines the interface only; **none of the 18 per-domain descriptor values (e.g. `adapterKey`, `freshnessDescription`) are present here**, so "domain source metadata" is only partly closed (shape yes, values no).
- Coverage/authority vocabulary used by the tool result: `RetrievalSourceStatus` (`healthy|degraded|unavailable|unauthorized|unsupported|error`, L69–70), `RetrievalAuthority` (L72–73), `RetrievalTenantScope` (L75), `RetrievalQueryCapabilities` (L77–83), `RetrievalSourceCoverage` (L223–239), `CoverageManifest` (L241–253). `RetrievalCallerContext` (L108–117) documents that `authorized*` envelopes never grant access and that `clientIds` is SubjectScope only.
- `RetrievalRequest` (L119–168) confirms `requireComplete` forces exhaustive pagination and that `exhaustive_search` always behaves that way (L161–165); cursors are opaque per-domain strings (L159–160).

## 4. `meri-data-search.helpers.ts` — `search_capiro_data` input grammar

`parseCapiroDataSearchInput` (L32–79) is the tool-boundary validator:

- `query`: string, length ≤ 4000, trimmed (L33–34, L76).
- `domains`: non-empty array, ≤ `RETRIEVAL_DOMAINS.length`, every member a supported domain, de-duplicated (L36–40).
- `queryClass`: **default `'lookup'`**, must be one of `MERI_DATA_QUERY_CLASSES` (L41–44).
- `MERI_DATA_QUERY_CLASSES` (L6–8) is a **7**-value subset — `lookup, semantic_recall, comparison, entity_history, change_detection, exhaustive_search, federal_market_analysis` — deliberately smaller than the 10-value `RETRIEVAL_QUERY_CLASSES`. `relationship_history`, `temporal_state`, `portfolio_scan` are reachable at the retrieval layer but **not** selectable through this tool.
- `pageSize`: default **50**, integer 1–100 (L45–48).
- `clientId`: optional canonical UUID (hex-8-4-4-4-12) (L49–51).
- `memoryItemId`: optional UUID; additionally requires exactly one domain = `institutional_knowledge` and queryClass in `lookup|semantic_recall` (L52–57).
- `cursors`: optional map; each key must be a **requested** domain and each value a non-empty string ≤ 8192 chars (L58–70). **Cursor content is opaque and not defined in this file.**
- `windowStart`/`windowEnd`: optional ISO-8601 timestamps with timezone, ≤ 64 chars, both-or-neither, end strictly after start (L22–30, L71–75).

`searchCapiroData` (L83–109): with no Context Plane it throws `ServiceUnavailableException` and searches nothing; it sets `requireComplete` when `queryClass === 'exhaustive_search'`; passes only an explicit `clientId` through; and returns `{ tool: 'search_capiro_data', coverage, ...data }` preserving provenance verbatim (L104–108). The **`coverage`/`data` object shapes come from the Context Plane** (`MeriContextPlaneService.searchToolData`) and are NOT established here.

## 5. `meri-client-context.helpers.ts` — `get_client_context` section/default/coverage

- `CLIENT_PROFILE_SECTIONS` (L3–6): **6** literals — `capabilities, people, facilities, submissionHistory, advocacyMatters, advocacyRecords`.
- `parseClientProfileQuery` (L17–50): `section` optional but must be a known section; `limit` **default 25**, integer 1–50; `representation` optional `summary|full`; `cursor` optional, ≤1024 chars, `[\w-]+`, base64url-decoded to `{ v:1, clientId, section, afterId }` and rejected unless the decoded `clientId`/`section` **match the current call** (scope-bound cursor, L37–46).
- `ClientProfileCoverage` (L58–69): `status ∈ {complete, partial, unavailable, not_requested}`, `total: number|null`, `returned`, `limit`, `truncated: boolean|null`, `nextCursor`, `representation`, `source { tool, clientId, section }`, `sourceReferences[]` (recordId/updatedAt/sourceUrl), optional `error: 'section_unavailable'`.
- `clientProfileCoverageHeader` (L73–76) drops `sourceReferences` from the header.
- `readClientProfileSection` (L81–132): prefers a domain-owned `loadPage`; otherwise loads all rows and pages by immutable id order so a cursor stays stable across inserts/deletes (L109–116); on read failure returns `status:'unavailable'` with no evidence claim (L117–119); effective representation defaults to `full` when a section is named, else `summary` (L93). Per-section record DTOs come from the injected loaders, so exact result field sets are **not** established here.

## 6. `federal-market-meri-tools.service.ts` — the five absent federal-market schemas

Definitions are re-exported from `@capiro/shared` (`FEDERAL_MARKET_MERI_TOOL_DEFINITIONS`, L10); the input schemas and dispatch live here. `MAX_TOOL_PAGE = 10_000` (L21). A shared `commonProperties` block (L23–52) supplies `clientId` (string), `query` (string), `agency` (string), `state` (string, 2-letter place-of-performance), `district` (string, number or `00`/`AL`), `fiscalYear` (integer), `page` (integer 1–`MAX_TOOL_PAGE`), `limit` (integer 1–25, "Default 10").

| Tool | Schema lines | Properties | `required[]` |
| --- | --- | --- | --- |
| `search_federal_contract_awards` | 55–70 | common + `fiscalYear`(int 1900–2200) + `recipient` + `dateFrom` + `dateTo` | none (advertised) |
| `search_federal_subawards` | 71–79 | common + `recipient` + `dateFrom` + `dateTo` | none |
| `search_contract_vehicles` | 80–85 | common **minus `fiscalYear`** | none |
| `search_procurement_forecasts` | 86–89 | common (all) | none |
| `get_district_federal_market` | 90–99 | `clientId` + `state` + `district` + `agency` | `['state','district']` |

Dispatch (`execute`, L207–272): unknown names throw; `search_contract_vehicles` **rejects any present `fiscalYear`** even though the schema omits it (L209–211); each branch returns `pageResult(...)` plus `tool` and `generatedAt`. Output boundary of `pageResult` (L138–147): spreads the service page and adds `hasMore`, `nextPage` (null at `MAX_TOOL_PAGE`), `paginationLimitReached`. `search_federal_contract_awards` additionally applies an evidence-accuracy mode from `resolveEvidenceAccuracyModeForTenant` (`shadow` logs missing base-date counts; `enforce` maps rows through `serializeFederalAwardDates`, L217–233). `search_procurement_forecasts` strips `clientId` and queries global public data (L249–259). `get_district_federal_market` requires state+district and delegates to `FederalMarketGeographyService.geography` (L260–269). `FederalMarketPage`/`FederalMarketQuery` types are imported from `federal-market.types.js` — **the result item DTO is not in this file**.

## 7. Advertised schema vs helper defaults/coercions vs actual unknowns

**Advertised structural schema (JSON-Schema literals):** the above `properties`, integer `minimum`/`maximum` (1–25 limit, 1–10000 page, 1900–2200 contract-award fiscalYear) and the single `required: ['state','district']`. None of the five schemas declares `additionalProperties`, so the advertised outer object is **open**; extra-argument refusal is a runtime choice, not advertised structure.

**Helper defaults / coercions (observations, not recommendations):**
- `objectInput` converts any non-object/array to `{}` (L102–106).
- `optionalString` trims and drops non-strings/empty strings (L108–111).
- `limitOf`: default **10**; accepts a number or `Number(raw)`; must be an integer in 1–25 else `BadRequestException` (L113–121).
- `pageOf`: default **1**; accepts a number, or a string only when it matches `^[1-9]\d*$`; integer 1–10000 else throw (L123–136).
- `queryOf` (L149–184): `fiscalYear` coerced via `Number()` then range-checked 1900–2200; `state` uppercased and must match `^[A-Z]{2}$`; `district` uppercased and must match `^(?:[0-9]{1,2}|00|AL)$`. These coercions are legacy boundary behaviour, not to be recreated at a new external boundary without review.

**Actual result / authorization unknowns (explicitly not established):**
- Result DTOs (`FederalMarketPage<T>` items; geography output; per-domain `coverage`/`data` from the Context Plane; per-section profile records) live outside these four files.
- The `clientId` "server pins to the conversation client" claim is only a schema/prose description here; the actual server-side pin and tenant scoping (`ctx.tenantId`) are enforced elsewhere.
- Per-domain `SemanticDatasetDescriptor` values (adapter keys, freshness descriptions, supported query classes) and opaque cursor contents are defined outside these files.
- Registry access flags (`Read` for all seven) do not authenticate an actor, prove grants, or establish source freshness/coverage.

## 8. What the four files cannot establish

- Any complete **output/result contract**; only input schemas, dispatch and paging envelopes are recovered.
- Per-domain retrieval descriptor **values** and cursor **encoding**; only the descriptor interface and cursor-agnostic validation are recovered.
- Per-section client-profile **record DTOs**; only the section enum, paging and coverage envelope.
- **Authorization**: no file here authenticates the caller, resolves grants, applies RLS/ethical walls, or proves the client pin. `RetrievalCallerContext` text restates the fail-closed expectation but is a type, not an enforcement.
- **Source truth/freshness/coverage** for any federal-market or retrieval domain.
- Anything about the other 132 capability IDs, deferred scope, or the three mail IDs (separate owner).

## 9. Proposed narrow next contract tasks (for Codex allocation)

Each is bounded metadata-only unless Codex allocates a contract path. No new generic registry/executor/authorization system is proposed.

1. **Federal-market family input contract** (`B`, lane B) — from §6, author the five typed input schemas (client-scope + global rails kept distinct; `fiscalYear` excluded for vehicles) plus the `pageResult` paging envelope as a `packages/contracts/retrieval-0.2/` candidate. Bound to `federal-market.types.js` for the result DTO in a **follow-on** read.
2. **Result-shape follow-on read** (lane B) — read `apps/api/src/federal-spending/federal-market.types.ts` (and the geography service result type) at the same commit to close the item/graph DTO gaps; no contract authored until Codex allocates.
3. **Retrieval domain descriptor values** (lane B) — locate and read the module that populates the 18 `SemanticDatasetDescriptor`s; reconcile `MERI_DATA_QUERY_CLASSES` (7) vs `RETRIEVAL_QUERY_CLASSES` (10).
4. **`search_capiro_data` contract** (lane B) — input grammar (§4) + the Context Plane coverage/data envelope (separate read of `meri-context-plane.service`).
5. **`get_client_context` contract** (lane B) — section enum/coverage (§5) + per-section reader DTOs.
6. **Serialization owner: one integration owner** must serialize later edits to `retrieval-0.2/validate.mjs` and `catalog.json`. Contract version stays `0.1.0` only after Codex freezes a reviewed integration commit.

## 10. Verification (read-only; exact commands and exits)

All commands ran against frozen Git objects; the `capirov2` working tree was never read or written.

- Repo/branch/head: `git rev-parse HEAD` in `meri-greenfield-rel02-four-gap-20261011` → `8c746b4…`; `git status --porcelain` clean before and after (only ignored `.task-inputs/` scratch plus the new report). Exit 0.
- Frozen commit present: `git -C C:/dev/capirov2 cat-file -t fd8765ec…` → `commit`. Exit 0.
- Blob IDs (4× `git rev-parse fd8765ec…:<path>`) → exact expected SHAs (§1). Exit 0.
- Raw SHA256 + byte counts (4× `git show … | sha256sum` / `wc -c`) → §1. Exit 0.
- Extraction to ignored `.task-inputs/remote-rel02-four-gap-1/` re-hashed → identical four SHA256. Exit 0.
- Count checks on frozen bytes: domains **18**, retrieval query classes **10**, `MERI_DATA_QUERY_CLASSES` **7**, `CLIENT_PROFILE_SECTIONS` **6**, federal schema keys **5**, `required:` occurrences **1** (only district tool), `MAX_TOOL_PAGE = 10_000`. Exit 0.
- **Failed attempt (retained):** the first extraction used `git -C /c/dev/capirov2 …` and failed with `fatal: cannot change to '/c/dev/capirov2': No such file or directory` (exit 128) because this host disables MSYS path translation for native tools. No file was written and no state changed; re-run with the native path `C:/dev/capirov2` succeeded. This is an environment failure, not a product defect.

No product, native, Docker, AWS, GitHub-write, network, credential, provider/model or paid action was performed. No `capirov2` code was copied into greenfield.

## 11. Limits

- No product checks, runtime/authorization tests or parity claims are made. All schemas/behaviour are read-only metadata observations from four frozen files.
- Advertised schema does not equal enforced behaviour: the absence of `additionalProperties`, the runtime coercions and the `fiscalYear`-for-vehicles rejection are documented separately.
- The seven structural *input* gaps are closed at the advertised-metadata level; result contracts, descriptor values, cursor contents and authorization remain open.
- REL-02/REL-03 and G1 remain open. This report is a metadata candidate for Codex independent review, not an accepted artifact.