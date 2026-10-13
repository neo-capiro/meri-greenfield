# Isolated greenfield deployment contract — source audit, 13 October 2026

Audited source **71d8c90c5a1fe5abc88b25fb74abba177949d3b1**, tree **1d2832f47c6b32295cf4dd6d8e837d27310bd468**. Read-only source/config audit; this report is the only write. Outline: inspect approved placement, actual runtime factories/routes/registration, persistence/native/current-authority boundaries and legacy routing references; record exact source blobs and missing assembly before any deployment proposal. No code imports/execution, dependency installation, listener, database, AWS, credential/secret value, network activation or deployment occurred.

## Current deployable boundary

**There is no assembled production application startup or product health route at this source.** Product behavior exists as injected factories/Fetch handlers and an SDK activity; shipping a qualification image or legacy endpoint would not assemble this application. Root package scripts run checks and qualification synthesis, not a production `start` command.

| Responsibility | Actual source owner | Deployment assembly still required |
| --- | --- | --- |
| Authenticated conversation HTTP | `apps/control/conversations/service.mjs`, `http.mjs`; additive `lifecycle/service.mjs`, `http.mjs` | Production HTTP process, origin/port/TLS/router, graceful shutdown and health/readiness contract. Existing Node bridge is reusable source, but `listenActionApplication` only accepts `127.0.0.1`, port0 and finite lifetime<=30s. |
| Durable dispatch | `temporal-dispatch.mjs`, `workflow.ts`, `lifecycle/workflow.ts` | Explicit isolated Temporal endpoint/namespace/taskQueue and trusted worker registration of `executeConversation`. No product `Worker.create`/worker bootstrap was found. |
| Only model loop | `apps/worker/conversation/activity.mjs`, `options.mjs`, `skills/selected-runtime.mjs` | Isolated task launch/current-owner `prepareRuntime`, task proxy capability, bounded model/cost/deadline, durable SessionStore and workspace, heartbeat/cancel delivery. SDK query executes in its caller process: place/handoff this activity to the approved per-conversation execution boundary; do not run all conversations inside a shared control process. |
| Selected original skills | `apps/control/conversations/skills/admission.mjs`, gateway `selected-skills/mount.mjs`, SDK skill MCP/runtime | Qualified installation/catalog/handlers, current allocation/identity/subject and native producer read ports. Current service's optional `selectedSkillAdmission` is implemented before persistence/replay/release; without it, frozen catalog denial remains the default. Old README statements saying all selected requests fail are historical and do not describe the configured hook. |
| Immutable output and files | Conversation `skills/retention.mjs`; document `selected-output/*`, `index.mjs`; artifact services | Separately approved outputRun/current source-access owner and production immutable object/version stores. No approved output means durable pending preparation, not a fabricated artifact/grant. The original read manifest is not widened to `create_word`. |

The approved plan keeps trusted application/control, gateway, broker and Temporal in **new isolated Fargate resources** (independent VPC, cluster, security groups, roles, database, buckets, keys/secrets, logs and pipeline). Active conversations get fresh independent workers; never reuse tasks across tenants/conversations. The D005 isolated browser-host exception applies to the measured browser workload only and still needs sandbox/network/native qualification; it does not move the trusted application to Capiro infrastructure. Sources remain disabled until separately qualified. No new orchestrator: Claude Agent SDK is the sole model loop; Temporal workflow code remains deterministic durability.

`apps/worker/qualification/Dockerfile` starts `/opt/meri-worker/probes/runtime.mjs`; proxy/control qualification workers, `createQualificationApplication` and local demos are fixture/probe assemblies. Their protected schema, observed engine, admission packet and historical image/resource pins are not product startup defaults. `docs/COMPONENTS.md` also retains unresolved findings on historical qualification images; this audit does not accept an image for production.

## Frontend route contract

Paths are on the **new application origin**, which has no production URL/port assigned by this source. Do not prepend `/meri-api`.

