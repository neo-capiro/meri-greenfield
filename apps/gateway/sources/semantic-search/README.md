# Native semantic reads over public bills, grants and contract opportunities

`semantic_search_bills@0.2.0`, `semantic_search_grants@0.2.0` and
`semantic_search_contract_opportunities@0.2.0` use the fixed Core routes
`/api/clio/tools/<id>`. The existing control owner checks current execution and
native Core authority; the gateway sends the actor's native Core credential and
the internal service secret, exactly as the other stored native reads. No
credential, grant or separate search authority is created, and no client wall
applies: every ranked record is public (tenant-less) data.

Core (capiro-backend `apps/api/src/meri/semantic-search*.ts`) embeds the query
with the same Titan v2 model that wrote the stored vectors, ranks the two
hundred nearest `context_embeddings` rows of the family (`bill`,
`funding_grant_chunk`, `funding_notice_chunk`) by cosine distance under a
partial HNSW index, keeps the best chunk per record above a 0.35 similarity
floor, applies the family's filters and returns at most twenty-five canonical
records with a score, a snippet and a stable reference
(`congress_bill:<id>`, `federal_grant:<id>`, `sam_opportunity:<uuid>`).

Catalog 0.2.33 adds the closed input and result contract. The receiver refuses
a filter the family does not apply, and checks the answering tool, the echoed
query, the page bound (`total` equals the page size and never exceeds `limit`),
descending scores above the declared floor, references that name their record,
the family's filters on every record and an unchanged record shape. Oversized
or extra data fails rather than being silently clipped.

The wire fixture at `packages/contracts/test/fixtures/semantic-search.wire.json`
is hand-built from the Core projection, not a PostgreSQL capture; live
acceptance records the deployed shape. Tests exercise those bytes through the
receiver and the installed SDK MCP path over synthetic HTTP.

The model is told (family guidance and the `meri_reads` routing sentence) to
use these reads for find, compare, summarize and recommend questions by topic
or intent, then text-to-SQL for exact facts about the returned references, and
text-to-SQL alone for counts, fields, trends, joins and exact filters. Source
registration does not enable a deployment: the preview rosters list the
operations for approval, the edge rules and the Core allowlist are added by the
release owner, and live acceptance remains to be run.
