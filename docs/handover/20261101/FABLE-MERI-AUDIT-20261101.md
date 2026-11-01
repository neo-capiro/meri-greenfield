# Fable Meri audit and completion report, 1 November 2026

Scope set by Neo: audit all of Meri in `meri-greenfield`, fix bugs, make the architecture more efficient without over-engineering (remove gates a lower layer already enforces, leave no dead code), verify client isolation and the AgentCore/SDK path for durable Claude-quality answers, explain the short answers, make text-to-SQL work well, strip the chat UI noise, make every feature in the 31 October packet functional and complete at source level, and list recommendations. Live acceptance is handed to a separate agent; nothing here claims live acceptance.

Source basis at start: `meri-greenfield` main `57004784` (PR 464), `capiro-frontend` main `2c9ecd30` (PR 419; releases cut from `codex/portfolio-ui-serving63-base-20261031`), `capiro-backend` `19cdf4b4` (PR 312; PRs target `backend-import`, there is no `main` on origin).

## 1. Why every answer came back short

Three independent causes in the SDK invocation path, fixed in PR 467 (merged):

1. **Output-token cap of 4096 per message.** `apps/control/conversations/usage.mjs` pinned `maxOutputTokens: 4096` for every run (forwarded as `CLAUDE_CODE_MAX_OUTPUT_TOKENS`). Sonnet 4.6 spends thinking tokens inside that ceiling, so a brief longer than a few paragraphs was cut mid-sentence. Now `SDK_MAX_OUTPUT_TOKENS = 32000`.
2. **The Claude Code preset tells the model to be terse.** The pinned CLI 2.1.295 preset contains "Keep your responses short and direct while doing the work just as thoroughly." The append in `apps/worker/conversation/options.mjs` now states that Meri answers in a chat application, that the brevity rule does not apply, and asks for complete, structured Markdown sized to the question, finishing every section, without naming tools, hooks, run state or budgets. The preset is retained as Neo's standing rule requires.
3. **Selected-skill runs had a $0.001 model budget.** `activity.mjs` divided each manifest's tool-charge budget `maxCostMicroUSD` (1000 micro-units) into the SDK dollar budget. Every Bill Watch, commitments audit, relationship brief or cited report run would have stopped after its first model call. The tenant model policy is now the model budget.

A fourth limiter, the 60-second skill runtime pinned in every manifest, is fixed by PR 477: sixteen successor skill versions with `maxRuntimeSeconds 600`, offered to new selections while persisted pins keep resolving.

## 2. Client isolation and the AgentCore/SDK path

Reviewed `apps/runtime/agentcore-query.mjs`, `agentcore-execution.mjs`, `agentcore-workspace.mjs`, `conversation-identity.mjs`, `sdk-session-runtime.mjs`, `apps/worker/conversation/{options,provider,activity}.mjs`, `apps/control/conversations/service.mjs`.

What holds:
- One AgentCore runtime session per conversation. A next turn reuses the predecessor's session only when it is settled, not stopped, and has the same tenant, actor, conversation, scopes and versions; otherwise a fresh session id is minted. The workspace identity hashes tenant, actor, conversation and session id. No path shares a session across conversations or clients.
- The SDK child gets an explicit environment only: `HOME` and `cwd` are the conversation workspace, `TMPDIR` a private per-run sibling (PR 458), credentials are the task role or a scoped API key, and a prohibited-variable list refuses ambient provider, AWS and cache overrides. Permission rules allow `Read`/`Edit` only under the conversation cwd, `blockReadsOutsideWorkingDirectories` is on, `settingSources` is empty, Bash is disallowed without a sandbox attestation, `NotebookEdit` and `AskUserQuestion` are admitted only by the capability fragment.
- Every control operation re-reads the authenticated session and current conversation state and refuses on tenant, actor, conversation, run or scope mismatch. PR 478 lets only `message.delta` publications reuse an observation at most 2 s old, keyed by credential and binding, dropped on any refusal and never from a cleanup pass; revocation reaches a streaming run within 2 s.
- Durability: control-mirrored session store with batched flush, checkpoints through the lifecycle owner, next turns resume the SDK session, usage recorded once per claimant with explicit unavailable states, and (PR 478) a question still pending when a run ends is settled as cancelled inside the terminal transaction so a reload never shows an answerable question on a stopped run.

