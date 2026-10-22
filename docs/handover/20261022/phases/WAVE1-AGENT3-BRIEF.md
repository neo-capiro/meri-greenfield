# Wave 1 brief: Agent 3 (lane A: the app, Portfolio, Workspace, Settings and Mail)

Read `FINAL-PLAN-20261021.md` sections 1, 2 and 4 first.

**How we work:** you build, and Fable reviews, merges and deploys.
- **Repositories:** `neo-capiro/capiro-backend` (base branch `backend-import`) and `neo-capiro/capiro-frontend` (base `main`).
- **Rules:**
  - draft PRs only;
  - no merges, no AWS access, no GitHub Actions changes;
  - list the tests you ran and the ones you couldn't run;
  - mutation-check every new test.
- **Don't touch Meri code:** `features/meri/**`, `shared/meri-*`, the Core Meri bootstrap and application-authority.

## Sources of truth (read before coding)

1. **The two master closeout plans:** *Capiro Meri Wiring Closeout Plan* and *Capiro Portfolio, Workspace, Settings and Mail Wiring Closeout Plan* (20261021). They're the detailed spec for every ticket.
2. **`STANDING-RULES.md`:** the architecture to preserve, the owner map and collision rule, the no-duplication rules, the regression matrix and the definitions of done, copied verbatim from both plans. These apply to everything you do.
3. **Your tickets, verbatim:** `A1-TICKETS.md` (all 17 A1 tickets).

**For every ticket:** implement its **bounded work** and meet its **acceptance**, exactly as written. Reuse the existing owners it names. If a ticket, the standing rules and this brief seem to disagree, or the ticket leaves a decision open, **stop and ask Fable through Neo; don't decide on your own**. Name the ticket IDs you closed in each PR.

## Phase A1 · Safety fixes

**Goal:** close the confirmed security and data-integrity gaps before any of these features is switched on. **Nothing new is enabled in this phase.**

**Tickets:** the full text of every ticket is in `A1-TICKETS.md` (attached), copied verbatim from the closeout plan. Each ticket gives its evidence, root cause, bounded work and acceptance; follow it.

| Group | Tickets | Repository |
|---|---|---|
| Settings | ST-01 (branding object-ownership bypass), ST-02 (protected-member removal), ST-24 (receipts and scope safety for security-sensitive writes only) | backend + frontend |
| Workspace | WS-02 (Hill Day authority), WS-03 (draft share/approval holes), WS-04 (canonical client ID on drafts) | backend + frontend |
| Portfolio | PF-10 (meeting reads check client visibility), PF-11 (reassignment provenance), PF-12 (debrief metadata), PF-22 (undated commitments) | backend + frontend |
| Mail | ML-02 (no automatic replay of Graph mutations), ML-03 (durable single-send identity), ML-07 (server-side preflight), ML-08 (add vs reconnect), ML-09 (mailbox-qualified identity), ML-10 (wrong-account token-cache fallback) | backend |
| Cross-cutting | X-04: tests that tenant, client and session authority hold at every hop you touch | both |

**Order:**
1. ST-01, ST-02, WS-02, WS-03, PF-10: the P0 items, independent of each other.
2. WS-04 (before any Workspace save or staging work).
3. ML-02, ML-07, ML-08, ML-10; confirm ML-09 with a failing fixture first, then ML-03.
4. PF-11, PF-12, PF-22, ST-24.

Group them into **3–4 draft PRs** by area (Settings, Workspace, Portfolio, Mail), not one large PR.

**Neo's approval is needed first** for anything touching OAuth or token storage (ML-08, ML-10) or Core auth and sessions. Name those files in the PR description, and Fable gets Neo's yes before merging.

**Tests:** every fix comes with a **direct-API negative test** that fails before the fix and passes after: wrong tenant, wrong owner, client wall, removed member, wrong mailbox. UI hiding doesn't count as the fix. Use mock providers; never send real mail.

**Done when:**
- all A1 tickets are fixed, with tests, in reviewed draft PRs;
- Fable has merged them and deployed them to the staging environment;
- the negative tests pass there, and nothing new is switched on.

**Design (for any screen you touch):**
- **Source of truth:** Figma, [Capiro 3.0 UI Redesign, page 411:40601](https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=411-40601). Use the frames for Portfolio, Modules/Workspace and Settings, and read the design context rather than screenshots if you have access.
- **Build with what's already there:** the existing shared shell, components and tokens in capiro-frontend (see `apps/web/PORTFOLIO.md` and `docs/SHARED-FRONTEND-PREVIEW-GUIDELINES-2026-10-11.md`).
- **No new UI kit and no hard-coded colors.**
- A1 is mostly backend; this matters most from A2 onward.

**Next:** A2 (finishing screens that already have a backend). The brief comes when A1 is in review.
