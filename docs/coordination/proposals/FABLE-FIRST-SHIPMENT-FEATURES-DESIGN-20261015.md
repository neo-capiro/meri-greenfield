# First-shipment features: device/browser bridge, live takeover, in-browser Office editing, authenticated website workflows (design proposal)

> **PROPOSAL, AWAITING OWNER APPROVAL. NOTHING IS IMPLEMENTED.** This document is input to the `FEATURE-DESIGN-APPROVAL` gate in the [scope ledger](../ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md). The owner is Neo Martinez; dot reviews. This lane changed no code, dependency, lockfile, contract, catalog, migration, credential, cloud resource or deployment. It allocates no migration ID and opens no gate. Every recommendation below is a proposal. Module paths named as "proposed" are suggestions for allocation, not created files.

Date: 15 October 2026. Lane: Fable design. Branch `fable/design-first-shipment-features-20261015`. Base `db88ef1c`: package two re-signed, with the same tree as `e09a5783`. The base contains the [owner decisions record](../reports/FABLE-OWNER-DECISIONS-20261015.md) and the regenerated scope ledger.

Why this exists: on 15 October 2026 the owner made all four previously deferred features required for the first shipment. AGENTS.md requires approval before any change to architecture, component choices, scope or placement. So each feature needs an approved design before anyone builds it.

Coordination note: the AGENTS.md on this branch's base (inherited from ba40647c) still carries the older OpenAI/Codex-only text. The current handoff AGENTS.md (commit aa09dd28, 14 October 2026) assigns Meri implementation to Fable and independent validation/integration to dot, and supersedes that restriction. The integration branches have not yet merged aa09dd28; dot, as integration owner, decides when to merge it. No ownership question remains open for this proposal.

## 0. Decision summary

| # | Feature | Recommended definition (scope boundary) | Recommended architecture and components | License / service constraints | Placement | Effort (eng-weeks) | Owner decisions needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Device/browser bridge | **Interpretation A.** Meri operates tabs that the user explicitly shares from their own desktop Chrome/Edge. Those tabs carry the user's existing sign-ins. Desktop only. No local files, no desktop apps, no phone. | A small Meri extension (Manifest V3) built from the upstream **Playwright Extension** (Apache-2.0). It pairs through a short-lived, device-bound, revocable capability. It connects outbound to a **control-plane relay**. The worker's pinned **Playwright MCP 0.0.83** attaches through `cdpEndpoint` + `cdpHeaders`. Every interaction needs approval. Read-only by default. | Apache-2.0 (keep notices). Chrome Web Store or enterprise force-install distribution. `chrome.debugger` shows a "debugging" banner. | User device (extension); relay in the control service (Fargate); MCP in the conversation worker | 8–12 | Q-B1–Q-B7. Mainly: accept a **user-device trust tier** that is outside infrastructure egress control. |
| 2 | Live browser takeover | **Interpretation B.** A live view of the conversation's isolated browser, plus an **exclusive control lease**: the user drives and the agent is paused, then the user hands back. Desktop only. No clipboard or file sync in v1. | A **browser session owner** process on the D005 host. It launches Chromium through the pinned Playwright, gives the context to Playwright MCP (`createConnection`), streams frames with Playwright's `page.screencast` and injects input with `page.mouse`/`page.keyboard`. Frames go to the control-plane relay over the worker's trusted channel. **Not VNC.** | Apache-2.0 only (Playwright). No X server and no GPL VNC server. | D005 host (session owner); control (relay); frontend viewer | 6–9 | Q-T1–Q-T6 |
| 3 | Full in-browser Office editor | **Interpretation A.** WYSIWYG editing of DOCX/XLSX/PPTX in the browser. Each save produces a **new immutable version** through the existing artifact owner. Single editor per session in v1. PDF stays preview-only. | **Collabora Online** integrated through **WOPI**. The WOPI host is a new module of the artifact owner. Each edit session gets one disposable editor container on an isolated host class. Fidelity is qualified on a held-out corpus. Fallback: ONLYOFFICE Docs (Developer Edition if white-label or scale is needed). | Collabora: MPL-2.0 (file-level copyleft). CODE builds are not for production and are limited to 10 documents / 20 connections, so production needs a subscription or a supported self-build decision. ONLYOFFICE Community: AGPL-3.0 plus §7 additional terms (attribution, legal notices in the UI, no trademark); those terms are under public dispute. | Editor host class (new placement); WOPI host in control/artifacts | 9–14 (+ procurement) | Q-O1–Q-O8. Mainly: editor product, subscription budget, editor placement. |
| 4 | Authenticated third-party website workflows | A **named site + named workflow** that the platform owner approves and qualifies individually. Runs in the conversation's isolated browser. Authenticated Meri chat (Clerk) is separate and unchanged. | **Site workflow manifests** live in the platform configuration beside the approved destination list. **Credential custody C1:** the user signs in through takeover, Meri never sees credentials, and session cookies live only in the conversation-bound profile and are disposed with it. Consequential site actions go through the canonical approval owner using the existing input-digest port. | Each site's terms of service must permit automation (legal review per site). | D005 host; platform configuration; control | 5–8 framework + 1–2 per site/workflow | Q-A1–Q-A7. Mainly: the first named sites/workflows, and whether to allow a session vault (C2) later. |
| X | Cross-feature | Desktop-only for all four. Nothing is activated until the browser activation hold opens (except the editor, which has its own host gate). | Shared parts: session owner, live relay, canonical approval port, receipts, per-conversation disposal. | — | — | Total **30–47** eng-weeks (two initial sites assumed). HOLD prerequisites excluded. | Q-X1–Q-X5 |

Recommended build order (section 6): prerequisites → **takeover → authenticated workflows (first site)**. The **Office editor** runs on a parallel track. The **device bridge** comes last.

## 1. What already exists and is reused

