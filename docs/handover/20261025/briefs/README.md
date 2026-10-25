# Prepared phase briefs: ownership, sequence and current release boundary

Prepared **2026-10-25 11:20 UTC**, with a final source metadata read at 11:23 UTC. Documentation branch `codex/wave3-phase-briefs-20261025` starts at fresh Meri remote main `e70dac734ae4efed31ebb3c3bcc5566584a848b5`. This is a docs-only package. No product code, tests, build, migration, AWS operation, email, public coordination post or Wave 3 agent launch occurred here. Handoff author owns the combined draft PR and decision O243; this author owns only this briefs directory.

Neo explicitly authorizes root to orchestrate Wave 3 and start independent existing-plan work when able. Fresh implementation/review sessions use xhigh; root remains Ultra and orchestrates. Independent scoped work can start after exact brief/ownership review on isolated branches. Wave 2 must finish fully and retains release/acceptance priority. Root sends the completion notice with actual final source/contracts/images/configuration and deployed acceptance before dependent integration/release work resumes. There is no blanket hold on disjoint Workspace/data/UI work.

## Current Wave 2 checkpoint and role briefs

Schedule1 startup returned exit3 / `RUNTIME_UNAVAILABLE`; the separate local exact-URI diagnostic failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, while composite-CA `SELECT 1` passed. Internal ECS stack trace and sole-failure attribution remain unproven. Root allocated application change-set cancel/rollback to control67/worker63, remove failed Schedule1 and restore endpoint4, preserving Core12, applied DB migrations, FE29 and DNS state. These are instructions, not claimed execution receipts. Schedule repair source was observed clean at `51b059063629cf7b7a1370ae54ae9a82624a3bff`, parent `7559e7c397c74a60231997926ddd5613cdb05b68`. Review, successor image/material, deployed Schedule health, retention activation and final acceptance are not established by this document. The [current handoff](../WAVE-2-HANDOFF.md) owns later checkpoint truth; this link resolves in the combined handoff branch.

| Current agent/phase | Brief | Remaining boundary |
|---|---|---|
| Release Execution | [Release operator](W2-RELEASE-OPERATOR.md) | Sole AWS writer; actual containment/readbacks, successor release only when allocated; no new product build plan here |
| Authenticated Acceptance | [Acceptance](W2-ACCEPTANCE-OWNER.md) | Preserved sessions/checklist; wait for coherent new pins and deploy-free window; fixtures/physical-erasure gaps explicit |
| Runtime and Objectives | [Retention route author](W2-RETENTION-ROUTE-AUTHOR.md) | Offline bounded one-off adapter; stale control68 assumption must be rebound to actual qualified successor |
| Primary Independent Review | [Retention route review](W2-RETENTION-ROUTE-REVIEW.md) | Exact artifact review pending final candidate/current control readback; no AWS |
| Schedule trust author | [Schedule repair](W2-SCHEDULE-TRUST-AUTHOR.md) | Narrow nine-file CA startup delta; source inspection is not source verdict or release acceptance |
| Independent Schedule reviewer | [Schedule review](W2-SCHEDULE-TRUST-REVIEW.md) | Exact base/head review and affected mutation checks; no reopening unrelated accepted gates |

Current role references are names only; no public chat UUIDs or customer-linked identifiers. Root alone communicates dispatch/completion to the user-owned chats. These brief files do not request cross-chat messages.

## Prepared source observations and refresh obligation

| Repository | Accepted source inspected | Remote default observed at 11:20 UTC | Meaning |
|---|---|---|---|
| Meri | `7559e7c397c74a60231997926ddd5613cdb05b68` | `main` `e70dac734ae4efed31ebb3c3bcc5566584a848b5` | Accepted candidate differs from remote main; Schedule repair is a later unqualified candidate |
| Core | `025ae90fc7bf85c91a5f60eaf949cc7effa1d330` | `backend-import` `2edec026c912c2f6155a6ac8d04ae08bc70030b3` | Remote has no `main` ref; use actual default/integration branch, not a fabricated main |
| Frontend | `e478e4d73132bd1566b3945d63c5e0a3a1306cc1` | `main` `d01ea5544b64008ed0a72ae4e6c5af30d8ba64a1` | Accepted source differs from default branch; final release pins still require readback |

Before **each send**, root refreshes remote default/integration and dependency heads, chooses the actual isolated base, checks current open PRs/owned files and records UTC/SHA in that agent's header. Never call a prepared SHA future-refreshed. Read-only `git show` was used for sparse Core Workspace/Onboard files; missing filesystem entries were not treated as missing source. Host AGENTS and private readiness/operator evidence remain with their existing owners. Public sources are the linked plans/register in each brief.

## Maximum-safe parallel allocation

Four cohesive implementation lanes, with one separate independent reviewer per exact final candidate as capacity allows. Lane names are proposed allocations, not permission for recursive agents. Shared-file writes are serial even while other source work proceeds.

