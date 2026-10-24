# Capiro Portfolio, Workspace, Settings and Mail Wiring Closeout Plan

> **Current decision — 24 October 2026:** Meri uses the actual Claude Agent SDK on [AgentCore Runtime V1](../plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md). No app ticket is removed. Root has autonomous implementation/shipping authority; exact owner allocations and real acceptance still apply. Meri entry points consume one canonical context contract, not a new authority DTO. Neo also lifted the client-record preview read-only restriction; retain selected-client, tenant/member/client walls and the exact route/target guards. All other feature/provider gates remain until qualified. See [standing requirements](../STANDING-REQUIREMENTS.md).

**Historical audit prepared:** 21 October 2026. **Mode at that date:** comprehensive read-only source audit and implementation-ready plan. **Implementation performed:** none. **Audited source refs:** exact table below; live deployment and provider acceptance remain unverified.

## Executive verdict

Capiro is **not an unwired shell**, but it is also **not fully wired end to end**. Much ordinary client/profile CRUD, Portfolio data entry, Workspace document/Hill Day/newsletter editing, Settings administration, Microsoft/Google connection and mailbox sync already has real UI→API→service source. Rebuilding those systems would duplicate existing work.

The remaining work falls into five distinct groups:

1. **Concrete source defects to fix before enabling or expanding affected actions:** provider mutation replay/uncertain-send handling and threading; Workspace ownership/client-wall/share/approval consistency; Settings tenant storage-key and privileged-member boundaries; selected Portfolio meeting/commitment lifecycle and receipt handling. These are confirmed source-level enforcement or consistency gaps. This audit did not demonstrate a live exploit or establish that any affected code is currently publicly exposed.
2. **Missing consumers and incomplete action lifecycles despite existing backend support:** account-management entry, recipient broadcast acknowledgement, selected team eligibility, Workspace draft/share/review/template operations, newsletter client/subject staging, file/batch and member-log gaps, mailbox capabilities and status/receipt refresh.
3. **Genuinely missing product contracts or implemented-but-held behavior:** Meri client/profile/file handoffs, safe enrichment proposals, objective-to-work execution/association, prospect conversion/carry-over, authoritative metrics, full Memory governance/preferences and some advanced mail/document flows. These are not solved by adding a URL or changing a flag.
4. **Source already written but not in default branches:** frontend115, Core104 and Meri197 contain reusable supplemental work. Their exact scope and holds are recorded below. Old open donor PRs are frequently already contained; do not receive them twice.
5. **Configuration, deployment and live-qualification gates:** restricted preview deliberately blocks most operations; Strategy/Workspace/Onboard/Engagement/Meri require their correct separate mounts, identities, migrations, callbacks, jobs and runtime flags. Current source/test presence does not prove a live working path.

**Recommended order:** freeze source and launch scope; close authorization/send-safety defects; finish consumers of existing contracts; implement true missing contracts; integrate/regress; then root performs qualified migration/deployment/provider activation and controlled end-to-end acceptance under the current authorization. Do not broadly disable preview guards or restore retired runtime code to make controls appear functional.

**Full closeout versus first release:** A smaller first release may deliberately hold optional capabilities, but a held/deferred row remains an open item in the full requested-scope inventory. It is not counted as wired. Where product semantics or an authoritative contract are absent, the first bounded deliverable is an owner-approved request/response, authority and receipt contract; implementation follows that decision. This plan identifies those decision gates rather than pretending undefined behavior is ready to code.

## What is included

- Portfolio index, client profiles and their actual nested tabs; Business Development/prospects; objectives/relationships/targets; Strategy/Planner destination dependencies; meetings/calendar/documents; files/artifacts; outreach and activity/commitment workflows present in the inspected source.
- Modules Workspace documents/drafts, Hill Day, simple and rich newsletters, templates, comments/collaboration/review, export/share/upload and Meri artifact access boundaries.
- All actual Settings route sections and nested administration, analyst, governance and preference tabs, including account, profiles, team/roles, branding, integrations, billing and Memory.
- Personal Microsoft365/Outlook and Gmail connection/read/sync/send paths, native-threading/draft/attachment capabilities, background jobs and provider failures; related Meri/Outreach send ownership and separate system-mail paths.
- Shared auth/proxies/operation contracts, service mounts, source/PR disposition, configuration propagation, migrations/storage/jobs, regression tests and operator-only release gates.

The domain matrices are the coverage ledger: each row names the action family, current source state and remaining closure. Their gap tickets specify severity, evidence, root cause, bounded work, dependency and acceptance. The integrated execution plan assigns file ownership and ordering. Explicit unresolved coverage appears at the end, rather than being hidden under a claim that every runtime path was tested.

## Reading the status and priority labels

| Label | Meaning |
|---|---|
| Implemented in main / source-wired | Inspected current source contains the relevant handlers/contracts/services; no live acceptance is implied. Individual defects may still be listed. |
| Implemented in open PR / receiver | Required source exists at the specified unmerged head; do not rewrite it or claim it is on default. |
| Missing implementation / consumer / contract | An actual unsupported control, missing lifecycle step, boundary mismatch or absent authoritative contract remains. |
| Configuration or activation held | Source has an intentional flag, hard-off, deployment constraint or authority/qualification prerequisite; enabling needs the named gate, not a workaround. |
| Live unverified | Image/routing/DB/provider/runtime behavior was not exercised by this audit, even if source and fixtures exist. |
| Intentional external / unsupported / superseded | Keep the current safe owner/hosted flow or record a product decision; do not resurrect or invent missing facts. |

**P0** means a security/authority/data-integrity or fundamental activation prerequisite must close before the affected capability ships. **P1** means a core user-visible flow, contract or reliability defect. **P2** means completeness, optional product expansion or UX gap that still requires an explicit supported/held decision. Priorities apply to the affected path, not an assertion that the whole deployed product is compromised.

## Deliverable navigation

1. [Cross-cutting exact refs, call-chain map and X tickets](#cross-cutting).
2. [Portfolio coverage and PF tickets](#portfolio).
3. [Workspace coverage and WS tickets](#workspace).
4. [Settings coverage and ST tickets](#settings).
5. [Mail/provider coverage and ML tickets](#mail).
6. [Integrated stages, parallel file ownership, operator checklist, regression matrix, definition of done and unresolved coverage](#execution).

All repository paths in this document refer to the specified repositories, not to a suggested new project. Source links are pinned where possible. Previous test receipts are identified as previous receipts; no test counts are silently aggregated across overlapping suites.


## Consolidated work index and no-duplication rules

The domain registers contain **112 indexed closure items: X 7, PF 25, WS 25, ST 29 and ML 26**. These are not 112 independent defects: some are intentional cross-owner pointers, configuration/qualification gates, product decisions or optional unsupported capabilities. Use the canonical owner map below before creating implementation tickets. Coverage comprises 52 Portfolio action-family rows, 47 Workspace action-family rows plus 216 mounted-route entries, all 19 Settings route keys and their nested actions, and the provider/action matrix for Microsoft, Google and related system-mail senders. Counts are different inventory dimensions and must not be added together.

A domain's **P1 release blocker** is mandatory before the affected action activates, even where another domain labels the corresponding security/data-integrity gate P0. This is a scheduling normalization, not a claim of a production incident. Source-confirmed authorization issues and residual risks requiring reproduction remain distinguished in each ticket.

| Shared boundary | Canonical implementation owner / tickets | Referencing scope and duplication rule |
|---|---|---|
| Restricted preview versus ordinary product | X-01; ST-03 owns the concrete archived-roster query defect | PF-01 is a pointer to the same release-profile decision. Use the approved narrow client-record preview write path with canonical online checks; retain reserved roster guards and all unrelated gates. |
| Service mounts, flags, image and migration qualification | X-02–06 | PF-24, WS-01, ST-26 and ML-01 provide domain-specific acceptance, not four competing routing/configuration projects. |
| Draft canonical client identity | WS-04 owns schema/DTO/storage/version/list/backfill; Portfolio owns its consuming adapter | PF-09 is the cross-reference. WS-13 staging fidelity follows the same canonical identity, not a second name-based patch. |
| Meri artifact access/public contracts | WS-23/24 with the existing Meri owner | PF-23 consumes the typed bridge. Receive current FE115/Meri197 only after review; PR192 is donor lineage, not another merge. |
| Meri client/profile/file/generation entry | PF-02/03 and WS-22/24, coordinated by the existing Meri owner | Different entry points may reuse one accepted context/artifact contract. Do not implement competing authority DTOs, renderers or runtime clients. |
| Provider reply and Timeline reply | ML-05 shared sender contract; ML-20 selects/enables the product consumer | PF-25 is the Timeline pointer. ML-06 updates the legacy Meri action consumer of the same provider boundary. Canonical Meri read tools remain read-only. |
| Single-mail send safety | ML-02 transport; ML-03 durable intent; ML-04/09 reconciliation/identity; ML-07 authority | These are separate necessary layers of one send path, not interchangeable fixes. Existing OutreachSendIntent and Meri proposal machinery remain; no fake campaign records or second mail platform. |
| Newsletter staging and dispatch | WS-04/05/13 own basic saved content/client/subject; WS-15/19 own rich stage/consumer; ML-02–07/21/23 own dispatch correctness | Existing Core prepare/test/send remains the sender. Do not build a Workspace SMTP/OAuth sender. |
| Workspace collaborator/reviewer notifications | WS-08/17 own UI and recipient state; ML-24 owns SES/system delivery | Notification email is separate from newsletter campaign delivery. A single authorized test of one does not authorize the other. |
| Prospect drafts, proposals and conversion | PF-17 is the canonical new-proposal ticket: Workspace owns its durable draft/revision contract and Portfolio owns entry/receiving UI. PF-18/19 remain Core BD/Portfolio conversion/brief review; WS-25 preserves current copy/draft invariants | Existing prospect transfer denials stay. An approved transfer manifest is distinct from linking a prospect to a client. |
| Settings/Meri connection status | Mail ML-08/11/12/17/25 owns actual OAuth and mailbox identity | ST-14 either reuses/links that owner or requires a different explicit Meri grant contract; no duplicate OAuth integration. |
| Settings Memory | ST-07–10 shared governance/grants/files/notifications; ST-11 separate owner-review slice | FE115 owner review is not completion of all nine governance tabs. Runtime retention, public DTO and deployment gates remain separate. |
| Mutation receipts and recovery | PF-13, ST-24, WS-05/15/20, ML-03 retain their existing domain owners | Split by enumerated mutation family; reuse existing safe-dialog/receipt patterns. Do not create a new universal command framework to satisfy these parent tickets. |
| Hosted billing/capacity | ST-25 owns Core read + Onboard/Stripe handoff | Portfolio billing and PF-18 conversion use the same capacity/entitlement owner; no duplicate billing writer. |
| Metrics | PF-05/20 own Portfolio facts; X-07 owns seven hub cards | Define each metric's actual source/denominator/time-window and unavailable state. Similar-looking cards do not justify invented common counts. |

### First coding batches after separate implementation authorization

1. Baseline/contract decisions: X-01–06, source receivers, current owners, ordinary environment, absent-contract decisions including ML-19 incoming attachments support. This can be prepared in parallel with isolated fixture tests without enabling anything.
2. Immediate source-safety and shared-schema foundations: ST-01/02; WS-02/03/04; PF-10/11/12/22; ML-02/07/08/10. Confirm residual ML-09 identity risk with a failing synthetic fixture before choosing its migration. Implement the approved mailbox namespace/lineage correction with ML-03 and before ML-04 reconciliation. WS-04 canonical client shape precedes WS-05 save/version and WS-13 staging. Preserve existing guards while doing so.
3. Durable effect/receipt work: ML-03/09 before ML-04, then ML-05/06/16/24; WS-05/09/10/12/15; enumerated PF-13/ST-24 forms. Do not enable affected share/send/approval paths before prerequisite authority fixes.
4. Existing-owner consumers and bounded lifecycle corrections: ST-04/05/06/20/27/28; PF-07/18; WS-06/07/08/13/16/17/19/20/21; ML-11–15/17/18/21. Each ticket states where a contract decision or backend correction must precede its consumer.
5. Missing product semantics and explicitly held capabilities: remaining Portfolio Meri/enrichment/objective/prospect/forecast work, full Settings Memory/preferences/HQ unsupported surfaces, Workspace agent/artifact/template extensions and accepted ML-19 inbound-attachment implementation and optional mail drafts/forward/realtime/providers. Decide support explicitly, implement bounded accepted contracts, or leave visibly open/unsupported. Do not silently count deferral as wiring.
6. Integrated regression, owner-reviewed source reception, and separately authorized migration/deploy/provider acceptance follow the final execution section. An earlier batch completing does not permit activation by itself.

### Indexed ticket navigation

The following links lead to the exact bounded ticket, not to a generic backlog category. Source evidence, root cause, work, dependencies and tests remain in that ticket.

#### Cross-cutting

- [X-01](#x-01) · Separate restricted preview from ordinary product activation
- [X-02](#x-02) · Qualify service ownership, mounts, prefixes and authority end to end
- [X-03](#x-03) · Close configuration-to-deployment propagation without equating flags with readiness
- [X-04](#x-04) · Preserve and test current tenant/client/session authority at every hop
- [X-05](#x-05) · Reconcile schema, migration, storage and worker prerequisites by service
- [X-06](#x-06) · Require source→image→runtime receipts, not synthetic success
- [X-07](#x-07) · Define authoritative hub metrics rather than inventing counts

#### Portfolio

- [PF-01](#pf-01) · P0 prerequisite · Qualify ordinary Portfolio deployment separately from the restricted preview
- [PF-02](#pf-02) · P1 · “Ask Meri about this client” has no canonical context handoff
- [PF-03](#pf-03) · P1/P2 · “Create with Meri” profile and Files starters are not implemented
- [PF-04](#pf-04) · P1 safety hold · Enrichment Start / Run again / Retry cannot safely use the legacy start API
- [PF-05](#pf-05) · P2 · Portfolio/profile/bill/prospect/federal summary placeholders lack compatible aggregates
- [PF-06](#pf-06) · P1 activation/contract · Governed Objective Planner and Strategy intake are hard-disabled
- [PF-07](#pf-07) · P1 frontend omission · Durable Objective associations exist in Core but have no authoring UI
- [PF-08](#pf-08) · P2 product/backend gap · Objective Questions and applied Automation lack real producers
- [PF-09](#pf-09) · P1 cross-owner · Work/Workspace documents are matched by mutable client name, not canonical client ID
- [PF-10](#pf-10) · P0 native-read blocker · Four meeting reads do not establish current selected-client visibility
- [PF-11](#pf-11) · P1 · Editing an unchanged client assignment rewrites meeting association provenance
- [PF-12](#pf-12) · P1/P2 · Debrief list omits approval/sharing metadata needed by artifact controls
- [PF-13](#pf-13) · P1 reliability · Several ordinary mutations have only mounted/session uncertainty fences, not durable attributable receipts
- [PF-14](#pf-14) · P2 · Directory member Quick Log supports Note only
- [PF-15](#pf-15) · P2 · Government target card has no linked Strategy / ask / next-action projection
- [PF-16](#pf-16) · P2 · Files multi-selection cannot perform an atomic batch move
- [PF-17](#pf-17) · P1/P2 cross-owner · Prospect proposal execution and file transfer are deliberately unsupported
- [PF-18](#pf-18) · P1 · Prospect conversion UI only links an existing client; new-client and reviewed carry-over are missing
- [PF-19](#pf-19) · P1 safety hold · Prospect brief refresh can be previewed but not accepted as the exact reviewed text/citations
- [PF-20](#pf-20) · P2 product/data gap · Calendar government forecasts have no published exact-date source contract
- [PF-21](#pf-21) · P1 configuration/navigation · Some detail actions rely on explicitly configured existing-app/Workspace destinations
- [PF-22](#pf-22) · P1/P2 correctness · Undated commitment/request cannot settle; rich metadata cannot be edited
- [PF-23](#pf-23) · P1 cross-owner / open PR · Meri-generated document access is not equivalent to Portfolio Files access
- [PF-24](#pf-24) · P0/P1 shared service prerequisite · Strategy/Planner and Outreach V3 need the correct mounted runtime cohort
- [PF-25](#pf-25) · P1 cross-owner · Timeline email reply is review-only

#### Workspace

- [WS-01](#ws-01) · Workspace-specific readiness and qualification (P0 release gate; configuration-held)
- [WS-02](#ws-02) · Enforce current Hill Day document/client authority everywhere (P0)
- [WS-03](#ws-03) · Close draft sharing/approval authorization holes (P0)
- [WS-04](#ws-04) · Canonical client association for legacy drafts (P1, cross-Portfolio dependency)
- [WS-05](#ws-05) · Atomic ordinary draft/newsletter save and concurrency (P1)
- [WS-06](#ws-06) · Complete library semantics and durable navigation (P1)
- [WS-07](#ws-07) · Ordinary document lifecycle, content editing and version use (P1)
- [WS-08](#ws-08) · Ordinary collaboration, review, context, checks and locking consumers (P1)
- [WS-09](#ws-09) · Safe approval/share/public-review completion (P1, after WS-03/05)
- [WS-10](#ws-10) · Hill Day durable job lifecycle and resume (P1)
- [WS-11](#ws-11) · Finish Hill Day editing and correction coverage (P2; owner-dependent AI held)
- [WS-12](#ws-12) · Recoverable Hill Day export and stable signing (P1)
- [WS-13](#ws-13) · Basic newsletter staged content fidelity (P1)
- [WS-14](#ws-14) · Basic newsletter templates/assets and preview fidelity (P2)
- [WS-15](#ws-15) · Rich-newsletter exact recovery and pinned preview receipt (P1)
- [WS-16](#ws-16) · Rich newsletter content/library/brand/survey consumers (P1)
- [WS-17](#ws-17) · Rich newsletter review/collaboration and system-mail handoff (P1)
- [WS-18](#ws-18) · Rich assets and optional provider tools (P1 consumer gap; configured capability holds)
- [WS-19](#ws-19) · Complete rich-newsletter Outreach handoff, not a second sender (P1)
- [WS-20](#ws-20) · Campaign Template Studio recovery, refresh and history (P2)
- [WS-21](#ws-21) · Real document Template Studio, themes and assets (P1 missing consumer)
- [WS-22](#ws-22) · General document generation and agent consumers, with correct owner (P1 missing consumer / intentional AI hold)
- [WS-23](#ws-23) · Receive current all-format artifact access correctly (P1, open-PR supplemental)
- [WS-24](#ws-24) · Meri file workspace/upload/preview/history consumer boundary (P1 missing consumers; intentional holds)
- [WS-25](#ws-25) · Preserve and complete prospect/copy guarantees (P2 residual lifecycle; intentional holds)

#### Settings

- [ST-01](#st-01) · Close the branding object-ownership bypass (P0, MAIN defect, pre-activation blocker)
- [ST-02](#st-02) · Enforce protected-member removal server-side (P0, MAIN defect, pre-activation blocker)
- [ST-03](#st-03) · Make Settings honest and usable in read-only preview (P1, CONFIG + concrete query defect)
- [ST-04](#st-04) · Add a real account-profile/security opener (P2, MAIN UI gap; Clerk EXTERNAL)
- [ST-05](#st-05) · Align Team controls with effective permissions and member states (P2, MAIN UI gap)
- [ST-06](#st-06) · Complete invitation enumeration and preserve resend identity (P2, MAIN backend completeness)
- [ST-07](#st-07) · Wire shared Memory Governance Center (P1, missing consumer/contract; Core exists)
- [ST-08](#st-08) · Wire memory access grants without bypassing walls (P1, missing consumer/contract)
- [ST-09](#st-09) · Wire Firm/My files and governed submission (P1, missing consumer/contract)
- [ST-10](#st-10) · Connect Memory review notifications (P2, missing consumer)
- [ST-11](#st-11) · Finish and qualify PR115 owner-memory slice without conflating it with governance (P1, HELD + CONFIG)
- [ST-12](#st-12) · Qualify personal-preference persistence and deliberate consumption (P2, MAIN/CONFIG, effect gap)
- [ST-13](#st-13) · Finish designed personal defaults/accessibility/reset, or explicitly retire them (P2, UNSUPPORTED)
- [ST-14](#st-14) · Connect Meri Connections to the correct authorization owner (P2, UNSUPPORTED)
- [ST-15](#st-15) · Wire Meri usage, effective limits, and queue navigation (P2, UNSUPPORTED)
- [ST-16](#st-16) · Wire skills/templates as permission-preserving starting points (P2, UNSUPPORTED)
- [ST-17](#st-17) · Connect workspace update preferences and header entry (P2, UNSUPPORTED)
- [ST-18](#st-18) · Wire privacy/retention/export/deletion through existing policy owners (P1 if promised for launch; otherwise P2 UNSUPPORTED)
- [ST-19](#st-19) · Remove fake feedback receipt and wire actual help/feedback (P2, MAIN presentation bug + UNSUPPORTED service)
- [ST-20](#st-20) · Deliver and acknowledge HQ broadcasts in the user shell (P1, missing frontend consumer)
- [ST-21](#st-21) · Complete audited HQ impersonation only as a whole boundary (P1 HELD, intentionally disabled)
- [ST-22](#st-22) · Supply managed-import status or remove the unsupported promise (P2, UNSUPPORTED)
- [ST-23](#st-23) · Finish Provision→PE and SAM analyst queues with exact domain contracts (P2, UNSUPPORTED)
- [ST-24](#st-24) · Finish mutation lifecycle, receipt, and scope safety across remaining forms (P1 for consequential HQ/security writes; P2 elsewhere)
- [ST-25](#st-25) · Qualify the actual billing handoff and settle in-app parity (P1 CONFIG for launch; P2 optional UI parity)
- [ST-26](#st-26) · Qualify configuration, schema, workers, and live receipts separately from merges (P1 CONFIG/LIVE?)
- [ST-27](#st-27) · Make branding-name provider convergence truthful (P2, MAIN partial provider wiring)
- [ST-28](#st-28) · Preserve client context and rebind actions on scope changes (P2, navigation/lifecycle)
- [ST-29](#st-29) · Resolve API-only actions and explicit product exclusions (P2 decision, not automatic new features)

#### Mail

- [ML-01](#ml-01) · Prove each mail route reaches its intended runtime
- [ML-02](#ml-02) · Prevent automatic replay of Graph mutations below the send ledger
- [ML-03](#ml-03) · Give single-mail an actor-scoped durable dispatch identity and recovery receipt
- [ML-04](#ml-04) · Reconcile Graph immediate sent rows with authoritative mailbox ingestion
- [ML-05](#ml-05) · Implement actual provider reply semantics before enabling reply everywhere
- [ML-06](#ml-06) · Align legacy Meri mail actions with reviewed sender and original thread
- [ML-07](#ml-07) · Complete server-side client/person preflight before irreversible single-mail send
- [ML-08](#ml-08) · Make adding versus reconnecting a mailbox identity-safe
- [ML-09](#ml-09) · Mailbox-qualified persistence identity
- [ML-10](#ml-10) · Remove wrong-account token-cache fallback and prove refresh concurrency
- [ML-11](#ml-11) · Consume OAuth outcomes in Settings
- [ML-12](#ml-12) · Separate requested scopes, actual grants and runtime capability
- [ML-13](#ml-13) · Preserve permanent reconnect state through sync failure
- [ML-14](#ml-14) · Report mail-specific partial health and backfill progress
- [ML-15](#ml-15) · Complete Microsoft subscription lifecycle recovery
- [ML-16](#ml-16) · Bound provider calls and make sync claim lifetime match execution
- [ML-17](#ml-17) · Make disconnect available and explain retained-data semantics
- [ML-18](#ml-18) · Close mail UI pagination/search/completeness and bound thread reads
- [ML-19](#ml-19) · Resolve incoming attachment support explicitly
- [ML-20](#ml-20) · Decide draft persistence, forward and Timeline reply product scope
- [ML-21](#ml-21) · Validate aggregate outgoing payload limits before provider dispatch
- [ML-22](#ml-22) · Integrate canonical Meri mail composition without mistaking source presence for activation
- [ML-23](#ml-23) · Keep legacy send paths deliberately gated through V3 cutover
- [ML-24](#ml-24) · Separate system-mail activation and close weaker SES delivery claims
- [ML-25](#ml-25) · Qualify OAuth replay, identity claims and encryption-key rotation
- [ML-26](#ml-26) · Make unsupported IMAP and consumer-provider scope truthful


<a id="cross-cutting"></a>

## Cross-cutting source, deployment and acceptance audit

### Authority and evidence boundary

This is an implementation plan, not an implementation receipt. Only connected-GitHub reads and scratch research/document files were used. No repository, branch, PR, infrastructure, configuration, credential, provider connection, mailbox, database or live deployment was changed. No actual mail was sent. Source test files and previous PR receipts were inspected; this audit did not rerun builds, tests or authenticated live acceptance.

The requested outcome is comprehensive closure of Portfolio, Workspace, Settings and mail integrations. Existing code is to be reused. The retained Next.js frontend, Core API, separate Strategy/Planner service, Workspace service, Onboard billing owner, Engagement service boundary and greenfield Meri contracts remain the architecture. Do not create a new integration platform, duplicate editor, second identity layer, generic workflow engine or parallel mail stack to close these gaps.

### Exact audited source baseline

Baseline refs were read through GitHub at 2026-10-21 15:43 UTC and independently rechecked unchanged at 16:00–16:01 UTC. Domain final checks through 16:05 UTC reconfirmed the relevant frontend/Core and Meri197 heads. These are source snapshots, not deployed-runtime observations:

| Repository | Default branch | Current default head | Supplemental PR | Current PR head | Disposition |
|---|---|---|---|---|---|
| neo-capiro/capiro-frontend | main | `4f9a7e8dcaa9ba03494dc5a49559daf70cea5100` | [115](https://github.com/neo-capiro/capiro-frontend/pull/115) | `7fda299e2264d17a5a88c1dad50b08633ba862ae` | Open draft, not merged. Current metadata overrides stale `368ce652…` in its body. |
| neo-capiro/capiro-backend | backend-import | `309af848f1aa403f6c8e54aa0d22990d4230f063` | [104](https://github.com/neo-capiro/capiro-backend/pull/104) | `5bf901173e839c0145069ec42e16dcb40c373ba6` | Open draft, not merged. |
| neo-capiro/meri-greenfield | main | `3c56c3e981ba868a2af103c4cae9f65a0d47458d` | [197](https://github.com/neo-capiro/meri-greenfield/pull/197) | `cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a` | Open draft, not merged. |

Do not equate an open donor PR with missing code. Frontend 94's ordinary Modules/Settings work is already contained through the merged receiving sequence 97, 101, 105 and 110. PR115 is a supplement, including held memory review/correction/proxies, the refreshed roster source pin, status correction and six-format document-access consumer. It is not a general missing-Settings patch. PR114 is subsumed by115, not an additional independent receipt. Core104 receives cleanup/Directory pagination/Strategy raw ingress/outreach visibility and successful-send outcome correction. Meri197 receives read composition, intent/document contracts, guarded memory retention/tombstones and other supplemental source; it does not authorize native activation. Its unresolved PR178 canonical target-descriptor/C10 reconciliation and alternative local-SDK lease architecture remain separate decisions; matching generated contracts does not settle native handoff or host authority. Recheck exact ancestry and current heads at implementation start, because these repositories are active.

Existing PR receipt caveats must remain visible: Core104 reports 62 inherited broad Core TypeScript diagnostics unchanged from base, not a wholly green typecheck. Meri197 reports 504/506 public tests, inherited/OS-dependent failures, native/PKI/render gaps, and unqualified host activation. Frontend115 synthetic browser/build receipts are not proof of live services or native rendering. These are author-reported source receipts, not independently rerun results in this audit.

### Shared call-chain map

| Surface | Browser transport | Server-side gate | Backend owner | Completion evidence required |
|---|---|---|---|---|
| Most Portfolio features | React Query + `shared/portfolio/api` | `/api/backend/[service]/[...path]`, permitted roots, path/method/origin checks, Clerk `capiro` template | Core `/api`, Strategy `/strategy-api`, Workspace `/workspace-api`, explicit Intelligence tracker owner | Correct response schema, current actor/client scope, operation receipt where present, targeted invalidation and confirmed subsequent read |
| Modules Workspace and Settings | `useCapiroQuery` / `useCapiroMutation` | `/api/capiro/[operation]`, fixed registry, request/response schemas, origin check, registered multipart/binary modes | Registered `core`, `strategy`, `workspace`, `intelligence`, `onboard` service | Validated response and current-scope reload; no unregistered arbitrary backend URL |
| Meri conversations, actions, documents, task commands, preferences | Dedicated typed client/proxy families | `/api/conversations/*`, `/api/action-followthrough/*`, `/api/documents/*`, `/api/task-commands/*`, `/api/settings/user/*`, separate flags | Greenfield Meri opaque-session/native authority and versioned contracts | Exact conversation/run/artifact/intent/session binding and durable receipt, not a UI-only success |
| Preview exceptions | Dedicated preview read/first-chat/conversation gateway | `CAPIRO_PREVIEW_READ_ONLY`, exact route and source/target/image pins | Separately qualified preview Core/Meri owners | Qualified matching image and source plus current membership; ordinary routes stay held |
| Mail providers | Portfolio or Settings → Core/Engagement routes | Current user/tenant/client/provider connection checks | Existing Microsoft/Google adapters, encrypted connection tokens, sync workers and receipts | Provider-specific dispatch/readback receipt; no fabricated sent status or automatic blind replay |
| Billing mutations | Fixed Settings operation | Onboard URL and Clerk session auth where specified | Onboard owns Stripe write/portal/checkout | Authorized hosted redirect and eventual authoritative billing refresh, not Core mutation |

Source: [fixed route](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/app/api/capiro/%5Boperation%5D/route.ts), [registry](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/registry.ts), [gateway](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/gateway.ts), [Portfolio proxy](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/api/proxy.ts), [Portfolio route](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/app/api/backend/%5Bservice%5D/%5B...path%5D/route.ts).

Both frontend transports already exist. Do not replace them in this closeout. Fixed-operation writes deliberately do not auto-retry; `useCapiroMutation` prevents concurrent submission and drops stale results after scope changes. The generic Portfolio proxy uses a 30-second deadline and a 2 MB JSON body ceiling; fixed operations have explicit operation limits and multipart/binary support. Workspace itself accepts larger document payloads. Any newly wired upload/export must use the correct existing typed transfer path, not push binary through the generic JSON proxy.

Source: [mutation/read lifecycle](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/queries.ts), [typed transfers](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/http.ts), [Workspace HTTP setup](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/main.ts).

<a id="x-01"></a>

### X-01 — Separate restricted preview from ordinary product activation

**Priority:** P0 activation prerequisite, not a justification to weaken containment. **State:** implemented containment; broad product activation intentionally held; current live state unverified. **PR disposition:** default source plus roster refresh in115; no PR claims all product paths enabled.

**Evidence/root cause.** Preview policy rejects nonqualified operations with503 `PREVIEW_BACKEND_HELD`. The current frontend service template enforces `CAPIRO_PREVIEW_READ_ONLY=true`; Strategy URL is constrained to empty; Onboard URL is injected empty; action/document workflows are false. Core roster source is constrained to an empty value even though an approved source string exists in code, pending combined image/digest qualification. Thus this is not solved by supplying ordinary URLs or changing one boolean. The fixed Settings preview reads are only `me.read` and separately qualified `clients.list`; Portfolio/Meri preview exceptions are separately enumerated. Source pins describe intent, not identity of the actual running service.

**Bounded work.** Platform owner prepares two explicit capability profiles: retain the current restricted preview unchanged; separately document and qualify the intended ordinary test/product deployment for the requested feature families. If preview capabilities themselves must expand, use a narrowly reviewed change to the exact allowlist, template constraints, source/image binding and backend read authority, with negative tests. Do not replace preview targets with production services, remove the fail-closed gate, silently expand write paths or copy historical image qualification to a new head. Coordinate roster's Profiles incompatibility with ST/PF gap owners.

**Acceptance.** With restricted preview selected, blank/unqualified source or target bindings and malformed configuration remain held before contacting any backend. Ordinary-mode defaults outside that selected profile are a distinct configuration, not preview admission. Qualified reads target only their pinned service; wrong source/digest/origin is refused. Ordinary authorized test profile reaches each required mounted service with no preview exemption bypass. UI distinguishes held/setup-required/unauthorized/empty data. Final operational receipt includes actual source and image digest for every serving process and host route.

**Files/evidence:** [policy](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/preview/backend-policy.server.ts), [target validation](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/preview/read-config.server.ts), [preview proposal](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/deployment/portfolio/preview-config.mjs), [service template](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/deployment/portfolio/service.yml).

<a id="x-02"></a>

### X-02 — Qualify service ownership, mounts, prefixes and authority end to end

**Priority:** P0 activation prerequisite. **State:** source mounts exist, configuration/live routing unverified; V3 mismatch is a concrete dependency. **PR disposition:** Core104 supplements Strategy ingress, not a replacement service architecture.

**Evidence/root cause.** The fixed registry has no independent `engagement` service key. V3 operations choose `core`, but ordinary Core AppModule does not import OutreachV3State/Generation/Send modules; EngagementApiAppModule does and adds EngagementRuntimeGuard. Existing Core mounts legacy Engagement/integration/callback/worker modules. Strategy/Planner and Workspace are separate apps, not routes proved by Core health. Workspace global prefix is `/workspace-api`; Strategy's is `/strategy-api`; full base URLs must include existing routing prefixes. The checked-in ALB priority manifest explicitly calls itself a historical/source-only candidate and states current AWS ownership is unverified.

**Bounded work.** Produce a path→service→process→image→auth table for the chosen environment. Preserve existing edge routing or add the smallest explicit dispatch seam if a distinct Engagement upstream is required; do not add V3 modules to standard Core merely to mask a routing error. Verify owning runtime and worker flags before serving any path; keep one provider subscription/scheduler/send owner during handover. Match callback/webhook paths to the owning service. Confirm root-vs-prefixed Meri URL requirements. Read current deployment state before generating a change set; do not infer it from historical taskdefs.

**Acceptance.** For every feature family, unauthenticated request fails appropriately, current authorized tenant request reaches the intended controller, wrong method/body/path fails before side effects, disabled runtime returns held state, no duplicate scheduled owner exists, and the same service's receipt is visible after UI refresh. Smoke checks must include actual feature endpoints, not only `/health`.

**Files/evidence:** [Core mounts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/app.module.ts), [Engagement mounts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement-api.app.module.ts), [Strategy mounts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api-strategy/src/app.module.ts), [Workspace mounts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/app.module.ts), [routing caveat](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/infra/routing/capiro-prod-alb-priorities.json).

<a id="x-03"></a>

### X-03 — Close configuration-to-deployment propagation without equating flags with readiness

**Priority:** P1. **State:** configuration/activation work, with bounded template/documentation gaps in the inspected preview profile. **PR disposition:**115/197 may supply consumer/producer source; no activation authorization follows.

**Evidence/root cause.** Runtime configuration reads `CORE_API_BASE_URL`, `STRATEGY_API_BASE_URL`, `WORKSPACE_API_BASE_URL`, `INTELLIGENCE_API_BASE_URL`, `ONBOARD_API_BASE_URL`, `MERI_API_BASE_URL`, `CAPIRO_REQUEST_ORIGIN`, designated Clerk keys and explicit `TRACKER_BACKEND`. Meri configuration additionally requires independent conversation/action/document/task-command/intent-approval/user-preferences flags. The inspected preview task template carries conversation/action/document flags but no `MERI_INTENT_APPROVALS_WORKFLOW_ENABLED`, `MERI_TASK_COMMAND_WORKFLOW_ENABLED` or `MERI_USER_PREFERENCES_ENABLED` parameter/env entry. This is an intentional held preview, not proof these features are enabled elsewhere. `.env.example` is not a complete operational contract.

**Bounded work.** In the selected ordinary deployment owner, map each required server variable to validated config, secret reference where applicable, container environment and startup/readiness receipt. Add only the missing parameters needed for approved features, false by default. Distinguish public build-time material from server-only values. Preserve exact origin validation and document-operation family binding. Add a source-only config parity test that lists known activation switches and verifies chosen profiles explicitly set or intentionally hold each one. No secret value belongs in source, browser bundle or evidence.

**Acceptance.** Blank/invalid URL, mismatched Clerk environments, wrong Meri root prefix, absent issuer, absent scope, unavailable downstream and held flag each produce truthful blocked UI without calls to alternate services. Each enabled feature has both frontend and backend readiness demonstrated on exact source/image. Independent switches do not accidentally unlock one another.

**Files/evidence:** [fixed config](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/config.ts), [Portfolio config](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/config/config.ts), [Meri connection flags](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-actions/connection-config.ts), [intent flag](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-intents/config.ts), [preference flag](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-user-preferences/config.ts).

<a id="x-04"></a>

### X-04 — Preserve and test current tenant/client/session authority at every hop

**Priority:** P0 security acceptance gate; domain-specific fixes are listed in their domains. **State:** substantial existing authority implementation, not a missing global auth layer. **PR disposition:** preserve receiver safeguards; do not overwrite with old donor code.

Core resolves current local user/membership/tenant, cross-checks Clerk org/tenant claims and rejects removed/suspended memberships. Separate services use the required `ORG_TENANT_RESOLVER` and TenantGuard, resolving canonical UUID rather than treating Clerk org IDs as tenant UUIDs. The shared guard's source notes that Workspace `ws_*` data relies on guard plus explicit tenant predicates rather than PostgreSQL RLS. Tenant authorization alone does not prove owner/collaborator/client authorization. The frontend selected client is a navigation/data-scope hint, never authority. Ordinary Core identity handling can provision/self-heal/update last-seen; a supposedly read-only live probe must not be assumed mutation-free merely because it uses GET. Dedicated preview native reads intentionally bypass those mutations.

**Bounded work.** Reuse the current guards and current-membership checks. Domain owners add missing resource/role/client predicates only at identified holes. Test stale cached identity, no selected client, client switch while a query/write is pending, active→removed membership, same-tenant wrong owner, wrong tenant, archived client, impersonation constraints, provider connection owner mismatch and role downgrade. Ensure response/error/redirect data cannot leak another tenant's existence or tokens. Do not synthesize tenant claims or widen server permissions to make a fixture pass.

**Acceptance.** Negative cases deny before provider/storage/write effects; pending results from a prior user/org/client are discarded; reload uses the current actor; current membership is rechecked at irreversible send/share/decision boundaries where required. Same-tenant ACL tests are separate from cross-tenant tests.

**Evidence:** [Core middleware](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant/tenant-context.middleware.ts), [shared TenantGuard](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/auth/src/tenant.guard.ts), [resolver contract](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/auth/src/org-tenant-resolver.ts), [scope lifetimes](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/CapiroBoundary.tsx).

<a id="x-05"></a>

### X-05 — Reconcile schema, migration, storage and worker prerequisites by service

**Priority:** P0 activation gate; P1 implementation work where a new contract needs persistence. **State:** migration source exists; applied state and grants unverified. **PR disposition:** Core104 explicitly has no schema/migration changes; do not assume it applies historical migrations. Meri197 leaves command-retention/migration binding held.

**Bounded work.** Inventory migration ledger and schema checksum separately for Core, Strategy, Workspace, Onboard and greenfield Meri. Include mail connection/message/attachment/sync/send-intent tables; client/prospect/objective/activity/version links; Workspace draft/version/lock/collaborator/share/approval/newsletter data; Settings membership/branding/memory; provider job claims/outbox and retention. Classify needed migrations as already applied, pending, superseded or held using the actual target database and a reviewed read-only ledger query. Migration filenames in this repository include future-looking timestamps; never infer applicability from today's date or blindly run every migration from an unrelated schema. Preserve separate Prisma clients, explicit app DB roles, storage buckets and least-privilege object access. Add only required migrations for approved new durable fields/constraints and test upgrade from current baseline plus data backfill/rollback or forward-fix.

**Acceptance.** All selected services boot against a staging copy at the selected schema; migration ordering and checksums are reproducible; foreign-key/unique/version constraints reject cross-scope or duplicate state; scheduler leases survive restarts; storage ACLs and malware/quarantine state are honored; rollback disables feature safely without losing successful provider outcomes or exposing revoked shares. Destructive reset/purge scripts are not a rollout step.

**Evidence:** [Core schema](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/prisma/schema.prisma), [Strategy schema](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api-strategy/prisma/schema.prisma), [Workspace schema](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/prisma/schema.prisma), [Onboard schema](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/onboard-api/prisma/schema.prisma).

<a id="x-06"></a>

### X-06 — Require source→image→runtime receipts, not synthetic success

**Priority:** P1 release qualification. **State:** live unverified for the whole requested scope. **PR disposition:** all candidate receivers require fresh exact-head checks and owner-authorized merge/deployment.

**Bounded work.** Preserve a per-action acceptance ledger containing route/control, operation, request schema, downstream controller, persistence/provider receipt, expected refresh, test tier, actor/client/provider, exact source/image, result and evidence. Reuse existing tests; add targeted regression cases for listed gaps. Snapshot inherited failures against untouched base, then require no new diagnostics and no unexplained relevant failure. Final aggregate checks still run even if targeted suites passed. Keep source compilation, mocked/browser fixture, local real DB/provider simulator, deployed read-only and authorized live write tests separate.

**Existing commands to reuse, after checking each script's effects:** frontend Node24/npm11.9: `npm run check`, `npm run build`, `npm run test:browser`, `npm run test:browser:modules`, relevant `test:newsletter` suites; Core pnpm9.12: scoped package typecheck/build/tests plus applicable backend-only verification scopes, not the retired frontend suites; Workspace/Strategy each expose build/typecheck/test and explicit Prisma deploy commands; Meri Node24 exposes contract and distribution checks with native qualification separately. No command here was run by this audit. Never run a `--run`, migration, live-eval, sender or deployment script merely because its name contains "verify"; inspect it and use isolated fixtures first.

**Acceptance.** Owner can identify which exact action is fully live-qualified, which is source-ready, which is configured-but-held and why. No historical image qualifies a newer source. No skipped/native-unavailable test is reported passed. Failed writes are distinguished from unknown outcomes and reconciled before retry; backend receipt contracts, not toast presence, determine completion.

**Evidence:** [frontend commands](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/package.json), [Core commands](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/package.json), [Meri commands](https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/package.json), [frontend shipping qualification](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/deployment/portfolio/README.md).

<a id="x-07"></a>

### X-07 — Define authoritative hub metrics rather than inventing counts

**Priority:** P2 product-contract gap, adjacent to the requested surfaces. **State:** missing aggregate contracts/UI consumer, not a missing navigation handler. **PR disposition:** ordinary cards already in main; no current supplement supplies all seven aggregates.

Main ModuleHub queries available client profiles and renders navigation cards for Engagement, Planner, Workspace, Strategies, Directory, Intelligence and Research Portfolios. It has no card metric query. Existing capped/owner/grant-scoped lists and Portfolio summary are not interchangeable with firm-wide totals. Preview intentionally does not show the ordinary cards or selector.

**Bounded work.** Product and each existing module owner define the exact metric, unit, actor-versus-tenant visibility, client filter, statuses/time window and freshness. Supply bounded authorized aggregates from existing owners; compose only if needed by the seven-card screen. Return unavailable separately from measured zero; never count one page, infer missing records or silently enlarge permission scope. Wire those named values into cards only if the product still wants metrics. Otherwise retain honest navigation-only cards and record the deliberate omission, not a false "fully wired metrics" claim.

**Acceptance.** Empty versus denied versus unavailable versus stale are distinct; paginated populations produce correct totals; actor/client/tenant filters agree with list visibility; partial downstream failures do not zero out other metrics; preview holds remain unchanged.

**Evidence:** [current hub](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/hub/ModuleHub.tsx), [authoritative receiving map](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/docs/integration/CORE-MODULES-RECEIVING-20261018.md).


<a id="portfolio"></a>

## Portfolio wiring audit and bounded closeout plan

Read-only source audit, 21 October 2026. This document is a planning deliverable, not authorization to change code, configuration, access, infrastructure, data, or provider state.

### 1. Executive finding and evidence boundaries

Ordinary Portfolio is substantially implemented, not a collection of mock screens. The audit found real handlers, validated transports, mounted controllers and persisted services for most CRUD, activity, relationships, capabilities, bill tracking, files, meetings, prospect management, and resource navigation. What remains falls into four different classes that must not be conflated:

1. **Implemented-main / live-unverified:** source paths exist, but native authentication, selected-client visibility, runtime routing, migrations, workers, provider behavior and deployed image identity have not been exercised by this audit.
2. **Activation-held:** preview policy intentionally returns 503 for almost everything outside the explicitly reviewed read/first-chat/conversation cohorts. Governed Objective surfaces also have explicit false frontend gates. Removing a disabled attribute or broadening the proxy is not the fix.
3. **Missing or incompatible contract/UI:** specific visible controls are disabled or informational because a safe persistence, review, context or receipt contract is absent. Those are enumerated PF-02 through PF-25 below.
4. **Open-PR source / superseded history:** current main contains many historical “open PR” features. GitHub PR state alone does not prove a change is missing. PR115 contains a newer roster source pin and supplemental Meri source, but is not main or a live deployment.

#### Pinned evidence

- Frontend main: [4f9a7e8dcaa9ba03494dc5a49559daf70cea5100](https://github.com/neo-capiro/capiro-frontend/tree/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100).
- Backend backend-import: [309af848f1aa403f6c8e54aa0d22990d4230f063](https://github.com/neo-capiro/capiro-backend/tree/309af848f1aa403f6c8e54aa0d22990d4230f063).
- Heads were refreshed during the audit. Open [frontend PR115](https://github.com/neo-capiro/capiro-frontend/pull/115) was read through the live pull API at 15:50 UTC: draft/open, head **7fda299e2264d17a5a88c1dad50b08633ba862ae**, base 4f9a7e8dcaa9ba03494dc5a49559daf70cea5100, updated 15:30:32Z. Its body cites an older head, so the API head is authoritative.
- The actual PR115 read-config file pins qualified roster Core **50475125275853299798fc40f8cb119f0b865464**. Main still pins **b97a3286487abcda6a7424cf1dc2812d93b65b3d**. See [PR115 read configuration](https://github.com/neo-capiro/capiro-frontend/blob/7fda299e2264d17a5a88c1dad50b08633ba862ae/apps/web/src/shared/preview/read-config.server.ts), [main read configuration](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/preview/read-config.server.ts#L5), and open [PR111](https://github.com/neo-capiro/capiro-frontend/pull/111). PR115 is the reported superset of PR114/111/112, not a second independently mergeable activation plan.
- Open PR75/80/96/99/100/103 and other historical stack entries were found by current search. Their named functionality was compared against main source, not classified as missing simply because GitHub still lists them open. The governed reads/intake, ordinary Portfolio refinements, Outreach receiving, and preview-roster UI are already present in main; their runtime qualifications remain separate.
- No test, browser session, native login, provider send, database mutation, migration, deployment, PR edit or repository edit was performed for this audit. Historical PR test claims are not this audit's results.

#### Coverage and exclusions

The Portfolio subtree census contains **498 implementation .ts/.tsx files**, all retrieved and source-scanned, excluding conventional test, public barrel and contracts.ts files from that count. Relevant contracts, fixed operations, shared proxy/config, actual receiving destinations, backend controllers/modules/services were read additionally. The 498-file count is inventory coverage, not a claim that every possible behavior or every service SQL branch was proven.

Subtree counts: advocacy 26; bill-tracker 35; billing 8; calendar 86; capabilities 12; client-intake 12; client-profile 111; files 34; index 24; intake 14; objectives 37; opportunities 5; prospects 37; relationships 51; work 6.

Included routes: /portfolio; /portfolio/prospects; /portfolio/prospects/[prospectId]; /portfolio/[clientId] and /bills, /calendar, /capabilities, /files, /objectives, /opportunities, /relationships, /work; shared /calendar. The audit includes the Strategy/Planner/Outreach/Workspace destinations actually reached from these routes. It does **not** claim a complete audit of unrelated Modules functionality. Workspace/Meri document access, Settings and provider-mail mechanics have separate canonical owners in the combined plan.

### 2. Shared transport, authority, mount and receipt model

- Ordinary Portfolio generally uses [ApiClient](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/api/http.ts) → same-origin Portfolio API proxy → an explicitly selected service. It is incorrect to label all Portfolio actions fixed /api/capiro operations.
- Objectives, modern Modules destinations and some shared reads use the fixed-operation registry [registry](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/registry.ts) and [gateway](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/gateway.ts).
- [Portfolio proxy](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/api/proxy.ts) obtains native Clerk bearer server-side, validates configured upstreams, constrains service/path roots, performs non-GET origin checking, and bounds JSON/request time. It does not turn a configured target into proof of service mounting or client authorization.
- [runtime configuration](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/config/config.ts#L27) requires separate Core, Strategy, Workspace and Intelligence API targets. STRATEGY_API_BASE_URL is essential for Work, Planner, legacy Objective drafts/materialization and Strategy receiving. CAPIRO_EXISTING_APP_URL and CAPIRO_WORKSPACE_URL are navigation destinations, not API base URLs.
- [preview backend policy](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/preview/backend-policy.server.ts) is fail-closed. Read-only preview is not ordinary operation with a hidden auth bypass. [PreviewClientCatalog](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/PreviewClientCatalog.tsx) deliberately exposes CLIENT roster rows/count/local search, not details, selection, owner filters, layouts or writes.
- Backend ownership is real: [Core app](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/app.module.ts) → [ClientsModule](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/clients.module.ts), [BusinessDevelopmentModule](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/business-development.module.ts), [EngagementModule](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.module.ts); [Strategy app](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api-strategy/src/app.module.ts) → Planner/Strategy/Meri modules. Outreach V3 state/generation routes need [EngagementApiAppModule](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement-api.app.module.ts); registering service “core” in the frontend does not mount them on the ordinary Core process.
- Most legacy services use Prisma tenant transactions; some also enforce current user/client access. The four meeting reads in PF-10 are a verified exception where meeting ownership is not equivalent to current selected-client visibility. All proposed activation cohorts require native role/client-wall tests, not a frontend preflight as substitute.
- Existing UI commonly validates resource/client IDs and reviewed versions, retains drafts on error, invalidates relevant query families on acknowledgement, and freezes ambiguous writes. That is good source wiring, but a current-state GET is not necessarily an attributable operation receipt. PF-13 addresses only the remaining command/recovery gaps.

### 3. Action-family coverage matrix

Status key: **M** implemented in main, live-unverified; **H** intentionally held by preview/capability/config; **G** bounded gap below; **R** read/navigation-only by current product contract. In the restricted preview only, M operations outside its allowlist remain H; ordinary controlled deployment is a separate qualification path.

| Surface and actual action family | UI/handler → transport / owner → persistence or provider → refresh/receipt | Disposition |
|---|---|---|
| Portfolio index / Clients / Prospects / Partners / search / sector / tag / owner / sort / cards/table | [PortfolioIndex.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/PortfolioIndex.tsx), [queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/queries.ts), [IndexFilters.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/IndexFilters.tsx) → Core clients, client-account-owners and tenant-members; business-development reads only for relevant non-CLIENT tabs → ClientsService/BusinessDevelopmentService + Prisma; local filters do not claim server aggregate completeness. [clients.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/clients.controller.ts), [client-account-owner.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-account-owner.controller.ts) | M; preview limited roster H; metrics PF-05. |
| Customize layout / pins / profile order / save / reset | [PortfolioLayoutEditor.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/layout/PortfolioLayoutEditor.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/layout/api.ts) → GET/PUT me/portfolio-layout → PortfolioLayoutController; actor/versioned layout receipt and local retained edit state → UI reread. [portfolio-layout.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/users/portfolio-layout.controller.ts) | M; H in preview. |
| Attention panel / retry / client destination | [PortfolioAttention.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/attention/PortfolioAttention.tsx), [query.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/attention/query.ts) → GET intelligence/portfolio-alerts?limit=50; source-bounded result, independent refresh; capped per-client disclosure. [intelligence.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/intelligence/intelligence.controller.ts) | M, not full portfolio metric. |
| Add/edit/archive profile; company/sector/registrations; logo intake | [CreateProfileDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/CreateProfileDialog.tsx), [ClientIntakeDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-intake/ClientIntakeDialog.tsx), [profile-api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-intake/profile-api.ts) → Core clients POST/PUT/DELETE; latest saved source merge, capacity/auth checks, client receipt → invalidate clients/billing/detail; ClientsService persists client/intake data. [clients.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/clients.service.ts) | M manual; Meri creation G PF-03. |
| CSV import / review / submit / partial receipt | [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/intake/csv/api.ts) → Core bulk intake endpoint; reviewed row command → ClientsController/ClientsService; explicit receipt and roster/capacity invalidation. [clients.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/clients.controller.ts) | M; native billing/duplicate cases unverified. |
| LDA firm search / link registrant / candidate selection / import | [RegistrantImportDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/intake/registrant/RegistrantImportDialog.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/intake/registrant/api.ts) → firm/lda-registrants, registrant, import-candidates, import → FirmOnboardingService, Prisma + prepopulation; import receipt and candidate/client/billing refresh. [firm-onboarding.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/intelligence/firm-onboarding.controller.ts), [firm-onboarding.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/intelligence/firm-onboarding.service.ts) | M; permissions and paid-capacity boundary retained. |
| Profile capacity and billing summary | [ProfileCapacityStatus.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/billing/ProfileCapacityStatus.tsx), [summary-api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/billing/summary-api.ts) → Core billing/state and billing/summary; read-only capacity/permission authority. Inline payment is deliberately absent from this preview. [billing.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/billing/billing.controller.ts) | M/R; Settings billing owner, not a missing charge handler. |
| Profile details / Government registration / federal activity / program context | [ClientDetails.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ClientDetails.tsx), [GovernmentInfo.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/GovernmentInfo.tsx), [FederalActivity.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/FederalActivity.tsx), [ClientProgramContext.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ClientProgramContext.tsx) → Saved client data + Core District Nexus / PE relevance; current scoped schemas, independent data errors, bounded paging; Prisma source data and client mappings. [district-nexus.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/district-nexus/district-nexus.controller.ts), [client-pe-relevance.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/intelligence/client-pe-relevance.service.ts) | M/R except missing funding aggregates PF-05. |
| Profile notes / tags / account and ordered owners / team membership | [notes-writer.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/notes-writer.ts), [actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/tags/actions.ts), [team-writer.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/team-writer.ts), [OwnerCards.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/OwnerCards.tsx) → Core client notes/intake tags, owner/team endpoints; fresh client/member actor checks → ClientTeam/OrderedOwner services + Prisma → scoped invalidation and pending-dialog fences. [client-team.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-team.service.ts), [client-ordered-owner.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-ordered-owner.service.ts) | M; preserve unknown owner IDs, no fabricated labels. |
| Export profile | [ClientProfileExport.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/export/ClientProfileExport.tsx), [actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/export/actions.ts) → Fresh Core client + intelligence snapshot; browser JSON download records unavailable sources rather than silently inventing completeness. [clients.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/clients.controller.ts), [intelligence.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/intelligence/intelligence.controller.ts) | M; no external export send. |
| Ask Meri about client | [ClientMeriActions.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ClientMeriActions.tsx) → Disabled dropdown; no canonical client context handoff dispatch.  | G PF-02. |
| Activity timeline / filter / date range / refresh / pin / edit / remove / settle / reopen | [ActivityTimeline.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ActivityTimeline.tsx), [ActivityActions.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ActivityActions.tsx), [activity-change.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/activity-change.ts) → Core clients/:id/activity → ClientActivityService; recorded + derived event projection, Prisma, refreshed current activity identity before mutation. [client-activity.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-activity.service.ts) | M; undated lifecycle G PF-22; legacy command attribution PF-13. |
| Global/client Quick Log note/call/email/decision/request/commitment | [GlobalQuickLog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/GlobalQuickLog.tsx), [QuickLog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/QuickLog.tsx), [QuickLogDetailFields.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/QuickLogDetailFields.tsx), [actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/actions.ts) → Core activity POST persists optional dueAt, direction, counterparty, objectiveId/version and ordinary fields; rich receipt verification/undo; due-day conversion is present. [client-activity-details.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-activity-details.ts), [client-activity.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-activity.service.ts) | M, historical missing-commitment claim superseded. |
| Quick Log + Planner follow-up / recovery / resume | [command-actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/command-actions.ts), [useCommandRecovery.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/useCommandRecovery.ts) → Core activity-commands with retained requestId/version; ActivityCommandService persists command/activity and calls Planner owner; receipt read and explicit resume. [activity-command.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/activity-commands/activity-command.service.ts) | M; unlike plain create, already has durable command protocol. |
| Facilities create/edit/remove / map / geocode / reviewed candidate / district resolution | [FacilitiesManager.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/FacilitiesManager.tsx), [facility-writer.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/facility-writer.ts), [FacilityGeocoding.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/FacilityGeocoding.tsx), [facility-action-writer.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/facility-action-writer.ts) → Core client facilities → ClientFacilitiesService/representation resolver; Prisma, Census/geocoder ownership; expected candidate revision, current-read fences, facility/Nexus/representation invalidation. [client-facilities.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-facilities.service.ts), [representation-resolver.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/representation-resolver.service.ts) | M; missing candidate revision appropriately disables selection. |
| Facility detail ten-category evidence / economic footprint / representation / committees / awards / strategy relevance / priority changes | [FacilityDetailDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/FacilityDetailDialog.tsx), [profile-evidence-queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/profile-evidence-queries.ts), [FacilityCommittees.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/FacilityCommittees.tsx) → Core District Nexus, economic context/footprint, strategic and priority intelligence plus Directory; exact client/facility/district binding and source freshness; source Prisma reads. [district-nexus.module.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/district-nexus/district-nexus.module.ts), [district-nexus-economic.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/district-nexus/district-nexus-economic.service.ts) | M/R; no inferred site allocation or fabricated workforce. |
| Research setup / start / rerun / retry; existing-run ledger / findings apply/reject/restore/assign/cancel | [ResearchSetup.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/ResearchSetup.tsx), [RunLedger.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/RunLedger.tsx), [actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/actions.ts) → Read/review existing Core profile-fill runs is implemented; applying findings is separate persisted action. Start/rerun/retry deliberately disabled because legacy start can mutate profile before review. [client-profile-fill-workflow.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-profile-fill-workflow.service.ts), [client-profile-fill-completion.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-profile-fill-completion.service.ts) | M review; G PF-04 start/retry. |
| Advocacy history / matters / timeline / unassigned records / create-edit matter / add record / correction | [AdvocacyHistory.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/advocacy/AdvocacyHistory.tsx), [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/advocacy/mutations.ts), [matter-edit.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/advocacy/matter-edit.ts), [correction.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/advocacy/correction.ts) → Core clients/:id/advocacy-matters → ClientAdvocacyMatterService; tenant-scoped matters/records/history, actor/source/version fences, review and scoped invalidation. [client-advocacy-matter.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-advocacy-matter.controller.ts), [client-advocacy-matter.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-advocacy-matter.service.ts) | M; no generic no-op found. |
| Past performance / saved submissions / remove | [PastPerformance.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/past-performance/PastPerformance.tsx), [actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/past-performance/actions.ts) → Saved-submission list/remove in Core; active-client scope and explicit confirmation, acknowledged deletion then reread. [clients.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/clients.controller.ts) | M/R; no new submission creation offered by this surface. |
| Capabilities create/edit/delete / maturity / fit refresh / registration update | [CapabilitiesPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/capabilities/CapabilitiesPage.tsx), [writer.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/capabilities/writer.ts), [registration-writer.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/capabilities/registration-writer.ts) → Core capabilities + capability-fit + registrations → ClientCapabilitiesService/ClientCapabilityFitService; Prisma/embedding/PE+Tracker+opportunity projections; typed receipt and capability/fit/client invalidation. [client-capabilities.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-capabilities.service.ts), [client-capability-fit.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-capability-fit.service.ts) | M; EIN/primary NAICS read-only in this form intentionally, intake owns broader details. |
| Objective list / create / edit / status / owner / readiness / current revision | [ObjectivesPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectivesPage.tsx), [writer.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/writer.ts), [ObjectiveEditor.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveEditor.tsx) → Core clients/:id/objectives → ObjectivesService + Prisma versioned objective revisions; current write receipt, query invalidation and retained draft. [objectives.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/objectives.service.ts) | M. |
| Objective legacy generation / draft job / Strategy receiving / Planner materialization | [ObjectiveGeneration.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveGeneration.tsx), [objective-generation-session.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/objective-generation-session.ts), [objective-plan-session.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/objective-plan-session.ts) → Fixed strategy operations → /strategies/objective-drafts, /strategies/draft-jobs/:jobId, planner materialization; Strategy MeriController + canonical services; retained request/job IDs and exact receiving checks. [meri.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api-strategy/src/meri/meri.controller.ts), [objective-canonical-application.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api-strategy/src/planner/objective-canonical-application.controller.ts) | M source / H activation; not blanket absent. PF-06 selects canonical successor. |
| Objective governed Planner read/output and Strategy intake | [ObjectiveGovernedPlanner.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveGovernedPlanner.tsx), [ObjectiveStrategyIntake.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveStrategyIntake.tsx) → Frontend constants false; Core ObjectiveWorkController → owner router → Planner/Strategy continuation contracts and workload authority; backend feature gates. [objective-work.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/work/objective-work.controller.ts), [objective-work.module.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/work/objective-work.module.ts) | H/G PF-06. |
| Objective existing work picker / Strategy / task / Context revision / Calendar / Directory / Outreach destination | [ObjectiveWorkDestinations.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveWorkDestinations.tsx), [useObjectiveWorkDestination.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/useObjectiveWorkDestination.ts), [ObjectiveOutreach.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveOutreach.tsx) → Fresh current Objective and resource facts → typed destination binding; receiving page rechecks current resource/client. This opens existing resources, not an association write. [objective-operational.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/operational/objective-operational.controller.ts) | M/R navigation; G PF-07. |
| Objective operational overview / strategies/projects/decisions/engagements / linked resources / section pagination | [ObjectiveOperationalPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/operational/ObjectiveOperationalPage.tsx), [OperationalSections.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/operational/OperationalSections.tsx) → Fixed objectives.operational.read → Core projection/store; version/cursor consistency, per-section availability and no fake totals. Questions/automation explicitly not implemented. [objective-operational.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/operational/objective-operational.service.ts), [objective-operational.projection.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/operational/objective-operational.projection.ts) | M/R; PF-07 association controls and PF-08 missing producer. |
| Client Work / strategy cards / owners / upcoming nodes / risks / links / New Strategy | [WorkPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/WorkPage.tsx), [queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/queries.ts), [owners.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/owners.ts) → Raw Strategy list/detail, exact client+resource receipt; fixed tenant-member read; currentStrategyHref → StrategiesScreen/Timeline. Complete-only counts, independent owner retry. [strategy.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api-strategy/src/strategy/strategy.service.ts) | M; separate Strategy target required PF-24. |
| Work Workspace documents / owner / link | [WorkspaceDocuments.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/WorkspaceDocuments.tsx), [WorkspaceDocumentTable.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/WorkspaceDocumentTable.tsx), [queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/queries.ts) → Workspace drafts?scope=all; current client-name match and ambiguity hold; navigation to configured Workspace destination.  | M but canonical client identity missing PF-09 (Workspace owner). |
| Planner/Strategy receiving from Portfolio | PlannerScreen rejects malformed project selector, requires active selected client, verifies project/task scope; StrategiesScreen rechecks selected client and StrategyTimeline exact resource/client/step. Ordinary task/project data is Strategy API, not Core. [planner.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api-strategy/src/planner/planner.controller.ts), [strategy.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api-strategy/src/strategy/strategy.controller.ts) | M/R; actual receiver inspected, not all Modules audited. |
| Relationships contacts / hierarchy / Org chart / duplicate-title warning | [RelationshipsPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/RelationshipsPage.tsx), [contact-api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/contact-api.ts), [HierarchyEditor.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/HierarchyEditor.tsx) → Core clients/:id/people → ClientPeopleService, Prisma + client context; create/edit/remove and manager hierarchy guards, current receipts, refresh. Create uncertainty blocks repeated session submit. [client-people.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-people.service.ts) | M; durable create receipt PF-13. |
| Government target search/add/remove/tier / committees / recommended targets refresh | [GovernmentRelationships.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/GovernmentRelationships.tsx), [target-queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/target-queries.ts), [TargetRecommendations.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/TargetRecommendations.tsx) → Core client targets/recommendations and Directory snapshots; canonical target IDs, Prisma association, persisted recommendation owner; scoped invalidation. [client-targets.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-targets.service.ts), [client-target-recommendations.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-target-recommendations.controller.ts) | M; target strategy/ask/next action G PF-15. |
| Member Directory note / Quick Log | [MemberNoteForm.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/member-notes/MemberNoteForm.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/member-notes/api.ts) → Current directory/members/:id preflight then directory/contacts/:id/notes POST; authored receipt validated; not linked to client. [directory.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/directory/directory.controller.ts), [directory.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/directory/directory.service.ts) | M Note only; Call/Meeting/Email/detail fields G PF-14. |
| Contact mail history / compose / mailbox / recipients / rich body / attachments / rewrite / review / send | [ContactMail.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/ContactMail.tsx), [MailCompose.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/MailCompose.tsx), [send.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/email/send.ts) → Real engagement mail paths; exact author/client/mailbox/attachment checks and provider send boundary. Mail audit owns detailed contract/provider activation and receipt plan. [engagement.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.controller.ts) | M for compose path; no claim successful provider dispatch. |
| Timeline thread / reply review | [TimelineMailThread.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/thread/TimelineMailThread.tsx), [recipients.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/thread/recipients.ts) → Read thread and calculate verified reply recipients; explicitly unsupported send context, review-only MailCompose capability.  | G PF-25; mail owner canonical. |
| Bill board/table / search / track-untrack / detail / hearings / external full board | [BillTrackerPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/BillTrackerPage.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/api.ts), [BillDrawer.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/BillDrawer.tsx) → TRACKER_BACKEND selects Core intelligence/clients/:id/tracker or Intelligence clients/:id/tracker; controller/service → persisted associations + public source repositories; load-more and refresh. [tracker.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tracker/tracker.service.ts), [tracker-board.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/intel-api/src/tracker/tracker-board.service.ts) | M/H config; summary placeholders PF-05; external destinations PF-21. |
| Watchlist config / taxonomy / jurisdictions / terms / save and conflict review | [WatchlistDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/WatchlistDialog.tsx), [watchlist-writer.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/watchlist-writer.ts) → Distinct Core/intel DTOs, current actor/client, targeting revision/source checks; tenant watchlist persistence; receipt validation/refresh. [tracker.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tracker/tracker.controller.ts), [tracker-watchlist.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/intel-api/src/tracker/tracker-watchlist.service.ts) | M; do not exchange backend wire formats. |
| Bill alert criteria / channels / personal preferences / phone verify / test alert | [AlertPreferencesDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/AlertPreferencesDialog.tsx), [queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/alert-preferences/queries.ts), [usePhoneVerification.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/alert-preferences/usePhoneVerification.ts), [useTestAlert.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/alert-preferences/useTestAlert.ts) → Tracker alert preferences + personal preference service, SMS verification and real test-alert endpoints; retained channel attempt/actor checks. [tracker.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tracker/tracker.controller.ts), [tracker-channel.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/intel-api/src/tracker/tracker-channel.controller.ts) | M; provider side effects H unless separately qualified. |
| Matched funding opportunities / search/page / relevant programs / details link | [OpportunitiesPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/opportunities/OpportunitiesPage.tsx), [queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/opportunities/queries.ts) → Core intelligence/opportunities/v2/search mode=matched + client PE relevance; page/client schema; source Prisma/repositories. Detail/workflow controls are existing-app links, not local saves. [funding-opportunity-v2-search.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/funding-opportunities/funding-opportunity-v2-search.controller.ts), [client-pe-relevance.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/intelligence/client-pe-relevance.controller.ts) | M/R; PF-21 destination dependency. |
| Calendar month/week/day/agenda / scope/filter/date/timezone / source refresh | [CalendarPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/CalendarPage.tsx), [feeds.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/feeds.ts), [comment-feed.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/comment-feed.ts), [effective-feed.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/effective-feed.ts), [funding-feed.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/funding-feed.ts) → Core meetings, LegiWatch hearings, Federal Register comment/effective dates, funding detail; Strategy Planner tasks. Independent errors, exact-date provenance, paging caps and incompleteness disclosure. [federal-register.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/federal-register/federal-register.controller.ts), [legiwatch-wave1.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/live-hearings/legiwatch-wave1.controller.ts) | M; PF-10 native meeting access; PF-20 forecasts. |
| Meeting create/edit / detail / library / assignment / shared meetings | [MeetingForm.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/MeetingForm.tsx), [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/mutations.ts), [MeetingAssignment.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/library/MeetingAssignment.tsx), [MeetingLibrary.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/library/MeetingLibrary.tsx) → Core engagement meeting CRUD/library/client assignment → EngagementService + Prisma; permission/current-read fences and scoped invalidation. [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts) | M with concrete G PF-10/11/13. |
| Meeting notes/debrief create/edit/approve/share/unshare | [MeetingArtifacts.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/MeetingArtifacts.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/artifacts/api.ts) → Core meeting notes/debrief endpoints → EngagementService encrypted content and Prisma approvals/shares; fresh artifact version/source checks and receipt reread. [engagement.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.controller.ts), [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts) | M; debrief metadata G PF-12; ambiguous command PF-13. |
| Meeting preparation start/status/cancel/edit/settings; saved document print/PDF attachment | [MeetingPreparation.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/preparation/MeetingPreparation.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/preparation/api.ts), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/documents/api.ts), [PreparationPdfAttachmentReview.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/documents/PreparationPdfAttachmentReview.tsx) → Core meeting prep jobs + settings; MeetingPrepJobService and worker/generation ownership; saved-source review, explicit job status, document receipts; print is browser-owned. [meeting-prep-job.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/meeting-prep-job.service.ts), [meeting-prep-worker.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement-workers/meeting-prep-worker.service.ts) | M/H worker/provider capability; no auto-resubmission on unknown. |
| Meeting transcript upload/extract / manual debrief / voice capture / attachment approval | [MeetingTranscriptUpload.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/library/MeetingTranscriptUpload.tsx), [DebriefGeneration.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/debrief/DebriefGeneration.tsx), [useVoiceSource.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/debrief/voice/useVoiceSource.ts), [MeetingAttachmentApprovals.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/review/MeetingAttachmentApprovals.tsx) → Engagement attachment upload/extraction and debrief generation; object storage/processing + approved source binding. Browser microphone consent not automatic; runtime external-action gate honored. [attachment-content.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/attachment-content.service.ts), [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts) | M/H; provider permissions/live extraction unverified. |
| Meeting sharing / saved-note source review / remove shares / calendar sync / one-off Meri attendance / automatic attendance | [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/sharing/api.ts), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/sync/api.ts), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/attendance/api.ts) → Core engagement actions → sharing persistence, provider-calendar sync, notetaker dispatch/status. Explicit target review, consent and current authority; pending/unknown retained. [engagement-runtime-policy.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/runtime/engagement-runtime-policy.service.ts) | M/H; PF-13 durable recovery and mail/provider owner dependencies. |
| Public hearing Calendar detail / official source / capture/follow state | [PublicEventDetail.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/public-event/PublicEventDetail.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/public-event/api.ts) → GET legiwatch/live-hearings/events/:canonicalId/detail-v2, optional client scope; exact canonical hearing identity and source-state projection. [legiwatch-wave1.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/live-hearings/legiwatch-wave1.service.ts) | M/R; no inferred event date or new provider action. |
| Client Files list/search/filter/folders/storage usage/upload/download/preview/extract | [FilesPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FilesPage.tsx), [queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/queries.ts), [UploadDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/UploadDialog.tsx), [navigation.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/navigation.ts), [extraction.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/extraction.ts) → Engagement attachments and signed object URLs; Core client folder/access metadata; object processing + Prisma; immutable identity checks, changed-source refusal, explicit unavailable preview. [client-files.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-files.controller.ts), [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts) | M; Meri creation PF-03 and cross-owner artifact format PF-23. |
| File move / viewing access / delete / multi-selection | [MoveFile.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/MoveFile.tsx), [FileAccess.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FileAccess.tsx), [DeleteFile.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/DeleteFile.tsx), [FileSelectionBar.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FileSelectionBar.tsx) → Core per-file metadata PATCH and Engagement delete, explicit rights/receipt verification. Multi-selection is implemented; Move deliberately permits exactly one. [client-files.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-files.controller.ts) | M single; G batch PF-16; ambiguity PF-13. |
| Prospects pipeline/list/detail / new/edit/stage / next step / notes / history / archive/restore | [ProspectPipeline.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/ProspectPipeline.tsx), [ProspectDetail.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/ProspectDetail.tsx), [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/mutations.ts) → Core business-development prospect APIs, current stage catalog/flag, active/converted scope checks → BusinessDevelopmentService + Prisma/history; list/detail refresh. [business-development.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/business-development.service.ts) | M/H stage flag; metric PF-05; non-Identified Add is intentional. |
| Prospect contacts CRUD | [ProspectContacts.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/contacts/ProspectContacts.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/contacts/api.ts) → Core business-development prospect contacts → ProspectContactsService + Prisma; archived/converted readonly and exact prospect receipt. [prospect-contacts.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/prospect-contacts/prospect-contacts.service.ts) | M. |
| Prospect brief initial generation / manual version save / citations / history / refresh preview / Workspace copy | [ProspectBrief.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/brief/ProspectBrief.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/brief/api.ts), [BriefRefresh.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/brief/BriefRefresh.tsx), [WorkspaceCopyLink.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/brief/WorkspaceCopyLink.tsx) → Core brief service + immutable versions/idempotent manual saves; controlled Workspace copy reference. Refresh preview exists but Accept omitted because backend recomputes instead of accepting reviewed snapshot. [bizdev-brief.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/bizdev-brief.service.ts) | M/H brief flag; G PF-19. |
| Prospect proposal templates catalog/filter/preview; proposal author/send/history | [ProspectProposals.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/proposals/ProspectProposals.tsx), [TemplateCatalog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/proposals/TemplateCatalog.tsx), [persistence-contract.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/proposals/persistence-contract.ts) → Template browse exists; proposed persistence schema is not a running proposal create/send/link implementation.  | M catalog/R; G PF-17, Workspace canonical owner. |
| Prospect files upload/list/download/delete; share/send/text import | [ProspectFiles.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/ProspectFiles.tsx), [prospect-upload.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/prospect-upload.ts) → Dedicated prospect-scoped upload intent/checksum/storage stamps and explicit denial of client/mail/meeting transfer; forbidden buttons stay disabled. [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts) | M safe subset; G/restricted scope PF-17, not bypassable flags. |
| Prospect conversion / link existing client / new client / carry-over | [ProspectClientLink.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/conversion/ProspectClientLink.tsx), [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/conversion/api.ts) → UI accepts existing client only and checks created=false; backend convert also supports new-client transaction and capacity checks. Files/research/contact transfer is not supplied by UI. [business-development.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/business-development.service.ts) | M link existing; G PF-18. |

Additional receiving evidence: [PlannerScreen.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/planner/PlannerScreen.tsx), [LinkedTaskDetail.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/planner/LinkedTaskDetail.tsx), [ObjectivePreparedPlan.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/planner/ObjectivePreparedPlan.tsx), [StrategiesScreen.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/strategies/StrategiesScreen.tsx), [strategy-navigation.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/strategy-navigation.ts). These are current-resource checks, not proof that deployed owner services are reachable.

### 4. Implementation-ready gap register

Severity: **P0** blocks safe admission; **P1** blocks a primary end-to-end workflow or trustworthy recovery; **P2** incomplete supporting behavior or a separately scoped product extension. “Held” means do not enable it as a shortcut. Cross-owner IDs here are pointers, not duplicate implementation tickets.

<a id="pf-01"></a>

#### PF-01 · P0 prerequisite · Qualify ordinary Portfolio deployment separately from the restricted preview

**Evidence:** [backend-policy.server.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/preview/backend-policy.server.ts); [read-config.server.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/preview/read-config.server.ts); [PreviewClientCatalog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/PreviewClientCatalog.tsx). Main's qualified roster pin is b97a3286; PR115/111 advances it to 50475125 but keeps activation held. PreviewClientCatalog intentionally has no profile click/selection/detail/edit.

**Root cause:** Source-only preview admission and exact-host/source pairing are narrower than the fully implemented ordinary product. That is an intentional containment boundary, not a requirement to expand the preview to deliver the ordinary product. Broad API configuration cannot substitute for selected-client/native auth qualification.

**Bounded work:** Root has approved one exact first-chat Core preview owner for client-record CRUD/detail/account-owner reads and writes, with canonical online membership, role, client-wall and capacity enforcement. Frontend uses the existing first-chat target/source pair and explicit client-write flag; keep the legacy preview routing marker for Meri compatibility. Do not relax the reserved roster guard or enable unrelated logo, profile-note, import or provider writes through a global flag. Qualify each remaining ordinary product workflow through its own canonical owner; the approved client slice does not complete them.

**Dependencies:** Parent shared proxy/config plan X-01; PF-10/11 meeting corrections; exact migrations and source/image custody; separate owner approval for any deployment/access change and, independently, any preview-policy expansion.

**Acceptance:** Verify current signed-in role, foreign tenant, hidden/revoked client, archived client, changed identity, capacity/owner concurrency and malformed requests against the exact serving cohort. Unadmitted methods/paths fail before upstream dispatch. Client writes must not break first-chat or broaden reserved roster access. Source and historical build receipts do not replace real service and deployed acceptance.

<a id="pf-02"></a>

#### PF-02 · P1 · “Ask Meri about this client” has no canonical context handoff

**Evidence:** [ClientMeriActions.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ClientMeriActions.tsx#L40). The disabled dropdown has no request/receiver, whereas independent Meri entry exists elsewhere.

**Root cause:** No allocated Portfolio-to-Meri context/bootstrap contract for the currently authorized client.

**Bounded work:** Add a typed navigation/command handshake carrying canonical client ID, active client scope, actor/tenant epoch and a reviewed initial intent. Reuse the existing Meri bootstrap/session authority instead of inventing a parallel conversation endpoint. Receiver must resolve fresh client authority, return/retain canonical conversation/run/request IDs, reject changed/archived scope, and keep any unsent prompt separate from dispatch. UI becomes enabled only from an explicit capability receipt. Do not pass confidential profile content through arbitrary URL parameters.

**Dependencies:** Meri public contract/source owner and first-chat/runtime admission; shared selected-client gate.

**Acceptance:** Clicking from two different clients cannot cross-bind history; revoked/archived client refuses without starting a run; reload/uncertain ACK recovers the same request rather than creating another conversation; source context is visible to the user before meaningful generation. Native fixture plus actual authorized service receipt required.

<a id="pf-03"></a>

#### PF-03 · P1/P2 · “Create with Meri” profile and Files starters are not implemented

**Evidence:** [CreateProfileDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/CreateProfileDialog.tsx#L139); [FilesPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FilesPage.tsx#L127).

**Root cause:** Generic Meri presence does not define a safe profile-creation proposal or a generated client-bound artifact.

**Bounded work:** Allocate two bounded workflows, not one broad enable flag: (a) draft-only profile proposal with schema, provenance, duplicate/capacity preflight and explicit user apply into existing intake service; (b) client-bound Workspace/artifact starter returning an immutable saved draft/revision and current access metadata, then an explicitly reviewed attach/save to Files. Reuse ordinary profile and document persistence owners. Keep generation separate from client creation, attachment sharing and mail sending. Add retained request IDs, terminal result/unknown states and cancellation receipts.

**Dependencies:** PF-02 context; Workspace canonical client binding PF-09; runtime artifact contract PF-23; billing capacity owner. A generic chat link is not closure.

**Acceptance:** Declined/cancelled generation has no client/file side effect; duplicate submit produces one proposal; changed schema/capacity/client denies apply; file is correctly typed, client-scoped and readable after reload; all unsupported formats and missing capabilities remain explicit.

<a id="pf-04"></a>

#### PF-04 · P1 safety hold · Enrichment Start / Run again / Retry cannot safely use the legacy start API

**Evidence:** [ResearchSetup.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/ResearchSetup.tsx#L78); [RunLedger.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/RunLedger.tsx#L56); [ClientEnrichmentDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/ClientEnrichmentDialog.tsx#L127); [contracts.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/contracts.ts#L153); [client-profile-fill-workflow.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-profile-fill-workflow.service.ts#L87).

**Root cause:** Current start can seed website, identity mappings and facility districts before specialist results are approved. Source checkboxes currently represent a setup draft, not a reviewed mutation command. Retry would repeat this unsafe boundary. Existing run review/apply/reject/restore/assign/cancel is already wired and should be preserved.

**Bounded work:** Introduce a review-only start/retry contract. Persist provisional input selections and generated findings within the run, never canonical client fields. Add immutable source snapshot/digest, command ID, run/task retry identity, receipt/status endpoint, role/active-client checks and precise cancellation semantics. Apply should be a separate transactional, version-bound command for the exact reviewed findings. Preserve partial application and per-finding failure; surface unknown outcome across reload. Only then connect source selection, identity selection, start, rerun and failed-task retry buttons.

**Dependencies:** Core enrichment owner, Context Plane and credential/runtime capability, CLIENT_PROFILE_FILL_WORKER_ENABLED, provider limits and worker queue. Do not enable old endpoints to make the UI appear complete.

**Acceptance:** Before approval, canonical website/identities/districts are unchanged; conflicting client revision refuses apply; same task retry cannot duplicate findings or writes; partial/unknown states reconcile; native user/admin wall tests; provider-disabled mode makes zero provider calls.

<a id="pf-05"></a>

#### PF-05 · P2 · Portfolio/profile/bill/prospect/federal summary placeholders lack compatible aggregates

**Evidence:** [PortfolioPulse.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/PortfolioPulse.tsx); [OverviewSignals.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/OverviewSignals.tsx); [BillTrackerPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/BillTrackerPage.tsx#L99); [ProspectPipeline.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/ProspectPipeline.tsx#L111); [ClientDetails.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ClientDetails.tsx#L71); [FederalActivity.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/FederalActivity.tsx#L60).

**Missing values:** objective-linked work percentage; Need attention/Objectives/Off track/Strategies on Portfolio pulse; touches/reply status/overdue/trend/health/deadline stress/open requests on profile; material changes/watchlist coverage on Bills; weighted pipeline/win rate for prospects; FY obligated/request/associated-program total for Government card.

**Root cause:** UI deliberately refuses to derive authoritative totals from bounded lists or semantically incompatible data. Existing intelligence portfolio-summary/rollup/trend/health and tracker-summary endpoints may be reusable, but their definitions, scope and completeness have not been qualified for these labels. PE relevance is FY-agnostic, capped candidate matching, not a client funding total.

**Bounded work:** Define each metric's numerator/denominator, event kinds, period/timezone/FY, stage weights, counted statuses, archived-client policy, freshness and completeness. Version one aggregate read DTO with availability/reason rather than zeros. Reuse verified service projections where exact semantics match; add only missing calculations. Wire independent queries and error states, not estimates.

**Acceptance:** Tests with paginated >500 activity, >50 alerts, duplicate/cross-client links, no data versus unavailable, FY boundary and changed pipeline stage definitions. Relevance or public program appropriation must never be labeled an award to the client/site. A product decision to remove an unsupported metric is acceptable closure only if explicit.

<a id="pf-06"></a>

#### PF-06 · P1 activation/contract · Governed Objective Planner and Strategy intake are hard-disabled

**Evidence:** [ObjectiveGovernedPlanner.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveGovernedPlanner.tsx#L20); [ObjectiveStrategyIntake.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveStrategyIntake.tsx#L23); [ObjectiveEditor.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveEditor.tsx); [objective-work.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/work/objective-work.controller.ts); [objective-planner-work-owner.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/work/objective-planner-work-owner.ts#L159); [objective-strategy-work-owner.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/work/objective-strategy-work-owner.ts#L48).

**Root cause:** Frontend receiving exists but no reviewed coherent serving cohort grants it authority. The legacy ObjectiveGeneration path through Strategy /strategies/objective-drafts still exists. Missing activation must not be confused with missing all generation code or solved by silently using the legacy path.

**Bounded work:** Owners choose and document canonical legacy-versus-governed workflow per action. Pin one compatible Core ObjectiveWork + Strategy canonical producer/application + frontend contract cohort; qualify read/status/output first; then generation/continuation/confirm-pair. Replace hardcoded false with fail-closed server-derived capability only after exact route/source/flags are reviewed. Preserve original request identity, saved Objective revision, retained approved output digest, same-request continuation and canonical Planner project/Strategy output identifiers. If legacy path is superseded, migrate its entrypoint explicitly and keep existing-job recovery read compatible.

**Dependencies:** Separate Strategy service configuration PF-24; workload authority, worker/provider/DB schema; flags above; runtime owner receipts.

**Acceptance:** Canonical saved Objective mismatch, stale revision, owner unavailable, lost ACK/reload, conflicting pair, foreign output, archived project and duplicate continuation cases all refuse or recover correctly. Real native receipt links to current Strategy/Planner receiver; no route broadening or automatic provider action during read.

<a id="pf-07"></a>

#### PF-07 · P1 frontend omission · Durable Objective associations exist in Core but have no authoring UI

**Evidence:** [ObjectiveWorkDestinations.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveWorkDestinations.tsx#L74); [ObjectiveOutreach.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveOutreach.tsx#L176); [objective-operational.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/objective-operational.ts#L220); [objective-operational.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/operational/objective-operational.service.ts#L131).

**Root cause:** Existing pickers only open already-authorized resources. The registered objectives.operational.link operation and Core transactional link/unlink/receipt implementation are not consumed by Portfolio controls.

**Bounded work:** Add an explicit “Link to this Objective” review and “Unlink” action distinct from Open. Support only allocated resource kinds: strategy, planner_project, planner_task, outreach_session and meeting; strategy-only cycle annotations. Capture objective version, association-set version, exact current resource snapshot, request ID and payload digest before dispatch. Use existing link and receipt operations, validate the returned digest/revisions/set version with requireOperationalAssociationReceipt, persist recovery identity across reload, and refresh the operational section after acknowledgement. Do not treat general Context Files, Directory targets or Calendar occurrences as supported durable link kinds without expanding the contract.

**Dependencies:** PF-01 ordinary deployment qualification (or separately approved preview admission), PF-24 owner mounts; correct existing-resource picker contracts. Core already owns resource locks and current authority.

**Acceptance:** Double click/reload returns same association; source moved/deleted before linking refuses; stale association set requires review; unlinked resource receipt remains historically recoverable; foreign client/kind/cycle refuses; current receiver still revalidates navigation. No unintended resource creation.

<a id="pf-08"></a>

#### PF-08 · P2 product/backend gap · Objective Questions and applied Automation lack real producers

**Evidence:** [objective-operational.projection.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/operational/objective-operational.projection.ts#L491); [ObjectiveOperationalPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/operational/ObjectiveOperationalPage.tsx#L146); [objective-operational.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/objective-operational.ts#L33).

**Root cause:** The projection explicitly returns not_implemented/unsupported_question_lifecycle and frontend intentionally rejects the unallocated automation branch. Generic automation UI or a fabricated zero would be misleading.

**Bounded work:** Either formally defer/remove the visible unsupported feature with truthful capability copy, or allocate a versioned question lifecycle and applied-composite automation read owner. Define immutable question/request/outcome IDs, lifecycle transitions, author/reviewer roles, source versions, explanation/provenance, current grants, paging and audit trail. Any start/continue action is separate from reading the page. Extend public DTOs and producer first, then receiver, then UI actions.

**Dependencies:** Objective/Meri runtime owners and product decision. Not a one-line flag fix.

**Acceptance:** Unknown versus empty shown distinctly; reading performs no generation/continuation; unsupported producers cannot masquerade as applied output; historical output survives deletion without granting current access; native receipt/authority tests before activation.

<a id="pf-09"></a>

#### PF-09 · P1 cross-owner · Work/Workspace documents are matched by mutable client name, not canonical client ID

**Evidence:** [queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/queries.ts); [WorkspaceDocuments.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/WorkspaceDocuments.tsx); [contracts.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/contracts.ts). Workspace audit independently confirmed basic newsletter create/update lacks canonical clientId, while Outreach staging requires it.

**Root cause:** Workspace draft contract carries client display string; Portfolio currently permits a match only when that name is unambiguous and excludes prospect drafts. Renames and duplicates hide or disconnect genuine work. It is intentionally safer than guessing, but not complete binding.

**Bounded work:** Workspace canonical ticket owns draft schema/storage/write DTO/list/filter/saved-revision propagation of clientId, tenant/current access checks, and migration-safe backfill. Backfill only uniquely evidenced associations; ambiguous/unverified historical name rows remain held for explicit review. Portfolio reads exact clientId and stops joining by name; keep display names non-authoritative. Revalidate links on destination entry.

**Dependencies:** Workspace owner, PF-03 generated files and Outreach staging/mail owner. Do not duplicate implementation or weaken denyProspectTransfer.

**Acceptance:** Client rename preserves association; two equal names do not cross-bind; old ambiguous drafts stay unavailable; saved revision matches intended client; active grant revocation removes destination/staging access; an ordinary client-selected newsletter stages only after canonical binding is present.

<a id="pf-10"></a>

#### PF-10 · P0 native-read blocker · Four meeting reads do not establish current selected-client visibility

**Evidence:** [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1448); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6138); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6194); compare stronger [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1460); [feeds.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/feeds.ts). PR111's checklist independently retains these four GETs held.

**Root cause:** GET engagement/meetings, meetings/:id, notes and debriefs use tenant/ownMeetingWhere. Filtering by associated client is not the same as a current user/client ethical-wall check. The stronger getClientMeeting helper is not the authority used by these ordinary endpoints.

**Bounded work:** Allocate client-scoped meeting read methods/DTOs or strengthen the existing endpoints with an explicit authorized-client parameter. Resolve current native tenant/user, current active client visibility and meeting-to-client association inside the authoritative transaction; use equivalent checks for notes/debriefs and redaction. Retain separately authorized owner/unassigned-library behavior without treating it as authority for client context. Do not merely add frontend selectedClient checks.

**Dependencies:** Shared native authorization qualification for the selected ordinary deployment cohort, Engagement owner, current client-wall grants; any cache keyed by prior client needs invalidation.

**Acceptance:** Native tests for owned meeting on hidden client, recently revoked grant, archived client, moved meeting, foreign tenant, owner-only unassigned library and legitimately shared content. Four routes remain held until passing; distinguish “not available” from permission-leaking metadata. This is a proven source admission gap, not a claim that a live leak was observed.

<a id="pf-11"></a>

#### PF-11 · P1 · Editing an unchanged client assignment rewrites meeting association provenance

**Evidence:** [MeetingForm.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/MeetingForm.tsx); [meeting-save.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/meeting-save.ts); [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/mutations.ts); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1563); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1664).

**Root cause:** Meeting edit sends clientId. Backend checks presence of that property and invokes reassignment even when the ID is unchanged; reassign writes manual reason/score and isInternal=false. “Changed=false” avoids some downstream reset but does not preserve provenance.

**Bounded work:** Frontend omits clientId if unchanged from the reviewed saved meeting. Backend independently makes unchanged assignment a semantic no-op and preserves association reason, score and internal state. For real changes require expected current association/revision, explicit reviewed target, client-wall/capacity policy as applicable and an attributable receipt; refresh old/new client calendars and related artifact metadata.

**Acceptance:** Change only subject/time on auto-associated or internal meeting preserves all association fields and no reassignment audit/event. Actual client change updates exactly once; stale/moved/hidden target refuses. A malicious unchanged clientId cannot trigger side effects server-side.

<a id="pf-12"></a>

#### PF-12 · P1/P2 · Debrief list omits approval/sharing metadata needed by artifact controls

**Evidence:** [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6138) includes approvedAt/approvedBy/sharedAt/sharedBy; [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6194) returns debrief fields without that metadata; [MeetingArtifacts.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/MeetingArtifacts.tsx#L191) depends on it.

**Root cause:** Asymmetric notes/debrief read projection. The frontend intentionally does not invent sharing state; debrief rows can show unavailable and cannot expose reliable Unshare from absent sharedAt.

**Bounded work:** Publish one versioned artifact metadata projection for notes/debrief reads, including nullable approval/share timestamps, actor IDs/names with visibility rules, content/source revision and current action capabilities. Use it in list and mutation receipts, and align frontend schema. Do not assume absent optional field means unshared.

**Acceptance:** Create → approve → share → reread → unshare → reread works for both artifact types; false/unavailable/null are distinct; unauthorized role cannot infer actors or act; response loss does not show success merely from stale cached row. Verify both selected meeting and shared-library surfaces.

<a id="pf-13"></a>

#### PF-13 · P1 reliability · Several ordinary mutations have only mounted/session uncertainty fences, not durable attributable receipts

**Evidence:** [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/mutations.ts); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/artifacts/api.ts); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/sharing/api.ts); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/sync/api.ts); [contact-create-attempt.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/contact-create-attempt.ts); [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/mutations.ts); [actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/actions.ts). By contrast [command-actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/command-actions.ts) already has command receipt recovery.

**Root cause:** Some handlers deliberately freeze an uncertain write in mounted state, and some reconcile only current state via GET. That avoids immediate unsafe retry but does not identify whether this exact command succeeded after navigation/reload, nor prove attribution under concurrent edits.

**Bounded work:** Inventory by actual mutation and add only missing command protocols: meeting create/update/reassign; notes/debrief create/edit/approval/sharing; externally consequential calendar sync; client contact create; plain Quick Log create; file metadata/access/delete where current state is insufficient. Server accepts immutable command ID + actor/client/resource/version + payload digest, commits receipt with the mutation, exposes authenticated lookup, and handles same-key/same-payload replay versus conflict. UI stores a minimal scoped journal before dispatch and recovers the same command; never stores bearer tokens. Distinguish definitive refusal, accepted, completed, and unknown/provider-pending. Existing durable prep/ActivityCommand/prospect upload/Objective protocols should not be replaced.

**Dependencies:** Owner-specific DB transaction or provider reconciliation capability. For external actions, a DB receipt cannot falsely guarantee provider completion.

**Acceptance:** Lost response before/after commit, reload, multi-tab, session renewal, duplicate click and concurrent conflicting edit yield one intended write or an explicit unresolved outcome. Changed payload with same ID refuses; arbitrary fresh retries never recreate uncertain work; current-state match alone is labeled observation, not historical receipt.

<a id="pf-14"></a>

#### PF-14 · P2 · Directory member Quick Log supports Note only

**Evidence:** [MemberNoteForm.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/member-notes/MemberNoteForm.tsx#L83); [MemberNoteForm.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/member-notes/MemberNoteForm.tsx#L107); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/member-notes/api.ts).

**Missing:** Call/Meeting/Email kind; staff selection; event time; client association; Objective link; Planner follow-up. Current note is saved in Directory, deliberately not in the selected client's activity.

**Bounded work:** Either keep clearly labeled Directory note-only scope, or define a canonical Directory activity command with recognized member/staff identity, event kind/time and optional explicitly authorized client/objective binding. Backend must verify canonical directory entity itself: current frontend preflight is not authorization. Reuse the ActivityCommand owner for an explicit client-bound follow-up rather than writing duplicate events independently. Add versioned receipt and durable recovery.

**Acceptance:** Note behavior stays intact; unsupported kinds cannot be disguised as note text; staff/member ID confusion refuses; client links require current client access and exact Objective version; one approved follow-up creates one linked task; no implicit client note sharing from a Directory-only action.

<a id="pf-15"></a>

#### PF-15 · P2 · Government target card has no linked Strategy / ask / next-action projection

**Evidence:** [TargetDrawer.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/TargetDrawer.tsx#L147).

**Root cause:** Target persistence carries canonical person/tier/source but does not expose the promised linked-work context. No setter/handler exists for this card.

**Bounded work:** Product chooses read-only context or authored target work. Define explicit target-to-Strategy-step/Objective/Planner-task associations with current client/resource visibility and provenance; reuse allocated operational/plan associations if their resource kind genuinely matches, otherwise extend the owner contract. Never infer a link from a matching person name/email or arbitrary note. Add source version, bounded list and actual destination receiver.

**Acceptance:** A target linked to multiple strategies has deterministic disambiguation; removed/archived/foreign-client work disappears or is truthfully unavailable; next action reflects authoritative status/date; no automatic creation or email send from merely opening the card.

<a id="pf-16"></a>

#### PF-16 · P2 · Files multi-selection cannot perform an atomic batch move

**Evidence:** [FileSelectionBar.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FileSelectionBar.tsx#L35); [FileSelectionBar.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FileSelectionBar.tsx#L44); [client-files.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-files.controller.ts).

**Root cause:** Existing metadata PATCH is per-file. The UI allows selection but intentionally disables Move unless exactly one file is selected.

**Bounded work:** Add a bounded batch-move command with sorted file IDs, exact client/folder, expected per-file revisions, destination authority and idempotency key. Server locks and validates all records then commits all or none, returning per-file revisions plus aggregate receipt. Frontend reviews hidden selected rows explicitly and submits one command, not a loop of individual PATCHes.

**Acceptance:** One denied/stale/missing file means zero moves; duplicate IDs refuse; concurrent source/destination changes conflict; uncertain replay yields same atomic receipt; selection across filters remains visible and clearable. Keep single-file workflow unchanged.

<a id="pf-17"></a>

#### PF-17 · P1/P2 cross-owner · Prospect proposal execution and file transfer are deliberately unsupported

**Evidence:** [ProspectProposals.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/proposals/ProspectProposals.tsx); [persistence-contract.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/proposals/persistence-contract.ts); [ProspectFiles.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/ProspectFiles.tsx#L57); [ProspectDetail.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/ProspectDetail.tsx#L181).

**Root cause:** Template browsing is implemented, but a prospective schema is not a mounted creation/send/history workflow. Prospect documents use a distinct security scope; sharing/sending/text import are denied by design. Workspace owner confirmed denyProspectTransfer should be preserved.

**Bounded work:** Split deliverables: (a) canonical prospect-bound proposal draft/revision persistence and returned IDs, linked template/version provenance and commercial-terms policy; (b) explicit generate/save/history; (c) only if separately approved product scope, a reviewed prospect share/send/import capability with concrete recipient, permission and data-class rules. Never relabel a prospect as a client or reuse a client ID to bypass transfer denial. If product remains browse/upload-only, remove misleading expectations while retaining disabled explanation.

**Dependencies:** Workspace canonical proposal/binding owner; mail owner for actual dispatch; prospect visibility and active status; scoped provider contract.

**Acceptance:** Template preview performs no save/send; draft remains prospect-bound after reload; converted/archived prospect refuses unsupported mutation; client/meeting/mail attachment routes reject prospect objects; recipients and immutable revision explicitly reviewed for any later send.

<a id="pf-18"></a>

#### PF-18 · P1 · Prospect conversion UI only links an existing client; new-client and reviewed carry-over are missing

**Evidence:** [ProspectClientLink.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/conversion/ProspectClientLink.tsx#L174); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/conversion/api.ts); [business-development.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/business-development.service.ts#L936).

**Root cause:** Backend already has a new-client conversion transaction, capacity/billing checks and audit, but UI narrows to existingClientId and expects created=false. No selected transfer manifest exists for contacts/files/research.

**Bounded work:** First add a dedicated new-client conversion review using canonical intake fields, duplicate check and capacity/price implications, with command/receipt identity and explicit result type. Keep existing-client link behavior. Then separately allocate an opt-in transfer manifest for each permitted data category with immutable source IDs/revisions, target authority, conflict/merge rules, attachment ACL handling, audit and rollback/recovery. Do not implicitly copy everything or preserve inappropriate sharing.

**Dependencies:** Core BD/Clients owner, Settings billing/capacity, Workspace/files identity and mail restrictions. New client creation and transfer are separate acceptance stages.

**Acceptance:** Same conversion cannot create two clients; already converted/archived/stale prospect refuses or returns same receipt; exact client returned; capacity failure leaves prospect unchanged; existing-client link is not billed as new client; approved selected transfers have deterministic receipts and all unselected data remains prospect-scoped.

<a id="pf-19"></a>

#### PF-19 · P1 safety hold · Prospect brief refresh can be previewed but not accepted as the exact reviewed text/citations

**Evidence:** [BriefRefresh.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/brief/BriefRefresh.tsx#L34); [bizdev-brief.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/bizdev-brief.service.ts#L892); [bizdev-brief.flag.guard.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/bizdev-brief.flag.guard.ts).

**Root cause:** Accept currently accepts idempotencyKey, expectedVersionNumber and keepUserEdits, then rebuilds proposal internally before transaction. It does not accept the reviewed immutable proposal/sections/citations digest. Connecting a Save button could persist changed content that the user did not review.

**Bounded work:** Persist or cryptographically bind an immutable refresh proposal with base brief version, source snapshot/digest, proposed sections, citations, user-edit treatment and expiry. Accept references that exact proposal ID/digest and expected version; server refuses changed/stale sources according to explicit policy rather than regenerating silently. Add exact resulting version receipt, idempotency and unknown-state recovery; UI compares final saved projection and refreshes history/current brief.

**Dependencies:** businessDevelopment.brief.enabled, BD generation/source owners and Workspace copy identity. Do not enable by bypassing the hold.

**Acceptance:** Source or manual edits between preview and accept cannot silently change saved text/citations; retries return one same version; changed keepUserEdits requires new review; citation identity preserved; draft retained on refusal; actual saved version matches reviewed proposal byte/semantic contract.

<a id="pf-20"></a>

#### PF-20 · P2 product/data gap · Calendar government forecasts have no published exact-date source contract

**Evidence:** [CalendarPageControls.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/CalendarPageControls.tsx#L418).

**Root cause:** Existing hearings/comment/effective/funding/Planner sources provide explicit dates; forecast data is a different uncertainty model. It is intentionally unavailable.

**Bounded work:** If product wants forecasts, define a separate approximate window/confidence/source-as-of model with probability and revision, not a fake exact date in the ordinary calendar. Supply an authoritative source endpoint and UI visual distinction; preserve source links and cancellation/revision history. Otherwise document the supported calendar excludes forecasts.

**Acceptance:** An uncertain month/range is never rendered as an exact midnight event/deadline; timezone policy and uncertainty copy survive export/filtering; changed forecast does not create duplicate authoritative events; live source freshness verified.

<a id="pf-21"></a>

#### PF-21 · P1 configuration/navigation · Some detail actions rely on explicitly configured existing-app/Workspace destinations

**Evidence:** [config.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/config/config.ts#L89); [OpportunitiesPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/opportunities/OpportunitiesPage.tsx); [BillDrawer.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/BillDrawer.tsx#L119); [WorkspaceDocumentTable.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/WorkspaceDocumentTable.tsx#L87); [TargetDrawer.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/TargetDrawer.tsx#L177).

**Root cause:** List/data API can be wired while deeper legacy resource destinations are absent. APIs and navigation URLs are distinct configuration contracts. Some links intentionally go to the existing application rather than a new local detail editor.

**Bounded work:** Produce a destination matrix for opportunity/recommendation/program, Bill 360/full board/hearing, Directory, Workspace and generated artifacts. Prefer native receiving routes where already available; otherwise set only verified canonical HTTPS application URLs, validate exact path/ID encoding and session compatibility, and preserve clear unavailable state. Product must decide which legacy dependencies remain versus are migrated; do not invent local action handlers solely for parity.

**Acceptance:** Each link opens the requested resource with the same current client and ordinary user session; 403/deleted/moved item is truthful; no untrusted return URL/open redirect; absent config never creates a dead or wrong-client link. This audit did not inspect live environment values.

<a id="pf-22"></a>

#### PF-22 · P1/P2 correctness · Undated commitment/request cannot settle; rich metadata cannot be edited

**Evidence:** [QuickLogDetailFields.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/QuickLogDetailFields.tsx) makes due date optional; [ActivityActions.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ActivityActions.tsx#L49); [activity-change.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/activity-change.ts#L30); [client-activity.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-activity.service.ts#L366); [ActivityDialogs.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ActivityDialogs.tsx).

**Root cause:** Settlement checks dueAt presence instead of activity kind. Backend update selects id/dueAt and rejects settled when no dueAt. The edit DTO only supports title/body/pinned/settled, so an undated commitment cannot be given a due date through this editor. Direction/counterparty/Objective metadata is captured at create but cannot be revised here.

**Bounded work:** Decide canonical lifecycle rule: recommended completion eligibility is recorded kind commitment/request regardless of optional dueAt. Update backend kind validation and frontend action availability together; reject settling all other types. If due required is intended, make it explicit at create and migrate/review existing undated entries instead. Allocate versioned rich metadata editing separately with due-day/timezone semantics, objective-version authority and stale-write protection.

**Acceptance:** Dated and undated commitment/request settle/reopen; note/email cannot; due date edit preserves local intended day; stale linked Objective/current client refuses inappropriate reassociation; old entries remain reachable; no loss of recorded metadata during title-only edit.

<a id="pf-23"></a>

#### PF-23 · P1 cross-owner / open PR · Meri-generated document access is not equivalent to Portfolio Files access

**Evidence:** PR115 contains a six-format Meri document-access consumer at its actual head, while Files has independent attachment preview/navigation. See [navigation.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/navigation.ts), [FilePreview.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FilePreview.tsx), [PR115](https://github.com/neo-capiro/capiro-frontend/pull/115).

**Root cause:** A runtime artifact receipt, a saved Workspace revision and an Engagement attachment are distinct identities/permission authorities. Current main versus PR115 source reception and live runtime qualification must not be collapsed.

**Bounded work:** Workspace/Meri owner reconciles the exact public runtime document-access contract and PR115 source adoption. Portfolio consumer receives typed current artifact/attachment mapping only through the owning bridge; supports allowed MIME/format, current authorization, download/preview semantics and source version. No raw storage-key construction or generic URL pass-through.

**Acceptance:** Six-format contract tests plus native authenticated access, changed artifact version/permissions, expired link and content disposition; Files source must not be confused with a generated artifact. Native rendering and deployed API acceptance remain unverified. Canonical implementation belongs to Workspace/Meri workstream.

<a id="pf-24"></a>

#### PF-24 · P0/P1 shared service prerequisite · Strategy/Planner and Outreach V3 need the correct mounted runtime cohort

**Evidence:** [config.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/config/config.ts#L29); [app.module.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api-strategy/src/app.module.ts); [engagement-api.app.module.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement-api.app.module.ts); [app.module.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/app.module.ts); [objective-local-resources.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/operational/objective-local-resources.ts#L28).

**Root cause:** Work/Planner/Strategy use a separate application. V3 Outreach modules are on EngagementApiAppModule rather than standard Core. A fixed operation's service label or a non-empty Core URL is not evidence its route exists.

**Bounded work:** Shared owner publishes route-to-process-to-schema-to-worker matrix. Configure verified Strategy target and correct Engagement V3 host/routing; retain native token audience/tenant/user boundaries. Qualify V3 state first, then generation, then dispatch separately. Explicitly reconcile OUTREACH_V3_STATE_ENABLED and relevant generation/send/runtime capability flags and migrations. Core Objective local projections must agree with the actual serving V3 cohort.

**Acceptance:** Read endpoints prove current selected-resource identity under native auth; wrong app/flag returns explicit held/unavailable, never fallback to unrelated legacy route; no cross-tenant service token authority; workers/provider caps tested without live send until separately authorized. Parent/mail canonical tickets own configuration; no environment changes authorized here.

<a id="pf-25"></a>

#### PF-25 · P1 cross-owner · Timeline email reply is review-only

**Evidence:** [TimelineMailThread.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/thread/TimelineMailThread.tsx#L15); [MailCompose.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/MailCompose.tsx#L34).

**Root cause:** Shared compose can send in supported ContactMail context, but this thread's reply context intentionally lacks dispatch/upload/rewrite capability. The reply-recipient derivation is not provider reply authority.

**Bounded work:** Mail owner defines exact original mailbox/provider conversation/message identity, Reply-To/To/Cc handling, validated recipients, attachment scope, source version and immutable reviewed send intent. Bind the reply to a currently connected originating mailbox; never substitute another mailbox. Add durable send receipt/provider reconciliation then expose dispatch. Until then retain review-only explanation.

**Acceptance:** Unknown/removed mailbox, foreign client thread, changed reply target, provider-specific headers and ambiguous send recovery; exactly one reply to reviewed recipients, not a new unthreaded message mislabeled reply. Canonical provider work and gap ID should be deduplicated with mail audit.


### 5. Dependency-ordered delivery plan

No phase below is executed by this audit. Code work, source reception, runtime admission and provider activation are separate reviewable changes.

#### Phase A: Establish one source and route baseline, then close native blockers

1. Shared owner reconciles main versus PR115 and backend candidate/current source, preserving exact source/image evidence. Do not merge historical stacks blindly.
2. Close PF-10 meeting selected-client read authority and PF-11 unchanged-assignment behavior before qualifying those reads or existing-meeting PUT for ordinary controlled deployment. The restricted preview can retain its current refusals throughout.
3. Close PF-12 debrief metadata projection; publish updated exact DTO and regression fixtures.
4. Produce PF-24 route/process/schema/worker map and PF-01 qualification matrix for the separately controlled ordinary product deployment, the default delivery path. Keep restricted preview unchanged. A narrow preview-admission matrix is needed only if the owner separately approves that optional expansion; this phase itself enables neither preview routes nor provider writes.
5. Begin PF-13 command inventory and implement highest-consequence command/receipt owners first. Shared protocol design can be parallel, but no general “retry” button should be enabled ahead of its server receipt.

**Exit evidence:** exact source references; mounted controller ownership; schema/migration review; offline contracts and native denied/allowed role/client-wall cases; source/image/config identity. No live-provider success claim.

#### Phase B: Complete existing-core workflows without inventing new owners

1. PF-22 commitment/request lifecycle correction and, if approved, rich metadata edit contract.
2. PF-07 association authoring consumes existing Core link/unlink/receipt operations.
3. PF-19 immutable reviewed brief refresh, then UI acceptance.
4. PF-18 new-client conversion with capacity preflight, preserving existing-link path; transfer manifest is a later substage.
5. Workspace canonical PF-09 binding shared with Portfolio Work and newsletter-to-Outreach staging.
6. PF-06 governed Objective receiving/cohort selection and safe capability exposure; keep legacy recovery compatible.

**Exit evidence:** UI → validated request → exact mounted service → persisted change → attributable receipt → current reread, including reload/unknown/concurrency tests. Unit-only or synthetic UI evidence cannot prove native authorization.

#### Phase C: Add bounded product capabilities

1. PF-02 client-context Meri handoff.
2. PF-03 profile/file drafting proposals, dependent on reviewed artifact and profile owners.
3. PF-04 review-only enrichment start/rerun/retry, dependent on producer isolation, worker and apply receipts.
4. PF-16 atomic batch file move.
5. PF-14 member activity extensions and PF-15 target work context, only after product/contract allocation.
6. PF-17 proposal execution / explicitly permitted prospect transfer; preserve existing scope denial until every capability is defined.
7. PF-25 thread reply through mail owner, and PF-23 six-format artifact access through Workspace/Meri owner.

#### Phase D: Finish truthful derived/read-only experience

1. PF-05 per-metric definitions and compatible aggregate API, wiring independent availability states.
2. PF-21 validated existing-app/native resource destination matrix.
3. PF-20 forecasts only with explicit uncertainty model.
4. PF-08 Questions/Automation producer or explicit product deferral/removal.

Phases can run in parallel by owner where dependencies permit; for example aggregate definition does not block meeting authorization correction. Provider activation, infrastructure changes, new credentials/grants, real sends and any consequential data conversion require separate authorization from this planning task.

### 6. Definition of done and verification matrix

Every claimed closure should include the following evidence, as applicable:

| Boundary | Required evidence |
|---|---|
| UI/control | Every visible action is enabled with a real handler and reachable capability, or explicitly unsupported/held with a precise reason. Keyboard submit, Escape/close, pending state and draft retention are tested. No placeholder success/toast. |
| Transport | Correct ordinary proxy versus fixed operation; exact service/method/path/query/body schema; native bearer and origin behavior; bounded payload; no secret or token in URL/journal. |
| Mount | Controller is in the actual serving app module, not only exported in a package. Strategy and Engagement V3 are not assumed to be ordinary Core. |
| Native authorization | Current tenant/user/role, active selected client and current grant; unauthorized client, revoked membership, moved/archived resource and foreign tenant tested. Frontend filtering/preflight is not the authority. |
| Persistence | Real storage model/transaction owns intended fields; no unintended canonical write during review/generation; migration/flag configuration is explicit; data remains correct after reload. |
| Receipt | Exact resource/client/request/payload/version matches; accepted versus completed versus unknown distinct; durable lookup for ambiguous commands; duplicate replay safe and changed-payload replay rejected. |
| Refresh | Acknowledged mutation updates/invalidate the owning query families and any old/new client views; error or stale data cannot reopen a dismissed or unauthorized destination. |
| Provider | Explicit immutable review, original provider/mailbox/source, configured capability/worker and timeout/cancel semantics; mock/provider-disabled tests first; native provider evidence only when separately authorized. |
| Data honesty | Empty, unavailable, incomplete and not implemented distinct; no fabricated counts/dates/ownership; paginated/truncated reads never relabeled global totals. |
| Release | Exact frontend/backend/runtime contract source, schema cohort, build/image provenance, host and flag pairing, limited activation plan, rollback and native check receipts. No inference from a PR being open, a branch name or old test pass. |

Suggested acceptance scenario set for each applicable family: initial load; no data; partial source failure; read retry; create/edit/remove; current role denied; wrong tenant/client; revoked grant; archive/convert while open; source version changes between review and submit; duplicate click; lost ACK before/after commit; reload during unknown; same-key replay; changed-payload replay; receiver current-access failure; stale caches after client switch; provider-disabled/read-only preview; eventual final receipt and refresh.

### 7. Bounded unresolved verification and scope ledger

This section is important: an exhaustive source action-family inventory is not exhaustive deployed behavior proof.

1. **Live runtime:** No live environment values, image digests, deployment listener state, mounted HTTP responses, Clerk native session, DB migration state, worker queue or external provider activity was checked in this worker. These remain live-unverified even where source is fully wired.
2. **Tests:** No tests were executed. Existing committed tests/PR historical reports were used as context only, not inherited acceptance. Native concurrency and RLS/client-wall coverage must be run by owners in the agreed environment.
3. **Source census:** The complete Portfolio subtree has **669 files** including tests/styles/contracts/barrels; **498 implementation .ts/.tsx** were fetched and scanned for action families, handlers, explicit holds, unsupported copy, API use and receipt/refresh behavior. Related contracts and backend source were selectively read beyond that census. The action-family matrix covers all 15 Portfolio directories. This is not a formal proof of every conditional branch.
4. **Cross-owner closures:** PF-09 and PF-17 proposal/binding details belong to Workspace; PF-23 to Workspace/Meri runtime contracts; PF-25 plus send/provider receipts to Mail; PF-01/PF-24 to shared platform. Their final source/runtime verification should be linked into the combined plan, not omitted or duplicated.
5. **Broader Modules:** Strategy/Planner receiving pages and relevant API owners were audited because Portfolio navigates to them. Planner Forms/Timesheets/Capacity and unrelated Modules features were not independently audited here.
6. **Product decisions:** Questions/Automation, forecasts, target context, advanced Directory logs and prospect transfer require a scoped supported-product decision. “Implement everything” does not justify bypassing current safety holds. The combined plan should either allocate their real owners/contracts or explicitly accept deferral/removal of unsupported affordances.
7. **Remaining backend dependencies:** Data source freshness/completeness, optional provider/worker flags and exact DTO revisions across public contract packages need owner qualification. Source presence of a controller/service and Prisma call is evidence of implementation, not proof that current database/provider configuration can satisfy every request.
8. **No authorization for changes:** This plan intentionally does not alter repositories, PRs, runtime config, grants, external messages or live data. Source merge/admission steps are recommendations requiring the user's later implementation instruction.

### 8. Historical “missing” claims corrected by current source

- Client Quick Log **does** support commitment/request, direction, counterparty, due day and Objective/version capture; optional Planner follow-up has a durable command/recovery protocol. The remaining actual lifecycle gap is PF-22.
- Work **does** expose strategy/node owners and source-bounded upcoming work/risks, with independent member-name retry. Missing owner labels are not a reason to recreate owner persistence.
- Standard ContactMail **does** have compose/mailbox/recipients/attachments/rewrite/review/send handlers. Timeline thread reply is a distinct unsupported context.
- Objective operational read and manual Core association contract **do** exist; the missing part is authoring UI for the latter and unsupported Questions/Automation producers.
- Objective generation is not uniformly absent: the legacy Strategy draft job path remains, while governed successors are hard-held.
- Meeting prep, notes/debrief, sharing, transcript/manual/voice source, approval, attendance and sync are not generic mock controls; the remaining gaps are precise authority/metadata/recovery/runtime qualifications.
- Prospect file upload/list/download/delete and template browse are implemented; share/send/import/proposal execution are intentionally separate unsupported capabilities.
- Open PR presence does not imply main lacks its code. PR115's newer roster pin/document-access supplements are distinct from already-consolidated historical Portfolio source.

### Appendix A. Implementation-source census

All paths below were retrieved at frontend main 4f9a7e8dcaa9ba03494dc5a49559daf70cea5100. This list is an internal traceability appendix for review, not a claim of live acceptance. CSS/test/public barrels are excluded from this 498-path list; additional source links above identify read contracts and backend owners.

#### advocacy

- advocacy/AdvocacyBrowser.tsx
- advocacy/AdvocacyFilters.tsx
- advocacy/AdvocacyHistory.tsx
- advocacy/AdvocacyReadState.tsx
- advocacy/AdvocacyTimeline.tsx
- advocacy/CorrectionDialog.tsx
- advocacy/EditMatterDialog.tsx
- advocacy/MatterDetail.tsx
- advocacy/MatterEditFields.tsx
- advocacy/MatterEditor.tsx
- advocacy/RecordCard.tsx
- advocacy/RecordDialog.tsx
- advocacy/UnassignedRecords.tsx
- advocacy/access.ts
- advocacy/correction.ts
- advocacy/history-model.ts
- advocacy/matter-edit-attempt.ts
- advocacy/matter-edit-request.ts
- advocacy/matter-edit-scope.ts
- advocacy/matter-edit.ts
- advocacy/mutations.ts
- advocacy/queries.ts
- advocacy/read-state.ts
- advocacy/source.ts
- advocacy/useCorrection.ts
- advocacy/useMatterEdit.ts

#### bill-tracker

- bill-tracker/AlertPreferencesDialog.tsx
- bill-tracker/BillDrawer.tsx
- bill-tracker/BillHearings.tsx
- bill-tracker/BillResults.tsx
- bill-tracker/BillTrackerPage.tsx
- bill-tracker/TrackBillDialog.tsx
- bill-tracker/WatchlistDialog.tsx
- bill-tracker/WatchlistForm.tsx
- bill-tracker/WatchlistNotice.tsx
- bill-tracker/WatchlistTopics.tsx
- bill-tracker/alert-preferences/AlertCriteria.tsx
- bill-tracker/alert-preferences/AlertDelivery.tsx
- bill-tracker/alert-preferences/PhoneVerification.tsx
- bill-tracker/alert-preferences/PreferenceForm.tsx
- bill-tracker/alert-preferences/TestAlert.tsx
- bill-tracker/alert-preferences/access.ts
- bill-tracker/alert-preferences/channel-attempts.ts
- bill-tracker/alert-preferences/channel-scope.ts
- bill-tracker/alert-preferences/personal-access.ts
- bill-tracker/alert-preferences/personal-queries.ts
- bill-tracker/alert-preferences/preference-write-lifetime.ts
- bill-tracker/alert-preferences/queries.ts
- bill-tracker/alert-preferences/usePhoneVerification.ts
- bill-tracker/alert-preferences/usePreferenceEditor.ts
- bill-tracker/alert-preferences/useTestAlert.ts
- bill-tracker/api.ts
- bill-tracker/current-data.ts
- bill-tracker/hearings.ts
- bill-tracker/intel-watchlist-receipt.ts
- bill-tracker/queries.ts
- bill-tracker/useWatchlistEditor.ts
- bill-tracker/watchlist-queries.ts
- bill-tracker/watchlist-session.ts
- bill-tracker/watchlist-source.ts
- bill-tracker/watchlist-writer.ts

#### billing

- billing/BillingSummaryPanel.tsx
- billing/ProfileCapacityStatus.tsx
- billing/api.ts
- billing/capacity.ts
- billing/summary-api.ts
- billing/summary-authority.ts
- billing/useBillingSummary.ts
- billing/useProfileCapacity.ts

#### calendar

- calendar/Agenda.tsx
- calendar/CalendarGrid.tsx
- calendar/CalendarPage.tsx
- calendar/CalendarPageControls.tsx
- calendar/CalendarPagePanels.tsx
- calendar/MeetingAgenda.tsx
- calendar/MeetingArtifacts.tsx
- calendar/MeetingDetail.tsx
- calendar/MeetingForm.tsx
- calendar/MeetingIdentity.tsx
- calendar/MeetingWorkspacePage.tsx
- calendar/ObjectiveCalendarDestination.tsx
- calendar/ObjectiveMeetingDestination.tsx
- calendar/access/queries.ts
- calendar/access/useDispatchGuard.ts
- calendar/artifacts/api.ts
- calendar/artifacts/metadata.ts
- calendar/artifacts/useArtifactMutation.ts
- calendar/attendance/ClientAttendancePreferences.tsx
- calendar/attendance/ConsentFields.tsx
- calendar/attendance/MeetingAttendance.tsx
- calendar/attendance/SendMeriDialog.tsx
- calendar/attendance/api.ts
- calendar/attendance/queries.ts
- calendar/comment-feed.ts
- calendar/debrief/DebriefGeneration.tsx
- calendar/debrief/ManualDebriefSource.tsx
- calendar/debrief/api.ts
- calendar/debrief/voice/VoiceMemoSource.tsx
- calendar/debrief/voice/source.ts
- calendar/debrief/voice/useVoiceSource.ts
- calendar/documents/PreparationPdfAttachmentReview.tsx
- calendar/documents/SavedMeetingDocumentPreview.tsx
- calendar/documents/api.ts
- calendar/documents/print.ts
- calendar/documents/useDocumentAuthority.ts
- calendar/documents/useSavedDocument.ts
- calendar/effective-feed.ts
- calendar/feeds.ts
- calendar/funding-deadline.ts
- calendar/funding-feed.ts
- calendar/library/MeetingAssignment.tsx
- calendar/library/MeetingLibrary.tsx
- calendar/library/MeetingTranscriptUpload.tsx
- calendar/library/SharedMeetings.tsx
- calendar/library/api.ts
- calendar/library/hooks.ts
- calendar/lifecycle.ts
- calendar/meeting-save.ts
- calendar/mutations.ts
- calendar/objective-occurrence.ts
- calendar/planner-feed.ts
- calendar/preparation/MeetingPreparation.tsx
- calendar/preparation/PreparationContent.tsx
- calendar/preparation/PreparationDocumentActions.tsx
- calendar/preparation/PreparationEditor.tsx
- calendar/preparation/PreparationProgress.tsx
- calendar/preparation/PreparationSettings.tsx
- calendar/preparation/api.ts
- calendar/preparation/editing.ts
- calendar/preparation/email-evidence.ts
- calendar/preparation/hooks.ts
- calendar/preparation/schema.ts
- calendar/public-event/PublicEventDetail.tsx
- calendar/public-event/api.ts
- calendar/public-event/presentation.ts
- calendar/public-event/usePublicEvent.ts
- calendar/queries.ts
- calendar/range.ts
- calendar/review/MeetingAttachmentApprovals.tsx
- calendar/review/SavedMeetingNotesSource.tsx
- calendar/review/api.ts
- calendar/review/useAttachmentApproval.ts
- calendar/review/useReviewActor.ts
- calendar/review/useSavedMeetingNotes.ts
- calendar/sharing/MeetingSharing.tsx
- calendar/sharing/api.ts
- calendar/sharing/fence.ts
- calendar/sharing/targets.ts
- calendar/sharing/useSharing.ts
- calendar/sync/CalendarSyncDialog.tsx
- calendar/sync/api.ts
- calendar/sync/queries.ts
- calendar/sync/useCalendarSync.ts
- calendar/useCalendarPageState.ts
- calendar/useMeetingClock.ts

#### capabilities

- capabilities/CapabilitiesPage.tsx
- capabilities/CapabilityEditor.tsx
- capabilities/CapabilityFields.tsx
- capabilities/CapabilityFit.tsx
- capabilities/CapabilityForm.tsx
- capabilities/Registrations.tsx
- capabilities/execution.ts
- capabilities/mutations.ts
- capabilities/queries.ts
- capabilities/registration-mutations.ts
- capabilities/registration-writer.ts
- capabilities/writer.ts

#### client-intake

- client-intake/ArchiveClientDialog.tsx
- client-intake/ClientIntakeDialog.tsx
- client-intake/CompanyStep.tsx
- client-intake/Fields.tsx
- client-intake/RegistrationStep.tsx
- client-intake/SectorStep.tsx
- client-intake/authority.ts
- client-intake/catalog.ts
- client-intake/form.ts
- client-intake/logo.ts
- client-intake/mutations.ts
- client-intake/profile-api.ts

#### client-profile

- client-profile/ActivityActions.tsx
- client-profile/ActivityDateFilter.tsx
- client-profile/ActivityDialogs.tsx
- client-profile/ActivityFeed.tsx
- client-profile/ActivityFilters.tsx
- client-profile/ActivityTimeline.tsx
- client-profile/ClientDetails.tsx
- client-profile/ClientFrame.tsx
- client-profile/ClientHeader.tsx
- client-profile/ClientMeriActions.tsx
- client-profile/ClientOverview.tsx
- client-profile/ClientProfileActions.tsx
- client-profile/ClientProgramContext.tsx
- client-profile/ClientViewSwitcher.tsx
- client-profile/FacilitiesCard.tsx
- client-profile/FacilitiesManager.tsx
- client-profile/FacilityActionStatus.tsx
- client-profile/FacilityAwardSection.tsx
- client-profile/FacilityCommittees.tsx
- client-profile/FacilityDetailDialog.tsx
- client-profile/FacilityDialog.tsx
- client-profile/FacilityEconomicSections.tsx
- client-profile/FacilityEditor.tsx
- client-profile/FacilityEngagementContext.tsx
- client-profile/FacilityEvidenceChanges.tsx
- client-profile/FacilityFields.tsx
- client-profile/FacilityGeocoding.tsx
- client-profile/FacilityLocationFacts.tsx
- client-profile/FacilityMap.tsx
- client-profile/FacilityMapControls.tsx
- client-profile/FacilityMapDialog.tsx
- client-profile/FacilityMemberPriorities.tsx
- client-profile/FacilityRemoveDialog.tsx
- client-profile/FacilityRepresentation.tsx
- client-profile/FacilityRepresentationSection.tsx
- client-profile/FacilityStrategicRelevance.tsx
- client-profile/FacilityStrategySections.tsx
- client-profile/FacilityWriteStatus.tsx
- client-profile/FederalActivity.tsx
- client-profile/GovernmentInfo.tsx
- client-profile/GovernmentRegistration.tsx
- client-profile/NexusSourceFreshness.tsx
- client-profile/NotesDialog.tsx
- client-profile/OrderedOwnerFields.tsx
- client-profile/OverviewSignals.tsx
- client-profile/OwnerCards.tsx
- client-profile/ProfileEvidenceState.tsx
- client-profile/ProfileFacts.tsx
- client-profile/QuickLog.tsx
- client-profile/TeamDialog.tsx
- client-profile/TeamMemberFields.tsx
- client-profile/TeamRoster.tsx
- client-profile/activity-attempt.ts
- client-profile/activity-change.ts
- client-profile/activity-completion.ts
- client-profile/activity-filters.ts
- client-profile/activity-mutations.ts
- client-profile/activity-presentation.ts
- client-profile/client-program-context.ts
- client-profile/enrichment/ClientEnrichmentDialog.tsx
- client-profile/enrichment/FindingReview.tsx
- client-profile/enrichment/ResearchSetup.tsx
- client-profile/enrichment/RunLedger.tsx
- client-profile/enrichment/actions.ts
- client-profile/enrichment/queries.ts
- client-profile/enrichment/useReviewAction.ts
- client-profile/export/ClientProfileExport.tsx
- client-profile/export/actions.ts
- client-profile/facility-action-attempt.ts
- client-profile/facility-action-writer.ts
- client-profile/facility-attempt.ts
- client-profile/facility-map-model.ts
- client-profile/facility-map-mutations.ts
- client-profile/facility-map-projection.ts
- client-profile/facility-map-queries.ts
- client-profile/facility-map-view.ts
- client-profile/facility-writer.ts
- client-profile/notes-writer.ts
- client-profile/ordered-owners.ts
- client-profile/past-performance/PastPerformance.tsx
- client-profile/past-performance/RemoveSubmission.tsx
- client-profile/past-performance/actions.ts
- client-profile/past-performance/queries.ts
- client-profile/past-performance/submission-view.ts
- client-profile/past-performance/useSubmissionRemoval.ts
- client-profile/profile-access.ts
- client-profile/profile-evidence-queries.ts
- client-profile/profile-keys.ts
- client-profile/profile-read-queries.ts
- client-profile/profile-receipts.ts
- client-profile/profile-source.ts
- client-profile/queries.ts
- client-profile/quick-log/FollowUpFields.tsx
- client-profile/quick-log/FollowUpStatus.tsx
- client-profile/quick-log/QuickLogDetailFields.tsx
- client-profile/quick-log/QuickLogUndo.tsx
- client-profile/quick-log/actions.ts
- client-profile/quick-log/authority.ts
- client-profile/quick-log/command-actions.ts
- client-profile/quick-log/command-recovery.ts
- client-profile/quick-log/useCommandRecovery.ts
- client-profile/quick-log/useFollowUpCommand.ts
- client-profile/quick-log/useQuickLog.ts
- client-profile/tags/FocusTags.tsx
- client-profile/tags/actions.ts
- client-profile/team-writer.ts
- client-profile/useClientViewKeys.ts
- client-profile/useFacilityWriter.ts
- client-profile/useOrderedOwners.ts
- client-profile/useProfileNotesEditor.ts
- client-profile/useProfileTeamEditor.ts

#### files

- files/DeleteFile.tsx
- files/DocumentState.tsx
- files/EntityDocuments.tsx
- files/FileAccess.tsx
- files/FileMetadataStatus.tsx
- files/FilePreview.tsx
- files/FileSelectionBar.tsx
- files/FileStorageUsage.tsx
- files/FileTable.tsx
- files/FileToolbar.tsx
- files/FilesPage.tsx
- files/FolderAccessStatus.tsx
- files/FolderCards.tsx
- files/MoveFile.tsx
- files/ProspectFiles.tsx
- files/UploadDialog.tsx
- files/deletion.ts
- files/extraction.ts
- files/file-reader.ts
- files/file-scope.ts
- files/folder-access.ts
- files/linked-arrival.ts
- files/metadata-actions.ts
- files/metadata-attempt.ts
- files/mutations.ts
- files/navigation.ts
- files/prospect-files.ts
- files/prospect-upload-recovery.ts
- files/prospect-upload.ts
- files/queries.ts
- files/upload.ts
- files/useFileDeletion.ts
- files/useFileMetadataChange.ts
- files/useProspectUpload.ts

#### index

- index/CreateProfileDialog.tsx
- index/GlobalQuickLog.tsx
- index/IndexFilters.tsx
- index/IndexNavigation.tsx
- index/IndexOwnerFilter.tsx
- index/IndexPipeline.tsx
- index/PortfolioIndex.tsx
- index/PortfolioProfiles.tsx
- index/PortfolioPulse.tsx
- index/PreviewClientCatalog.tsx
- index/ProfileResults.tsx
- index/ProspectResults.tsx
- index/attention/AttentionItem.tsx
- index/attention/PortfolioAttention.tsx
- index/attention/model.ts
- index/attention/query.ts
- index/catalog-projection.ts
- index/filter.ts
- index/layout/PortfolioLayoutEditor.tsx
- index/layout/api.ts
- index/layout/ordering.ts
- index/layout/usePortfolioLayout.ts
- index/mutations.ts
- index/queries.ts

#### intake

- intake/csv/CsvImportDialog.tsx
- intake/csv/api.ts
- intake/csv/model.ts
- intake/registrant/CandidateReview.tsx
- intake/registrant/FirmLinkConfirmation.tsx
- intake/registrant/FirmSearch.tsx
- intake/registrant/ImportRecovery.tsx
- intake/registrant/ImportResult.tsx
- intake/registrant/RegistrantImportDialog.tsx
- intake/registrant/api.ts
- intake/registrant/domain.ts
- intake/registrant/queries.ts
- intake/registrant/useFirmLink.ts
- intake/registrant/useImportAttempt.ts

#### objectives

- objectives/NewObjectivePage.tsx
- objectives/ObjectiveEditor.tsx
- objectives/ObjectiveEditorControls.tsx
- objectives/ObjectiveFields.tsx
- objectives/ObjectiveGeneration.tsx
- objectives/ObjectiveGovernedPlanner.tsx
- objectives/ObjectiveList.tsx
- objectives/ObjectiveOutreach.tsx
- objectives/ObjectivePlanOutcome.tsx
- objectives/ObjectiveReadiness.tsx
- objectives/ObjectiveSavedVersion.tsx
- objectives/ObjectiveStrategyIntake.tsx
- objectives/ObjectiveSummary.tsx
- objectives/ObjectiveWorkDestinations.tsx
- objectives/ObjectivesPage.tsx
- objectives/global-create/GlobalObjectiveClientPicker.tsx
- objectives/global-create/client-options.ts
- objectives/mutations.ts
- objectives/objective-generation-recovery.ts
- objectives/objective-generation-session.ts
- objectives/objective-governed-planner-read.ts
- objectives/objective-plan-flow.ts
- objectives/objective-plan-recovery.ts
- objectives/objective-plan-session.ts
- objectives/objective-planner-sources.ts
- objectives/objective-strategy-intake-recovery.ts
- objectives/objective-strategy-intake-session.ts
- objectives/objective-strategy-intake-source.ts
- objectives/objective-work-sources.ts
- objectives/operational/ObjectiveOperationalPage.tsx
- objectives/operational/OperationalSections.tsx
- objectives/operational/operational-links.ts
- objectives/operational/query.ts
- objectives/queries.ts
- objectives/useObjectiveEditorSession.ts
- objectives/useObjectiveWorkDestination.ts
- objectives/writer.ts

#### opportunities

- opportunities/OpportunitiesPage.tsx
- opportunities/OpportunityResults.tsx
- opportunities/RelevantPrograms.tsx
- opportunities/presentation.ts
- opportunities/queries.ts

#### prospects

- prospects/NextStepEditor.tsx
- prospects/ProspectDetail.tsx
- prospects/ProspectEditor.tsx
- prospects/ProspectHistory.tsx
- prospects/ProspectNotes.tsx
- prospects/ProspectPipeline.tsx
- prospects/ProspectStageProgress.tsx
- prospects/ProspectsIndex.tsx
- prospects/StageEditor.tsx
- prospects/brief/BriefDate.tsx
- prospects/brief/BriefDocument.tsx
- prospects/brief/BriefEditor.tsx
- prospects/brief/BriefHistory.tsx
- prospects/brief/BriefRefresh.tsx
- prospects/brief/BriefSource.tsx
- prospects/brief/BriefViewer.tsx
- prospects/brief/ProspectBrief.tsx
- prospects/brief/WorkspaceCopyLink.tsx
- prospects/brief/api.ts
- prospects/brief/editing.ts
- prospects/brief/hooks.ts
- prospects/contacts/ContactEditor.tsx
- prospects/contacts/ProspectContacts.tsx
- prospects/contacts/api.ts
- prospects/contacts/queries.ts
- prospects/conversion/ProspectClientLink.tsx
- prospects/conversion/api.ts
- prospects/conversion/queries.ts
- prospects/mutations.ts
- prospects/overview.ts
- prospects/proposals/ProspectProposals.tsx
- prospects/proposals/TemplateCatalog.tsx
- prospects/proposals/TemplatePreview.tsx
- prospects/proposals/api.ts
- prospects/proposals/hooks.ts
- prospects/proposals/persistence-contract.ts
- prospects/queries.ts

#### relationships

- relationships/AddGovernmentTargetButton.tsx
- relationships/AddTargetDialog.tsx
- relationships/ContactDrawer.tsx
- relationships/ContactForm.tsx
- relationships/ContactMail.tsx
- relationships/DirectoryResults.tsx
- relationships/GovernmentRelationships.tsx
- relationships/HierarchyEditor.tsx
- relationships/MailCompose.tsx
- relationships/OrganizationChart.tsx
- relationships/PriorityTarget.tsx
- relationships/RelationshipTypeNavigation.tsx
- relationships/RelationshipsPage.tsx
- relationships/TargetDrawer.tsx
- relationships/TargetRecommendations.tsx
- relationships/committee/CommitteePicker.tsx
- relationships/committee/CommitteePickerPanel.tsx
- relationships/committee/catalog.ts
- relationships/contact-api.ts
- relationships/contact-create-attempt.ts
- relationships/directory-queries.ts
- relationships/email.ts
- relationships/email/AttachmentFields.tsx
- relationships/email/MailboxField.tsx
- relationships/email/RecipientFields.tsx
- relationships/email/RichMailEditor.tsx
- relationships/email/SignaturePreview.tsx
- relationships/email/attachments.ts
- relationships/email/authority.ts
- relationships/email/draft.ts
- relationships/email/mail-body-html.ts
- relationships/email/mail-body.ts
- relationships/email/mailboxes.ts
- relationships/email/recipients.ts
- relationships/email/rewrite.ts
- relationships/email/rich-mail-selection.ts
- relationships/email/send-attempt.ts
- relationships/email/send.ts
- relationships/email/useMailAttachments.ts
- relationships/email/useMailRewrite.ts
- relationships/email/useMailboxes.ts
- relationships/member-notes/MemberNoteForm.tsx
- relationships/member-notes/MemberQuickLog.tsx
- relationships/member-notes/api.ts
- relationships/member-notes/useMemberNote.ts
- relationships/mutations.ts
- relationships/queries.ts
- relationships/target-queries.ts
- relationships/thread/ThreadContent.tsx
- relationships/thread/TimelineMailThread.tsx
- relationships/thread/recipients.ts

#### work

- work/WorkPage.tsx
- work/WorkStrategyState.tsx
- work/WorkspaceDocumentTable.tsx
- work/WorkspaceDocuments.tsx
- work/owners.ts
- work/queries.ts



<a id="workspace"></a>

## Workspace action wiring audit and bounded closeout plan

### Scope, evidence, and interpretation

Read-only source audit as of 21 October 2026. Main branch and PR115/192 heads were rechecked unchanged at 16:04 UTC; PR197 receiver head was verified at 16:05 UTC. No repository changes, tests, provider calls, live tenant writes, mail, deployment, infrastructure changes, or permission changes were performed. Tests below are proposed acceptance tests, not executed results.

Pinned sources:
- Frontend main: `4f9a7e8dcaa9ba03494dc5a49559daf70cea5100`.
- Backend backend-import: `309af848f1aa403f6c8e54aa0d22990d4230f063`.
- Meri main: `3c56c3e981ba868a2af103c4cae9f65a0d47458d`.
- [Frontend PR115](https://github.com/neo-capiro/capiro-frontend/pull/115) is open/draft, actual head `7fda299e2264d17a5a88c1dad50b08633ba862ae`, 16 commits and 103 changed files at inspection. Its body cites older heads and is not the current implementation inventory. Its all-format artifact-access receiver is supplemental, not merged-main behavior.
- [Meri PR197](https://github.com/neo-capiro/meri-greenfield/pull/197) is the current open/draft receiving vehicle, head `cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a`, based on Meri main above. Its [pinned source-coverage report](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/docs/integration/SOURCE-COVERAGE-20261021.md) records receipt of the B2 document-access donor and exact generated public artifacts. Qualify the public package and runtime binding against this chosen receiver, coordinated with frontend PR115.
- [Meri PR192](https://github.com/neo-capiro/meri-greenfield/pull/192), open/draft at `8eab537a8c60bf086afb56b2ceb24b79f6260b6b`, is **donor provenance**, not an additional merge to perform: its additive B2 source is already received in PR197. The document-access contract is distinct from document-writing; neither donor nor receiver alone activates handlers, storage or renderer. Do not separately merge PR192 on top of the receiver.
- Historical donor PR94 is already represented by received work in PR97/101/105/110. Do not plan those merges again.

“Implemented” below means a concrete consumer, operation, controller/service and persistence path exist in the pinned source. It does not mean deployed, enabled, successfully migrated, provider-qualified or live-verified. “Missing consumer” means backend capability exists but the new frontend has no corresponding product control/operation. “Intentional hold” means a visible limitation is truthful and must not be removed by bypassing authority or reusing an incompatible legacy API.

Portfolio Work and prospect entry points share Workspace persistence. Portfolio planning owns those entry points; Workspace owns the durable document/client contract and underlying editor lifecycle here. Settings and user-mailbox integrations are separate plans. Review/invitation mail is system mail, not the user's connected Outlook/Gmail mailbox.

### Executive findings

1. Workspace is not a blank shell. Hill Day, ordinary draft save/history, basic newsletter editing/comments, saved-revision Outreach staging, Outreach template CRUD/use, prospect manual documents, independent Core-brief copies and rich-newsletter CAS persistence have real source paths.
2. The largest gaps are distinct: incomplete document lifecycle, several backend-only consumer families, a canonical-client mismatch that blocks client-associated basic-newsletter staging, and inconsistent recovery/versioning.
3. Fix access boundaries before expanding controls. Hill Day has tenant-only read/status paths; share create/revoke/index and approval preflight/request are not consistently document-role scoped. These are source-level security defects, not merely missing buttons.
4. Three document systems coexist: ordinary `WsDraft/WsDocument`, `WsNewsletterDocument`, and immutable Meri artifact versions. Outreach templates are a fourth, campaign-specific resource. They must not be silently conflated or migrated by display name.
5. “Deliver” in Hill Day records status only. Newsletter “Stage” creates/hands off a saved draft revision only. Neither action proves recipients were selected, a provider sent anything, or delivery occurred.
6. Frontend preview containment and Meri write gates intentionally hold capabilities. Source implementation and configuration-held/live-unverified states must remain separately visible.

### End-to-end transport and persistence spine

[Workspace operation registry][ws-ops] selects fixed operations. Browser consumers use the existing Capiro request/query/mutation transport. [Next route][ws-route] first applies [preview containment][ws-preview-policy], then session authentication and the [fixed-operation gateway][ws-gateway]. The gateway chooses service URL from [configuration][ws-config], validates inputs/outputs and binds the token server-side. Workspace operations use **WORKSPACE_API_BASE_URL**, not merely the Core API URL. [Workspace bootstrap][ws-main] mounts a global `/workspace-api` prefix; a base URL lacking that prefix targets the wrong routes. Core Outreach template and stage-receive operations use Core instead. Meri has its separate opaque-session, selected-client and deployment-owner boundary.

[AppModule][ws-mounts] mounts Drafts, Documents, Versions, Comments, Collaborators, Notifications, Context, Generation, Export, Checks, EditLock, DocumentAgent, QuickDraft, TemplateStudio, Delivery, HillDay and Newsletter modules. Their presence is not proof that the new frontend consumes all of them.

[Prisma schema][ws-schema] contains real document, version, share, approval, comment, collaborator, notification, edit-lock, blueprint/theme/asset, Hill Day, intake/run, prospect receipt and rich-newsletter models. [Prisma service][ws-prisma] documents application-level tenant/role enforcement for Workspace tables, making missing service checks material. [Entrypoint][ws-entrypoint] separates migration from serving; schema files alone do not prove deployed tables. Preserve the existing migration lineage, including versions/locks/collaborators, notifications, document-agent, guest comments, durable intake/run, themes/assets, Hill Day, source preparations, newsletter subfamilies, prospect-origin and immutable-version migrations, and Core-brief-copy migration. New migrations should be additive and bounded to the gaps below.

### Coverage matrix: actual routes and action families

Legend: **I** = source implemented; **P** = partially implemented; **M** = missing consumer; **H** = intentionally held/unavailable; all are **live-unverified** in this audit.

| Surface/action family inspected | Trace and persistence/receipt | Status and closure |
|---|---|---|
| Workspace entry, Documents/Workflows/Client shares tabs, Template Studio, New document chooser, Rich newsletter preview | [WorkspaceScreen][ws-screen] dispatches exact draft/prospect/brief-copy/rich-newsletter routes and local Hill Day/editor state. New document offers Hill Day, Newsletter and campaign template only. | P. General manual document creation/catalog is absent; local navigation loses Hill Day workflow/editor resume on reload. WS-06/07/10/21/22. |
| Documents search, owner/client/type/status filters, refresh, older/newest pages, row open | [Library][ws-library] → workspace.documents → GET /hillday/documents → [merged library service][ws-hill-service] → WsHillDayDocument/WsDraft plus source authorization. | P. Search and most filters apply to the loaded page, not entire library; client options also page-local. Rich newsletters/Meri artifacts not included. WS-02/04/06. |
| Ordinary draft title/section editing, Save, error/retry, History | [Draft editor][ws-draft] → PATCH draft then POST version → [Drafts][ws-draft-service]/[Versions][ws-version-service]. GET versions strips content to metadata in [DTO][ws-draft-ops]. | P. Save is not atomic/CAS; sectionless document bodies are read-only; history has no content/compare/restore; no ordinary export button. WS-05/07. |
| Prospect list, Refresh, manual Create, open | [ProspectWorkspace][ws-prospect]/[Create][ws-prospect-create] → prospect-scoped fixed operations → guarded Workspace persistence and request receipts. Retained exact creation request supports deliberate recovery. | I with deliberate restrictions. Keep canonical prospect and conversion-origin checks. WS-25 only for residual lifecycle/hold decisions. |
| Prospect title/content Save, read-current, uncertain-save recovery | [Draft editor][ws-draft]/[prospect-save][ws-prospect-save] retain original command and verify current actor/tenant/prospect authority. | I, stronger than ordinary draft save. Reuse its discipline, not necessarily its prospect-specific DTO, in WS-05. |
| Prospect rich formatting and local preview | [Formatting toolbar][ws-format-toolbar]: undo/redo, paragraph/h2/h3, bold/italic/underline, safe link add/remove, lists, insert/add-row/add-column/delete-table, quote/divider, preview. Sanitization review protects unsupported original markup. | I local editor functions, persisted by explicit save; not native Office fidelity. Ordinary non-prospect editor does not expose these. WS-07. |
| Prospect PDF/DOCX exports | [Export controls][ws-prospect-export] re-read scope → existing [export operations][ws-export-ops] → [ExportController][ws-exports] → saved-content renderer and binary receipt. | I. Export is saved content, not unsaved local editor. Keep origin/ACL tests; WS-25. |
| Prospect Share/Send/Generate | Disabled in [prospect surface][ws-prospect]; backend transfer denial preserves origin safety. | H, not a forgotten click handler. Do not enable as part of wiring without separate authority contract. WS-25. |
| Core brief → independent Workspace copied tab | [BriefCopyFlow][ws-copy] checks exact Core saved version and destination state; atomic copy command creates document+version. | I. Source remains immutable and edits independent; no generation/send/share. |
| Copied-tab edit/name, save, read-current, exact retry/conflict review | [CopyEditor][ws-copy-editor]/[CopyRecovery][ws-copy-recovery] use expectedStateHash, expectedClientId, durable request and bound receipt; explicit refresh/adopt semantics. | I. Reuse these patterns for WS-05, do not replace with generic PATCH. |
| Copied-tab source evidence and history | [CopyHistory][ws-copy-history] lists whole-draft version metadata, original source evidence and fresh body for comparison; whole-draft restore explicitly forbidden. | P/H. No version-content viewer yet; do not remove restore prohibition. WS-07/25. |
| Client shares index, expiration/count display, Revoke confirmation | [Shares UI][ws-shares] → GET /shares and DELETE share → [DeliveryController][ws-delivery]/[ShareLinkService][ws-share-service] → WsShareLink. Reload after response. | P. Index/revoke ACL gaps; void DELETE vs frontend null response mismatch; no create/copy/public viewer/feedback detail consumer. WS-03/09. |
| Hill Day blueprint/sponsor/name/timezone setup | [Wizard][ws-hill-wizard] → blueprints/clients/create → [HillDay service][ws-hill-service] → WsHillDayDocument; implemented blueprints only. | I/P. No durable wizard URL/resume; name is editable at setup but no rename consumer after generation. WS-10/11. |
| Hill Day calendar date selection, event checkboxes, Directory member search, manual meeting add | [Meetings][ws-hill-meetings] → calendar/members/meetings PUT/manual POST → source adapter + persisted meetings. | I/P. Broader member/staffer/relationship browsing endpoints unconsumed. WS-11. |
| Hill Day resolution, resolve/re-resolve, office correction, manual attendees, stale facts, meeting location | [Resolution][ws-hill-resolution] → GET/POST resolution and PATCH correction → persisted resolution/event. | I/P. Not all correction DTO kinds/meeting facts have UI; refresh must replace earlier resolve mutation result. WS-11. |
| Hill Day context, carry bio/committees/issues/staffers, linked threads, lookback/notes, save | [Context][ws-hill-context] → GET/PUT meeting context → persisted selections/source provenance; unsaved switching guarded. | I. Source/provider availability is visible, not synthetic success. WS-01/02 qualification. |
| Hill Day Generate, per-unit progress, retry, open document | [Generation UI][ws-hill-run-ui] → start → poll job → [generation service][ws-hill-generation] → WsHillDayJob/meetings and AI credentials. | P. Local job ID, in-process execution claim; no cancel/recover-current after reload. WS-10. |
| Hill Day navigation, quality checks, provenance/context drawer, client preview | [Editor][ws-hill-editor] → document/quality/context reads. | I, read ACL defect WS-02. Preview is local, not delivered/rendered proof. |
| Hill Day first-page edit/restore defaults; focus/background edit | [Section editors][ws-hill-edit-fields] → PATCH. First-page has expectedUpdatedAt; section updates do not. | P. Summary layout/facts preserved but not editable; CAS missing on section/status/name changes. WS-05/11. |
| Hill Day Refine with Meri/regenerate | Visible refinement control explicitly unavailable. Legacy backend refine/regenerate/SSE routes exist, but are not the greenfield Meri consumer contract. | H/M. WS-11/22, no legacy-owner bypass. |
| Hill Day Export PDF, page size, download | [Export UI][ws-hill-export-ui] → POST export → [PDF service][ws-hill-export] stores bytes; fixed download with exp/sig. Status operation exists but unused. | P. No refresh/recovery of expired or lost receipts; unstable-secret fallback; ACL. WS-02/12. |
| Hill Day Deliver confirmation | [Editor][ws-hill-editor] explicitly says it records delivery status; PATCH status only. | I as status marker, not mail/share. WS-09 for actual delivery handoff; do not relabel as sent. |
| Basic newsletter template search/category/preview/select | [Template presets][ws-newsletter-presets] are three local seeds (weekly/column/blank). | I as local seeds, not persisted catalog. Save as template explicitly unavailable. WS-14. |
| Basic newsletter blocks/edit dialog/add/remove/reorder, undo/redo, desktop/mobile, title/subject/preview/firm/address/client | [Workflow][ws-newsletter]/[Paper][ws-newsletter-paper] maintain local design; Save writes WsDocument body.newsletter plus rendered blocks. | P. Asset URLs, social/code rendering limitations, unsaved data lifetime; no upload. WS-04/05/13/14. |
| Basic newsletter Save draft | [useNewsletter][ws-newsletter-save] creates legacy draft with client NAME, then document PATCH, draft title PATCH and version POST. | P. Canonical client ID missing; partial writes, no whole-save CAS/idempotent receipt. WS-04/05. |
| Basic newsletter Review, comments/replies, resolve/reopen | [Comments][ws-newsletter-comments] → existing comments GET/POST/PATCH → WsComment; reload. Checklist is explanatory prose. | I/P. No formal approval, collaborators, suggestions/delete, mention notifications. WS-08/09. |
| Basic newsletter saved-version selection, Outreach target, stage, retained recovery, receipt open | [Staging][ws-newsletter-staging]/[model][ws-newsletter-stage-model] → exact saved revision/hash and Core Outreach request; rechecks actor/client and retains request identity. [Server projection][ws-saved-revision] authorizes immutable snapshot. | P. Client-name drafts fail canonical client guard; subject projection uses docTitle; body plain text only. WS-04/13. Sending remains separate. |
| Rich newsletter local create/edit blocks, basic style controls, undo/redo, mobile/plain text, close confirmation | [Rich editor][ws-rich-editor]/[structure][ws-rich-structure]/[controls][ws-rich-controls]. Only 7 addable kinds; other loaded content preserved with partial controls. | I/P. Sections/columns/advanced/product/social/survey tools absent; external resources inert in local preview. WS-16. |
| Rich newsletter explicit Load/Create/Open/Read/Adopt/Rebase/Save | [Actions][ws-rich-actions] → [controller][ws-rich-controller]/[adapter][ws-rich-adapter] → [8 fixed ops][ws-rich-ops] → [Newsletter service][ws-rich-service] → WsNewsletterDocument revision CAS. | I/P. Current-state readback is not exact unknown-create reconciliation. Journal scope/lifetime limits; no durable exact operation receipt for create. WS-15. |
| Rich saved-state preview | Explicit POST preview returns rendered saved content, but no document/revision receipt; UI does not falsely claim pinned proof. | P. WS-15. Never equate local preview with email-client screenshot. |
| Rich stage | Revision-pinned POST stage → WsNewsletterStage transaction/upsert → confirmed stage ID/route shown only. Unknown attempt fences same revision. | P. No stage recovery operation in consumer, no destination navigation/open/prepare/test/send flow. WS-15/19. |
| Rich collaboration/review/review mail/preferences | Visible combined unavailable action; backend [routes][ws-rich-routes] support reviewers, invitations, review/comments and notifications. | M/H. WS-17; system email worker dependency, not user mailbox. |
| Rich saved template/section library, folders/name/delete, brand kit/fonts, surveys | Backend [NewsletterController][ws-rich-routes]/[service][ws-rich-service] has all these; no new frontend operations. | M. WS-16. Brand-kit GET can initialize data; library/detail reads can activate invitations, so do not hide side effects behind prefetch. |
| Rich uploads/assets/folders/image revisions/import/stock images | Backend persists assets, tokens, folders, revisions and provider metadata; new UI only edits URLs. | M. WS-18. Generic Meri attachment upload is a different missing contract. |
| Rich AI write, image refine, alt text, HTML check, video thumbnail, link preview, inbox preview | Backend supports first seven with capability checks; inbox screenshot capability explicitly false. | M/H. WS-18/22; keep unavailable providers honest, no auto external fetch/generate on typing. |
| Outreach Template Studio list/search/sort/filter/archive tabs | [Studio][ws-template-studio] → [Outreach template operations][ws-outreach-templates] → Core campaign-template service, not Workspace blueprint service. “Capiro” system catalog is empty/held. | I/P. No fake system template seeds; clear campaign/template distinction. WS-20/21. |
| Outreach template create/edit defaults/questions/variables/guardrails/review/save | [Wizard][ws-template-wizard] uses real create/update draft calls. | I/P. Sequential metadata+draft writes, no atomic receipt; WS-20. |
| Outreach template publish/archive/duplicate/from-campaign/settings | [Studio][ws-template-studio]/[Settings][ws-template-settings] invoke actual Core mutations and detail reads. | I/P. Settings does not refresh parent list; from-campaign only first100 sessions; version/provenance consumers absent. WS-20. |
| Outreach template Use, inherited/refreshed/unresolved result, open campaign | Fixed Core use op with request key; receipt reports actual resolution, links Engagement. | I/P. Request identity held only in mounted useRef, not durable recovery; WS-20. |
| Workspace document blueprints/themes/brand assets/catalog | [TemplateStudio backend][ws-document-templates], [themes][ws-themes], [brand assets][ws-brand-assets], [cascade][ws-cascade] are mounted but not this frontend campaign studio. | M. WS-21, distinct resource names/contracts. |
| General draft context, checks, collaborator role lifecycle, notifications, lock lifecycle | Existing [context][ws-context], [checks][ws-checks], [collaborator][ws-collaborators], [comment][ws-comments], [notification][ws-notifications], [lock][ws-locks] controllers. | M except limited basic-newsletter comments and external context-add consumers. WS-08. |
| Document-agent setup/brief/context/outline/proposals/generation/quality; quick/two-step intake/run/retry | [Document-agent][ws-agent] and [intake][ws-intake] mounted with durable models/worker; no general new-Workspace product consumer. | M/H depending owner/provider qualification. WS-22, reuse owners, never resurrect old UI wholesale. |
| Imported LegiWatch preparations/editorial/research drafts and output bridge | Internal source controllers ([preparation][ws-source-preparation], [editorial][ws-source-editorial], [research][ws-source-research]) resolve current authorized source via Intel, create source-action receipts, serve bounded output. Workspace opens resulting draft. | I/P. Depends on Intel URL/internal secret and current source access; editor may expose read-only document bodies. WS-01/07. Source creation belongs to originating module, not a new public internal-route button. |
| /meri/files connect, create Word/TXT or workbook, revise, inspect, versions/known-version ID, verified download | [Host][ws-meri-host]/[Workflow][ws-meri-files] → separate Meri opaque-session transport → [document owner][ws-meri-doc-owner] → immutable versions/storage. Deployment selects one operation. | I/configuration-held. Main receiver limited to docx/txt/xlsx. WS-23/24. |
| Meri conversation artifact cards inspect/download | [Conversation artifacts][ws-conversation-artifacts]/[access adapter][ws-meri-access] validate version identity/hash/bytes and selected scope. | I/P. PR115 widens read-only formats to all six; not merged. WS-23. |
| Meri rendered preview, full history/list/file-to-client/upload/extract/share | [Unavailable resources][ws-meri-unavailable] accurately withhold public consumers. [Preview owner][ws-meri-preview-owner]/[runtime composition][ws-meri-runtime] already exist behind trusted custody/renderer configuration. | M/H. Do not implement duplicate renderer/storage or conflate private handler with published contract. WS-24. |
| Meri fixture document workspace/filetree/share/comment/save/export sheets | [Fixture document screen][ws-fixture-doc]/[comments][ws-fixture-comments] are design/fixture surfaces; save/version formatting controls disabled or local-only; dialogs do not prove persistence. | H/design-only. Do not count as operational Workspace routes. WS-24 separately decides graduation; not blanket enable. |

### Implementation-ready gap register

Severity: **P0** must be resolved or held before affected capability activation because it threatens authorization or release containment. **P1** blocks an advertised end-to-end workflow or durable correctness. **P2** is completeness/usability once the safe path works. A P0 configuration qualification is not a request to change live configuration during this audit.

<a id="ws-01"></a>

#### WS-01 — Workspace-specific readiness and qualification (P0 release gate; configuration-held)

**Evidence/root cause:** [Config][ws-config], [route][ws-route], [main][ws-main], [mounts][ws-mounts], [entrypoint][ws-entrypoint]. The main preview is read-only-contained; Core availability does not establish Workspace availability. Ordinary Workspace uses a distinct service URL/prefix, Prisma schema and migration history. Hill Day reads Core/Directory sources; source-backed drafts call Intel; AI and reviewer mail have independent dependencies.

**Bounded work:** Add a non-secret readiness diagnostic for each required service/operation family, with explicit held/unconfigured/auth/migration/provider states. Qualify the exact Workspace image and all existing migrations against its DB, ALB path, Clerk tenant resolver, Core/Intel internal routes and token audience. Keep preview mutation gates off until separate release approval. Do not run migrations at every serve startup or silently fall back to production source URLs.

**Dependencies/tests:** Shared deployment plan, Settings AI credentials and mail-worker plan. In non-production fixtures verify missing/wrong WORKSPACE_API_BASE_URL, missing prefix, 401/403, absent tables, unavailable Core/Intel, and read-only preview all fail closed with actionable UI; Core success must not imply Workspace success. Record source SHA/image/migration/route/provider evidence separately from any later live run.

<a id="ws-02"></a>

#### WS-02 — Enforce current Hill Day document/client authority everywhere (P0)

**Evidence/root cause:** [HillDay service][ws-hill-service] listDocuments applies client wall only when a client filter is supplied; the unfiltered Hill Day query is tenant-only. get/quality/assertDoc do not receive actor; getClient is called with a null user. Owner writes do not consistently recheck current client wall. [Generation job reads][ws-hill-generation] and [export status][ws-hill-export] are tenant/document scoped without actor. These differ from source-guarded ordinary drafts.

**Bounded work:** Introduce one small Hill Day resource admission helper using existing actor resolution/client-wall lookup. Apply it to list rows, get/quality/context/resolution, job/event reads, edit/generate/refine/export and signed-link issuance. Preserve owner-write policy; explicitly decide whether reads are tenant-team or owner-based, but always enforce the current client's wall and active membership. Do not add a new ACL platform.

**Acceptance:** Tenant A vs B, same-tenant unrelated member, owner whose client access was revoked, removed member, invalid IDs, filtered/unfiltered list, direct URL, job ID and export ID tests; forbidden rows do not leak title/count/source text. A formerly issued public grant follows the explicit expiry/revocation policy, not an accidental authenticated fallback.

<a id="ws-03"></a>

#### WS-03 — Close draft sharing/approval authorization holes (P0)

**Evidence/root cause:** [Delivery controller][ws-delivery] supplies no actor to revoke/list. [Share service][ws-share-service] create/revoke validate tenant and deny prospect transfer but do not call collaborator permission policy; list enumerates tenant-wide titles/counts. [Approval service][ws-approval] preflight/request omit actor permission checks; decision uses generic canReview but does not enforce blueprint permittedApproverRoles.

**Bounded work:** Reuse CollaboratorsService/current source access for list/read/share/revoke/request/decide; define who may share and approve, then check it at service boundaries, not buttons alone. Validate pinned version belongs to the exact draft+tenant. Enforce approval policy against the exact frozen revision before public release and invalidate or refuse stale approvals. Preserve prospect transfer denial.

**Acceptance:** Owner/editor/reviewer/viewer/unrelated member matrix, removed collaborator, revoked source/client access, cross-draft version substitution, forged share/approval IDs, and request-vs-decision role mismatches. No public share release without the required approval of the exact served version. Security tests must pass before WS-09 consumers activate.

<a id="ws-04"></a>

#### WS-04 — Canonical client association for legacy drafts (P1, cross-Portfolio dependency)

**Evidence/root cause:** [Draft DTO][ws-draft-ops] accepts only display-name client; [newsletter create][ws-newsletter-save] sends client.name. [Schema][ws-schema] retains legacy string association. [Merged library][ws-hill-service] and Portfolio Work match names. [Saved-revision projection][ws-saved-revision] explicitly refuses legacy client hints unless snapshot/current config.clientId are valid and equal. Therefore a normal client-selected basic newsletter cannot stage to Outreach using the current flow.

**Bounded work:** Add canonical nullable clientId to the ordinary draft owner contract and persisted association (prefer typed column plus safe snapshot field), validated against active client/current wall. Carry it in create/read/save/version/library/Portfolio adapters; retain display name only for presentation. Backfill only provably unique authorized mappings, keep ambiguous/renamed legacy rows held for explicit association, and never infer prospect conversions from names. Define immutable revision attribution versus current-client changes.

**Acceptance:** Duplicate names, rename, inactive/deleted client, reassignment, revoked wall, firm/null and snapshot mismatch. Creating a client newsletter, saving, reopening from Portfolio and staging must retain the same UUID and succeed; ambiguous legacy content must not migrate or become visible to the wrong client.

<a id="ws-05"></a>

#### WS-05 — Atomic ordinary draft/newsletter save and concurrency (P1)

**Evidence/root cause:** [Ordinary save][ws-draft] is PATCH + version POST; [newsletter save][ws-newsletter-save] is document PATCH + draft PATCH + snapshot, after a separate create. [Draft][ws-draft-service]/[document services][ws-document-service] are last-write-wins for ordinary content. Hill Day first-page CAS exists, section edits omit it. Successful first writes followed by failures can be presented as a failed save or version unrelated to submitted content.

**Bounded work:** Add a bounded atomic save-and-version operation to the existing owner, with expected revision/state hash and durable request ID+payload hash. Persist all supplied title/body/config and exactly one immutable snapshot in one transaction. Reuse prospect/copy receipt and recovery discipline, not their special authority. Resolve ordinary create plus primary document atomically. Expose read-current/adopt/rebase and exact original replay after unknown outcome; never allocate new request IDs automatically. Use expectedUpdatedAt for all Hill Day edits.

**Acceptance:** Two editors, stale baseline, failure between every former write, timeout-after-commit, retry same/different payload, remount/session switch, body/title consistency, and one receipt/one snapshot. Retain local text until the bound receipt and current read are reconciled. No optimistic “saved” on partial success.

<a id="ws-06"></a>

#### WS-06 — Complete library semantics and durable navigation (P1)

**Evidence/root cause:** [Library][ws-library] filters the current 50-row response locally; older pages replace current data. [Screen][ws-screen] opens Hill Day/current draft in local state. Rich newsletters and Meri artifacts have separate libraries, and prospect drafts intentionally are not name-matched.

**Bounded work:** Move search/owner/type/client filters to the authorized library query with stable cursor semantics; include canonical clientId from WS-04. Add durable document and Hill Day wizard/job URLs with unambiguous resource kind. Provide explicit links/tabs to rich-newsletter and Meri libraries before attempting any aggregation. If a unified list is desired, aggregate only each owner's safe metadata projection with resource kind and authoritative route, not raw tables or fabricated shared IDs.

**Acceptance:** Search hit on page3, empty authorized page with nextCursor, filter changes resetting cursor, duplicate names, reload/back/forward, direct URLs, malformed/conflicting params, moved client scope and no unauthorized rows. Existing prospect-origin exclusion remains.

<a id="ws-07"></a>

#### WS-07 — Ordinary document lifecycle, content editing and version use (P1)

**Evidence/root cause:** [Draft editor][ws-draft] exposes title, known sectionContent, save and metadata-only history; arbitrary WsDocument blocks without section names render read-only. Rich formatting/preview/export exists only on prospect branch. [Documents][ws-document-service], [Versions][ws-version-service] and [ExportController][ws-exports] already own much of the missing capability. Backend restore skips removed documents and leaves extra current documents, so it is not an exact whole-draft restore despite earlier “lossless” wording.

**Bounded work:** Add ordinary manual create, safe section/tab create/rename/reorder/remove, section formatting/preview reuse, saved PDF/DOCX export with explicit all/main/tab choice, document status and recoverable delete where product semantics allow. Add version detail and compare using exact saved snapshots, then a clearly defined restore-as-new-version transaction with CAS. Preserve unsupported block JSON without lossy round-trip; show read-only reason until a typed editor exists. Do not enable whole-draft restore on a copied-Core-brief draft.

**Acceptance:** Imported source draft with block bodies, unknown rich fields, formatted/plain content, tab add/delete/reorder, malformed/oversized content, version detail authorization, restore with deleted/new tabs and ordinal changes, export saved vs unsaved warning. No data deletion hidden inside editor hydration.

<a id="ws-08"></a>

#### WS-08 — Ordinary collaboration, review, context, checks and locking consumers (P1)

**Evidence/root cause:** [Collaborators][ws-collaborators], [notifications][ws-notifications], [comments][ws-comments], [locks][ws-locks], [context][ws-context], [checks][ws-checks] are mounted. Basic newsletter only consumes comment read/create/reply/resolve. Ordinary draft has no collaboration, notification, context-manager or check panel.

**Bounded work:** Add narrowly scoped fixed operations and UI for invite/accept/decline/change-role/remove, list/read/read-all notifications, comment suggestion/delete and permitted edits, context list/add/update/delete, validation checks and edit-lock status/acquire/heartbeat/release/request/takeover. Keep lock advisory vs enforced semantics explicit and rely on WS-05 CAS for actual safety. Reuse the existing inbox/profile shell where possible rather than a second notification platform. Mail notifications remain opt-in and separate from merely adding collaborators.

**Acceptance:** Full role matrix, invitation acceptance/current-membership recheck, expired locks/two tabs/abrupt disconnect, accepted suggestion creates expected content revision, mention resolution, notification idempotence/readback, private source context removal and no cross-client context leakage. Basic comments still work without mail provider.

<a id="ws-09"></a>

#### WS-09 — Safe approval/share/public-review completion (P1, after WS-03/05)

**Evidence/root cause:** [Shares UI][ws-shares] only lists/revokes. [Share service][ws-share-service] token hash is returned once; idempotency is incorrectly overloaded onto label, replay can return an empty token, no unique request key. Public response only maps config.sectionContent and truncates each section to 2,000 characters, ignoring document-body newsletters. Guest comments persist but have no new internal viewer; rate limiting is process-local. Revoke returns void without explicit 204 while [frontend operation][ws-draft-ops] expects null, a source-level response mismatch needing integration confirmation.

**Bounded work:** First harden WS-03. Define immutable share payload by supported document kind, never truncate silently; return unsupported-content refusal rather than blank newsletters. Add approval request/decision/status UI, share creation expiry/version/label confirmation, one-time URL display/copy and deliberate replacement/revocation recovery, public view and guest-feedback panel. Store separate unique request ID+hash/receipt, not label/notes. Return explicit 204 or a typed revoke receipt and refresh list correctly. Use existing persistence/rate-limit owner, with distributed enforcement for multiple replicas.

**Acceptance:** Frozen revision stays frozen after edits; no unapproved share; full long content or explicit refusal; newsletter payload parity; expiry/revoke/unknown creation/replay without token leakage; duplicate click creates one link; guest comment visible internally; multi-replica abuse limits; DELETE success updates UI without false error. Actual external sending remains a separate reviewed Outreach/provider action.

<a id="ws-10"></a>

#### WS-10 — Hill Day durable job lifecycle and resume (P1)

**Evidence/root cause:** [Generation service][ws-hill-generation] uses an in-process Set and setImmediate. If an active DB job is absent from that process's Set it treats it as interrupted, so another replica may invalidate/restart live work. [UI][ws-hill-run-ui] retains job ID locally; wizard selection is not durable navigation.

**Bounded work:** Reuse existing [durable generation-worker][ws-worker] lease/claim pattern for WsHillDayJob; add lease owner/expiry/heartbeat or equivalent conditional DB claim, persisted phase/unit progress and exact start request identity. Add authorized latest-active-job read, reload/resume, deliberate failed-unit retry and cancellation with honest “requested” state if provider work cannot stop. Persist wizard document ID/phase in route; read authoritative saved selections on entry.

**Acceptance:** Two replicas race one start, restart during unit execution, worker lease expiry, browser reload/close, start timeout-after-commit, partial failure and retry only failed units. No duplicate provider charge from a second process assuming the first stopped. Preserve successful content/manual edits on retry.

<a id="ws-11"></a>

#### WS-11 — Finish Hill Day editing and correction coverage (P2; owner-dependent AI held)

**Evidence/root cause:** [Resolution UI][ws-hill-resolution] consumes a subset of correction kinds. [Section editor][ws-hill-edit-fields] edits only title/dateline and focus/background. Directory staffer/detail/relationship browsing, some meeting subject/time facts, first-page layout fields and post-create rename are unconsumed; refinement is explicitly held.

**Bounded work:** Add verified correction inputs for staffer assignment and supported meeting facts, consistent current resolution refresh, post-create name editing, and supported first-page summary/column controls with CAS. Reuse existing Directory/current source IDs rather than accepting free-form authoritative identities. Expose regenerate/refine only after the chosen greenfield contract/owning service is qualified under WS-22, with preview/accept separate from generation.

**Acceptance:** Stale Directory vs invitation selection, attendee IDs from another meeting, unavailable Directory, empty/manual rows, timezone/date boundaries, repeated refresh after prior resolve, concurrent section changes, reset defaults and no unintended erasure of preserved first-page fields.

<a id="ws-12"></a>

#### WS-12 — Recoverable Hill Day export and stable signing (P1)

**Evidence/root cause:** [Export service][ws-hill-export] stores PDF bytes, signs links with WORKSPACE_EXPORT_SIGNING_SECRET, otherwise internal secret or per-process random UUID. [Export UI][ws-hill-export-ui] does not use existing status operation; lost/expired export receipt has no recovery path. Export status also needs WS-02 authorization.

**Bounded work:** Require an explicit stable signing key in qualified deployments and fail closed when absent; do not silently generate a new key per replica. Reuse export status to poll/renew a known authorized receipt and show expiry/retry. Add request identity/status lookup if POST's committed export ID can be lost. Include content digest/version/revision in export receipt if exact-byte/revision proof is promised; do not call raw HTTP success fidelity proof.

**Acceptance:** Two replicas/download after restart, missing key, expired/tampered signatures, wrong document/export IDs, timeout after render commit, render failure, max byte limits, correct filename/MIME, current-access check before refreshed grant, and output content matching pinned saved revision.

<a id="ws-13"></a>

#### WS-13 — Basic newsletter staged content fidelity (P1)

**Evidence/root cause:** [Saved-revision projection][ws-saved-revision] uses snapshot.docTitle as email subject and projects plaintext body; authored newsletter.subject is separately stored. [Staging UI][ws-newsletter-stage-model] correctly warns rich formatting/images/attachments are excluded, but cannot fix a mismatched intended subject or legacy client binding.

**Bounded work:** After WS-04/05, extend the versioned projection for Newsletter to use validated saved newsletter subject and plain-text body with an explicit projection/version hash. Show the exact staged subject/body before confirmation, preserve immutable attribution and length limits, and never silently truncate. Keep rich HTML sending on the rich-newsletter path rather than attaching an unverified HTML blob to the plaintext staging contract.

**Acceptance:** Distinct document title/email subject, non-ASCII content, empty subject, >8,000-character body, image-only blocks, invalid or missing newsletter body, exact saved-version replays, firm/client sponsors and changed session scope. What the user confirms must equal the staged draft receipt.

<a id="ws-14"></a>

#### WS-14 — Basic newsletter templates/assets and preview fidelity (P2)

**Evidence/root cause:** [Presets][ws-newsletter-presets] are local; “Save as template” is unavailable. [Paper][ws-newsletter-paper] accepts image/logo URLs but no upload; social kind falls through to text, and code renders literally. Local displayed date is not a saved revision fact.

**Bounded work:** Do not route this button to campaign Template Studio. Prefer an explicit supported conversion/import into the existing rich Newsletter library owner (WS-16), preserving source version and warning on unsupported kinds, or implement a narrowly typed basic-template store if product chooses to retain both systems. Connect asset picker via WS-18 rather than arbitrary new storage. Correct/social-code display semantics or label unsupported projections; save date metadata if intended as content. Preserve local undo/redo and intentional save.

**Acceptance:** Save/reopen same design, basic→rich conversion with unsupported content refusal/review, same subject/footer/images/links before and after save, no email-script execution, no remote image fetch on inert preview, and template client scoping.

<a id="ws-15"></a>

#### WS-15 — Rich-newsletter exact recovery and pinned preview receipt (P1)

**Evidence/root cause:** [Controller][ws-rich-controller]/[adapter][ws-rich-adapter] correctly fence unknown create/save/stage; current read/adopt does not establish earlier causation. Create lacks exact operation reconciliation. Stage is backend-unique by document/revision/owner, but frontend cannot recover missing stage ID and permanently fences that revision in scope. Saved preview response lacks document/revision identity.

**Bounded work:** Add request-bound create/status receipt to existing NewsletterService and durable uniqueness; add explicit stage lookup/replay for exact document/revision/owner using existing upsert identity. Return documentId/revision/render hash in preview receipt and validate them client-side. Upgrade write journal to supported durable recovery semantics if recoverability across reload is promised, minimizing retained sensitive content. Keep explicit adopt/rebase; no read-triggered writes or blind retries.

**Acceptance:** Unknown create/save/stage after commit, reload, scope switch, stale revisions, current read differing from submitted payload, exact vs changed replay, concurrent stage requests and preview response from another revision. Readback must not falsely claim original creation success.

<a id="ws-16"></a>

#### WS-16 — Rich newsletter content/library/brand/survey consumers (P1)

**Evidence/root cause:** [Rich structure][ws-rich-structure]/[controls][ws-rich-controls] add only heading/paragraph/image/button/divider/spacer/code, and some loaded block types have limited controls. [Newsletter routes][ws-rich-routes] already own template/section library CRUD, brand kit/fonts and surveys.

**Bounded work:** Add fixed operations and UI for owner-scoped library search/use/save section/template/name/folder/delete, brand kit/fonts, supported section/column/reorder/style controls, social/logo/video/product/context blocks and survey authoring only where existing validated types permit. Use loaded design as source, never drop unknown fields on edit. Separate client-bound source blocks from presentation-only blocks; recheck every referenced client on save/stage. Brand-kit initialization and invitation activation must be explicit, not hidden prefetch.

**Acceptance:** Nested columns and all supported kinds round-trip; cancel leaves saved design untouched; unknown fields preserved; source client removed/revoked; brand font MIME/size validation; library ownership; survey choices/closed state; existing block values remain stable when editing an unrelated block.

<a id="ws-17"></a>

#### WS-17 — Rich newsletter review/collaboration and system-mail handoff (P1)

**Evidence/root cause:** [Unavailable action][ws-rich-actions] has no consumer for mounted [review/comment/invitation endpoints][ws-rich-routes]. Backend owns reviewer/author/viewer roles, invitations, watchers, comments, review summaries and durable mail requests.

**Bounded work:** Add reviewers/current role panel, invite existing user or explicit email, cancel/remove, review comments/replies/resolve/mentions and notification preference controls. Use role-derived read-only editor and current-access readback. Expose queued/sent/unknown/failed invitation or review-mail state only from the system-mail owner; distinguish granting access from sending notification. Reuse existing review and invitation workers, not user mailbox integration.

**Dependencies/acceptance:** Mail plan owns default-off worker gates, SES sender and retries. Test unverified email, existing/absent membership, author vs reviewer/viewer, invite activation on explicit open, cancellation before mail claim, revoked client access, duplicate invite, mention recipient derivation and no silent mail on a mere save. A request receipt must not be displayed as delivered email.

<a id="ws-18"></a>

#### WS-18 — Rich assets and optional provider tools (P1 consumer gap; configured capability holds)

**Evidence/root cause:** [Newsletter routes][ws-rich-routes]/[service][ws-rich-service] already persist asset bytes, folders, public capability tokens, image revisions and origin metadata. Stock-image search needs NEWSLETTER_PEXELS_API_KEY; HTML compatibility uses MAILTRAP_API_TOKEN/ACCOUNT_ID/SANDBOX_ID; image refinement/alt text uses OpenAI credentials; writing uses AI credentials. Link/video import owners exist. Inbox screenshots explicitly remain unavailable.

**Bounded work:** Build bounded upload/import/select/details/rename/delete/move/folders/revisions controls and reuse the existing gateway’s bounded multipart support, rather than introducing arbitrary upstream routing. Reuse asset ACL, validated import/SSRF owner, byte/MIME limits and deletion semantics. Add explicit-intent stock search/import with attribution, alt-text generation/refine-image, writing assistance, HTML check, video thumbnail and link-preview commands using capability reads. Show proposed result before replacing document design. Distinguish provider keys configured from operation qualified.

**Acceptance:** Oversize/MIME mismatch, SVG/script payloads, private-network/redirect imports, cross-owner asset IDs/folders, deleted public token, multi-image revision, duplicate paid request/unknown result, missing provider/rate-limit, and provider errors without secret/body leakage. No screenshot “passed” state without a real screenshot provider. Optional tools failing must not break manual editing.

<a id="ws-19"></a>

#### WS-19 — Complete rich-newsletter Outreach handoff, not a second sender (P1)

**Evidence/root cause:** [Rich UI][ws-rich-actions] shows a legacy returned route as text, intentionally does not navigate/open/prepare/test/send. Core already mounts [NewsletterOutreachController](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/newsletter-outreach.controller.ts): stage read/open, record get, prepare, send and test; its service uses immutable prepared versions and durable send intents. No new sender is needed.

**Bounded work:** Add a validated native Engagement destination and explicit “Open staged newsletter” action with fixed Core stage-open operation, bound receipt and readback. Build/reuse recipient/sender review, prepare, immutable-version preview, deliberate test/send and durable send-status consumer in Engagement. Preserve exact stage/document/revision/client identity, own sender connection and prepared destination binding. Reuse mail-plan readiness/recovery. Public archive/unsubscribe/preferences/survey routes already exist; qualify their generated public base URLs and tokens rather than recreate them.

**Acceptance:** Existing stage opened once/replayed, wrong actor/client/stage rejection, selection changes invalidating prepared versions, sender revoked, test vs live recipients, timeout-after-send, zero automatic resend, unsubscribe/preference/survey token behavior and no open/create/send on navigation alone. Staging receipt never implies approval or sending.

<a id="ws-20"></a>

#### WS-20 — Campaign Template Studio recovery, refresh and history (P2)

**Evidence/root cause:** [Template wizard][ws-template-wizard] updates metadata and draft sequentially; [Settings][ws-template-settings] refreshes detail but not outer cards. “Use” request key survives only the mounted component; source-campaign picker takes first100. Core version/provenance routes exist without consumers.

**Bounded work:** Keep this as campaign templates. Add bound save/use command receipts and durable exact replay or a clear unknown-state fence; freeze submitted inputs while pending. Invalidate list+detail after settings/publish/archive/duplicate. Add paginated campaign search and existing version/provenance viewers, with publication pinned to the saved revision. Do not fabricate populated “Capiro” templates.

**Acceptance:** Metadata saved/draft failure, concurrent draft publish, lost use receipt/remount, double-click, label/client changes while pending, list card refresh, campaign beyond first100 and correct inherited/unresolved fields shown on actual receipt.

<a id="ws-21"></a>

#### WS-21 — Real document Template Studio, themes and assets (P1 missing consumer)

**Evidence/root cause:** Current [TemplateStudio UI][ws-template-studio] consumes Core Outreach. Workspace [blueprint][ws-document-templates], [theme][ws-themes], [brand-asset][ws-brand-assets] controllers and [cascade][ws-cascade] catalog are separate and mounted. New-document chooser has no route into them.

**Bounded work:** Add a distinctly named document-template area using existing blueprint create/clone/version/test/publish/retire/compare, theme CRUD/version/publish/retire and brand-asset list/upload/delete. Wire published blueprint selection into the chosen ordinary/agent setup; never send campaign template IDs as document blueprints. Expose library/product/industry/pathway/committee/section defaults only as catalog data, not generated content. Preserve publisher-role and validation/test gates before publication.

**Acceptance:** Draft vs published visibility, immutable pin on existing documents, invalid blueprint validation, retired template behavior, compare exact versions, tenant/client scopes, duplicate names, referenced theme/assets removed and campaign-vs-document ID confusion rejected.

<a id="ws-22"></a>

#### WS-22 — General document generation and agent consumers, with correct owner (P1 missing consumer / intentional AI hold)

**Evidence/root cause:** [Document-agent][ws-agent] has catalog/recommend, initialize/state/messages, brief edit/synthesize/approve/reopen, context recommend/analyze/resolve/approve, outline generate/edit/revise/approve, proposal accept/reject, generation status/retry/cancel and quality/fix routes. [Two-step intake][ws-intake] already aggregates authorized source IDs into an idempotent durable run. The new general Workspace screen does not consume these; legacy generation/refinement is not automatically the greenfield Meri contract.

**Bounded work:** Choose and document the existing approved execution owner for each advertised action before adding operations. For Workspace-owned intake/manual phases, reuse current state-machine/revision and run-worker APIs with typed controls and exact request recovery. For greenfield Meri actions, publish/adopt only supported public contracts; do not import private runtime types or turn on old provider handlers to make the button look wired. Add only the missing feature panels and state transitions, not a parallel agent platform. Respect capability flag and explicit paid-generation intent.

**Acceptance:** Capability off, missing credentials, wrong source IDs/current scope, duplicate intake key/payload mismatch, brief/context/outline approval pins, stale proposal, source revoked between plan/run, cancel/retry preserving successful units, unknown provider outcome and no execution merely by reading the editor. Review quality route ACL before exposing it: controller passes tenant/draft without actor to evaluator.

<a id="ws-23"></a>

#### WS-23 — Receive current all-format artifact access correctly (P1, open-PR supplemental)

**Evidence/root cause:** Main [artifact access][ws-meri-access]/[transport][ws-meri-transport] consumes frozen document-application read shapes for docx/txt/xlsx. Actual PR115 head switches inspect/download to public document-access-application 0.1.0 (donor provenance Meri PR192, already received by current Meri PR197 at `cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a`) and supports docx/txt/xlsx/pptx/pdf/zip. Writer remains the narrower contract.

**Bounded work:** Review/receive the existing coordinated frontend PR115 and Meri PR197 changes after current-head checks and public-contract acceptance; do not reimplement the adapter, merge historical donor94, or separately merge donor192. Pin the generated public artifact provenance/hash/version, verify byte equivalence at the chosen PR197 receiver, and qualify that receiver’s actual runtime mounting/configuration against the matching read application. Keep create/revise on the existing write contract and preserve unknown/runtime-held states. Inspect/download is not native rendered preview or successful creation qualification.

**Acceptance:** All six formats, old3 compatibility, wrong version/client/session, bad SHA/size/MIME, expired link, unavailable nativeOpen/render/recalc flags remain unavailable, and no new write operations enabled. Check PR head changed files, not stale body prose. Production remains unqualified until separately evidenced.

<a id="ws-24"></a>

#### WS-24 — Meri file workspace/upload/preview/history consumer boundary (P1 missing consumers; intentional holds)

**Evidence/root cause:** [Meri Files][ws-meri-files] creates/revises typed documents, shows recent local versions or a known ID, and verifies inspect/download; no published workspace-wide artifact list, upload/extraction, file-to-client, share or full history consumer. [Preview implementation][ws-meri-preview-owner]/[runtime][ws-meri-runtime] already supports publish/read via qualified renderer/custody with session/retention checks. Those private/opt-in owners are not automatically a public frontend contract. Fixture save/share/comment sheets are not production handlers.

**Bounded work:** Inventory current public contract gaps per action; extend the Meri public application surface only for list/history/preview/upload/file/share actually approved for product. Reuse immutable artifact storage, retention, signed downloads, existing preview renderer/custody and exact-parent revisions. Expose explicit preview publication (a write) separately from read. Upload/extraction requires scoped storage/object ownership, allowlisted MIME/limits, scanning/extraction receipt and provenance before use as evidence. No browser-supplied tenant grants or fake conversion. Graduate fixture controls only after these contracts; otherwise keep clearly unavailable.

**Acceptance:** Retention suppressed/revoked artifacts disappear from list and fail direct history/preview/download; preview source digest matches exact version; renderer unavailable/unsupported TXT honest; read never reserves generation budget; upload cannot cross client or become trusted model instruction; no local dialog suggests durable save/share. Broader PDF/PPTX generation requires its own qualified owner, not merely a read-format expansion.

<a id="ws-25"></a>

#### WS-25 — Preserve and complete prospect/copy guarantees (P2 residual lifecycle; intentional holds)

**Evidence/root cause:** [Prospect][ws-prospect], [save][ws-prospect-save] and [copy][ws-copy]/[recovery][ws-copy-recovery] are already substantial main implementation, not unreceived donor work. Prospect sharing/sending/generation are explicitly denied. Copied Core briefs have independent atomic editing and immutable source lineage; whole-draft restore is refused.

**Bounded work:** Keep current scope/origin/receipt guards while applying only missing safe lifecycle pieces from WS-07, such as version-detail inspection and saved-tab export where supported. Preserve original Core-version evidence separately from newly edited text. If product later wants share/send/generate on prospect-origin content, require a dedicated converted-client authority and immutable-version contract; that decision is outside simple wiring and must not be silently bundled into “enable all controls.”

**Acceptance:** Converted prospect's original identity retained; client-wall revocation after conversion; source/destination mismatch, stale stateHash, exact retained copy/save retry, history containing unknown fields, prohibited restore and generic PATCH attempts against copied tabs. No duplicate copy from recovery and no mutation of the original Core brief.


### Mounted-route inventory cross-check

This inventory is extracted from the inspected controller source to ensure backend-only families are not lost. “Missing” refers to the new Workspace consumer, not a claim that no legacy/external module uses the route. The source bridge controllers are intentionally internal and must not be added as browser operations. Exact authorization and response work is described in the gap register above.

| Controller/source | Declared routes | Receiving scope |
|---|---|---|
| [cascade.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/cascade/cascade.controller.ts) | `GET /cascade`; `GET /cascade/section-library`; `GET /cascade/:industry/products`; `GET /cascade/:industry/data`; `GET /cascade/:industry/products/:product/pathways`; `GET /cascade/:industry/committees`; `GET /products/:product/defaults` | WS-21/22; catalog missing consumer |
| [checks.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/checks/checks.controller.ts) | `GET /drafts/:draftId/checks` | WS-08; missing check panel |
| [collaborators.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/collaborators/collaborators.controller.ts) | `GET /drafts/:draftId/collaborators`; `POST /drafts/:draftId/collaborators`; `POST /drafts/:draftId/collaborators/:id/accept`; `POST /drafts/:draftId/collaborators/:id/decline`; `PATCH /drafts/:draftId/collaborators/:id`; `DELETE /drafts/:draftId/collaborators/:id` | WS-08; missing role/invitation lifecycle |
| [comments.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/comments/comments.controller.ts) | `GET /documents/:documentId/comments`; `POST /documents/:documentId/comments`; `POST /documents/:documentId/comments/:commentId/suggest`; `PATCH /documents/:documentId/comments/:commentId`; `DELETE /documents/:documentId/comments/:commentId` | Basic newsletter list/create/reply/resolve wired; WS-08 for remainder |
| [context.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/context/context.controller.ts) | `GET /drafts/:draftId/context`; `POST /drafts/:draftId/context`; `DELETE /drafts/:draftId/context/:itemId` | External free-text addition exists; WS-08 for general Workspace manager |
| [delivery.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/delivery/delivery.controller.ts) | `POST /drafts/:draftId/delivery/preflight`; `POST /drafts/:draftId/delivery/approval-requests`; `POST /drafts/:draftId/delivery/approval-requests/:requestId/decision`; `POST /drafts/:draftId/delivery/share-links`; `DELETE /drafts/:draftId/delivery/share-links/:shareLinkId`; `GET /drafts/:draftId/delivery/guest-comments`; `GET /shares`; `GET /public/workspace-share/:token`; `POST /public/workspace-share/:token/comments` | Index/revoke wired; WS-03/09 for safe completion |
| [document-agent.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/document-agent/document-agent.controller.ts) | `GET /document-agent/catalog`; `POST /document-agent/recommend`; `GET /drafts/:draftId/agent`; `POST /drafts/:draftId/agent/initialize`; `PATCH /drafts/:draftId/agent`; `GET /drafts/:draftId/agent/messages`; `POST /drafts/:draftId/agent/messages`; `PUT /drafts/:draftId/agent/brief`; `POST /drafts/:draftId/agent/brief/synthesize`; `POST /drafts/:draftId/agent/brief/approve`; `POST /drafts/:draftId/agent/brief/reopen`; `POST /drafts/:draftId/agent/context/recommend`; `POST /drafts/:draftId/agent/context/analyze`; `POST /drafts/:draftId/agent/context/approve`; `POST /drafts/:draftId/agent/context/resolve`; `POST /drafts/:draftId/agent/outline/generate`; `PUT /drafts/:draftId/agent/outline`; `POST /drafts/:draftId/agent/outline/revise`; `POST /drafts/:draftId/agent/outline/approve`; `GET /drafts/:draftId/agent/proposals`; `POST /drafts/:draftId/agent/proposals/:proposalId/accept`; `POST /drafts/:draftId/agent/proposals/:proposalId/reject`; `POST /drafts/:draftId/agent/generate`; `GET /drafts/:draftId/agent/generation`; `POST /drafts/:draftId/agent/generation/retry`; `POST /drafts/:draftId/agent/generation/cancel`; `GET /drafts/:draftId/agent/quality`; `POST /drafts/:draftId/agent/quality/issues/:issueId/fix`; `PATCH /drafts/:draftId/context/:itemId` | WS-22; general new-Workspace consumer missing/owner qualification |
| [documents.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/documents/documents.controller.ts) | `GET /drafts/:draftId/documents/brief-copy-state`; `GET /drafts/:draftId/documents/:docId/brief-copy`; `POST /drafts/:draftId/documents/core-brief-copy`; `POST /drafts/:draftId/documents/:docId/brief-copy-save`; `GET /drafts/:draftId/documents/meri-import`; `GET /drafts/:draftId/documents`; `GET /drafts/:draftId/documents/:docId/meri-import`; `POST /drafts/:draftId/documents`; `PATCH /drafts/:draftId/documents/:docId`; `DELETE /drafts/:draftId/documents/:docId` | Basic newsletter update and bound Core-copy flow wired; WS-07 remainder |
| [drafts.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/drafts/drafts.controller.ts) | `POST /drafts`; `GET /drafts`; `GET /drafts/:id`; `PATCH /drafts/:id`; `POST /drafts/:draftId/anonymize/detect`; `DELETE /drafts/:id` | Ordinary read/create/update and prospect guarded lifecycle wired; WS-05/07 plus source bridges |
| [editorial-source.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/drafts/editorial-source.controller.ts) | `POST /internal/legiwatch/editorial/lookup`; `GET /internal/legiwatch/editorial/:id/output`; `POST /internal/legiwatch/editorial` | Ordinary read/create/update and prospect guarded lifecycle wired; WS-05/07 plus source bridges |
| [preparation-source.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/drafts/preparation-source.controller.ts) | `POST /internal/legiwatch/preparations` | Ordinary read/create/update and prospect guarded lifecycle wired; WS-05/07 plus source bridges |
| [research-source.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/drafts/research-source.controller.ts) | `GET /internal/legiwatch/research/:id/output`; `POST /internal/legiwatch/research` | Ordinary read/create/update and prospect guarded lifecycle wired; WS-05/07 plus source bridges |
| [edit-lock.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/edit-lock/edit-lock.controller.ts) | `GET /drafts/:draftId/lock`; `POST /drafts/:draftId/lock/acquire`; `POST /drafts/:draftId/lock/heartbeat`; `POST /drafts/:draftId/lock/release`; `POST /drafts/:draftId/lock/request`; `POST /drafts/:draftId/lock/take-over` | WS-08; no editor lock consumer |
| [export.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/export/export.controller.ts) | `GET /drafts/:draftId/export/docx`; `GET /drafts/:draftId/export/pdf` | Prospect PDF/DOCX wired; WS-07 ordinary controls |
| [generation.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/generation/generation.controller.ts) | `POST /drafts/:draftId/generate-section`; `POST /drafts/:draftId/generate-all`; `POST /drafts/:draftId/retry-failed-sections`; `POST /drafts/:draftId/apply-generated-sections`; `POST /drafts/:draftId/generate-all-direct`; `GET /drafts/:draftId/context-used`; `POST /drafts/:draftId/promote-memory`; `POST /meri/intake` | WS-22; legacy provider boundary, not implied greenfield activation |
| [hillday-file.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-file.controller.ts) | `GET /hillday/files/:documentId/:exportId` | Main workflow substantially wired; WS-02/10/11/12 |
| [hillday.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday.controller.ts) | `GET /hillday/blueprints`; `GET /hillday/documents`; `POST /hillday/documents`; `GET /hillday/clients`; `GET /hillday/clients/:clientId/calendar`; `PUT /hillday/documents/:id/meetings`; `POST /hillday/documents/:id/resolution`; `GET /hillday/documents/:id/resolution`; `PATCH /hillday/documents/:id/resolution/:meetingId`; `POST /hillday/documents/:id/meetings/manual`; `GET /hillday/directory/members/:memberId`; `GET /hillday/directory/members`; `GET /hillday/directory/staffers`; `GET /hillday/directory/browse`; `GET /hillday/documents/:id/relationships`; `GET /hillday/documents/:id/meetings/:meetingId/context`; `PUT /hillday/documents/:id/meetings/:meetingId/context`; `GET /hillday/engagement/threads`; `POST /hillday/documents/:id/generate`; `GET /hillday/documents/:id/generate/:jobId`; `GET /hillday/documents/:id/generate/:jobId/events`; `POST /hillday/documents/:id/sections/:sectionId/regenerate`; `POST /hillday/documents/:id/sections/:sectionId/refine`; `GET /hillday/documents/:id`; `PATCH /hillday/documents/:id`; `GET /hillday/documents/:id/quality`; `POST /hillday/documents/:id/exports`; `GET /hillday/documents/:id/exports/:exportId` | Main workflow substantially wired; WS-02/10/11/12 |
| [newsletter-stock-image.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/newsletters/newsletter-stock-image.controller.ts) | `GET /newsletters/stock-images/status`; `GET /newsletters/stock-images`; `POST /newsletters/stock-images/:id/import` | Only list/create/get/save/preview/stage wired; WS-15/16/17/18 |
| [newsletter.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/newsletters/newsletter.controller.ts) | `GET /newsletters/brand-kit`; `PATCH /newsletters/brand-kit`; `POST /newsletters/brand-kit/fonts`; `GET /newsletters/capabilities`; `GET /newsletters/documents`; `POST /newsletters/documents`; `GET /newsletters/documents/:id/surveys`; `POST /newsletters/documents/:id/surveys`; `GET /newsletters/documents/:id`; `PATCH /newsletters/documents/:id`; `POST /newsletters/documents/:id/preview`; `POST /newsletters/documents/:id/stage`; `POST /newsletters/documents/:id/write`; `POST /newsletters/documents/:id/generate-alt-text`; `POST /newsletters/documents/:id/refine-image`; `POST /newsletters/documents/:id/html-check`; `POST /newsletters/documents/:id/video-thumbnail`; `POST /newsletters/documents/:id/link-preview`; `GET /newsletters/library/:kind`; `POST /newsletters/documents/:id/library`; `PATCH /newsletters/library/items/:id`; `DELETE /newsletters/library/items/:id`; `GET /newsletters/documents/:id/comments`; `GET /newsletters/documents/:id/review`; `GET /newsletters/documents/:id/reviewers`; `POST /newsletters/documents/:id/reviewers`; `POST /newsletters/documents/:id/invitations`; `DELETE /newsletters/documents/:id/invitations/:invitationId`; `DELETE /newsletters/documents/:id/reviewers/:userId`; `PATCH /newsletters/documents/:id/review-notifications`; `POST /newsletters/documents/:id/comments`; `GET /newsletters/documents/:id/thread-notifications`; `GET /newsletters/documents/:id/comments/:commentId/notifications`; `PATCH /newsletters/documents/:id/comments/:commentId/notifications`; `PATCH /newsletters/documents/:id/comments/:commentId`; `GET /newsletters/assets`; `GET /newsletters/asset-folders`; `POST /newsletters/asset-folders`; `PATCH /newsletters/asset-folders/:id`; `DELETE /newsletters/asset-folders/:id`; `POST /newsletters/assets/move`; `GET /newsletters/assets/:id`; `GET /newsletters/assets/:id/revisions`; `POST /newsletters/assets/revisions`; `PATCH /newsletters/assets/:id`; `POST /newsletters/assets/delete`; `POST /newsletters/assets/import`; `POST /newsletters/assets`; `GET /newsletters/assets/file/:token` | Only list/create/get/save/preview/stage wired; WS-15/16/17/18 |
| [notifications.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/notifications/notifications.controller.ts) | `GET /notifications`; `POST /notifications/read-all`; `POST /notifications/:id/read` | WS-08; no Workspace notification consumer |
| [quick-draft.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/quick-draft/quick-draft.controller.ts) | `POST /drafts/:draftId/agent/generate-from-intake` | WS-22; no general intake/run consumer |
| [two-step-draft.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/quick-draft/two-step-draft.controller.ts) | `GET /document-agent/two-step-draft-capability`; `POST /document-agent/intakes`; `GET /document-agent/runs/:runId/status`; `POST /document-agent/runs/:runId/retry-failed` | WS-22; no general intake/run consumer |
| [brand-asset.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/template-studio/brand-asset.controller.ts) | `GET /template-studio/assets`; `POST /template-studio/assets`; `DELETE /template-studio/assets/:assetId` | WS-21; separate document-template consumer missing |
| [template-studio.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/template-studio/template-studio.controller.ts) | `GET /template-studio/blueprints`; `POST /template-studio/blueprints`; `GET /template-studio/blueprints/:blueprintId`; `POST /template-studio/blueprints/:blueprintId/clone`; `POST /template-studio/blueprints/:blueprintId/versions`; `GET /template-studio/blueprints/:blueprintId/versions/:versionId`; `PATCH /template-studio/blueprints/:blueprintId/versions/:versionId`; `POST /template-studio/blueprints/:blueprintId/versions/:versionId/test`; `POST /template-studio/blueprints/:blueprintId/versions/:versionId/publish`; `POST /template-studio/blueprints/:blueprintId/versions/:versionId/retire`; `GET /template-studio/blueprints/:blueprintId/compare` | WS-21; separate document-template consumer missing |
| [theme-studio.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/template-studio/theme-studio.controller.ts) | `GET /template-studio/themes`; `POST /template-studio/themes`; `GET /template-studio/themes/:themeId`; `POST /template-studio/themes/:themeId/versions`; `PATCH /template-studio/themes/:themeId/versions/:versionId`; `POST /template-studio/themes/:themeId/versions/:versionId/publish`; `POST /template-studio/themes/:themeId/versions/:versionId/retire` | WS-21; separate document-template consumer missing |
| [templates.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/templates/templates.controller.ts) | `GET /templates`; `GET /templates/library`; `GET /templates/:id` | WS-21; not campaign Template Studio |
| [versions.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/versions/versions.controller.ts) | `GET /drafts/:draftId/versions`; `GET /drafts/:draftId/versions/:versionId/outreach-revision`; `GET /drafts/:draftId/versions/:versionId/objective-destination`; `POST /drafts/:draftId/versions`; `POST /drafts/:draftId/versions/:versionId/restore` | Metadata list/snapshot plus staged revision/objective reads wired; WS-05/07 |

Controller route count in this appendix: **216** (excluding health; includes internal source bridges and multiple controller classes per file). This is a source surface inventory, not 1:1 missing-work count. Several routes intentionally belong to separate read/write phases or internal workflows.

### Dependency order and bounded implementation batches

1. **Qualification and access first:** WS-01, WS-02, WS-03. Keep previews and risky consumers held. Fix role/current-client checks in existing service owners and add negative tests before exposing another share/generate/export control.
2. **Durable document foundation:** WS-04 and WS-05, then WS-06/07. Coordinate the canonical client DTO once with Portfolio Work. Build ordinary atomic save/version receipts and safe version read before broader lifecycle UI.
3. **Complete already-working workflows:** WS-10/11/12 for Hill Day; WS-13/14 for basic newsletter; WS-15 for rich newsletter. Each batch ends with a reload/recovery/readback test, not just a button click.
4. **Add existing backend consumers in small vertical slices:** WS-08/09 (collaboration/share), WS-16/17/18 (rich library/review/assets/provider tools), WS-20/21 (campaign polish versus document templates). Each slice adds operation schema, handler, permission-specific UI, receipt and invalidation together.
5. **Handoff rather than rebuild:** WS-19 connects existing Core newsletter sender and mail readiness. WS-22 selects qualified generation owner. Neither can be completed by wiring a “Send”/“Generate” button straight to an older provider.
6. **Meri supplemental and contract work:** WS-23 receives coordinated current PR115/PR197 and the public artifact only after review; WS-24 fills remaining approved public consumer contracts using existing owners. Keep WS-25 origin guards throughout every batch.

Useful implementation PR boundaries: (a) security-only Hill Day/shared draft access; (b) canonical draft client association+safe migration+Portfolio adapter; (c) ordinary atomic save/version and recovery; (d) document library/navigation/lifecycle; (e) Hill Day job/export recovery; (f) basic-newsletter projection; (g) rich lifecycle receipts; (h) rich review/assets/library consumers; (i) template distinction and completion; (j) Outreach stage receiving UI; (k) current Meri artifact access receiver. These are sequencing suggestions, not new PRs created or merges authorized.

### Schema and storage change ledger

Reuse existing tables and migrations; do not recreate subsystems already present.

| Change | Existing owner | Minimal persistence delta to assess |
|---|---|---|
| Canonical ordinary draft association | WsDraft, WsDocVersion; shared saved-revision projection | Nullable canonical clientId/index/FK or equivalently enforced typed owner field, explicit ambiguous legacy state, frozen snapshot attribution. Additive backfill with counts and manual-resolution queue; no name-based blanket rewrite. |
| Atomic save/create receipt | WsDraft, WsDocument, WsDocVersion; prospect/copy receipt patterns | Expected revision/state hash, uniquely scoped requestId+payload hash+receipt, transaction joining title/config/documents/version. Avoid reusing prospect-only receipt semantics for arbitrary drafts. |
| Share/approval idempotence | WsShareLink, WsApprovalRequest, WsGuestComment | Separate request identity/hash/unique constraint and immutable served version. Do not store plaintext bearer tokens just to make replay convenient; define one-time grant recovery/replacement explicitly. |
| Hill Day multi-replica work | WsHillDayJob and existing durable-run worker pattern | Lease/claim/heartbeat/cancel/request identity as needed; no new general job platform. |
| Hill Day export recovery | WsHillDayExport byte storage | Request identity and pinned source digest/revision if exact recovery is required; existing status/download reused. Stable secret supplied outside DB/application logs. |
| Rich newsletter create/stage recovery | WsNewsletterDocument, WsNewsletterStage | Durable create request identity; existing document/revision/owner stage uniqueness reused. Preview identity/hash is a response-contract change, not necessarily a new store. |
| Rich review, assets, library, surveys | Existing newsletter models and design JSON | Primarily missing consumers. Existing migrations already cover reviewers/invitations/watchers/email requests/assets/folders/image revisions/library/brand. Assess only newly promised behavior, not duplicate tables. |
| Document template management | WsBlueprint/Version, WsTheme/Version, WsBrandAsset | Primarily fixed operations and new consumer. Preserve immutable pins and current validation rules. |
| Meri artifact listing/preview/upload | Existing Meri artifact version/storage/retention/preview custody | Publish suitable public contracts first. Reuse existing Postgres/S3/KMS/private-bucket/custody owners, not Workspace tables for opaque Meri versions. Upload/extraction needs actual provenance/scanning ownership before promotion to evidence. |

Migrations require fixture migration tests from current baseline, backfill verification, uniqueness-race tests and rollback/forward-recovery review. Live migration/deployment is not part of this planning task.

### Acceptance and proof requirements

#### Cross-cutting gates for every new action

- A declared source owner and fixed operation; no browser-composed arbitrary service path.
- Authenticated actor/tenant derived server-side, canonical client/prospect/resource identity checked on each current read/write and receipt.
- Button state distinguishes permission-denied, configuration-held, unsupported, loading, unsaved, submitted/unknown, conflict and confirmed.
- Mutation freezes exact submitted input, retains original request identity where supported, has no automatic replacement retry, and checks returned identity before success.
- Persisted outcome is followed by appropriate detail/list/version invalidation or explicit current read. Query readback alone is not causation proof.
- No successful toast for an empty/invalid response; no “sent/delivered/approved/rendered” inference from save/stage/provider acceptance.
- Supported content round-trips without silent stripping/truncation. Unsupported original fields remain byte-preserved/read-only until deliberate review.
- Cancellation/session/client switching clears stale presentation and aborts in-flight receive work, without claiming server rollback.
- Tenant/private-client/owner/editor/reviewer/viewer/removed-member/source-revoked tests run both through UI and direct controller service paths.
- Timeout-after-commit, response loss, concurrent tabs, multi-replica execution, replay payload mismatch and reload are mandatory cases for durable actions.
- Keyboard/modal/error focus and narrow/mobile view checks cover added controls, but cosmetic polish must not hide missing state/authority.

#### Reuse current regression suites, add gap-specific cases

These existing files were located in the pinned source; **none were run during this audit**:
- [Workspace admission](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/test/browser/workspace-admission.spec.ts), [ownership state](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/test/browser/workspace-ownership-state.spec.ts), [prospect restart](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/test/browser/prospect-draft-restart-acceptance.spec.ts), and [brief-copy](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/test/browser/workspace-brief-copy.spec.ts).
- [Newsletter staging](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/test/browser/newsletter-staging.spec.ts), [rich lifecycle](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/test/browser/newsletter-document-lifecycle.spec.ts), [rich navigation](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/test/browser/newsletter-document-navigation.spec.ts), and rich local-history/unit tests.
- [Meri file lifecycle](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/test/browser/meri-files-lifetime.spec.ts), [workflow](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/test/browser/meri-files-workflow.spec.ts), adapter/proxy/download/journal/workbook tests, plus PR115's supplemental document-access tests and the corresponding PR197 public-package/runtime qualification. Receiver-recorded historical passes/failures are not tests run in this audit.
- [Backend delivery](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/delivery/delivery.spec.ts), [Hill Day library access](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-library-access.spec.ts), generation/export/first-page/context/resolution tests, [newsletter tests](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/newsletters/newsletter.spec.ts), newsletter asset/folder/image/HTML/provider/review tests, prospect access and brief-copy tests.

A source unit test pass is not live readiness. Close each gap only with (1) contract/service negative tests, (2) fixture browser journey including recovery, (3) schema/storage evidence, (4) mounted environment/flag/provider qualification evidence, and, only when separately authorized, (5) bounded live verification. Report each layer separately. The final release checklist must still say “held” or “live-unverified” for layers without evidence.

### Explicit non-goals and honest stopping conditions

- No duplicate donor PR merge; no broad old-frontend import; no new document platform, sender, renderer, storage layer or job framework.
- Do not enable prospect transfer, bypass blueprint approval, route around source/client walls, or send mail as a side effect of review.
- Do not turn a fixture dialog into apparent success without the owner operation, persistence and receipt.
- Do not equate all-format artifact inspection with all-format generation, rendered preview, native Office opening, recalculation or delivery.
- Publication of a public Meri contract, provider qualification, actual environment/secret availability and the product choice for legacy/basic vs rich newsletter templates are dependencies. Until each is resolved, keep the exact affected action explicitly held while implementing independent work.
- This is a plan, not evidence that any described remediation has been made.

### Pinned source links

[ws-screen]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceScreen.tsx
[ws-library]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceLibrary.tsx
[ws-draft]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceDraft.tsx
[ws-shares]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceShares.tsx
[ws-ops]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/workspace.ts
[ws-draft-ops]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/workspace-documents.ts
[ws-hill-ops]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/workspace-hillday.ts
[ws-export-ops]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/workspace-exports.ts
[ws-gateway]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/gateway.ts
[ws-config]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/config.ts
[ws-route]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/app/api/capiro/[operation]/route.ts
[ws-preview-policy]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/preview/backend-policy.server.ts
[ws-mounts]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/app.module.ts
[ws-main]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/main.ts
[ws-schema]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/prisma/schema.prisma
[ws-prisma]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/prisma/prisma.service.ts
[ws-entrypoint]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/scripts/entrypoint.sh
[ws-draft-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/drafts/drafts.service.ts
[ws-document-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/documents/documents.service.ts
[ws-version-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/versions/versions.service.ts
[ws-saved-revision]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/shared/src/workspace-saved-revision.ts
[ws-delivery]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/delivery/delivery.controller.ts
[ws-share-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/delivery/share-link.service.ts
[ws-approval]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/delivery/approval.service.ts
[ws-hill-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-document.service.ts
[ws-hill-generation]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-generation.service.ts
[ws-hill-export]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-export.service.ts
[ws-hill-wizard]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayWizard.tsx
[ws-hill-meetings]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayMeetings.tsx
[ws-hill-resolution]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayResolution.tsx
[ws-hill-context]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayContext.tsx
[ws-hill-run-ui]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayGeneration.tsx
[ws-hill-editor]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayEditor.tsx
[ws-hill-edit-fields]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDaySectionEditors.tsx
[ws-hill-export-ui]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayExport.tsx
[ws-newsletter]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/NewsletterWorkflow.tsx
[ws-newsletter-save]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/use-newsletter.ts
[ws-newsletter-presets]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/NewsletterTemplates.tsx
[ws-newsletter-paper]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/NewsletterPaper.tsx
[ws-newsletter-comments]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/NewsletterComments.tsx
[ws-newsletter-staging]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/useNewsletterStaging.ts
[ws-newsletter-stage-model]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/staging-model.ts
[ws-rich-editor]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-newsletter/RichNewsletterEditor.tsx
[ws-rich-actions]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-newsletter/RichDocumentActions.tsx
[ws-rich-controller]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-newsletter/document-controller.ts
[ws-rich-structure]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-newsletter/RichStructure.tsx
[ws-rich-controls]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-newsletter/RichBlockControls.tsx
[ws-rich-adapter]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/rich-newsletter.ts
[ws-rich-ops]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/rich-newsletter.ts
[ws-rich-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/newsletters/newsletter.service.ts
[ws-rich-routes]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/newsletters/newsletter.controller.ts
[ws-template-studio]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/templates/TemplateStudio.tsx
[ws-template-wizard]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/templates/TemplateWizard.tsx
[ws-template-settings]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/templates/TemplateSettings.tsx
[ws-outreach-templates]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/outreach-templates.ts
[ws-document-templates]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/template-studio/template-studio.controller.ts
[ws-themes]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/template-studio/theme-studio.controller.ts
[ws-brand-assets]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/template-studio/brand-asset.controller.ts
[ws-prospect]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/prospects/ProspectWorkspace.tsx
[ws-prospect-create]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/prospects/ProspectDraftCreate.tsx
[ws-prospect-save]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/prospects/useProspectDraftSave.ts
[ws-prospect-export]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/prospects/ProspectDraftExport.tsx
[ws-format-toolbar]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-document/DocumentToolbar.tsx
[ws-copy]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/brief-copy/BriefCopyFlow.tsx
[ws-copy-editor]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/brief-copy/CopyEditor.tsx
[ws-copy-recovery]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/brief-copy/CopyRecovery.tsx
[ws-copy-history]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/brief-copy/CopyHistory.tsx
[ws-meri-host]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/app/meri/files/MeriFilesHost.tsx
[ws-meri-files]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/files/MeriFilesWorkflow.tsx
[ws-meri-access]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-documents/artifact-access.ts
[ws-meri-transport]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-documents/workflow-transport.ts
[ws-meri-config]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-actions/connection-config.ts
[ws-meri-unavailable]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-resources/unavailable.ts
[ws-meri-doc-owner]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/control/document-application/index.mjs
[ws-meri-preview-owner]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/control/document-application/preview-route.mjs
[ws-meri-runtime]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/runtime/artifacts/composition.mjs
[ws-meri-doc-readme]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/control/document-application/README.md
[ws-collaborators]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/collaborators/collaborators.controller.ts
[ws-comments]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/comments/comments.controller.ts
[ws-notifications]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/notifications/notifications.controller.ts
[ws-locks]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/edit-lock/edit-lock.controller.ts
[ws-context]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/context/context.controller.ts
[ws-checks]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/checks/checks.controller.ts
[ws-agent]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/document-agent/document-agent.controller.ts
[ws-intake]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/quick-draft/two-step-draft.controller.ts
[ws-worker]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/quick-draft/generation-run-worker.service.ts
[ws-cascade]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/cascade/cascade.controller.ts
[ws-exports]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/export/export.controller.ts
[ws-source-editorial]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/drafts/editorial-source.controller.ts
[ws-source-preparation]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/drafts/preparation-source.controller.ts
[ws-source-research]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/drafts/research-source.controller.ts
[ws-conversation-artifacts]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/conversation/ConversationArtifacts.tsx
[ws-fixture-doc]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/artifacts/DocumentWorkspaceScreen.tsx
[ws-fixture-comments]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/artifacts/DocumentComments.tsx



<a id="settings"></a>

## Settings wiring audit and implementation-ready closeout plan

As-of source inspection: 21 October 2026. Read-only audit; no repository, PR, deployment, account, provider, configuration, database, or live-state changes were made. The only output is this planning document.

### 1. Scope, evidence, and conclusion

The audit covers all 19 actual Settings route keys, all nested settings tabs and dialogs, the ordinary-user/admin/HQ distinctions, fixed operation contracts, the authenticated proxy, real Core/Onboard/Meri mounts, persistence/provider ownership, and receipt/refresh behavior. It also covers Settings integration entry, status, and connection controls; the separate mail audit owns detailed provider correctness.

Pinned sources:
- Frontend main: `4f9a7e8dcaa9ba03494dc5a49559daf70cea5100`.
- Core and Onboard backend-import: `309af848f1aa403f6c8e54aa0d22990d4230f063`.
- Meri main: `3c56c3e981ba868a2af103c4cae9f65a0d47458d`.
- Frontend [PR115](https://github.com/neo-capiro/capiro-frontend/pull/115): open draft, current inspected head `7fda299e2264d17a5a88c1dad50b08633ba862ae`. Its body is stale relative to the head. Owner-memory UI/proxy work here is not main or live activation.
- Core [PR104](https://github.com/neo-capiro/capiro-backend/pull/104): open draft, inspected head `5bf901173e839c0145069ec42e16dcb40c373ba6`. Supplemental backend cleanup, Directory pagination, Strategy raw ingress and outreach corrections do not establish Settings UI completion or live enablement.
- Do not recreate old frontend PR94 work: its earlier changes are already contained through the subsequent consolidation lineage (97/101/105/110).

#### Principal findings

1. Ordinary Settings is substantially source-wired. Personal title/signature, contact, branding, Profiles CRUD, team invitations/roles, billing handoffs, AI usage, HQ management, most analyst queues, and intelligence mappings have actual operations and mounted services. “Everything is a mock” would be wrong.
2. Source security issues need repair before broader activation: the generic branding update bypasses tenant-owned logo validation; team removal relies on the UI, not the server, to protect `capiro_admin` targets.
3. Preview read-only mode is deliberately not ordinary mode. Only `me.read` and the qualified roster `clients.list` path are available to these Settings screens. Most Settings requests must remain blocked. Profiles currently always requests `includeArchived:true`, which Core explicitly rejects in preview.
4. Personal Settings tells users to choose Profile in the top-right account menu, but the Settings header has only an Account settings link back to Personal. The actual Clerk UserButton exists in the Portfolio header, not this header.
5. All nine Memory Governance tabs, review notifications, grants editor, and memory files editor remain unavailable. Core has mounted APIs for much of this; the missing work is qualified contracts, UI consumers, permission/state handling, and activation, not wholesale backend invention.
6. Personal owner-memory review is separate, held PR115 work. It does not fill shared governance, grants, files, or notifications.
7. Only the separately enabled Meri personal-preferences slice is source-wired. It persists theme/density/timezone but previews appearance only inside its own panel. The other six preference tabs remain intentionally unavailable, and most designed personal defaults are not canonical fields.
8. Broadcast creation/list/detail/archive is wired, but recipient delivery and acknowledgement have no frontend consumer. Core already mounts the recipient APIs. The admin UI's “appears next time each person signs in” promise is therefore unfulfilled by this frontend.
9. HQ impersonation is correctly disabled because starting a session is not enough to bind all later requests to an audited scope. Managed-import status, Provision→PE review, and SAM review also remain unavailable.
10. Numerous remaining form mutations lack the pending-draft/lifecycle discipline already implemented in selected newer dialogs. They must not report cancellation as reversal or encourage blind resubmission after an uncertain write.

#### Status vocabulary

- **MAIN**: implementation traced in current main/source, including fixed transport and mounted handler.
- **GAP**: actual missing/incorrect connection, consumer, authorization, or outcome handling.
- **HELD**: implemented only in an open PR or explicitly held behind a qualification boundary.
- **CONFIG**: code exists but flags, credentials, URL/origin, storage, migrations, or worker readiness must be qualified.
- **EXTERNAL**: deliberately delegated to Clerk/Stripe/provider rather than an absent endpoint.
- **UNSUPPORTED**: designed/visible unavailable control with no qualified contract.
- **LIVE?**: deployment, provider behavior, applied schema, and real-user E2E remain unverified. MAIN never means live-tested.

No browser mutation or live API call was made. Findings about failure/security paths are source-supported, not claims of exploitation. Tests below are proposed work, not tests executed during this audit.

### 2. Common wire path and authority boundaries

#### Ordinary Settings

Browser component → registered operation name → schema-validated `api.request` → Next `/api/capiro/[operation]` → server-acquired Clerk token and method/origin/request checks → configured service base URL → mounted Core or Onboard controller → service-owned persistence/provider call → response schema → notice and query reload.

The gateway is a fixed-operation adapter, not an arbitrary URL/method/tenant tunnel. Ordinary Core calls use the Capiro Clerk token template; any operation requiring another auth mode must explicitly select it. UI role hiding is convenience, not authorization. Core's middleware derives current tenant membership from authenticated claims/current membership, and RolesGuard uses fail-closed minimum-role checks. HQ cross-tenant operations are purpose-specific `capiro_admin` handlers, not permission for arbitrary client-controlled tenant headers. [Gateway][st-gateway], [route][st-gateway-route], [configuration][st-config], [tenant context][st-tenant-context], [role guard][st-roles].

Core AppModule actually imports Users, TenantAdmin, Branding, Clients, Billing, Memory, Intelligence, CapiroAdmin, AdminBroadcasts, ProgramElement, AcquisitionPersonnel, and AiUsage. Onboard AppModule imports BillingModule. Meri runtime explicitly routes its user-preferences paths to the composed feature or returns unavailable. This distinguishes repository files from mounted runtime behavior. [Core mounts][st-app-module], [Onboard mounts][st-onboard-app], [Meri route composition][st-preferences-runtime-route].

#### Preview

The read-only route accepts only its small fixed GET family, rejects identity/tenant override headers, and has no ordinary-service fallback. The three direct Core paths are `/me`, `/clients`, and a UUID-shaped `/clients/:id`; the generic operation adapter admits only `me.read` and `clients.list`. The proxy checks the qualified Core source and auth. Core independently rejects archived roster reads in this mode. Do not “fix Settings” by widening this trust boundary or turning preview into ordinary mode. [Read allowlist][st-preview], [proxy][st-preview-proxy], [Core roster rejection][st-core-preview].

#### Personal preferences

Settings app route independently gates `MERI_USER_PREFERENCES_ENABLED`. Its purpose-limited `/api/settings/user/read|save` proxy uses native authenticated identity, exact routes, same-origin/body constraints, and a Meri root-origin target. The UI binds a Core-resolved tenant/user owner; the Meri gate resolves current native membership and client access. It is not the general Capiro operation registry and must not accept browser-supplied owner identity as authority. Runtime requires explicit feature enablement, the conversation-membership port, borrowed persistence, and readiness of `meri_settings.user_preferences` and `meri_settings.settings_audit`. Writes are revisioned with audit persistence; uncertain outcomes are read back rather than replayed blindly. [Composition][st-settings-route], [proxy][st-preferences-proxy], [runtime][st-preferences-runtime], [service][st-preferences-service], [migration][st-preferences-migration].

### 3. Complete route inventory

Every row below is an actual key in the screen registry. `/settings/preferences` aliases `meri-preferences`; it is not an additional independent implementation. Unknown keys return an unavailable notice. [Registry][st-settings-screen], [access][st-settings-access], [navigation][st-settings-nav].

| # | Route key | Intended audience and actual nested surfaces | Overall source state |
|---|---|---|---|
| 1 | personal | Own profile/title, signature, account facts, account/security guidance, monitoring and Meri preference links | MAIN plus account opener GAP |
| 2 | contact-info | All ordinary members read; user_admin/capiro_admin edit organization/contact and two addresses | MAIN |
| 3 | branding | user_admin/capiro_admin; name and logo upload/preview | MAIN plus server asset-boundary GAP |
| 4 | team | user_admin/capiro_admin; Members and Pending invitations; invite/remove/role/billing controls | MAIN plus entitlement, paging, protected-target gaps |
| 5 | integrations | Own/provider account list, register, permissions, connect/reconnect, sync, realtime, disconnect | MAIN/CONFIG, provider gaps in mail plan |
| 6 | memory | Personal inbox entry, notifications, nine governance tabs, grants dialog, Firm/My files | GAP; owner entry HELD/CONFIG |
| 7 | meri-preferences | Personal defaults; Connections; Usage and limits; Skills and templates; Workspace updates; Privacy and retention; Help and shortcuts | Personal slice MAIN/CONFIG, remaining designed surfaces UNSUPPORTED |
| 8 | billing | capiro_admin or user_admin+billingAdmin; plan/payment/invoices/cancel/checkout dialogs | MAIN/EXTERNAL/CONFIG |
| 9 | ai-usage | user_admin/capiro_admin; 7/30/90 day summary, daily/workflow/model detail, masked provider credentials | MAIN |
| 10 | profiles | user_admin/capiro_admin; Active/Archived tabs, search, owner display, create/archive/restore | MAIN; preview incompatibility GAP |
| 11 | hq-tenants | capiro_admin only; tenant list/create/detail/resend/delete/disabled impersonation | MAIN plus held impersonation |
| 12 | hq-customers | capiro_admin only; billing customer metrics/filter, comp/uncomp, managed-import placeholder | MAIN plus unavailable imports |
| 13 | hq-ai-keys | capiro_admin only; tenant AI usage; manage credential/usage drawer; rotate/remove/model CAS | MAIN |
| 14 | hq-broadcasts | capiro_admin only; tenant/member targeting, preview/send, list/detail/ack metrics/archive | Admin MAIN; recipient consumer GAP |
| 15 | intelligence-mappings | user_admin/capiro_admin; filters, resolution, attach/review, contractor identity and bulk confirm | MAIN |
| 16 | hq-personnel | capiro_admin only; personnel merge queue | MAIN; shared with Analyst |
| 17 | hq-reconciliation | capiro_admin only; reconciliation queue, decisions and second approval | MAIN; shared with Analyst |
| 18 | hq-matches | capiro_admin only; PE→Program match review | MAIN; shared with Analyst |
| 19 | hq-analyst | capiro_admin only; Reconciliation, Program matches, Alias manager, Person candidates, Merge candidates, Quarantine, Audit log, Provision links, SAM | First seven MAIN; last two UNSUPPORTED |

HQ Tenants, Personnel merge queue, and AI Keys & Usage additionally share a three-tab strip. This is route navigation, not three separate backends. [Tenant tabs][st-tenant-tabs].

### 4. Exhaustive action-family inventory

“Reload” below means the current code calls its query reload after a successful parsed result; it does not prove the provider action finished or the response identifies the right target. Remaining lifecycle/receipt checks are ST-24.

#### 4.1 Personal, signature, contact, branding, Profiles

| Surface/action | Actual chain, persistence, and feedback | Classification / closeout |
|---|---|---|
| Personal title edit + Save | `me.update` → PATCH `/me` → own user title, trimmed/null normalization → me query reload and saved notice. Text limit 120. | MAIN; freeze edited value while pending under ST-24. [Personal][st-personal], [Users][st-users] |
| Read account user ID/workspace/role | `me.read` → GET `/me`, current authenticated tenant/member projection | MAIN; these are intentionally read-only. |
| Email/password/2FA/Profile instructions | Text directs to top-right menu → Settings header links back to Personal, does not open Clerk profile | GAP ST-04; Clerk backend itself is EXTERNAL. |
| Monitoring setup link | Link to `/modules/legiwatch` | Navigation MAIN; preserve selected client scope ST-28. |
| Meri preferences link | Link to `/settings/meri-preferences` | Navigation MAIN; personal persistence separately gated. |
| Signature load; enabled/append-default switch; rich editor | GET `/me/email-signature`; HTML and boolean stored on own user; bold/italic/underline, headings, lists, link/image insertion, clear-formatting are local editor actions | MAIN, not no-ops. [Signature][st-signature], [editor][st-signature-editor] |
| Signature upload/browse/drop and sandbox preview | PNG/JPG/GIF/WEBP or HTML/HTM read locally; image limit 12 MB; large signature character bound; CSP sandboxed preview; no separate object-storage upload | MAIN local preparation. Do not invent a missing upload endpoint. |
| Signature Cancel and Save | Cancel resets local draft; PUT `/me/email-signature` sanitizes server-side; reloads authoritative HTML. Engagement sends append sanitized sender signature according to stored default or explicit override | MAIN end-to-end consume, not dangling preference. File/drop/switch pending freeze ST-24. [Consumption][st-signature-send] |
| Organization/contact read, edit, Save | GET/PUT `/tenant-admin/contact-info`; name/email/phone; mailing and permanent street1/street2/city/stateZip; `tenant.settings.contactInfo` persisted and refreshed | MAIN. Standard user read only; server admin write. [Contact][st-contact], [service][st-tenant-service] |
| Branding name edit + Save | PUT `/tenant-admin/branding` → tenant name; best-effort Clerk organization name mirror; local query reload | MAIN; silent provider divergence ST-27. |
| Logo select/upload/preview | Presigned ticket → browser S3 POST → server confirm → tenant logo key/content type/uploaded timestamp → signed preview URL; 2MB PNG/JPEG/SVG/WEBP | MAIN/CONFIG; authoritative boundary defect ST-01. No remove/reset control exists to wire. [Branding][st-branding], [upload transport][st-uploads], [Core][st-branding-core] |
| Profiles Active/Archived tabs and text search | Both tabs derive from one `clients.list` with `includeArchived:true`; local filtering; owner info from `/client-account-owners` | MAIN ordinary; GAP preview ST-03. Owner error has separate retry, rather than fabricating owner data. |
| Profile row navigation/owner display | Profile links use returned IDs; owner service excludes archived/inaccessible ownership scopes | MAIN; preserve scope testing. [Profiles][st-profiles], [owner service][st-account-owners] |
| Add profile dialog; Create; Cancel/Close | POST `/clients` name/optional website/description; creates tenant client under server capacity/permissions; reloads list and owners | MAIN. Busy-close protection exists, but input freeze/unknown result tests remain ST-24. |
| Archive profile confirmation | DELETE `/clients/:id` soft-archives; UI requires returned ID and archived status, reloads both queries | MAIN, not irreversible delete. |
| Restore profile | PUT `/clients/:id` with status active; validates returned ID/status; capacity enforced server-side | MAIN. [Profile contracts][st-profile-operations], [client controller][st-clients], [service][st-clients-service] |

#### 4.2 Team and permissions

| Action | Actual chain and authority | State / work |
|---|---|---|
| Members tab/list | GET `/tenant-admin/team`, includes active/invited/removed statuses, role, billing bit, joined and last-seen facts | MAIN; not an active-only list. |
| Pending invitations tab/list | GET `/tenant-admin/team/invitations` → Clerk organization invitation list → local response projection | MAIN first-page implementation; complete enumeration ST-06. |
| Add team member | Name/email + user_admin or standard_user → POST invite → normalized email, active-member check, revoke matching pending invite, Clerk invitation with tenant/name metadata and redirect | MAIN; newer invite dialog pending freeze already present. Acceptance creates real user through webhook/self-heal, not a fake pending user row. |
| Resend invitation | POST invitation ID/resend → find current tenant invitation → revoke old → create fresh → refresh pending list | MAIN; pagination and lost metadata ST-06. |
| Change member role | PUT member/role → server blocks self, inactive target, capiro_admin target → Clerk provisioning + local member state | MAIN. UI currently exposes selector on inactive targets, ST-05. |
| Toggle billing administrator | PUT member/billing-admin → caller must capiro_admin or active billing admin; target active; granting only user_admin → persist membership bit, refresh | MAIN backend, GAP UI eligibility ST-05. This is not a license for every user_admin to delegate billing. |
| Remove member confirmation | DELETE member → self guard; local membership removed + durable Clerk deletion outbox in one transaction; immediate best-effort attempt after commit; refresh | MAIN removal/outbox, P0 missing privileged-target guard ST-02. Local access revocation does not wait for Clerk completion. |
| Self/capiro restrictions in UI | Own role rendered badge; own/capiro remove hidden; billing disabled for own/capiro rows | MAIN presentation only. Server must enforce independently. |
| Tenant audit history | Fixed `settings.auditLogs` exists with GET `/tenant-admin/audit-logs`; server redacts internal actor/request/before/after detail | API-only, no ordinary Settings route/control. Decide discoverability ST-29; do not reuse unrestricted HQ audit DTO. |

Evidence: [Team UI][st-team], [invite][st-invite], [Core controller][st-tenant-controller], [Core service][st-tenant-service], [fixed operations][st-operations].

#### 4.3 Integrations, billing, AI usage

| Action | Actual chain and output | State / boundary |
|---|---|---|
| Integration list/register | GET/POST `/engagement/integrations`; provider and account details; RegisterAccount dialog; query refresh | MAIN. Account registration is not OAuth authorization. |
| Provider capabilities and permissions dialog | Microsoft and Google capabilities endpoints; connection permission/status metadata displayed | MAIN/CONFIG; requested-versus-granted accuracy owned by mail closeout. |
| Connect/reconnect Microsoft and Google | Fixed provider start operation → returned OAuth URL → allowlisted external navigation; provider callback required to finish | MAIN/CONFIG/EXTERNAL; return notice/session/account binding tests in mail plan. |
| Sync now | Fixed Google/Microsoft sync; returned connection ID must match; failed results are not shown as success; refresh | MAIN with provider error/partial-health limitations in mail plan. |
| Microsoft Realtime | Explicit subscriptions action; no Google push-equivalent button | MAIN/CONFIG; Google periodic sync already exists. Do not invent Gmail push as missing ordinary sync. |
| Disconnect | Provider-specific DELETE with confirmation and matched receipt; refresh | MAIN for supported states/providers; mail plan covers error-state recoverability. |
| IMAP/CalDAV | Registration allowed, but OAuth/manual sync/disconnect explicitly unavailable | UNSUPPORTED contract, not a silently working provider. Product support decision belongs to ML plan. |
| Billing state and summary | Core GET `/billing/state` + `/billing/summary`, authoritative guard, status/capacity/period/usage/cost data | MAIN; mismatch/disabled state fails closed. |
| Start subscription | Quantity/promo dialog → reread state+summary → Onboard POST `/billing/checkout` → hosted Stripe URL | MAIN/EXTERNAL/CONFIG. Quantity minimum10. No card entry stored by frontend. |
| Add profiles on existing subscription | Reread billing state → Onboard portal session → Stripe portal | MAIN/EXTERNAL. Ordinary client creation is separate. |
| Update payment method / View invoices | Same portal handoff | MAIN/EXTERNAL, not in-app payment/invoice DTOs. |
| Cancel plan / confirm dialog | Opens hosted cancellation settings, does not itself claim subscription cancelled | MAIN/EXTERNAL. No in-app exit survey or contract-window workflow. |
| Billing failure/locked/cancelled notices | Derived from server state; only allowed hosted actions enabled | MAIN. Actual Stripe portal configuration and webhook convergence unverified ST-25. |
| AI usage 7/30/90 days | GET `/ai-usage/summary`, date windows, totals/daily/workflow/model detail | MAIN; provider/metering freshness LIVE?. |
| Masked provider credential summary | GET `/ai-usage/credential`; contact manager rather than ordinary-user secret editing | MAIN intentional role boundary. |
| Raw AI usage events | Registered GET `/ai-usage/events`, no exposed Settings control | API-only, not a broken visible button. |

Evidence: [Integrations][st-integration], [registration][st-register], [provider policy][st-providers], [Billing UI][st-billing], [billing flow][st-billing-flow], [Core billing][st-billing-core], [billing guard][st-billing-guard], [Onboard controller][st-onboard], [Stripe writer][st-onboard-service], [usage UI][st-usage], [usage controller][st-usage-core].

#### 4.4 Memory, every nested surface

| Surface/action | Actual source | Required closeout |
|---|---|---|
| Personal Memory Review Inbox link | Rendered only if MERI_MEMORY_OWNER_REVIEW_ENABLED; points `/meri/memory` | Main entry exists but complete route/proxy is held PR115; ST-11. |
| Review notifications and Mark all read | No query; disabled action; unavailable text | Core review notifications/list/unread/read-one/read-all exists; ST-10. |
| Governance Overview | Tab only, generic unavailable text | Qualified overview/read model ST-07. |
| Active | Tab only | Qualified item bucket/detail and allowed actions ST-07. |
| Pending review | Tab only | Pending item/candidate/request semantics ST-07, not owner-only inbox. |
| Conflicts | Tab only | Conflict detail and resolve permission/state ST-07. |
| Review due | Tab only | Review-due/item workflow ST-07. |
| History | Tab only | Define authoritative version/item history projection before rendering ST-07. |
| Access grants | Disabled client selector, empty table; Add grant opens inert dialog | Core grants/list/create/revoke + permissions exists; ST-08. |
| Transition history | Tab only | Existing governance transitions read contract ST-07. |
| Projection health | Tab only | Existing health/jobs/retry authority ST-07. |
| Grant dialog | Active-member user ID, Read/Read+Propose, reason, expiry fields all disabled; Submit disabled; Cancel/Close local | ST-08; never assume granting equals bypassing client walls or admin policy. |
| Memory files Firm/My files | Only local tab switch | Core catalog/items/sections and governed submission exist; ST-09. |
| Who we are / Positioning | Disabled textareas on both tabs; no load | Scope-correct document load/editor ST-09; personal must not incorrectly reuse firm copy. |
| Submit for review | Disabled; no command/receipt | Review-readiness gate and pending-not-active receipt ST-09. |
| Active clients | Explanatory copy only, no derived list | Tenant/current-client scoped source and memory projection status ST-09. |

Core mounts are present in MemoryModule. Governance controller is admin-only; ordinary own-memory and notifications are not equivalent to tenant admin authority. Shared Settings readiness explicitly requires review + lifecycle + authorization, checks eligible approvers, and leaves active memory unchanged while pending. Current policy permits admin self-approval where the server says so; do not impose a blanket two-person rule copied from PE reconciliation. [Memory UI][st-memory], [module][st-memory-module], [governance][st-governance-core], [general memory][st-memory-core], [review APIs][st-review-core], [readiness][st-review-readiness], [gates][st-governance-switch].

#### 4.5 Meri preferences, every nested tab and control

| Tab/action | Actual implementation | Status |
|---|---|---|
| Personal defaults when enabled | UserPreferencesHost read/save; theme System/Light/Dark, density Comfortable/Compact, canonical IANA timezone/null; revision, conflict/readback/access-loss behavior | MAIN/CONFIG. Theme/density preview only this panel, not whole app. ST-12. |
| Writing style / Default scope / Artifact template | Designed unavailable fields; not fields in current canonical preference document | UNSUPPORTED ST-13. |
| Appearance when disabled | Local Light/Dark/System preview only, explicitly not persistent | Intentional local behavior, not save implementation. |
| Reduced motion / Keyboard navigation | Designed disabled fields | UNSUPPORTED ST-13. |
| Keyboard shortcuts / Templates and skills links | Designed link records without live destinations in unavailable view | UNSUPPORTED navigation ST-13/16/19. |
| Clear personal defaults confirmation | Designed reset/confirm controls unavailable | UNSUPPORTED ST-13; must use revisioned write, not local fake reset. |
| Connections table | Static unavailable row, no selected provider/account | UNSUPPORTED ST-14; separate from Capiro Integrations until authority equivalence qualified. |
| Reconnect / source coverage / Disconnect confirmation | Disabled or no href | UNSUPPORTED ST-14. |
| Usage and limits metrics + Run usage | “—” and unavailable data; designed near-limit/budget/concurrency examples | UNSUPPORTED ST-15; examples are not actual usage. |
| Workspace model/budget/concurrency/deadline | Read-only unavailable policy fields; no admin editor wired | UNSUPPORTED ST-15. |
| View run queue | No href/consumer | UNSUPPORTED ST-15. |
| Skills: Research brief, Spreadsheet analysis, Client update deck | Static cards; each Use skill button disabled | UNSUPPORTED ST-16. |
| Approved templates / Attach a permitted template | Placeholder row; attachment disabled | UNSUPPORTED ST-16. |
| Workspace updates | Run outcomes/decisions/connection-change preference fields unavailable | UNSUPPORTED ST-17. |
| Preview Updates / Open profile menu | Disabled, headerOverlays false; account/workspace fields unavailable | UNSUPPORTED ST-17; share account opener ST-04. |
| Empty updates message | Static “You are all caught up” illustrative state, not query-backed | Honest unavailable-state correction ST-17. |
| Privacy retention table | Placeholder policy rows for conversations/events, uploads/browser state, previews/artifact versions, filed records/receipts | UNSUPPORTED ST-18; policy must remain server-owned. |
| Request export / Request deletion / confirmations | Disabled; no runtime request or durable receipt | UNSUPPORTED ST-18; legal-hold/retained-record constraints cannot be bypassed. |
| View retention states | No href | UNSUPPORTED ST-18. |
| Help supported work + shortcut list | Static designed content; not proof each shortcut is registered | Informational only; verification ST-19. |
| Report summary/details / include run reference / run reference / Submit | Local draft scaffolding, controls unavailable, Submit disabled | UNSUPPORTED ST-19. |
| “Report submitted” notice | Unconditionally rendered designed receipt callout despite no submission | Actual misleading presentation GAP ST-19. |

Canonical current user-preference fields are only theme, density, timezone, notifications (runCompleted/approvalRequested/memoryReviewed), and defaultClientId. UI exposes the first three and deliberately preserves the others. Saved notification bits do not prove a delivery consumer, and defaultClientId is not a general scope-authority grant. [Panel][st-preferences], [form][st-preferences-form], [host][st-preferences-host], [canonical document][st-preferences-document], [unavailable workspace model][st-unavailable-workspace], [unavailable account model][st-unavailable-account], [personal][st-preference-personal], [connections][st-preference-connections], [usage][st-preference-usage], [skills][st-preference-skills], [updates][st-preference-updates], [privacy][st-preference-privacy], [help][st-preference-help].

#### 4.6 HQ tenant/customer/AI/broadcast actions

| Action | Actual chain, storage/provider and feedback | Status |
|---|---|---|
| Tenant list; detail drawer; member facts | Core `/capiro-admin/tenants` and `/:tenantId`; HQ-only, explicit target | MAIN. |
| Create tenant + invite first admin | Name/slug/admin name/email → Core create → tenant+Clerk org/admin invitation orchestration → list refresh | MAIN; lifecycle/partial provider receipt tests ST-24/26. |
| Resend admin invitation | Target tenant+email → Core admins/resend → Clerk → detail refresh | MAIN; qualified invitation redirect and paging tests. |
| Permanently delete tenant | Typed DELETE, current tenant disabled → HQ DELETE → server cleanup/audit/provider lifecycle | MAIN dangerous admin action; test only isolated fixture. UI confirmation is not substitute for server checks. |
| Start impersonation + reason | Both disabled; explicit missing audited subsequent-request binding notice | HELD/UNSUPPORTED ST-21, not absence of Core session routes. |
| Customer list metrics/filter | Core `/capiro-admin/billing/customers`; local status filter; capacity/MRR/overage | MAIN. |
| Comp/Uncomp | Confirmation → Onboard `/admin/billing/tenants/:id/comp` → tenant billing status plus onboard billing event; refresh | MAIN; only Onboard is billing writer. Uncomp returns none, not automatic previous subscription restoration. |
| Managed client import status | Placeholder notice; no queue query/command | UNSUPPORTED ST-22. |
| Cross-tenant AI usage 7/30/90 | Core HQ summary → tenant rows → drawer | MAIN. |
| Tenant key/usage drawer | Separate tenant usage and masked credential queries; provider OpenAI/Anthropic | MAIN. |
| Validate & save key / rotate | Write-only secret field, optional model → Core credential store validation+encryption → secret cleared, reload | MAIN/CONFIG; not ordinary-user preference. Never return or log plaintext. |
| Remove credential confirmation | Exact provider+tenant DELETE → credential removal/audit → reload | MAIN; uncertainty and stale target ST-24. |
| OpenAI model switch/restore default | Dedicated mutation with expectedModelOverride and expectedUpdatedAt CAS | MAIN; preserve CAS rather than generic overwrite. |
| Broadcast choose tenant/audience/members | HQ tenants + active-member list; all_users or selected_users; tenant change clears selected IDs/confirm/detail | MAIN. |
| Compose title/body, preview, Send now | Core creates broadcast+recipient rows and audit; reload; admin UI says delivery next sign-in until ack | Admin MAIN, delivery promise GAP ST-20. |
| Sent list / details / acknowledgement percent | Core list/detail recipient and ack data | MAIN read; depends on missing recipient consumer for actual acknowledgements. |
| Archive broadcast confirmation | Core marks archived and audits; refresh | MAIN; archived messages excluded from recipient pending reads. |

Evidence: [Tenants][st-tenants], [dialogs][st-tenant-dialogs], [customers][st-customers], [AI keys][st-ai-keys], [broadcasts][st-broadcasts], [details][st-broadcast-detail], [HQ operations][st-hq-operations], [HQ controller][st-hq-controller], [HQ service][st-hq-service], [broadcast service][st-broadcast-service], [recipient routes][st-broadcast-recipient].

#### 4.7 Analyst console and intelligence mappings

| Nested family/control | Actual chain and outcome | Status |
|---|---|---|
| Pipeline counts + Refresh counts | Core `/capiro-admin/review-counts`; includes counts for provision queue even though its panel is unavailable | MAIN counts, not evidence provision review is wired. |
| Reconciliation status filter/page | open/pending_approval/resolved, 25/page → Core reconciliation queue | MAIN. |
| Keep / Accept conflicting / Manual value+notes | Resolve endpoint returns resolved or pendingApproval; UI explicitly says canonical value unchanged while pending | MAIN with accurate pending semantics. |
| Approve pending reconciliation | Separate approval endpoint; second-admin policy owned server-side | MAIN; actor/state/race tests required. |
| Program matches | candidate/quarantined/accepted/rejected filter, page25, evidence dialog, notes, accept/quarantine/reject | MAIN; backend state transition must remain authoritative. |
| Alias manager | Search programs (limit100), select program, list aliases, add/edit/delete alias; type/source, immutable source on edit | MAIN. |
| Duplicate alias detector; Merge programs | Detect duplicates; select keep and merge programs; confirmation and canonical merge mutation | MAIN; exact target/receipt and destructive lifecycle tests. |
| Person candidates | Candidate page25; confirm/reject and refresh | MAIN. |
| Personnel merge queue | Open page10; A/B comparison, merge/keep_separate/reject_a/reject_b, notes, confirmation | MAIN; reused by hq-personnel. |
| Quarantine | Type program_element/acquisition_personnel; source filter, page; raw viewer; reprocess or discard | MAIN. Reprocess can legitimately remain quarantined with reason; do not translate every 2xx into accepted. |
| Analyst audit log | Action/entity filters, paging, detail before/after/actor | MAIN HQ-authorized view; not tenant-safe audit projection. |
| Provision→PE links | Tab/count but unavailable panel, no qualified screen queue/action contracts | UNSUPPORTED ST-23. |
| SAM matches | Unavailable panel, no qualified screen queue/action contracts | UNSUPPORTED ST-23. |
| Mappings list/filter/search | Core `/intelligence/mappings`, clients; local client/source/match-basis/status/search filters | MAIN; these operations target Core, not the separately named Intelligence API service. |
| Find exact contractor identifiers | POST `/intelligence/mappings/match-contractor-identifiers`; actual created/autoConfirmed/needsReview result | MAIN. |
| Resolve all / per-client resolve | Core resolution endpoints; return counts and refresh | MAIN; do not infer confirmed when only needsReview. |
| Individual review confirm/reject | PATCH mapping, or reject-candidate command with reason/target | MAIN. |
| Manual attach dialog | Client/source selection; source search; select record; attach; contractor/assistance require relationship and explicit rollup choice | MAIN. Five actual source searches: LDA clients, FEC employers, FEC committees, contractors, assistance recipients. |
| Contractor identity drawer | Candidate search/view, confirm existing/manual attach/reject, awards footprint | MAIN. Preserve exact self/alias/former_name/parent/subsidiary/operating_unit relationship semantics. |
| Confirm all ≥60% | Only currently filtered eligible candidate records; permitted sources lda/fec_employer/sec/fara/lobby_intel; excludes contractor/assistance/PAC; sequential individual writes, partial count on error | MAIN, but loop continues dispatch after unmount unless explicitly stopped; ST-24. Not an atomic batch. |

Evidence: [Analyst][st-analyst], [reconciliation][st-reconciliation], [matches][st-program-match], [aliases][st-aliases], [program merge][st-merge-programs], [people/merges][st-people], [audit/quarantine][st-audit-quarantine], [program controller][st-program-controller], [PE controller][st-pe-controller], [personnel controller][st-personnel-controller], [mapping UI][st-mappings], [individual review][st-mapping-review], [attach][st-mapping-attach], [contractor][st-mapping-contractor], [source search][st-mapping-source], [bulk eligibility][st-mapping-bulk], [fixed mapping contract][st-mapping-operations], [Core intelligence controller][st-intelligence-controller].

### 5. Numbered closeout backlog

Severity: P0 = security/authority or data-integrity pre-activation blocker; P1 = major advertised workflow blocked or release qualification required; P2 = bounded correctness, completeness, recovery, or designed feature gap. P0 ST-01 and ST-02 block broader activation. A P1 “held” feature is not an instruction to enable it before its gates qualify. All work below is proposed, not executed.

<a id="st-01"></a>

#### ST-01 — Close the branding object-ownership bypass (P0, MAIN defect, pre-activation blocker)

**Evidence/root cause.** The generic PUT branding DTO and fixed frontend operation allow arbitrary logoS3Key/logoContentType. TenantAdminService writes them without the prefix/HEAD checks enforced by the dedicated confirm path. Branding GET later signs the stored key with shared bucket credentials. This is an exposed API boundary issue even though the current name form sends only name. Additionally confirm HEAD checks existence but not returned ContentType/ContentLength despite its comment. [Frontend contract][st-operations], [generic update, L381–400][st-tenant-service], [signing/finalization][st-branding-core], [DTO][st-tenant-controller].

**Bounded tasks.** Narrow generic branding update to name (or route every logo field through the same authoritative finalizer if backward compatibility requires it). Reject cross-tenant/nonbranding keys at both write and signed-read boundaries. Validate actual HEAD type/size against allowed values and configured limits; use an exact tenant-owned upload object, not an unverified client assertion. Keep existing presigned POST flow; no new storage architecture. Review existing persisted keys in a separately authorized operational step before exposing suspect keys.

**Dependencies/tests.** Core and FE operation change together; ASSETS_BUCKET/IAM/CORS qualification. Direct API tests with another tenant's key, arbitrary same-bucket object, omitted/false MIME, oversize HEAD, missing object, stale upload, and corrupted existing row must refuse and never produce a signed foreign-object URL. Legitimate own-tenant upload/name save still works. No live exploit test was performed.

<a id="st-02"></a>

#### ST-02 — Enforce protected-member removal server-side (P0, MAIN defect, pre-activation blocker)

**Evidence/root cause.** Controller minimum role is user_admin. removeMember blocks self but not a target capiro_admin before marking membership removed and queuing Clerk deletion. Adjacent role-change code does reject capiro_admin; UI hides Remove, but API callers can bypass that. The issue is within the actor's tenant, not demonstrated cross-tenant access. [Controller L160–195][st-tenant-controller], [service L300–363][st-tenant-service], [UI L218–225][st-team].

**Tasks.** Define the existing intended protected-target rule explicitly and enforce it inside the removal transaction before any local state/outbox mutation. Use HQ's distinct authorized personnel lifecycle for any intentional staff removal. Preserve immediate local revocation plus durable outbox for allowed ordinary targets.

**Tests.** user_admin→capiro_admin target denied with unchanged membership and no outbox; self denied; standard user denied; foreign-tenant ID absent/denied; ordinary active target removed and old access refused even if Clerk fails; retry idempotency; explicit HQ path authorized only as designed.

<a id="st-03"></a>

#### ST-03 — Make Settings honest and usable in read-only preview (P1, CONFIG + concrete query defect)

**Evidence/root cause.** Generic preview admits only me.read and clients.list. Profiles always asks includeArchived:true, rejected by Core preview with 400; proxy failure mapping can surface a generic unavailable/502 rather than explaining the policy. [Allowlist][st-preview], [Core guard][st-core-preview], [Profiles][st-profiles], [proxy][st-preview-proxy].

**Tasks.** Expose a server-owned mode/capability to Settings, not a browser-controlled bypass. In preview render available identity and active roster with includeArchived:false/omitted; disable or omit Archived/owner-admin controls if their reads are not admitted. Mark other sections read-only-unavailable without sending known-forbidden operations on entry. Preserve explicit ordinary-mode behavior. If archived or additional Settings reads are truly required, qualify one bounded native-read contract at a time before any allowlist change.

**Tests.** Preview no writes/no ordinary fallback/no tenant headers; Profiles requests permitted shape and renders active rows; archived unavailable explanation; ordinary archived/create/restore unchanged; 401/403/source mismatch not fabricated as empty data. Test actual blocked-versus-upstream-error distinction.

<a id="st-04"></a>

#### ST-04 — Add a real account-profile/security opener (P2, MAIN UI gap; Clerk EXTERNAL)

**Evidence/root cause.** Personal instructions promise Profile from top-right menu; ModuleHeader only routes to Personal. PortfolioHeaderActions already renders Clerk UserButton. [Personal][st-personal], [Settings header][st-module-header], [working Portfolio control][st-portfolio-header].

**Tasks.** Reuse the existing Clerk account control or explicit supported profile opener in Settings header/Personal, with a real keyboard-accessible target. Keep name/email/password/MFA authority with Clerk. If this surface intentionally will not host it, link to an actual supported account surface and change the copy; do not leave circular instructions.

**Tests.** Signed-in user opens own Clerk profile from Settings, edits only supported Clerk fields, closes/returns correctly; unauthenticated/loading states; keyboard/focus; no client/tenant context leakage into provider identity.

<a id="st-05"></a>

#### ST-05 — Align Team controls with effective permissions and member states (P2, MAIN UI gap)

**Evidence/root cause.** UI billing switch checks busy/self/capiro only, while backend additionally requires caller billingAdmin and target active user_admin for grants. Role selector remains enabled on inactive memberships. [Team L122–187][st-team], [service L162–195/L346–378][st-tenant-service].

**Tasks.** Derive canChangeRole/canGrantBilling/canRevokeBilling/canRemove per row and caller, preserving server checks. Show explanatory disabled labels for inactive targets and nonbilling admins. Refresh me/permissions after relevant membership changes; handle authority lost between render and dispatch. Do not add a “last billing admin” rule that contradicts existing policy, which allows HQ recovery.

**Tests.** Role×billingAdmin×target-role×status matrix; direct API denial remains; active user_admin grants/revokes; demotion behavior reconciles billing permission; self/staff protections; revoked actor cannot continue via stale UI.

<a id="st-06"></a>

#### ST-06 — Complete invitation enumeration and preserve resend identity (P2, MAIN backend completeness)

**Evidence/root cause.** Pending list and resend lookup call one Clerk invitation-list page without paging. Dedup revoke requests only one page with limit100. Resend recreates email/role/redirect but omits original publicMetadata carried by initial invite (tenant and name fields). [Service L198–297/L448–466][st-tenant-service].

**Tasks.** Implement bounded provider pagination or explicit paginated UI/API contracts using real provider cursors/offsets; ensure resend/dedup can find an authorized target beyond page one. Preserve safe intended invitation metadata across resend; retain tenant binding from verified org/current target. Return enough result to refresh the exact replaced invitation. Keep redirect validation/config separate from list completeness.

**Tests.** More than one provider page; target beyond100; empty pages with continuation; duplicate pending email; expired/revoked invitation; resend metadata/name preservation; cross-org ID denied; partial revoke/create failure gives recoverable truthful state; invitation acceptance results in real user/member without placeholder UUID collisions.

<a id="st-07"></a>

#### ST-07 — Wire shared Memory Governance Center (P1, missing consumer/contract; Core exists)

**Evidence/root cause.** Nine UI tabs are local state only. Mounted Core governance supports overview, bucket/items/detail, transitions, projection-health, clients, approve/confirm/mark-stale/revoke/second-approve and projection-job retry. Related memory/review APIs support conflict/review workflows. [UI][st-memory], [controller][st-governance-core], [memory controller][st-memory-core].

**Tasks.** Add purpose-limited fixed operations with DTOs pinned to public Core results; implement each of Overview/Active/Pending/Conflicts/Review due/History/Transition history/Projection health using its correct source. Qualify history semantics rather than inventing a generic history endpoint. Add only server-permitted contextual actions and reason/confirmation/expected-state inputs. Render role and lifecycle availability from authoritative readiness; don't show admin governance to standard users merely because Memory route itself is public. Show pending/reviewed/projection-pending as different states and refresh affected item/count/history/health views.

**Dependencies/tests.** Existing memory migrations and lifecycle/enforcement/center gates, correct tenant allowlisting, eligible reviewers, wall-aware reads, notification/projection workers. Test empty versus unavailable, every bucket, pagination/limits, wrong tenant/client, removed member, stale candidate, duplicate decision, permitted self-approval versus explicit second approval, projection retry lease/state. No automatic flag enablement with code merge.

<a id="st-08"></a>

#### ST-08 — Wire memory access grants without bypassing walls (P1, missing consumer/contract)

**Evidence.** Add grant opens an inert form. Core exposes permissions catalog and client grants list/create/revoke with lifecycle/role checks. [UI L87–123/L163–200][st-memory], [Core L389–434][st-memory-core].

**Tasks.** Populate visible clients and active tenant member picker using qualified current access; load grants; render effective permissions/status/expiry/reason. Submit exact client/user/permission/reason/expiry and show authoritative grant; add revoke action to actual grant rows. Distinguish expired/revoked/inherited policy. Gate editing by current admin capability; do not expose raw foreign user IDs or treat a grant as overriding all confidentiality rules.

**Tests.** Foreign client/user, removed member, forbidden permission, expiry in past, max reason, duplicate grant, expired grant, revoke idempotency, stale membership after dialog open, denied-wall read. Verify no UI success until server receipt and list reconciliation.

<a id="st-09"></a>

#### ST-09 — Wire Firm/My files and governed submission (P1, missing consumer/contract)

**Evidence.** Tabs, Who we are/Positioning and Submit are placeholders; catalog/items/sections/update plus Settings review-readiness service exist. [Memory UI][st-memory], [Core sections L150–283][st-memory-core], [readiness][st-review-readiness].

**Tasks.** Map Firm and My files to authoritative scope/type/slug, load sections and metadata, support revision-safe drafts and cancel, map Who we are/Positioning to real section keys, and display active clients from permitted canonical clients rather than editing them as free text. For firm/client changes use existing review submission protocol, eligible approver and reviewer summary. Personal writes follow owner-only policy, not the shared admin path. Receipt must say pending candidate with active memory unchanged until accepted; link to appropriate review item. Preserve source/type/version lineage.

**Tests.** Read-only member vs editor; private personal data never visible to another member/admin by default; absent/not-ready reviewers refuses before candidate creation; stale version conflict; duplicate submit; active content unchanged while pending; approved content and projection eventually reflect exact version; reject/cancel does not erase active memory.

<a id="st-10"></a>

#### ST-10 — Connect Memory review notifications (P2, missing consumer)

**Evidence.** UI has no notification query and disabled Mark all read; Core has list/unread-count/read-one/read-all. [UI][st-memory], [review controller][st-review-core].

**Tasks.** Add fixed notification read/ack operations, unread badge/list/detail navigation, Mark all read and individual read with exact current-owner scope. Use real empty state only after successful load, preserve unread on failed ack, and reload count/list after receipt. Reuse delivery/outbox semantics, do not call client UI “delivery” merely because a row exists.

**Tests.** Pagination, zero/unavailable, cross-owner notification ID, role revocation, duplicate ack, stale list, partial delivery/redaction, notification links to a now-inaccessible memory safely withheld.

<a id="st-11"></a>

#### ST-11 — Finish and qualify PR115 owner-memory slice without conflating it with governance (P1, HELD + CONFIG)

**Evidence.** Current PR115 contains owner inbox/status/decision/version decision/items/corrections and strict server proxies. Its preview source is deliberately null until a compatible Core public wire packet is admitted. Main has only the gated link. [Owner UI][st-pr115-inbox], [proxy][st-pr115-owner-proxy], [preview boundary][st-pr115-owner-route], [source gate][st-pr115-preview-config], [Core owner items][st-owner-core].

**Tasks.** Review current head rather than stale PR body; finish contract/public DTO parity and tests, then separately approve merge. For ordinary mode qualify exact /api Core base and native owner authority. For preview retain two gates and explicit source/target qualification; never make env alone defeat null source. Validate owner candidate list/status, accept/reject, version decision, correction with expectedUpdatedAt, and uncertain-dispatch readback. Preserve activeItemUnchanged/pending correction semantics.

**Tests.** Own vs other owner, tenant switch, status before/after immutable decision, stale version, six-digit timestamp behavior, held/unavailable produces no dispatch, write timeout distinguishes not-dispatched from unknown, correction cannot overwrite active item. Merge, deployment, flag enablement, and live certification are four separate receipts.

<a id="st-12"></a>

#### ST-12 — Qualify personal-preference persistence and deliberate consumption (P2, MAIN/CONFIG, effect gap)

**Evidence.** Current source composes revisioned save/read but panel explicitly previews theme/density only locally; notification/default-client values preserved but not edited. [Form][st-preferences-form], [host][st-preferences-host], [runtime][st-preferences-runtime], [document][st-preferences-document].

**Tasks.** Qualify FE flag/base URL/native token + Meri enabled flag/membership/persistence readiness together. Decide intended effect: keep explicitly panel-only preview, or bind validated saved theme/density/timezone into the existing application shell/time formatting at current-owner scope. Do not write global preference effect speculatively. Add notification/default-client controls only when a consuming surface is qualified; preserve current document fields and CAS.

**Tests.** Initial default, reload persistence, invalid timezone, save conflict, write timeout→check current, membership loss during save, tenant/account switch, client no longer allowed yields withheld/null default. If global consumption chosen: system theme changes, SSR hydration, density, timezone, no cross-user cache flash. Existing safeguards must survive UI expansion.

<a id="st-13"></a>

#### ST-13 — Finish designed personal defaults/accessibility/reset, or explicitly retire them (P2, UNSUPPORTED)

**Evidence.** Writing style/default scope/artifact template/reduced motion/keyboard and Clear defaults are designed unavailable fields, not current canonical document fields. [Personal design][st-preference-personal], [unavailable model][st-unavailable-workspace], [canonical document][st-preferences-document].

**Tasks.** Decide supported fields against real consumers first. For accepted fields, extend the existing versioned user preference document/schema/migration only as needed and implement readers in bounded consumers; otherwise keep precise unavailable explanation/remove misleading editable affordance. Reset must submit canonical defaults with expected revision, preserve tenant policy and permission ownership, and return a durable revision. Navigation shortcuts should switch the actual preference tab or real route.

**Tests.** No field accepted without consumer; unknown fields rejected; upgrade/default migration backward compatibility; reset conflict/uncertain write; accessibility preference actually changes declared behavior; stored writing preferences never override tools/security/system policy.

<a id="st-14"></a>

#### ST-14 — Connect Meri Connections to the correct authorization owner (P2, UNSUPPORTED)

**Evidence.** Placeholder account row and disabled reconnect/disconnect/coverage actions. Capiro Integrations is a different, real connection surface. [Connections][st-preference-connections], [model][st-unavailable-workspace].

**Tasks.** First determine whether the represented “Meri authorized connection” is exactly the same Core provider connection and grant audience. If yes, reuse its qualified status/actions or link to Integrations with preserved context; if not, qualify Meri-owned public DTOs and bounded commands. Provide account identity, granted scope, refresh state, health, coverage, and truthful revoke impact. No second OAuth flow merely to fill a tab.

**Tests.** Personal vs tenant connection boundaries, current account mismatch, expiry/revocation, preserved evidence access rechecks after disconnect, status not inferred from a registry row. Share mail-plan ML acceptance rather than duplicate a separate provider implementation.

<a id="st-15"></a>

#### ST-15 — Wire Meri usage, effective limits, and queue navigation (P2, UNSUPPORTED)

**Evidence.** Metrics and run usage are placeholders; limits/model read-only unavailable; View run queue has no destination. Core AI cost summaries are not interchangeable with Meri attempt/concurrency/deadline accounting. [Usage screen][st-preference-usage], [model][st-unavailable-workspace].

**Tasks.** Bind effective runtime usage/attempts/current run/available capacity and policy to a qualified Meri read model. Link the actual permitted run queue. Keep ordinary view read-only; any administrator config editor must use existing authoritative policy contracts and separate capability, not browser-side threshold edits. Replace illustrative near-limit/budget/concurrency states with effective states while retaining explanations.

**Tests.** Failed/cancelled/retried attempts included according to runtime policy; clock/day boundary; stale metrics marked; budget reached/queue queued/cancelled; tenant isolation; no user can raise limits through preference save.

<a id="st-16"></a>

#### ST-16 — Wire skills/templates as permission-preserving starting points (P2, UNSUPPORTED)

**Evidence.** Three Use skill buttons and Attach a permitted template disabled; approved list placeholder. [Skills][st-preference-skills], [model][st-unavailable-workspace].

**Tasks.** Qualify existing permitted skill/template catalog, list only accessible entries, pass selected template into the existing conversation/task creation flow, and implement attachment via the existing file permission/scan/readiness pipeline. No arbitrary template text becomes authority or tool permissions. If no permitted template, actual empty state and disabled attach.

**Tests.** Revoked template, stale catalog, forbidden upload, file quarantine/processing, wrong client scope, duplicate launch, skill content cannot expand tools/authority. Prove actual research/document/spreadsheet/presentation start, not a success toast alone.

<a id="st-17"></a>

#### ST-17 — Connect workspace update preferences and header entry (P2, UNSUPPORTED)

**Evidence.** Updates fields and preview/profile-menu controls disabled; static caught-up notice despite no data. Canonical preference doc already has three notification booleans, but no consumer is shown by this Settings page. [Updates][st-preference-updates], [model][st-unavailable-account], [document][st-preferences-document].

**Tasks.** Define mapping between designed run/decision/connection categories and actual supported notification keys; do not conflate memoryReviewed and connection state without a contract. Add revisioned controls only for supported categories and bind existing notification consumers/delivery filtering. Reuse real Updates/profile entry components; render unavailable separately from zero unread. Broadcast recipient workflow ST-20 is a distinct mandatory-message policy, not automatically suppressible by personal toggles.

**Tests.** Saved preference survives reload and affects correct notifications only; mandatory approvals/security notices not accidentally suppressed; no fake caught-up or preview success; account/tenant switch clears stale updates; notification ownership enforced.

<a id="st-18"></a>

#### ST-18 — Wire privacy/retention/export/deletion through existing policy owners (P1 if promised for launch; otherwise P2 UNSUPPORTED)

**Evidence.** Retention values are placeholders; export/deletion and state links disabled. Static legal-hold and pending notices are design examples, not actual account state. [Privacy][st-preference-privacy], [model][st-unavailable-account].

**Tasks.** Qualify the existing runtime retention/export/deletion read/command owners, then expose effective per-store policy and actual request status. Implement explicit request, confirmation, durable request ID, pending/final/refused receipt and safe status polling. Exclude filed records/action receipts unless their owner supports it; honor legal hold and current authorization. Never route this through generic preference save or generic memory purge.

**Tests.** Authorized export scoped to own permitted data, expired download, revoked access at download, legal hold, concurrent request/idempotency, unknown deletion outcome blocks a second destructive action, retained records accurately explained, no success before authoritative completion. Use fixtures; real irreversible deletion requires separate action-time authorization.

<a id="st-19"></a>

#### ST-19 — Remove fake feedback receipt and wire actual help/feedback (P2, MAIN presentation bug + UNSUPPORTED service)

**Evidence.** HelpShortcutsScreen always renders view.submitted; unavailable model titles it “Report submitted” while saying a real service must acknowledge. Submit remains disabled. [Help L61–81/L98–135][st-preference-help], [model][st-unavailable-account].

**Tasks.** Immediately stop rendering success absent a receipt. Verify actual keyboard registrations and label only implemented shortcuts as available. Qualify an existing help/support submission owner before enabling summary/detail/optional run-reference submission; explicitly limit attachments and redact sensitive run metadata. Provide request ID and real failure/uncertain state, no automatic private content attachment.

**Tests.** Fresh page has no success; disabled mode sends nothing; a real accepted response alone shows submitted/request ID; timeout preserves draft; opted-out run reference omitted; malicious text treated as data; keyboard instructions match behavior.

<a id="st-20"></a>

#### ST-20 — Deliver and acknowledge HQ broadcasts in the user shell (P1, missing frontend consumer)

**Evidence.** Admin UI promises next-sign-in display until acknowledged. Core already mounts GET /me/broadcasts/pending and POST /me/broadcasts/:id/acknowledge for current user with tenant-scoped recipient checks. No corresponding fixed frontend operations or signed-in-shell consumer exist; Updates buttons disabled. [Promise][st-broadcasts], [recipient routes][st-broadcast-recipient], [service L196–231][st-broadcast-service], [header][st-module-header].

**Tasks.** Add bounded recipient fixed operations; mount a signed-in recipient banner/dialog/inbox in shared authenticated shell, including Settings/Portfolio/Workspace entry as intended. Read pending once authenticated, display oldest/policy order, acknowledge exact broadcast after explicit user action, reconcile pending and admin metrics. Distinguish view/dismiss from persisted ack. Preserve recipient/tenant/archived checks and prevent tenant-switch flash.

**Tests.** Targeted vs nontargeted users, all_roles allowed by server, multiple messages/order, reload before ack retains, ack survives reload, duplicate ack idempotent, archive removes pending, foreign broadcast denied, removed member, multi-tab refresh, admin count changes only after actual ack.

<a id="st-21"></a>

#### ST-21 — Complete audited HQ impersonation only as a whole boundary (P1 HELD, intentionally disabled)

**Evidence.** Core supports start/end sessions and tenant middleware requires an active session matching actor/target before impersonation override, with audit context. Frontend lacks subsequent-request binding, so Start is intentionally disabled. [Disabled UI][st-tenants], [Core sessions L506–575][st-hq-service], [context L529–557][st-tenant-context].

**Tasks.** Qualify purpose-specific start/end operations and a server-owned trusted session binding for subsequent fixed gateway calls. Render persistent “acting as” tenant/expiry indicator and explicit exit. Invalidate caches/drafts and native authority on enter/exit; never forward arbitrary browser tenant headers or silently impersonate on ordinary links. Restrict which surfaces and auth modes support impersonation; personal memory/preferences/native approval routes may deliberately refuse it.

**Tests.** Only capiro_admin; reason required; current session actor/tenant/expiry match; ended/expired session denies; exit restores original tenant; audit of start/end/actions; tabs and request races; no scope applies to another user; direct header without trusted session rejected. Keep feature disabled until these pass.

<a id="st-22"></a>

#### ST-22 — Supply managed-import status or remove the unsupported promise (P2, UNSUPPORTED)

**Evidence.** HQ Customers explicitly shows managed import status unavailable; no qualified queue contract in its fixed operations. [Customers][st-customers], [HQ operations][st-hq-operations].

**Tasks.** Locate the authoritative managed-import/onboarding job owner and qualify a bounded status/list/detail projection with target tenant, request, state, counts, errors and last update. Do not confuse ordinary client create, firm-onboarding candidates, or provider sync with managed import. If retry/cancel is required, qualify that owner's supported command; otherwise read-only status plus honest operator path. No broad import subsystem rewrite.

**Tests.** Queued/running/partial/failed/completed, wrong tenant, pagination, stale last update, count reconciliation, no inferred completion from client count. Product explicitly accepts unsupported disposition if no current owner exists.

<a id="st-23"></a>

#### ST-23 — Finish Provision→PE and SAM analyst queues with exact domain contracts (P2, UNSUPPORTED)

**Evidence.** Both panels explicitly unavailable; Provision candidate count exists but no screen queue/decision implementation. [Analyst L23–46/L76–80][st-analyst].

**Tasks.** Inspect and qualify authoritative service projections for these exact analyst queue identities. Reuse existing domain services only when evidence/decision/state semantics match; per-program/PE link endpoints are not automatically a review queue. Add fixed list/detail/decision contracts, paging/filters/evidence/reasons and true accepted/rejected/pending result handling, or formally mark unsupported with no action promise.

**Tests.** Reviewer capability, candidate stale/race, duplicate decision, foreign or nonexistent entity, immutable evidence, audit, counts update, no mutation of unrelated canonical program/provision/person. Keep two separate tickets internally if service owners differ.

<a id="st-24"></a>

#### ST-24 — Finish mutation lifecycle, receipt, and scope safety across remaining forms (P1 for consequential HQ/security writes; P2 elsewhere)

**Evidence/root cause.** useSettingsAction suppresses stale callbacks and exposes AbortSignal, but most callsites omit scopeKey and ignore the signal. Many dialogs allow backdrop/Escape/onClose while busy and fields remain editable. Examples: Team remove; Billing checkout/cancel; HQ create/delete/comp, key drawer/removal and broadcast send; mapping/analyst dialogs. Profiles create protects closing but not input edits. Signature editor disables typing but not upload/drop/default switch. Bulk mapping loop dispatches sequential requests without checking scope cancellation. [Hook][st-action-hook], [Profiles][st-profiles], [signature][st-signature], [HQ dialogs][st-tenant-dialogs], [AI drawer][st-ai-keys], [broadcasts][st-broadcasts], [mapping loop][st-mappings].

**Tasks.** Apply the existing safe dialog pattern per form, not a broad state-management rewrite: snapshot/freeze target and payload, disable editing and dismiss while mutation is in flight, pass signal and scope identity where safe, stop dispatching remaining bulk items after scope invalidation, preserve exact pending/unknown result record. Aborting fetch is not evidence the backend cancelled a write. On dispatched timeout re-read the exact resource/outcome before offering retry; avoid automatically replaying invite, broadcast, credential rotation, tenant create/delete, comp, or decisions. Verify semantic receipt target/status/value when available, and explicitly reconcile read state where responses are only ok.

**Acceptance inventory.** Apply to personal title, signature, branding name, contact, profile create/archive/restore, team invite/resend/remove/role/billing, integrations, billing handoff, HQ tenant create/delete/resend, customer comp, AI credential set/remove/model, broadcast send/archive, mapping single/bulk/manual/contractor, analyst decisions/alias/delete/merge/quarantine. Preserve already repaired Invite/Register/Disconnect/Profiles busy-close protections rather than regress them.

**Tests.** Double click; Enter+click; input edit; Escape/backdrop/Close/Cancel; route/tab/tenant/Clerk-account change; 401/403 midflight; response for wrong ID; malformed 2xx; failure after server commit; delayed readback; partial bulk completion. No false success in a different scope, no hidden background continuation beyond the initiated bounded work, no lost newer draft.

<a id="st-25"></a>

#### ST-25 — Qualify the actual billing handoff and settle in-app parity (P1 CONFIG for launch; P2 optional UI parity)

**Evidence.** Core read views and Onboard Stripe writer are mounted. State/summary revalidation and allowlisted Stripe URLs already exist. In-app payment-card/invoice/cancellation-detail data is deliberately not implemented. [Flow][st-billing-flow], [UI][st-billing], [Onboard][st-onboard-service].

**Tasks.** Qualify same-environment CORE/ONBOARD URLs, Clerk BillingActorGuard identity, Stripe key/prices, BILLING_RETURN_URL, portal products/settings, webhook secret/endpoint, and subscription event convergence. Test portal supports intended quantity/payment/invoice/cancel actions; “opens portal” is not proof configured portal permits each action. Decide whether hosted parity is sufficient; only if not, add bounded masked payment/invoice/contract-window DTOs to the billing owner, not Core's obsolete tenant-admin billing stub.

**Tests.** None/trialing with no subscription→checkout; live subscription→portal; comped/disabled/mismatched state refuses inappropriate flow; min slots/promo; no billing permission; changed permission before handoff; allowed HTTPS Stripe origins only; cancel return and successful checkout return do not mark paid until webhook/read convergence. No real purchase performed for this audit.

<a id="st-26"></a>

#### ST-26 — Qualify configuration, schema, workers, and live receipts separately from merges (P1 CONFIG/LIVE?)

**Evidence.** Current source contains mounts/schema/migrations, but no applied migration, running config, provider callback, or E2E receipt was observed. Main/source presence is not activation evidence. [Config][st-config], [Core config][st-core-config], [schema][st-schema], [Meri migration][st-preferences-migration].

**Tasks.** Produce per-environment nonsecret readiness record for Core, Onboard, Meri and provider boundary. Check Clerk app/issuer/template, WEB_ORIGIN/request origin, service base paths, ASSETS_BUCKET/region/IAM/CORS, AI credential encryption readiness, Stripe configuration, signature body limit, identity outbox drainer, notification dispatcher/projection/cleanup workers as applicable. Verify applied schema ledger, not filenames alone. Exercise isolated fixture read→authorized write→receipt→reload; deploy and flag steps require separate approval and rollback record.

**Relevant migration families already in source.** Billing (20260614120000); email signature (20260614180000); billing-admin (20260707003000); identity outbox (20260802010000); admin broadcasts (20260914120000); memory governance/candidate/private scope/walls, immutable versions, projection/cleanup, review foundation/revision/notification assignment+dispatcher/admin-self-approval; Meri 0001_settings.sql. Future-looking migration filenames are merely source names, not evidence of application.

**Tests/receipt.** Record exact source SHA, config hashes/redacted readiness, applied migration IDs, qualified route+status, expected persistent object ID/revision and post-refresh result. Deliberately disabled services return unavailable without fallback. No secrets in evidence. Separate ordinary, preview and owner-memory qualification.

<a id="st-27"></a>

#### ST-27 — Make branding-name provider convergence truthful (P2, MAIN partial provider wiring)

**Evidence.** Tenant name persists, then Clerk update errors are swallowed. UI says branding saved and reloads local state, so Clerk could remain different indefinitely. [Service L381–400][st-tenant-service].

**Tasks.** If cross-provider name consistency is required, use the existing provider-outbox/retry pattern or a bounded sync-status receipt and repair command; distinguish local save from Clerk convergence. Do not move external calls deeper into a DB transaction. If best effort is intentional, label it and expose operational failure telemetry rather than promise synchronized identity.

**Tests.** Clerk timeout/error after local commit, retry idempotency, concurrent name changes and last-authoritative value, UI local-vs-provider notice, no leaked credentials. No new outbox architecture required.

<a id="st-28"></a>

#### ST-28 — Preserve client context and rebind actions on scope changes (P2, navigation/lifecycle)

**Evidence.** Navigation has scoped helpers, but Personal monitoring/preferences and Billing AI-usage links use raw Link. Most settings mutations use unscoped local action hooks. [Personal][st-personal], [Billing][st-billing], [navigation][st-settings-nav], [hook][st-action-hook].

**Tasks.** Use the existing scoped-link/context mechanism for links whose destination should retain selected client. Explicitly define account/tenant-global pages so a query parameter never becomes authority. On tenant/actor switch clear local secrets/drafts, invalidate reads, and rebind mutation state to new API/session identity. Fold pending-request protection into ST-24.

**Tests.** Enter Settings from selected profile; traverse Personal→monitoring/preferences and Billing→usage; return scope preserved where designed. Tenant switch never displays old profile/member/key or sends old draft to new tenant. Query-tampered client still authorized server-side.

<a id="st-29"></a>

#### ST-29 — Resolve API-only actions and explicit product exclusions (P2 decision, not automatic new features)

**Evidence.** Tenant redacted audit log, raw usage events, memberships, and various server admin utilities exist without visible Settings controls. This alone does not mean the visible feature is broken. [Operations][st-operations], [tenant audit service][st-tenant-service], [HQ controller][st-hq-controller].

**Tasks.** Record each as intentionally API-only or add a narrowly scoped entry if part of agreed parity. Tenant audit is the clearest useful candidate: add an ordinary-admin audit read tab using the already redacted DTO, never HQ before/after payloads. Do not invent buttons for password reset, arbitrary user removal, logo deletion, invite cancellation, tenant policy editing, or new providers merely because related backend code exists.

**Tests.** If exposed, current tenant admin only, redaction invariant, paging/filters and no foreign tenant metadata. Otherwise an explicit unsupported/external disposition closes the gap without speculative architecture.

### 6. Implementation sequencing and ownership

#### Wave A: source safety and honest availability, no activation

1. Core+frontend ST-01 logo boundary and Core ST-02 protected member removal.
2. Frontend ST-03 preview query/mode behavior, ST-04 account opener, ST-05 Team permissions.
3. Backend ST-06 invitation completeness and metadata.
4. Frontend ST-19 fake success removal and unavailable-state corrections from ST-17/18.
5. Begin ST-24 per-form lifecycle fixes, prioritizing tenant deletion, key rotation, broadcasting, comp and role changes.

Exit: direct API negative tests pass; no unsupported screen fires known-blocked calls or claims completed work.

#### Wave B: reuse already-mounted owners

1. ST-20 broadcast recipient consumer.
2. ST-10 review notifications and read-only parts of ST-07.
3. ST-08 grants and ST-09 governed files after read/authorization DTO qualification.
4. ST-12 personal-preference runtime qualification and explicit consumption decision.
5. ST-25 billing configuration/hosted parity qualification and ST-27 name-sync truthfulness.

Exit: contract fixtures pin correct owner/type/permission; all actions have receipt, retry/readback and refreshed state; no live feature gate silently opened.

#### Wave C: held work and genuinely unsupported slices

1. ST-11 current PR115 owner-memory qualification/merge review, kept distinct from shared governance.
2. ST-21 full audited impersonation boundary, if in supported scope.
3. ST-22 managed imports and ST-23 Provision/SAM contracts.
4. ST-13–18 unsupported preferences only after exact consumer/owner decisions.
5. ST-29 API-only disposition and ST-28 scope navigation finish.

Exit: each designed control is either backed by the authoritative flow with tests or explicitly excluded/unavailable. A placeholder labelled unavailable is safer than a fabricated backend, but not “feature complete.”

#### Wave D: authorized release qualification

ST-26 per-environment readiness, migration/worker confirmation, isolated smoke plan and rollback. Review ordinary production and read-only preview separately. PR merge, image deployment, configuration enablement, provider authorization, and E2E certification are separate events; report each precisely.

#### Suggested ownership

- Frontend Settings: route/control matrix, fixed DTO adapters, pending/unknown/readback behavior, account opener, navigation.
- Core identity/tenant: team permissions/invites/outbox, branding ownership, broadcast recipients, role/tenant checks.
- Core memory: public read/action DTOs, readiness/eligibility, walls/grants, version/candidate transitions, review notifications/projections.
- Meri runtime/contracts: canonical preferences, usage/policy/template/retention ownership and native membership.
- Onboard/billing: Stripe writer/portal/webhooks/comp and billing receipts.
- Mail/integrations: OAuth session/callback/status/scope/worker configuration and provider result correctness, referenced by this document rather than duplicated.

### 7. Release acceptance matrix

Run against isolated seeded fixtures or explicit non-mutating reads first. Any real invite, email, OAuth grant, credential change, payment, privacy deletion, tenant deletion, or infrastructure/config change needs its own approved execution scope; this audit authorizes none.

1. **Role matrix:** standard_user, user_admin without billing bit, active billing admin, capiro_admin, client_portal_user where explicitly allowed, removed/inactive member, expired session, unknown role. Verify UI affordances and direct handler denial independently.
2. **Ownership matrix:** same tenant, foreign tenant UUID, same tenant foreign owner, denied/walled client, archived client, stale default client, removed reviewer, revoked provider grant. Browser identity hints must never create authority.
3. **Mode matrix:** ordinary Core/Onboard; preview allowlist; disabled Meri preference feature; composed preference feature; held owner-memory preview; allowed ordinary owner-memory. No cross-mode fallback.
4. **Mutation matrix:** success with exact receipt, malformed 2xx, semantic wrong target/value, 400, 401, 403, 404, 409 stale/conflict, 429, pre-dispatch failure, post-dispatch timeout, uncertain server commit, refresh failure after success.
5. **Lifecycle matrix:** double-click, keyboard submit, change input while pending, backdrop/Escape, route/tab/tenant/account switch, reload, multi-tab, concurrency, partial bulk dispatch. A write may outlive transport; status/readback must reconcile.
6. **Provider matrix:** Clerk invitation pagination/acceptance/webhook lag; Clerk name sync failure; S3 policy/HEAD/key ownership; Stripe portal feature/return/webhook lag; AI key validation/encryption; mail provider connect/status/sync/revoke as ML plan specifies.
7. **Persistence matrix:** exact own user title/signature/preferences revision; tenant contact/name/logo; client status and capacity; membership/outbox; broadcast recipient+ack; memory candidate/version/grant/notification; audit records. No fake UI success before persistence/accepted command receipt.
8. **Recovery matrix:** retry only after safe preflight or authoritative readback; duplicate ack/decision idempotency; stale/ineligible reviewer; unknown credential result clears secret safely but offers readback; deletion ambiguity blocks duplicate destructive action.
9. **UX matrix:** loading/error/unavailable/empty/pending/success visually distinct; keyboard focus; real disabled reasons; correct return navigation; account profile opener reachable; no stale tenant flashes; no “Report submitted” or “caught up” fabricated from no data.
10. **Observability:** redacted request correlation, operation name, authoritative target, status class, source/config qualification; no email signature HTML, private memory, raw AI keys, OAuth tokens, arbitrary feedback attachments or identity secrets in logs.

### 8. Non-gaps and explicit limitations

- Hosted Clerk identity/security and Stripe billing are legitimate external implementations, not automatically missing custom screens.
- Existing ordinary-main Settings operations should be repaired/qualified, not rewritten into a new gateway or backend.
- Local tab changes, search filters, editor formatting, file preview, cancellation of an unsent draft, and dialog open/close are intentionally local actions.
- Signature persistence has an actual send consumer. Gmail periodic sync exists; lack of Google “Realtime” button is not absence of sync.
- Profile archive is recoverable status change; tenant deletion is a different irreversible HQ action.
- Review submission is not activation, and a candidate acknowledgement is not a final memory version.
- Memory admin self-approval policy is not the same as PE reconciliation's second-administrator approval.
- Main Settings's old `/tenant-admin/billing` stub is not its actual billing path; do not mistake that unused route for missing Onboard Stripe implementation.
- Source flags or migration filenames do not prove a deployed configuration or applied database schema.
- This is exhaustive for inspected Settings routes/actions and related source boundaries, not a penetration test, provider-account audit, or assertion that every unexamined backend utility deserves a Settings button.

### 9. Source references

All file links below pin the inspected commit rather than a moving branch.

[st-settings-route]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/app/settings/[section]/page.tsx
[st-settings-screen]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/SettingsScreen.tsx#L37-L59
[st-settings-access]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/access.ts
[st-settings-nav]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/SettingsNavigation.tsx
[st-gateway]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/gateway.ts
[st-gateway-route]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/app/api/capiro/[operation]/route.ts
[st-config]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/config.ts
[st-preview]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/preview/read-route.server.ts
[st-preview-proxy]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/preview/read-proxy.server.ts
[st-core-preview]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/clients.controller.ts#L330-L365
[st-personal]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/PersonalSettings.tsx
[st-module-header]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/shell/ModuleHeader.tsx#L65-L90
[st-portfolio-header]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/shell/PortfolioHeaderActions.tsx
[st-signature]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/SignatureSettings.tsx
[st-signature-editor]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/signature/RichSignatureEditor.tsx
[st-users]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/users/users.controller.ts
[st-signature-send]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1128-L1157
[st-contact]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/ContactSettings.tsx
[st-branding]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/BrandingSettings.tsx
[st-uploads]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/uploads.ts
[st-branding-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/branding/branding.service.ts
[st-branding-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/branding/branding.controller.ts
[st-team]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/TeamSettings.tsx
[st-invite]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/InviteMember.tsx
[st-tenant-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant-admin/tenant-admin.service.ts
[st-tenant-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant-admin/tenant-admin.controller.ts
[st-profiles]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/ProfileSettings.tsx
[st-clients]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/clients.controller.ts
[st-clients-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/clients.service.ts
[st-account-owners]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-account-owner.service.ts
[st-operations]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/settings.ts
[st-profile-operations]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/settings-admin/profiles.ts
[st-integration]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/IntegrationSettings.tsx
[st-register]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/RegisterAccount.tsx
[st-providers]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/integrationProviders.ts
[st-billing]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/BillingSettings.tsx
[st-billing-flow]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/billingFlow.ts
[st-billing-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/billing/billing.controller.ts
[st-billing-guard]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/billing/billing-admin.guard.ts
[st-onboard]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/onboard-api/src/billing/billing.controller.ts
[st-onboard-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/onboard-api/src/billing/billing.service.ts
[st-onboard-app]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/onboard-api/src/app.module.ts
[st-usage]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/UsageSettings.tsx
[st-usage-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/ai-usage/ai-usage.controller.ts
[st-memory]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/MemorySettings.tsx
[st-memory-module]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory.module.ts
[st-memory-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory.controller.ts
[st-governance-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory-governance.controller.ts
[st-governance-switch]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory-governance-center.switch.ts
[st-review-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory-review-inbox.controller.ts
[st-review-readiness]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory-settings-review-readiness.service.ts
[st-owner-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory-owner-items.controller.ts
[st-preferences]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/MeriPreferencesPanel.tsx
[st-preferences-form]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/user-preferences/UserPreferencesForm.tsx
[st-preferences-host]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/user-preferences/UserPreferencesHost.tsx
[st-preferences-config]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-user-preferences/config.ts
[st-preferences-proxy]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-user-preferences/proxy.ts
[st-preferences-route]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/app/api/settings/user/[operation]/route.ts
[st-preferences-document]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/packages/contracts/user-preferences-application/document.mjs
[st-preferences-runtime]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/runtime/user-preferences.mjs
[st-preferences-runtime-route]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/runtime/product-applications.mjs#L72-L90
[st-preferences-service]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/control/settings/user-service.mjs
[st-preferences-migration]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/control/settings/migrations/0001_settings.sql
[st-preference-personal]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/PersonalPreferencesScreen.tsx
[st-preference-connections]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/ConnectorAccountsScreen.tsx
[st-preference-usage]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/UsageLimitsScreen.tsx
[st-preference-skills]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/SkillsTemplatesScreen.tsx
[st-preference-updates]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/NotificationsAccountScreen.tsx
[st-preference-privacy]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/PrivacyDeletionScreen.tsx
[st-preference-help]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/HelpShortcutsScreen.tsx
[st-unavailable-workspace]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/unavailable-workspace.ts
[st-unavailable-account]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/unavailable-account.ts
[st-tenants]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/TenantSettings.tsx
[st-tenant-dialogs]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/TenantDialogs.tsx
[st-tenant-tabs]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/TenantTabs.tsx
[st-customers]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/CustomerSettings.tsx
[st-ai-keys]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/AiKeysSettings.tsx
[st-broadcasts]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/BroadcastSettings.tsx
[st-broadcast-detail]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/BroadcastDetail.tsx
[st-broadcast-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/admin-broadcasts/admin-broadcasts.controller.ts
[st-broadcast-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/admin-broadcasts/admin-broadcasts.service.ts
[st-broadcast-recipient]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/admin-broadcasts/me-broadcasts.controller.ts
[st-hq-operations]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/settings-admin/hq.ts
[st-hq-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/capiro-admin/capiro-admin.controller.ts
[st-hq-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/capiro-admin/capiro-admin.service.ts
[st-tenant-context]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant/tenant-context.middleware.ts
[st-roles]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/auth/roles.guard.ts
[st-analyst]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/analyst/AnalystSettings.tsx
[st-reconciliation]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/analyst/ReconciliationQueue.tsx
[st-program-match]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/analyst/ProgramMatchQueue.tsx
[st-aliases]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/analyst/AliasManager.tsx
[st-merge-programs]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/analyst/MergePrograms.tsx
[st-people]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/analyst/PersonReviewQueues.tsx
[st-audit-quarantine]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/analyst/AuditAndQuarantine.tsx
[st-program-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/program-element/programs/programs.controller.ts
[st-pe-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/program-element/program-element.controller.ts
[st-personnel-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/acquisition-personnel/acquisition-personnel.controller.ts
[st-mappings]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/mappings/MappingSettings.tsx
[st-mapping-review]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/mappings/MappingReview.tsx
[st-mapping-attach]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/mappings/AttachFederalRecord.tsx
[st-mapping-contractor]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/mappings/ContractorIdentity.tsx
[st-mapping-source]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/mappings/SourceSearch.tsx
[st-mapping-bulk]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/mappings/bulkReview.ts
[st-mapping-operations]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/settings-admin/mappings.ts
[st-intelligence-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/intelligence/intelligence.controller.ts
[st-action-hook]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/useSettingsAction.ts
[st-app-module]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/app.module.ts#L80-L160
[st-schema]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/prisma/schema.prisma
[st-core-config]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/config/config.schema.ts
[st-pr115-owner-proxy]: https://github.com/neo-capiro/capiro-frontend/blob/7fda299e2264d17a5a88c1dad50b08633ba862ae/apps/web/src/features/meri/memory-review/owner-review-proxy.server.ts
[st-pr115-inbox]: https://github.com/neo-capiro/capiro-frontend/blob/7fda299e2264d17a5a88c1dad50b08633ba862ae/apps/web/src/features/meri/memory-review/MemoryOwnerInbox.tsx
[st-pr115-owner-route]: https://github.com/neo-capiro/capiro-frontend/blob/7fda299e2264d17a5a88c1dad50b08633ba862ae/apps/web/src/shared/preview/memory-owner-route.server.ts
[st-pr115-preview-config]: https://github.com/neo-capiro/capiro-frontend/blob/7fda299e2264d17a5a88c1dad50b08633ba862ae/apps/web/src/shared/preview/read-config.server.ts



<a id="mail"></a>

## Mail integrations: source audit and implementation-ready closeout

### Scope, evidence and status vocabulary

Read-only audit against frontend main `4f9a7e8dcaa9ba03494dc5a49559daf70cea5100`, backend backend-import `309af848f1aa403f6c8e54aa0d22990d4230f063`, and Meri main `3c56c3e981ba868a2af103c4cae9f65a0d47458d`. Branch heads and relevant open PR metadata were checked through GitHub. Actual production implementation, DI providers, mounted controllers, persistence and provider-call code were read, not merely test names or documentation. No repository, infrastructure, configuration, integration or credential was changed. No provider call, OAuth grant, live mailbox sync, test run or real message send was performed.

- **Implemented** means present on these source heads, not deployed or live-qualified.
- **Confirmed gap** means the source path demonstrably lacks a required boundary or advertised behavior.
- **Residual risk** means a concrete unsafe-looking source seam needs a reproduction/contract test before claiming an incident.
- **Config-held / live-unverified** is not missing code. Inspect rendered deployment and owner-approved runtime evidence before activation.
- **Product boundary** means absent functionality that must either remain explicitly unsupported or be deliberately selected for implementation, not automatically a new platform requirement.
- P1 below is a release blocker for the affected action; P2 is a closure/usability/operational gap. No observed cross-user exploit or production incident is asserted.

#### The most important corrections to a naïve “not wired” inventory

1. Both Microsoft 365 and Gmail already have OAuth, encrypted tokens, refresh, mailbox ownership checks, persisted mail ingestion, outbound sending and automatic sync. Rebuilding either integration would duplicate working source.
2. **Push/realtime is Microsoft-only. Gmail is not manual-only:** the same DB-claim scheduler periodically invokes Gmail history/backfill sync. There is no Gmail watch/Pub/Sub callback/renewal path in the inspected active integration implementation.
3. Single-contact compose is wired end-to-end but not yet durably at-most-once across reloads/process failure. Existing OutreachSendIntent and Meri proposal mechanisms are stronger and should be reused as patterns, not replaced.
4. “Reply” in Contact compose is a local thread association, not a provider-native reply. Timeline explicitly states reply sending is unavailable. Legacy Meri reply has additional sender/recipient selection defects.
5. Graph's draft-then-send adapter is implemented, but its shared HTTP helper can retry the send POST before the ambiguity boundary sees the error. Its immediate local message receipt is deliberately synthetic and lacks a reconciliation anchor.
6. Newsletter external delivery is **already** prepare -> immutable draft versions -> durable send intents -> owned OAuth mailbox. Workspace reviewer/invitation notifications use a **different SES system-sender** path. Staging, notification email and newsletter external sending must not be conflated.
7. Separate EngagementApiAppModule and its V3 route/feature gates are not equivalent to standard Core. The frontend's `core` URL alone does not establish that V3 routes reach the separate app.

### Actual execution chains

#### Settings OAuth and sync

`IntegrationSettings` handlers -> fixed `settings.integrations.*` operations targeting service `core` -> authenticated frontend transport -> mounted `MicrosoftIntegrationActionsController` / `GoogleIntegrationActionsController` -> guarded OAuth/sync services -> `IntegrationConnection` plus encrypted `IntegrationConnectionToken` -> provider -> callback redirect or sync result -> Settings list reload. Callbacks live in the separately mounted callbacks module and are authentication-middleware exclusions, with signed OAuth state/provider notification validation instead. Do **not** edit the older monolithic `*-oauth.controller.ts` assuming it owns these routes; the split action/callback controllers are the active owners. [ML-S01][ml-ML-S01] [ML-S02][ml-ML-S02] [ML-S04][ml-ML-S04] [ML-S05][ml-ML-S05] [ML-S06][ml-ML-S06] [ML-S07][ml-ML-S07] [ML-S08][ml-ML-S08] [ML-S09][ml-ML-S09] [ML-S10][ml-ML-S10]

OAuth currently requests Microsoft `offline_access, User.Read, Mail.Read, Mail.ReadWrite, Mail.Send, Calendars.Read`; authority defaults to `organizations`, therefore the advertised integration is work/school Microsoft 365, not a proven consumer Outlook.com path. Google requests `openid, email, profile, gmail.readonly, gmail.send, calendar.events.readonly`. Google validates missing initial grants; both persist canonical scope lists rather than a reliable ongoing granted-permission inventory. Tokens use AES-256-GCM at rest. [ML-S12][ml-ML-S12] [ML-S14][ml-ML-S14] [ML-S17][ml-ML-S17] [ML-S58][ml-ML-S58] [ML-S69][ml-ML-S69] [ML-S70][ml-ML-S70]

#### Contact compose

`ContactMail / MailCompose` -> actor/tenant/client lifetime capture -> owned sending-mailbox selection -> upload existing document/file pipeline if needed -> current attachment readiness and thread preflight -> same-origin custom Portfolio proxy `core/engagement/mail/send` -> protected EngagementController -> sendSingleMail -> own originating mailbox for thread replies -> rendered/sanitized HTML + actor signature + authorized attachment bytes -> EngagementMailSender -> Graph or Gmail -> local thread/message receipt -> invalidate contact-mail, mail-thread and client-profile queries. Frontend retry is disabled and in-session ambiguous attempts are locked. Backend owns the real authorization; UI authority checks alone cannot replace server preflight. [ML-S03][ml-ML-S03] [ML-S29][ml-ML-S29] [ML-S30][ml-ML-S30] [ML-S36][ml-ML-S36] [ML-S37][ml-ML-S37] [ML-S38][ml-ML-S38] [ML-S39][ml-ML-S39] [ML-S41][ml-ML-S41] [ML-S42][ml-ML-S42]

#### Durable outreach and newsletters

Immutable accepted draft versions -> OutreachSendIntent with immutable recipient/body/signature/attachment manifest and request-key fingerprint -> transactionally committed delivery -> status-guarded pending-to-sending claim -> current checks -> same EngagementMailSender -> durable acceptance or terminal unknown -> intent/status refresh. Production DI uses **RaceSafeOutreachSendIntentService**, including unique-race retry, with worker timers owned separately. Newsletter prepare/send/test already uses this path with exact prepared sender/destinations and opt-out filtering. Keep this implementation; do not route ad-hoc single mail through invented campaign records just to reuse it. [ML-S44][ml-ML-S44] [ML-S45][ml-ML-S45] [ML-S46][ml-ML-S46] [ML-S59][ml-ML-S59] [ML-S60][ml-ML-S60]

#### Meri

The retained canonical mail family is read-only: list/search/read-thread -> explicit mail HTTP adapter -> authenticated retained-source route in Core -> current delegated mailbox/client authorization -> stored normalized mail -> proof/coverage/continuation validation. It does not query the provider live or mark messages read. Its installed catalog only admits measured read-only handlers. Legacy `send_email/reply_email` are a different path through Meri's action-proposal engine and the shared provider sender; they are not evidence that canonical mail read tools have write permission. [ML-S47][ml-ML-S47] [ML-S48][ml-ML-S48] [ML-S49][ml-ML-S49] [ML-S50][ml-ML-S50] [ML-S51][ml-ML-S51] [ML-S52][ml-ML-S52] [ML-S53][ml-ML-S53]

### Exhaustive provider/action coverage matrix

| Capability | Microsoft 365 / Outlook work-school | Gmail / Google Workspace | User-visible or closeout implication |
|---|---|---|---|
| Register account | Owner-scoped connection registration exists | Same | Registration is metadata, not a successful OAuth connection. IMAP registration does not create an adapter. |
| Connect / reconnect | Signed-state authorization-code flow, MSAL certificate credentials | Signed-state authorization-code flow, client ID/secret, offline access | Account replacement/adding another mailbox and callback feedback need ML-08/11. |
| Disconnect | Deletes local token/connection; best-effort subscription removal; deliberately does not revoke tenant app grant | Best-effort grant revoke, then local delete | Error-state UI cannot disconnect; retained-history access changes, ML-17. |
| Status / capabilities | OAuth configured and connection status exposed | Same | Configured is not deployed, granted, synchronizing or realtime-healthy. ML-01/12/14. |
| Scopes / identity | Organization authority, own account, canonical scopes; refresh cache fallback concern | Initial missing-scope validation; decoded token identity; canonical stored scopes | Requested scopes must not be represented as verified ongoing grants. ML-08/10/12/25. |
| Token persistence / refresh | AES-GCM, expiry-aware refresh, rotation persistence | AES-GCM, expiry-aware refresh | Reconnect status overwritten by outer sync failure; no complete key rotation/refresh serialization proof. ML-10/13/25. |
| Automatic mail sync | Claim scheduler plus webhook-triggered sync | Claim scheduler plus history cursors | Gmail automatic sync exists; “Gmail realtime” would be new optional scope. |
| Initial history / paging | Bounded ~365-day backfill, folder discovery, page caps, durable next/delta links | ~365-day bounded backfill, quota budget, pending IDs/pages, history baseline | Not full-lifetime mailbox completeness. Surface continuations and coverage, ML-14/18. |
| Incremental / removals | Folder delta, excluded trash/junk/draft/outbox classes, replay/removal handling | history additions/deletions/label changes, excludes spam/trash/drafts, expired-history recovery | Keep current stored removal and folder semantics; test cursor reset and mutations during continuation. |
| Read / list / search | Normalized DB readers with owner predicate | Same | Contact list caps at 50 and has no cursor/search UI; assistant search has bounded pagination and coverage. ML-18. |
| Thread read / body | Full stored thread; body hydration with completeness/truncation metadata | MIME body extraction, including body attachment hydration; completeness/truncation metadata | UI schema discards completeness; full-thread DB read remains unbounded. ML-18. |
| Incoming file attachments | hasAttachments metadata; no ordinary incoming file materialization/download path found in active sync | Same; Gmail “attachment” fetch for message body is not a general file attachment feature | ML-19 product decision; do not mistake compose attachments for inbound support. |
| Compose | Reviewed HTML compose, exact sender, To/Cc/Bcc, attachments, rewrite and actor signature | Same | Implemented, preserve. No need redo UI or signatures. |
| Save mailbox drafts | Internal provider draft created during Graph send only | No provider draft-save operation | User draft persistence is not implemented; ML-20. |
| New send | Create draft then POST draft/send, returns draft/Message-ID/conversation metadata | MIME messages/send, returns provider message/thread IDs | Shared Graph retry issue, single-mail ledger and receipt gap, ML-02/03/04. |
| Reply / reply-all | Local thread association, no createReply/reply identity passed | Raw MIME lacks threadId/In-Reply-To/References | Contact “Reply” is not provider-native; ML-05. Timeline explicitly blocks real send. |
| Forward | No active first-class forward operation found | Same | Explicit product boundary, ML-20. |
| Signature | Actor signature read, sanitized, default enabled flag/per-send override consumed | Same | Already wired. Policy is actor, not per-mailbox signature, and receipt says so. |
| Send-time outgoing attachments | Authorized scoped file bytes; readiness/distribution/parent checks; per-file 3 MiB restriction | Same shared resolver, MIME rendering | No silent dropping, already fixed; aggregate/provider limit needs ML-21. |
| Send receipts / UI refresh | Thread conversation key helps dedup; message is synthetic manual key | Provider message key upsert; narrow update preserves sync provenance | Graph manual-message reconciliation missing. Provider acceptance is not recipient delivery. ML-04. |
| Idempotency / outbox | Durable outreach intent; same-session-only single mail; Meri proposal ledger | Same | Do not erase existing safeguards; close weaker entry points, ML-02/03/23/24. |
| Push callbacks | Mounted GET/POST challenge + subscription/clientState validation | No Gmail watch/Pub/Sub mounted path found | Microsoft-only push. Process-local queue plus periodic fallback, not durable webhook delivery SLA. |
| Subscription renewal | Scheduler invokes create/reuse; lifecycle state recorded | Not applicable to periodic Gmail mode | Removed subscriptions can be reused; reauthorize lifecycle not serviced. ML-15. |
| Retry / timeout / claim recovery | Generic Retry-After retry also affects mutations; no fetch deadline; stale intents become unknown | Read retries bounded by Retry-After; send ambiguity stays unknown; no fetch deadline | ML-02/16. Test transport layer, not adapter stubs alone. |
| Permissions / tenant / client | Caller-owned connection predicates, scoped attachment checks, guarded provider seam | Same | Single-mail client/person preflight and mailbox-key collision risks need ML-07/09. |
| Failure UX | Some errors displayed, ambiguous-send warning, reconnect action | Same | OAuth callback notices, partial sync, reconnect/disconnect and realtime health incomplete. ML-11/13/14/17. |
| System notifications | SES, not Outlook mailbox | SES, not Gmail mailbox | Onboarding/Workspace notification paths are separate. ML-24. |

Matrix evidence: Settings [ML-S01][ml-ML-S01] [ML-S02][ml-ML-S02] [ML-S03][ml-ML-S03] [ML-S04][ml-ML-S04] [ML-S05][ml-ML-S05] [ML-S06][ml-ML-S06] [ML-S07][ml-ML-S07] [ML-S08][ml-ML-S08] [ML-S09][ml-ML-S09] [ML-S10][ml-ML-S10]; OAuth/token [ML-S11][ml-ML-S11] [ML-S12][ml-ML-S12] [ML-S13][ml-ML-S13] [ML-S14][ml-ML-S14] [ML-S15][ml-ML-S15] [ML-S16][ml-ML-S16] [ML-S17][ml-ML-S17] [ML-S23][ml-ML-S23]; provider ingestion [ML-S20][ml-ML-S20] [ML-S21][ml-ML-S21] [ML-S22][ml-ML-S22] [ML-S23][ml-ML-S23] [ML-S24][ml-ML-S24] [ML-S25][ml-ML-S25] [ML-S26][ml-ML-S26] [ML-S27][ml-ML-S27] [ML-S28][ml-ML-S28]; reads/schema [ML-S31][ml-ML-S31] [ML-S32][ml-ML-S32] [ML-S33][ml-ML-S33] [ML-S34][ml-ML-S34] [ML-S35][ml-ML-S35] [ML-S50][ml-ML-S50] [ML-S51][ml-ML-S51] [ML-S52][ml-ML-S52] [ML-S53][ml-ML-S53]; compose/send [ML-S19][ml-ML-S19] [ML-S25][ml-ML-S25] [ML-S29][ml-ML-S29] [ML-S30][ml-ML-S30] [ML-S31][ml-ML-S31] [ML-S32][ml-ML-S32] [ML-S33][ml-ML-S33] [ML-S34][ml-ML-S34] [ML-S35][ml-ML-S35] [ML-S36][ml-ML-S36] [ML-S37][ml-ML-S37] [ML-S38][ml-ML-S38] [ML-S39][ml-ML-S39] [ML-S40][ml-ML-S40] [ML-S41][ml-ML-S41] [ML-S42][ml-ML-S42] [ML-S43][ml-ML-S43] [ML-S44][ml-ML-S44] [ML-S45][ml-ML-S45] [ML-S46][ml-ML-S46]; system senders [ML-S59][ml-ML-S59] [ML-S60][ml-ML-S60] [ML-S61][ml-ML-S61] [ML-S62][ml-ML-S62] [ML-S63][ml-ML-S63] [ML-S64][ml-ML-S64]. Individual links are enumerated in the source index.

### Exact deployment/configuration checklist (read-only evidence now, no activation)

These are task inputs to verify, not requests to create grants, expose secret values or change configuration.

| Owner/path | Exact inputs and propagation to verify | Required evidence |
|---|---|---|
| Both OAuth services | OAUTH_STATE_SECRET; OAUTH_TOKEN_ENCRYPTION_KEY; OAUTH_TOKEN_ENCRYPTION_KEY_VERSION | Secret-reference mapping and readable-version/key-rotation plan; same callback state domain and correct runtime key, without logging secrets. |
| Microsoft OAuth | MICROSOFT_CLIENT_ID, MICROSOFT_TENANT_ID, MICROSOFT_AUTHORITY, MICROSOFT_CERT_THUMBPRINT, MICROSOFT_CERT_PRIVATE_KEY, MICROSOFT_REDIRECT_URI, MICROSOFT_OAUTH_SUCCESS_REDIRECT | Current app registration/certificate metadata and exact registered callback. MICROSOFT_TENANT_ID remains required by capabilities despite organization-authority diagnostics wording; reconcile the contract, not by silently narrowing to one tenant. |
| Microsoft push | MICROSOFT_GRAPH_NOTIFICATION_URL plus callback runtime eligibility | Exact public GET/POST challenge route, subscription inventory and runtime ownership; mere OAuth configured=true is insufficient. |
| Google OAuth | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_OAUTH_SUCCESS_REDIRECT | Exact provider redirect, consent/publishing/test-user restrictions and current required grants. No Pub/Sub inputs are required for existing periodic mode. |
| Sync/worker owner | CAPIRO_SERVICE_NAME; ENGAGEMENT_PROCESS_MODE; ENGAGEMENT_BACKGROUND_OWNER; ENGAGEMENT_EXTERNAL_ACTIONS; ENGAGEMENT_CALLBACKS_ENABLED; ENGAGEMENT_AUTO_SYNC; ENGAGEMENT_SYNC_INTERVAL_MINUTES | One owner, shadow refusal, migration availability and worker health. Source defaults auto-sync=true / interval=20 minutes (accepted range 5–1440); deployed values unverified. Separate Engagement API promotion is an all-fields reviewed posture, not flipping one flag. |
| Outbound files | ASSETS_BUCKET, AWS_REGION_DEFAULT, task S3 permissions, existing scanner/readiness configuration | Both asset name and permissions exist on the selected runtime; provider sender never bypasses quarantine/parent/distribution checks. Promoted Engagement API source already propagates assets. |
| V3 only | OUTREACH_V3_STATE_ENABLED and dependent reasoning/targets/context/generation/drafts/send flags, ENGAGEMENT_GENERATION_GATEWAY, ENGAGEMENT_VERSIONED_OUTREACH | Correct separate app, eligible runtime posture and accepted source qualification. Standard app's ordinary mail does not require automatic V3 activation. |
| System newsletter notifications | NEWSLETTER_REVIEW_EMAIL_ENABLED; NEWSLETTER_INVITATION_EMAIL_ENABLED; NEWSLETTER_REVIEW_APP_URL; WORKSPACE_INVITE_EMAIL_FROM; AWS_REGION_DEFAULT | Both flags default false. Core delivery migrations, Workspace request migrations, verified SES identity/IAM and current UI link path must agree. |
| Onboarding / alerts | ONBOARD_EMAIL_ENABLED, ONBOARD_EMAIL_FROM; TRACKER_ALERTS_ENABLED, TRACKER_ALERT_EMAIL_FROM, TRACKER_APP_BASE_URL; PE_ALERT_EMAIL_TENANTS | Onboarding enabled only by exact true; preserve alert shadow/ownership/canary gates. Confirm the actual scheduler/invoker separately from script existence. |

The Core task secret/URL declarations and separate Engagement API IAM/promotion declarations are present in source. No current AWS inspection was performed; historical routing/config comments do not establish the running environment. [ML-S54][ml-ML-S54] [ML-S55][ml-ML-S55] [ML-S56][ml-ML-S56] [ML-S57][ml-ML-S57] [ML-S58][ml-ML-S58] [ML-S72][ml-ML-S72]

#### Other inspected system-mail consumers, not user-mailbox integrations

- Core Tracker notifications already claim a notification row before dispatch; its older SES adapter collapses failure/uncertainty to failed and does not explicitly disable SDK retries. Intel API has a different SES adapter with maxAttempts=1 and accepted/retryable/terminal/uncertain outcomes, plus source-ownership/shadow gates and durable claims. Verify the selected alert owner and preserve the newer machinery; do not build another notification queue or enable both paths by assumption. [ML-S73][ml-ML-S73] [ML-S74][ml-ML-S74] [ML-S75][ml-ML-S75] [ML-S76][ml-ML-S76]
- PE alert digest is an explicit --commit script guarded by PE_ALERT_EMAIL_TENANTS. It uses an in-memory per-run send plan and a run watermark, not per-recipient durable delivery claims. It catches SES failures but returns errors=0; therefore a successful run watermark is not proof all intended recipients received mail. Runtime invocation is unverified. [ML-S77][ml-ML-S77]
- Demo request notifications also use SES after saving a request, with a separate configured sender/recipient. Failure is reported as “saved but email could not be sent.” This is adjacent public/onboarding infrastructure, not an Outlook/Gmail connection or a selected Portfolio action. [ML-S78][ml-ML-S78]
- No SMTP/nodemailer, IMAP/CalDAV worker, SendGrid or Mailchimp send adapter was found in these inspected application mail paths. This is a source-scope finding, not a claim about every external service the organization operates.

### Closeout tickets

<a id="ml-01"></a>

#### ML-01 — Prove each mail route reaches its intended runtime
**P1; config-held / live-unverified; owner: Platform + Mail backend.**

Source mounts mail integrations in both Core and the separate Engagement API; V3 modules exist only in the latter. The frontend registry/proxy uses Core, while the separate task defaults to shadow/no external actions unless promoted. Checked-in CDK already propagates Core OAuth secret references/URLs and promoted Engagement API callback URLs/assets; those are implemented, not missing. Source comments about “live task” are historical assertions, not current AWS evidence. [ML-S02][ml-ML-S02] [ML-S03][ml-ML-S03] [ML-S04][ml-ML-S04] [ML-S05][ml-ML-S05] [ML-S06][ml-ML-S06] [ML-S07][ml-ML-S07] [ML-S08][ml-ML-S08] [ML-S09][ml-ML-S09] [ML-S10][ml-ML-S10] [ML-S54][ml-ML-S54] [ML-S55][ml-ML-S55] [ML-S56][ml-ML-S56] [ML-S57][ml-ML-S57] [ML-S58][ml-ML-S58]

**Tasks:** produce an exact frontend base -> ingress rule -> app/module -> runtime owner map for start/callback/notifications/sync/mail/send/send-intents/V3. Inspect rendered task environment and secret-reference names, certificate expiry metadata, key version, Google publishing/allowed users and exact provider-registered redirect URLs through a separately authorized operational check, without exposing secret values. Prove one background owner and one callback owner per integration; preserve shadow holds. Ensure public Microsoft notifications support challenge/POST without session redirects. Bind OAuth success redirect to the actual new Settings route. Do not add an `engagement` service alias or promote V3 merely to fix ordinary Core mail.

**Acceptance:** offline app-composition/proxy route tests for both modules and shadow refusal; rendered config/IAM assertions; later authorized test-account OAuth round-trip and notification challenge at the intended host. Dependencies: shared platform route plan, then all live mail acceptance.

<a id="ml-02"></a>

#### ML-02 — Prevent automatic replay of Graph mutations below the send ledger
**P1 confirmed release blocker; owner: Mail provider adapter.**

`graphFetch` retries every method on 429/5xx with small Retry-After, including `POST /me/messages/{draftId}/send`. Ambiguous-send classification runs only after that helper completes. A caller-level “never retry” promise therefore does not guarantee one provider invocation. Current send tests stub `graphPost/graphPostNoContent`, bypassing precisely this retry code. [ML-S19][ml-ML-S19] [ML-S24][ml-ML-S24] [ML-S65][ml-ML-S65]

**Tasks:** add explicit retry semantics to the existing Graph transport: read-only retries allowed; create/send mutations default no replay after dispatch. A definite pre-acceptance rejection may be a new explicit attempt only under ledger policy, not generic HTTP recursion. Keep draft creation and send separate, preserve draft/correlation evidence, and classify unknown at the actual network boundary. Apply this to ordinary compose, Meri, durable outreach and newsletter through the shared adapter.

**Acceptance:** real helper with fake fetch receives send 500/429 + Retry-After, response loss, socket close, malformed result; assert exactly one send POST and unknown/definite failure as appropriate. GET retry tests remain. No live send needed for this test. Dependency: none; precedes ML-03/04/05 and any send release.

<a id="ml-03"></a>

#### ML-03 — Give single-mail an actor-scoped durable dispatch identity and recovery receipt
**P1 confirmed release blocker; owner: Mail backend + Portfolio frontend.**

Single-mail sends before saving any receipt and accepts no request key; frontend's random attempt lock is React Query memory with infinite cache lifetime, not a server ledger or cross-tab/reload guarantee. A 30-second proxy timeout, reload, second tab or process failure can lose the only lock. Backend correctly warns on ambiguity/receipt loss, but there is no durable lookup to resume. Existing outreach intents already implement the relevant claim/unknown pattern. [ML-S03][ml-ML-S03] [ML-S30][ml-ML-S30] [ML-S38][ml-ML-S38] [ML-S44][ml-ML-S44] [ML-S45][ml-ML-S45] [ML-S46][ml-ML-S46]

**Tasks:** extend the existing mail domain with a bounded single-message intent/receipt record or shared low-level delivery primitive, not a new platform and not fake campaign records. Bind tenant+actor+request key to exact mailbox, reply target, recipients including Bcc, subject/body hash, signature policy/content snapshot and attachment manifest. Commit pending then claim before provider dispatch. Expose owned status/read receipt; never recycle sending/unknown to pending automatically. Replay same key returns existing state; different content same key conflicts. UI retains intent ID and resumes/polls after navigation/reload, distinguishes safely rejected from unknown, and offers reconciliation rather than blind retry. Persist provider acceptance even if current visibility is later revoked, while withholding body/details from unauthorized reads.

**Acceptance:** concurrent duplicate requests/processes, reload/cross-tab, timeout before/after dispatch, failure after provider acceptance before DB commit, revoked client permission and changed sender. At most one irreversible send dispatch per intent; zero sends on preflight/authority rejection; unknown remains fenced pending reconciliation and survives restart. This is not an exactly-once delivery claim. Graph draft creation and send are separate provider calls. Reuse Core104's post-provider outcome-persistence principle, not its legacy campaign function as a substitute. [ML-S68][ml-ML-S68]

<a id="ml-04"></a>

#### ML-04 — Reconcile Graph immediate sent rows with authoritative mailbox ingestion
**P1 confirmed release blocker; owner: Mail persistence + Graph adapter.**

Single-mail intentionally uses `manual:<uuid>` for Graph messages because it lacks a Graph message ID. Thread-level conversation-key dedup is already implemented. The message's metadata stores no provider draft ID, internet Message-ID or delivery correlation; sync therefore creates a second provider row and cannot retire/update the manual row after deletion or correction. Gmail real-ID upsert and narrow metadata-preserving update are already implemented and must remain. [ML-S19][ml-ML-S19] [ML-S22][ml-ML-S22] [ML-S30][ml-ML-S30]

**Tasks:** preserve stable provider evidence from the existing adapter in the durable receipt. Select one authoritative Graph reconciliation strategy after contract verification: immutable-ID handling and/or authenticated Sent Items resolution using exact delivery correlation/internet Message-ID plus mailbox. Never label an RFC Message-ID as a Graph item ID. Reconcile into one logical message with safe reference migration/alias handling, retaining attachment links and existing thread URLs; do not delete ambiguous unmatched records. Add read-state distinction “accepted, awaiting mailbox confirmation.” Backfill only deterministically provable old duplicates, report the rest.

**Acceptance:** webhook arrives before receipt, after receipt, repeated sync, moved sent message, later deletion, connection disconnect, two mailboxes, identical subject/body. One visible message and stable links, preserved source metadata/body, no false delivered claim. Dependencies ML-02/03/09.

<a id="ml-05"></a>

#### ML-05 — Implement actual provider reply semantics before enabling reply everywhere
**P1 confirmed gap; owner: Mail backend + Portfolio.**

`sendSingleMail` enforces originating mailbox and local thread ownership, but passes only subject/body/recipients to sender. Graph creates a new message; Gmail posts only raw MIME without provider thread identity or In-Reply-To/References. Merely adding “Re:” or appending to a local thread does not implement a provider reply. [ML-S19][ml-ML-S19] [ML-S25][ml-ML-S25] [ML-S30][ml-ML-S30]

**Tasks:** add an explicit reply mode and exact original message identity to existing DTO/sender contracts. Re-resolve active owned message/thread/mailbox server-side; validate recipient/reply-all policy excluding self and preserving intentional Cc/Bcc rules. Use provider-native reply creation on Graph and correctly threaded Gmail payload/headers. Store provider-returned thread/message identity and reconcile when it differs from historical local association. Until complete, change Contact Reply wording/disable real reply rather than presenting new-message delivery as threaded reply.

**Acceptance:** incoming vs last-outgoing message, reply-all, self aliases, multiple senders, deleted original, forwarded copy, same subject unrelated conversations, provider conversation returned different, sync-before-receipt. Confirm a true threaded reply in later approved test mailboxes. Dependencies ML-02/03/04/07/09; Timeline wiring follows ML-20.

<a id="ml-06"></a>

#### ML-06 — Align legacy Meri mail actions with reviewed sender and original thread
**P1 confirmed behavior gap; owner: Meri action boundary + Mail backend.**

Legacy Meri chooses Microsoft-preferred newest connected mailbox independently of requested thread. `reply_email` selects latest message by sentAt without active-message filtering, replies to its fromEmail (possibly self), and invokes new-send without original identity or proposal correlation. Its durable action-proposal claim/unknown handling already exists and should be preserved. Scheduled briefing mail also uses the implicit selector. [ML-S47][ml-ML-S47] [ML-S48][ml-ML-S48] [ML-S49][ml-ML-S49]

**Tasks:** extend reviewed action proposals with exact senderConnectionId and original active message/thread where applicable; include sender in preview and fingerprint. Route legacy reply through the corrected shared reply boundary; choose the intended incoming counterpart, not latest row blindly. Carry proposal ID as correlation for replies as for send_email. Scheduled briefing delivery should retain the selected authorized sender at schedule creation or explicitly show the deterministic policy, and never silently switch sender when one account disconnects. Keep canonical retained mail family read-only.

**Acceptance:** two providers, two same-provider accounts, latest outgoing message, removed message, revoked mailbox, mailbox change between approval and execute, proposal replay and crash. Ensure no provider call on stale authority. Dependencies ML-02/05; shared Meri authority work.

<a id="ml-07"></a>

#### ML-07 — Complete server-side client/person preflight before irreversible single-mail send
**P1 confirmed missing explicit preflight; owner: Mail backend + Portfolio access policy.**

The server checks thread ownership/originating connection and attachment access, but `sendSingleMail` does not explicitly load/authorize input client/person associations before provider dispatch. Attachment validation returns immediately when no attachment IDs exist. Thread preflight selects id/connectionId, not client binding; the frontend currently enforces the client relation, which direct API callers can bypass. Later persistence failure is too late to stop a sent message. [ML-S30][ml-ML-S30] [ML-S42][ml-ML-S42]

**Tasks:** before ledger creation/dispatch, resolve current client visibility and allowed operation using the same Portfolio policy; validate person IDs and their client/tenant membership, client/thread association semantics including recipient-derived histories, and source-document distribution. Recheck relevant mutable authority immediately before claim/send. Do not prohibit valid recipient-derived null-client histories accidentally. Ensure private inbox ownership does not silently grant access to a revoked client.

**Acceptance:** no attachments, nonexistent/foreign/archived client, inaccessible same-tenant client, foreign person IDs, recipient-derived thread vs directly assigned thread, grant revoked during attachment fetch. Assert zero provider calls on every rejection. Dependencies shared client policy; donor Core104 contains related outreach access hardening but not a complete single-mail fix.

<a id="ml-08"></a>

#### ML-08 — Make adding versus reconnecting a mailbox identity-safe
**P1 confirmed unsafe transition; owner: OAuth services + Settings.**

Top-level Connect submits an empty body; OAuth start selects the newest existing caller/provider row when accountEmail is absent. Callback overwrites row accountEmail/homeAccountId with the chosen account and retains old sync state; an omitted new refresh token can preserve the prior row's refresh token. Selecting account B while reconnecting A can therefore change the identity underneath A's cursors/history. [ML-S01][ml-ML-S01] [ML-S12][ml-ML-S12] [ML-S13][ml-ML-S13] [ML-S14][ml-ML-S14] [ML-S15][ml-ML-S15]

**Tasks:** distinguish create-new from reconnect-existing explicitly. Bind OAuth state to expected connection/provider/actor/identity intent. Reconnect must prove the same stable provider account ID, otherwise refuse with a clear “add another mailbox” flow; adding another creates an independent row. Never retain a previous account's refresh token or cursors after identity changes. Handle existing same-account unique conflicts transactionally, with no cross-owner takeover. Confirm the actual account before showing connected.

**Acceptance:** A->A reconnect without new refresh token, A->B attempted replacement, two concurrent starts, callback for deleted row, registered account email differs, same email identity changed, duplicate existing mailbox. No cursor/history/token crosses identities. Dependencies ML-11/25.

<a id="ml-09"></a>

#### ML-09 — Mailbox-qualified persistence identity
**P1 residual cross-mailbox integrity risk; owner: Mail persistence/schema.**

MailThread and MailMessage uniqueness is `tenantId, source, externalId`, not connection/mailbox. Sync looks up those keys and updates connection association. This is unsafe if provider IDs collide across mailboxes or one message's identifier is reused across imported accounts; provider-wide uniqueness across every mailbox is not proven by this schema. Current single-mail upsert has an additional connection/thread mismatch check, but provider sync needs the same invariant. [ML-S22][ml-ML-S22] [ML-S35][ml-ML-S35]

**Tasks:** reproduce with synthetic two-mailbox same-ID fixtures. Adopt mailbox-qualified keys or a stable mailbox-lineage namespace after reviewing reconnect semantics; at minimum fail closed on mismatched existing connection rather than reassigning it. Migrate indexes and all readers/upserts/removal/reconciliation paths together; preserve historical URLs and disconnected lineage. Do not mass reassign ambiguous old rows.

**Acceptance:** same tenant different owners, same owner two accounts, same provider message/thread IDs, shared-message copies, reconnect and deletion. No row or attachment transfers ownership; reader remains owner-scoped. Dependency ML-08/17; blocks trusting ML-04 reconciliation.

<a id="ml-10"></a>

#### ML-10 — Remove wrong-account token-cache fallback and prove refresh concurrency
**P1 confirmed fallback defect plus residual concurrency risk; owner: Microsoft OAuth/token.**

Both refresh-token selectors return the last cache entry if an expected homeAccountId has no match, contrary to the OAuth selector's stated exact-account guarantee. Initial OAuth uses a fresh MSAL instance, but refresh uses a shared instance/cache; concurrent account refreshes widen the risk. No exploit is asserted. [ML-S11][ml-ML-S11] [ML-S23][ml-ML-S23]

**Tasks:** exact expected-account match or fail closed; only permit single-entry fallback if account identity is truly absent and independently verified. Isolate cache per refresh/connection or serialize guarded refresh with a durable version/CAS update. Bind returned access-token account/scopes to the connection before writing. Prevent late refresh from resurrecting disconnected/replaced connection or overwriting a newer rotated token.

**Acceptance:** unmatched home ID with several cache entries, simultaneous two-account refresh, rotated token races, refresh after disconnect, stale callback. No wrong-account token persisted or returned. Dependencies ML-08/25.

<a id="ml-11"></a>

#### ML-11 — Consume OAuth outcomes in Settings
**P2 confirmed UX gap; owner: Settings frontend + callback controllers.**

Callbacks emit provider/error/connected/connectionId/admin-consent query parameters, but current Settings page/screen/integration component does not consume them. Google exchange errors redirect; Microsoft exchange failures can escape as raw endpoint errors. Success/error/admin-consent results therefore disappear or strand the user away from Settings. [ML-S01][ml-ML-S01] [ML-S09][ml-ML-S09] [ML-S10][ml-ML-S10]

**Tasks:** parse a bounded allowlisted callback result, reconcile against freshly loaded owned connection, display success/cancel/denied/admin-consent/reconnect/error states, and clear transient query parameters. Do not trust query text as a connected receipt or render unsanitized provider details. Add equivalent safe Microsoft exception-to-return handling; do not leak secrets from provider errors.

**Acceptance:** granted, denied, cancelled, missing code/state, expired/tampered state, wrong connection, provider exchange failure, admin consent only and duplicate callback. Success requires list-read confirmation; refresh does not repeat toast/action. Dependencies ML-08/12.

<a id="ml-12"></a>

#### ML-12 — Separate requested scopes, actual grants and runtime capability
**P2 confirmed observability/contract gap; owner: OAuth backend + Settings.**

Canonical requested scopes are written to token/connection rows. Microsoft refresh logs insufficient resource scopes but can keep connected; Google initial denial check is good but refresh stamps canonical scopes. Settings permissions can therefore look authoritative when they are not. OAuth “configured” does not include notification URL/runtime eligibility. Generic Engagement capabilities also hardcode campaignSendingProvider=microsoft_365 despite Gmail routing. [ML-S01][ml-ML-S01] [ML-S14][ml-ML-S14] [ML-S16][ml-ML-S16] [ML-S23][ml-ML-S23] [ML-S71][ml-ML-S71]

**Tasks:** represent requested/granted/last-verified scope separately, classify missing read/send/calendar permissions, and provide actionable reconnect/admin-consent reasons. Extend existing capabilities with per-action configured/allowed/held reason and Microsoft push readiness. Correct generic provider metadata or deprecate unused misleading fields, without replacing provider-specific endpoints.

**Acceptance:** partial Google consent, older Microsoft token missing Mail.ReadWrite/Send, scope revoked after connection, runtime shadow, missing notification URL, valid Gmail-only sender. No optimistic “permissions granted” claim from requested list alone. Dependencies ML-01/13.

<a id="ml-13"></a>

#### ML-13 — Preserve permanent reconnect state through sync failure
**P1 confirmed status-transition bug; owner: both provider sync/token services.**

Google invalid_grant and Microsoft interactive-consent errors mark needs_configuration, then throw. Outer sync catch unconditionally calls markSyncError, overwriting that with error and a 15-minute retry hint. Scheduler selects error rows, so revoked credentials can remain on a retry loop instead of an explicit reconnect hold. [ML-S16][ml-ML-S16] [ML-S23][ml-ML-S23] [ML-S24][ml-ML-S24] [ML-S26][ml-ML-S26] [ML-S27][ml-ML-S27] [ML-S28][ml-ML-S28]

**Tasks:** use typed sync/token errors and a single transition policy distinguishing transient, needs-reconnect, mailbox-not-enabled, permission-denied and disconnected. Preserve terminal/reconnect state and stop automated redemption until owner reconnects; retain safe diagnostics. Let UI retry transient sync without forcing new OAuth, but not invalid grants.

**Acceptance:** real top-level sync invocation with fake token exchange invalid_grant/consent required, not only token-service unit test. Final row remains reconnect-required, excluded from scheduler claims; reconnect restores scheduled eligibility. Dependencies ML-12/17.

<a id="ml-14"></a>

#### ML-14 — Report mail-specific partial health and backfill progress
**P2 confirmed truthfulness gap; owner: sync backend + Settings.**

If calendar succeeds and mail hits a transient error, both sync services may return success without mail, set connected/lastSyncAt and clear lastError. This intentionally avoids falsely calling calendar failure, but Settings then reports “Connection sync completed”/“Synced just now.” Settings inspects failed counts only, not missing mail, hasMore, cursor backlog or mailbox coverage. Existing detailed coverage is available to assistant readers but not surfaced here. [ML-S01][ml-ML-S01] [ML-S20][ml-ML-S20] [ML-S26][ml-ML-S26] [ML-S27][ml-ML-S27] [ML-S28][ml-ML-S28] [ML-S32][ml-ML-S32]

**Tasks:** persist/return per-resource attempted/succeeded/error/lastSuccess/continuation state; distinguish connected authorization from sync health. Show partial mail failure, catch-up in progress, last complete mail sync, scope/window, auto-sync schedule and explicit safe retry. Preserve durable continuations; do not loop unboundedly in browser. Make manual reset a clearly distinct advanced action with server authority and recovery evidence.

**Acceptance:** calendar success/mail429, mail success/calendar failure, page/quota cap, failed record, expired history/delta reset, empty mailbox, deleted folder and long initial catch-up. UI never equates connection timestamp with complete mail coverage. Dependencies ML-13/16.

<a id="ml-15"></a>

#### ML-15 — Complete Microsoft subscription lifecycle recovery
**P1 confirmed lifecycle gap; owner: Graph integration + runtime operations.**

subscriptionRemoved only sets configured=false; it retains subscriptions. configureSubscriptions ignores configured and can reuse a future-dated removed entry. reauthorizationRequired is recorded but no reauthorize action is performed. Near-expiry renewal currently creates replacements rather than updating/retiring old subscriptions, and multiple triggers are not serialized around subscription creation. [ML-S18][ml-ML-S18] [ML-S20][ml-ML-S20] [ML-S24][ml-ML-S24] [ML-S28][ml-ML-S28]

**Tasks:** invalidate/remove the exact removed subscription ID, implement provider-supported reauthorization/renewal or deliberate recreate-and-retire, serialize per-mailbox resource subscription reconciliation, and persist each resource outcome so partial creation does not leak untracked subscriptions. Expose expiry, last notification, last renewal, lifecycle failure and periodic fallback health. Preserve signed clientState matching. Reconcile missed notifications via cursor sync. Decide whether process-local notification queue plus periodic repair satisfies the product SLA; add durable queue only if required.

**Acceptance:** removed while unexpired, missed, reauthorizationRequired, one of two resources fails, duplicate callback, forged clientState, wrong subscription/tenant, concurrent scheduler/manual renewal, restart after accepted notification. Later authorized live challenge/expiry recovery test. Dependencies ML-01/10/16.

<a id="ml-16"></a>

#### ML-16 — Bound provider calls and make sync claim lifetime match execution
**P1 residual reliability risk; owner: provider transport + sync scheduler.**

Provider fetches do not have explicit AbortSignal/deadlines. Scheduler handles claimed mailboxes sequentially with an in-process busy guard and uses nextSyncAt as lease; one hung call can stall a process, and a call exceeding its lease can overlap another process/manual/webhook sync. Transaction-level persistence locks do not prove the entire token/cursor operation is serialized. [ML-S24][ml-ML-S24] [ML-S27][ml-ML-S27] [ML-S28][ml-ML-S28]

**Tasks:** introduce per-call and total sync budgets into existing transports; classify send timeout as unknown, read timeout as retryable. Give each sync a durable claim token/version or equivalent serialization across manual/scheduler/webhook entry points; cursor/state commit must reject stale owners. Release/reschedule transient work safely, retain pending page state, and use bounded jitter/backoff rather than resetting all mailboxes together. Refresh/network cancellation should not advance cursors.

**Acceptance:** never-resolving fetch, process crash, lease overrun, manual+webhook+scheduler concurrency, stale state commit, multi-replica renewal, disconnect during work. Other mailboxes progress; no regression of cursor/removal state. Dependencies ML-13/15.

<a id="ml-17"></a>

#### ML-17 — Make disconnect available and explain retained-data semantics
**P2 confirmed UI/contract gap; owner: Settings + mailbox lineage.**

Backend disconnect supports errored/stale connections, but UI shows Disconnect only for connected rows and disables Sync on error. Deleting the connection sets message/thread connectionId null; owner predicates require a connection owner, so physically retained records become unreadable through these mail surfaces. The dialog only says existing records are kept. Microsoft local disconnect intentionally does not revoke the upstream app grant. [ML-S01][ml-ML-S01] [ML-S13][ml-ML-S13] [ML-S15][ml-ML-S15] [ML-S33][ml-ML-S33] [ML-S34][ml-ML-S34] [ML-S35][ml-ML-S35]

**Tasks:** allow owner disconnect for any existing state; offer transient retry separately from reconnect. Define retained-history policy explicitly: either retain owner/mailbox lineage independently so historical read stays authorized, or state that history disappears from mail views until a supported recovery. Never broaden to tenant-wide history access. Expose Microsoft user/admin grant-removal guidance and Google's best-effort revoke outcome honestly. Decide whether reconnect can recover prior lineage only with proof of same stable account.

**Acceptance:** error/needs_configuration disconnect, revoke failure, orphaned history, repeated delete, reconnect same/different mailbox, reader permission after deletion. Dependencies ML-08/09/13.

<a id="ml-18"></a>

#### ML-18 — Close mail UI pagination/search/completeness and bound thread reads
**P2 confirmed gap; owner: Mail read API + Portfolio.**

Contact list fetch returns at most 50 threads, no cursor/hasMore; UI has no route to older results/search. Each list embeds only three messages; detail loads all messages in DB with no page bound. Frontend schema strips body completeness/truncation and renders text as if that is the stored whole body. Assistant list/search is already bounded with asOf, offset, mailbox coverage and continuation, but thread output slices only after the full DB read. [ML-S31][ml-ML-S31] [ML-S32][ml-ML-S32] [ML-S36][ml-ML-S36] [ML-S50][ml-ML-S50]

**Tasks:** extend existing read contracts with stable bounded thread/message cursors, explicit hasMore and coverage/completeness; UI Load more/search/date/folder controls only within authorized scope. Reuse mail-query filtering semantics, do not build a second global inbox engine. Push thread pagination to DB while preserving active-message order and current mailbox authorization; keep assistant body continuation exact. Distinguish no matches, still importing, truncated body and unavailable body.

**Acceptance:** >50 threads, >3 messages, very large thread, deleted/reordered message between pages, stable asOf filters, incomplete backfill and removed account. No silent “all history” claim; no unbounded response/proxy failure. Dependencies ML-14/17.

<a id="ml-19"></a>

#### ML-19 — Resolve incoming attachment support explicitly
**P2 product boundary; owner: Product + Mail/files.**

Sync persists hasAttachments and message bodies, but no active general incoming-file ingestion/download UI chain was found. Gmail's body attachment retrieval is for MIME body content, not a general inbox-file attachment feature. Outgoing upload/send attachments are real and must not be reimplemented. [ML-S21][ml-ML-S21] [ML-S27][ml-ML-S27] [ML-S35][ml-ML-S35] [ML-S41][ml-ML-S41] [ML-S42][ml-ML-S42]

**Tasks:** if inbound files are in scope, add owner-scoped provider attachment manifest/read endpoint on the existing message identity, then reuse existing quarantine/scanning/storage/access/distribution pipeline before exposing downloads or attaching to outgoing mail. Support inline/CID separately from real file attachments; bound bytes, content types, redirects and duplicate IDs. Otherwise show a truthful “open original mailbox for attachments” boundary, not an empty attachment area that implies none exist.

**Acceptance:** malicious/quarantined file, inline image, oversized file, nested MIME, revoked mailbox, cross-user message, deleted original, duplicate fetch and file reuse in forward. No external provider credential is sent to browser. Dependencies ML-09/18/21.

<a id="ml-20"></a>

#### ML-20 — Decide draft persistence, forward and Timeline reply product scope
**P2 explicit product boundary, with known Timeline gap; owner: Portfolio + Mail.**

Compose state is local; no save/list/delete provider draft or first-class forward path exists in the inspected active UI/controller surface. Graph draft creation is an implementation detail during send, not user draft persistence. Timeline deliberately provides review-only reply preparation with a visible unavailable explanation. [ML-S19][ml-ML-S19] [ML-S39][ml-ML-S39] [ML-S40][ml-ML-S40]

**Tasks:** decide per surface whether the supported outcome is compose-and-send, saved local Capiro draft, provider draft, or external mailbox handoff. For selected draft support, persist actor/client/mailbox binding with version/CAS and explicit restore/discard semantics, not silent localStorage carrying across identities. For forward, define original/attachment provenance and reviewed recipients. Enable Timeline sends only through the same corrected shared mail boundary, not a second sender. If these remain unsupported, retain clear UI boundaries and no dead actionable controls.

**Acceptance:** route change/reload, actor/client switch, stale draft version, changed signature, original deleted, forward attachment permissions, Timeline reply/reply-all threading. Dependencies ML-03/05/07/19; do not claim current blocking text is an accidental disconnected handler.

<a id="ml-21"></a>

#### ML-21 — Validate aggregate outgoing payload limits before provider dispatch
**P2 residual provider-compatibility risk; owner: shared mail attachments.**

The same loader permits multiple 3-MiB files and base64-encodes each; UI limits count but no aggregate encoded-message/provider-envelope budget was found. A per-file limit is not proof that combined Graph JSON or Gmail MIME fits provider limits. Source already refuses oversize/quarantined files instead of silently dropping them. [ML-S39][ml-ML-S39] [ML-S42][ml-ML-S42] [ML-S19][ml-ML-S19] [ML-S25][ml-ML-S25]

**Tasks:** verify current provider limits from official docs during implementation; codify a conservative per-provider aggregate size check including encoding/body/headers before claim/dispatch. Align capability and UI errors. Offer an existing authorized document link for larger files; add chunked provider upload only if explicitly chosen product scope.

**Acceptance:** multiple individually-valid files exceeding aggregate, Unicode filename/MIME overhead, large HTML/signature, duplicate attachment IDs, changed file bytes after readiness. No partial send and no silent omission. Dependencies ML-03/19.

<a id="ml-22"></a>

#### ML-22 — Integrate canonical Meri mail composition without mistaking source presence for activation
**P1 held integration/qualification work; owner: Meri runtime + Core authority.**

Current main contains real canonical read adapters/handlers and Core stored-mail readers. Meri PR189's complete read-family composition is not wholly contained in main; comparison shows main ahead 15/donor ahead 8. Aggregate PR197 is 29 commits ahead of current main and receives that work. Read-only source presence alone does not prove installed handlers, current authority and source measurements are wired into a deployed runtime. [ML-S50][ml-ML-S50] [ML-S51][ml-ML-S51] [ML-S52][ml-ML-S52] [ML-S53][ml-ML-S53]

**Tasks:** review/receive the already-written donor composition through the existing aggregate path, retain exact operation descriptors and measured source hashes, bind explicit canonical endpoints and scoped credential/currentness provider, and prove installation receipt resolves only read-only operations. Do not bypass held gates or re-create mail read handlers. Coordinate Core delegated authority/ingress source already tracked in the platform plan.

**Acceptance:** exact end-to-end mocked runtime installation -> authenticated Core route -> owned mailbox page -> continuation/proof validation; stale actor/client/mailbox scope, altered source measurement, tampered continuation, expired authority and incomplete coverage all refuse/restrict correctly. Later live-read qualification requires separately approved runtime configuration, not a mail send. PRs: https://github.com/neo-capiro/meri-greenfield/pull/189 and https://github.com/neo-capiro/meri-greenfield/pull/197.

<a id="ml-23"></a>

#### ML-23 — Keep legacy send paths deliberately gated through V3 cutover
**P1 activation contract / residual bypass risk; owner: Engagement + Platform.**

Legacy raw-body campaign/batch send paths remain conditionally callable when ENGAGEMENT_VERSIONED_OUTREACH is false; source explicitly closes them under that flag. V3 promoted task sets versioned outreach/generation flags, but ordinary Core defaults and deployed routing must be checked separately. A UI migration alone does not retire authenticated callable routes. Tests that send to “self” still send real mail. [ML-S55][ml-ML-S55] [ML-S57][ml-ML-S57] [ML-S67][ml-ML-S67]

**Tasks:** enumerate all send entry points (single, legacy campaign/batch, durable intents, newsletter, Meri/scheduled briefing) and their actual runtime/action policy. Decide and document compatibility support; reject retired external raw-body routes server-side when cutover is complete, without accidentally disabling selected single-contact compose. Preserve audited version checks for V3; verify worker sweeps and hidden internal records follow the existing boundaries. Reuse Core104 outcome persistence/access repair before activation, with no blind aggregate merge assumption.

**Acceptance:** direct HTTP invocation for every legacy route under both module/runtime postures, feature combinations, role and ownership; test-mode recipient enforcement; duplicate/unknown replay. No route relies solely on UI being absent. Dependencies ML-01/02/03 and platform V3 route plan.

<a id="ml-24"></a>

#### ML-24 — Separate system-mail activation and close weaker SES delivery claims
**P1 confirmed onboarding dedupe defect; P2/config-held notification UI work; owner: Onboarding/Workspace + Platform.**

Newsletter review/invitation workers already commit durable claims before SES, set SDK maxAttempts=1, recheck current authority, and convert stale sending to outcome_unknown. Their default-off flags and request-producing UI are separate workspace work. Ordinary WorkspaceCollabEmailService is best-effort SES without a durable ledger. Onboarding EmailService reads the dedupe log, calls SES, then inserts the unique log; concurrent calls can both send before one loses P2002. “Unique log” is therefore not at-most-once sending. Disabled onboarding mail records a disabled receipt, which must not appear as actually delivered or be silently confused with a prior real send when the flag later changes. [ML-S61][ml-ML-S61] [ML-S62][ml-ML-S62] [ML-S63][ml-ML-S63] [ML-S64][ml-ML-S64]

**Tasks:** keep correct newsletter workers; wire existing request/status/cancel UI and ACL fixes through Workspace plan. Verify NEWSLETTER_REVIEW_EMAIL_ENABLED, NEWSLETTER_INVITATION_EMAIL_ENABLED, NEWSLETTER_REVIEW_APP_URL, WORKSPACE_INVITE_EMAIL_FROM, SES region/identity/IAM and request/delivery tables together. For onboarding and any ordinary invitation action requiring replay safety, commit an owned delivery claim before SES, explicitly bound SDK retries, record acceptance/unknown separately from notification creation, and expose accurate sent/skipped/disabled/unknown result. Reuse current newsletter delivery pattern. Newsletter external campaign sending remains the OAuth durable-send-intent route, not SES notification transport.

**Adjacent consumers:** for any still-active legacy Core Tracker/PE digest sender, preserve existing alert preferences and claims but add explicit accepted/failed/unknown delivery evidence and no automatic replay of uncertain acceptance. For PE digest, do not mark the entire window successfully delivered after caught per-recipient send errors; retain pending/failed/unknown recipients durably or explicitly document a best-effort non-retry policy. Prefer the existing Intel delivery owner where its cutover is already approved, not a parallel replacement. Demo-request notification reliability is an adjacent follow-up only if selected into this release. [ML-S73][ml-ML-S73] [ML-S74][ml-ML-S74] [ML-S75][ml-ML-S75] [ML-S76][ml-ML-S76] [ML-S77][ml-ML-S77] [ML-S78][ml-ML-S78]

**Acceptance:** simultaneous same dedupe key, retry after acceptance/log failure, crash, disabled flag, invalid sender identity, recipient access revoked, stale request, SDK timeout, receipt rendering. Verify no automatic resend from unknown. Activation/live tests only with approved recipients and explicit sending approval. Dependencies Workspace action/ACL plan, ML-01 for shared operations only.

<a id="ml-25"></a>

#### ML-25 — Qualify OAuth replay, identity claims and encryption-key rotation
**P2 residual hardening/operational risk; owner: OAuth + Platform security.**

Signed OAuth state has expiry and random nonce but nonce is not durably consumed; authorization-code single-use is a mitigation, not proof of a complete local replay/session binding contract. Google identity extraction trusts the server token response payload and can return empty claims; keyVersion is persisted while TokenCrypto currently decrypts with the single configured key. This audit did not access credentials or test attacks. [ML-S12][ml-ML-S12] [ML-S14][ml-ML-S14] [ML-S15][ml-ML-S15] [ML-S17][ml-ML-S17]

**Tasks:** use bounded one-time state consumption bound to actor/provider/connection intent, verify mandatory stable account/issuer/audience/email identity assumptions as applicable, and fail closed before marking an unidentified mailbox connected. Define a safe key-ring or explicit re-encryption/reconnect rotation procedure honoring persisted keyVersion; do not rotate an env key without migration/recovery. Avoid credential/token values in logs and callback errors.

**Acceptance:** expired/tampered/reused state, callback cross-browser/actor intent, empty/malformed provider claims, code replay, two concurrent valid callbacks, old/new encrypted-token versions, rotation rollback and unreadable ciphertext. Dependencies ML-08/10/11.

<a id="ml-26"></a>

#### ML-26 — Make unsupported IMAP and consumer-provider scope truthful
**P2 product/metadata boundary; owner: Settings + integration owner.**

UI permits IMAP/CalDAV registration but explicitly disables OAuth/manual sync/disconnect and says server configuration is required. No active IMAP/CalDAV adapter/controller/job was found in the inspected application source tree. Generic capabilities says requires_server_credentials, which is not evidence that supplying credentials would create ingestion. Microsoft defaults to organization accounts. [ML-S01][ml-ML-S01] [ML-S58][ml-ML-S58] [ML-S71][ml-ML-S71]

**Tasks:** label IMAP/CalDAV as unsupported/external unless an actual separately owned ingestion service is identified and verified. If external, document its exact contract, owner, health signal and record attribution; don't invent a credential form for absent code. Clarify Microsoft 365 work/school scope and Gmail/Google Workspace account eligibility. Build additional providers only after an explicit product decision; leave no misleading “just configure credentials” promise.

**Acceptance:** unsupported provider registration does not claim connected/syncable; connect buttons/labels match capabilities; no accidental fallback of an unsupported provider to Graph sender. No broad new integration platform is needed for this closeout.

### PR/source disposition: reuse rather than duplicate

- Frontend mail [PR14](https://github.com/neo-capiro/capiro-frontend/pull/14) (signature preview/rewrite undo) and [PR17](https://github.com/neo-capiro/capiro-frontend/pull/17) (caret handling) remain open but their heads are fully contained in current main according to commit comparison. Do not plan to merge or reimplement those fixes.
- Main already contains owned mailbox selection, thread authorization before send, client lifetime checks, send review, outgoing attachment readiness/authorization, signature append, thread-level provider-key dedup, Gmail real-message upsert, narrow sync-metadata preservation and postaccept receipt-loss warning.
- Main already contains both providers' automatic sync, Graph folder/delta history, Gmail backfill/history/deletion recovery and assistant mail coverage output.
- Backend [Core104](https://github.com/neo-capiro/capiro-backend/pull/104) at `5bf901173e839c0145069ec42e16dcb40c373ba6` has additional outreach access/cleanup/ingress work and preserves provider outcome despite later access change in legacy sendCampaign. Review/reuse it. It is **not** proof that ML-02/03/04/05 are fixed. [ML-S68][ml-ML-S68]
- Meri189 is diverged; Meri197 is the current aggregate receiving it. Integrate/qualify existing composition instead of rewriting read tools. Neither source comparison nor open PR status proves deployment.
- Historical capirov2 is not needed to recreate provider code already present in active repositories. Old UI and old monolithic controllers are reference material, not current runtime owners.

### Dependency-ordered implementation sequence

1. **Inventory and hold:** ML-01 route/owner map, ML-22 donor composition disposition, ML-23 compatibility inventory; preserve current shadow/default-off gates. Obtain product decisions for ML-19/20/26 without blocking safety fixes.
2. **No duplicate/wrong-mailbox effects:** ML-02 transport no-replay, ML-07 client preflight, ML-08 account identity, ML-10 strict refresh binding, ML-13 reconnect transition. Reproduce ML-09 and ML-16 risks with deterministic tests.
3. **Durable mail identity:** ML-03 intent/receipt, ML-09 namespace/lineage, ML-04 Graph reconciliation, ML-17 retained-history policy. Use current provider adapters and existing transactional patterns.
4. **Correct recipient-visible behavior:** ML-05 native replies, ML-06 Meri actions, selected ML-20 Timeline/draft/forward work, ML-21 size budget.
5. **Reliable freshness and honest UX:** ML-15 lifecycle, ML-16 bounded sync ownership, ML-14 health, ML-11 callbacks, ML-12 permission capability, ML-18 pagination/completeness.
6. **Separate system-mail release:** ML-24 SES claims/flags and Workspace request UI/ACL work. Qualify ML-25 rotation/replay behavior before credential operations.
7. **Operational acceptance:** only after source tests pass and authorized runtime proof exists. No live external sending is authorized by this audit.

### Acceptance plan: mocked, local integration and later live evidence

#### What existing tests prove and do not prove

The inspected Graph send test constructs the service prototype and substitutes authorization/token helpers and Graph POST methods. It checks draft/send ordering and receipt/ambiguity behavior, **not** the actual generic retry helper, OAuth, real Graph identity/thread behavior or deployment. Gmail tests replace global fetch and token loading, proving MIME/receipt/error handling with synthetic provider responses, not a live grant. Frontend browser mail tests use deterministic routed fixtures. No tests were executed in this audit. [ML-S65][ml-ML-S65] [ML-S66][ml-ML-S66]

#### Required offline/mock suite, both providers

- Actual mounted controller + runtime guard + actor/tenant role context + DTO validation + provider transport fake, not disconnected service-only stubs.
- Same actor/two clients, same tenant/two users, two accounts/provider, two providers, absent/expired connection, wrong sender, client revocation and no-attachment direct API cases.
- OAuth return matching, connect-vs-reconnect, malformed/missing grants, encrypted token round trip, refresh race, permanent error state, disconnected while in flight.
- DB-backed migrations/constraints and concurrent claims in disposable PostgreSQL: request-key uniqueness, replay conflict, claim crash, stale claim, provider acceptance/local failure, donor outcome persistence. A fake in-memory store cannot prove transaction/unique/lease behavior.
- Fake provider servers exercising actual HTTP helpers: 429, 5xx, Retry-After, timeouts, response loss, malformed 2xx, redirected response, missing IDs and oversized responses. Count irreversible calls.
- Initial and incremental sync with multiple pages, quota budget, delta/history expiry, deletes/moves/custom folders, partial calendar/mail failures, overlapping invocation and restored process.
- Sender/recipient/header fidelity, real reply identity, Bcc not exposed in receipts, MIME Unicode, sanitized HTML/signature, attachment parent/readiness/distribution, aggregate budget and sync-before-receipt.
- UI success/error/unknown/pending/not-configured/unsupported/incomplete states, navigation/reload, actor/client switch, cache invalidation, polling current receipt and no automatic resend.
- Canonical Meri read installation/measurement/currentness and precise continuation; never silently elevate canonical read tools to send authority.

#### Microsoft-only later live acceptance, separately authorized

Use a dedicated work/school test account with an approved test mailbox and exact approved recipient. Verify consent/scopes, callback host, encrypted persistence/refresh, send-as identity, one new send, one true reply/reply-all, Sent Items mapping and exact one-message reconciliation, attachment receipt, custom-folder delta, move/delete, notification validation/clientState, subscription expiry/removal/reauthorization recovery and disconnect. Capture sanitized IDs/timestamps/status, not tokens or message secrets. A test send is still a real email and needs explicit permission. Provider acceptance is not delivery/read receipt. Consumer Outlook.com is outside the currently proven organization-authority path.

#### Gmail-only later live acceptance, separately authorized

Verify configured OAuth publishing/test-user status and supported account eligibility, exact callback and required grant inventory, refresh/revocation, initial paging and history catch-up, quota/expired-history recovery, one approved send with real message/thread ID, true reply headers/thread attachment, sent/inbox/label/delete reconciliation, outgoing attachment and disconnect. Demonstrate scheduled freshness with no browser manual sync. Do **not** require Pub/Sub watch setup to pass periodic Gmail support; add watch/renewal/security only if Gmail realtime becomes an explicit product requirement.

#### System-mail later live acceptance, separately authorized

Verify SES sender identity/region/IAM and the exact intended frontend links. Turn on only the selected worker flag through approved deployment; exercise one approved invitation/review/onboarding recipient, durable request/claim/receipt, cancellation and unknown-no-retry behavior. Confirm disabled mode is never described as delivered. Newsletter campaign test/send remains the OAuth mailbox path and has its own reviewed content/recipients, not automatic permission from a Workspace notification test.

#### Exit criteria

Every selected mail action has a named current handler, transport, app mount, server authority, persistence identity, provider contract, terminal receipt and visible recovery state. All P1 confirmed issues are closed; P1 residual risks have either passing reproducer/negative tests with documented invariant or a bounded implementation fix. Product-boundary rows have explicit supported/unsupported decisions. Deployment evidence is kept separate from source/test evidence. No feature flag, OAuth grant, subscription, credential or external email is changed merely because this plan exists.

### Immutable source index

- **ML-S01:** [Settings handlers, provider actions and error-state UI][ml-ML-S01]
- **ML-S02:** [Fixed Settings operations][ml-ML-S02]
- **ML-S03:** [Portfolio authenticated proxy and timeout][ml-ML-S03]
- **ML-S04:** [Standard Core composition][ml-ML-S04]
- **ML-S05:** [Separate Engagement API composition][ml-ML-S05]
- **ML-S06:** [Actual providers, guarded seams and race-safe implementations][ml-ML-S06]
- **ML-S07:** [Mounted Microsoft integration actions][ml-ML-S07]
- **ML-S08:** [Mounted Google integration actions][ml-ML-S08]
- **ML-S09:** [Mounted Microsoft callbacks][ml-ML-S09]
- **ML-S10:** [Mounted Google callback][ml-ML-S10]
- **ML-S11:** [Microsoft refresh-token account selector][ml-ML-S11]
- **ML-S12:** [Microsoft OAuth start and exchange][ml-ML-S12]
- **ML-S13:** [Microsoft disconnect and token persistence][ml-ML-S13]
- **ML-S14:** [Google OAuth start and granted-scope check][ml-ML-S14]
- **ML-S15:** [Google disconnect, identity extraction and token persistence][ml-ML-S15]
- **ML-S16:** [Google refresh/reconnect state][ml-ML-S16]
- **ML-S17:** [Encrypted token storage][ml-ML-S17]
- **ML-S18:** [Graph subscription create/reuse][ml-ML-S18]
- **ML-S19:** [Graph draft-then-send adapter][ml-ML-S19]
- **ML-S20:** [Graph notifications and sync orchestration][ml-ML-S20]
- **ML-S21:** [Graph folder/delta continuation][ml-ML-S21]
- **ML-S22:** [Graph message persistence and uniqueness][ml-ML-S22]
- **ML-S23:** [Graph refresh, granted scopes and cache][ml-ML-S23]
- **ML-S24:** [Graph generic retries, sync failure and lifecycle events][ml-ML-S24]
- **ML-S25:** [Gmail send, receipts and raw MIME][ml-ML-S25]
- **ML-S26:** [Google partial-sync health][ml-ML-S26]
- **ML-S27:** [Gmail backfill/history/body ingestion][ml-ML-S27]
- **ML-S28:** [Both-provider claim scheduler and renewal][ml-ML-S28]
- **ML-S29:** [Mail read/send/rewrite HTTP routes][ml-ML-S29]
- **ML-S30:** [Single-mail preflight, dispatch and receipt persistence][ml-ML-S30]
- **ML-S31:** [Thread detail and capped thread list][ml-ML-S31]
- **ML-S32:** [Bounded assistant list/search and coverage][ml-ML-S32]
- **ML-S33:** [Mail connection-owner predicates][ml-ML-S33]
- **ML-S34:** [Connection/token schema][ml-ML-S34]
- **ML-S35:** [Mail lineage and unique constraints][ml-ML-S35]
- **ML-S36:** [Contact mail reads, send hook and refresh][ml-ML-S36]
- **ML-S37:** [Reviewed-send authority, preflight and receipt check][ml-ML-S37]
- **ML-S38:** [Same-session attempt lock][ml-ML-S38]
- **ML-S39:** [Compose controls, review and signature toggle][ml-ML-S39]
- **ML-S40:** [Explicit Timeline reply gap][ml-ML-S40]
- **ML-S41:** [Existing upload/readiness chain][ml-ML-S41]
- **ML-S42:** [Outgoing attachment access/bytes enforcement][ml-ML-S42]
- **ML-S43:** [Actual signature consumption][ml-ML-S43]
- **ML-S44:** [Durable immutable-version send planning][ml-ML-S44]
- **ML-S45:** [Claim/send/acceptance/unknown recovery][ml-ML-S45]
- **ML-S46:** [Actual race-safe send-intent DI wrapper][ml-ML-S46]
- **ML-S47:** [Legacy Meri sender selection/send][ml-ML-S47]
- **ML-S48:** [Legacy Meri reply implementation][ml-ML-S48]
- **ML-S49:** [Meri durable proposals and unknown outcome][ml-ML-S49]
- **ML-S50:** [Meri bounded mail output and retained source][ml-ML-S50]
- **ML-S51:** [Canonical mail read HTTP port][ml-ML-S51]
- **ML-S52:** [Canonical mail read handlers][ml-ML-S52]
- **ML-S53:** [Measured read-only installation catalog][ml-ML-S53]
- **ML-S54:** [Core OAuth secret/URL propagation][ml-ML-S54]
- **ML-S55:** [Engagement API active/shadow task environment][ml-ML-S55]
- **ML-S56:** [Separate task secret and IAM map][ml-ML-S56]
- **ML-S57:** [Runtime ownership and action gates][ml-ML-S57]
- **ML-S58:** [Provider OAuth configuration][ml-ML-S58]
- **ML-S59:** [Newsletter prepare and durable mailbox send][ml-ML-S59]
- **ML-S60:** [Mounted newsletter prepare/send/test routes][ml-ML-S60]
- **ML-S61:** [SES review worker][ml-ML-S61]
- **ML-S62:** [SES invitation worker][ml-ML-S62]
- **ML-S63:** [Best-effort ordinary Workspace SES sender][ml-ML-S63]
- **ML-S64:** [Onboarding SES send-before-dedupe][ml-ML-S64]
- **ML-S65:** [Graph tests stub below send boundary][ml-ML-S65]
- **ML-S66:** [Gmail tests replace fetch][ml-ML-S66]
- **ML-S67:** [Legacy campaign send gate][ml-ML-S67]
- **ML-S68:** [Unmerged Core104 provider-outcome persistence repair][ml-ML-S68]
- **ML-S69:** [Google requested scopes][ml-ML-S69]
- **ML-S70:** [Microsoft requested scopes][ml-ML-S70]
- **ML-S71:** [Generic capabilities including IMAP placeholder][ml-ML-S71]
- **ML-S72:** [Automatic sync defaults][ml-ML-S72]
- **ML-S73:** [Legacy Core Tracker SES adapter][ml-ML-S73]
- **ML-S74:** [Legacy Core Tracker notification claim][ml-ML-S74]
- **ML-S75:** [Intel SES no-retry and outcome classification][ml-ML-S75]
- **ML-S76:** [Intel alert claim and shadow/ownership boundary][ml-ML-S76]
- **ML-S77:** [PE digest canary, watermark and best-effort sends][ml-ML-S77]
- **ML-S78:** [Demo-request system notification][ml-ML-S78]

[ml-ML-S01]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/IntegrationSettings.tsx#L48-L398
[ml-ML-S02]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/settings.ts
[ml-ML-S03]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/api/proxy.ts
[ml-ML-S04]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/app.module.ts
[ml-ML-S05]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement-api.app.module.ts
[ml-ML-S06]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.module.ts
[ml-ML-S07]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-integration-actions.controller.ts#L34-L105
[ml-ML-S08]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-integration-actions.controller.ts#L24-L70
[ml-ML-S09]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-callbacks.controller.ts#L7-L73
[ml-ML-S10]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-callbacks.controller.ts#L6-L41
[ml-ML-S11]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth.service.ts#L69-L80
[ml-ML-S12]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth.service.ts#L96-L239
[ml-ML-S13]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth.service.ts#L245-L355
[ml-ML-S14]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-oauth.service.ts#L105-L240
[ml-ML-S15]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-oauth.service.ts#L244-L451
[ml-ML-S16]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-token.service.ts#L82-L181
[ml-ML-S17]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/token-crypto.service.ts#L1-L80
[ml-ML-S18]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L406-L470
[ml-ML-S19]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L526-L624
[ml-ML-S20]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L627-L838
[ml-ML-S21]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L910-L1194
[ml-ML-S22]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L1490-L1635
[ml-ML-S23]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L1750-L1896
[ml-ML-S24]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L1919-L2025
[ml-ML-S25]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/gmail-send.service.ts#L43-L224
[ml-ML-S26]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-sync.service.ts#L350-L419
[ml-ML-S27]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-sync.service.ts
[ml-ML-S28]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement-sync-scheduler.service.ts#L1-L206
[ml-ML-S29]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.controller.ts#L2327-L2388
[ml-ML-S30]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L9278-L9604
[ml-ML-S31]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L2531-L2631
[ml-ML-S32]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/mail-query.ts#L60-L350
[ml-ML-S33]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement-access.helpers.ts#L66-L82
[ml-ML-S34]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/prisma/schema.prisma#L1352-L1401
[ml-ML-S35]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/prisma/schema.prisma#L1524-L1592
[ml-ML-S36]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/email.ts#L55-L150
[ml-ML-S37]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/email/send.ts
[ml-ML-S38]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/email/send-attempt.ts
[ml-ML-S39]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/MailCompose.tsx
[ml-ML-S40]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/thread/TimelineMailThread.tsx#L1-L180
[ml-ML-S41]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/email/useMailAttachments.ts
[ml-ML-S42]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L8815-L8872
[ml-ML-S43]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1128-L1157
[ml-ML-S44]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/outreach-send-intent.service.ts#L229-L470
[ml-ML-S45]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/outreach-send-intent.service.ts#L596-L1005
[ml-ML-S46]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/race-safe-outreach-send-intent.service.ts#L1-L59
[ml-ML-S47]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-tools.service.ts#L7322-L7437
[ml-ML-S48]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-tools.service.ts#L7850-L7933
[ml-ML-S49]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-action-proposal.service.ts#L735-L800
[ml-ML-S50]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-tools.service.ts#L7486-L7690
[ml-ML-S51]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/gateway/sources/mail/http-adapter.mjs#L1-L101
[ml-ML-S52]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/gateway/sources/mail/handler.mjs
[ml-ML-S53]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/gateway/catalog/installed-catalog.mjs#L1-L33
[ml-ML-S54]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/infra/cdk/lib/compute-stack.ts#L650-L780
[ml-ML-S55]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/infra/cdk/lib/engagement-api/engagement-api-service-stack.ts#L289-L425
[ml-ML-S56]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/infra/cdk/lib/engagement-api/engagement-api-iam.ts
[ml-ML-S57]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/runtime/engagement-runtime-policy.service.ts
[ml-ML-S58]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/config/config.schema.ts#L981-L1032
[ml-ML-S59]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/newsletter-outreach.service.ts#L348-L542
[ml-ML-S60]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/newsletter-outreach.controller.ts#L56-L85
[ml-ML-S61]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/workspace-collab/newsletter-review-email.worker.ts#L39-L280
[ml-ML-S62]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/workspace-collab/newsletter-invitation-email.worker.ts#L39-L275
[ml-ML-S63]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/workspace-collab/workspace-collab-email.service.ts#L21-L75
[ml-ML-S64]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/onboard-api/src/email/email.service.ts#L39-L132
[ml-ML-S65]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-send.service.spec.ts#L83-L103
[ml-ML-S66]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/gmail-send.service.spec.ts#L71-L94
[ml-ML-S67]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L10813-L10843
[ml-ML-S68]: https://github.com/neo-capiro/capiro-backend/blob/5bf901173e839c0145069ec42e16dcb40c373ba6/apps/api/src/engagement/engagement.service.ts#L3265-L3300
[ml-ML-S69]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/shared/src/index.ts#L104-L118
[ml-ML-S70]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth-constants.ts
[ml-ML-S71]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1316-L1341
[ml-ML-S72]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/config/config.schema.ts#L506-L519
[ml-ML-S73]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tracker/notifications/tracker-email.service.ts#L1-L49
[ml-ML-S74]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tracker/notifications/tracker-alert.service.ts#L83-L215
[ml-ML-S75]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/intel-api/src/intel-alert/intel-email.service.ts#L1-L59
[ml-ML-S76]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/intel-api/src/intel-alert/intel-alert.service.ts#L113-L411
[ml-ML-S77]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/scripts/send-pe-alert-emails.ts#L1-L299
[ml-ML-S78]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/demo-requests/demo-requests.service.ts#L35-L138


<a id="execution"></a>

## Integrated execution plan

### How a coding agent should use this plan

1. Read the executive verdict, exact source table, status legend and all four domain matrices before editing. A feature can be source-implemented and still have a missing consumer, an authorization defect, a held deployment or unproven live behavior.
2. Re-read the repository's AGENTS instructions and current canonical owners. Refresh the three default and supplemental refs; compare ancestry and file content before receiving anything. Do not merge old donor PRs simply because they remain open.
3. Open only bounded source work after the owner authorizes implementation. This plan itself does not authorize edits, commits, pushes, merges, database operations, provider connection changes, actual sending or deployment.
4. For each ticket, retain the existing transport, controller/service owner, persistence model and rendering stack where possible. Add missing contracts only at the identified boundary. A disabled control must not be enabled before its downstream authority and receipt semantics are ready.
5. Record each closed action in the acceptance ledger with its actual evidence tier. If a product decision intentionally removes/defer-supports a capability, name it explicitly and keep truthful UI. Do not silently treat omission as implementation.

### Order of work and dependencies

#### Stage 0 — Freeze a truthful baseline and launch scope

**Outcome:** One exact source baseline and owner-approved list of capabilities to be enabled, held or deliberately external.

- Inventory each matrix row into a work item, preserving its PF/WS/ST/ML/X ID, dependencies and source links. Include surfaced admin subflows, unsupported controls and backend-only consumers, not only top-level pages.
- Reconcile candidate receivers frontend115, Core104 and Meri197 against current defaults and open review findings. They are reusable source, not an instruction to merge. If the owner elects to receive them, preserve their conflict decisions and stricter current safeguards. Do not separately reapply114/111/112, legacy94, old mail donors or superseded runtime branches already covered by these receivers.
- Select ordinary controlled test environment versus restricted preview. X-01 requires a deliberate profile decision; do not toggle the preview gate off in place as a shortcut.
- Establish the per-service current migration ledger, intended image/release SHAs, routing owner and provider app registrations from nonsecret metadata. Current applied state is unverified by this audit.
- Honor the current repository change-control boundary before implementation: Core auth, tenant context/JWT/session handling, Microsoft OAuth, Clerk webhooks and connection/token persistence require Neo’s prior approval. Obtain explicit scope for those changes rather than treating this plan, a generic readiness check or an unrelated implementation permission as authority. Re-read the current file headers and AGENTS instructions before editing.
- Decide bounded product questions listed in the domains: genuine provider reply/forward versus new message; client/user/shared mailbox support; complete in-app billing facts versus hosted portal; new share recipients and approval policy; accepted file/export formats; enrichment proposal-before-apply; objective destination behavior; metric definitions; Memory governance/user-preference scope. Clear defaults are given where source owners already exist; do not invent obligations or data semantics.

**Exit:** No ticket depends on an ambiguous service owner, stale donor status or undefined authority boundary. Security fixes can proceed independently of optional product expansion. The launch checklist explicitly preserves intentionally held features until their gates close. First-wave acceptance is not full closeout: all deferred rows remain open in the full inventory with owner, rationale and next decision.

#### Stage 1 — Fix safety, consistency and false-success blockers first

**Outcome:** Already-visible source cannot expose another permitted user's private resource, remove privileged members, accept/sign an unvalidated stored logo key, subject to actual bucket/IAM access or replay uncertain outbound sends when deployed.

- Apply Settings privileged-target removal and branding key/finalize/read validation fixes. UI hiding is not the server control. Include direct-API negative tests, not only browser tests.
- Apply Workspace same-tenant owner/collaborator and client-wall checks, Hill Day direct/list/export checks, current revision/approval/share validity, and transport receipt consistency before wiring new share/review consumers.
- Close Portfolio meeting access/reassignment/document/debrief consistency and commitment lifecycle gaps identified by the domain audit. Reuse current canonical actor/client validation.
- Restrict generic provider retries by operation safety. Add/reuse durable single-send request identity and record provider outcomes before mutable visibility can erase completion evidence; reconcile unknown outcomes before any new send. Core104's corrected outreach outcome-write behavior is reusable pending authorized receipt, not a reason to copy an unsafe donor version.
- Bind reply/forward to the original owned connection and provider message/thread identity. Do not represent a fresh message with a local thread ID as a provider-threaded reply.
- Preserve draft/correction inputs, current revision and nonsecret uncertainty hold across timeout/navigation/reload. A failed follow-up read cannot turn a known accepted provider operation into a safe-to-resend failure.

**Dependencies:** Current-source baseline; local fixture/database test design. These fixes do not require production credentials or actual provider sends. **Exit:** Negative tenant/client/owner/role/revocation cases and failure-after-effect tests pass against mock providers and isolated database, and no new unsafe UI is enabled.

#### Stage 2 — Finish existing-backend consumers and bounded lifecycle fixes

**Outcome:** Product controls that already have authoritative backend support are genuinely usable, refresh correctly and remain truthful.

- Settings: authenticated account-management entry; caller/target-aware Team controls; recipient broadcast delivery/ack; missing routine preference/admin receipt flows; correct preview Profiles request/read mode. Keep hosted billing ownership and avoid inventing invoice/contract facts.
- Portfolio: existing-resource action consumers, editable/settleable commitment/request metadata, member log/context handling, missing selection/batch actions where a current backend exists, and current scope/receipt invalidation. Do not rebuild already-working client create/archive/restore, Quick Log, capability CRUD or ordinary list/detail flows.
- Workspace: create-client association/subject preservation before newsletter staging; registered existing draft/version/export/collaborator/share/review capabilities after Stage1; ordinary draft preview; supported template/catalog actions; correct revoke/delete receipts; safe transfer/upload/download through existing registered modes.
- Mail: status/connection identity and provider-specific error displays; cursor/attachment/read capabilities actually present; existing sync controls and scheduler health; compose/draft/send outcomes and disabled-control rationale. Reuse Gmail's existing history scheduler and Microsoft's existing delta/subscription machinery.

**Dependencies:** Stage1 for any security-sensitive resource/share/send path, X-02 service ownership. **Exit:** Every implemented consumer has a real operation and tests through controller/service, storage/provider simulator, receipt and visible refresh. No fake total, fabricated success or local-only persisted setting remains in the selected supported scope.

#### Stage 3 — Close true missing contracts and cross-service features

**Outcome:** Missing product behavior has one accepted authoritative contract and a bounded implementation, not a loose UI placeholder.

For every missing-contract ticket, first deliver a short owner-approved decision containing the exact request/response shapes, authority and scope rules, persistence owner, durable receipt/reconciliation behavior, supported/unsupported states and compatibility plan. This is a prerequisite deliverable, not an instruction to invent these semantics in code. Only then implement the named bounded changes and tests.

- Portfolio Meri handoffs, proposal-only enrichment, objective execution/association/generation, prospect conversion/resource carry-over and authoritative metrics are contract work, not flags. Reuse present intent/plan/version/authority models and require current-scope binding.
- Workspace rich-newsletter collaboration/assets/delivery, save-as-template, approval-state handling and artifact lifecycle require their correct existing owner and public contract. Implement only the remaining consumer or bounded owner defect; do not add a second editor or renderer.
- Settings Memory governance/review/files/access and preference categories need the domain's exact contracts. Frontend115's owner-review UI does not provide all Governance tabs; Core's required public versioned wire DTO and Meri retention/composition gates must be closed separately. Preserve held defaults until then.
- Mail durable drafts, provider-native replies/forwards, complete message/attachment pagination/search behavior and shared-mailbox support, if included in launch scope, need explicit provider semantics and test coverage. Treat Gmail realtime push as a product-latency choice because periodic sync already exists, not as a mandatory replacement architecture.
- Publish/adopt immutable generated public artifacts through the current contract distribution flow when needed. Compare all generated files/provenance to producer, and avoid manually editing generated DTOs to hide drift.

**Dependencies:** Product decisions, current public contracts and migration allocation. **Exit:** Every row selected for this implementation wave is fully source-implemented with tests. Other rows remain explicitly open/held or owner-approved unsupported, with truthful UI and a next decision; they are not counted as full requested-scope closeout. A code-present but unmounted or hardcoded-off route is not complete.

#### Stage 4 — Integrate, regress and prepare an owner-reviewable release candidate

**Outcome:** One compatible cross-repository candidate with no redundant receivers and explicit baseline test debt.

- Run focused tests first, then all relevant repository aggregate checks on the final integrated head. Compare inherited diagnostics against untouched baseline; retain failed/skip logs rather than hiding them.
- Exercise real HTTP mount and body parsing, not only direct service calls. Verify strict DTOs, auth template/session requirements, origin/method allowlists, file limits, content types, encoded IDs, CAS/version and pagination semantics.
- Run browser journeys for every selected action family with mocked network and real staging API variants separately. Include cancelled/repeated clicks, Back/Forward, direct deep link, client switch, session expiry, network loss and delayed old responses.
- Confirm Core/Strategy/Workspace/Onboard/Meri sources are compatible at the chosen head and that no retired capirov2/backend web runtime was accidentally restored. Historic snapshots are evidence, not a deployment source.
- Produce source manifest, image build recipe, migration plan, configuration mapping, rollout order, rollback controls, test ledger and unresolved-gates list. Keep secrets out of the packet.

**Exit:** Source candidate is reviewable and relevant tests are green or explicitly blocked with unchanged known debt; final merge remains the owner's decision. No deployment is implied by a PR, passing CI or this plan.

#### Stage 5 — Operator-only migration, configuration and activation

**Outcome:** Exact approved images serve the intended capabilities with least privilege and one active worker owner.

After separate owner authorization, operators:

1. Verify account/environment identity, target database and current immutable image/source/route state. Take the approved backup/restore checkpoint and preserve current routing and rollback image.
2. Apply only reviewed service-specific migration groups and required grants/backfills, with ledger/checksum evidence. Verify upgrade behavior and no unintended global migration/reset/purge. Meri memory/journal retention has explicit additional gates, not an automatic apply.
3. Deploy backend reader/schema-compatible prerequisites before dependent writes/consumers, then dependent frontend/public contracts. Use the approved expand/contract order where fields change. Keep new feature flags false until per-service checks pass.
4. Supply approved secret references and nonsecret variables, Clerk issuer/key/template/origin consistency, service URL prefixes, storage/scanner configuration and public callback/webhook destinations. OAuth consent and new persistent access remain explicit user/operator actions. No credentials are requested in chat or committed to a file.
5. Activate exactly one scheduler/subscription owner, verify claims/leases/renewal/recovery, then enable consumers narrowly. Do not run Core and Engagement worker ownership simultaneously without the intended fencing configuration.
6. Check source/image identity and route ownership on live readback; preserve narrow preview rules. Create provider subscriptions only after callback routing and authorization are validated. A provider app registration or successful OAuth callback alone does not qualify sync/send.
7. On a failure, hold affected capability and preserve durable outcome evidence. Roll back code/config according to compatibility; do not delete provider outcomes, replay accepted sends, revoke unrelated connections or alter shared ingress as an automatic rollback.

**Exit:** The exact approved environment has confirmed source/image/DB/config ownership, and each activated capability is separately eligible for acceptance. Optional/held capabilities remain off with truthful status.

#### Stage 6 — Controlled acceptance and operational closeout

**Outcome:** Real end-to-end usability, not just source presence.

- First perform authorized nonmutating reads with dedicated test actors, accounting for Core GET identity side effects. Verify provider status, reads, search, pagination and attachments against controlled mailboxes.
- Obtain exact authority for any write/send/share/invite/billing/provider mutation tests. Use seeded client data and designated test recipients/mailboxes, never real customer bulk contacts. Test send, reply and forward separately on Microsoft and Gmail; correlate provider IDs and sent-folder/thread readback. No actual mail was sent during this audit.
- Prove sync/backfill/cursor progression and duplicate suppression across the chosen normal job interval, failover/restart and provider renewal boundary using provider sandbox or controlled time/fixtures as appropriate. Production elapsed-time checks are not replaced by mocked timer success.
- Verify current access removal, client reassignment, expired/revoked token,429/backoff, provider5xx, timeout-after-accept, storage denial, attachment quarantine and webhook duplicate/out-of-order delivery. Unknown send outcome remains blocked pending reconciliation.
- Verify final UI refresh after each durable operation and no data appears after logout/org/client switch. Capture only nonsecret evidence and redact message contents except test fixtures.
- Hand over dashboard/log/query locations, expected scheduler cadence, pending/failed/unknown thresholds, retry rules and the one named service owner for each integration. Monitoring should expose last successful run, lag, cursor/lease health and terminal/unknown send receipts without leaking credentials or private bodies.

**Exit:** Every supported action has a current live acceptance receipt or an explicit narrowly scoped unresolved gate. Rollout claims name the actual supported scope. Owner signs off deployment/activation independently from source merge.

### Parallel lanes and file ownership

Root is the sole orchestrator and shipping owner. Four logical A/U/R/D sessions use current exact-file allocations and independent Astra Ultra reviews. The domain boundaries below preserve canonical owners, not the historical dot/Fable assignment. Root resolves shared contracts, migrations, infrastructure and integration; one writer per file and no duplicate policy, sender or runtime.

| Lane | Owns | Must coordinate, not independently overwrite |
|---|---|---|
| Platform and integration | Frontend shared server gateways/config/session guards, deployment profile/template, current service-route matrix; Core/Strategy/Workspace entrypoints; shared auth and migration sequencing | All domain additions to registry/config; exact preview allowlist/source pins; any new service routing; no domain bypasses held gates |
| Portfolio | `apps/web/src/features/portfolio/**`, Portfolio routes; Core clients/objectives/business-development/capabilities; corresponding bounded contracts | Meetings live in shared Engagement owner, file storage with Workspace, Meri public-contract handoffs, Settings client Profiles; one author per shared controller/service at a time |
| Workspace | `features/modules/workspace/**`, `operations/workspace*`, rich-newsletter contracts; `apps/workspace/**` | Core engagement newsletter staging/send paths with mail owner; branding with Settings; Meri artifact inspection/rendering contracts with runtime owner; don't duplicate artifact stores |
| Settings | `features/settings/**`, Settings routes, `operations/settings*`; Core tenant-admin/branding/users/capiro-admin/admin-broadcasts; Onboard billing reads/portal integration | `IntegrationSettings.tsx` mail subsection with mail owner; memory/preferences contract owner; shared headers/account/broadcast consumer with platform owner |
| Mail/Engagement | Provider OAuth/token/adapters, message read/send/sync/realtime/scheduler/attachments, Core `engagement*` shared controllers/services and send ledgers; Portfolio email and Settings integration consumer hooks | Portfolio meeting changes and Workspace newsletter staging both touch Engagement. Serialize shared-file edits through this lane or deliver reviewed bounded patches; do not parallel-edit the monolithic service blindly |
| Meri/public contracts, allocated by root | Greenfield runtime/action/read/document/memory/preference authority and public distribution; coordinated frontend `shared/meri-*` consumers | One producer owns each public DTO and generated artifact set. Frontend115/Meri197 are coordinated receivers; no competing local DTO, old SDK/runtime or historical Stop/adoption fallback |
| Independent acceptance | Cross-domain matrices, contract snapshots, direct HTTP/DB tests, browser journeys, provider test-mailbox acceptance and nonsecret evidence | Test changes cannot weaken existing guard/architecture/format checks. Root owns runtime operations and deployment under current authorization |

Within a lane, split work by independent feature subdirectory and test owner. Shared files such as frontend registry, Core engagement service, schema files, migration numbering, public generated contracts and deployment templates have one integration owner and a short change queue. This avoids turning the plan into mutually conflicting parallel refactors.

### Required operator/configuration inventory

| Boundary | Verify/configure | Evidence required before enable |
|---|---|---|
| Frontend auth | Designated Clerk public/server keys, same environment, issuer/template expectations, active org mapping, browser origin | Sign-in/expiry/org-switch tests; no user-selected scope trusted as authority |
| Service routing | Core `/api`, Strategy `/strategy-api`, Workspace `/workspace-api`, Onboard prefix, explicit Intelligence tracker backend, Meri root origin, Engagement path split | Correct controller reached on exact image; bad prefix not hidden by health-only green |
| Preview | Exact read/roster/bootstrap/conversation pins, image digest, qualified target and blank-held defaults | Fail-closed positive/negative routing and no ordinary production fallback |
| Provider OAuth | Existing Microsoft and Google app IDs/scopes/redirects, approved secret references, callback owner/state protections, consent/reconnect behavior | Provider matrix passes in controlled accounts; no persistent access change without authorization |
| Mail runtime | Ownership/runtime flags, connection token encryption, sync claim cadence, cursors, subscription renewal owner, callback public origin, attachment scanning/storage | One owner, current status and safe replay/recovery across restart/revoke/failure |
| Workspace | DB/grants, blob/artifact/export storage, scanner/format support, delivery/share/approval policy, model flags if generating | Owner/client ACL, approved current revision, correct artifact bytes and receipt |
| Settings/billing | Role and billing-admin mapping, branding bucket namespace, Onboard/Stripe hosted callback origin, signed legal facts only when present | Correct caller/target eligibility, tenant-bound storage and provider readback |
| Memory/Meri | Exact public DTO release, generated provenance, source/runtime flags, journal/retention schema and registry, canonical Core permissions, user preferences flag | Matching immutable contracts; no widening of unsupported approvals or purge controls |

Do not include secret values in this inventory. For each item record the current nonsecret reference, owner, environment, status (`verified`, `missing`, `held`, `not selected`) and the associated action rows.

### Universal regression matrix

These apply to every domain in addition to its detailed tests:

| Dimension | Required cases |
|---|---|
| Identity | Signed out; malformed/expired JWT; wrong issuer; absent org; one/multiple memberships; org change; removed/suspended member; role downgrade; account switch while request pending |
| Data scope | Wrong tenant; same tenant wrong owner; client wall/revoked client; archived/deleted client; no selected client; all-permitted scope versus specific client; stale resource association; wrong provider connection |
| Contracts | Required/unknown fields; null/empty; wrong enum/version; mismatched response;204 vs JSON-null/empty body; encoded IDs; malformed cursor; pagination limits; exact public DTO/provenance |
| Concurrency | Double click; overlapping edits; stale revision/CAS; request finishes after navigation; reload after timeout; provider accepted but persistence/read failed; worker claim stolen/expired; repeat callback/webhook |
| UI | Loading/empty/error/unavailable/held are distinct; disabled action explanation; keyboard and accessible labels; direct route/deep link; Back/Forward; cancel with no effect; preserved unsaved draft; truthful counts/status |
| Files | MIME/extension/magic/size mismatch; tenant storage key; quarantine/scan states; expired/revoked link; binary checksum; upload partial completion; export status polling; unsupported format; untrusted HTML/SVG/ZIP contents |
| Providers | Microsoft and Google separately; missing scopes; consent denied; account mismatch; token refresh/revocation;429/Retry-After;5xx; network loss; malformed response; pagination token expiry; no unsafe mutation replay |
| Operations | Exact image/source; service mount and prefix; schema/grants; configured off/on; scheduler owner/lag; callback reachability; rollback without data/receipt loss; logs redact secrets/private content |

### Definition of done

A supported feature/action is closed only when all relevant layers are proven. An owner-approved unsupported/external disposition resolves scope explicitly; it does not prove implementation. Held/deferred rows remain open, even if the first release is accepted:

- The route/tab/control exists or its deliberate unsupported/external disposition is clearly approved and shown.
- Its handler invokes the correct registered operation or bounded proxy and preserves current actor/client/conversation/revision identity.
- Request and response contracts match the authoritative mounted service; no mock/local placeholder masquerades as durable state.
- Authorization is enforced server-side for tenant, client, owner/collaborator, role and provider connection, including access changes during pending work.
- Persistence/provider effect has a durable, correlated result. Replays, conflicts and unknown outcomes have safe reconciliation semantics.
- UI refresh/readback reflects the real durable outcome without leaking old scope or erasing edits made after the submitted snapshot.
- Required migrations, storage/scanner, config, callback URLs, background jobs and feature flags are qualified on the exact selected deployment, not merely present in source.
- Source, fixture, real DB, deployed and provider-live evidence tiers are labeled separately. Every relevant negative/failure case passes or the feature stays explicitly held.
- Existing architecture/tests/security holds are preserved; no unrelated rewrite or donor duplication was introduced.
- Merge, migration, deployment, provider permission and actual send/share actions have the required separate owner authorization. None is authorized or performed by this plan.

### Explicit unresolved coverage and limits

This audit is exhaustive at the enumerated source route/action-family inventory level, not a proof that every possible runtime path is correct. The following remain intentionally unresolved until the specified verification:

1. Actual deployed image digests, task/env values, ingress rules, worker counts, database migration ledgers, storage policies, OAuth app registrations, real tenant membership/client grants and provider account scopes were not inspected live. Verify via approved operator readback; repository taskdefs and historical snapshots are insufficient.
2. No authenticated application journey, live database mutation, OAuth connect/disconnect, provider subscription, actual send/reply/forward, external invitation/share or payment was executed. Use the controlled acceptance plan with explicit authorization.
3. Source tests and previous PR receipts were read but not rerun in this audit. Relevant inherited build/test debt is retained, not converted to green. Native Linux/Postgres/PKI/render qualification remains distinct from Windows/synthetic fixtures.
4. Active branches and PRs may move after the timestamp. Recheck all selected refs, open reviews and exact file ancestry/content before implementation; current supplement status is a snapshot.
5. Published current source was inspected. Deleted/unadvertised refs, uncommitted local work, protected unpublished Engagement work and unfinished alternative runtime proposals are not claimed received or understood. Request the responsible owner's bounded published handoff if they become necessary; do not reconstruct them from an old census.
6. Portfolio's Strategy/Planner destination contracts and shared meeting/Outreach dependencies are in scope. This is not an exhaustive new audit of every unrelated Intelligence/Directory/Research Portfolio/Planner module screen or all onboarding/marketing features. Those are included only where the requested actions depend on them. The adjacent seven-card hub metric gap is explicitly recorded.
7. A real source integration is not proof of provider parity, full Figma parity, full document rendering fidelity, complete datasets or legal/commercial facts. Unsupported capabilities require a product decision, not guessed fields or sample values.

These limits are verification tasks with clear owners, not permission to declare the requested product fully wired before acceptance.

---

## Addendum A: UI library and font stack (Neo, 22 October 2026)

Neo approved this UI stack. It **extends** the component-adoption rule (GF-02: "adopt SDK/AI Elements …") and the AI Elements/shadcn reuse rule; it changes no ticket text above. The full table (purpose, Figma node IDs, code status, waves) and the rules are in FINAL-PLAN §10. Rules in brief: Figma first, where a library has no Figma reference; pin versions, hashes and licenses, with free tiers only unless Neo approves; one library per pattern; lazy-load heavy libraries; honour Reduced motion; receipts, not toasts or charts, decide success. Fonts: **Geist Sans** (interface), **Geist Mono** (IDs and numbers), **Newsreader** (editorial and document headings).

| Ticket(s) | Library to use |
|---|---|
| ST-05, ST-06, ST-20 (Team, invitations, HQ broadcasts) | coss ui (tables and panels on shadcn primitives) |
| ML-11, ML-12, ML-17 (mail connections) | coss ui; Sonner (connection disconnected) |
| ML-13 to ML-15 (sync and reconnect history) | coss Origin (vertical timeline) |
| ML-14 (partial health and backfill progress) | Recharts |
| ST-19 (feedback) | Sonner (problem report sent), only after the real receipt |
| PF-07 (Objective associations), PF-14 (Quick Log) | ReUI Cascader (client → objective → commitment) |
| PF-16 (Files multi-select), PF-18 (prospect conversion) | coss ui (tables and cards) |
| WS-05 to WS-21 (Workspace documents, rich newsletters) | Plate (replaces the custom document and workbook editors) |
| PF-25, ML-20 (Timeline reply) | coss Origin |
| PF-06, PF-15 (Objective Planner, Strategy projection) | Kibo UI (Gantt, Kanban, list, milestone) |
| PF-20 (government forecast calendar) | Schedule-X |
| A5 facilities map, prospect and district geography (product contracts) | MapLibre + react-map-gl (Figma map frame first; Map marker master exists) |
| Portfolio relationships (existing) | React Flow (in use) |
| All screens | shadcn/ui foundation, Lucide icons, Motion for sheets, dialogs and popovers (Reduced motion honoured) |
