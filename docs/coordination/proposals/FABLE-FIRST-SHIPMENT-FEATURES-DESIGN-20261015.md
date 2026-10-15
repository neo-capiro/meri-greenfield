# First-shipment features: device/browser bridge, live takeover, in-browser Office editing, authenticated website workflows (design proposal, revision 2)

> **PROPOSAL, AWAITING OWNER APPROVAL. NOTHING IS IMPLEMENTED.** This document is input to the `FEATURE-DESIGN-APPROVAL` gate in the [scope ledger](../ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md). The owner is Neo Martinez; dot reviews. This lane changed no code, dependency, lockfile, contract, catalog, migration, credential, cloud resource or deployment. It allocates no migration ID and opens no gate. Every recommendation below is a proposal. Module paths named as "proposed" are suggestions for allocation, not created files.
>
> **What this document does not grant.** No recommendation here approves or performs: installation of anything on a user device (extension, helper, policy), browser or extension permissions, persistent device pairing, persistence of any third-party credential or session state beyond what is stated as a proposal, any cloud resource, any purchase, subscription, quote request or vendor contact, any numeric budget, any placement, or any first-shipment scope commitment. Each of those stays a separate, explicit owner decision. Package three remains HOLD; accepting this design would not change that.

## Revision note — 15 October 2026 (revision 2)

Revision 2 refines this proposal against dot's feature-design review, [`PACKAGE3-DESIGN-REVIEW.md`](https://github.com/neo-capiro/meri-greenfield/blob/f8d1816eda48347eeca4c0c25308870f2885c1f5/docs/coordination/audits/meri-comprehensive-20261015/PACKAGE3-DESIGN-REVIEW.md), and item 5 of the [package-three review summary](https://github.com/neo-capiro/meri-greenfield/blob/f8d1816eda48347eeca4c0c25308870f2885c1f5/docs/coordination/audits/meri-comprehensive-20261015/PACKAGE3-REVIEW-20261015.md) (published at origin commit `f8d1816e`). Those files are not on this branch's base; they are cited at that commit. The review was performed on revision 1, Git blob `f4c9be9b345d0920dc21f5209f206e2e6e096002`, which is identical in design branch `c827406a` and package three `81e20025`. Revision 2 was written on branch `fable/r4-design-refine-20261015` from base `81e20025`. It is still a proposal; nothing in it is implemented, and none of the review's findings is "closed" by prose. Each mechanism below names the test that would close it once built.

Where each review finding is addressed:

| Review finding | Change in revision 2 | Sections |
| --- | --- | --- |
| Takeover must deny new agent calls and drain/fence in-flight ones before the user's lease; hand-back needs explicit resume and a fresh safe snapshot; lost stream or timeout stays paused | New shared **control fence and drain** mechanism (S1): a fence in the session owner (the single execution point), bounded drain, UNKNOWN for unsettled calls, grant only when drained and the lifecycle hold is applied, fail closed if drain cannot complete, return only through explicit lifecycle resume with a new attempt fence. Auto-resume removed. | 1.1 S1; 3.2; 3.6; Q-T5, Q-T7 |
| Login confidentiality: suspend model-bound snapshots/screenshots, redact all inputs including OTP and other credential fields; say the model and logs do not receive credentials, not that the system has no custody | New **model-bound confidentiality filter** (S2) at the session owner's MCP output boundary, covering every tool response (not only `browser_snapshot`), fail-closed, plus a canary test plan. Custody wording corrected everywhere. | 1.1 S2; 2.4; 3.4; 5.2; 5.4; 5.6 |
| Disconnect only clears cookies; destroy all authenticated state and stop in-flight actions; test real invalidation | New **authenticated-state destruction** (S3): fenced teardown of the whole browser context, profile and process tree (cookies, local/session storage, IndexedDB, Cache Storage, HTTP cache, service-worker data, downloads), verified absent, on disconnect, conversation end, revocation and crash. Invalidation test that fails if only cookies are cleared. | 1.1 S3; 5.3; 5.6; 6.3 |
| Editor: coherent autosave, explicit save, CAS conflicts and immutable versions; session usable across saves; validation must not discard the draft | Rewritten **WOPI save model**: per-edit-session WOPI file, lock tokens, PutFile accepted into a private draft store, publish pipeline that creates immutable versions only from explicit saves, two-level conflict handling, idempotent publish with UNKNOWN barrier, crash/abandon recovery. | 4.2; 4.4; 4.6; Q-O6, Q-O9, Q-O10 |
| Pinned manifest version must not delay urgent disable/revocation; keep withdrawal effective during an active run | New **live revocation** mechanism (S4) for all four features: withdrawal generations checked on every action and pushed to owners, fail closed on staleness, per-feature enforcement. Manifest pinning now applies to changes and widening, never to withdrawal. | 1.1 S4; 2.4; 3.4; 4.4; 5.4; 6.10 |
| The user-device browser is outside infrastructure egress; intranet support conflicts with public-only filtering | Intranet/VPN claim removed from the bridge's capability statement. Public-only is described as hostname-level software filtering, not network enforcement. Private-network access is a separate explicit owner decision (Q-B8), recommended out of the initial design. | 2.1; 2.4; 2.10 |
| Prove the filtered CDP integration actually enforces read-only; Playwright-internal evaluation is not that proof | Read-only claim withheld until a mutation-canary test passes; relay method allowlist for read-only mode; fallback to a CDP-native read path if Playwright's read tools need script evaluation (qualification decision). | 2.4; 2.6; Q-B2 |
| Bridge narrowed: opt-in separate trust tier, selected tabs and selected approved public sites, visible state, immediate local disconnect, no background attachment; installation, persistent pairing and permissions are separate decisions | Bridge scope boundary and pairing narrowed; persistent pairing is now an explicit decision (Q-B9), recommended session-bound. | 2.1; 2.2; 2.10 |
| Collabora pricing rationale is outdated; Collabora-through-WOPI is an evaluation candidate, not a purchase | CODE-limit statement corrected. Collabora is an **evaluation recommendation**, not a subscription, budget or verified commercial offer. Written-quote contents listed. | 0; 4.3; Q-O2 |
| 30–47 engineer-weeks is an unvalidated author estimate | Labelled as unvalidated planning, with assumptions; revision-2 additions estimated separately and also unvalidated. | 0; 6.7 |
| Release scope must be confirmed; calling the editor optional would amend recorded scope | New Q-X0. The editor is not described as optional or deferrable. | 0.1; 6.9 |
| First sites: ask for one or two site + exact task combinations, retrieval/export first; prefer connectors; connector work does not count | Q-A1 sharpened; Q-A7 sharpened; section 5.1 updated. | 5.1; 5.10 |
| Placements as logical homes; placement approval is not deployment | Placement section aligned with the review's logical homes; relay is not a generic remote-device gateway; editor has no shared warm state. | 6.2; 6.5 |
| A small qualification spike would resolve the main technical uncertainties | Proposed as an explicit decision (Q-X6), synthetic and local, with no cloud resource or purchase. | 6.6; 6.9 |

Date: 15 October 2026. Lane: Fable design. Revision 1: branch `fable/design-first-shipment-features-20261015`, base `db88ef1c` (package two re-signed, same tree as `e09a5783`). Revision 2: branch `fable/r4-design-refine-20261015`, base `81e20025` (package three). Both bases contain the [owner decisions record](../reports/FABLE-OWNER-DECISIONS-20261015.md) and the regenerated scope ledger.

Why this exists: Fable's [owner decisions record](../reports/FABLE-OWNER-DECISIONS-20261015.md) relays an owner decision of 15 October 2026 to include all four previously deferred features in the first shipment. That record is evidence of what Fable recorded; dot's review notes it is not fresh authorization to approve designs, spending, device permissions or placements, and asks the owner to confirm whether all four are release-blocking (Q-X0). AGENTS.md requires approval before any change to architecture, component choices, scope or placement. So each feature needs an approved design before anyone builds it.

Coordination note: the AGENTS.md on this branch's base (inherited from ba40647c) still carries the older OpenAI/Codex-only text. The current handoff AGENTS.md (commit aa09dd28, 14 October 2026) assigns Meri implementation to Fable and independent validation/integration to dot, and supersedes that restriction. The integration branches have not yet merged aa09dd28; dot, as integration owner, decides when to merge it. No ownership question remains open for this proposal.

## 0. Decision summary

| # | Feature | Recommended definition (scope boundary) | Recommended architecture and components | License / service constraints | Placement (logical home, needs approval) | Effort (eng-weeks, unvalidated) | Owner decisions needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Device/browser bridge | **Interpretation A, narrowed.** Opt-in, separate **user-device trust tier**. Meri reads tabs the user explicitly selects in their own desktop Chrome/Edge, and may open new tabs only to selected approved **public** sites. Read-only by default; interactions need separate enablement and per-action approval. Visible connection state and immediate local disconnect. No other tabs or profiles, local files, cookie export, background attachment, arbitrary CDP or private-network destinations. | A small Meri extension (Manifest V3) built from the upstream **Playwright Extension** (Apache-2.0). Session-bound pairing through a short-lived, device-bound, revocable capability. Outbound connection to a bounded **control-plane relay**. The worker's pinned **Playwright MCP 0.0.83** attaches through `cdpEndpoint` + `cdpHeaders`. Relay method allowlist; read-only claim only after the mutation-canary test passes. | Apache-2.0 (keep notices). Distribution method is an owner decision. `chrome.debugger` shows a "debugging" banner. | User device (extension, separately approved); relay in the control domain; MCP in the conversation worker | 8–12 | Q-B1–Q-B9. Mainly: accept the trust tier that is **outside infrastructure egress control** (Q-B1); keep private networks out (Q-B8); session-bound pairing (Q-B9). |
| 2 | Live browser takeover | **Interpretation B.** Live view of the conversation's isolated browser, plus an **exclusive control lease** for the conversation owner only. Agent calls are fenced and drained before the user gets control; hand-back needs an explicit resume and a fresh, filtered snapshot. No recording, clipboard or file sync in v1. Desktop only. | The **browser session owner** process on the D005 host serves Playwright MCP (`createConnection`) and owns the fence (S1), the confidentiality filter (S2), screencast (`page.screencast`) and input (`page.mouse`/`page.keyboard`). Frames go to the relay over the worker's trusted channel. **Not VNC.** | Apache-2.0 only (Playwright). No X server and no GPL VNC server. | Existing isolated browser host boundary (session owner); control (relay); frontend viewer | 6–9 | Q-T1–Q-T7 |
| 3 | Full in-browser Office editor | **Interpretation A.** WYSIWYG editing of DOCX/XLSX/PPTX. Autosaves land in a private draft store; an explicit save is published as a **new immutable version** through the existing artifact owner after checks pass; a failed check or conflict never discards the draft. One editor per edit session. PDF stays preview-only. | **Collabora Online** through **WOPI** as the **evaluation candidate** (not a purchase). WOPI host and draft store are new modules of the artifact owner. One disposable editor container per edit session. Fidelity qualified on a held-out corpus. Fallback candidate: ONLYOFFICE Docs behind the same WOPI host. | Collabora server MPL-2.0. CODE is a rolling development edition without SLA/LTS that the vendor does not recommend for production; the 10-document/20-connection limit applies in Home Mode, not default CODE (Collabora clarification, September 2026). Production terms need a written quote; no commercial offer for Meri's use is verified. ONLYOFFICE Community: AGPL-3.0 plus disputed §7 terms. | Disposable single-session editor containers (prefer existing approved hosting if it meets the sandbox constraints); WOPI host and drafts in the artifact owner | 9–14 (+ evaluation, quote, legal) | Q-O1–Q-O10. Mainly: evaluation approval, quote contents, placement, draft retention. |
| 4 | Authenticated third-party website workflows | A **named site + exact task** that the platform owner approves and qualifies individually, starting with retrieval or export. Runs in the conversation's isolated browser. Authenticated Meri chat (Clerk) is separate and unchanged. Connector/API work does not count as acceptance for this feature. | **Site workflow manifests** in platform configuration beside the approved destination list. **Credential model C1:** the user signs in through takeover. The model, transcripts, receipts and logs never receive credentials (S2). The browser host does hold the resulting session state in the conversation profile until it is destroyed (S3). Consequential actions go through the canonical approval owner. Withdrawal is live (S4). | Each site's terms must permit automation (legal review per site). | Existing isolated browser host; platform configuration; control | 5–8 framework + 1–2 per site/task | Q-A1–Q-A8. Mainly: the one or two first site + task combinations. |
| X | Cross-feature | Desktop only for all four. Nothing activates until its own gate opens (browser activation hold for 2 and 4; separate bridge activation for 1; editor host admission for 3). | Shared mechanisms S1–S4 (section 1.1); session owner; relay; canonical approval port; receipts; per-conversation disposal. | — | — | **30–47** for the revision-1 scope plus an estimated **4.5–7** for the revision-2 mechanisms. **Unvalidated author planning**, not a delivery date; assumptions in 6.7. Prerequisite HOLD work, procurement and cloud actions excluded. | Q-X0–Q-X7 |

Recommended build order (section 6.6): finish the existing conversation, tool, artifact and safety prerequisites → **takeover → one named authenticated site/task**. The **Office editor** is evaluated on a parallel track. The **device bridge** comes last, because it introduces the largest new trust boundary. A small synthetic qualification spike (Q-X6) should precede broad implementation.

### 0.1 Top owner questions after revision 2

These are the decisions that block design acceptance, in the order they unblock work. Full lists are in each feature's section; tags there mark each question as **[new]**, **[sharper]** or unchanged.

1. **Q-X0 [new]** Are all four features release-blocking first-shipment requirements? Calling any of them optional, or moving it later, would amend Fable's recorded scope rather than accept this design.
2. **Q-A1 [sharper]** Which one or two **website + exact task** combinations come first? Recommended: retrieval or export (no submission, payment or account administration). Outlook/SharePoint retrieval is a suggestion only if it matches real needs, and only where no connector/API covers it.
3. **Q-B1 + Q-B8 [sharper/new]** Accept the bridge's user-device trust tier, in which redirects, subresources and network traffic happen on the user's own network outside Meri's egress boundary and software navigation filtering is not equivalent protection? And keep private-network/intranet destinations out of the initial design (recommended), deciding them later only through a separately reviewed boundary?
4. **Q-O2 [sharper]** Approve Collabora-through-WOPI as the **evaluation** candidate only: fidelity and deployment-fit evaluation plus a written commercial quote for Meri's embedded multi-tenant use, before any spending request. No purchase and no numeric budget now.
5. **Q-X2 [sharper]** Approve the logical homes in section 6.2 as placements (placement approval is not deployment, spending, migration or credential approval).
6. **Q-X6 [new]** Approve a bounded synthetic qualification spike (session-owner fence/drain and relay separation; WOPI save/lock/recovery lifecycle against a local editor build) before broad implementation, with no cloud resource, purchase or live site.
7. **Q-B9, Q-T5/Q-T7, Q-O9, Q-X7 [new/sharper]** Session-bound bridge pairing (no persistent device record); takeover timeout and drain failure behaviour; editor draft retention class; live-revocation propagation target and fail-closed staleness bound.

