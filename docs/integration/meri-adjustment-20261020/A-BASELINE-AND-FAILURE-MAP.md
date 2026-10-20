# Package A: deployed baseline and failure map (Meri adjustment plan, Revision 2)

Prepared 2026-10-20 03:09–03:45Z by session adj-a-baseline (Fable). Branch `fable/adj-a-baseline-20261020`, base
`2b4421f612f9fbb728d6da52927aac228d712d40`. AWS reads used `--profile capiro-dev --region us-east-1` and were read-only.
No AWS mutation was made, no secret value was read, nothing was deployed and no chat was sent.

Labels used throughout:
- **[R] recorded**: read from AWS or Git during this session.
- **[D] derived**: computed by running or reading the deployed source on recorded inputs.
- **[I] inference**.
- **[U] unknown**.

Ownership changed at about 04:00Z. Neo directed: "Leave dot out of this . You Can deploy . This will be all of Claude". The
Claude orchestrator session is now the single AWS operator and shipper; dot is no longer involved. Earlier mentions of dot below
are historical records only.

Companion files, used by the read packet in §4:
- [A-FAILED-ATTEMPT-READONLY.sql](A-FAILED-ATTEMPT-READONLY.sql): the read-only durable-state queries.
- [A-FAILED-ATTEMPT-READ-RUNNER.cjs](A-FAILED-ATTEMPT-READ-RUNNER.cjs): the in-task runner.
- [A-FAILED-ATTEMPT-READ.overrides.json](A-FAILED-ATTEMPT-READ.overrides.json): the RunTask overrides built from the two files
  above.

## 0. Summary

1. **Deployed baseline (03:09Z).** Nothing has changed since the release E rollout completed at 01:34Z. Running: control:35,
   temporal-worker:34, temporal-issuer:34, owner:33 and proxy:33; runner:20 is the RunTask family. Node image `f5a7abc9…`
   (ECR tag `product-2b4421f6…`), proxy image `734a20ec…` (source `34851020`), Temporal server `f73ce01e…` (source `989a4227`),
   Core `ade7fc88` and frontend `67fdf56b` (both confirmed by ECR tag). Material secrets use version label
   `FIRST_CHAT_20261020E`. There are no pending CloudFormation change sets.
2. **No later chat.** Since the failed E attempt, nothing has been deployed and no conversation workflow has started. The only
   `StartWorkflowExecution` between 01:30 and 03:20Z was at 01:39:13.851Z, and the only control-role `RunTask` was at
   01:39:17Z. One public request to control at 02:25Z returned a target 5xx in 0.14 s; it started no workflow.
3. **Attempt identity (all [R]).** Tenant `17b63099-bc0f-4ac5-b596-496161e9481e`, conversation `13865b0a-…`, run
   `c3af3d1d-66bb-46ed-94fc-5a7a87e97ade`, Temporal run `01a156f6-711a-7c83-b5fe-82693a966bc5`. Execution/binding key
   `2b6358940a46…8432`, plan `8468284d…`, allocation lease expiry 01:53:19.753Z.
4. **Configuration inconsistency on the failing hop [D].** The runner allows its `start` exchange 23 s (30 s transport ceiling).
   Control's task router bounds the same forwarded request at a hard-coded **8 s** and turns any expiry into a 403, which the old
   transport reports as `UNKNOWN`. This is demonstrated in source but is **not proven** to be the live cause.
5. **Failure became 12 minutes of waiting [R].** After the 01:41:02 failure, the `executeConversation` activity kept
   heartbeating every 48 s until the allocation lease expired at 01:53:19.753. Containment then began at 01:53:20.
6. **Durable state is unread; a read packet is ready for the orchestrator.** The existing task definition
   `meri-product-preview-d2-migrate:6` already holds the least-privilege DB logins. One RunTask with the supplied overrides runs
   read-only SQL derived from the real schema (§4). It creates nothing new and reads no secret value outside the task. [I] The
   conversation may stay blocked for new allocations until its allocation is `RETIRED` with a recorded stop proof (Q3 checks
   this).
7. **Rollback.** Every predecessor task-definition revision is INACTIVE (deregistered by `jump-cli`), and the rendered material
   pins exact task-definition ARNs. A rollback is therefore a re-registration plus a private re-render and a staged rollout, not
   an `UpdateService`. No revision has ever completed a chat, so there is no known-good chat baseline.

## 1. Deployed baseline

### 1.1 Services and images ([R], 03:09Z)

