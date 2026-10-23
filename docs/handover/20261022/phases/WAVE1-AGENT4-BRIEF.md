# Wave 1 brief: Agent 4 (lane U: Meri UI and Core-for-Meri)

Read `FINAL-PLAN-20261021.md` sections 1, 2 and 4 first.

**How we work:** you build, and Fable reviews, merges and deploys.
- **Repositories:** `neo-capiro/capiro-frontend` (base `main`) for `apps/web/src/features/meri/**` and `apps/web/src/shared/meri-*`, and `neo-capiro/capiro-backend` (base `backend-import`) for the Meri bootstrap and application-authority only.
- **Rules:**
  - draft PRs only;
  - no merges, no AWS access, no GitHub Actions changes;
  - list the tests you ran and the ones you couldn't run;
  - mutation-check every new test.
- **Don't touch:** Portfolio, Workspace, Settings and Mail code (agent 3), or the greenfield runtime (agents 1 and 2).

## Sources of truth (read before coding)

1. **The two master closeout plans:** *Capiro Meri Wiring Closeout Plan* and *Capiro Portfolio, Workspace, Settings and Mail Wiring Closeout Plan* (20261021). They're the detailed spec for every ticket.
2. **`STANDING-RULES.md`:** the architecture to preserve, the owner map and collision rule, the no-duplication rules, the regression matrix and the definitions of done, copied verbatim from both plans. These apply to everything you do.
3. **Your tickets, verbatim:** `M1-UI-TICKETS.md` (MF-01, MF-02, MF-06, MF-07, MF-10, MF-21) and `AGENT4-DESIGN-TICKET.md` (MG-03 design rules, MF-19).

**For every ticket:** implement its **bounded work** and meet its **acceptance**, exactly as written. Reuse the existing owners it names. If a ticket, the standing rules and this brief seem to disagree, or the ticket leaves a decision open, **stop and ask Fable through Neo; don't decide on your own**. Name the ticket IDs you closed in each PR.

## Phase M1 (UI part) · Reliable chat on screen

Agent 1 builds M1's runtime half (MR-01, MR-02, MR-06, MR-08, MR-09, and pause/resume/fork across a deploy) in greenfield. You build the screen half, against the contracts that exist on greenfield `main` today. If you need a field or route that doesn't exist yet, ask Fable; don't invent one.

**Tickets:** the full text of each is in `M1-UI-TICKETS.md` (attached), copied verbatim from the Meri closeout plan.

| Ticket | What |
|---|---|
| MF-01 | Show each capability and route truthfully: on, off, or unavailable, with the reason. No dead controls. |
| MF-02 | Identity, exact-run renewal and access-loss isolation. Includes a heartbeat and send acknowledgement: the user sees "sent" only when the service has accepted the message. |
| MF-06 | Show Stop and next-turn readiness honestly: "stopping", "stopped", "ready for your next message". |
| MF-07 | Drafts and in-flight requests survive a reload: no lost text, no double send. |
| MF-10 | Use the existing public lifecycle contract (pause, resume, retry) where the backend supports it; otherwise show the action as unavailable. |
| MF-21 | A pinned, composed frontend acceptance matrix: one browser test set that runs the real chat flows (send, stream, reload, Stop, second turn, client switch) against pinned contracts. Fable runs it before every release. |

**Design (applies to every screen you build):**
- **The source of truth is Figma:** [Capiro 3.0 UI Redesign, page 411:40601](https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=411-40601).
- **Meri nodes:**

  | Node | ID |
  |---|---|
  | Meri section | `599:136957` |
  | Complete standalone mockup | `439:81406` |
  | Home | `442:81437` |
  | Checkpoint and restore | `443:84112` |
  | Interrupted run and fork | `443:84534` |
  | Run/recovery state board | `450:88532` |
  | Approval/permission state board | `450:89113` |
  | Conversation/memory lifecycle | `450:90240` |
  | Document drafting | `532:122225` |

- **If you can open Figma,** read the node's design context, not a screenshot.
- **If you can't,** use the captured references in greenfield `docs/design/meri/20261010T004355Z/`, which include desktop, tablet and phone PNGs and the inventory, plus `docs/UI-SPEC.md` and `docs/UI-COVERAGE.md`.
- **Build with what's already there:** the shared shell (`apps/web/src/shared/shell`) and the existing components and tokens. Never introduce a new UI kit, hard-coded colors, or screens built from screenshots.
- **Each M1 state must match its node on the state boards:** running, stopping, stopped, failed, unavailable, ready. Name the node IDs you matched in the PR description.
- Phone and tablet layouts are reviewed in the L1 design reconciliation (MG-03); for now, keep them working and don't redesign them.

**Order:** MF-21 first (the test harness), then MF-02 and MF-07 (sending and reload), then MF-06 and MF-10, then MF-01.

**Done when:**
- the PRs are reviewed;
- MF-21's matrix passes against preview after Fable deploys;
- these checks pass on preview: E01–E07 (send, reload, double-click, disconnect, session expiry, client switch, Stop) and E12 (pause, resume, retry), plus the whole-flow chat check.

**Next:** M2's UI and Core part (General chat, New conversation, conversation list and history). Its brief comes when M1 is in review.
