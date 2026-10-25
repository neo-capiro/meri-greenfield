# Fable → dot handover (2026-10-22)

> **25 October current entry point:** [Wave 2 in-progress handoff](../20261025/WAVE-2-HANDOFF.md), [user acceptance checklist](../20261025/WAVE-2-USER-ACCEPTANCE.md) and [current PROCESS templates](PROCESS.md#6-current-templates). Root only orchestrates at Ultra; helpers use xhigh; existing Release is the sole AWS operator. The dated receipts/roles below are historical where superseded; no #202 post without Neo.

> **Update 2026-10-23 (Neo).** Planning, delegation and shipping for Wave 2 and later moved to a local Codex orchestrator (not dot). **Before anything else read `STANDING-REQUIREMENTS.md`** (Claude handles the harness; a simple, standard architecture; leave no dead code; Capiro data must keep working), then `WAVE-1-HANDOFF.md` and `WAVE-2-HANDOVER.md`. The plans were updated in place: `source-of-truth/SUPERSEDED-BY-ITEM-0.md` lists every ticket, scenario and plan row that Wave 2 item 0 supersedes. Documents below that describe the owner/proxy pair, P1/P2, the temporal-issuer or per-operation authority are history for layers being deleted.

**Execution on the new host:** Codex on EC2AMAZ-M7CDRPT is the sole orchestrator, with bounded implementation lanes and independent reviewers. Root only orchestrates at Ultra; helpers use xhigh; existing Release alone executes AWS. Use AWS profile `default`, account `967807252336`, region `us-east-1`. Neo authorized autonomous Wave 2 implementation, qualification, integration, migrations and shipping; the earlier AWS-write hold is lifted. The package includes archived executable kits and configuration, not only prose. Their presence is not qualification for a new release: inspect, regenerate and gate each current recipe against its exact source and live baseline. Never execute old release folders or removed-component steps merely because they were copied here.

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
| 5 | `SHIPPING-RUNBOOK.md` | Current Codex release sequence, canonical source tools, private-input handling, clone-only migrations, rollback and live acceptance requirements. |
| 6 | `phases/` | Briefs, ticket extracts and historical validation reports. The P2 image verifier and its launcher were removed with the obsolete image-proof pipeline; the remaining proxy-specific harness needs the separate proxy deletion audit. |
| 7 | `shipping/` | Core/frontend reference kits, retained private-input and ledger helpers, and dated release evidence. The old active Meri pair/measurement kit and launcher are removed. Current builds use the checked-in image buildspec and shell script. |
| 8 | `decision-log/DECISION-LOG.md` | Every decision O48–O155 with its reason and rollback, chronological. Search it before re-deciding anything. |
| 9 | `notes/` | Fable's working notes on traps and environment facts (owner/proxy pair restart, preview edge allowlist, rollout traps, test environments, Windows/WSL issues, AWS profile). Read them before your first ship. |

## The handoff line (historical; superseded by `WAVE-1-HANDOFF.md`)

Fable finishes only (1) the P2 ship-gate run for #196 ba548925 and #199 bfe98e96 (running in a Claude session; results get posted on #196 and #199), and (2) this package. After that, Fable posts **SHIPPING RELEASED** on #202 and stops starting shipping operations.
