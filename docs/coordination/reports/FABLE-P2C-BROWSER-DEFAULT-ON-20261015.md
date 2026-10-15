# Fable lane P2c: browser capability on by default, destinations denied by default (15 October 2026)

Branch `fable/p2c-browser-default-on-20261015`, base `e0f94fe` (p1c). Owned paths: `apps/worker/conversation/browser/**`, the new `apps/artifacts/structure/**`, `evals/promptfoo/graders/usable-file.mjs` and its test/README line, and this report. No contracts, lockfiles, migrations, credentials, network calls, builds, deployment or cloud actions. Node v24.21.0. Dependencies were symlinked from `/home/user/meri-fable-complete` only where the lockfile SHA-256 matched (root, `packages/contracts`, `packages/window-resolution`, `packages/ui-stream`, `apps/worker/conversation`, `apps/worker/qualification`, `apps/control/{conversations,qualification-temporal}`, `apps/runtime`, `apps/artifacts/storage`); the symlinks are untracked.

**Status.** Source: **HOLD** (dot's [corrected browser review](https://github.com/neo-capiro/meri-greenfield/blob/aac9164001b087e072b22dafc66bc89915662c75/docs/coordination/audits/meri-comprehensive-20261015/CORRECTED-BROWSER-REVIEW.md) of `31ed4a73`, H1–H5); the successor repairs below are returned for independent re-review and are not accepted until dot records it. Activation/live qualification: **HOLD**, independently of source. Browser capability ON by default, destinations denied by default, consequential interactions decided before execution: unchanged. The sections before "Successor-review repairs" describe the `31ed4a73` candidate and are corrected where the review found them stale.

## Direction implemented

The brief changed twice while this lane ran. The final binding direction is the product owner's, recorded in commit `7606375d` ([`DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md` at `7606375d`](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md), section "Subsequent explicit product direction — 18:39 UTC"; the file is not in this branch's tree, so the link is to the commit):

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
| `egress.mjs` | (successor repair) `egressDecision`/`egressRedirectChain`: executable reference for the mandatory effective-origin-allowlist egress requirement. Pure; not a network control. |
| `server.mjs` | `validateBrowserInstallation` (a trusted fact, moved out of policy) and the Playwright MCP 0.0.83 stdio config. |
| `workspace.mjs` | `browserPaths` and `disposeBrowserState`, which removes state and verifies absence. |
| `downloads.mjs` | The download port: synchronous slot and identity claim, policy source check, structural validation, ingest, receipt. `validateSourceScopes` is a trusted fact, moved out of policy. |
| `fragment.mjs` | `buildOpenBrowserFragment`: composition of the open path (module-internal). |
| `index.mjs` | `createBrowserCapability`: validates the context, then returns a disabled, held or open fragment. Each carries `status`. |
| `receipts.mjs` | Unchanged. |

`apps/artifacts/structure/file-structure.mjs` holds `structurallyValid` and `readZip`. At `31ed4a73` it used Node `zlib` only, recognised XML with regular expressions and checked PDFs by token signature; the review showed that this accepted malformed files (H1/H2). The successor repairs split it into `zip.mjs`, `xml.mjs`/`ooxml.mjs` and `pdf.mjs`/`pdf-objects.mjs` behind the same entry and add the upstream `saxes` 6.0.0 XML parser as an exact-pinned root dependency (see "Successor-review repairs").

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
- `canUseTool` calls `approvals.decide(...)` and allows only `{decision:'approve',toolUseId}` for the exact call. A missing port, error, abort, mismatched id or oversized input denies. At `31ed4a73` a port that never answered left the callback pending even after abort, and the claimed timeout denial did not exist (H5). The successor repair adds a bounded deadline, abort completion and input-digest binding.
- `disallowedTools` removes from the model context the upstream core tools that are exposed by default but never admitted.
- Tests drive a scripted model of the documented SDK order: denied interactions never reach the executor, and approved ones execute once.

**HOLD item 2: download claims.** The slot count and filename claim happen synchronously, before the first `await`.

