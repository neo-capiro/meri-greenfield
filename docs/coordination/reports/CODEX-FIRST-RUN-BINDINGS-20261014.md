# Concrete first-run binding map

This is a source/configuration audit for one **preadmitted, fresh, uninterrupted authenticated conversation**. The new compiled mount can use the pool already owned by `startControl`; it does not create a run, grant, worker, verifier or observation owner. Existing authority bridge source is present in the pinned backend integration. A live authority endpoint, real admitted product state and the external native provider/supervisor remain unbound. No live connection, secret-value read, test, provider call, fixture start, migration, security change or document creation occurred in this audit.

Task base `f008efc97619c7ed2e8119ad8ebc0e0a733a5970`, inherited PR69 `a8655da564233e5a7b5ba4e53838ba923fb7f69d`. The runtime author separately owns `control.mjs`, `first-run-mount.mjs` and their verification. The interface below was statically matched to author commit `727e1a87d87bae1d5ff166a8ddbe779b1ef96ea1`; this report does not independently accept it.

## Executable compiled assembly

Use the trusted server bootstrap, with these existing imports and approved in-memory inputs. The function below is a wiring example, not a new product export or permission to invoke startup:

```js
import {validateConfiguration} from './apps/runtime/config.mjs';
import {startControl} from './apps/runtime/control.mjs';
import {createNativeFirstRunMount} from './apps/runtime/native-authority/first-run-mount.mjs';

export async function startBoundFirstRun(rawConfiguration, admittedPacket,
                                       registration, signal) {
  const configuration = validateConfiguration(rawConfiguration, 'control');
  const productPortsFactory = createNativeFirstRunMount({
    allocationJson: admittedPacket.allocationJson,
    grantFactsJsons: admittedPacket.grantFactsJsons,
    identity: {
      origin: admittedPacket.authorityOrigin,
      commandContext: admittedPacket.commandContext,
      fetchImpl: fetch,
    },
    registration, // borrowed independent native .read owner; never worker JSON
    enabled: true, // explicit trusted-server activation after admission
    limits: {
      maxRequestMs: configuration.limits.requestMs,
      maxFactBytes: 131072,
    },
  });
  return startControl(configuration, {signal, productPortsFactory});
}
// Existing supervised entrypoint supplies its AbortSignal and bounded startup/
// shutdown watchdogs; no new signal handler or JSON module loader is needed.
export async function runBoundFirstRun(configuration, packet, registration, signal) {
  const runtime = await startBoundFirstRun(configuration, packet, registration, signal);
  try {
    await new Promise(resolve => {
      if (signal.aborted) resolve();
      else signal.addEventListener('abort', resolve, {once: true});
    });
  } finally {
    await runtime.close();
  }
}
```

`createNativeFirstRunMount({allocationJson,grantFactsJsons,identity,registration?,enabled=false,limits})` returns a synchronous factory. Control calls it with frozen `{configuration,pool,native,now}` before readiness/listening. The mount constructs `createPostgresAdmittedRunOwner` with that **same pool**, `namespace:'product'`, supplied allocation/grants, and supplied clock; the same admitted owner supplies identity `currentRun` and SDK `withCurrentAllocation`. `native` is control's already-created `createNativeCapabilityClient`, not another credential/client constructed by this mount. `registration.read` retains its original receiver. The constructor snapshots original packet data and rejects commandContext.binding differing from the admitted grant binding before startup resources are allocated. Explicit `productPorts` remains an exclusive alternative to `productPortsFactory`; neither is configuration JSON. Factories must be synchronous and trusted compiled functions.

The stock `node apps/runtime/cli.mjs control --config ...` passes only a signal. Its JSON parser deliberately accepts no factory/registration/module fields, so it does **not** install this first-run mount. The server owner must invoke the public `startControl` seam from its compiled bootstrap as above. A JSON module path, eval/loader, second pool or browser-installed owner is not a substitute. Existing CLI remains suitable for the separately configured Temporal poller and runner.

