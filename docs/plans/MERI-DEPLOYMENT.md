# Meri deployment plan for Codex and Hermes

Prepared 9 October 2026. Save this file in the new repository as `docs/plans/MERI-DEPLOYMENT.md`. The final section contains the prompt to start Codex.

Build a new, independently deployed Meri workspace with the Claude Agent SDK, AI Elements, governed Capiro data and memory access, browser work, downloadable artifacts, and durable execution. Codex coordinates implementation, delegates bounded work sessions to Hermes, verifies the resulting commits, and owns integration and deployment. Hermes is a development worker; it is not part of Meri's production agent runtime.

This plan implements the defined first release in the updated Meri Greenfield Agent Plan. A runnable demo is a milestone, not release acceptance. Expect roughly two weeks for a demo, six to eight weeks for a controlled pilot, and ten to fourteen weeks for production readiness with three senior engineers and part-time platform/QA support. These are planning estimates; credentials, source access, policy discovery, and qualification can change them. Full parity with every current Meri business workflow is a separately estimated scope.

## 1. Architecture and reuse requirements

Create a new repository and independent infrastructure. Read the existing Capiro repository to discover schemas, identity boundaries, policies, source domains, and current capabilities. Do not import its agent, retrieval implementation, UI, queues, or infrastructure modules. Existing Capiro records, institutional memory, and user identity remain authoritative external sources accessed through new connectors.

| Area | Adopt | Build only the Capiro-specific part |
| --- | --- | --- |
| Agent runtime | Claude Agent SDK, its supported Claude Code runtime, built-in tools, hooks, subagents, skills, compaction, and session APIs | Tool contracts, tenant context, permission rules, and the adapter to the UI |
| Interface | Next.js, React, AI Elements and AI SDK UI transport | Conversation workspace, approvals, source views, artifact versions, and schedule controls |
| Browser work | One supported Playwright integration and its matching browser build | Tenant-bound browser ownership, authenticated access, action approval, and receipts |
| Durable execution | Temporal server and TypeScript SDK | Workflows for runs, approvals, schedules, execution activities, and verified checkpoints |
| Identity | Clerk's official backend SDK for the existing identity integration | Current membership, client walls, mailbox access, and resource authorization |
| Memory and data | PostgreSQL and supported source/database clients | New permission-aware connectors, governed memory search, freshness and provenance |
| Documents | python-docx | Original document skills, templates, validation, and revision workflow |
| Spreadsheets | XlsxWriter for creation; qualified openpyxl use for edits | Formula/reference checks, recalculation workflow, and preservation rules |
| Slides and PDF | PptxGenJS, LibreOffice, PDF.js; qualified PDF/OCR libraries | Original presentation skills, rendering, previews, and quality checks |
| Persistence | S3 and PostgreSQL | Artifact provenance, immutable versions, authorized downloads, and checkpoint manifests |
| Verification | Playwright Test, Promptfoo, OpenTelemetry and existing CI tooling | Capiro task fixtures, policy tests, recovery tests, and release evidence |
| Development delegation | Installed Hermes Kanban if qualified; otherwise bounded Hermes CLI sessions | Task briefs and a thin launcher only if needed |

Pin adopted versions, licenses, image digests, and compatibility evidence in `docs/COMPONENTS.md`. Check licenses before copying code or bundling skills. In particular, write original Office skills rather than assuming third-party Office skill text is freely redistributable. A custom replacement requires an observed upstream limitation and a recorded decision. Do not add another agent loop, swarm scheduler, browser framework, or workflow engine by default.

The AI SDK is the UI transport layer, not a second model orchestration loop. Use the Claude Agent SDK for Meri's agent behavior. Public search uses supported SDK tools or a qualified search provider; institutional retrieval always goes through the new authorized gateway.

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
| B | Hermes implementer | Source inventory, gateway authorization, governed memory, selected commands |
| C | Hermes implementer | AI Elements workspace, artifact records, native file generation, previews, original skills |
| D | Separate Hermes reviewer/session | Independent policy, browser, UI, artifact, recovery, and load verification |
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
4. Selected capabilities, source inventory, unresolved decisions, and blockers.
5. Current gate, evidence links, task/session identifiers, and next ready tasks.

Ask only for genuinely missing access, a material scope choice, or an action requiring authorization. Continue independent work while a source or account is blocked. Do not upgrade Hermes, change global model settings, or create a second gateway dispatcher merely to fit this plan.

