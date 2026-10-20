# Run the SDK and the Claude CLI together in the isolated runner

Date: 20 October 2026 UTC. Status: **proposed** (Meri adjustment plan Revision 2, work package E, with the
recovery inventory from §9). This is design only: no source, configuration, infrastructure or deployment
changes. AGENTS.md requires the owner's approval before the deployment architecture changes, so nothing here is
implemented until Neo accepts it. Implementation waits for the first-chat gate (plan §7, package D), with one
exception in §6.4.

Author: Fable lane `adj-e-architecture`, an independent architecture and review owner. Source: deployed commit
`2b4421f612f9fbb728d6da52927aac228d712d40`. Live AWS reads were read-only on 2026-10-20 between 03:13 and 03:35 UTC
(ECS task definitions, IAM role policies, EC2 security groups). No secret values were read.

Evidence tags used throughout:

- **[V]** read in code or in the live readback.
- **[D]** official SDK documentation or the installed SDK declarations.
- **[I]** inference.
- **[E]** an estimate derived from code paths, not a measurement.

## 1. Decision summary

1. **Replace the network-forwarded SDK stdio path with a local spawn inside the runner task.** The SDK parent
   already runs in the per-conversation runner task. Under the proposal it spawns the Claude CLI on the same host,
   through the existing one-use launcher, instead of sending every stdin and stdout chunk out through the private
   ALB and control's task router and back into the same Node process.
2. **Control keeps the durable launch authority.** It still owns prepare, the one-use launch claim, started,
   stop, fencing, budgets and receipts, as explicit run commands. Only the byte path moves.
3. **No services are merged now.** The privilege matrix (§5) supports keeping issuer, owner, proxy, worker and
   control separate. The worker is the one service that could be folded into control without adding privilege.
   That stays deferred while control is limited to a single replica.
4. **Recovery reuses the existing checkpoint, fencing, request-identity, allocation-journal and accounting
   owners.** §7 lists the gaps that the code demonstrates. None of them blocks a no-tool first chat.
5. **The migration is reversible, then permanent.** A temporary switch keeps the old transport available. After
   acceptance the old transport, its tests and its configuration are deleted (§6.3). The local owner becomes the
   single execution owner.

## 2. Current runtime: responsibility and privilege map

### 2.1 Services

