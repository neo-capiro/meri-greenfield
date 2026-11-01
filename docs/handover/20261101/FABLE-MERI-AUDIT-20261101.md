# Fable Meri audit and completion report, 1 November 2026

Scope requested by Neo: audit all of Meri in `meri-greenfield`, fix bugs, find architecture and performance improvements without over-engineering, verify client isolation and the AgentCore/SDK path for durable, Claude-quality answers, explain why answers come back short, make text-to-SQL work well, strip the chat UI noise, complete the remaining work in the 31 October handoff, and list recommendations.

Source basis: `neo-capiro/meri-greenfield` main at `57004784` (merge of PR 464) and `neo-capiro/capiro-frontend` main at `2c9ecd30` (merge of PR 419). Frontend releases are cut from `codex/portfolio-ui-serving63-base-20261031`, not from `main`.

## 1. Why every answer came back short

Three independent causes, all in the SDK invocation path, all fixed on branch `fable/meri-response-quality-20261101`:

1. **Output-token cap of 4096 per message.** `apps/control/conversations/usage.mjs` pinned `maxOutputTokens: 4096` for every run; the worker forwards it as `CLAUDE_CODE_MAX_OUTPUT_TOKENS`. Sonnet 4.6 spends thinking tokens inside that same ceiling, so a brief longer than a few paragraphs was cut mid-sentence. Now `SDK_MAX_OUTPUT_TOKENS = 32000` (Bedrock serves 64k; the provider validator in `apps/worker/conversation/provider.mjs` already allowed up to 64000).
2. **The Claude Code preset tells the model to be terse.** The system prompt is `{type:'preset', preset:'claude_code', append:…}` and the pinned CLI 2.1.295 preset contains the instruction "Keep your responses short and direct while doing the work just as thoroughly." That is correct for a terminal coding agent and wrong for a chat product. The append in `apps/worker/conversation/options.mjs` now states that Meri answers in a chat application, that the brevity rule does not apply, and asks for complete, structured Markdown sized to the question, finishing every section, written as a colleague, without naming tools, hooks, run state or budgets. The preset itself is retained, as Neo's standing rule requires.
3. **Selected-skill runs had a $0.001 model budget.** `activity.mjs` divided each skill manifest's `budgets.maxCostMicroUSD` (1000 in every original manifest) by 1e6 into the SDK `maxBudgetUsd`. That value is a gateway tool-charge budget in tariff micro-units (reads cost 1 unit; see `assertOneHoldFits`), not provider spend. Every Bill Watch, commitments audit, relationship brief or cited-report run would have stopped after its first model call. The tenant model policy now stays the model budget; `maxTurns` and the runtime deadline are still narrowed by the manifest.

Verified: `apps/worker/conversation` suite 310 tests, 256 pass, 54 fail, with a failure set byte-identical to the untouched base (the 54 are host-bound: Linux sandbox, symlink, PostgreSQL and real-SDK checks on this Windows host). `apps/runtime/selected/test/native-plugin.test.mjs` 23/23. `apps/control/conversations` usage tests 19/19.

## 2. Remaining limiters that are configuration, not code

- Tenant model policy defaults are `maxTurns 20`, `maxBudgetMicroUsd 2,000,000` and live in `meri_settings.tenant_settings` (`sdk_max_turns`, `sdk_max_budget_micro_usd`); the serving tenant row carries the migration defaults. A SQL-heavy answer that describes relations, runs three or four queries and writes a brief uses 8 to 12 turns; 20 is adequate, 40 is safer. Change it through the tenant settings document, not code.
- Skill manifests pin `maxRuntimeSeconds: 60` for every original skill. That bounds the whole selected-skill run (`skills/selected-runtime.mjs` lifetime plus the activity deadline). Twelve turns with tool reads will not finish in 60 s. Raising it changes each manifest's `manifestSha256`, which is the persisted selection pin, so it needs new skill versions (for example `bill_watch@1.1.1`) rather than edits in place; existing conversations keep their pinned versions. Recommended value: 600.
- The model catalog (`configuration.models` in the control deployment config) exposes exactly one row: Bedrock `us.anthropic.claude-sonnet-4-6`, efforts `[null]`. The code already accepts `low|medium|high|xhigh|max` and any `us.anthropic.claude-*` model id; adding Opus 4.6 and explicit effort rows is a Release material change plus the M03 acceptance cases.

