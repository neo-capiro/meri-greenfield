# Browser composition lane, 16 October 2026

**Lane:** browser composition.
**Branch:** `fable/live-browser-composition-20261016`.
**Base:** `fable/live-base-20261016` @ `48a27c8d0e09f8eb6501e13f0d137458460e163e`.

The default-on browser is prepared for activation at source level. **Activation stays held.** The shipped `BROWSER_ACTIVATION` is unchanged: `state:'held'`, `evidence:null`. No argument, policy field, runtime port or environment variable opens it. Product defaults are unchanged:

- capability on;
- destinations denied by default, with an empty source list;
- consequential actions decided before execution.

Inputs read:

- `docs/IMPLEMENTATION-STANDARDS.md`;
- `FABLE-OWNER-DECISIONS-20261015.md` (decision 3: the platform list is a maximum, tenants only narrow, restrictions apply through redirects and downloads);
- D005;
- `apps/worker/conversation/browser/**`;
- the audit branch `dot/meri-comprehensive-audit-20261015`: README matrix row "Complete desktop and default-on browser", `CORRECTED-BROWSER-REVIEW.md`, `PACKAGE2-BROWSER-REVIEW.md` and `PACKAGE3-BROWSER-REVIEW.md`.

This lane addresses the remaining holds those reviews named: H3 live wiring, the approval-port contract, options composition, and installation/ingest/cleanup integration.

## Implementation outline

| Responsibility | Canonical owner | This lane |
| --- | --- | --- |
| Effective policy (platform ∧ tenant ∧ role) | `resolution.mjs` (unchanged) | The same validated record and its digest now drive the egress grant, the approval subject and download provenance |
| Egress decision | `egress.mjs` reference | `egress-control.mjs`: the run-bound admission the host proxy runs. `egress-proxy.mjs`: maps proxy requests. `server.mjs`: routes the browser there with `--proxy-server` |
| Consequential-action authority | Canonical approval owner: `ApprovalProposal`/`ApprovalDecision`, `apps/control/commands/approval-context.mjs` semantics | `approval-binding.mjs` states the subject and correlates the owner's receipt. No second authorizer |
| Page context | Playwright MCP tool responses | `page-context.mjs` tracks the starting origin per tool-use |
| SDK options | `../options.mjs` | `browser/options.mjs` composes the fragment last, with server-owned routing |
| Run lifecycle | `../activity.mjs` | `runtime.mjs` (prepare and egress grant) and `lifecycle.mjs` (cleanup after exit) |
| Download ingest | Artifact owner port (`artifacts.ingest`) | Idempotency key and provenance added |

- **Dependency direction:** `activity → browser/runtime → index (gate) → fragment`. `options → browser/options`. There are no imports from `apps/control`; the canonical approval semantics are reached through the injected port, as before. No cycles.
- **Failure handling:** every refusal is a stable code; an unknown outcome is never treated as success.
- **Verification:** unit tests per module, an activity integration test and a 17-case revert sweep (below).

## Changes by lane item

### 1. Effective origin policy at egress (`egress-control.mjs`, `egress-proxy.mjs`, `server.mjs`, `activation.mjs`)

**Run binding.** `createEgressGrant({binding,policy,expiresAtMs})` binds the full `RunBinding` to the canonical digest of the run's enabled effective policy. On the host, `createEgressControl({grant,resolve,now})` re-validates the grant: a policy that does not re-validate to its digest is refused.

**Admission.** `admit({kind,url})` checks, in order:

1. The grant is neither revoked nor expired.
2. `egressDecision` admits the URL. This applies the effective allowlist to every kind: navigation, redirect hop, sub-resource, fetch, WebSocket, download and a new `tunnel` kind.
3. The port is 80 or 443.
4. The controlled resolver's answer is non-empty and holds at most 32 addresses, and **every** address is public. A mixed answer refuses the whole name.
5. The grant is re-checked after the lookup.

It returns the single checked `connect.address` for the proxy to dial. Each admission resolves afresh, so a rebinding answer cannot redirect an admitted connection.

**Proxy requests.** `admitProxyRequest` maps `CONNECT host:443|80` and absolute-form `http://` requests to connections. A WebSocket upgrade is mapped to `ws:`. Everything else is refused.