## Exact input packet and state it must match

| Input | Existing canonical owner/shape | What the supplying owner must provide |
| --- | --- | --- |
| `identity.origin` | `apps/control/action-host/application-adapters/authority-http.mjs` | Approved HTTPS origin only, no userinfo/query/fragment/path; existing two fixed Capiro routes, bounded Fetch response, original bearer/session expiry and current revocation. This is separate from `configuration.native.origin`. |
| `identity.commandContext` | `context-adapter.mjs` | Exactly `{binding,clientResolution:{reference,clientId}}`; reference equals clientId UUID. Binding is `{tenantId,actorId,conversationId,runId,attemptId,workerId,writerFence}`. Actor is Capiro TenantContext.userId, not Clerk subject. Identity/context principal, conversation/client and current admitted binding must match. |
| `allocationJson` | `apps/gateway/budget/tool-budget-binding.mjs:allocation` | JSON string containing `{run,manifest,manifestSha256,catalogSha256,budgets,schedule}`. run is tenant/actor/conversation/run; manifest is canonical private SkillManifest; its hash and budgets must match. schedule is `{revision,expiresAt,operations:[{operation,chargeMicrousd}]}` with positive charges and manifest-allowed operations. These are trusted allocation facts, not spend approval or a caller-selected manifest. |
| `grantFactsJsons` | `admitted-run-binding.mjs:parseAdmittedGrantSet` | 1–16 JSON strings, each exactly `{grantId,binding,qualificationBinding,capabilitySha256,allocationSha256}`. Unique grants share full binding and qualificationBinding; allocationSha256 equals canonical allocation hash. qualificationBinding is `{runId,attempt,workerArn,fence,policyRevision}`; runId/fence match binding. The field's historical name does not make a fixture grant valid product authority. |
| Actual task identity | `tool-budget-binding.mjs:validateGrantBinding` | Positive bounded attempt/fence, hex policy hash, and real ECS task ARN matching `arn:aws:ecs:us-east-1:967807252336:task/<cluster>/<32hex>`. `workerId` is the binding UUID, not an ARN. The mounted owner does not issue or discover either. |
| Existing DB rows | `admitted-run-current.mjs` | Nonquarantined singleton budget; exact current run row; ACTIVE, unexpired grant rows with matching capability hashes; one immutable allocation row plus matching tool_grant_bindings facts. DB clocks, immutable started_at, grant expiry and schedule expiry bound the lease. Missing/mismatched rows refuse. |
| `registration` | `apps/runtime/native-authority/session-owner.mjs` | Compiled independent `.read({binding,key,signal,deadlineMs})` owner returning the exact observation described below. A boolean, callback key, grant hash or local probe receipt is insufficient. |

Preadmission must precede successful identity/currentRun resolution. UI submit and Temporal `execution/start` do not initialize budget/grant authority. The native admission/launch owner must furnish the **actual task-bound packet and installed current state**, including actual worker ARN, before this static mount is useful. The audit proposes no launch-order workaround or invented future ARN.

The existing `createPostgresToolBudget({pool,allocationJson,namespace:'product',now}).bindTrustedGrant(invocationJson,check)` in `postgres-tool-budget.mjs` can install the immutable allocation and tool-grant binding only **after** genuine current run/ACTIVE grant/budget admission exists. It does not create a run, activate a grant or initialize a ledger. Its invocation includes a trusted invocationId in addition to the grant facts. Native issuance/initialization remains separately owned; no fixture initializer is a product issuer.

## Authority bridge is implemented source, not an absent route proposal

`cross-repo/pins.json` and `cross-repo/README.md` under `apps/control/action-host/application-adapters` bind backend PR2449 `60cf2e51129f8358e6afe5fc600ffcdb6de01759` (tree `1b2c9f6e975a47397f08d34563087455ed1c2242`) and nineteen source/compiler dependencies. Source owners are Capiro `apps/api/src/auth/application-authority.ts`, `auth/clerk.service.ts`, `tenant/tenant-context.middleware.ts`, `context/context-security-scope.service.ts`, and `meri/meri.controller.ts`/`meri.service.ts` methods `applicationAuthorityIdentity`/`applicationAuthorityContext`.

