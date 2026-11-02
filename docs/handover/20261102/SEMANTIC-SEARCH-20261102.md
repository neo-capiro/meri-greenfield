# Semantic reads over bills, grants and contract opportunities (2 November 2026)

Neo's direction: bills, contracts and grants carry embeddings in Core, so natural-language questions about them use semantic search; text-to-SQL stays for counts, filters, joins and aggregates. This note records the inventory, the two changes, what the release owner must add, what remains live-only, and the acceptance plan.

Core PR: `neo-capiro/capiro-backend`, branch `fable/semantic-search-core-20261102` (see the PR body for the Core inventory table). Meri PR: branch `fable/semantic-search-20261102`.

## Inventory

| Entity | Embeddings in Core | Model | Kept fresh by | Scope | Vector readers before this change |
| --- | --- | --- | --- | --- | --- |
| Federal bills (`congress_bill`) | `context_embeddings` `source_type='bill'`, one row per bill, text = number, title, policy area, subjects, sponsor, latest action | `amazon.titan-embed-text-v2:0`, 1024 dims | `sync-congress` inline on sync, `embed-backfill` | public (`tenant_id IS NULL`) | tracked-bill discovery, tracker recommendations, intel-api scoring; partial HNSW index since 1 Nov |
| Grants (`federal_grant`, Grants.gov) | `source_type='funding_grant_chunk'`, chunks per grant (`parentId` in metadata); `embedded_at` marks completion | Titan v2 | `embed-funding-catalog` bounded worker, open and forecasted grants first | public | none (funding v2 search is text) |
| Contract opportunities (`sam_opportunity`, SAM.gov notices) | `source_type='funding_notice_chunk'`, chunks per notice | Titan v2 | same worker, active notices first | public | none (`search_sam_opportunities` is keyword search) |
| Contract awards (`federal_award`, `federal_assistance_award`) | none | – | – | – | keyword reads only; "contracts" semantic search means SAM contract opportunities |
| Opportunity attachments | `funding_attachment_chunk` | Titan v2 | same worker | public | none; not exposed |
| Defense research (program elements) | `source_type='pe'` | Titan v2 | `embed-program-elements` | public | `defense-research-semantic.ts` (pattern reused) |

Meri before this change: `search_congress_bills` / `read_bill_text` (bill-text family), `search_sam_opportunities` (sam-opportunities family), `search_federal_grants` (public-data family), the SQL pair (`describe_capiro_data` / `query_capiro_data` 0.5), and the legacy `search_capiro_data` cross-domain candidate search whose domains include `legiwatch_bills`, `grants`, `contracts_opportunities` and `federal_awards`. None ranked by vector.

## What changed

Core: three fixed read-only receivers on `/api/clio/tools/<id>` (`semantic_search_bills`, `semantic_search_grants`, `semantic_search_contract_opportunities`), guarded like the connected-app reads (actor Core credential, service secret, allowlist, deadline, in-transaction membership recheck). Query embedded with the stored model, nearest 200 vectors by cosine distance under the family's partial HNSW index, best chunk per record above a 0.35 floor, family filters, at most 25 canonical records with score, snippet and a stable reference. One additive SQL-only migration adds the two missing partial HNSW indexes.

Meri (catalog 0.2.33): family `semantic-search` with one shared schema (`retrieval-0.2/semantic-search.schema.json`), validator, three catalog rows and originals, gateway source and family module, native-family registration, 165 µUSD embedding tariffs, worker mount, family guidance, a routing sentence in the `meri_reads` prompt, rosters in `infra/product-preview/first-chat/deployment-inputs.json` (all six lists), regenerated `docs/RETRIEVAL-AUDIT.md` and tariff proposal, and the catalog digest pins.

Routing the model is given:

- find, compare, summarize or recommend bills, grants or contract opportunities by topic, intent, need or similarity: semantic read first, then text-to-SQL for exact facts, counts or joins about the returned references;
- how many, which fields, trends, totals, joins or exact filters (sponsor, date, agency, status): text-to-SQL, not semantic search;
- cite each record by title and identifier from the returned reference, say the page is the nearest matches and not a count, never name the search method or tool to the user.