The table separates three kinds of value:
- **Deployed now**: live ECS and ECR state.
- **Historical**: the 10-19 18:31Z state from PR #121 comment 6274410983, and the D revisions.
- **Proposed**: not applicable; no candidate is staged for deployment.

| Role | Deployed now: task def / running task (start UTC) | Deployed image (ECR tag → source) | Historical: 18:31Z (C) | Historical: D (deregistered) |
| --- | --- | --- | --- | --- |
| control | control:35 (reg 01:29:30Z) / c95be8bc (01:31:22.952, HEALTHY) | `f5a7abc9…5ff7` → `product-2b4421f6…` | control:33, `9bff84ba` (a16cc40d) | control:34, `ea0e9ad4` (5b395d4c) |
| temporal-worker | worker:34 (01:29:29Z) / ee2c5dee (01:31:57.693, HEALTHY) | `f5a7abc9…` | worker:32 | worker:33 |
| temporal-issuer | issuer:34 (01:24:14Z) / 56be9ac8 (01:25:58.512) | `f5a7abc9…` | issuer:32 | issuer:33 |
| model owner | owner:33 (01:10:34Z) / a79e2d92 (01:12:20.495) | `f5a7abc9…` | owner:31 | owner:32 |
| model proxy | proxy:33 (01:10:34Z) / 7643ec1e (01:12:22.564) | runtime `734a20ec…` → `proxy-product-34851020…`; init `f5a7abc9…` | proxy:31 | proxy:32 |
| runner (RunTask) | runner:20 (01:29:29Z), latest ACTIVE; no task now | `f5a7abc9…` | runner:18 | runner:19 |
| Temporal server ×5 | frontend, history, matching, internal-frontend, internal-worker, each :1 (10-17) | `f73ce01e…` → `temporal-server-989a4227…` | same | same |
| Core | capiro-preview-first-chat-core:2 / 6df6b502 (10-17 18:31Z, HEALTHY) | `capiro/preview-core@46acfc07…` → tag `ade7fc88…` | same | same |
| Frontend | capiro-portfolio-preview:18 (cluster capiro-portfolio-preview) / e09c2809 | `capiro/portfolio-preview@0401f61d…` → tag `67fdf56b…` | same | same |

More recorded facts:
- [R] **Secret versions in use** are `FIRST_CHAT_20261020E`, created 00:48–00:49Z: control `a9c2148b`, worker `f1522c03`,
  issuer `ba82451b`, owner `67dfd78d`, proxy `bf1b441d`. Labels 19, 19B, 19C and 19D remain on older versions. Only version
  metadata was listed.
- [R] **Stacks.** `meri-first-chat-model` was updated at 01:10:30Z, `-issuer` at 01:24:10Z and `-app` at 01:29:25Z, all
  UPDATE_COMPLETE with no change sets. `-temporal` (10-17), `-foundation` (10-17) and `-private-edge` are unchanged.
- [R] **No activity after 01:34Z.** ECS service events for the five app services end with the 01:10–01:34Z rollout. CloudTrail
  shows no Meri `RegisterTaskDefinition`, `UpdateService` or `RunTask` after 01:39:17Z.
- [R] **Stale frontend labels.** `capiro-portfolio-preview:18` sets `CAPIRO_PREVIEW_MERI_RUNTIME_SOURCE=176a8811…`,
  `CAPIRO_PREVIEW_MERI_RUNTIME_IMAGE_DIGEST=sha256:5534edfe…` and `CAPIRO_PREVIEW_MERI_CONTRACT_PACKAGE_VERSION=0.1.10`. None of
  these describe the deployed Meri runtime. [I] They are informational; this is a manifest-drift item for package F.

### 1.2 Versions and executable identity

