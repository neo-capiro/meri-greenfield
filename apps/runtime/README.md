# Meri runtime

The current item 0 source path uses Claude Agent SDK 0.3.295 / Claude Code 2.1.295 with the full Claude Code preset, a short Meri append, native tools, installed skills and subagents. The isolated runner calls Bedrock directly with task IAM. The model is `us.anthropic.claude-sonnet-4-6` in `us-east-1`; application-owned settings bind native 5-minute prompt caching for both the main agent and subagents. Static cloud credentials, alternate provider endpoints and pricing/TTL environment overrides are refused or removed at the runner boundary.

This branch is an implementation draft. Source tests do not establish deployed preview acceptance. The governing sequence and remaining acceptance are in [item 0](../../docs/handover/20261022/phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md).

| Role | Command | Responsibility |
| --- | --- | --- |
| Control | `node apps/runtime/cli.mjs control --config /run/meri/control.json` | Existing conversation/service/store owners, Temporal client, authenticated public routes and current private tool/run routes |
| Temporal worker | `node apps/runtime/cli.mjs temporal-worker --config /run/meri/worker.json` | Durable workflow execution; launch an isolated runner, read canonical run status, stop on completion/cancellation/expiry |
| Conversation runner | `node apps/runtime/cli.mjs conversation-runner --config /run/meri/task.json` | One SDK query in a private workspace with exact run binding; Bedrock through task IAM, Capiro tools through control |

The runner never receives a Core service secret, database connection or Temporal service credential. The existing task identity and lower Core tenant/member/client/wall checks remain until the tool-gateway replacement and its negative tests land in steps 3-4. They are temporary dependencies, not a new model-authorization layer. Model proxy, model grant issuance, the custom SDK child launcher, descriptor measurement and the execution broker are removed.

## First-turn execution and accounting

Control retains canonical conversation, run and preparation/qualification identity through the conversation store and its native execution owner. Native SDK init registers its actual session ID through the existing session owner. No proxy launch proof or new registration token is involved. Temporal uses only `execution/kickoff`, `execution/kickoff/status` and `execution/kickoff/stop`; status reads the persisted run. A missing or mismatched binding, fence, lifetime or receipt refuses. Every activity exit after dispatch invokes the original stop with its own bounded cleanup lifetime; an unknown cleanup never becomes a successful activity result.

The SDK owns the model loop, retries, streaming, context management and per-run `maxTurns` / `maxBudgetUsd`. The canonical tenant settings owner supplies the existing defaults of 20 turns and $2, plus an explicit tenant monthly cap. Missing/malformed caps refuse new admission. Migration `0021_sdk_run_usage.sql` preserves legacy monthly caps exactly and adds typed policy columns to the existing settings row; settings revision/CAS/audit remain the sole configuration owner. No model reservation or settlement ledger is composed.

One bounded terminal `runner/record-usage` call records native cumulative model usage and a content-free native hook tool batch on the existing run row. Exact replay is idempotent. Resume/fork accounting subtracts only the exact parent baseline with the same verified model/cache/rate basis. Missing, reset or incompatible usage is unavailable, never zero. Owned regional-price accounting and the SDK estimate remain distinct. Accounting uncertainty does not fail an already completed answer. No raw tool arguments, results or thinking enter this batch.

## Existing boundaries and remaining work

Configuration uses a closed versioned JSON shape and explicit `isolated-preview` profile. `sourceEnabled` is an explicit boolean. HTTPS is required except explicitly configured synthetic loopback fixtures. Secret files must be absolute, regular, non-symlink files owned by the running UID with no group/other permissions. The control database connection requires `sslmode=verify-full`. Startup never applies migrations. Health readiness reports dependency readiness, not release acceptance.

Public conversation submit/history/events/control and action/document/settings routes continue through their existing owners. Private run operations use closed envelopes and the exact canonical run binding. Source families still enforce current Core authority and typed result boundaries. Public web search must remain available through the existing provider: native WebSearch is unavailable on Bedrock, while WebFetch was observed in the bounded SDK spike.

Steps 3-4 replace remaining custom tool admission, credential relay and per-operation wrappers only after proving the lower Core checks. Step 5 must persist native SDK session and native task-list files, implement resume/fork/steer/pause/stop and simplify retained content/stream batching. The existing custom checkpoint storage/restore owners remain only as explicit step 5 dependencies; deleting their old child-process wrapper does not qualify continuity or waive persistence. Temporal credential-owner removal follows its own step. All retained image, sandbox, source-data and preview behavior gates still apply.

## Historical Stop receipts

Authenticated historical `execution/kickoff/stop` uses immutable allocation and
issuance custody without preparing an original, opening model material, issuing
grants, allocating, restoring or invoking the model. Existing original expiry
takes precedence; a dynamic first attempt without an original retains its
immutable initial-admission expiry. For a **later** allocation durably
`FORECLOSED` before any original existed, the existing `expiresAtMs` receipt field
instead reports the persisted terminal UIEvent's `createdAt` as an **event-time
cutoff** at which that allocation ceased being usable. It is not database commit
time, a newly minted timestamp or permission to execute.

The reader verifies the exact pinned event ID and whole-event hash, full binding,
scope and failed/cancelled state through the existing paged store reader within
the same bounded Stop operation. Missing or mismatched custody stays unknown;
repeated reads preserve the same cutoff and cannot reclaim the allocation.
Broader command/environment profiles and legacy rows without sufficient historical
custody remain fail-closed. This source behavior does not qualify physical task
absence, grant revocation, PostgreSQL durability or a deployed release.

## Dependencies, build and evidence

Own lockfile pins `@hono/node-server` 2.1.5, pg 8.23.1 and Temporal 1.24.0 (MIT). Claude SDK remains the existing 0.3.295/CLI 2.1.295 owner; TypeScript is 5.9.3. No root/shared lock changed. The Node server adapter deliberately sets `overrideGlobalObjects: false` and materializes a native Fetch Request because canonical owners validate native brands. Upstream references: [Node adapter](https://github.com/honojs/node-server), [Temporal workers](https://docs.temporal.io/develop/typescript/workers), [pg pool](https://node-postgres.com/apis/pool).

Build from repository root using `docker build --platform linux/arm64 -f apps/runtime/Dockerfile .`. Both base images are pinned ARM64 manifests; the builder verifies Node 24.22.1. ENTRYPOINT is the actual CLI, USER is UID/GID 1000, and role/config are explicit container arguments. Mount only each role's secret files and writable task workspace; apply read-only root/network/sandbox controls in the separately reviewed deployment. `.dockerignore` excludes host dependencies, secrets, private fixture artifacts and evidence while retaining source schemas, locks and original skill assets. A build is not browser/isolation qualification.

Run `npm ci --prefix apps/runtime --ignore-scripts --no-audit --no-fund`, then `npm test --prefix apps/runtime` and `npm run typecheck --prefix apps/runtime`. Existing application package dependencies must also be installed from their locks. Tests exercise real HTTP listeners, canonical service/SDK composition and upstream workflow bundling. The dedicated PG16 fixtures use disposable socket-only databases and real migrations, transaction contention, session registration and run accounting; Core responses, model responses and cloud resources remain synthetic. Source manifests, original failure logs and resource cleanup accompany qualification. Provider, Temporal-server and deployed preview acceptance are separate gates.