The preserved integration review records actual original endpoint/middleware/Clerk/guard methods executed against synthetic external ports, including current-session revocation and wall predicates. `CODEX-NATIVE-DOCX-FLOW-20261013.md` records backend carrier PR2482 `37339931788d8384b864192f2c2eacf56cd9bf06` retaining the eight authority-owner files and PR2450 native pairs under a deterministic Clerk fixture. No new backend source or live acceptance is inferred from this audit.

The saved `/workspace/capirov2` checkout is older clean `4be13b0b...`; it lacks the bridge. That is a stale-checkout limitation, **not** evidence that later bridge implementation is missing. The historical carrier is not a Git object in that checkout. Its source status is established by the retained pinned integration/report; current deployed origin/endpoint revision/live current-session transport still requires its owner handoff.

Exact wire, with native bearer, `POST` and `no-store`:

- `/api/clio/application-authority/identity`, body `{}`; receipt `{principal:{tenantId,actorId},identityRevision,checkedAtMs,expiresAtMs}`.
- `/api/clio/application-authority/context`, body `{identitySha256,conversationId,clientId}`; receipt `{identitySha256,principal,identityRevision,conversationId,selectedClientId,contextRevision,checkedAtMs,expiresAtMs}`.

Meri `createApplicationContextAdapters` joins those receipts with prebound commandContext and currentRun before/after the context request, producing its full binding/scopes/current policy. Raw native context cannot be supplied directly as the Meri opaque-session context. Ordinary frontend read-route approval and raw `/me` are not this bridge handoff. Middleware may provision/rebind membership/update activity; live invocation needs the already reviewed side-effect scope, not an assumption that every authentication path is read-only.

## Resources, schema and startup

| Resource/selector | Actual code requirement | Existing metadata/status |
| --- | --- | --- |
| Product PostgreSQL | `database.connectionFile`; pg8.23.1 Pool max10, finite connect/query timeout; PostgreSQL URL with exactly one `sslmode=verify-full`, no other query key/fragment | No approved product endpoint/connection-file selector was found in the inspected runtime config. No connection/secret value read. Dedicated product resource, roles/TLS/current schema must come from persistence owner. |
| Product budget migration | `apps/gateway/budget/migrations/0001_product_budget.sql` | Empty structure only; includes budget/runs/grants/requests, allocations/bindings/reservations/invocations/liabilities. Runtime never applies it or seeds cap/run/grants. |
| Conversation migrations | `apps/control/conversations/migrations/{0001_conversations,0002_lifecycle,0003_selected_outputs,0004_sdk_sessions}.sql` | Apply to approved product DB in order through migration owner; 0004 adds immutable session owner/streams/entries/batches and conversation FK. Startup readiness checks runs/events/controls/selected_outputs only, not complete schema/hash or SDK tables. |
| Selected source reads | `0005_selected_reads.sql` | Required for separately mounted selected read workflow; simple first conversation adds no selected activation. It does not replace the four first-run migrations. |
| Temporal | `temporal:{address,namespace,taskQueue,tls:{caFile,certFile,keyFile}}` | Exact namespace/queue/frontend endpoint and TLS files must be supplied. No implicit defaults. `apps/control/qualification-temporal` contains preparation-only server1.32.1/design pins, not a running service. No approved actual namespace/queue/TLS selector found. |
| Native capability provider | `native:{origin,capabilityFile,loopback,maxResponseBytes}` | HTTPS provider origin and existing task/server capability-file mounts are configuration. Genuine provider operations below are not implemented by merely supplying that URL. No real local provider server discovered; test process-fixture handlers are synthetic. |
| HTTP and sessions | `http:{hostname,port,frontendOrigin}`, `sessions:{mode:'process-local',replicas:1,maxSessions,maxTtlMs}` | Control planning ports8080/poller8081 are documented assignments, not discovered listener/resources. One replica, maxTTL≤300000ms; restart/replica durability unqualified. Browser Origin must match frontendOrigin. |
| Runtime/image pins | `versions:{imageDigest,sdk,cli,contracts,skillsDigest,checkpointFormat}` | Real reviewed image digest/skills digest must match durable run and returned runtime. SDK0.3.295/CLI2.1.295; private RuntimeVersions contracts/checkpointFormat are0.1.0. Public receiving package0.1.5 is a different version domain. |