| Item | Value | Evidence |
| --- | --- | --- |
| Node / libc / base image | v24.21.0 / glibc 2.44 / `cgr.dev/chainguard/wolfi-base@sha256:030e45cb…` | [R] Measured on the exact image by dot's measurement build `aaab4ac1…` (`runtime-packages.json`). Not re-measured here. |
| Agent SDK | `@anthropic-ai/claude-agent-sdk` 0.3.295 | [R] `apps/worker/conversation/package.json` and lock (`sha512-GaLZbMAq…`). Enforced by `native-authority/launch-configuration.mjs:14` and `runtime-provider.mjs:12`. |
| CLI | 2.1.295 | [R] `launch-configuration.mjs:14`, `build/first-chat-launch-measurement.mjs:30` |
| CLI executable | `/opt/meri/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude`, 256,113,848 B, sha256 `4503bfe1…f358` | Declared in `runtime-values.json`. **Verified** by the packet's launch measurement (all 7 gates PASS) on the exact digest. Not re-hashed here. |
| Runner / SDK options sha256 | `166742d9…96f5` (also runner:20 env) / `fbc8e95d…` | [R] |
| Launch arguments | stream-json in/out, `--thinking=disabled`, `--max-turns=3`, `--max-budget-usd=2`, `--model=meri-sonnet-qualification`, `--tools=`, `--setting-sources=`, `--permission-prompt-tool=stdio`, `--session-mirror`; `ANTHROPIC_BASE_URL=https://proxy.meri.internal:8443/` | [R] `runtime-values.json` |
| Model | profile `us.anthropic.claude-sonnet-4-6`, alias `meri-sonnet-qualification`; per-run max 2,000,000 µUSD; 65,536 in / 8,192 out tokens | [R] policy and deployment inputs |
| Runner task | 1 vCPU / 2 GB, X86_64, uid 1000:1000, read-only root, sg-098fc4f2ac89aa943, subnets of `deployment-inputs` | [R] runner:20 |
| Runner → control | `MERI_POSTSTART_CONTROL_ORIGIN=https://control.meri-preview.internal`, the internal ALB `meri-preview-control-private` → TG `meri-preview-control-8082` (HTTP1 to target) | [R] |
| Private ALB attributes | idle 120 s, HTTP/2 on, desync mitigation `defensive`, drop invalid headers on, **access and connection logs off** | [R] |
| Public control | TG `meri-preview-control-8080` on the shared `capiro-prod-alb` | [R] |

Provenance: dot's release packet `origin/handoff/runner-diagnostic-release-20261020` @ `c8fcf965` (README, `public-candidate/`,
`measurement-results/`). Image build `04e83f76…` SUCCEEDED at 00:13:45Z and measurement build `aaab4ac1…` at 00:19:27Z. The ECR
scan found 0 HIGH/CRITICAL.

## 2. Effective non-secret startup configuration

### 2.1 Where the values come from

The rendered configs (`control.json` `e5f7c0fb…`, `worker.json` `a7ae502d…`, `issuer.json` `b0670d20…`, `owner.json`
`73d783d7…`, `proxy.json` `24db403a…`) exist only inside the Secrets Manager material bundles. They were not read.

Neo rendered them on neomart with the released wrapper. It pins source `2b4421f6`, so the render code is
`infra/product-preview/first-chat/render-material.mjs` at `2b4421f6` (Neo reported `PR193_LOCAL_RENDER_COMPLETE`). The values
below are constants in that code, so they are **[D]**. Byte-equality with the deployed hashes cannot be checked without the
private inputs.

`render-material.mjs:591` sets `limits = {startupMs: 30000, shutdownMs: 10000, requestMs: 25000, requestBytes: 131072}` for
control and temporal-worker. The runner receives the same limits through control's prepared delivery (comment at :593).

### 2.2 Startup budget for this attempt

[D] Computed by running deployed `packages/runtime/runner-load-budget.mjs`:

```
runnerStartupBudget({requestMs: 25000, shutdownMs: 10000, originalExpiresAtMs: 1792461199753})
```

The inputs are the deployed limits and the recorded RunTask tag `meri:expires-at-ms`. The result reserves 302,000 ms, so the
last stage cutoff is 01:48:17.753Z.

| Stage | maxMs | Cutoff (UTC) |
| --- | --- | --- |
| bootstrap | 23000 | 01:44:24.753 |
| admittedBefore | 23000 | 01:44:47.753 |
| admittedAfter | 23000 | 01:45:10.753 |
| load | 23000 | 01:45:33.753 |
| runtime | 23000 | 01:45:56.753 |
| local | 3000 | 01:45:59.753 |
| starting | 23000 | 01:46:22.753 |
| setup | 23000 | 01:46:45.753 |
| running | 23000 | 01:47:08.753 |
| nativePrepare | 23000 | 01:47:31.753 |
| **nativeStart** | **23000** | **01:47:54.753** |
| session | 23000 | 01:48:17.753 |

At 01:41:02.451 the runner's native-start allowance was not exhausted. This matches the prior finding that a lifetime expiry would
have reported `REMOTE_TASK_REFUSED`, not `UNKNOWN`.

### 2.3 Hop limits on the failing path

