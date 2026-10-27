# Fable Wave 4 bug-fix return — 27 October 2026

From Fable to the Wave 4 orchestrator. Author evidence only; no merge, deployment, migration or acceptance was performed. Authors do not accept their own fixes: root arranges independent review of every head below.

## 1. Returned branches (PR candidates)

No pull request was opened; each branch is ready for root to open, review and merge. All three carry the same branch name `claude/jolly-cori-v7dcvd`.

| Repository | Base (fetched remote) | Head commit / tree | Commits | Mergeability |
| --- | --- | --- | --- | --- |
| `neo-capiro/meri-greenfield` | `main` 651bdf37 (PR292) | `61e9574ebe59a91e552cb9356be75112892bdfd7` / `f39f1bd5acc8f45a91f5b3abe4fc6492650e32e8` | 1bbcf5a9 sharing read fixes; 4a93f8eb MO-05 integration + contracts 0.1.21 / catalog 0.2.23; 61e9574e UI stream 0.1.8 peers | fast-forward on 651bdf37 at push time |
| `neo-capiro/capiro-frontend` | `main` 050df524 (PR250); remote main is now b70f5d8e (PR244 merged after PR250, unrelated avatar change) | `6652fe2280ed3282e52ee2ca08803f2000ad32c5` / `3f8bba04f420dd21a0ea736757e9b268ca69a248` | one commit | no overlap with b70f5d8e expected; root confirms at PR time |
| `neo-capiro/capiro-backend` | `backend-import` c5b99db7 (PR193) | `8fa0ccdd94c17c0c677d2f01ae18a6762d218b59` / `412267afc3eb93be016041c17b3ee0b35f2787f4` | 4a6636f4 preview labels; 8fa0ccdd guard | fast-forward on c5b99db7 at push time |

Dependency order: Meri first (it produces contracts 0.1.21 and UI stream 0.1.8), then frontend (vendors both artifacts), then Core (independent; the preview labels are cosmetic and safe before or after).

### 1.1 Meri commit 1bbcf5a9 — sharing reads: advertised schema and Core envelope

- **Bug 1 (user-visible):** `get_research_portfolio_share_links` was never offered to the model. The sharing schema pinned `pattern: ^[a-f0-9-]+$` beside `format: uuid` on every id; the worker's zod round-trip proof cannot narrow that combination, so the read failed closed with `READ_SCHEMA_CONFIGURATION`. Reproduction: baseline `apps/worker/conversation` schema proof for that operation; fixed by removing the redundant pattern (format remains) and repinning the three sharing descriptors.
- **Bug 2:** the attended sharing read posted a flat body to Core, which Core's trusted transport (`meri-rp-tool-transport.ts`) admits only for `CapiroMeriRead` delegations; attended native reads relay the live user session and must send `{version:1,input,currentTurn}`. New `research-portfolio-envelope.mjs` builds that envelope from the authority binding; `reads-research-sharing.test.mjs` asserts it.
- **Correction:** pre-call refusals in the sharing preparer (invalid arguments, first rights check) are reported as effect `none`, not unknown, so the journal never treats a refused prepare as an uncertain write.
- Changed files: `packages/contracts/retrieval-0.2/research-portfolio-sharing.schema.json`, `catalog.json` (three pins only), `apps/gateway/sources/retained-reads/research-portfolio-envelope.mjs` (new), `apps/gateway/general-reads/families/research-portfolio-sharing.mjs`, `apps/runtime/test/reads-research-sharing.test.mjs`, `apps/control/intents/research-sharing-preparer.mjs`.

### 1.2 Meri commit 4a93f8eb — MO-05: 7 reads and 10 governed actions

