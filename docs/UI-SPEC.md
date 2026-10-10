# Meri UI specification — pinned design and executable contract boundaries

Status: **initial contract specification; implementation and acceptance PENDING**. This document preserves the agreed standalone v1 capabilities. It records proposed UI behavior and unresolved service contracts; it does not establish a working application, authorize an API, accept a component candidate, advance a deployment gate or authorize cutover. The [coverage ledger](UI-COVERAGE.md) classifies all captured frame, overlay, state and component-family IDs. Full distinct-control mapping remains OPEN beyond the initial Home table.

10 October 2026 discovery update: the human accepted the documented v1 scope, selected Capiro-internal / Neo Martinez for tenant-wide internal discovery, and confirmed Neo as technical source-access owner. Canonical IDs, actual membership/grants and client activation remain unverified; client-bound controls stay disabled until explicit client/ID/wall fixtures before G3. D008's independent authenticated entry and disabled Portfolio/Modules remain the selected shared-shell decision. G0 discovery has a complete pinned frame/overlay/state/family inventory and initial control contract; complete semantic distinct-control/service/fixture mapping and every UI behavior remain open implementation/verification work. Neither node/reaction counts nor that discovery distinction establish a full control audit or UI pass. Future G0/G1 work is Codex-only under D010; historical reviewer evidence is preserved.

## Baseline, provenance and limitations

