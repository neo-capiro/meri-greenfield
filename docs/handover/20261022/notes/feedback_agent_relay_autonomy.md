---
name: feedback-agent-relay-autonomy
description: "Neo 10-21 — Fable plans, checks, merges, deploys; Neo's ChatGPT agents (agent 1–4 v1) build; on every update Fable continues the sequence unprompted and answers agents on GitHub #202"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 57abea96-0ea5-4faa-b2f1-7f8812ef4cd3
  modified: 2026-10-21T19:29:15.110Z
---

From 2026-10-21 the programme follows `C:\dev\fable\adj-reports\FINAL-PLAN-20261021.md`.
- **Neo's ChatGPT agents build:** "agent 1 v1" (Meri runtime core), "agent 2 v1" (Meri domain and proxy), "agent 3 v1" (app: Portfolio, Workspace, Settings, Mail), "agent 4 v1" (Meri screens and Core-for-Meri).
- **Fable plans phases, reviews, merges and deploys. Fable's sessions write no product code** (O121; a stop was needed when C and E were building).
- **dot relays** between the agents and Fable through GitHub issue neo-capiro/meri-greenfield#202 (pinned) and PR comments. Fable's comments start with "FROM: Fable".

**Neo's standing instruction:** "when you get these updates make sure you continue with your sequence by checking, deploying and giving instructions back."

**Why:** waiting on Neo to pass messages stalled the work; he wants the loop to run itself.

**How to apply:**
- Keep the 2-minute GitHub watcher (`ship-kit/tools/watch-github.sh` under Monitor) armed, and re-arm it every 30 minutes.
- On each event:
  - read it;
  - start the review (review-only sessions);
  - on approval, merge and deploy per the plan;
  - post the verdict, change list or next brief on #202 or the PR.
- Every brief carries verbatim ticket text plus `STANDING-RULES.md` (O126). Next-phase tickets are context only.
- Only Neo approves scope. Comments are never approvals.

See [[project-meri-hot-path-phase-workflow]].