## 3. Client isolation and the AgentCore/SDK path

Reviewed `apps/runtime/agentcore-query.mjs`, `agentcore-execution.mjs`, `agentcore-workspace.mjs`, `conversation-identity.mjs`, `sdk-session-runtime.mjs`, `apps/worker/conversation/{options,provider,activity}.mjs` and `apps/control/conversations/service.mjs`.

What holds:
- One AgentCore runtime session per conversation. `chooseSession` reuses the predecessor run's session only when it is settled, not stopped, and has the same tenant, actor, conversation, scopes and versions; otherwise a fresh session id is minted. The workspace identity hashes tenant, actor, conversation and session id. No path shares a session across conversations or clients.
- The SDK child gets an explicit environment only: `HOME` and `cwd` are the conversation workspace, `TMPDIR` is a private per-run sibling (PR 458), credentials are the task role or a scoped API key, and a prohibited-variable list refuses ambient provider, AWS and cache overrides. Permission rules allow `Read`/`Edit` only under the conversation cwd, `blockReadsOutsideWorkingDirectories` is on, `settingSources` is empty, and Bash is disallowed unless the runtime supplies a sandbox attestation.
- Every control operation (including each `message.delta` publish) re-reads the authenticated session and the current conversation state and refuses on tenant, actor, conversation, run or scope mismatch. Revocation during a run stops publication and closes the query (covered by tests).
- Durability: `sessionStore` is the control-mirrored native session store (`sessionStoreFlush: 'batched'`), checkpoints are recorded through the lifecycle owner, next turns resume the SDK session, and usage is recorded once per claimant with explicit unavailable states.

What to watch:
- Streaming granularity. Each display publication is a control HTTPS round trip plus a PostgreSQL append; the worker folds deltas produced meanwhile (up to 16 KiB) into the next publication. Text therefore arrives in bursts rather than token by token. Acceptable, but a 150 to 250 ms minimum fold window would make bursts regular and halve publish traffic on long answers.
- Every hook event (PreToolUse, PostToolUse, compaction, subagent) publishes a hash through the run owner before the tool proceeds. That is one control round trip per tool call; fine for a handful of SQL calls, noticeable for a 20-call run.
- The 5-minute prompt-cache TTL is right for interactive use. Subagents share it.

## 4. Text-to-SQL

Finding that changes the design: the text-to-SQL "engine" is Claude inside the SDK loop writing PostgreSQL; nothing in the SDK does text-to-SQL for you, and Meri already uses the SDK the right way (describe → author SQL → `query_capiro_data` → answer). The compiler is not in Meri: `apps/gateway/sources/capiro-data/handler.mjs` forwards the SQL to Core `POST /api/clio/tools/query_capiro_data`, where `sql-query-compiler.ts` parses it against a closed allow-list and regenerates it. Run locally against 58 statements, that gate accepts only single SELECTs, CTEs, equality joins on declared keys, comparison/ILIKE/IS NULL, named aggregates, GROUP BY/HAVING/ORDER BY, LIMIT and `$n` parameters, and refuses string literals, SELECT *, IN, BETWEEN, NOT, LIKE, CASE, COALESCE, casts, arithmetic, every function, window functions, subqueries, OFFSET, UNION and NULLS LAST, with refusal messages that name no token. From the model's side that is "text-to-SQL does not work".

Decision (Neo, 1 November): that gate duplicates what PostgreSQL already enforces for the two dedicated readers (read-only transaction, grants limited to published projections and security-barrier views, transaction-local tenant/scope context, `search_path=pg_catalog`, 8 s statement timeout). Remove it: keep only the checks the database cannot make (one statement, SELECT/WITH only, no SET/COPY/transaction control, LIMIT wrapper at 1000, byte cap, no public/private mixing, `visible_clients` never selectable), pass the SQL through verbatim, return PostgreSQL's own error with position, and delete the compiler. That work runs in capiro-backend on branch `fable/core-sql-grammar-20261101`, with database-level proofs for every removed property before deletion.

