# Meri deployment plan for Codex and Hermes

Prepared 9 October 2026; Revision R2 dated 10 October 2026 (America/New_York). Supersedes the prior deployment-plan revision. Save this file in the new repository as `docs/plans/MERI-DEPLOYMENT.md`; keep the accompanying updated capability workbook in `docs/plans/`. Section 10 contains the prompt to start Codex. Neither this plan nor the workbook reports implementation or qualification completion.

Build a new, independently deployed Meri workspace with the Claude Agent SDK, AI Elements, governed Capiro data and memory access, browser work, downloadable artifacts, and durable execution. Codex coordinates implementation, delegates bounded work sessions to Hermes, verifies the resulting commits, and owns integration and deployment. Hermes is a development worker; it is not part of Meri's production agent runtime.

This R2 plan and its companion updated capability workbook are the current two-file deployment handoff. They retain the defined first-release scope; any already-provided Meri Greenfield Agent Plan remains background for unaffected requirements. Agents do not need to obtain a third document to start the REL work. A runnable demo is a milestone, not release acceptance. Expect roughly two weeks for a demo, six to eight weeks for a controlled pilot, and ten to fourteen weeks for production readiness with three senior engineers and part-time platform/QA support. These are inherited planning assumptions, not a certification that R2 preserves the remaining schedule. Re-estimate from accepted deployment work, the added named-skill qualification, credentials, source access, policy discovery and qualification results at W00. Full parity with every current Meri business workflow is a separately estimated scope.

### Revision R2 — 10 October 2026

This revision preserves the existing capability inventory, isolated hosting, Figma/AI Elements interface, three mode buttons, artifact/browser workflows, governed memory/actions, Temporal durability, and Codex/Hermes working-session model. R2 additionally proposes the 14 current quick-action workflow intents for v1 original skill qualification; this is an explicit named-workflow scope clarification, not a claim of full current-Meri parity. Commitments & Deliverables remains required. W00 records the proposed selections, maps existing accepted work and re-estimates remaining skill/reliability work. It changes how retrieval, tool discovery, skills and evidence qualify for that release:

- Add one authoritative typed capability catalog and executable skill manifests; consolidate overlapping infrastructure without imposing a fixed total tool count or a giant free-text query tool.
- Establish a Claude SDK baseline with qualified native deferred tool discovery through the actual trusted model proxy. The SDK remains the sole production agent loop.
- Bind scope/identity at the server; normalize calendar/fiscal-year/version windows; separate candidate search, exact queries, and full evidence reads.
- Send selected skill identity/version and typed scope/dates from the UI; preserve Commitments & Deliverables; eliminate keyword-based memory capture, missing portfolio sources, and instructions requiring absent recipes.
- Add normalized coverage/freshness/paging/error metadata, trace/oracle diagnostics, a 75-case starting benchmark expanded to 200 cases, REL-01–REL-09 tickets, and RG-01–RG-12 proposed qualification gates.
- Evaluate OpenAI Decisions only as an optional bounded routing advisor, and JEV only as an optional calibrated evidence judge initially. Neither authorizes scope, executes tools, creates tool arguments, or blocks core release when unavailable.

The accompanying workbook retains the original inventory and adds revision, audit, gateway, reliability execution and qualification detail. R-01–R-12, REL-01–REL-09 and RG-01–RG-12 are shared identifiers across both artifacts. These are requirements and proposed gates; no new PASS claims are made.

**Authority order:** explicit user instructions and repository instructions; this R2 plan and its companion workbook revision; pinned contracts and task briefs; the earlier Greenfield Agent Plan for unaffected scope. Where an older plan suggests a fixed ten-tool interface, regex-only workflow routing, or mandatory JEV/Decisions selection, R2 replaces that recommendation. Codex records any unresolved conflict before dependent implementation and continues independent work.

## 1. Architecture and reuse requirements

Use the standalone Meri repository and independent infrastructure. Create them only if this deployment has not already established them; otherwise preserve and extend the current accepted work. Read the existing Capiro repository to discover schemas, identity boundaries, policies, source domains, and current capabilities. Do not import its agent, retrieval implementation, UI, queues, or infrastructure modules. Existing Capiro records, institutional memory, and user identity remain authoritative external sources accessed through new connectors.

| Area | Adopt | Build only the Capiro-specific part |
| --- | --- | --- |
| Agent runtime | Claude Agent SDK, its supported Claude Code runtime, built-in tools, hooks, subagents, skills, compaction, and session APIs | Tool contracts, tenant context, permission rules, and the adapter to the UI |
| Interface | Next.js, React, AI Elements and AI SDK UI transport; the linked Meri Figma section as the design reference | Implement the approved screens, interactions and states; connect them to real conversations, approvals, evidence, artifact versions and schedules |
| Browser work | One supported Playwright integration and its matching browser build | Tenant-bound browser ownership, authenticated access, action approval, and receipts |
| Durable execution | Temporal server and TypeScript SDK | Workflows for runs, approvals, schedules, execution activities, and verified checkpoints |
| Identity | Clerk's official backend SDK for the existing identity integration | Current membership, client walls, mailbox access, and resource authorization |
| Memory and data | PostgreSQL and supported source/database clients; native SDK tool discovery where qualified | One permission-aware typed catalog/gateway, source adapters, exact queries, candidate retrieval, evidence reading, governed memory and coverage/freshness contracts |
| Documents | python-docx | Original document skills, templates, validation, and revision workflow |
| Spreadsheets | XlsxWriter for creation; qualified openpyxl use for edits | Formula/reference checks, recalculation workflow, and preservation rules |
| Slides and PDF | PptxGenJS, LibreOffice, PDF.js; qualified PDF/OCR libraries | Original presentation skills, rendering, previews, and quality checks |
| Persistence | S3 and PostgreSQL | Artifact provenance, immutable versions, authorized downloads, and checkpoint manifests |
| Verification | Playwright Test, Promptfoo, OpenTelemetry and existing CI tooling | Versioned task/evidence fixtures, trace/oracle diagnostics, domain truth, policy/recovery checks and release evidence |
| Development delegation | Installed Hermes Kanban if qualified; otherwise bounded Hermes CLI sessions | Task briefs and a thin launcher only if needed |

Pin adopted versions, licenses, image digests, and compatibility evidence in `docs/COMPONENTS.md`. Check licenses before copying code or bundling skills. In particular, write original Office skills rather than assuming third-party Office skill text is freely redistributable. A custom replacement requires an observed upstream limitation and a recorded decision. Do not add another agent loop, swarm scheduler, browser framework, or workflow engine by default.

The AI SDK is the UI transport layer, not a second model orchestration loop. Use the Claude Agent SDK for Meri's agent behavior. Public search uses supported SDK tools or a qualified search provider; institutional retrieval always goes through the new authorized gateway. Optional classifiers/judges are bounded trusted-service calls, not a second agent loop or authorization service.

### Typed catalog, retrieval and skill ownership

Use one versioned catalog as the source for SDK/MCP schemas, handlers, discovery descriptions, authorization metadata, UI capability labels and qualification mappings. A shared gateway is not one generic operation: retain separate typed semantics for exact counts/status/history, evidence reading, graph paths and domain-specific comparisons. Do not expose arbitrary SQL, unrestricted table names, or a free-text `query_data` escape hatch. The gateway can use parameterized SQL internally after validating a closed operation contract.

Keep a small, measured default tool surface and discover authorized specialized tools as needed. There is no fixed total tool-count target. Merge wrappers only when their source authority, filters, semantics, output and failure behavior genuinely match. Preserve domain capabilities even when shared connectors serve several operations. Authorization is rechecked by the gateway at execution, including tools discovered earlier in the session.

The trusted control/gateway layer resolves current actor, tenant, client or authorized portfolio, mailbox/source grants, entitlements and entity IDs. UI/model-provided names and scope hints are requests, not authority. When subject ambiguity changes the answer, resolve it from authorized candidates or ask a targeted clarification. Institutional Memory is a governed source, not a keyword-triggered replacement for mail, meetings, client history or official facts.

The UI must send a selected skill's stable ID/version and typed subject/window parameters; the server pins its executable manifest to the run. Original SDK skill prose teaches the workflow. The manifest specifies required evidence, allowed operations, approval constraints, completion conditions, budgets and provenance. The gateway/control service enforces those conditions. This does not import the current Meri planner, recipes or skill code; use their behavior as reference and write the new contracts independently.

Native SDK deferred discovery is the default candidate for the new catalog. Qualify it with the pinned runtime/model and actual trusted proxy, including supported reference blocks, headers, stream events, cancellation, resume and compaction. A non-first-party proxy can change SDK discovery defaults or reject the required payload. If qualification fails, repair the proxy or pin a documented supported configuration; use a measured bounded fallback and record the limitation. Do not silently restore the old lexical discovery engine or globally preload an unmeasured full catalog.

### Figma design and UI implementation contract

Use the [standalone Meri section in Capiro 3.0 — UI Redesign](https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=439-81406) as the design and interaction reference. [Meri Home](https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=442-81437) is the primary entry. File key: `Zc2dEN5aLU47dVdsewDmiJ`; page: `411:40601`; owned Meri section: `439:81406`. Other sections of the file belong to separate Capiro frontend work.