| Existing owner | Path / record | How these features reuse it |
| --- | --- | --- |
| Single model loop | Claude Agent SDK 0.3.295 `query` (`apps/worker/conversation/activity.mjs`, `options.mjs`) | No feature adds a model loop. Bridge and takeover add MCP configuration and hooks to the one query. |
| Browser fragment | `apps/worker/conversation/browser/**` (README, `policy.mjs`, `permissions.mjs`, `server.mjs`, `downloads.mjs`, `workspace.mjs`, `receipts.mjs`, `activation.mjs`, `egress.mjs`, `resolution.mjs`) | The tool policy, deny-by-default destinations, platform limits (`public-web.mjs`), the `PreToolUse` + `canUseTool` approval gate (`meri-browser-approval-request/2` with `inputDigest`), the download → `artifacts.ingest` path, receipts and `dispose` all stay canonical. |
| Activation hold | `activation.mjs` `BROWSER_ACTIVATION={state:'held'}` + `EGRESS_REQUIREMENTS` | Takeover and authenticated workflows cannot open before it opens. The bridge needs its own gate (section 2.5). |
| Destination policy | `resolution.mjs`: platform maximum ∧ tenant ∧ role; owner Decision 3 | Site manifests and bridge origins are subsets of the platform-approved list. Tenant admins can only narrow. |
| Canonical approval owner | `apps/control/commands/approval-context.mjs` (ApprovalProposal / ApprovalDecision); lifecycle approval-wait in `apps/control/conversations/lifecycle` | Every consequential action in features 1, 2 (agent side) and 4 goes through it. The browser README lists the approvals port owner as remaining work item 5. |
| Conversation lifecycle | `apps/control/conversations/lifecycle` (pause/resume controls, `nextControls`/`claimControl`/`ackControl`), Temporal workflows | Takeover leases and bridge attachments are lifecycle controls, not a second orchestrator. |
| Artifacts | `apps/artifacts/**` (immutable versions, CAS head, structural inspection `structure/file-structure.mjs`), `apps/runtime/artifacts` (document application, signed download links, suppression generation) | The editor's WOPI `GetFile`/`PutFile` reuse the same authorization chain and the create/revise path. The download-link authorization ordering is the model to follow. |
| Isolated browser host | D005; `docs/qualification/G1-REMAINING-WORK.md` | Takeover and authenticated workflows run there. The editor proposes a sibling host class. |
| Pinned Playwright | `@playwright/mcp` 0.0.83 + `playwright-core` 1.64.0-alpha (`docs/COMPONENTS.md`) | Verified in the installed package (`apps/worker/qualification/node_modules` in the `meri-fable-complete` worktree): `createConnection(config, contextGetter)` (`@playwright/mcp/index.d.ts`); config `cdpEndpoint`/`cdpHeaders`/`remoteEndpoint` (`config.d.ts`); `page.screencast.start({onFrame,size,quality,fps})` (`playwright-core/types/types.d.ts`, interface `Screencast`); `browser.bind()`. Not yet exercised: these are source facts, not qualification. |
| Figma (Meri UI) | File `IXJzJUkXcUTkySHir5JNea`, page `1064:140864` "Prototype — Capiro 3.4" (layer metadata inspected only) | Existing frames are cited per feature. The current design explicitly says "Live browser viewer · Not selected / unsupported · No live viewer or user takeover" (`1064:152347`, in `12.17 · Browser permissions & qualification` `1064:152281`), and "Office previews are read-only" (`1064:151439`). Those frames must change. The repository's older design references point at file `Zc2dEN5aLU47dVdsewDmiJ`. dot should confirm which file is authoritative for `docs/UI-COVERAGE.md`. |

New shared parts that need approval (each is introduced once and reused):

- **Browser session owner** (proposed `apps/worker/conversation/browser/session/`). One process per conversation on the D005 host. It launches the browser through Playwright and serves Playwright MCP to the SDK over stdio (`createConnection`). It also owns screencast and input for takeover. This replaces the current "spawn the MCP CLI" composition in `server.mjs` with the same flags as config: `--sandbox`, per-conversation user-data-dir, origin lists, service workers blocked, WebMCP off. It stays inside the one Playwright integration. Alternative: keep the CLI and attach it with `--endpoint` to a browser bound by `browser.bind()` on a named pipe. This is unverified for persistent contexts, so it is a qualification item.
- **Live session relay** (proposed `apps/control/live-session/`). A WebSocket relay in the control service between an authenticated user and a conversation's worker. Takeover uses it for frames and input. The bridge uses it for CDP. It has no persistence beyond receipts. AI SDK UI transport stays the chat transport; the relay is a separate channel with a separate ticket.
- **Contract proposals for dot** (not edited here): live-session ticket, takeover lease control, bridge pairing/attachment, WOPI edit session, site workflow manifest. Each needs a versioned schema in `packages/contracts` through its owner. Migrations needed (device pairings, edit sessions/locks, site enablement) get IDs from dot centrally.

---

## 2. Feature 1: Device/browser bridge

### 2.1 What "device" could mean (owner chooses)

| Interpretation | Meaning | Assessment |
| --- | --- | --- |
| **A. Own-browser bridge (recommended)** | Meri reads and acts in tabs that the user explicitly shares from their own desktop Chrome/Edge. This uses the sign-ins and network the user already has. | This is the usual meaning of "browser bridge" in agent products. It covers sites that cannot be qualified in Meri's isolated browser (corporate SSO, device-bound MFA, VPN-only intranets). Upstream support exists (Playwright Extension). |
| B. Device handoff to the remote browser | The user's device views and drives Meri's isolated browser. | This is feature 2 (takeover). It should not be built twice. |
| C. Local device access | A desktop helper exposes local files, folders, clipboard or desktop Office apps to Meri. | This needs a large native helper with a high-privilege attack surface. It is not implied by "browser bridge". Recommend excluding it from the first shipment. |
| D. Phone/mobile pairing | Meri on a phone acts as an approval device or companion. | Mobile is deferred relative to desktop (ledger row "Mobile"). Excluded. |

**Scope boundary (A):** desktop Chrome and Edge only (the upstream extension supports Chromium-family browsers only). Only tabs the user puts in the Meri tab group are visible. The same bounded tool list as the isolated browser applies. In v1 there are no uploads from the device, no access to local files, no cookie or storage export, and no access to other tabs or profiles. While the bridge is paired, the user can watch everything in their own browser. A takeover equivalent is not needed: the user already controls the tab.

### 2.2 Architecture and placement

```
User's Chrome/Edge ── Meri extension (MV3, chrome.debugger on the shared tab group)
      │  outbound WSS, device capability (short-lived, DPoP-style proof from a non-extractable WebCrypto key)
      ▼
Control service (Fargate): live-session relay ── CDP method filter + tab scoping + receipts
      ▲  WSS from worker with task-bound capability (cdpHeaders)
      │
Conversation worker: Playwright MCP 0.0.83 instance `meri_device_browser` (cdpEndpoint → relay)
      └─ same PreToolUse/canUseTool gate and approvals port as `meri_browser`
```

- The worker never connects to the user's machine, and the user's machine never connects to the worker. Both connect outbound to the relay. The relay pairs them only for an attachment that is current and authorized (tenant, actor, conversation, device).
- This adds a second instance of the same pinned Playwright MCP with its own server name and policy. It does not add a second browser framework. The model sees `mcp__meri_device_browser__*` tools only while an attachment is active.
- Pairing (a new control owner, proposed `apps/control/device-pairing/`): the user opens "Connect this browser" in Meri, and the extension shows a one-time code that is valid for 5 minutes or less. The extension generates a non-extractable key pair. Control binds the public key to (tenant, actor, device label) and issues access capabilities lasting 15 minutes or less, renewed only with a key proof. Attaching to a conversation is a separate per-conversation grant that the user confirms in the extension UI. It ends when the conversation run ends.

### 2.3 Upstream options

