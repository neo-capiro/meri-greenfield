# Current AgentCore preview inputs

Use the [shipping runbook](../../../docs/handover/20261022/SHIPPING-RUNBOOK.md) and the current source owners in this directory. These files do not establish a deployed release. `deployment-inputs.json` is an example of the current shape: its AgentCore ARN and version are intentionally `PENDING`, and the renderer refuses it. Other identifiers, image digests and certificate pins are historical examples that require fresh root verification before use. Git history preserves earlier example bytes; build receipts, `foundation-outputs.json`, dated Temporal bindings and other dated readbacks remain historical evidence.

Prepare a new private input copy outside the repository. Keep exact before/after bytes and their provenance. The current deployment has no fixed tenant, actor, client or identity credential. Core supplies those on each authenticated request. Set only these origins here: `temporalAddress` and `controlPublicOrigin`. A separate `core-values.json` contains exactly `coreOrigin` and `frontendOrigin`.

## Existing source owners

1. Populate the foundation binding from fresh nonsecret AWS readbacks. Its `checkpoint` field still names the control object's versioned S3/KMS storage grant; it is not a runner allocation. Bedrock execution IAM belongs to the separate AgentCore stack. Generate the template with the existing pure owner, from the repository root:

   ```powershell
   node --input-type=module -e "import{readFile,writeFile}from'node:fs/promises';import{synthesizeFirstChatFoundation}from'./infra/product-preview/first-chat-foundation.mjs';const b=JSON.parse(await readFile(process.argv[1],'utf8'));await writeFile(process.argv[2],JSON.stringify(synthesizeFirstChatFoundation(b),null,1)+'\n',{flag:'wx'});" C:/private-release/foundation-binding.json C:/private-release/foundation.template.json
   ```

   The checked-in template is generated source, not a live stack receipt. Review the actual change set and preserve compatible rollback until replacement acceptance. Re-read foundation outputs after any update; the deployment copy must match every output consumed by Stage3.

2. Set `deployment.agentcore = {runtimeArn,runtimeVersion,qualifier}` only from the qualified standard V1 runtime and endpoint readbacks. The endpoint name is `preview`; its live/target version must equal the explicit version. Verify MMDSv2, immutable image, IAM, networking, lifecycle and actual private-control invocation before control cutover. Never fill a pending field with a guessed ARN or version.

3. Replace image/source pins and certificate hashes with the exact candidate's evidence. Preserve the existing private-control and native Temporal TLS PKI and keys unless a separate reviewed rotation requires replacements. `pki.py` generates only private-control and native Temporal CAs/leaves into a **new** directory:

   ```powershell
   python -I infra/product-preview/first-chat/pki.py C:/private-release/new-pki --days 90
   ```

   It never overwrites an existing directory. No runner or issuer CA is generated. The three approved client certificate CNs are `meri-temporal-control`, `meri-temporal-worker`, and `meri-temporal-schedule`. The native Temporal server keeps its default authorizer and maps only verified current client certificates to the permitted `meri` namespace role. The control and worker material both pin `/run/meri/control-ca.pem` for the private control channel. Fetch required private values using the current release owner's exact secret ARN and VersionId, with tracing disabled and owner-only scratch custody. The renderer's `--feature-secrets` entries bind each local path to that exact ARN/version. Do not run historical PKI-archive or kit helpers. Keep database/service secrets out of the SDK environment. Remove owned private scratch on success, failure, cancellation and timeout; retain scrubbed receipts.

4. In the clean checkout matching the qualified runtime image's source commit, generate runtime values with the existing policy owner:

   ```powershell
   node infra/product-preview/first-chat/runtime-values.mjs assemble --deployment-inputs C:/private-release/deployment-inputs.json --policy infra/product-preview/first-chat/policy.json --out C:/private-release/runtime-values.json
   ```

   This binds actual SDK/CLI/skill versions and the explicit run/output policy. The operator checkout may have a separately reviewed commit; never relabel the image source.

   `policy.json` carries the served model catalog under `models`. A row with `available:false` and `unavailableReason` is shown as disabled and refused at admission; Release flips it after qualification by setting `available:true` and clearing the reason. `pendingModels` lists catalog rows that cannot be served yet because the same provider/model already has a narrower available row (today: explicit Sonnet 4.6 efforts); Release flips those by moving the efforts onto the served row and removing the pending entry. Pending rows are validated but never served, selectable or persisted; the contract's effort vocabulary is not live availability.