| Service (live revision) | Responsibility and owned state | IAM task role (live) | Material and keys (from source) | Network (live security groups) | Replicas |
| --- | --- | --- | --- | --- | --- |
| **control** (control:35) | Public conversation API on :8080. Private :8082 serves the task router, runner poststart, and the worker's native calls. Owns conversation, run and lifecycle records, allocation and launch journals, issuance of task capabilities and model grants, runner start and stop, and the runner CA. Process-local state: login sessions, poststart challenge nonces, material files under `/tmp/meri-material` [V] | `MeriPreview-control-task`. `ecs:RunTask` on `runner:*` with a tag-key condition. `ecs:TagResource` on create. **`ecs:DescribeTasks`/`StopTask` on `task/capiro-dev/*` with no condition.** `ListTasks`, `DescribeTaskDefinition`, `ec2:DescribeNetworkInterfaces`, `iam:PassRole` for runner-execution, S3 get/put on the checkpoint prefix, KMS via S3 [V] | Runner CA private key, Temporal client certificate and key, DB login `meri_control_runtime`, static Core identity bearer, task/control/proxy capabilities (`render-material.mjs:647-659`) [V] | IN: 8080 from the public ALB; 8082 from the runner and the private ALB. OUT: **8080 to the runner**, 7233 within the VPC, 443 [V] | Exactly 1, because nonces and sessions are process-local [V] |
| **temporal-worker** (worker:34) | Temporal poller. Its activities call control's native API (kickoff, status, poll, stop). No DB [V] | **None** [V] | The same control capability as control; a Temporal client certificate [V] | No inbound. OUT: 7233, 443 [V] | 1 |
| **temporal-issuer** (issuer:34) | Issues per-task Temporal client certificates (CSR challenge, bound to the live ECS/ENI identity) and RS256 Temporal JWTs valid for at most 60 s with `meri:write`, signed through KMS. Publishes the JWKS. DB: `service_task_registrations` [V] | `MeriPreview-issuer-task`, observer only (ECS/ENI describes). The KMS key policy grants this role `kms:Sign`, and also grants the account root `kms:*` [V] | Issuer-client CA private key, issuer server key, DB login [V] | IN: 8445 from the issuer-client marker only. OUT: 443 [V] | 1 |
| **owner** (owner:33, :8444) | Product **model-budget owner** for the proxy: bearer-to-grant lookup, admission, reserve and settle, a currentness check with Core. **Issues no credentials** (`owner-native-currentness.mjs:1-2`). DB `meri_model_budget_owner` is the only writer of `budget.consumed_micro_usd` [V] | `MeriPreview-owner-task`, observer only [V] | Own DB login, the shared static Core bearer, owner server certificate and key, `control.json` configuration [V] | IN: 8444 from the proxy only. OUT: 443 [V] | 1, paired with the proxy |
| **proxy** (proxy:33, :8443, LiteLLM 1.104.2) | Trusted model gateway. Authorises a request by bearer hash and by checking that the socket peer is the run's ENI, through the owner. Reserves before send and allows a single send to Bedrock [V] | `MeriPreview-proxy-task`. **The only Bedrock principal:** `InvokeModel*` on profile `us.anthropic.claude-sonnet-4-6` and its three regional models, plus `CountTokens` [V] | Proxy server certificate and key; proxy-to-owner client certificate and key [V] | IN: 8443 **from the runner only**. OUT: 8444 to the owner, 443 [V] | 1 |
| **runner** (runner:20) | One ECS task per run. A **single container, uid 1000, all capabilities dropped, read-only root filesystem** [V]. Holds three processes: **P1** = the SDK `query()` parent **and** the HTTPS :8080 receiver; **P2** = the supervisor, forked by P1 with `env:{}`, IPC only, no network code; **P3** = the Claude CLI, spawned by P2 with no uid change (`session-launcher.mjs:32`) [V] | **None.** Execution role: ECR pull and logs only [V] | Its own TLS key and leaf, task capability, per-run proxy credential, config, CA certificates. All arrive through poststart into owner-only files, and all are owned by uid 1000 [V] | IN: 8080 from control only. OUT: 8082 to control, 8443 to the proxy, 443 to endpoints, the private ALB and S3. **No internet egress** [V] | Per run, at most 2 at once |
| **Temporal** (five roles) | Durable orchestration. mTLS plus the default token authorizer, with the JWKS served by the issuer [V] | None [V] | Per-role DB and internode material; one internode leaf shared by all five roles [V] | Frontend 7233 open only to control and worker [V] | 1 each |
| **Aurora** | Per-service roles with no superuser and no bypass-RLS. Core's `capiro_app` executes the SECURITY DEFINER `meri_core_authority.current_admission_v1` [V] | n/a | n/a | 5432 from the db-client marker | shared |
| **Core** (capiro-backend) | Canonical identity, membership and client authority, reached at `/api/clio/application-authority/{identity,context}`. Calls Clerk on each request [V comment `render-material.mjs:586-590`] | external | — | public ALB | external |
| **Frontend proxy** | Browser to control:8080 via the public ALB host rule [V] | external | — | — | external |

Every service's distinctive privilege is its own `meri/preview/<service>/material` secret, and the execution role
injects it into `material-init` [V]. Two services merged into one process would therefore hold the union of both
secrets.

### 2.2 Trust boundaries and attacker model

The repository has no formal attacker model. This ADR assumes three attackers, and §5 and §6 are evaluated against
them:

- **A1, prompt injection or model error inside the agent.** It controls what the model and CLI do. Today it has no
  tools and no Bash. Later it gets in-process MCP read and intent tools and, possibly, a sandboxed Bash.
- **A2, a compromised runner task.** Any process in the runner container, for example through a CLI or library
  bug.
- **A3, a compromised shared service** (control, worker, owner or proxy), including a confused-deputy request to it.

Boundaries that actually hold today [V]:

- **Provider credential.** Only the proxy role can call Bedrock. The runner has no task role and no secret, and has
  no internet egress.
- **Spend.** The proxy reserves before send. The owner is the only writer of the spend counter, and control is
  explicitly denied that write (`first-chat-database.sql:274`).
- **Durable authority.** Control's journals require full RunBinding/writer-fence equality and record lost
  acknowledgements as UNKNOWN.
