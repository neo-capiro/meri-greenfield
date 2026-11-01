# Text-to-SQL, memory recall and mail as the model experiences them (1 November 2026)

Branch `fable/data-query-20261101` (Meri, from `main` 7888a2c5) and `fable/core-data-20261101` (Core, from `main` 55bf0661, which carries PR 362).
What the model receives before and after this change is rendered by the production composition in
[READ-MODEL-VIEW-BEFORE.md](READ-MODEL-VIEW-BEFORE.md) and [READ-MODEL-VIEW-AFTER.md](READ-MODEL-VIEW-AFTER.md)
(`apps/worker/conversation/reads/test/model-view-fixture.mjs`, asserted by `model-view.test.mjs`).

## What was weak

- **Text-to-SQL.** `results.mjs` still rendered a "Core SQL contract … grammar" notice from a `contract` field that Core 362's
  `describeEnvelope` no longer returns (PR 486 retired the envelope on the Meri side); the describe page therefore produced no
  notice at all. The `UNSUPPORTED_SQL` correction and the `sql` argument description in `retrieval-0.5/capiro-data.schema.json`
  told the model to "use the optional versioned contract" and what to do "when an older Core omits contract". The SQL-first routing
  sentence was attached to `describe_capiro_data` and `query_capiro_data` themselves ("call describe_capiro_data first … use this
  read for the typed record path"). PostgreSQL's own message for `INVALID_QUERY` (for example `could not determine data type of
  parameter $1`, SQLSTATE 42P18) was dropped because the diagnostics line required a position, hint or candidate. The system prompt
  repeated two long paragraphs of argument and result detail that the tool descriptions already state. On the Core side every
  public column comment except the budget-position amounts repeated the column name, so describe output carried no identifier
  format (`119-hr-1234`), no value vocabulary for `status`, `chamber` or `appropriation_type`, and no join hints.
- **Memory.** `search_memory` reached the model with the frozen registration-era descriptor ("Inspect the declared source projection
  through a qualified source owner", "Trusted context is an adapter assertion …", "Local validation does not qualify …") and no
  statement of its arguments, scope rule, page size, result fields or attribution; the system prompt never said when to recall.
- **Mail.** The three mail reads reached the model as "Prepare incomplete stored message candidates under current trusted mailbox
  and client authorization" with no arguments, paging, result fields, the filter rule or the subject rule; a missing mailbox read as
  the generic `UNAVAILABLE` text, and a disconnected mailbox was invisible (every candidate carries `connectionStatus`, which nothing
  surfaced). The system prompt did not route email questions.

## What changed (Meri)

- `reads/guidance.mjs`: operational guidance for `search_memory`, `mail_list_messages`, `mail_search_messages` and `mail_read_thread`
  (arguments with defaults, result fields, the two canonical questions, stale-mailbox and no-save rules), precise `UNAVAILABLE`,
  `ACCESS_DENIED` and `INVALID_ARGUMENTS` hints, and the `UNSUPPORTED_SQL` / `PARAMETER_MISMATCH` corrections stated as Core 362's
  gate rules.
- `reads/results.mjs`: the dead contract notice is gone; a describe page gets one orientation line (relations described, spell names
  exactly, enum filters, rowLimit bounds); memory pages get one line (items returned, page size, attribution, "empty is not
  absence", partial content, Core's argument error); mail candidate and thread pages get one line (counts, `nextOffset`,
  preview incompleteness, incomplete body sections, mailbox connection status with the reconnect hint). PostgreSQL diagnostics now
  render for every PostgreSQL-reported refusal (`INVALID_QUERY`, `UNKNOWN_RELATION`, `UNKNOWN_FIELD`), not only when a position,
  hint or candidate is present.
- `reads/tools.mjs`: the SQL-first routing sentence is no longer attached to the two SQL tools.
- `reads/options.mjs`: the prompt is routing only (SQL first for structured questions; `search_memory` first for saved knowledge,
  attributed, and "saving is a proposal, never say saved"; mail tools for email, stored mail not the live inbox), one block per
  mounted path, about a third of the previous length.
- `reads/family-guidance.mjs`: `mail` and `client-knowledge-memory` name the actual result fields and states.
- `packages/contracts/retrieval-0.5/capiro-data.schema.json`: the `sql` argument states the statement rules and refusal diagnostics
  instead of the retired contract; the catalog rows for `describe_capiro_data@0.5.0` and `query_capiro_data@0.5.0` and the two
  installation-catalog digest pins (`packages/skills/index.mjs`, `current-installation.test.mjs`) follow the new bytes.

## Gates removed, with proof

- The `describe_capiro_data … page.contract` notice branch in `results.mjs` and its worker test. Proof: Core 362's `describeEnvelope`
  (`apps/api/src/meri/analytics/sql-query-output.ts`) returns `{…head, ok, relations, limits}` with no `contract`, so the branch could
  never execute against the served Core; `sql-feedback.test.mjs` and `capiro-data.test.mjs` now assert the Core 362 shape.
- No authorization, budget or validation gate was removed. Left in place on purpose: the gateway's retained 0.2/0.3 handlers in
  `apps/gateway/sources/capiro-data/handler.mjs` still carry the `contract` and eight-relation-default branches for the pinned
  retained descriptors (`sql-contract.test.mjs`); they are not on the mounted 0.5 path and belong to the retained-pin owner.

## Tests versus main

Run per file with `node --test` on this Windows host; compare by failing-test name against the untouched base 7888a2c5 in the same
worktree (`node_modules` junctioned). New suites: `model-view.test.mjs` (5), `sql-analyst-questions.test.mjs` (15),
`memory-mcp.test.mjs` (7, real MCP server → worker HTTP → control composer → signed memory adapter over scripted Core pages and
eligibility receipts), `mail-mcp.test.mjs` (7, same path over the scripted mail pages: connected, empty, no mailbox, denied subject,
unrestricted search, thread read). Changed expectations: `sql-feedback`, `sql-primary-guidance`, `family-guidance`, `capiro-data`,
`server` (the mail page now carries one notice), `skills/sql-consumers`. The after/before comparison is in the PR body; the
inherited failures on this host (gateway `mail-context`, `memory-context`, `memory-signed-dispatch`, `passive-projections`,
`client-knowledge/read-adapter`, the `84/48` family-count cases, intents `catalog`/`schema`) fail identically on the base and are
stale fixtures, not host-bound (see `wt-memory` and `wt-readers-graph` notes).

## The twelve analyst questions (`sql-analyst-questions.test.mjs`)

Each answerable row is checked against the surface Core 362 publishes (`capiro-published-surface.fixture.json`, captured from the
migration's view and column comments) with a test oracle mirroring the gate: one `SELECT`/`WITH`, contiguous `$n` matching the
parameters, no blocked keyword, one source, every `FROM`/`JOIN` name published and every `alias.column` a published column.

| # | Question | Path | Result |
|---|---|---|---|
| 1 | Members who cosponsored the most bills in the 119th | `congress_bill_cosponsors` ⋈ `congress_bills`, `withdrawn_date IS NULL`, `COUNT(DISTINCT bill_id)` | valid |
| 2 | Bills introduced per month in 2025 | `date_trunc('month', introduced_date)`, two `$n::date` bounds | valid |
| 3 | Bills whose title mentions "hypersonic" | `title ILIKE $1` with `%hypersonic%` | valid |
| 4 | The selected client's tracked bills (client scope) | `source client_records`, `client_tracked_bills WHERE client_id = $1` | valid |
| 5 | PB FY2026 assertions for one PE by fiscal year | `program_element_budget_positions`, `position_cycle = 'pb_fy2026'`, `value_kind = 'total'` | valid |
| 6 | Texas senators who sponsored 119th bills | `congress_bills` ⋈ `congress_members` on `sponsor_bioguide_id`, `chamber = 'senate'`, `state = 'TX'` | valid |
| 7 | Distinct bills carrying one subject | `COUNT(DISTINCT bill_id)` per the subjects limitation | valid |
| 8 | 119th bills per legislative stage | `GROUP BY status` | valid |
| 9 | Largest FY2026 PB project totals under one PE | project positions ⋈ projects on `(pe_code, project_code)` | valid |
| 10 | Republican-sponsored bills since 2025, page two | keyset `id > $3 ORDER BY id LIMIT 200` | valid |
| 11 | RDT&E program elements first seen in FY2024 or later | `appropriation_type = 'RDT&E'`, `first_seen_fy >= $2` | valid |
| 12a | Bills introduced after March with `introduced_at` (typo) | PostgreSQL 42703 → notice names position and `Did you mean: introduced_date`; corrected statement valid | corrected |
| 12b | LDA registrants who lobbied for the client | no published relation or column; `search_lda_filings` (disclosures) carries the SQL-first sentence that routes back to the typed reader | routed |

Refusal paths asserted: two statements, a data-modifying keyword, unreferenced parameters, an untyped parameter (42P18),
a client relation in a public query, a misspelled relation (candidates), a timeout and an oversized result.

Values the questions rely on that only the Core change publishes: `status` stages, `chamber` `house|senate`,
`appropriation_type` `RDT&E|PROC|OM`, the `119-hr-1234` id format and `pb_fy2026` cycles (Core migration
`20281101180000_capiro_data_public_column_meaning`).

## What remains live-only

- A real mailbox grant: the no-mailbox, disconnected and client-subject paths are scripted; the Core `job.readMailboxes` inventory
  and the Microsoft 365 / Google Workspace connection states (`needs_configuration`, `connected`, `error`, `disabled`) were not
  exercised against a live tenant.
- Real memory publication: approved items, eligibility refusals and the `metadata_only` path are scripted; no governed memory was
  approved on preview during this work, and the `save_memory` → proposal → review flow was not driven end to end.
- Serving-data answers: the twelve statements are admitted by the gate oracle and the published surface, but their rows were not
  run against the preview clone; the published `enum` values for `status`, `chamber` and `appropriation_type` come from the Core
  writers (`deriveBillStage`, `CongressMember.chamber`, `program_element.appropriation_type`), not from a scan of stored rows, and
  party codes are described rather than enumerated for that reason.
- The Core migration applies to the preview clone only through Release (snapshot first); describe output changes only after it.

## Recommendations beyond bug fixes

1. Have `describe_capiro_data` carry a few stored sample values per enum-less text column (`policy_area`, `service`,
   `position_cycle`) from a periodic scan, so the model stops guessing spellings; the comment schema already admits `enum`, a
   `samples` key would need `PublishedColumn` and the retrieval 0.5 `CapiroDataField` schema.
2. Retire the retained 0.2/0.3 SQL handler branches (`contract`, eight-relation default) once the installation pins only 0.5; they
   are the last code that knows the retired envelope.
3. Give the mail family a `connectionStatus` enum in the 0.2 contract (`EngagementConnectionStatus`) so the stale-mailbox notice can
   name the exact remedy per state instead of one generic reconnect hint.
4. Add a Core `search_memory` option to return the scope label (`personal|client|firm`) in `results[]`, not only in
   `records[].payload`, so attribution needs no second look into the record.
5. Surface mailbox and memory availability in the server instructions ("Available now: …") from the control snapshot, so the model
   knows before the first call whether a mailbox is connected rather than learning it from a refusal.
