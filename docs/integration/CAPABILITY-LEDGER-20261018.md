# Canonical capability ledger — Meri (meri-greenfield)

Section R2 (20 October 2026) is the canonical seven-column capability ledger required by adjustment plan Revision 2 §11. The 18 October per-operation coverage ledger (§0–§5) follows unchanged as its detail.

## R2. Canonical capability ledger (Revision 2 §11)

**This file is the one canonical capability ledger.** Adjustment plan Revision 2 §11 requires a single ledger with seven distinct columns. Section R2 adds that view above the existing per-operation Tables A, B and C, which stay below unchanged as its detail.

Other documents keep their own jobs and are not separate capability registries:
- `RUNTIME-INTEGRATION-LEDGER.md` §5 records startup wiring and gates.
- `SOURCE-RELEASE-MANIFEST-20261018.md` records repository pins, migrations and release order.
- `docs/shipping/20261017/BACKLOG.md` is the 17 October lane backlog.
- `docs/coordination/ledgers/*` is the 15 October scope ledger.

All four now point here for capability status. The file was not moved, so existing links keep working.

Prepared by Fable session adj-g-ledger on 2026-10-20, from deployed source `2b4421f6`. Pins are read back in [the manifest successor](SOURCE-RELEASE-MANIFEST-20261018.md).

### R2.0 Column definitions

| Column | Meaning |
| --- | --- |
| **Implemented** | Source exists at a named commit or branch. |
| **Integrated** | Reachable from the real startup composition, `apps/runtime/cli.mjs` and the render `features` block, on the **deployed line** `2b4421f6`. A capability that is integrated only on an open PR says so and names the PR. |
| **Enabled** | Switched on in what is **deployed now**. The deployed Meri render has **no `features` key**, so every optional family is off and `sourceEnabled=false`. The policy is 3 turns, $2 per run, with the allocation rubric `first-chat-no-tools`. |
| **Runtime-verified** | A live record on the deployed system proves the capability worked for a real authenticated user. **No successful live Meri chat exists.** The last attempt, runner `283f12c5…` on `2b4421f6`, failed at `native-start` with `UNKNOWN`. So no row below can be runtime-verified, and none is. |

Owner names follow `AGENTS.md`:
- **Fable** owns the Meri runtime, tools, documents, memory, settings and routines, plus Meri-specific UI.
- **dot** owns Core, Portfolio, non-Meri Modules/Settings, shared frontend, and deployment coordination.

Decision O1 makes **dot the sole AWS operator and shipper** for this plan. "Owner" below means the source owner. Every enablement ships through dot.

### R2.1 Approved-scope ledger