**Proxy route.** `server.mjs` takes a new required trusted installation fact, `egressProxy` (`http://host:port` only), and passes `--proxy-server`. No `--proxy-bypass` is passed. I read the pinned `playwright-core` 1.64.0-alpha-1790635538000 (`shouldProxyLoopback`, `coreBundle.js`): Playwright then adds `<-loopback>`, so loopback is proxied. I also confirmed `--proxy-server` and `--proxy-bypass` in the 0.0.83 README.

**Activation requirements.** Two requirements were added:

- `proxy-route`: launch flags, grant digest, pinned address, revocation and expiry.
- `connection-coalescing`: HTTP/2 and HTTP/3 coalescing, ORIGIN frames, Alt-Svc.

The `evidence` requirement adds probes for proxied loopback, coalescing, WebRTC/QUIC UDP and a request after revocation. `EGRESS_REQUIREMENTS` keeps its identity.

**Negative tests (`egress-control.test.mjs`):**

- an allowlisted → unlisted public redirect hop;
- unlisted sub-resource, fetch, download, `wss` WebSocket and tunnel;
- the platform-approved origin narrowed by tenant, by role ceiling and by tenant role;
- an empty list;
- private, mapped, NAT64 and mixed DNS answers;
- rebinding across admissions;
- DNS errors and oversized answers;
- a non-web port on an allowlisted origin;
- revocation, including during a pending lookup;
- expiry;
- tampered grants;
- unlisted CONNECT, plain WebSocket and absolute-form requests.

### 2. Approval binding to the canonical owner (`approval-binding.mjs`, `permissions.mjs`, `page-context.mjs`)

**The subject (`meri-browser-action/1`)** covers:

- the full binding: tenant, actor, conversation, run, attempt, worker, `writerFence`;
- server and tool;
- tool-use id;
- the canonical input SHA-256;
- the allowlisted `pageOrigin` the call starts from;
- `policySha256`.

`subjectSha256` takes the place of `commandSha256` in the canonical `ApprovalDecision`, so the owner's proposal and decision semantics apply unchanged.

**Request.** It is now `meri-browser-approval-request/3`. The port receives a structured clone, so it cannot rewrite what the call is checked against; a regression test covers this.

**Accepted receipt (`meri-browser-approval-receipt/1`).** The gate allows only a receipt that meets all of these:

- the decision passes `validateShape('ApprovalDecision')` and is `approved`;
- subject digest, `commandSha256`, proposal id and tool-use all match;
- the approver is in the same tenant;
- it was decided after the request, is unexpired, and arrived within the request window;
- it carries a consumption record (`consumed:true`, UUID `consumptionId`, `consumedAtMs` in range).

A run-local ledger refuses reuse of a proposal, consumption or tool-use (`BROWSER_APPROVAL_REPLAY`). This is defence in depth; durable once-only consumption is the owner's.

**Page binding.** The PreToolUse gate registers each admitted call. PostToolUse and PostToolUseFailure hooks close it from the `- Page URL:` report. The approval is refused with `BROWSER_APPROVAL_PAGE_UNKNOWN` when the starting page is unknown: nothing observed yet, overlapping calls, a failed call, or `about:blank`. A page outside the effective allowlist is refused with its policy code. A refused call restores the page.

**Unchanged:** the H5 deadline and abort race.

**Owner-side obligations, which do not exist yet** (proposal A1): approver authentication, current-authority checks, 30 s revocation, and durable once-only consumption across restarts.

### 3. Options composition (`browser/options.mjs`, `../options.mjs`)

`buildConversationOptions` takes a 7th optional `browserFragment`. `composeBrowserOptions` runs last, over the fully built options:

- **Server ownership.** `meri_browser` and every `mcp__meri_browser*` name belong to the fragment. Another mount naming them in `mcpServers`, `allowedTools`, `tools` or permission allow rules is refused (`BROWSER_COMPOSITION_REFUSED`).
- **Routing, not "first allow wins".** `routeBrowserPermissions` sends browser tools only to the browser gate and every other tool only to the existing chain. A permissive decider cannot allow a browser call, and the browser gate never decides `meri_original_reads`, `meri_reads`, `meri_intents` or built-ins.
- **Hooks and tool lists.** Hooks are appended by event: PreToolUse, PostToolUse and PostToolUseFailure. `allowedTools` and `disallowedTools` are unions.
- **Permission mode.** `permissionMode` must be `'default'`.
- **Inert fragments.** A held or disabled fragment returns the options unchanged; this is checked through `options.mjs`.