| Option | What | License / constraints | Verdict |
| --- | --- | --- | --- |
| U1. Upstream Playwright Extension + local `@playwright/mcp --extension` | Microsoft's extension attaches to the user's tabs. The MCP server must run **on the same machine**: the pinned code reads the local user data directory to find the extension profile (`playwright-core/lib/tools/utils/extension.js`). Connections are approved per connection or with a profile token. Each client gets its own tab group. | Apache-2.0. Chrome Web Store item `mmlmfjhmonkocbjadbfplnigmagldckm`. Store auto-updates, so the version cannot be pinned unless it is force-installed from a self-hosted update URL. | Works only with a local MCP, which means a desktop helper on the user's machine that tunnels MCP to Meri. That is too heavy and puts an unpinned binary on user devices. **Not recommended as-is.** |
| **U2. Meri extension built from the upstream extension source + relay + `cdpEndpoint` (recommended)** | Adopt the Apache-2.0 extension source. Replace the local-relay connect page with Meri pairing and an outbound WSS to the relay. The worker's Playwright attaches over CDP (`cdpEndpoint`/`cdpHeaders`, both present in 0.0.83 `config.d.ts`). | Apache-2.0 (keep NOTICE and attribution). The upstream limitation (local-only MCP) justifies the custom change under standards §14. The `debugger` permission triggers Chrome's "started debugging this browser" banner. Enterprise force-install via group policy can suppress it; recommend **keeping** it as a visible indicator ([Chrome permission docs](https://developer.chrome.com/docs/extensions/mv3/declare_permissions); [UiPath MV3 debugger banner note](https://docs.uipath.com/studio-web/automation-cloud/latest/user-guide/debugging-banner-notification-after-extension-upgrade-to-manifest-v3)). | Smallest custom surface. Keeps one Playwright integration. Version is pinned through self-distribution. |
| U3. Desktop helper using the browser's `--remote-debugging-port` | A native app attaches to the user's whole browser over CDP. | It exposes every profile and tab. A localhost debug port is a known attack surface. | Rejected. |
| U4. Hosted remote-browser vendors | Third-party cloud browsers. | Not the user's device. Third-party data processing. | Not this feature. |

Sources: [Playwright MCP README (`--extension`, `--cdp-endpoint`, `--cdp-header`)](https://github.com/microsoft/playwright-mcp/blob/main/README.md); [Playwright Extension README](https://github.com/microsoft/playwright/tree/main/packages/extension#readme); [Chrome Web Store listing](https://chromewebstore.google.com/detail/mmlmfjhmonkocbjadbfplnigmagldckm).

### 2.4 Authority, approval, isolation, custody, revocation, audit

- **Authority:** the server binds tenant, actor, conversation and device. The extension's claims are requests, not authority. Every relay frame is checked against a current attachment. Platform maximum: bridge on or off, plus origins. Tenant admins can turn it off or narrow origins. Role ceilings apply.
- **Destinations:** agent-initiated navigation and new tabs are limited to the effective allowlist (the existing `checkBrowserUrl`), enforced in the worker gate **and** in the relay (which inspects `Page.navigate` / `Target.createTarget` URLs). Redirects and sub-resources in the user's browser use the user's own network. **Meri cannot enforce `EGRESS_REQUIREMENTS` there.** This is a different trust tier, and the owner must accept or reject it explicitly (Q-B1).
- **Approval:** read tools (snapshot, screenshot, wait) are allowed. Navigation is allowed within the allowlist. Every interaction tool goes through the existing `canUseTool` → approvals port → canonical approval owner with the exact `inputDigest`. Recommended default: **read-only mode** (interaction tools removed) unless the tenant enables interactions for the bridge.
- **CDP restriction (relay):** an allowlist of the CDP domains and methods Playwright needs for the bounded tools. Denied, among others: `Storage.getCookies`, `Network.getCookies`/`getAllCookies`, `Network.setCookie(s)`, `Browser.*` (except version), `Target.createBrowserContext`, `Target.attachToTarget` for tabs outside the group, `Page.setDownloadBehavior`, `Fetch.*` interception, `Input.*` while the agent is not in an approved interaction, and `Runtime.evaluate` from anything other than the Playwright session. The exact method list is derived and qualified against Playwright 1.64 traffic. Upstream `chrome.debugger` already blocks some domains.
- **Credential custody:** Meri stores no third-party credentials and no cookies. The device holds a non-extractable private key. Control holds only the public key and pairing metadata. The worker gets a task-bound relay capability, never the device capability.
- **Revocation:** the user can unpair in Meri or the extension, or close the tab group. Admin or tenant policy can turn the bridge off. A membership change ends active attachments. Target: within the 30 s propagation target, measured. Revoked capabilities fail at the next frame. The relay closes both sockets.
- **Isolation:** one attachment per conversation. Tabs belong to one client at a time (the upstream design). There is no cross-tenant relay routing. The relay keys connections by (tenant, attachment ID) and refuses mismatches.
- **Audit:** `meri-browser-receipt/1` extended with `surface:'device'`, device ID, attachment ID, origin host and outcome. Pairing and unpairing receipts. No page content or screenshots retained beyond the conversation's existing receipt policy.

### 2.5 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| The agent acts with the user's real sign-ins (email, banking, corporate) | Tab-group scoping. Origin allowlist. Read-only default. Per-interaction approval with the digest shown. Persistent "Meri is connected" indicator and the Chrome debug banner. Kill switch in the extension. |
| Prompt injection from pages the user is signed in to | Treat page content as untrusted. No tool can read cookies or storage. Approval shows the exact action. No uploads from the device. |
| Infrastructure egress controls do not apply | Explicit trust-tier acceptance (Q-B1). Allowlist checked twice (worker + relay). Bridge activation gated separately from the D005 gate. |
| Extension supply chain / auto-update | Self-hosted update URL or enterprise force-install with pinned versions. Signed CRX. Version in `docs/COMPONENTS.md`. |
| Relay hijack or replay | Single-use tickets. Proof-of-possession on every reconnect. Short expiry. Tenant-keyed routing. |
| Data in transit through the control plane | TLS. No frame or CDP payload persistence. Redacted telemetry, as in the download-link logging rules. |

### 2.6 Qualification / acceptance tests

1. Pairing: code expiry; replay refused; key-proof failure refused; unpair takes effect within the target and is measured.
2. Scoping: tabs outside the group are invisible; attach to an unshared tab is refused; a second conversation cannot attach to the same tab.
3. CDP filter: each denied method is refused at the relay (cookie reads, new browser context, interception); allowed tool traffic passes for every bounded tool.
4. Policy: navigation to an unlisted origin is refused at the worker and at the relay; an origin the tenant narrowed away is refused; interaction tools are absent in read-only mode.
5. Approval: an interaction runs only after an approval matching the digest; expiry, abort and mismatch deny (reuses the `permissions` tests, now against a live SDK).
6. Revocation: membership removal, tenant toggle-off and conversation close each end the attachment within the target.
7. Audit: receipts for every call, pairing and unpairing, with no secrets or tokens in logs (redaction test like `download-links-redaction.test.mjs`).
8. Real-browser runs on Chrome and Edge stable, with the extension at the pinned version.

### 2.7 Dependencies on HOLD items

Approvals port owner composition (ledger: approval owners unmounted, L1/L2). `STARTUP-COMPOSITION`. Conversation multi-run UX (frontend one-run observer). Revocation deadline and membership source (Core). Browser fragment HOLD findings from P1c (the gate code is shared). Not blocked by D005 host qualification, but needs its own activation record.

### 2.8 Effort: 8–12 engineer-weeks

Extension adaptation, pairing and distribution: 3–4. Relay with CDP filter and routing: 2–3. Worker composition and policy: 1–2. Frontend pairing/settings/indicators: 1–1.5. Qualification: 1.5–2. Assumes the shared relay is built here or in feature 2 (counted once, in feature 2). If the relay is already built: subtract 1. Excludes Chrome Web Store or enterprise rollout lead time.

### 2.9 UI needs (capiro-frontend) and missing Figma frames

Needed: "Connect this browser" pairing flow (code display/entry, success, expiry); paired devices list with unpair (Settings · Connections, near `09.02 · Connector accounts and permissions` `1064:143496`); per-conversation "Use my browser" attach and detach; connected indicator; approval card for device actions (variant of the existing confirmation); revoked/disconnected notices. **Missing frames:** all of the above. No current frame covers device pairing. `Install Meri` (`1064:150635`, in the Meri top bar) is not a bridge flow and should not be reused without a design decision.

### 2.10 Owner questions

- **Q-B1** Accept interpretation A and the **user-device trust tier**? In that tier, Meri enforces destinations and approvals in software, but not network egress.
- **Q-B2** Read-only by default, with interactions only when a tenant enables them? Or interactions available by default, each still approved?
- **Q-B3** Should the platform destination allowlist apply to bridge navigation (recommended)? Or should the bridge be allowed on any site the user opens?
- **Q-B4** Distribution: unlisted Chrome Web Store item, enterprise force-install with a self-hosted update URL, or both?
- **Q-B5** Keep Chrome's debugging banner visible (recommended)?
- **Q-B6** Confirm Edge support alongside Chrome. Confirm interpretations C (local device access) and D (phone) are out of the first shipment.
- **Q-B7** Approve the new control-plane relay and device-pairing owner placement in the control service.

---

## 3. Feature 2: Live browser takeover

### 3.1 Interpretations (owner chooses)

| Interpretation | Meaning | Assessment |
| --- | --- | --- |
| A. Live view only | The user watches the agent's isolated browser live. | Useful, but it does not solve sign-in, MFA, CAPTCHA or stuck flows. |
| **B. View + exclusive takeover lease (recommended)** | Live view whenever the browser is active. "Take control" pauses the agent and gives the user exclusive input. "Hand back" resumes the agent with a fresh snapshot. | Covers sign-in for feature 4 without Meri ever handling credentials. Simple authority model: one driver at a time. |
| C. Simultaneous co-control | User and agent both act at the same time. | Ambiguous attribution and race conditions. Not recommended. |

**Scope boundary (B):** applies only to the conversation's own isolated browser on the D005 host. Desktop web. Keyboard, mouse and wheel input. Tab switching among the context's pages. In v1 there is no clipboard sync (typing only), no file upload from the user's device (uploads stay separately qualified), no audio, and no devtools. Downloads go only through the existing download gate. User-driven navigation is subject to the same destination policy, because host egress enforces it anyway.

### 3.2 Architecture and placement

- The **browser session owner** (section 1) holds the Playwright `BrowserContext`. It serves Playwright MCP to the SDK and, on request, runs `page.screencast.start({onFrame, size, quality, fps})` on the active page. JPEG frames go over a Unix-domain socket to the conversation worker's trusted channel and on to the **live-session relay** in control, then to the user's viewer.
- Input comes back the same way. Each event is checked by the session owner (lease holder, coordinates inside the viewport, rate limit, allowed key set) and then injected through `page.mouse` / `page.keyboard`.
- The browser's network namespace gains **no new destination**. The relay path goes from the session owner and worker, outside the browser's sandboxed network, over the existing worker → control channel. This keeps `EGRESS_REQUIREMENTS` unchanged and adds a host design requirement: the browser processes cannot reach the session owner's socket or the worker channel.
- **The lease** is a conversation lifecycle control (`takeover.begin` / `takeover.end`), not a new orchestrator. While the user holds the lease, the browser `PreToolUse` hook denies every agent browser tool with `BROWSER_USER_IN_CONTROL`, and the run sits in the lifecycle's paused state. On hand-back, the model receives a content-free note ("the user controlled the browser from t1 to t2; current URL host is …") and takes a new snapshot. Idle lease timeout (default 10 minutes) ends the lease and leaves the run paused, not auto-resumed.
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

- **Who may view or take over:** by default only the conversation's owning actor. Tenant admins do not get live view of other users' sessions unless the owner decides otherwise (Q-T3). The server rechecks authority on ticket issue, on every lease start and on a heartbeat (30 s or less).
- **Approval semantics:** actions the user performs during a lease are the user's own and are attributed to the user. They are not agent actions, so no agent approval is requested. Agent actions after hand-back keep per-call approval. If a page is mid-submit when the lease ends, nothing auto-continues.
- **Secrets:** password fields typed during a lease must never reach the model, receipts or logs. Requirements: input events are never logged; the post-hand-back snapshot is checked to show masked password values only (a qualification test, since this is an upstream accessibility-snapshot behavior); screenshots in receipts are skipped during a lease.
- **Recording:** frames are not persisted (recommended). Receipts record lease start and end, actor, page origin hosts visited and counts of input events, without content (Q-T4).
- **Isolation:** the D005 per-conversation host. The relay routes by (tenant, conversation, session-owner instance). There is no cross-conversation viewer.
- **Revocation:** membership removal, conversation cancel or close, or tenant disable ends the lease and the stream within the 30 s target. `dispose` removes the profile as it does today.

### 3.5 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Stream leaks sensitive pages | Owner-only viewing. Single-use tickets. TLS. No persistence. Redacted telemetry. |
| User navigates somewhere unsafe | Host egress allowlist applies to user input too. Platform limits unchanged. |
| Credentials typed by the user reach the model | Password masking tested. No input logging. No receipt screenshots during a lease. |
| Agent and user race | Exclusive lease. Agent tools denied during the lease. Run paused. |
| Input injection abuse (fast scripted input) | Server-side rate limits. Only the lease holder. Coordinates bounded to the viewport. |
| Takeover used to bypass approvals | User actions are attributed to the user and receipted. The agent never acts during a lease. Tenant can disable takeover. |

### 3.6 Qualification / acceptance tests

1. Lease exclusivity: agent tool calls during a lease are denied; hand-back produces a fresh snapshot; an idle timeout leaves the run paused.
2. Authority: a non-owner ticket is refused; an expired or reused ticket is refused; membership revocation ends the stream within the target.
3. Egress: typed navigation to an unlisted origin, a private address, a redirect to an unlisted origin, and a rebinding name are all refused at host egress, using the D005 negative probes driven through the takeover input path.
4. Secrets: a synthetic sign-in page with a password field produces no password value in snapshot, receipt, log or telemetry.
5. Performance: frame latency p95 and bandwidth measured on the D005 host; reconnect without duplicating input.
6. Cleanup: the session owner, relay sockets and screencast stop on cancel, crash and close; physical process absence verified.
7. Real non-root browser and renderer sandbox evidence with the session owner composition (re-run the D005 evidence, because the launch path changes).

### 3.7 Dependencies on HOLD items

Browser activation hold (all `EGRESS_REQUIREMENTS` evidence). D005 host qualification (not yet run). Approvals port owner composition. Lifecycle pause/approval-hold publication race (L1) and continuation/approval owners in prepared startup (L2). Physical task cleanup (L5). `STARTUP-COMPOSITION`. Frontend multi-run controls.

### 3.8 Effort: 6–9 engineer-weeks

Session owner refactor of the fragment composition: 1.5–2. Live-session relay (shared with the bridge): 1.5–2. Lease lifecycle control and gate integration: 1–1.5. Frontend viewer, controls and states: 1–2. Qualification on the D005 host: 1–1.5. Assumes the D005 host is qualified and activation is open (not counted).

### 3.9 UI needs and missing Figma frames

Needed: live viewer panel inside the browser workspace (desktop); "Take control" / "Hand back" controls; lease banner with timer; agent-paused state; reconnecting and lost-stream states; sign-in-needed prompt from the agent; takeover-unavailable notices (policy off, mobile). **Existing frame to revise:** `Browser workflow · Live browser viewer` (`1064:152347`), which today says "No live viewer or user takeover", and its row in `12.17` (`1064:152281`). **Missing:** viewer, lease controls and states. `Remote browser snapshot` (`1064:147996`) and `07.01 · Public browser activity` (`1064:143463`) are the nearest anchors. `State · Reconnecting` (`1064:149790`) may be reusable.

### 3.10 Owner questions

- **Q-T1** Approve interpretation B (live view plus exclusive lease), not co-control.
- **Q-T2** Approve the browser session owner composition, which replaces the spawned MCP CLI with `createConnection` in a Meri process, still Playwright 0.0.83. Also approve Playwright screencast instead of VNC/WebRTC.
- **Q-T3** Who may view or take over: only the conversation owner (recommended), or also tenant admins?
- **Q-T4** No frame recording, receipts only (recommended)? Or record takeover video for audit, with a retention class?
- **Q-T5** Lease idle timeout (proposed 10 minutes) and whether hand-back auto-resumes the run (proposed: the user chooses "Resume").
- **Q-T6** Confirm v1 exclusions: clipboard, device uploads, audio, mobile.

---

## 4. Feature 3: Full in-browser Office editor

### 4.1 Interpretations (owner chooses)

| Interpretation | Meaning | Assessment |
| --- | --- | --- |
| **A. Full WYSIWYG Office editing (recommended)** | Users open a Meri DOCX/XLSX/PPTX version in a browser editor with Office-class fidelity (styles, tables, formulas, slides), edit it, and save it as a new immutable version. | Matches "full in-browser Office editor". Requires a server-side editor engine. |
| B. Lightweight editors | A rich-text editor for documents and a grid for spreadsheets, exporting OOXML. | Lossy round-trip. Three different components. Not "full". |
| C. Desktop round-trip | Download, edit in desktop Office, upload as a new version. | Not in-browser. Useful as a fallback only. |
| D. Microsoft 365 for the web | Microsoft's editors through WOPI. | Requires the Cloud Storage Partner Program (aimed at cloud-storage vendors; co-authoring required), documents processed by Microsoft, and users with M365 licences ([CSPP overview](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/overview)). Eligibility and timing are unlikely for the first shipment. |

**Scope boundary (A):** DOCX, XLSX and PPTX versions that Meri created or ingested, in the user's authorized scope. **Each save creates a new version through the artifact owner. Originals are never mutated.** Single editor per edit session in v1 (no real-time co-editing). PDF remains preview-only (Q-O4). Macros are disabled. External links and data connections are disabled. Native generation, natural-language revision, preview and download stay as they are, and editor output joins the same version chain. Desktop only (editor mobile UIs are an edition feature and mobile is deferred).

### 4.2 Architecture and placement

```
Frontend (capiro-frontend): editor iframe (CSP frame-src = editor origin only) ── postMessage (save/close states)
      │ WOPISrc + access_token (short-lived, per edit session)
      ▼
Editor host (new isolated host class): one disposable Collabora Online (coolwsd) container per edit session
      │ WOPI calls (CheckFileInfo, GetFile, PutFile, Lock/RefreshLock/Unlock) — only to the WOPI host
      ▼
Control: WOPI host module of the artifact owner (proposed apps/runtime/artifacts/wopi/ + apps/artifacts/edit-sessions/)
      └─ reuses canonical inspect/download authorization, suppression generation, structural inspection, CAS head, revise path
```

- **Edit session** (new record, owner = artifact service): (tenant, actor, conversation, baseVersionId, editor instance, expiry). Opening one needs current `artifact.inspect` **and** `artifact.revise` authorization for that exact version. Otherwise the editor opens read-only (`UserCanWrite:false`) or is refused.
- **GetFile** runs the same ordered authorization as the signed download links (inspect → suppression generation → download → hash → current authority → final generation) and streams exactly the version bytes.
- **PutFile** writes nothing in place. It calls the existing create/revise owner with `operation:'edit'`, provenance `user-edit` (actor, edit session, base version), CAS on the expected head, structural inspection (`file-structure.mjs`: strict ZIP/OPC, no macros), and the native qualification pipeline before the version is shown as published. A CAS conflict (Meri revised the file meanwhile) is refused as `WOPI_CONFLICT` and the UI offers "save as a branch from v{n}" (Q-O6).
- **Locks:** WOPI lock state lives in the edit-session store with expiry (WOPI's 30-minute lock semantics). It is not the artifact head lock.
- **Editor container:** started per edit session from a pinned, scanned image. Egress only to the WOPI host endpoint (no internet, no metadata). Read-only root. Non-root. Destroyed with verified cleanup on close or expiry. Coolwsd's jail/namespace requirements decide whether it can run on Fargate or needs the isolated host class (qualification item). No document data is persisted outside the artifact store.
- **Original skills only:** the editor is a separate product component. Meri's Office generation and revision skills stay original. No restrictive Office skill implementation is copied.

### 4.3 Upstream options

| Option | Fidelity / features | License and service constraints | Deployment shape | Verdict |
| --- | --- | --- | --- | --- |
| **Collabora Online (recommended)** | LibreOffice core. Good DOCX/XLSX/PPTX support, but complex Word/Excel features can lose fidelity (the deployment plan already notes "LibreOffice recalculation is not universal Excel equivalence"). | Server MPL-2.0 ([COPYING](https://github.com/CollaboraOnline/online/blob/master/COPYING)); client historically BSD-2 ([LWN](https://lwn.net/Articles/692871/)). File-level copyleft means only modified MPL files must be shared. **CODE** is a rolling development edition, "not recommended for business or production", and shows a 10 documents / 20 connections limit ([Collabora FAQ](https://www.collaboraonline.com/faqs/); [Nextcloud forum](https://help.nextcloud.com/t/collabora-document-limitation-by-purpose-10docs-20connections/4425)). Production means a per-user **Collabora Online subscription** (SLA, LTS, security updates) or a self-build with no vendor support. | `coolwsd` container. Standard **WOPI** integration ([Collabora FAQ](https://www.collaboraonline.com/faqs/)). Uses its own jails/namespaces. | Weak copyleft. A standard protocol (WOPI) keeps the editor replaceable. Consistent with LibreOffice already in the worker image. |
| ONLYOFFICE Docs | Native OOXML model. Usually the best MS Office layout fidelity among open-source editors. | Community: **AGPL-3.0 with §7 additional terms**: retain notices and attribution, show legal notices in the UI identifying ONLYOFFICE, no trademark rights ([LICENSE](https://github.com/ONLYOFFICE/DocumentServer/blob/master/LICENSE); [README editions table](https://github.com/ONLYOFFICE/DocumentServer/blob/master/Readme.md)). Community lacks mobile web editors and white-labelling. Older documentation states a 20 simultaneous editing connections limit ([Help Center FAQ](https://helpcenter.onlyoffice.com/docs/faq/docs-community.aspx)); 2026 press reports say 9.4 removed it (**unverified against official release notes**). The §7 terms are publicly disputed in the Euro-Office fork controversy ([The Register](https://www.theregister.com/2026/04/02/eurooffice_forks_onlyoffice/); [It's FOSS](https://itsfoss.com/news/onlyoffice-forked/)). Enterprise/Developer editions are proprietary. | Document Server container plus its own PostgreSQL/Redis/RabbitMQ. JS editor API with JWT and callback-URL save. WOPI also supported. | Fallback if Collabora fails the fidelity gate. Prefer the **Developer Edition** (commercial) to avoid AGPL/§7 obligations in a SaaS product. Needs legal sign-off. |
| Microsoft 365 for the web | Best fidelity. | Partner programme eligibility; Microsoft processes the data; per-user M365 licences ([CSPP](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online)). | Microsoft-hosted. WOPI host on our side. | Not viable for the first shipment. |
| Univer | Canvas sheets/docs/slides SDK. | Core Apache-2.0 ([LICENSE](https://github.com/dream-num/univer/blob/main/LICENSE)). **OOXML import/export is a Pro (commercial) server feature**; without a licence it adds watermarks and caps imports at 1 MB and exports at 10k cells ([Univer import/export docs](https://docs.univer.ai/guides/sheets/features/import-export)). | Browser SDK plus exchange server. | Not "full Office" without a commercial licence. Lossy for DOCX/PPTX. |
| SuperDoc / Tiptap / CKEditor 5 | DOCX-centric rich-text editors. | SuperDoc AGPL-3.0 or commercial ([README](https://cdn.jsdelivr.net/npm/superdoc@1.45.0/README.md)). Tiptap core MIT but DOCX import/export is paid. CKEditor 5 GPL-2.0+ or commercial. | Browser libraries. | DOCX only. Would need separate sheet and slide editors. Not recommended. |

Recommendation: **Collabora Online through WOPI, with a production subscription.** Gate it on a held-out fidelity corpus (section 4.6). If it fails the gate, switch to **ONLYOFFICE Developer Edition** behind the same WOPI host (ONLYOFFICE also speaks WOPI), so the artifact-side design is unchanged.

### 4.4 Authority, approval, isolation, custody, revocation, audit

- **Authority:** current authorization is checked at session open, on every WOPI call (`GetFile`/`PutFile`/`Lock`) and at publish. A revoked actor or suppressed version fails the next WOPI call. Retention suppression revokes edit sessions through the suppression generation, exactly as it revokes download links.
- **Approval:** a user's own edit that creates a new version in their own conversation is not a consequential external action. It needs no approval, matching natural-language revision. Filing an edited version to a client destination still uses the existing `artifact.file` approval.
- **Isolation:** one editor container per edit session (Q-O3), never shared across tenants or conversations, egress only to the WOPI host, destroyed on close. This applies the per-conversation host rule to the editor class.
- **Credential custody:** the WOPI `access_token` is HMAC-signed by control, lasts 10 minutes or less (renewed through the edit session), is bound to (session, actor, version), and is never logged (same redaction rules as download links). The editor container holds no database, S3 or provider credentials.
- **Audit:** edit-session open/close receipts, each `PutFile` with the new version ID and checksum, conflicts and refusals.

### 4.5 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Editor engine is a large, complex attack surface (document parsers) | Disposable per-session container. Non-root. Read-only root. Egress only to the WOPI host. Image scan must have zero HIGH/CRITICAL. Macros and external links disabled. |
| Silent fidelity loss on save | Fidelity corpus gate. Every save is a new version, so the original is always recoverable. Structural plus native inspection before publish. Unsupported features disclosed, as the plan requires. |
| Licensing (AGPL/§7, CODE limits) | Collabora subscription or ONLYOFFICE Developer Edition. Licence record in `docs/COMPONENTS.md`. Legal review. |
| Concurrent Meri revision during an edit | CAS head refusal plus a branch option. No last-writer-wins. |
| Token leakage through the iframe | POST-form token delivery (WOPI standard). No tokens in URLs or logs. Short expiry. Strict CSP and `frame-ancestors`. |
| Cost/capacity of per-session containers | Measure cold start. Allow a warm pool of **fresh, unassigned** containers only, the same rule as conversation workers. |

### 4.6 Qualification / acceptance tests

1. Fidelity corpus: at least 30 held-out DOCX/XLSX/PPTX files (Meri-generated plus representative client-style files). Open → no-op save → compare: 100% open, zero corruption, formulas and references preserved, no critical layout loss on rendered pages. Human review at the `ARTIFACT-NATIVE` bar.
2. WOPI conformance: Microsoft's WOPI validator suite or the vendor's test suite against the WOPI host.
3. Authority: read-only fallback without revise permission; revocation, suppression and session expiry block the next `GetFile`/`PutFile`; cross-tenant WOPISrc refused.
4. Immutability: a `PutFile` produces a new version with `user-edit` provenance; the original bytes are unchanged; a CAS conflict is refused.
5. Isolation: the editor container cannot reach the internet, metadata, other sessions or the database; it is destroyed with verified cleanup; it runs non-root with a read-only root.
6. Security: macro-bearing and external-link files open with macros and links disabled; a malformed-file corpus does not escape the container.
7. Frontend: iframe CSP; save/close/discard states; focus and keyboard access.

### 4.7 Dependencies on HOLD items

`ARTIFACT-ADMISSION` (PPTX overlap DA-3; PDF revision DA-2 if PDF is ever editable). `ARTIFACT-NATIVE` (renderer sandbox, real storage/KMS). Artifact options owner composed in startup. Download-link final-read race (P1b) and the uncertain-liability release HOLD. Retention suppression owner (DA-1/DA-4) for revocation. Image scan HIGH/CRITICAL admission. A new placement approval for the editor host class. Not blocked by the browser activation hold.

### 4.8 Effort: 9–14 engineer-weeks, plus procurement

WOPI host, edit sessions, versioning and locks: 3–4. Editor host packaging, hardening, per-session lifecycle and egress: 3–4. Frontend embed and states: 1.5–2. Fidelity corpus, WOPI conformance and security qualification: 1.5–3. Excludes subscription procurement, legal review and the shipping owner's cloud work.

### 4.9 UI needs and missing Figma frames

Needed: "Edit" entry on an exact artifact version; editor workspace (document, spreadsheet, presentation); saving/saved-as-v{n} states; conflict ("Meri saved v{n} while you were editing") with branch/discard; read-only fallback; lock-held and session-expired/revoked notices; exit with unsaved changes. **Existing frames:** `03.02 · Word document workspace` (`1064:143350`), `Document overlay · Editing mode` (`1064:150609`), `Notice · Office previews are read-only` (`1064:151439`, to revise), `03.04 · Spreadsheet preview` (`1064:143357`), `03.05 · Presentation preview` (`1064:143360`). **Missing:** spreadsheet and presentation editing modes, every save/conflict/lock/expiry state, and the exit confirm. The editor's own toolbar is the vendor UI. Figma only needs to define the frame around it.

### 4.10 Owner questions

- **Q-O1** Approve interpretation A (full WYSIWYG, new version per save, originals immutable).
- **Q-O2** Editor product: **Collabora Online with a subscription** (recommended), ONLYOFFICE Developer Edition, or ONLYOFFICE Community under AGPL-3.0 + §7 terms (needs legal sign-off)? Approve the subscription budget.
- **Q-O3** Placement: a new isolated **editor host class** with one disposable container per edit session (recommended)? Or a per-tenant editor pool (cheaper, weaker isolation)?
- **Q-O4** Is PDF editing in scope? Recommendation: no, preview-only.
- **Q-O5** Single editor per session in v1 (recommended)? Or real-time co-editing among authorized actors?
- **Q-O6** On conflict with a Meri revision: refuse and offer a branch (recommended), or allow overwrite of the head with confirmation?
- **Q-O7** Should edited versions need any review before filing beyond the existing filing approval? Recommendation: no.
- **Q-O8** Confirm mobile editing is excluded from the first shipment.

---

## 5. Feature 4: Authenticated third-party website workflows

### 5.1 Definition and scope boundary

A **site workflow** is (named website, named workflow, version). An example is "sign in to research portal X and download the filings list". It runs in the conversation's isolated browser on the D005 host, against an account the user (or, later, Capiro) holds. Each site workflow is approved by Capiro's platform owner, reviewed for terms-of-service compatibility, qualified individually and enabled per tenant. **This is separate from authenticated Meri chat (Clerk), which is unaffected.** It is also separate from OAuth/API connectors in the gateway, which remain preferred whenever the site offers an API. Figma already reflects the intent: `07.02 · Site connection and sign-in` (`1064:143466`), `07.02A · Research account connected` (`3024:32266`), and `12.17` "Signed-in websites · Qualification pending per site".

### 5.2 Credential custody interpretations (owner chooses)

| Model | Meaning | Assessment |
| --- | --- | --- |
| **C1. User signs in live through takeover (recommended for the first shipment)** | The agent reaches the sign-in page and asks the user to take control. The user types credentials and MFA. Cookies exist only in the conversation-bound profile and are disposed with it. | Meri never sees or stores credentials. No new credential store. Fits "no new credentials" and per-conversation disposal. Cost: the user signs in again in each conversation. |
| C2. Per-user encrypted session vault | After sign-in, control stores the site's storage state, encrypted with a per-tenant KMS key, and injects it into later conversations' fresh profiles (`--storage-state`/`contextOptions`). | Better UX. It carries session state across conversations: the host is not reused, but the identity is. It needs a new secret class, a retention class and revocation. A later, separately approved step (Q-A3). |
| C3. Capiro- or tenant-managed service accounts | Credentials in a secrets manager, filled by a trusted component, never by the model. | New shared credentials and higher ToS risk. Not for the first shipment. |
| C4. API/OAuth connector instead | Gateway connector. | Preferred when available. It is a different feature (source connectivity). |

### 5.3 Architecture and placement

- **Site workflow manifest** (platform configuration, owned by the platform owner beside the approved destination list; contract proposal for dot). It contains: `siteId`, `workflowId`, `version`; `origins` (including identity-provider origins needed for sign-in), all of which must be in the platform maximum; `signInUrl`; `signedInProbe` (a URL or selector that shows the session is active, evaluated by the session owner, not the model); allowed tools; **action classes** (which interactions are consequential and need approval; default: all interactions); download formats and limits; session TTL; `logoutUrl`; ToS review reference; qualification evidence reference. Tenant admins enable listed workflows and can narrow origins and actions, never widen.
- **Runtime:** when a run uses a site workflow, `resolveBrowserPolicy` intersects the conversation's effective policy with the manifest. The egress allowlist for that run becomes the manifest origins (bound and revoked with the run, as `effective-origin-allowlist` already requires). The agent navigates to `signInUrl`. If the probe says it is not signed in, the agent asks for takeover (feature 2). After hand-back, the probe confirms the session and the UI shows "connected". Consequential actions go through the existing approval gate with digest binding.
- **Disconnect:** the user's "Disconnect" (Figma `Overlay · Disconnect the research portal?` `3022:32509`) runs `context.clearCookies()` for the manifest origins, navigates to `logoutUrl` if one is defined, records a receipt, and marks the workflow disconnected. Conversation close runs `dispose` (profile removal) as today. Under C1, nothing survives the conversation.

### 5.4 Authority, approval, isolation, custody, revocation, audit

- **Authority:** the platform owner approves each manifest version. The tenant enables it. The role ceiling applies. The current actor is checked per call. Manifest version is pinned per run, and a manifest change takes effect at the next run.
- **Approval:** every interaction classified as consequential (submit, post, purchase, send, delete, change settings) needs a canonical approval for the exact input digest before it executes. Sign-in itself is a user action under takeover.
- **Isolation:** per-conversation host and profile. No profile reuse across conversations or tenants. Egress is restricted to the manifest origins for that run.
- **Custody:** C1 means none. Session cookies stay in the per-conversation profile. Receipts never contain cookies, tokens or credential text.
- **Revocation:** user disconnect, tenant disable, platform manifest withdrawal, membership removal and conversation close each end access within the 30 s target. A site-side session expiry shows `Notice · Sign-in expired` (`1064:148233`). A revoked grant shows `Notice · Connection revoked` (`1064:148237`).
- **Audit:** receipts carry `siteId/workflowId/version`, the signed-in probe result (boolean), each action with approval ID, downloads, and disconnect.

### 5.5 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Prompt injection on high-value authenticated pages | Manifest origin confinement. New tabs only to manifest origins. All interactions approved. No script-evaluation tools. Page content is untrusted. |
| Terms-of-service violation or account suspension | Per-site legal/ToS review before approval. Rate limits in the manifest. User-owned accounts only (C1). |
| Credential capture | Takeover secrets rules (section 3.4). No credential fields readable by the model. Password masking tested. |
| Cross-conversation session bleed | C1 disposal. Per-conversation host. Isolation test with two tenants and two conversations. |
| IdP redirects outside the allowlist break sign-in | IdP origins listed explicitly in the manifest and qualified. |
| Site changes break the workflow | Manifest versioning. A site-specific smoke test in qualification. Failure produces a closed "site unavailable" notice (`Notice · Site unavailable` `1064:148225`). |

### 5.6 Qualification / acceptance tests (per site workflow)

1. Sign-in through takeover, including MFA. The signed-in probe is correct. The session is absent from a second conversation and from a second tenant.
2. Egress is confined to the manifest origins, including IdP redirects. An unlisted origin is refused at host egress.
3. Each consequential action is blocked without approval and executes exactly once with a matching approval. Replay is refused.
4. Download through the existing ingest gate: formats, size and structure.
5. Disconnect, conversation close, membership removal and tenant disable each end access within the target. The profile is absent after dispose.
6. No credential, cookie or token text appears in the transcript, receipts, logs or telemetry.
7. A ToS review record and a named qualification evidence reference are stored in the manifest.

### 5.7 Dependencies on HOLD items

Feature 2 (takeover). Browser activation hold. D005 host qualification. Approvals port owner composition. Browser P1c HOLD findings (download limits/filename races, profile persistence). Platform destination list (Decision 3, initial list still open). Retention and deletion of the browser-state data class. `STARTUP-COMPOSITION`.

### 5.8 Effort: 5–8 engineer-weeks for the framework, plus 1–2 per named site workflow

Manifest contract and resolution: 1–1.5. Signed-in probe, disconnect and session lifecycle: 1–2. Approval-class wiring and receipts: 1–1.5. Frontend site connection states: 1–1.5. Framework qualification: 1–1.5. Each site workflow: 1–2 (manifest, ToS review support, qualification). The two-site assumption gives 7–12.

### 5.9 UI needs and missing Figma frames

Existing: `07.02` (`1064:143466`), `07.02A` (`3024:32266`), `07.04 · Browser connection states` (`1064:143472`), the disconnect overlays (`3022:32509`, `3022:32411`, `3022:32424`), the notices above, and `Browser workflow · Signed-in websites` (`1064:152337`). **Missing:** the "sign-in needed → take control" hand-off moment linking to takeover; a per-site workflow description and approval-class disclosure; tenant admin enablement of site workflows (Settings); and the C2 "remember sign-in" consent if C2 is ever approved.

### 5.10 Owner questions

- **Q-A1** Name the first site(s) and workflow(s) for the first shipment. The estimate assumes two.
- **Q-A2** Approve credential model **C1** (user signs in via takeover, nothing persisted) for the first shipment.
- **Q-A3** Should the C2 encrypted session vault be designed as a follow-up? It would carry sign-ins across conversations, with a new secret class and retention class.
- **Q-A4** Who performs the per-site terms-of-service review (Capiro legal)? Is it a hard prerequisite for manifest approval (recommended)?
- **Q-A5** Default action class: all interactions on authenticated sites need approval (recommended), or let the manifest pre-approve low-risk ones (for example, search-box typing)?
- **Q-A6** Approve site workflow manifests as platform configuration owned by Capiro's platform owner, alongside the destination list.
- **Q-A7** Confirm that sites offering an API should use a gateway connector instead of browser automation.

---

## 6. Cross-feature design

### 6.1 Browser activation hold

`activation.mjs` stays held until every `EGRESS_REQUIREMENTS` item has measured evidence on the D005 host. **Takeover and authenticated workflows cannot activate before that.** The session-owner composition changes the browser launch path, so the D005 sandbox evidence must be produced with that composition (re-run if it was produced earlier). Takeover adds one requirement to the host design, not to the egress list: the browser's network namespace must not reach the session owner's socket or the worker → control channel. Proposed text for a new requirement, `relay-path-separation`, goes to dot. The **device bridge** does not use the D005 host. It needs a separate activation record (proposed `BRIDGE_ACTIVATION`) with its own evidence (section 2.6) and the owner's trust-tier decision (Q-B1). The **Office editor** does not depend on browser activation. It needs its own host/placement admission.

### 6.2 Dedicated isolated browser host (D005)

D005 authorizes a new isolated host for the browser, with no privileged, no-sandbox or unconfined shortcuts. Fitting each feature to it:

- Takeover and authenticated workflows: on the D005 host, inside the per-conversation unit, with the session owner as the browser parent.
- Office editor: proposes a **sibling host class** (editor containers) qualified the same way: non-root, read-only root, no credentials, egress only to the WOPI host, verified cleanup. **This is a new placement and needs explicit owner approval (Q-O3, Q-X2).** If coolwsd runs within Fargate's constraints, Fargate is preferred and no new host class is needed. Qualification decides.
- Device bridge: no host. The relay runs in control (Fargate). The new worker instance of Playwright MCP runs where the conversation worker runs.

### 6.3 Per-conversation host lifecycle

| Resource | Bound to | Ends at |
| --- | --- | --- |
| Session owner, browser profile, screencast | Conversation (D005 unit) | `dispose` at conversation close or delete. Host destruction is the backstop. |
| Takeover lease, viewer ticket | Run + actor | Hand-back, idle timeout, cancel, revocation |
| Site sign-in session (C1) | Conversation profile | Disconnect or `dispose` |
| Editor container, WOPI token, lock | Edit session (actor + exact version) | Close, expiry, revocation |
| Device pairing | Actor + device (outlives conversations) | Unpair, admin disable, membership removal |
| Device attachment | Conversation run | Run end, detach, revocation |

Nothing in these features is reused across conversations or tenants. The only resource that outlives a conversation is the device pairing, which holds a public key and metadata only and grants nothing without a fresh per-conversation attachment.

### 6.4 Mobile deferral

Mobile stays deferred relative to desktop (ledger row "Mobile"). Recommendation for all four features in the first shipment: desktop only. Phone and tablet show closed "continue on desktop" notices. Takeover live view (watch-only) on tablet is a possible later extension. ONLYOFFICE Community lacks mobile web editors anyway. Figma has phone and tablet browser/artifact frames (`10.24 · Phone browser activity` `3032:31526`, `10.06 · Mobile artifact` `1064:143537`). They need "unavailable on this device" variants for these features (Q-X3).

### 6.5 Shared components and ownership (proposed)

| Component | Owner | Used by |
| --- | --- | --- |
| Browser session owner | Worker browser module (`apps/worker/conversation/browser/session/`) | 2, 4 |
| Live-session relay | Control (`apps/control/live-session/`) | 1, 2 |
| Device pairing | Control (`apps/control/device-pairing/`) | 1 |
| WOPI host and edit sessions | Artifact owner (`apps/runtime/artifacts/wopi/`, `apps/artifacts/edit-sessions/`) | 3 |
| Site workflow manifests | Platform configuration + `resolution.mjs` | 4 (and 1 for origins) |
| Approvals port | Canonical approval owner (`apps/control/commands`) through the browser approvals port | 1, 2 (agent side), 4 |
| Receipts | `receipts.mjs` (extended) | all |
| Frontend surfaces | capiro-frontend (D014): viewer, pairing, editor frame, site states | all |

### 6.6 Recommended build order

0. **Prerequisites (not estimated here; existing HOLD work):** approvals owner composition and lifecycle L1/L2; `STARTUP-COMPOSITION`; D005 host qualification with real browser and renderer sandbox; browser activation evidence; P1c browser HOLD fixes; frontend multi-run controls; artifact native admission (for 3).
1. **Live takeover:** session owner, relay and lease. It is the foundation for sign-in and the riskiest host change, so it should land first.
2. **Authenticated workflows:** framework plus the first named site, using takeover for sign-in (C1).
3. **Office editor:** a parallel track from the start, because it is independent of the browser. It is gated on procurement and editor host placement approval.
4. **Device bridge:** last. It reuses the relay, has the most novel trust model, and depends on distribution decisions.

With three engineers after the prerequisites: roughly 12–16 calendar weeks. Single-threaded: 30–47 engineer-weeks.

### 6.7 Effort summary

| Feature | Engineer-weeks | Assumptions |
| --- | --- | --- |
| Live takeover | 6–9 | Relay counted here. D005 qualified and activation open. |
| Authenticated workflows | 7–12 | 5–8 framework + two site workflows at 1–2 each |
| Office editor | 9–14 | Collabora via WOPI. Excludes procurement, legal and cloud setup. |
| Device bridge | 8–12 | Relay already built (else +1). Excludes store/enterprise rollout lead time. |
| **Total** | **30–47** | Excludes all prerequisite HOLD work, new credentials and cloud actions (shipping owner) |

### 6.8 Biggest risks across the four

1. **Authenticated sessions plus prompt injection** (features 1 and 4). The agent operates where a user is signed in. Mitigated by origin confinement, approval of every interaction, no cookie/script tools and read-only defaults. This remains the highest residual risk.
2. **The device bridge leaves infrastructure egress control.** It needs explicit owner acceptance of a software-enforced trust tier.
3. **Editor licensing and fidelity.** AGPL/§7 terms (ONLYOFFICE) or subscription cost and LibreOffice-level fidelity (Collabora). There is a hard fidelity gate.
4. **Secrets typed during takeover** must never reach the model or logs. This depends on upstream snapshot masking and must be tested.
5. **Schedule risk from prerequisites:** D005 host qualification and browser activation are not yet run and block features 2 and 4.

### 6.9 Cross-feature owner questions

- **Q-X1** Approve the build order: takeover → authenticated workflows; the editor in parallel; the bridge last.
- **Q-X2** Approve the new placements: the live-session relay and device pairing in control; the browser session owner on the D005 host; an editor host class (or Fargate if it qualifies).
- **Q-X3** Confirm all four features are desktop-only for the first shipment.
- **Q-X4** Approve adding the new components to `docs/COMPONENTS.md` once chosen: Collabora Online (or ONLYOFFICE edition) and the adapted Playwright Extension source, with versions and licences.
- **Q-X5** Confirm the Figma file for these frames (`IXJzJUkXcUTkySHir5JNea`, versus `Zc2dEN5aLU47dVdsewDmiJ` in the repository's UI ledgers), and that dot/frontend own adding the missing frames listed in sections 2.9, 3.9, 4.9 and 5.9.

## 7. Evidence and limits

- Repository facts come from the base tree: the browser module, artifact READMEs, ledger rows, DECISIONS D005/D014, the deployment plan, the capability scope and the audit's "End-goal scope accounting" (`origin/dot/meri-comprehensive-audit-20261015`, `meri-audit-product-integration.md`).
- The Playwright API facts were read from the installed pinned package's type declarations and bundled sources in a local worktree. They have not been exercised.
- Figma facts come from layer metadata of file `IXJzJUkXcUTkySHir5JNea` (frame and layer names only; long text layers are truncated in the metadata). Design note frame `3043:34159` ("Meri 3.4 handoff decisions · 15 October 2026") was not readable in full and should be reconciled by dot.
- Licence statements cite upstream licence files where they were fetched (ONLYOFFICE `LICENSE` §7 terms and README editions table; Collabora `COPYING`; noVNC, neko and Univer licences). Points marked "unverified" (the ONLYOFFICE 9.4 limit removal; current Collabora CODE limits) rest on secondary sources and need vendor confirmation before procurement. This is not legal advice. Capiro legal should review the editor and extension licences and each site's terms.
- No checks were run because no code changed.
