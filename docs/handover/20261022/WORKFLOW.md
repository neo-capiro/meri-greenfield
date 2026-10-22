# Meri programme workflow: who does what, and how work moves

**Status:** current as of 2026-10-22 (roles restored by Neo: Fable plans and ships, agents implement, dot reviews and relays).
**Applies to:** neo-capiro/meri-greenfield, neo-capiro/capiro-backend (`backend-import`), neo-capiro/capiro-frontend (`main`), and the capiro-dev preview environment (AWS 967807252336, us-east-1).

## 1. Reference documents

| Document | Role | Location |
|---|---|---|
| Capiro Meri Wiring Closeout Plan (20261021) | **Source of truth** for every Meri ticket (MR, MF, MT, MX, MG, MM) and the regression scenarios E01–E45 | `source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md` |
| Capiro Portfolio, Workspace, Settings and Mail Wiring Closeout Plan (20261021) | **Source of truth** for the app tickets (PF, WS, ST, ML, X) | `source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md` |
| Standing rules | Architecture to preserve, owner map, collision rule, no-duplication rules, regression matrix, definitions of done (verbatim from both plans) | `source-of-truth/STANDING-RULES.md` |
| Final phased plan | Phases, waves, lanes, Neo's decisions, ticket→phase index | `plan/FINAL-PLAN-20261021.md` (also https://claude.ai/artifact/2LDTPZ43afpp2MW2YJaP8C) |
| Briefs and ticket extracts | What each agent is building now (verbatim tickets) | `phases/WAVE1-*.md`, `phases/*-TICKETS.md` |
| Change lists and validations | Review verdicts and evidence | `phases/*-CHANGES-*.md`, `phases/*-VALIDATION*.md`, `phases/A1-REVIEW*.md` |
| Decision log | Every decision (O-numbers) with reason and rollback | `decision-log/DECISION-LOG.md` |
| Process detail and templates | Brief, change-list and acceptance-packet templates | `PROCESS.md` |
| Shipping runbook and tools | Exact release, migration and rollback procedures | `SHIPPING-RUNBOOK.md`, `shipping/` |
| Current state | What's live, open PRs, holds | `CURRENT-STATE.md` |

