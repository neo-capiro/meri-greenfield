# Conversation browser capability

`createBrowserCapability({binding,cwd,policy,installation,sourceScopes,artifacts,receipts,approvals,now})` returns one composable fragment for the conversation's single Claude Agent SDK query. It never starts a second agent loop. Nothing is created or launched when the fragment is built.

## Product direction and what it changes

Recorded direction ([dot review of p1c, section "Subsequent explicit product direction — 18:39 UTC"](../../../../docs/coordination/reports/DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md), commit `7606375d`):

> Neo directs that the **browser capability be enabled by default as the desired product behavior**. … This is separate from **network destinations being denied by default** and **pre-execution controls for consequential actions**.

The same record says the direction does not accept the p1c defects, authorize live infrastructure activation or credentials, waive security/host/egress qualification, or let consequential actions bypass their controls. This source therefore changes the earlier "disabled by default" posture as follows:

| Concern | Before (p1c `e0f94fe`) | Now |
| --- | --- | --- |
| Capability default | Disabled (`{enabled:false}`) | **Enabled** (`DEFAULT_BROWSER_POLICY`), subject to platform maximum, tenant-admin settings and role (`resolution.mjs`) |
| Destinations | Mandatory explicit HTTPS origin list per policy | **Denied by default.** Only origins on `allowedOrigins` open. The source default list is empty. Capiro supplies its approved origins as trusted platform configuration; tenant admins may narrow them or enable approved origins the default left out, never widen beyond the approved set. An empty effective list keeps the capability on with no destination, and `status` says `destinations:'none'` with notice `BROWSER_NO_ALLOWED_DESTINATIONS`. |
| Platform security limits | HTTPS syntax only | Unremovable denials on top of any list (`public-web.mjs`): non-public IPv4 ranges (0/8, 10/8, 100.64/10, 127/8, 169.254/16 including cloud metadata, 172.16/12, 192.0.0/24, 192.0.2/24, 192.88.99/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, multicast 224/4, reserved 240/4); IPv6 outside 2000::/3 (loopback, unspecified, IPv4-mapped, NAT64, unique-local including `fd00:ec2::254`, link-local, multicast) or inside 2001::/23, 2001:db8::/32, 2002::/16, 3fff::/20, 5f00::/16; single-label and special-use/internal names (`localhost`, `.local`, `.internal`, `.arpa`, `.test`, `.onion` and similar); every scheme except http/https (plus `about:blank` for navigation); credentials in URLs. No tenant, role or platform record can approve such an origin (`BROWSER_PLATFORM_LIMIT`). |
| Consequential actions | Pre-approved in `allowedTools`; only a PostToolUse receipt | **Decided before execution** (`permissions.mjs`) |
| Activation | Default disabled, uncomposed | **Held** (`activation.mjs`) until real egress controls are qualified; no argument opens it |

## Fragment contents (once activation opens)

