# Dedicated Meri candidate: minimal deployment handoff

This is a source-to-deployment handoff, not permission to deploy. Neo's current direction is a new dedicated Meri runtime/database/Temporal/storage/proxy, with eventual retirement of old resources planned separately. No old resource deletion, legacy secret adoption, capability issuance, cloud mutation or IAM/network change occurred in this slice. Exact final source and qualification receipts are recorded in the candidate manifest. Product Claude SDK/CLI and Temporal architecture are unchanged; engineering/review used OpenAI/Codex.

## Inputs known versus absent

Parent's read-only inventory identifies dedicated reuse candidates: CodeBuild `meri-greenfield-qualification-build`, ECR `meri-greenfield/qualification-worker`, cluster `meri-greenfield-qualification` in VPC `vpc-06e1941747e798f0a`, and versioned KMS private bucket `meri-greenfield-qual-checkpoint-967807252336-us-east-1`. The cluster currently had zero services/tasks. These are reuse candidates if suitable, not compulsory dependencies or deployed acceptance. Existing task definitions lack measured runner/bootstrap, private HTTP and init bindings; they cannot be relabelled as the repaired candidate.

Absent approved non-secret bindings: immutable base `NODE_IMAGE`; repaired built runtime image digest and actual runner/executable measurements; dedicated runtime database endpoint/connection-file reference; private Temporal endpoint/namespace/queue/TLS-file references; dedicated provider-proxy origin/model/credential-file reference; live Capiro application-authority origin/current identity-file reference; public Meri HTTPS origin; original-task private HTTPS routing/TLS/bootstrap placement; exact current binding/qualification/allocation/grants and role/task-definition/network references. Observed legacy RDS/provider references are not accepted substitutes. No actual secret value belongs in this document.

Existing backend `/api/clio/application-authority/identity` and `/context` remain stable external contracts. Reusing their application identity/data authority does not require adopting legacy Meri runtime, database, orchestration, model proxy or secrets.

## Small first-real-conversation deployment

Use one approved dedicated control workload running the existing `control` CLI, one Temporal poller running `temporal-worker`, and one fresh non-root conversation Fargate task for the exact approved run. Control owns canonical PostgreSQL, current authority, allocation/admission, original process observation, immutable checkpoint access and provider mediation. Temporal owns workflow/activity durability. The conversation task owns one SDK Query and CLI, private HTTP receiver and workspace; it receives only its pre-existing task capability and task-scoped proxy access, with no DB/provider/admin/Temporal/cloud credentials. The immutable task image needs init/descendant reaping and actual runner/executable measurement; declaring a runner hash in an environment variable is not measurement proof.

Provide one dedicated private PostgreSQL deployment with canonical conversation migrations0001–0008 and product budget0001, current budget row and approved admission inputs. Provide one dedicated private Temporal deployment with its persistence, namespace/queue and TLS; do not add Temporal Cloud or duplicate an approved dedicated deployment. If no suitable existing dedicated binding exists, creation is a separately approved shipping action. Existing dedicated qualification VPC/cluster/build/ECR may be reused after qualification; otherwise the shipping owner selects new dedicated runtime resources without forcing legacy dependencies.

Provide the dedicated trusted provider proxy with the exact model and approved owner-supplied credential/reference. No paid provider execution is authorized here. A future real prompt needs an explicit per-run turn/cost/deadline/output budget and provider-call approval; the 24-hour pilot availability window does not extend a worker's original lease or authorize repeated runs.

For checkpoint capture/inspection, provide an approved versioned KMS private object bucket/prefix and its exact owner/key bindings. The existing dedicated qualification bucket is suitable only after the shipping owner verifies its purpose, policy, versioning, KMS and network path; otherwise provision dedicated runtime checkpoint storage under the approval bundle. Ordinary first-prompt execution does not need artifact generation, Office rendering, browser hosts, governed mutations or output publication. Those remain later product qualification work, not waived scope.

## Required access paths for approval

These describe required paths, not an applied IAM policy. Shipping must review exact role/resource bindings and supported IAM conditions before executing.