### Repository layout

```text
apps/web/                 AI Elements workspace and UI transport
apps/control/             Conversations, run APIs, approvals, Temporal workflows
apps/worker/              Claude Agent SDK, workspace, browser and artifact execution
apps/gateway/             Current authorization, source tools and model/data proxy
packages/contracts/       Events, tools, proposals, artifacts and checkpoints
packages/skills/          Original skills and templates
infra/                    New CDK stacks and environment configuration
evals/                    Promptfoo, policy fixtures, Playwright and recovery checks
docs/plans/               Architecture and this deployment plan
docs/coordination/        Status, decisions, task briefs and worker reports
docs/                     Components, source inventory and capability parity
```

Use the installed Hermes board as the task-status authority when qualified; `STATUS.md` is Codex's dated projection and handoff. Git task briefs are the authoritative task contracts. If Kanban is unavailable, use one Git-backed task ledger and the CLI fallback rather than inventing a replacement scheduler.

## 4. Work queue and dependency order

Each row is a work package split into one- to two-hour Hermes tickets. Those are session limits, not estimates that a package will finish in two hours. Codex continually assigns the next ready ticket until the accepted scope is complete.

| Package | Owner | Depends on | Required output |
| --- | --- | --- | --- |
| W00 Discovery and scope | Codex, read-only Hermes support | Access to environment | Source inventory; selected/deferred capability ledger; account/repository decision |
| W01 Shared contracts | Codex with one Hermes session | W00 | Versioned events, tools, proposals, artifact/checkpoint schemas; fixture conventions |
| W02 Runtime qualification | A | W00–W01 | SDK/Fargate/browser/model-proxy spike and Temporal production-topology decision |
| W03 Isolated foundation | A | W02 | New CDK stacks, OIDC CI roles, persistence, networking, secrets, deployment/runbooks |
| W04 Authorization and reads | B | W01; W03 for live integration | Two-tenant and within-tenant fixtures; memory read; full agreed source coverage |
| W05 Durable runs | A | W02–W03 | Broker ownership/fencing, SDK SessionStore, file checkpoints, events, approvals and schedules |
| W06 Workspace interface | C | W01; W05 for integration | Streaming, history, stop/steer/resume/fork, approvals, files, sources and schedule controls |
| W07 Artifacts and browser | C, sequential scoped tickets | W02; W04–W06 for authorized integration | Native files, render/revise/download workflow; public browsing, then qualified authenticated work |
| W08 Selected mutations | B | W04 passes; W05 | Memory proposals, tasks and artifact filing with approval, idempotency and receipts |
| W09 Independent verification | D | Starts with W01; expands as packages land | Adversarial policy suite, UI/browser tests, artifact benchmark, recovery/load evidence |
| W10 Staging candidate | Codex; D verifies | W03–W09 accepted | Immutable candidate deployed and complete release evidence |
| W11 Controlled release | Codex | W10; release authorization | Internal allowlist, bounded tenant canary, production rollout and rollback evidence |

Freeze contracts before parallel implementation; downstream UI and gateway work may use fixtures while live infrastructure is being qualified. Integrate reviewed dependency commits before launching dependent live-integration tickets. Scope expansion goes in the capability ledger with its own estimate and gates.

Inventory current Meri from the actual repository. The previous audit identified roughly 139 business capabilities; recheck the current count and tenant feature flags. Access to all agreed data domains does not mean every existing business workflow is implemented. Every selected capability needs a new tool/workflow and a passing behavior/policy fixture. Every deferred item must remain visible.

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
| G0 Discovery | Real account/repository/region/identity/source decisions; selected capability and data inventory; no guessed production target |
| G1 Qualification | Pinned SDK/runtime/UI/browser/Office/Temporal components; Fargate sandbox, interrupt/resume, checkpoint and egress spike; production Temporal persistence, authentication/TLS, backup and upgrade design |
| G2 Isolated development | New stack deployed with source connections disabled; seeded identity/policy fixtures; task capabilities, restricted IAM/network paths, encryption, and conversation ownership pass |
| G3 Read-only data | One client and governed memory first, then all agreed domains; pagination/count/history/citations/freshness verified; tenant and within-tenant policy fixtures, including the measured revocation deadline, pass |
| G4 Execution workspace | SDK plus UI/artifact/browser integration; worker loss, approval-wait restart, session/files recovery, cancellation and single-writer fencing pass |
| G5 Selected commands | Immutable proposals, approval expiry, current authorization, revocation, idempotent outcomes and receipts pass; repeated delivery creates zero duplicate mutations |
| G6 Staging | Exact immutable candidate passes full task/policy/artifact/UI/browser/recovery/load suite, retention/deletion, deployment rollback, database restore and workflow compatibility |
| G7 Controlled release | Internal users, then bounded tenant allowlist; observable task quality/cost/error evidence; release owner authorizes the candidate before broader production rollout |