Efficiency changes made under Neo's rule (lower layer proven, duplicate deleted):
- Streaming: deltas now fold for a 200 ms clock window instead of one control round trip per delta (PR 478).
- The worker's per-read availability re-fetch across all 65 read families is gone; the control reads owner refuses from its own fresh snapshot on every execute (PR 476).
- Memory decision pre-check gone; Core's decision routes lock only a pending candidate (PR 470).
- Client-side upload identity gate gone; the closed request admission already binds bytes to the declaration (PR 475).
- Search-input re-normalization, a prefix helper and a selection validator gone (PR 472); route-level export recompile, history re-comparison, MIME pre-check and a second USLM scope limit gone (PR 473); gate-side answer re-validation and a tautological run-binding check gone (PR 478); five hard-coded "which versions have a compiler" lists collapsed into the assets registry (PR 477).
- Dead code deleted with each change: `edit-sessions/activation.mjs`, `artifacts/filing.mjs`, `native/checks.mjs` and `workbook_cells.py`, question `recover`/`outstanding`/events `read`, test-only exports, the unreachable `DRAFT_EMPTY_RESULT`/`DRAFT_PREPARATION_REFUSED` codes.

## 3. Text-to-SQL

Finding that changed the design: the text-to-SQL "engine" is Claude writing PostgreSQL inside the SDK loop; the SDK has no text-to-SQL feature of its own and Meri already uses it the right way (describe → author SQL → `query_capiro_data` → answer). The compiler sat in Core (`sql-query-compiler.ts`), parsed the model's SQL against a closed allow-list and regenerated it. Run against 58 statements it refused string literals, `SELECT *`, `IN`, `BETWEEN`, `NOT`, `LIKE`, `CASE`, `COALESCE`, casts, arithmetic, every function, window functions, subqueries, `OFFSET`, `UNION` and `NULLS LAST`, with errors naming no token. From the model's side that is "text-to-SQL does not work".

Decision (Neo): that gate duplicates what PostgreSQL enforces for the two dedicated readers. Core PR 362 removes it: a 54-case integration spec under both reader roles proves the database refuses writes, DDL, unpublished tables, `visible_clients`, other schemas, `SET ROLE`, cross-tenant rows and runaway statements; the thin gate keeps only what the database cannot do (one `SELECT`/`WITH` statement, no `SET`/`COPY`/transaction control, a function blocklist including `set_config`, which the spec showed a reader can otherwise call inside a SELECT to read another tenant, a LIMIT wrapper at 1000, byte caps, no public/private mixing). The model's SQL runs verbatim; errors return PostgreSQL's `message`, `position`, `hint`, SQLSTATE and nearest valid names; a migration publishes eight `meri_public` views with JSON metadata comments so `pg_catalog` is the single registry that `describe_capiro_data` reads; the compiler, its registries and projections are deleted.

Meri side: PR 468 (merged) told the model the contract and mapped refusals to corrections; PR 480 (draft, rebasing) accepts both envelope generations through the transition, renders PostgreSQL diagnostics to the model, rewrites the contract text to the real one, and raises the tool-description cap so nothing is sliced mid-sentence. Deploy order: PR 480 before Core 362; after Core 362 is live, the named follow-up `fable/sql-envelope-retire-old-generation` deletes the old generation. Open point: Core 362 drops the column cap while Meri still caps results at 32 columns and says so to the model; one side should own that number.

Coverage the published relations cannot answer (for the acceptance agent and product): bill text, summaries and actions history; committee assignments and referrals; FPDS/USAspending awards (only SAM notices); state bill text and sponsor lists; regulatory dockets and hearing transcripts; mail bodies, documents and notes; strategy history; cross-client aggregates in client mode.

## 4. Chat UI

Frontend PR 434 (reviewed, merge) removes the "Ready / Complete / You can send your next message / Write next message" card, the always-open "Pause and recovery" block, the per-run "Earlier run N / Current run / View recorded usage" sections, the empty "Actions for your approval" panel with its Refresh button, the per-answer status pill for completed turns, and the tool-activity rows under answers; renders Markdown through the existing streamdown component; folds sources, usage, tool activity and checkpoint actions into one closed disclosure that only appears when there is something in it. Frontend PR 438 (stacked on 434) keeps the transcript on screen when the post-run access check goes unanswered and offers "Check access again" beside the composer, opens a bare `/meri` with the member's saved default client or General instead of the two-click "Choose a scope" landing, and removes the "Saved conversation history loaded." line. Both cherry-pick cleanly onto the release branch.