- Control: existing canonical SQL and Temporal/TLS connectivity; backend identity/context HTTPS; dedicated provider proxy; task allocation/read/stop on the approved cluster and exact immutable task definition, with narrowly approved role passing; original-task private HTTPS for release/stdin/stdout/inspection/cleanup. The source uses adopted ECS RunTask/DescribeTasks/DescribeTaskDefinition/ListTasks/StopTask commands. No broad account access is needed.
- Task: image/log/bootstrap reads through its separately approved execution role, private HTTPS to the bound control and trusted provider proxy, and the original private receiver path from control. No task access to DB, Temporal, provider secret, administrative APIs or S3 control storage.
- Checkpoints: control-only bucket versioning inspection, create-only versioned writes and exact-version reads in the selected checkpoint prefix, plus that key's narrowly approved KMS use. Current inventory permits only `qualification-sdk/fixture/*`; do not silently widen to unrelated objects. Its S3 endpoint currently permits only ECR-layer reads, so checkpoint bucket connectivity is an explicit missing least-scope network approval if capture/inspection is included. No duplicate NAT or broad internet/S3 permission is implied.
- Build/public access: build the pinned source with approved immutable `NODE_IMAGE`, publish to the approved dedicated ECR repository, and bind public/private TLS to approved hostnames. Public Meri routes must not expose private worker/control capabilities or process/bootstrap/checkpoint receiving routes.

HA replicas, autoscaling, broad source access, browser/renderer hosts, artifact/export services, scheduled jobs and retirement of old infrastructure are later product work. Existing single-replica process-local action-session configuration is a bounded pilot constraint; it is not a production HA claim.

## Executable source and commands

The authoritative closed validator is `apps/runtime/config.mjs:validateConfiguration` plus `prepared-candidate-config.mjs:compilePreparedCandidateConfiguration`; this avoids a second configuration owner. The candidate author directory contains three complete `SYNTHETIC-*-configuration.json` examples, validated by tests. Their IDs, hashes, paths, deadlines and reserved origins are fixtures. Replace them with approved exact owner bindings; they are not deployable credentials or live references.

Validate each supplied file without allocation using the existing `loadConfiguration` function, then invoke:

```
node apps/runtime/cli.mjs control --config /run/meri/control.json
node apps/runtime/cli.mjs temporal-worker --config /run/meri/temporal-worker.json
node apps/runtime/cli.mjs conversation-runner --config /run/meri/runner.json
```

Control opts into closed `nativeCandidate`, borrowing its existing Pool/Temporal client and configured current identity. The Temporal worker sets `native.preparedKickoff=true`; the task sets `captureOwnsClose=true` and `bootstrap.remote=true`. Task bootstrap obtains only its admitted original tuple, actual ARN, preparation intent and private receiver binding through its existing task capability. It mounts the same listener/Query/mirror, waits for exact control release, and keeps callback availability through positively acknowledged original control cleanup. No arbitrary module loader, new issuer or parallel persistence owner is introduced.

Configuration supplies exact fixed first-run identity binding/client/policy, runtime versions/proxy/model/budgets, preparation/image/executable/runner/options/authority pins, allocation JSON/qualification/grant intents, approved task definition/cluster/network/command and task HTTP origin/listener binding, existing identity/task/control/proxy capability-file paths, object bucket/prefix/owner/key, database connection file and Temporal TLS files. Secret files must meet existing no-follow/owner/mode bounds. Current backend identity/context is checked before and after release. Once a canonical run exists, exact canonical scopes/policy/fence must match; only genuine missing-row state permits the already-approved fixed first-run input. Configuration is not evidence that these inputs are currently authorized.

## Frontend PR39 and acceptance path

Current receiving candidate is frontend PR39 `348c98dfe1962fac962157eb785732281a282d06`. Set `MERI_API_BASE_URL` to the approved public Meri HTTPS origin, without `/api`, `MERI_CONVERSATION_WORKFLOW_ENABLED=true`, existing valid same-environment Clerk configuration and Core `/api` binding. Strategy `/strategy-api` and Workspace `/workspace-api` remain separate. No actual approved Meri hostname is supplied here. Existing `CAPIRO_PREVIEW_READ_ONLY=true` containment blocks activation; only the release owner may approve its relevant activation change. All337native acceptance rows remain open.

A bounded future acceptance run should verify: actual immutable image/runner/bootstrap and non-root isolation; fresh real backend authority/current canonical admission; one frontend opaque session and immutable submit; Temporal kickoff before one Query/native launch; real prompt through the approved proxy under its budget; streamed history/events/reconnect and cancellation; exact original physical cleanup; then checkpoint publication and inspection with a fresh current identity after source-task expiry if that phase is approved. Read-only object/process/SQL fixtures and separate zero-turn SDK probes cannot be combined into a fictitious deployed receipt.

This candidate is explicitly a fixed first-run receiving composition. Existing wider continuation admission/retirement and approval read/decision owners are not mounted by this first-conversation compositor; fresh-run/resume/fork/output/browser/source and broader product acceptance remain open. It does not claim arbitrary multi-run/multi-tenant production orchestration or full rebuilt Meri completion.