| Hop / timer | Effective value | Source at 2b4421f6 |
| --- | --- | --- |
| Allocation lease (original expiry) | admission + `maxRuntimeSeconds` 900 → 01:53:19.753Z [R tag]; [I] admission ≈ 01:38:19.75Z | allocation.json budgets; RunTask tag |
| Runner → control `/v1/native-task/{prepare,start}` client lifetime | min(`startupMaxRequestMs` = min(23000, 25000 − 2000) = 23000, stage.maxMs 23000), clipped to stage and original expiry; error factory `REMOTE_TASK_REFUSED` | `remote-composition.mjs:64`, `remote-task-client.mjs:10-15`, `remote-conversation-runner.mjs:43` |
| Pinned transport (runner) | 30000 ms timer, socket `timeout: 30000`, TLSv1.3, `connection: close`, no pool. A non-200 response destroys the response before the body is read, and every rejection is code-less | `pinned-native-transport.mjs` |
| **Control task router, per forwarded `/v1/native-task/*` request** | **8000 ms, hard-coded**, clipped to original and authority expiry. Covers 3× authority verify, 3× network observe (ECS DescribeTasks + EC2 DescribeNetworkInterfaces), the runner TLS connect, the forwarded runner operation and the response. Any failure returns 403 `TASK_ROUTER_REFUSED`; a closed router returns 503 | `control.mjs:180`, `task-router.mjs:10-52` |
| Router → runner TLS handshake | min(3000, candidate expiry − now) | `runner-tls-client.mjs:93` |
| Control `/v1/runner/native/*` preparation endpoint | default 3000 (`preparation-http.mjs:8`); [U] deployed wiring to be confirmed by package C | — |
| Runner `admitted` gate calls | min(8000, stage.maxMs) | `preparation-http.mjs:21`, `remote-conversation-runner.mjs:41` |
| Prepared kickoff wait | min(1,800,000, admittedAfter cutoff − now) | `remote-conversation-runner.mjs:41` |
| Runner cleanup | 10000 per step; retirement wait up to original expiry + 10 s | `remote-conversation-runner.mjs:44` |
| Control DB / Temporal | pg connect and query 25000; Temporal connect 30000; run-budget reader 3000 | `control.mjs:112,157-158` |
| Temporal token / issuer delivery | refresh 5000, max lifetime 60000; delivery request 3000; bootstrap 12000 / total 30000 | `render-material.mjs:573-583` |
| Issuer | request 5000, bootstrap 10000, currentness lease 20000, task-authority lease 8000, startup 60000 | `render-material.mjs:617-622` |
| Model owner | request 3000, lease 30000 | `render-material.mjs:636` |
| Control sessions | process-local, 1 replica, 100 max, TTL 300000 | `render-material.mjs:595` |
| Private ALB | idle timeout 120 s | [R] |

**Inconsistency [D].** On the `start` hop the inner runner allowance (23 s) is wider than the router's 8 s. The router's 8 s
covers the runner's own `start` work (supervisor and CLI launch, plus the runner's nested preparation calls). It also covers six
serial AWS readbacks. This is the "8 s router" suspect from plan §2, now tied to effective values. It is not proven to be the
live cause; see §3.3.

## 3. Failed E attempt timeline (2026-10-20, UTC)