Authenticated browser actions qualify individually after public browsing. OAuth/connector secrets remain in the trusted layer. Browser profiles, cookies, downloads and uploads are conversation-bound. External side effects follow the same proposal/current-authority/idempotency rules as other commands.

### Concrete deployment sequence

1. **Build CI and infrastructure.** Use GitHub Actions OIDC with narrowly scoped environment-specific AWS roles, immutable ECR images, and CDK. Separate trusted migrations from agent execution. Keep production roles unavailable to worker sessions.
2. **Deploy development foundations.** Verify the AWS account/region immediately before changes. Review CDK synthesis/diff, then deploy new networking, database, buckets, keys, gateway/control services, Temporal and broker resources. Do not modify existing Capiro stacks.
3. **Start with fixtures.** Exercise login, current membership, gateway tools, SDK streaming, capability expiry, cancellation, task budgets and durable checkpoints before enabling real sources.
4. **Enable reads progressively.** Use a restricted read role that cannot bypass policies through owner privileges. Validate one client and memory, then every inventory domain. Record unsupported history, freshness or coverage explicitly.
5. **Enable selected actions.** Add memory proposals, tasks and artifact filing after G3–G5 pass. An approval binds the exact immutable action and expires; execution rechecks current authority.
6. **Deploy an immutable staging candidate.** Capture code SHA, image digests, component/skill versions, contracts, checkpoint format, migrations, Temporal compatibility strategy and environment configuration. Deploy those exact assets and run the complete release suite.
7. **Run controlled release.** Keep current Meri available. Start with named internal users and an explicit tenant allowlist. Use feature flags to separate run creation, source writes, schedules and authenticated browser actions. Review failures, quality, latency and cost against agreed limits before increasing exposure.
8. **Publish release evidence.** Record candidate manifest, deployment diff, migration effects, acceptance results, restore/rollback drill, canary observations, known limitations and the release decision. If production authorization is still required, present this concrete candidate for approval after all authorized preparatory work is complete.

Configure streaming/reconnect behavior across the actual load balancer and application path. Browser closure must not accidentally cancel a durable run. Store only needed payloads in workflow history; do not leak secrets or unnecessary private file contents into logs or tracing. Record measured model/tool usage and cost for every run and attempt, including failures, cancellation, retries and subagents. Reconcile provider usage with gateway/broker records and enforce budgets outside the agent's control.

## 7. Release success criteria

A release passes only when every applicable criterion has evidence against the staging candidate. Establish the task set and scoring rubric before evaluating so workers cannot redefine success after implementation.

| Criterion | Required result |
| --- | --- |
| Real work | At least 60 representative tasks; at least 90% completed successfully; at least 95% checked factual correctness |
| Cross-tenant isolation | Zero unauthorized rows, citations, transcripts, browser state or files across at least 100 adversarial cases |
| Within-tenant authorization | 100% fixtures pass for client walls, mailbox ownership, private memory, expired grants, role changes and revocation of already-stored context |
| Revocation | Numeric propagation bound agreed before G3 and met in staging; live cancellation, further publication denial and historical thread/file/preview/artifact access checks pass |
| Source coverage | 100% agreed source inventory has authorized reads; counts/aggregates match fixtures; pagination/history correct; citations authorized; freshness and completeness disclosed |
| Current Meri scope | Every selected capability has a new implementation and passing behavior/policy fixture; deferred items explicitly recorded |
| Native artifacts | 100% benchmark files open; supported formulas and reference totals correct; at least 95% meet the agreed human quality rubric; zero critical clipping/corruption; originals preserved |
| Recovery and side effects | 100% restart/retry suite passes; recovery within two minutes on healthy infrastructure; zero duplicate mutations after repeated delivery or worker termination |
| User interface | 100% visible controls pass end-to-end checks, including stop, steer, resume, fork, approve/reject, preview, versions, download and schedules |
| Browser operation | Authentication, cancellation, uploads/downloads, restart, isolation and revocation pass for each enabled browser workflow |
| Performance and cost | At 10 concurrent runs, p95 UI acknowledgement at most two seconds and p95 fresh-task readiness at most 90 seconds; tenant budgets, concurrency and runtime limits enforced; 100% runs/attempts have measured usage, including failed/cancelled/retried work |
| Data lifecycle | Retention/deletion fixtures pass across transcripts, events, uploads, browser state, snapshots, previews and artifacts; documented backup/restore rules prevent renewed access |
| Deployment operations | Exact candidate succeeds in staging; alerting, restore, rollback and in-flight compatibility drills pass |
| Reuse | Every generic subsystem has a pinned adoption/license record; custom replacements explain a demonstrated limitation |