- A refusal before ingest releases the slot.
- After an ingest attempt, the claim stays, even when the acknowledgement is lost, because an unknown outcome is not treated as "not ingested".
- The concurrency test fires 5 distinct downloads plus 1 duplicate against `maxFiles: 2`. Exactly 2 ingest; the rest refuse with 3× `BROWSER_DOWNLOAD_LIMIT` and 1× `BROWSER_DOWNLOAD_DUPLICATE`.

**HOLD item 3: structural validation.** At `31ed4a73` validation became structural in both the download port and the promptfoo `usable-file` grader, and `PK\x03\x04rest` stopped passing as a DOCX. The grader's success text became "structurally valid … native open UNRUN", and office `requiredText` fails closed (`REQUIRED_TEXT_UNVERIFIED`).

That version did not establish what this section originally claimed. dot's review found ten malformed files that it accepted (H1, H2):

- OOXML was recognised with regular expressions, so an unterminated main part, a relationship or override present only inside an XML comment, and a relationship under an un-namespaced `NotRelationships` all passed;
- PDF only checked that `startxref` pointed at the token `xref` or an object header, with no table, trailer or catalog;
- ZIP local flags, CRC and sizes were not compared with the central directory, data descriptors were ignored, and `C:/escape.txt` passed.

The current checks are described in "Successor-review repairs". Native open/render remains UNRUN.

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
8. **Evidence.** Measured negative probes from the real non-root sandboxed browser for each denied class, a redirect to a denied address, a rebinding name, an allowlisted-to-unlisted public redirect, an unlisted public sub-resource, an unlisted public WebSocket and a platform-approved origin narrowed away by tenant or role, plus a positive probe to an allowlisted origin.
9. **Effective origin allowlist (mandatory; successor repair for H3).** For every connection the browser makes, the egress path permits only an origin on the effective platform-maximum ∧ tenant ∧ role allowlist resolved for this conversation run. This covers each navigation and every redirect hop, sub-resources, fetch/XHR, WebSocket (ws/wss compared as http/https) and downloads. The allowlist is bound to the run and revoked with it, and applies in addition to requirements 1–4. Refused: an allowlisted public origin redirecting to an unlisted public origin; an unlisted sub-resource or WebSocket origin; an origin the platform approves but the tenant or role narrowed away. An empty effective list admits nothing. `egress.mjs` `egressDecision` is the executable reference decision. A likely implementation is an SNI/Host-aware forward proxy or firewall domain list derived from the same resolved record.

At `31ed4a73` this report called egress allowlist enforcement "Recommended, not required". That was wrong: without it, the stated criteria did not forbid an allowlisted public origin redirecting to an unlisted public origin (review H3). It is now mandatory in `EGRESS_REQUIREMENTS`, and the existing eight measurements are insufficient to open the gate.

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
   - the `approvals` port: a UI/control owner that presents `meri-browser-approval-request/2` and returns `{decision,toolUseId,inputDigest}` (successor repair; at `31ed4a73` it was `/1` with `{decision,toolUseId}`). This is an injected boundary, not a complete approval contract: see "Approval-port proposal" below;
   - the conversation-close hook that calls `dispose`.
5. **UI contract.** The UI should display the fragment `status` (`capability`, `destinations`, `allowedOriginCount`, `notice`, `activation`). It needs a display state for "browser on, no destinations configured" and for "activation held".
6. **Decision log.** Proposed `DECISIONS.md` entry, which needs dot's review because the file is shared (revised after the corrected review): "Browser capability default on (product direction 7606375d). Destinations deny-by-default from platform-approved configuration with tenant/role narrowing. Platform non-public/scheme/credential limits unremovable. Interactions decided pre-execution. The effective platform/tenant/role origin allowlist is mandatory at egress for every hop, sub-resource and WebSocket. Source status and activation status are recorded separately: source HOLD pending re-review of the successor repairs, activation HOLD pending D005 egress, SDK pre-execution approval, profile/host cleanup and ingest qualification." It must not say that all prior defects were accepted.
7. **Options composition.** The `options.mjs`/`activity.mjs` owner must merge `disallowedTools` and both hooks, chain `canUseTool` (as `chainPermissions` on the capability lane does) and keep `permissionMode:'default'`.