`search_capiro_data` is not deleted. Its catalog row and `data-search.schema.json` are preserved 0.2 bytes pinned by the installation digest and by the immutable `portfolio_changes` and `portfolio_overlap` skill manifests, so removing its bill, grant and contract-opportunity domains needs a successor version, not a deletion. Its routing was narrowed instead: the `data-search` family guidance no longer advertises bills, grants or awards as its coverage and points topic questions at the semantic reads.

## Release owner inputs

- Preview ALB rules (host-scoped, before the preview catch-all): `POST /api/clio/tools/semantic_search_bills`, `/api/clio/tools/semantic_search_grants`, `/api/clio/tools/semantic_search_contract_opportunities`.
- Preview Core task `MERI_TOOL_ALLOWLIST`: add the three ids (the rosters in `deployment-inputs.json` carry them for approval).
- Core migration `20281102100000_funding_chunk_embedding_hnsw`: snapshot the clone, `prisma migrate deploy`, then `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;` must be empty.

## Live-only

- Backfill status per family on the preview clone: bills under `source_type='bill'`; `federal_grant.embedded_at` and `sam_opportunity.embedded_at` coverage (the funding worker is bounded and prioritizes open records, so older or closed records may have no vectors). Not measured here: no read-only clone path is recorded in the receipts for this session, so the inventory is inferred from code.
- The Core task role's Bedrock `InvokeModel` for Titan v2 (already exercised by tracked bills).
- The HNSW builds themselves and the index-validity check.
- Hermes acceptance of the ten questions below.

## Acceptance plan (ten questions)

| # | Question | Expected path | Expected answer shape |
| --- | --- | --- | --- |
| 1 | Which bills address rural broadband affordability? | `semantic_search_bills` | up to a page of bills by title and bill id, "nearest matches", no count claim |
| 2 | Find grants for wildfire resilience in small rural counties. | `semantic_search_grants` | grants by title and opportunity number with close dates, cited by id |
| 3 | Are there contract opportunities like our counter-drone capability statement? | `semantic_search_contract_opportunities` | active notices by title and notice id with deadlines and set-asides |
| 4 | Summarize the bills about PFAS cleanup liability and how they differ. | semantic bills, then `read_bill_text` or SQL for specifics | comparison citing each bill id |
| 5 | Recommend federal grants similar to the Community Wildfire Defense program. | semantic grants, then SQL for exact ceilings if asked | ranked recommendations with ids |
| 6 | How many bills did Senator Warren sponsor in the 119th Congress? | text-to-SQL only | one number with the query bound stated |
| 7 | Which fields does the grants relation carry for award ceilings? | `describe_capiro_data` | relation metadata, no semantic call |
| 8 | Show the trend of SAM notices posted per month this year. | text-to-SQL only | monthly counts, no semantic call |
| 9 | Join tracked bills to their cosponsors and list the ones from Texas. | text-to-SQL only | rows from the join |
| 10 | List grants from the Department of Energy with a close date after 1 March. | text-to-SQL only (exact filter) | filtered rows; a semantic call here is a routing failure |

Pass criteria: the expected tool family is called first for 1 to 5 and not at all for 6 to 10; answers for 1 to 5 cite the returned references and never say "search", "embedding", "tool" or a method name; an empty semantic page is reported as "no close matches", never as absence.

## Host facts

Meri worktree dependencies were mirrored from `wt-data-query` (per-package junctions into `meri-cap-235-20261029`, the scrum238 contracts store, the private worker store `meri-worker-deps-20261102`, own `@capiro` links); Core worktree dependencies are junctions of every `node_modules` directory of the sibling clone `capiro-backend`. An untouched base worktree `wt-semantic-base` (detached at `14816c82b`, same junction layout) was left in place for the failure-name comparison; unlink its junctions before any removal.