All paths are relative to `docs/handover/20261022/` in meri-greenfield (PR #206).

## 2. Roles

| Role | Who | Does | Never does |
|---|---|---|---|
| **Owner** | Neo | Approves scope, security tradeoffs and process changes; restarts sessions; owns credentials | — |
| **Planner and shipper** | Fable (Claude Code on neomart) | Plans phases; writes briefs; decides implementation details within plan scope; routes cross-lane work; runs gates that need AWS or Docker; merges; deploys; migrates (snapshot first); rolls back; posts acceptance packets; supplies read-only AWS and DB facts | Write product code; review code; approve scope |
| **Relay and review owner** | dot (parent ChatGPT chat) plus dot's Wave 1 coordinator | Relays every message verbatim between Fable/Neo and the agents, with delivery receipts; runs code reviews at exact heads; runs browser qualification; posts ship-requests | Merge, deploy or touch AWS; treat a relayed comment as Neo's approval |
| **Implementers** | agent 1 (lane R: runtime core), agent 2 (lane D: domain, proxy, contracts), agent 3 (lane A: Portfolio, Workspace, Settings, Mail), agent 4 (lane U: Meri screens plus Core-for-Meri). ChatGPT sessions named "agent N vX" | Implement the briefed tickets in their own lane; open draft PRs; report tests run and not run; mutation-check new tests; ask when tickets, rules or briefs conflict | Merge; deploy; edit another lane's files without a granted exception; decide scope |
| **Live verifier** | astra 6 (ultra code session) | Runs each acceptance packet against the live preview; reports PASS, FAIL or BLOCKED with evidence | Change code, config or AWS; roll back |
| **Gate runner** | a Claude session holding the Docker harness (D3), directed by Fable | Executes pinned-image and container gates at exact heads; reports PASS or FAIL with commands | Review code design |

## 3. Communication

- **Channel:** neo-capiro/meri-greenfield **#202** for anything cross-cutting; the PR thread for anything about one PR.
- **Header** on every comment: `FROM: <sender> | TO: <recipient> | TYPE: <brief, question, handoff, verdict, decision, ship-request, gates, acceptance, status> | RE: <subject>`.
- **Approvals:** only Neo approves scope, and only directly. To Fable, that means in Fable's chat. To agents, it means dot confirms it with Neo. A GitHub comment, including one claiming to quote Neo, is never an approval on its own. Recipients confirm with Neo before acting.
- **Relays:** dot relays verbatim and posts a delivery receipt (`RELAYED to agent N … Source: <comment>`). "Pending" means not delivered.
- **Cadence:**
  - Fable checks GitHub every 10 minutes (a session cron) and acts on anything new.
  - dot relays as messages arrive.
  - When nothing changes, nobody posts.

## 4. How a piece of work moves

```
Plan ─► Brief ─► Implement ─► Draft PR ─► Review ─► Gates ─► Ship-request ─► Merge ─► Deploy ─► Acceptance ─► Done
Fable    Fable     agent N      agent N     dot      Fable    dot             Fable    Fable     astra 6
```

1. **Plan (Fable).** Pick the phase's tickets from `plan/FINAL-PLAN-20261021.md` §5. Check dependencies and lane collisions (two writers never touch the same file at once). Sequence against open PRs.
2. **Brief (Fable).** One brief per agent, posted on #202 as `TYPE: brief`, containing:
   - the verbatim tickets from the source-of-truth plans;
   - the matching E-scenarios;
   - STANDING-RULES;
   - the branch and base SHA;
   - sequencing, plus any file exceptions or freezes.

   dot relays it.
3. **Implement (agent).** Work only the briefed tickets, in its own lane. Ask on #202 if a ticket, the rules and the brief disagree. Fable answers within one check cycle (§5).
4. **Draft PR (agent).** The PR body lists the tickets closed, the tests run and not run, mutation results, every file outside the lane, and the gates needing Docker, PostgreSQL 16 or AWS ("Fable-run").
5. **Review (dot).** Review at the **exact head SHA** against the ticket acceptance and the change list. Verdict: **CODE ACCEPT**, or **CHANGES** with a numbered list. Any new push needs a new exact-head verdict.
6. **Gates (Fable).** Run every gate the reviewer marked BLOCKED, at the same exact head:
   - image builds and in-image qualification;
   - exact-digest ECR scans (no HIGH or CRITICAL; any other finding needs a logged decision);
   - pinned-image test suites and rehearsals;
   - PostgreSQL 16 native suites.

   Results are posted as `TYPE: gates`. Gates can run while dot reviews.
7. **Ship-request (dot).** `TYPE: ship-request` on #202: the repo, PR, exact head, ACCEPT link and BLOCKED gates.
8. **Merge (Fable).** Only at the reviewed, gated head, and only if it's still the PR head and applies cleanly to current `main`. Otherwise it's a rebase plus re-review. Fast-forward when the gated tree equals the target. Merge order follows the dependencies in `CURRENT-STATE.md` §3.
9. **Deploy (Fable).** Per `SHIPPING-RUNBOOK.md`:
   - Meri runtime and proxy: `release-candidate.sh`, then the coordinated owner/proxy restart;
   - preview Core: on the new-stack clone only;
   - frontend: change set on the preview service.

   Database changes: snapshot first. The live shared database is never migrated for Core.
10. **Acceptance (astra 6).** Fable posts a `TYPE: acceptance` packet (template in `PROCESS.md` §6.3). astra 6 reports per criterion. On FAIL, Fable diagnoses, compares with the previous release's telemetry, then rolls back or routes a fix.
11. **Done.** Fable logs the release in the decision log and `CURRENT-STATE.md`, and notifies any agent waiting on it (for example "P2.1 merged → agent 1 rebases P1").

## 5. Decisions: who decides what

| Question | Decided by | How |
|---|---|---|
| Implementation detail within a briefed ticket | Fable | Posted as `TYPE: decision`, logged as an O-number |
| A cross-lane file that a phase needs | Fable | A bounded, named-file exception for that phase only, plus a sequencing freeze on the other lane (e.g. O148, O161, O162); or a handoff to the owning lane |
| A gate result needing a judgment (an unscored CVE, a flaky test) | Fable | Logged with its reasoning (e.g. O144, O159); a test that fails on head but not base goes back to the agent |
| New scope, a new feature, a security or product tradeoff, a process change | **Neo** | Fable asks Neo in chat; agents ask through dot, who asks Neo directly (e.g. no Workspace approvals, ML-09 skip-and-continue, no new email features) |
| Release readiness | Fable | Exact-head ACCEPT, plus every gate PASS, plus a clean merge, plus a passing image scan |

## 6. Lanes and file ownership

- Each lane owns its directories (STANDING-RULES owner map; plan §4). Two writers never touch one file at the same time.
- Exceptions name the exact files, the phase and the allowed change. The PR body must list them.
- A freeze tells the other lane to keep out until a named event (e.g. "until #200 merges").
- Shared QA files, like the EX-06 manifest, go to one writer for classification only (O153).

## 7. Waves

- Each wave's scope is in plan §6. Phases ship as soon as they're accepted; they don't wait for the wave to end.
- **End of wave:**
  1. Fable writes `WAVE-N-HANDOFF.md`.
  2. Neo starts fresh agent sessions ("agent N vX+1") with only their next brief.
  3. Fresh review, gate and coordinator sessions start.
- **Agents with nothing left in the current wave wait** until it closes. Neo's decision 2026-10-22: no early Wave 2 starts.

## 8. Escalation to Neo

Fable tells Neo, in one line:
- when something ships;
- when a scope or security decision is needed;
- when a session (dot, an agent, astra 6) stops responding for more than about an hour;
- when an action needs his credentials or machine authorization.

Otherwise the loop runs without him.