- POST `/api/conversations/submit`: `{requestId,prompt,windowRequest?,skill?:{skillId,skillVersion}}`.
- POST `/api/conversations/history`: `{after?,limit?}`; POST `/api/conversations/cancel`: `{}`.
- POST `/api/conversations/events`: `{command:{conversationId,intent:'view.subscribe'}}`; GET `/api/conversations/events/{conversationId}/stream`: `x-meri-resume-sequence`, canonical nonnegative safe decimal integer. No query/Last-Event-ID cursor. Selector must equal current authenticated conversation before stream release.
- Opt-in lifecycle POST `/api/conversations/control`; POST `/api/conversations/checkpoints/inspect`: `{checkpointId}`. Inspection projects only ID/hash/sourceBinding/event sequence, after current owner and exact retained checkpoint readback.
- Existing `/api/documents/{create,revise,inspect,download}` and action/session owners retain their own exact bound authorities. `/api/action-followthrough/session` is the existing opaque-session issuance surface; it is not a new native grant issuer.

AI SDK7.0.137 supplies transient `data-meri-event` UI streams. Stream end/reader abort is cleanup, not durable completion/cancellation. Resume/fork target receipts are selectors, not credentials: obtain a fresh existing-owner session. Inherited approval is context only; target mutation needs fresh immutable proposal/current approval. Re-freeze a coherent public0.1.4 package/source pair after integrated selected-admission changes; the earlier cd033 package tar is not the final frontend deployment pin.

## Worker, queue and authority bindings

Node24 is required. Conversation control pins `@temporalio/client` and `@temporalio/workflow`1.24.0; conversation worker pins Claude Agent SDK0.3.295/CLI2.1.295. There is no configured product queue default. `createTemporalConversationDispatcher({client,taskQueue,lifecycle})` receives the caller's explicit queue and starts `meriConversationWorkflow`, or opt-in `meriConversationLifecycleWorkflow`, using workflowId `meri:<tenantId>:<conversationId>:<runId>`, reject-duplicate/use-existing policies and one activity with automatic retries disabled. Lifecycle waits durably after pause/approval checkpoint; resume starts a new run/attempt/worker with higher fence after exact retirement; fork starts an independent conversation/task without retiring the original.

Native ports must bind full tenant/actor/conversation/run/attempt/worker/writerFence, exact selected client/scopes/policy, original request/window/skill/runtime/checkpoint pins and expiry. `prepareRuntime` supplies isolated cwd ending in the conversation ID, HTTPS model-proxy URL/task capability, model, SessionStore and bounded budgets. SDK options disable account/provider credentials, settings discovery and automatic filesystem memory; environment options are not physical network/sandbox enforcement. Current task launch/retirement, capture/restore receipts, proxy admission and worker credential delivery remain concrete native-owner/live gates, not boolean configuration acceptance.

The same existing opaque session owner authenticates and re-reads current authority before/after effects and release; selector/body fields never establish identity/scopes. `createActionSessionOwner` currently supports **process-local** sessions only. Production Clerk/current-membership callbacks, replica routing/reissuance/restart behavior and task-bound credential provisioning still require assembly/qualification. Workers receive neither Capiro DB credentials, provider account keys nor Temporal service credentials. `createLifecycleRunOwner` borrows a trusted credential provider to call the canonical control owner; it is not an authentication service or SDK loop.

## Database and storage inputs

Apply/reconcile only approved product migration bytes under an independently admitted restricted product database owner; never apply them to the protected native fixture during deployment planning:

1. `0001_conversations.sql`: `meri_conversations.conversations`, `runs`, `events`; tenant/conversation/run keys, immutable request and projection hashes, contiguous event identities.
2. `0002_lifecycle.sql`: hold, continuation/hash columns plus immutable controls/checkpoints. Current authority, exact control replay/UNKNOWN barriers and writer fences remain enforced by the same owner.
3. `0003_selected_outputs.sql`: `meri_conversations.selected_outputs`, exact preparation/projection hashes and source-run FK. It explicitly says **source-only migration candidate**; this audit provides no native application/durability receipt.

