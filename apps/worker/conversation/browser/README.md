# Conversation browser capability

`createBrowserCapability({binding,cwd,policy,installation,sourceScopes,artifacts,receipts,approvals,now})` returns one composable fragment for the conversation's single Claude Agent SDK query. It never starts a second agent loop. Nothing is created or launched when the fragment is built.

The activity reaches it through `prepareBrowserRun` (`runtime.mjs`) when a trusted browser runtime port is configured, and `options.mjs` composes it last through `composeBrowserOptions` (`options.mjs` in this directory). While activation is held the fragment contributes nothing, but the run's browser cleanup still runs on every outcome. [ACTIVATION-CHECKLIST.md](ACTIVATION-CHECKLIST.md) lists every measurement that must be recorded on the approved host before the hold can open.

## Modules

| Module | Responsibility |
| --- | --- |
| `index.mjs` | Public entry: validates trusted context, applies the held activation gate |
| `policy.mjs`, `resolution.mjs`, `public-web.mjs` | Policy shape, platform ∧ tenant ∧ role resolution, unremovable platform limits |
| `egress.mjs` | Pure reference decision for every connection kind |
| `egress-control.mjs`, `egress-proxy.mjs` | Run-bound grant (worker) and the enforceable admission the host proxy runs: allowlist, web ports, every resolved address public, pinned connect address, revocation and expiry; mapping of forward-proxy requests |
| `../egress/proxy-server.mjs` | The socket-level proxy that serves a run's control on loopback (`startEgressProxy`): CONNECT, absolute-form and upgrade requests, dial only the checked address, no redirect following, revocation closes open tunnels. Shared with networked Bash (`../egress/bash-egress.mjs`) |
| `server.mjs` | Playwright MCP 0.0.83 stdio configuration, including `--proxy-server` to the host control |
| `permissions.mjs`, `approval-binding.mjs`, `page-context.mjs` | Pre-execution gate; canonical approval subject, receipt correlation and replay ledger; page-origin tracking |
| `fragment.mjs` | Assembles the open fragment (module-internal, behind the gate) |
| `options.mjs` | Composition into the built SDK options with server-owned permission routing |
| `runtime.mjs`, `lifecycle.mjs`, `workspace.mjs` | Run preparation and egress grant; cleanup after process exit on every outcome; verified disposal |
| `downloads.mjs`, `receipts.mjs` | Download ingest through the artifact owner port; content-free receipts |

## Product direction and what it changes

