# M1 UI ticket text (verbatim from the Meri closeout plan)

#### MF-01 — Publish truthful capability and route state (P0 activation gate)

- **Root cause / evidence:** Route tree and explicit allowlists disagree with stale `shared/meri-resources/unavailable.ts`: history/create/approvals/preferences now have real slices; lifecycle is publicly exported upstream. Fixture navigation resembles working product.
- **Bounded files/owner:** Frontend shell `SidebarDestinations`, `Sidebar`, `MeriMobileNavigation`, `MeriHome`; `shared/meri-resources/unavailable*.ts`; route-activation tests. Do not edit every screen indiscriminately.
- **Implementation:** Create a reviewed capability table with source pin, ordinary route, deployment flag, accepted public contract version, runtime owner, required receipt and unavailable reason. Render only supported ordinary links; clearly label design fixtures. Replace stale no-contract copy with precise held/not-configured/missing-consumer language. Record PR115 as already merged and preserve its status-copy regression. Distinguish source reception from deployment/flag activation in release notes.
- **Dependencies / exclusions:** MR/MT/MM truth inventory, PR115 merge provenance, canonical PF-01 deployment qualification. No global enable flag or fixture-to-production rewrite.
- **Acceptance:** For every flag/config combination, sidebar/home/mobile/route guard/API agree; no dead href or disabled action claims completed work. Tree test proves actual mounts; `/kit` is not advertised. All fixture destinations remain recognizably non-authoritative.

---

#### MF-02 — Qualify identity, exact-run renewal and access-loss isolation (P0 before live activation)

- **Root cause / evidence:** Fresh token issuance and 45-second renewal already exist. Source presence does not prove backend bearer lifetime, account mapping, deployment origin or revocation behavior.
- **Bounded files/owner:** `identity-token.server.ts`, `opaque-session-controller.ts`, `session-bootstrap.ts`, `host-controller.ts`, `useConversationConnection.ts`, `SelectedClient.tsx`, shared query scope and their tests. Fix only demonstrated gaps.
- **Implementation:** Build composed acceptance scenarios for verified native actor, tenant/client switch, archived/deleted client, signout, revoked membership, token expiry while streaming and while mutation pending, multiple renewal cycles, browser back/forward, StrictMode/remount. On exact-lifetime loss abort readers, hide actor/client-bound data and invalidate sensitive cached views without auto-canceling backend work. Reissue using fresh identity for exact existing selectors; never allocate next turn on reconnect.
- **Dependencies / exclusions:** MR session-owner expiry/error taxonomy and environment operator qualification. No browser tenant/actor override, persistent bearer storage, weakened issuer/audience or synthetic client.
- **Acceptance:** At least two real renewal cycles preserve run ID and accepted cursor, no duplicate submit/next-turn; stale account/client DOM is hidden immediately, denied data not resurrected by cached pages; explicit retry cannot mint broader authority; native subject-to-actor mismatch fails closed.

---

#### MF-06 — Expose Stop retirement and next-turn readiness honestly (P1)

- **Root cause / evidence:** Stop fence acknowledgement precedes physical retirement; next-turn can correctly conflict. Frontend retry window is150s, whereas backend cleanup can outlast it. Existing history/new-chat/next-turn consumers must be preserved.
- **Bounded files/owner:** `RunStatus.tsx`, `ConversationHistoryStatus.tsx`, `useConversationSession.ts`, `turn-journal.ts`, first-chat/bootstrap/next-turn integration tests.
- **Implementation:** Display separate Stop requested, fence recorded, run terminal and next-turn readiness/cleanup pending where public evidence supports them. Exhausted turn-conflict retry becomes retryable not-ready, not a new conversation/run request. Reconcile same source reservation after reconnect; keep original intent/request identity. For accepted-but-not-started input show recover/readback action rather than a new Send. Avoid unbounded spinner and explain cancellation receipt versus cleanup.
- **Dependencies / exclusions:** MR retirement/current-render fix and readiness/readback semantics. Do not extend frontend timers as substitute for backend recovery or reinterpret409 as permission to allocate.
- **Acceptance:** Stop during tool/provider work, dropped cancel receipt, cleanup delayed beyond150s, fresh deployment and repeated next-turn click all converge to at most one successor; no overlap before retirement; approved prompt preserved and no claim of physical stop without evidence.

---

#### MF-07 — Design durable drafts and request recovery across reload (P1)