5. Use `stage3-deploy.mjs --help` for exact current arguments to `stage3-input`, `core-values`, `upload-plan`, `bindings` and `verify-outputs`; use `render-material.mjs --help` to render. The default is two material families, task-definition revisions and application services: control and Temporal worker. An explicit `features.routines.workflow` adds the existing schedule-worker role as a third service in that same application stack, with its own exact material version and task-definition readback. No issuer bundle, JWT/JWKS/token writer, signing key, issuer service, discovery entry or issuer network rule is emitted. There is no runner task, probe task, runner role/network, runner source measurement or runner PKI. AgentCore invocation/restore qualification replaces the old runner network probe.

6. Use `ship-packet.mjs --help` to bind the current/previous inputs, source/image evidence, migration plans, upload plan and generated templates. Its configuration diff is for review, not authorization. Root verifies the full clone ledger and any forward migration rehearsal/snapshot, holds the deploy lock, reviews real change sets and qualifies the selected native TLS Temporal cluster and AgentCore version before deploying the application. Preserve required durable jobs. Complete live multitenant conversation, restore, Stop and feature acceptance before retiring old hosting resources.

The old `neomart-kits` and dated Stage3 prep remain historical. Do not recreate their removed generators or use copied outputs as current readbacks. Active observability retirement and the final integrated AgentCore/native/cloud qualification remain separately tracked in the migration plan.

For schedule activation, supply the existing `features.routines` task identity and workflow target, enabled source/reads, and Core unattended-firing trust. The task ID/version must come from the canonical approved task manifest; the renderer never creates that identity. The schedule queue is `routines.workflow.taskQueue`, and must differ from the ordinary `deployment.temporal.taskQueue` used for conversation dispatch. The schedule runtime remains `sourceEnabled:false` and receives only its existing schedule configuration, health port8083, native private-control capability, pinned `meri-temporal-schedule` certificate and Core service-secret file. Node loads the same pinned private-control CA before startup.

The schedule worker requires its own reviewed database login: `deployment.database.roles.schedule` and private `db-logins.json` entry `schedule`. Control's login is deliberately forbidden from inserting occurrences and must not be elevated or reused. The database owner must supply and qualify the narrow schedule grants through the existing migration/grant owner before activation. This renderer performs no database changes.

Bind an actual existing `deployment.secrets["schedule/material"]` ARN, plus `ScheduleExecutionRoleArn` and `ScheduleLogGroupName` foundation outputs. The existing foundation renderer accepts optional `secretArns.schedule` and matching `secretKmsKeyArns.schedule` to create only a scoped execution role and retained log group. It creates no secret or SDK task role and changes no existing resource or security-group rule. The schedule service reuses the Worker security group and existing DbClient marker. Refresh the foundation readback, list both ACTIVE/INACTIVE schedule task revisions, and let the normal upload, binding and ship owners carry all three roles. Preserve existing PKI and persistent resources.

Rendering, a healthy service and a running Temporal poller do not establish successful schedules. Root must first compose the current AgentCore occurrence/retirement owners, verify the canonical task manifest and database grants, then qualify an actual Core-authorized scheduled occurrence plus revocation and retirement. Do not restore `nativeCandidate` allocation inputs or historical token/grant kits to satisfy missing runtime composition.

Removing issuer resources from generated source is not evidence of cloud cleanup. After replacement acceptance and the bounded rollback window, the release owner must retire the old issuer service/stack and secret labels, then account explicitly for its retained KMS signing key and log group. Applied SQL and historical readbacks remain immutable. A rollback to the old issuer topology requires its historical compatible renderer/configuration and fresh task revisions; the current renderer cannot make an old image native-TLS compatible.