## 1. What already exists and is reused

| Existing owner | Path / record | How these features reuse it |
| --- | --- | --- |
| Single model loop | Claude Agent SDK 0.3.295 `query` (`apps/worker/conversation/activity.mjs`, `options.mjs`) | No feature adds a model loop. Bridge and takeover add MCP configuration and hooks to the one query. |
| Browser fragment | `apps/worker/conversation/browser/**` (README, `policy.mjs`, `permissions.mjs`, `server.mjs`, `downloads.mjs`, `workspace.mjs`, `receipts.mjs`, `activation.mjs`, `egress.mjs`, `resolution.mjs`) | The tool policy (`BROWSER_TOOLS`, `INTERACTION_TOOLS`), deny-by-default destinations, platform limits (`public-web.mjs`), the `PreToolUse` + `canUseTool` approval gate (`meri-browser-approval-request/2` with `inputDigest`), the download → `artifacts.ingest` path, receipts and `disposeBrowserState` (verified profile/home/output removal) all stay canonical. |
| Activation hold | `activation.mjs` `BROWSER_ACTIVATION={state:'held'}` + `EGRESS_REQUIREMENTS` | Takeover and authenticated workflows cannot open before it opens. The bridge needs its own gate (section 6.1). |
| Destination policy | `resolution.mjs`: platform maximum ∧ tenant ∧ role; owner Decision 3 | Site manifests and bridge origins are subsets of the platform-approved list. Tenant admins can only narrow. |
| Canonical approval owner | `apps/control/commands/approval-context.mjs` (ApprovalProposal / ApprovalDecision); lifecycle approval-wait in `apps/control/conversations/lifecycle` | Every consequential action in features 1, 2 (agent side) and 4 goes through it. The browser README lists the approvals port owner as remaining work item 5. |
| Conversation lifecycle | `apps/control/conversations/lifecycle` (pause/approval-wait holds, `nextControls`/`claimControl`/`ackControl`/`recordCheckpoint`, resume with exact retirement and a new admitted run/attempt/higher fence), Temporal workflows | Takeover leases and bridge attachments are lifecycle controls, not a second orchestrator. A takeover is a hold of the pause family; hand-back returns control through the existing resume path (S1). Its existing rule that ambiguous delivery stays UNKNOWN, and that no timeout grants replay, is reused unchanged. |
| Artifacts | `apps/artifacts/**` (immutable versions, CAS head, `ARTIFACT_EFFECT_UNKNOWN`, structural inspection `structure/file-structure.mjs`), `apps/runtime/artifacts` (document application, signed download links, suppression generation) | The editor's WOPI `GetFile` reuses the download authorization chain; publishing reuses the create/revise path and its CAS and UNKNOWN semantics. |
| Isolated browser host | D005; `docs/qualification/G1-REMAINING-WORK.md` | Takeover and authenticated workflows run there. |
| Pinned Playwright | `@playwright/mcp` 0.0.83 + `playwright-core` 1.64.0-alpha (`docs/COMPONENTS.md`) | Verified in the installed package (`apps/worker/qualification/node_modules` in the `meri-fable-complete` worktree): `createConnection(config, contextGetter)` (`@playwright/mcp/index.d.ts`); config `cdpEndpoint`/`cdpHeaders`/`remoteEndpoint` (`config.d.ts`); `page.screencast.start({onFrame,size,quality,fps})` (`playwright-core/types/types.d.ts`, interface `Screencast`); `browser.bind()`. Not yet exercised: these are source facts, not qualification. |
| Figma (Meri UI) | File `IXJzJUkXcUTkySHir5JNea`, page `1064:140864` "Prototype — Capiro 3.4" (layer metadata inspected only) | Existing frames are cited per feature. The current design explicitly says "Live browser viewer · Not selected / unsupported · No live viewer or user takeover" (`1064:152347`, in `12.17 · Browser permissions & qualification` `1064:152281`), and "Office previews are read-only" (`1064:151439`). Those frames must change. The repository's older design references point at file `Zc2dEN5aLU47dVdsewDmiJ`. dot should confirm which file is authoritative for `docs/UI-COVERAGE.md`. |

New shared parts that need approval (each is introduced once and reused):

- **Browser session owner** (proposed `apps/worker/conversation/browser/session/`). One process per conversation on the D005 host. It launches the browser through Playwright and serves Playwright MCP to the SDK over stdio (`createConnection`). Because every agent browser call executes inside it, it is the **single enforcement point** for the fence (S1), the confidentiality filter (S2) and state destruction (S3). It also owns screencast and input for takeover. This replaces the current "spawn the MCP CLI" composition in `server.mjs` with the same flags as config: `--sandbox`, per-conversation user-data-dir, origin lists, `--block-service-workers`, `--no-webmcp`, action/navigation timeouts. It stays inside the one Playwright integration. Alternative: keep the CLI and attach it with `--endpoint` to a browser bound by `browser.bind()` on a named pipe. That alternative cannot host S1/S2 at the execution point (the CLI would execute calls the session owner cannot see), so it would need the fence and filter at the stdio boundary instead; it is unverified for persistent contexts and is a qualification item.
- **Live session relay** (proposed `apps/control/live-session/`). A bounded WebSocket transport in the control domain between an authenticated user and a conversation's worker. Takeover uses it for frames and input. The bridge uses it for filtered CDP. It reuses existing identity and authority, issues separate tickets, enforces per-connection rate and backpressure limits, and persists no payloads (receipts only). It is **not** a generic remote-device gateway: it routes only the two message families defined here, for current attachments or leases. AI SDK UI transport stays the chat transport.
- **Contract proposals for dot** (not edited here): live-session ticket, takeover lease control (including the fence/drain states and `BROWSER_ACTION_OUTCOME_UNKNOWN`), withdrawal generation, bridge pairing/attachment, WOPI edit session and draft, site workflow manifest. Each needs a versioned schema in `packages/contracts` through its owner. Migrations needed (device pairings if approved, edit sessions/locks/drafts, site enablement, withdrawal generations) get IDs from dot centrally.

### 1.1 Shared safety mechanisms (new in revision 2)

Four mechanisms are defined once here and referenced by each feature. They reuse existing owners; none adds an orchestrator, scheduler or credential manager.

#### S1. Control fence and drain (exclusive takeover, disconnect, revocation)

Purpose: no agent action may still be executing, or start, once the user (or a teardown) has control. Pausing only *subsequent* tool calls leaves a race with a call that is already running; S1 closes it.

**Where the fence lives.** The authoritative fence is in the browser session owner, because every agent browser call executes there. The worker's `PreToolUse` hook also denies (`BROWSER_USER_IN_CONTROL`) as defence in depth, but the hook runs in a different process and can race; it is not relied on. For the bridge, the equivalent fence point is the relay (section 2.4). For the editor, it is the WOPI host (section 4.4).

**States** (per conversation browser; recorded in the lease control and in receipts):

| State | Agent calls | User input | Leaves when |
| --- | --- | --- | --- |
| `agent` | admitted (subject to policy and approvals) | refused | a takeover, disconnect or revocation is recorded |
| `fencing` | **new calls refused** with `BROWSER_USER_IN_CONTROL` (or `BROWSER_REVOKED`) before they touch the page | refused | the in-flight table is empty, or the hard drain bound is reached |
| `drained` | refused | refused | the lifecycle hold is `APPLIED` (run checkpointed and paused) → `user`; or teardown proceeds (S3) |
| `user` | refused | admitted for the lease epoch only | hand-back, lease timeout, lost stream, revocation |
| `returning` | refused | refused | the filtered post-lease snapshot is captured and the user explicitly resumes |

**Step 1, fence.** Recording `takeover.begin` (a lifecycle hold of the pause family, with immutable `controlId`) makes control send a fence command over the trusted channel. The session owner increments a per-browser `controlEpoch` and atomically closes admission. Every agent call carries the epoch it was admitted under. A call that reaches the session owner after the fence is refused without executing, even if the worker hook let it through.

**Step 2, drain.** Calls admitted before the fence are tracked in an in-flight table (MCP request ID, tool, epoch, approval ID if any, start time). They are allowed to settle. Every Playwright action already has a bounded timeout (`--timeout-action`, `--timeout-navigation`; defaults 5 s and 60 s in `DEFAULT_BROWSER_POLICY`), so the drain bound is the larger applicable timeout plus a margin (proposed: settle bound = max(actionMs, navigationMs of in-flight calls) + 5 s; hard bound 130 s, the policy maximum plus margin).

- A call that **settles with a definite result** returns to the model normally (through S2), and its receipt carries the epoch.
- A call that **settles with a timeout or transport error after dispatch** (the input may or may not have reached the page, or a navigation may be pending) is recorded as `BROWSER_ACTION_OUTCOME_UNKNOWN`. The model receives that code and no page content.
- **Cancellation:** v1 does not rely on aborting a Playwright action mid-flight. Per-request cancellation in Playwright MCP 0.0.83 is not verified, and closing the MCP transport does not stop an action already running in the session owner. The design waits for settlement within the bounded timeouts instead. If the qualification spike proves a reliable cancel path, a cancelled call is still recorded `BROWSER_ACTION_OUTCOME_UNKNOWN`, because a cancelled input may already have been dispatched.
- If any call is **still unsettled at the hard bound** (for example a hung CDP session), the browser is treated as untrustworthy. The lease is **not granted**. The run stays paused. The takeover ends as `TAKEOVER_DRAIN_UNKNOWN`. The user is offered "Reset browser", which runs S3 destruction and starts a fresh empty profile (losing any sign-in). The design never hands a user a browser that an agent action may still be driving.

**UNKNOWN handling.** UNKNOWN is a barrier, as elsewhere in Meri. An UNKNOWN call is never retried, replayed or redispatched automatically, before or after hand-back. If it consumed an approval, that approval stays consumed; repeating the action needs a fresh proposal and a fresh decision (the lifecycle rule that a grant never aliases into a new run applies). Before the user gets control, the lease banner shows "Meri's last action may or may not have completed: {tool} on {host}" so the user can check the page. After hand-back, the model's note names the UNKNOWN call (tool and host, no content).

**Step 3, grant.** The lease is granted only when the in-flight table is empty **and** the lifecycle hold is `APPLIED` (the worker has checkpointed and published `paused`; worker publication is already held from the moment a pause-family control is recorded). User input events carry the lease epoch; events with any other epoch are dropped and counted.

**Return of control.** "Hand back" moves to `returning`: user input closes (epoch increments), screencast may continue view-only, and the session owner itself captures a post-lease snapshot through S2 with all form-control values redacted (S2 rule 3). The run then waits in `paused`. Control returns to the agent **only** when the user explicitly chooses "Resume", which uses the existing lifecycle resume: exact retained hold, originating `APPLIED` control, immutable checkpoint, native retirement of the paused attempt, and a new admitted run/attempt with a higher fence. Any late result attributed to the old attempt is rejected by that fence. The new run's first browser context is a content-free note ("the user controlled the browser from t1 to t2; current URL host is …; UNKNOWN calls: …") plus the filtered snapshot. Lease idle timeout, viewer disconnect, lost stream and relay failure all end the lease and leave the run **paused**; nothing auto-resumes.

**Tests that would close S1** (synthetic unless stated; each must fail when the mechanism is removed, shown by reverting it):

1. A slow approved interaction admitted just before `takeover.begin`: the lease is granted only after it settles; no user input event is accepted before then.
2. An agent call that arrives at the session owner after the fence while the worker hook is stubbed to allow it: refused with `BROWSER_USER_IN_CONTROL`, zero page effects (page-side event recorder shows nothing). Reverting the session-owner fence (hook-only) makes this test fail.
3. An action that times out after dispatch: recorded `BROWSER_ACTION_OUTCOME_UNKNOWN`, receipted, never re-executed after resume, and its approval cannot be reused.
4. A hung CDP call past the hard bound: no lease, run paused, `TAKEOVER_DRAIN_UNKNOWN`, reset offered.
5. User input carrying a stale epoch after hand-back: dropped.
6. A late result from the paused attempt after resume: rejected by the attempt fence.
7. Lost viewer stream and idle timeout: lease ends, run stays paused, no auto-resume.
8. Live (UNRUN until the D005 host exists): the same races against a real non-root sandboxed browser through the session owner.

#### S2. Model-bound confidentiality filter (login snapshots and credentials)

Purpose: credentials and sign-in secrets typed during takeover, and sensitive authenticated content, must not reach the model, transcripts, receipts, logs or telemetry. Upstream password masking in accessibility snapshots is not enough: it does not cover OTP codes, recovery codes, security answers, card numbers or text fields used for secrets, and it covers only one tool.

Correct claim: **the model and logs do not receive credentials.** The system as a whole does have custody of session state: the isolated browser host holds session cookies and tokens in the conversation profile until S3 destroys it. This document no longer says "Meri never sees credentials".

**Where.** One output boundary in the browser session owner wraps **every** MCP tool response before it leaves the session owner for the worker. Playwright MCP returns page content from many tools, not only `browser_snapshot`: navigation and interaction tools append a page snapshot by default; `browser_tabs` returns titles and URLs; `browser_handle_dialog` returns dialog text; `browser_take_screenshot` returns pixels. All of them pass through the filter. Receipts and telemetry are written from the filtered form only. Screencast frames go only to the viewer relay; the frame path has no consumer that writes to the model, receipts, logs or telemetry, and no frame is persisted. For the bridge, the same filter runs in the worker on the `meri_device_browser` MCP responses (the relay sees CDP, not tool output) and the relay never logs CDP payloads.

**Rules.**