- **Temporal identity.** The issuer, which holds the CA and the KMS signing permission, authenticates control and
  the worker. Neither holds a signing key.

A boundary the code assumes but that **does not hold** [V+I]:

- The native-authority docs treat P2 (the supervisor) as an *independent trusted observer*. Examples: "No
  worker-supplied child, stdout, observation or renewal is accepted" (`SESSION-LAUNCHER.md`), and the registration
  witness taken from P3's stdout.
- In reality P2 is forked by P1, runs as the same uid in the same container, and reaches control **only through
  P1's own :8080 receiver** (control → router → P1 → IPC → P2).
- P3 is also uid 1000. It can read the owner-only poststart files (task capability, proxy credential, TLS key) and
  `/proc/<P1>/environ` [I: standard Linux permissions; not tested on Fargate].
- So against A1-with-code-execution or against A2, the runner task is **one trust domain**. Today's network
  hairpin re-authorizes every byte at control, but it does not separate P1, P2 and P3 from each other.

### 2.3 First-chat startup path: round trips and dependencies

These counts come from a code trace at `2b4421f6`. They are **[E] lower bounds**: one DB round trip is counted per
store call, and nothing here was measured.

Unit costs used in the table:

- **H** = one P1 → private ALB → control hop: a new TCP and TLS 1.3 connection, with no pooling
  (`pinned-native-transport.mjs:42-43`).
- **R** = one task-router forward: 3 authority checks (about 9 DB reads), 3 ECS/ENI observations (6 AWS calls), and a
  new TLS connection to the runner on :8080 (`task-router.mjs:33-55`).
- **F** = the receiver's `fresh()` check (H plus a control `current()`, which needs 4 DB reads, 2 Core calls, 1
  allocation read and 3 ECS calls).

| Segment | HTTP exchanges | New TLS handshakes | Postgres | AWS API | Core (+Clerk) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Submit → Temporal → kickoff → RunTask → poststart → bootstrap → release → load/runtime | ≥15 | ≥15 | ≥100 | RunTask + 1 s DescribeTasks polling during cold start, plus about 10 more | ≥100 | Fargate pull and cold start dominate. Live attempt `283f12c5`: created 01:39:17.2, image pull 29.4 s, started 01:40:01.9 [V logs] |
| `query()` → CLI first model request (prepare, start, first two stdin writes) | ≈20 | ≈18-20 | ≈138 | ≈69 | ≈32 | `start` alone is ≈10 exchanges: runner → router → runner → control → (ALB) → control router → runner launch → fork P2 → spawn P3 → control `started` → router → runner `inspect` |
| **Each stdin chunk or stdout poll while the run is live** | 3 | 3 | ≈14 | ≈9 | ≈2 | Stdout is long-polled continuously (100 ms server wait), so AWS describe calls grow with run time, with ECS/EC2 throttling risk [I] |

Services that must be healthy on the per-chunk path today: the private ALB, control (single replica), the task
router, Postgres, the ECS API, the EC2 API, and Core plus Clerk [V].

The 8 s router cap (`control.mjs:180`) encloses the **whole** nested `start`, including inner calls with
23-25 s allowances, a fork, and a SHA-256 of the 256 MB CLI binary (`session-launcher.mjs:28-32`) [V path; I net
effect]. These timing facts belong to package C, the startup owner, and §8 hands them over.

Two credential exposures sit on this path [V]:

- The per-run proxy credential travels P1 → ALB → control → P1 inside the descriptor.
- The ALB → control:8082 hop is **plain HTTP** (`first-chat-private-edge.mjs:42`), so task capabilities and the
  proxy credential cross it in clear inside the VPC. Security groups restrict that hop.

## 3. SDK facts that the design relies on

Each fact below was checked against the installed pinned package `@anthropic-ai/claude-agent-sdk@0.3.295`
(`sdk.d.ts`, `manifest.json` CLI 2.1.295) and against the official documentation [D].

- **Spawn hook.** `Options.spawnClaudeCodeProcess(SpawnOptions) → SpawnedProcess` (d.ts:2445, 9518-9604) is the
  supported way to run the CLI "in VMs, containers, or remote environments".
  - `SpawnOptions.signal` aborts only after stdin EOF plus a grace period of about 2 s.
  - With a custom spawner the SDK sees plain process exit, without waiting for stderr to close.
  - Meri already injects this hook (`sdk-query-preparation.mjs:41`). The local design keeps using it, now
    returning a real local `ChildProcess`, which `SESSION-LAUNCHER.md` already describes.
