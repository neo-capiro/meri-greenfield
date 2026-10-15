# Fable lane P2c: browser capability on by default, destinations denied by default (15 October 2026)

Branch `fable/p2c-browser-default-on-20261015`, base `e0f94fe` (p1c). Owned paths: `apps/worker/conversation/browser/**`, the new `apps/artifacts/structure/**`, `evals/promptfoo/graders/usable-file.mjs` and its test/README line, and this report. No contracts, lockfiles, migrations, credentials, network calls, builds, deployment or cloud actions. Node v24.21.0. Dependencies were symlinked from `/home/user/meri-fable-complete` only where the lockfile SHA-256 matched (root, `packages/contracts`, `packages/window-resolution`, `packages/ui-stream`, `apps/worker/conversation`, `apps/worker/qualification`, `apps/control/{conversations,qualification-temporal}`, `apps/runtime`, `apps/artifacts/storage`); the symlinks are untracked.

## Direction implemented

The brief changed twice while this lane ran. The final binding direction is the product owner's, recorded in commit `7606375d` ([`DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md`](DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md), section "Subsequent explicit product direction — 18:39 UTC"):

> Neo directs that the **browser capability be enabled by default as the desired product behavior**. … This is separate from **network destinations being denied by default** and **pre-execution controls for consequential actions**.

That record also states that the direction does not accept the p1c defects, authorize live infrastructure activation or credentials, waive security/host/egress qualification, or let consequential actions bypass their controls.

An interim brief said "public web browsing is allowed by default; no per-site allowlist". It was superseded by this direction, and that design was removed before commit. No default-allow-public code, `null` allowlist or tenant blocked-origin list remains.

dot's HOLD items for p1c (same record) are also in scope:

1. pre-execution approval;
2. atomic download claims;
3. structural, not signature, file validation;
4. activation held until real egress controls exist;
5. corrected profile retention.

## Implementation outline

Responsibilities and owners:

- The **Claude Agent SDK** owns the loop and permission flow. This lane supplies only SDK-native `allowedTools`, `disallowedTools`, `canUseTool` and `PreToolUse`/`PostToolUse` hooks.
- The **control owner (Core/dot)** owns the trusted platform record and the tenant-admin record, and supplies the user's server-side role and the approvals port. The worker resolves and enforces; it does not originate authority.
- The **artifact owner** owns structural file validation (`apps/artifacts/structure/`) and future ingest.
- The **browser host and infrastructure owner** owns the binding network boundary (egress), per D005.

Modules (`apps/worker/conversation/browser/`, all import-safe, no I/O on import):

| Module | Responsibility |
| --- | --- |
| `public-web.mjs` | Platform security limits. `classifyWebUrl`, `isPublicHost` and `isPublicOrigin` use Node `net.BlockList` over IANA special-purpose ranges, special-use name suffixes, and the scheme and credential rules. `PLATFORM_BLOCKED_ORIGINS` is the Playwright defence-in-depth list. Pure; no DNS. |
| `policy.mjs` | Policy vocabulary and validation. `DEFAULT_BROWSER_POLICY` is on, with every bounded tool and `allowedOrigins: []`. Also exports `validateBrowserPolicy`, `assertFullBrowserPolicy`, `checkBrowserUrl` (limits, then allowlist), `browserStatus` (UI state) and `INTERACTION_TOOLS`. |
| `resolution.mjs` | `resolveBrowserPolicy({platform,tenant,role})`, `assertPlatformBrowserLimits`, `assertTenantBrowserSettings`, `intersectBrowserPolicies` and `browserWideningField`. Shapes and codes mirror `capabilities/policy-resolution.mjs` on the parallel capability lane, which was read but not edited. |
| `permissions.mjs` | `createPermissionGate`. PreToolUse denies unadmitted tools and URLs that fail policy, and returns `ask` for interactions. `canUseTool` lets an interaction run only on an approval-port decision for the exact `toolUseID`. |
| `activation.mjs` | `BROWSER_ACTIVATION` (held), `EGRESS_REQUIREMENTS` and the pure `activationOpen`. No runtime input opens it. |
| `server.mjs` | `validateBrowserInstallation` (a trusted fact, moved out of policy) and the Playwright MCP 0.0.83 stdio config. |
| `workspace.mjs` | `browserPaths` and `disposeBrowserState`, which removes state and verifies absence. |
| `downloads.mjs` | The download port: synchronous slot and identity claim, policy source check, structural validation, ingest, receipt. `validateSourceScopes` is a trusted fact, moved out of policy. |
| `fragment.mjs` | `buildOpenBrowserFragment`: composition of the open path (module-internal). |
| `index.mjs` | `createBrowserCapability`: validates the context, then returns a disabled, held or open fragment. Each carries `status`. |
| `receipts.mjs` | Unchanged. |