**Coexistence with the concurrent intents lane.** No intents source is on this base. The composition test mounts a synthetic `meri_intents` server alongside `meri_original_reads` and `meri_reads`. Any intents mount merged before the browser step keeps its own decider.

### 4. Lifecycle and downloads (`lifecycle.mjs`, `runtime.mjs`, `../activity.mjs`, `downloads.mjs`)

**Activity port.** `createConversationActivity` accepts an optional trusted `browser` port. `prepareBrowserRun`:

- asks `port.policy` for the run's effective policy;
- builds through the activation gate;
- for an open fragment only, installs the egress grant. A refused or failed grant settles cleanup, then rethrows.

**Cleanup.** In the activity's `finally`, after the query is closed, `settle({outcome})` runs once per run for `ended`, `failed` and `cancelled`. It runs even when another cleanup failed:

1. revoke egress;
2. `processes.waitForExit`;
3. **only then** dispose the profile, HOME and output, and verify they are gone.

An unconfirmed exit keeps the profile and rejects with `BROWSER_CLEANUP_UNKNOWN`. The activity then fails with `SDK_CLEANUP_UNKNOWN`, and D005 host destruction is the backstop. Cleanup has its own deadline (default 30 s, maximum 130 s), independent of the aborted run signal. A held fragment only removes and verifies stale state.

**Intentional behaviour change.** Browser state no longer persists across runs of a conversation. The README previously described persistence for the conversation's life. Cross-run sign-in (Q-A8) needs the authenticated-workflow design.

**Downloads.**

- The source is decided by the egress `download` rule.
- `artifacts.ingest` receives `idempotencyKey`: the canonical SHA-256 over tenant, conversation, run, filename and content digest.
- Provenance is `source:{kind,origin,urlHost,acquiredAtMs,policySha256}`.
- The owner must echo the key; otherwise the result is `BROWSER_DOWNLOAD_INGEST` and the claim stays.
- Size, count and structure bounds are unchanged.

### 5. Activation checklist

`apps/worker/conversation/browser/ACTIVATION-CHECKLIST.md` lists the preconditions (P1–P6) and every measurement required on the approved host:

| Section | Covers |
| --- | --- |
| A1–A5 | sandbox and isolation |
| B1–B13 | every egress requirement, with its probe |
| C1–C5 | live SDK approval and routing |
| D1–D4 | lifecycle across all outcomes, including SIGKILL |
| E1–E2 | downloads |
| F1 | status UI |

A test asserts that the checklist names every egress requirement and that the gate stays held.

## Checks run

Node 24.22.0; `npm ci --ignore-scripts` per lock; `MERI_REVIEW_SOURCE_ROOT` set to the checkout.

| Command | Result |
| --- | --- |
| `node --test apps/worker/conversation/browser/test/*.test.mjs apps/artifacts/structure/test/*.test.mjs` | **63/63 pass** (base 43/43). |
| `apps/worker/conversation`: `node --test test/*.test.mjs skills/test/*.test.mjs continuation/test/*.test.mjs reads/test/*.test.mjs` | **237/237 pass**. Base was 233/233; the 4 added cases are `activity-browser.test.mjs`. |
| `tsc` (apps/runtime 5.x, `@types/node`) over `options.mjs`, `browser/options.mjs`, `capabilities/fragment.mjs`, `reads/options.mjs` | clean |
| Revert sweep (each protection reverted alone, its test file run, then the file restored) | **17/17 detected** |

The revert sweep's first run detected 15 of 17. Two gaps were found:

- the idempotency-key echo had no test, so I added one;
- a page-tracker reset was redundant, so I removed it and pointed the mutation at the real check.

The rerun detected all 17. Mutations: first-allow-wins chain; foreign browser names; all-addresses-public check; revocation; effective allowlist; web ports; consumption; replay ledger; page origin; port sees the live request; approver tenant; dispose before exit; activity skips cleanup on failure; `--proxy-server`; key echo; download allowlist; overlapping page origin.