- **Root cause / evidence:** Unsent drafts are React state; QueryClient journals preserve SPA navigation only. `turn-journal.ts` explicitly warns hard reload loses intent identity; clearing a next-turn composer before successful reservation can lose visible text on reload.
- **Bounded files/owner:** `useConversationSession.ts`, `MeriLiveConversation.tsx`, `MeriComposer.tsx`, `query-journal.ts`, `turn-journal.ts`, first-chat intent helper; a small versioned per-scope journal, not broad local persistence.
- **Implementation:** Define retention for unsent drafts separately from dispatched immutable requests. Save permissible draft text per tenant/actor/client/conversation (or explicitly state drafts not saved); restore only to exact scope and clear on signout/retention expiry. Persist minimal non-secret request identity before mutation if permitted, then use server readback/reservation on reload. Unknown submission must not create new logical request. Distinguish edited newer draft from acknowledged text and preserve IME/blocked-enter behavior.
- **Dependencies / exclusions:** Privacy/retention ST-18; MR durable admission/readback owner; MF-04 journal conventions. Never persist bearer/session credentials or trust restored bytes as authority.
- **Acceptance:** Reload before dispatch, after dispatch/before ACK, after ACK, during next-turn409, offline, storage-full and account/client switch: no accidental resend, no cross-scope draft, no unexplained loss of accepted request. Hard-reload outcome recovered from durable server state, not guessed from local cache.

---

#### MF-10 — Implement the existing public lifecycle consumer (P1)

- **Root cause / evidence:** Contracts0.1.10 already exports conversation-lifecycle. Main FE allows no control/checkpoints route and no real steer/pause/resume/fork/inspect consumer.
- **Bounded files/owner:** New `packages/meri-client/src/conversation-lifecycle.ts` export or direct approved contracts import; bounded frontend lifecycle proxy/adapter; `useRunCommands`, run detail/checkpoint UI; targeted route/receiver/browser tests.
- **Implementation:** Consume POST `/api/conversations/control` and `/api/conversations/checkpoints/inspect` through fixed same-origin allowlists with existing origin/body/timeout/auth controls. Model each intent and typed receipt; capture immutable request before dispatch; inspect eligible checkpoint before explicit resume/fork; require fresh admitted target session. Present source/target lineage and unknown-outcome readback; never call private lifecycle APIs or automatically replay as new request.
- **Dependencies / exclusions:** MR composition: shared intents+membership/migration, native candidate; fork needs dynamic initial runs. MR receipt-status-only readback gap gates safe recovery. Approval wait/decision needs existing authority, no FE grants.
- **Acceptance:** Steer/pause/resume/fork success/refusal/unknown/reload are tested at exact pins; duplicate same request returns durable receipt, never redispatches. Cross-run/checkpoint substitution rejected; old session cannot access new target; held composition has truthful disabled reason.

---

#### MF-21 — Build a pinned composed frontend acceptance and release matrix (P0 activation gate)

- **Root cause / evidence:** Numerous unit/browser tests exist, many use controlled fixtures. No live deployment/provider action or test run occurred in this read-only audit.
- **Bounded files/owner:** Existing `apps/web/tests/meri-*`, `test/browser/meri-*`, route activation/production-data tests, fixture provenance checks; release checklist/receipt artifact.
- **Implementation:** Create matrix per ordinary route and flag with exact FE/Meri/Core pins, contract versions, deployment scope, issuer/audience/native actor mapping, client allowlist, migrations, worker composition, secrets references (not values), positive and negative test receipt IDs. Separate mocked receiver/browser regressions from composed runtime tests and provider-qualified outcomes. Require at least one real authorized main-path refresh/reconnect/Stop/approval/artifact receipt per enabled slice plus required denial/unknown-outcome cases. Keep not-tested/blocked labels explicit.
- **Dependencies / exclusions:** MR/MT/MM release gates and PF-01 ordinary deployment; PR115 merged source versus PR197 reception status. No test automation that mutates production or providers without separate implementation-stage authorization.
- **Acceptance:** Each enabled control traces UI→fixed proxy→versioned public contract→authorized owner→durable receipt→refresh. CI receipts map exact current pins, not stale PR body counts. Disabled/held slices remain disabled; no synthetic data in ordinary routes; rollback leaves uncertain operations reconcilable.

### 5. Cross-owner mapping and sequencing

