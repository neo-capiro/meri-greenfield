# Current state at handover (2026-10-22 ~02:30 UTC)

> **HISTORICAL (superseded 2026-10-23).** This file describes the preview as of 2026-10-22. Some of its instructions are now WRONG: for example "Re-clone before the next Core migrate". **Never delete or re-clone the new-stack clone database**; snapshot, then migrate forward in place. Do not act on it. Read `STANDING-REQUIREMENTS.md`, `WAVE-1-HANDOFF.md` and `WAVE-2-HANDOVER.md` instead.

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
