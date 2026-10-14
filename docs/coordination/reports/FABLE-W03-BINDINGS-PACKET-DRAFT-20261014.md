# W03 / G2: dedicated bindings, persistence, keys, logs, retention and rollback action packet (draft for the shipping owner, slice 8)

Base `c6053e24b465be677cc5980533009b4aab03beab` (PR86). Author: Fable. Status: DRAFT PACKET, no AWS action, no resource, no credential, no deployment. The handoff makes the sole existing shipping owner the only party that performs AWS build, resource and deployment actions, and dot the owner of integration and acceptance. This packet lists, from the source at PR86, every binding the Meri runtime needs before a first authenticated chat, what the shipping owner must supply for each, how the runtime verifies it, and the rollback and compatibility notes. Every binding is UNBOUND per the public-safe shipping appendix of the handoff; this packet contains no hostnames, ARNs, bucket names, key IDs or secret references and must not be filled with historical dedicated-resource inventory, which the appendix labels historical only.

## 1. Preconditions that this packet cannot satisfy

1. Admitted image: the PR86 image is scan-blocked (2 Critical, 48 High). Admission requires zero High and zero Critical. Fable's dependency-traced candidate needs the private finding table (HANDOFF SCAN-STATUS). No build is requested here.
2. Launch-template credential shape (gap 3): resolved in source after dot's acceptance. The configured `launchTemplate.env` must not carry `ANTHROPIC_AUTH_TOKEN`; the preparation authority verifies the issued credential separately. The `preparationIntent` of section 2 can now be configured without a secret.
3. Gap 2 (per-task SDK config directories): resolved in source with ownership, permission and symlink verification; the task's config parent and secure storage parent must be owned by the task uid and private (mode without group or other bits), which the task bootstrap and image must guarantee.

## 2. Binding inventory from the PR86 configuration schema

Keys are those accepted by `apps/runtime/config.mjs` (`validateConfiguration` per role) and `apps/runtime/prepared-candidate-config.mjs`. "Verified by" is the existing readback the runtime performs; "Supplied as" is the delivery shape the source expects (a file path read once by `readSecret`, or a JSON value). Workers never receive account, provider, database or Temporal administration credentials: `assertRunnerEnvironment` refuses any task process that inherits `DATABASE_URL`, `PGPASSWORD`, `AWS_*`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `TEMPORAL_API_KEY` or `MERI_NATIVE_ADMIN_TOKEN`.

| Binding | Config key(s) | Supplied as | Verified by the runtime | Owner | State |
| --- | --- | --- | --- | --- | --- |
| Product PostgreSQL pool | control role `database.connectionFile` | connection string in a secret file mounted to the control task only | pool query at startup; `TASK_OWNED_DATABASE_REQUIRED`-style checks in the admitted owners (`listen_addresses`, version 16) | shipping (instance, roles, secret), trusted migration owner | UNBOUND |
| Product schemas and migrations | migrations `meri_conversations` 0001–0008, `meri_product_budget` 0001, `meri_artifacts` 0001 | source-reviewed SQL only; execution by the separate trusted owner, never by a worker | the stores read the exact tables; no migration runs at startup | trusted migration owner | source-reviewed; execution UNRUN |
| Temporal | control and temporal-worker roles `temporal.address`, `temporal.namespace`, `temporal.taskQueue`, `temporal.tls.{caFile,certFile,keyFile}` | address and namespace values; TLS material as secret files | worker registration with the canonical workflow bundle (`bundle.test.mjs`); readiness through GetSystemInfo is not namespace authorization (HANDOFF §5 item 4) | shipping (dedicated Temporal, namespace, queue, TLS, persistence) | UNBOUND |
| Control HTTP and frontend origin | `http.{hostname,port,frontendOrigin}`, prepared candidate `taskHttp` | values | listener refuses cross-origin (`process.test.mjs`) | shipping (routing, TLS termination), frontend owner (origin) | UNBOUND |
| Backend authority bridge | prepared candidate `identity.{origin,credentialFile,commandContext}` | approved HTTPS origin; credential in a secret file; `commandContext` from the admitted packet | fixed `/api/clio/application-authority/identity` and `/context` routes, bounded Fetch, revocation rechecks (`identity-context.test.mjs`) | dot (backend), shipping (secret) | UNBOUND |
| Native capability provider | all roles `native.{origin,capabilityFile,maxResponseBytes}`; prepared candidate `taskCapabilityFile`, `controlCapabilityFile` | origin value; task and control capabilities as distinct secret files | `capabilityDigest` equality, control and task digests must differ (`remote-task-http.mjs`) | shipping (issuance), dot (verifier owner) | UNBOUND |
| Model, proxy and budget pin | prepared candidate `runtime.{proxyUrl,model,deadlineMs,maxTurns,maxCostMicroUSD,maxOutputBytes}`, `proxyCredentialFile`, `plan` | proxy origin and model string as values; per-task proxy credential as a secret file | `https:` only, no userinfo/query; `plan` hash binds the original execution | provider/proxy owner | UNBOUND |
| Allocation and grants | `allocationJson`, `qualification`, `grantIntents`, `grantId`, `operations` | JSON values from the product budget owner | `createNativeAllocationAdmission` activates grants atomically; replay never extends deadlines (`native-allocation-admission.test.mjs`) | dot (budget owner) | UNBOUND |
| ECS task request | `taskRequest.{cluster,taskDefinition,networkConfiguration,overrides}`, `containerName`, `taskOrigin` | values; the task definition must pin the admitted image digest and the runner hash | `createEcsPreparedTaskProof` brackets the running task against declared image and runner pins (`ecs-prepared-task-proof.test.mjs`) | shipping | UNBOUND |
| Preparation intent | `preparationIntent.{workspace,configParentDirectory,secureStorageDirectory,launchTemplate,executableSha256,imageSha256,runnerSha256,sdkOptionsSha256,authoritySha256}` | values; `launchTemplate` is the exact CLI argv and env (see precondition 2) | `compileNativePreparationIntent` refuses forbidden keys and non-string env; `matchPreparedDescriptor` requires exact equality | dot (shape), shipping (values) | blocked on gap 3 |
| Artifact objects | `objects.{bucket,prefix,expectedBucketOwner,kmsKeyId}` | values; the runtime role needs only immutable-version put/head/get on the prefix | S3 adapter refuses suspended or unversioned buckets and missing checksum, KMS or owner metadata (`s3.test.mjs`) | shipping | UNBOUND |
| Session issuance | control role `sessions.{mode,replicas,maxSessions,maxTtlMs}` | values | bounded registry, expiry and revocation (`action-host/session`) | dot | configuration only |
| Limits and bootstrap | `limits.{startupMs,shutdownMs,requestMs,requestBytes}`, `bootstrap.{expiresAtMs,remote}` | values | watchdogs in `process.test.mjs` and `task-bootstrap.mjs` | dot | configuration only |
| Browser and renderer hosts | outside the runtime configuration: dedicated isolated browser host (D005) and renderer resources | separate hosts, never shared across tenants | probes in `apps/worker/qualification/probes` and `infra/browser-*` | shipping | UNBOUND for this base |