Follow [the deployment plan](plans/MERI-DEPLOYMENT.md#figma-design-and-ui-implementation-contract) and [D008](coordination/DECISIONS.md#d008-figma-baseline-and-independent-ui-entry). The owned reference is standalone Meri section `439:81406`, page `411:40601`, file `Zc2dEN5aLU47dVdsewDmiJ`; Home is `442:81437`. References to another section are recorded only as prototype pointers. They do not authorize traversing that section, adopting its behavior, guessing a route or copying private current-Capiro UI logic.

The adopted [snapshot](design/meri/20261010T004355Z/SUMMARY.md) is a **non-atomic multi-call capture** from **2026-10-10T00:43:55.609Z through 00:54:02.016Z**. No immutable Figma revision/version identifier was available; the Figma API version is not a design revision. Direct-root metadata fingerprints matched during part of the capture window, which does not exclude later or nested leaf edits. Preserve these exact files/hashes in task briefs; later live design edits require an explicit baseline update.

The separately adopted later [evidence extension](design/meri/20261010T012511Z-extension/SUMMARY.md) captures all 18 referenced style definitions and a valid dark reference PNG from **2026-10-10T01:25:11.846Z through 01:26:23.924Z**. Its [manifest](design/meri/20261010T012511Z-extension/capture-manifest.json), SHA256 `229c5d7082f33e366277aa20b042d389db2f85b7a4dd75f3f9ae3b9369295f85`, binds this later live evidence without overwriting the original baseline or its failed download history. Both captures are non-atomic and have no immutable Figma revision. Extension start/end direct-root metadata also match the original; this does not prove unchanged nested content or styles across either capture.

| Evidence | Exact reference / limit |
| --- | --- |
| Full inventory | [inventory.json](design/meri/20261010T004355Z/inventory.json), SHA256 `6b04fb2b28ed90c17247a4722d671f8af8b7890534b7c5f83dd309d49b29ec6a` |
| Original capture manifest | [capture-manifest.json](design/meri/20261010T004355Z/capture-manifest.json), SHA256 `cd5fed106532eccce57de84dd9013e7e30108de16bd4c7e4afa861a9f8bd02e6` |
| Inventory totals | 85 main roots (80 screens and 5 state boards), 29 overlay roots, 60 state examples, 15 component families / 70 variants, 11 named starts, 38 variables / 5 collections |
| Direct-root accounting | 85 main + 29 overlays + review map `439:81407` = 115 owned direct roots |
| File accounting | Original: 10 files / 9 manifest payloads. Later extension: 8 files / 7 manifest payloads. Both manifests exclude their own self-hash |
| Prototype capture | Partial full-product graph: summary reports 2,214 reaction nodes / 118 deduplicated definitions. Full Home reaction definitions are captured; complete product control/overlay mapping is OPEN |
| Original missing-evidence history | Original baseline lacked 18 referenced style definitions and its one dark PNG download failed MIME validation. That history remains unchanged; the later extension supplies both reference gaps |
| Adopted style definitions | [styles.json](design/meri/20261010T012511Z-extension/styles.json), SHA256 `9ecb24384a628aa7a28ff75e2d27ec454ad8bcd6871956568bb1b999c9ef4ff3`: all 18 exact referenced IDs (15 text, 2 effect, 1 paint) |
| Adopted dark reference | [Dark PNG](design/meri/20261010T012511Z-extension/dark-448-89992.png), SHA256 `d5c921e681e918b02cdb5b705347798d3d554570faf1f026aa295169c718b674`: inspected 1440×1040 native inline PNG; dark content/sidebar with light shared header. Application visual comparison remains PENDING |
| Whitespace preservation | Six original and six extension capture text files retain source EOF blank lines byte-for-byte to preserve manifest hashes. This explicit capture-only formatting exception is not a clean-whitespace claim; owner-authored docs use one ending newline |

Capture counts and screenshots are design evidence. They are not semantic distinct-control counts, implemented coverage or functional passes. State boards are required supporting fixtures; their classification does not defer any capability.

## Independent authenticated entry and shared shell

D008 chooses an **independent authenticated Meri entry point** in the new repository/deployment/environment. Its actual URL, canonical identity bridge, session integration and versioned handoff contract remain UNRESOLVED. Capiro's canonical identity/data/memory remain external authorities reached through new reviewed connectors. No current Meri/Capiro agent, retrieval, UI, queue or infrastructure implementation is adopted by this UI specification.

Meri is active in the three-mode header. Portfolio and Modules are explicit disabled placeholders until the separate new Capiro frontend supplies verified authorized destinations. Enabling them requires a recorded versioned navigation/authentication contract and tests for tenant/client preservation, destination authorization, expired sessions and revocation. Do not put credentials in URLs or create guessed destinations or dead links.

The captured Home shared-header Brand, Search, Updates and Profile reactions also point outside the owned section. Their pointers are preserved in the table below, with local Meri behavior or verified handoff still unresolved. They remain inert until that decision is implemented and tested. Owned Meri search, notifications and preferences remain planned v1 work; this dependency does not silently remove them. Repeated header, sidebar, scope picker, prompt and artifact controls reuse a shared behavioral contract and stable UI ID; each responsive instance must still be checked for accessible naming and correct context.

## Context carried through every action

Implementation owner proposals are Lane C for presentation, Lane A for runtime/broker/durability, Lane B for authorization/data/selected mutations, and Lane D for independent verification. Codex owns shared contracts and acceptance. Names and scenario IDs here are proposals, not dispatched tickets or existing exports.

| Context | Required binding and transition rule |
| --- | --- |
| Tenant and actor | Use authenticated `Identity.tenantId` / `actorId`; never infer identity from the Figma sample name, fixture, URL label or browser-local state |
| Client/data scope | Carry the current authorized `Scope` values, including kind/resourceId/policyRevision, and revalidate at reads/actions. A displayed client name is a label, not an authorization decision. Do not invent a `clientId` wire field |
| Conversation | Bind selected `conversationId` to current tenant/actor and authorized context. Switching conversations revalidates stored messages, evidence, files and resumable state; existing runs may continue in the background |
| Run and attempt | Carry the admitted run and exact current `RunBinding` when required, including attempt/worker/writerFence. The trusted broker assigns execution identity; UI code does not allocate fences or reuse a stale execution attempt |
| Artifact | Bind `artifactId` and exact immutable `versionId`; preview, revision, download, approval and filing must refer to the version shown. A later latest-version change cannot silently retarget an action |
| Object/evidence | Preserve object/version/hash/byte/scopes and evidence provenance where required by the frozen shape. Recheck current access for old transcripts, previews, exports, attachments and evidence, not just new retrieval |
| Approval | Show immutable proposed intent and exact approved producer provenance. Execute against current authorized attempt/fence separately; stale selection or changed scope cannot rewrite approved intent |
| Lifecycle/revocation | Block unavailable actions and remove protected content when access is revoked. Numeric propagation/admission/retention behavior comes from the separately qualified services and gates; these docs do not prove it |

Closing a tab, disposing a transport subscription, changing routes, closing a drawer or cancelling local edits does not cancel a durable run. Run stop, steering, pause/resume and fork require explicit service contracts and current authorization. Keep them visibly pending while awaiting actual admission/receipt; never infer completion from HTTP completion or an SDK UI `ready` state.

## Frozen shapes and unresolved service behavior

The frozen [0.1.0 schema](../packages/contracts/meri.schema.json) has SHA256 `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b`. Its 28 definitions establish payload structure only. They supply no endpoint, live permission, authenticated connection, persisted record or production event stream. Contract changes remain Codex-owned, reviewed and versioned before consumers adopt them.

| UI capability | Actual frozen shape / boundary | Required unresolved work |
| --- | --- | --- |
| Conversation and authorized reads | `Identity`, `Scope`, `Conversation`, `ReadRequest`, `ReadResult`, `SourceEvidence`, `Coverage` | Entry/session, allowed-scope listing, history/search, read tools, context validation and live transport APIs |
| Run activity | `Run`, `RunBinding`, `Budgets`, `UsageLedger`, `ToolAudit`, `UIEvent` | Admission/start/stop/steer/pause/resume/fork services, actual progress/receipt mapping and durable persistence |
| Governed source changes | `Command`, `ApprovalProposal`, `ApprovalDecision`, `CommandExecutionRequest`, `CommandReceipt` | Initial commands are **memory.propose, task.create, artifact.file only**. Wire shape is not permission to execute; gateway/broker current authorization and receipts still required |
| Approvals | `ApprovalDecision` accepts approved/rejected | A design “changes requested” control needs an explicit local/new-proposal or reviewed versioned contract decision; do not silently coerce it to an existing enum |
| Run state display | queued, starting, running, waiting-for-approval, paused, completed, failed, cancelled | “Cancelling” is a possible local request-pending display, not an added wire state. Actual stop/cancel acknowledgement remains service work |
| Files and previews | `ArtifactVersion`, `ObjectReference`, `WorkspaceEntry`, `WorkspaceManifest` | Authorized upload/extraction/list/preview/exact-version download/revision/filing APIs, validation and storage lifecycle |
| Verified recovery | `Checkpoint`, `RuntimeVersions`, workspace manifest and durable receipt | Session state alone does not restore workspace files or browser state. Show verified restore only after actual complete checkpoint validation |
| Schedules | `ScheduleProjection` | Listing/create/update/pause/resume/delete lifecycle commands and deterministic workflow behavior are not supplied by the projection |
| Browser workspace | `CapabilityClaims`, scope, evidence and audit shapes | `browser.public` does not imply authenticated browsing, uploads/downloads or desktop access. Enable only separately qualified connection actions |
| Preferences and deletion | Local UI state; `Lifecycle` describes lifecycle data | Preferences/account persistence and deletion APIs are unresolved; `Lifecycle` does not create a deletion endpoint |

The only frozen UI event variants are `run.status`, `message.delta`, `tool.started`, `tool.completed`, `source.available`, `approval.required`, `artifact.available`, `checkpoint.verified`, `usage.recorded` and `run.error`. Use one application adapter for these supported events and reviewed service projections. Show plain user-facing activity summaries, evidence and tool receipts. Do not expose private model reasoning or manufacture backend internal chain-of-thought or undocumented SDK events.

The accepted [offline UI transport report](coordination/reports/W02-04-UI-TRANSPORT.md) and [acceptance record](coordination/reports/W02-04-UI-ACCEPTANCE.md) cover immutable event ordering, canonical deduplication/conflict handling, gap replay and an authorized-view fixture. They do not establish a React mount, live SSE, current authorization/revocation, browser persistence or actual component adoption. Its `/api/chat/<conversationId>/stream` reconnect URL is a **test fixture**, not an adopted application endpoint.

## Required adopted components

Implement generic patterns with AI Elements and shadcn/ui primitives before custom UI, preserving the Claude Agent SDK as the agent runtime and AI SDK as transport. Verify actual APIs from accepted pinned sources rather than treating a design component name as an available export.

| Generic design pattern | Adoption target, subject to source/API qualification |
| --- | --- |
| Streaming conversation and composer | Conversation / Message / PromptInput |
| Run activity and specialist progress | Plan / Task / Queue / Tool |
| Authorized evidence | Sources / InlineCitation |
| Governed approval | Confirmation |
| Immutable artifacts and attachments | Artifact / Attachments / FileTree |
| Applicable workspace details | Context / Checkpoint / WebPreview / CodeBlock / Terminal |

AI Elements source candidate `8d2cd17584f85fd87e010d1592dc13dc7e8aa27a` is **accepted OFFLINE for source/pins/API/plain-text fixture preparation only**, integrated at `d442885` after separate actual Hermes review2 `84d28013` (preserved at `31acba1`) and the owner's independent strict-compile/12-test pass. See [the owner decision](coordination/reports/W02-09-OFFLINE-ACCEPTANCE.md). Component/source APIs are unchanged; the thin diagnostic repair caches the first SSR outcome and permits no automatic second child. Original `636bf87` strict-compile/8-of-10 history, two SSR timeouts and review1's 40-turn closure without a report remain retained. Later passes are not guaranteed cold-cache runs and do not establish the timeout cause or resolve cold-start reliability. Seven notice gaps, unsigned upstream tag and retained skipLibCheck remain explicit limits. Browser/CSS/hydration/theme/plugin behavior, the consuming component mappings and product UI acceptance remain open; this source decision advances no deployment gate.

Use the plan's adopted preview/generation libraries rather than building Office editors. Previews are read-only; natural-language revisions create immutable new versions. Full Office WYSIWYG editing remains the plan's existing separate scope. Original Office skills/templates, generation validation and exact-version previews/downloads remain required v1 work.

## Initial Home control contract

This is an initial mapping of **all 30 captured Home reaction nodes** (27 ancestor-visible and 3 hidden legacy) plus **four ancestor-visible zero-reaction candidates**: New conversation, Meri, Conversations and PromptInput. The 31 ancestor-visible captured control candidates are **not a proven semantic distinct-control count**. Full application control mapping, including overlay children and responsive copies, remains OPEN. A captured frame/instance/reaction does not prove an executable HTML control. Decorative icons/profile children inherit their owning control; actual role, name and semantic-distinctness must be audited during implementation.

Each row proposes a stable UI ID and future Playwright scenario. The auth and state profiles below are normative planned behavior for these rows; implementation and every scenario are PENDING. All table transitions are planned, with service activation contingent on the unresolved contracts above. Suggested-task draft preparation is a proposed safe real transition for owner confirmation during W06; every suggestion capability remains in v1. A prototype jump to a completed answer/artifact must never substitute for actual admitted execution and validation.

### Authentication profiles

| Profile | Required authorization |
| --- | --- |
| A0 | Authenticated independent entry with current canonical tenant/actor; exact session/identity bridge UNRESOLVED |
| A1 | A0 plus fresh authorization for selected conversation/resource and stored context |
| A2 | A0 plus current authorized Scope and server read decision; changing a client/scope rechecks permission |
| A3 | A1/A2 as applicable plus exact admitted run/action/artifact/version binding and current action authority |
| A4 | D008 separately verified handoff/destination authentication and current destination authorization; absent until agreed and tested |

A composite profile requires all applicable checks. Figma samples, disabled placeholders and offline authorized-view fixtures satisfy none of these live authentication requirements.

### State profiles

Every Home row binds one profile covering empty, loading, pending, error, revoked, disabled and success. Human-readable failure text must explain the unavailable operation without exposing secrets or protected content.

| Profile | Empty | Loading | Pending | Error | Revoked | Disabled | Success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N — navigation/read | Authorized empty result with useful next action | Named busy state; no fake data | Preserve current selection until actual result/ack | Safe error; explicit retry retains context | Remove protected content and block further read/action | Missing authority/contract/destination prevents execution | Show actual authorized result, never fixture data |
| L — local draft/selection | Empty draft/default selection | Hydration busy only where supported | Unsaved changes are local, not accepted server work | Validate while preserving safe draft | Purge inaccessible draft attachments/context | No authority or unavailable action is inert | Local focus/selection/draft changes; no server receipt claimed |
| S — submit | Whitespace/empty invalid draft cannot submit | Await actual request acknowledgement | Show admitted queued/running/approval state from actual response/events | Safe failure, no false completion or automatic duplicate submission | Stop inaccessible events/actions and block publication paths | Missing contract/authority/budget, unsupported attachments or duplicate request blocks execution | Accepted intent then actual validated result; acceptance is not completion |
| X — unresolved/disabled | Explain unavailable destination/action | No external request | No handoff or work accepted | Clear unavailable explanation | Locked to current authorized context | Explicit disabled and inert until reviewed destination/contract | N/A until separately implemented and accepted |
| H — hidden legacy | Hidden and inert | Hidden and inert | Hidden and inert | Hidden and inert | Hidden and inert | Hidden and inert | No user-visible success |

### Home controls and future checks

Pointers are Figma IDs, not application URLs. Outside-section pointers must remain metadata only. All no-reaction rows preserve absent prototype behavior explicitly.

| Stable UI ID | Exact Figma node ID | Captured control / pointer | Planned real transition | Frozen shape or local behavior | Auth | States | Future Playwright / status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| meri.shell.brand | I473:92315;469:41448 | Brand · Capiro · Home → 411:40629 | UNRESOLVED owned local entry or separately verified handoff; captured outside pointer stays inert | Local navigation/handoff contract UNRESOLVED | A0+A4 | X | PW-HOME-001 — PENDING |
| meri.mode.portfolio | I473:92315;469:41457 | Portfolio → 411:41421 | D008 explicit disabled placeholder until independently verified destination | Local disabled mode control; no handoff yet | A4 | X | PW-HOME-002 — PENDING |
| meri.mode.modules | I473:92315;469:41464 | Modules → 411:93787 | D008 explicit disabled placeholder until independently verified destination | Local disabled mode control; no handoff yet | A4 | X | PW-HOME-003 — PENDING |
| meri.shell.search | I473:92315;469:41472 | Search → 411:42489 | Owned Meri search/palette or verified handoff requires owner decision; outside pointer stays inert | ReadRequest/ReadResult shapes; search API UNRESOLVED | A0+A2 | X | PW-HOME-004 — PENDING |
| meri.shell.updates | I473:92315;469:41480 | Updates → 411:46861 | Owned notifications view or verified handoff requires owner decision; outside pointer stays inert | Local open; notification read API UNRESOLVED | A0+A1 | X | PW-HOME-005 — PENDING |
| meri.shell.profile | I473:92315;469:41488 | Profile · Jordan Clayton sample → 411:67409 | Owned account menu or verified handoff requires owner decision; outside pointer stays inert | Identity shape; account/session API UNRESOLVED | A0+A4 | X | PW-HOME-006 — PENDING |
| meri.legacy.search | 442:81458 | Hidden legacy Search (ancestor hidden) → 442:82465 | Remain hidden and inert; captured reaction is design metadata only | No executable contract | A0 | H | PW-HOME-007 — PENDING |
| meri.legacy.updates | 442:81467 | Hidden legacy Updates (ancestor hidden) → 448:89130 | Remain hidden and inert; captured reaction is design metadata only | No executable contract | A0 | H | PW-HOME-008 — PENDING |
| meri.legacy.profile | 442:81475 | Hidden legacy JC / Profile (ancestor hidden) → 448:89130 | Remain hidden and inert; captured reaction is design metadata only | No executable contract | A0 | H | PW-HOME-009 — PENDING |
| meri.nav.search-conversations | 442:81492 | Search conversations → 442:82205 | Open authorized conversation-history search; retain current context until selection | Conversation + ReadRequest/ReadResult shapes; listing/search API UNRESOLVED | A1 | N | PW-HOME-010 — PENDING |
| meri.nav.files | 442:81508 | Files → 443:84733 | Open authorized workspace file list; selecting a file binds its exact version | WorkspaceManifest/ArtifactVersion shapes; read API UNRESOLVED | A1 | N | PW-HOME-011 — PENDING |
| meri.nav.runs | 442:81516 | Runs → 443:82819 | Open actual authorized background runs; selecting a run binds its conversation and run | Run + UIEvent.run.status shapes; listing API UNRESOLVED | A1 | N | PW-HOME-012 — PENDING |
| meri.nav.approvals | 442:81524 | Approvals · 2 sample → 447:85660 | Open actual authorized proposals; badge comes from actual pending items | ApprovalProposal + UIEvent.approval.required; listing API UNRESOLVED | A1+A3 | N | PW-HOME-013 — PENDING |
| meri.nav.memory | 442:81531 | Memory → 446:85688 | Open governed memory recall with scope and provenance | ReadRequest/ReadResult/SourceEvidence/Coverage; named tool API UNRESOLVED | A2 | N | PW-HOME-014 — PENDING |
| meri.nav.schedules | 442:81539 | Schedules → 447:88833 | Open authorized schedule projections; lifecycle actions need reviewed contracts | ScheduleProjection shape; listing/lifecycle API UNRESOLVED | A1 | N | PW-HOME-015 — PENDING |
| meri.nav.data-access | 442:81547 | Data access → 446:85206 | Open current coverage and authorization explanation; no broader access implied | Coverage/Scope/AuthorizationDecision shapes; read API UNRESOLVED | A2 | N | PW-HOME-016 — PENDING |
| meri.recent.meeting-brief | 442:81558 | Anduril meeting brief sample → 442:81682 | Select the real authorized conversation represented by this row; sample title is not an ID | Conversation shape; conversation read API UNRESOLVED | A1 | N | PW-HOME-017 — PENDING |
| meri.recent.funding-landscape | 442:81564 | FY27 funding landscape sample → 442:81682 | Select the real authorized conversation represented by this row | Conversation shape; conversation read API UNRESOLVED | A1 | N | PW-HOME-018 — PENDING |
| meri.recent.weekly-updates | 442:81570 | Weekly client updates sample → 442:81682 | Select the real authorized conversation represented by this row | Conversation shape; conversation read API UNRESOLVED | A1 | N | PW-HOME-019 — PENDING |
| meri.nav.preferences | 442:81578 | Preferences → 448:87360 | Open owned preferences view; persistence must use a reviewed contract | Local view; preference persistence API UNRESOLVED | A0 | N | PW-HOME-020 — PENDING |
| meri.scope.header-open | 442:81587 | Anduril header scope sample → 442:81953 | Open shared authorized scope picker; revalidate on selection | Scope + ReadRequest shapes; allowed-scope listing API UNRESOLVED | A2 | N | PW-HOME-021 — PENDING |
| meri.prompt.attach | 442:81604 | Attach → 445:84258 | Open attachment choices; validate selected upload or authorized existing file before use | ObjectReference/WorkspaceManifest; upload/read/extraction API UNRESOLVED | A2+A3 | N | PW-HOME-022 — PENDING |
| meri.scope.prompt-open | 442:81611 | Anduril prompt scope sample → 442:81953 | Same scope-picker contract as meri.scope.header-open; selection updates both | Scope + ReadRequest shapes; allowed-scope listing API UNRESOLVED | A2 | N | PW-HOME-023 — PENDING |
| meri.prompt.send | 442:81619 | Send → 442:81682 | Submit actual validated draft and authorized scope; transition follows server admission/events | Send/start API UNRESOLVED; then UIEvent.message.delta/run.status | A2+A3 | S | PW-HOME-024 — PENDING |
| meri.suggestion.research | 442:81633 | Research · Start → 443:82027 | Proposed: prepare research intent/draft; execute only through explicit admitted submission | Local draft intent; send/start API UNRESOLVED | A2+A3 | L | PW-HOME-025 — PENDING |
| meri.suggestion.brief | 442:81644 | Create a brief · Start → 443:85000 | Proposed: prepare document intent/draft; show output only after actual validated generation | Local draft intent + ArtifactVersion/UIEvent.artifact.available | A2+A3 | L | PW-HOME-026 — PENDING |
| meri.suggestion.analyze-file | 442:81655 | Analyze a file · Start → 445:84258 | Open attachment/analyze intent; use actual validated extraction before reporting analysis | ObjectReference/ReadResult shapes; upload/extraction API UNRESOLVED | A2+A3 | N | PW-HOME-027 — PENDING |
| meri.suggestion.spreadsheet | 442:81662 | Build a spreadsheet → 444:83270 | Proposed: prepare spreadsheet intent/draft; no canned completed artifact | Local draft intent + ArtifactVersion/UIEvent.artifact.available | A2+A3 | L | PW-HOME-028 — PENDING |
| meri.suggestion.presentation | 442:81668 | Create a presentation → 444:83586 | Proposed: prepare presentation intent/draft; no canned completed artifact | Local draft intent + ArtifactVersion/UIEvent.artifact.available | A2+A3 | L | PW-HOME-029 — PENDING |
| meri.suggestion.template | 442:81674 | Use a template → 448:88066 | Open original curated-template choices; user confirms choice and permitted task | Local choice; curated-pack listing API UNRESOLVED | A2 | N | PW-HOME-030 — PENDING |
| meri.nav.new-conversation | 442:81485 | New conversation; no captured reaction | Start blank local draft with authorized scope; existing background run continues | Local draft; create/send API UNRESOLVED | A0+A2 | L | PW-HOME-031 — PENDING |
| meri.mode.meri | I473:92315;469:41451 | Meri active; no captured reaction | Remain in Meri and retain authorized current view | Local active mode; no external handoff | A0 | L | PW-HOME-032 — PENDING |
| meri.nav.conversations | 442:81501 | Conversations; no captured reaction | Open owned authorized history; selection revalidates resource | Conversation/ReadRequest shapes; listing API UNRESOLVED | A1 | N | PW-HOME-033 — PENDING |
| meri.prompt.text | 442:81601 | PromptInput empty frame; no captured reaction | Edit local draft; validated Enter submits, Shift+Enter inserts newline; IME composition does not submit | Local editable input; shares meri.prompt.send contract | A2 | L | PW-HOME-034 — PENDING |

Header and prompt scope controls call one shared scope-picker contract. The three recent-conversation controls bind actual authorized row identities; the sample title and common prototype destination do not select the same live conversation. Approvals' sample count of 2 and the profile/client names must never be shipped as hardcoded state.

## Close, cancel, back, focus and scroll

| Interaction | Required planned behavior / remaining qualification |
| --- | --- |
| Open dialog/drawer/popover | Remember invoker and selected tenant/scope/conversation/run/artifact/version. Use accessible name and appropriate initial focus; trap focus for modal surfaces. Exact per-overlay mappings remain OPEN |
| Close / Escape | Close only the transient local surface when allowed; restore focus to invoker or nearest safe surviving control. Do not cancel a durable run, approve a proposal or discard an accepted command |
| Cancel local draft/edit | Preserve or discard unsent local changes according to an explicit confirmation rule. No silent network mutation. Dirty attachment/revision/schedule forms need individual rules in the full control audit |
| Back / history | Restore authorized selected context and relevant list/preview scroll. If selection was deleted/revoked, return to a safe authorized parent with explanation. Route/history policy is UNRESOLVED, so no route is implied |
| Conversation scroll | Follow new stream only while the user is at the current end; preserve older-reading position and offer an explicit new-content affordance. Reconnect must not duplicate text or reset selection |
| Preview scroll | Preserve position for the exact selected artifact version; changing version visibly changes the binding and does not silently retain stale preview bytes |
| Switch conversation / new draft / close tab | Existing durable work continues as admitted. Reopening requests authorized replay from a validated cursor; no stale actor/scope or old attempt is trusted |
| Explicit stop / steer / resume / fork | Separate action contract, current authorization, pending state and actual receipt/result. Subscription stop is not run stop; restore needs the complete verified checkpoint, not session ID alone |

These are required interaction contracts, not evidence of implemented browser behavior. Lane C/A/B must reconcile each overlay and service action with the preserved v1 screens and record any mismatch through Codex-owned versioned decisions.

## Responsive references, tokens and accessibility

Match the pinned design at its exact reference dimensions before qualifying additional breakpoints. Responsive behavior must preserve context and actual control availability rather than merely scale a screenshot.

| Reference | Exact frame / size | Local pixels and SHA256 |
| --- | --- | --- |
| Desktop Home | `442:81437`, 1440×1040 | [Home PNG](design/meri/20261010T004355Z/home-442-81437.png), `6f15ecf712252124bfee60a0245e62ccd989a3359dd0510de572d98cabfae772` |
| Tablet conversation | `448:90209`, 1024×1100 | [Tablet PNG](design/meri/20261010T004355Z/tablet-448-90209.png), `d87d103ba89ec8da13577f75ca1841c15117464d456389c74770b4c65518aab4` |
| Phone Home | `449:88256`, 390×844 | [Phone PNG](design/meri/20261010T004355Z/phone-449-88256.png), `a57e744f7d07d73ac4350421eff46b6bd07004441bf57be868110dd91fe8e3bf` |
| Dark workspace | `448:89992`, 1440×1040 | [Later Dark PNG](design/meri/20261010T012511Z-extension/dark-448-89992.png), `d5c921e681e918b02cdb5b705347798d3d554570faf1f026aa295169c718b674`; captured and inspected, application comparison PENDING |

The Home desktop capture shows a 64px header and 232px sidebar. These are observations for that reference, not a tested universal breakpoint policy. Tablet conversation and phone Home are different views; neither proves responsive parity for all 85 frames. Additional breakpoints, orientation, overflow and reduced-motion behavior require recorded implementation and checks. The later dark reference shows dark content/sidebar with a light shared top header; it establishes no live theme-switching or application parity.

The snapshot records **38 variables in five collections**. Light and dark are separate collections, not two modes of one collection. Preserve variable aliases and captured values from the original inventory. The later [style definitions](design/meri/20261010T012511Z-extension/styles.json) supply all 18 exact referenced IDs; use their recorded fields rather than inferred style values.

| Exact collection ID | Captured collection | Captured mode |
| --- | --- | --- |
| `VariableCollectionId:11:338` | v2 · shadcn / color | `11:0` Light |
| `VariableCollectionId:11:369` | v2 · shadcn / radius | `11:1` Mode 1 |
| `VariableCollectionId:2:45` | shadcn / color | `2:3` Light |
| `VariableCollectionId:2:77` | tailwind / spacing | `2:5` Mode 1 |
| `VariableCollectionId:448:90059` | Meri · Dark theme | `448:0` Dark |

Observed typography includes Geist Regular/Medium/SemiBold and Geist Mono Medium. Font files, runtime availability, metrics and redistribution rights remain unverified. The later capture preserves the referenced style definitions and an inspected dark PNG. Do not claim pixel equivalence until fonts/tokens/styles and actual application rendering are qualified.

Required future checks include semantic roles/names; keyboard-only navigation and visible focus; Enter/Shift+Enter/IME behavior; focus restoration and modal escape; screen-reader stream announcements without repeated entire transcripts; disabled controls that cannot execute; contrast in both themes; touch targets; zoom/reflow; long titles/messages/tool output; tables/code/filenames; loading/error/revoked states; overflow and reduced motion. Render plain user-facing copy rather than implementation jargon. Baseline pixels alone pass none of these checks.

## Open gate work and handoff

| Work | Gate/package / proposed owner | Status and evidence required |
| --- | --- | --- |
| Finish semantic distinct-control inventory, full graph, all overlay children and exact fixture links | W01/W06/G6; Codex+C, D checks | OPEN. D012 accepts the complete pinned frame/state/component inventory and initial Home contract for G0 discovery; complete semantic service/fixture mapping remains required |
| Independent session/identity bridge and versioned shared-shell navigation; owned behavior for outside-section Home header pointers | G0/W04/W06; Codex+B+separate new frontend owner | OPEN. No guessed routes, outside traversal, provider/source credentials or private Capiro logic |
| Accept exact AI Elements/shadcn source, APIs, versions/licenses and meaningful compatibility evidence | G1/W02/W06; Codex+Hermes+D | Source preparation accepted OFFLINE8d2cd17/d442885 after review2 and parent12; cold performance, consuming browser/CSS and complete release notice/security checks OPEN |
| Version missing admission, run lifecycle, schedule, upload/revision/download and other service contracts without loosening frozen authorization | W01/W04/W08; Codex+A+B+C | OPEN. Shapes alone cannot enable controls |
| Implement every v1 planned capability, state and component in the coverage ledger using adopted primitives and actual authorized services | W06–W08/G4–G5; C+A+B | PENDING. Include background stop/steer/resume/fork, stale approvals, evidence/memory, upload/extraction failures, immutable revisions/exact downloads/filing, browser permissions and schedule lifecycle |
| Match exact desktop/tablet/phone/dark references; qualify theme/font/responsive/long-content/accessibility behavior | W06/W09/G6; C implements, D independently verifies | PENDING on actual application candidate; all four local visual references exist, including the later dark capture |
| Exercise all 11 walkthrough starts and 100% of accepted distinct visible controls with real transitions/adverse states and tenant/client preservation | W09/G6; D independently verifies; C+A+B repair | PENDING on immutable staging candidate with traceable Playwright, visual and accessibility evidence |

Document generation and capture classification are not UI acceptance. Preserve all agreed v1 capabilities until their required gates pass; resolve discrepancies explicitly through recorded owner decisions. No source connection, deployment or cutover is admitted by these documents.