Sources: CloudWatch `/meri/product-preview/{control,worker,runner,issuer,owner,proxy,temporal}`, CloudTrail control-task-role
events, and ALB metrics. Raw files are in `C:\dev\fable\adj-reports\adj-a-evidence\` on the investigation host (not committed;
the queries are reproducible).

### 3.1 Correlation identifiers

| Identifier | Value | Source |
| --- | --- | --- |
| Workflow ID | `meri:17b63099-bc0f-4ac5-b596-496161e9481e:13865b0a-b0d0-41de-8c97-c2a2058fa222:c3af3d1d-66bb-46ed-94fc-5a7a87e97ade` | [R] worker log. Format `meri:${tenantId}:${conversationId}:${runId}` per `temporal-dispatch.mjs:8` [D] |
| Tenant / conversation / run | `17b63099-…` / `13865b0a-…` / `c3af3d1d-…` | [D] from the workflow ID |
| Temporal run ID / namespace ID | `01a156f6-711a-7c83-b5fe-82693a966bc5` / `6d4cbe46-8224-4c60-ae53-fc5c0d15a90a` (namespace `meri`, queue `meri-conversations`) | [R] worker log, decoded task token |
| Activities | `executeConversation`: scheduled event 5, attempt 1. `reconcileConversation`: scheduled event 11, attempts 1–7 | [R] decoded task tokens |
| Execution / binding key | `2b6358940a46173d56f2a4873b91afd797ef35c53a1c38909a6f1ed7297a8432` (RunTask `startedBy`, `clientToken`, group `meri:<key>`, tags `meri:execution-id` and `meri:binding-sha256`) | [R] CloudTrail RunTask. Equals hash(RunBinding) = `native_executions.execution_id` = `native_allocations.intent_key` [D] |
| Plan sha256 | `8468284d23a5509356d7b70a53a5aabc2e7f4613bf84e278f930208138bc81bc` | [R] RunTask tag |
| Lease expiry | `1792461199753` = 01:53:19.753Z | [R] RunTask tag |
| Runner task | `283f12c53eba4dc89f4d54767d0fa832`, runner:20, subnet-0920665f91c905f01, ENI 10.40.7.226 | [R] |
| attemptId, workerId, writerFence (fence generation), actorId | [U] in RunBinding (`model_run_issuances` CHECK lists the keys); read with query 1 or 5 | — |
| HTTP request IDs | [U] control and runner do not log requests, and ALB access logs are off | — |

### 3.2 Timeline

| UTC | Event | Label |
| --- | --- | --- |
| 01:31:22.952 / 01:31:57.693 | control c95be8bc / worker ee2c5dee start (before that, worker task 54dc8f19 logged `RUNTIME_UNAVAILABLE` at 01:30:49 and stream `…5c3ae84a8a46` at 01:30:01; unexplained, as in the handoff) | R |
| 01:38 | Public control TG: 11 requests, 5 target 4xx, max target response time 15.72 s. Control logs "Client connection prematurely closed." at 01:38:18.431 and 01:38:29.946 | R; attribution U |
| ≈01:38:19.75 | Admission (lease expiry − 900 s) | I |
| 01:39:13.851 | Temporal `StartWorkflowExecution` meriConversationLifecycleWorkflow (the only one between 01:30 and 03:20Z) | R |
| ≈01:39:14.25 | `executeConversation` begins (01:53:20.681 − durationMs 846430) | D |
| 01:39:17 | Control task role `RunTask` runner:20 → 283f12c5 (created 01:39:17.207) | R |
| 01:39:18–01:40:04 | Control `DescribeTasks(283f12c5)` about 1 Hz while the image is pulled (01:39:30.964–01:40:00.346) | R |
| 01:40:01.865 | Runner started | R |
| 01:40:02.724 | First `executeConversation` heartbeat; heartbeats then every 48 s until 01:52:50.752 | R |
| 01:40:04–01:40:11 | Dense control readbacks (DescribeTasks, DescribeNetworkInterfaces, DescribeTaskDefinition runner:20) | R; [I] poststart/bootstrap authority |
| 01:40:22–01:40:24 | Short readback cluster | R |
| 01:40:24–01:40:50 | **26 s with no control AWS readbacks** | R |
| 01:40:50–01:41:02 | Dense continuous readbacks: 8 DescribeTaskDefinition, 10 DescribeNetworkInterfaces, about 25 DescribeTasks; they end in the failure second | R; [I] router authority/network checks for prepare/start |
| minute 01:40 | Private ALB: 91 requests (78 target 2xx, **13 target 4xx**), max target response **13.08 s**, 37 new connections | R |
| 01:41:02.448 | control: "Client connection prematurely closed." | R |
| 01:41:02.449 | runner: "Client connection prematurely closed." (runner's :8080 listener) | R |
| 01:41:02.451 | runner: `RUNNER_FIRST_FAILURE origin=native-start code=UNKNOWN` | R |
| minute 01:41 | Private ALB: 69 requests (62 target 2xx, 6 target 4xx, **1 ELB 4xx**), max target response **10.38 s**, 0 ELB 5xx, 0 target connection errors, 0 client TLS errors | R |
| 01:42–01:52 | Private ALB steady at 59–60 requests/min, all 2xx, max ≤ 0.15 s; active-connection sum 2/min | R; [I] polling or streaming during the waiting period |
| 01:53:19.753 | Lease expiry | R |
| 01:53:20–01:53:58 | Control `StopTask(283f12c5, "Meri original allocation containment")` ×9 with DescribeTasks | R |
| 01:53:20.681 | worker: `executeConversation` failed `BROKER_KICKOFF_CLEANUP_UNKNOWN`, cause `NATIVE_UNAVAILABLE` (`native-client.mjs:34`), durationMs 846430 | R |
| 01:53:21.139–01:53:59.171 | `reconcileConversation` attempts 1–7, each `NATIVE_UNAVAILABLE` (294–833 ms) | R |
| minute 01:53 | Private ALB: 29 requests, 2 target 4xx, **8 target 5xx** | R |
| 01:53:29.764 | runner: `RUNNER_RUNTIME_FAILED stage=activity-stream code=UNKNOWN`, then `RUNTIME_UNAVAILABLE` | R |
| 01:54:07.526 | Runner stopped, exit 3 | R (prior read) |
| 01:54:09.435 | Workflow failed (Activity task failed ← `BROKER_KICKOFF_CLEANUP_UNKNOWN`) | R |
| 01:56:15.919 | control: "Client connection prematurely closed." | R; attribution U |
| 02:02 / 02:25 | Public control: 1 target 4xx / 1 target 5xx (0.14 s). No workflow started | R |
| 01:30–03:20 | issuer, owner, proxy and migrator log groups: **0 events** | R. This does not prove zero provider activity or spend |

### 3.3 What the ordering can and cannot separate

All three log lines fall within 3 ms on two hosts. Fargate clocks are normally within about 1 ms, so this ordering is weak
evidence:

- **Router-deadline reading (B in the prior diagnosis).** Router aborts the runner leg, then replies 403, then the runner rejects.
  Under this reading control's response would normally be written in full, and its premature-close line would be unexpected or
  would belong to another request.
- **Edge or client-close reading (A or C).** The client or ALB closes control's request first (control .448). Router cancellation
  then closes the runner leg (runner .449), and the runner rejects (.451). This fits the order shown and the single ELB 4xx.

Two further points:
- The router's own lifetime should keep its responses near 8 s. Max target response times of 13.08 s and 10.38 s in these
  minutes therefore suggest a different route, such as the preparation endpoints or poststart. [U] They are unattributed.
- The 13 + 6 target 4xx during startup are also unattributed.

The repaired failure codes (package B), or ALB access logs on `meri-preview-control-private`, would separate these readings. Both
are decisions for the orchestrator.

## 4. Durable state: read packet for the orchestrator

### 4.1 Read access

This session has no read channel of its own and makes no AWS mutations. The orchestrator, now the single AWS operator, can run
the read with one RunTask on an **existing** task definition. It registers no new resource and reads no secret value outside the
task. Nothing in the packet contains a secret.

| Item | Value |
| --- | --- |
| Task definition | `meri-product-preview-d2-migrate:6` (ACTIVE, registered 10-18 07:08Z, X86_64, 0.25 vCPU / 0.5 GB). Execution role `MeriPreview-migrator-execution`; **no task role**, so no AWS API access from inside. Read-only root; `/run/meri` volume |
| Image | `qualification-worker@sha256:5534edfe…` (ECR tag `product-176a8811…`, still in ECR). It contains `node` and `pg` 8.23.1 under `apps/runtime/node_modules`, which `first-chat-migrate.mjs` uses. A RunTask cannot change the image; only Node and `pg` are used |
| Secrets the task already injects | Aurora master (`PGUSER`/`PGPASSWORD`), the per-role logins from `meri/preview/migrator/logins` version `90031867…` (AWSCURRENT), and the RDS CA. The override's shell **unsets** the master, issuer and temporal migrator/primary credentials before Node starts. **The master login is never used** |
| DB logins used | `meri_control_runtime` (SELECT on every `meri_conversations` table read here, and on budget `runs`/`grants`/`tenant_*`). `meri_model_budget_owner` (SELECT on `meri_product_budget.requests`). `meri_temporal_visibility_runtime` (SELECT on `temporal_visibility.public.executions_visibility`). Grants: `infra/product-preview/first-chat-database.sql:240-300`, `existing-database-grants.sql:201` |
| Read-only enforcement | Connection option `default_transaction_read_only=on`, each section in `BEGIN TRANSACTION READ ONLY … ROLLBACK`, `statement_timeout` 15 s, SELECT statements only. Postgres refuses any write inside a read-only transaction even though these runtime roles hold INSERT/UPDATE grants |
| Network | subnet `subnet-0920665f91c905f01` (us-east-1a); SGs `sg-0c9f0505c552ce469` (meri-preview-migrator) and `sg-0d5b5286baf28242e` (meri-preview-dbclient). Same as the earlier d2-migrate measurement runs (`docs/integration/scripts/measure-n21.sh`) |
| Output | CloudWatch `/meri/product-preview/migrator`, stream `d2/d2-migrate/<task-id>`. One JSON line per SELECT, then `{"complete":true}` (exit 0). A failed statement prints `{"error":…}` and the run continues; a connection failure exits 2. Strings over 160 characters are truncated and byte values replaced by their length, so prompts, transcripts and blobs do not enter the log |
| Cost | One Fargate task of about 0.25 vCPU for under a minute. No model request |

Temporal event history (beyond the visibility row) would need the Temporal frontend with an authorized mTLS + issuer-JWT
client identity. No existing task definition provides that, so it is left out rather than creating new access. Q2 and Q10 cover
ordering and terminal status.

### 4.2 Commands (orchestrator only)

Run from a checkout of this branch:

```bash
aws ecs run-task --profile capiro-dev --region us-east-1 --cluster capiro-dev --launch-type FARGATE --platform-version 1.4.0 --count 1 --task-definition meri-product-preview-d2-migrate:6 --started-by adj-a-durable-read --network-configuration 'awsvpcConfiguration={subnets=[subnet-0920665f91c905f01],securityGroups=[sg-0c9f0505c552ce469,sg-0d5b5286baf28242e],assignPublicIp=DISABLED}' --overrides file://docs/integration/meri-adjustment-20261020/A-FAILED-ATTEMPT-READ.overrides.json --query 'tasks[0].taskArn' --output text
```

```bash
aws ecs wait tasks-stopped --profile capiro-dev --region us-east-1 --cluster capiro-dev --tasks <task-arn>
```

```bash
MSYS_NO_PATHCONV=1 aws logs get-log-events --profile capiro-dev --region us-east-1 --log-group-name /meri/product-preview/migrator --log-stream-name d2/d2-migrate/<task-id> --query 'events[].message' --output text
```

Overrides shape, with the SQL and JS values abbreviated (8,131 bytes in total, under the 8,192-byte limit):

```json
{"containerOverrides":[{"name":"d2-migrate",
  "command":["set -euo pipefail; umask 077; printf \"%s\" \"$MERI_D2_RDS_CA_PEM\" > /run/meri/rds-ca.pem; unset MERI_D2_RDS_CA_PEM PGUSER PGPASSWORD MERI_D2_ISSUER_PASSWORD MERI_D2_TEMPORAL_MIGRATOR_PASSWORD MERI_D2_TEMPORAL_PRIMARY_PASSWORD; printf \"%s  /run/meri/rds-ca.pem\\n\" \"$MERI_D2_RDS_CA_SHA256\" | sha256sum -c - >/dev/null; exec node -e \"$MERI_A_READ_JS\""],
  "environment":[{"name":"MERI_A_READ_SQL","value":"<A-FAILED-ATTEMPT-READONLY.sql without comment lines>"},
                 {"name":"MERI_A_READ_JS","value":"<A-FAILED-ATTEMPT-READ-RUNNER.cjs without comment lines>"}]}]}