## Checks at `31ed4a73` (Node v24.21.0, historical author evidence)

These results are the original lane's and were not independently reproduced by the reviewer (see the successor section for the reason). Results:

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

## Successor-review repairs (15 October 2026)

Branch `fable/p2c-r-structure-policy-20261015`, base `31ed4a732e81000c1962765ff1d16cdcdf16ecaf`. The acceptance criteria are dot's [corrected browser review](https://github.com/neo-capiro/meri-greenfield/blob/aac9164001b087e072b22dafc66bc89915662c75/docs/coordination/audits/meri-comprehensive-20261015/CORRECTED-BROWSER-REVIEW.md) (SHA-256 `c2f4fd41…5f594b`, checked against the delivered copy): H1–H5 and its contract-proposal dispositions.

Owned paths:

- `apps/artifacts/structure/**`;
- `apps/worker/conversation/browser/**`;
- `evals/promptfoo/graders/usable-file.mjs` and its tests (`evals/promptfoo/test/usable-file.test.mjs`, new);
- this report;
- under a lane-scoped dependency exception, the root `package.json` and `package-lock.json`.

Nothing else was edited. In particular, no contract, migration, Dockerfile, image recipe, frozen UIEvent or Run shape, and not the promptfoo README line.

Status:

- **Source: HOLD** until dot independently re-reviews these exact commits.
- **Activation/live qualification: HOLD**, separately.

The product direction is unchanged:

- the browser capability is ON by default and never set to OFF;
- destinations are denied by default;
- consequential interactions are decided before execution.

The reviewer's accepted narrow repairs are kept, and their tests still pass:

- the default-on policy with an empty allowlist;
- the pre-execution `allowedTools`/`ask`/approval fix;
- the synchronous download claims;
- the held entry point;
- profile disposal.

### Implementation outline

Responsibilities stay with the same owners:

- the artifact owner: structure;
- the worker browser fragment: policy, permissions, activation record;
- the control owner: approvals port and trusted records;
- the host/infrastructure owner: egress.

Modules:

| Module | Responsibility |
| --- | --- |
| `apps/artifacts/structure/file-structure.mjs` | Small entry: `structureCheck(bytes,format)` → `{valid:true}` or `{valid:false,reason}`, plus the unchanged `structurallyValid` and `readZip`. |
| `refusal.mjs` | Closed `STRUCTURE_REASONS` vocabulary and `StructureInvalid`. |
| `zip.mjs` | Strict ZIP reader (H2). |
| `xml.mjs` | Strict, namespace-aware part reader over upstream `saxes`. |
| `ooxml.mjs` | OPC/OOXML package rules (H1). |
| `pdf-objects.mjs` | Minimal strict PDF object syntax and bounded stream decoding. |
| `pdf.mjs` | Cross-reference/trailer/catalog coherence (H1). |
| `browser/resolution.mjs` | Raw partial type validation before normalization (H4). |
| `browser/permissions.mjs` | Deadline/abort race and input-digest binding (H5, item 6). |
| `browser/activation.mjs` | Mandatory effective-origin-allowlist requirement (H3). |
| `browser/egress.mjs` | Executable reference decision for that requirement (H3). |

Dependency direction:

- `file-structure → {zip, ooxml → xml → saxes, pdf → pdf-objects}`, all → `refusal`;
- `downloads → file-structure`;
- `usable-file → file-structure`;
- `permissions → contracts/validate (canonicalSha256)`;
- `egress → policy`.

There are no cycles. Each new module has one reason to change.

### H1 — malformed OOXML and PDF (closed in source)

- **XML.** `[Content_Types].xml`, `_rels/.rels`, the main part and the main part's relationship part are parsed completely by `saxes` 6.0.0 (`xmlns:true`). It throws on unterminated or mismatched elements, unbound prefixes, duplicate attributes, undefined entities, multiple roots and text outside the root.
  - Only real elements count. Comments, CDATA and processing instructions never become elements.
  - DTDs are refused (OPC forbids them), and so are declarations of a non-UTF-8 encoding.