The inspected design baseline contains 85 main frames, including five state boards; 29 overlays; 60 state examples; 15 reusable component families; and 11 named walkthrough entry points. It covers the defined standalone v1 UI capability families. Those counts describe designs, not implemented features or full parity with current Meri. The file remains editable: at W00, record the actual Figma revision or available version identifier, capture date, frame IDs and reference screenshots. Keep that snapshot in the repository so later design edits cannot silently change an active ticket's acceptance criteria.

Figma specifies layout, typography, component appearance, navigation, dialogs and representative states. Next.js/React and AI Elements provide the executable UI. Backend/event contracts specify real state transitions, authorization and outcomes. Prototype navigation is an example, not an API specification or evidence that the SDK implements the corresponding behavior. Generated Figma snippets may accelerate layout work after review; do not ship a screenshot-based UI or generated code without adopted components, real events and acceptance checks.

Create `docs/UI-SPEC.md`, `docs/UI-COVERAGE.md` and a versioned reference snapshot under `docs/design/meri/`. Record:

- Each frame, overlay, state and reusable component with its Figma node ID, release classification, implementation owner and route or component.
- Each distinct visible control with a stable UI identifier, expected transition, real API/event or local UI behavior, authorization rule, disabled/pending/error/success states, and Playwright coverage. Repeated shell controls may reference one shared contract.
- The selected conversation, tenant/client scope, run, artifact and exact artifact version carried through every action. Define close/cancel/back behavior, focus restoration and scroll position explicitly.
- Responsive behavior, light/dark tokens, keyboard interactions, labels, long-content behavior, and reference screenshots at the design's desktop, tablet and phone sizes. Use the 1440px desktop and 390px phone frames as initial baselines; record exact tablet sizes and additional breakpoints during discovery.
- Every discrepancy between the design, supported component APIs and real product behavior. Resolve it through a recorded decision; never silently omit an agreed v1 capability or represent an unavailable operation as working.

Implement the generic patterns with AI Elements and shadcn/ui primitives before writing custom UI. Map Conversation/Message/PromptInput to streaming chat; Plan/Task/Queue/Tool to run activity; Sources/InlineCitation to authorized evidence; Confirmation to governed approval; Artifact/Attachments/FileTree to files; and Context/Checkpoint/WebPreview/CodeBlock/Terminal to their applicable workspace views. Use one application event adapter to the SDK. Adopt existing preview and authoring libraries from this plan rather than building Office editors. Keep component/version/license records current; add Code Connect only if maintaining design-to-code mappings would materially help this team.

Implement the Meri / Portfolio / Modules mode switch in the Meri view, with Meri active. Do not build Portfolio or Modules content in this workstream. Keep the header, design tokens and mode-handoff contract aligned with the separate new Capiro frontend. At W00 choose and record whether the shared shell hosts a versioned Meri UI package or routes to its independent authenticated entry point. Separate UI, agent and Capiro backend repositories/deployments are compatible with that contract. Test preservation of tenant/client scope and authorized navigation when destinations exist; otherwise render explicit disabled placeholders. Do not create guessed destinations or dead links.

The UI contract preserves these v1 boundaries:

- Initial source mutations remain governed memory proposals/review, task creation and artifact filing. Approvals stay inside Meri.
- Artifact previews are read-only. Natural-language revisions produce immutable new versions; full Office WYSIWYG editing is separate scope.
- Browser access includes public browsing and individually qualified authenticated workflows. Show only the actions and upload/download permissions actually enabled for that connection; the design does not imply access to a user's whole desktop.
- Progress views show supported activity summaries, evidence and tool receipts. Do not expose private model reasoning or invent internal SDK events.
- Data coverage, current-Meri business-workflow parity, runtime isolation and durable recovery still require their own implementation and evidence. The design cannot satisfy those gates.

Keep the existing quantitative release targets and runtime architecture. This update adds design traceability and UI acceptance; it does not rebuild Capiro's backend, replace AI Elements, expand source mutations or treat a prototype as a deployed agent.

### Production boundaries

- Deploy the UI/control service, authorization/data gateway, execution broker, and Temporal services in the new trusted stack. Deploy active conversation workers separately.
- Start with one Fargate task per active conversation. Do not reuse a task across conversations or tenants. Any warm pool contains fresh, unassigned workers only.
- Give each worker a task-bound, short-lived capability. Do not give it a Capiro database login, Anthropic account key, cloud administrator credentials, or Temporal service credentials.
- Use a trusted model proxy and data gateway. Enforce permitted network paths at the infrastructure/proxy boundary; environment variables and SDK hooks alone do not create isolation.
- Run Chromium and the SDK under a qualified non-root configuration. Use a read-only container root with deliberate writable workspace paths. Fargate qualification must prove the browser sandbox works without privileged-container workarounds.
- Use ECS on EC2 or a qualified sandbox host only if a measured Fargate limitation prevents the required workload. Keep the worker interface unchanged and requalify equivalent isolation. Do not move the whole application because one browser workload needs a different host.
- Keep SDK execution inside Temporal activities or broker-managed workers. Temporal workflow code must contain only deterministic orchestration.
- Persist both SDK session state and workspace files. Resuming an SDK session alone does not restore files, browser state, or a lost process.
- Keep institutional memory in the governed source/gateway layer. Disable automatic filesystem memory using the pinned runtime's supported configuration. Use dedicated configuration/work directories and an immutable curated skill/plugin pack. Prevent uploaded `.claude` settings, project instructions, plugin configuration, and similar files from being discovered as runtime configuration; treat them as untrusted data.
- Recheck authorization for tools, stored conversation context, browser state, artifact previews, and downloads. Revocation must prevent access through previously stored content as well as new retrieval.
- Before G3, agree and record a numeric maximum revocation-propagation deadline. Target at most 30 seconds from the authoritative permission change; measure it in staging. Test live-run cancellation, denial of further publication, and access to old threads/files/previews/artifacts within the agreed bound.
- Define retention and deletion for transcripts, UI events, uploads, browser state, workspace snapshots, previews, artifacts and telemetry. Implement the lifecycle across stores, caches and authorized exports; document backup expiry and restore handling so deleted or revoked material cannot silently regain access.

## 2. Codex and Hermes responsibilities

Codex is the single integration and release owner. It discovers the environment, freezes interfaces, chooses ready tasks, assigns worktrees, reviews evidence, integrates changes, and advances deployment gates. Hermes implements bounded tickets and produces reviewable commits.

Use at most three concurrent implementation sessions and one independent review session initially. Increase concurrency only after measuring review throughput, provider capacity, and merge conflicts. Do not permit recursive, unbounded delegation.

| Lane | Owner | Scope |
| --- | --- | --- |
| A | Hermes implementer | Runtime qualification, worker image, execution broker, checkpoints, infrastructure, Temporal |
| B | Hermes implementer | Source inventory; typed catalog/adapters, authorization, normalized evidence, governed memory and selected commands; REL-02/REL-03/REL-06 scoped tickets |
| C | Hermes implementer | Figma-mapped AI Elements workspace, explicit skill identity/manifests, UI coverage ledger, shell integration, artifact records, native file generation, previews and original skills; REL-04 scoped tickets |
| D | Separate Hermes reviewer/session | Independent trace/benchmark/domain-truth, policy, browser, UI behavior/visual/accessibility, artifact, recovery and load verification; separate optional-router/judge reviews |
| Integration and release | Codex | Shared contracts, dependency order, migration allocation, conflict resolution, final checks, deployments |

A worker may propose an interface change, but Codex approves and integrates it before dependent work begins. Give each task a base commit and owned paths. One session owns a shared file, lockfile, migration, or contract at a time. Reserve migration identifiers centrally.

Do not give implementation workers unrestricted infrastructure deployment credentials. A worker can build infrastructure code and validate a synthesized plan; Codex executes authorized deployment actions. No worker independently changes Capiro's existing infrastructure or publishes a production release.

## 3. Bootstrap on the actual execution host

Codex first performs read-only discovery. Locate the installed Hermes executable, its profiles, the actual repository, worktree location, and available credentials. A Windows drive root or remembered AWS jumpbox is only a location clue.

Inspect:

```text
hermes --version
hermes --help
hermes chat --help
hermes kanban --help
hermes profile list
hermes doctor
```

Inspect Git remotes and status, the existing Capiro repository instructions, Node/Python/container tooling, AWS CLI/CDK versions, AWS account identity, regions, and existing deployment conventions. Do not print tokens or secret values. Use `aws sts get-caller-identity` with the discovered authorized profile; record the account and role rather than assuming a deployment destination.

Confirm the new repository owner/name before creating it. Names such as `meri-agent-dev`, `meri-agent-staging`, and `meri-agent-prod` are proposed stack labels, not discovered resources. Prefer a separate AWS account; if sharing an account, use independent stacks, roles, databases, buckets, keys, and budgets.

Record in `docs/coordination/STATUS.md`:

1. Repository and integration branch, current commit, and existing work to preserve.
2. Execution host, Hermes version, selected profiles, and supported invocation mode.
3. AWS targets, credential mechanism, source endpoints, Clerk integration, and DNS ownership.
4. Selected capabilities, source inventory, REL/R/RG mappings, measured baseline, unresolved decisions and blockers.
5. Current gate, evidence links, task/session identifiers, and next ready tasks.

Ask only for genuinely missing access, a material scope choice, or an action requiring authorization. Continue independent work while a source or account is blocked. Do not upgrade Hermes, change global model settings, or create a second gateway dispatcher merely to fit this plan.

### Repository layout

```text
apps/web/                 AI Elements workspace and UI transport
apps/control/             Conversations, run APIs, approvals, Temporal workflows
apps/worker/              Claude Agent SDK, workspace, browser and artifact execution
apps/gateway/             Current authorization, source tools and model/data proxy
packages/contracts/       Versioned catalog, skill invocation/manifests, evidence, events, proposals, artifacts and checkpoints
packages/skills/          Original skills and templates
infra/                    New CDK stacks and environment configuration
evals/                    Promptfoo, held-out retrieval/domain truth, policy fixtures, Playwright UI/visual and recovery checks
docs/plans/               Architecture and this deployment plan
docs/design/meri/         Pinned Figma references, frame IDs, screenshots and UI decisions
docs/coordination/        Status, decisions, task briefs and worker reports
docs/                     Components, UI spec/coverage, source inventory, capability parity, routing and evidence contracts
```

Use the installed Hermes board as the task-status authority when qualified; `STATUS.md` is Codex's dated projection and handoff. Git task briefs are the authoritative task contracts. If Kanban is unavailable, use one Git-backed task ledger and the CLI fallback rather than inventing a replacement scheduler.

## 4. Work queue and dependency order

Each row is a work package split into one- to two-hour Hermes tickets. Those are session limits, not estimates that a package will finish in two hours. Codex continually assigns the next ready ticket until the accepted scope is complete.

| Package | Owner | Depends on | Required output |
| --- | --- | --- | --- |
| W00 Discovery and scope | Codex, read-only Hermes support | Access to environment | Source inventory; selected/deferred capability ledger; account/repository decision; pinned Meri Figma baseline and shared-shell decision; REL-01 baseline/trace plan |
| W01 Shared contracts | Codex with one Hermes session | W00 | Versioned catalog, typed operations, skill invocation/manifests, normalized evidence, events, proposals and artifact/checkpoint schemas; REL-02; fixture and UI control/state mappings |
| W02 Runtime qualification | A | W00–W01 | SDK/Fargate/browser/model-proxy spike, native discovery compatibility and Temporal production-topology decision; REL-05 runtime-only checkpoint, not its later end-to-end acceptance |
| W03 Isolated foundation | A | W02 | New CDK stacks, OIDC CI roles, persistence, networking, secrets, deployment/runbooks |
| W04 Authorization and reads | B | W01/REL-02; W03 for live integration | Two-tenant and within-tenant fixtures; exact/search/evidence adapters; memory read; source coverage/freshness/paging; REL-03 and REL-06 |
| W05 Durable runs | A | W02–W03 | Broker ownership/fencing, SDK SessionStore, file checkpoints, events, approvals and schedules |
| W06 Workspace interface | C | W01/REL-02; W05 for integration | Figma-mapped AI Elements screens and responsive states; explicit skill ID/version/scope/dates; real streaming, history, stop/steer/resume/fork, approvals, files, evidence and schedules; three mode buttons; REL-04 |
| W07 Artifacts and browser | C, sequential scoped tickets | W02; W04–W06 for authorized integration | Native files, render/revise/download workflow; public browsing, then qualified authenticated work |
| W08 Selected mutations | B | W04 passes; W05 | Memory proposals, tasks and artifact filing with approval, idempotency and receipts |
| W09 Independent verification | D | Starts with W01; expands as packages land | Held-out RG suite and oracle checks, adversarial policy suite, UI behavior/visual/accessibility, browser/artifact/recovery/load evidence; independent REL-06/REL-09 acceptance |
| W10 Staging candidate | Codex; D verifies | W03–W09 accepted | Immutable candidate deployed and complete release evidence |
| W11 Controlled release | Codex | W10; release authorization | Internal allowlist, bounded tenant canary, production rollout and rollback evidence |

Freeze contracts before parallel implementation; downstream UI and gateway work may use fixtures while live infrastructure is being qualified. Integrate reviewed dependency commits before launching dependent live-integration tickets. Scope expansion goes in the capability ledger with its own estimate and gates.

Inventory current Meri from the actual repository. The 10 October audit at `fd8765ec01d292013758606204f2c9d886cd31c1` identified 139 native business capability IDs; recheck the current count, aliases and deployed tenant flags. This count is not the number exposed on every turn or the target count for the new SDK catalog. Access to all agreed data domains does not mean every existing business workflow is implemented. Every selected capability needs a new typed implementation/workflow and passing behavior/policy fixtures. Consolidated IDs map to their replacement operations; every deferred item remains visible in the workbook and Git ledger.

## 4.1 Retrieval, tool and skill reliability workstream

This workstream qualifies the new implementation, not an in-place repair or import of current Meri. It runs within W00–W09 and uses their existing lanes, worktrees and review process. Source audit findings identify regression cases; only end-to-end traces and frozen fixtures establish live cause and measured improvement.

### Audited baseline and regression cases

Reference commit: `neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1`. Record the deployment SHA, flags and source availability separately when collecting live traces. Current governed turns bypass historical V3 recipe planning; do not assume both historical and current planners execute on the same turn. Current authorization, canonical registries and coverage safeguards are useful behavioral requirements even though the new implementation is independently written.

| Audit finding | Pinned behavioral reference | Required new behavior / regression |
| --- | --- | --- |
| Calendar phrases can fall through to a 30-day change window; early portfolio selection can omit a requested window or required domains | `apps/api/src/meri/meri-context-plane.service.ts` | R-03/R-04: exact calendar/timezone boundaries; weekly portfolio fixtures require the requested window and all manifest-required sources |
| Memory-keyword checks can capture a broader relationship-history request | Same Context Plane; relationship quick-action prompts in `packages/shared/src/meri-skills.ts` | R-07/R-08: explicit skill or resolved task intent owns source requirements; mentioning memory cannot restrict the whole task to memory |
| UI quick-action text loses selected skill ID/version before the stream request | `apps/web/src/vnext/meri/VNextMeriComposer.tsx`; `apps/web/src/components/chat/useMeriChatController.ts` | R-07: typed invocation survives submit, steering, reconnect, resume and fork with an explicit version policy |
| Regex family selection and lexical discovery can miss paraphrases; actual exposure depends on gateway mode and flags | `apps/meriv2-orchestrator/src/meri/meriv3/meri-semantic-tool-gateway.ts`; `meri-progressive-tool-discovery.ts` | R-01/R-06: qualify the SDK catalog with synonyms, extra words, mixed-domain requests and unavailable tools; log mode and exposed/discovered operations |
| Overlapping search names hide materially different methods and coverage: capped substring/recency discovery versus narrow semantic knowledge retrieval versus canonical retrieval | `apps/api/src/meri/meri-tools.service.ts`; `apps/api/src/embeddings/client-kb.service.ts` | R-04/R-05: explicit candidate, exact and evidence contracts; normalized method/coverage/paging/freshness; no false negatives from snippets or capped candidate sets |
| A description requires high-level recipes that governed turns remove | `apps/meriv2-orchestrator/src/meri/meriv3/meriv3-retrieval-assistant.service.ts` | R-01/R-08: no schema/skill description references an unavailable operation; contract lint and representative replay |
| Historical skill prose/required-tool metadata is not uniformly enforced; governed procedures have stronger enforcement | `apps/api/src/meri/meri.service.ts`; `meri-procedure-runtime.ts`; `skills/commitments-audit.procedure.ts` | R-07/R-08: one executable manifest resolver; preserve procedure protections without forcing every ordinary question through a comprehensive workflow |
| Current JEV duties are evidence/client judgments, not tool routing; calibrations are provisional | `apps/meriv2-orchestrator/src/meri/jev/jev-provider.factory.ts`; `packages/meriv2-core/src/jev/task-registry.ts` | R-12: establish task-specific labelled calibration and abstention before evidence gating; no production router claims based on current JEV integration |

The pinned directory paths are audit references, not code to copy. Recheck filenames in the discovered repository and link exact lines/commits in `docs/RETRIEVAL-AUDIT.md`. Topic-based effort escalation is a qualification hypothesis until replayed: a simple budget/status question must not become a long research run merely because it names defense, legislation or a portfolio. The workstream must distinguish observed source behavior from an unverified production incident explanation.

### Shared requirements

