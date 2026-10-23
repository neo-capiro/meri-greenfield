---
name: feedback-fresh-sessions-per-wave
description: "Neo 10-21 — after each wave, start fresh Claude sessions (reviewers + coordinator) and fresh agent sessions (agent N vX+1) from a WAVE-N-HANDOFF.md, to save money and avoid large-context mistakes"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 57abea96-0ea5-4faa-b2f1-7f8812ef4cd3
  modified: 2026-10-21T19:46:27.503Z
---

**Neo, 2026-10-21:** "after each wave I want new claude sessions and I want new agent sessions to save money and avoid mistakes with large context windows."

**Why:** long sessions cost more and drift or misremember. Fresh, small contexts per wave.

**How to apply at the end of every wave:**
1. **Write `C:\dev\fable\adj-reports\WAVE-N-HANDOFF.md`:**
   - what's live (versions and SHAs), what's merged but undeployed, and the open PRs with their review state;
   - the wave's decisions and the open items;
   - the next wave's briefs, ticket extracts, `STANDING-RULES.md`, and the two master closeout files.
2. **Agents:** Neo starts new ChatGPT sessions named "agent 1 vN+1" … "agent 4 vN+1" with only their next brief, tickets, standing rules and master files. Post the switch on GitHub #202, so dot relays to the new names.
3. **Claude reviewers:** archive the current review sessions and start fresh ones per review task.
4. **Coordinator:** hand off to a fresh session (`hand_off_to_session`) that starts from the handoff file plus memory, and give Neo the link.

Wave 1 started 10-21 with agents "agent 1 v1" … "agent 4 v1". See [[feedback-agent-relay-autonomy]] and [[project-meri-hot-path-phase-workflow]].