- **Content types.** The root must be `Types` in the content-types namespace, with only `Default`/`Override` children of that namespace and no duplicates. Every part needs a content type, and macro-enabled types refuse.
- **Relationships.** The root must be `Relationships` in the relationships namespace, with only `Relationship` children: unique `Id`, `Type`, `Target`, and `TargetMode` absent/Internal/External. There must be exactly one internal officeDocument relationship.
- **Main part.** It must be present, carry the claimed format's content type and have the expected root local name and namespace. If its relationship part exists, it must follow the same rules, and every internal target must exist.
- **PDF.** No strict JavaScript PDF library exists. pdf-lib and pdf.js deliberately recover broken files, for example by rebuilding missing cross-reference tables, so neither is usable as a validator. The bounded check in `pdf.mjs` requires:
  - the header, then `startxref` … `%%EOF`;
  - at the `startxref` offset, either a classic `xref` table (subsections of exact 20-byte entries, object 0 free) followed by a `trailer` dictionary, or a cross-reference stream (`/Type /XRef`, `W`/`Index`/`Size`, FlateDecode with PNG predictors 10–15, or unfiltered). Cross-reference streams are **accepted**, not refused;
  - `/Prev` and hybrid `/XRefStm` sections followed, with loop and count bounds (`PDF_LIMITS`: 64 sections, 1,000,000 objects, 16 MiB per decoded stream, nesting depth 32);
  - every in-use entry pointing exactly at an `N G obj` header of that number and generation;
  - every compressed entry naming an in-use `/Type /ObjStm` with enough objects;
  - every object number below its section's `/Size`;
  - the newest trailer having `/Size` and an indirect `/Root` that resolves, directly or inside an object stream, to `/Type /Catalog` with an indirect `/Pages` that is in use.
- **Reasons.** Refusals are closed reasons: `XML_*`, `OPC_*`, `PDF_*`.
- **Regressions.** `apps/artifacts/structure/test/review-probes.mjs` rebuilds the four OOXML probes and both PDF probes byte for byte (the PDFs are exactly 32 and 47 bytes). Each probe is asserted in three places:
  - the validator, with its exact reason (`file-structure.test.mjs`);
  - the grader, as `file 0: DOES_NOT_OPEN <reason>` (`evals/promptfoo/test/usable-file.test.mjs`);
  - the download port, as `BROWSER_DOWNLOAD_TYPE` with `detail:<reason>`, with no ingest and no receipt (`downloads.test.mjs`). This closes the reviewer's note that the ingest implication was inferred and not run.
- **Additional negatives:** DTD; non-UTF-8 declaration; unbound prefix; mismatched end tag; root only in a comment; two roots; two officeDocument relationships; external officeDocument target; relationship without `Id`; text in an element-only root; duplicate or unknown content-types children; a part without a content type; un-namespaced `Types`; a main-part relationship to a missing part, with the wrong namespace, or unterminated; an xref entry off by one byte or pointing at another object; a 19-byte entry; object 0 in use; an object at or above `/Size`; no `/Root`; a non-catalog root; a catalog without `/Pages`; a duplicate trailer key; a `/Prev` loop; corrupt xref-stream data; a stream that is not `/XRef`; `xref` only inside a comment.
- **Positives:** an incremental update, an xref stream, a PNG predictor, and a catalog in an object stream.
- **Scratch cross-checks** (not committed; synthetic content only):
  - Poppler `pdfinfo` opens every synthetic positive PDF without a syntax error.
  - The validator accepts real files generated locally: LibreOffice DOCX, XLSX, PPTX and PDF; python-docx; python-pptx; openpyxl; reportlab; Python `zipfile`; PyMuPDF output with object streams and xref streams (`use_objstms`) and a linearized file; and two PDFs already on the host.
  - Native Office/PDF open or render remains **UNRUN**.

### H2 — ZIP agreement (closed in source)

`zip.mjs`:

- **Agreement.** Local flags, method and name must equal the central record. Without the data-descriptor flag (bit 3), the local CRC-32 and both sizes must also equal it. With bit 3, the local fields must be zero or equal to the central values, and a signed or unsigned data descriptor carrying the central values must follow the data (`ZIP_DATA_DESCRIPTOR`).
- **Layout.** Local entries (header, data, descriptor) must tile the bytes before the central directory exactly. So no entry overlaps or shares another's data, and no bytes hide between entries (`ZIP_ENTRY_LAYOUT`).
- **Data.** Every member is inflated with `node:zlib`, and its length and `zlib.crc32` must equal the central record.
- **Bomb bounds.** These are stated in `ZIP_LIMITS`:
  - the declared uncompressed total is at most 128 MiB;
  - a declared ratio is at most 1032, the deflate maximum, checked before inflating;
  - inflation never produces more than the declared size.
- **Names.** Names must be portable and unique case-insensitively. Refused: a drive letter or any other colon, backslash, NUL or control characters, absolute paths, empty, `.` or `..` segments, and non-ASCII without the UTF-8 flag. A directory entry may not carry data.
- **Refused formats.** Encryption, zip64, multi-disk and methods other than stored and deflate.
- **Regressions.** The four probes rebuilt exactly: local encryption flag, local CRC zeroed, local sizes zeroed without a descriptor, `C:/escape.txt`. The first three are also run inside DOCX, XLSX and PPTX packages. Each fails in the validator, the grader and the download port. Additional cases:
  - signed and unsigned descriptors, stored and deflated (pass);
  - a descriptor value that disagrees;
  - a descriptor flag set with no descriptor present;
  - a non-zero local CRC under bit 3;
  - any local flag difference;
  - a local method difference;
  - bytes hidden before the first entry;
  - a second central record that reuses the first local entry;
  - a declared total over 128 MiB;
  - a ratio over 1032;
  - inflation beyond the declared size;
  - twelve name classes;
  - a non-ASCII name with the UTF-8 flag (pass) and without it (refused);
  - directory entries.

### H4 — mistyped tenant and role settings (closed)

`override()` now checks raw partial field types before any merge or normalization:

- `enabled` and `downloads.enabled` must be booleans;
- `tools`, `allowedOrigins` and `downloads.formats` must be arrays;
- timeouts and download limits must be safe integers.

Nested records are copied as own data. A mistyped field refuses with `BROWSER_TENANT_SETTINGS_REFUSED` and its field path, at write time (`assertTenantBrowserSettings`) and at run time (`resolveBrowserPolicy`), for both tenant and role partials. Only already-valid values are normalized.

The regression covers 13 cases at write time and at run time for two roles, including `{browser:{enabled:'yes'}}` and `{browser:{downloads:{enabled:'yes'}}}`. It also checks that real `false` values still narrow.

### H5 — bounded approval and abort completion (closed in the fragment; live SDK round trip UNRUN)

`canUseTool` races `approvals.decide` against the run's AbortSignal and an explicit deadline that the gate owns:

- **Deadline.** `APPROVAL_DEADLINE_MS` has a default of 120 s and a configurable range of 1 s to 15 min, set through the trusted runtime setting `approvalDeadlineMs`. Any other value is `BROWSER_CONFIGURATION`.
- **Expiry** denies `BROWSER_APPROVAL_EXPIRED`. It is also checked against the injected clock and `expiresAtMs`.
- **Abort** denies `BROWSER_APPROVAL_UNAVAILABLE`.
- **Port signal.** The port receives a signal that aborts on either expiry or abort.
- **Cleanup.** The timer and the abort listener are always released.
- **Late answers.** An answer or rejection that arrives after the race is settled is ignored.

Regressions use mock timers and a port that never answers:

- the port completed by abort;
- the port completed by expiry, and not one millisecond early;
- the default deadline without a run signal;
- a late approve after abort, and after expiry, both still denied;
- deadline configuration bounds.

A **live SDK cancellation round trip remains UNRUN**. These are scripted ports, not SDK delivery.

### H3 — effective destination allowlist mandatory at egress (closed in source/contract; not measured)