Secret/certificate selectors are absolute paths to existing regular, nonsymlink, same-UID files with mode denying group/other access and size≤32KiB. This report supplies no credential value, new credential or guessed secret ARN. These files are mounted only in their owning role; conversation tasks get no product DB or Temporal/provider-account credential.

`startControl` reads approved connection/native/TLS files, creates the Pool and Temporal Connection/Client, constructs native client and compiled mount, then checks conversation table presence, Temporal GetSystemInfo and native readiness before HTTP listener. The new mount creates neither a second pool nor a resource lifecycle. Startup/ready success does not verify SDK migration hashes, namespace authorization, task isolation or native task authority. Existing `readiness` response is `{service:'meri-native-capability-provider/1',ready:true}` and health remains releaseAcceptance held.

Retained resources cannot be silently reused as product bindings:

- `/workspace/cloud-onboarding/meri-native/README.md` names stopped `meri-native-postgres`, volume `meri-native-postgres-data`, loopback127.0.0.1:55432/database meri_qualification_test/user qualification_owner, PostgreSQL16.15/trust fixture. PR69 snapshots show only meri_qualification and original data preserved; actual admitted owner refused missing product state. No product namespace, TLS proof or production grant comes from it.
- `infra/native-enforcement/lib/binding.mjs` records qualification account967807252336/us-east-1, VPCvpc-06e1941747e798f0a, subnetsubnet-0864c000b771df32c, SGsg-0c4e15bec7adeed1a. `infra/native-qualification/component-pins.json` names the qualification-worker ECR repository, execution role, SDK/Office task-definition families and log group `/meri-greenfield/qualification/runtime`; status is preparation-only, with all-a image placeholder and historical role information. These are qualification references, not admitted control/product DB/Temporal/broker resources or current inventory.
- D001/approved deployment plan require a separate application/control Fargate foundation, new database/buckets/keys/roles and fresh task per conversation. W03/G2 resource binding is still separate. No static runtime product foundation template supplying the missing endpoints was found in the inspected infra directories. No cloud readback occurred.
- D004 already records the historical synthetic Bedrock candidate `us.anthropic.claude-sonnet-4-6`, profile `arn:aws:bedrock:us-east-1:967807252336:inference-profile/us.anthropic.claude-sonnet-4-6`, US-only destinations and aggregate$10 synthetic ceiling. This supersedes a blanket historical “no selected model” statement. It does not bind this first authenticated conversation's proxy/provider/image/pricing or authorize paid execution here. Workers remain inference-account-credential-free; trusted proxy owns provider access/accounting.

## Request path and external provider implementation work

There are three separate destinations: Capiro `identity.origin`, Meri control listener, and `configuration.native.origin` provider gateway. The native client always posts `/v1/<operation>` with the configured capability header. Control does not implement `/v1/worker/authorize`, `/v1/runner/runtime` or `/v1/execution/start`; therefore pointing native.origin at control is not enough.