| Capability (plan §11) | Implemented | Integrated (deployed line `2b4421f6`) | Enabled now | Runtime-verified | Owner | Evidence | Remaining work |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Retrieval, evidence/citations, tool discovery/selection, client context** | Yes. Typed catalog 0.2.16 with 97 descriptors. Installable source inventory **76 ops / 42 families** at `2b4421f6`; PR189 raises it to **81 / 45**. Evidence envelopes. `get_client_context@0.3.0`. Native discovery. 14 plugin skills (`packages/skills/plugin.mjs`). | **Partly.** Native read families compose through `native-authority/reads-composer.mjs`. Discovery is gated by `features.reads.discovery` plus `capabilityPlatform`. G1 `sourceEnabled` threading is done (`4bb54ca5`). G3 single-pin blockers 1–4 are fixed (`77cad80d`, `176a8811`). PR189's additional composition is **not** on the deployed line. | **No.** No `reads`, `capabilityPlatform` or `sourceEnabled` render keys. The first-chat SDK runs with no tools mounted. | **No** | Fable (Meri). Core read producers: dot. | Table A below; `generalReadInstallation` SHA-256 `8850af4b…` (76/42); PR189 recorded 2,511/2,511 local tests over 93 files plus a 290/290 auth-correction run (`docs/integration/read-tools-evidence-20261019/summary.json` on `e82d199f`). | Prove first chat. Receive PR189 onto the deployed line. Run the in-image re-measure, then render `reads` + `discovery` + `capabilityPlatform`. Qualify discovery through the actual SDK → proxy → Bedrock path, including after compaction/resume and after revocation (RG-08, plan §11). Prove claim-to-source citation mapping on real records (RG-03/05/12). The 75-request benchmark (R2.3) still applies. |
| **Read tools** | Yes. 55 native read names, 10 retained operations in 8 families, and PR189's retained families (research portfolio, portfolio changes/evidence, Florida, Monday, `query_tasks`, `search_research_sources`, BD evidence). Option A credential relay (`e320c37f`, `f5b26559`). Option B is approved for source by D016-A and composed disabled. | **Partly.** Integrated (held) per Table A: **68** names. 23 are source-only and **5** are contract-only (`read_chat_attachments`, `search_research_sources` before PR189, `get_certification_status`, `get_state_rule_status`, `search_sam_opportunities`). PR189 is not on the deployed line. | **No** (same render). | **No** | Fable. Core read routes and the delegated-read allowlist: dot. | Table A; `PR171-RECEIPT-20261018.md`; PR189 docs `MERI-READ-GAPS-20261019.md` and `MERI-READ-SECURITY-REVIEW-20261019.md`. | Receive PR189 (three-way check of `cli.mjs` with PR190). Core: add `search_research_sources` and BD evidence to the delegated-read allowlist. Research/Florida: real issuer, key and recipient pins. Mail stays held for trusted mailbox scope and a continuation owner. The 4 still-blocked operations need producer clocks/locale. Core rev 3 receivers (Core `50475125`) are not deployed. |
| **Separately governed business writes** | Yes. `meri_intents` decision, journal, rev3 13-field codec, issuance client, ACTIVE execution-grant installer, result release (`36ddfef8`, `11b90c7f`, `442650ae`). PR190 adds artifact/memory/filing preparation. PR191 adds the list/decide contract. | **Partly.** `create_task` / `update_task` are mounted as governed intents (`intents/catalog.mjs`), **but** `apps/control/intents/approval.mjs:29` `APPROVABLE_ACTIONS` is `['task.create']` only. Table A row 82 therefore overstates `update_task`. | **No.** No `features.intents`. Core rev 3 issuance/decision routes are not deployed. The integration-stage tables are not evidenced as applied. | **No** | Fable (Meri intents). Core receivers, approval record/decision/revoke, and the KMS signer: dot. | `RUNTIME-INTEGRATION-LEDGER.md` §5 write-intents row; PR190 recorded 1,067/1,069 local (2 opt-in skips); PR191 recorded 82/82 contract tests. | Core security-clean rev 3 image (Core `50475125` has 7 HIGH findings) and its 11 Prisma migrations. Apply the Meri `integration` stage (intents, commands, approval-metadata). KMS Ed25519 execution key (D016 #9; [U] whether it was created). Turn on `features.intents.execution` together with Core rev 3 (no bearer fallback). Widen `APPROVABLE_ACTIONS` beyond `task.create` only with matching Core execution payloads. Duplicate-delivery and worker-death zero-duplicate proof. One approval-controlled write end to end (plan §11 order). |
| **Institutional memory: proposal and approval lifecycle** | Yes. `product-ports/memory.mjs` proposals plus the proposer review surface over Core M2 (`/api/memory/proposals/*`, `/api/memory/review/*`) (`74e53f3a`, `e7dacfc7`). `save_memory` → `memory.propose` always produces a **pending proposal** (PR190). Continuation journal `0019`. Frontend owner review is `MemorySettings.tsx` (main). | **Partly.** The memory family is config-gated in startup composition. PR190's conversational `memory.propose` is not on the deployed line. Discovery and execution are held: `memory.propose` is in neither `APPROVABLE_ACTIONS` (`apps/control/intents/approval.mjs:29`) nor `EXECUTION_COMMAND_ACTIONS` (`apps/runtime/native-authority/execution-capability.mjs:34`); both are `task.create` only. | **No.** No `features.memory`. Frontend `MERI_MEMORY_OWNER_REVIEW_ENABLED` is unset at rev 18, and the flag does not exist at `67fdf56b`. Core `MEMORY_GOVERNANCE_*` is not set on rev 2. | **No** | Fable (Meri memory and Meri UI). Core M2 routes: dot. | `RUNTIME-INTEGRATION-LEDGER.md` §5 memory row; D016 #6; PR190 memory lane 19/19; `MERI-RETENTION-FACTS-OWNER-MAP-20261018.md` (0019 checked only in a disposable PostgreSQL). | Add conversations `0018` and `0019` to the migrate `PLAN` (absent at `2b4421f6`), then grants review. Apply `meri_memory` 0001 (integration stage). Core rev 3 with `MEMORY_GOVERNANCE_LIFECYCLE=enforce` for the preview tenant only. Memory audit PR121 `6249424994` remains open. Prove one proposal → owner review → decision on live. Canonical confirm/correct/forget stay **deferred** (Table B 32–34). |
| **Files and editable documents, spreadsheets, presentations; preview, download, filing, versioning** | Yes. Artifact store with immutable versions (`apps/artifacts/migrations/0001_versions.sql`), retention (0002), previews (0003). DOCX/XLSX generation through `request_document`. PPTX (`apps/artifacts/presentation.mjs`, pptxgenjs) and typed-ZIP `run_analysis` (PR190). Attachment filing codec and custody preparation (PR190). Document-access inspect/download contract for docx/txt/xlsx/pptx/pdf/zip (PR192). Frontend `features/meri/files/*` (version panel, download URL). | **Partly.** `create_word` and `create_excel` are mounted (`format-admission.mjs:12` admits word/excel only). The executor dependencies are now in the image: Python 3.13 and pptxgenjs in `apps/runtime/Dockerfile` at `2b4421f6`, which closes the earlier "control image lacks Python/pptxgenjs" blocker. PPTX, analysis and filing are on PR190 only. Preview has **no contract**. | **No.** No `features.artifacts` or `downloadLinks`. Frontend `MERI_DOCUMENT_WORKFLOW_ENABLED=false`, and `MERI_DOCUMENT_OPERATION` admits only `create_word`/`create_excel`. | **No** | Fable (Meri artifacts and Meri files UI). Core artifact receiver and exact-version attachment registration: dot. | `RUNTIME-INTEGRATION-LEDGER.md` §5 documents row; PR190 artifact lanes 96/96 and 79/79, attachments 63/63, LibreOffice PDF tests skipped (`MERI_ARTIFACT_SOFFICE` unset); PR192 151/151 contract tests. | Bucket, KMS key and control-role S3/KMS access (D016 #10; [U] whether created). Artifacts 0001–0003 (integration stage). Core receiver `POST /api/clio/application-authority/artifact`. Receive PR190 and re-measure the governed profile. A qualified renderer before any preview contract (PR192 gap 3). Filing approval execution and Core `registerApprovedArtifactVersion` (proposed; possible Core migration **unallocated**). Native-file benchmark (open, formulas, rubric) not run. One generated → downloaded artifact on live (plan §11 order). |
| **Browser work on the approved isolated browser host** | Source only. Lane 8 browser and Bash (`apps/worker/conversation/browser/**`, egress proxy in the qualification CLI). | **No.** `browser/activation.mjs:28` `BROWSER_ACTIVATION` is `held` with `BROWSER_EGRESS_UNQUALIFIED`. | **No** | **No** | Fable. Host infrastructure goes through the shipper. | `RUNTIME-INTEGRATION-LEDGER.md` §5 browser row; D005; D015 #8 (Bash on the same host); `PLAN-RECONCILIATION-20261018.md` M8 ("no lane assigned"). Frontend `screens/browser/*` is fixture-only. | Build the approved dedicated isolated host and egress proxy. Prove network controls and a real non-root browser plus renderer sandbox (AGENTS.md). Image packages. Networked-Bash approvals. A live UI. **No owner lane is assigned.** Authenticated sites are **deferred** (lane 9). |
| **Subagents, longer research, planner/objectives, background execution** | Yes. G2 profile has `subagents:true` (4 types, max 4) with progress, audit and compaction hooks (`product-ports/capability-policy.mjs:42`). Objective/Planner worker activities, run-start (`objective-source/0002`), JTI replay store (`a208af5a`, `c0ed14a1`). Temporal conversation workflows (`apps/control/conversations/workflow.ts`). Routines attended plus unattended authority (`3a04031e`, `b34d9359`). | **Partly.** Temporal conversation workflows are integrated and running. Objective is **composed disabled** (D016-A #8). Subagents need `capabilityPlatform`. The separate schedule-worker service is not built (lane B3). | **No.** No `capabilityPlatform`, `routines` or Objective activation. `maxTurns 3` (the D016 default of 20 turns / 20 tool calls is not rendered). | **No.** Temporal services are healthy, but no run completed. | Fable (Meri runtime, routines, Objective adapters). Core planner loop (D7-1), D7-2 keys/signer and D7-3: dot. | `RUNTIME-INTEGRATION-LEDGER.md` §5 Objective and routines rows; D016 and D016-A #3, #5, #8. | Render `capabilityPlatform` with the measured profile. Raise the per-run allocation to the D016-A default. Schedule worker as its own service, with Core wire C unattended grant and consent fence lift (unattended firing **in scope** per D016-A #5). Objective activation after Core D7-2/D7-3 and the remaining phases; its three KMS keys are in the packet. Replacement-worker, workspace-snapshot and subagent/compaction restoration are a **later recovery gate** (plan §9). |
| **Approvals, schedules, recovery, budgets, retention, audit** | Yes. Approval forwarder, continuation authority and `approval.wait` (lanes L/L2). Schedules 0001–0004 and routines application. Fencing, allocation journal, retention fence (PR193), stdout EOF (`2b4421f6`), first-failure diagnostics. Canonical product and tenant budgets with model grants. Retention inventory and planner (PR176/177). Audit hooks in the G2 profile. Approval metadata (`meri_commands.approval_metadata`). | **Partly.** Budgets, model grants, fencing, retention fence and recovery diagnostics are on the deployed line. Resume/fork had two lane L2 end-to-end defects recorded on 18 October (fork refused by the transition context adapter; resume target not registry-servable). [U] Whether they are fixed at `2b4421f6` was not re-verified here. Schedules and approvals need integration-stage tables and Core rev 3. | **Partly.** Budget reservation and model grants are active (budget 0001–0002 applied; $2 per run). Everything else is off: no `retention`, `routines` or `intents`. | **No.** Admission-level behaviour was observed on the older N17 cohort (sign-in → client → conversation → admission, §8 steps 1–4). On `2b4421f6`, settlement and provider contact are **unproven** after a failure (`BROKER_KICKOFF_CLEANUP_UNKNOWN`, `NATIVE_UNAVAILABLE`). | Fable (Meri). Core approval/decision/revoke routes: dot. | `D2-DATABASE.md` (applied budget/issuer migrations); START-HERE §3 (failed-attempt record); PR193 recorded 245/245 local. | Reconcile the uncertain E-attempt allocation before any replay (plan §4, §9). Confirm or fix the lane L2 resume/fork defects. Core `approval/revoke` (lane RD). Apply the integration stage, then render `retention` and `routines`. K1 kickoff cancellation signal. Crash/lost-acknowledgement boundary tests at the recovery gate. An unresolved reservation stays visibly unresolved, never assumed to be zero spend. |
| **Unified Meri/Portfolio/Modules UI against the Capiro 3.4 Figma files** | Yes. Frontend main `5cd5f20d` carries the 3.4 desktop work for Portfolio, Modules/Settings and Meri (PR97, PR101, PR104–PR110). The live Meri conversation host covers stream, history and stop (`MeriConversationHost.tsx` → `MeriLiveConversation.tsx`; stop in `run-commands.ts:87`). | **Partly.** The approvals, memory proposal, routines, browser and run-history screens are **fixture-only** (imported only from `features/meri/fixtures`). The intents approvals UI is PR102 only. Main is **not deployed**: serving is `67fdf56b`, and main has 50 more commits. | **Partly.** The conversation workflow is enabled at rev 18. Documents, actions, task commands, preferences and memory review are off. | **No.** Rev 17/N17 had sign-in, Portfolio entry, client selection and new conversation; the first prompt has never succeeded. | dot (shared shell, Portfolio, Modules/Settings). Fable (Meri-specific UI per AGENTS.md; PR190's handoff names dot for the decision UI in `ConversationTurn.tsx`, an ownership point for the coordinator to settle). | 3.4 files (START-HERE §7): Meri `IXJzJUkXcUTkySHir5JNea` (node `3089-40132` per `docs/figma-34-gaps-20261016/README.md`); Portfolio `mpXWnySldUFzdVna8i69Ki` (directory `3069-54192`); Modules/Settings `zGvvF6V6hh7yweoplCdpdE` (directory `3060-110154`; node list in `docs/modules-settings/FIGMA-3.4-DESKTOP-AUDIT-20261018.md`). PR101 recorded build 283 pages and 2,952 web tests; PR97 recorded pixel parity unverified and Figma PanelLeft assets returning 403. | Deploy a main-based build, held behind Core (PR111). Wire the fixture-only screens only as their Meri families are enabled. Align pending, error and recovery states with the Meri 3.4 file. Several docs still cite the historical **3.0** file `Zc2dEN5aLU47dVdsewDmiJ` (`apps/web/PORTFOLIO.md:91`, `docs/modules-settings/HANDOVER.md:72`, `IMPLEMENTATION.md:7`, `docs/portfolio-31/*`); they must not be used as implementation authority. Browser parity and 11 walkthroughs not run. **Mobile deferred.** |

### R2.2 Named deferrals

These are recorded owner decisions, not cuts made by this ledger. None of them may be enabled quietly.

- **Table B: 43 excluded operations** (list in §2 below). Examples: Research Portfolio management and analytics; LegiWatch writes; `send_email` and `reply_email`; `create_client` and `update_client_profile`; canonical `confirm_memory`, `correct_memory` and `forget_memory`; opportunity and BD briefs. Each is absent from the catalog surface and guarded by `legacy-tools-excluded.test.mjs`.
- **Lane 9 / D015 N1–N7** (10-15 Q-X0, "ship a live version first"): takeover, bridge, WOPI/Office in-place editor, authenticated sites.
- **M9, the four advanced features** (remaining-plan milestone 3).
- **Mobile** (remaining plan §1).
- **Optional Decisions router and JEV** (R-11, RG-10/11): disabled experiments, not selected for release.
- **Not deferred, only pending** (stated so they are not mistaken for cuts):
  - document preview, until a renderer is qualified;
  - unattended routine firing and read option B, both approved for source by D016-A;
  - Objective activation, composed disabled until Core phases land.

### R2.3 Benchmark of 75 approved real requests: required inputs and owners

Revision 2 §11 and R2 plan REL-01/REL-06 apply. Synthetic fixtures (`evals/retrieval-r2`, `evals/promptfoo` and others) **cannot substitute** for this benchmark. A missing input blocks the benchmark claim and nothing else. **0 of 75 requests are supplied.** None are fabricated here.

| Input | Needed for | Owner | Status |
| --- | --- | --- | --- |
| The 75 representative real requests, including successful cases and the user's reported failures, with approved provenance | REL-01 baseline; RG-01/03/05/09 | **Neo** (the human). `DECISIONS.md` line 101: collection "blocked pending the human's approved location/owner". | Not supplied |
| An approved, access-controlled storage location for requests, labels and traces (redacted, retention-bounded) | Every stage | **Neo** to designate. Any party that copies data needs that authorization. | Not designated |
| Per-case frozen labels: case ID, authorized source snapshot and as-of time, expected subject/window/FY/version, accepted operation routes, exact arguments, gold answer-bearing records (≤10 per Recall@10 unit), required evidence coverage, expected grounded facts, allowed clarification/abstention | RG-01–06, RG-12 | **Lane Q: dot plus an independent reviewer** (`PLAN-RECONCILIATION-20261018.md` §4 item 3), with domain input from Neo | Not started |
| Development/calibration vs held-out split, with near-duplicate and snapshot grouping; no tuning on held-out | Validity of every RG score | Lane Q | Not started |
| Redacted per-request traces: actor/grants, resolved subject, skill ID/version, deployed model/runtime/proxy/catalog flags; exposed, discovered and selected operations with rejection reasons; per-call coverage/freshness/paging and claim-to-source map; SDK round trips, tool calls, subagent calls, p50/p95 timings and measured cost; final output, rubric and failure stage | Meaningful latency/cost budgets; failure localisation | **Fable** (Meri runtime trace emission, existing OpenTelemetry/Promptfoo mechanisms). **dot** (shipping the instrumented build). | Blocked on the runtime prerequisite below |
| Runtime prerequisite: working authenticated chat with reads, discovery and skills enabled on the measured profile | Running any real case | Fable (source) and dot (ship) | Blocked: no successful chat |
| Human adjudication of outputs | Rubric scores, RG-10/11 adoption decisions | Lane Q reviewer | Not assigned to a named person |
| Frozen latency cohorts and load | RG-09 (warm simple lookup p95 ≤ 15 s) | Lane Q with Fable | Not started |

Neo's approved launch split (`DOT-SOURCE-INTEGRATION-20261018.md`) places the larger labelled corpus after launch as a separately tracked evidence stream. That does not lower any gate and does not allow a synthetic substitute.

---


## Per-operation coverage ledger, 2026-10-18

Lane CL. One row per Appendix A name (96), Appendix B name (43) and Appendix C skill (14) of `CAPIRO-REMAINING-DEPLOYMENT-PLAN-20261017.md` (capiro-backend `5f719149`). Companion to `RUNTIME-INTEGRATION-LEDGER.md` and `PLAN-RECONCILIATION-20261018.md`. The original stopped survey is retained below; this successor refreshes retained-read startup composition and the corresponding skill dependencies after exact PR171 receipt. Other domains retain their recorded status and owners.

**Dot PR171 receipt correction:** PR171 exact `d117a7d4d6de94f25943d54c0b15d82c891b9b96` is received at `c7d58584bd9bac7529f82ba7600ce600a733cb97` on PR165 successor `48e84282bf164e873bf759f11ce815ee1bd3c2b4`. Ten of the historical 21 retained operations now have startup source composition in eight families; they are **integrated in source and held**, not qualified, deployed or live-verified. Eleven operations remain outside this selected composer. The desired P2 inventory remains **76 operations / 42 families**. The receipt, exact operation list, source measurements and failed checks are in [PR171-RECEIPT-20261018.md](PR171-RECEIPT-20261018.md). No active P2/G3 selection, image/config pin or deployment input was changed. Memory audit PR121 `6249424994` remains open.

## 0. Tip, method, vocabulary

- **Retained source receipt analysed:** `c7d58584bd9bac7529f82ba7600ce600a733cb97`; exact PR171 source `d117a7d4d6de94f25943d54c0b15d82c891b9b96`. Authoritative `generalReadInstallation` and selected plugin manifests were executed with Node 24.19.0; see the receipt for source-only evidence.
- **Original survey tip:** `fable/meri-integration-20261018` @ `6aa515b302c519069ccf45221b54add9962d544d` (`6aa515b3`; the lane branch was fast-forwarded from `1b8a1fb5` to that docs-only commit).
- **Enumerators actually used (read, and re-executed where the SDK import allowed):**
  - Catalog: `packages/contracts/retrieval-0.2/catalog.json` — `catalogVersion 0.2.16`, **97 operations** (96 replacements + the retained historical `query_action_items@0.2.0`). Every descriptor is `availability: unimplemented`, `qualification: pending`, `handler: null` (dumped with a scratch script). The static index therefore supplies nothing to `apps/gateway/catalog/runtime-catalog.mjs` (`entry()` requires enabled/qualified/handler); run-time availability comes only from the installation receipt (`apps/gateway/catalog/installed-catalog.mjs`, `apps/gateway/general-reads/installation-issuer.mjs`).
  - Installable reads: executed `apps/runtime/build/first-chat-launch-measurement.mjs generalReadInstallation({root})` on the received tree: **76 operations / 42 families**, SHA-256 `8850af4b50666deef9e4c7edc23d32f25d663840748380c7baaa066585602f6a`. A synthetic exact selection of the ten composed retained operations gives **10 / 8**, SHA-256 `028dd903f6fb0f0ba0650c9d7f0a12f124a98d94890d8a27bfc91fe140ef829e`. These are source measurements, not an active deployment list or image receipt.
  - Startup composition: `apps/runtime/cli.mjs` (control role) → `native-authority/reads-composer.mjs` (reads), `native-authority/execution-composition.mjs` + `product-ports/intents.mjs` (intents), `artifacts/authority-composition.mjs` + `product-ports/documents.mjs` (documents), `product-ports/memory.mjs`, `product-ports/routines.mjs`, `product-ports/capability-policy.mjs` (G2 profile, `PLUGIN_SKILL_NAMES`). Render switches: `infra/product-preview/first-chat/render-material.mjs` `features` block (lines 36–56, 202–284).
  - Skills: `packages/skills/assets.json` (15 assets), `packages/skills/originals/*/*/manifest.json`, `packages/skills/plugin.mjs describeSkillPlugin()` (executed: 14 plugin skills, `bill_watch@1.0.0` excluded `NO_SDK_FRONTMATTER`, `bill_watch@1.0.1` admitted as `meri-bill-watch`).
  - Exclusions: `apps/worker/conversation/test/legacy-tools-excluded.test.mjs` (43 names, guard), `catalog.json` `originals[].disposition:'deferred'`, `docs/coordination/ledgers/scope-ledger.json` `ownerDirection` (15 Oct), `docs/CAPABILITY-SCOPE.md` "Registry disposition ledger"; plus a fresh whole-word grep of every name over `apps/ packages/ infra/ scripts/` (.mjs .js .cjs .ts .py .sql .json; node_modules skipped).
  - `docs/coordination/ledgers/scope-ledger.json` / `MERI-FINAL-SCOPE-LEDGER-20261015.md` were used only for cross-checking family names; their totals are stale (P2) and not reproduced here.
- **States** (plan §3): inventory · source · integrated · qualified · deployed · live-verified · blocked · deferred. Here: **inventory** = catalog descriptor/contract only, no handler or owner; **source** = code exists on the tip but is not reachable from `cli.mjs` startup composition; **integrated** = reachable from the real startup composition and switchable by the render `features` block (all such rows are still held by **G1** `features.sourceEnabled` and their family keys; see note codes). **Nothing on this branch is qualified, deployed or live-verified except budgets/model grants and conversations on N17 `4172e474`** (`PLAN-RECONCILIATION-20261018.md` §1) — stated once, not repeated per row. **not yet mapped** = verification stopped before the row's startup reachability was established.

**Note codes used in Table A**

- **R-NATIVE** — read in a `NATIVE_READ_FAMILIES` family (`apps/gateway/sources/retained-reads/native-families.mjs`): composed by `reads-composer.mjs:115-117,145` (27 families on the tip), handlers via `general-reads/integration.mjs` over Core `/api/clio/tools/*`; rendered by `features.sourceEnabled` + `features.reads{enabled, installation, discovery}` (+ `capabilityPlatform` for discovery/`generalReads`).
- **R-SELECTED** - one of ten retained operations in `selected-task-ports.mjs`, supplied by the real control CLI from exact pinned P2 rows. The seven signed client reads and both action reads require Option B; dataset metadata uses the immutable local registry. State **integrated (held)** pending active P2/G3 selection, final source/image/config pins and Core/authenticated qualification. `query_tasks` is explicitly refused.
- **R-RETAINED** - one of eleven retained operations outside this selected startup composer. Portfolio detail/changes/evidence, Monday, memory search/proposals, mail, Florida and `query_tasks` retain their source/context/authority owners. Passive adapters and partial task ports do not establish startup composition or release acceptance.
- **R-SUBSET** — handler/route exists in `apps/gateway/sources/<dir>/handler.mjs` but the operation is excluded from installation by `reads/families.mjs` (`operationIds` / family absent) or `NATIVE_READ_OPERATION_SUBSETS`.
- **C-ONLY** — only `packages/contracts/retrieval-0.2/<x>.schema.json` + validator; no handler under `apps/gateway/sources/**`, `apps/gateway/general-reads/families/**`, `apps/worker/conversation/reads/families.mjs` (searched by name).
- **I-OK** — governed intent row available in `apps/worker/conversation/intents/catalog.mjs` `INTENT_ROWS`; control side `cli.mjs` composes `createControlIntentExecution` / `intentMountFor`; rendered by `features.intents{enabled, core, execution}` + `capabilityPlatform.governedIntents`.
- **I-HELD** — `INTENT_ROWS` row carries `unavailable: …` so it is never mounted (`intents/runtime.mjs:51-53`).
- Path prefixes: `F/` = `apps/gateway/general-reads/families/`, `S/` = `apps/gateway/sources/`, `K/` = `packages/contracts/retrieval-0.2/`.

## 1. Table A — 96 selected legacy capabilities

| # | legacy name | mapped implementation | proving file(s) | state | note |
|---|---|---|---|---|---|
| 1 | get_research_portfolio | `get_research_portfolio@0.2.0` / family `research-portfolio` | `F/research-portfolio.mjs`; `S/research-portfolio/handler.mjs` | source | R-RETAINED (recipient-composed only) |
| 2 | get_research_portfolio_changes | `get_research_portfolio_changes@0.2.0` / `research-portfolio` | same as #1 | source | R-RETAINED |
| 3 | get_research_evidence | `get_research_evidence@0.2.0` / `research-portfolio-evidence` | `F/research-portfolio-evidence.mjs`; `S/research-portfolio-evidence/handler.mjs` | source | R-RETAINED |
| 4 | read_chat_attachments | `read_chat_attachments@0.2.0`, group `client-knowledge-attachments` — **none found** | `K/client-knowledge-attachments.schema.json`; `apps/control/retention/data-classes.mjs:31` ("not yet implemented") | inventory | C-ONLY; no family for the group |
| 5 | read_monday_client_boards | `read_monday_client_boards@0.2.0` / `client-knowledge-monday` | `F/client-knowledge-monday.mjs`; `S/client-knowledge/handler.mjs`, `monday-mapping.mjs` | source | R-RETAINED; clientScope required |
| 6 | search_capiro_data | `search_capiro_data@0.2.0` / `data-search` | `F/data-search.mjs`; `S/data-search/handler.mjs` | integrated | R-NATIVE |
| 7 | get_client_context | `get_client_context@0.3.0` / `client-knowledge-profile` | `F/client-knowledge-profile.mjs`; `S/client-evidence/handler.mjs` | integrated (held) | R-SELECTED; exact PR171 receipt; release gates open |
| 8 | search_research_sources | `search_research_sources@0.2.0`, group `research-legal-candidates` — **none found** | `K/research-legal-candidates.schema.json` | inventory | C-ONLY |
| 9 | run_analysis | `run_analysis@0.2.0` → intent `request_analysis` | `apps/artifacts/postgres-analysis.mjs`, `sandbox-analysis.mjs`; `intents/catalog.mjs` | source | I-HELD `ROUTE_GAP` (no governed analysis route; ANALYSIS-SANDBOX) |
| 10 | search_client_knowledge | `search_client_knowledge@0.2.0` / `client-knowledge-search` | `F/client-knowledge-search.mjs`; `S/client-knowledge-search/handler.mjs` | integrated | R-NATIVE; `requiredClientOperations` |
| 11 | query_intelligence | `query_intelligence@0.2.0` / `intelligence-summary` | `F/intelligence-summary.mjs`; `S/intelligence-summary/handler.mjs` | integrated | R-NATIVE |
| 12 | query_knowledge_graph | `query_knowledge_graph@0.2.0` / `client-knowledge-search` | as #10 | integrated | R-NATIVE |
| 13 | search_memory | `search_memory@0.2.0` / `client-knowledge-memory` | `F/client-knowledge-memory.mjs`; `S/client-knowledge/handler.mjs`, `memory-eligibility.mjs` | source | R-RETAINED |
| 14 | list_memory_proposals | `memory.list_own_proposals@0.2.0` / `memory-proposals` | `F/memory-proposals.mjs`; `S/memory-proposals/handler.mjs` | source | R-RETAINED. HTTP surface `/api/memory/proposals/*` is composed separately (`product-ports/memory.mjs`, `features.memory`) — not the conversational read |
| 15 | search_congress_bills | `search_congress_bills@0.2.0` / `bill-text` | `F/bill-text.mjs`; `S/bill-text/handler.mjs` | integrated | R-NATIVE |
| 16 | get_bill_status | `get_bill_status@0.2.0` / `federal-legislation` | `F/federal-legislation.mjs`; `S/federal-legislation/handler.mjs` | integrated | R-NATIVE |
| 17 | read_bill_text | `read_bill_text@0.2.0` / `bill-text` | as #15 | integrated | R-NATIVE |
| 18 | get_certification_status | `get_certification_status@0.2.0`, group `certification-status` — **none found** | `K/certification-status.schema.json` | inventory | C-ONLY |
| 19 | search_floor_votes | `search_floor_votes@0.2.0` / `federal-legislation` | as #16 | integrated | R-NATIVE |
| 20 | search_cbo_cost_estimates | `search_cbo_cost_estimates@0.2.0` / `public-reports` | `F/public-reports.mjs`; `S/public-reports/handler.mjs` | integrated | R-NATIVE |
| 21 | resolve_entity | `resolve_entity@0.2.0` / `entity-candidates` | `F/entity-candidates.mjs`; `S/identity-contacts/handler.mjs` | integrated (held) | R-SELECTED; exact PR171 receipt; release gates open |
| 22 | search_lda_filings | `search_lda_filings@0.2.0` / `disclosures` | `F/disclosures.mjs`; `S/disclosures/handler.mjs` | integrated | R-NATIVE |
| 23 | list_global_datasets | `list_global_datasets@0.2.0` / `dataset-metadata` | `F/dataset-metadata.mjs`; `S/dataset-metadata/handler.mjs` | integrated (held) | R-SELECTED; exact PR171 receipt; release gates open |
| 24 | query_global_data | `query_global_data@0.2.0` / `public-domain-query` | `F/public-domain-query.mjs`; `S/public-domain-query/handler.mjs` | integrated | R-NATIVE |
| 25 | search_sec_filings | `search_sec_filings@0.2.0` / `disclosures` | as #22 | integrated | R-NATIVE |
| 26 | search_fara_registrations | `search_fara_registrations@0.2.0` / `disclosures` | as #22 | integrated | R-NATIVE |
| 27 | search_federal_grants | `search_federal_grants@0.2.0` / `public-data` | `F/public-data.mjs`; `S/public-data/handler.mjs` | integrated | R-NATIVE; ledger R2 noted an adapter failure on the integrated tree (rt-reads) |
| 28 | search_federal_awards | `search_federal_awards@0.2.0` / `public-data` | as #27 | integrated | R-NATIVE |
| 29 | search_gao_reports | `search_gao_reports@0.2.0` / `public-reports` | as #20 | integrated | R-NATIVE |
| 30 | search_state_bills | `search_state_bills@0.2.0` / `state-legislation` | `F/state-legislation.mjs`; `S/state-legislation/handler.mjs` | integrated | R-NATIVE |
| 31 | get_state_bill_status | `get_state_bill_status@0.2.0` / `state-status-votes` | `F/state-status-votes.mjs`; `S/state-status-votes/handler.mjs` | integrated | R-NATIVE |
| 32 | search_state_floor_votes | `search_state_floor_votes@0.2.0` / `state-status-votes` | as #31 | integrated | R-NATIVE |
| 33 | get_state_legislator | `get_state_legislator@0.2.0` / `state-legislation` | as #30 | integrated | R-NATIVE |
| 34 | get_committee_roster | `get_committee_roster@0.2.0` / `legislative-directory` | `F/legislative-directory.mjs`; `S/legislative-directory/handler.mjs` | integrated | R-NATIVE |
| 35 | get_representation | `get_representation@0.2.0` / `facility-representation` | `F/facility-representation.mjs`; `S/facility-representation/handler.mjs` | integrated | R-NATIVE; clientScope required |
| 36 | list_members | `list_members@0.2.0` / `legislative-directory` | as #34 | integrated | R-NATIVE |
| 37 | get_state_rule_status | `get_state_rule_status@0.2.0`, group `rule-status` — **none found** | `K/rule-status.schema.json` | inventory | C-ONLY |
| 38 | search_intel_articles | `search_intel_articles@0.2.0` / `stored-intelligence` | `F/stored-intelligence.mjs`; `S/stored-intelligence/handler.mjs` | integrated | R-NATIVE |
| 39 | search_committee_hearings | `search_committee_hearings@0.2.0` / `public-domain-hearings` | `F/public-domain-hearings.mjs`; `S/public-domain-hearings/handler.mjs` | integrated | R-NATIVE |
| 40 | search_legiwatch_news | `search_legiwatch_news@0.2.0` / `research-legal-news` | `F/research-legal-news.mjs`; `S/research-legal-news/handler.mjs` (PARTIAL_INPUT) | source | R-SUBSET: family absent from `READ_FAMILIES` → not installable |
| 41 | get_florida_budget_project | `get_florida_budget_project@0.2.0` / `florida-budget` | `F/florida-budget.mjs`; `S/florida-budget/handler.mjs` | source | R-RETAINED (recipient-composed only) |
| 42 | search_legislative_research | `search_legislative_research@0.2.0` / `research-legal-legislation` | `F/research-legal-legislation.mjs`; `S/research-legal-legislation/handler.mjs` | integrated | R-NATIVE (family `operationIds` = this op only) |
| 43 | get_legal_reference | `get_legal_reference@0.2.0` / `research-legal-legislation` | `S/research-legal-legislation/handler.mjs` (route present) | source | R-SUBSET: excluded by `reads/families.mjs` `operationIds` |
| 44 | search_crs_reports | `search_crs_reports@0.2.0` / `public-reports` | as #20 | integrated | R-NATIVE |
| 45 | query_economic_data | `query_economic_data@0.2.0` / `public-data` | as #27 | integrated | R-NATIVE |
| 46 | get_district_nexus_context | `get_district_nexus_context@0.2.0` / `district-nexus` | `F/district-nexus.mjs`; `S/district-nexus/handler.mjs` | integrated | R-NATIVE; clientScope required |
| 47 | get_district_nexus_changes | `get_district_nexus_changes@0.2.0` / `district-nexus` | as #46 | integrated | R-NATIVE; clientScope required |
| 48 | search_public_web | `search_public_web@0.2.0` / `public-web` (Core `/api/clio/tools/search_public_web`) | `F/public-web.mjs`; `S/public-web/handler.mjs`, `README.md` | integrated | R-NATIVE. Distinct from the browser (held `BROWSER_EGRESS_UNQUALIFIED`, `apps/worker/conversation/browser/activation.mjs:28`) |
| 49 | scrape_web_page | `scrape_web_page@0.2.0` / `public-web` | as #48 | integrated | R-NATIVE; same browser distinction |
| 50 | save_chat_attachments | `save_chat_attachments@0.2.0` → intent `propose_attachment_filing`; command `artifact.file` | `apps/artifacts/filing.mjs`; `packages/contracts/commands-0.2/artifact-file*.{json,mjs}`; `apps/control/commands/source-projection.mjs:4` | source | I-HELD `OWNER_MISSING` (no proposal-metadata codec) |
| 51 | list_emails | `mail.list_messages@0.2.0` / `mail` | `F/mail.mjs`; `S/mail/handler.mjs`, `http-adapter.mjs` | source | R-RETAINED (no composer for `mail` found) |
| 52 | search_emails | `mail.search_messages@0.2.0` / `mail` | as #51 | source | R-RETAINED |
| 53 | get_email_thread | `mail.read_thread@0.2.0` / `mail` | as #51 | source | R-RETAINED |
| 54 | list_upcoming_meetings | `meeting.list_upcoming_meetings@0.2.0` / `meeting-source` | `F/meeting-source.mjs`; `S/meetings/handler.mjs` | integrated (held) | R-SELECTED; exact PR171 receipt; release gates open |
| 55 | save_memory | `save_memory@0.2.0` → intent `propose_memory`; command `memory.propose` | `packages/contracts/commands-0.2/memory-propose*`; execution-side source `product-ports/memory.mjs` `commandSourceFor` | source | I-HELD `OWNER_MISSING`; proposal boundary preserved (no canonical write) |
| 56 | search_program_elements | `search_program_elements@0.2.0` / `program-elements` | `F/program-elements.mjs`; `S/program-elements/handler.mjs` | integrated | R-NATIVE |
| 57 | get_program_element | `get_program_element@0.2.0` / `program-elements` | as #56 | integrated | R-NATIVE |
| 58 | get_pe_budget_timeline | `get_pe_budget_timeline@0.2.0` / `program-elements` | as #56 | integrated | R-NATIVE |
| 59 | get_pe_contractors | `get_pe_contractors@0.2.0` / `pe-references` | `F/pe-references.mjs`; `S/pe-references/handler.mjs` | integrated | R-NATIVE |
| 60 | get_pe_bills | `get_pe_bills@0.2.0` / `pe-references` | as #59 | integrated | R-NATIVE |
| 61 | get_pe_report_language | `get_pe_report_language@0.2.0` / `pe-references` | as #59 | integrated | R-NATIVE |
| 62 | search_acquisition_personnel | `search_acquisition_personnel@0.2.0` / `acquisition-personnel` | `F/acquisition-personnel.mjs`; `S/acquisition-personnel/handler.mjs` | integrated | R-NATIVE |
| 63 | get_acquisition_person | `get_acquisition_person@0.2.0` / `acquisition-personnel` | as #62 | integrated | R-NATIVE |
| 64 | create_word | `create_word@0.2.0` → intent `request_document` → document application | `intents/catalog.mjs`; `apps/control/document-application/format-admission.mjs:12`; `apps/runtime/artifacts/run-options.mjs:37`, `authority-composition.mjs`; `cli.mjs` (`composeDocumentsFamily`) | integrated | I-OK; `features.artifacts{…, authority}` + `artifacts.executor`; control image lacks Python 3/pptxgenjs (lane I) |
| 65 | create_excel | `create_excel@0.2.0` → `request_document` | as #64 | integrated | I-OK; same holds |
| 66 | create_powerpoint | `create_powerpoint@0.2.0` → `request_document` | `apps/artifacts/presentation.mjs` (pptxgenjs 4.0.1); `format-admission.mjs:12` admits word/excel only | source | I-HELD `ROUTE_GAP` (DA-3, ARTIFACT-ADMISSION) |
| 67 | schedule_task | `schedule_task@0.2.0` → intent `propose_schedule` | `apps/control/intents/schedule-preparer.mjs`; `apps/control/schedules/tool-interface.mjs`, `application.mjs` | source | `INTENT_ROWS` lists it available, but `schedule-preparer.mjs:5-9` states no trusted `resolveContext` owner exists (P-INT-6); startup owner **not yet mapped** |
| 68 | list_scheduled_tasks | `list_scheduled_tasks@0.2.0` — read, `NOT_INTENTS` | `apps/control/schedules/application.mjs:95`, `application-http.mjs` (`/api/routines/list`); `intents/catalog.mjs` `NOT_INTENTS` | source | HTTP product route (routines family, `features.routines`); no conversational tool; not in any read family |
| 69 | cancel_scheduled_task | `cancel_scheduled_task@0.2.0` → `propose_schedule_change` | as #67 | source | as #67 |
| 70 | update_scheduled_task | `update_scheduled_task@0.2.0` → `propose_schedule_change` | as #67 | source | as #67 |
| 71 | query_tasks | `query_tasks@0.2.0` / `operational-reads` | `F/operational-reads.mjs`; `S/original-tracking/handler.mjs` | source | R-RETAINED |
| 72 | query_action_items | `actions.query@0.2.0` / `action-items-complete` (+ historical `query_action_items@0.2.0` / `operational-reads`) | `F/action-items-complete.mjs`; `S/action-items/handler.mjs`; `S/original-tracking/handler.mjs` | integrated (held) | R-SELECTED; exact PR171 receipt; release gates open |
| 73 | search_tracked_bills | `search_tracked_bills@0.2.0` / `tracked-bills` | `F/tracked-bills.mjs`; `S/tracked-bills/handler.mjs` | integrated | R-NATIVE; clientScope required |
| 74 | query_regulatory_dockets | `query_regulatory_dockets@0.2.0` / `regulatory-dockets` | `F/regulatory-dockets.mjs`; `S/regulatory-dockets/handler.mjs` | integrated | R-NATIVE |
| 75 | search_sam_opportunities | `search_sam_opportunities@0.2.0`, group `sam-opportunities` — **none found** | `K/sam-opportunities.schema.json` | inventory | C-ONLY |
| 76 | query_debriefs | `meeting.query_debriefs@0.2.0` / `meeting-source` | as #54 | integrated (held) | R-SELECTED; exact PR171 receipt; release gates open |
| 77 | read_client_meetings | `meeting.read_client_meetings@0.2.0` / `meeting-source` | as #54 | integrated (held) | R-SELECTED; exact PR171 receipt; release gates open |
| 78 | query_outreach | `query_outreach@0.2.0` / `outreach-query` | `F/outreach-query.mjs`; `S/outreach-query/handler.mjs` (PARTIAL_INPUT) | source | R-SUBSET: family absent from `READ_FAMILIES` |
| 79 | read_client_documents | `read_client_documents@0.2.0` / `client-documents` | `F/client-documents.mjs`; `S/client-evidence/handler.mjs` | integrated (held) | R-SELECTED; exact PR171 receipt; release gates open |
| 80 | lookup_client_registry | `lookup_client_registry@0.2.0` / `client-registry` | `F/client-registry.mjs`; `S/client-registry/handler.mjs` | integrated | R-NATIVE |
| 81 | create_task | `create_task@0.2.0` → intent `propose_task`; command `task.create` | `intents/catalog.mjs`; `apps/control/intents/command-preparer.mjs`; `packages/contracts/commands-0.2/task-create*` | integrated | I-OK; needs Core rev 3 + `features.intents.execution` ON (ledger §5) |
| 82 | update_task | `update_task@0.2.0` → `propose_task_update`; `task.update` | as #81; `task-update*`; `product-ports/tasks.mjs` | integrated | I-OK; task executor grant owner still absent on the Core side (`tasks.mjs` header) |
| 83 | find_contacts | `find_contacts@0.2.0` / `tenant-contacts` | `F/tenant-contacts.mjs`; `S/identity-contacts/handler.mjs` | integrated (held) | R-SELECTED; exact PR171 receipt; release gates open |
| 84 | search_funding_opportunities | `search_funding_opportunities@0.2.0` / `funding-opportunities` | `F/funding-opportunities.mjs`; `S/funding-opportunities/handler.mjs` | integrated | R-NATIVE; clientScope required |
| 85 | get_funding_opportunity_requirements | `…_requirements@0.2.0` / `funding-opportunities` | as #84 | integrated | R-NATIVE |
| 86 | get_funding_opportunity | `get_funding_opportunity@0.2.0` / `funding-opportunities` | as #84 | integrated | R-NATIVE |
| 87 | get_opportunity_client_context | `get_opportunity_client_context@0.2.0` / `funding-opportunities` | as #84 | integrated | R-NATIVE |
| 88 | get_opportunity_government_landscape | `…_government_landscape@0.2.0` / `funding-opportunities` | as #84 | integrated | R-NATIVE |
| 89 | search_federal_contract_awards | `search_federal_contract_awards@0.2.0` / `federal-market` | `F/federal-market.mjs`; `S/federal-market/handler.mjs` | integrated | R-NATIVE |
| 90 | search_federal_subawards | `search_federal_subawards@0.2.0` / `federal-market` | as #89 | integrated | R-NATIVE |
| 91 | search_contract_vehicles | `search_contract_vehicles@0.2.0` / `federal-market` | as #89 | integrated | R-NATIVE |
| 92 | search_procurement_forecasts | `search_procurement_forecasts@0.2.0` / `federal-market` | as #89 | integrated | R-NATIVE |
| 93 | get_business_development_context | `get_business_development_context@0.2.0` / `business-development` | `F/business-development.mjs`; `S/business-development/handler.mjs` | integrated | R-NATIVE (subset) |
| 94 | get_business_development_evidence | `get_business_development_evidence@0.2.0` / `business-development` | `K/business-development.schema.json`; no route in `S/business-development/handler.mjs` | source | R-SUBSET: excluded by `NATIVE_READ_OPERATION_SUBSETS` and `operationIds`; no handler route |
| 95 | get_business_development_recent_changes | `…_recent_changes@0.2.0` / `business-development` | as #93 | integrated | R-NATIVE (subset) |
| 96 | get_district_federal_market | `get_district_federal_market@0.2.0` / `federal-market` | as #89 | integrated | R-NATIVE |

## 2. Table B — 43 excluded capabilities

All 43: catalog `originals[].disposition='deferred', replacement=null`; absent from catalog operations/aliases, every skill manifest and the SDK tool surface (`legacy-tools-excluded.test.mjs`); **0 code hits** in the fresh grep over `apps/ packages/ infra/ scripts/` (non-test, non-record). Reference: `docs/CAPABILITY-SCOPE.md` "Registry disposition ledger" (10 Oct, "proposed deferred") and `scope-ledger.json` `ownerDirection` (15 Oct, excluded by owner direction).

| # | name | present? | reference |
|---|---|---|---|
| 1–17 | manage_research_portfolio, get_research_portfolio_analytics, create_research_portfolio_snapshot, request_research_portfolio_output, save_research_portfolio_output_to_client, watch_research_portfolio, update_research_portfolio_change_state, get_research_portfolio_bookmarks, create_research_portfolio_bookmark, get_research_portfolio_fit, get_research_portfolio_reviews, add_research_portfolio_review_note, get_research_portfolio_rules, get_research_portfolio_imports, get_research_portfolio_operations, prepare_research_portfolio_brief, prepare_research_portfolio_meeting | absent | scope-ledger group "Research Portfolio"; `packages/contracts/test/retrieval-research-portfolio*.test.mjs` (negative tests); CAPABILITY-SCOPE rows 43–63 |
| 18 | find_path_to | absent | CAPABILITY-SCOPE line 72 |
| 19 | get_legiwatch_review | absent | CAPABILITY-SCOPE line 100 |
| 20 | compare_florida_budget_amounts | absent | scope-ledger group "Relationships, legislation and Florida" |
| 21 | prepare_legiwatch_briefing | absent | same group |
| 22 | compare_legislative_versions | absent | same group |
| 23 | save_legislative_research | absent | same group |
| 24 | preview_legiwatch_relevance | absent | same group |
| 25 | save_legiwatch_relevance | absent | same group |
| 26 | apply_legiwatch_suggestion | absent | same group |
| 27 | create_meeting_brief | absent | CAPABILITY-SCOPE line 118 ("new local native brief generation is required separately" — the selected skill `meeting_prep` is not this operation) |
| 28 | draft_policy_memo | absent | CAPABILITY-SCOPE line 119 |
| 29 | save_note | absent | CAPABILITY-SCOPE line 120 |
| 30 | send_email | absent | CAPABILITY-SCOPE line 122 |
| 31 | reply_email | absent | CAPABILITY-SCOPE line 127 |
| 32 | confirm_memory | absent (governed alternative: proposer approve/reject via Core review, `apps/control/memory/core-review.mjs`, D016 #6 review-only) | CAPABILITY-SCOPE line 129; `legacy-tools-excluded.test.mjs` "three direct canonical-memory writes" |
| 33 | correct_memory | absent (sourced correction = `memory.propose` candidate, `product-ports/memory.mjs` header) | as #32 |
| 34 | forget_memory | absent | as #32 |
| 35 | get_pe_buyer_workspace | absent | CAPABILITY-SCOPE line 135 |
| 36 | create_client | absent | CAPABILITY-SCOPE line 158 |
| 37 | update_client_profile | absent (name appears only in recorded evidence `provenance.json` files under `apps/control/document-application/mail-history/local/`, class "recorded-evidence" per scope-ledger) | scope-ledger `excludedReferences` |
| 38 | explain_opportunity_match | absent | CAPABILITY-SCOPE line 166 |
| 39 | compare_funding_opportunities | absent | CAPABILITY-SCOPE "Client and opportunity analysis" group |
| 40 | build_opportunity_action_plan | absent | same |
| 41 | get_business_development_brief | absent | CAPABILITY-SCOPE line 177 |
| 42 | resolve_business_development_source | absent | same group |
| 43 | save_business_development_brief | absent | same group |

## 3. Table C - 14 required original skills

The selected plugin still contains 14 skills. Nine profile-dependent skills select their immutable `1.0.1` successor using `get_client_context@0.3.0`; original versions remain preserved. Counts below were recomputed from `describeSkillPlugin()`, `selectSkill()` and the current installable refs. "Source composed" includes native reads plus the ten received retained operations; it does not establish an active per-run set or live callability. All source and release gates still apply.

| # | skill id | selected version | source-composed reads | retained reads still outside selected composer | reads outside installation / other dependency | state |
|---|---|---|---|---|---|---|
| 1 | research_company | 1.0.1 | 18/20 | none | `search_sam_opportunities`, `get_certification_status` | plugin integrated; reads held |
| 2 | relationship_brief | 1.0.0 | 6/11 | `mail.search_messages`, `mail.read_thread`, `search_memory`, `query_tasks`, `read_monday_client_boards` | none | plugin integrated; reads held |
| 3 | client_changes | 1.0.1 | 9/13 | `mail.search_messages`, `mail.read_thread`, `query_tasks`, `read_monday_client_boards` | none | plugin integrated; reads held |
| 4 | portfolio_changes | 1.0.1 | 10/14 | `mail.search_messages`, `mail.read_thread`, `query_tasks`, `read_monday_client_boards` | none | plugin integrated; reads held |
| 5 | portfolio_overlap | 1.0.1 | 11/11 | none | none | plugin integrated; reads held |
| 6 | mail_history | 1.0.0 | 2/5 | `mail.list_messages`, `mail.search_messages`, `mail.read_thread` | none | plugin integrated; reads held |
| 7 | meeting_prep | 1.0.1 | 11/16 | `mail.search_messages`, `mail.read_thread`, `search_memory`, `query_tasks`, `read_monday_client_boards` | none | plugin integrated; reads held |
| 8 | commitments_audit | 1.0.0 | 4/8 | `mail.search_messages`, `mail.read_thread`, `query_tasks`, `read_monday_client_boards` | none | plugin integrated; reads held |
| 9 | funding_opportunity_match | 1.0.1 | 8/9 | none | `search_sam_opportunities` | plugin integrated; reads held |
| 10 | pe_deep_dive | 1.0.0 | 11/11 | none | none | plugin integrated; reads held |
| 11 | bill_watch | 1.0.1 | 3/3 | none | `create_word` is an I-OK intent | plugin integrated; reads held |
| 12 | hearing_watch | 1.0.1 | 7/7 | none | none | plugin integrated; reads held |
| 13 | representation_lookup | 1.0.1 | 7/7 | none | none | plugin integrated; reads held |
| 14 | regulatory_docket_brief | 1.0.1 | 5/7 | none | `get_state_rule_status`, `get_legal_reference` | plugin integrated; reads held |

## 4. Totals

- **Table A (96):** integrated **68** (55 native read names + 9 newly composed retained names + 4 existing intents), source **23** (11 remaining retained names + 4 R-SUBSET reads + 3 schedule intents + list_scheduled_tasks + 4 I-HELD), inventory **5**. The nine newly composed names cover ten operations because row 72 contains both action reads. They remain held; qualified/deployed/live-verified counts gain **zero**. Other domain classifications are carried from the original survey.
- **Table B (43):** absent 43 · governed/deferred-with-reference 0 (confirm/correct/forget_memory have a governed *alternative*, not an implementation).
- **Table C (14):** 14 selected plugin skills; 0 allowed-operation names missing from the catalog. Three skills still reference reads outside the installable set (research_company, funding_opportunity_match, regulatory_docket_brief). The earlier zero-composed claims are superseded: relationship_brief now has 6/11 source-composed reads, mail_history 2/5, commitments_audit 4/8. These are composition counts, not live workflow acceptance.
- **Appendix A names with no implementation (contract only):** `read_chat_attachments`, `search_research_sources`, `get_certification_status`, `get_state_rule_status`, `search_sam_opportunities`.
- **Skills whose required operations are missing (not installable on the tip):** research_company (`search_sam_opportunities`, `get_certification_status`), funding_opportunity_match (`search_sam_opportunities`), regulatory_docket_brief (`get_state_rule_status`, `get_legal_reference`).
- **Rows still without the selected retained startup owner:** #1, 2, 3, 5, 13, 14, 41, 51, 52, 53 and 71. The three schedule intents retain their separate owner and evidence; this receipt does not reclassify them.

## 5. Unverified (could not be established from source in the time available)

1. **Installation receipt vs composed handlers.** The authoritative full inventory remains 76/42. Ten retained operations are now source-composed alongside the existing native families when their exact refs are selected. A full 76-operation production selection remains blocked by eleven retained operations outside the selected composer. No required operation was revoked to make installation pass.
2. **Retained startup composition.** `cli.mjs` now supplies `createSelectedRetainedTaskPorts` from measured P2 rows, verified by the 7/7 CLI suite. This supersedes the earlier missing-caller assertion for the ten selected operations only.
3. **Schedule intents** (#67/69/70): `INTENT_ROWS` marks them available while `schedule-preparer.mjs` says no `resolveContext` owner exists; `execution-composition.mjs` was not read to settle which is current.
4. **Documents composition** details (`authority-composition.mjs` header says the production CLI supplies no `authorityPorts`; ledger says lane X threaded `runOptions`) — taken from the ledger, not re-verified.
5. The authoritative enumerator was executed after PR171 receipt and reproduced both upstream source hashes. Image/config and authenticated qualification remain open.
6. No live/AWS/Core/DB evidence was consulted; `qualified` and later states are taken from `PLAN-RECONCILIATION-20261018.md` §1 only.