## 3. Separation requirements (HANDOFF W03 acceptance focus)

- Separate VPC, cluster, roles, database, buckets and secrets for Meri; nothing reuses legacy Meri or production Capiro resources, and nothing reads them as substitutes.
- Exact image and config: the task definition pins the admitted image digest; the config digest is recorded with the candidate; both appear in every receipt.
- No worker administration credentials: the runner task receives only its task capability file, its proxy credential file and the per-task directories; the control task receives the database connection file, native capability file and Temporal TLS files; the shipping owner holds everything else.
- No automatic deployment: a passing build, scan or native gate never triggers a task definition update, a service update or a canary; each is a separately authorized action with its own packet.

## 4. CI, OIDC, IAM, keys, logs and retention (requirements to be filled by shipping)

| Area | Requirement derived from the source and the handoff | To be supplied |
| --- | --- | --- |
| CI identity | Build and push through a short-lived OIDC role scoped to the Meri ECR repository and the build log group only; no long-lived keys in CI | role and trust policy |
| Build | `NODE_IMAGE` as an explicit reviewed digest (no floating default); `RUN --network=none` SWC materialization retained; the 45 proof rows and the fresh candidate manifest for any recipe change | digest, build receipt, scan receipt |
| Runtime IAM | control task: read its three secret files, PG network path, Temporal network path, `ecs:RunTask`/`DescribeTasks`/`StopTask` on the dedicated cluster only, S3 immutable-version operations on the prefix with the KMS key; runner task: no AWS API permissions beyond its own metadata denial; browser host: egress restricted and metadata denied | role policies |
| Keys | one KMS key for the artifact bucket and the secrets; key policy limited to the two task roles and the shipping owner; rotation recorded as a receipt | key policy |
| Logs | task stdout/stderr to dedicated log groups; the runtime never logs credential values (`assertRunnerEnvironment`, redaction in receipts); access limited to shipping and dot | log groups, retention period |
| Retention | log, backup and object retention periods; deletion of transcripts, events, uploads, browser state, workspaces, previews, artifacts, telemetry and backups needs the retention design proposal of `FABLE-DOCUMENT-COVERAGE-MAP-20261014.md` gap 2 before any policy is automated | periods, policy owner |

## 5. Rollback and in-flight compatibility

- Image rollback: the previous admitted digest stays in ECR; rollback is a task definition revision pointing at it, performed by shipping with its own packet; the config digest must match the digest's accepted candidate.
- Configuration rollback: configuration is a versioned file per role; rollback restores the previous accepted file; `validateConfiguration` refuses unknown fields, so a rolled-back runtime cannot load a newer config shape.
- Database: migrations 0001–0008, product-budget 0001 and artifact-version 0001 are additive; no down migration is authorized by this packet; a rollback keeps the schema and runs the previous runtime against it, which the stores tolerate because they read exact tables and refuse corruption rather than reinterpreting rows.
- In-flight workflows: Temporal workflow determinism is preserved by the canonical bundle (`bundle.test.mjs`); a runtime rollback must register the same workflow definitions; in-flight runs end in their recorded state (`completed`, `failed`, `cancelled`, `UNKNOWN`) and are never redispatched by a restart (`prepared-temporal.test.mjs`, `native-prepared-launch-pg.test.mjs`).
- Canary: only after G2 acceptance, on allowlisted tenants, with the bypass and rollback drill of REL-09 exercised first; no canary is authorized by this packet.

## 6. What Fable returns with this packet

- This inventory, derived from the configuration schema at PR86, with every binding marked UNBOUND or configuration-only.
- The exact readbacks the runtime performs for each binding, so shipping can verify a value before an action.
- The three preconditions in section 1, which block the packet from becoming an action packet regardless of the bindings.

Shipping freshly reads back any current inventory before acting; dot records ACCEPT or HOLD on the packet shape. Nothing here authorizes a build, a resource, a credential, a migration, a deployment or a legacy deletion.