| Stage | Existing caller/receiving source | Exact route or provider contract and supplying owner |
| --- | --- | --- |
| Browser obtains Meri session | `control.mjs` → `action-host/session/http.mjs` | POST `/api/action-followthrough/session`, native bearer plus only conversationId/runId/clientId hints. Compiled identity adapter performs canonical Capiro receipt/current-run join; opaque credential stays current-scope bound. |
| Submit plain conversation | `conversations/{http,service,postgres-store}.mjs` | POST `/api/conversations/submit` using opaque bearer, `{requestId,prompt}` (skill/window optional). Durable request/run/event before dispatcher; does not create budget/grants/worker authority. |
| Durable scheduling | `temporal-dispatch.mjs`, `workflow.ts` | Workflow ID `meri:<tenant>:<conversation>:<run>`, lifecycle workflow, taskQueue. Poller `startTemporalWorker` registers `executeConversation` broker; activity retries disabled. |
| Actual isolated task | `runtime/temporal-worker.mjs:createBrokerActivity` | Provider POST `/v1/execution/start` with binding/executionKey -> `{binding,executionId,expiresAtMs}`; `/v1/execution/poll` -> same binding/executionId/state. Native broker owns real fresh task launch, durable idempotence, lease and terminal cleanup. No product implementation discovered here. |
| Runner load/runtime/publish | `runtime/conversation-runner.mjs`, `native-client.mjs` | Provider `/v1/runner/load`, `/runtime`, `/publish`, ordinary control operations. Gateway must authenticate current task and forward load/publish to control POST `/internal/conversations/{load,publish,...}`. These route families differ; control listener alone cannot serve the full runner native transport. |
| Current task verifier | `native-authority/task-authority.mjs`, `worker-http.mjs` | Provider POST `/v1/worker/authorize`: request `{capability,binding,operation,inputSha256}`; exact receipt `{binding,operation,inputSha256,identityCredential,scopes,selectedClientId,policyRevision,authorizationDecisionId,checkedAtMs,expiresAtMs}`. Real native capability authenticity/currentness/policy owner is external and still missing; adapter validates/correlates only. Verify inside held allocation lease must not reacquire the same budget lock. |
| Trusted runtime options | Runner `prepareRuntime` → `worker/conversation/options.mjs` | `{binding,versions,proxyUrl,proxyCredential,model,deadlineMs,maxTurns,maxCostMicroUSD,maxOutputBytes,sdkSessionKey:null}` for fresh run. Exact proxy origin/versions/deadline/budget rechecked; query env uses task proxy token, no account API/OAuth keys. Genuine model/proxy pin and native runtime owner are external. |
| Native observation + SessionStore | `sdk-first-session.mjs` → `session-client.mjs` → mounted `session-http.mjs` | Gateway forwards `/v1/runner/session/{register,load,append,list-subkeys}` to control's same routes. Independent supervisor `.read` must return `{binding,key,sdkVersion:'0.3.295',cliVersion:'2.1.295',observationId,sessionEventSha256,checkedAtMs,expiresAtMs}` corroborating actual init/main key with original expiry. No product reader implementation discovered. PR69 local /status witness supplies mechanics, not this task-bound authority. |
| Completion/history | Service/store/runner settled mirror | SDK mirror must register/settle before durable completed status. Browser history/events stream uses same opaque-current scope. Native terminal/group cleanup still needs its owner proof; a completed event alone does not prove physical exit. |

Lifecycle checkpoint/approval/continuation provider operations remain mounted contracts for later control use, not prerequisites invented for this uninterrupted plain-conversation slice. Selected source research and document output require their separate compiled owners/current admission. This mount returns only identityContext/sdkSessionOwner. It supplies neither artifactOptionsOwner nor selectedOutputPublication nor approvedOutput; **document creation remains awaiting separate explicit output approval**, with storage/renderer resources separately unbound.

The next handoff is concrete: backend owner supplies deployed bridge revision/origin/current bearer semantics; persistence/native admission owner supplies reviewed schema and actual allocation/grant packet; Temporal owner supplies endpoint/namespace/queue/TLS; native supervisor supplies provider/broker/verifier/runtime transport and independent reader; runtime owner supplies reviewed task/image/proxy/model/cleanup bindings. Then the existing compiled bootstrap and route chain can execute one real conversation. No repeated refusal test can supply any of these external implementations or resources.
