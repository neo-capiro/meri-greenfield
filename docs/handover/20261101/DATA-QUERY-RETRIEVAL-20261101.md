# Text-to-SQL, memory recall and mail as the model experiences them (1 November 2026)

Branch `fable/data-query-20261101` (Meri, from `main` 7888a2c5) and Core PR 393 on `fable/core-data-20261101` (from Core `main`
55bf0661, which carries PR 362). What the model receives is rendered on demand by the production composition:
`node apps/worker/conversation/reads/test/model-view-fixture.mjs` (asserted by `model-view.test.mjs`).

## What was weak

- **Text-to-SQL.** `results.mjs` still rendered a "Core SQL contract … grammar" notice from a `contract` field that Core 362's
  `describeEnvelope` no longer returns, so a describe page produced no notice. The `UNSUPPORTED_SQL` correction and the 0.5 `sql`
  argument description pointed at the retired contract. The SQL-first routing sentence was attached to the two SQL tools themselves.
  PostgreSQL's own message for `INVALID_QUERY` was dropped unless a position, hint or candidate came with it. The system prompt
  repeated two paragraphs the descriptors already state. On the Core side every public column comment except the budget-position
  amounts repeated the column name (Core PR 393 fixes that: formats, join hints and the `status`, `chamber`, `appropriation_type`
  vocabularies).
- **Memory.** `search_memory` reached the model with the registration-era descriptor and no statement of arguments, scope rule,
  page size, result fields or attribution; the prompt never said when to recall.
- **Mail.** The three mail reads carried no arguments, paging, result fields, filter rule or subject rule; a missing mailbox read as
  the generic `UNAVAILABLE`; the per-message `connectionStatus` was never surfaced; the prompt did not route email questions.
- **Live acceptance.** With no read mounted the model quoted harness vocabulary ("read-disabled", "UNAVAILABLE", "bounded session")
  and recommended a third-party API.

## What changed (Meri)

- `reads/guidance.mjs`: operational guidance for `search_memory` and the three mail reads (arguments with defaults, result fields,
  the two canonical mail questions, mailbox connection states `connected`, `needs_configuration`, `error`, `disabled` from Core's
  `engagement_connection_status`, the no-save rule) and precise `UNAVAILABLE` / `ACCESS_DENIED` / `INVALID_ARGUMENTS` hints;
  `UNSUPPORTED_SQL` and `PARAMETER_MISMATCH` state the correction. Model-facing text names what to do or tell the user, never Core.
- `reads/results.mjs`: dead contract notice removed; one orientation line per describe page, memory page and mail page. The memory
  line distinguishes `empty` (no approved memory matched) from `unavailable` (recall did not complete) and
  `unavailable_or_ineligible` (the item could not be read) and takes the page size from the response. The thread line continues
  only cut bodies (`preview`, `truncated`, a section with more) and reports `missing`/`unknown` bodies as not available. PostgreSQL
  diagnostics render for every PostgreSQL-reported refusal; a permission-denied or missing-schema message is replaced by a fixed
  sentence because Core 362 passes PostgreSQL's text through unsanitized (`translateDatabaseError` in
  `sql-reader-connection.ts`) and it would name an object outside the published source.
- `reads/tools.mjs`: the SQL-first sentence is not attached to the SQL tools; `SQL_TOOL_IDS` is the one definition.
  `reads/options.mjs`: routing only (SQL once per source, memory first for saved knowledge, mail tools for email); with no read
  mounted, or on `UNAVAILABLE` / `ACCESS_DENIED`, the model says in the user's terms that Capiro's data is not connected or not
  permitted, answers only what is not specific to Capiro's or the client's records, and never quotes internal words or recommends
  a third-party API or scraping. `reads/family-guidance.mjs`: mail and memory name their actual fields and states.
- `packages/contracts/retrieval-0.5/capiro-data.schema.json`: the `sql` argument no longer refers to the retired contract and does
  not restate the gate; the two 0.5 catalog rows and the installation-catalog digest pins follow the new bytes.

## Gates removed, with proof

- The `describe_capiro_data … page.contract` notice branch and its worker test. Proof: Core 362's `describeEnvelope`
  (`apps/api/src/meri/analytics/sql-query-output.ts`) returns `{…head, ok, relations, limits}` with no `contract`.
- No authorization, budget or validation gate was removed. The gateway's retained 0.2/0.3 SQL handlers still carry the `contract`
  and eight-relation-default branches for the pinned retained descriptors; they are off the mounted 0.5 path (follow-up).

## Catalog digest pins

Persisted skill selections pin the asset catalog digests in `packages/skills/assets.json` (unchanged). Installation receipts
compare a run's `baseCatalogSha256` with the running image's constant (`packages/skills/index.mjs`) and the worker's own
catalog hash (`reads/snapshot.mjs`); both ship in the same image, so nothing re-pins them. A run that straddles the deploy fails its
availability snapshot closed (no reads) and the next run is clean; this is the same behaviour as every earlier catalog edit.

## Tests

Per-file `node --test` on the Windows host; failing-test names compared against the untouched base 7888a2c5 in the same worktree.
New: `model-view.test.mjs`, `memory-mcp.test.mjs` (real MCP server → worker HTTP → control composer → signed memory adapter over
scripted Core pages and eligibility receipts), `mail-mcp.test.mjs`, `page-notices.test.mjs`. The inherited failures on this host
(gateway `mail-context`, `memory-context`, `memory-signed-dispatch`, `passive-projections`, `client-knowledge/read-adapter`, the
`84/48` family-count cases, intents `catalog`/`schema`) are stale fixtures on the base, unchanged here.

## What remains live-only

- A real mailbox grant and the real connection states; the no-mailbox, disabled and client-subject paths are scripted. Core's page
  carries the connection state only per returned message, so an empty page cannot report a disconnected mailbox from its bytes.
- Real memory publication and the save → approval → review flow.
- Running statements against the preview clone; the `status`, `chamber` and `appropriation_type` vocabularies come from the Core
  writers and reach `describe_capiro_data` only after Core PR 393 is applied to the clone.

## Recommendations beyond bug fixes

1. Publish a few stored sample values per enum-less text column (`policy_area`, `service`, `position_cycle`) in the describe metadata.
2. Retire the retained 0.2/0.3 SQL handler branches once the installation pins only 0.5.
3. Carry the mailbox connection state in the mail page envelope (not only per message) so an empty page can say the mailbox is off.
4. Return the scope label in `search_memory` `results[]`, not only in `records[].payload`.
5. Surface mailbox and memory availability in the server instructions from the control snapshot.