- **SessionStore** (d.ts:1830, 6596-6670; session-storage docs) mirrors **transcripts only**, best effort.
  - `append` runs after the local write. A failed batch is retried 3 times, then dropped with `mirror_error`.
    Timeouts are not retried.
  - `load` runs **in the SDK parent before spawn**, and the transcript is materialized into a temporary
    `CLAUDE_CONFIG_DIR` on the parent's host.
  - `projectKey` encodes the working directory.
  - It cannot be combined with `persistSession:false` or `enableFileCheckpointing`.
  - It provides **no workspace snapshot**.
  - Meri sets `sessionStore` with `sessionStoreFlush:'eager'` (`options.mjs:62`) [V].
  - Consequence: SDK resume materialization assumes the parent and the CLI share a filesystem. A local spawn
    satisfies that natively. A truly remote spawn would have to recreate it.
- **Hosting and secure deployment.** "Claude Code (or your Agent SDK application) runs inside the isolation
  boundary". Provider credentials stay outside, behind a proxy reached via `ANTHROPIC_BASE_URL`. Permissions and
  command parsing are "a permission gate, not a sandbox". The subprocess "does not listen on the network" [D].
- **Pinned options already in use** (`options.mjs:62`) [V]: `query`, `settingSources:[]`,
  `settings.autoMemoryEnabled:false`, `canUseTool` (deny by default), `hooks`, in-process `mcpServers` (type
  `sdk`, which run in P1), `outputFormat`, `includePartialMessages`, `maxTurns`, `maxBudgetUsd`, `abortController`,
  `resume`/`forkSession`, and `env` with `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` (the per-run proxy grant)
  and `CLAUDE_CONFIG_DIR`.
- **Not used yet:** `startup()` (d.ts:9610, pre-warms the CLI) and `prewarm()` (d.ts:2826, alpha). They are
  optional later latency work and are **not** acceptance dependencies.
- **Binary pin.** The CLI checksum for linux-x64 in the SDK `manifest.json`
  (`4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`) equals
  `runtime-values.json:44 executableSha256` [V]. Only the win32 platform binary is installed on the review host,
  so the Linux binary was not executed in this review.

## 4. Network-forwarded stdio versus local spawn

Both columns assume the same inputs and constraints: the same runner image and task definition, the same control
journals, the same proxy, owner and budget, and the same SDK options.

| Concern | Today: forwarded stdio (`remote-task-client` → router → `remote-task-http` → `independent-task`/P2 → P3) | Proposed: local spawn (P1 → existing launcher → P3; control commands for prepare/claim/started/stop) |
| --- | --- | --- |
| Where the SDK parent and CLI run | Same container, same uid [V] | Same. No privilege change |
| Per-chunk path | ALB, control, router, Postgres, ECS/EC2, Core | Local pipes only |
| Startup round trips from `query()` to first stdin | ≈20 HTTP, ≈18-20 TLS [E] | Target ≤4 direct P1 → control commands (prepare, claim/start, started, plus a verify where required), **0** router forwards, **0** control → runner connections |
| One-use launch, durable PREPARED → CLAIMED → STARTED, execution-journal claim | Control, triggered through the router hairpin | Control, triggered by P1's direct command. Same journal, same refusals |
| Executable SHA, explicit env, process-group lifetime, init-frame registration | P2 (supervisor) and launcher | Same launcher and lifetime modules, used in-process or through local IPC |
| Revocation while running | Every byte re-verified at control. A stop fences the router | The proxy and owner deny model calls on a revoked grant per request [V]. Tool gateway and result publication are fenced [V]. Control stop revokes grants and runs ECS `StopTask` [V]. Plus a bounded runner lease check using the existing `runner/native/verify` route (target interval ≤5 s) |
| SessionStore resume materialization | Temporary config directory created in P1. The CLI runs on the same host only because the hairpin returns to the same task | Native SDK behaviour |
| Failure surface | 8 s router cap around a nested start; per-poll AWS describes; 3-hop TLS per chunk | Removed from the byte path. The start path keeps the durable checks |
| What is lost | Per-chunk re-verification. This protects nothing that the proxy, gateway, fence and StopTask do not already protect, because P1 could forge any byte it relays (§2.2) [I] | — |