| Canonical owner | Meri frontend work here, without duplication |
|---|---|
| PF-02/03 | MF-19 consumes Ask Meri/client profile/Create with Meri context; Portfolio owns starter placement and object semantics. |
| WS-22 | MF-14/19 consume general generation/agent results; no replacement Workspace generation service. |
| WS-23 | PR115 all-format source is already merged; MF-14 supplies Meri consumer acceptance, not duplicate vendoring. |
| WS-24 | MF-14/15 are Meri-specific library/detail/upload/preview/history/filing consumer slices under same canonical custody/version/permission owner. |
| ST-07–11 | MF-13/17 reflect memory governance/grants/files/notifications/owner-memory, not new governance model. |
| ST-12–19 | MF-17/18/20 attach persistence/consumption, defaults, connectors, usage, skills, updates, privacy and help acceptance; original tickets remain canonical. |
| ST-28 | MF-02/19 exact client-context rebind. |
| ML-05/06 | MF-19 does not implement fake reply or new provider send owner; preserve canonical connection/sender/thread. |
| MR | Sessions, durable run lifecycle/retirement/next-turn/readback, routine owner/firing, runtime browser/continuation. MF implements consumers and honest UI state only. |
| MT | Real tool registry, task-create/update execution/grants, mail/read scopes and capability truth. No client authority expansion. |
| MM | Upload/read attachments, artifact writer/read/renderer/custody, memory/research receipts. No browser substitute for backend provenance. |

**Sequence:** (1) MF01/02/03/04/08/21 and qualify the already-received PR115 source, with flags held; (2) MF05/06/07 correctness and composed chat/approval qualification; (3) MF10/12/14/16/19 existing-contract consumers and canonical handoffs; (4) publish missing management/index/inbox/read packets then MF09/11/13/15; (5) deliberate MF17/18 product scope and MF20 across every shipped slice. Independent safe read-only consumers may run in parallel, but a UI ticket does not waive a runtime/migration/authority gate.

### 6. Existing tests, mandatory new cases and unknowns

Existing source tree contains dedicated tests for action adapter/bootstrap/correlation/host/lifetime/proxy/session/transport; client selector; conversation host/live/proxy/reconnect/route; document adapter/bounds/journal/links/proxy/transport; files download/draft/state/workbook; first-chat Core/host/preview-policy/route; history not-started/proxy; identity-token; initial draft/input proxy/recovery; intents access/gating/proxy/view; preview-route activation; task-command adapter/proxy; turn settlement; unavailable resources; preferences proxy/route/host. Browser suites cover host lifetime/navigation/mobile/workflow, conversation artifacts/host/selection, files lifetime/navigation/workflow, history, initial input/reconnect, intents dark, new conversation, production data, stored-conversation recovery and task-command workflow. These are existing test **sources**, not fresh pass results.

Add explicit regression cases for the three newly isolated defects: approval Load More after membership denial, unload immediately after decision dispatch, and waiting-for-approval→running after same-tab or external decision. Add hard-reload unknown-input/next-turn identity, Stop cleanup beyond frontend retry window, two renewal cycles with current native identity, stale successful responses after identity switch, denied file URL after lifetime abort, live source/citation denial and exact-version artifact deep links. Preserve clean-empty SSE window behavior, sequence duplicate/gap rejection, immutable same-request retries, no broad bearer forwarding, no redirect/compression acceptance and signed-byte verification.

Unknowns requiring implementation-stage qualification, not guesses:
- Actual deployment flags, ordinary versus restricted preview exposure, current upstream origin and native identity configuration.
- Live membership/actor mapping, migrations, runtime worker ports, continuation candidate, routine management owner and effective provider/tool grant.
- Whether queued/paused/approval transitions emit enough current public events for UI-only reconciliation; use explicit history read until proven.
- Product policy for conversation naming, archive/delete recovery, unsent draft retention, full document editing/comments/sharing, run/approval inbox scope and supported templates/model selection.
- Contract and owner for typed source details, durable file/run indexes, request-status readback where current list/history is insufficient.
- Provider-qualified task update/mail/artifact results and exact composed renewal/retirement behavior. This audit deliberately did not perform them.
- Current CI/deployment pass status after the pinned metadata reads. Old PR descriptions and fixture success counts are not substituted.

No denied operation was bypassed. No source test or provider action was executed. The output is a plan, not a claim that any listed defect was fixed.

### Appendix A. Complete fixture-route census

**258 registered literal fixture slugs in 20 source group files**, plus the three fixed fixture routes noted above. Every slug below is under `/meri/fixture/`; none is an independent source-wired ordinary workflow. Responsive/dark versions repeat the same action family rather than add authority. Source group links pin the exact registrations.

