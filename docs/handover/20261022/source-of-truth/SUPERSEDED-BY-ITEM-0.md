# Superseded by Wave 2 item 0: register (Neo, 2026-10-23)

**Why this exists.** The two master closeout plans, `STANDING-RULES.md` and `FINAL-PLAN-20261021.md` were written for the architecture Neo has now decided to replace. Wave 2 agents implement "each ticket's bounded work and meet its acceptance exactly", so an old ticket followed literally rebuilds code that item 0 deletes. This register, plus the inline markers in the plans, stops that.

**Principle.** Behaviour and quality stay binding: the E-scenarios, the RG gates, the original release suite and every product acceptance. The mechanisms that existed to protect, measure or speed up the removed layers are superseded. Neo's requirements are in `../STANDING-REQUIREMENTS.md`. The spec that replaces the layers is `../phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`.

**Legend**

| Marker | Meaning |
|---|---|
| **SUPERSEDED** | Do not implement, extend, qualify or measure. Keep only the behaviour named under "keep as acceptance". Close the ticket as superseded; don't leave its code dormant. |
| **RE-SCOPED** | The behaviour is still required. Implement it on item 0's architecture. Ignore any instruction in the ticket that names a removed component. |
| **DONE** | Shipped already. Informational. Its code may be deleted by item 0. |
| (unlisted) | Unchanged. If its text still names a removed component in an implementation instruction, follow the intent and implement it on item 0's architecture. |

Each marker also appears inline in the plan, directly under the ticket heading, in the index rows and on the scenario rows. If the inline marker and this register differ, ask on #202.

---

## A. Components deleted by item 0

Do not build, extend, qualify, measure or preserve any of these. The paths are a starting inventory taken from `main` at `05d588c7`; confirm with the import graph and delete leaf-first.

| Component | Where it lives (inventory) | Replaced by |
|---|---|---|
| Owner/proxy pair (model credentials, per-call admission, reservations, CountTokens, retries, mTLS pair) | `apps/proxy/**`; `apps/runtime/model-grant-issuer.mjs`, `pinned-native-transport.mjs`, `native-runner-gateway.mjs`; services `meri-product-preview-owner` and `-proxy`; the private PKI (`meri/preview/private-pki`); `infra/product-preview/first-chat-private-edge.mjs` and `OWNER-INTERFACE-CLOSURE-*` | SDK → Bedrock directly, using the runner task's IAM role |
| Budget reservation, settlement and liability recovery | `apps/gateway/budget/**`, `apps/gateway/model-proxy/**`, `infra/product-preview/first-chat-seed-budget.sql` and its consumers | SDK `maxTurns` / `maxBudgetUsd` per run; one tenant ledger row per run, debited from the SDK result; the tenant monthly cap checked at admission |
| Per-operation authority | `apps/runtime/native-authority/**`; `read-credential-relay.mjs`; `prepared-run-*`, `prepared-candidate*`, `prepared-next-run`, `original-run-preparation`, `original-stop`, `task-bootstrap` in `apps/runtime/` | One Core access check per turn in control; SDK `allowedTools` / `canUseTool` / hooks; Core enforcement on every tool call. **Review, don't delete wholesale:** `apps/control/admitted-runs/**` and `apps/control/action-host/**` serve the browser's action-session and submit routes (`/api/action-followthrough/*`) and idempotent submit (E03). Keep what the browser still needs and delete the pin, producer-grant and capability-hash machinery inside them once the import graph shows it unreachable. Also review `memory-context-relay.mjs` and `occurrence-relay.mjs`: routines still need consent-bound reads |
| Temporal issuer | `apps/runtime/temporal-issuer/**`, `temporal-issuer-cli.mjs`, `temporal-product-*`, `temporal-authorization.mjs`; `infra/product-preview/first-chat-issuer-service.mjs`; service `meri-product-preview-temporal-issuer` | Temporal's standard auth: an mTLS client certificate or a namespace API key from Secrets Manager |
| P1 timeout/budget table, P2 proof reuse and exchange collapse, authority-lite (S2), signed lease (S4) | P1 #200 and C9 #203 (open; **do not merge**). Already merged, to be deleted with the layers: P2 PR-A #196 and S2 #213 (P2 PR-B #199 was closed unmerged) | Nothing. They only existed to make the removed layers fast enough |
| Custom checkpoint / dormant-original continuity | `apps/runtime/sdk-first-session.mjs`, `sdk-continuation-session.mjs`, `sdk-session-runtime.mjs`, `checkpoint-session-factory.mjs`; `apps/worker/conversation/continuation/**` | SDK `resume` / `forkSession`, with the SDK session id stored on the conversation. Conversation storage stays |