The security boundary does not change, because P1, P2 and P3 already share a container and a uid. Hardening that
boundary is separate and independent of the transport. **Before any code-executing tool (Bash) is enabled**, one
of these must be qualified:

- (a) Run the CLI under a distinct uid with no read access to `/run/meri/**`. Fargate drops `CAP_SETUID`, so this
  means a second container in the same task, with the workspace on a shared volume and stdio over a task-local
  socket.
- (b) A measured Bash sandbox that denies `/run/meri/**`, `/proc/<P1>` and network access other than the proxy.

Neither is needed for the no-tool first chat. SDK hooks and `canUseTool` run in P1 and are policy, not the
security boundary [D].

## 5. Issuer and model-owner separation matrix

The matrix scores each service against the six plan §8 criteria.

| Candidate | (1) Responsibility and state owner | (2) IAM and secret access | (3) Trust boundary / attacker | (4) Scaling or fault containment | (5) Startup latency and failure contribution | (6) Replacement owner and negative tests | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **issuer → control** | Temporal identity for control and worker; registrations table | `kms:Sign`, issuer-client CA key | Issuer authenticates control, so merging makes control self-attesting. Under A3, control could mint `meri:write` for any task | Single instance. Its failure stops control and worker through auth health (`control.mjs:141,149`) | Not on the per-chat path: boot plus background token renewal | Keep: certificate for a stopped or foreign task refused; token after revocation honoured for ≤60 s only | **Keep separate** |
| **owner → control** | Spend counter writer; model admission and settlement | DB role with `consumed` UPDATE; Core bearer (control has one too) | Control is public-facing, can RunTask, and is denied spend writes by design. Merging lets an A3 control rewrite spend | Paired 1:1 with the proxy (`service-pair-discovery.mjs:50,53`) | First-token path only: 1 mTLS exchange per model request | Keep: owner unreachable from the runner security group (`stage3-deploy.mjs:85` probe); control cannot UPDATE consumed | **Keep separate** |
| **owner → proxy** | — | Would put Bedrock, the spend-ledger DB login and the Core bearer in one process | The proxy is the runner-facing ingress (A2 attack surface). The ledger DB writer must not be | — | Saves 1 intra-VPC mTLS hop per model request | — | **Keep separate** |
| **worker → control** | Temporal polling; broker kickoff and status | Worker has no task role. Its secrets (control capability, Temporal client certificate) are a subset of control's, so the union adds nothing [V] | No new privilege | Worker activity slots (10) and long broker polls would tie to control's **single-replica** constraint | Removes one ALB hop (kickoff, 3 s client cap) and the 1 s status poll | Same tests as control | **Eligible, deferred** until control is multi-replica (shared nonce and session owner) |
| **proxy and owner as the credential/egress gateway** | Already matches the plan's "credential/egress gateway" | — | — | — | — | — | **Retain as is** |

Result: **no consolidation now.** This is driven by the privilege and fault-containment facts, not by service
count.

## 6. Recommendation and migration

### 6.1 Target design (plan §8 table, mapped to existing owners)

| Plan component | Existing owner kept |
| --- | --- |
| Trusted Meri control | `control` (conversation, lifecycle, journals, issuance, allocation, approvals, budget reservation through the gateway, receipts) |
| Isolated execution worker | The runner task. P1 runs the SDK parent, the in-process MCP tools and the local launcher, and P3 is the CLI. Interface to control: run commands (bootstrap, load, runtime, prepare, claim, started, publish, session store, verify) and stop |
| Credential and egress gateway | `proxy` + `owner` |
| Durable orchestration and stores | Temporal plus the existing Postgres schemas and S3 checkpoint prefix |
| Identity and business authority | Core |

**Single permanent execution owner:** one new runner-side module, `native-authority/local-process-client.mjs`,
replaces `remote-task-client.mjs` behind the existing `processTransport` injection point
(`remote-conversation-runner.mjs` → `createWorker` → `worker.query`). It does three things:

- calls control's existing `runner/native/prepare`, `start` and `started` routes directly over P1's existing pinned
  native fetch;
- launches through the existing `independent-task.mjs`, `supervisor-process.mjs`, `session-launcher.mjs` and
  `process-lifetime.mjs`;
