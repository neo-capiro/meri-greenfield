## 1. Claude handles the harness

The quality bar is Claude's own. Answer quality comes from the whole harness, not only the model: its system prompt, built-in tools, subagents, skills, context management and compaction, and session handling.

- Run `@anthropic-ai/claude-agent-sdk` with its **full harness** and the Claude Code system-prompt preset, plus a short Capiro/Meri append. Don't replace the preset with our own prose.
- Do not rebuild what the SDK or AWS already does: model calls, retries, streaming, the tool loop, context management and compaction, session resume/fork, per-run turn and spend limits, AWS credentials.
- The real Claude SDK calls Bedrock directly using its narrowly scoped AgentCore runtime IAM role. Preserve the full preset, native tools, subagents and all 14 skills.
- Capiro data reaches Claude as **tools** (rule 4), not as a custom retrieval layer around the model.

Spec and plan: `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`. It is **Wave 2 item 0**, and it comes before every other item that touches the runner, the proxy or authority.

## 2. Simple, standard architecture

```text
browser -> control (current access, conversation/run ownership, durable events)
        -> AgentCore Runtime V1 (isolated conversation session; actual Claude SDK) -> Bedrock
                                      -> tool gateway -> Core
control -> existing durable SDK SessionStore and artifact owners
control -> Temporal for required durable runs, schedules and background work
```

- **Core is the gatekeeper for Capiro data.** Tenant, member, client and wall rules remain server-side in Core. Check current access at admission and actual tool/data/artifact access; revocation must also prevent use of previously loaded privileged context. Do not duplicate policy in the harness.
- Reuse one isolated environment only for the same immutable tenant/actor/conversation and approved General/client scope. Serialize turns; stop idle compute and restore exact SDK transcripts and artifacts from their durable owners. A Runtime session ID is not authorization or durable storage.
- Keep the SDK's per-run turn/spend limits and one canonical tenant cap/usage owner. Preserve required durable runs, schedules, consent, outcomes and uncertain-write fences; neither SDK Task tools nor a warm process replaces Temporal durability.
- **No custom warm pool, per-turn ECS task requirement, model proxy, duplicated per-hop authority, credential-minting service or spend-reservation ledger.** Use standard Runtime V1; no V2 snapshot machinery or second SDK implementation.
- Before adding a mechanism, identify the standard feature or existing owner it uses. Before deleting a wrapper, prove the retained lower-layer behavior with meaningful positive/negative tests. Do not remove canonical authorization, idempotency or durable outcomes as “extra security.”

## 3. Leave no dead code behind

A change is not done until what it replaced is gone.

1. **Delete in the same PR** everything the change makes unused: code, tests, fixtures, docs, config keys, env vars, feature flags, IAM statements, ALB rules, secrets, task definitions, CloudFormation resources, kit steps, alarms and metric filters. Applied database migrations are history: never edit them. Drop tables only through a separately reviewed forward migration after a snapshot; this hosting migration does not itself authorize schema/data removal.
2. **Temporary diagnostics come out before merge** of the fix they were added for. A log line stays only as named product telemetry that someone reads.
3. **No code behind a flag nothing turns on.** The "source-complete, activation-held" status is retired for code we don't intend to ship. Dark features need an owner and a date, or they are deleted.
4. **No** commented-out code, `legacy` or `_old` copies, compatibility shims for removed things, or "superseded" stubs.
5. **Show proof in the PR:** list the identifiers, files and resources deleted, with a search proving no executable/active caller remains; label immutable historical references, and explain any drop in test count.
6. **Old plan tickets for removed mechanisms are closed as superseded**, not implemented and left dormant. See `source-of-truth/SUPERSEDED-BY-ITEM-0.md`.
7. **Reuse before write.** Use SDK, AWS and library features first. Custom code needs one line saying what the standard option couldn't do.

## 4. Capiro data must keep working

- Capiro data is served to Claude as tools. Core remains the source: today's read families call Core at `/api/clio/tools/<operation>`, and the new tools call the same endpoints.
- Tools are hosted by **control** (the existing tool gateway) so the runner never holds the Core service secret (`x-internal-service-secret`). The runner gets only a short-lived per-run token for control, scoped to tenant, user, client, conversation and run.
- Reuse the existing read handlers under `apps/gateway/sources/*` and their typed schemas. Delete the authority, relay and measurement wrappers around them.
- Parity: every read family that works today must be reachable as a tool with the same results and the same permission outcomes. A parity checklist is part of the item 0 spec.
- Negative tests are mandatory: another tenant's data, another client's data, and walled data must not be retrievable, through chat or through tools. A General chat reads across the clients the user can already see, with each client's wall enforced per result (FINAL-PLAN decision 2).
- The original read-only first cut is historical. Neo subsequently authorized preview client-record writes and autonomous Wave 2 completion. Activate accepted writes through their existing authenticated domain/intent owners and receipts, with the actual route/configuration and effect semantics verified. This does not authorize the assistant to send external mail without the user's specific send instruction.

