---
name: project-meri-c11-two-turn-chat-works
description: 10-21 17:45Z greenfield Meri candidate 11 (main bce70776) passed a live two-turn chat with memory; known open gaps and test tricks
metadata:
  node_type: memory
  type: project
  originSessionId: 57abea96-0ea5-4faa-b2f1-7f8812ef4cd3
  modified: 2026-10-21T17:46:32.019Z
---

**Two-turn chat works live** on portfolio-preview (candidate 11, greenfield `main` `bce70776`, shipped 17:20Z 10-21): turn 1 → turn 2 sent immediately → correct recall ("PELICAN"), reload keeps history. Timings ≈ 10 s accepted, ~85–93 s runner running, ~195 s first text, ~225–233 s done (speed = P1/P2/pool work).

**Turn-2 needed four fixes, found one live failure at a time:** journal claim state (96b6da6d), SDK `claude-resume-*` under `/tmp` vs the `/run/meri` policy (3c56c3e9), the deploy pin on conversations (E §4b), and a reserved turn across a deploy (C F1). See [[project-meri-hot-path-phase-workflow]].

**Open (10-21):**
- **C12:** an unstarted original (the first session issuance claims it) is immutable, single-use and expires in ≤ 15 min, or on a config/policy change. The conversation is then bricked forever. The fix needs migration 0020 (`adj-e-C12-UNSTARTED-ORIGINAL.md`).
- **Preview admits one configured client (Anduril).** "New conversation" is disabled; Core bootstrap creates a new conversation per new requestId.

**Test trick:** the bootstrap requestId lives in the tab's **sessionStorage**, so a **fresh browser tab = a new Core conversation**, which escapes a bricked one without DB surgery. Every refused issuance now logs `CONTROL_SESSION_REFUSED step=… code=…` in `/meri/product-preview/control`.

**Release tooling traps:** the release script needs `C:\dev\fable\wt-candidate` (keep it). Never export `MSYS_NO_PATHCONV` before `release-candidate.sh` (it mangles node paths). The proxy kit idle check needs no `--sort-order` (pagination); the repo fix is in PR197.
