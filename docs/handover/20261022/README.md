# Fable → dot handover (2026-10-22)

> **Update 2026-10-23 (Neo).** Planning, delegation and shipping for Wave 2 and later moved to a local Codex orchestrator (not dot). **Before anything else read `STANDING-REQUIREMENTS.md`** (Claude handles the harness; a simple, standard architecture; leave no dead code; Capiro data must keep working), then `WAVE-1-HANDOFF.md` and `WAVE-2-HANDOVER.md`. The plans were updated in place: `source-of-truth/SUPERSEDED-BY-ITEM-0.md` lists every ticket, scenario and plan row that Wave 2 item 0 supersedes. Documents below that describe the owner/proxy pair, P1/P2, the temporal-issuer or per-operation authority are history for layers being deleted.

Neo confirmed directly to Fable (2026-10-22 ~02:10 UTC) that **planning, delegation and shipping move from Fable (Claude) to dot and dot's ChatGPT/Codex sessions**. This folder is Fable's complete working set: the plans, the process Fable actually followed, the shipping runbooks and tools, the current state, and the known traps.

Nothing here contains secrets. Credentials, rendered secret bundles and private deploy inputs are referenced by name or location only (see `SHIPPING-RUNBOOK.md` §1).

## Read in this order

| # | File | What it is |
|---|---|---|
| − | `STANDING-REQUIREMENTS.md` | **Read first.** Neo's requirements for all work, 2026-10-23. |
| − | `WAVE-1-HANDOFF.md`, `WAVE-2-HANDOVER.md` | Where Wave 1 stopped, and the Wave 2 plan, state and traps. |
| 0 | `WORKFLOW.md` | **The end-to-end workflow:** roles, documents, communication, how a piece of work moves, who decides what, lanes, waves, escalation. Start here. |
| 1 | `CURRENT-STATE.md` | What's live, what's merged but not deployed, open PRs and their review state, holds, and in-flight operations at handover. |
| 2 | `source-of-truth/` | **The authoritative specs:** the two master closeout plans (20261021), plus `STANDING-RULES.md` (verbatim sections from both). Every ticket ID (MR-, MF-, MT-, MX-, MG-, MM-, WS-, PF-, ML-, ST-, E01–E45) is defined there. |
| 3 | `plan/FINAL-PLAN-20261021.md` | The approved phased plan: phases, the seven-wave table, lanes, simplifications, Neo's decisions (§8) and the full ticket→phase index (§9). Also published at https://claude.ai/artifact/2LDTPZ43afpp2MW2YJaP8C (v4). |
| 4 | `PROCESS.md` | The exact steps Fable used to plan phases, write briefs, route reviews, manage lanes and file ownership, resolve blockers and decide readiness, with templates. |
| 5 | `SHIPPING-RUNBOOK.md` | Exact shipping procedures for the Meri runtime/proxy, preview Core, preview frontend and the databases (snapshot, clone, migrate), with rollback, health gates and the acceptance-packet format. |
| 6 | `phases/` | Every brief, ticket extract, change list, validation report and review Fable produced (Phase 0, P1, P2, P6-Core, A1, M1, Wave 1). `p2a-harness/` holds the Docker gate harness used for the P2 pinned-image gates. |
| 7 | `shipping/` | The tools: the Meri ship-kit generator (`make-ship-kit.mjs`, `kit.mjs`, `tools/release-candidate.sh`), the proxy kit generator, the frontend kit generator, the Core kit (as adapted for the clone), the eb657920 release scripts as a worked example, and the read-only DB ledger scripts. |
| 8 | `decision-log/DECISION-LOG.md` | Every decision O48–O155 with its reason and rollback, chronological. Search it before re-deciding anything. |
| 9 | `notes/` | Fable's working notes on traps and environment facts (owner/proxy pair restart, preview edge allowlist, rollout traps, test environments, Windows/WSL issues, AWS profile). Read them before your first ship. |

## The handoff line (historical; superseded by `WAVE-1-HANDOFF.md`)

Fable finishes only (1) the P2 ship-gate run for #196 ba548925 and #199 bfe98e96 (running in a Claude session; results get posted on #196 and #199), and (2) this package. After that, Fable posts **SHIPPING RELEASED** on #202 and stops starting shipping operations.