- **Gap:** Core already served all 22 Research Portfolio tools behind `RESEARCH_PORTFOLIO_MERI_TOOLS_ENABLED`; Meri mapped only the 5 sharing/portfolio operations. The 17 remaining originals were `deferred`.
- **Reads** (`research-portfolio-workflow` group): analytics, bookmarks, fit, reviews, rules, imports, operation status. Typed input/output schema (`research-portfolio-workflow.schema.json`, 29 definitions), validators that bind the conversation, tenant and `visibleClientIds`, gateway routes `/api/clio/tools/<id>` with the trusted envelope, worker family (`clientScope: optional`), runtime read context.
- **Actions** (`research-portfolio-action` group): management (49 Core actions, `confirmed:true`, bounded parameters), snapshot, output request, save output to client, watch, change state, bookmark, review note, brief, meeting. Each is a prepare-only intent (`propose_research_portfolio_*`, `prepare_research_portfolio_draft`) that posts an immutable proposal to Core `/api/clio/action-proposals`; approve/dismiss go through the existing intent journal and the public intents contract (kind `research_action`, decide response `research_action_decided`). Model-supplied `idempotencyKey` / `operationKey` / authority keys are refused; the key is derived from the delivery identity (`meri-rp-<sha256>`).
- **Contracts/catalog:** contracts 0.1.21, catalog 0.2.23 (originals 153 = 141 selected / 12 deferred; operations 142), `packages/skills/assets.json` `installationCatalogSha256` repinned, dist regenerated (byte-identical regeneration verified on the untouched baseline), owner-exclusion ledger authorizes the 17 names.
- **Tests added:** `packages/contracts/test/retrieval-research-portfolio-workflow.test.mjs` (3), `apps/control/intents/test/research-action.test.mjs` (6), `apps/runtime/test/reads-research-workflow.test.mjs` (4); stale-count tests updated (`legacy-tools-excluded`, intents `schema.test`).
- **Known limitation (Core, not changed here):** Core's `manage_research_portfolio` runs every management action through an approval, including the read-only ones; Meri labels them honestly but cannot skip the approval.

### 1.3 Meri commit 61e9574e — UI stream 0.1.8

UI stream 0.1.7 admits only contracts `0.1.19 || 0.1.20` as a peer, so the frontend cannot install contracts 0.1.21 beside it (`npm install` fails resolving the peer). 0.1.8 changes package metadata only (peer `0.1.20 || 0.1.21`, README note); `dist/` is byte-identical to 0.1.7 after rebuild. The handoff's "do not repack unchanged artifacts" is respected for 0.1.20/0.1.7 themselves: both stay in the frontend vendor record untouched; the new versions are additive.

### 1.4 Frontend commit 6652fe22 — receive `research_action` proposals

- Vendors `capiro-meri-contracts-0.1.21-4a93f8eb-4b92830eaa46.tgz` (1,298,567 bytes, 69 entries, SHA256 `4b92830e…`) and `capiro-meri-ui-stream-0.1.8-61e9574e-39451998f953.tgz` (3,177 bytes, 6 entries, SHA256 `39451998…`), both packed with `npm pack --ignore-scripts` from the exact Meri heads above; records added to `vendor/meri-public-packages.json` with status `candidate-source-pending-review-and-merge`. Root may repack from the merged Meri head and replace both records; the bytes will match if the merged tree is identical.
- New `research-action-view.ts` renders the retained request, the bounded Core preview, approve/reject and settled states; `intent-view.ts`, `decision-recovery.ts`, `useConversationIntents.ts`, `useIntentExpiry.ts`, `ConversationIntents.tsx` treat `research_action_decided` like the other owner decisions; uncertain outcomes are recovered by reading the recorded status, never by re-sending.
- Pins moved to 0.1.21: `apps/web`, `packages/meri-client` (peer and dev), `packages/qualification-transport`, root; `previewMeriContractsPackageVersion` in `meri-conversation-route.server.ts`; `scripts/installed-public-export.test.mjs`.
- Tests added: `tests/meri-research-action-fixture.ts`, `tests/meri-research-action-view.test.ts` (4).

### 1.5 Core commits 4a6636f4 + 8fa0ccdd — preview labels

Meri action previews for the ten MO-05 actions showed only the raw tool name. `meri-action-preview.ts` now labels each action and shows only bounded facts (ids, action, label, counts, effect text); keys and body text stay server-side. Spec extended (`meri-action-preview.spec.ts`). The second commit guards the field-table lookup under `noUncheckedIndexedAccess`.

## 2. Author check results

Node 24.x, npm 11 (Meri/frontend), pnpm 9.12 (Core); isolated clones; no live target touched.