#### approvals (23)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/approvals.tsx#L96-L274): `approval-center`, `approvals-after-task-decision`, `approvals-after-filing-decision`, `approvals-after-memory-decision`, `memory-approval-review`, `memory-review-authorized-reviewer`, `request-memory-changes`, `memory-approved-by-reviewer`, `draft-client-task`, `review-task-action`, `executed-task-proposal`, `review-artifact-filing`, `artifact-filing-rejected`, `action-receipts`, `reject-or-request-changes`, `request-filing-changes`, `filing-changes-requested`, `task-proposal-rejected`, `task-changes-requested`, `source-access-review`, `source-access-approved`, `source-access-denied`, `source-access-owner-review`.

#### artifacts-pages (21)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/artifacts-pages.tsx#L17-L175): `word-document-page-2`, `word-document-page-3`, `word-document-page-4`, `pdf-preview-page-2`, `pdf-preview-page-3`, `pdf-preview-page-4`, `spreadsheet-source-data`, `spreadsheet-references`, `presentation-slide-2`, `presentation-slide-3`, `presentation-slide-4`, `presentation-slide-5`, `presentation-slide-6`, `web-verification-activity`, `document-comment-reply`, `document-comment-reply-added`, `document-comment-resolved`, `document-comment-reopened`, `document-comment-open-thread`, `artifact-sharing-from-document`, `download-pdf`.

#### artifacts (11)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/artifacts.tsx#L120-L290): `workspace-files`, `word-document`, `document-working-draft`, `pdf-preview`, `spreadsheet-preview`, `presentation-preview`, `generated-web-preview`, `code-activity`, `analysis-outputs`, `artifact-versions`, `revise-artifact`.

#### browser (6)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/browser.tsx#L73-L118): `browser-activity`, `browser-sign-in`, `research-account-connected`, `browser-files`, `public-download-receipt`, `browser-connection-states`.

#### conversation-filters (2)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/conversation-filters.tsx#L12-L19): `conversation-history-client-menu`, `conversation-history-status-menu`.

#### conversation (20)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/conversation.tsx#L117-L279): `choose-scope`, `choose-scope-no-matches`, `conversation-history`, `conversation-history-empty`, `conversation-history-no-matches`, `conversation-history-complete`, `conversation-history-anduril`, `conversation-history-general`, `conversation-history-running`, `conversation-history-archived`, `conversation-history-after-deletion`, `conversation-client-filter`, `conversation-status-filter`, `command-palette`, `command-palette-no-matches`, `research-progress`, `specialist-activity`, `tool-activity`, `tool-activity-expanded`, `conversation-management`.

#### dark (5)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/dark.tsx#L15-L47): `dark-run-detail`, `dark-approval-center`, `dark-workspace-files`, `dark-memory-recall`, `dark-routines`.

#### files (10)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/files.tsx#L17-L329): `attach-files`, `attach-capiro-file`, `file-extraction`, `file-to-client`, `download-artifact`, `revision-progress`, `filing-receipt`, `artifact-sharing`, `source-access-review-requested`, `download-source-bundle`.

#### memory-proposals (15)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/memory-proposals.tsx#L42-L140): `memory-proposal`, `memory-proposal-submitting`, `memory-proposal-pending`, `memory-proposal-rejected`, `memory-proposal-changes-requested`, `memory-proposal-revised`, `memory-proposals-loading`, `memory-proposals-load-error`, `memory-proposals-retrying`, `memory-proposal-submission-error`, `memory-review-status-uncertain`, `memory-review-status-confirmed`, `memory-review-restricted`, `memory-proposal-changed`, `memory-proposal-refreshed`.

#### memory (7)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/memory.tsx#L78-L159): `memory-recall`, `memory-history`, `memory-history-no-matches`, `memory-detail`, `memory-approved`, `memory-current-approved`, `memory-superseded`.

#### mobile (11)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/mobile.tsx#L18-L98): `phone-routines`, `phone-approval-center`, `phone-memory-recall`, `phone-run-detail`, `phone-conversation-history`, `phone-browser-activity`, `tablet-approval-center`, `tablet-routines`, `tablet-workspace-files`, `phone-artifact-sharing`, `tablet-artifact-sharing`.

