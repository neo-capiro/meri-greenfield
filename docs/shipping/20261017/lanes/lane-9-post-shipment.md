# Lane 9: post-shipment features (browser takeover, authenticated websites, Office editor, device/browser bridge)

| | |
|---|---|
| Owner | Fable (Claude Code), lane-9 session |
| meri-greenfield branch | `fable/meri-lane9-post-shipment-20261017`, rebased on `de1bfd77` (tip of `fable/meri-first-chat-receiving-20261017`, PR #133) |
| Draft PR | [#141](https://github.com/neo-capiro/meri-greenfield/pull/141) into `fable/meri-first-chat-receiving-20261017`. **Hold it out of integration until the first shipment is live**, like lanes 2–8. |
| Status vocabulary | as in `../BACKLOG.md`. Everything this lane added is **source (preparation)**: pure decisions, validators and held gates with focused tests. Nothing is composed, integrated, qualified, deployed or live. No feature flag or activation gate was opened. |
| Files added | `apps/worker/conversation/browser/session/{fence,confidentiality,destruction,input,activation}.mjs`; `apps/worker/conversation/browser/site-workflows/manifest.mjs`; `apps/control/withdrawal/generations.mjs`; `apps/control/live-session/bridge-guard.mjs`; `apps/artifacts/edit-sessions/{wopi-locks,edit-session,wopi-access-token,activation}.mjs`; one test file next to each group; this file. |
| Files not touched | No existing file was edited. Untouched: `infra/product-preview/**`, `material-init*`, `temporal-issuer/*`, `native-authority/sdk-option-template.mjs`, `continuation-pin.mjs`, `apps/runtime/conversation-runner.mjs`, `packages/contracts/**`, migrations, lockfiles, frontend, `BACKLOG.md`. `apps/artifacts/edit-sessions/` is a new directory inside lane 6's `apps/artifacts/**` area. It holds new files only, so there is no merge overlap with PR #138. |
| First-chat pin | `apps/runtime/test/dynamic-sdk-options.test.mjs` **8/8** and `infra/product-preview/first-chat/runtime-values.test.mjs` **5/5**, before and after this lane's changes. The SDK option template is unchanged. |

## Summary

The four features are **required**. Neo ruled on 15 October that an initial live version ships first and these four follow it (Q-X0, Q-X1). Their design is complete as a proposal ([design revision 2](../../../coordination/proposals/FABLE-FIRST-SHIPMENT-FEATURES-DESIGN-20261015.md)). Neo has already answered most of its questions ([owner decisions record](../../../coordination/reports/FABLE-OWNER-DECISIONS-20261015.md), decisions 6 and 7).

At base `de1bfd77`, **no source existed for any of the four features** on this branch or on any remote `fable/*` or `dot/*` branch. Only the documents, a planned retention class and the reusable browser, lifecycle and artifact owners existed.

This lane adds the parts that the accepted answers already fix and that no open decision changes:
- the shared safety mechanisms S1–S4;
- takeover input admission;
- the site-workflow manifest validator (credential-free by construction);
- the vendor-neutral WOPI host decisions for the Office editor;
- the bridge relay guard.

Each feature has its own **held** activation gate, and each gate lists the outstanding owner decisions among its requirements. Once Neo decides, implementation can start from tested pieces rather than prose.

## 1. Inventory (state at base, before this lane)

"complete", "partial" and "absent" refer to source in this repository. Paths are relative to the repository root, and line numbers are at the base.

### 1.1 Decision records and design

| Item | State | Citation |
|---|---|---|
| Four-feature design (architecture, components, placement, authority, isolation, qualification) | **complete as a proposal** (revision 2, answers dot's review) | `docs/coordination/proposals/FABLE-FIRST-SHIPMENT-FEATURES-DESIGN-20261015.md:1-761`; questions at `:48-58`, `:307-315` (Q-B), `:397-403` (Q-T), `:545-554` (Q-O), `:626-633` (Q-A), `:732-739` (Q-X) |
| Owner answers to the design | **mostly recorded** (see section 3) | `docs/coordination/reports/FABLE-OWNER-DECISIONS-20261015.md:8-39` |
| Scope ledger rows and `FEATURE-DESIGN-APPROVAL` gate | complete (rows "required, not blocking the initial live version") | `docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md:498,506-508,548` |
| D005 dedicated isolated browser host | accepted (qualification not run) | `docs/coordination/DECISIONS.md:69-73` |
| D015 entry recording the 15 October scope decisions | **absent**: proposed text exists, but dot has not added it to `DECISIONS.md` | `FABLE-OWNER-DECISIONS-20261015.md:50-54`; `docs/coordination/DECISIONS.md` (no D015) |
| Open owner items carried forward | recorded | `docs/coordination/reports/FABLE-REPAIR-PACKAGE-4-20261016.md:166-172` |
| Live-lane briefs | the four features are out of scope for the live lanes | `docs/coordination/briefs/FABLE-LIVE-LANE-BRIEFS-20261016.md:23` |
| Stale scope statements that contradict decision 2 | **stale** (flagged for dot, not edited) | `docs/CAPABILITY-SCOPE.md:35` ("separately estimated/deferred"); `docs/SOURCE-INVENTORY.md:74` ("no desktop-browser/device bridge … is assumed"); `docs/UI-SPEC.md:95` ("rather than building Office editors") |

### 1.2 Live browser takeover

| Capability | State | Citation |
|---|---|---|
| Conversation browser fragment: Playwright MCP 0.0.83 over stdio, approvals, receipts, downloads | complete (source), **held** | `apps/worker/conversation/browser/server.mjs:30` (spawns the MCP CLI), `permissions.mjs:55`, `approval-binding.mjs:19-46`, `receipts.mjs:13`, `activation.mjs:15-34` |
| Browser activation gate | held (`BROWSER_EGRESS_UNQUALIFIED`) | `apps/worker/conversation/browser/activation.mjs:28` |
| Socket egress proxy, Linux qualification harness | source on lane 8 (PR #139), not at base | `pr/139: apps/worker/conversation/egress/proxy-server.mjs:67` |
| Fargate can run neither the Chromium nor the Bash sandbox; D005 host required | measured verdict (lane 8) | `pr/139: docs/shipping/20261017/lanes/lane-8-browser-bash.md` section 4 |
| Run cleanup that names the Q-T7 drain hard limit | complete | `apps/worker/conversation/browser/lifecycle.mjs:13-14` |
| Pause-family lifecycle hold (`pause`, `approval.wait`), checkpoint, resume with retirement and a new fence | complete (source); L1/L2/L4 HOLDs open | `apps/control/conversations/lifecycle/journal.mjs:30,36,47`; `service.mjs:40` |
| **Browser session owner** (`createConnection`, single execution point) | **absent** | proposed `apps/worker/conversation/browser/session/` (design `:77`) |
| **S1 fence/drain** | **absent** → added (section 2) | design `:85-125` |
| **S2 model-bound confidentiality filter** | **absent** → added (rules; parser port absent) | design `:127-152` |
| **S3 authenticated-state destruction** | **partial**: `disposeBrowserState` verifies profile/home/output removal; no fence, logout or trigger ordering | `apps/worker/conversation/browser/workspace.mjs:15`; → added `session/destruction.mjs` |
| **S4 withdrawal generations** | **absent** (only the artifact suppression generation exists) | `apps/runtime/artifacts/suppression-generation.mjs:5`; → added `apps/control/withdrawal/` |
| Screencast + input injection, live-session relay, viewer ticket, `takeover.begin/end` lifecycle controls | **absent** | design `:331-338`; contract proposals (section 5) |
| Takeover input admission | **absent** → added | design `:334` |
| Frontend viewer and lease states, Figma frames | absent in this repository (capiro-frontend is dot's; not inspected) | design `:391-393` |

### 1.3 Authenticated third-party website workflows

| Capability | State | Citation |
|---|---|---|
| Destination policy: platform maximum ∧ tenant ∧ role, never widened | complete | `apps/worker/conversation/browser/resolution.mjs:1-40`, `policy.mjs:79-85` (`checkBrowserUrl`) |
| Per-call approval of interactions (canonical subject `meri-browser-action/1`) | complete (source); the canonical owner does not accept browser subjects yet | `approval-binding.mjs:19,25`; lane 8 dependency 6 |
| Profile retention within a run; Q-A8 noted as needing the authenticated design | complete / noted | `apps/worker/conversation/browser/README.md:61-69` |
| **Site workflow manifest** (origins, IdP origins, sign-in probe, sensitive selectors, TTL, logout, ToS and qualification references) | **absent** → validator added | design `:575` |
| Approved first sites/tasks | **absent: awaiting Neo (Q-A1)** | `FABLE-OWNER-DECISIONS-20261015.md:38` |
| Initial platform destination list | **absent: still to be chosen** | `FABLE-OWNER-DECISIONS-20261015.md:17` |
| Credential custody / session vault | **absent by decision**: Q-A2 sign-in through takeover only; Q-A3 vault later. Not built here. | `FABLE-OWNER-DECISIONS-20261015.md:38` |

### 1.4 Office editor

| Capability | State | Citation |
|---|---|---|
| Typed DOCX/XLSX generation, immutable full-replacement revision with CAS parent | complete (lane 6, PR #138) | `apps/control/document-application/index.mjs:15-21,49-53`; `apps/artifacts/storage/postgres-versions.mjs:44` (`ARTIFACT_STALE_PARENT`) |
| Signed revocable download links (HMAC codec), suppression generation | complete | `apps/artifacts/storage/signed-download.mjs:19`; `apps/runtime/artifacts/suppression-generation.mjs:5` |
| Structural inspection, LibreOffice transformer, qualified-renderer port and owner | complete (owner on PR #138) | `apps/artifacts/structure/file-structure.mjs`; `apps/artifacts/office-transform.mjs`; `pr/138: apps/artifacts/renderer-qualification.mjs` |
| Editor draft data class (Q-O9: private, 7 days, destroyed on suppression or loss of access) | **planned**, no owner | `apps/control/retention/data-classes.mjs:38` |
| **WOPI host** (CheckFileInfo/GetFile/PutFile/Lock family), edit sessions, draft store, publish pipeline | **absent** → vendor-neutral decisions added | design `:420-470` |
| Editor component (Collabora evaluation, ONLYOFFICE fallback), quote, hosting | **absent**: evaluation only (Q-O2); quote request still to be sent by a Capiro person | `FABLE-OWNER-DECISIONS-20261015.md:37`; `FABLE-REPAIR-PACKAGE-4-20261016.md:171` |
| Non-head-parent lineage for "publish as branch" | **absent**: contract proposal for dot (Q-O10) | design `:454` |

### 1.5 Device/browser bridge

| Capability | State | Citation |
|---|---|---|
| Extension, pairing owner, relay, `meri_device_browser` MCP instance, CDP allowlist | **absent** | design `:225-265` |
| Destination filtering reusable for agent navigation | complete (`classifyWebUrl`, `checkBrowserUrl`) | `apps/worker/conversation/browser/public-web.mjs:30`, `policy.mjs:80` |
| Relay guard (always-denied CDP, private networks out, access-mode refusal) | **absent** → added | design `:257-259`; Q-B8 accepted |
| Access-all model, pairing model, interaction-approval classes, MCP placement | **absent: awaiting Neo** (Q-B3, Q-B9, Q-B2, Q-X2) | `FABLE-OWNER-DECISIONS-20261015.md:31-35,39` |

## 2. What this lane added (source, preparation only)

Every module is pure or works only over injected ports. None is imported by production code, and every feature gate stays held.

| Module | What it fixes now (accepted answer) | What stays open |
|---|---|---|
| `browser/session/fence.mjs:26,32` (`drainBoundMs`, `createControlFence`) | S1 states `agent → fencing → drained → user → returning`, plus `drain-unknown` and `ended`. It behaves as follows: <ul><li>New agent calls are refused at the execution point (`BROWSER_USER_IN_CONTROL`, `BROWSER_REVOKED`, `BROWSER_SESSION_ENDING`).</li><li>The drain bound is the largest in-flight timeout plus 5 s, capped at 130 s (Q-T7).</li><li>A call that settles by timeout or transport error is `BROWSER_ACTION_OUTCOME_UNKNOWN`. Its request id is never re-admitted, and its approval stays consumed.</li><li>The lease is granted only when the browser is drained **and** the hold is APPLIED.</li><li>Input from a stale epoch is dropped.</li><li>The idle lease is 10 minutes (Q-T5). Lost stream, idle timeout and revocation all leave the run paused.</li><li>Resume must be explicit and needs the filtered snapshot. Revocation forbids resume.</li></ul> | Wiring into a session owner (placement Q-X2) |
| `browser/session/input.mjs:42,50` | Q-T6: keyboard, mouse and wheel only. It refuses clipboard, drag/drop, file and audio, and admits only coordinates inside the viewport. It also has a per-lease token bucket and refuses a batch as a whole. | The named-key set and limits are a **conservative proposal** (no Ctrl/Meta/Alt chords), for review |
| `browser/session/confidentiality.mjs:23-52` | S2 rules 1–6: <ol><li>no model-bound output during a lease;</li><li>credential fields redacted (password, `one-time-code`, `cc-*`, manifest selectors);</li><li>every form value redacted after a lease;</li><li>sign-in and IdP pages withheld, and screenshots refused there;</li><li>URLs reduced to origin and path;</li><li>fail closed.</li></ol>**With no parser pinned to Playwright MCP 0.0.83, every response is `BROWSER_OUTPUT_UNFILTERABLE`.** | The real parser port, which needs the pinned package and canary qualification |
| `browser/session/destruction.mjs:26` | S3 order: fence and drain → best-effort logout (`confirmed/failed/unknown/not-defined`) → close the context → confirm exit → verified profile removal. Then: <ul><li>An unconfirmed exit never removes the profile and leaves `BROWSER_DISPOSE_INCOMPLETE`.</li><li>Crash recovery destroys the profile before any launch.</li><li>A port set that can export storage state is refused, so no vault can be wired in.</li></ul> | A real-browser server-side invalidation test (D005) |
| `browser/session/activation.mjs:17,20` | `TAKEOVER_ACTIVATION` **held**. It can never open while the browser gate is held. | Its requirements list the placement (Q-X2), the relay, lifecycle L1/L2/L4, S4 and the frontend |
| `browser/site-workflows/manifest.mjs:55,87,100,112` | Manifest validator: <ul><li>**Credential-free by construction**: any credential, cookie, token, stored-session or vault key at any depth is refused.</li><li>All origins, including IdP origins, must already be in the platform maximum.</li><li>Every interaction is approval-required (Q-A5).</li><li>The sign-in TTL is at most 8 h of inactivity (Q-A8).</li></ul>Enablement lists every unmet condition: held gate, takeover unavailable, not approved (registry **empty**, Q-A1), no legal review (Q-A4), unqualified. Run-policy narrowing never widens. | Site list (Q-A1), initial destination list, the manifest contract and its config store (dot) |
| `apps/control/withdrawal/generations.mjs:28,33,48` | S4 per-action check for the four features, using the accepted Q-X7 bounds (30 s staleness, fail closed). A bumped pinned scope refuses with the feature's code (`BROWSER_REVOKED`, `WOPI_REVOKED`, `BRIDGE_REVOKED`). The guard ages out a silent source. | The generation source and push channel (control/Core, dot) |
| `apps/artifacts/edit-sessions/wopi-locks.mjs:17` | WOPI Lock/GetLock/RefreshLock/Unlock/UnlockAndRelock/PutFile. Expiry is 30 minutes, and a lock conflict returns 409 with the current lock. PutFile needs the matching lock. | Durable edit-session store (migration from dot, Q-O9) |
| `apps/artifacts/edit-sessions/edit-session.mjs:22-61` | Admission: inspect plus revise opens in edit mode; inspect alone opens read-only. PDF is preview-only (Q-O4), desktop only (Q-O8), one editor per session (Q-O5).<br><br>Saves: every PutFile is a draft, identical bytes are deduplicated, and only an explicit save publishes (Q-O1).<br><br>Publish outcomes:<ul><li>a definite refusal keeps the draft;</li><li>`ARTIFACT_STALE_PARENT` is a conflict offering reopen or discard, and never an overwrite (Q-O6);</li><li>"branch" is offered only once dot accepts Q-O10;</li><li>anything else is an UNKNOWN barrier, lifted only by a definite reconciliation.</li></ul> | Draft store, publish pipeline, `user-edit` provenance contract |
| `apps/artifacts/edit-sessions/wopi-access-token.mjs:24` | HMAC WOPI access token, valid for 10 minutes or less and bound to the file. It uses its own domain separator, so a download-link token never verifies as a WOPI token. | Key material (lane 1, later) |
| `apps/artifacts/edit-sessions/activation.mjs:17` | `EDITOR_ACTIVATION` **held**. Its requirements list the evaluation, the quote and spending decision, placement, the draft migration, WOPI conformance and the image scan. | Vendor evaluation and quote (Q-O2) |
| `apps/control/live-session/bridge-guard.mjs:24-58` | `BRIDGE_ACTIVATION` **held**. Cookie, storage, browser-context, download, interception and `Browser.*` CDP methods are always denied, even if allowlisted. Every other method refuses until a qualified allowlist exists. Non-public destinations are always refused (Q-B8). "Access all" refuses with `BRIDGE_ACCESS_ALL_UNDECIDED`. | Q-B2, Q-B3, Q-B9, Q-X2; relay, pairing and extension |

## 3. Owner decisions (all **awaiting Neo**; nothing here decides them)

Answers Neo has already given are recorded in `FABLE-OWNER-DECISIONS-20261015.md` and are used as fixed inputs above:
- **Takeover:** Q-T1 to Q-T7.
- **Office editor:** Q-O1 and Q-O3 to Q-O10. Q-O2 is accepted for evaluation only.
- **Websites:** Q-A2 to Q-A8.
- **Bridge:** Q-B1, Q-B4 to Q-B8.
- **Cross-feature:** Q-X0, Q-X1, Q-X3 to Q-X7.

Each recommendation below is a **recommendation only**.

| # | Decision (awaiting Neo) | Source | Options and tradeoffs | Recommendation (not a decision) |
|---|---|---|---|---|
| N1 | **Q-X2, remaining placements**: the takeover session owner, the bridge MCP instance (and the schedule worker, which is outside lane 9). | `FABLE-OWNER-DECISIONS-20261015.md:26,39`; `FABLE-REPAIR-PACKAGE-4-20261016.md:168`; design `:643-652` | **(a)** Session owner inside the D005 per-conversation browser unit: the only place with a real sandboxed browser. The launch path must be requalified there.<br>**(b)** A separate process outside the unit, attached over CDP or `--endpoint`: the fence and filter cannot sit at the execution point (design `:77`).<br><br>Bridge MCP:<br>**(c)** in the conversation worker, beside `meri_browser`, so no new host;<br>**(d)** in the control relay, which turns the relay into an execution host. | **(a)** and **(c)**. Lane 8 measured that Fargate cannot sandbox Chromium, so the browser side already lives on D005. |
| N2 | **Q-A1, first sites and exact tasks**, and the **initial platform destination list** (decision 3). Without them, every site manifest is refused, because the platform maximum is empty. | `FABLE-OWNER-DECISIONS-20261015.md:17,38`; design `:626` | Retrieval/export (lowest risk; approvals still apply to every interaction) versus submission or administration tasks (higher prompt-injection and terms-of-service risk). One site versus two (the estimate assumes two). Each site needs its real origins plus its IdP redirect origins. | One retrieval/export site + task with no connector or API coverage (Q-A7). Choose its origins and IdP origins as the first entries of the initial destination list, so one decision closes both. |
| N3 | **Q-B3, the "access all" control model.** Neo asked for the option. Who enables it, at what level, and how it relates to decision 3 (tenant admins cannot widen beyond the platform maximum) are unspecified. | `FABLE-OWNER-DECISIONS-20261015.md:32,39`; `FABLE-REPAIR-PACKAGE-4-20261016.md:170` | **(a)** Platform owner only, per tenant: strongest, but least flexible.<br>**(b)** Platform owner permits it per tenant, then the tenant admin enables it: consistent with decision 3.<br>**(c)** Like (b), plus a per-user opt-in per attachment: most explicit.<br>**(d)** Tenant admin alone: contradicts decision 3.<br><br>In every option, private networks stay out (Q-B8) and consequential actions still need approval. | **(c)**: platform permit, then tenant enablement, then a user opt-in shown at attach time. Keep the trust-tier notice ("your browser's traffic does not pass through Meri's network controls"). |
| N4 | **Q-B9, pairing modelled on the Claude Chrome connector/extension**: the pairing, persistence and revocation model. Persistence implies a new stored device credential. | `FABLE-OWNER-DECISIONS-20261015.md:35` | **(a)** Session-bound pairing (the original recommendation): no persistent record, but the user re-pairs often.<br>**(b)** Persistent device-bound pairing: a non-extractable device key with expiry and renew-on-use, unpair and admin revocation, a new data class and retention. Better UX, but it adds a credential class.<br>**(c)** Persistent pairing that never auto-attaches: each conversation needs an explicit attach confirmation. | First have Fable write design section 2.2 revision 3, documenting the reference experience **from observation**. Then approve **(b)+(c)**: persistent, device-bound, revocable pairing with a bounded lifetime, and an explicit per-conversation attach. Register the device credential in `data-classes.mjs` as planned before it exists. |
| N5 | **Q-B2, which bridge interactions need per-action approval** now that the bridge must fill forms, and whether the read-only default remains. | `FABLE-OWNER-DECISIONS-20261015.md:31`; design `:257,308` | **(a)** Every interaction approved, as for authenticated sites (Q-A5): safest on the user's real signed-in sessions.<br>**(b)** Typing and selection pre-approved, with only submission-class actions approved: smoother, but submission detection is heuristic.<br>**(c)** Per-site classes, like site manifests.<br><br>Separately: keep the read-only default and require per-tenant enablement of interactions, or not. | **(a)** in v1, with `browser_fill_form` approved as one action showing the whole field set. Keep read-only as the default until a tenant enables interactions. |
| N6 | **Order of the editor and the bridge.** Neo approved prerequisites → spike → takeover → first site, but did not place the editor or the bridge. | `FABLE-OWNER-DECISIONS-20261015.md:23`; design `:687-694` | Editor in parallel versus after the first site; bridge last versus earlier. | Run the editor evaluation in parallel, locally only (Q-X6 already accepted). Build the bridge last: it has the largest new trust boundary and depends on N3–N5. |
| N7 | **Q-O2 quote request**: a Capiro person must send it (Fable has no vendor channel). Who sends it, and when? | `FABLE-OWNER-DECISIONS-20261015.md:37`; `FABLE-REPAIR-PACKAGE-4-20261016.md:171` | Send now, in parallel with the local evaluation (earlier cost visibility), or after the local fidelity evaluation (a better-informed request). | Send it after the local fidelity and fit evaluation, so the request names real concurrency and hosting needs. Fable prepares the text. |

The following coordination items are not Neo decisions:
- dot to add **D015** (`FABLE-OWNER-DECISIONS-20261015.md:50-54`);
- dot to refresh the stale scope lines (`CAPABILITY-SCOPE.md:35`, `SOURCE-INVENTORY.md:74`, `UI-SPEC.md:95`);
- dot to review the two conservative proposals in this lane: the takeover key set and the whole-`Storage`-domain CDP denial.

## 4. Tests (Windows host, Node 24, one file at a time, `MERI_REVIEW_SOURCE_ROOT=<worktree>`)

| File | Result |
|---|---|
| `apps/worker/conversation/browser/session/test/fence.test.mjs` (new) | 10/10 |
| `apps/worker/conversation/browser/session/test/input-activation.test.mjs` (new) | 5/5 |
| `apps/worker/conversation/browser/session/test/confidentiality.test.mjs` (new) | 7/7 (canary values never leak) |
| `apps/worker/conversation/browser/session/test/destruction.test.mjs` (new) | 5/5 (real temporary profile with cookie, local-storage token, IndexedDB, caches and downloads) |
| `apps/worker/conversation/browser/site-workflows/test/manifest.test.mjs` (new) | 6/6 |
| `apps/control/withdrawal/test/generations.test.mjs` (new) | 4/4 |
| `apps/artifacts/edit-sessions/test/edit-sessions.test.mjs` (new) | 6/6 |
| `apps/control/live-session/test/bridge-guard.test.mjs` (new) | 4/4 |
| `apps/runtime/test/dynamic-sdk-options.test.mjs` (first-chat pin) | 8/8 |
| `infra/product-preview/first-chat/runtime-values.test.mjs` (first-chat pin) | 5/5 |

None of these is real-browser, D005, editor, extension, Linux-image or live evidence. Every S1–S3 "live" test in the design stays **UNRUN**.

## 5. Contract proposals for dot (not edited; `packages/contracts` is shared)

Coordinate these on PR #121 before anyone edits `packages/contracts`:
1. **Lifecycle:** `takeover.begin` / `takeover.end` as pause-family controls, with fence/drain states and `BROWSER_ACTION_OUTCOME_UNKNOWN` / `TAKEOVER_DRAIN_UNKNOWN`. The shapes are in `session/fence.mjs`.
2. **Live-session viewer ticket**: single use, valid 60 s or less, bound to tenant, actor, conversation, run and session-owner instance.
3. **Withdrawal generation source and push**: the scopes and feature mapping in `apps/control/withdrawal/generations.mjs`.
4. **Site workflow manifest** `meri-site-workflow-manifest/0` (the shape in `site-workflows/manifest.mjs`) and its platform-configuration store (Q-A6).
5. **WOPI edit session, lock and draft rows**, with the draft migration (Q-O9).
6. **`user-edit` provenance** on revise, and **non-head-parent lineage** (Q-O10).
7. **Canonical approval owner**: accept `meri-browser-action/1` subjects for takeover-adjacent and site interactions (shared with lane 8, dependency 6).

## 6. Dependencies

| Item | Owner | Blocks |
|---|---|---|
| D005 browser host qualified; browser activation opened with evidence; lane 8 egress proxy integrated | lane 1 + lane 8 | takeover, sites |
| Lifecycle L1/L2/L4 HOLDs closed (exact retirement on resume) | lane 4 / runtime owner | takeover resume |
| Pinned Playwright MCP 0.0.83 in the worker image (package + lockfile), so the S2 parser can be written and qualified | image/lockfile owner (lane 1, dot) | S2 parser, session owner |
| Lane 6 artifact composition (options owner, store, renderer) live | lane 1 + dot | editor publish |
| Contract items in section 5 | dot | composition of every feature |
| Owner decisions N1–N7 | Neo | as listed |
| Figma frames for all four features (Q-X5: Fable adds them) | Fable, later session | frontend |

## 7. Acceptance

- **Source (this PR):** the eight new test files pass, and the two first-chat pin tests pass unchanged. No existing file is edited. Every gate is held, and the site registry is empty.
- **Integrated:** each module is composed by its owner only after its decisions and contracts exist: the session owner on D005 (S1–S3, input), the relay (bridge guard), the WOPI host (edit sessions), and control (withdrawal source).
- **Qualified / live:** the design's acceptance tests pass: takeover `:373-381`, sites `:601-610`, editor `:515-529`, bridge `:280-291`. They run on the real host, with the real editor and the real extension, and each gate opens by a reviewed change citing that evidence.

## 8. Remaining tasks

1. Neo: N1–N7.
2. dot: D015, the contract proposals (section 5), and the stale-doc refresh.
3. Lane 9, next steps once the inputs exist:
   - the S2 parser against the pinned package;
   - the session-owner composition (`createConnection`) wrapping the fence, filter and destruction;
   - the WOPI host routes over the edit-session decisions;
   - design revision 3 for the bridge (N3–N5);
   - Figma frames;
   - the Q-X6 synthetic spike (local only).