`EGRESS_REQUIREMENTS` gains `effective-origin-allowlist`. Every connection may reach only an origin on the run's effective platform-maximum ∧ tenant ∧ role allowlist. That covers each navigation and every redirect hop, sub-resources, fetch/XHR, WebSocket (ws/wss mapped to http/https) and downloads.

The allowlist is bound to and revoked with the run, and applies in addition to the non-public, resolved-address and rebinding rules. It explicitly refuses:

- an allowlisted public origin redirecting to an unlisted public origin;
- an unlisted sub-resource or WebSocket origin;
- an origin that tenant or role narrowing removed.

The related requirements also changed:

- `redirects` applies both checks per hop.
- `evidence` adds the measured probes for each of these cases.
- `activationOpen` still requires the exact record, so a record without this requirement never opens. The shipped record stays held.

`egress.mjs` (`egressDecision`, `egressRedirectChain`) is the pure reference decision that the host control must reproduce.

Source-level negatives:

- public-allowlisted → public-unlisted redirect, refused at the redirect hop;
- an unlisted public IP literal hop;
- scheme downgrade;
- an unlisted sub-resource, fetch, download and WebSocket;
- a non-default port, a non-public WebSocket and a wrong scheme;
- tenant narrowing, role-ceiling narrowing and tenant-role narrowing;
- an empty list;
- a disabled policy.

**No browser, DNS, redirect, sub-resource or WebSocket measurement was made.** These tests fix the expected decisions only.

### Dependency addition for dot's review

`saxes` **6.0.0** was added as an exact-pinned root devDependency, beside the existing exact `ajv`/`canonicalize` entries, with `npm install --save-exact --save-dev saxes@6.0.0`.

- It is committed alone in `aff11390`.
- The `package-lock.json` diff adds only `node_modules/saxes` 6.0.0 (integrity `sha512-xAg7SOnEhrm5zI3puOOKyy1OMcMlIJZYNJY7xLBwSze0UjhPLnWfj2GF2EpT0jmzaJKIWKHLsaSSajf35bcYnA==`, matching the brief) and its single dependency `node_modules/xmlchars` 2.2.0 (`sha512-JZnDKK8B0RCDw84FNdDAIpZK+JuJw+s7Lz8nksI7SIuU3UXJJslUthsi+uWBUYOwPFwW7W7PRLRfUKpxjtjFCw==`).
- No other lock entry changed.
- `saxes` is ISC-licensed and `xmlchars` MIT-licensed. Neither has an npm install lifecycle script (`xmlchars` has a non-lifecycle `test-install` script, which npm never runs on install).

**Proposal to the worker image owner** (no Dockerfile edited): include `saxes` in the worker/runtime image. `apps/runtime/Dockerfile` already runs root `npm ci --ignore-scripts` without `--omit=dev`, so a rebuild from the new root lockfile would install it, as it does `ajv`/`canonicalize` today. The image owner should confirm that root devDependencies remain installed in the image, or reclassify the root runtime dependencies (ajv, ajv-formats, canonicalize, saxes) as `dependencies`, and record the image's bound package bytes.

### Approval-port proposal (for the canonical approval owner)

The worker's `approvals.decide` is an injected boundary. A `{decision,toolUseId}` answer is not durable authorization. The canonical approval owner, reusing the canonical approval mechanism and not creating a second authorizer, must bind and enforce:

1. **Approver.** An authenticated approver, authorized for the tenant and role, with the UI session bound to that identity.
2. **Scope.** `tenantId`, `actorId`, `conversationId`, `runId`, `attemptId`, `workerId` and `writerFence`, from the trusted binding. A stale fence or attempt refuses.
3. **Tool.** Server (`meri_browser`), tool/action and `toolUseId`.
4. **Input.** The canonical input digest: canonical JSON (RFC 8785, `canonicalize`) SHA-256 of the exact input that will run. The approver must see the exact action, target and data that the digest covers.
5. **Page context.** The relevant page origin and context the interaction applies to (the current page URL origin and element reference). The fragment does not have this today; it must be supplied by the browser host and bound.
6. **Expiry.** It must not exceed the fragment's `expiresAtMs`. Expiry is decided server-side.
7. **Revocation.** Revoked when the run is cancelled, the conversation is closed, the policy revision changes or the approver is withdrawn.
8. **One-time consumption.** An approval is consumed at most once, atomically, by the matching attempt.
9. **Replay.** The same `toolUseId` with a different digest, an approval presented after consumption or expiry, and an approval from another run or attempt all refuse.
10. **Uncertain execution.** If the tool may have run but its outcome is unknown, the approval is consumed and the outcome recorded as uncertain. It never licenses a retry without a new approval.