`apps/artifacts/structure/file-structure.mjs` holds `structurallyValid` and `readZip`. It uses Node `zlib` `inflateRawSync` and `crc32` only. No dependency was added, because the conversation worker's lockfile is owned elsewhere and Node built-ins are upstream.

Dependency direction:

- `index → {policy, activation, workspace, fragment}`
- `fragment → {server, receipts, downloads, permissions, workspace, policy}`
- `downloads → {policy, artifacts/structure}`
- `policy → public-web`
- `resolution → policy`
- `evals/promptfoo/graders/usable-file → artifacts/structure`

There are no cycles.

Interface changes, all to unfrozen worker-internal modules with no callers outside this directory:

- `installation` and `sourceScopes` moved from the policy to trusted runtime arguments of `createBrowserCapability`. The resolved policy can then come from platform, tenant and role records that hold no paths or tenant scopes.
- The policy lost `installation` and `sourceScopes`. `allowedOrigins` became an always-present list that may be empty.
- New fragment keys: `disallowedTools`, `canUseTool`, `hooks.PreToolUse`, `status` and `dispose`.

## What changed

**Capability default.** It is now on (`DEFAULT_BROWSER_POLICY.enabled === true`). It was `{enabled:false}`. A tenant admin can still disable it (`{enabled:false}`), and roles narrow it.

**Destinations.** These are denied by default:

- Navigation (`browser_navigate`, `browser_tabs` new) and download sources must be on the effective `allowedOrigins`. These are exact canonical http/https public origins; trailing-dot hosts are normalized so they cannot bypass the list.
- The source list is empty, so out of the box nothing external opens. `status` is then `{capability:'enabled',destinations:'none',allowedOriginCount:0,notice:'BROWSER_NO_ALLOWED_DESTINATIONS'}`, and refusals carry `BROWSER_NO_ALLOWED_DESTINATIONS`.
- The platform-approved set is `platform.maximum.allowedOrigins`, supplied as trusted configuration. `platform.defaults.allowedOrigins` is the subset enabled for a tenant that has not chosen.
- Tenant admins may narrow the list, or enable approved origins the default left out. Anything outside the maximum refuses with `BROWSER_TENANT_WIDENING_REFUSED` (field `allowedOrigins`). Role ceilings intersect, and a tenant may only narrow a role ceiling (`BROWSER_ROLE_WIDENING_REFUSED`).
- Playwright receives `--allowed-origins` with the effective list. Because upstream treats an empty list as allow-all, an empty list is passed as the reserved origin `https://no-destination.invalid`.

**Platform security limits.** These are unremovable and apply before any list:

- every scheme except http/https, plus `about:blank` for navigation only. Refused examples: `file:`, `data:`, `javascript:`, `chrome:`, other `about:` pages, `view-source:`, `blob:`, `ws:`, `ftp:`;
- credentials in URLs;
- non-public IPv4 literals in any WHATWG-normalized form (decimal, hex, short): 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.88.99/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4;
- IPv6 outside 2000::/3, or inside 2001::/23, 2001:db8::/32, 2002::/16, 3fff::/20 or 5f00::/16;
- single-label names and the `localhost`, `local`, `localdomain`, `internal`, `intranet`, `private`, `corp`, `home`, `lan`, `arpa`, `test`, `invalid`, `onion` and `alt` suffixes.