- returns the real local `ChildProcess` facade to the SDK spawn hook.

No new registry, transport framework or error vocabulary is introduced. Its error codes join the existing
allowlist in `runner-runtime-diagnostics.mjs`.

**Control-side change:** `execution-broker.start` stops calling `remote.launch` through the router. It consumes
the launch claim, records execution `launching`, and returns. `started` records STARTED after P1's report and a
fresh `current()` check.

The P3 init observation now comes from P1. That is the same trust domain as today (§2.2), so no guarantee is lost.
The ADR states this openly rather than calling it "independent".

### 6.2 Phases, each reversible

| Phase | Gate to start | Work | Rollback |
| --- | --- | --- | --- |
| 0. Baseline | Now | Use the existing stage markers (`markRunnerStage`, activity `diagnostic`) to emit per-stage durations. In the qualification owner's Linux real-transport harness, count HTTP, TLS, DB, AWS and Core calls for one start and one chunk on the current transport. This turns §2.3 [E] into measurements | None needed (diagnostic only) |
| 1. Local owner behind a switch | First chat (D) accepted on the current transport, **or** the §6.4 exception | Add `local-process-client.mjs` and the control broker/started change. Add `runner.executionTransport: 'remote' \| 'local'` to the existing validated runner configuration that control delivers through poststart, default `remote`. Add the runner lease check loop | Set the switch to `remote` (configuration re-render only; same image) |
| 2. Parity qualification | Phase 1 merged | Run the same inputs on both switch values: two-turn with SessionStore resume; stop before, during and after start and mid-stream; two concurrent conversations plus second-turn exclusion; lost start acknowledgement, crash after launch, restart retirement; revocation mid-turn; diagnostics codes. Rerun the I1-I10 suites in `adj-reports/adj-e-notes/REVIEW-CHECKLIST-B-C.md` on both | Switch stays available |
| 3. Default local | Phase 2 passes with measured criteria (§6.5) | Flip the default to `local` on preview; D3 authenticated acceptance repeated | Flip back |
| 4. Retire old transport | Phase 3 has held through the agreed observation window | Delete everything in §6.3 in one reviewed PR | Revert that PR. The image keeps the old code until then |

### 6.3 What gets deleted in phase 4, so no dead path survives

- **Runner modules:**
  - `native-authority/remote-task-client.mjs`;
  - in `remote-task-http.mjs`, the `prepare`, `start`, `stdin`, `stdout`, `launch` and `registration` handlers
    (and the whole file if `stop` moves to the control-side stop below);
  - the frame and stream limits in `remote-task-boundary.mjs`;
  - `deferred-process-transport.mjs` (the local hook returns a real process after prepare and claim complete);
  - the HTTPS :8080 listener and its TLS material path, if no route remains.
- **Control:**
  - the task-router operations prepare, start, stdin, stdout, launch and registration;
  - the stream byte budgets in `task-router.mjs`;
  - `runner-tls-client.mjs` and `task-router-network*.mjs`, if graceful stop is done with grant revocation plus ECS
    `StopTask` (decide on phase 2 stop-latency evidence). Otherwise only the `stop` operation survives.
- **Configuration:**
  - `executionTransport` (the switch itself);
  - `processOrigin`;
  - router stream sizing;
  - runner certificate issuance, the runner CA and the control → runner 8080 security-group pair, if the listener
    is gone.
- **Tests:** the stdin/stdout/launch cases in `remote-task.test.mjs`, `deferred-process-independent.test.mjs` and
  the stream cases in `task-router.test.mjs`. Their invariants (one-use launch, no retry, lost acknowledgement
  leads to UNKNOWN, stop proof) move to the local owner's tests **before** deletion.
- **Docs:** this ADR's "current" sections become historical. Update `native-authority/README.md`,
  `SESSION-LAUNCHER.md` and `task-route.md` to the one owner.

### 6.4 Exception: the transport turns out to be the first-chat blocker

If package B/C evidence (the repaired first-failure class on the next attempt) shows that the forwarded transport
itself prevents first chat, then the plan's "smallest replacement behind the existing execution interface" is
phase 1 alone:

- `local-process-client.mjs` plus the broker/started change, behind the switch;
- the first-chat profile only (no tools);
- phase 2's affected race and cleanup tests run now (plan §9 "immediate safeguards").

