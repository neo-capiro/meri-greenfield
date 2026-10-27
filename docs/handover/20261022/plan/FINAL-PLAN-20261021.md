# Capiro and Meri Final Plan

> **27 October current entry point:** [Wave 4 deployment stopping point](../../20261027/WAVE-4-HANDOFF.md), [Fable handoff](../../20261027/FABLE-HANDOFF.md) and [Wave 5 briefs](../../20261027/WAVE5-BRIEFS.md). Fable owns Wave 4 bug fixes and all existing Research Portfolio requirements under Neo's latest scope change; root integrates/deploys, Hermes reviews and accepts. Wave 5 reconciles current M5/M7 allocations and bounded A5 intake without duplicating Fable. Wave 4 remains OPEN. Dated schedules and role assignments below remain historical.

> **25 October checkpoint:** [WAVE-2-HANDOFF](../../20261025/WAVE-2-HANDOFF.md) owns newer source/live/acceptance facts. Its current roles and [PROCESS templates](../PROCESS.md#6-current-templates) supersede dated roles below. Wave 2 remains IN PROGRESS; source/image qualification is not final authenticated acceptance.

> **Current decision — 24 October 2026.** Neo approved the real Claude Agent SDK on **AgentCore Runtime standard V1**, conversation-scoped isolation, durable native SDK/artifact restore and canonical Core permissions. This replaces per-turn Fargate and the S3 custom warm-pool mechanism. The [migration plan and completion matrix](AGENTCORE-RUNTIME-MIGRATION-20261024.md) are current; this dated plan retains the complete ticket index and acceptance outcomes.
> Item 0 removes the model owner/proxy, budget reservation, duplicate native-authority, custom checkpoint and Temporal-issuer mechanisms. It preserves the actual SDK SessionStore, all memory/data, 14 skills, durable outcomes and Temporal for required runs, schedules and background work. [Standing requirements](../STANDING-REQUIREMENTS.md) and the [supersession register](../source-of-truth/SUPERSEDED-BY-ITEM-0.md) define the boundary. All Item 0/A2/M2/MP/frontend features remain required; source review is not shipping acceptance.
> Root has Neo's autonomous implementation and release authority. Dated source/status/decision tables below are historical evidence where identified, not an instruction to repeat completed migrations or revive removed services.

**Date:** 21 October 2026.
**Roles:** root is the sole orchestrator and shipping owner. Four logical A/U/R/D sessions use Astra Ultra and independent reviews; root assigns exact files and shared contracts, serializes gates and owns AWS/default-profile operations. Neo's current scope and authorization govern all lanes.

This plan puts everything left into a sequence of deployed phases. It merges three sources:

- *Capiro Portfolio, Workspace, Settings and Mail Wiring Closeout Plan* (112 items: X, PF, WS, ST, ML).
- *Capiro Meri Wiring Closeout Plan* (107 items: MG, MB, MO, MF, MR, MT, MM, MX).
- Fable's open work: chat fixes, consolidation, the speed phases, and **client-optional chat**.

The two closeout plans stay the detailed specs: each ticket there already has its evidence, work and acceptance. This plan sets the order, grouping, owner and deployment. **Every ticket appears in exactly one phase**; the index is in section 9.

## 0. Current Wave 2 execution — 24 October 2026

**25 October successor checkpoint:** [CURRENT-STATE](../CURRENT-STATE.md#successor-audit--25-october-2026) supersedes the implementation/deployment status in the dated tables below. All sessions have resumed. One agent completes the preserved local environment while independent product work continues. Accepted successor code now covers skills/client handoff, conversation management, Objective, task/document/file/memory actions, meeting/artifact/file-access recovery, current Mail reads and contact transfer. Routines and General task reads are source-reviewed. Remaining implementation includes the paired routines/contact/brief consumers, file delete/copy and calendar recovery, missing data adapters/General parity, and the identified retention/late-hold defects. Combined local acceptance and the successor AWS release have not occurred. Preserve the full ticket scope below, but do not restart already accepted implementation or repeat unchanged checks.

This reconciles the accepted source inventory at 21:25 with root's subsequent release handoff at the 21:37 documentation cutoff. [CURRENT-STATE](../CURRENT-STATE.md) owns exact release/migration stages; [WORKFLOW](../WORKFLOW.md) owns the execution loop. The original phase/ticket/decision tables below retain scope and lineage. **Implemented, reviewed, built/qualified, deployed and accepted are distinct states.** A missing live receipt is not proof that implementation is missing.

### Immediate release and remaining source work

General migration 49 is applied and General chat/follow-up passed. Runtime version 4/control 67 is stable and new follow-up text appears once. Core 4ce7 and frontend 6118 are image-qualified and merged; Core's four forward migrations are applied and revision 11 is healthy. The existing frontend image-only change set is executed and its rollout is in progress, without a rebuild. Authorized data reads remain unaccepted. Reuse those exact builds and passed checks.

| Work | What remains, using existing owners | Dependency / closure |
|---|---|---|
| Basic chat/data | Finish actual paired rollout and remaining client/General first/follow-up/third turn, Stop, reconnect/history, current wall/permission and data-read cases. Keep the separately reproduced history-only initial model-omission retry limitation open. | Core 4ce7 contains the strict-profile DTO repair; FE 6118 contains completed-turn hold/Stop wording. Those fixes are not new source gaps. Preserve passed General/recovery cases. |
| MF09 conversations | Reviewed Core metadata/search/CAS/Trash/Restore plus runtime/FE packets exist. Finish existing physical-purge production composition and exact deletion/expired-Restore/consumed-key PG coverage; do not build another purger/journal. | Publish/install the actual management receiver and integrate runtime/FE; the history 0.1.13 package is not proof of management support. MF09 is absent from 6118. Keep purge unenabled until its owner, storage custody and 30-day erasure evidence pass. |
| MG05 automatic context | Core PR122 and paired runtime/clock repair are reviewed. Integrate them; fix source only for a demonstrated omission/cost defect. | Core automatic-context route first, then runtime. Accept rich/sparse/denied/current/revoked context, other-subject handling, critical corrections and measured cost. Source read-dispatch estimates are not measured network calls. No new cache/profile store. |
| MG02 / MT13 skills | Complete the missing ordinary composer launcher and typed selected-skill scope/window consumer using existing registry/contracts. | Preserve exact skill ID/version/window through submit/steer/reload/reconnect/resume/fork. All 14 identities/15 assets still need relevant lifecycle and real-output acceptance; installation alone is not completion. |
| PF02 / MF19 context | The client Ask Meri action is still disabled in 6118. Connect existing canonical bootstrap/context and reviewed draft; finish allocated source handoffs/result links. | Current client/object authority; reload/back/client-switch isolation; no auto-dispatch or private context in URLs. No full later-wave Mail/Workspace action expansion. |
| PF13 remaining writes | Undo and contact creation are now reviewed with actual PG evidence. Inspect and finish only missing semantics in meeting create/update, notes/debrief/approval, sharing, calendar sync and non-PF16 file metadata/delete/folder owners. | Reuse domain receipts and exact recovery/refusal owners. Qualify paired deployed behavior without rerunning unchanged contact/Undo gates. |
| PF18 carry-over | New-client conversion/recovery exists. Separate opt-in contact/file/research transfer is missing. | Root resolves finite category/merge/custody choices. Contact-create receipts are not transfer proof; files have immutable prospect origin; existing saved-brief copy remains prospect-bound. No implicit copy-all, email-only merge or generic transfer framework. |
| MP provider/model/effort | Preferences/admission/usage and the Settings/conversation picker exist; ship 6118 and qualify exposed choices. | Only actually qualified Bedrock catalogue entries are enabled. Claude API needs the existing runtime-only secret/IAM path and real provider/continuity/usage/Stop evidence before enabling. No new proxy or credential platform. |

**Schedules/runs:** lifecycle/application/inbox/Temporal code and the reviewed native Objective pair already exist. Confirm actual production mounting/task placement, finish only a missing composition splice, then accept one real occurrence, current consent, overlap, pause/resume/cancel/Stop, restart/inbox/history and Objective initial/regeneration publication. Healthy native TLS or an SDK Task tool does not establish these product outcomes.

**Institutional memory and outputs:** preserve existing memory classes, serving/review/correction/retention owners and their valid PG evidence. Accept current role/wall and General personal/firm restrictions, approved correction in a new thread, actual review consumers and critical-correction recall beyond MG05's bounded first page. For selected documents/skills, retain native DOCX/source results and complete real Core decision→publication→inspection/download→replay and output quality. Do not replace the full SDK/tools with a reduced qualification profile or pull all later M6/Cowork governance into this work.

### A2: 25 tickets, not 25 new screens

All 10 Settings, 6 Portfolio and 9 Mail tickets remain accounted for. Reviewed owner inputs are in FE 6118/Core 4ce7 where applicable; image qualification and the applied Core schema do not close feature/provider acceptance.

| Ticket | Current source and necessary remaining work |
|---|---|
| ST03 | Settings reads repaired; accept admitted reads/permitted writes while preserving preview clone routing. |
| ST04 | Real Clerk profile opener implemented; accept identity opener/return/focus and denial. |
| ST05 | Current Team eligibility/member states implemented; accept real role/billing/member states. |
| ST06 | Existing canonical invitation paging/resend controls retained; real multi-page and partial-failure acceptance remains. |
| ST19 | Authenticated support owner/UI reviewed; 6/6 actual PG passed and migration now applied. Accept receipt/recovery/HQ paging/audit; do not invent a timed retention policy. |
| ST20 | Authenticated broadcast consumer/exact acknowledgment exists; qualify route activation and recipient/reload/multi-tab/admin-count behavior. |
| ST24 | Affected forms repaired; reconcile remaining named HQ/key/bulk/analyst call sites and fix only demonstrated gaps. |
| ST25 | Stripe customer/subscription defect fixed; qualify existing hosted flow/config/return/webhook, not new card/invoice screens. |
| ST27 | Branding save/provider outcomes and bodyless retry reviewed; actual Clerk convergence/lost-ACK acceptance remains. |
| ST28 | Scope navigation/protection implemented; accept actual account/client switches and stale responses; richer handoff is PF02/MF19. |
| PF07 | Canonical Objective associations implemented; accept paired Strategy/Planner/Outreach/meeting persistence and scope. |
| PF09 | Canonical client-ID document filtering implemented; Workspace saved revision/writer and deployed revocation remain. |
| PF13 | Quick Log/Directory/Undo/contact repairs exist; remaining domain owners and deployed checks are listed above. |
| PF14 | Current accepted Directory allocation is explicitly note-only. Root must reconcile the broader beyond-Note ticket before closure or expansion; not a new basic-chat blocker. |
| PF16 | Hearing-aware atomic batch move reviewed; 18 actual PG cases passed. Additive Intel metadata must precede Core behavior; paired real-flow acceptance remains. |
| PF18 | Conversion/recovery exists; accept conversion and separately implement the bounded carry-over stage above. |
| ML11 | Callback reconciliation implemented; real Microsoft/Google/wrong-account outcomes remain. |
| ML12 | Requested/granted/runtime scopes separated; accept actual provider grants/capabilities. |
| ML13 | Permanent reconnect state retained; accept invalid-grant/reconnect lifecycle. |
| ML14 | Resource partial/backfill health implemented; accept real partial/hasMore/backfill outcomes. |
| ML15 | Subscription readiness/recovery implemented; accept actual Microsoft renewal/recovery. |
| ML16 | Bounded call/body/claim behavior implemented; finish provider/ordinary-role contention acceptance; preserve one-dispatch unknown outcomes. |
| ML17 | Truthful disconnect/retained-data behavior implemented; accept real revoke and later access. |
| ML18 | Bounded paging/search/thread behavior exists; rerun only the remaining folder-filter interaction after locator-only 84242999, then provider completeness. |
| ML26 | Unsupported IMAP registration removed; accept truthful capabilities. No new adapter requirement. |

Mail has 30/31 unique selected browser cases across runs, not one all-green run; the remaining locator repair preserved 52 assertions and only collected the case. Its provider checklist remains unrun. The earlier support PG setup timeout is superseded by 6/6 success. Stale inventories calling support, PF16, Undo/contact or the MP picker unimplemented must not restart those owners.

### Order and wave boundaries

1. Finish current Core/frontend rollout and remaining real chat/data acceptance; retain General 49, Core 678 and passed recovery/General evidence.
2. Integrate MG05 and MF09 through existing paired Core/public/runtime/FE owners. Reconcile reserved Meri purge 50–52 against the actual ledger; never renumber applied history.
3. Allocate MG02, PF02/MF19, residual PF13, PF18 and PF14 scope reconciliation. Continue independent schedule/memory/skill/provider acceptance in parallel where ownership allows. Activate qualified targets through coherent existing authenticated routing and configuration. Obsolete preview holds may be removed after target/credential compatibility is verified; preserve canonical authorization, tenant isolation and unrelated service boundaries.
4. After replacement acceptance and rollback closure, refresh and execute the existing legacy-hosting retirement inventory. Its earlier resource counts are historical; preserve active V1/Temporal, durable local services and applied history.

Wave 3 A3/Workspace breadth, new M3 citation/index products beyond retained read parity, broader M4 actions/full mail send, full M6 memory Settings/procedure/Cowork governance, browser takeover/device bridge and customer rollout remain separately sequenced unless explicitly pulled forward. The agreed simple-turn budget remains ≤30 Core calls/≤3 seconds; proposed tighter targets are not newly imposed gates.

## 1. Rules

1. **One coherent release candidate.** Root composes compatible accepted changes in dependency order, builds the candidate once, smokes/scans that image and checks affected live behavior. A phase label does not require a separate unchanged build.
2. **Features stay off until proven.**
   - Root activates a capability only against its qualified compatible owners and verifies its actual preview behavior before claiming completion.
   - Coordinate required UI/backend capability settings; source-only work has an owner and next release step, not an indefinite hold.
   - Use only required capability flags; remove replaced flags and callers after acceptance.
3. **Reuse what exists.** No new frameworks, senders, storage platforms or second implementations. Missing pieces are added at the boundary the closeout plans name.
4. **Measure before building anything heavy.** Expensive designs are built only if telemetry after the cheaper steps shows they're needed (section 7).
5. **Chat/session changes retain whole-flow acceptance.** Reuse valid evidence for unchanged behavior; rerun cases affected by the integrated release:
   - turn 1, then turn 2 straight after;
   - a page reload;
   - reopening after the deploy;
   - a conversation left idle for 20 minutes.

   Each of today's turn-2 bugs slipped past a narrower test.
6. **Keep canonical security owners.** Neo has authorized the work. Root allocates exact Core auth/session/OAuth boundaries and requires independent review and affected real gates; no parallel authorization layer or repeated approval request is inferred from this dated plan.

## 2. How each phase runs

| Step | Who | Output |
|---|---|---|
| Brief | Root | One brief per phase, written one phase ahead: scope (ticket IDs), files, flags and acceptance. It points to the closeout-plan tickets for detail. |
| Build | Allocated agent | Exact bounded source and deletion inventory, with tests run and not run. Root owns shared integration and shipping. |
| Validate | Independent reviewer / root | Targeted independent review, plus a security review for phases that change authority (A1, M2, M4, M6, M8). Run only required affected checks, actual PostgreSQL for changed data/transaction behavior and the ordinary image gate; reuse valid exact-source evidence. |
| Deploy | Root | Merge. Take a database snapshot before any migration. Deploy the backend first, then Meri, then the frontend. |
| Accept | Root | Qualify the compatible target, activate within its allocated preview scope, verify actual behavior and update the status. |

While a phase is being validated and deployed, its agent starts the next phase in its lane.

## 3. Where we are today

> **Historical 21 October snapshot.** The current completion states are in the [AgentCore migration matrix](AGENTCORE-RUNTIME-MIGRATION-20261024.md#current-completion-matrix) and the latest root release receipts. Neither this table nor the historical handoff table is a live status report.

| Area | State |
|---|---|
| Meri chat (preview) | **Two-turn chat works** (candidate 11, greenfield `main` `bce70776`): turn 2 recalls turn 1, and a reload keeps history. About 195 s to first text. |
| Meri blocker | A conversation whose first turn isn't sent within 15 minutes is stuck forever. The fix (C12, migration 0020) is being finished. |
| Meri consolidation | PR197 (reads, writes, documents and memory source, all off) is nearly merge-ready and replaces PR189–192. |
| Core consolidation | `backend-import` `8d9958f7` (PR96, PR97, PR101–104, P6-Core) is **merged, not deployed**. Preview still runs an older Core. |
| Frontend | `main` `24316f91` (preview line plus PR102, PR114, PR115) is **merged, not deployed**. |
| Speed work | P0 telemetry is live. P1 (agent 1) is in progress. P2 PR-A (#196, `c703e9f3`) is revised and awaiting validation. |
| Environments | Restricted preview only (read-only Core). No ordinary staging environment yet. os.capiro.ai still runs capirov2. |

## 4. Lanes: who can work at the same time

| Boundary | Current allocation rule |
|---|---|
| Runtime, control, contracts and infrastructure | Root assigns one writer per file; R implements the allocated SDK runtime, A/U the allocated control/frontend compatibility. Shared contract versions and migrations remain root-owned. |
| App, data tools, Memory and artifacts | Existing domain owners stay canonical. A/U/R/D implement only their current allocation; no second sender, policy service or storage platform. |
| Independent review and documentation | A different author reviews each final exact head; D maintains current plans and reviews other authors. |
| Integration, native gates and shipping | Root alone schedules scarce local resources, operates AWS, owns deploy locks and records remaining acceptance. |

Four logical A/U/R/D sessions may run in parallel on disjoint files. This is the current Codex workflow, not the historical agent-number ownership map.

## 5. The phases

### Phase 0 · Historical baseline sequence (21 October)

This completed/superseded sequence is retained for ticket lineage. Use current ledgers and release receipts; do not execute these old merge, migration or runtime steps.

**Goal:** everything already built is live, and the stuck-conversation bug is fixed.

**Agents build:**
- **Agent 2:** fix PR197's last red test (the declared-slice state in the read-scope ledger, O120), then update `AGENTS.md` to this ownership: agents build, Fable reviews and ships, dot is out.
- **Agent 1:** C12, so unstarted conversations recover (migration 0020), continuing E's handover branch. [MR-07]

**Fable ships:**
- Merge PR197 and release it with every feature off. [MX-02, MT-02, MM-08 source]
- Release C12, with a snapshot before migration 0020.
- Deploy the consolidated Core to preview: 11 Core migrations, applied after a snapshot. Then deploy frontend `main`. [MF-08 regression check]
- Add the session-refusal alarm metric, and start the status table: what's live, what's off, and where. [MX-01]
- **Housekeeping:**
  - close the PRs that PR197 and PR194 supersede;
  - merge or close the stale-browser-spec and proxy-diagnostics branches;
  - record migration numbers: C12 owns 0020, and PR178 must renumber if it is ever adopted [MX-04];
  - WSL disk compaction and a reboot.

**Done when (on preview):**
- E01–E04, E08 and E09 pass, and E11 passes by test;
- a conversation left idle for 20 minutes still works;
- a conversation opened before the Phase 0 deploys still works after them.

### Speed track (lanes R and D)

| Phase | Scope | Done when |
|---|---|---|
| **S1** · P1 + P2 PR-A **[SUPERSEDED 2026-10-23]** | P1 budget table (agent 1). P2 PR-A owner/proxy proof reuse (#196). Dashboards from P0 telemetry [MX-08]. | No behaviour change. Owner exchanges ≤ 13 per model request. A partner restart re-pairs within 30 s (E39). Telemetry stays truthful (E41). |
| **S2** · P2 PR-B + authority-lite **[SUPERSEDED 2026-10-23]** | P2 PR-B (exchange collapse). **Authority-lite**, which replaces ADR P3: Meri control uses Core's combined current-authority receipt and its bounded Clerk cache (P6-Core, deployed in Phase 0) instead of separate identity, membership and context calls. Write intents use the run's own session instead of minting one per intent, which M4 needs. | Core calls per turn ≤ 30 (from about 151). Core time ≤ 3 s per turn. A revoked user loses access within 30 s. |
| **S3** · Interactive session latency **[RE-SCOPED 2026-10-24]** | Standard V1 conversation reuse, idle stop and durable native SDK/artifact restore [MX-06, MX-09]. No Fargate warm pool. | Retain the median first-text target of 15 s and measure cold, warm and restored sessions separately; actual Runtime evidence, cost and cleanup are required. No target achievement is claimed. |
| **S4** · Only if S3 misses its target **[SUPERSEDED 2026-10-23]** | The full signed authority lease (ADR P3), Stop without the task router (ADR P4), or an in-process path for plain chat like os.capiro.ai's. Neo picks. | Target met. |

### Meri track

| Phase | Lanes | Scope | Needs | Done when |
|---|---|---|---|---|
| **M1** · Reliable chat **[RE-SCOPED 2026-10-23: MR-01, MR-02, MR-09 superseded; MR-06, MR-08 re-scoped]** | R + U | **Lifecycle:** MR-01, MR-02, MR-06, MR-08, MR-09; pause, resume and fork across a deploy (E12); the whole-flow chat check built into every release [MX-13]. **UI:** MF-01, MF-02 (including heartbeat and send acknowledgement), MF-06, MF-07, MF-10, and the pinned frontend acceptance matrix MF-21. **Also** the open review follow-ups from candidates 9–11. | Phase 0 | E01–E12 and E40 on preview |
| **M2** · General or client chat | R + U | **Client-optional chat** (details below). New conversation, conversation list, switching and history (MF-09). Automatic client context MG-05. Selected skill and scope kept MG-02. "Ask Meri about this client" PF-02. Cross-module context MF-19 (context part). | M1, and Neo's decision on reads across clients | E06, E45 (context part), and the client-optional checks below |
| **M3** · Read tools on **[RE-SCOPED 2026-10-23: read families become tools on the tool gateway]** | D + U | MT-01, MT-04 to MT-09, MT-16, MO-14, MO-15, MG-06. Citations and evidence UI MF-16. Re-register the reads per O118. Bind each enabled capability to its dependencies [MX-03]. | Phase 0. Reads in General chats need M2. | E18–E20, E31, E44, and each family's positive, negative and paging cases. `reads` turned on. |
| **MP** · Model choice: Claude API alongside Bedrock **[RE-SCOPED 2026-10-23: an SDK provider setting, not a proxy feature]** | D + U | **Two model paths:** Bedrock (today's) and the Claude API. Any current Claude model and reasoning level is selectable: a default in Settings, plus a per-conversation picker. The API key lives in AWS Secrets Manager. Both paths get the same budgets, usage records, telemetry and Stop behaviour. | Item 0 SDK/Runtime provider owner | The whole-flow chat check passes on both paths; switching model or provider mid-conversation works; usage is recorded per provider |
| **M4** · Actions and approvals on **[RE-SCOPED 2026-10-23: approvals via the SDK permission callback plus Core intents]** | D + U | task.create MT-10, task.update MT-11, Research Portfolio actions MO-05, LegiWatch watches MO-06, prospect, client and note changes MO-08. Approval UI MF-03, MF-04, MF-05, MF-12, MF-13. | Item 0 plus the affected Core/intent owner and a qualified target | E13–E17 in staging. `intents` and the approvals UI turned on together. |
| **M5** · Documents, files and research outputs | D + U + A | MM-09 to MM-19, MB-04. UI MF-14, MF-15, MF-19 (completion links). Portfolio PF-03, PF-23. Workspace WS-22, WS-23, WS-24. | M4 | E26–E31 and E45. All six formats open natively. `artifacts` turned on. |
| **M6** · Memory and preferences | D + U + A | MM-01 to MM-07, MR-05. Settings ST-07 to ST-13, ST-18. UI MF-17. Migrations intents/0002 and memory/0002. | M4 and A0 | E23–E25 and E36. `memory` and the memory-review UI turned on together. |
| **M7** · Routines, Cowork and skills | R + D + U | MR-03, MR-04, MR-10, MB-05, MT-12, MT-13 (all 14 skills), MO-01, MO-02, MO-10. Runs and routines UI MF-11, MF-18. Settings ST-15, ST-16, ST-17. | M4, M5 | E32–E35 |
| **M8** · Advanced capabilities, each its own release | R + D + U | Browser, Bash and user devices: MT-14, MB-01, MB-02, MB-03, each with its own isolation qualification (E37, E38). Federal drafting workbench MO-03. Graph, buyer and funding MO-07. Office editing MM-20. | M7 | Each capability's own checks |

### Client-optional chat (in M2)

**Baseline before M2 activation:** native chat requires a selected client; client-record preview writes do not change that rule. On os.capiro.ai, users can ask anything with no client selected, or pick one.

**M2 matches that with one rule:** a conversation is either **General** or **bound to one client**, decided when it is created.

- **Core:** the conversation bootstrap accepts "no client". The current-authority receipt supports a clientless conversation, designed properly this time; an earlier ad-hoc version was removed from PR102. This work is change-controlled.
- **Meri control:** the initial binding, context and tool scopes accept a clientless conversation. A tool that needs a client asks the user to start a client chat instead of guessing.
- **Reads in a General chat:** across the clients the user can already see, with each client's wall enforced per result (Neo's decision 2).
- **Actions in a General chat:** whichever is simpler to build safely. Either they run under the user's own per-client permissions, or they require a client chat. **No new authorization machinery for this.**
- **Memory:** a General chat uses personal and firm memory only, never a client's.
- **UI:** "General" appears in the client selector, and the New conversation button works.
- **Checks:**
  - a General chat answers a general question;
  - it never returns another client's walled data;
  - a client chat cannot see another client;
  - switching between conversations keeps each one's history.

### App track (lane A)

| Phase | Scope | Needs | Done when |
|---|---|---|---|
| **A0** · Ordinary staging environment (root + lane A). Original decision deferred a separate environment; this does not block currently authorized, narrowly qualified preview work. | X-01, X-02, X-03, X-05, X-06; PF-01, PF-21, PF-24, WS-01, ST-26, ML-01. One correct service/schema/provider topology with a controlled test tenant. | Root selects and qualifies the actual target under current authorization | Every service answers at its correct path on exact images; existing flows are smoke-tested. |
| **A1** · Safety fixes | ST-01, ST-02, WS-02, WS-03, WS-04, PF-10, PF-11, PF-12, PF-22, ML-02, ML-03, ML-07, ML-08, ML-09, ML-10, X-04; ST-24 (security-sensitive writes) | Build can start now; live checks need A0 | Direct-API negative tests pass. Deployed to staging. Nothing new switched on. |
| **A2** · Finish screens that already have a backend | Settings ST-03 to ST-06, ST-19, ST-20, ST-24 (remaining forms), ST-25, ST-27, ST-28. Portfolio PF-07, PF-09, PF-13, PF-14, PF-16, PF-18. Mail status and sync ML-11 to ML-18, ML-26. | A1 | Every Settings, Portfolio and mail-read row in the closeout matrices is accepted in staging or explicitly held |
| **A3** · Workspace complete | WS-05 to WS-21: documents, Hill Day, newsletters, templates. System mail ML-24. | A1 | Every Workspace row accepted in staging or held |
| **A4** · Sending mail, including from Meri | ML-04, ML-05, ML-06, ML-19, ML-20, ML-21, ML-22, ML-23, ML-25; ST-14; Timeline reply PF-25; Meri send and reply MO-04, MT-03 (lane D part) | A1 and M4 | Send, reply and forward work on Microsoft and Gmail test mailboxes, with durable receipts. No resend after an unknown outcome (E21, E22). |
| **A5** · New product features | PF-04, PF-05, PF-06, PF-08, PF-15, PF-17, PF-19, PF-20, X-07, WS-25, ST-21, ST-22, ST-23, ST-29 | A2 | Each starts from a proportionate contract from the existing owner, reviewed under root's allocation, then ships like any other phase |

### Launch track (root)

| Phase | Scope | Done when |
|---|---|---|
| **L1** · Launch qualification **[RE-SCOPED 2026-10-23: MX-05/06/07/09; no pair or issuer material in the packet]** | One release packet [MX-04, MX-05, MX-07, MX-10, MX-11, MX-12, MX-14]. Disable and restore MO-09. Reliability corpus MG-01. Figma reconciliation MG-03. Optional Decisions/JEV MG-04. Keyboard and mobile MF-20. Register of original features and exclusions MT-15. Model default MO-13 (an SDK upgrade first needs the transcript-recap handover from O103). Production stacks kept separate from preview. The data path for os.capiro.ai. **A parity list of what users rely on in today's os.capiro.ai.** Alarm email routing. | Packet reviewed, E42 and E43 pass, and Neo signs off the scope |
| **L2** · Internal tenant | Capiro's own tenant moves to the new production stack | One clean week |
| **L3** · First 3 customer tenants | Moves once the parity list is met | Two clean weeks |
| **L4** · All tenants; retire the old runtime | MO-11, MO-12, ML-23 cutover; capirov2 Meri retired | Old paths removed |

**Recommended launch line:**
- **Internal tenant (L2)** after Phase 0, S1–S3, M1–M5 and A0–A4.
- **Customers (L3)** once the parity list is met, which likely includes M6 (memory).
- **After launch:** M7, M8 and A5 continue.

## 6. Running in parallel

> **[RE-SCOPED 2026-10-23]** This wave table predates Wave 2 item 0. Ignore the cells for P1, P2, S1, S2, S4 and MP-as-a-proxy-feature. Wave 2 starts with item 0; the other lanes continue as the handover says.

The following dated wave schedule is historical sequencing, not a current calendar or source allocation. Root updates the migration matrix and exact work allocations as gates complete.

| Wave | Agent 1 · lane R | Agent 2 · lane D | Agent 4 · lane U | Agent 3 · lane A | Fable ships |
|---|---|---|---|---|---|
| 1 (weeks 1–2) | Finish P1, then C12, then M1 runtime | PR197 last test, `AGENTS.md`, P2 fixes, then PR-B | M1 screens | A1 safety fixes | Phase 0; S1 (P1 + P2 PR-A) |
| 2 (weeks 3–4) | Finish M1, then S2 authority-lite | P2 PR-B, then MP (Claude API path) | M2 screens and Core (General chat, New conversation) | A2 | M1, A1 |
| 3 (weeks 5–7) | M2 runtime and V1 conversation lifecycle | M3 read tools | M3 screens | A3 | S2, MP, M2, M3, A2; production data-path question to Neo |
| 4 (weeks 8–10) | Finish S3, then M7 groundwork | M4 actions and approvals | M4 screens | A4 (with agent 2 for Meri mail) | S3, M4, A3 |
| 5 (weeks 11–13) | M7 routines and skills | M5 documents and files | M5 and M7 screens | A5 | M5, A4, M7, then L1 |
| 6 (weeks 14–16) | M8 | M6 memory and preferences | M6 screens | A5 | M6, then **L2 internal tenant** |
| 7 (weeks 17+) | M8 | M8 | M8 screens | A5 | L3 first customers, then L4 |

**UI libraries by wave:** see §10.3. Each phase adopts the libraries assigned to it, Figma first (§10.4).

**Current preview authorization:** Neo lifted the client-record read-only restriction, with exact routing and canonical online tenant/member/client/capacity checks. Selected-client requirements and other feature/provider gates remain. Root qualifies each real target; an old deferred staging decision does not create a fresh approval hold or waive any feature acceptance.

- **Can run together when allocated:** independent A/U/R/D and visible-lane work with disjoint files and non-conflicting shared resources. Root names the writer and dependencies; lane labels alone do not guarantee isolation.
- **Must never overlap:**
  - two changes to the same runtime-core file (lane R works through them one at a time);
  - two releases to the same environment (root runs deploys one at a time);
  - migrations (root numbers and orders them).

## 7. What was simplified, and when to revisit

> **2026-10-24:** the historical ADR P3/P4/P5 alternatives below are superseded by Item 0 and Runtime V1. Keep behavior and latency requirements; do not reintroduce authority leases or a custom warm pool because an acceptance run is slow.

| Before | Now | Revisit if |
|---|---|---|
| ADR P3: signed authority leases with key rotation (2–2.5 weeks) | Authority-lite in S2, using the Core receipt and Clerk cache that are already merged | After S3, Core and Clerk time still exceeds 20% of a turn, or revocation misses 30 s |
| ADR P4: Stop without the task router (1–1.5 weeks) | Only its two-turn and Stop test suite, in M1 | Stop or cleanup latency causes visible problems |
| ADR P6 browser work as a separate phase | Folded into M1 (MF-02) | Not applicable |
| Test tiers T0–T7 and operator gates O0–O7 | The five-step phase loop in section 2, plus each phase's live checks | Not applicable |
| Separate acceptance registries | One status table (MX-01) and the index below | Not applicable |
| More environments | Preview (read path), one staging, then production | Not applicable |
| Full mutation campaigns on every PR | Targeted reviews; full campaigns only where authority changes | A phase ships a defect that a campaign would have caught |

## 8. Decision history and current superseding instructions

Rows 1–17 preserve the recorded decisions. Rows 18–20 append the current execution agreements; they supersede conflicting operational holds/process assumptions without removing product scope.

| # | Decision | Neo's answer |
|---|---|---|
| 1 | Create the ordinary staging environment | **Not yet.** A0 is deferred. Live checks for A1–A5 and M4–M7 wait for it; builds and reviews continue. |
| 2 | General chats read across the clients a user can see | **Yes**, walls enforced per result. Keep it simple: if letting actions span clients is easier, that's fine. No new authorization machinery. |
| 3 | Change-controlled work (Core auth and sessions, OAuth and token storage) | **Approved for all phases.** |
| 4 | Number of agents | **Four**, one per lane. |
| 5 | Launch line | **As recommended:** internal tenant at L2, customers after parity. |
| 6 | Production data path for os.capiro.ai | **Fable raises it when Wave 3 starts.** |
| 7 | Mail scope | **As recommended:** provider-native reply and forward now; drafts later. |
| 8 | A5 product contracts | **As recommended:** a one-page contract each. |
| 9 | Models | Keep the current Claude model on Bedrock, **and add the Claude API as a second code path, with every model and reasoning level selectable** (new phase MP). SDK upgrades still need the recap handover first. |
| 10 | capirov2 comparison | **Deferred.** |
| 11 | Workspace approvals (A1 WS-03) | **Removed** (21 Oct, 22:50 UTC). No approval workflow in Workspace, and no dead code left. Stored approval data stays untouched until an approved drop migration. Sharing, wall and ownership protections stay. Meri, release and Portfolio artifact approvals are unaffected (O143). |
| 12 | New-stack database | **A copy-on-write clone** of the shared Aurora DB for preview Core; the live DB is never migrated by this programme. Data diverges from live from the clone date (O135, O140). |
| 13 | Meri harness (Neo, 23 October 2026) | **Claude handles the harness as much as possible**, for Claude-quality answers: the SDK full harness, direct Bedrock, Capiro data as MCP tools. It is Wave 2 item 0. Wave 1 finishes on the current design first. |
| 14 | Architecture (Neo, 23 October 2026) | **A simple, standard architecture, with no extra security layers.** The owner/proxy pair, budget reservation, per-operation authority and the temporal-issuer are deleted, not completed. Core stays the gatekeeper for Capiro data. |
| 15 | Dead code (Neo, 23 October 2026) | **Leave no dead code behind.** Every change deletes what it replaces; temporary diagnostics are removed; nothing stays dark without an owner and a date (`STANDING-REQUIREMENTS.md` rule 3). |
| 16 | Hosting (Neo, 24 October 2026) | **Implement AgentCore Runtime standard V1 now**, retaining the real Claude Agent SDK, Core permissions, durable native sessions/artifacts, all memory/data/skills and required Temporal durability. Replace per-turn Fargate and S3 warm-pool machinery; leave no dead code. |
| 17 | Completion and authority (Neo, 24 October 2026) | **Finish autonomously and in parallel under root's sole orchestration.** Update all plans, retain every accepted feature, run real acceptance and report gaps. Client-record preview writes are approved without removing selected-client or access walls. |
| 18 | Current execution (Neo, 24 October 2026) | Root Codex on EC2AMAZ-M7CDRPT is the sole orchestrator using profile default. Implementation and separate review sessions use GPT-6 Astra at Ultra, with useful parallel work bounded by root; Fable/dot roles and old work/AWS holds are historical. |
| 19 | Durable development environment (Neo, 24 October 2026) | Preserve WSL, persistent local app/DB services and data, private development configuration, active checkouts and reusable caches across waves. Repair in place; clean only owned disposable tests/temporary release material. |
| 20 | Necessary work only (Neo, 24 October 2026) | Reuse existing owners and valid checks; check the changed behavior, build the release image once, smoke/scan it and verify deployment. Do not add parallel frameworks or blanket gate reruns. Actual source changes/failures and required security/data checks still receive proportionate qualification. |

## 9. Index: every item and its phase

### App closeout plan (112 items)

- **X:** X-01 A0 · X-02 A0 · X-03 A0 · X-04 A1 · X-05 A0 · X-06 A0 · X-07 A5
- **PF:** PF-01 A0 · PF-02 M2 · PF-03 M5 · PF-04 A5 · PF-05 A5 · PF-06 A5 · PF-07 A2 · PF-08 A5 · PF-09 A2 · PF-10 A1 · PF-11 A1 · PF-12 A1 · PF-13 A2 · PF-14 A2 · PF-15 A5 · PF-16 A2 · PF-17 A5 · PF-18 A2 · PF-19 A5 · PF-20 A5 · PF-21 A0 · PF-22 A1 · PF-23 M5 · PF-24 A0 · PF-25 A4
- **WS:** WS-01 A0 · WS-02 A1 · WS-03 A1 · WS-04 A1 · WS-05 to WS-21 A3 · WS-22 M5 · WS-23 M5 · WS-24 M5 · WS-25 A5
- **ST:** ST-01 A1 · ST-02 A1 · ST-03 A2 · ST-04 A2 · ST-05 A2 · ST-06 A2 · ST-07 M6 · ST-08 M6 · ST-09 M6 · ST-10 M6 · ST-11 M6 · ST-12 M6 · ST-13 M6 · ST-14 A4 · ST-15 M7 · ST-16 M7 · ST-17 M7 · ST-18 M6 · ST-19 A2 · ST-20 A2 · ST-21 A5 · ST-22 A5 · ST-23 A5 · ST-24 A1 and A2 · ST-25 A2 · ST-26 A0 · ST-27 A2 · ST-28 A2 · ST-29 A5
- **ML:** ML-01 A0 · ML-02 A1 · ML-03 A1 · ML-04 A4 · ML-05 A4 · ML-06 A4 · ML-07 A1 · ML-08 A1 · ML-09 A1 · ML-10 A1 · ML-11 to ML-18 A2 · ML-19 A4 · ML-20 A4 · ML-21 A4 · ML-22 A4 · ML-23 A4 and L4 · ML-24 A3 · ML-25 A4 · ML-26 A2

### Meri closeout plan (107 items)

- **MG:** MG-01 L1 · MG-02 M2 · MG-03 L1 · MG-04 L1 · MG-05 M2 · MG-06 M3
- **MB:** MB-01 M8 · MB-02 M8 · MB-03 M8 · MB-04 M5 · MB-05 M7
- **MO:** MO-01 M7 · MO-02 M7 · MO-03 M8 · MO-04 A4 · MO-05 M4 · MO-06 M4 · MO-07 M8 · MO-08 M4 · MO-09 L1 · MO-10 M7 · MO-11 L4 · MO-12 L4 · MO-13 L1 · MO-14 M3 · MO-15 M3
- **MF:** MF-01 M1 · MF-02 M1 · MF-03 M4 · MF-04 M4 · MF-05 M4 · MF-06 M1 · MF-07 M1 · MF-08 Phase 0 · MF-09 M2 · MF-10 M1 · MF-11 M7 · MF-12 M4 · MF-13 M4 · MF-14 M5 · MF-15 M5 · MF-16 M3 · MF-17 M6 · MF-18 M7 (browser parts M8) · MF-19 M2 and M5 · MF-20 L1 · MF-21 M1
- **MR:** MR-01 M1 · MR-02 M1 · MR-03 M7 · MR-04 M7 · MR-05 M6 · MR-06 M1 · MR-07 Phase 0 · MR-08 M1 · MR-09 M1 · MR-10 M7
- **MT:** MT-01 M3 · MT-02 Phase 0 · MT-03 A4 · MT-04 to MT-09 M3 · MT-10 M4 · MT-11 M4 · MT-12 M7 · MT-13 M7 · MT-14 M8 · MT-15 L1 · MT-16 M3
- **MM:** MM-01 to MM-07 M6 · MM-08 Phase 0 (source) and M5 (on) · MM-09 to MM-19 M5 · MM-20 M8
- **MX:** MX-01 Phase 0 · MX-02 Phase 0 · MX-03 M3, then every flag · MX-04 Phase 0 and L1 · MX-05 L1 · MX-06 S3 · MX-07 L1 · MX-08 S1 · MX-09 S1–S3 · MX-10 L1 · MX-11 L1 · MX-12 L1 · MX-13 M1 · MX-14 L1

### Meri integrated scenarios (E01–E45)

E01–E04 Phase 0 · E05–E12 M1 (E08, E09 also in Phase 0) · E13–E17 M4 · E18–E20 M3 · E21–E22 A4 · E23–E25 M6 · E26–E31 M5 · E32–E35 M7 · E36 M6 · E37–E38 M8 · E39 S1 · E40 M1 · E41 S1 · E42–E43 L1 · E44 M3 · E45 M2 and M5

### Fable's open items

> **[RE-SCOPED 2026-10-23]** The ADR P1 to P4 and S1 to S2 items are superseded (see the update at the top). ADR P5 (S3) stays.

- **Phase 0:**
  - C12 (unstarted conversations); PR197 merge; consolidated Core and frontend deploys;
  - session-refusal alarm metric;
  - PR and branch housekeeping, `AGENTS.md`, migration register, disk and reboot.
- **M1:**
  - candidate 9–11 review follow-ups: PostgreSQL fixtures, the `running` assertion, the openssl fixture, the ledger load failure, B's four C11 notes;
  - the whole-flow release check;
  - pause, resume and fork across a deploy;
  - ADR P6 browser work.
- **M2:** client-optional chat; New conversation.
- **MP:** Claude API path alongside Bedrock (decision 9).
- **M3:** read re-registration (O118).
- **Speed:**
  - ADR P1 and P2: S1–S2;
  - ADR P3: S2 (lite), or S4 if needed;
  - ADR P4: tests in M1, design in S4 if needed;
  - ADR P5: S3.
- **L1:**
  - transcript-recap handover before any SDK upgrade (O103);
  - alarm email routing.
- **S4 decision:** the capirov2 comparison, on hold.

## 10. UI library and font stack (Neo, 22 October 2026)

Neo named these libraries and fonts as the approved UI stack. Each one is assigned below to the phase and wave that builds its feature. The Figma column points at the reference in "Capiro 3.4 — Meri" (`IXJzJUkXcUTkySHir5JNea`). Where Figma has no reference, the row gives Fable's recommended placement, and **the UI lane adds the Figma master or frame first** (§10.4). Code status is capiro-frontend `main` `e5f1f263` (22 October).

### 10.1 Libraries

| Library | Purpose | Figma reference | In code today | Where it applies (phase · wave · tickets) |
|---|---|---|---|---|
| **AI Elements** | Meri chat, tools, sources and artifacts | Masters: Prompt Input `337:34389`, Suggestion `337:34390`, Source `337:34392`, Tool `337:34425`, Plan step `337:34443`, Confirmation `340:34887`, Message user `340:34888`, Skill suggestion `338:34356`. Screen: Meri · Review map `1064:143241` | **Yes** (`packages/ui/src/ai-elements`, `packages/meri-client`) | M1 (done). **M2** chat shell and conversation switching (MF-09), Wave 2. **M3** Source and InlineCitation (MF-16), Wave 3. **M4** Confirmation for approvals (MF-03 to MF-05, MF-12), Wave 4. **M5** Artifact, Attachments and FileTree (MF-14, MF-15), Wave 5. **M7** Plan, Task and Queue for runs (MF-11, MF-18), Wave 5 |
| **Plate** | Document drafting and editing | Masters: Plate toolbar `526:43330`, Floating selection `526:43331`, Block menu `526:43373`, Meri revision `526:43409`, Comment thread `526:43441`. Screens: 13.24–13.28 document comments, Document overlay · blocks `1064:150601` | No (custom `DocumentEditor` / `WorkbookEditor`) | **A3** Workspace documents and rich newsletters (WS-05 to WS-21, especially WS-15 to WS-17), Wave 3. **M5** artifact editor and natural-language revision (MM-09 to MM-19, MB-04), Wave 5. Replaces the custom editors; it doesn't run alongside them |
| **Schedule-X** | Calendars and schedules | Calendar event · Schedule-X `293:31360`, Calendar week event `313:32568` | **Yes** (both `CalendarGrid`s) | Existing Portfolio and Modules calendars. **A5** government forecast calendar (PF-20), Wave 5–6. **M7** routine schedules (MF-11, MF-18, MR-03), Wave 5 |
| **React Flow** | Organization charts and hierarchies | Org person · React Flow `300:31334` | **Yes** (Portfolio `OrganizationChart`) | Existing Portfolio relationships. **M8** graph views (M8 row "Graph"), Wave 6–7 |
| **Kibo UI** | Roadmaps, Gantt and Planner boards | Gantt bar `542:43607`, Kanban card `542:43644`, Group header `542:43701`, List row `542:43765`, Milestone `542:43784`; review `542:43793` | No (custom planner and roadmap) | **A5** Governed Objective Planner and Strategy intake (PF-06), Strategy projection on target cards (PF-15), Wave 5–6. **M7** routine and run boards (MF-11), Wave 5. Replaces the custom planner and roadmap views |
| **ReUI Cascader** | Hierarchical selectors | Trigger `563:44165`, Option `563:44221`, Panel `563:44282`; review `563:44623` | No | **MP** provider → model → reasoning-level picker (Settings default plus per-conversation), Wave 2. **A2** Objective association authoring (PF-07) and Quick Log client → objective → commitment selection (PF-14; Figma "Overlay · Quick log · Client · Objective menu" `1064:141773`), Wave 2 |
| **coss Origin** | Vertical timelines | Timeline event · coss icon vertical `284:31060`; Advocacy history compact vertical event `414:80880`; Timeline item `20:453` | No (custom timelines) | **A2** mail sync and reconnect history in Settings (ML-13 to ML-15), Wave 2. **A4** Timeline reply (PF-25, ML-20), Wave 4. **M7** run history (MF-11), Wave 5 |
| **coss ui** | Cards, panels and tables | **Not in Figma.** Recommended: the table, card and panel masters on the Components page. Meri · Action table `353:35383` is the closest existing pattern | No | **A2** Settings tables and panels (Team and invitations ST-05, ST-06; HQ broadcasts ST-20; mail connections ML-11, ML-12, ML-17) and Portfolio cards and tables (Files multi-select PF-16, prospect conversion PF-18), Wave 2. **M4** approval and action lists (MF-03 to MF-05), Wave 4. **M6** memory review lists (MF-17, ST-07 to ST-13), Wave 6. **Rule:** use coss ui only for a card, panel or table pattern that shadcn doesn't already cover, so that one library owns each pattern |
| **shadcn/ui** | Shared interface foundation | **Not named in Figma.** Recommended: tag the Component sheet masters (`4:2`, `12:338`) and Capiro 3.1 shared header and sidebar with their shadcn component names during MG-03 | **Yes** (`radix-ui` 1.7, `packages/ui/src/shadcn`) | Every phase. Primitives such as Button, Dialog, Sheet, Popover, Command, Tabs and Form come from shadcn |
| **Recharts** | Charts and reporting | Artifact card Type=Chart Ready / Generating / Error `350:35125`–`350:35127`; Funding visual View=Chart `353:35322`. Screens: 03.04 Spreadsheet preview `1064:145539`, 03.04A `3026:32155` | No (custom charts) | **A2** mail partial health and backfill progress (ML-14), Wave 2. **M5** chart artifacts and report deliverables (MM-08 chart correctness, MM-16), Wave 5. Charts render deterministic data only (GF rule) |
| **Motion** | Layout and panel motion | **Not in Figma.** Only the "Reduced motion" preference exists: 09.01 Personal preferences `3022:29587`, 10.33 `3033:32256`, 10.34 `3033:32515`. Recommended: add a motion spec (durations, easing, enter/exit) to **06 · Shared UI patterns** `1103:280888` | No | **M2** Meri workspace: artifact panel open/close (Artifact workspace `358:35394`), workspace rail collapse (`350:35446`), history filter menus (13.21, 13.22), streamed tool and plan-step layout changes; Wave 2. **A2** app shell sheets, dialogs and popovers, Wave 2. **Must honour** the Reduced motion preference and `prefers-reduced-motion` |
| **Animate UI** | Animated icon controls | Animated icon button `1103:280937` (06 · Shared UI patterns; review `1103:280953`) | No | **M2** composer and message actions (send, stop, copy, regenerate) and sidebar toggles, Wave 2. Honours Reduced motion |
| **Sonner** | Toast notifications | About 15 prototype overlays using "Capiro 3.4 / Library patterns / Sonner …": Copied, Saved, Download ready, Conversation deleted, Research account connected, Task created, Artifact filed, Preferences saved, Connection disconnected, Problem report sent, Export ready, Deletion requested, Signed out, Quick log · Logged | No (custom toasts) | **M2** copy and conversation deleted, Wave 2. **A2** Settings outcomes (feedback sent ST-19, connection disconnected ML-17, preferences saved), Wave 2. **M4** task created, Wave 4. **M5** artifact filed, download and export ready, Wave 5. **Rule (existing):** a toast never signals completion on its own; completion comes from the server receipt, with no placeholder success |
| **cmdk** | Search and command palettes | 01.05 Search and command palette `1064:144529`; 01.05A no matches `3034:37943`; Global search overlays desktop `1064:141068`, tablet `1064:141241`, phone `1064:141406` | **Yes** (through shadcn `command.tsx`) | **M2** Meri search, command palette and conversation switching (MF-09), Wave 2. Global sidebar search when its live search is enabled (parity list) |
| **MapLibre + react-map-gl** | Maps | Map marker `20:461` (sheet `20:454`) and `icon/map-pin` `20:382` only; **no map screen** | No | Recommended: **client facilities map** on the Portfolio client profile (facilities and geocoding already exist), and prospect and district geography, in **A5** (product contracts), Wave 5–6. The UI lane designs the map frame using the Map marker master first. Lazy-load per route |
| **Media Chrome + Vidstack** | Hearing media controls | **Media Chrome:** Modules / Media Chrome / Hearing player `955:186700`, `1064:267525`. **Vidstack: not in Figma** | No | Hearing playback: **M3** citations that open a hearing at its timestamp (MF-16), Wave 3. **M4** LegiWatch watches (MO-06), Wave 4. Recommended split: **Media Chrome supplies the controls Figma specifies; Vidstack supplies the playback engine** (HLS providers, captions, keyboard). If they conflict, Media Chrome's UI wins because Figma specifies it. Lazy-load |
| **Lucide** | Icons | 50 `icon/*` masters on the Components page, used on 223 prototype screens | **Yes** (`lucide-react` 0.577) | Every phase |

### 10.2 Fonts

| Font | Use | Figma | Code |
|---|---|---|---|
| **Geist Sans** | All interface text | 15,218 text layers | **Yes** (`geist` package, root layout) |
| **Geist Mono** | IDs, code, numeric and tabular values | 273 text layers | **Yes** |
| **Newsreader** | Editorial and document headings (Portfolio, artifacts, documents) | 78 prototype text layers plus 50 on components | **Yes** (self-hosted variable font; `--font-newsreader`) |

### 10.3 Libraries by wave (added to §6)

| Wave | New library adoption |
|---|---|
| 1 (done) | AI Elements, shadcn/ui, Schedule-X, React Flow, cmdk, Lucide, Geist Sans/Mono, Newsreader (already in code) |
| 2 | **M2:** Motion, Animate UI, Sonner (plus AI Elements and cmdk). **MP:** ReUI Cascader. **A2:** coss ui, coss Origin, Recharts (ML-14), ReUI Cascader, Sonner, Motion |
| 3 | **A3:** Plate. **M3:** Media Chrome + Vidstack (hearing citations), AI Elements Source and InlineCitation |
| 4 | **M4:** AI Elements Confirmation, coss ui approval lists, Sonner. **A4:** coss Origin Timeline reply. LegiWatch hearing playback (MO-06) |
| 5 | **M5:** Plate (artifacts), Recharts (chart artifacts). **M7:** Schedule-X routine schedules, Kibo UI run boards. **A5:** Kibo UI (PF-06, PF-15), Schedule-X forecasts (PF-20), MapLibre + react-map-gl (facilities and geography) |
| 6–7 | **M6:** coss ui memory lists. **M8:** React Flow graph views |
| L1 | **MG-03 Figma reconciliation** confirms every library-built component matches its Figma master |

### 10.4 Rules for every library

1. **Figma first.** Before building a component from a library row marked "Not in Figma", or one without a screen, the UI lane adds the Figma master or frame. Code Connect `get_design_context` is the spec; never a screenshot. Today that's coss ui, Motion (spec), Vidstack and the map screen.
2. **Pin and license.** Pin every package version, and pin registry components (AI Elements, shadcn, Kibo UI, ReUI, coss, Animate UI are copied into `packages/ui`) by source hash. Record the license (GF-02). Use only free or open tiers. A paid tier (for example Schedule-X premium plugins, React Flow Pro, Plate Plus) needs Neo's approval.
3. **One library per pattern.** No two libraries for the same UI pattern (shadcn vs coss ui; Media Chrome controls vs Vidstack UI). A library replaces the custom code it supersedes in the same phase, with no parallel implementation left behind.
4. **Performance.** Heavy libraries load lazily, on the route that needs them: Plate, Recharts, React Flow, the Kibo Gantt, MapLibre, the media players.
5. **Accessibility.** Motion and Animate UI respect the Reduced motion preference and `prefers-reduced-motion`. Every library component keeps keyboard and screen-reader behaviour (MF-20).
6. **Truthful UI is unchanged.** Libraries change presentation, not completion semantics. Server receipts still decide success. Toasts, charts and status chips never invent an outcome.
