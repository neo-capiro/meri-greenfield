# Integrated source release manifest — 18 October 2026, with 20 October successor

## 20 October 2026 successor: three-repository release manifest (adjustment plan Revision 2)

Status: **inventory and dependency record only.** It does not authorize a merge, image build, migration, deployment, rollback, or chat. Revision 2 §4 makes this parallel work: it is not a prerequisite for the first-chat repair. The 18 October body below this section is kept unchanged as history. Where the two disagree, this section is newer. The capability view of the same release is in [CAPABILITY-LEDGER-20261018.md §R2](CAPABILITY-LEDGER-20261018.md#r2-canonical-capability-ledger-revision-2-11).

Prepared by Fable session adj-g-ledger on branch `fable/adj-g-capability-ledger-20261020`, from `2b4421f6`. Readbacks were taken 2026-10-20 between 03:30 and 04:10 UTC. They used `gh`, Git objects, and read-only ECS/ECR/CloudWatch describe calls on account `967807252336`, `us-east-1`. Nothing was mutated, no secret value was read, and no database was queried.

Labels used below:
- **[R]** recorded now: read from GitHub, Git or AWS during this session.
- **[E]** recorded earlier: taken from a cited release record and not re-read here.
- **[I]** inference.
- **[U]** unknown.

The focused deployed baseline for the failing path is in `C:\dev\fable\adj-reports\adj-a-baseline-REPORT.md` (package A). This section does not repeat its executable and configuration detail.

### S1. Deployed now

| Repo | Service / task definition | Image digest | Source | Evidence |
| --- | --- | --- | --- | --- |
| meri-greenfield | control:35, temporal-worker:34, temporal-issuer:34, owner:33, runner:20 (registered 2026-10-20 01:10–01:29Z; each service 1/1, rollout COMPLETED) | `qualification-worker@sha256:f5a7abc9…5ff7` | `2b4421f612f9fbb728d6da52927aac228d712d40` (head of `fix/runner-transport-diagnostic-20261019`) | [R] ECS DescribeServices/DescribeTaskDefinition. [R] ECR tag `product-2b4421f6…-8779200a…`, pushed 2026-10-20T00:09Z. [E] scan COMPLETE with zero HIGH/CRITICAL, per `handoff/runner-diagnostic-release-20261020@c8fcf965` README. |
| meri-greenfield | proxy:33 | `sha256:734a20ec…3551` (material-init uses `f5a7abc9…`) | `34851020aa0d73fead4db59ba6e26a098e2d0313`, an ancestor of `2b4421f6` | [R] ECR tag `proxy-product-34851020…`, pushed 2026-10-19T01:01Z |
| meri-greenfield | Temporal frontend, history, matching, internal-frontend, internal-worker (each :1, since 2026-10-17) | `sha256:f73ce01e…` | `989a4227…` | [E] public-candidate `deployment-inputs.candidate.json`. [R] services still at :1. |
| capiro-backend (Core) | capiro-preview-first-chat-core:2 (registered 2026-10-17 18:27Z) | `capiro/preview-core@sha256:46acfc07…` | `ade7fc883b7459cbc50e6f71d40ce3644bace5ea` | [R] task definition `RELEASE_SHA` and ECR tag |
| capiro-frontend | capiro-portfolio-preview:18 (cluster capiro-portfolio-preview, registered 2026-10-18 15:37Z) | `capiro/portfolio-preview@sha256:0401f61d…` | `67fdf56b8f63f25c95dd2c0a2ff0139dcfe3cfb8` | [R] ECR tag on the serving digest. The task environment labels `CAPIRO_PREVIEW_MERI_RUNTIME_SOURCE=176a8811…` and `CAPIRO_PREVIEW_FIRST_CHAT_BACKEND_SOURCE=c64f0005…` are stale and do not describe what is deployed. |
| capiro-dev (not this product path) | capiro-dev-meriv2-orchestrator:175 | — | — | Old Meri v2. Out of scope; listed so it is not mistaken for this runtime. |

#### Deployed capability inputs

- **[E] Meri.** In the deployed public `deployment-inputs.candidate.json` (handoff `c8fcf965`) there is **no `features` key**. Every optional family in `render-material.mjs` `FEATURE_KEYS` therefore renders disabled: `sourceEnabled`, `userPreferences`, `tenantSettings`, `intents`, `routines`, `retention`, `artifacts`, `downloadLinks`, `capabilityPlatform`, `reads`, `memory`.
  - `policy.json`: `maxTurns 3`, $2 per run, model profile `us.anthropic.claude-sonnet-4-6`.
  - The allocation rubric is `first-chat-no-tools`.
  - The release README says: "Optional feature, capability-profile and active-read selectors stay absent."
- **[R] Frontend rev 18.** Flags set:
  - `MERI_CONVERSATION_WORKFLOW_ENABLED=true`
  - `CAPIRO_PREVIEW_MERI_CONVERSATION_ROUTES_ENABLED=true`
  - `MERI_FIRST_CHAT_BOOTSTRAP_ENABLED=true`
  - `MERI_DOCUMENT_WORKFLOW_ENABLED=false`
  - `MERI_ACTION_WORKFLOW_ENABLED=false`

  Not set: `MERI_MEMORY_OWNER_REVIEW_ENABLED`, `MERI_TASK_COMMAND_WORKFLOW_ENABLED`, `MERI_USER_PREFERENCES_ENABLED`. Every frontend flag check is `=== "true"`, so an unset flag is off. The checks are in `apps/web/src/shared/meri-actions/connection-config.ts`, `apps/web/src/app/settings/[section]/page.tsx:16` and `shared/meri-user-preferences/config.ts:14` at main.
- **[R] Core rev 2.** Background and delivery flags are false: `MERI_JOB_SWEEPER_ENABLED`, `ENGAGEMENT_CALLBACKS_ENABLED`, `CLIENT_PROFILE_FILL_*`, `NEWSLETTER_*`, `RESEARCH_PORTFOLIO_WATCH_DELIVERY_ENABLED`, `ENGAGEMENT_RECALL_WEBHOOK_ENABLED`. None of the rev 3 settings appear in the task environment: `MEMORY_GOVERNANCE_*`, `MERI_EXECUTION_MAX_*`, `PREVIEW_NATIVE_GETS_ENABLED`.

#### Contract package

- **[R]** `@capiro/meri-contracts` is `0.1.10` at:
  - deployed `2b4421f6`
  - `32d06db2`
  - PR189, PR190, PR191, PR192 and PR193 heads
  - PR188 `98d3c96a`
- **[R]** The frontend vendors the same tarball blob `abba937b…` (`vendor/capiro-meri-contracts-0.1.10.tgz`) at `67fdf56b`, `5cd5f20d`, `e6180219` and PR102 `3a23d8b1`. `packages/meri-client` declares `0.1.10`.
- **[R]** PR121 `c7af4ed6` is still on `0.1.7`. Its old base makes it a coordination thread, not a release input.
- **[R]** PR191 and PR192 add the subpath exports `intents-application` (`urn:meri:intents-application:0.1.0`) and `document-access-application` (`urn:meri:document-access-application:0.1.0`) without changing the package version.
- **[R]** Frontend PR102 consumes the intents-application contract.
- **Open decision (dot as freeze reviewer, recorded in the PR191/192 docs):** bump `0.1.10`, or vendor the subpath contracts into `packages/meri-client/vendor/`. PR102 already vendors the PR191 dist directly. The decision settles whether that vendoring or a version bump is canonical before PR102 is received.

### S2. Historical: kept as evidence, not deployed

| Repo | Item | Status |
| --- | --- | --- |
| Meri | Release D: source `5b395d4c` (PR193 head), image `sha256:ea0e9ad4…` | [R] control:34, worker:33, issuer:33, owner:32, proxy:32, runner:19, registered 2026-10-19 22:06–22:28Z, now **INACTIVE**. No completed chat is recorded. |
| Meri | Release C: source `a16cc40d`, image `sha256:9bff84ba…` | [R] control:33, worker:32, issuer:32, runner:18, registered 2026-10-19 ~18:00Z, now **INACTIVE** |
| Meri | Failed E attempt on `2b4421f6`, runner task `283f12c53eba4dc89f4d54767d0fa832` | [E] First failure at 2026-10-20 01:41:02.451Z: `RUNNER_FIRST_FAILURE origin=native-start code=UNKNOWN`. Terminal at 01:53:29.764Z. Runner exit 3 at 01:54:07.526Z. Provider contact and settlement are **unproven** (START-HERE §3; `meri-native-start-unknown-20261020/DIAGNOSIS.md`). |
| Meri | PR175 `993f52a9` (frozen) | [R] Ancestor of `2b4421f6`. Never edit. |
| Meri | N17 `4172e474`, N20/N21 `176a8811` | [E] Older first-chat cohort and build pins (`PLAN-RECONCILIATION-20261018.md` §1) |
| Core | rev 1, `6542f5b0`, image `722a4832…` | [R] Task definition still ACTIVE. Previous Core. |
| Frontend | rev 17, `4ea553fe`, image `98d2b5d3…` | [R] INACTIVE task definition |

### S3. Proposed and open, by repository, with ancestry against what is deployed

#### meri-greenfield

| Item | Head | Relation to deployed `2b4421f6` | Release status |
| --- | --- | --- | --- |
| Diagnostic candidate (package B) | `32d06db2`, `fable/pinned-transport-failure-codes-20261020` | Direct child; one new commit | Proposed. Revision 2 B and C successors are owned by the adj-b and adj-c sessions and had not been pushed when this was read. The integration owner must re-pin this row to the combined B+C candidate. |
| PR193 | `5b395d4c` | **Contained** | Deployed as part of `2b4421f6` |
| PR145, PR179, PR180, PR186, PR187, dot/meri-release-combined `7252f483`, PR171–PR177, document-executor lane `d2f05436` | — | **Contained** (ancestors) | Deployed as part of `2b4421f6` |
| PR181 `139e0a14`, PR183 `b51687d4`, PR184 `6be3e4ab`, PR185 `67a7bfbc` | — | **Patch-equivalent commits contained.** `git cherry` shows all of their commits as `-` against `2b4421f6`. | Their source is in the deployed image. The PR branches themselves stay open drafts. |
| PR178 | `ba701529` (config adoption) | Not contained (22 commits) | Proposed. Not in any release candidate. |
| PR188 | `98d3c96a` | `34851020` plus one docs commit | Base for PR189 and PR190 |
| PR189 read tools | `e82d199f` | Not contained. Sibling of PR190 off PR188. | Proposed. Recorded 2,511/2,511 local over 93 files and a 290/290 correction run. Adds `reads.retainedAuthority` config. No migration. |
| PR190 conversational writes | `29379ab1` | Not contained | Proposed. Recorded 1,067/1,069 local (2 opt-in LibreOffice skips). Changes the governed SDK profile, so it needs an in-image re-measure. No migration. |
| PR191 B1 intents contract | `53bbe3da` | On PR190 | Proposed. Contract only: 82/82. |
| PR192 B2 document access contract | `8eab537a` | On PR190 | Proposed. Contract only: 151/151. |
| PR121 | `c7af4ed6` | Unrelated old base | Coordination thread only |

**[I] Overlaps the integration owner must check.**
- PR189 and PR190 both edit `apps/runtime/cli.mjs`. PR190 records no textual conflict.
- PR190 edits `apps/runtime/control.mjs` (`bindDocumentsSessions(..., retention?.gate)`). The deployed PR193 changes the same file to inject the gate into the worker. No three-way check of that pair is recorded.
- PR191 and PR192 add lines to the same `packages/contracts/package.json` exports and scripts.

#### capiro-frontend

| Item | Head | Relation | Release status |
| --- | --- | --- | --- |
| Serving | `67fdf56b` | Ancestor of main | Deployed (rev 18) |
| main | `5cd5f20d` (PR110 merge, 2026-10-19 19:48Z) | 50 commits after `67fdf56b`. Received PR97, PR101, PR104–PR110. The heads of the still-open PR98 (`5c784e3e`), PR99, PR100 and PR103 (`442f188c`) are also ancestors of main. Meri feature code differs from serving in only 18 files (+204/−91). | Not built from main itself. |
| PR111 held candidate | `e6180219` | Main plus 2 commits that move the Core roster source pin from `b97a3286` to Core `50475125` | [R] ECR tag on `portfolio-preview@sha256:32941b84…`. [E] PR112 receipt: build `capiro-portfolio-preview-build:78d8240f…` SUCCEEDED (ended 20:41:11Z); scan COMPLETE with 0 findings. **Held**: it needs a qualified Core image, `PREVIEW_NATIVE_GETS_ENABLED` and `CORE_ROSTER_PREVIEW_ENABLED` proven, host routing, native-session checks and template admission. With the roster unset, `clients.list` would stop working. Not deployed. |
| PR112 | `cfabbc30` | On PR111 | Build-receipt documentation |
| PR102 FE intents approvals | `3a23d8b1` | One commit on `5c784e3e` (main has 25 more commits past that base) | Proposed. It vendors Meri PR191's `intents-application` 0.1.0 dist under `packages/meri-client/vendor/intents-application/0.1.0/`, adds flag `MERI_INTENT_APPROVALS_WORKFLOW_ENABLED` (not on main), and records tsc clean, vitest 2,939 tests, node 79/82 (3 failures described as pre-existing). No Playwright and no live run. |
| PR93–PR96, PR99, PR100, PR103 | — | Older receiving lines. Content from PR93–PR96, PR99, PR100 and PR103 is in main. | Open drafts. Closing them is up to the frontend owner (dot). |

#### capiro-backend (Core)

| Item | Head | Relation | Release status |
| --- | --- | --- | --- |
| Serving | `ade7fc88` | — | Deployed (rev 2) |
| Candidate PR98 | `50475125` | `ade7fc88` plus 286 commits. Contains PR83 `9ab565f4`, PR84 `5c105cfe`, PR86 `b40971b1`, PR96 `784b1c3a` and PR97 `b841544a`. | [R] Image `preview-core@sha256:ace1acca…`, pushed 2026-10-19 20:31Z. [E] Scan: **7 HIGH, 2 MEDIUM, 2 LOW** (PR99 `BUILD-PLAN.md`). The single build authorization is consumed. **Not releasable.** |
| PR99 | `d443e227` | Docs on PR98 | Core roster release plan, build receipt and route plan |
| PR100 | `05d8eb03` | Buildspec and docs on PR98 | Held amd64 Alpine alternative for the OS findings, and real-PostgreSQL qualification gates. Not built. |

### S4. Migrations: applied and pending

Meri preview database (shared `capiro` Aurora). The canonical ordered plan is `infra/product-preview/first-chat-migrate.mjs` `PLAN` at `2b4421f6`. Every entry is SHA-256 pinned, and the plan refuses a changed applied file.

| Stage | Entries | Status |
| --- | --- | --- |
| `meri` | conversations 0001–0011, 0013, 0015, 0016, 0017; budget 0001–0002; issuer 0001; seed; `phase:meri_grants` | **Applied** [E]: `RUNTIME-INTEGRATION-LEDGER.md` §5 G5 and `D2-DATABASE.md`. Conversations `0012` and `0014` stay **held** (reserved, central allocation ledger). |
| `temporal` | `phase:temporal_grants` | **Applied** [E] (same records) |
| `integration` | settings 0001; commands 0001; approval-metadata 0001; intents 0001; schedules 0001–0004; task-lookup 0001; objective-source 0001–0003; artifacts 0001–0003; memory 0001; read-delegation 0001–0002; `phase:integration_grants` | **Approved, not evidenced as applied.** D016 #1 approved it, with a cluster snapshot `meri-integration-pre-<UTC>` taken first. I found no recorded application. [R] The latest `meri-product-preview-d2-migrate` task definition (:6, registered 2026-10-18 07:08Z) has `MERI_D2_STAGE=meri` and the older N21 image `5534edfe…`. The newest retained migrator log streams (2026-10-18 00:28–07:10Z) contain launch-measurement and diagnostic output, not an `integration` stage completion. [U] The ledger rows themselves (`meri_migration_ledger.applied`) were not read: that needs database access. **Owner: dot**, as shipper, through a read-only ledger SELECT before any release that enables these families. |
| Not in the plan | conversations `0018_memory_candidate_targets.sql` and `0019_memory_proposal_contexts.sql` | [R] Both are in source at `2b4421f6`. Both are absent from `PLAN`. They were allocated in `docs/coordination/tasks/CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md`; 0019 was verified only in a disposable PostgreSQL. They need a plan entry, a stage, grants review and approval before the memory-continuation code that reads them can be enabled. |
| Qualification only | proxy qualification state 0001–0003; qualification-sdk-fixture 0001 | Not product migrations. Not part of release. |

PR189, PR190, PR191, PR192 and 32d06db2 add **no** migration [R]. PR190 names a possible additive Core migration for exact-version attachment registration as **unallocated** [E].

Core (Prisma, `apps/api/prisma/migrations`). [R] `50475125` adds 11 migrations over the deployed `ade7fc88`:
- `20281015040000_engagement_plans`
- `20281016010000_client_objective_workload_delegations`
- `20281017010000_client_objective_strategy_intake`
- `20281018010000_clio_meri_approval_decisions`
- `20281018020000_clio_meri_memory_submissions`
- `20281018030000_clio_meri_routine_authority`
- `20281018040000_clio_meri_execution_authority`
- `20281018050000_clio_meri_routine_unattended`
- `20281018060000_meri_read_delegation`
- `20281018080000_clio_memory_scope_unique`
- `20281018090000_clio_meri_memory_submissions_content_free`

The held `20281018100000_meri_memory_eligibility_helper` is absent. [E] Stage 1 (`090000`) is payload-preserving, and its archive hash `f9d2f4a1…` was checked. Inclusion in source authorizes no migration. A role/target preflight is required. Stage 2 is held. [U] Whether the preview Core database already contains any of the 11 was not read. Owner: dot (Core).

Frontend: no database migrations.

### S5. Dependency order for a coordinated release and rollback

This is a proposed order derived from the dependencies above. It is not a schedule or an authorization. Each step requires its own reviewed packet from the shipper.

1. **First-chat candidate (Meri only).** Combine `2b4421f6`, B (`32d06db2` or its successor) and the C startup correction. Then: one image, a measured runtime-values file, and a render with no `features` (unchanged scope). Core rev 2 and frontend rev 18 stay as they are. D3 acceptance runs on this cohort. Nothing in steps 2–6 is a prerequisite.
2. **Core security-clean candidate.** Resolve the 7 HIGH findings, through PR100's Alpine alternative or a successor, on the `50475125` line. Before any rev 3 activation, run the preflight and approval for the 11 Prisma migrations, then set the rev 3 environment (`MEMORY_GOVERNANCE_*` for the preview tenant only, `MERI_EXECUTION_MAX_*`, the internal service secret reference).
3. **Frontend held candidate.** Release `e6180219` only together with a deployed Core that satisfies its roster pin. Before release, refresh its stale Meri runtime labels so they match the S1 Meri pins.
4. **Meri migration readback, then integration stage.** dot reads `meri_migration_ledger.applied`. If the `integration` stage is not applied, take the D016 #1 snapshot, apply the stage, and read the ledger back. Plan entries for 0018/0019 come first if memory continuation is in the same release.
5. **Meri capability receipt.** Receive PR189 and PR190 onto the step 1 line (three-way check `cli.mjs` and `control.mjs`). Then receive PR191/192 after the contract version/vendor decision. Re-measure the governed SDK profile in-image, then render `features` family by family. Revision 2 §11 integration order: one read/evidence flow, then memory, then one approval-controlled write, then one generated/downloaded artifact.
6. **Frontend capability UI.** PR102 and the document/memory UI flags, released after the Meri families they call are enabled.

**Rollback targets.**

- **Meri.** The previous task definitions (release D and earlier) are **INACTIVE**.
  - [E] Earlier preview rollouts (Fable operational notes, outside this repository) recorded that the issuer admits only pinned revisions and that a rollback consumes the pinned revisions. Rolling back therefore means re-rendering and re-registering with the prior image digest and material labels. It is not a service-revision flip.
  - The last deployed state before E is release D (`5b395d4c`, `ea0e9ad4…`). It also never completed a chat, so rolling back restores a known non-working chat state.
  - Database rollback for applied conversation migrations is not supported in place; see `D2-DATABASE.md`. The `integration` stage has a logical drop-schema rollback (D016 #1).
- **Core.** Task definition rev 1 (`6542f5b0`) is still ACTIVE. Rev 2 is the current target. Rolling back across the 11 Prisma migrations requires their own down-path review. [U] None was found.
- **Frontend.** Rev 17 is INACTIVE. The rev 18 image digest remains in ECR.

### S6. Not verified here

- The Meri migration ledger rows and the Core migration table (no database access).
- Image scan results other than the recorded ones (`DescribeImages` returned no scan summary for these digests).
- Whether dot's live view has moved since 04:10Z. The shipper must refresh S1 before acting.

---

## 18 October 2026 manifest (historical, unchanged)

Status: **source candidate, held for successor review and release qualification**. This
manifest records immutable repository commits and their dependencies. It is not an
image, migration, deployment, or production activation instruction. The separate
[deployment packet](DEPLOYMENT-PACKET-20261018.md) remains a draft with older
Meri/Core/frontend source placeholders and must be re-pinned after the final source
freeze. No capability is silently removed to make this candidate appear ready.

## Implementation outline and ownership

The Meri manifest branch starts at the accepted [PR179](https://github.com/neo-capiro/meri-greenfield/pull/179)
source head and fast-forwards to the first published [PR180](https://github.com/neo-capiro/meri-greenfield/pull/180)
audit successor. Those two commits are parent and child, so no patch replay or shared
file conflict is involved. A later PR180 fence commit was examined but is held
for its owner's repair of a reproducible pool starvation path. This branch adds
only this manifest after the safe receipt.
The Meri receiving branch, PR175 first-chat branch, frontend PR97/PR98 branches,
and Core PR96 branch retain their own owners; this document does not move code
between repositories or change their feature, schema, image, or render inputs.

The following pins were read from published commits on 18 October 2026.
"Received on this manifest branch" applies only to Meri code in this branch;
PR185's distinct source receipt is scoped to its own branch. Frontend and Core
are separate repositories and remain referenced source candidates.

| Repository and scope | Immutable source pin | Relationship and disposition |
| --- | --- | --- |
| `neo-capiro/meri-greenfield` [PR179](https://github.com/neo-capiro/meri-greenfield/pull/179), integrated A8, Florida, first chat, memory, and seven audit repairs | `141f2ada6378382f2bf7462d8a2c5dc7758230d0` | Accepted Meri receiving base, descended from `main` `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`. |
| `neo-capiro/meri-greenfield` [PR180](https://github.com/neo-capiro/meri-greenfield/pull/180), first audit follow-up | `7e4e75828abcd870137ea8f72ff5fbea08fa25a6` | Parent is exact PR179 pin above; received by fast-forward on this manifest branch. Closes the awaited history-membership and rapid-successor gaps. |
| `neo-capiro/meri-greenfield` [PR180](https://github.com/neo-capiro/meri-greenfield/pull/180), later retention fence/evidence candidate | `a1876afaeaa59d9da47729487d490cba8cfc9d9c` | **Not received** here. The source fence is direct child `1aa5c66e9283024e78ad6f26f5450cbc61a37659`; this head adds evidence/docs only. A finite PostgreSQL pool can starve while the fence holds a lease and a nested retention read requests another. |
| `neo-capiro/meri-greenfield` [PR181](https://github.com/neo-capiro/meri-greenfield/pull/181), held-lease retention follow-up | `a50ce248337f3ce1ab7103e045bb8ab826ca92dc` | Draft direct child of PR180 `a1876afa`; **not received** here. Focused finite-pool source repair is published for review. Real PostgreSQL qualification and the separate consistent Core authorization decision remain open. |
| `neo-capiro/meri-greenfield` [PR182](https://github.com/neo-capiro/meri-greenfield/pull/182), control private-origin CA trust | `58b13b1644726bb307ea3e58461c7c0a970215f9` | Draft direct child of frozen PR175 `993f52a9`; independent source review GO. Cherry-picked into PR185 as `8753a2fb`; **not received on this manifest branch**. Live trust behavior and image qualification remain open. |
| `neo-capiro/meri-greenfield` [PR183](https://github.com/neo-capiro/meri-greenfield/pull/183), native usage stream counts | `b51687d4dadbb8cbf8ee817490e5f95c01e60d54` | Draft successor based on PR180 `a1876afa` through its first commit `97906eb5`; **not received** here. Optional terminal metrics correction and offline regression source candidate, pending review. Exact live Sonnet 4.6 stream/cache behavior and image qualification remain open. |
| `neo-capiro/meri-greenfield` [PR184](https://github.com/neo-capiro/meri-greenfield/pull/184), first-chat SDK model alias | `6be3e4abccebb5da56092572ccb0feddaf514d0e` | Draft direct child of PR180 `a1876afa`; **not received** here. Standalone renderer/runtime measurement source candidate, also cherry-picked into PR185 as `2bc282d8`. The checked-in image receipt is stale; no image qualification is implied. |
| `neo-capiro/meri-greenfield` [PR185](https://github.com/neo-capiro/meri-greenfield/pull/185), combined control CA and model alias source | `67a7bfbc7df47f326e4287de8df7f0f59b110b8c` | Draft based on PR180 `a1876afa`; source received **only on PR185's separate branch**. Exact PR182 and PR184 patches are cherry-picked as `8753a2fb` and `2bc282d8`; `85e71366` and this docs-only child record the receipt and its diagnostic scope. **Not received on this manifest branch or the final Meri receiving tree**; review and qualification remain open. |
| `neo-capiro/meri-greenfield` document-executor image lane, [PR121 handoff](https://github.com/neo-capiro/meri-greenfield/pull/121) | `d2f054362521f622b9dd63c65ef5eaa3bdde8d5a` | Separate successor to lane I `94b692648c47fd509e62a621cc5b612e0d356ed3`; **not received** in PR179/PR180 or this manifest branch. The final Meri source must receive its owned image/package/wheel closure before image qualification. |
| `neo-capiro/capiro-frontend` [PR97](https://github.com/neo-capiro/capiro-frontend/pull/97), receiving Meri, Modules/Settings, Portfolio, and Portfolio Core source | `d9959a9cee267365d1f13a72351802a66c6dbfe2` | Open receiving candidate against frontend `main` `02c02d95bdf3949662b9123f425271c6491ffdab`. This head is a documentation-only child of the reviewed code pin `a0a542d5eff162bef572564ff0397e460d74ed77`; not a Meri-tree merge. |
| `neo-capiro/capiro-frontend` [PR98](https://github.com/neo-capiro/capiro-frontend/pull/98), session renewal and cross-run composer guard | `5c784e3e46114816ba57db17ad7a2c2013a8d81a` | Reviewed frontend source candidate, **not received** by PR97. Its first commit starts at exact PR97 code pin `a0a542d5eff162bef572564ff0397e460d74ed77`; the cross-run guard is in its second code commit `d626bb080d7774ba5fc8167661d21893d9f1e3c8`, and this head adds docs/evidence. The branches diverge only by PR97's later documentation commit. Frontend owner receipt and release qualification remain pending. |
| `neo-capiro/capiro-backend` [PR96](https://github.com/neo-capiro/capiro-backend/pull/96), Core plus Directory receiving source | `784b1c3a91eb6d78f16d92c42e71f05c12c5b5bb` (tree `93b41a8cb736a8276fcb32182c1e07e601e4b417`) | Open draft against that repository's default `backend-import` `c76f5fc0df6688743afeec274211afd2e67fe8f1`; source only. |

The frontend PR97 lineage includes Meri desktop [PR92](https://github.com/neo-capiro/capiro-frontend/pull/92)
`271a267da93aa952a89b208d1f42eed0ffb080c2`, Modules/Settings
[PR94](https://github.com/neo-capiro/capiro-frontend/pull/94)
`e1de3f1d41f508629a79c198a21b71103e17c245`, Portfolio desktop
[PR95](https://github.com/neo-capiro/capiro-frontend/pull/95)
`88088d9ca86dc9c2f8ea9b2e42507348ca7652b1`, and Portfolio Core
[PR96](https://github.com/neo-capiro/capiro-frontend/pull/96)
`45528667db95f805660d2ded5f7a20b5c91c909b`. These four commits are
ancestors of PR97, not additional cherry-picks. The frontend PR96 and backend
PR96 numbers name different repositories.

The published frontend PR97 and PR98 heads were checked again before this
manifest update. PR97's sole new commit after `a0a542d5` changes only
`docs/coordination/reports/CODEX-THREE-REPO-SOURCE-PIN-AND-NON-MERI-PREVIEW-20261018.md`.
The comparison from current PR97 head to PR98 reports one commit behind and
three ahead, with `a0a542d5` as their common parent. The independent frontend
review returned GO for PR98's source candidate with 35 extracted-source
assertions. This records a reviewed source pin; the PR97 receiving owner still
has to incorporate and verify the PR98 commits while retaining its newer
documentation before the frontend source can be frozen.

Core PR96 includes the guarded Core and Directory lineage documented in its
[source candidate](https://github.com/neo-capiro/capiro-backend/blob/784b1c3a91eb6d78f16d92c42e71f05c12c5b5bb/docs/integration/CORE-INTEGRATED-SOURCE-CANDIDATE-20261018.md).
It carries the accepted Core PR84–95 work in that receiving DAG; its Stage 1
`090000` migration is payload preserving, while `100000` remains held. Its
[deployment source packet](https://github.com/neo-capiro/capiro-backend/blob/784b1c3a91eb6d78f16d92c42e71f05c12c5b5bb/docs/integration/CORE-DEPLOYMENT-SOURCE-PACKET-20261018.md)
is not a qualified image or live route readback.

Meri first-chat [PR175](https://github.com/neo-capiro/meri-greenfield/pull/175)
remains the frozen first-chat shipping source at
`993f52a97e5d9edcf65c9f89423c097aa52831c7`. Its accepted changes are
also represented in the later PR179 ancestry, as recorded by the
[receiving report](MAIN-RECEIVING-SOURCE-20261018.md). This manifest branch
does not alter PR175 or imply that its earlier image ships the later source.

## Receipt evidence and remaining source work

The received PR180 commit changes 19 Meri paths: seven production `.mjs` files,
related tests and fixtures, two generated metadata files, and its
[audit report](AUDIT-REPAIR-REVIEW-20261018.md). The received source diff contains no
Dockerfile, dependency lock, feature selection, allocation, migration, render,
or deployment edits. Its generated metadata changes source fingerprints and
byte counts, without a wire-version change. The owner reports **585/585 focused
backend tests** passing. The Meri receiving report records **374/374 focused
post-audit tests** for its earlier seven fixes. These are local source/fixture
results, not release qualification.

The later PR180 fence commit changes another 14 paths. Its three directly
affected test files passed **85/85** locally (retention release fence and product
effect/release 30, history HTTP 55), but the tests do not model a finite pool.
Using a disposable one-connection scripted PostgreSQL pool, `withRelease` held
the only lease while its callback's `assertServable` requested a second. The
request timed out as `RETENTION_READ_UNAVAILABLE` after 81 ms, with two checkout
attempts and one queued. Production composes the journal and watermark against
the same pool; at pool size N, N concurrent pages can reproduce this wait.
The relevant path is `postgres-journal.mjs` `withServing` → history release →
retention gate → watermarked read → `postgres-watermark.mjs` → `journal.tx`.
This is source-only synthetic evidence of a release blocker, not a live outage.
PR180's later evidence commit documents its own source tests and inherited
baseline; it does not change the nested lease behavior. Draft PR181 publishes a
held-lease repair and reports **112/112 focused source checks**. Review remains
before receipt; real PostgreSQL qualification remains before release acceptance.

The separate native source candidates branch from exact PR180 `a1876afa` and
have not been combined with PR181 or this manifest's Meri code. PR183 reports
**62/62 focused credential-free Python checks** of terminal usage, response
settlement, host observation/composition, and callback behavior. Its parser
requires a bound `message_start` input count, final cumulative `message_delta`
output count, terminal stop, and complete stream EOF. Bedrock stop invocation
metrics are optional; if present, their input/output/latency shape is checked
against the bound counts. Malformed, conflicting, or unexpected raw stop usage
remains `UNKNOWN`. Optional cache counts can only be zero; exact live Sonnet 4.6
stream and cache billing behavior remain unqualified. The full upstream LiteLLM
streaming test did not run because its local environment lacked FastAPI; no
provider stream was observed. PR184 reports **8/8 runtime-values tests**,
**1/1 pinned-SDK/CLI local HTTPS stand-in flow**, and **8/8 native-auth tests**.
The stand-in used a
synthetic token and no provider call. Its runtime test used a synthetic image
digest; the existing N21 receipt remains stale. The SDK-facing alias is aligned
with the fixed native/proxy allowlist while the provider profile and pricing
stay pinned. Both drafts require review
and ancestry/overlap checks before receipt. Neither qualifies an image,
provider behavior, live auth, or first-chat activation.

PR182 is an independent source-GO control trust candidate based on frozen PR175;
its parent repairs were already replayed into the PR180 receiving line. PR185
starts at exact PR180 `a1876afa` and receives the PR182 and PR184 patches on a
separate branch. Both cherry-picks have the same stable patch IDs as their
respective source commits. Their shared `render-material.mjs` changes composed
without a manual conflict: the control task binds the composite CA bundle,
while first-chat SDK options select the fixed authorized model alias. The
Bedrock profile, provider mapping, pricing, native allowlist, and other feature
rendering remain pinned. This is a branch-local source receipt, not receipt by
this manifest branch or the final Meri receiving tree.

PR185 reports focused Linux evidence: new CA tests **13/13**; integrated render
and Stage 3 bindings **13/13**; runtime values and the pinned SDK local HTTPS
stand-in **9/9**; native authorization **8/8**. Host task/material checks were
**40/41** because an unchanged deadline fixture could not write this host's
`/run`. Disposable offline Linux/amd64 Node containers with writable task-like
mounts ran exact PR182 source, whose CA files match PR185's cherry-pick. These
diagnostics did not exercise the whole combined branch. The deadline fixture
passed **1/1**, and synthetic control init wrote **15 files** with owner-only
modes. The fresh-process startup readback/fetch probe stopped in the diagnostic
DNS fixture before product code, so that result is unverified. No
product Dockerfile image was built or qualified; the N21 measurement is stale,
and physical material VersionIds, live trust, first-chat activation and
deployment remain held.

The following owners must publish and review successors before a release freeze:

| Owner | Pending source or evidence |
| --- | --- |
| Meri retention/history | Review PR181's held-lease successor against PR180, including finite-pool behavior, shared/exclusive transition ordering, and real PostgreSQL lock/session behavior. The separate Core membership/currentness race still needs a consistent authorization decision before release. |
| Meri native usage and first-chat trust/model | Review PR183's standalone usage correction and PR185's branch-local CA/model source receipt while preserving PR184's standalone pin, settlement, provider and budget authorization. Remeasure source-bound image/runtime inputs after source freeze; no current receipt qualifies these drafts. |
| Frontend | Receive the independently reviewed PR98 session renewal and cross-run guard into PR97, retaining PR97's later documentation and exact request identity. PR98's owner reports 14/14 browser, 69/69 unit, TypeScript, and 283/283-page build checks; authenticated release qualification remains separate. |
| Backend audit | PR180's held evidence commit inventories the standard `npm run check` baseline (**4,357 passed, 32 failed**) and runtime/control typecheck diagnostics (**3/18**) against PR179. Resolve or explicitly disposition those red release gates without weakening assertions. |
| Core and frontend product owners | Qualify authenticated Portfolio Core behavior and complete the Modules aggregate metrics and remaining Settings contracts/design decisions. PR97 and Core PR96 are source candidates; production behavior is not inferred from ancestry. |

The separate Meri image lane retains a `linux/amd64` Wolfi/Python/wheel lock,
matching the observed ECS `X86_64` task target. The receiving tree still has
the older package lock (SHA-256 `5c7724e6c9837dabc3146256aa55b3dce2230d10de5a2ff7c479f519aafb3ac9`)
and no `runtime-wheels.lock.json` or checked-in wheel files. The lane's package
lock is SHA-256 `5dc3b335d8dc7f0377c75852c28addc1a2517bb4bcc05e2125d0e1e31a97bdea`.
Its native diagnostic image and focused generation checks therefore do not
qualify an image from this later Meri source. The frozen 15 October image-closure
candidate has stale hashes and must be regenerated from the final source. The
image owner must receive the exact lane-owned dependency closure and verify its
provenance without an ARM64 switch or accidental re-pin.

## Source receipt and release gates

1. Receive only published, reviewed successor commits on their repository's
   receiving branch after checking exact parent/ancestry, changed paths, and
   retained behavior. Update this manifest to their new full commit IDs. Do not
   replay PR98 in Meri or PR180 in frontend/Core.
2. Keep source findings separate from release evidence. PR180's received report
   records the broader 32 failing checks and 3/18 type diagnostics; the frontend and Core
   source reports identify their own open qualification. Resolve or explicitly
   disposition these before calling any integrated test gate green.
3. Receive the separate Meri image lane's owned Dockerfile, package lock,
   wheel lock/artifacts, and architecture verifier with their exact hashes;
   preserve the current owners of CLI, control, config, and render. Freeze exact
   Meri, frontend, and Core commits together. Rebuild and measure the Meri image
   from that final Meri commit for actual `linux/amd64`, then
   record immutable image digests, scan, source-bound config/render, and
   authenticated readbacks. Core and frontend require their own exact image
   and deployment evidence. Update the draft deployment packet's older `TBD`,
   Core #86, and frontend #92 references at that time.
4. Keep migrations, retained operations, memory, document reads, Portfolio
   dependencies, and production traffic behind their existing activation
   gates. The Core Stage 1 migration needs role/target preflight; held Stage 2
   is not authorized by this manifest. The Meri image, generated closure,
   configuration and active selection remain unqualified.

There has been no main merge, AWS build or deploy, live SQL, IAM change, secret
change, or traffic activation as part of this source receipt.