There is still no second permanent chat implementation: phases 2-4 complete or revert it.

### 6.5 Measured success criteria

Removing services is not a criterion.

1. **Startup.** Round trips from `query()` to first stdin written fall from the phase-0 baseline (≈20 HTTP / ≈18 TLS
   [E]) to ≤4 HTTP with 0 router forwards. Per-chunk network round trips fall from 3 to 0. Dependencies on the byte
   path fall from 7 (ALB, control, router, Postgres, ECS, EC2, Core) to 0.
2. **Latency.** Preview time from `query()` to first model request, and to first token, measured with both switch
   values over the same prompts. Local must not be slower.
3. **Guarantees preserved.** I1-I10 pass on both. No timeout is treated as zero spend. The stop proof is still
   required before ATTEMPT_LOST.
4. **Behaviour.** Two-turn, stop, concurrency and recovery tests pass (phase 2 list) on Linux with the real
   transport.
5. **Reversibility.** The switch round-trips on preview without an image change.

## 7. Recovery owners: existing guarantees and demonstrated gaps (plan §9)

Each row below is a canonical owner. Row 1 of the table is checkpoint, row 2 fencing, row 3 request identity,
row 4 the allocation journal, row 5 accounting.

| Mechanism | Canonical owner (code) | Implemented guarantee [V] | Main tests | Wired into the deployed path? |
| --- | --- | --- | --- | --- |
| Checkpoint | `task-checkpoint-source.mjs` → `checkpoint-capture/publication/readback.mjs`; `workspace-capture/restore.mjs`; `native-restorer.mjs`; `session-owner.mjs` (durable SessionStore); `continuation-*` | A checkpoint stops the original process (`physicalStopProven`) before capture. It binds RunBinding (attempt, worker, **writerFence**), sessionId, the opaque transcript set (main plus ≤255 subpaths), the workspace manifest and SHA, versions (image, sdk, cli, contracts, skills, format), `lastEventSequence`, scopes and the parent. Puts are read back. The restorer claims before writing and records RESTORED or UNKNOWN. SessionStore appends carry `appendId`, `expectedOffset` and `entriesSha256`, and a lost COMMIT becomes `SDK_SESSION_COMMIT_UNKNOWN` with no resend | checkpoint-capture (11), task-checkpoint-source (10), native-restorer (8), session-owner (10), continuation-runtime (10) | Yes (`remote-composition.mjs:41-50`, `prepared-candidate.mjs:95,172`). Next turn binds the completion checkpoint. Resume/fork admission requires `intents.enabled` (deployed value unknown) |
| Fencing | Run-row lock with full RunBinding equality → `STALE_WRITER` (`postgres-store.mjs:49`, journals); `withCurrentAllocation` (`admitted-run-owner.mjs:36-55`); `temporal-runtime-fence.mjs`; router stop fence; hold fence | Resume target gets fence+1. Initial run is CHECK-pinned to fence 1. Model reservation, tool budget and SDK append run inside the current-allocation lease | temporal-runtime-fence (13), stop-races (15), lifecycle (18), task-router (9) | Yes |
| Request identity | `requestId` replay (`postgres-store.mjs:37`); Temporal workflow ID REJECT_DUPLICATE; `eventId`; lifecycle `controlId`; issuance key and claim fence; model `requestId` + `one_unknown_per_grant`; tool delivery key | Exact replays return the original result; mismatches are refused | store (7), temporal-dispatch (7), product-model-budget (12) | Yes. Command and intent journals are integration-stage and **not applied** |
| Allocation journal | `native-preparation-journal.mjs` (`native_allocations`; launchBinding PREPARED → CLAIMED → STARTED/UNKNOWN; FORECLOSED); `initial-run-binding-journal.mjs` | CLAIMED is written before RunTask and replay rediscovers by `startedBy`. RETIRED requires `physicalStopProven`. Conversation exclusion. Reconciler writes ATTEMPT_LOST only after a proven retirement | allocation-exclusion-pg (5), ecs-task-owner (14), prepared-kickoff(-reconcile), recovery-workflow (5) | Yes |
| Accounting | `product-model-budget.mjs` (UNKNOWN row before send), `product-model-settlement.mjs` (200 + complete + EOF only), proxy `request_admission.py` / `response_settlement.py` (single send), tenant gate | **No timeout is treated as zero spend** on the product path. A lost provider response keeps the UNKNOWN hold and blocks the grant | product-model-budget (12), product-model-settlement (6), test_response_terminal_gate (5) | Admission and tenant gate yes. Live reservation traffic is unproven (no completed chat) |