| ID | Requirement and implementation boundary | Acceptance evidence |
| --- | --- | --- |
| R-01 | Canonical catalog and typed operations: one source for schemas, adapters, descriptions, availability, authority and eval mappings; no fixed total count, giant free-text query operation or raw SQL exposure | Catalog/handler drift checks, distinct operation examples, selected/deferred/replacement mapping, unavailable-recipe lint |
| R-02 | Server-bound scope/entity identity: bind current actor/tenant/client or authorized portfolio, grants and entity IDs; validate model/UI scope requests; reauthorize every read/write/publication | Same-name clients, pronouns/follow-ups, denied IDs, portfolio/client/personal distinctions, revocation and within-tenant fixtures |
| R-03 | Calendar/FY/version windows: calendar periods, relative durations and fiscal years are distinct; normalize timezone, inclusive start/exclusive end, document version and funding stage | This/last week, Monday/Sunday policy, DST, month/year boundaries, last seven days, fiscal-year rollover and conflicting version/stage fixtures |
| R-04 | Candidate search/exact query/source-read distinction: hybrid candidate discovery where useful; typed authoritative counts/status/history/comparisons; full decisive passage reads | Search coverage versus enumerated counts; late-body match; multi-source history; bill version/status and PE identity/budget-stage truth |
| R-05 | Normalized evidence/coverage/freshness/paging: consistent envelopes, explicit status and method, authorized citations, source versions, filters and continuation | Partial/unavailable/stale/empty/truncated fixtures; no absence claim from incomplete coverage; exact-version evidence continuity |
| R-06 | Native SDK discovery and proxy compatibility: small measured default surface and authorized domain discovery through pinned supported model/runtime/proxy | End-to-end reference/stream/header/compaction/resume compatibility; adversarial catalog recall; observed token/call/latency evidence |
| R-07 | Explicit skill invocation and executable manifest: selected ID/version plus typed scope/dates; manifest pins required evidence, allowed operations, approval constraints, completion and budget | Submit/steer/reconnect/resume/fork fixtures, manifest validation, active-version migration policy and required-source completion checks |
| R-08 | Scoped original skills including Commitments: preserve the 14 quick-action workflow intents as proposed v1 selections; qualify their promises; ordinary questions remain lightweight | Skill-by-skill expected evidence/output rubric; Commitments proof/owner/date/ambiguity/dedup/coverage fixtures; no forbidden source widening |
| R-09 | Complexity budget and bounded recovery: budget follows requested work and evidence, not a domain keyword; direct known-ID lookup avoids unnecessary discovery; recovery follows diagnosed failure | Simple versus comprehensive paired fixtures; no blind repeated search; explicit partial/clarify/block outcomes; enforced runtime/token/tool budgets |
| R-10 | End-to-end trace/oracle diagnostics: correlated route, arguments, result coverage, evidence read and final claims; correct-tool and correct-evidence runs localize failure | Replayable redacted traces, failure taxonomy, original/oracle comparisons and per-stage timings/costs |
| R-11 | Optional Decisions routing benchmark: bounded choice/predicate/score advice, multi-source coverage, abstention/fallback, no authority or argument generation | SDK baseline first, paired held-out shadow trials, calibrated confidence, outage/timeout tests and independent adoption decision |
| R-12 | Optional calibrated JEV evidence benchmark: task-specific passage relevance/claim support/client-fit improvement with abstention; no unsupported tool-router integration | Human-labelled gold data, withheld-evidence/authoritative-state safeguards, calibration plots, error slices and fallback tests |

R2 proposes the 14 current quick-action intents as named v1 skill selections, all pending qualification. This adds explicit workflow selection where the earlier inventory did not select every named recipe. W00 must record/re-estimate that scope against accepted standalone work; the workbook must show proposed/pending status rather than implemented. Retain existing intent/prompt descriptions as qualification references and write original versioned SDK skill content and executable manifests. Six historical built-ins and firm/self-service skill management retain their existing inventory classifications and separate parity decisions. They are not silently declared fully implemented by R-08. Preserve any already-selected firm-skill capability from the original ledger, with the same typed invocation and manifest requirements.

For Commitments & Deliverables, preserve promises versus suggestions, known versus unknown owner/date, evidence of delivery, conflicting statements, deduplication and disclosed source coverage. Task creation is a separate governed action, never an automatic consequence of extracting a suggested commitment. Memory proposals/review, task creation, artifact filing/version/download and schedule lifecycle retain explicit contracts and approval rules. SDK `Read` acts only after authorized file delivery; it does not replace ingestion, source authorization, provenance or artifact filing.

### Contract deliverables

Codex freezes these before dependent adapter/UI/runtime work:

- `docs/CAPABILITY-CATALOG.md` and `packages/contracts/` definitions: stable capability ID/version; source authority; precise selection examples and limitations; closed input/output schema; aliases; side effects; required grants; handler; discovery terms; retry/error taxonomy; retirement/replacement map; R/REL/RG and fixture IDs.
- `docs/RETRIEVAL-CONTRACT.md`: authorized entity resolution; calendar/FY/version normalization; exact query/search/source-read modes; source inventory; authoritative versus derived/approved-memory distinctions; continuation and negative-assertion policy.
- `docs/SKILL-CONTRACT.md` and immutable manifests: ID/version, source requirements, legal operations, subject/window inputs, artifact/output rubric, completion obligations, budget, approval boundaries and version policy for existing runs.
- `docs/ROUTING-EVALUATION.md`, versioned `evals/` fixtures and `docs/RETRIEVAL-AUDIT.md`: deployed baseline settings, held-out split, scoring, confidence/abstention calibration, oracle protocol, measured performance budgets, optional-service adoption decisions and exact candidate evidence.

A client-side selected-skill request has this logical shape; field names can change only through a reviewed versioned contract:

```json
{
  "skill_id": "relationship-brief",
  "skill_version": "1.0.0",
  "scope_request": { "kind": "client", "entity_id": "authorized-client-id" },
  "window_request": {
    "basis": "calendar-week",
    "expression": "this week",
    "timezone": "America/New_York"
  },
  "prompt": "Prepare this week's relationship brief."
}
```

The server binds identity and authorization, resolves the supplied subject, returns and stores the normalized window with exact timestamps/week policy, and pins the manifest before execution. A request is not preauthorized merely because an ID appears above. UI date selection may supply explicit dates; text-derived and selected dates must converge to the same normalized contract. If the UI modifies an explicit workflow into a different goal, resolve the change deliberately and record whether the skill version/manifest was preserved or replaced.

Every evidence response contains at least:

| Field group | Required content |
| --- | --- |
| Outcome | `complete`, `partial`, `empty`, `unavailable`, `denied`, or `error`; stable reason/error code and retryability |
| Request identity | Request/trace ID, operation/version, server-resolved subject scope, normalized dates/FY/version and applied filters |
| Authority and method | Source/system, authoritative/derived/approved-memory designation, exact/search/read method, source snapshot/version and adapter version |
| Evidence | Stable record IDs, authorized citations/locators, extracted relevant passages or full-read handles, snippet/full-read distinction |
| Coverage | Sources requested/checked/unavailable, enumerable count when known, returned count, truncation, cursor/page status, searched range/history limits |
| Freshness | Source synchronization/as-of timestamps, retrieval timestamp and explicit stale/unknown status |
| Continuation | Authorized next cursor/read handles and required follow-up for decisive passages or incomplete enumeration |

Do not invent a total count for a vector candidate search. An exact aggregate uses the authorized underlying source and validated filters; it cannot infer a count from top-k candidates. A snippet is a discovery aid, not proof that the relevant later passage was read. Evidence handles are opaque, scope-bound and reauthorized at use. Complete negative statements require complete relevant coverage; otherwise state what was checked and what remains unavailable.

### Bounded routing and evidence services

The first accepted baseline uses Claude Agent SDK selection, the qualified catalog and server contracts. OpenAI Decisions is an optional trusted-tier advisor: the public-beta API currently supports choice/predicate/score outputs with `gpt-6-luna`. It does not generate arbitrary argument JSON or execute tools. Confirm current account availability, endpoint/model support and version at qualification rather than assuming access.

Benchmark choices such as exact lookup, relationship history, legislation, defense-budget comparison, or clarification after authority filtering. Multi-source requests must allow several relevant families or a multi-source branch; a single winning family cannot suppress manifest-required evidence. Calibrate confidence/abstention from labelled data. Advice can prioritize discovery, but Claude retains the loop and the gateway retains authority. Use one bounded call only where measured benefit justifies it; outage, unsupported beta, timeout, uncertainty or rejected advice falls back to the accepted SDK baseline. Do not add mandatory serial classifier calls to every known-ID lookup.

Current JEV integration is an evidence/client judge and its registrations are provisionally calibrated. Begin with relevance/support/client-fit evaluation after candidate retrieval. A judge cannot recover a never-retrieved record or replace authoritative counts/status, mandatory source reads or domain invariants. Preserve required evidence and log exclusions/abstentions. A future JEV routing task requires its own explicit contract, labelled benchmark and adoption decision; it is outside the initial R-12 role. Do not chain JEV and Decisions as mandatory selectors. Optional shadow results do not affect user scope, committed actions or required baseline coverage.

### Diagnostics and benchmark protocol