**Fragment-side guard (implemented).** The port interface is a local, unfrozen worker proposal, not a canonical contract, so it could carry the guard without a contract change.

- The request is now `meri-browser-approval-request/2`: `{schema,binding,toolUseId,action,input,inputDigest,expiresAtMs}`.
- Only `{decision:'approve',toolUseId,inputDigest}` whose digest equals the canonical digest of the gate's private copy of the input allows.
- The allowed `updatedInput` is that digested copy.

Regressions:

- canonical key order;
- a replayed approval digest for different input under the same `toolUseId`, which the reviewer's synthetic repeat showed was previously allowed;
- a missing, zero or other-input digest;
- a port that mutates its request copy and still cannot change what runs.

Durable replay prevention and single use remain the owner's obligation (items 8–9).

### Contract-proposal dispositions (response to the review)

- **Platform and tenant records.** The direction stays as accepted, and the wire/storage freeze stays held. Strict partial types are now enforced (H4). The same effective record is required to govern egress (H3).
- **Execution-record `browser`.** HOLD stands. The canonical owner should bind the policy revision/digest to the task and attempt and check revocation on restore. A client-supplied effective policy must never be authority.
- **Approvals.** As specified above.
- **UI status.** Unchanged: the held fragment's `cap.enabled:false` means "activation held", not "user turned the browser off". Approval UI must show exact action/target/data, expiry, cancellation and stale state.
- **Options composition, installation, ingest, cleanup.** HOLD stands and is unchanged by this lane. `approvalDeadlineMs` is a new optional trusted runtime setting that the composition owner may pass.
- **Decision log.** The proposed entry (item 6 above) is revised: source HOLD and activation HOLD are recorded separately, and the effective allowlist is required.

### Checks (Node v24.21.0, worktree `/home/user/meri-p2c-r`)

Lockfile-matched `node_modules` symlinks from `/home/user/meri-fable-complete` were used for:

- `apps/worker/conversation`;
- `apps/worker/qualification`;
- `apps/control/{conversations,qualification-temporal}`;
- `apps/runtime`;
- `apps/artifacts/storage`;
- `packages/{contracts,ui-stream,window-resolution}`.

The root has a real `npm ci` (its lockfile changed). The symlinks and `node_modules` are untracked.

| Check | Base `31ed4a73` | Final |
| --- | --- | --- |
| Structure suite `node --test apps/artifacts/structure/test/*.test.mjs` | 4/4 | **10/10** |
| Browser suite `node --test apps/worker/conversation/browser/test/*.test.mjs` | 24/24 | **33/33** |
| Graders `node --test evals/promptfoo/test/*.test.mjs` | 14/14 | **16/16** |
| Full conversation worker: `test/`, `browser/test`, `continuation/test`, `skills/test` | 162 | **171/171** (56 + 33 + 43 + 39) |
| `node --test scripts/qualification/assembled-image/source-proof.test.mjs` | — | **5/5** |
| `node --test apps/control/qualification-temporal/compatibility.test.mjs` (R7 executor rule) | 22/22 | **22/22** |
| `npm run check` (root) | 4238/4241 | **4238/4241**. The same 3 pre-existing contracts browser-distribution failures: `vm.SourceTextModule`, generated-distribution drift, `--allow-fs-read` permission model. |
| Clean `git archive` of `2bed1915` plus root `npm ci --ignore-scripts`, browser and structure suites | — | **43/43**. Before the install the same archive failed 6/6 files: 5 on `ajv`, 1 on `saxes`. |
| `git diff --check` | — | clean |