```

The overrides file is generated from the `.sql` and `.cjs` files: comment lines are dropped (`-- @login` markers kept),
whitespace is collapsed, and the result is checked against the 8,192-byte limit. Regenerate it after editing either file.
The command was dry-run locally with a stubbed `pg` client, which exercised:
- the three login sections (12, 3 and 3 statements) and variable substitution;
- read-only connection options;
- recovery from a failed statement;
- output shortening.

It has not been run against the real database.

### 4.3 What each answer decides

Q-numbers refer to the `.sql` file.

| Read | Decides |
| --- | --- |
| Q1 `runs.projection.state` and binding | Whether the run is terminal or still non-terminal. Gives its exact attemptId, workerId and writerFence: the fencing generation any reconciliation must use |
| Q2 run events (ordered by `sequence`) | **The only durable ordered history in this schema.** Whether a started or assistant-output event exists, so whether any output reached durable state |
| Q3 `native_allocations` (all rows of the conversation) | Current allocation and `launchBinding.state`. `RETIRED` with `physicalStopProven=true` closes the attempt. `UNKNOWN` or `ADMITTED` leaves it unresolved; any such row makes the preparation journal refuse a new allocation (`NATIVE_PREPARATION_CONVERSATION_BUSY`), i.e. the next chat in this conversation. **Current state only**: the trigger (`0008`) enforces PREPARED→CLAIMED→STARTED/UNKNOWN but keeps no history, so a label alone does not date the launch |
| Q4 `native_executions.phase` / `native` | Whether the broker recorded the launch as `started` (with `native.taskId`), `unknown` or `retired` |
| Q5 task and model issuances | Whether a model grant was ISSUED (provider reach possible) or only CLAIMED |
| Q6 binding, SDK mirror, controls, checkpoints | Whether any SDK transcript was mirrored (entries and bytes), and whether a stop control or checkpoint was recorded |
| Q7 budget `runs` / `grants` | The model-budget fence and attempt, and whether the grant is ACTIVE or REVOKED |
| Q8 tenant reservation | Whether the hold is HELD (it occupies a concurrency slot), RELEASED (cost unresolved), SETTLED or NOT_DISPATCHED |
| Q9 `meri_product_budget.requests` | **The provider-reach decider.** No row means no proxy-recorded dispatch. `UNKNOWN` means a held, unresolved request; leave it unresolved. `SETTLED` / `NO_DISPATCH` give the actual cost |
| Q10 Temporal visibility row | Workflow close status, close time and history length |

Rules:
- No row mutation, reset, reservation release or replay.
- CLAIMED, UNKNOWN or STARTED labels without ordered events do not prove that a process existed or that nothing was spent (plan
  §4, §9).
- If Q3 shows a non-retired allocation, use a new conversation for the next acceptance attempt. Do not clear the row.

## 5. Ownership, rollback and authority

### 5.1 Ownership

- **AWS and shipping: the Claude orchestrator session** (Neo's direction, about 04:00Z on 10-20). This supersedes the dot handoff
  recorded in PR #121 comments 6274410983 (10-19 18:33Z) and 6282402238 (10-20 03:07Z). dot is not involved.
- **Private render inputs** (PKI, Core identity, DB logins) live outside Git on the operator host, neomart. Any re-render uses them
  there.
- **Package sessions:** source work on separate branches; no AWS mutations.
  - Package B owns `pinned-native-transport.mjs` and `runner-runtime-diagnostics.mjs` on
    `fable/pinned-transport-failure-codes-20261020`.
  - Package C owns the startup budget on `fable/adj-c-startup-budget-20261020`.

### 5.2 Rollback target

- **There is no known-good chat baseline.** No revision has ever completed a live chat.
- **Every predecessor revision is INACTIVE.** Revisions 34/33/33/32/32/19 (D, image `ea0e9ad4` → `5b395d4c`) were deregistered by
  `jump-cli` at 01:15–01:35Z. Revisions 33/32/32/31/31/18 (C, `9bff84ba`, untagged in ECR; a16cc40d per the 10-19 record) were
  deregistered at 22:11–22:32Z on 10-19.
- **All three images are still in ECR:** `f5a7abc9`, `ea0e9ad4`, `9bff84ba`.
- **Rendered material pins exact task-definition ARNs** (`render-material.mjs`: `issuerRolePin` and `pairPin` use
  `s.taskDefinitions[role]`). Re-registering any predecessor therefore produces new revision numbers. That requires a fresh
  private re-render on the operator host, then upload, then the MODEL → ISSUER → APP sequence.
- **Rollback is not an `UpdateService` to an old revision.** It is a forward deployment of an older image. The secret labels
  `FIRST_CHAT_20261019C` and `FIRST_CHAT_20261019D` exist, but their bytes pin the deregistered ARNs.
- **Safest operational state** [I]: the current release E with no chat traffic. It is healthy (1/1 everywhere), and leaving it in
  place costs only idle services.

### 5.3 Spend and authority (as recorded only)

- Total approved ceiling **$621**: Neo's +$5 at 10-19 23:48:50Z raised it from $616 (release AUTHORIZATION.md). PR #121 comment
  6274867081 records the overall cap as $610 after the 18:56Z +$5; the $610 → $616 step is not in the comments read [U].
- Under the latest allocation, both permitted jobs are used (image `04e83f76`, measurement `aaab4ac1`, both SUCCEEDED).
- Ceilings are allocations, not billing. Remaining dollars are [U].
- The packet states: "A fresh model chat is not authorized" by that allocation, and "No new live-chat authorization is inferred."
- The E chat at 01:38Z happened under an authority this session has not seen recorded [U]. No old allowance carries over to new
  experiments (plan §4).

## 6. Hand-offs

- **Package C.** §2.3 (8 s router vs 23 s client); §3.2 (26 s readback gap, then a 12 s dense burst ending at the failure;
  13.08 s and 10.38 s max target responses); and the 12-minute post-failure wait until lease expiry. That wait is the plan's
  "short failure became many minutes" case.
- **Package B.** Nothing in the deployed configuration changes its scope. A repaired code on the next attempt separates the
  readings in §3.3.
- **Orchestrator (AWS operator).**
  - Run the §4 read packet.
  - Consider enabling access logs on `meri-preview-control-private` (both readings in §3.3 need per-request attribution).
  - Note that rollback needs a private re-render.
  - If Q3 shows a non-retired allocation, run the next acceptance attempt in a new conversation.
- **Package F.** The frontend's stale runtime labels; and the INACTIVE-predecessor plus ARN-pinned material property, which makes
  rollback a full forward deployment.
