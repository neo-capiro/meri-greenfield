---
name: project-meri-hot-path-phase-workflow
description: "Meri hot-path redesign runs phase by phase — Fable writes each phase's detailed plan, Neo's other agent implements, Fable validates, then the next phase"
metadata:
  node_type: memory
  type: project
  originSessionId: 57abea96-0ea5-4faa-b2f1-7f8812ef4cd3
  modified: 2026-10-20T23:24:04.819Z
---

From 2026-10-20 (after the candidate 6 live chat test), the accepted redesign `C:\dev\fable\adj-reports\ADR-HOT-PATH-REDESIGN.md` (P0–P6) is executed as a loop per phase:
1. Fable (me) writes a detailed, self-contained phase plan.
2. Neo hands it to **his other implementing agent**.
3. I validate the result: code review, the 24-case image gate, rehearsals, then ship to preview and check live with P0 telemetry.
4. Only then does the next phase start.

I must tell Neo whenever phases can run in parallel.

Context:
- Neo delegated the phase decisions to me with a production-grade bar and "no more unnecessary testing paths" (DECISION-LOG O55).
- I remain the sole AWS operator/shipper ([[feedback-meri-all-claude-dot-out]]).

**Why:** Neo wants a separate implementer, with me as planner and gatekeeper, after ~28 integration bugs surfaced in one day.

**Agents (10-20, O66):**
- All phases go to Neo's external (non-Claude, cost-saving) agents:
  - agent 1: P0, then P1;
  - agent 2: P6-Core, in capiro-backend.
- They have GitHub and Linux only: no AWS and no access to this machine.
- I send plan files to Neo with SendUserFile (the repo docs commit is held per O63).
- I run the Docker image gate and the rehearsals myself during validation, and I ship the images.

**How to apply:**
- Every phase plan states scope, exact files, design, acceptance criteria with numbers, tests, gates, telemetry, rollback, out-of-scope items and my validation checklist.
- Don't implement phase work myself unless Neo asks.
- The consolidation merges (CONSOLIDATION-*.md) come before P0.