1. **During a lease** (states `fencing` through `returning`): no model-bound output is produced at all. Agent tools are refused by S1, and the session owner produces no snapshots or screenshots for the worker.
2. **Credential fields are always redacted**, in every snapshot at any time: values of `input type=password`; fields whose `autocomplete` contains `current-password`, `new-password`, `one-time-code`, `cc-number`, `cc-csc`, `cc-exp` or similar credential/payment tokens; fields matched by the site manifest's `sensitiveSelectors`. Values become `[redacted]`; labels stay so the agent can still navigate.
3. **After a lease**, the first snapshot (captured by the session owner, not requested by the model) redacts the values of **all** form controls and contenteditable regions. The user may have typed secrets into ordinary text fields. Subsequent agent snapshots return to rule 2.
4. **Sensitive pages are withheld, not masked.** A page is sensitive when its origin and path match the manifest's `signInUrl` or `idpOrigins`, or it contains a focused or non-empty field covered by rule 2. On a sensitive page, snapshots return "sign-in page; content withheld" plus the host, and `browser_take_screenshot` is refused with `BROWSER_SENSITIVE_PAGE`. Pixel masking is not attempted because it is unreliable.
5. **URLs are reduced** in tool output and receipts to origin plus path; query strings and fragments (which often carry tokens or codes) are dropped. Dialog text on sensitive pages is withheld.
6. **Fail closed.** If the filter cannot parse a response (for example after an upstream snapshot format change), the response is blocked with `BROWSER_OUTPUT_UNFILTERABLE`; it is never passed through. The filter is pinned to the Playwright MCP version, so a version bump must re-run its tests.

**Tests that would close S2:**

1. Canary sign-in page (synthetic): password, OTP (`autocomplete=one-time-code`), security-answer text box, card number, and a plain text field. Unique canary strings are typed during a lease through the takeover input path. Assert that no canary appears in any model-bound tool result (captured at the SDK hook boundary), the SDK transcript, receipts, logs, telemetry or relay logs. Removing the filter must make the test fail.
2. For every tool in `BROWSER_TOOLS`, the canary page's credential values are absent from the response, including action-appended snapshots.
3. A screenshot on a sensitive page is refused; a snapshot is withheld; a non-sensitive page still works.
4. A URL with a token in its query string appears in output and receipts as origin plus path only.
5. An unparseable synthetic response is blocked, not passed.
6. Bridge: the same canaries in a selected device tab never reach the model or relay logs.
7. Live (UNRUN until a real browser): repeat 1–3 with the pinned browser and MCP version, including a real IdP test tenant once a site is named.

#### S3. Authenticated-state destruction

Purpose: when a site session ends, every piece of authenticated state is destroyed, not only cookies, and no in-flight action can use it afterwards. The design prefers a clear context and profile lifecycle over a new credential manager.

**What is destroyed.** The whole Playwright `BrowserContext` and the Chromium process tree are closed (session cookies and tokens live in memory too). Then `disposeBrowserState` removes the profile, home and output directories and verifies they are absent. That covers cookies, local storage, session storage, IndexedDB, Cache Storage, the HTTP cache, service-worker registrations and their storage (service workers are already blocked by `--block-service-workers`; any data directories are removed anyway), File System Access and other origin storage, network state such as HSTS and socket pools, saved form data, and local download copies in the output directory. Downloads already ingested as artifacts stay governed by artifact retention; their local copies are destroyed. Chromium's password manager and autofill must be disabled in the session owner's launch configuration (a requirement to verify in qualification; this revision did not confirm the current defaults), so that no saved credential store exists to remove. Playwright `storageState` is never exported.

**Order.**

1. Fence and drain (S1). In-flight calls settle or become `BROWSER_ACTION_OUTCOME_UNKNOWN`; new calls are refused with `BROWSER_SESSION_ENDING`.
2. Optional server-side logout: if the manifest defines `logoutUrl`, the session owner (not the model) navigates there inside the manifest origins with a bounded timeout. The receipt records `logout: confirmed | failed | unknown | not-defined`. Logout is best effort: failure does not block destruction, and the UI says the site session may still be valid on the site's side.
3. Close the context and terminate the process tree; verify the processes are gone.
4. `disposeBrowserState`; verify the directories are gone. Failure leaves the conversation browser unavailable (`BROWSER_DISPOSE_INCOMPLETE`), never reused.
5. If the run continues, launch a fresh, empty profile.

**When.** User "Disconnect"; conversation end (close, delete or cancel); site session TTL expiry (manifest); every revocation in S4; and session-owner crash. After a crash, the restarted owner destroys any surviving profile before launching anything; it never relaunches onto a surviving profile. Host destruction of the per-conversation D005 unit is the backstop.

**Tests that would close S3** (synthetic site with a server-side session check):

1. The synthetic site authenticates requests with **either** an HttpOnly session cookie **or** a bearer token kept in local storage, and also writes session storage, IndexedDB, Cache Storage and an HTTP-cached authenticated response, and downloads a file. After Disconnect, a fresh context visiting the site is unauthenticated **on the server's own check**; the profile directory and process tree are absent. Replacing destruction with `context.clearCookies()` must make this test fail, because the local-storage token still authenticates.
2. With `logoutUrl` defined, the harness replays the old cookie directly to the synthetic server after Disconnect and is refused (server-side invalidation). Without it, the receipt says `not-defined`.
3. An agent call racing Disconnect is refused or recorded UNKNOWN; none executes after destruction starts.
4. A session-owner kill followed by restart: the old profile is destroyed before any launch.
5. The same for conversation close, revocation (S4) and TTL expiry.
6. Live (UNRUN): repeat on the D005 host with a real browser.

#### S4. Live revocation and urgent disable during active runs

Purpose: urgent disable, withdrawal and revocation take effect while a run is active, for all four features. Pinning a manifest or policy version per run controls *what a run is allowed to do*; it never delays *withdrawal*.

**Mechanism.** Control keeps a monotonic **withdrawal generation** for each scope: platform feature switch (bridge, takeover, editor, site workflows), site workflow manifest (site, workflow, version), tenant enablement, actor membership and role, conversation state, artifact suppression (already exists as the suppression generation), and device pairing/attachment. Narrowing, disabling, withdrawing or revoking any of these bumps its generation. Widening or changing a manifest does not affect a running run (it takes effect at the next run).

- **Pull:** every enforcement point checks the current generations for its scopes on every action: the session owner per agent call and per user input batch, the relay per frame, the WOPI host per WOPI call, host egress per new connection where the egress owner supports it.
- **Push:** control notifies subscribed enforcement points over the existing trusted channel when a generation changes, so idle sessions are torn down without waiting for the next action.
- **Fail closed:** if an enforcement point cannot confirm current generations within the staleness bound (proposed 30 s, Q-X7), it refuses new actions until it can.
- **Target:** the existing 30 s propagation target, measured end to end, not assumed.

**Enforcement on a bump:** S1 fence (deny new) → drain with UNKNOWN for unsettled calls → feature teardown:

| Feature | Teardown on revocation |
| --- | --- |
| 1. Bridge | Relay stops forwarding at once and closes both sockets; the `meri_device_browser` tools disappear from the worker; the relay tells the extension, which detaches `chrome.debugger` and shows "Disconnected by policy". If the relay cannot reach the extension, the extension detaches on its own when its socket or capability renewal fails. |
| 2. Takeover | Lease ends, input closes, stream closes, run stays paused. |
| 3. Editor | Next WOPI call fails; control stops the editor container. Draft handling follows section 4.2: drafts on a suppressed base, or for an actor who lost access, are destroyed; otherwise the draft is retained for recovery only if the actor still has current revise authority when they return. |
| 4. Site workflows | S3 destruction; the run's manifest origins are withdrawn from the effective egress allowlist (which is already bound to and revoked with the run). |

**Tests that would close S4:** for each feature, a revocation in the middle of an active run (tenant disable, manifest withdrawal, membership removal, platform switch off) stops the next action and tears the feature down within the target, with an in-flight action recorded UNKNOWN rather than completed. A stubbed generation source that stops answering makes enforcement points refuse after the staleness bound. Reverting to "check at run start only" must make the tests fail.

---

## 2. Feature 1: Device/browser bridge

### 2.1 What "device" could mean (owner chooses)

| Interpretation | Meaning | Assessment |
| --- | --- | --- |
| **A. Own-browser bridge (recommended, narrowed)** | Meri reads tabs the user explicitly selects in their own desktop Chrome/Edge, using the sign-ins the user already has. | This is the usual meaning of "browser bridge" in agent products. It covers public sites that cannot be qualified in Meri's isolated browser because they depend on the user's own sign-in (for example corporate SSO or device-bound MFA on a public origin). Upstream support exists (Playwright Extension). Revision 1 also claimed VPN-only intranets; that is removed (see Q-B8). |
| B. Device handoff to the remote browser | The user's device views and drives Meri's isolated browser. | This is feature 2 (takeover). It should not be built twice. |
| C. Local device access | A desktop helper exposes local files, folders, clipboard or desktop Office apps to Meri. | This needs a large native helper with a high-privilege attack surface. It is not implied by "browser bridge". Recommend excluding it from the first shipment. |
| D. Phone/mobile pairing | Meri on a phone acts as an approval device or companion. | Mobile is deferred relative to desktop (ledger row "Mobile"). Excluded. |

**Scope boundary (A, revision 2):** an opt-in, separate user-device trust tier.

