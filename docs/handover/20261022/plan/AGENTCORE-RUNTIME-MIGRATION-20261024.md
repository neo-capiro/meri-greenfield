# Approved AgentCore Runtime migration and completion plan

Neo approved the migration on 24 October 2026 and instructed root to finish autonomously, run bounded work in parallel, update all active plans and leave no dead code. This replaces the per-run Fargate and custom warm-pool implementation requirements. It does not reduce Item 0, A2, M2, MP or any accepted product scope. Read [standing requirements](../STANDING-REQUIREMENTS.md) first.

## Approved architecture

```text
browser -> control: authenticated conversation/run ownership, events and outcomes
              -> AgentCore Runtime V1: isolated conversation session
                   -> actual Claude Agent SDK full harness -> Bedrock
                   -> existing tool gateway -> Core canonical permissions/data
              -> existing durable SDK SessionStore and artifact owners
              -> Temporal for required durable runs, schedules and background work
```

- Use standard **AgentCore Runtime V1**, ARM64, hosting the actual pinned Claude Agent SDK. No managed Harness replacement, V2 snapshots, home-built pool, second model loop or automatic adoption of AgentCore Memory/Gateway/Identity services. Existing SDK/CLI upgrades remain separately qualified.
- Bind each isolated session immutably to the current tenant, actor, conversation and approved General/client scope. Reuse it for serialized turns in that conversation; never share a mutable workspace across conversations or tenants. Idle stop and maximum lifetime use the platform's standard lifecycle settings, selected from measured behavior and cost. Stopped compute is restored from durable state; it is not the durable conversation record.
- Core remains the canonical membership/client/wall authority. Check current access at turn admission and actual data/tool/artifact access; revoke or refuse previously loaded context when its scope is no longer permitted. A session identifier or old successful admission is not authorization. Do not duplicate Core policy inside the model harness.
- Preserve the native SDK SessionStore, exact opaque transcripts/substreams, resume/fork, artifact/workspace persistence, all memory/data capabilities, the 14 skills, subagents and full Claude Code preset/tools. Retain Bash/browser/file and Python/JS document generation with their actual isolation and native gates. Runtime isolation does not prove retention, artifact restoration or product permissions.
- Preserve distinct idempotent run/outcome/event/usage records and uncertainty fences. SDK Task tools are not durable product schedules. Temporal remains for required durable runs, consent-bound routines, schedules and background work; remove obsolete foreground task-allocation machinery only after its retained behavior has a tested owner. No blanket deletion of durable outcomes.
- Public contracts remain owned by `packages/contracts`; A/root coordinate the minimal control/frontend proposal before changing the wire. Do not invent a parallel session DTO, grant service, persistence ledger or compatibility framework.

## Bounded implementation order and owners

1. **Source, in parallel with one writer per boundary.** Root owns control/contracts and infrastructure allocations; R owns SDK runtime adaptation and its dependency/security repair; A owns the allocated UI/control compatibility; D owns active docs and independent reviews of other authors. Root may refine allocations before edits. Inspect existing callers and freeze the public compatibility decision. Reuse existing persistence and Core clients. Each patch supplies focused positives/denials and its exact deletion inventory.
2. **Independent integrated qualification.** Bind the clean source/tree, ARM image, platform V1 configuration and private release inputs. Run affected contract/distribution/infra/types, real native SDK/artifact/import tests and actual nonowner PostgreSQL checks. Test first/second/third turn, exact transcript/substream/artifact restore after idle/stop/crash, fork, concurrent submission, duplicate/unknown acknowledgment, access loss and usage once. Preserve the existing retention gap as open until its canonical schema/role/owner is repaired and qualified.
3. **Staged preview cutover, then retirement.** Root owns current AWS readbacks, deployment lock, reviewed runtime/network/IAM/control configuration and rollback. Qualify the actual standard Runtime service, streaming, Stop and cleanup, then root opens Meri and executes T3–T6/H1/H2 and real scoped data/feature acceptance. Keep the last accepted Fargate release only as a bounded cutover rollback, not a permanent dual-host product. After replacement acceptance, remove the obsolete live resources and remaining source/configuration callers; verify their absence and close the rollback window explicitly.

No command is invented here for an unimplemented AgentCore release owner. Read its final checked-in contract after implementation; do not reuse the old Fargate ship packet by relabeling it AgentCore.

## Current completion matrix (baseline 0425d9af; update with evidence)