| Lane / one agent-phase | Independent work allowed after dispatch | Owned source boundary | Prerequisite/serialized work |
|---|---|---|---|
| [A3 Core/Workspace domain](W3-A3-DOMAIN.md) | Reconcile existing WS owners; bounded ordinary document/library/collaboration/export/system-mail changes | Core repo Workspace service directories; Workspace-collab and onboarding email; exact newsletter stage seam | Sole Core shared contracts/manifests/lockfile/schema/forward migration writer; publishes save/revision/access/receipt contracts before dependent UI |
| [M3 data/tools](W3-M3-DATA.md) | Existing 84-operation/48-family reconciliation; local typed family semantics and actual owner discovery | Meri gateway read families/sources/public data contracts; disjoint Core Meri/data reader files | Sole Meri contract/export/lockfile writer; MG-06 index-intent file owner remains unverified until bounded trace/root allocation; Core schemas via A-domain; frozen runtime edits require named exception |
| [M3 citation/evidence UI](W3-M3-CITATIONS-UI.md) | Source-read investigation; safe presentation and tests against existing typed receipts | Meri conversation/source/workspace projection and citation UI/receiver tests in frontend | Wait for accepted D evidence contract and U-Workspace shared dependency/export commit; actual integrated source reads/deployment await completion notice |
| [A3 Workspace UI](W3-A3-WORKSPACE-UI.md) | Existing editor/library/route/recovery investigation and bounded independent presentation/consumer work | Workspace features/fixed operations/tests plus exact stage-open route | Sole frontend manifests/lockfile/shared registry/export writer; Plate editor ownership; A-domain atomic write contracts precede enabled mutation consumers |

**Order:** root records actual base/ownership → A-domain and D-data reconcile/publish minimal contract changes while UI authors inspect existing inputs → U-Workspace integrates the single approved frontend dependency/export change → both UI branches rebase on that commit, then edit disjoint features → dependent API/UI consumers integrate only on accepted pinned contracts → independent exact-head review → root integrates in contract/domain, data, UI order → affected local gates → root-allocated Release qualification/deploy → Acceptance. Work independent of the unfinished Wave 2 release can run now; final successor contract adoption/rebase/release waits root's completion notice. Reuse completed evidence; do not create a new release framework.

**Named shared-file exceptions:** A-domain alone writes all needed Core/Workspace/Onboard schema/migrations and `packages/shared` Workspace/newsletter contracts; D sends narrowly specified changes rather than editing them. D alone writes Meri public data contracts and related exports/manifests. U-Workspace alone writes frontend package manifests/lockfile/shared operation registry/UI exports; U-Citations receives citation component ownership after that baseline. Root numbers/orders migrations and never edits applied history. No new shared-shell or runtime exception is granted. Newly discovered overlap is resolved before editing. Reviewers write no product files.

## Open PR observations and rebase order

GitHub read-only search returned many historical open drafts, capped at100. The following relevant candidates were individually read for exact current heads during preparation. This is not a claim of exhaustive PR inventory, current merge eligibility or need to merge any historical stack. Root must reconcile final delta/ancestry against accepted source and refresh before dispatch. Unverified conflict/ownership is **BLOCKED for the affected shared edit/integration**, not for independent work.