Recorded direction ([dot review of p1c at commit `7606375d`, section "Subsequent explicit product direction — 18:39 UTC"](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md); the file is not in this branch's tree):

> Neo directs that the **browser capability be enabled by default as the desired product behavior**. … This is separate from **network destinations being denied by default** and **pre-execution controls for consequential actions**.

The same record says the direction does not accept the p1c defects, authorize live infrastructure activation or credentials, waive security/host/egress qualification, or let consequential actions bypass their controls. This source therefore changes the earlier "disabled by default" posture as follows:

| Concern | Before (p1c `e0f94fe`) | Now |
| --- | --- | --- |
| Capability default | Disabled (`{enabled:false}`) | **Enabled** (`DEFAULT_BROWSER_POLICY`), subject to platform maximum, tenant-admin settings and role (`resolution.mjs`) |
| Destinations | Mandatory explicit HTTPS origin list per policy | **Denied by default.** Only origins on `allowedOrigins` open. The source default list is empty. Capiro supplies its approved origins as trusted platform configuration; tenant admins may narrow them or enable approved origins the default left out, never widen beyond the approved set. An empty effective list keeps the capability on with no destination, and `status` says `destinations:'none'` with notice `BROWSER_NO_ALLOWED_DESTINATIONS`. |
| Platform security limits | HTTPS syntax only | Unremovable denials on top of any list (`public-web.mjs`): non-public IPv4 ranges (0/8, 10/8, 100.64/10, 127/8, 169.254/16 including cloud metadata, 172.16/12, 192.0.0/24, 192.0.2/24, 192.88.99/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, multicast 224/4, reserved 240/4); IPv6 outside 2000::/3 (loopback, unspecified, IPv4-mapped, NAT64, unique-local including `fd00:ec2::254`, link-local, multicast) or inside 2001::/23, 2001:db8::/32, 2002::/16, 3fff::/20, 5f00::/16; single-label and special-use/internal names (`localhost`, `.local`, `.internal`, `.arpa`, `.test`, `.onion` and similar); every scheme except http/https (plus `about:blank` for navigation); credentials in URLs. No tenant, role or platform record can approve such an origin (`BROWSER_PLATFORM_LIMIT`). |
| Consequential actions | Pre-approved in `allowedTools`; only a PostToolUse receipt | **Decided before execution** (`permissions.mjs`) |
| Activation | Default disabled, uncomposed | **Held** (`activation.mjs`) until real egress controls, including the mandatory effective origin allowlist at every hop, are qualified; no argument opens it |

## Fragment contents (once activation opens)

- `mcpServers.meri_browser` is a stdio configuration for Playwright MCP 0.0.83, the integration pinned in `docs/COMPONENTS.md`. It runs headless Chromium with explicit `--sandbox`, a per-conversation `--user-data-dir` and `--output-dir` under `<cwd>/.browser/` (`cwd` must end in the bound conversation ID), `--block-service-workers` and `--no-webmcp`. `--proxy-server` carries the dedicated host's egress-control endpoint (trusted installation fact `egressProxy`, `http://host:port`); no `--proxy-bypass` is passed, so Playwright 1.64 adds `<-loopback>` and loopback is proxied too (`shouldProxyLoopback`, read from the pinned playwright-core). The environment never sets `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK`. Upstream treats an empty `--allowed-origins` as "allow all". So `--allowed-origins` always carries the effective allowlist, or the single reserved origin `https://no-destination.invalid` when the list is empty. `--blocked-origins` carries the platform loopback and metadata entries (`PLATFORM_BLOCKED_ORIGINS`), which upstream evaluates first. Both flags were read from the installed 0.0.83 package (`originOrHostGlob`/`_setupRequestInterception` in `playwright-core` 1.64.0-alpha-1790635538000). Each entry becomes a context route glob: an exact origin, `scheme://host:*` for any port, or a bare host on default ports. They cannot express address ranges, do not affect redirects, and are **not a security boundary** (upstream README). The environment is limited to `PLAYWRIGHT_BROWSERS_PATH` and a workspace-local `HOME`. No storage state, secrets file, extension, CDP endpoint, `--caps` or config file is passed.
- `allowedTools` pre-approves only the policy's non-interaction tools: navigate, back, snapshot, wait, screenshot, tabs and close. The interaction tools (`INTERACTION_TOOLS`: click, type, fill form, select option, press key, hover, dialog) are never listed. `disallowedTools` removes from the model context the core tools upstream exposes by default that Meri never admits (evaluate, run-code, file upload, console/network inspection, drag/drop, resize, find, media emulation), plus any bounded tool the policy narrowed away.
- `hooks.PreToolUse` runs for every call, including pre-approved ones. It denies unadmitted tools and any navigation or new tab whose URL fails the effective policy, and registers an admitted call with the page tracker. For an interaction tool it returns `ask`, which forces the SDK permission flow even if another rule would pre-approve the tool. With no permission surface an `ask` is terminal.
- `canUseTool` (composable: it returns `undefined` for other servers' tools) re-checks admission and URL. For an interaction tool it binds the call to the canonical approval owner (`approval-binding.mjs`). The subject (`meri-browser-action/1`) is the full run binding (tenant, actor, conversation, run, attempt, worker, writer fence), server, tool, tool-use id, canonical SHA-256 of the exact input, the allowlisted origin of the page the call starts from and the effective policy digest. Its canonical digest `subjectSha256` takes the place of `commandSha256` in the canonical `ApprovalDecision`. The gate calls `approvals.decide({schema:'meri-browser-approval-request/3',subject,subjectSha256,input,requestedAtMs,expiresAtMs},{signal})` and allows only a `meri-browser-approval-receipt/1` carrying an `approved` `ApprovalDecision` for that subject digest, proposal and tool-use, by an approver of the same tenant, decided after the request and unexpired, with a consumption record. A run-local ledger refuses any reuse of a proposal, consumption or tool-use (`BROWSER_APPROVAL_REPLAY`). The allowed `updatedInput` is the digested copy. An unknown starting page (nothing observed yet, a failed or overlapping call, `about:blank`) denies `BROWSER_APPROVAL_PAGE_UNKNOWN`; a page outside the effective allowlist denies with its policy code. The port call is raced against the run's AbortSignal and a bounded deadline (`APPROVAL_DEADLINE_MS`: default 120 s, trusted runtime setting `approvalDeadlineMs` from 1 s to 15 min): expiry denies `BROWSER_APPROVAL_EXPIRED`, abort denies `BROWSER_APPROVAL_UNAVAILABLE`, the port's signal is aborted, and a late answer is ignored. A missing port, error, oversized input or any other answer denies. Approver authentication, current-authority checks, revocation and durable one-time consumption are the canonical owner's; the owner does not yet accept a browser subject (proposal in the lane report).
- `hooks.PostToolUse` records one content-free `meri-browser-receipt/1` per executed browser call: action, page URL host, injected clock time, a workspace-relative screenshot or trace reference, and outcome. It cannot authorize or undo an action. A failed receipt stops the run. A second PostToolUse hook and a PostToolUseFailure hook close the call in the page tracker.
- `downloads.accept({filename,url})` moves a file out of the output directory only through `artifacts.ingest`. The request carries `idempotencyKey` (canonical SHA-256 over tenant, conversation, run, filename and content digest, so a retried attempt of the run cannot add a second version) and provenance `source:{kind:'browser-download',origin,urlHost,acquiredAtMs,policySha256}`; the owner must echo the key. A slot and the filename are claimed synchronously before any asynchronous work, so concurrent calls cannot exceed `maxFiles` or ingest one file twice. A refusal before ingest releases the slot. Once ingest has been attempted, the claim stays, because an unknown artifact outcome is not treated as "not ingested". The checks are, in order:
  - the source URL against the egress rule for `download` connections;
  - the extension against the policy formats;
  - structural validity through the artifact owner's `apps/artifacts/structure/file-structure.mjs`: strict ZIP with local/central agreement, data descriptors, exact entry layout, CRC-32 of every member, bomb bounds and portable names; an OPC package whose parts are parsed by the namespace-aware `saxes` XML parser, with the claimed OOXML main part and no macros; a PDF with coherent cross-reference sections, trailer and catalog; strict UTF-8 text. A refusal carries the closed structural reason as `detail`;
  - size, plain-file and no-symlink rules;
  - the returned checksum.

  Native open/render in Office or a PDF reader is **UNRUN**. The file goes out with the canonical MIME type and the trusted same-tenant `sourceScopes`, and a download receipt is recorded.
- `status` is the UI-facing state: `{capability, destinations, allowedOriginCount, notice?, activation}`.
- `dispose({signal})` removes `.browser/profile`, `home` and `output`, verifies their absence, and refuses a symlinked browser root.
- `policySha256` is the canonical digest of the effective policy; the run's egress grant, approval subjects and download provenance all carry it.

Trusted runtime facts, never policy: `installation` (absolute node, CLI and browser paths plus the exact version `0.0.83`) and `sourceScopes` (same tenant, required when downloads are on).

## Run lifecycle and profile retention

Within one run the `--user-data-dir` profile holds cookies, local and session storage, IndexedDB, cache and any site session established by the run's browser calls. Nothing is pre-loaded, but the profile is not credential-free once a page sets cookies. `lifecycle.mjs` settles every run once, after the SDK query is closed, whatever its outcome (`ended` covers completed, paused and waiting-for-approval; `failed`; `cancelled`):

1. revoke the run's egress grant at the host control;
2. wait until the host confirms the Playwright MCP and browser processes have exited;
3. only then remove `profile`, `home` and `output` and verify their absence.

An unconfirmed exit leaves the profile in place and reports `BROWSER_CLEANUP_UNKNOWN` (the activity then fails with `SDK_CLEANUP_UNKNOWN`); the D005 per-conversation host destruction is the backstop. A held or disabled fragment launched nothing, so its cleanup only removes and verifies any stale browser state. Nothing persists across runs; keeping a site sign-in across runs (owner answer Q-A8) needs the authenticated-workflow design. Screenshot and trace references in receipts are valid only until cleanup.

## Policy resolution

`resolveBrowserPolicy({platform,tenant,role})` mirrors the SDK capability resolver (`capabilities/policy-resolution.mjs`, parallel lane):

- `platform = {maximum, defaults, roleCeilings}`. Its `maximum.allowedOrigins` is the platform-approved set.
- `tenant = {browser?, roles?:{[role]:partial}}`.
- Effective policy = maximum ∧ tenant settings ∧ role ceiling ∧ tenant role narrowing.
- Widening refuses with `BROWSER_TENANT_WIDENING_REFUSED` or `BROWSER_ROLE_WIDENING_REFUSED` plus `field`. Other codes: `BROWSER_ROLE_UNKNOWN`, `BROWSER_PLATFORM_LIMITS_REFUSED`, `BROWSER_TENANT_SETTINGS_REFUSED`, `BROWSER_PLATFORM_LIMIT`.
- `assertTenantBrowserSettings` gives an admin save the same refusals at write time.
- Allowlist order follows the platform list.

## Not qualified

No browser host is qualified, and activation is held. This fragment proves none of the following:

- the non-root browser or renderer sandbox;
- network egress controls;
- per-conversation host isolation;
- live SDK cancellation, restart or revocation (the approval deadline and abort completion are tested only against scripted ports);
- native file usability;
- live SDK permission delivery. The permission tests use a scripted model of the documented SDK order.
- that the host proxy runs `egress-control.mjs`, that every browser connection reaches it, or how Chromium reuses and coalesces connections;
- the format of real Playwright MCP 0.0.83 page reports (`- Page URL:`) that the page tracker relies on;
- host process-exit observation and live cleanup ordering;
- the canonical approval owner's handling of the browser subject (not yet implemented by that owner).

Remaining work:

1. Record every measurement in [ACTIVATION-CHECKLIST.md](ACTIVATION-CHECKLIST.md) on the approved D005 host, including each requirement in `activation.mjs` (`EGRESS_REQUIREMENTS`), with the host proxy running `egress-control.mjs`. Then open the gate by a reviewed source change that cites that evidence.
2. Composition into the single query is source-wired (`../options.mjs`, `../activity.mjs`) but inert while held; live SDK hook precedence and permission delivery remain unmeasured.
3. Add `@playwright/mcp` 0.0.83 to the conversation worker package and lockfile through the lockfile owner.
4. Add an artifact ingest operation for externally sourced files, honouring `idempotencyKey` and provenance, to the artifact owner.
5. Extend the canonical approval owner to accept the browser subject and consume a decision once (proposal in the lane report), add the trusted browser runtime port (policy source, host egress grant/revoke, process-exit observation), and decide the source of the platform approved-origin configuration, tenant browser settings and role ceilings.
6. Authenticated workflows and uploads stay out of scope and qualify individually.

Tests (`node --test apps/worker/conversation/browser/test/*.test.mjs apps/artifacts/structure/test/*.test.mjs`, after `npm ci` at the repository root for `ajv`, `ajv-formats`, `canonicalize` and `saxes`; the activity composition case is `apps/worker/conversation/test/activity-browser.test.mjs`) use scripted MCP configuration, scripted ports, a scripted resolver and a scripted SDK permission order. No browser, MCP, proxy, DNS or SDK process is launched.