| Repo | Check | Result |
| --- | --- | --- |
| Meri | affected tests: new 13 + sharing read + legacy-tools-excluded + intents schema (`node --test`) | 28 pass, 0 fail |
| Meri | `npm run check:contracts:distribution` | exit 0 |
| Meri | `npm run check:contracts` | exit 1 at head and at baseline. Head 1053 failing cases vs baseline 1021; the 34 "new" names are the pre-existing broken `next independent zero inner effects for unavailable <id>` case (it fails for all 250 operations on the baseline because `createSourceDisabledGateway` passes `authority`/`budget` where `createToolDispatch` requires `current`/`contextFor`) applied to the 17 new ids; 2 cases fixed at head. Inherited stale-count tests (139/97/48/84 etc.) untouched. |
| Meri | full `npm run check` baseline comparison (pre-compaction run) | 1019 inherited failures; affected suites: no new failures, one fixed |
| Frontend | `npm run check:packages` | exit 0 (both new artifacts bound) |
| Frontend | `apps/web` `tsc --noEmit` (8 GB heap; the default heap OOMs in this container) | exit 0 |
| Frontend | `npm run lint --workspace @capiro/web` | exit 0 (83 inherited warnings) |
| Frontend | `npm run format:check --workspace @capiro/web` | exit 1: 6 inherited files, none touched by this branch; all changed files are Prettier-clean |
| Frontend | root `npm test` | 205 pass / 3 fail at head and at baseline (`preview-backend-boundary` ×2, `preview-config` ARM pins) |
| Frontend | `npm run architecture` | exit 1 at head and baseline; no new review-required signal (DecisionControls shrank 117→86 lines; `researchActionRow` 58 lines) |
| Frontend | vitest: intents views (15), research action (4), preview route activation, share view | pass; `meri-capabilities.test.ts` 2 fail at head and baseline (fixture pins 0.1.14) |
| Frontend | `npm run test:transport` | 132 pass |
| Core | `jest src/meri/meri-action-preview.spec.ts` | 6 pass |
| Core | `tsc --noEmit --rootDir .` in `apps/api` | 9,410 inherited errors in this container (Prisma clients and `@capiro/shared` not generated here); 0 in the changed file after 8fa0ccdd |
| Core | eslint | not runnable here (no eslint in the installed `apps/api` dependencies); root's gate covers it |

GitHub checks: none observed for the pushed branches from this environment; report as not run.

## 3. Migration, schema, contract, package, environment, route and deployment impact

- **Database:** none. No migration in any repo.
- **Contracts/catalog/packages:** contracts 0.1.21, catalog 0.2.23, UI stream 0.1.8, skills `installationCatalogSha256` changed. A deployed runtime needs a fresh native installation receipt for the new catalog hash (release owner); the previous 0.2.22 receipt will not admit the new reads.
- **Core environment:** every Research Portfolio Meri tool requires `RESEARCH_PORTFOLIO_MERI_TOOLS_ENABLED=true`; the CDK preview source does not set it, the preview `first-chat-core-meri-tools.json` allowlist lists no Research Portfolio tools and the standard profile sets no `MERI_TOOL_ALLOWLIST`. Without those the 22 tools stay unavailable on preview. Deployment decision for root/release, not a code change.
- **Frontend environment:** `CAPIRO_PREVIEW_MERI_CONTRACT_PACKAGE_VERSION` must equal `0.1.21` on preview. Pre-existing mismatch: `apps/web/deployment/portfolio/service.yml` asserts `0.1.14` and `tests/meri-capabilities-fixtures.ts` pins `0.1.14`, which already disagreed with 0.1.20; both are release-owned and left unchanged.
- **Routes:** no new HTTP routes. Meri calls the existing Core `/api/clio/tools/get_research_portfolio_*` and `/api/clio/action-proposals` endpoints.
- **Cleanup/recovery:** no resources created; the temporary local tarball pin was replaced before commit and never committed.

## 4. Decisions and definitions returned to root