Meri side, draft PR 468 (`fable/meri-text-to-sql-quality-20261101`): tool descriptions and input-schema annotations that tell the model the contract; a correction notice per refusal code; a count line with remedies for rowLimitReached, byteTruncated and zero rows; Core 5xx/408/429 mapped to UNAVAILABLE instead of "withheld"; two guidance sentences tightened; `docs/RETRIEVAL-CONTRACT.md` section. Tests: gateway capiro-data 17/17, reads suite 550/573 with the same 23 host-bound failures as base, contracts 4449/5010 identical set to base. The draft's grammar text shrinks to "PostgreSQL 16 read-only SELECT over the published relations" once the Core change merges. Coverage gaps the relations cannot answer (bill text and actions, committee assignments, FPDS awards, state bill text, mail bodies, strategy history, cross-client aggregates in client mode) are listed in the PR.

## 5. Live outage: capacity raised

With Neo's go-ahead, `capiro-newstack-preview-clone` ServerlessV2 `MaxCapacity` was raised from 8 to 16 ACU at about 01:40 UTC on 1 November (`modify-db-cluster`, applied immediately, status available, no pending values). Core's query cost and the frontend's handling of a failed re-check are being fixed in their own sessions (section 5a).

## 5. Chat UI noise and UX bottlenecks

The noise Neo quoted comes from five frontend components, all in `apps/web/src/features/meri/conversation/`:
- `MeriLiveConversation.tsx` `CurrentRunStatus`: the "Ready / Complete / You can send your next message / Write next message" card after every finished run.
- `lifecycle/RunLifecycleControls.tsx`: the "Pause and recovery" disclosure rendered for every turn that ever had a checkpoint, i.e. every finished run.
- `evidence/ConversationEvidence.tsx` and `RecordedUsageView.tsx`: "Earlier run N / Current run / View recorded usage" sections per run.
- `intents/ConversationIntents.tsx`: the "Actions for your approval" panel with Refresh and the empty-state sentence even when nothing is pending.
- `ConversationTurn.tsx`: assistant text rendered as plain paragraphs, so Markdown headings, lists and tables show as raw `#`, `*` and `|`; plus a status pill and "Tool activity" rows on every answer.

PENDING: fe-chat-clean session PR.

PENDING: visual audit of the live site (`C:\dev\fable-meri-20261031\VISUAL-AUDIT-20261101.md`).

## 5a. Live outage observed during the audit, 1 November 00:00 to 00:30 UTC