| Repository / draft PR | Observed exact head | Base branch | Treatment |
|---|---|---|---|
| Meri [238](https://github.com/neo-capiro/meri-greenfield/pull/238) | `f6e849afd56d6e7484acdb28f2b14fcd1d4567a2` | main | MG05 context lineage; reconcile already accepted successor, no duplicate merge |
| Meri [228](https://github.com/neo-capiro/meri-greenfield/pull/228) | `5d6bc28ea5cc516f2b1f81e8bdb23421c4090f8d` | main | Experiment-only SDK spike; do not merge/restart |
| Meri [215](https://github.com/neo-capiro/meri-greenfield/pull/215) | `ac724cbcfced98a6e5aa8b7d60a9ce3c65fb0f2b` | main | Historical M2 checkpoint; do not replay obsolete harness |
| Core [113](https://github.com/neo-capiro/capiro-backend/pull/113) | `0dd24f50a0d0da4b69d1c6f3613be9b0c34baf8d` | backend-import | General/management lineage; compare accepted Core before new branch |
| Frontend [134](https://github.com/neo-capiro/capiro-frontend/pull/134) | `8424299960ac09dc7996231092f35ac976aab5dd` | codex/general-frontend-20261024 | Mail visible slice; shared-operation conflicts require root reconciliation |
| Frontend [133](https://github.com/neo-capiro/capiro-frontend/pull/133) | `abca9ab93cc51b6cbee1e459cb306c71e5bc6636` | codex/general-frontend-20261024 | Settings visible slice; no wholesale replay |
| Frontend [124](https://github.com/neo-capiro/capiro-frontend/pull/124) | `4a6a6fae8bf7a493c23268ec04c80a4dd0cbce97` | main | A2 historical UI; reconcile already integrated changes |
| Frontend [123](https://github.com/neo-capiro/capiro-frontend/pull/123) | `bdcad07fec4f248d7b82fb7cb7ad98f4fd61be09` | main | M2 historical UI; do not restart M2 in Wave3 |
| Frontend [103](https://github.com/neo-capiro/capiro-frontend/pull/103) | `442f188c6636ee4d34566e92aad34261d2dd402a` | codex/non-meri-functional-gap-20261018 | Campaign edit lineage; inspect pending-edit behavior before WS20 changes |

No safe instruction exists to rebase these old PRs in numerical order. The safe rebase target is root's actual accepted integration baseline, after ancestry/delta reconciliation. New Wave3 order is the owned contract/domain/data/UI sequence above; merge only the exact reviewed final candidate through root.

## Ticket/register coverage and scope decisions

FINAL-PLAN §5 M3 assigns MT-01, MT-04–09, MT-16, MO-14/15, MG-06, MF-16 and MX-03 dependencies. A3 assigns WS-05–21 and ML-24. The historical “Wave3 M2/V1” hosting work is now Wave2 and is not restarted. Every allocated ticket is quoted in its lane brief with register disposition. Full standing sections1–4 appear at the top of every actual brief and template example. Reference rows below were located in the accepted master source, not assumed from the dispatch's earlier line hints.

| Ticket | Master line | Register decision / lane |
|---|---:|---|
| WS-05 | 1572 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-06 | 1582 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-07 | 1592 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-08 | 1602 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-09 | 1612 | Register §E: no app ticket wholly superseded. FINAL-PLAN decision 11 / O143 removes Workspace approvals and overrides WS-09 approval text. Keep current wall/ownership/share protections and stored approval history; no new approval workflow or unapproved data drop. |
| WS-10 | 1622 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-11 | 1632 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-12 | 1642 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-13 | 1652 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-14 | 1662 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-15 | 1672 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-16 | 1682 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-17 | 1692 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-18 | 1702 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-19 | 1712 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-20 | 1722 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| WS-21 | 1732 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| ML-24 | 3088 | UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals. |
| MT-01 | 3189 | RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms. |
| MT-04 | 3231 | RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms. |
| MT-05 | 3245 | RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms. |
| MT-06 | 3259 | RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms. |
| MT-07 | 3273 | RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms. |
| MT-08 | 3287 | RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms. |
| MT-09 | 3301 | RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms. |
| MT-16 | 3396 | RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms. |
| MO-14 | 1397 | UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them. |
| MO-15 | 1410 | UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them. |
| MG-06 | 859 | UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them. |
| MF-16 | 2413 | UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them. |
| MX-03 | 3985 | UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them. |
| MX-05 | 4009 | RE-SCOPED — register §B1; exact source/image, Runtime V1 readiness and remaining secrets only. Removed registry/pair/issuer/task-proof machinery is excluded. |
| MX-06 | 4022 | RE-SCOPED — register §B1; exact source/image, Runtime V1 readiness and remaining secrets only. Removed registry/pair/issuer/task-proof machinery is excluded. |
| MX-07 | 4035 | RE-SCOPED — register §B1; exact source/image, Runtime V1 readiness and remaining secrets only. Removed registry/pair/issuer/task-proof machinery is excluded. |
| MX-10 | 4073 | UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them. |
| MX-11 | 4085 | UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them. |
| MX-12 | 4097 | UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them. |
| MM-07 | 3724 | UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them. |

Decision11/O143 removes Workspace approvals even though register §E says no entire app ticket is superseded. WS09 share/current wall behavior remains; stored approval data stays until a separately approved drop. WS11's WS22 generation dependency, WS19's later full Outreach send/review lifecycle, optional provider qualification and ML24's explicit sending approval are preserved as dependencies, not silently implemented or dropped. Broader M4 actions/full mail/new send, M5 generation and M6 governance are not allocated. Legacy Intel, Stage-G and Context Import generation are not automatically Wave3 scope.

## Checks and real open questions

This author ran source/head/default-branch reads, bounded plan/register/code/test-path inspection, document generation, full-rule/ticket-quotation/link/coverage/sensitive-identifier checks and `git diff --check`. Final results are returned with the exact commit; no product tests, builds or environment setup ran. Existing test names are starting owners; proposed new paths are labeled. The independent reviewer must review the final combined exact head.

Open dependencies: actual final Wave2 completion pins/acceptance; exact MG06 current index-intent file owner; any unsupported connector's actual canonical provider owner/entitlement; unprovided Figma/library prerequisite; explicit optional mail/provider sending authorization and fixtures. In-plan implementation choices are decided/logged through root. New scope/security/product tradeoffs go to Neo directly. Missing live receipts are not proof of missing implementation. None of these blocks unrelated disjoint work.

[PROCESS6.1 brief / 6.2 verdict / 6.3 acceptance examples](90-PROCESS-EXAMPLES.md) use current roles and no public customer-linked identifiers. Branch/worktree persists; no shared resources were cleaned up.