Artifact `createPostgresArtifactService` provides canonical PostgreSQL budget/accounting, but requires caller-owned `versions.commit/read` and `objects.put/get`. The concrete store found, `apps/artifacts/local-store.mjs`, explicitly says source-local filesystem and **not deployed S3/PG**. No product artifact-version DDL or production S3 artifact adapter/assembly was found. Production needs immutable object ID/version/hash/length/scopes, immutable spec/inspection/evidence/provenance/parent lineage, serialized head/ancestry/replay and current inspect/download revocation checks. Session/workspace checkpoints also need immutable durable storage, exact restoration and native readback; SDK session resume alone does not restore files.

Budget adapters currently reference `meri_qualification.*` grants/runs/allocations/reservations/liabilities; that is a real source coupling to the canonical qualification owner. Isolated product schema/bootstrap mapping must be explicit and reviewed. It does not authorize cloning the protected fixture, renaming its schema/pins, inheriting Capiro credentials or assuming conversation migration0003 provisions grants/artifact versions. Source accounting ambiguity and durable pending output remain visible.

Document generation uses original source plus python-docx1.2.0, XlsxWriter3.2.9/openpyxl3.1.5 component candidates. Local Python generation and retained real DOCX visuals are source evidence; the production image/executor/sandbox/render/storage wiring remains separate qualification.

## Legacy configuration verification