## 5. Live outage observed during the audit (1 November, 00:00 to 00:30 UTC)

The Sonnet visual-audit session could not complete a prompt on https://app.capiro.ai/meri. Read-only AWS diagnosis: every Meri and Core ECS service was healthy; control telemetry shows the prompt's run completed in 25.7 s with 82 delta publications; Core logged PostgreSQL `57014` statement timeouts from `IntelligenceService` profile-v1 sources, `getHearingAlerts` and `listMailThreads` (13 to 56 per hour all day); control recorded Core calls as unanswered; the serving database `capiro-newstack-preview-clone` was at its 8 ACU ceiling and 100% CPU. The browser then discarded the finished answer because its access re-check failed, and the retry got 503 on input allocation.

Actions: with Neo's go-ahead the cluster's `MaxCapacity` was raised 8 → 16 ACU at about 01:40 UTC (applied immediately). Core PR 361 gives Meri's authority reads their own Prisma pool, moves schedulers to a background pool, bounds the profile-v1 fan-out, caches tracked bills per client, and adds concurrent indexes for the slow statements (Release steps in the PR). Frontend PR 438 stops the UI from discarding a completed answer on an unanswered re-check.

## 6. Source merges and PRs

| Repo | PR | What | State |
|---|---|---|---|
| meri-greenfield | 467 | 32k output tokens, chat response style, skill model budget, this report | merged |
| meri-greenfield | 468 | SQL contract to the model, refusal corrections, count line, 5xx mapping | merged |
| meri-greenfield | 470 | memory proposer review state machine, M18 to M22 source map | merged |
| meri-greenfield | 471 | connected-app reads, scopes, revocation (M11, M12) | merged |
| meri-greenfield | 472 | web search results fix (limit mismatch withheld results), browser refusal codes, workflow hand-back, selected tab (M05, M13 to M15) | merged |
| meri-greenfield | 473 | federal drafting workbench: USLM, explicit refusals, approval records, exports, redline (M34) | merged |
| meri-greenfield | 474 | meetings, outreach, proposals, routines, objectives, feedback (M35 to M41) | merged |
| meri-greenfield | 475 | uploads, attachments, Office, PDF, cited reports (M16, M17, M23 to M29) | merged |
| meri-greenfield | 476 | reader families reconciled, result states, award identity, Money Flow, candidate selection (M32, M33) | merged |
| meri-greenfield | 477 | sixteen 600 s skill versions, compiler registry, Opus and effort catalog rows (M10, M03) | merged |
| meri-greenfield | 478 | fold window, delta-authority reuse, durable question cancellation (M01, M04, M06, M07, M09) | merged |
| meri-greenfield | 480 | accept Core 362 envelope, PostgreSQL diagnostics, real SQL contract | draft, rebasing; merge last, deploy before Core 362 |
| capiro-backend | 361 | authority lane, background lane, bounded profile-v1, indexes | open, reviewed: merge |
| capiro-backend | 362 | SQL statement gate replaces the compiler; `meri_public` views; compiler deleted | open, reviewed: merge after Meri 480 |
| capiro-frontend | 434 | clean chat, Markdown answers | open, reviewed: merge, cherry-pick to release branch |
| capiro-frontend | 438 | transcript kept on unanswered re-check, default scope opening, status line removed | open, reviewed: merge after 434 |

Infrastructure: `capiro-newstack-preview-clone` MaxCapacity 8 → 16 ACU (done). No deployment was performed; Release owns shipping.

## 7. Packet items: source status and what stays live-only