**Reverted-fix proof.** Each fix was temporarily reverted in the worktree, the new tests were run, and the fix was restored. The outputs are in the session scratchpad.

- **H1/H2.** Base `file-structure.mjs` was put behind a shim exposing `structureCheck`. The probe, ZIP-agreement, bomb, name, OPC and PDF tests, the download-port probe test and the grader probe test failed: 8 of 18 tests, with the 10 pre-existing passes unchanged. With the base validator all ten reviewer probes return `structurallyValid=true`, and with the fix all return `false`.
- **H4.** With base `resolution.mjs`, the H4 test fails: `write time {"browser":{"enabled":"yes"}}` was accepted.
- **H5.** With the race replaced by a direct `await approvals.decide(...)`, both H5 tests hang until the 8 s test timeout (cancelled).
- **Digest guard.** With the `inputDigest` comparison removed, the digest test fails.
- **H3.** With base `activation.mjs`, the record test fails. The decision tests exercise the new `egress.mjs` reference and are not a revert proof of the record.

**Reviewer's dependency-blocked run.** The reviewer's four browser test files failed to load only because the root dev dependencies were not installed. `packages/contracts/validate.mjs`, imported by `downloads.mjs` and now `permissions.mjs`, resolves `ajv`, `ajv-formats` and `canonicalize` from the repository root `node_modules`, and the structure validator now also needs `saxes`. The exact install command, from the repository root, is:

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

Then run:

```sh
node --test apps/worker/conversation/browser/test/*.test.mjs apps/artifacts/structure/test/*.test.mjs
```

The clean-archive row above reproduces both the failure and the fix.

Failures during this lane, kept visible:

1. **Old fixture refused.** The first structure run failed the minimal-PDF positive. The old fixture had no `/Pages`, an xref covering only object 0 and no `/Size`, so the stricter check correctly refused it. The fixture was rebuilt as a real minimal PDF.
2. **Byte offsets shifted.** One PDF negative first failed with `PDF_XREF` instead of `PDF_CATALOG`, because the edit shortened the file and moved the offsets. It was replaced by an equal-length edit.
3. **Microtask ordering.** The first H5 expiry test read the port request before the port was invoked (a microtask), and was corrected.

### Not run, and why

- Real Playwright MCP or Chromium.
- A live SDK permission or cancellation round trip.
- Native Office or PDF open/render.
- Any DNS, redirect, sub-resource, WebSocket, rebinding or egress probe.
- The approved isolated host.
- The artifact ingest service.
- Image build, AWS, deployment, Promptfoo CLI and model calls.

None is authorized or possible offline in this lane. Activation stays held. No result here is live, sandbox, isolation or release evidence.

### Residual risks

- **PDF scope.** The PDF check is structural. It does not validate page trees beyond `/Pages` being in use, does not decode content streams, and does not support filters other than FlateDecode in xref and object streams; any other filter refuses. Encrypted PDFs whose catalog is in an encrypted object stream refuse.
- **OOXML scope.** UTF-16 parts refuse; this check accepts UTF-8 only. Only the four named parts are parsed; other XML parts are not.
- **ZIP strictness.** Exact layout tiling refuses archives with prefixed or interleaved data, such as self-extracting archives, by design. Real Office, LibreOffice, Python, PyMuPDF, python-docx and openpyxl outputs passed locally.
- **Approval timing.** The deadline is enforced in-process. An approval that the owner records after the worker has expired it must be reconciled by the owner (items 6, 8 and 10).
- **Egress decision is a reference only.** `egressDecision` is not wired into Playwright routing. In-process gates still see only the navigation URL. The binding boundary remains the host egress control.

### Cleanup

Processes started:

- `node --test`;
- `npm ci`/`npm install`;
- headless LibreOffice conversions with a scratch profile, used only for scratch fixtures;
- short Python scratch scripts.

All exited; no `soffice` process remains. Scratch files are under the session scratchpad only, including the scratch fixtures and the clean archive. The test temp directories are removed in `finally` blocks. No branch was pushed, and no other worktree or source was changed.