- Desktop Chrome and Edge only (the upstream extension supports Chromium-family browsers only).
- Meri sees only tabs the user explicitly puts in the Meri tab group. New tabs the agent opens go into that group and only to **selected approved public sites** (the platform list, narrowed by tenant and by the user's per-attachment selection).
- **Read-only by default.** Interactions need separate tenant enablement **and** per-action approval through the existing gate.
- Visible connection state at all times (extension badge, in-page indicator, Chrome's debugging banner) and an immediate **local** disconnect in the extension that works even if Meri's servers are unreachable.
- No other tabs or browser profiles; no local files or device uploads; no cookie or storage export; **no background attachment** (the extension attaches only while the user has confirmed an attachment for a live conversation run, and detaches when the run ends, the Meri page closes or the socket drops); no arbitrary CDP; **no private-network or intranet destinations** in the initial design (Q-B8).
- A takeover equivalent is not needed: the user already controls the tab.

**Why intranet is out.** Revision 1 advertised VPN-only intranets while also reusing the public-only URL validation (`checkBrowserUrl` / `public-web.mjs`), which refuses private-network destinations. Those two statements conflict. Even "public-only" is weaker here than on the D005 host: the user's browser resolves names on the user's own network, so a public hostname can resolve to a private address, and Meri sees neither the resolution nor redirects and subresources. On the bridge, destination policy is hostname-level software filtering of agent-initiated navigation, not network enforcement. Private-network access would need a separately reviewed boundary and an explicit owner decision (Q-B8).

### 2.2 Architecture and placement

```
User's Chrome/Edge ── Meri extension (MV3, chrome.debugger on the Meri tab group only)
      │  outbound WSS, session-bound device capability (short-lived, DPoP-style proof from a non-extractable WebCrypto key)
      ▼
Control domain: live-session relay ── CDP method allowlist + tab scoping + withdrawal generations + receipts
      ▲  WSS from worker with task-bound capability (cdpHeaders)
      │
Conversation worker: Playwright MCP 0.0.83 instance `meri_device_browser` (cdpEndpoint → relay)
      └─ same PreToolUse/canUseTool gate and approvals port as `meri_browser`; S2 filter on its responses
```

- The worker never connects to the user's machine, and the user's machine never connects to the worker. Both connect outbound to the relay. The relay pairs them only for an attachment that is current and authorized (tenant, actor, conversation, device) at the current withdrawal generations.
- This adds a second instance of the same pinned Playwright MCP with its own server name and policy. It does not add a second browser framework. The model sees `mcp__meri_device_browser__*` tools only while an attachment is active.
- **Pairing** (a new control owner, proposed `apps/control/device-pairing/`; installation and pairing persistence are separate owner decisions, Q-B4 and Q-B9): the user opens "Connect this browser" in Meri, and the extension shows a one-time code valid for 5 minutes or less. The extension generates a non-extractable key pair. Control binds the public key to (tenant, actor, device label) and issues access capabilities lasting 15 minutes or less, renewed only with a key proof. **Recommended v1: session-bound pairing** that ends at Meri sign-out, browser restart or 12 hours, whichever comes first, with no persistent device record beyond receipts. A persistent pairing would be a new persisted device credential and needs its own approval (Q-B9). Attaching to a conversation is a separate per-conversation grant that the user confirms in the extension UI. It ends when the conversation run ends.

### 2.3 Upstream options

| Option | What | License / constraints | Verdict |
| --- | --- | --- | --- |
| U1. Upstream Playwright Extension + local `@playwright/mcp --extension` | Microsoft's extension attaches to the user's tabs. The MCP server must run **on the same machine**: the pinned code reads the local user data directory to find the extension profile (`playwright-core/lib/tools/utils/extension.js`). Connections are approved per connection or with a profile token. Each client gets its own tab group. | Apache-2.0. Chrome Web Store item `mmlmfjhmonkocbjadbfplnigmagldckm`. Store auto-updates, so the version cannot be pinned unless it is force-installed from a self-hosted update URL. | Works only with a local MCP, which means a desktop helper on the user's machine that tunnels MCP to Meri. That is too heavy and puts an unpinned binary on user devices. **Not recommended as-is.** |
| **U2. Meri extension built from the upstream extension source + relay + `cdpEndpoint` (recommended)** | Adopt the Apache-2.0 extension source. Replace the local-relay connect page with Meri pairing and an outbound WSS to the relay. The worker's Playwright attaches over CDP (`cdpEndpoint`/`cdpHeaders`, both present in 0.0.83 `config.d.ts`). | Apache-2.0 (keep NOTICE and attribution). The upstream limitation (local-only MCP) justifies the custom change under standards §14. The `debugger` permission triggers Chrome's "started debugging this browser" banner. Enterprise force-install via group policy can suppress it; recommend **keeping** it as a visible indicator ([Chrome permission docs](https://developer.chrome.com/docs/extensions/mv3/declare_permissions); [UiPath MV3 debugger banner note](https://docs.uipath.com/studio-web/automation-cloud/latest/user-guide/debugging-banner-notification-after-extension-upgrade-to-manifest-v3)). | Smallest custom surface. Keeps one Playwright integration. Version is pinned through self-distribution. |
| U3. Desktop helper using the browser's `--remote-debugging-port` | A native app attaches to the user's whole browser over CDP. | It exposes every profile and tab. A localhost debug port is a known attack surface. | Rejected. |
| U4. Hosted remote-browser vendors | Third-party cloud browsers. | Not the user's device. Third-party data processing. | Not this feature. |

Sources: [Playwright MCP README (`--extension`, `--cdp-endpoint`, `--cdp-header`)](https://github.com/microsoft/playwright-mcp/blob/main/README.md); [Playwright Extension README](https://github.com/microsoft/playwright/tree/main/packages/extension#readme); [Chrome Web Store listing](https://chromewebstore.google.com/detail/mmlmfjhmonkocbjadbfplnigmagldckm).

### 2.4 Authority, approval, isolation, custody, revocation, audit

- **Authority:** the server binds tenant, actor, conversation and device. The extension's claims are requests, not authority. Every relay frame is checked against a current attachment and the current withdrawal generations (S4). Platform maximum: bridge on or off, plus origins. Tenant admins can turn it off or narrow origins. Role ceilings apply.
- **Destinations and the trust tier:** agent-initiated navigation and new tabs are limited to the effective public allowlist (the existing `checkBrowserUrl`), enforced in the worker gate **and** in the relay (which inspects `Page.navigate` / `Target.createTarget` URLs). Redirects, subresources, DNS resolution and all other traffic in the user's browser use the user's own network. **Meri cannot enforce `EGRESS_REQUIREMENTS` there, and software navigation filtering is not equivalent protection.** The owner must accept or reject this tier explicitly (Q-B1).
- **Read-only mode (default) and how it is proved:** read-only means no input events, no script evaluation that can change page state, no navigation of the user's existing tabs, and no downloads. The relay enforces it with a **method allowlist**: in read-only mode `Input.*`, `Runtime.evaluate`, `Runtime.callFunctionOn`, `DOM.set*`, `DOM.remove*`, `Page.navigate` on non-Meri-opened targets, `Page.reload`, `Fetch.*`, `Emulation.*` and download behaviour methods are denied. Playwright's own read tools (aria snapshot) use injected script through `Runtime.*`; an allowance for "evaluation by the Playwright session" is therefore not proof of read-only behaviour, because any script can mutate the page. The read-only claim is **withheld** until the mutation-canary test (2.6 item 4) passes. If Playwright's read tools cannot work under the read-only allowlist, the qualification spike decides between (a) a CDP-native read path (`Accessibility.getFullAXTree`, `DOMSnapshot.captureSnapshot`, `Page.captureScreenshot`) for read-only mode, with Playwright MCP used only when interactions are enabled, or (b) not offering a read-only mode and requiring interaction enablement for any bridge use. Option (a) adds a small Meri read adapter beside the one Playwright integration and needs dot's agreement (Q-B2).
- **Approval:** with interactions enabled for the tenant, every interaction tool goes through the existing `canUseTool` → approvals port → canonical approval owner with the exact `inputDigest`.
- **CDP restriction (relay, interaction mode):** an allowlist of the CDP domains and methods Playwright needs for the bounded tools. Denied, among others: `Storage.getCookies`, `Network.getCookies`/`getAllCookies`, `Network.setCookie(s)`, `Browser.*` (except version), `Target.createBrowserContext`, `Target.attachToTarget` for tabs outside the group, `Page.setDownloadBehavior`, `Fetch.*` interception, and `Input.*` outside an approved interaction's execution window. The exact method list is derived and qualified against Playwright 1.64 traffic. Upstream `chrome.debugger` already blocks some domains.
- **Fence for the bridge:** the relay is the execution choke point; on detach or revocation it applies S1 (deny new frames from the worker, let an in-flight approved interaction's CDP exchange settle within the action timeout or record it `BROWSER_ACTION_OUTCOME_UNKNOWN`, then close).
- **Confidentiality:** model-visible snapshots of a selected tab can contain sensitive signed-in data even in read-only mode. S2 rules 2, 4 and 5 apply to every `meri_device_browser` response; sharing a tab shows the user "Meri can read this tab's content"; receipts record hosts only. The residual risk (content the user deliberately shares reaching the model) is disclosed, not mitigated away.
- **Credential custody:** Meri stores no third-party credentials and no cookies, and the relay denies cookie and storage reads. The device holds a non-extractable private key. Control holds only the public key and pairing metadata, for the session-bound pairing lifetime. The worker gets a task-bound relay capability, never the device capability.
- **Revocation (S4):** the user can disconnect locally in the extension (immediate, no server round trip), unpair in Meri, or close the tab group. Admin or tenant policy can turn the bridge off. A membership change ends active attachments. Target: the 30 s propagation target, measured. The relay closes both sockets; the extension detaches on its own if its socket or capability renewal fails.
- **Isolation:** one attachment per conversation. Tabs belong to one client at a time (the upstream design). There is no cross-tenant relay routing. The relay keys connections by (tenant, attachment ID) and refuses mismatches.
- **Audit:** `meri-browser-receipt/1` extended with `surface:'device'`, device ID, attachment ID, origin host and outcome (including UNKNOWN). Pairing and unpairing receipts. No page content or screenshots retained beyond the conversation's existing receipt policy.

### 2.5 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| The agent acts with the user's real sign-ins (email, banking, corporate) | Selected-tab scoping. Public-origin allowlist. Read-only default, proven by the mutation canary. Separate interaction enablement plus per-interaction approval with the digest shown. Persistent indicator and the Chrome debug banner. Local kill switch. |
| Sensitive signed-in content reaches the model through snapshots | S2 filter (credential fields redacted, sensitive pages withheld, URL reduction). Explicit per-tab sharing. Disclosed residual risk. |
| Prompt injection from pages the user is signed in to | Treat page content as untrusted. No tool can read cookies or storage. Approval shows the exact action. No uploads from the device. |
| Infrastructure egress controls do not apply | Explicit trust-tier acceptance (Q-B1). Allowlist checked twice (worker + relay), described honestly as software filtering. Private networks excluded (Q-B8). Bridge activation gated separately from the D005 gate. |
| Extension supply chain / auto-update | Self-hosted update URL or enterprise force-install with pinned versions (Q-B4). Signed CRX. Version in `docs/COMPONENTS.md`. |
| Relay hijack or replay | Single-use tickets. Proof-of-possession on every reconnect. Short expiry. Tenant-keyed routing. |
| Data in transit through the control plane | TLS. No frame or CDP payload persistence. Redacted telemetry, as in the download-link logging rules. |
| Persistent device credential | Session-bound pairing by default (Q-B9). |

### 2.6 Qualification / acceptance tests

1. Pairing: code expiry; replay refused; key-proof failure refused; session-bound pairing ends at sign-out, browser restart and 12 h; unpair takes effect within the target and is measured.
2. Scoping: tabs outside the group are invisible; attach to an unshared tab is refused; a second conversation cannot attach to the same tab; no attachment exists without a confirmed live run (no background attachment).
3. CDP filter: each denied method is refused at the relay (cookie reads, new browser context, interception); allowed tool traffic passes for every bounded tool in interaction mode.
4. **Read-only proof (mutation canary):** a synthetic page records every DOM mutation, input event, focus change, form submission, navigation and network request not initiated by the page itself. Every read-only tool runs against it through the relay with the read-only allowlist. The canary must record none. Allowing `Runtime.*` "for Playwright only" must make the test fail if any read path can mutate the page.
5. Policy: navigation to an unlisted origin and to a private-address literal is refused at the worker and at the relay; an origin the tenant narrowed away is refused; interaction tools are absent in read-only mode. The test report states that DNS-level private resolution in the user's browser is outside this test's reach.
6. Approval: an interaction runs only after an approval matching the digest; expiry, abort and mismatch deny (reuses the `permissions` tests, now against a live SDK).
7. Revocation (S4): membership removal, tenant toggle-off, platform switch-off and conversation close each end the attachment within the target; local disconnect works with the relay unreachable; an in-flight interaction at revocation is recorded UNKNOWN.
8. Confidentiality (S2): canary credentials in a selected tab never reach the model, receipts or relay logs.
9. Audit: receipts for every call, pairing and unpairing, with no secrets or tokens in logs (redaction test like `download-links-redaction.test.mjs`).
10. Real-browser runs on Chrome and Edge stable, with the extension at the pinned version (UNRUN until installation is separately approved).

### 2.7 Dependencies on HOLD items

Approvals port owner composition (ledger: approval owners unmounted, L1/L2). `STARTUP-COMPOSITION`. Conversation multi-run UX (frontend one-run observer). Revocation deadline and membership source (Core), now also the withdrawal-generation source (S4). Browser fragment HOLD findings from P1c (the gate code is shared). Not blocked by D005 host qualification, but needs its own activation record and the owner's installation, pairing and trust-tier decisions.

### 2.8 Effort: 8–12 engineer-weeks (unvalidated)

Extension adaptation, pairing and distribution: 3–4. Relay with CDP filter and routing: 2–3. Worker composition and policy: 1–2. Frontend pairing/settings/indicators: 1–1.5. Qualification: 1.5–2. Assumes the shared relay is built in feature 2 (counted once there). If the relay is already built: subtract 1. Excludes Chrome Web Store or enterprise rollout lead time. The revision-2 read-only proof and possible CDP-native read adapter are in the separate revision-2 delta (6.7).

### 2.9 UI needs (capiro-frontend) and missing Figma frames

Needed: "Connect this browser" pairing flow (code display/entry, success, expiry); paired devices list with unpair (Settings · Connections, near `09.02 · Connector accounts and permissions` `1064:143496`); per-conversation "Use my browser" attach and detach; per-tab "Meri can read this tab" sharing confirmation; trust-tier explanation at first use ("traffic from your browser does not pass through Meri's network controls"); connected indicator; approval card for device actions (variant of the existing confirmation); revoked/disconnected notices. **Missing frames:** all of the above. No current frame covers device pairing. `Install Meri` (`1064:150635`, in the Meri top bar) is not a bridge flow and should not be reused without a design decision.

### 2.10 Owner questions

- **Q-B1 [sharper]** Accept interpretation A as an opt-in **user-device trust tier**, understanding that redirects, subresources, DNS and all network traffic happen on the user's own network outside Meri's egress boundary, and that Meri's navigation filtering there is software filtering, not equivalent protection?
- **Q-B2 [sharper]** Read-only by default, with interactions only after separate tenant enablement and per-action approval (recommended)? If the qualification spike shows Playwright's read tools need script evaluation, choose: a small CDP-native read adapter for read-only mode, or no read-only mode at all.
- **Q-B3** Should the platform destination allowlist apply to bridge navigation (recommended)? Or should the bridge be allowed on any site the user opens?
- **Q-B4 [sharper]** Distribution and installation: unlisted Chrome Web Store item, enterprise force-install with a self-hosted update URL, or both? This document grants no installation; this decision does.
- **Q-B5** Keep Chrome's debugging banner visible (recommended)?
- **Q-B6** Confirm Edge support alongside Chrome. Confirm interpretations C (local device access) and D (phone) are out of the first shipment.
- **Q-B7** Approve the relay (as a bounded transport, not a generic device gateway) and the device-pairing owner placement in the control domain.
- **Q-B8 [new]** Private-network/intranet destinations on the bridge: keep them **out** of the initial design (recommended)? Supporting them conflicts with the public-only filtering and would need a separately reviewed boundary (per-tenant declared private origins, data classification, and acceptance that private resolution is unobservable from Meri) and a separate explicit decision.
- **Q-B9 [new]** Pairing persistence: session-bound pairing with no persistent device record (recommended), or a persistent pairing (a new persisted device credential with its own expiry, revocation and retention)?

---

## 3. Feature 2: Live browser takeover

### 3.1 Interpretations (owner chooses)

| Interpretation | Meaning | Assessment |
| --- | --- | --- |
| A. Live view only | The user watches the agent's isolated browser live. | Useful, but it does not solve sign-in, MFA, CAPTCHA or stuck flows. |
| **B. View + exclusive takeover lease (recommended)** | Live view whenever the browser is active. "Take control" fences and drains the agent (S1) and then gives the user exclusive input. "Hand back" ends input; the agent continues only after the user explicitly resumes, with a fresh filtered snapshot. | Covers sign-in for feature 4 without the model, transcripts or logs ever receiving credentials (S2). Simple authority model: one driver at a time. |
| C. Simultaneous co-control | User and agent both act at the same time. | Ambiguous attribution and race conditions. Not recommended. |

**Scope boundary (B):** applies only to the conversation's own isolated browser on the D005 host. Conversation owner only. One driver. Desktop web. Keyboard, mouse and wheel input. Tab switching among the context's pages. In v1 there is no recording, no clipboard sync (typing only), no file upload from the user's device (uploads stay separately qualified), no audio, and no devtools. Downloads go only through the existing download gate. User-driven navigation is subject to the same destination policy, because host egress enforces it anyway.

### 3.2 Architecture and placement

- The **browser session owner** (section 1) holds the Playwright `BrowserContext`. It serves Playwright MCP to the SDK and, on request, runs `page.screencast.start({onFrame, size, quality, fps})` on the active page. JPEG frames go over a Unix-domain socket to the conversation worker's trusted channel and on to the **live-session relay** in control, then to the user's viewer. Frames never enter the model path, receipts or logs (S2).
- Input comes back the same way. Each event is checked by the session owner (lease holder, lease epoch, coordinates inside the viewport, rate limit, allowed key set) and then injected through `page.mouse` / `page.keyboard`. Input events are never logged.
- The browser's network namespace gains **no new destination**. The relay path goes from the session owner and worker, outside the browser's sandboxed network, over the existing worker → control channel. This keeps `EGRESS_REQUIREMENTS` unchanged and adds a host design requirement: the browser processes cannot reach the session owner's socket or the worker channel.
- **The lease** is a conversation lifecycle control (`takeover.begin` / `takeover.end`) of the pause family, not a new orchestrator. It follows S1 exactly: fence in the session owner, bounded drain with UNKNOWN for unsettled calls, grant only when drained and the hold is `APPLIED`, fail closed (`TAKEOVER_DRAIN_UNKNOWN`, offer browser reset) if drain cannot complete, return only through explicit lifecycle resume with a new attempt fence. Revision 1's "pause subsequent tool calls" description is replaced.
- **Lease end without hand-back:** idle lease timeout (proposed 10 minutes, Q-T5), viewer disconnect, lost stream, relay failure or revocation end the lease and leave the run **paused**. There is no auto-resume option.
- **Viewer ticket:** the user's Clerk session plus a single-use live ticket. It lasts 60 s or less to open and is bound to (tenant, actor, conversation, run, session owner instance). The socket is renewed per lease. No CDP endpoint is ever exposed to the user.

### 3.3 Upstream options

| Option | Mechanism | License / constraints | Verdict |
| --- | --- | --- | --- |
| **Playwright `page.screencast` + `page.mouse`/`keyboard` (recommended)** | First-party API in the pinned `playwright-core` (JPEG frames to a callback; input through the public API). Wraps CDP screencast under the hood. | Apache-2.0. Works headless. Keeps the qualified `--headless --sandbox` configuration. | Same component as today. No new browser stack. |
| Raw CDP `Page.startScreencast` + `Input.dispatchMouseEvent/KeyEvent` | Same mechanism, one level lower ([CDP Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/); [Input domain reference](https://cdpstatus.reactnative.dev/devtools-protocol/1-3/Input)). | Chromium protocol. No extra license. | Use only if the Playwright API proves insufficient. Bypassing Playwright adds a second control path. |
| noVNC + Xvfb + VNC server (x11vnc/TigerVNC) | Headed Chromium on a virtual X display, streamed as VNC. | noVNC core MPL-2.0 ([LICENSE](https://github.com/novnc/noVNC/blob/master/LICENSE.txt)). x11vnc/TigerVNC are GPL-2.0 (separate processes). | Requires **headed** Chromium and an X server, which changes the qualified D005 browser configuration. Exposes the whole display, including native dialogs. More attack surface. Not recommended. |
| WebRTC virtual browser (neko) | Complete virtual-browser product (its own Chromium, X server and GStreamer). | Apache-2.0 ([LICENSE](https://github.com/m1k1o/neko/blob/master/LICENSE)). | A second browser stack, which conflicts with "one qualified Playwright integration". Rejected. |
| KasmVNC / Apache Guacamole | VNC/RDP gateways. | KasmVNC GPL-2.0; Guacamole Apache-2.0, but it still needs a VNC/RDP server. | Same objections as VNC. |

Expected quality: JPEG at 5–15 fps over WSS is enough for sign-in and form review. The qualification measures latency and bandwidth.

### 3.4 Authority, approval, isolation, custody, revocation, audit

- **Who may view or take over:** by default only the conversation's owning actor. Tenant admins do not get live view of other users' sessions unless the owner decides otherwise (Q-T3). The server rechecks authority on ticket issue, on every lease start, on a heartbeat (30 s or less) and on every withdrawal-generation change (S4).
- **Approval semantics:** actions the user performs during a lease are the user's own and are attributed to the user. They are not agent actions, so no agent approval is requested. Agent actions after resume keep per-call approval. If a page is mid-submit when the lease ends, nothing auto-continues. An agent action left UNKNOWN by the drain is never repeated without a fresh approval (S1).
- **Credentials and sensitive content (S2):** model-bound snapshots and screenshots are suspended for the whole lease; the post-lease snapshot redacts all form-control values; credential fields (password, OTP, card, manifest-listed) are redacted at all times; sign-in and IdP pages are withheld; input events are never logged; frames are never persisted or logged. The claim is that the model, transcripts, receipts and logs do not receive credentials; the browser host does hold the resulting session state until S3 destroys it.
- **Recording:** frames are not persisted (recommended). Receipts record lease start and end, actor, drain outcome (including UNKNOWN calls), page origin hosts visited and counts of input events, without content (Q-T4).
- **Isolation:** the D005 per-conversation host. The relay routes by (tenant, conversation, session-owner instance). There is no cross-conversation viewer.
- **Revocation (S4):** membership removal, conversation cancel or close, platform takeover switch-off or tenant disable ends the lease and the stream within the 30 s target, leaving the run paused. Conversation end runs S3 destruction.

### 3.5 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Stream leaks sensitive pages | Owner-only viewing. Single-use tickets. TLS. No persistence. Redacted telemetry. |
| User navigates somewhere unsafe | Host egress allowlist applies to user input too. Platform limits unchanged. |
| Credentials typed by the user reach the model | S2: no model-bound output during the lease; post-lease snapshot redacts all inputs; credential fields always redacted; sensitive pages withheld; canary tests. |
| Agent and user race | S1: fence at the execution point, bounded drain, grant only when drained and paused, UNKNOWN for unsettled calls, fail closed. |
| Input injection abuse (fast scripted input) | Server-side rate limits. Only the lease holder and epoch. Coordinates bounded to the viewport. |
| Takeover used to bypass approvals | User actions are attributed to the user and receipted. The agent never acts during a lease. Tenant can disable takeover. |
| Run silently continues after a lost stream | No auto-resume; explicit resume only. |

### 3.6 Qualification / acceptance tests

1. Lease exclusivity and fence (S1 tests 1–7): late agent call refused at the session owner even when the hook allows it; slow in-flight call delays the grant; timeout after dispatch is UNKNOWN and never repeated; hung call past the hard bound denies the lease and keeps the run paused; stale-epoch input dropped; late old-attempt result rejected after resume; lost stream and idle timeout leave the run paused.
2. Authority: a non-owner ticket is refused; an expired or reused ticket is refused; membership revocation ends the stream within the target.
3. Egress: typed navigation to an unlisted origin, a private address, a redirect to an unlisted origin, and a rebinding name are all refused at host egress, using the D005 negative probes driven through the takeover input path.
4. Secrets (S2 tests 1–5): canary password, OTP, security answer, card number and plain-text secrets typed during a lease appear in no snapshot, receipt, log, transcript or telemetry.
5. Performance: frame latency p95 and bandwidth measured on the D005 host; reconnect without duplicating input.
6. Cleanup: the session owner, relay sockets and screencast stop on cancel, crash and close; physical process absence verified.
7. Real non-root browser and renderer sandbox evidence with the session owner composition (re-run the D005 evidence, because the launch path changes).

### 3.7 Dependencies on HOLD items

Browser activation hold (all `EGRESS_REQUIREMENTS` evidence). D005 host qualification (not yet run). Approvals port owner composition. Lifecycle pause/approval-hold publication race (L1, accepted at package three) and continuation/approval owners in prepared startup (L2). L4 recovery HOLD (restart cannot yet reconstruct a stop-only retirement owner), because takeover resume depends on exact retirement of the paused attempt. Physical task cleanup (L5). `STARTUP-COMPOSITION`. Frontend multi-run controls.

### 3.8 Effort: 6–9 engineer-weeks (unvalidated)

Session owner refactor of the fragment composition: 1.5–2. Live-session relay (shared with the bridge): 1.5–2. Lease lifecycle control and gate integration: 1–1.5. Frontend viewer, controls and states: 1–2. Qualification on the D005 host: 1–1.5. Assumes the D005 host is qualified and activation is open (not counted). The S1 fence/drain and S2 filter are in the revision-2 delta (6.7).

### 3.9 UI needs and missing Figma frames

Needed: live viewer panel inside the browser workspace (desktop); "Take control" / "Hand back" / "Resume" controls; "Waiting for Meri's current action to finish" (drain) state; "Meri's last action may or may not have completed" UNKNOWN notice; drain-failed state with "Reset browser" (explains that sign-ins are lost); lease banner with timer; agent-paused state after hand-back; reconnecting and lost-stream states (run stays paused); sign-in-needed prompt from the agent; takeover-unavailable notices (policy off, mobile). **Existing frame to revise:** `Browser workflow · Live browser viewer` (`1064:152347`), which today says "No live viewer or user takeover", and its row in `12.17` (`1064:152281`). **Missing:** viewer, lease controls and all states above. `Remote browser snapshot` (`1064:147996`) and `07.01 · Public browser activity` (`1064:143463`) are the nearest anchors. `State · Reconnecting` (`1064:149790`) may be reusable.

### 3.10 Owner questions

- **Q-T1** Approve interpretation B (live view plus exclusive lease), not co-control.
- **Q-T2** Approve the browser session owner composition, which replaces the spawned MCP CLI with `createConnection` in a Meri process (still Playwright 0.0.83) and makes it the single enforcement point for S1–S3. Also approve Playwright screencast instead of VNC/WebRTC.
- **Q-T3** Who may view or take over: only the conversation owner (recommended), or also tenant admins?
- **Q-T4** No frame recording, receipts only (recommended)? Or record takeover video for audit, with a retention class?
- **Q-T5 [sharper]** Lease idle timeout (proposed 10 minutes). Revision 2 removes the auto-resume option: hand-back always needs an explicit "Resume" and a fresh filtered snapshot, and lost stream or timeout leaves the run paused. Confirm.
- **Q-T6** Confirm v1 exclusions: recording, clipboard, device uploads, audio, mobile.
- **Q-T7 [new]** Drain bounds and failure behaviour: settle bound = largest in-flight action/navigation timeout + 5 s, hard bound 130 s; on drain failure, deny the lease and offer "Reset browser" (destroys the profile and any sign-in) rather than granting control. Confirm, or set different bounds.

---

## 4. Feature 3: Full in-browser Office editor

### 4.1 Interpretations (owner chooses)

| Interpretation | Meaning | Assessment |
| --- | --- | --- |
| **A. Full WYSIWYG Office editing (recommended)** | Users open a Meri DOCX/XLSX/PPTX version in a browser editor with Office-class fidelity (styles, tables, formulas, slides), edit it, and publish it as a new immutable version. | Matches "full in-browser Office editor". Requires a server-side editor engine. |
| B. Lightweight editors | A rich-text editor for documents and a grid for spreadsheets, exporting OOXML. | Lossy round-trip. Three different components. Not "full". |
| C. Desktop round-trip | Download, edit in desktop Office, upload as a new version. | Not in-browser. Useful as a fallback only. |
| D. Microsoft 365 for the web | Microsoft's editors through WOPI. | Requires the Cloud Storage Partner Program (aimed at cloud-storage vendors; co-authoring required), documents processed by Microsoft, and users with M365 licences ([CSPP overview](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/overview)). Eligibility and timing are unlikely for the first shipment. |

**Scope boundary (A):** DOCX, XLSX and PPTX versions that Meri created or ingested, in the user's authorized scope. **Published versions are created only through the artifact owner. Originals and published versions are never mutated.** Unpublished work lives in a private draft store (4.2) and is never visible to the model, filing or download. One editor per edit session in v1 (no real-time co-editing). PDF remains preview-only (Q-O4). Macros are disabled. External links and data connections are disabled. Native generation, natural-language revision, preview and download stay as they are, and editor output joins the same version chain. Desktop only (editor mobile UIs are an edition feature and mobile is deferred). The editor is a required first-shipment feature in Fable's record; this document does not make it optional (Q-X0).

### 4.2 Architecture and placement

```
Frontend (capiro-frontend): editor iframe (CSP frame-src = editor origin only) ── postMessage (save/publish/close states)
      │ WOPISrc + access_token (short-lived, per edit session, POST-form delivery)
      ▼
Editor host: one disposable editor container (Collabora coolwsd, evaluation candidate) per edit session
      │ WOPI calls (CheckFileInfo, GetFile, PutFile, Lock/RefreshLock/Unlock/GetLock/UnlockAndRelock) — only to the WOPI host
      ▼
Control: WOPI host module of the artifact owner (proposed apps/runtime/artifacts/wopi/ + apps/artifacts/edit-sessions/)
      ├─ draft store (private, per edit session; proposed apps/artifacts/edit-sessions/drafts)
      └─ publish pipeline → existing create/revise owner (CAS head, structural + native checks, immutable version)
```

**Edit session** (new record, owner = artifact service): (tenant, actor, conversation, baseVersionId, editor instance, expiry, `draftSeq`, `lastPublishedVersionId`, lock). Opening one needs current `artifact.inspect` **and** `artifact.revise` authorization for that exact version. Otherwise the editor opens read-only (`UserCanWrite:false`) or is refused.

**WOPI file identity.** Each edit session gets its own WOPI `FileId`. The editor therefore sees one stable file across successive saves, and its only writer is that session. `CheckFileInfo` reports `Version` = the current draft sequence. `GetFile` serves the latest draft if one exists, otherwise the base version bytes. Base bytes are read through the same ordered authorization as the signed download links (inspect → suppression generation → download → hash → current authority → final generation).

**Locks.** WOPI lock tokens live in the edit-session store with WOPI's 30-minute expiry, refreshed by `RefreshLock`. They are not the artifact head lock. `Lock` with a different token while locked returns 409 with the current `X-WOPI-Lock`. `PutFile` requires the matching `X-WOPI-Lock`. A second editor instance for the same session is refused (single editor).

**Three kinds of save** (Collabora's PutFile extension headers `X-COOL-WOPI-IsAutosave`, `X-COOL-WOPI-IsExitSave` and `X-COOL-WOPI-IsModifiedByUser` distinguish them; these headers are from Collabora's integration documentation and must be confirmed against the evaluated version):

| Save kind | What the WOPI host does | Creates a version? |
| --- | --- | --- |
| **Autosave** (periodic or idle) | Writes the bytes atomically to the draft store as `draftSeq+1` with SHA-256 and size, commits the sequence row, then returns 200 with `X-WOPI-ItemVersion`. Size cap and type sniff only; no structural or native gate on acceptance. | No |
| **Exit save** (last view closes with changes) | Same as autosave, and marks the session `closed-with-draft`. | No |
| **Explicit save** (user presses Save) | Same as autosave, then marks that draft revision as a **publish candidate** and starts the publish pipeline asynchronously. The 200 response does not wait for publishing. | Only if the pipeline passes |

Accepting bytes into the draft store is the durability point. A save that is accepted keeps the editor session usable for further saves, however many. Because the WOPI response never depends on structural or native checks, a failing check cannot make the editor report a failed save or prompt the user to discard work.

**Publish pipeline (explicit save → new immutable version).** A publish intent row is recorded first (`PENDING` → `DISPATCHING` → `APPLIED` or `UNKNOWN`), keyed by (editSessionId, draftSeq). The pipeline runs structural inspection (`file-structure.mjs`: strict ZIP/OPC, no macros) and the native qualification pipeline on the candidate bytes, then calls the existing create/revise owner with `operation:'edit'`, provenance `user-edit` (actor, edit session, base version, draft sequence), and CAS on the expected head (`lastPublishedVersionId`, or the base version for the first publish). Outcomes:

- **Checks pass, CAS holds:** new version vN; `lastPublishedVersionId` = vN; the Meri frame shows "Saved as vN" (via the host page, not via the WOPI response).
- **Checks fail:** no version. The draft stays, marked `publish-refused` with the reason. The frame shows "Saved as draft. Could not publish: {reason}". The user keeps editing; the next explicit save tries again.
- **CAS conflict** (Meri or another session revised the artifact meanwhile): no version, no overwrite. The draft stays. The frame offers: publish the draft as a **branch** whose parent is the edit session's base (needs artifact lineage support for a non-head parent, Q-O10); reopen on the new head with the draft shown side by side; or discard the draft. No last-writer-wins.
- **`ARTIFACT_EFFECT_UNKNOWN`** from the revise owner: the intent stays `UNKNOWN` and the draft is marked `publish-unknown`. Nothing republishes automatically. A reconciler looks up the artifact store for a version carrying that intent key; only a definite "absent" re-enables publishing, and a definite "present" records the version. The UNKNOWN barrier is not lifted by a timeout.
- A retried explicit save of the same bytes (same SHA-256 as the current draft) does not create a new draft sequence, and a retried publish of the same (session, draftSeq) returns the same version.

**WOPI-level conflicts.** A `PutFile` with a missing or mismatched lock returns 409 with the current `X-WOPI-Lock`, as WOPI requires. The body is not lost: if the caller's authority is current, its bytes are kept as an **orphan draft** bound to the actor and session, never published, and offered at the next open. With one writer per WOPI file, storage-side changes should not occur, so Collabora's "document changed in storage" path (`X-COOL-WOPI-Timestamp` with 409 / `COOLStatusCode` 1010) is not used for artifact-level conflicts; those are handled at publish. Collabora behaviour on a 409 must be checked in the evaluation.

**Crash and abandon recovery.**

- **Editor container crash:** edits since the last accepted PutFile are lost. That window is bounded by the autosave interval (proposed 60 s or less, plus idle save; an evaluation item). Drafts survive. The session is marked `editor-lost`; reopening starts a fresh container whose `GetFile` serves the latest draft ("Recovered your draft from {time}").
- **Tab closed or abandoned:** the exit save writes a draft. The lock expires; the container is destroyed with verified cleanup. The draft is retained for the draft retention period (proposed 7 days, Q-O9) and offered at the next "Edit" on that artifact, with publish, keep or discard. It is never published automatically.
- **WOPI host or control crash during PutFile:** the draft write is atomic (object written, then sequence row committed); the response is sent only after commit. If the response is lost, the editor retries and the SHA-256 dedupe applies.
- **Publish pipeline crash:** the intent row survives; restart reconciles by intent key as for UNKNOWN.

**Drafts are not artifacts.** They are encrypted with the same key class as artifacts, tenant-scoped, visible only to the editing actor through recovery, invisible to the model, filing and download, subject to the suppression generation (a suppressed base destroys its drafts), and destroyed when retention expires or the actor loses access. They need a new data/retention class and migration (Q-O9, dot allocation).

**Editor container:** started per edit session from a pinned, scanned image. Egress only to the WOPI host endpoint (no internet, no metadata). Read-only root. Non-root. Destroyed with verified cleanup on close or expiry. Coolwsd's jail/namespace requirements decide whether it can run on existing approved hosting or needs a new isolated host class (qualification item). No document data is persisted outside the artifact and draft stores. Any pre-started containers are fresh and unassigned; there is no shared warm state across tenants, conversations or sessions.

**Original skills only:** the editor is a separate product component. Meri's Office generation and revision skills stay original. No restrictive Office skill implementation is copied.

### 4.3 Upstream options

| Option | Fidelity / features | License and service constraints | Deployment shape | Verdict |
| --- | --- | --- | --- | --- |
| **Collabora Online (recommended evaluation candidate)** | LibreOffice core. Good DOCX/XLSX/PPTX support, but complex Word/Excel features can lose fidelity (the deployment plan already notes "LibreOffice recalculation is not universal Excel equivalence"). | Server source MPL-2.0 ([COPYING](https://raw.githubusercontent.com/CollaboraOnline/online/master/COPYING)); client historically BSD-2 ([LWN](https://lwn.net/Articles/692871/)). File-level copyleft means only modified MPL files must be shared. Collabora's [FAQ](https://www.collaboraonline.com/faqs/) distinguishes the supported subscription edition from **CODE**, a rolling development edition without SLA/LTS that the vendor does not recommend for production. **Correction to revision 1:** the 10-document/20-connection limit is not a default CODE limit; Collabora's September 2026 [clarification](https://forum.collaboraonline.com/t/does-collabora-code-26-04-2-4-have-any-user-or-concurrent-connection-limits/5023) says it applies in Home Mode. That does not establish CODE's suitability or support for production. The public [subscriptions page](https://www.collaboraonline.com/subscriptions/) advertises standard tiers but does not establish a price or terms for Meri's embedded, multi-tenant SaaS use. An open-source licence is not a verified commercial offer for this deployment. | `coolwsd` container. Standard **WOPI** integration. Uses its own jails/namespaces. | **Evaluate first.** Weak copyleft. A standard protocol (WOPI) keeps the editor replaceable. Consistent with LibreOffice already in the worker image. |
| ONLYOFFICE Docs | Native OOXML model. Usually the best MS Office layout fidelity among open-source editors. | Community: **AGPL-3.0 with §7 additional terms**: retain notices and attribution, show legal notices in the UI identifying ONLYOFFICE, no trademark rights ([LICENSE](https://github.com/ONLYOFFICE/DocumentServer/blob/master/LICENSE); [README editions table](https://github.com/ONLYOFFICE/DocumentServer/blob/master/Readme.md)). Community lacks mobile web editors and white-labelling. Older documentation states a 20 simultaneous editing connections limit ([Help Center FAQ](https://helpcenter.onlyoffice.com/docs/faq/docs-community.aspx)); 2026 press reports say 9.4 removed it (**unverified against official release notes**). The §7 terms are publicly disputed in the Euro-Office fork controversy ([The Register](https://www.theregister.com/2026/04/02/eurooffice_forks_onlyoffice/); [It's FOSS](https://itsfoss.com/news/onlyoffice-forked/)). Enterprise/Developer editions are proprietary. | Document Server container plus its own PostgreSQL/Redis/RabbitMQ. JS editor API with JWT and callback-URL save. WOPI also supported. | Fallback candidate if Collabora fails evaluation. A commercial edition would avoid AGPL/§7 obligations in a SaaS product, but needs its own quote and legal sign-off. |
| Microsoft 365 for the web | Best fidelity. | Partner programme eligibility; Microsoft processes the data; per-user M365 licences ([CSPP](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online)). | Microsoft-hosted. WOPI host on our side. | Not viable for the first shipment. |
| Univer | Canvas sheets/docs/slides SDK. | Core Apache-2.0 ([LICENSE](https://github.com/dream-num/univer/blob/main/LICENSE)). **OOXML import/export is a Pro (commercial) server feature**; without a licence it adds watermarks and caps imports at 1 MB and exports at 10k cells ([Univer import/export docs](https://docs.univer.ai/guides/sheets/features/import-export)). | Browser SDK plus exchange server. | Not "full Office" without a commercial licence. Lossy for DOCX/PPTX. |
| SuperDoc / Tiptap / CKEditor 5 | DOCX-centric rich-text editors. | SuperDoc AGPL-3.0 or commercial ([README](https://cdn.jsdelivr.net/npm/superdoc@1.45.0/README.md)). Tiptap core MIT but DOCX import/export is paid. CKEditor 5 GPL-2.0+ or commercial. | Browser libraries. | DOCX only. Would need separate sheet and slide editors. Not recommended. |

Recommendation: **evaluate Collabora Online through WOPI. Do not approve a production purchase yet.** This is an evaluation recommendation, not a subscription, a numeric budget or a verified commercial offer. Before any spending request:

1. Establish round-trip fidelity on the held-out corpus (4.6) and deployment fit (jail/namespace needs on approved hosting, cold start, per-session resource use), using a local evaluation build with no deployment.
2. Obtain a **written commercial quote** covering Meri's embedded, multi-tenant use; which users count as eligible; support and SLA; security update and LTS terms; branding; billing term; renewal and cancellation conditions; taxes; and any minimum commitment. Requesting a quote is itself a vendor contact that needs the owner's go-ahead.
3. Add hosting and concurrency costs, then bring a bounded spending request to the owner.

If Collabora fails evaluation, evaluate ONLYOFFICE behind the same WOPI host (ONLYOFFICE also speaks WOPI), so the artifact-side design (sessions, drafts, publish) is unchanged.

### 4.4 Authority, approval, isolation, custody, revocation, audit

- **Authority:** current authorization is checked at session open, on every WOPI call (`CheckFileInfo`/`GetFile`/`PutFile`/`Lock` family) and again at publish. Retention suppression revokes edit sessions through the suppression generation, exactly as it revokes download links.
- **Fence:** the WOPI host is the editor's execution choke point. On revocation it refuses every subsequent WOPI call (`WOPI_REVOKED`), lets an in-flight `PutFile` commit or fail atomically, marks an in-flight publish UNKNOWN if its effect is uncertain, and asks control to stop the container.
- **Revocation (S4):** a revoked actor, a suppressed version, a tenant or platform editor switch-off, or a membership change fails the next WOPI call within the target and stops the container. Drafts on a suppressed base, or held for an actor who lost access, are destroyed. After a tenant or platform switch-off, a draft is retained but offered only if the actor still has current revise authority on return.
- **Approval:** a user's own edit that creates a new version in their own conversation is not a consequential external action. It needs no approval, matching natural-language revision. Filing an edited version to a client destination still uses the existing `artifact.file` approval.
- **Isolation:** one editor container per edit session (Q-O3), never shared across tenants, conversations or sessions, egress only to the WOPI host, destroyed on close. This applies the per-conversation host rule to the editor.
- **Credential custody:** the WOPI `access_token` is HMAC-signed by control, lasts 10 minutes or less (renewed through the edit session), is bound to (session, actor, version), is delivered by POST form, and is never logged (same redaction rules as download links). The editor container holds no database, S3 or provider credentials.
- **Audit:** edit-session open/close receipts; each accepted `PutFile` with draft sequence, kind (auto/exit/explicit) and checksum; each publish with intent key, outcome (version ID, refused reason, conflict, UNKNOWN); lock conflicts; orphan drafts; recoveries; draft destruction.

### 4.5 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Editor engine is a large, complex attack surface (document parsers) | Disposable per-session container. Non-root. Read-only root. Egress only to the WOPI host. Image scan must have zero HIGH/CRITICAL. Macros and external links disabled. |
| Silent fidelity loss on publish | Fidelity corpus gate. Every publish is a new version, so the original is always recoverable. Structural plus native inspection before publish. Unsupported features disclosed, as the plan requires. |
| User loses work to a failed check, conflict or crash | Draft store is the durability point; checks and CAS act only at publish; orphan drafts on lock mismatch; recovery on reopen; no automatic discard. |
| Unchecked bytes reach the model or a client | Drafts are invisible to the model, filing and download until published; publishing requires the checks. |
| Duplicate or lost versions on retry | Publish intent keyed by (session, draftSeq); SHA-256 dedupe; UNKNOWN barrier with reconciliation. |
| Licensing and commercial terms | Evaluation first; written quote before spending; licence record in `docs/COMPONENTS.md`; legal review. |
| Concurrent Meri revision during an edit | CAS refusal at publish plus branch/reopen/discard options. No last-writer-wins. |
| Token leakage through the iframe | POST-form token delivery (WOPI standard). No tokens in URLs or logs. Short expiry. Strict CSP and `frame-ancestors`. |
| Cost/capacity of per-session containers | Measure cold start. Pre-started containers only if fresh and unassigned, the same rule as conversation workers. |

### 4.6 Qualification / acceptance tests

1. Fidelity corpus: at least 30 held-out DOCX/XLSX/PPTX files (Meri-generated plus representative client-style files). Open → no-op save → compare: 100% open, zero corruption, formulas and references preserved, no critical layout loss on rendered pages. Human review at the `ARTIFACT-NATIVE` bar.
2. WOPI conformance: Microsoft's WOPI validator suite or the vendor's test suite against the WOPI host, including lock semantics (409 with current lock on mismatch).
3. Repeated saves: ten successive autosaves and explicit saves in one session each return 200 with an increasing `X-WOPI-ItemVersion`; the session stays usable throughout; only explicit saves create versions.
4. Validation does not discard: an explicit save whose bytes fail structural inspection produces no version, keeps the draft (`publish-refused`), and the editor continues; reverting to "PutFile fails when checks fail" must make this test fail.
5. CAS conflict: a Meri revision between open and explicit save produces no version and no overwrite; the draft stays; branch, reopen and discard each behave as specified.
6. Lock mismatch: 409 with the current lock; the body is kept as an orphan draft and offered at the next open; it is never published.
7. Idempotency and UNKNOWN: a retried PutFile with identical bytes adds no draft sequence; a retried publish returns the same version; an injected `ARTIFACT_EFFECT_UNKNOWN` blocks republishing until reconciliation reports a definite outcome.
8. Recovery: killing the editor container after an autosave and reopening serves the latest draft; closing the tab triggers an exit save that is offered at the next open; killing the WOPI host mid-PutFile leaves either no draft row or a complete one.
9. Authority and revocation: read-only fallback without revise permission; revocation, suppression and session expiry block the next WOPI call; drafts on a suppressed base are destroyed; cross-tenant WOPISrc refused.
10. Immutability: a publish produces a new version with `user-edit` provenance; the original bytes are unchanged.
11. Isolation: the editor container cannot reach the internet, metadata, other sessions or the database; it is destroyed with verified cleanup; it runs non-root with a read-only root.
12. Security: macro-bearing and external-link files open with macros and links disabled; a malformed-file corpus does not escape the container.
13. Frontend: iframe CSP; saving / saved-as-vN / saved-as-draft / publish-refused / conflict / recovered / close states; focus and keyboard access.

### 4.7 Dependencies on HOLD items

`ARTIFACT-ADMISSION` (PPTX overlap DA-3; PDF revision DA-2 if PDF is ever editable). `ARTIFACT-NATIVE` (renderer sandbox, real storage/KMS). Artifact options owner composed in startup. Download-link final-read race (P1b) and the uncertain-liability release HOLD. Retention suppression owner (DA-1/DA-4) for revocation and draft destruction. Image scan HIGH/CRITICAL admission. Draft data class, retention class and migration allocation (dot). A placement approval for the editor containers. Not blocked by the browser activation hold.

### 4.8 Effort: 9–14 engineer-weeks, plus evaluation, quote and legal (unvalidated)

WOPI host, edit sessions, versioning and locks: 3–4. Editor host packaging, hardening, per-session lifecycle and egress: 3–4. Frontend embed and states: 1.5–2. Fidelity corpus, WOPI conformance and security qualification: 1.5–3. Excludes vendor evaluation time, quote and procurement, legal review and the shipping owner's cloud work. The draft store, publish intent/reconciliation and recovery are in the revision-2 delta (6.7).

### 4.9 UI needs and missing Figma frames

Needed: "Edit" entry on an exact artifact version; editor workspace (document, spreadsheet, presentation); saving / saved-as-v{n} / saved-as-draft / could-not-publish states; conflict ("Meri saved v{n} while you were editing") with branch / reopen / discard; "Recover your draft from {time}" on reopen; read-only fallback; lock-held and session-expired/revoked notices; exit with an unpublished draft (publish / keep draft / discard). **Existing frames:** `03.02 · Word document workspace` (`1064:143350`), `Document overlay · Editing mode` (`1064:150609`), `Notice · Office previews are read-only` (`1064:151439`, to revise), `03.04 · Spreadsheet preview` (`1064:143357`), `03.05 · Presentation preview` (`1064:143360`). **Missing:** spreadsheet and presentation editing modes, every save/draft/publish/conflict/recovery/lock/expiry state, and the exit confirm. The editor's own toolbar is the vendor UI. Figma only needs to define the frame around it.

### 4.10 Owner questions

- **Q-O1** Approve interpretation A (full WYSIWYG; explicit saves publish new immutable versions after checks; drafts private; originals immutable).
- **Q-O2 [sharper]** Approve Collabora-through-WOPI as the **evaluation** candidate only: local fidelity and deployment-fit evaluation, then (with your go-ahead for vendor contact) a written quote covering embedded multi-tenant use, eligible users, support/SLA, security updates/LTS, branding, billing term, renewal/cancellation, taxes and any minimum commitment. No purchase and no numeric budget now; a bounded spending request follows only after the quote and hosting costs. ONLYOFFICE is the fallback evaluation candidate under the same conditions.
- **Q-O3 [sharper]** Placement: disposable single-session editor containers, on existing approved hosting if coolwsd fits its sandbox constraints, otherwise a new isolated host class created only if measurement requires it (recommended)? Or a per-tenant editor pool (cheaper, weaker isolation, not recommended)?
- **Q-O4** Is PDF editing in scope? Recommendation: no, preview-only.
- **Q-O5** Single editor per session in v1 (recommended)? Or real-time co-editing among authorized actors?
- **Q-O6 [sharper]** On a publish conflict with a Meri revision: keep the draft and offer branch / reopen-on-head / discard (recommended), never overwrite the head. Confirm that no head overwrite, even with confirmation, is offered.
- **Q-O7** Should edited versions need any review before filing beyond the existing filing approval? Recommendation: no.
- **Q-O8** Confirm mobile editing is excluded from the first shipment.
- **Q-O9 [new]** Editor drafts are a new private data class: approve it, its retention (proposed 7 days after last activity, destroyed on suppression or loss of access) and the migration request to dot.
- **Q-O10 [new]** "Publish as a branch from the base" needs artifact lineage that accepts a non-head parent. Accept that contract change as a proposal for dot, or limit conflict handling to reopen-on-head and discard?

---

## 5. Feature 4: Authenticated third-party website workflows

### 5.1 Definition and scope boundary

A **site workflow** is (named website, exact task, version). An example is "sign in to research portal X and download the filings list". It runs in the conversation's isolated browser on the D005 host, against an account the user holds. Each site workflow is approved by Capiro's platform owner, reviewed for terms-of-service compatibility, given its actual origins and identity-provider redirects, tenant and role controls, and live qualification, and enabled per tenant. **The first workflows should be retrieval or export**, not submission, payment or account administration. **This is separate from authenticated Meri chat (Clerk), which is unaffected.** It is also separate from OAuth/API connectors in the gateway: when a site offers an API or an existing connector covers the task, the connector is preferred, browser automation is used only for a concrete missing capability, and **connector work does not count as acceptance for this feature**. The source documents do not name actual first sites (Q-A1). Figma already reflects the intent: `07.02 · Site connection and sign-in` (`1064:143466`), `07.02A · Research account connected` (`3024:32266`), and `12.17` "Signed-in websites · Qualification pending per site".

### 5.2 Credential custody interpretations (owner chooses)

| Model | Meaning | Assessment |
| --- | --- | --- |
| **C1. User signs in live through takeover (recommended for the first shipment)** | The agent reaches the sign-in page and asks the user to take control. The user types credentials and MFA. The resulting session state exists only in the conversation-bound profile and is destroyed by S3. | The model, transcripts, receipts and logs never receive credentials (S2). There is no credential store and no cross-conversation session vault. The isolated browser host does hold session cookies and tokens for the profile's lifetime; that is bounded custody of session state, not "no custody". Cost: the user signs in again in each conversation (and after TTL expiry). |
| C2. Per-user encrypted session vault | After sign-in, control stores the site's storage state, encrypted with a per-tenant KMS key, and injects it into later conversations' fresh profiles (`--storage-state`/`contextOptions`). | Better UX. It carries session state across conversations: the host is not reused, but the identity is. It is credential persistence, needs a new secret class, a retention class and revocation, and is a later, separately approved step (Q-A3). |
| C3. Capiro- or tenant-managed service accounts | Credentials in a secrets manager, filled by a trusted component, never by the model. | New shared credentials and higher ToS risk. Not for the first shipment. |
| C4. API/OAuth connector instead | Gateway connector. | Preferred when available. It is a different feature (source connectivity) and does not satisfy this feature's acceptance. |

### 5.3 Architecture and placement

- **Site workflow manifest** (platform configuration, owned by the platform owner beside the approved destination list; contract proposal for dot). It contains: `siteId`, `workflowId`, `version`; `origins` and `idpOrigins` (identity-provider origins needed for sign-in), all of which must be in the platform maximum; `signInUrl`; `signedInProbe` (a URL or selector that shows the session is active, evaluated by the session owner, not the model); `sensitiveSelectors` (S2); allowed tools; **action classes** (which interactions are consequential and need approval; default: all interactions); download formats and limits; session TTL; `logoutUrl`; ToS review reference; qualification evidence reference. Tenant admins enable listed workflows and can narrow origins and actions, never widen.
- **Runtime:** when a run uses a site workflow, `resolveBrowserPolicy` intersects the conversation's effective policy with the manifest. The egress allowlist for that run becomes the manifest origins (bound and revoked with the run, as `effective-origin-allowlist` already requires). The agent navigates to `signInUrl`. If the probe says it is not signed in, the agent asks for takeover (feature 2, with S1 and S2). After the user hands back and resumes, the probe confirms the session and the UI shows "connected". Consequential actions go through the existing approval gate with digest binding. Every action also checks the withdrawal generations (S4).
- **Disconnect (revised):** the user's "Disconnect" (Figma `Overlay · Disconnect the research portal?` `3022:32509`) runs S3: fence and drain, optional `logoutUrl`, close the context and process tree, `disposeBrowserState` with verified absence, receipt, and a fresh empty profile if the run continues. Revision 1's `context.clearCookies()` approach is withdrawn, because local storage, IndexedDB and other storage can still authenticate. Conversation end, TTL expiry, revocation and session-owner crash run the same destruction. Under C1, nothing survives the conversation.

### 5.4 Authority, approval, isolation, custody, revocation, audit

- **Authority:** the platform owner approves each manifest version. The tenant enables it. The role ceiling applies. The current actor is checked per call. The manifest version is pinned per run **for changes and widening only**: a new version or a widened manifest takes effect at the next run. **Withdrawal, urgent disable, narrowing and revocation take effect during the active run** through S4; the pin never delays them.
- **Approval:** every interaction classified as consequential (submit, post, purchase, send, delete, change settings) needs a canonical approval for the exact input digest before it executes. Sign-in itself is a user action under takeover.
- **Isolation:** per-conversation host and profile. No profile reuse across conversations or tenants. Egress is restricted to the manifest origins for that run.
- **Custody:** the model, transcripts, receipts, logs and telemetry never receive credentials, cookies or tokens (S2). The isolated browser host holds session state in the per-conversation profile until S3 destroys it. There is no credential store.
- **Revocation (S4):** user disconnect, tenant disable, platform manifest withdrawal or urgent disable, membership removal and conversation close each end access within the 30 s target, during an active run, followed by S3. A site-side session expiry shows `Notice · Sign-in expired` (`1064:148233`). A revoked grant shows `Notice · Connection revoked` (`1064:148237`).
- **Audit:** receipts carry `siteId/workflowId/version`, the signed-in probe result (boolean), each action with approval ID and outcome (including UNKNOWN), downloads, disconnect with logout outcome, and destruction verification.

### 5.5 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Prompt injection on high-value authenticated pages | Manifest origin confinement. New tabs only to manifest origins. All interactions approved. No script-evaluation tools. Page content is untrusted. Retrieval/export first. |
| Terms-of-service violation or account suspension | Per-site legal/ToS review before approval. Rate limits in the manifest. User-owned accounts only (C1). |
| Credential capture | S2 (no model-bound output during takeover; credential fields always redacted; sign-in pages withheld; canary tests). |
| Session survives disconnect | S3 full destruction with server-side invalidation test; `clearCookies` alone is withdrawn. |
| Withdrawal waits for the next run | S4 generations checked per action and pushed; fail closed on staleness. |
| Cross-conversation session bleed | C1 disposal. Per-conversation host. Isolation test with two tenants and two conversations. |
| IdP redirects outside the allowlist break sign-in | IdP origins listed explicitly in the manifest and qualified. |
| Site changes break the workflow | Manifest versioning. A site-specific smoke test in qualification. Failure produces a closed "site unavailable" notice (`Notice · Site unavailable` `1064:148225`). |

### 5.6 Qualification / acceptance tests (per site workflow)

1. Sign-in through takeover, including MFA. The signed-in probe is correct. The session is absent from a second conversation and from a second tenant.
2. Egress is confined to the manifest origins, including IdP redirects. An unlisted origin is refused at host egress.
3. Each consequential action is blocked without approval and executes exactly once with a matching approval. Replay is refused. An action interrupted by takeover or revocation is UNKNOWN and not repeated.
4. Download through the existing ingest gate: formats, size and structure.
5. **State destruction (S3):** after Disconnect, conversation close, TTL expiry and revocation, the site's own server-side check reports the session unauthenticated from a fresh context; the profile and process tree are absent; with `logoutUrl`, a replayed old cookie is refused by the server. The framework test uses a synthetic site with a local-storage bearer token so that cookie-only clearing fails it.
6. **Live revocation (S4):** tenant disable, manifest withdrawal and membership removal in the middle of an active run stop the next action and destroy state within the target.
7. **Confidentiality (S2):** no credential, OTP, cookie or token text appears in the transcript, model-bound tool results, receipts, logs or telemetry (canary method; real IdP test tenant once a site is named).
8. A ToS review record and a named qualification evidence reference are stored in the manifest.

### 5.7 Dependencies on HOLD items

Feature 2 (takeover). Browser activation hold. D005 host qualification. Approvals port owner composition. Browser P1c HOLD findings (download limits/filename races, profile persistence). Platform destination list (Decision 3, initial list still open). Retention and deletion of the browser-state data class. Withdrawal-generation source (S4). `STARTUP-COMPOSITION`.

### 5.8 Effort: 5–8 engineer-weeks for the framework, plus 1–2 per named site workflow (unvalidated)

Manifest contract and resolution: 1–1.5. Signed-in probe, disconnect and session lifecycle: 1–2. Approval-class wiring and receipts: 1–1.5. Frontend site connection states: 1–1.5. Framework qualification: 1–1.5. Each site workflow: 1–2 (manifest, ToS review support, qualification). The two-site assumption gives 7–12. S3 destruction verification and S4 enforcement are in the revision-2 delta (6.7).

### 5.9 UI needs and missing Figma frames

Existing: `07.02` (`1064:143466`), `07.02A` (`3024:32266`), `07.04 · Browser connection states` (`1064:143472`), the disconnect overlays (`3022:32509`, `3022:32411`, `3022:32424`), the notices above, and `Browser workflow · Signed-in websites` (`1064:152337`). **Missing:** the "sign-in needed → take control" hand-off moment linking to takeover; a per-site workflow description and approval-class disclosure; disconnect outcome including "the site may still consider you signed in" when logout is not confirmed; "disabled by your administrator" mid-run notice; tenant admin enablement of site workflows (Settings); and the C2 "remember sign-in" consent if C2 is ever approved.

### 5.10 Owner questions

- **Q-A1 [sharper]** Name one or two **website + exact task** combinations for the first shipment, starting with retrieval or export (no submission, payment or account administration). For each, its real origins and IdP redirects are needed. Outlook/SharePoint retrieval is a possible suggestion only if it matches real needs and no connector/API covers it. The estimate assumes two.
- **Q-A2 [sharper]** Approve credential model **C1**: user signs in via takeover; the model and logs never receive credentials; session state lives only in the conversation profile and is fully destroyed (S3) on disconnect, conversation end, TTL expiry and revocation; no vault, no service accounts.
- **Q-A3** Should the C2 encrypted session vault be designed as a follow-up? It would be credential persistence across conversations, with a new secret class and retention class.
- **Q-A4** Who performs the per-site terms-of-service review (Capiro legal)? Is it a hard prerequisite for manifest approval (recommended)?
- **Q-A5** Default action class: all interactions on authenticated sites need approval (recommended), or let the manifest pre-approve low-risk ones (for example, search-box typing)?
- **Q-A6** Approve site workflow manifests as platform configuration owned by Capiro's platform owner, alongside the destination list.
- **Q-A7 [sharper]** Confirm that sites or tasks covered by an API or existing connector use the connector instead of browser automation, and that connector work does not count toward this feature's acceptance.
- **Q-A8 [new]** Site session lifetime under C1: keep a sign-in across runs within the same conversation until the manifest TTL (proposed default 8 hours of inactivity), or destroy it at the end of every run?

---

## 6. Cross-feature design

### 6.1 Browser activation hold

`activation.mjs` stays held until every `EGRESS_REQUIREMENTS` item has measured evidence on the D005 host. **Takeover and authenticated workflows cannot activate before that.** The session-owner composition changes the browser launch path, so the D005 sandbox evidence must be produced with that composition (re-run if it was produced earlier). Takeover adds one requirement to the host design, not to the egress list: the browser's network namespace must not reach the session owner's socket or the worker → control channel. Proposed text for a new requirement, `relay-path-separation`, goes to dot. The **device bridge** does not use the D005 host. It needs a separate activation record (proposed `BRIDGE_ACTIVATION`) with its own evidence (section 2.6) and the owner's trust-tier, installation and pairing decisions (Q-B1, Q-B4, Q-B8, Q-B9). The **Office editor** does not depend on browser activation. It needs its own host/placement admission.

### 6.2 Placements (logical homes, subject to explicit approval)

Placement approval is not deployment, spending, migration or credential approval.

- **Takeover session owner:** the existing isolated browser-host boundary (D005), inside the per-conversation unit, using the same Playwright integration, with the session owner as the browser parent. The changed launch path and relay separation must be requalified.
- **Authenticated workflows:** the same D005 host and session owner.
- **Live/bridge relay:** a bounded control-domain transport reusing existing identity and authority, with separate tickets, rate and backpressure limits and no payload persistence. Not a generic remote-device gateway.
- **Device pairing:** a control-domain owner beside the relay; session-bound by default (Q-B9).
- **Editor:** disposable single-session containers with short-lived single-document WOPI access and the existing artifact owner. Prefer existing approved hosting if it meets the real editor's sandbox constraints; create a new host class only if measurement requires it. No shared cross-tenant warm state, and no custom editor fleet beyond the required lifecycle (Q-O3, Q-X2).
- **Device bridge MCP:** the second Playwright MCP instance runs where the conversation worker runs.
- **Schedules** are not part of this document; their placement (control-domain managed Temporal worker on a dedicated queue) is in the L6 schedule proposals (P-L6-2/P-L6-3).

### 6.3 Per-conversation host lifecycle

| Resource | Bound to | Ends at |
| --- | --- | --- |
| Session owner, browser profile, screencast | Conversation (D005 unit) | S3 destruction at conversation end; host destruction is the backstop. |
| Takeover lease, viewer ticket | Run + actor | Hand-back, idle timeout, lost stream, cancel, revocation (run stays paused) |
| Site sign-in session state (C1) | Conversation profile | S3 destruction on disconnect, conversation end, TTL expiry, revocation, session-owner crash |
| Editor container, WOPI token, lock | Edit session (actor + exact version) | Close, expiry, revocation |
| Editor drafts | Edit session + actor | Publish, discard, draft retention expiry, suppression, loss of access |
| Device pairing | Actor + device, session-bound by default | Sign-out, browser restart, 12 h, unpair, admin disable, membership removal |
| Device attachment | Conversation run | Run end, detach, local disconnect, revocation |

Nothing in these features is reused across conversations or tenants. Resources that can outlive a conversation are the device pairing (session-bound by default, public key and metadata only, granting nothing without a fresh per-conversation attachment) and editor drafts (private to the editing actor, bounded by retention).

### 6.4 Mobile deferral

Mobile stays deferred relative to desktop (ledger row "Mobile"). Recommendation for all four features in the first shipment: desktop only. Phone and tablet show closed "continue on desktop" notices. Takeover live view (watch-only) on tablet is a possible later extension. ONLYOFFICE Community lacks mobile web editors anyway. Figma has phone and tablet browser/artifact frames (`10.24 · Phone browser activity` `3032:31526`, `10.06 · Mobile artifact` `1064:143537`). They need "unavailable on this device" variants for these features (Q-X3).

### 6.5 Shared components and ownership (proposed)

| Component | Owner | Used by |
| --- | --- | --- |
| Browser session owner (S1 fence, S2 filter, S3 destruction for the isolated browser) | Worker browser module (`apps/worker/conversation/browser/session/`) | 2, 4 |
| Live-session relay (S1 fence for the bridge) | Control (`apps/control/live-session/`) | 1, 2 |
| Device pairing | Control (`apps/control/device-pairing/`) | 1 |
| Withdrawal generations (S4) | Control, beside the existing revocation/membership source and the artifact suppression generation | 1, 2, 3, 4 |
| WOPI host, edit sessions and drafts | Artifact owner (`apps/runtime/artifacts/wopi/`, `apps/artifacts/edit-sessions/`) | 3 |
| Site workflow manifests | Platform configuration + `resolution.mjs` | 4 (and 1 for origins) |
| Approvals port | Canonical approval owner (`apps/control/commands`) through the browser approvals port | 1, 2 (agent side), 4 |
| Receipts | `receipts.mjs` (extended) | all |
| Frontend surfaces | capiro-frontend (D014): viewer, pairing, editor frame, site states | all |

### 6.6 Recommended build order

0. **Prerequisites (not estimated here; existing HOLD work):** usable conversation, tools and artifacts; approvals owner composition and lifecycle L1/L2/L4; `STARTUP-COMPOSITION`; D005 host qualification with real browser and renderer sandbox; browser activation evidence; P1c browser HOLD fixes; frontend multi-run controls; artifact native admission (for 3).
1. **Qualification spike (if approved, Q-X6):** synthetic and local only, no cloud resource, purchase or live site. (a) Session owner with `createConnection`: S1 fence/drain races, S2 filter over every tool's output, S3 destruction against a synthetic local-storage-token site, relay path separation. (b) WOPI lifecycle against a local editor evaluation build: repeated saves, locks, 409 behaviour, crash and exit-save recovery, publish refusal without draft loss. (c) Bridge read-only feasibility: can Playwright's read tools run under the read-only allowlist (mutation canary)? Results feed design acceptance; the spike is not an implementation approval.
2. **Live takeover:** session owner, relay and lease with S1/S2. It is the foundation for sign-in and the riskiest host change, so it should land first.
3. **Authenticated workflows:** framework plus the first named site and task (retrieval/export), using takeover for sign-in (C1) with S3/S4.
4. **Office editor:** a parallel evaluation track from the start, because it is independent of the browser. Build is gated on evaluation results, the quote and spending decision, and the editor placement approval.
5. **Device bridge:** last. It reuses the relay, has the most novel trust model, and depends on installation, pairing and trust-tier decisions.

Revision 1 guessed roughly 12–16 calendar weeks with three engineers after the prerequisites, for the revision-1 scope; the revision-2 mechanisms extend that by an amount not separately estimated. Single-threaded effort is in 6.7. All of these are unvalidated.

### 6.7 Effort summary (unvalidated author planning)

These figures are Fable's planning estimates. They are **not validated**, not a delivery commitment, and have not been reviewed against team velocity or measured spikes. They assume:

- engineers already familiar with this repository's owners (browser fragment, lifecycle, artifacts, approvals);
- all prerequisite HOLD work (6.6 step 0) is already complete and not counted;
- the D005 host is qualified and browser activation is open before takeover and site work start;
- one editor product, chosen after evaluation, with no switch to the fallback;
- two named site workflows of retrieval/export complexity;
- no redesign forced by live qualification failures (the spike is meant to reduce that risk);
- no procurement, legal, vendor, store/enterprise rollout or cloud-provisioning lead time;
- frontend work at the level of the frames listed in 2.9, 3.9, 4.9 and 5.9.

| Feature | Engineer-weeks | Assumptions |
| --- | --- | --- |
| Live takeover | 6–9 | Relay counted here. D005 qualified and activation open. |
| Authenticated workflows | 7–12 | 5–8 framework + two site workflows at 1–2 each |
| Office editor | 9–14 | Collabora via WOPI after evaluation. Excludes evaluation, quote, procurement, legal and cloud setup. |
| Device bridge | 8–12 | Relay already built (else +1). Excludes store/enterprise rollout lead time. |
| **Revision-1 scope** | **30–47** | Excludes all prerequisite HOLD work, new credentials and cloud actions (shipping owner) |
| Revision-2 delta | 4.5–7 | S1 fence/drain 1–1.5; S2 filter and canary tests 1–1.5; S3 destruction and invalidation tests 0.5–1; S4 withdrawal generations across four features 1–1.5; editor draft store, publish intent/reconciliation and recovery 1–1.5 |
| Qualification spike (Q-X6) | 1–2 | Overlaps with the above; partly reusable as their tests |
| **Total (unvalidated)** | **≈ 34.5–54** | Same exclusions |

### 6.8 Biggest risks across the four

1. **Authenticated sessions plus prompt injection** (features 1 and 4). The agent operates where a user is signed in. Mitigated by origin confinement, approval of every interaction, no cookie/script tools, read-only defaults and retrieval-first workflows. This remains the highest residual risk.
2. **The device bridge leaves infrastructure egress control.** It needs explicit owner acceptance of a software-enforced trust tier, and private networks stay out unless separately decided.
3. **Takeover race and confidentiality** depend on S1 and S2 being enforced at the session owner, the one execution point; a design that relied on the worker hook or on upstream password masking would not be safe.
4. **Editor licensing, commercial terms and fidelity.** No verified commercial offer exists; the CODE edition is not a production basis; fidelity has a hard gate; draft handling must never lose or prematurely publish user work.
5. **Schedule risk from prerequisites:** D005 host qualification, browser activation and L4 recovery are not yet done and block features 2 and 4.

### 6.9 Cross-feature owner questions

- **Q-X0 [new]** Confirm whether all four features are release-blocking first-shipment requirements. Making any of them optional, or moving it later, would amend Fable's recorded scope; this document does not assume either.
- **Q-X1** Approve the build order: prerequisites → spike → takeover → first authenticated site/task; the editor evaluated in parallel; the bridge last.
- **Q-X2 [sharper]** Approve the logical homes in 6.2 as placements: relay and device pairing in the control domain; the browser session owner on the D005 host; disposable single-session editor containers (existing approved hosting if it qualifies, a new host class only if measured necessary). Placement approval is not deployment, spending, migration or credential approval.
- **Q-X3** Confirm all four features are desktop-only for the first shipment.
- **Q-X4** Approve adding the new components to `docs/COMPONENTS.md` once chosen: the evaluated editor (Collabora Online or an ONLYOFFICE edition) and the adapted Playwright Extension source, with versions and licences.
- **Q-X5** Confirm the Figma file for these frames (`IXJzJUkXcUTkySHir5JNea`, versus `Zc2dEN5aLU47dVdsewDmiJ` in the repository's UI ledgers), and that dot/frontend own adding the missing frames listed in sections 2.9, 3.9, 4.9 and 5.9.
- **Q-X6 [new]** Approve the bounded qualification spike in 6.6 step 1 (synthetic, local, no cloud resource, purchase, vendor contact or live site) before broad implementation? It is design evidence, not implementation approval.
- **Q-X7 [new]** Live revocation (S4): keep the 30 s propagation target for all four features and a 30 s fail-closed staleness bound, measured end to end?

### 6.10 Revocation and teardown summary

| Trigger | Bridge | Takeover | Editor | Site workflows |
| --- | --- | --- | --- | --- |
| User action | Local disconnect / unpair / close group | Hand-back (then explicit resume) | Close (exit save → draft) | Disconnect → S3 |
| Conversation end | Attachment ends | Lease ends; S3 | Sessions closed; drafts retained per Q-O9 | S3 |
| Tenant or platform switch-off | S4 → relay closes | S4 → lease ends, run paused | S4 → WOPI refused, container stopped | S4 → S3 |
| Manifest withdrawal / urgent disable | Origins removed | — | — | S4 → S3, during the run |
| Membership removal | S4 → relay closes | S4 → lease ends | S4 → WOPI refused; drafts destroyed | S4 → S3 |
| Artifact suppression | — | — | Suppression generation → refused; drafts destroyed | — |
| Process crash | Extension detaches on socket loss | Run stays paused | Drafts survive; recovery offered | Restarted owner destroys profile before launch |

## 7. Evidence and limits

- Repository facts come from the base tree: the browser module (`policy.mjs` tool lists and timeouts, `server.mjs` launch flags, `workspace.mjs` disposal), the lifecycle README (pause/approval-wait holds, checkpoint, resume with exact retirement and a new fence, UNKNOWN rules), artifact sources (`ARTIFACT_EFFECT_UNKNOWN`, CAS), artifact READMEs, ledger rows, DECISIONS D005/D014, the deployment plan, the capability scope and the audit's "End-goal scope accounting" (`origin/dot/meri-comprehensive-audit-20261015`, `meri-audit-product-integration.md`).
- Review inputs for revision 2: `PACKAGE3-DESIGN-REVIEW.md` and `PACKAGE3-REVIEW-20261015.md` item 5, read at origin commit `f8d1816e`.
- The Playwright API facts were read from the installed pinned package's type declarations and bundled sources in a local worktree. They have not been exercised. Per-request cancellation in Playwright MCP 0.0.83 is not verified; S1 does not depend on it.
- Collabora's PutFile extension headers and 409/1010 behaviour are cited from vendor integration documentation as recalled by the author, not re-fetched for revision 2; they must be confirmed against the evaluated version. The CODE-limit correction and the CODE/subscription distinction come from the review's cited sources (Collabora FAQ, forum clarification of September 2026, subscriptions page), which revision 2 did not re-fetch. No vendor was contacted.
- Figma facts come from layer metadata of file `IXJzJUkXcUTkySHir5JNea` (frame and layer names only; long text layers are truncated in the metadata). Design note frame `3043:34159` ("Meri 3.4 handoff decisions · 15 October 2026") was not readable in full and should be reconciled by dot.
- Licence statements cite upstream licence files where they were fetched (ONLYOFFICE `LICENSE` §7 terms and README editions table; Collabora `COPYING`; noVNC, neko and Univer licences). Points marked "unverified" (the ONLYOFFICE 9.4 limit removal) rest on secondary sources and need vendor confirmation before procurement. This is not legal advice. Capiro legal should review the editor and extension licences and each site's terms.
- All tests named in this document are proposed acceptance criteria. None has been written or run. No checks were run because no code changed.