| Item | Source work | Live-only remainder |
|---|---|---|
| M01 core chat, continuity | 467, 478; lineage and replay verified | streaming/follow-up/reload/access-loss on preview |
| M02 usage, composer recovery | accepted evidence reused | ship FE 4018 image |
| M03 models, effort, budgets | 477: Opus row `available:false`, pending Sonnet efforts, budget tests | Release flips rows after qualification; M0 to M7 cases |
| M04 SDK question tool | 478: durable cancel, ordered records, expiry resolves call | question card and answer on preview |
| M05 AWS web search | 472: limit/contract mismatch, query bound refusal, stream parsing, model guidance | gateway target, grant, "two most recent articles" case |
| M06 notebook editing | 478 verified admission and capture | fixture case on preview |
| M07 workspace file tools | 478 verified rules and lineage | matrix on preview |
| M08 Bash/Python native | untouched (native 463 owners) | physical qualification |
| M09 run controls, forks, children | 478; UI 434 | live matrix |
| M10 skills, QuickActions | 467 budget, 477 successor versions and refusals | picker cases on preview |
| M11, M12 MCP | 471 | real provider grant, real OAuth round trip |
| M13, M14, M15 browser, sites, tab | 472 | physical host, real site, distributed extension |
| M16, M17 uploads, attachments | 475 | per-format resource images, Core filing version contract |
| M18 to M22 memory, learning, notifications | 470; Core-side gaps recorded (deferral bound, retention policy, notification 404 causes) | Core fixes, real producer witness, real ACK |
| M23 to M29 documents, Office | 475 | renderer/LibreOffice/Collabora images, Office 47 build, fidelity corpus |
| M30 primary text-to-SQL | 468, 480, Core 362 | DB qualification of roles and views, representative live answers |
| M31 Research portfolio | untouched (PRs 453 to 461 by owners) | DB closure, composition |
| M32, M33 readers, graph | 476 | real serving populations |
| M34 legislative drafting | 473, plus Hermes PR 479 | official source fetch, renderer image, frontend routes |
| M35 to M41 business families | 474; undefined business rules recorded as explicit refusals with proposals | per-family live cases; Core contract additions listed in 474 |

## 8. Recommendations beyond bug fixes

1. **Keep the preset, own the voice.** PR 467 overrides the brevity rule; if answers still read "engineer-ish" after a week of real use, add one paragraph defining Meri's voice and audience to the append rather than replacing the preset.
2. **Raise tenant limits with the catalog flip.** `maxTurns 40`, `maxBudgetMicroUsd 5,000,000` per run through tenant settings when Release flips Opus 4.6 and explicit efforts (rows are in `policy.json`, disabled).
3. **Finish the SQL transition in order.** Meri 480 → Core 362 → `fable/sql-envelope-retire-old-generation`; decide the column cap; then enrich `describe_capiro_data` from the view comments Core 362 writes.
4. **Publish Core's grammar and relation catalog as one versioned descriptor** Meri reads at runtime, so the tool description never drifts from the gate again.
5. **Delete `query_global_data` and `list_global_datasets`** if research no longer needs them; they are the last consumers of the raw-table grants and of `global-dataset-registry.ts`.
6. **Core lanes: keep `CORE_DB_LANES=off` only as this release's rollback switch** and remove it after a week of lanes in service.
7. **Remove `apps/control/commands/source-http.mjs`** after re-basing the twelve `commands-*` test fixtures on the production source port (left by PR 475 for its owner).
8. **Preview acceptance should include response-length and Markdown checks**: a 400-word brief is not truncated and a table renders. Both would have caught this regression.
9. **One model catalog source of truth** across `policy.json`, `settings/documents.mjs` and `usage.mjs`.
10. **Frontend: ship 434 and 438 together** onto the release branch; the clean chat without the transcript-preserving fix would still lose answers on a slow Core.

## 9. Checks, evidence, unrun

- Every PR body carries its own test table compared against untouched `main` on this Windows host; failure-name sets matched base in every case (host-bound: Linux sandbox, symlink, PostgreSQL, real SDK, LibreOffice, Codex-host Python). Core 362's 298-test analytics suite ran against an isolated PostgreSQL 16; Core 361's suites ran without a database.
- Unrun: PostgreSQL-backed and Linux-only Meri suites (Release's Linux gate), Core `*.pg.spec.ts`, frontend `meri-m1-live`, all live acceptance.
- Incident during the work: a session's `git worktree remove --force` followed dependency junctions and emptied the shared `node_modules` stores of three sibling checkouts; all seven stores were reinstalled from their own lockfiles with exit 0. No source, git data or database was affected.
- Evidence: PR bodies and comments ("Reviewed by Fable"), `C:\dev\fable-meri-20261031\VISUAL-AUDIT-20261101.md` with five screenshots, this report.