REL-01 starts with 75 representative real requests, including successful cases and the user's reported failures. Expand to at least 200 versioned cases spanning paraphrases, mixed domains, pronouns, ambiguous identities, selected skills, calendar/FY/version edges, denied grants, missing/stale sources, late-body evidence and source outages. Keep the original release task and policy suites; the reliability cases may overlap only where their labels and scoring fully satisfy both purposes.

Freeze case IDs, authorized source snapshots/as-of times, expected subject/window, accepted operation routes, exact filters/arguments, labelled answer-bearing records, required evidence coverage, expected grounded facts and allowed clarification/abstention outcomes. For Recall@10, freeze atomic discovery retrieval units with at most 10 gold answer-bearing records; do not remove gold records to make that metric attainable. Comprehensive history/enumeration cases with more than 10 required records qualify completeness/paging under RG-05/RG-12 instead. Use distinct development/calibration and held-out sets; group near-duplicate paraphrases and source snapshots so they cannot leak across splits. Do not tune descriptions, thresholds or prompts on the held-out set.

For every evaluated request retain redacted, access-controlled evidence of:

1. Actor/grants, requested and resolved subject, requested and normalized dates/FY/version, selected skill ID/version/manifest, deployed model/runtime/proxy/catalog flags.
2. Available/exposed/discovered operations, selection and argument validation, rejected route reasons and permitted fallback.
3. Per-call result status, coverage/freshness/paging, read handles actually resolved, decisive passages and claim-to-source mapping.
4. SDK round trips, data/tool calls, recovery attempts, subagent/classifier/judge calls, p50/p95 timings and measured usage/cost for all attempts.
5. Final output, rubric score, human adjudication and failure stage: intent/scope, discovery/selection, arguments, retrieval/index/source, evidence read, skill completion, synthesis or environment.

Use existing OpenTelemetry and Promptfoo mechanisms; add a thin fixture adapter only as needed. First replay the original path. Then run a correct-tool oracle with accepted arguments and unchanged authorization/source snapshot. Finally run a correct-evidence oracle using the gold authorized evidence. If the correct-tool/argument oracle still retrieves the wrong or incomplete evidence, investigate adapters/query/index/source/coverage. If it retrieves the right evidence but the answer remains wrong, continue to later layers. If the correct-evidence oracle still produces an incorrect result, investigate synthesis/skill/domain handling. Report interacting failures rather than attributing every bad answer to routing.

Compare the accepted SDK baseline against optional Decisions shadow and optional JEV evidence shadow separately. Use paired cases and report denominators, absolute/relative errors, calibration, abstentions, confidence intervals and important domain/source slices. A high confidence score is not evidence of calibration. If the held-out data are too small to support an adoption claim, keep the optional service in shadow and collect more labelled cases.

### Execution tickets and safe parallelization

Each REL ticket is decomposed into bounded Hermes sessions under section 5. Codex owns contract integration, acceptance and the next ready ticket. D reviews the exact implementation commit independently. Task briefs carry R/REL/RG and capability/skill/fixture IDs so workbook rows map to executable evidence.

| Ticket | Owner / paths | Dependencies | Required deliverable and review evidence | Required IDs |
| --- | --- | --- | --- | --- |
| REL-01 Traces and baseline | Codex + B/D scoped sessions; `docs/RETRIEVAL-AUDIT.md`, `evals/` baseline fixtures | W00; read-only current-Meri trace/source access where available | 75-case initial set, failure taxonomy, deployed settings, source snapshots, oracle protocol and measured budgets; inaccessible production traces explicitly blocked | R-09/R-10; RG-09 |
| REL-02 Contracts and catalog | Codex + one B session; `packages/contracts/`, catalog/retrieval/skill docs | W00 discovery accepted; W01 contract ownership allocated; REL-01 inventory findings (REL-02 contributes to W01 completion) | Frozen typed operations, scope/window/evidence/skill contracts, handler/schema/description mapping and unavailable-recipe checks | R-01–R-05/R-07; RG-02/RG-07 |
| REL-03 Retrieval adapters | B; `apps/gateway/` source adapters, scoped fixture files | Accepted REL-02; W03 for live source checks | Independently written exact/search/read adapters with coverage/freshness/paging; memory/client/portfolio and selected domain truth fixtures | R-02–R-05; RG-02–RG-05/RG-07/RG-12 |
| REL-04 Skills and UI identity | C; `apps/web/`, `packages/skills/`, owned manifests/UI ledger | Accepted REL-02; W05 for resume/fork integration | Typed explicit invocation, original scoped skills, Commitments, required evidence/completion, calendar/portfolio/memory regressions and Playwright checks | R-03/R-07/R-08; RG-02/RG-06/RG-12 |
| REL-05 SDK discovery and loop | A; `apps/worker/`, trusted proxy integration; Codex owns catalog shared changes | Runtime checkpoint: accepted REL-02 and W02 spike environment ready. Final end-to-end checkpoint: accepted REL-03/04 and W03/W05 integration | Runtime-only discovery/proxy evidence contributes to W02 before W03. Later lightweight baseline, budgets/recovery, resume/compaction and adversarial integration evidence qualify under W09 | R-01/R-06/R-09/R-10; RG-01/RG-08/RG-09/RG-12 |
| REL-06 Benchmark and domain truth | D with scoped B evidence support; `evals/`, `docs/ROUTING-EVALUATION.md` | REL-01; accepted REL-03/04/05 baseline | Expanded 200-case frozen suite and held-out labels, exact domain truth, oracle diagnostics, baseline result manifest and independent adjudication | R-01–R-10; RG-01–RG-09/RG-12 |
| REL-07 Optional Decisions shadow | B/A scoped new adapter; separate D review | Accepted REL-06 baseline; actual API availability | One bounded advisor, multi-source/abstention/fallback fixtures, paired held-out improvement and latency evidence; adopt or remain disabled | R-11; RG-09/RG-10 |
| REL-08 Optional JEV shadow | B scoped trusted judge adapter; separate D review | Accepted REL-06 baseline; task/model availability | Labelled evidence calibration, required-evidence safeguards, paired quality/latency evidence; adopt or remain disabled | R-12; RG-09/RG-11 |
| REL-09 Integration and canary | Codex; D reviews exact candidate | Pre-staging checkpoint: accepted REL-03–REL-06, W04–W08 and prior W09 checks; promoted optional services only. Canary checkpoint: W10 accepted, then W11 authorization | Pre-staging trace/reconnect/revocation/full-read/RG evidence completes W09 for W10. Post-staging immutable candidate and bounded canary evidence complete the ticket under W11; canary is not a W09 prerequisite | R-01–R-12 as applicable; RG-01–RG-12 as applicable |

Package dependencies refer to their required checkpoints, not a circular requirement to complete every subtask first. REL-05 has a runtime-only checkpoint contributing to W02 before W03/W05, then a separate full integration checkpoint under W09. REL-09 has a pre-staging integration checkpoint contributing to W09/W10, then a post-staging canary checkpoint under W11; report their statuses separately. Contracts land before REL-03/04/05 write dependent code. B adapters, C UI/skills and A SDK qualification may then run in separate owned paths using the accepted fixture contracts. Expand the full held-out evaluation only after baseline integration; D can prepare fixtures independently earlier. Optional REL-07/08 never block release of a passing SDK baseline. An adopted optional service carries its own gates and independent kill switch.

### Agents already deploying: resume and integrate R2

Do not create another repository or replace existing qualified infrastructure merely because this revision was delivered. Codex first inventories the current standalone deployment branch/worktrees, accepted commits, candidate digests, current W/G status, Hermes task/session IDs, live processes, contract versions and evidence. Preserve existing work and explicitly identify which R/REL/RG requirements it already satisfies.

Apply missing REL tickets incrementally from the current accepted integration commit. Before altering shared contracts, record affected adapters/UI/workers/in-flight runs, reserve their owned paths, and publish an additive version/migration compatibility decision. Pause only dependent tickets whose contract changed; continue independent work. Resume an in-flight Hermes session by its explicit ID when compatible, or issue a scoped repair/integration task with its pinned handoff. Do not discard worktrees, reset the shared checkout, relaunch a second dispatcher, rerun accepted checks without cause, or redeploy existing stacks as an assumed clean start.

The initial R2 handoff should state: preserved work/evidence; current deployment target and immutable candidate; unmet R requirements; ready REL tickets and owners; changed-contract compatibility; proposed RG budgets; optional-service disabled/shadow status; and the next gate. A file delivery alone does not authorize a production rollout that was not previously authorized.

## 5. Launching and supervising Hermes

First qualify one small task through the installed Hermes version: launch, edit a fixture, run checks, checkpoint, resume, and return a commit. Verify its working directory, agreed write scope and intended tools. A Git worktree is an editing boundary, not a filesystem security sandbox: local Hermes inherits host-user permissions. Qualify a separate OS/container sandbox if restricted host access is required.

### Preferred mode with Hermes Kanban

Inspect existing boards before creating a dedicated `meri-greenfield` board. Confirm the installed help supports board/task creation, dependencies, worktree selection, runtime/retry bounds, and review handoffs. Use its native features instead of building a scheduler.