- `mcpServers.meri_browser` is a stdio configuration for Playwright MCP 0.0.83, the integration pinned in `docs/COMPONENTS.md`. It runs headless Chromium with explicit `--sandbox`, a per-conversation `--user-data-dir` and `--output-dir` under `<cwd>/.browser/` (`cwd` must end in the bound conversation ID), `--block-service-workers` and `--no-webmcp`. Upstream treats an empty `--allowed-origins` as "allow all". So `--allowed-origins` always carries the effective allowlist, or the single reserved origin `https://no-destination.invalid` when the list is empty. `--blocked-origins` carries the platform loopback and metadata entries (`PLATFORM_BLOCKED_ORIGINS`), which upstream evaluates first. Both flags were read from the installed 0.0.83 package (`originOrHostGlob`/`_setupRequestInterception` in `playwright-core` 1.64.0-alpha-1790635538000). Each entry becomes a context route glob: an exact origin, `scheme://host:*` for any port, or a bare host on default ports. They cannot express address ranges, do not affect redirects, and are **not a security boundary** (upstream README). The environment is limited to `PLAYWRIGHT_BROWSERS_PATH` and a workspace-local `HOME`. No storage state, secrets file, extension, CDP endpoint, `--caps` or config file is passed.
- `allowedTools` pre-approves only the policy's non-interaction tools: navigate, back, snapshot, wait, screenshot, tabs and close. The interaction tools (`INTERACTION_TOOLS`: click, type, fill form, select option, press key, hover, dialog) are never listed. `disallowedTools` removes from the model context the core tools upstream exposes by default that Meri never admits (evaluate, run-code, file upload, console/network inspection, drag/drop, resize, find, media emulation), plus any bounded tool the policy narrowed away.
- `hooks.PreToolUse` runs for every call, including pre-approved ones. It denies unadmitted tools and any navigation or new tab whose URL fails the effective policy. For an interaction tool it returns `ask`, which forces the SDK permission flow even if another rule would pre-approve the tool. With no permission surface an `ask` is terminal.
- `canUseTool` (composable: it returns `undefined` for other servers' tools) re-checks admission and URL. For an interaction tool it calls `approvals.decide({schema:'meri-browser-approval-request/1',binding,toolUseId,action,input},{signal})` and allows only `{decision:'approve',toolUseId}` for that exact call. A missing port, error, abort, oversized input or any other answer denies.
- `hooks.PostToolUse` records one content-free `meri-browser-receipt/1` per executed browser call: action, page URL host, injected clock time, a workspace-relative screenshot or trace reference, and outcome. It cannot authorize or undo an action. A failed receipt stops the run.
- `downloads.accept({filename,url})` moves a file out of the output directory only through `artifacts.ingest`. A slot and the filename are claimed synchronously before any asynchronous work, so concurrent calls cannot exceed `maxFiles` or ingest one file twice. A refusal before ingest releases the slot. Once ingest has been attempted, the claim stays, because an unknown artifact outcome is not treated as "not ingested". The checks are, in order:
  - the source URL against the same effective destination policy;
  - the extension against the policy formats;
  - structural validity through the artifact owner's `apps/artifacts/structure/file-structure.mjs`: verified ZIP central directory, local headers and CRC-32; an OPC package with the claimed OOXML main part and no macros; a PDF with a cross-reference trailer; strict UTF-8 text;
  - size, plain-file and no-symlink rules;
  - the returned checksum.

  Native open/render in Office or a PDF reader is **UNRUN**. The file goes out with the canonical MIME type and the trusted same-tenant `sourceScopes`, and a download receipt is recorded.
- `status` is the UI-facing state: `{capability, destinations, allowedOriginCount, notice?, activation}`.
- `dispose({signal})` removes `.browser/profile`, `home` and `output`, verifies their absence, and refuses a symlinked browser root.

Trusted runtime facts, never policy: `installation` (absolute node, CLI and browser paths plus the exact version `0.0.83`) and `sourceScopes` (same tenant, required when downloads are on).

## Profile retention

The `--user-data-dir` profile is persistent for the life of the conversation. Cookies, local and session storage, IndexedDB, cache and any site session established during the conversation remain there between browser calls and runs of that conversation until `dispose` runs. Nothing is pre-loaded, but the profile is not credential-free once a page sets cookies. The conversation lifecycle owner must call `dispose` after the MCP process exits, when the conversation closes or is deleted. The D005 per-conversation host destruction is the backstop. Screenshot and trace references in receipts are valid only until disposal.

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
- cancellation, restart or revocation;
- native file usability;
- live SDK permission delivery. The permission tests use a scripted model of the documented SDK order.

Remaining work:

1. Qualify the egress requirement in `activation.mjs` (`EGRESS_REQUIREMENTS`) and the D005 host (`docs/qualification/G1-REMAINING-WORK.md`) with real browser and renderer sandbox evidence. Then open the gate by a reviewed source change that cites that evidence.
2. Have the owner of `options.mjs`/`activity.mjs` compose this fragment into the single query. The composition must keep `permissionMode:'default'` and chain `canUseTool`. Today `options.mjs` admits only `meri_original_reads`.
3. Add `@playwright/mcp` 0.0.83 to the conversation worker package and lockfile through the lockfile owner.
4. Add an artifact ingest operation for externally sourced files to the artifact owner.
5. Add an approvals port owner (control/UI) and decide the source of the platform approved-origin configuration, tenant browser settings and role ceilings (proposal in the lane report).
6. Authenticated workflows and uploads stay out of scope and qualify individually.

Tests (`node --test apps/worker/conversation/browser/test/*.test.mjs apps/artifacts/structure/test/*.test.mjs`) use scripted MCP configuration, scripted ports and a scripted SDK permission order. No browser, MCP or SDK process is launched.