Gaps the code demonstrates (not speculative). None blocks a no-tool first chat:

1. **G-R1.** `prepared-run-issuer.reconcile` has **no non-test caller** (grep). An issuance left CLAIMED after a
   crash stays UNKNOWN indefinitely. This matches RELEASE D12.
2. **G-R2.** **No product writer of `NO_DISPATCH` / `tenant.notDispatched`** (grep). A reservation whose
   acknowledgement was lost before send leaves a permanent hold that blocks the grant. The only zero-spend writer is
   evidence-gated qualification code.
3. **G-R3.** The SDK `projectKey` rule `replace(/[^a-zA-Z0-9]/gu,'-')` is **cloned in six native-authority modules**,
   contrary to `native-authority/README.md:15`. It is coupled to CLI-internal behaviour and must be requalified on
   any SDK/CLI bump. The SDK's `CLAUDE_CODE_PROJECT_DIR_NAME` (SDK ≥0.3.234 [D]) could make the key explicit; that
   is a later, separately reviewed change.
4. **G-R4.** The workflow reconcile budget is finite (85 s). Afterwards a run stays non-terminal until a later stop
   or the operator CLI. There is no automated UNKNOWN sweeper.
5. **G-R5.** ECS containment checks `STOPPED` with a single `DescribeTasks` immediately after `StopTask`. On Fargate
   the first stop probably reports `ALLOCATION_CLEANUP_UNKNOWN` [I].
6. **G-R6.** The worker's native client uses a 3 s default for kickoff, status, poll and stop, so the reconcile
   activity's 15 s timeout is ineffective per attempt.
7. **G-R7.** The checkpoint binds subagent and compaction state only as opaque transcript entries. There is no
   explicit dependency manifest. This matters only at the later replacement-worker gate.

Plan §9 says to extend existing owners only for demonstrated gaps. G-R1, G-R2 and G-R4 are candidates for the later
recovery gate. G-R5 and G-R6 overlap package C's startup and cleanup timers.

## 8. Observations handed to other packages

- **Package C (startup).**
  - The router's 8 s cap encloses the whole nested `start`.
  - The worker's kickoff has a 3 s cap while it synchronously builds issuance, and a rejected registry entry is
    cached (`prepared-run-registry.mjs:109`).
  - The remote process-group `shutdownMs` defaults to 1000 (`launch-configuration.mjs:11`).
  - The router's reserved stop slot is global, not per original (`task-router.mjs:28`).
  - A `runWindowMs` below about 535 s silently expires every stage.
- **Package F (shipping) and security.**
  - The live security groups contain the control → runner 8080 pair, but the repository's foundation and
    private-edge stacks do not (drift).
  - Control's `ecs:StopTask`/`DescribeTasks` covers **every task in the shared `capiro-dev` cluster**, including
    Core's.
  - The `ForAllValues` tag condition on RunTask is vacuous when no tags are sent.
  - The issuer KMS key policy grants the account root `kms:*`.
  - The ALB → control:8082 hop is plain HTTP carrying capabilities.
  - Temporal `meri:write` is namespace-wide and shared by control and worker.
  - One internode leaf is shared by all five Temporal roles.
  - These are findings for the owners to triage. This ADR changes none of them.

## 9. Consequences

- **Positive.** The fragile 7-dependency byte path is removed from every chunk. The startup start-path collapses
  from ≈10 nested exchanges to direct commands. SDK resume materialization works natively. One execution owner
  remains, with fewer modules.
- **Negative or risk.** Per-chunk control re-verification goes away. The replacement controls are proxy and owner
  per-request admission, tool-gateway and publication fencing, the runner lease check and `StopTask`. Stop latency
  must be measured in phase 2. The runner remains one trust domain until §4's uid or sandbox separation is qualified,
  which is required before Bash.
- **Not changed.** Temporal, the pinned SDK/CLI, Bedrock through the proxy, Fargate, Core authority, journals and
  budgets.