Exactly one gateway dispatcher owns the board. Do not run a second dispatcher or share the board database over a network filesystem. Use the documented dry-run and diagnostic commands before activating dispatch.

Each card references its Git task brief, pinned base commit, branch/worktree, dependencies, assignee, idempotency key, maximum runtime, and retry limit. Use structured arguments for card creation. Set `--max-retries 1` initially: the documented dispatcher blocks after the first unsuccessful attempt, allowing Codex to inspect it before another attempt. Workers update heartbeat/status and request review through Hermes's built-in Kanban tools. Codex verifies the commit and evidence before accepting the task.

Create/promote a live dependent card only after Codex has accepted and integrated its dependencies. Keep future packages in the Git queue until then. A worker's completion status must not automatically launch downstream integration against an unreviewed commit. Configure concurrency for the dedicated orchestration context, without changing unrelated Hermes sessions.

Keep retries bounded. Inspect each attempt before retrying; authentication, billing, quota, or repeated provider failures require resolution rather than an automatic retry loop. Qualify how the installed version preserves context between attempts.

### Fallback with bounded CLI sessions

These forms are documented as of this plan's date. Confirm them against installed help. Replace uppercase placeholders with discovered values; pass them as process arguments rather than pasting task text into a shell.

```text
hermes -p PROFILE --in WORKTREE chat --oneshot --query-file TASK_FILE --format stream-json --max-turns 120

hermes -p PROFILE --in WORKTREE chat --resume SESSION_ID --oneshot --query-file FOLLOWUP_FILE --format stream-json --max-turns 120
```

Use an argument array through the execution host's process API. Capture stdout JSONL, stderr, process ID, start time, explicit session ID, terminal result, and OS exit status. Store scrubbed logs with the task evidence. Set a runtime deadline in addition to the turn limit.

Do not use `--resume latest` for parallel work, bypass repository instructions, or globally enable unrestricted execution. Only one live process may write a worktree. Before restarting, establish whether the previous process is still alive and inspect its Git state.

### Codex acceptance loop

1. Select a task with accepted dependencies and no path ownership conflict.
2. Create a dedicated branch/worktree from the pinned integration commit; write the task brief.
3. Launch Hermes, recording the task, process and session identifiers.
4. Monitor actual progress through tool results, Git changes and check output. A heartbeat alone is not progress.
5. Collect a commit and handoff. A successful process exit means the session ended, not that the task passed.
6. Have a separate review session examine that exact commit, acceptance criteria, and evidence. Re-run meaningful checks independently.
7. Resolve findings in the same bounded session or a new repair ticket. Integrate only accepted commits.
8. Re-run affected integration checks, update the board/status, and launch newly ready tasks.

At a deadline, blocked tool, or context limit, have Hermes persist a handoff before interruption when possible. Preserve the worktree. Resume the explicit session for the same task if compatible; otherwise start a new session with its pinned commit and handoff. Never silently discard partial changes or mark a blocked task complete.

## 6. Deployment gates

Advance environments only when the evidence passes. Work on independent packages can continue while an environment gate is blocked.

| Gate | Required evidence |
| --- | --- |
| G0 Discovery | Real account/repository/region/identity/source decisions; selected capability/data inventory; pinned Figma/UI/shell decision; current deployment/session evidence preserved; REL-01 audit/baseline plan; no guessed target |
| G1 Qualification | Pinned SDK/runtime/UI/browser/Office/Temporal components; Fargate sandbox, actual-proxy native discovery (RG-08), interrupt/resume/checkpoint/egress spike; accepted REL-02 contracts; Temporal persistence/authentication/TLS/backup/upgrade design; measured cohort budgets frozen |
| G2 Isolated development | New stack deployed with source connections disabled; seeded identity/policy fixtures; task capabilities, restricted IAM/network paths, encryption, and conversation ownership pass |
| G3 Read-only data | One client and memory, then all agreed domains; exact/search/full-evidence/coverage/freshness/paging, calendar/FY/version and authority fixtures (RG-02–RG-05/RG-07); measured revocation deadline and tenant/within-tenant policy checks pass |
| G4 Execution workspace | SDK baseline plus Figma-mapped UI/artifact/browser integration; selected skill ID/version/manifest and evidence completion (RG-06); native discovery/reconnect/full-read/recovery (RG-08/RG-12); real walkthroughs, worker loss, approval wait, cancellation and fencing pass |
| G5 Selected commands | Immutable proposals, approval expiry, current authorization, revocation, idempotent outcomes and receipts pass; repeated delivery creates zero duplicate mutations |
| G6 Staging | Exact immutable candidate passes original full suite, frozen reliability benchmark (core RG-01–RG-09/RG-12), Figma/UI/visual/accessibility, retention/deletion, rollback/restore/workflow compatibility; RG-10/RG-11 additionally pass only for promoted optional services |
| G7 Controlled release | Internal users, then bounded tenant allowlist; observe routing/evidence/task quality/latency/cost/error; optional services have independent bypass; release owner authorizes the exact candidate before broader rollout |

Authenticated browser actions qualify individually after public browsing. OAuth/connector secrets remain in the trusted layer. Browser profiles, cookies, downloads and uploads are conversation-bound. External side effects follow the same proposal/current-authority/idempotency rules as other commands.

### Concrete deployment sequence

1. **Build CI and infrastructure.** Use GitHub Actions OIDC with narrowly scoped environment-specific AWS roles, immutable ECR images, and CDK. Separate trusted migrations from agent execution. Keep production roles unavailable to worker sessions.
2. **Deploy development foundations.** Verify the AWS account/region immediately before changes. Review CDK synthesis/diff, then deploy new networking, database, buckets, keys, gateway/control services, Temporal and broker resources. Do not modify existing Capiro stacks.
3. **Start with fixtures.** Exercise login, current membership, typed scope/window/evidence/skill contracts, actual-proxy SDK discovery/streaming, capability expiry, cancellation, complexity budgets and checkpoints. Build the accepted SDK baseline before any optional routing/judging. Preserve qualified existing fixtures and work.
4. **Enable reads progressively.** Use a restricted read role that cannot bypass policies through owner privileges. Validate one client and memory, then every selected inventory domain with exact/search/evidence operations. Require calendar/FY/version and complete-negative-coverage fixtures. Record unsupported history, unavailable/stale sources, truncation and continuation explicitly.
5. **Enable selected actions.** Add memory proposals, tasks and artifact filing after G3–G5 pass. An approval binds the exact immutable action and expires; execution rechecks current authority.
6. **Deploy an immutable staging candidate.** Capture code SHA, images, runtime/model/proxy/catalog/skill/manifest versions, contracts, checkpoint format, migrations, Temporal compatibility and environment configuration. Deploy those exact assets and run the original full suite plus frozen core RG gates. Keep Decisions/JEV disabled or shadow unless their own adoption gates pass; unsupported optional availability never blocks a passing core candidate.
7. **Run controlled release.** Keep current Meri available. Start with named internal users and an explicit tenant allowlist. Use feature flags to separate run creation, source writes, schedules and authenticated browser actions. Review failures, quality, latency and cost against agreed limits before increasing exposure.
8. **Publish release evidence.** Record candidate manifest, deployment diff, migration effects, acceptance results, restore/rollback drill, canary observations, known limitations and the release decision. If production authorization is still required, present this concrete candidate for approval after all authorized preparatory work is complete.

Configure streaming/reconnect behavior across the actual load balancer and application path. Browser closure must not accidentally cancel a durable run. Store only needed payloads in workflow history; do not leak secrets or unnecessary private file contents into logs or tracing. Record measured model/tool usage and cost for every run and attempt, including failures, cancellation, retries and subagents. Reconcile provider usage with gateway/broker records and enforce budgets outside the agent's control.

## 7. Release success criteria

A release passes only when every applicable criterion has evidence against the staging candidate. Establish the task set and scoring rubric before evaluating so workers cannot redefine success after implementation.