1. **F01–F42 and V4-01–V4-15:** not recoverable from any accessible repository. The recorded lineage (`docs/research-portfolios/BRANCH-CLOSEOUT-2026-09-28.md`, `CURRENT-BRANCH-CLOSEOUT-2026-09-28.md`) states the original START-HERE/portable plan and the F/V4 source files are unavailable; only the 70 register rows exist. Root must supply the definitions or accept the register as the lineage.
2. **Original sections 1–15 and section 16 text (FR-16.36):** not in `meri-greenfield`, `capiro-backend` or `capiro-frontend`; `SECTION-16-SOURCE.txt` lives only in root's `R/outputs`. Needed before any row-11 fix.
3. **FR-16.36 / 16H row 11 (publisher source permission):** trace of current owners — the share payload admits only frozen evidence; evidence is resolved from the public qualified defense corpus (`resolveEvidence` has no tenant/user input); the publisher check is editor grant + linked client + current client access. No private-source input into a share widget was found, so there is nothing today that a publisher-specific source permission would gate. The meaning of "source permission" for a public-corpus widget is undefined in the available sources: root must decide whether row 11 is satisfied by the current public-only admission (then the acceptance row only needs a documented refusal case) or whether a private source is expected to exist (then name the source and widget). No ACL model was invented.
4. **Core management actions:** read-only `manage_research_portfolio` actions still require approval in Core (`RESEARCH_MANAGEMENT_READ_ONLY_ACTIONS` are labelled but not short-circuited). Decision whether Core should bypass approval for those actions.

## 5. Coverage note against the existing rows

**Status of this section: report only. No scan finding below was fixed, and none was independently re-verified by Fable against running code.** Six read-only static scans were run (no tests, no database, no live target). Each line cites file and line as reported by the scan; root or the fixing author must confirm before changing code. Severity is the scanner's. Paths: `BE` = `capiro-backend/apps/api/src`, `FE` = `capiro-frontend/apps/web/src`, Meri paths are repo-relative.

### 5.1 Coverage by existing handoff area

| Area | Scanned | Findings | Not covered |
| --- | --- | --- | --- |
| Sharing, 16H rows 1-14 | yes | 7 (2 medium, 1 medium-low, 2 low-medium, 2 low) | global request loggers, FE proxy token handling, CSP for the frozen logo, snapshot immutability |
| F09 SQL and saved reads | yes | 4 (1 medium, 3 low) | Hill Day, newsletter and document-version owners; whether the "current version versus pinned version" default for ordinary chat/PE is implemented (unverified, not a defect); real PostgreSQL behaviour |
| F10-F11 tasks and native actions | yes | 4 (2 medium, 1 low-medium, 1 low) | Intel owner receipt fields behind watch/client-record; whether Core `CLAIMABLE_STATUSES` includes `failed_retryable` |
| Mail | yes | 4 (1 low-medium, 3 low) | offset>0 pages validated only in the dispatcher; attachment download-by-id endpoint |
| Runtime | yes | 3 (1 medium, 2 low) | idle-stop code, Temporal worker, full SDK session and continuation owners |
| Research Portfolio module | yes | 11 backend defects (D1-D11) plus frontend gaps | import compensation body, rules service beyond guards, DI-row owners, S09-S15 |

"No defect found" is not acceptance. Rows below with no finding keep their `PASS / FAIL / NOT RUN` status for root and Hermes.

### 5.2 Sharing (16H) findings

1. **Medium, rows 14 and 6.** Core ignores the conversation's selected client on Meri publish and revoke. `BE/research-portfolios/research-portfolio-meri-tools.service.ts:147,287-314`: only the list tool compares `selectedClientId`; publish and revoke do not. The only client check is Meri-side (`apps/runtime/native-authority/research-sharing-client.mjs:48`). A client-A conversation could publish for or revoke a client-B link if the user has editor access, B is linked and B is not walled. Revoke takes only a `linkId`. Fix proposed: require `input.clientId === selectedClientId`, and for revoke load the link and compare its client. Test: `research-portfolio-share-meri.spec.ts`.
2. **Medium-low, row 14.** `revokeRow` (`research-portfolio-share.service.ts` ~790-806) skips the client wall and returns link details (client and snapshot names) for a walled client. Needs the link id. Fix: `assertResearchPortfolioClientAccess` on the non-admin path.
3. **Medium-low, row 2.** `findLiveLink` (~700-704) returns not-found while `lockedUntil` is in the future, and `dashboard()` and `logo()` use it, so five wrong PINs by anyone with the link end already-unlocked viewers' sessions for 15 minutes. Whether intended is unclear. Fix: apply the lock only in `verifyPin` and `availability`.
4. **Low-medium, rows 2 and 4.** Every public call with a real token takes `SELECT ... FOR UPDATE` on the tenant row, the FE polls every 15 s per viewer, and `scryptSync` runs inside that transaction. The attempt throttle is per process and in memory.
5. **Low, rows 2 and 14.** The admin UI shows "locked" while `failedPinAttempts >= 5` even after the lock expired (`FE/features/modules/research-portfolios/share/ResearchSharing.tsx:499`); `lockedUntil` is not in the DTO.
6. **Low-medium, row 10.** `DashboardDesigner.tsx:202-244`: the cell key handler does not ignore Alt/Ctrl/Meta combinations (Alt+ArrowLeft becomes a widget move) and does not check `event.target === event.currentTarget` (Delete on the focused resize button removes the widget).
7. **Low, row 10.** Focus is lost to `<body>` after keyboard delete (`DashboardDesigner.tsx:214-216,367-375`).