**Keep and simplify:** `apps/worker/conversation/` (the SDK activity), control's conversation, event and stream code, `apps/gateway/sources/*` (the read handlers become tools), the artifact and document generation code, Temporal itself, and the migrator.

---

## B. Meri closeout plan: `Capiro-Meri-Wiring-Closeout-Plan-20261021.md`

### B1. Tickets

| Ticket | Disposition | Keep as acceptance | Dropped |
|---|---|---|---|
| **MR-01** historical stop-only retirement | **SUPERSEDED** | A Stop sent for a run that began before a deploy works (E10) | The config-SHA / facts-hash pins the ticket repairs no longer exist |
| **MR-02** transient-authority classification in the control pump | **SUPERSEDED** | A transient Core outage retries with bounded backoff inside the run deadline; a definitive refusal fails at once | The authority-availability marker and the per-operation authority layer |
| **MR-06** durable lifecycle outcome readback | **RE-SCOPED** | Outcome readback and recovery after process or request loss | Temporal plus the conversation DB are the durable record; drop the prepared-run registries |
| **MR-07** checkpoint / dormant-original continuity | **SUPERSEDED** | The next turn after a deploy continues the conversation. An SDK upgrade needs the transcript-recap handover first (O103). An incompatible state shows a clear message | Admitting render, reserved successor, mirror append and dormant-original states |
| **MR-08** admission-to-next-turn lifecycle suite | **RE-SCOPED** | Behavioural crossings: duplicate submit, ACK loss, Stop repeated, stream reconnect with cursor, next turn after a failed or cancelled turn, deploy between turns, pause/resume/fork | Crossings that exist only for kickoff claim/lease, allocation and grants, native currentness, terminal usage capture |
| **MR-09** provider terminal accounting and unresolved-liability recovery | **SUPERSEDED** | Each run's cost comes from the SDK result and is recorded once. The tenant cap is enforced. A turn is never failed because accounting is uncertain | Reservations, UNKNOWN liability, quarantine, CountTokens basis |
| MT-01 installed capability set as release truth | **RE-SCOPED** | The tool list a user's run can call is the release truth, served by the tool gateway | "Measured installation", discovery through "the actual pinned proxy" |
| MT-02 selected-read composition (PR197) | **DONE / RE-SCOPED** | Read handlers stay | The authority composition around them |
| MT-03 to MT-09, MT-16 read families | **RE-SCOPED** | Same behaviour and acceptance, implemented as tools on the tool gateway | Extending native-authority or the relays |
| MT-10, MT-11, MT-12 task and schedule actions | **RE-SCOPED** | Approval, durable receipt, no blind redispatch | Approvals go through the SDK permission callback plus Core intents; no per-operation grant minting |
| MM-01, MM-13 "current-authority reads" | **RE-SCOPED** | Memory and attachment reads are scoped to the current actor, client and permissions | Core decides on each tool call; no authority receipt layer |
| MO-10 complete-job cost, context integrity, fair capacity | **RE-SCOPED** | Cost ceilings, context integrity, fair capacity | SDK limits plus one tenant cap, SDK compaction, runner pool limits |
| MO-11 retire obsolete runtime code | **KEEP, now** | Item 0 step 5 is its largest instance. Do it with item 0, not at L4 | — |
| MF-02 identity, exact-run renewal, access-loss isolation | **RE-SCOPED** | A revoked user loses access within 30 s | Ordinary Clerk session refresh plus one Core access check per turn; drop "exact-run renewal" |
| MF-10 public lifecycle consumer | **RE-SCOPED** | Pause, resume and fork controls | Consume item 0's lifecycle DTOs |
| MX-05 exact image and capability measurement | **RE-SCOPED** | Exact-digest image scan and source-to-image proof | "Capability measurement" of the removed registry |
| MX-06 topology, readiness, control scale | **RE-SCOPED** | Readiness and control scale. The warm runner pool (S3) stays | Pair and issuer topology |
| MX-07 material expiry, renewal, PKI rotation | **RE-SCOPED** | Expiry and rotation for the secrets that remain (Core service secret, Temporal credential, Clerk) | Pair mTLS PKI and issuer tokens |
| MX-09 latency, cost, resource measurement | **RE-SCOPED** | Measure on the new path against the targets in `../STANDING-REQUIREMENTS.md` §6 | "Without duplicating P1/P2" (they are gone) |
| MX-02 receive existing source once | **DONE** | — | — |

Unlisted Meri tickets (MG, MB, MO except MO-10/11, MF except MF-02/10, MT-13 to MT-15, MM except MM-01/13, MR-03/04/05/10, MX-01/03/04/08 and 10 to 14) are unchanged. MR-04 (routine read consent) must be implemented against the tool gateway's run token.

### B2. Scenarios E01–E45