| Work | State at this plan revision | Required closure |
|---|---|---|
| AgentCore Runtime V1 target and autonomous implementation | **Approved; implementation/cutover not present in baseline** | Reviewed integrated source, actual platform/image gates and deployed acceptance |
| Native Claude SDK/direct Bedrock/full harness | **Implemented in Fargate baseline; not AgentCore-qualified** | Same real SDK, tools, skills, subagents, artifact functionality and constraints on V1 |
| Native continuation repair `0425d9af` | **Independently reviewed; native-only PG passed; not claimed shipped** | Actual image/security gates and live second/third-turn context; no legacy checkpoint dependency |
| Retention inventory/schema/role closure | **Unresolved** | Canonical owner, migrations/grants and actual-role retention/purge/restore evidence; native continuation's passing fixture does not cover it |
| Tool gateway, all typed read families and Core permission parity | **Required; completion not established** | Every retained positive/negative/paging case, real General/client answers, revocation and all memory/data access |
| Temporal durability and standard authentication | **Required; replacement/cleanup not complete** | Existing durable runs, schedules, consent, cancellation and outcomes preserved; remove issuer only after standard auth passes |
| A2, M2, MP, full frontend and remaining features | **All retained; partial source/review evidence is not full completion** | Each closeout ticket and accepted feature matrix passes at its integrated deployment; General scope, client writes and provider alternatives are not dropped |
| All memory classes, 14 skills, artifacts, browser/Bash and original read families | **All retained; some acceptance unresolved** | Feature-specific permissions, durability, native output quality and live behavior; no reduced tool profile used to manufacture a pass |
| Old hosting/authority/model services and configuration | **Deletion required; absence not yet proved** | Source/import/config/test inventory and post-cutover live absence, with retained history clearly labeled |
| Latency, cost, reliability and user experience | **Measured old startup roughly 44 seconds; new service unmeasured** | Measure cold first turn, warm follow-up and idle restore separately, p50/p95, Core/AWS/DB work and billed usage; no vendor latency promise presented as Meri evidence |

The native-only PostgreSQL receipt is `work/wave2-current/d-native-continuation/pg-native-only/20261024T030859Z-native-only-0425-961796`: eight total Node tests, source unchanged and cleanup verified by root. It covers the canonical subset, not a new full 44-entry ledger or retention qualification. Scrubbed independent source review is under `work/wave2-current/a-review-native-continuation/`. These local evidence paths are pointers, not shipped artifacts.

## Deletion inventory (required, not a claim of deletion)

| Replaced responsibility | Locate and remove with its replacement | Retained behavior/owner |
|---|---|---|
| Fresh ECS runner allocation for every turn and warm-pool plan S3 | RunTask/DescribeTasks readiness loops, task-router/bootstrap carriers, per-task grants/pins, runner task family, PassRole/RunTask permissions, obsolete SG/ALB rules, flags, alarms and shipping steps | AgentCore session invocation/lifecycle; control's current ownership, admission, Stop and idempotent outcome |
| Model owner/proxy and spend reservation machinery | Remaining `apps/proxy`, gateway budget/model-proxy callers, model grants, PKI, services/secrets/flags and their tests/kit steps | SDK direct Bedrock with narrow runtime IAM, SDK limits and canonical once-only usage/cap accounting |
| Duplicate native-authority and custom checkpoint paths | Prepared/task authority chains, relays, measurement/config pins, legacy-only checkpoint/dormant-original code and active consumers | Core permission checks; native SessionStore lineage; truthful recovery and uncertain-effect handling |
| Custom Temporal credential issuer | Issuer source, token writer, service/role/secret/renderer/kit dependencies after standard authentication is qualified | Temporal durable execution and required consent/outcome records |
| Transitional release compatibility | Cutover-only fallback branches, old flags and scripts after replacement acceptance | Reviewed forward recovery and immutable historical receipts/migrations |

Before deletion, enumerate exact owned files, imports, commands, flags, resources and meaningful tests. Afterward search executable callers and active docs, explain test-count changes and verify no retained behavior lost its owner. Historical receipts and applied SQL are immutable; label historical references rather than pretending a literal search must erase history. No new drop migration is authorized by this documentation update.

## Acceptance and release limits

Acceptance includes fresh first turn, immediate follow-up, third turn, reload/reconnect without duplicate work, idle restore, deploy between turns, Stop during execution/deploy, unavailable Core, membership/client-wall revocation, same-label cross-tenant sessions, durable usage and uncertain external writes. Preserve the full closeout-plan feature/quality thresholds and actual customer-data privacy rules. Source tests, a platform-ready status and a successful first chat are separate evidence tiers.

Retain the one persistent preview clone, snapshot before forward migration, unchanged applied hashes and live ALB rules. All new images are ARM64 and need exact-digest scans with zero HIGH/CRITICAL findings; root records other finding decisions. No customer-linked identifiers, credentials or private source enter public evidence. Root owns qualification and cutover under the existing lock, and reports unresolved work honestly.