# Wave 2 handoff — in-progress checkpoint, 25 October 2026

**Status: IN PROGRESS. Wave 2 is not complete; the new preview has not passed final authenticated acceptance.** Evidence cutoff: **2026-10-25 11:16 UTC**. Later operations must be read back by their owner before this document is finalized. Root owns this checkpoint and its eventual closure update; Release remains the sole AWS operator. This public document contains source/infrastructure pins and aggregate facts only. Private evidence is referenced by descriptive name, never copied with identities or secrets.

## 1. Stopping point and changes since the last handoff

The previous [Wave 1 handoff](../20261022/WAVE-1-HANDOFF.md) ended on the owner/proxy/Fargate path. The [24 October state receipt](../20261022/CURRENT-STATE.md#historical-24-october-2026-receipt) subsequently recorded AgentCore V1 version 4, General migration 49 and Core ledger 678. This checkpoint supersedes those deployment statuses only where a newer receipt is identified below; their failures and acceptance limitations remain history.

The current accepted product source is Meri `7559e7c397c74a60231997926ddd5613cdb05b68`, tree `c3351c04374b3916dd30a95e03bc92f2fce1e40e`. It uses the actual Claude Agent SDK on standard AgentCore Runtime V1, native tools/skills/session persistence and Core's canonical access control. Source qualification passed for the repaired retention path with the reviewed 60/65/70/75-second work/private-HTTP/native/activity chain. This is a reviewed product change; earlier 18/20-second failures are not relabeled as passes.

Since the previous state receipt: Core's eight forward migrations and Meri's eleven forward entries are applied on the preserved preview clone; Schedule database LOGIN is verified; Core revision 12 is healthy; AgentCore runtime and preview endpoint select version 5; three reviewed service bundles have been uploaded. The coherent app rollout is **BLOCKED**: Schedule worker 1 exited 3 with `RUNTIME_UNAVAILABLE` after material-init exited 0. At 11:10:25.840 UTC, a local read-only diagnostic using the exact rendered Schedule database URI failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` under the deployed private-control-only CA and passed `SELECT 1` under the existing RDS-plus-control composite CA. This is a concrete trust-path diagnosis, not an ECS repaired-service result. Schedule owns the minimal existing CA-owner source correction on a preserved branch based at 755; Supporting independently reviews it. Successor SHA/image are unknown and unbuilt. Release holds downstream supporting-service/frontend/DNS cutover pending this correction and actual readiness. Root authorized cancellation of the retrying app update, restoration of known control67/worker63 without failed Schedule1 and paired endpoint4 restoration, preserving Core12, forward ledgers, frontend29 and DNS. App cancel was reported accepted at11:15 UTC; rollback completion and endpoint4 readback are NOT VERIFIED at this cutoff. The last verified endpoint5 receipt below must not be treated as a fresh post-cancel observation. Final client/General and advertised-feature acceptance is NOT RUN. Documentation does not block those existing operations. Neo directly clarified that root must finish Wave 2 fully: this checkpoint records the exact incomplete state, the independent work Wave 3 agents may do, and that root will notify those fresh agents only when Wave 2 is actually complete.

Read the [standing requirements](../20261022/STANDING-REQUIREMENTS.md), [current workflow](../20261022/WORKFLOW.md), [PROCESS templates](../20261022/PROCESS.md#6-current-templates), [approved plan](../20261022/plan/FINAL-PLAN-20261021.md), both [master plans](../20261022/source-of-truth/), and the [supersession register](../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md). The [user acceptance checklist](WAVE-2-USER-ACCEPTANCE.md) gives the actual entry paths, prerequisites and excluded actions. Historical briefs preserve ticket acceptance, not obsolete mechanisms, roles or holds.

**Current authority:** only Neo approves scope directly in chat. In-scope implementation decisions proceed and are logged; a scope, product or security tradeoff goes to Neo. GitHub comments never confer approval. Root operates at Ultra and only orchestrates; delegated implementation, gate, review and Release sessions use xhigh. Authors build; separate reviewers inspect exact heads; root coordinates gates and merges; existing Release alone performs AWS, migration, rollout and rollback. No post on issue #202 is authorized by this handoff. Neo decides what to publish there.

## 2. Live components, candidate pins, database and snapshots

The tables distinguish current readback from prepared candidates. A desired revision or uploaded bundle is not a healthy service receipt. `UNVERIFIED` means the fresh evidence was not available to this documentation checkpoint, not that the operation failed.

| Component | Exact source / image | Revision and evidenced state |
|---|---|---|
| AgentCore Runtime V1 | Meri `7559e7c397c74a60231997926ddd5613cdb05b68`; `sha256:d092c38caec09aa50542c609d661106eb9dc0573c233cee20ff6ed429773e73b` | Runtime **5 READY**; preview endpoint **liveVersion 5 READY**, last update **11:01:27.132475 UTC**, `endpoint-after-execute.json`. MMDSv2 required, V1; idle 900 s, maximum lifetime 28,800 s. No ECS runner revision applies. |
| Core | `025ae90fc7bf85c91a5f60eaf949cc7effa1d330`; `sha256:8140114178e42d9a224c9a058c140c8594e374135367933776b6349beb25e125` | `capiro-preview-first-chat-core:12`; **11:00:43.826783 UTC**, stack UPDATE_COMPLETE, running 1, both target groups healthy; `core025-live-verified.json`. Functional acceptance false. |
| Meri control | Candidate source/image: same `7559e7c…` / `d092c38…` complete pins above | Desired `meri-product-preview-control:68`; final app rollout executing, healthy readback UNVERIFIED. Previous serving `:67`, source `506591fb28eb07875e0ffce760b1e7eed94dc494`, image `sha256:763584a19f69856140e28741ea8a66dd427db1c03f7b5622830bb3abe5148aed`. |
| Conversation worker | Candidate source/image: same `7559e7c…` / `d092c38…` | Desired `meri-product-preview-temporal-worker:64`; healthy readback UNVERIFIED. Previous `:63`, image `sha256:1421f5cb090a010be2c3e3faa8c549f2c570c30a7432641efcca839dd8a8e35d`; previous exact source UNVERIFIED. |
| Routine Schedule worker | Candidate source/image: same `7559e7c…` / `d092c38…` | Revision **1** was attempted; startup **FAIL**, material-init exit0, application exit3/RUNTIME_UNAVAILABLE. CA diagnostic described above; healthy successor NOT RUN. This service is distinct from the hourly conversation-retention schedule. |
| Frontend | Candidate `e478e4d73132bd1566b3945d63c5e0a3a1306cc1`; `sha256:569cc85db6a9afa1ab198073ed5ce96dba92a0bd9f5391400590fbb499ffb9ca` | Candidate image qualified, change set prepared; new live revision UNVERIFIED. Last serving `capiro-portfolio-preview:29`, source `6118da8075c542229c0e88039cb6043fef13acb5`, image `sha256:e2afbdd3a8c684edf1109255a5de926b1bd6d3ffd7978865273b5f31c34a1153`. |
| API Strategy | Candidate `8f4d7fb40b96589c62a9d6d550acf9c95ae1602a`; `sha256:cd69ce4f3d31844fa0ee2c3f4057c01d720390645ca916202bead1202eb4d1da` | Candidate qualified; new live revision UNVERIFIED. Last serving `capiro-preview-api-strategy:1`, source `ca4de503fb6ec09caf0daf8b976a0f649c6b9665`, image `sha256:859669df27559b9d004cfdb3017b38c2a0968cb2e4cf25b332b14b7632203bc7`. |
| Workspace | Candidate `8f4d7fb40b96589c62a9d6d550acf9c95ae1602a`; `sha256:9912508298d7537c58c22f2f80606b29fee71f4d5495b6223e8e64d038eab1ee` | Candidate qualified; new live revision UNVERIFIED. Last serving `capiro-preview-workspace:3`, source `c96675e014ab8b5b339049e14aa4bf01881074e9`, image `sha256:c7b699b652f9be460e3c712e8176ba99a276b3b037bdfe04fc3b11c6edcbc635`. |
| Intel API | Candidate `310b9413b591546b153f3c5bd64f27801a48ded1`; `sha256:65187e558875615387378d03abee47a96ab7ebec08aa1c8188ff956b4edab846` | Candidate qualified; new live revision UNVERIFIED. Last serving `capiro-preview-intel-api:1`, source `ca4de503fb6ec09caf0daf8b976a0f649c6b9665`, image `sha256:39408a99891224ffd55c0c46c53e486b58ffd09dc0e5e258d55f56138195a007`. |
| Temporal server / dedicated preview edge / DNS | Server source and image UNVERIFIED in this checkpoint; do not infer a new server rollout | Existing Temporal services preserved. Edge preparation verified UPDATE_COMPLETE at **06:04:37 UTC**, 70 resources/13 outputs; DNS-last change prepared, execution UNVERIFIED. Live ALB rules must remain unchanged. |

Candidate satellite digests and the previous serving rows come from Release's `RELEASE-PREPARATION.txt`; individual initial build receipts predate completed scans. Release's later qualified-image status supersedes only those pending scan statements. Do not rebuild these unchanged images merely to obtain another receipt.

| Database / material | Verified result | Evidence and boundary |
|---|---|---|
| Preview clone snapshot | `capiro-newstack-preview-clone-pre-wave2-20261025t0541`, encrypted, AVAILABLE | `completed-preparation-readback.json`, **06:04:37 UTC**. One persistent preview clone; never reset/re-clone or migrate the shared live DB. |
| Core ledger | **678 preserved + 8 new = 686 total**; 585 finished, 101 historical rolled-back, no unfinished migration | `core025-migration` verified-after and Primary actual-migration review; after readback **10:13:16.544 UTC**. Historical rows are immutable. |
| Meri ledger | **49 preserved + 11 new = 60**; all 686 Core rows preserved | `meri-7559-migration` verified-after; operation **10:15:33.711–10:15:35.478 UTC**. Qualification's one Temporal-only fixture omission is not a production ledger omission. |
| Schedule database role | LOGIN true, ordinary role; SCRAM-SHA-256/SASL-final and TLSv1.3 verified; grants/memberships unchanged | `schedule-login-verified.json`, intent **10:15:50.162 UTC**; receipt has no completion timestamp. No Temporal schedule activation follows from this. |
| Service material | Three exact reviewed bundles uploaded and exact-byte readback passed | `upload-verified.json` and Release handoff; completion UTC not recorded in this checkpoint. No values/version identifiers copied. |
| Old custom secret labels | Four associations retired; control/worker 19 labels each; 68/66 versions preserved, reserved/live/rollback references preserved | `label-exception` verified receipt. Explicit narrow root operational exception, not general secret-version deletion or a scope approval. Reverse operations retained privately. |

## 3. Source integration, open PRs, review and gates

Fresh remote checks at this checkpoint: Meri `main` **`e70dac734ae4efed31ebb3c3bcc5566584a848b5`**; Core `backend-import` **`2edec026c912c2f6155a6ac8d04ae08bc70030b3`**; frontend `main` **`d01ea5544b64008ed0a72ae4e6c5af30d8ba64a1`**. The docs branch starts at that Meri main. **These default branches are not the accepted product release source.** The frozen Meri release candidate is 102 commits ahead of this main; a matching final-candidate PR was not returned by the open-PR query. Do not cherry-pick or rebuild product source during this docs publication.

Merged prior sources are historical deployment ancestors: Meri PR242/243 and Core PR126 were deployed before this checkpoint; frontend PR138 is the prior frontend image. No new candidate merge is asserted. Current accepted Core/FE/Meri candidates have independent local review/qualification receipts but their final default-branch integration is **UNVERIFIED / root-owned**. Preserve exact source-to-image association when root reconciles it.

The following are the still-open Wave 2/nearby handoff PRs returned by GitHub at **11:06 UTC**. GitHub reports each as draft, blank review decision and no status-check entries; that is **no hosted verdict/check evidence**, not a failed gate or a replacement for local review. Base-versus-head product gates on these old PRs were NOT RUN by the docs lane. Root must reconcile accepted descendants before considering any merge. Recorded PR base SHAs were separately read from GitHub metadata at 11:21 UTC; they can predate the current target-branch tips shown above. Clean merge against refreshed target and base-versus-head gates remain NOT RUN; do not use an old recorded base as today’s integration tip.

| Repository / PR | Exact head | GitHub-recorded base branch / SHA | Disposition / named blocker |
|---|---|---|---|
| [Meri #238](https://github.com/neo-capiro/meri-greenfield/pull/238) | `f6e849afd56d6e7484acdb28f2b14fcd1d4567a2` |`main` / `864d9d4315590b920fa5313591635e8d12e2e146` | MG05 donor; accepted composed descendant must be checked by Runtime/root. BLOCKED as a fresh standalone merge. |
| [Meri #228](https://github.com/neo-capiro/meri-greenfield/pull/228) | `5d6bc28ea5cc516f2b1f81e8bdb23421c4090f8d` |`main` / `05d588c7c5d6da8b8e8a12ea4d47e16526af1aaf` | Experiment only, do not merge. Runtime preserves spike evidence. |
| [Meri #215](https://github.com/neo-capiro/meri-greenfield/pull/215) | `ac724cbcfced98a6e5aa8b7d60a9ce3c65fb0f2b` |`main` / `4f8725b826a48c046a49e8d8d11babe188515894` | Suspended pre-item-0 checkpoint; root reconciles lineage, no revived mechanism. |
| [Core #113](https://github.com/neo-capiro/capiro-backend/pull/113) | `0dd24f50a0d0da4b69d1c6f3613be9b0c34baf8d` |`backend-import` / `0f067ed82acfa44b73dd4fc4c0ac21e5c731fe1d` | Historical M2 donor; Integration/root must compare accepted composition. |
| [Frontend #134](https://github.com/neo-capiro/capiro-frontend/pull/134) | `8424299960ac09dc7996231092f35ac976aab5dd` |`codex/general-frontend-20261024` / `5744f912d6ef83b3eb23983f6558b90be342229f` | Mail donor; Integration/root reconciles final candidate and retained failed/unrun rows. |
| [Frontend #133](https://github.com/neo-capiro/capiro-frontend/pull/133) | `abca9ab93cc51b6cbee1e459cb306c71e5bc6636` |`codex/general-frontend-20261024` / `5744f912d6ef83b3eb23983f6558b90be342229f` | Historical composed UI donor; Integration/root checks final descendant. |
| [Frontend #124](https://github.com/neo-capiro/capiro-frontend/pull/124) | `4a6a6fae8bf7a493c23268ec04c80a4dd0cbce97` |`main` / `75458af705e352c54bf23ed3b5c61de7e781d714` | A2 donor; Integration/root reconciles accepted descendant. |
| [Frontend #123](https://github.com/neo-capiro/capiro-frontend/pull/123) | `bdcad07fec4f248d7b82fb7cb7ad98f4fd61be09` |`main` / `75458af705e352c54bf23ed3b5c61de7e781d714` | M2 donor; Integration/root reconciles accepted descendant. |

The complete open-query counts were Meri 170, Core 97, frontend 96, including older donor/lineage PRs outside this release. Their individual readiness was NOT RUN and they are not release candidates by implication. This checkpoint does not authorize mass closure. Meri #200/#203 remain superseded historical mechanisms, not queued work. The docs publication PR and its exact reviewed head are discoverable from this branch's ordinary Git/PR history; root must verify them before merge rather than relying on a self-referential SHA in this file.

## 4. Acceptance rows: PASS / FAIL / NOT RUN

All UTC values below are on **25 October 2026** unless stated otherwise. PASS applies only to the named scope. The [user checklist](WAVE-2-USER-ACCEPTANCE.md) retains the actual steps, safe fixture requirements and unavailable paths.

| Row | Result | UTC, measurement and limit | Evidence / remaining owner |
|---|---|---|---|
| Exact 755 native ARM PostgreSQL SDK suite | **PASS** | **09:48:07.521–09:50:16.131**; SDK **20/20**, Objective **13/13**, separate rollback diagnostic **3/3**; 0 skips/cancellations/todos | `AWS-QUALIFICATION-RESULT.txt`; Primary actual-result review closed. Fixture Core/storage ports; not live acceptance. |
| Background retention, one large session | **PASS** | Same run; **100,000 entries / 33,500,001 bytes**, **23.32985177 s < 60 s**; 100 entry DELETE pages and row COMMIT; absence across 4 SDK tables, EXECUTED/finalized and no-repeat replay | `qualification-summary.json` / sweep diagnostic; one session only. 4 CPU/8 GiB. Cgroup counters unavailable; no headroom or 4,096-maximum-session claim. |
| Historical 33-source full sweep | **FAIL** | **09:07:19.163–09:09:30.013**; **20.00131132 s > 20 s**; SDK 18 pass/2 fail, Objective13 and diagnostic3 pass; 78 uncommitted DELETE pages | Prior failure remains preserved. Successful diagnostic does not qualify failed full purge. |
| Historical 89-source full sweep | **FAIL** | **07:46:01.578–07:47:52.376**; **20.000290957 s > 20 s**; SDK18 pass/2 fail, Objective13 pass; 67 uncommitted pages | Earlier setup-only failures have no performance result. No blind retry implied. |
| Final 755 runtime image | **PASS** | **09:57:30.923–10:01:09.450**; 8 canonical probes; ARM64/nonroot1000; 1,702,080,670 bytes; scan COMPLETE, **0 findings** | Exact `d092c38…` digest in §2; all 29 raw files, source20,882, owned cleanup verified. Primary actual-image review closed. |
| Qualification owned-resource cleanup | **PASS** | Same PG run; 44 raw files / 77,553 bytes; source20,882 verified; owned container and both mountpoints removed | No shared-service mutation; cleanup does not authorize environment pruning. |
| Core/Meri forward migration and Schedule LOGIN | **PASS** | §2 counts/times; historical prefixes preserved, no unfinished Core entry; ordinary-role TLS authentication | Primary actual migration/LOGIN closure; not schedule execution. |
| Core health / AgentCore endpoint selection | **PASS** | **11:00:43.826783 / 11:01:27.132475**; Core 1 running/2 healthy target groups; endpoint5 READY | Exact readbacks in §2; no feature pass inferred. |
| Schedule worker startup | **FAIL** | Before **11:10:25.840** diagnostic: material-init exit0, app exit3/RUNTIME_UNAVAILABLE; exact task stop UTC not copied here | `schedule-first-task.json` / `schedule-first-startup-log.json`; **BLOCKED: Schedule CA-owner correction, Supporting review, Release qualification/readiness**. |
| Schedule database trust diagnostic | **PASS (diagnosis only)** | **11:10:25.840**; private-only CA fails issuer verification; same URI with existing RDS-plus-control trust passes `SELECT 1` | `schedule-db-trust-diagnostic` / `result.json`; read-only local Node24.22.1 PG, not repaired ECS startup or source qualification. |
| App cancellation / restored67/63/endpoint4 pair | **NOT RUN (completion)** | Cancel reported accepted **11:15**; completed rollback and restored endpoint readbacks absent | **BLOCKED: Release terminal rollback/readiness readback**; Core12/forward ledgers/FE29/DNS retained. |
| Coherent control/worker/Schedule-worker, satellites, FE and DNS health | **NOT RUN** | At **11:16** checkpoint: downstream release held by Schedule startup; final readbacks absent | **BLOCKED: Release final cutover readbacks after Schedule fix**. No mixed old-control/new-runtime qualification. |
| Final client/General first turn, authorized read, follow-up, Stop, reload/reconnect/history | **NOT RUN** | No final-candidate authenticated run or new turn latency/call count | **BLOCKED: Release coherent handoff and no-deploy window**, then Acceptance. Agreed simple-turn limits remain Core calls ≤30 and Core time ≤3 s. |
| Idle restore/native continuity; full tools/14 skills and output quality | **NOT RUN** | Idle setting900 s is configuration, not a restore assay; image format probes are not publication/download/quality | Acceptance + Runtime; preserve real prior context, no forged invocation or fabricated historical restore. |
| Hourly retention Describe/activation and real 30-day erasure | **NOT RUN** | Earlier connection attempt bounded6 s sent **0 DescribeSchedule RPCs**; existence UNKNOWN, not absent | **BLOCKED: Release reachable bounded execution route, custody/Core/active material and actual erasure evidence**. Runtime prepares existing describe-first/reuse/create-if-absent operation. Never blind create. |
| Model policy read/save, routines/Objective, tasks, memory, files/carry-over, Calendar, Settings/Mail provider paths | **NOT RUN** | Final-source real behavior unmeasured; prior ordinary-role PG/local checks retain their narrower scopes | Acceptance and feature owners; see checklist for missing ready Objective/conversion/hearing/provider fixtures. Fixture gaps do not hold deployment. |
| Cross-tenant/client/wall denial and revocation | **NOT RUN** | Final deployed paths not measured; revocation acceptance target ≤30 s | Acceptance with existing authorized fixtures; Core remains gatekeeper. No tenant-role or permission workaround. |
| Prior frontend-only preparation | **PASS (predecessor only)** | **10:00:56**; existing sign-in, General/client scoped composer and Recent observed; current smoke-client file count0 | `acceptance-status.txt`. No prompts, policy save, provider action or final 755 acceptance. Old disabled controls are not a final-candidate failure. |

No product tests were run for this documentation change. No new executable tests were added; mutation checks are **N/A** and executable test count change is **0**. Docs validation consists of diff/whitespace, local links, exact rules, privacy and source/state consistency; independent review is against the final docs head. Product builds, PostgreSQL, AWS and browser acceptance were NOT RUN by the docs author. Product evidence above is explicitly reused from its owners.

## 5. Decisions and pending Neo decisions

The canonical [decision log](../20261022/decision-log/DECISION-LOG.md) previously contained **O240–O242**; this checkpoint adds **O243–O248** without duplicating them. Do not restart from O240 or retroactively invent decisions. **O243** records Neo's current direct process instruction: commit and push a dated nine-section wave handoff; hand off to fresh memoryless sessions with briefs/tickets/rules/plans; use current roles and PROCESS templates; no issue #202 post without Neo. Reason: a new session must continue from repository evidence alone. Reversal: a later direct Neo instruction can supersede the process; preserve the dated history. Neo further clarified directly: root also orchestrates Wave 3 and may start independently scoped plan work when able while prioritizing Wave 2; finish Wave 2 fully; if unfinished at checkpoint, state exactly where it stopped, what Wave 3 can independently work on, and that root will notify fresh Wave 3 agents once Wave 2 is done. This adds no product scope or release acceptance.

O244 records the existing measured retention-bound decision; O245 the coherent-cutover/functional-gate sequence; O246 the four-label exception; O247 the bounded held retention ECS route; O248 the failing-app cancellation and known-pair restoration. They are recorded now from root/owner evidence with original decision UTC explicitly unverified where unavailable, not invented as new Neo scope approvals. Each entry states reason and recovery bound. Existing exact reverse operations remain with Release. Source changes still need affected review/checks; rollback of deployed resources is Release-owned and must respect the now-applied forward schema.

Pending **Neo** decisions remain explicit: A0 staging and the production data path for the independently evolving clone; PF14 beyond the accepted note-only allocation where the broader ticket is unresolved; any new security/scope tradeoff beyond existing authorization. Their latest direct resolution is UNVERIFIED here. Root rechecks chat authority before asking again. Missing deployment/fixture evidence is an owner task, not an automatic new scope-approval flow.

## 6. Traps for a fresh session

- Default branches are older than the release candidates. Keep the frozen source/image binding; never rewrite the release checkout to publish docs.
- A local handoff may prepend newer facts above historical failures. Use exact receipt time and scope. Blank GitHub checks, source acceptance, image smoke, healthy tasks and a model response establish different things.
- The correct frontend is [preview Meri](https://portfolio-preview.app.capiro.ai/meri), with `?scope=general` for General. The retained API host's root/portfolio404 is expected, not a frontend deployment defect.
- Physical retention requires active matching source/material, real custody/Core finalization and scheduled execution evidence. Routine Schedule worker LOGIN, retention-enabled configuration, an empty file list and Trash suppression do not establish erasure. Response timeout is not a physical cleanup/stop receipt.
- Use the accepted 755 60/65/70/75 chain for current behavior. Preserve earlier 18/20-second failures. Do not turn a single large session pass into maximum aggregate capacity proof.
- AgentCore rejected an attempted immutable `requireServiceS3Endpoint` field update. The accepted correction omits that field and verifies it remains false; record returned actual version, do not predict the version number.
- Schedule material generation and database LOGIN passed, but Node PG startup used insufficient trust. The same exact URI succeeding under the existing composite CA is diagnostic evidence only; qualify the actual reviewed successor and verify deployed readiness before releasing downstream rollout. Preserve unchanged 755 qualification within its original scope.
- Four secret-label associations were retired under a narrow exception. Versions, active/rollback references and AWS-reserved stages remain. No blanket label/version cleanup is authorized.
- Core access remains canonical. An old local settings denial was a permission-projection defect; do not grant roles, seed policy or bypass current permissions to make acceptance pass.
- Preserve WSL Codex-Gates, persistent app/database services, volumes, development authentication/configuration, checkouts, evidence and caches. No setup repair or blanket cleanup; local setup gaps must not hold the existing AWS deployment.
- Reuse accepted images/checks, one writer per shared contract/config/migration. No new qualification/fingerprint framework. Keep real authorization, transaction/grant/migration/deletion checks where behavior changes.

## 7. Temporary resources and diagnostics to delete

| Resource | State / owner / condition |
|---|---|
| Native qualification container and two owned mountpoints | Verified absent after final qualification; no further cleanup. Environment/Release own any new bounded fixture. |
| Image job's owned image/container | Verified absent after successful final job; preserved raw evidence remains. |
| Local content-free settings relay diagnostic | Acceptance records it removed and original relay restored with diff0; do not reinstate without a demonstrated need. |
| Temporary private release material, credentials and operational scratch | Release owns exact inventory and safe cleanup after success/failure; retain required current/rollback material. Values and private paths do not enter this repo. |
| Replaced per-turn runner and old owner/proxy/issuer resources | Existing retirement inventory must be freshly read back after replacement acceptance/rollback closure. Current app change set removes obsolete runner task definition; execution result UNVERIFIED here. Do not treat historical names/counts as current deletion targets. |
| Historical owner/proxy network diagnostics | Flow-log group/role and related resources require fresh Release ownership/existence check; cleanup NOT RUN by docs. No claim that historical diagnostics still exist. |
| Docs and phase-brief worktrees | Preserve, commit and push; no recursive checkout cleanup. No product-code diagnostic added by this lane. |

## 8. What is not in this public repository

Names below identify private owners and evidence locations **by name only**. Ask the current owner for access in the existing environment; do not print or commit their contents. A fresh session can identify the next owner/action without possession of credentials.

| Name | Owner and retained contents |
|---|---|
| `wave2-visible-release` / `release-20261025` | Release: exact live readbacks, build/scan logs, migration ledgers/snapshot proof, source archives and rollback commands. Named receipts used here: `core025-live-verified.json`, `endpoint-after-execute.json`, `runtime-verified.json`, `verified-after.json`, `schedule-login-verified.json`, `upload-verified.json`, `completed-preparation-readback.json`, `schedule-first-task.json`, `schedule-first-startup-log.json`, `schedule-db-trust-diagnostic` / `result.json`. |
| `wave2-visible-review` / `independent-review.txt` | Primary reviewer: exact-source and actual-result review closures, preserved failures and limits. |
| `wave2-visible-supporting-services` | Supporting: final app local/cloud review, material/edge/service bindings and satellite image qualification. |
| `wave2-visible-runtime` / `retention-activation` | Runtime: existing retention overlay/operator, final assembly and bound-chain handoff; preparation is not activation. |
| `wave2-visible-acceptance` | Acceptance: authenticated browser context, private fixture nominations, screenshots, `acceptance-status.txt` and original user checklist. No identities copied. |
| `wave2-visible-integration`, `wave2-evidence-20261024` | Integration/feature owners: accepted source composition, actual PG evidence, feature receipts and preserved earlier runs. |
| `assembly7559`, `label-exception`, release private material | Release: rendered bundles, private PKI and exact reverse operations; never source-control these values. |
| `LOCAL-DEVELOPMENT-ENVIRONMENT.md`, `Codex-Gates` | Environment owner: preserved host inventory, persistent services/config/data and reusable caches. |
| AWS `default` profile, existing Secrets Manager and provider sessions | Release/authorized owners: existing credentials. Do not copy credentials across hosts or publish secret values/customer-linked IDs/UUIDs. |

## 9. Next-wave briefs, bases, ownership and first actions

This is an **in-progress checkpoint**, not permission to abandon unfinished Wave 2 or announce Wave 3 started. The [dated phase briefs](briefs/README.md) carry the next-wave allocations and verbatim ticket/acceptance extracts. Each fresh agent receives only its brief, tickets, standing rules and plans; fresh reviewers and continuing root orchestrator use the committed handoff rather than inherited chat memory. Preserve existing Release continuity while the active deployment runs.

**Wave 3 work before notification:** Neo explicitly authorized root to also orchestrate Wave 3 and start when able. Root may assign independently scoped existing-plan implementation after brief/ownership review on isolated branches, without another user-approval request; Wave 2 deployment and acceptance remain the priority. Fresh agents may read the plans, reconcile verbatim tickets and ownership, refresh read-only branch/PR facts and prepare their bounded briefs/review checklists. Any independent implementation requires its explicit root brief and verified non-overlap; no new feature scope or AWS action is inferred. Integration and release-dependent work wait for the explicit Wave 2 completion notice. Acceptance against the new release, shared-schema/config changes, retirement, production-path/staging choices and dependent feature activation remain BLOCKED until their named Wave 2 prerequisite or direct Neo decision is satisfied. Wave 2 carryover is not silently reassigned or called complete.

1. **Root, orchestration only:** refresh remote default heads, read the latest Release/Acceptance receipts, reconcile §§2–4 and final product source integration. Keep frozen Meri `7559e7c397c74a60231997926ddd5613cdb05b68`, Core `025ae90fc7bf85c91a5f60eaf949cc7effa1d330`, frontend `e478e4d73132bd1566b3945d63c5e0a3a1306cc1` as the candidate references until an explicitly reviewed successor exists. Hand out exact bases, dependency heads, paths and cleanup owners; never guess a future merge SHA.
2. **Existing Release, sole AWS operator:** first verify the authorized app rollback and restored67/63/endpoint4 pair; finish the minimal Schedule trust repair through its owner and independent review, then its necessary build/checks and healthy startup; resume the already authorized coherent rollout and DNS-last sequence; retain exact revision/digest/config and health readbacks. Supply PROCESS6.3 acceptance packet and a no-deploy window. Use existing rollback owners; no new setup or infrastructure framework.
3. **Acceptance and feature owners:** execute the [dated checklist](WAVE-2-USER-ACCEPTANCE.md) on matching deployed sources. Prioritize client/General chat, reads, context, Stop/reconnect and actual idle restoration; then available advertised features. Mark missing fixtures NOT RUN with owner. No external sends, provider edits, invented identities or customer-data deletion.
4. **Runtime + Release:** finish bounded reachable retention operation, describe first, reuse exact matching active schedule or create only after confirmed absence and qualified prerequisites. Verify actual scheduled workflow, real storage custody and finalization/30-day erasure within the approved scope; preserve unknown outcomes and no blind retries.
5. **Fresh next-wave implementation/review lanes:** use dated briefs after root establishes the genuine wave boundary. Reconcile in-scope carryovers before later-wave breadth. Escalate only unresolved scope/security decisions to Neo; ordinary fixes proceed/log. Every new executable test needs meaningful mutation checking; docs-only work has none.
6. **Root + docs owner at actual closure:** update all nine sections from fresh receipts, keep failures/unrun rows, continue after the latest actual O-number, get independent exact-head docs review, commit **and push** the final handoff. Record the ordinary PR/head/base/check evidence. Do not declare Wave 2 complete or the new preview accepted until its required rows actually pass. Root sends completion notice to the actual fresh Wave 3 agents only after required deployed acceptance and closure; until then notify them of the dependency state, not completion. Neo decides any issue #202 post.