| Scenario | Disposition | Note |
|---|---|---|
| E09 image-only release after a completed turn | KEEP | The conversation continues after a deploy |
| **E10** deploy or rotation while an old run is in flight | **RE-SCOPED** | Stop works and the run closes or resumes cleanly. No pins |
| **E11** SDK, CLI or format incompatibility | **RE-SCOPED** | A clear message and a recap or new-chat choice (O103); no silent session loss |
| **E18** read active-set and revoked operation | **RE-SCOPED** | The tools a user can call are those Core allows for that user and client; a revoked tool refuses |
| **E39** owner/proxy partner replacement | **SUPERSEDED** | There is no pair |
| **E40** budget / terminal usage missing or contradictory | **SUPERSEDED** | Replaced by: a missing SDK usage charges the per-run cap, and the user's turn is never failed by accounting |
| **E42** forward rollback and schema compatibility | **RE-SCOPED** | Drop "retained liabilities"; keep forward rollback and receipts |
| All others | KEEP | |

### B3. Sections and rules

| Where | Disposition | Replacement |
|---|---|---|
| "Architecture to preserve" items 3 and 4 (worker → "allocation/claim/lease"; gateway/domain owner → "budget/liability and receipt") | **SUPERSEDED** | Runner runs the SDK; tools go through the tool gateway to Core |
| Trace table rows "Chat / follow-up" (`run/claim/SDK model proxy`) and "Read/search" (`one-use delegated Core or retained authority … budget settlement/current release`) | **RE-SCOPED** | Chat: control → runner (SDK) → Bedrock → durable events. Read: tool gateway → Core with the run token; Core enforces scope |
| Stage B "Close authority, durable receipt and recovery foundations" (its runtime bullets) | **SUPERSEDED** | The frontend, commands, memory and QA bullets stay |
| Operator gate O3 "PKI material" | **RE-SCOPED** | Only for the secrets that remain |
| Definition of done #3 "Fresh tenant/actor/client/run authority through every hop" | **SUPERSEDED** | Core enforces tenant, actor and client scope on every data call; the harness doesn't re-verify at each hop |
| Definition of done #5 "UNKNOWN with read-only reconciliation" | **RE-SCOPED** | Applies to writes and external effects, not to model spend |
| R-06 "native SDK deferred discovery through the actual pinned trusted proxy" | **RE-SCOPED** | SDK tool discovery directly against Bedrock |
| RG-08 "actual-proxy compatibility" | **RE-SCOPED** | Compatibility against Bedrock through the SDK |
| REL-05 "first runtime/proxy checkpoint" | **RE-SCOPED** | The spike in item 0 step 1 |
| "Performance/cost: 100% attempt usage including failures" | **RE-SCOPED** | Usage comes from the SDK result |

---

## C. `plan/FINAL-PLAN-20261021.md`

| Item | Disposition | Note |
|---|---|---|
| **S1** (P1 table, P2 PR-A) | **SUPERSEDED** | P2 PR-A (#196) is merged and shipped. P1 #200 and C9 #203 are open and must not be merged. MX-08 dashboards stay |
| **S2** (P2 PR-B, authority-lite) | **SUPERSEDED** | P2 PR-B #199 was closed unmerged; S2 #213 is merged and shipped. Replaced by one Core access check per turn |
| **S3** warm runner pool | KEEP | Fargate cold start is about 60 s of every first turn. Re-measure after item 0 |
| **S4** | **SUPERSEDED** | |
| **M1** | **RE-SCOPED** | MR-01, MR-02, MR-09 are superseded; MR-06, MR-08 are re-scoped. E01–E12 and E40 follow B2 |
| **MP** | **RE-SCOPED** | The Claude API path is an SDK provider setting, not a proxy feature (see the MP brief) |
| **M3** | **RE-SCOPED** | Read families become tools on the tool gateway |
| **M4** | **RE-SCOPED** | Approvals via the SDK permission callback plus Core intents |
| **L1** | **RE-SCOPED** | MX-05/06/07/09 follow B1; the release packet no longer includes pair or issuer material |
| Lanes R and D | **RE-SCOPED** | Lane D's `apps/proxy` ownership ends when item 0 deletes it |
| §7 rows ADR P3 / P4 | **SUPERSEDED** | |
| §8 | Decisions 13–15 added (2026-10-23) | |

## D. `source-of-truth/STANDING-RULES.md`

"Architecture to preserve" items 3 and 4, the Chat and Read trace rows, owner-map rows for P1 and P2 and for action-session authority, and Definition of done #3 and #5 are rewritten there in the same way as B3.

## E. App plan (Portfolio, Workspace, Settings, Mail)

No ticket is superseded. Where it says "canonical Meri context contract", read context (tenant, client, entity ids) and not an authority token. "Do not implement competing authority DTOs" now means: don't build authority machinery for Meri entry points.
