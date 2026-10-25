# Current Wave 2 release state

> **25 October current entry point:** [Wave 2 in-progress handoff](../20261025/WAVE-2-HANDOFF.md), [user acceptance checklist](../20261025/WAVE-2-USER-ACCEPTANCE.md) and [current PROCESS templates](PROCESS.md#6-current-templates). Root only orchestrates at Ultra; helpers use xhigh; existing Release is the sole AWS operator. The dated receipts/roles below are historical where superseded; no #202 post without Neo.

## Successor audit — 25 October 2026

> **Historical pre-rollout audit retained from main.** Its source/deployment status and role wording are superseded by the dated current handoff linked above; preserve the original evidence below.

Neo resumed all sessions after their usage-limit interruption and asked that feature work continue in parallel with one dedicated local-environment owner. Root remains the sole integrator and AWS release owner. There has been **no successor AWS deployment, preview migration or DNS change**. Source/test results below do not qualify a testable preview. The last verified deployed baseline remains runtime `5430b131` / control 67, Core `4ce7cf63` / revision 11 and frontend `6118da80` / revision 29; obtain fresh readbacks before shipping.

| Area | Accepted source and evidence | Remaining closure |
|---|---|---|
| Core integration | Clean `30618725b1065e1d1404ac2cad0f27dd2ad41bb0` includes reviewed native filing commit verification, current Mail client-wall checks and contact transfer. Filing passed two paired HTTP cases and five actual PostgreSQL cases; contact transfer passed fourteen actual PostgreSQL cases with the active Contacts forward migration. | Paired contact UI/edge, complete local build and actual combined acceptance. New migrations are source-only for AWS. |
| Meri runtime | SDK/native tools, fourteen selected skills, management, Objective, task/document/file/memory owners and public contracts have accumulated accepted changes. Routines `2419a727b` and General task read `b4f19d1b` are reviewed; initial task retention `713a1a8d` is reviewed. | Missing certification/state-rule/SAM read adapters, General memory read/context correctness and broader General read parity; first-use routine and Objective prompt retention; large SDK-session purge. Public distributions must be regenerated from the final composition. |
| Frontend | Accepted management/lifecycle, selected-skill/client handoff, Objective, native action recovery, meeting/artifact and file-access consumers are composed through `166e48de`. Local layout authentication repair is verified with the existing signed-in browser. | Routines surface and contact carry-over consumer are in progress. Saved brief/file carry-over and remaining domain consumers must be paired with their actual owners. Final package install/build and integrated browser acceptance remain. |
| Portfolio | Contact source/migration is reviewed; saved Core brief to private client draft is sealed at `fc979524bc` with 56 focused passing tests, pending independent review and its ten prepared PG cases. | File deletion/copy and calendar sync recovery; paired brief UI/edge; actual feature acceptance. PF14's accepted Directory allocation remains note-only. |
| Data integrity | Filing false acknowledgements after COMMIT rollback are repaired and independently qualified. First-use task retention is repaired. | Memory-purge late legal-hold race has source candidate `86619dc8` with 15 unit checks and affected types passing; independent review and concurrent PG proof remain. Do not enable purge from source-only evidence. |
| Local environment | Existing environment/data/authentication are preserved. Meri migrations 1–53 are applied locally. Backups are saved; exact-lock Core dependency installation has completed and Core compilation is underway. | Same-volume PostgreSQL capacity repair, matching Core/control/runtime/Temporal startup and authenticated end-to-end flows. The local browser is not yet proof of complete chat readiness. |

Settings, Mail, Portfolio, frontend, runtime and environment work are active in parallel. Final release still requires coherent reviewed source, real local user paths, ARM64 images built once per candidate, exact-image smoke and zero HIGH/CRITICAL scan results, snapshot-before-forward-migration, preview deployment and actual client/General chat/data/follow-up/Stop acceptance. Preserve existing valid checks and all applied history. Do not reimplement already accepted owners merely because their deployment acceptance remains open.

Evidence stays in the existing local `C:/dev/wave2-evidence-20261024` owner folders and visible-lane handoffs. This checkpoint names source states, not new authorization, a new release framework or a promise that every advertised feature has passed.

## Earlier release receipt — 24 October 2026

Documentation cutoff **24 October 2026, 21:37 UTC**, incorporating root's Core migration verification at 21:30 and subsequent rollout handoff, on Meri main `5f1e166ea9919789dbe9d2e17bd451e846c0c6fa`. This is a fixed receipt, not a continuously refreshed environment inventory. Root owns later readbacks. No cloud, deployment, database or browser action was performed for this documentation update.

| Component | Implemented / reviewed / merged | Built and deployed state | Acceptance still required |
|---|---|---|---|
| General binding repair | Meri PR243, source `b7be7ddf46408cb00caec89c5e412f698eae6045`, merged `289f4379959399c87d01c5393ba486223fa4e55e` | Migration 49 applied; earlier 48 unchanged | General chat and follow-up passed. This does not close authorized client/General data reads or full lifecycle acceptance. |
| Runtime text projection | Meri PR242, source `5430b1311d0412aa2d544556525f53f3a7183b3b`, merged `5f1e166ea9919789dbe9d2e17bd451e846c0c6fa` | AgentCore V1 version 4, image `sha256:a1bc1bc86346a9304c66d2039b498e17021303a92f1c5af0c41f13650174835c`, control 67 stable | New General follow-up text appears once. Keep remaining client/General data, Stop, reconnect and feature cases open. |
| Integrated Core | PR126, source `4ce7cf634cfaed49f99b537f110240ac74703508`, merged `2edec026c912c2f6155a6ac8d04ae08bc70030b3` | Image `sha256:edf6fd19319d221474875d46c0e681c146a4a4ec81d6a679878d93843e4ffbcc` built, smoked and scanned. Four migrations verified: 674→678, prior 674 preserved, Meri 49 unchanged. Core revision 11 is deployed: CloudFormation UPDATE_COMPLETE, ECS COMPLETED, one desired/running task, zero pending, target HEALTHY. | Authorized data-read acceptance pending; healthy deployment alone does not establish data behavior. Do not reapply these migrations or rebuild unchanged source to rediscover their result. |
| Composed frontend | PR138, source `6118da8075c542229c0e88039cb6043fef13acb5`, merged `d01ea554…` | Image `e2af…` built, smoked and scanned; the existing image-only change set is executed and **rollout is in progress**, with no rebuild | Finish rollout, verify health, then accept affected Settings/Portfolio/Mail/MP and completed-turn/Stop behavior. MF09 management is absent from 6118. |

Short image/merge prefixes are identifiers from root's handoff, not executable deployment pins. Use the complete exact values in the release owner before action. Earlier frontend session recovery/history success remains evidence; the complete advertised chat/data acceptance set remains open. A separate history-only initial retry limitation remains when the original model omission is reconstructed as an explicit resolved model.

The four new Core migration directories are `20281024020000_meri_conversation_management`, `20281024030000_support_requests`, `20281024060000_client_activity_command_undo` and `20281024070000_client_person_create_receipts`. Existing migration files and applied ledger prefixes remain unchanged. Meri purge ordinals 50–52 were reserved, not applied by this receipt; root reconciles their final source and current ledger before any later migration.

**Next:** finish frontend rollout/health and Core data-read/live UI acceptance; integrate MG05/MF09 paired follow-ons; allocate the remaining source and acceptance work in [FINAL-PLAN §0](plan/FINAL-PLAN-20261021.md#0-current-wave-2-execution--24-october-2026). All 25 A2 tickets are accounted for there. Root's [current workflow](WORKFLOW.md) supersedes historical Fable/dot roles and old holds. AgentCore plus the full Claude SDK is chosen; the durable local environment stays preserved across waves.

Evidence is local under `C:/dev/wave2-evidence-20261024`: `root/general-scope-release/verified.json`, root's General/follow-up observations, `root/text-projection-release/runtime-live-verified.json` (21:26:42), `root/core-integration-release/migration-verified.json` (21:30:21), the Core/frontend image qualification receipts and root's release handoff. The source inventory is `settings/wave2-remaining-refresh/REPORT.md` (21:25 cutoff); this receipt supersedes its earlier build/deployment stages, not its unfinished feature assessment.

---

## Historical 22 October handover snapshot

The following receipt and holds are retained as history only. They do not govern current work. In particular, **never delete or re-clone the preview database**, use the shared live database, revive removed services, or reinstate a Fable/dot approval flow from this section.

## 1. Live on preview (portfolio-preview.app.capiro.ai)

| Component | Version | Notes |
|---|---|---|
| Meri runtime | meri-greenfield `main` **eb6579204** (PR197 + C12), deployed 2026-10-21 23:44 UTC | control:46, temporal-worker:45, runner:31, owner:44, proxy:44, temporal-issuer:45. Runtime image `qualification-worker@sha256:5164a6e0…`, proxy image `sha256:a838846f…` (one accepted unscored CVE in ca-certificates, O144). |
| Meri DB ledger (shared Aurora, Meri-owned objects) | ordinals **1–42** | Includes the full `integration` stage and C12 `0020` (O145). Snapshot before: `meri-pre-integration-c12-20261021`. |
| Preview Core | `capiro-preview-first-chat-core:3`, source 0f5d7e15, image `sha256:1ae9b167…`, **shared live DB** | Registered and **not rolled**: `:4` = 51e265bd (with #107) pointing at the clone. |
| New-stack DB clone | `capiro-newstack-preview-clone` (copy-on-write; endpoint `capiro-newstack-preview-clone.cluster-csryw28ai752.us-east-1.rds.amazonaws.com`; serverless v2 0–4 ACU; auto-pause 1800 s) | **Dirty:** 5 migrations applied plus one failed row (20281012020000). **Re-clone before the next Core migrate** (`reclone.sh`). |
| Preview frontend | capiro-frontend **2abf9cdd** (Fable's release record) | `main` has #116 merged and not deployed. |
| os.capiro.ai (capirov2, separate app) | `capiro-dev-web-vnext:478`, GIT_SHA b4af4110 | Not part of this programme. |

**Known live issue:** preview chat turns end ATTEMPT_LOST. The owner hot path takes about 110 s per model request (31 exchanges, about 600 owner AWS calls, 92 Core calls). It's the same on C11. **S1 (P2 #196 + #199, then P1 #200) is the fix.**

## 2. Merged but not deployed

- **capiro-backend `backend-import` 51e265bd:** the consolidated Core plus #107 qualification pins. It's blocked on #108 plus re-clone, migrate and roll.
- **capiro-frontend `main`:** #116 and later.

## 3. Open PRs

| PR | Head | State | Next |
|---|---|---|---|
| meri-greenfield #196 P2 PR-A | ba548925 | dot CODE ACCEPT; ship-request posted | **P2 Docker gates running now (Fable, D3 session).** Then merge #196 → #199 → P2 release (proxy + runtime, pair restart) → notify agent 1 → acceptance packet. |
| meri-greenfield #199 P2 PR-B | bfe98e96 | dot CODE ACCEPT; ship-request posted | Same gate run, on the combined tree. |
| meri-greenfield #200 P1 | ec8b45d2 | Runtime corrections done | After #196/#199 merge: rebase, then the P1-only shared-file exception (O148), then re-review. |
| meri-greenfield #204 M1 runtime | d3f45620+ | Draft, in progress (agent 1) | MR-01 foreclosure receipt semantics are awaiting Neo's confirmation (agent 1's request); Fable's proposal is in comment 6330762076. |
| meri-greenfield #205 contracts provenance | 9ccc8ecf | New (agent 2) | dot review. |
| meri-greenfield (EX-06 manifest PR) | — | Agent 1 is preparing it | All 193 uncovered entries in one PR (O153). |
| capiro-backend #108 Core migration cleanup | 6e962e64 | CHANGES, then the packaging fix pushed | dot re-review. **Critical path for A1 and Phase 0 Core.** |
| capiro-backend #105 A1 Workspace/Settings | ad71e416 | CODE ACCEPT; **deployment HOLD** (descendant ACL gap) | Agent 3 fixes the descendant ACL (O154). |
| capiro-backend #106 A1 Portfolio/Mail | 89f99aa7 | CODE ACCEPT; ship-request posted | Ships inside the Core release after #108 (O153). |
| capiro-frontend #117 A1 | f7b42d81 | CODE ACCEPT | With A1. |
| capiro-frontend #118 A1 | e37c204b | CODE ACCEPT; ship-request posted | With A1. |
| capiro-frontend #119 M1 screens | 5c86f9b3 | CODE ACCEPT; ship-request posted | **BLOCKED gates:** the full Meri browser suite (173 collected) and `next build`. Not run. |
| capiro-frontend #120 M1 integrations | d637c158 | CODE ACCEPT; ship-request posted | **BLOCKED:** the revocation case and the browser suite. An old-head run (870247e3) showed 14 regressions; re-run at the head. |

## 4. Holds and open decisions

- **#105:** Workspace draft-descendant ACL (comments, checks, edit-lock, anonymization) must be fixed server-side before the Workspace release.
- **#108:** must merge before any Core migration on the clone. Only runnable migrations may be in `prisma/migrations`.
- **MR-01:** the Stop receipt for a later run FORECLOSED before any original existed. Fable's proposal: `expiresAtMs` = the foreclosure event time, with no schema change. Agent 1 is waiting on Neo's confirmation.
- **A0 staging:** deferred (plan decision 1). It's raised again at the start of Wave 3.
- **Production data path:** the new stack runs on the clone, whose data diverges from live from the clone date (plan decision 12).
- **Session-refusal alarm metric and status table (MX-01):** not done (Phase 0 items).

## 5. In-flight at handover

- **D3 Claude session** (local_e75c8ab7…): running the P2 gates for #196/#199. It posts PASS/FAIL plus the exact commands on each PR, then ends.
- **Cron in Fable's session:** a 10-minute GitHub check until 09:40 local. Fable deletes it when shipping is released.
- **Disk cleanup:** `cleanup-all-old.ps1` (deleting old worktrees and Downloads `capiro-*` folders; loose files kept). It's harmless and can finish on its own.

## 6. AWS resources Fable created for the new stack (clean up when no longer needed)

- RDS cluster `capiro-newstack-preview-clone` plus instance `capiro-newstack-preview-clone-writer`.
- IAM role `capiro-preview-core-clone-migrate-exec` (ECS execution, plus read of `/capiro/dev/aurora/master` only).
- ECS task-definition families and revisions:
  - `capiro-preview-core-clone-migrate:1–2`;
  - `capiro-preview-first-chat-core:4` (registered, not serving);
  - `meri-product-preview-d2-migrate:8`.
- Aurora snapshot `meri-pre-integration-c12-20261021`.