Read-only references: Capiro HEAD `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; frontend HEAD `02c02d95bdf3949662b9123f425271c6491ffdab`. No implementation imported, endpoint called, environment/secret value read or configuration changed.

- Capiro `infra/cdk/lib/compute-stack.ts:783` configures `MERIV2_ORCHESTRATOR_URL` from its existing app host; lines1501/2308 use `/meri-api/health`; line2389 routes `/meri-api/*` to its existing orchestrator. `infra/cdk/lib/config.ts:39` labels that legacy service.
- `apps/workspace/src/meriv2/meriv2-orchestrator.client.ts:14,36` consumes the legacy environment variable and appends `/meri-api/workspace-generation`. The source runbook/ALB script corroborate the old route family. These are Capiro references, not new Meri defaults or live configuration proof.
- Standalone repository matches occur in `docs/INTEGRATION-BOUNDARY.md` as historical service inventory, not a product runtime URL variable/path. Frontend source search (excluding dependency/git/secret-env/lock artifacts) found neither legacy string; guarded transport accepts an explicit `options.api`, emits the agreed subscribe command and resume header. This is not acceptance of its current release/package pin.

## Exact decisive source blobs

Git object IDs below bind the actual files read at the audited source; link paths are repository-relative. Missing assembled entrypoints were checked through source file discovery and `createServer/listen/health/Worker.create` searches excluding test/evidence/dependency artifacts. No runtime test or live readiness assertion is implied.

| File | Git blob |
| --- | --- |
| [docs/plans/MERI-DEPLOYMENT.md](../../../docs/plans/MERI-DEPLOYMENT.md) | `c9849375e463e88a064b256f715db7858cd369df` |
| [apps/control/action-application/node-http.mjs](../../../apps/control/action-application/node-http.mjs) | `a738ec6177a79a767021d41e8d848409b9357ca8` |
| [apps/control/action-host/session/owner.mjs](../../../apps/control/action-host/session/owner.mjs) | `9ec0c2970949f1c66eb790aa53c2170a00c8a581` |
| [apps/control/conversations/service.mjs](../../../apps/control/conversations/service.mjs) | `52b8b9cb9103ba15b9a197e4f13c24b669375e0c` |
| [apps/control/conversations/http.mjs](../../../apps/control/conversations/http.mjs) | `5a850749ece0c0dc793d2ce10de31ab646a2cca8` |
| [apps/control/conversations/temporal-dispatch.mjs](../../../apps/control/conversations/temporal-dispatch.mjs) | `f7f84566d4942321844322ed1878b698f7621d25` |
| [apps/worker/conversation/activity.mjs](../../../apps/worker/conversation/activity.mjs) | `45a6c1ad4e17f7aa1f901a63d5fe2a963059a4d1` |
| [apps/control/conversations/migrations/0001_conversations.sql](../../../apps/control/conversations/migrations/0001_conversations.sql) | `e3a9da923144f2b0ee5a6e02be6bd6d384ba35cf` |
| [apps/control/conversations/migrations/0002_lifecycle.sql](../../../apps/control/conversations/migrations/0002_lifecycle.sql) | `727dde3aa354625972c6f9388a159d0136a0b15b` |
| [apps/control/conversations/migrations/0003_selected_outputs.sql](../../../apps/control/conversations/migrations/0003_selected_outputs.sql) | `c880a75db2dd81cbb03e8d1033064cae90ff29c7` |
| [apps/artifacts/postgres-service.mjs](../../../apps/artifacts/postgres-service.mjs) | `cd963d55028bb8add02ac333004d20b60d828138` |
| [apps/artifacts/local-store.mjs](../../../apps/artifacts/local-store.mjs) | `209c59ff2629b6a1e4639ded983dacac6fad9cbf` |
| [apps/gateway/sources/original-tracking/mount.mjs](../../../apps/gateway/sources/original-tracking/mount.mjs) | `101f1f4dcdf5ea7ec82f8d503e197b6c02612eac` |

Completion: docs-only source planning. Production bootstrap/health/worker registration and the native/identity/source/storage assembly described above remain open. No deployment gate or whole-plan requirement is closed by this report.

## Provider and model validation status — continuation clarification

The executable source selects the **Claude Agent SDK as the sole model loop**, pinned to SDK `0.3.295` and CLI `2.1.295`. Its current model route is the existing trusted HTTPS Anthropic-compatible proxy: `apps/worker/conversation/options.mjs` supplies `ANTHROPIC_BASE_URL`, a task-bound `ANTHROPIC_AUTH_TOKEN`, and `model: runtime.model`; it does not supply an account API key. The fixed runtime/current-task owner must bind that model and proxy admission to the immutable run/runtime versions and approved budget. SDK/CLI version validation is source implemented. A concrete approved upstream provider account, supported model ID/version, proxy configuration/image and live provider receipt are **unresolved and held**. Synthetic test names such as `qualified-model-pin` are not a deployed model selection or qualification.

Amazon Bedrock is supported by the upstream SDK using `CLAUDE_CODE_USE_BEDROCK=1` and AWS credentials; this means Claude through Bedrock, not arbitrary Bedrock models becoming the SDK's orchestration model. This upstream capability is documented in the [official quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart), verified on 13 October 2026. It establishes neither Meri's current provider selection nor deployed Bedrock acceptance. Neo's provider question did not authorize a provider switch, IAM grants, credentials or paid calls. A qualified trusted proxy/provider route must preserve the approved no-provider-account-credentials-in-worker boundary. Additional specialist models, if explicitly approved later, are tools/services underneath the existing Claude loop and do not replace it.

The separately published bootstrap source `46ab3d9836a557d2adda1f6de8f3f7ef351236ce` adds actual HTTP/health, Temporal poller and isolated runner entrypoints; the original audit above remains pinned to `71d8c90c…`. Its source review currently holds deadline/cancellation, lease-expiry and runtime-pin findings; 12 author local checks and upstream types passed, but do not establish independent or native acceptance. Repairs and current provider/model status are reported in the bootstrap's own README and evidence. No model, Bedrock, AWS, protected database or deployment call was made by this clarification.