No defect reported for rows 1, 3, 4 (unavailable states), 5, 7, 8, 9, 11, 12, 13 on static reading. Notable observations for root: published links keep working after unlink or archive (row 8; confirm that matches the specification); there are no cookies, the view token travels in the request body (row 13 cookie criteria do not apply as written); the tenant switch is audited as a settings stamp only.

### 5.3 F09 SQL and saved-reads findings

1. **Medium (or design gap).** The compiler does not prevent parent-total fan-out. `BE/meri/analytics/sql-query-compiler.ts:128-176` accepts SUM/AVG/COUNT over any joined column, and `SUM(DISTINCT ...)`. Only prose in `public-sql-registry.ts:425,428` tells the model to aggregate parents in a CTE first. Same for `client_campaign_recipients` joined to `client_outreach_campaigns`. If the accepted design deliberately leaves this to the model, reclassify.
2. **Low.** Private SQL is not covered by the saved-owner `readSource` denial: `apps/gateway/sources/retained-reads/http-transport.mjs:29-30` defines `privateData` after the check and leaves `capiro-data` out of the denied group list, so an injected `readSource` could serve `client_records` outside Core's interactive admission. Fix: `(savedOwner||privateData)&&readSource` denies.
3. **Low.** Timestamp output loses microseconds (`BE/meri/analytics/sql-query-output.ts` ~24-32, JS `Date` milliseconds) although the Meri validator accepts six fractional digits.
4. **Low.** `42P08` and `42P18` (conflicting parameter types) are not in the `INVALID_QUERY` SQLSTATE lists of `analytics-db.service.ts:169-175` and `private-sql-db.service.ts:159-175`, so they surface as `SOURCE_UNAVAILABLE`.

Optional data-semantics note: budget-position and project relations have no retirement predicate while `program_elements` excludes retired PEs, so position sums by PE code include retired PEs without saying so.

Checked with no defect: exact numeric strings and nulls, honest truncation and coverage flags, 14 private projections evaluated at query time with the live wall, revocation re-check before and after the transaction, selected-client scope cannot be broadened, 17 saved-read kinds (7 Core and 10 Workspace), Strategy kinds require a client, PlannerTask versus EngagementTask separation, read-only roles and no interpolation. Observation: in a client-selected conversation most saved-read kinds fail closed by design, so document traversal is unavailable in client chats.

### 5.4 F10-F11 tasks and native actions findings

1. **Medium.** `apps/control/intents/approval.mjs` `decideLegislativeDocument` (from line 168) catches every owner error as `NOT_DISPATCHED` and ignores `error.effect`, although the client throws `effect:'unknown'` after the request was sent (`apps/runtime/native-authority/legislative-document-client.mjs` ~335). A possibly recorded approval is reported as a refusal. Sharing and research-action branch on `effect==='none'`. Fix: branch on effect, otherwise `UNKNOWN`. Test: `apps/control/intents/test/legislative-document.test.mjs`.
2. **Medium (Core watch).** Pre-effect validation failures after approval are recorded as `outcome_unknown`. `BE/meri/watch-actions/keyword-watch.adapter.ts:66-67`, `defense-budget-watch.adapter.ts:308-309`, `client-watchlist.adapter.ts:189`, and the catch in `meri-action-proposal.service.ts`. Meri `watch-action-validation.mjs:17-23` and Core `watchRequestSchema` accept combinations the owners later reject (keyword subscribe/resume with null `sourceRevision`, defense-budget subscribe with null reason, null `clientId`). The approval is consumed, the proposal stays UNKNOWN and the UI says it will not be sent again, though nothing was sent.
3. **Low-medium.** `approval.mjs` expiry checks (lines ~108, 183, 202, 223, 245, 267, 290) run before any owner read, so replaying a decision after expiry gets a definite refusal even when the effect already succeeded and the response was lost. Fix: read the recorded state first.
4. **Low.** Four owners map all pre-send errors to `UNKNOWN`, discarding `effect:'none'` and `ACCESS_DENIED` (`approval.mjs` lines ~187, 206, 227, 249).