Define UI acknowledgement as the request being accepted, not model completion. Measure fresh-task readiness separately from a warm worker. Set numeric per-task and tenant spend caps after the qualification benchmark; do not invent a universal dollar target.

Artifact validation includes rendering the generated document/slides, opening the native format, checking referenced inputs and formulas, and comparing revisions. LibreOffice recalculation is not universal Excel equivalence. Unsupported features must be rejected or disclosed rather than silently lost.

## 8. Rollback and recovery

Maintain independent kill switches for new runs, source writes, schedules and browser actions. A data-policy failure disables the affected access immediately and revokes capabilities; changing a prompt is not a security fix.

Use additive expand/contract migrations. Support old and new readers/writers during rollout, backfill separately, and postpone destructive removal until rollback and in-flight runs no longer depend on the old schema. Application rollback reverts images/configuration; it must not automatically reverse a migration that deletes new user data.

Record each run's image, SDK/runtime, tool contracts, skills, and checkpoint-format versions. Use Temporal's qualified versioning/deployment approach and retain compatible workers for in-flight histories. Do not resume checkpoints with an unqualified runtime or deploy nondeterministic workflow changes onto existing histories.

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
Evidence/log/screenshots:
Policy and migration effects:
Remaining issues and risks:
Current process/worktree state:
Next command or repair task:
```

Codex's final status reports accepted capability coverage, deployment environment, immutable candidate, passed/failed gates, remaining blockers, and rollback instructions. It must not report production deployment when only local checks or development deployment occurred.

## 10. Ready to paste into Codex

Give Codex this file and the updated Meri Greenfield Agent Plan, with access to the existing Capiro repository for read-only discovery.

```text
You are the lead implementer and integration owner for the new Meri agent.

Read docs/plans/MERI-DEPLOYMENT.md and the updated Meri Greenfield Agent
Plan. Execute their defined first release in a new repository and independent
infrastructure. Use Claude Agent SDK for the deployed runtime, AI Elements
for the UI, Playwright for browser work, Temporal for durable execution, and
the adopted open-source artifact/testing components. Use existing Capiro
code only to discover data schemas, current policies and capability scope.

Orchestrate real Hermes working sessions on the available execution host.
Discover its executable, help, profiles and working directories first.
Qualify installed Kanban; use one existing/approved dispatcher when suitable.
Otherwise use bounded CLI sessions with query files, explicit session IDs,
structured process arguments and captured output. Do not simulate delegation
or add another swarm framework.

Start with read-only repository/AWS/source discovery. Record the actual
accounts, regions, roles and repository before deployments; never guess
targets or expose secrets. Preserve existing work. Freeze shared contracts,
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

Begin with discovery, write the initial status and dependency queue, then
launch the first bounded Hermes qualification task. Report accepted outcomes,
blockers and the next gate throughout.
```

## 11. Primary documentation

Verify installed versions and current API support before executing examples.

- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)
- [AI Elements](https://elements.ai-sdk.dev/)
- [Playwright](https://playwright.dev/docs/intro)
- [Temporal TypeScript](https://docs.temporal.io/develop/typescript)
- [Hermes CLI](https://hermes-agent.nousresearch.com/docs/reference/cli-commands)
- [Hermes Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban)
- [Hermes sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions)
- [AWS account identity](https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html)
- [AWS CDK deployment](https://docs.aws.amazon.com/cdk/v2/guide/deploy.html)
- [GitHub Actions OIDC for AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