| Criterion | Required result |
| --- | --- |
| Real work | Preserve the original at least 60 representative end-to-end tasks with at least 90% successful completion and at least 95% checked factual correctness. Start reliability work with 75 real requests and expand to at least 200 labelled cases; score the applicable frozen held-out RG gates separately |
| Cross-tenant isolation | Zero unauthorized rows, citations, transcripts, browser state or files across at least 100 adversarial cases |
| Within-tenant authorization | 100% fixtures pass for client walls, mailbox ownership, private memory, expired grants, role changes and revocation of already-stored context |
| Revocation | Numeric propagation bound agreed before G3 and met in staging; live cancellation, further publication denial and historical thread/file/preview/artifact access checks pass |
| Source coverage | 100% agreed source inventory has authorized reads; counts/aggregates match fixtures; pagination/history correct; citations authorized; freshness and completeness disclosed |
| Current Meri scope | Every selected capability has a new implementation and passing behavior/policy fixture; deferred items explicitly recorded |
| Native artifacts | 100% benchmark files open; supported formulas and reference totals correct; at least 95% meet the agreed human quality rubric; zero critical clipping/corruption; originals preserved |
| Recovery and side effects | 100% restart/retry suite passes; recovery within two minutes on healthy infrastructure; zero duplicate mutations after repeated delivery or worker termination |
| User interface | 100% distinct visible controls for the accepted scope have mapped behavior and passing checks, including stop, steer, resume, fork, approve/reject, citations, upload, preview, versions, revision, exact-version download, filing and schedules; disabled controls cannot execute |
| Design traceability | 100% Figma baseline frames, overlays and state examples are classified and mapped to implementation/fixtures or an explicit existing scope deferral; zero silently omitted agreed v1 screens or states |
| Visual and responsive behavior | Approved desktop/tablet/phone and light/dark references reviewed against the staging build; zero critical clipping, overlaps, unreadable content or missing actions; all accepted visual differences recorded |
| Interaction and accessibility | Keyboard navigation, accessible names, visible focus, dialog focus/return, contrast, long content/scrolling and reduced-motion behavior pass; selected scope and exact artifact/version are preserved through actions |
| Mode switch | Meri active; Portfolio/Modules content absent from this workstream; configured shared-shell handoffs preserve authorized tenant/client context, or unavailable destinations are explicitly disabled and tested |
| Browser operation | Authentication, cancellation, uploads/downloads, restart, isolation and revocation pass for each enabled browser workflow |
| Performance and cost | At 10 concurrent runs, p95 UI acknowledgement at most two seconds and p95 fresh-task readiness at most 90 seconds; tenant budgets, concurrency and runtime limits enforced; 100% runs/attempts have measured usage, including failed/cancelled/retried work |
| Data lifecycle | Retention/deletion fixtures pass across transcripts, events, uploads, browser state, snapshots, previews and artifacts; documented backup/restore rules prevent renewed access |
| Deployment operations | Exact candidate succeeds in staging; alerting, restore, rollback and in-flight compatibility drills pass |
| Reuse | Every generic subsystem has a pinned adoption/license record; custom replacements explain a demonstrated limitation |

### Retrieval and routing qualification gates

The following RG thresholds are **new proposed acceptance gates**, not existing production results. Freeze definitions, denominators, labelled gold data and measured latency cohorts before qualification. Codex may record a user-authorized scope/target change; workers may not lower a target merely to mark a ticket complete. Core gates apply to the exact baseline candidate; optional RG-10/RG-11 apply only if the service is promoted.

| Gate | Proposed acceptance result | Evidence and boundary |
| --- | --- | --- |
| RG-01 | Accepted route on at least 95% of held-out cases | Score allowed source/tool paths and all required families, including expected clarification; a route need not use one identical call sequence |
| RG-02 | 100% deterministic subject/window/FY/version fixtures pass | Server-bound scope/entity IDs; normalized calendar/timezone, relative duration, funding stage and evidence version |
| RG-03 | Labelled answer-bearing evidence Recall@10 at least 95% on frozen discovery retrieval units with at most 10 gold records | Define unit/source/candidate pool; retain all gold labels and report denominators/source slices. Cases with more than 10 required records use completeness/paging RG-05/RG-12; exact lookup/counts use RG-04 |
| RG-04 | 100% deterministic count/status/comparison fixtures pass | Authorized source snapshots, exact filters, bill/document version, PE identity/FY/stage and comparison consistency |
| RG-05 | Zero false absence claims on partial, unavailable or stale cases | Complete coverage or a clear limitation; empty candidate search does not prove no matching records |
| RG-06 | 100% selected skill ID/version and required evidence/completion fixtures pass | Includes client/portfolio/relationship/memory collisions and Commitments; replay, steer, reconnect, resume and fork preserve or explicitly version the contract |
| RG-07 | Zero unauthorized disclosure/mutation in the qualification suite | Cross-tenant and within-tenant boundaries; current grants, memory/mailbox walls, stored context, citations, files and revoked access |
| RG-08 | Native discovery actual-proxy compatibility and adversarial catalog recall suite pass | Known required capabilities found or an explicit supported fallback invoked; reference/header/stream/compaction/resume behavior and authorization at execution verified |
| RG-09 | Proposed warm simple-lookup answer p95 at most 15 seconds; optional-router incremental p95 at most 500 ms and total p95 regression at most 10% | Measure and freeze actual benchmark cohort/load before qualification; unsupported beta or exceeded optional budget uses the baseline. Retain all original performance targets; this does not relax a stricter overlapping ordinary-answer target |
| RG-10 | Optional classifier reduces held-out routing errors by at least 25% relatively, with no material coverage/argument regression | Paired sufficiently powered labelled cases, confidence intervals and human adjudication; low baseline error or insufficient data can require more cases; latency must also pass RG-09 |
| RG-11 | Optional JEV improves labelled evidence quality with calibrated abstention and no required-evidence loss | Freeze task-specific improvement/calibration/adoption thresholds before shadow scoring; report relevant/support/client-fit separately; authoritative facts and mandatory reads remain protected |
| RG-12 | Replay/reconnect/revocation/full-evidence-read/coverage-completeness contract suite passes | No stale discovered authorization; session/files/source versions pinned; decisive passage actually read; partial outcomes and continuation preserved |

Latency definitions are distinct. UI acknowledgement (at most two seconds) is accepted-request feedback; fresh-task readiness (at most 90 seconds) includes a new isolated worker; RG-09 measures a warm simple lookup from accepted request to grounded final answer. If the companion original plan/workbook retains an ordinary-answer p95 at most eight seconds, keep that target for its frozen original cohort; RG-09's broader warm lookup ceiling does not replace it. Report both cohorts and avoid hiding discovery/retry/classifier latency outside the measurement. Do not call an unfinished streaming token a completed answer.

RG-11 intentionally has no invented universal JEV gain number: REL-06/REL-08 must pin a task-specific measurable adoption threshold, calibration/abstention rubric and latency ceiling before judging. Until that qualification exists, JEV is disabled/shadow and cannot veto mandatory evidence. RG-10 likewise requires sufficient labelled evidence for its claimed improvement; optional indecision cannot delay a qualified baseline release.

Define UI acknowledgement as the request being accepted, not model completion. Measure fresh-task readiness separately from a warm worker. Set numeric per-task and tenant spend caps after the qualification benchmark; do not invent a universal dollar target.

Artifact validation includes rendering the generated document/slides, opening the native format, checking referenced inputs and formulas, and comparing revisions. LibreOffice recalculation is not universal Excel equivalence. Unsupported features must be rejected or disclosed rather than silently lost.

Run the 11 named Figma walkthrough entry points as implementation review paths, translating relevant paths into Playwright scenarios with real fixture-backed services. A linked Figma button or screenshot match does not count as a passing behavior test. Cover stream reconnection, background completion after browser closure, authorization changes, stale/expired proposals, stop/retry/fork, upload/extraction failures, selected-version revisions/downloads, filing receipts and schedule lifecycle. Exercise empty, loading, partial, error, revoked and recovery states from the 60-state catalog.

Use Playwright's screenshot and interaction capabilities rather than inventing a separate UI QA platform. Fix and record viewports, fonts, fixture data, clock and dynamic-content handling for reproducible comparisons. Set reviewed visual thresholds during qualification; preserve evidence of intended differences instead of blindly updating snapshots. Independent reviewer D verifies the exact candidate against the pinned design and UI coverage ledger. All existing data, artifact, recovery, isolation and performance criteria remain mandatory.

## 8. Rollback and recovery

Maintain independent kill switches for new runs, source writes, schedules, browser actions and optional Decisions/JEV services. Bypassing an optional service returns to the already-qualified SDK baseline, not an untested route. A data-policy failure disables the affected access immediately and revokes capabilities; changing a prompt is not a security fix.

Use additive expand/contract migrations. Support old and new readers/writers during rollout, backfill separately, and postpone destructive removal until rollback and in-flight runs no longer depend on the old schema. Application rollback reverts images/configuration; it must not automatically reverse a migration that deletes new user data.

Record each run's image, SDK/runtime/model/proxy, catalog/tool contracts, skill ID/version/manifest, normalized scope/window/source snapshot, optional-service configuration and checkpoint-format versions. Use Temporal's qualified versioning/deployment approach and retain compatible workers for in-flight histories. Do not resume checkpoints with an unqualified runtime or deploy nondeterministic workflow changes onto existing histories.

For rollback:

1. Stop new affected work and disable relevant actions/schedules.
2. Drain workers or obtain a verified durable checkpoint, including session state and file manifest.
3. Restore the previous qualified images/configuration and preserve required old workers.
4. Check migrations and compatibility before routing resumed work.
5. Verify authorization, data integrity, artifact access and idempotent outcomes.
6. Keep the affected feature disabled until independent checks pass.

Never terminate an active worker before durable persistence is verified unless the run is deliberately cancelled or immediate containment is required. Preserve failed-attempt evidence. Authentication/quota failures pause affected assignments; Codex continues unrelated work.

## 9. Worker task brief

Create one file per task under `docs/coordination/tasks/`.

