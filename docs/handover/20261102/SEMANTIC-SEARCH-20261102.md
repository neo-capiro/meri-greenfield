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

Coverage on the preview clone (orchestrator's read-only inventory, 2 November 2026; `DATA-POPULATION-INVENTORY-20261102.json`):

| Family | Records with vectors | Stored records | Not indexed |
| --- | --- | --- | --- |
| Bills (`context_embeddings` `source_type='bill'`) | 43,424 | 48,497 | 5,073 |
| Grants (`federal_grant.embedded_at`) | 20,595 | 84,115 | 63,520 |
| SAM contract opportunities (`sam_opportunity.embedded_at`) | 24,165 | 141,350 | 117,185 |
| Program elements (`source_type='pe'`) | 2,380 | 2,407 | 27 |
| Contract awards (`federal_award`) | 0 | 170,039 | all |
| Assistance awards | 0 | – | all |

Each semantic read returns `coverage {indexedRecords, totalRecords}` read in the same transaction as the page, and its notes say how many records are indexed, that only indexed records can be found, and on an empty page that the indexed records held no close match and how many are not indexed yet, never that none exists. The family guidance and the gateway contract carry the same rule.

Meri before this change: `search_congress_bills` / `read_bill_text` (bill-text family), `search_sam_opportunities` (sam-opportunities family), `search_federal_grants` (public-data family), the SQL pair (`describe_capiro_data` / `query_capiro_data` 0.5), and the legacy `search_capiro_data` cross-domain candidate search whose domains include `legiwatch_bills`, `grants`, `contracts_opportunities` and `federal_awards`. None ranked by vector.

## What changed

Core: three fixed read-only receivers on `/api/clio/tools/<id>` (`semantic_search_bills`, `semantic_search_grants`, `semantic_search_contract_opportunities`), guarded like the connected-app reads (actor Core credential, service secret, allowlist, deadline, in-transaction membership recheck). Query embedded with the stored model, nearest 200 vectors by cosine distance under the family's partial HNSW index, best chunk per record above a 0.35 floor, family filters, at most 25 canonical records with score, snippet and a stable reference. Two additive SQL-only migrations add the missing partial HNSW indexes, one `CREATE INDEX CONCURRENTLY` statement each.

Meri (catalog 0.2.33): family `semantic-search` with one shared schema (`retrieval-0.2/semantic-search.schema.json`), validator, three catalog rows and originals, gateway source and family module, native-family registration, 165 µUSD embedding tariffs, worker mount, family guidance, a routing sentence in the `meri_reads` prompt, rosters in `infra/product-preview/first-chat/deployment-inputs.json` (all six lists), regenerated `docs/RETRIEVAL-AUDIT.md` and tariff proposal, and the catalog digest pins.

Routing the model is given:

- find, compare, summarize or recommend bills, grants or contract opportunities by topic, intent, need or similarity: semantic read first, then text-to-SQL for exact facts, counts or joins about the returned references;
- how many, which fields, trends, totals, joins or exact filters (sponsor, date, agency, status): text-to-SQL, not semantic search;
- cite each record by title and identifier from the returned reference, say the page is the nearest matches and not a count, never name the search method or tool to the user.

`search_capiro_data` is not deleted. Its catalog row and `data-search.schema.json` are preserved 0.2 bytes pinned by the installation digest and by the immutable `portfolio_changes` and `portfolio_overlap` skill manifests, so removing its bill, grant and contract-opportunity domains needs a successor version, not a deletion. Its routing was narrowed instead: the `data-search` family guidance no longer advertises bills, grants or awards as its coverage and points topic questions at the semantic reads.

## Release owner inputs

- Routes `POST /api/clio/tools/semantic_search_bills`, `/api/clio/tools/semantic_search_grants` and `/api/clio/tools/semantic_search_contract_opportunities`: no new ALB rule is expected, because the existing preview rule for `/api/clio/tools/<id>` (`first-chat-core-routes.json`) covers them; the release owner confirms this against the live ALB.
- Preview Core task `MERI_TOOL_ALLOWLIST`: add the three ids (the rosters in `deployment-inputs.json` carry them for approval).
- Core migrations `20281102100000_funding_grant_chunk_embedding_hnsw` and `20281102100001_funding_notice_chunk_embedding_hnsw` (one `CREATE INDEX CONCURRENTLY` each): snapshot the clone, `prisma migrate deploy`, then `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;` must be empty and one `EXPLAIN` per family must show the partial index. The preview Core task must run with `EMBEDDING_MODEL=amazon.titan-embed-text-v2:0` and Titan invoke on its task role, matching the stored model, or every search is empty.

## Live-only

- Backfill per family, for the shipping executor after the PRs merge:
  - Grants and SAM notices are embedded only by `apps/api/scripts/embed-funding-catalog.ts` (ingestion-schedule job `EmbedFundingCatalog`, `embed-funding-catalog --commit --limit=300 --max-chunks=3000`, cron 04:20, 10:20, 16:20 and 22:20 UTC, currently `enabled: false` in `infra/cdk/lib/ingestion-schedule.ts`). Its selection covers only active notices with a live response deadline and posted or forecasted grants with an open close date, so most of the 117,185 unindexed notices and 63,520 unindexed grants are historical records the worker never embeds by design; indexing them needs a widened selection or a one-off run, not just enabling the schedule. Cost: Titan v2 at 0.02 USD per million input tokens, one call per chunk of at most 6,000 characters, roughly 1,500 tokens, so a full notice backfill is on the order of 140,000 calls and about 4 to 5 USD; the worker embeds chunks sequentially under a 6-hour advisory lock, so a full pass is hours, bounded per pass by `--max-chunks`.
  - Bills are embedded by `embed-backfill --source all` (one-shot Fargate task, EventBridge daily 13:00 UTC, enabled) and inline by `sync-congress`; 5,073 bills had no row on the clone.
  - Contract awards: no embedding writer exists in Core (no `embedded_*` columns on `federal_award`, no script); semantic search over awards needs a new embedder first and is not part of these PRs.
- Coverage figures above are the orchestrator's clone inventory; this session had no read-only clone path and inferred the rest from code.
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