## UNRUN

Everything live remains unrun:

- the real Playwright MCP, Chromium and renderer sandbox;
- host proxy deployment and all egress measurements (DNS, rebinding, coalescing, UDP/WebRTC);
- live SDK hook precedence and permission delivery;
- the real page-report format;
- the canonical owner's handling of browser subjects;
- process-exit observation;
- artifact ingest;
- image build and scan;
- any cloud resource.

No deployment, credential, model call or migration was used.

## Proposals (local; not frozen contracts)

- **A1 — Canonical approval owner.** Accept a `meri-browser-action/1` subject as an approval kind whose digest is the `commandSha256` of the existing `ApprovalProposal`/`ApprovalDecision`. Today `Command.action` is the closed set `memory.propose|task.create|artifact.file`, so a browser subject cannot be a Command without a contract change. Add an atomic `consume({proposalId,subjectSha256,binding,toolUseId})` that:
  - re-checks current authority (unrevoked, unexpired, approver authenticated, `policyRevision` current);
  - marks the decision consumed once, durably;
  - returns the `meri-browser-approval-receipt/1`.

  Requested of the owner (dot/control): the request/receipt shapes in `approval-binding.mjs` and its tests, 30 s revocation propagation (Q-X7), and the UI fields: action, target, data, page origin, expiry.
- **A2 — Artifact owner.** Provide an ingest operation for external files that is idempotent on `idempotencyKey`, records the provenance fields and echoes the key. Content safety and native usability stay with the owner.
- **A3 — Trusted browser runtime port** (runtime and host owners):
  - `policy({binding})` runs `resolveBrowserPolicy` over Capiro platform, tenant and role records with server-side roles;
  - `egress.grant/revoke` drives a host proxy that runs `createEgressControl`;
  - `processes.waitForExit` truthfully observes the run's browser processes;
  - the installation facts include `egressProxy`.

  The execution-record `browser` binding (earlier HOLD) is still needed so restore and replay can re-check `policySha256`.
- **A4 — Prompt sentence (owner approval of exact text).** The base system prompt says Meri never performs an external mutation. Once browser interactions are active, it needs a conditional sentence like P12: "Browser interactions that may change a website run only after your explicit approval."
- **A5 — Policy tightening (optional).** `policy.mjs` admits allowlisted origins with explicit non-web ports, which egress then always refuses (`BROWSER_EGRESS_PORT`). Proposal: refuse such origins at policy write time. I left this unchanged here to avoid changing resolver behaviour.
- **A6 — Status publication.** Publish `prepareBrowserRun(...).status` to the UI event adapter so it can show the four states in checklist F1.

## Hashed rows

No row of the current candidate manifest (`scripts/qualification/assembled-image/candidate-manifest-fable-20261015g.json`) changes. Two changed files appear only in historical, immutable evidence records under `docs/qualification/candidates/`. The base bytes of both files are referenced by no manifest, so no current hashed row changes. For the record:

| Path | Old SHA-256 (base `48a27c8d`) | New SHA-256 |
| --- | --- | --- |
| `apps/worker/conversation/activity.mjs` | `741c034f3d48cfd085f25ac6d96006d7c4741db3f66b17e4adbb384ba205d3c4` | `b3ec9a50a90564cd1af28cb72fb73e1e780a7d28fc71046688df0b95c85c8304` |
| `apps/worker/conversation/options.mjs` | `7462110918f24eff9e4a6a600a26835d8af802dd21784781c9d1d1549cd3950d` | `6268a6291f5c1126b571baa0b3bf72cde7dab35cae09b373675c0ef858b34f36` |

All other changed paths are under `apps/worker/conversation/browser/**` or are new tests, and appear in no manifest.

## Known limits

- **Page binding.** The approval binds the last page report before the call. A page that script-navigates between that report and the click is not observed. Egress still refuses unlisted origins.
- **Stuck in-flight call.** If another owner's PreToolUse hook denies a call this gate already registered, that call stays "in flight". Interactions are then refused for the rest of the run; this fails closed.
- **Hook precedence.** The deny > ask > allow precedence across mounts is the documented SDK behaviour, not yet measured (checklist C1).