Checked with no defect: task.create writes an `EngagementTask` (not PlannerTask); access is re-checked under the proposal lock at approval and release; start-another and reload; task.update is an unconditional title/status/dueDate patch with no CAS, assignee or clearing; MF13 list is actor/tenant/conversation keyed; idempotency keys are server-derived; save_note PASS/WARN/BLOCK mapping; legislative `complete`, `selection_only` and `unknown` stay distinct; four watch owners match Core's supported matrix; approve and dismiss idempotency; frontend uncertain recovery only refreshes.

### 5.5 Mail findings

1. **Low-medium, requirement 2.** Reply and reply-all do not quote the original: `BE/engagement/single-mail-reply.ts:286-347`, `microsoft/microsoft-send-payload.ts:66-67`, `google/gmail-send.service.ts:221-231`. Graph replies require the body to equal the editor HTML; reply subject must equal the original exactly, so no "Re:" prefix is added. Thread headers are preserved. Confirm whether deliberate.
2. **Low.** `FE/features/meri/screens/settings/connections-view.ts:178-184` compares scope counts, not sets, so extra granted scopes can hide a missing Gmail scope; "Needs setup" does not show the reconnect reason.
3. **Low.** The reply button is labelled with the contact name but the real recipient is `reply.to[0]`, which may be a Reply-To address (`FE/features/portfolio/relationships/thread/NativeMailReply.tsx` ~135-142).
4. **Low.** The thread read exposes account, thread, message id and `receivedAt` but no folder or Internet Message-ID (`BE/engagement/mail-thread-pages.ts:95-100,214-225`); Meri candidate pages do carry `internetMessageId`.

Contract looseness, enforced by Core and not a bug: `packages/contracts/commands-0.2/mail-send-validation.mjs:9-23` accepts a private-user scope with a client id and does not check reply or forward recipient shape.

Checked with no defect: tenant and account attribution, reply-all recipient rules, send-time recipient proof, forward bounds and escaping, provider source re-read before send, approval-gated native send, ambiguous outcomes read back and never re-sent, incoming-file limits, quarantine, parent access, no path traversal, scope health never auto-grants, bounded Meri mail reads with disclosed truncation.

### 5.6 Runtime findings

1. **Medium.** `apps/runtime/conversation-runner.mjs:111-117`: the uncommitted-workspace retention runs after the inner try/finally, so if `selectedSkills.close()` or `sdkSession.close()` throws, retention is skipped and the next turn in the same warm session fails restore verification with a file-count mismatch. Fix: put retention in its own finally. Test: `apps/runtime/artifacts/test/native-files-runner.test.mjs`.
2. **Low.** `apps/runtime/artifacts/workspace-restore.mjs` `retainedDirectory` never prunes `<workspace>.uncommitted[.n]`; after 1000 the next failed run reports `RUNNER_CLEANUP_UNKNOWN`, and retained bytes persist after access is revoked until the session ends.
3. **Low.** `apps/runtime/telemetry/turn-context.mjs:92` classifies any failed turn that saw a Core 503 or timeout as `upstream-unavailable`, over-counting `TimeoutFailures`.

Checked with no defect: session reuse only for identical tenant, actor, conversation, scopes and plan; the session id is routing only; serialized turns; no custom warm pool; HMAC per-run credential with expiry and phase checks and final release re-observation; no database credentials in the runner; per-run telemetry counters; cursor-ordered streaming with authority re-check per page; gateway rejects model-supplied authority keys and binds read context to run identity.

### 5.7 Research Portfolio module findings (backend D1-D11, frontend gaps)

Backend, under `BE/research-portfolios/`:

- **D1 Medium-high (privacy).** `research-portfolios.service.ts:131-146`: `detail()` builds its denied-client set only from currently linked clients, so `client_linked` and `client_unlinked` events for a walled, since-unlinked client still appear in `recentEvents`. `changes.service.ts:306-309` uses `fetchDeniedClientIds` and hides them.
- **D2 Medium.** `research-portfolio-phase11.service.ts:114-141`: `addReviewNote` ignores `idempotencyKey` (the Meri tool passes `operationKey`), has no archive guard, and the idempotent `ReviewService.addNote` (`review.service.ts:1715`) has no callers. A retried approved proposal inserts duplicate notes.
- **D3 Medium.** `output.service.ts:222,253,263,267,353`: create, cancel, retry, reconcile and save-to-client require only `viewer`; `reconcileOperation` and `createSnapshot` require `editor`. A viewer can cancel or retry another user's output job and, past the wall, file into a client's Client Files.
- **D4 Medium.** `research-portfolios.service.ts:298-326`: `decideMembers` can set an unresolved member to `included`, bypassing `resolveMember`.
- **D5 Low-medium.** `analytics.service.ts:95-114`: snapshots can be created on an archived portfolio.
- **D6 Medium.** `changes.service.ts:225-231,284-291`: resuming a subscription sets `active:true` without resetting baseline and checkpoint, so paused-period events are delivered at once (RP-09, S05).
- **D7 Low-medium.** `phase11.service.ts:74-103`: bookmark create ignores `idempotencyKey`, does not validate kind or target, has no archive guard and has no `P2002` handling.
- **D8 Low.** `meri-action-preview.ts:136-139` (my Core commit) gives every manage action the effect text "Core applies this action once ... after you confirm", which is untrue for list actions; `rule_preview` is `readOnly` yet persists a preview row. Reported against code I wrote: the effect text should follow `spec.readOnly`.
- **D9 Low.** Tour state, `update` mode and `decideMembers` disposition are unvalidated, giving 500s on over-long or invalid values.
- **D10 Low (frontend).** Settings, Snapshots and Reviews controls ignore archived state and then 409.
- **D11 Low.** Output and snapshot idempotent replay is not bound to the requesting actor; `ReviewService.loadAuthorized` returns 403 where others return 404; concurrent first writes return 500 (no `P2002` handling).

Per-row verdicts (code gap versus evidence only), from the scan:

| Rows | Verdict |
| --- | --- |
| RP-01, RP-02, RP-05, RP-06, RP-09, RP-10 | code gaps D1 to D6 above; remaining proof is evidence |
| RP-03, RP-04, RP-07, RP-08 | backend evidence only; frontend rules panel and import worksheet UI not found (see below) |
| MX-01 | evidence only, plus D2, D7, D8 |
| MX-02 | code gap: no frontend open path for a saved draft |
| MX-03 | frontend code gap: no five-step tour component found; backend state endpoint exists |
| OP-01 to OP-04 | evidence only (BLOCKED rows unchanged) |
| S04, S05, S06, S07, S16, S17 | frontend code gaps (below) |
| S01, S02, S03, S08 | evidence only, apart from D10 |
| DI-01 to DI-11, S09 to S15 | not owned by this module; not scanned |

Frontend gaps (one grep was partly cut by a shell quoting error, so re-run before relying on it): detail tabs are overview, members, changes, analytics, reviews, settings, snapshots, subscriptions and sharing. No component was found for rules, imports and operations, outputs and CSV, save to Client Files, bookmarks, review notes or assignment, watch conversion, fit refresh or the tour. The register names `ResearchPortfolioRulesPanel`, `ResearchPortfolioAnalyticsPanel` and a tour component, and none exists in `FE`. If they live elsewhere, the register's "native controls exist" claims need a path; otherwise S04-S07, S16, S17, RP-03, RP-08 and MX-03 are code gaps, not evidence gaps. This is the largest remaining implementation scope for "finish all existing Research Portfolio requirements" and needs a root decision on slicing and ownership.

### 5.8 Notes on my own deliverables raised by the scan

- Core `manage_research_portfolio` approval labelling (D8) is in the Core commit I pushed; I did not change it after the scan, per instruction.
- None of the scan findings touch the MO-05 reads or intents I added, except D8, D2 and D7, which are Core behaviour my new Meri intents call.