#### responsive (21)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/responsive.tsx#L17-L177): `dark-workspace`, `tablet-conversation`, `mobile-home`, `mobile-conversation`, `mobile-navigation`, `mobile-scope-picker`, `tablet-artifact-drawer`, `mobile-artifact`, `mobile-artifact-actions`, `mobile-artifact-revision`, `mobile-versions`, `mobile-upload`, `mobile-filing-receipt`, `mobile-revision-progress`, `document-working-draft-tablet`, `document-working-draft-phone`, `document-mobile-revision`, `mobile-task-approval`, `mobile-sources`, `mobile-filing-review`, `mobile-research-progress`.

#### routines (8)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/routines.tsx#L92-L169): `routines`, `routine-editor`, `edit-routine`, `routine-detail`, `routine-history`, `routine-paused`, `routine-disabled`, `routine-cancelled`.

#### runs (5)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/runs.tsx#L223-L269): `background-runs`, `run-detail`, `steer-run`, `checkpoint-restore`, `interrupted-run`.

#### settings (19)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/settings.tsx#L59-L278): `personal-preferences`, `clear-personal-defaults`, `preferences-saved`, `connector-accounts`, `disconnect-research-portal`, `connection-disconnected`, `usage-limits`, `skills-templates`, `notifications-account`, `updates-panel`, `account-menu`, `signed-out`, `privacy-deletion`, `export-ready`, `deletion-requested`, `help-shortcuts`, `problem-report-sent`, `phone-personal-preferences`, `tablet-personal-preferences`.

#### sources (8)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/sources.tsx#L234-L334): `evidence-sources`, `funding-evidence`, `sources-loading`, `sources-unavailable`, `sources-retrying`, `data-coverage`, `coverage-details`, `access-changed`.

#### states (7)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/states.tsx#L98-L140): `states-run-recovery`, `states-file-artifact`, `states-approval-permission`, `states-conversation-memory`, `states-empty-success`, `retention-states`, `session-states`.

#### workflow-responsive (20)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/workflow-responsive.tsx#L13-L146): `workflow-library-phone`, `commitments-deliverables-phone`, `sources-coverage-phone`, `workflow-request-phone`, `workflow-library-tablet`, `workflow-library-dark`, `phone-setup-research-company`, `phone-setup-relationship-brief`, `phone-setup-client-changes`, `phone-setup-portfolio-changes`, `phone-setup-portfolio-overlap`, `phone-setup-mail-history`, `phone-setup-meeting-prep`, `phone-setup-commitments-audit`, `phone-setup-funding-opportunity-match`, `phone-setup-pe-deep-dive`, `phone-setup-bill-watch`, `phone-setup-hearing-watch`, `phone-setup-representation-lookup`, `phone-setup-regulatory-docket-brief`.

#### workflow-setups (18)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/workflow-setups.tsx#L37-L168): `setup-research-company`, `setup-relationship-brief`, `setup-client-changes`, `setup-portfolio-changes`, `setup-portfolio-overlap`, `setup-mail-history`, `setup-meeting-prep`, `setup-commitments-audit`, `setup-funding-opportunity-match`, `setup-pe-deep-dive`, `setup-bill-watch`, `setup-hearing-watch`, `setup-representation-lookup`, `setup-regulatory-docket-brief`, `task-draft-commitment`, `task-review-source-action`, `task-creation-receipt`, `task-canonical-record`.

#### workflows (21)

[Registrations](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/fixtures/screens/workflows.tsx#L59-L318): `workflow-library`, `commitments-deliverables`, `sources-coverage`, `source-operations`, `artifact-formats`, `code-analysis`, `workflow-request`, `workflow-run`, `funding-market`, `budget-comparison`, `relationship-history`, `portfolio-changes`, `government-watch`, `memory-conflict`, `clarify-context`, `file-extraction-coverage`, `browser-permissions`, `company-research`, `portfolio-overlap`, `artifact-verification`, `exact-source-record`.

### Appendix B. Control-site and test-source review index

The companion `frontend-control-sites.csv` contains **659 JSX control/handler/disabled/href source sites** across the pinned Meri feature sources. It is an exhaustive lexical navigation aid, not a claim that every site is a separate action or enabled capability. The semantic action ledger above is authoritative about routing, durability and missing owners. New current-main owner-memory controls are separately enumerated in §3.4 and are not mislabeled as the old fixture-only memory catalogue.

All implementation tickets have bounded files, a public-contract/owner dependency and a refresh-based acceptance condition. No item is considered closed merely because a button gains an onClick handler, a mock responds, a fixture looks complete, a contract type exists or a flag can be set.


---

<a id="runtime"></a>