```markdown
# WXX Task title

Objective:
User-visible outcome:
Base commit:
Branch and absolute worktree:
Dependency commits:
Owned paths:
Paths/interfaces requiring Codex approval:
Adopted components and pinned versions:
R/REL/RG IDs and capability/skill/fixture IDs:
Catalog/skill invocation/manifest/evidence contract versions:
Baseline versus optional-service state and frozen budgets:
Figma frame/component IDs and pinned design reference:
UI controls/states, API/event contracts and Playwright coverage owned:
Required behavior and authorization boundaries:
Acceptance checks and expected evidence:
Runtime/turn budget:
External actions authorized for this task:
Known constraints:

Work only within the assigned scope. Preserve repository instructions.
Do not modify existing Capiro infrastructure or deploy a production release.
Use adopted SDK/tools first; record demonstrated gaps before replacing them.
Commit the result and return the handoff below. Report blockers plainly.
A test or provider failure is not completion.
```

### Worker handoff

```markdown
Task and explicit Hermes session ID:
Status: ready for review / blocked / partial
Base commit and result commit:
Changed files:
What behavior changed:
Checks run and exact outcomes:
Applicable R/REL/RG results, fixture IDs and benchmark split:
Contract compatibility, normalized scope/window and evidence coverage effects:
Trace/oracle diagnosis and measured latency/cost where applicable:
Evidence/log/screenshots:
Policy and migration effects:
Remaining issues and risks:
Current process/worktree state:
Next command or repair task:
```

Codex's final status reports accepted capability coverage, deployment environment, immutable candidate, passed/failed gates, remaining blockers, and rollback instructions. It must not report production deployment when only local checks or development deployment occurred.

## 10. Ready to paste into Codex

Give Codex this R2 file and the updated capability workbook as the current two-file handoff, with the current standalone deployment repository/branch and existing Capiro read access. Retain any already-provided Meri Greenfield Agent Plan as background for unaffected requirements; obtaining another document is not a prerequisite to start REL work. Agents already working should use this as an incremental revision, not a clean-start instruction. Codex stores the workbook with a dated revision/checksum, exports the accepted shared R/REL/RG/capability mappings into Git contracts/ledgers, and records discrepancies before dependent edits. The workbook is the reviewable inventory; versioned executable contracts and task briefs govern implementation after reconciliation.

```text
You are the lead implementer and integration owner for the new Meri agent.

Read Revision R2 of docs/plans/MERI-DEPLOYMENT.md and its updated capability
workbook as the current handoff. Retain any already-provided Greenfield Agent
Plan as background for unaffected scope; do not require a third document to
start REL work. Use R2 when older routing/ten-tool recommendations conflict. Execute the defined first
release in the independent Meri repository/infrastructure. If deployment work
is already underway, first inspect accepted commits, worktrees, live Hermes
sessions, contracts, candidate images and gate evidence. Preserve qualified
work, current stacks and in-flight sessions; resume incrementally. Do not
create a second repository/stack, reset branches or discard progress. Use Claude Agent SDK for the deployed runtime, AI Elements
for the UI, Playwright for browser work, Temporal for durable execution, and
the adopted open-source artifact/testing components. Use existing Capiro
code as a behavioral reference for data schemas, policies and capability scope;
never import its agent/retrieval/UI/planner/skill/infrastructure implementation.

Use the standalone Meri Figma section as the UI design and interaction reference:
https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=439-81406
Inspect and pin the current reference before UI implementation. Write
docs/UI-SPEC.md and docs/UI-COVERAGE.md, mapping frames, controls and states
to AI Elements/shadcn components, real routes/events/APIs, authorization and
Playwright checks. Figma supplies designs; React and AI Elements supply the
working interface. Keep Meri/Portfolio/Modules buttons in the Meri view and
implement Meri content only. Discover and document the separate new frontend's
shared-shell handoff; do not invent Portfolio/Modules destinations or content.

Orchestrate real Hermes working sessions on the available execution host.
Discover its executable, help, profiles and working directories first.
Qualify installed Kanban; use one existing/approved dispatcher when suitable.
Otherwise use bounded CLI sessions with query files, explicit session IDs,
structured process arguments and captured output. Do not simulate delegation
or add another swarm framework.

Create and qualify one typed catalog/gateway and executable skill manifest
resolver. Do not target a fixed total tool count or expose giant free-text
query_data/raw SQL. Separate exact queries, candidate searches and full source
reads; return normalized subject/window/FY/version, authority, evidence,
coverage, freshness, pagination and explicit errors. The server binds identity
and grants and rechecks authority. The UI sends selected skill ID/version and
typed scope/dates; manifests own evidence and completion. Preserve Commitments
& Deliverables and scoped original quick-actions; ordinary queries stay light.

Use native SDK deferred tool discovery only after qualifying the pinned
runtime/model through the actual trusted proxy. One Claude SDK loop owns
execution. Required skill source families cannot be dropped by memory keywords
or one selected family. Test calendar-week/timezone and portfolio source
coverage, absent-recipe instructions, exact counts/status/version/budget
comparisons, topic-driven effort escalation and bounded recovery.

Run REL-01 through REL-06 and REL-09 with dependencies, owned paths and an
independent review. Start with 75 real cases, expand to 200 frozen labelled
cases, isolate held-out data and run correct-tool/correct-evidence oracle
experiments. Preserve the full original acceptance suite. Report R/REL/RG IDs,
traces, denominators, confidence intervals and timings/costs against the exact
candidate; proposed thresholds are not current PASS results.

REL-07 Decisions and REL-08 JEV are optional shadow experiments after the SDK
baseline. Decisions supplies bounded choice/predicate/score advice, not tool
arguments/execution/authority; permit multi-source decisions and abstention.
JEV starts as a calibrated evidence judge, never a substitute for retrieval or
mandatory source reads. Neither service is a mandatory serial router or blocks
core release when unavailable. Promote only after its held-out quality and
latency gates pass; otherwise keep disabled/shadow with immediate baseline
fallback. Preserve stricter existing performance cohorts and distinguish warm
answer latency from UI acknowledgement and fresh-worker readiness.

Start with read-only repository/AWS/source discovery. Record the actual
accounts, regions, roles and repository before deployments; never guess
targets or expose secrets. Preserve existing work and explicit session IDs.
Reconcile R2 against already-qualified evidence and pin additive compatibility
for changed contracts before dependent tickets continue. Freeze shared contracts,
then create scoped task briefs and dedicated Git worktrees. Run up to three
implementation sessions and one separate reviewer initially. Give each
session a pinned commit, owned paths, dependencies, adoption choices,
acceptance checks and a one- to two-hour deadline.

You own acceptance and integration. Inspect each returned commit, use an
independent reviewer, re-run meaningful checks, and merge only accepted work.
A Hermes process exit is not acceptance. Continue assigning ready tickets
until the defined scope and release gates pass. Checkpoint partial work and
resume explicit sessions instead of discarding changes or restarting blindly.
Keep status, component/license records, source inventory, selected/deferred
capability scope, evidence and release manifests current.
Give UI workers exact Figma node IDs and a pinned reference. Adopt existing
components before custom code. Independently review behavior, visual fidelity,
responsive/accessibility states and every visible control; do not accept a
clickable mockup or static success message as implemented backend behavior.

Deploy isolated development and staging to authorized targets and complete
all qualification, data-policy, artifact, recovery, browser and load gates.
Keep current Meri available. Prepare the exact production candidate and
rollback plan. Execute production rollout only when that action is authorized
in this session; otherwise present the completed candidate and concrete
deployment effects for the final approval.

Do not stop for routine implementation choices. When access or a material
decision is missing, state precisely what is blocked and continue independent
work. Never bypass tenant policies, silently lower success criteria, repeatedly
retry quota failures, import the old Meri implementation, or claim an untested
capability is complete.

Begin with discovery or current-deployment reconciliation, write preserved
evidence and the dependency queue, then launch the next ready bounded Hermes
task. Preserve current authorization; this revision alone does not authorize
a production rollout. Report accepted outcomes,
blockers and the next gate throughout.
```

## 11. Primary documentation

Verify installed versions and current API support before executing examples.

- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Native SDK tool search and proxy compatibility](https://code.claude.com/docs/en/agent-sdk/tool-search)
- [OpenAI Decisions — optional bounded classification](https://developers.openai.com/api/docs/guides/decisions)
- [OpenAI function-calling contract guidance](https://developers.openai.com/api/docs/guides/function-calling)
- [Evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
- [Pinned current-Meri source audit](https://github.com/neo-capiro/capirov2/tree/fd8765ec01d292013758606204f2c9d886cd31c1)
- [AI Elements](https://elements.ai-sdk.dev/)
- [Standalone Meri Figma design](https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=439-81406)
- [Figma Code Connect — optional design/component mapping](https://developers.figma.com/docs/code-connect/)
- [Playwright](https://playwright.dev/docs/intro)
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)
- [Temporal TypeScript](https://docs.temporal.io/develop/typescript)
- [Hermes CLI](https://hermes-agent.nousresearch.com/docs/reference/cli-commands)
- [Hermes Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban)
- [Hermes sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions)
- [AWS account identity](https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html)
- [AWS CDK deployment](https://docs.aws.amazon.com/cdk/v2/guide/deploy.html)
- [GitHub Actions OIDC for AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