An origin in any record, even the platform record, that violates these limits refuses with `BROWSER_PLATFORM_LIMIT`. As defence in depth, `--blocked-origins` lists localhost, 127.0.0.1, 0.0.0.0, 169.254.169.254, 169.254.170.2 and metadata.google.internal, each in bare, `http://h:*` and `https://h:*` form, plus `[::1]` and `[fd00:ec2::254]` on default ports. Semantics were read from the installed package (`playwright-core` `originOrHostGlob` and `_setupRequestInterception`): each entry is a context route glob, the blocklist is evaluated first, and neither list sees redirects or address ranges. Upstream says these flags are not a security boundary, and this lane does not treat them as one.

The existing restrictions are kept: no evaluate, code, upload, cookie, storage, network, devtools, PDF or coordinate tools; per-conversation `--user-data-dir` and `--output-dir`; no storage-state, secrets, extension, CDP or `--caps`; `--sandbox`; `--block-service-workers`; `--no-webmcp`.

**HOLD item 1: pre-execution controls.** Interaction tools (click, type, fill form, select, press key, hover, dialog) are never in `allowedTools`.

- `PreToolUse` runs for every browser call. It denies unadmitted tools and failing URLs before execution. For interactions it returns `ask`, which forces `canUseTool` even if another fragment pre-approved the tool. Without a permission surface an `ask` is terminal.
- `canUseTool` calls `approvals.decide(...)` and allows only `{decision:'approve',toolUseId}` for the exact call. A missing port, error, abort, mismatched id or oversized input denies.
- `disallowedTools` removes from the model context the upstream core tools that are exposed by default but never admitted.
- Tests drive a scripted model of the documented SDK order: denied interactions never reach the executor, and approved ones execute once.

**HOLD item 2: download claims.** The slot count and filename claim happen synchronously, before the first `await`.

- A refusal before ingest releases the slot.
- After an ingest attempt, the claim stays, even when the acknowledgement is lost, because an unknown outcome is not treated as "not ingested".
- The concurrency test fires 5 distinct downloads plus 1 duplicate against `maxFiles: 2`. Exactly 2 ingest; the rest refuse with 3× `BROWSER_DOWNLOAD_LIMIT` and 1× `BROWSER_DOWNLOAD_DUPLICATE`.

**HOLD item 3: structural validation.** Validation is now structural, in both the download port and the promptfoo `usable-file` grader:

- ZIP: verified end of central directory, every central and local header, names (no traversal or absolute paths), no encryption or zip64, sizes, and CRC-32 of every entry within a 128 MiB inflate bound.
- OOXML: an OPC package with `[Content_Types].xml`, the `_rels/.rels` officeDocument relationship, a main-part override of the claimed type and a main-part root element/namespace that match the format. Macro content types and `vbaProject.bin` refuse.
- PDF: header plus a final `startxref` that points at `xref` or an object.
- Text: strict UTF-8 without NUL.

`PK\x03\x04rest` no longer passes as a DOCX. The grader's success text is now "structurally valid … native open UNRUN", and office `requiredText` fails closed (`REQUIRED_TEXT_UNVERIFIED`). Native open/render remains UNRUN.

**HOLD item 4: activation.** `BROWSER_ACTIVATION` is `{state:'held',reason:'BROWSER_EGRESS_UNQUALIFIED',evidence:null}`.

- `createBrowserCapability` takes no activation argument. While the gate is held it returns `enabled:false`, `activation:'held'`, the resolved `policy` and `status`, no server/tool/hook, and downloads refuse with `BROWSER_ACTIVATION_HELD`.
- Opening requires a reviewed source change to that record that cites egress evidence.
- No deployment gate is lowered. The browser still runs only on the dedicated isolated host, and that host's qualification still gates production.

**HOLD item 5: profile retention.** The README now states the real retention.

- The `--user-data-dir` profile keeps cookies, local and session storage, IndexedDB, cache and any site session for the life of the conversation, until disposal.
- `dispose()` removes the profile, home and output directories and verifies their absence. It refuses a symlinked or relocated browser root, is idempotent and honours abort.
- The conversation lifecycle owner must call it after the MCP process exits. D005 host destruction is the backstop.

## Egress requirement for the infrastructure/shipping owner (browser host, D005)

This is recorded verbatim in `activation.mjs` `EGRESS_REQUIREMENTS`. It is the binding control, and all of it must be measured on the approved host before activation:

1. **Deny non-public destinations.** The host egress path denies every destination in:
   - IPv4: 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16 (including 169.254.169.254 IMDS and 169.254.170.2 ECS credentials), 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.88.99.0/24, 192.168.0.0/16, 198.18.0.0/15, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4 and 240.0.0.0/4;
   - IPv6: every address outside 2000::/3 or inside 2001::/23, 2001:db8::/32, 2002::/16, 3fff::/20 or 5f00::/16. This covers ::1, fc00::/7 including fd00:ec2::254, fe80::/10, ff00::/8, ::ffff:0:0/96 and 64:ff9b::/96.
2. **Decide on the resolved address.** The check applies to the address actually connected to, after DNS, for every connection the browser makes: navigations, redirects, sub-resources, WebSocket, fetch/XHR and downloads.
3. **DNS rebinding.** DNS answers that contain denied addresses are refused, or the connection to them is refused even after an earlier public answer. Only the controlled resolver serves DNS.
4. **Redirects.** Every hop gets the same destination check.
5. **Web ports only.** Outbound is limited to TCP 80/443 plus the controlled resolver. There is no other UDP/QUIC egress unless separately qualified.
6. **No proxy bypass.** No route bypasses the control. Host IMDS and container credential endpoints are unreachable from the browser user.
7. **Per-conversation host.** A host or task is never reused across conversations or tenants and is destroyed with verified cleanup.
8. **Evidence.** Measured negative probes from the real non-root sandboxed browser for each denied class, a redirect to a denied address and a rebinding name, plus a positive probe to an allowlisted origin.

Recommended, not required by the activation record: enforce the destination allowlist at egress as well, using an SNI/Host-aware forward proxy or firewall domain list derived from the same platform configuration. This makes "denied by default" a network property and not only a worker and Playwright property.

## Contract and coordination proposals for dot (not edited)

1. **Platform browser record (Capiro-owned trusted configuration).** Proposed shape: `{maximum, defaults, roleCeilings}`, each a browser policy `{enabled, tools, allowedOrigins, timeouts, downloads}`.
   - `maximum.allowedOrigins` is the Capiro-maintained approved destination list. It is configuration, never source.
   - Proposed home: the same Core platform-policy record as the SDK capability limits (`capabilities/policy-resolution.mjs`), under a `browser` key. Role names must match Core's role vocabulary.
   - Open question: who maintains the approved list, and how a change is reviewed and versioned (a policy revision feeds `sourceScopes[].policyRevision`).
2. **Tenant-admin record.** Proposed shape: `{browser?:partial, roles?:{[role]:partial}}`, stored beside the tenant capability settings. Admin saves should call `assertTenantBrowserSettings` so widening refuses at write time with the resolver's codes.
3. **Run hand-off.** Core resolves `resolveBrowserPolicy({platform,tenant,role})` server-side and passes the result beside `run` with the capability policy. The closed `Run` contract cannot carry it. Proposed execution-record field: `browser`.
4. **Trusted runtime facts from runtime preparation:**
   - `installation` (`@playwright/mcp` 0.0.83 paths in the image);
   - `sourceScopes` (same tenant, e.g. `{kind:'public',resourceId:'public-web',policyRevision}`);
   - the `approvals` port: a UI/control owner that presents `meri-browser-approval-request/1` and returns `{decision,toolUseId}`;
   - the conversation-close hook that calls `dispose`.
5. **UI contract.** The UI should display the fragment `status` (`capability`, `destinations`, `allowedOriginCount`, `notice`, `activation`). It needs a display state for "browser on, no destinations configured" and for "activation held".
6. **Decision log.** Proposed `DECISIONS.md` entry, which needs dot's review because the file is shared: "Browser capability default on (product direction 7606375d); destinations deny-by-default from platform-approved configuration with tenant narrowing; platform non-public/scheme/credential limits unremovable; interactions approved pre-execution; activation held pending D005 egress qualification."
7. **Options composition.** The `options.mjs`/`activity.mjs` owner must merge `disallowedTools` and both hooks, chain `canUseTool` (as `chainPermissions` on the capability lane does) and keep `permissionMode:'default'`.

## Checks (Node v24.21.0)

Results:

| Check | Result |
| --- | --- |
| `node --test apps/worker/conversation/browser/test/*.test.mjs apps/artifacts/structure/test/*.test.mjs evals/promptfoo/test/*.test.mjs` | 42/42 pass, 2 runs |
| Browser and structure suites, `--test-concurrency=1` | 28/28 pass |
| `node --test apps/worker/conversation/test/*.test.mjs` | 56/56 pass |
| `node --test apps/control/qualification-temporal/compatibility.test.mjs` | 22/22 pass. This suite holds the R7 rule naming conversation/browser executors. |
| Other eval suites (`evals/*/test`, not promptfoo) | 127/127 pass |
| `npm run check` (root) | 4238/4241 |
| `npm run check:contracts` | 4233/4236 |
| Scratch `tsc --noEmit` with `checkJs` (non-strict, `@types/node`) over the browser entry points, the resolver, the structure module and the grader | 0 errors in owned files. Remaining errors are only in frozen `packages/contracts/{validate,commands-0.2/execution-boundary,retrieval-0.2/operation-contracts}.mjs`. No repository tsconfig covers the browser directory. |
| `git diff --check e0f94fe` | clean |
| Clean-pin run on a `git archive` of the final source tree (browser, structure, promptfoo, conversation worker and temporal compatibility suites; lockfile-matched `node_modules` symlinks) | 120/120 pass. The first attempt failed 3 files with `ERR_MODULE_NOT_FOUND` (`ai`) because the `packages/ui-stream`, `apps/control/conversations` and `apps/runtime` symlinks were missing from the archive; they were added and the run repeated. |

The 3 failures in `npm run check` and `npm run check:contracts` are the same 3 tests on a clean `git archive e0f94fe` snapshot with the same `node_modules`, so they predate this lane:

- "standalone browser module works with no Node or private graph": `vm.SourceTextModule is not a constructor`;
- "generated distribution check is independent of caller working directory": generated drift in `browser.mjs`;
- "imports and runs with no filesystem, network or process side effect": `--allow-fs-read` permission model.

These concern the contracts package's browser distribution, not this fragment.

Failures fixed during the lane, kept visible:

- **Initial ordering assertion.** The first run of `policy.test.mjs` failed one assertion. It expected tenant order for enabled approved origins, but intersection order follows the platform list. The behaviour was kept and documented, and the expectation corrected.
- **Missing tool in a test policy.** The first run of `permissions.test.mjs` failed because the test policy did not admit `browser_tabs`, so the scripted SDK reported it unavailable. The test policy was corrected.
- **Missing dependency.** `evals/promptfoo/test/provider.test.mjs` first failed with `@js-temporal/polyfill` not found. A `packages/window-resolution` `node_modules` symlink was missing; the lockfile hash matched and the symlink was added.
- **Trailing whitespace.** README trailing whitespace was found by `git diff --check` and fixed.
- **Scratch tsc findings.** JSDoc union annotations and default-parameter inference were tidied: prose result shapes and explicit `@param`. No behaviour change.

Old-versus-new regression probe (scratch script, not committed), run against the `e0f94fe` archive and this branch:

| HOLD item | `e0f94fe` | This branch |
| --- | --- | --- |
| 2: concurrent downloads with `maxFiles: 1` | 2 ingests (`ok,ok`) | 1 ingest (`ok,BROWSER_DOWNLOAD_LIMIT`) |
| 1: `browser_click` in `allowedTools` | `true` | `false` |
| 3: `PK\x03\x04rest` graded as a usable DOCX | `pass:true` | `DOES_NOT_OPEN` |

## Not run, and why

The following were not run:

- Real Playwright MCP or Chromium.
- A live SDK permission round trip. The permission order is a scripted model of the documented SDK 0.3.295 behaviour.
- Native Office or PDF open/render.
- Any egress, DNS, redirect or rebinding probe.
- The isolated browser host.
- Fargate, AWS or deployment.
- The Promptfoo CLI.

None is authorized or possible offline in this lane. Activation stays held because of them. No result here is live, sandbox, isolation or release evidence.

## Cleanup

No processes were started beyond `node --test`, `tsc` and the scratch probe; all exited. Scratch files live only under the session scratchpad. The temporary workspaces the tests created under the OS temp directory are removed in `finally` blocks. The `git fetch origin` that retrieved `7606375d` added remote-tracking refs to the shared clone only. No branch, worktree or source outside this worktree was changed.