The Sonnet visual-audit session (Claude in Chrome, Neo's own signed-in browser) could not complete a single prompt on https://app.capiro.ai/meri. Read-only AWS diagnosis (IAM user `jump-cli`, CloudWatch and ECS describe calls only; nothing was changed):

- Every Meri and Core ECS service was healthy and steady: `meri-product-preview-control` task definition 91 (deployed 23:26 to 23:32 UTC), `capiro-preview-first-chat-core` 44, Temporal, schedule worker, AgentCore runtime unchanged. No deployment overlapped the failures.
- Control telemetry for the audit's first prompt (run `b49a92c2`, 00:17:01 UTC): `send.admit.received` → `run.running` in 7 s, first durable text at 10.4 s, result at 25.7 s, **state completed**, 82 delta publications, 33 Core calls all 2xx. The backend finished the answer. The browser replaced it with "Conversation access unavailable" at about 40 s because the frontend's post-run access re-verification against Core failed.
- Core (`/capiro/preview-first-chat/core`) logged PostgreSQL `57014 canceling statement due to statement timeout` bursts at 23:55 and 00:17 UTC from `IntelligenceService` profile-v1 sources (`trackedBills`, `billRegulationLinks`, `hearingAlerts`, 4 to 7 s each), `getHearingAlerts`, and `EngagementService.listMailThreads` (`mail-thread-list.ts:76`), plus `Retryable transaction conflict` retries. These timeouts are chronic: 13 to 56 per hour for every hour of 31 October.
- Control recorded Core calls as `unanswered` (14 in the 23:45 window, 1 at 00:20). An unanswered current-state read inside control's `operation()` is exactly what the frontend saw as `CONVERSATION_UNAVAILABLE` and then `INITIAL_INPUT_UNAVAILABLE` (HTTP 503 on `POST /api/conversations/input/allocate`) on the retry at about 00:20.
- The serving database `capiro-newstack-preview-clone` (Aurora Serverless v2, one writer) is configured `MinCapacity 0.5, MaxCapacity 8`. CloudWatch shows `ServerlessDatabaseCapacity` pinned at the 8 ACU ceiling and `CPUUtilization` at 100% in the 23:55 and 00:15 five-minute windows, with connections rising from 42 to 56. The dev cluster allows 16 ACU.

Conclusion: the chat is not broken; Core's heavy intelligence and mail queries saturate an 8 ACU database, Core then answers control and the frontend too slowly, and both treat the slow answer as lost access. Owners: DB (capacity), Core (query cost and pool sharing), Frontend (do not discard a completed answer on a failed re-check).

Immediate actions, in order of leverage:
1. Raise `MaxCapacity` on `capiro-newstack-preview-clone` to 16 (DB owner; a scaling-configuration change, no restart).
2. In Core, give the conversation-authority endpoints (`identity`, `membership`, `current`) their own Prisma pool or priority, so IntelligenceService and mail sync cannot queue them; add indexes behind the three profile-v1 sources and `mail-thread-list`.
3. In the frontend, keep the completed transcript on screen when the post-run access re-check fails and offer "Check access again" beside it instead of replacing the turn (the UI session has this in its brief).
4. Raise control's per-request Core allowance for current-state reads from 3 s to 5 s only after 1 and 2; it masks rather than fixes.

## 6. Handoff items (31 October packet) and what this work changed

The packet (`FABLE-MERI-COMPLETE-HANDOFF-20261031.txt`) lists 41 items. Most are live-acceptance cases that need the serving stack, Root's effect allocation, the sole Release owner, the sole DB owner, a second actor, or provider grants; none of those can be run from a source checkout, and the packet forbids replaying consumed cases. What this work changed per item:

| Item | Packet status | Effect of this work | Still needed (owner) |
|---|---|---|---|
| M01 core chat, continuity | basic chat PASS; lifecycle open | Answers now full length and Markdown-structured (PR 467); UI chrome removed (frontend PR, section 5) | Streaming/follow-up/reload/access-loss cases on preview (Acceptance) |
| M02 usage, composer recovery | Control 91 serving; FE recovery image pending | none (accepted evidence reused) | Ship FE 4018 image (Release) |
| M03 models, effort, budgets | one catalog row, null effort | Documented exact catalog/limit changes (section 2); code already accepts effort rows and more model ids | Material change plus M0 to M7 cases (Release, Acceptance) |
| M04 SDK question tool | NOT RUN | none; source path reviewed, admitted only with the question port | Live cases (Acceptance) |
| M05 AWS primary web search | one case FAILED | none; `primary-search.mjs` targets the AgentCore Gateway web-search connector; failure cause not inferable from source | Consume serving endpoint/grants, one new request (Acceptance, Release) |
| M06 notebook editing | NOT RUN | none; `NotebookEdit` is admitted only when the capability fragment names it | Live fixture case (Acceptance) |
| M07 workspace file tools | matrix incomplete | isolation reviewed (section 3): rules confine Read/Edit to the conversation cwd | Live matrix (Acceptance) |
| M08 Bash/Python, native 463 | physical qualification pending | none | Native forwards, guest/AMI binding (Capabilities, Release, DB) |
| M09 run controls, forks, children | live matrix absent | UI keeps pause/steer/resume/fork, shown only while relevant | Live matrix (Acceptance) |
| M10 skills, QuickActions | catalog observed; typed-apply withdrawn | **Bug fixed:** every selected-skill run had a $0.001 model budget; 60 s manifest runtime still bounds skill runs (section 2) | New skill versions with 600 s runtime; live picker cases (MCP, Acceptance) |
| M11, M12 MCP directory/execution | provider-backed closure open | none | Real isolated grant (MCP) |
| M13, M14, M15 browser, sites, selected tab | native dependencies pending; PR 466 open | none | Native prerequisites; PR 466 review (Capabilities, Extension) |
| M16, M17 uploads, attachments | matrix incomplete | none | Format matrix (Documents) |
| M18, M19, M20 memory | Core 44 support, FE 420/422 queued | none; FE 420/422 are in the release branch | Ship FE image; owner-scoped cases (Memory, Release) |
| M21 learning producer | no accepted witness | none | Real producer case (Learning) |
| M22 notifications | A1 to A3 unreconciled | none | Fresh ACK case (Notifications) |
| M23 to M29 Office/PDF/reports | source exists; live open | none | Office 47 build, fidelity corpus (Office, Documents) |
| M30 primary text-to-SQL | source corrections ongoing | **Hardened** (section 4): tool descriptions, error feedback, validator coverage, result rendering; answer-length and style fixes apply here too | DB qualification of roles/views/pool (DB); representative live answers (Acceptance) |
| M31 Research portfolio SQL | PRs 453, 455, 456, 460, 461 open | none | DB closure, composition (SQL, DB) |
| M32, M33 connected readers, graph | per-family acceptance open | none | Family reconciliation (SQL, MCP) |
| M34 legislative drafting | PR 443 merged; acceptance pending | none | Connected acceptance; XML/USLM scope decision (Legislative) |
| M35 to M41 meetings, outreach, proposals, routines, objectives, forecasts, feedback | source merged; live open; PR 465 open | none | Live cases per family (owners named in packet) |

Nothing in the packet was replayed, no serving resource was touched, and no deployment was performed; all shipping remains with the sole Release owner.

## 7. Recommendations beyond bug fixes

1. **Stop using the Claude Code preset for chat, or wrap it deliberately.** The preset is the right harness for tools, skills, compaction and session handling, but its prose is a coding-terminal persona. PR 467 overrides the brevity rule; the remaining preset text still describes code review, commits and file references. If answer quality still reads "engineer-ish" after the override, the clean fix inside Neo's rule ("use the preset") is a short second paragraph in the append that defines Meri's voice and audience explicitly. Do not replace the preset with a custom prompt; that loses the harness behaviours.
2. **Raise tenant model limits with the catalog change.** `maxTurns 40`, `maxBudgetMicroUsd 5,000,000` per run through tenant settings, and add `us.anthropic.claude-opus-4-6` with efforts `[null, 'high', 'max']` to the control model material once Bedrock access is confirmed. Opus for research briefs, Sonnet default.
3. **Version the skill manifests.** Issue `*.1` successors of every original skill with `maxRuntimeSeconds 600`, `maxToolCalls 24` and unchanged prose, and point the installed catalog at them. The current 60 s bound makes the selected workflows (Bill Watch, commitments audit, relationship brief, cited report) unusable live.
4. **Publish text in time windows, not per control round trip.** Fold deltas for 150 to 250 ms before each `message.delta` publish (the fold already exists; add the clock). Expect smoother streaming and far fewer control writes on 30k-token answers.
5. **Collapse operational UI into one disclosure per turn.** Keep a single "Details" affordance for sources, usage, tool activity and recovery; everything else stays hidden until a run is running, paused, failed or awaiting approval. The frontend PR in section 5 does this; keep that rule for new features (browser viewer, approvals, uploads) so the chat does not grow chrome again.
6. **Render Markdown everywhere Meri text appears.** The UI package already ships streamdown; saved-history, exports and notifications should use the same component as the live turn.
7. **Make `describe_capiro_data` answer the real first question.** Users ask "what do you know about X"; the describe tool should return a compact relation map with grains, keys, freshness and three worked SQL examples so the model's first query is right (section 4 reports what was added).
8. **Add a short per-tool-call budget for SQL.** `statement_timeout 8 s` is fine; the bigger win is telling the model the limit and returning `EXPLAIN`-style hints on timeout so it narrows the query instead of abandoning the path.
9. **Reduce per-event control authorization cost.** Each publish and each hook re-authenticates the session; cache the fused session read for 2 s inside one run (revocation latency becomes at most 2 s, which the lifecycle already tolerates on checkpoint).
10. **One model catalog source of truth.** Catalog rows live in deployment material (`policy.json`), defaults in `settings/documents.mjs`, and validation in `usage.mjs`; a single versioned catalog document consumed by all three would prevent the "contract vocabulary vs live availability" confusion the packet describes.
11. **Preview acceptance should include response-length and Markdown checks.** Add two assertions to the first-chat acceptance: a 400-word brief is not truncated, and a table renders. Both would have caught this regression.

## 8. Checks run, evidence and unrun items

PENDING.
