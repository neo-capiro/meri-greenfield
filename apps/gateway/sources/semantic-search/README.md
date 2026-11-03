# Native semantic reads over public bills, grants, contract opportunities, DIBBS solicitations and SBIR topics

`semantic_search_bills@0.2.0`, `semantic_search_grants@0.2.0`,
`semantic_search_contract_opportunities@0.2.0`,
`semantic_search_dibbs_solicitations@0.2.0` and
`semantic_search_sbir_topics@0.2.0` use the fixed Core routes
`/api/clio/tools/<id>`. The existing control owner checks current execution and
native Core authority; the gateway sends the actor's native Core credential and
the internal service secret, exactly as the other stored native reads. No
credential, grant or separate search authority is created, and no client wall
applies: every ranked record is public (tenant-less) data.

Core (capiro-backend `apps/api/src/meri/semantic-search*.ts`) embeds the query
with the same model that wrote the stored vectors, then selects per family. The
three standing families rank the two hundred nearest `context_embeddings` rows
(`bill`, `funding_grant_chunk`, `funding_notice_chunk`) by cosine distance under
a partial HNSW index. The two active families do not preselect by index: Core
filters the eligible active records of the family first (canonical activity,
current identity, current-model and text-bound nonzero vectors, plus the
requested filters) and then takes the exact unrounded candidates up to the same
two-hundred window, so a filter-qualified page is not distorted by an
index preselection. Both paths keep the best chunk per record above a 0.35
similarity floor and return at most twenty-five canonical records with a score,
a snippet and a stable reference (`congress_bill:<id>`, `federal_grant:<id>`,
`sam_opportunity:<uuid>`, `tango_dibbs_solicitation:<uuid>`,
`tango_sbir_topic:<uuid>`). A provider record id is a separate display fact and
never replaces the canonical reference. Exact ranking may still require scanning
eligible vectors; no native query plan, timing or eight-second budget is claimed
here.

Catalog 0.2.34 adds the closed input and result contract. The receiver refuses
a filter the family does not apply, and checks the answering tool, the echoed
query, the page bound (`total` equals the page size and never exceeds `limit`),
descending scores above the declared floor, references that name their record,
the family's filters on every record and an unchanged record shape. Oversized
or extra data fails rather than being silently clipped.

The two active families add their own rules. DIBBS and SBIR share the stricter
`ActiveSemanticSearchInput` (`query`, `limit`, `agency`, `dateFrom`, `dateTo`
only). The bounds are Core's own and are measured in UTF-16 code units on the
values Core measures: a normalized query of 3..2000 units and a trimmed agency of
1..240 units. A JSON Schema length keyword counts code points of the raw string,
which is not what Core measures: whitespace padding makes the raw string longer
than the value Core normalizes, so any raw query length keyword would refuse
producer-valid input. The advertised active input therefore carries no length
keyword for `query` or `agency`; the receiver normalizes the query and decides
3..2000 code units with `String.prototype.length`, and measures the agency after
trimming. That is why a two-code-point surrogate query and a whitespace-padded
query are admitted, while a 121-code-point surrogate agency (242 units) is
refused. Raw size is still bounded by the existing inert-JSON operation contract
applied to every request (100000 nodes, depth 64, 16 MiB) and by the tool-call
argument byte guard; this change adds no new raw cap. The optional `agency`, `dateFrom` and `dateTo` values are
deliberately refused when null or blank rather than normalized to absent: the
final wire allows this stricter caller subset, and an absent filter is expressed
by omitting the key. `agency` is passed through unchanged to Core's
case-insensitive SQL ILIKE, so `%` and `_` keep their wildcard meaning and no
exact-agency match is claimed. An inclusive close-date bound excludes a null
date and a null date stays unknown. Each active result
carries `passage` provenance bound to the record by canonical **and** provider
id with `offsetBasis plain_text_normalized_utf16`: `documentHash` identifies the
normalized full text, `attachmentContentSha256` the archived bytes, and they are
distinct facts; `start`/`end` are offsets of the whole stored chunk, so they need
not equal the 400-character snippet. DIBBS passages are `opportunity_attachment`
rows with `local_parser` extraction, a boolean `truncated` and a `documents`
count block that is exactly one attachment, one with text and one indexed, whose
`truncated` count must agree with the cited passage; SBIR passages are
`tango_sbir_topic` provider synopses with null archive facts, a null extraction
method and no `documents` block, and an SBIR hit must carry the provider's open
activity spelling with no closed, expired or complete parent status (a null
status stays unknown and casing is never rewritten). Coverage is
the active stored corpus of the family, independent of query filters, and a
page is the nearest matches among indexed records, never eligibility or an
exhaustive list. Snapshot times bound the evidence, no continuous change at the
same URL is claimed, and an SBIR synopsis is not the full solicitation.

The wire fixture at `packages/contracts/test/fixtures/semantic-search.wire.json`
is hand-built from the Core projection, not a PostgreSQL capture; the two active
fixtures are marked PROJECTED. Live acceptance records the deployed shape. Tests exercise those bytes through the
receiver and the installed SDK MCP path over synthetic HTTP.

The model is told (family guidance and the `meri_reads` routing sentence) to
use these reads for find, compare, summarize and recommend questions by topic
or intent, then text-to-SQL for exact facts about the returned references, and
text-to-SQL alone for counts, fields, trends, joins and exact filters. Source
registration does not enable a deployment: the preview rosters list the
operations for approval, the edge rules and the Core allowlist are added by the
release owner, and live acceptance remains to be run. The two active reads also
remain unexposed until Release verifies the concrete selected model, the Core
bindings and a coherent Data/Core/Meri unit.
