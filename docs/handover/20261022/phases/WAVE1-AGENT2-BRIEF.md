# Wave 1 brief: Agent 2 (lane D: domain, proxy, gateway, contracts)

Read `FINAL-PLAN-20261021.md` sections 1, 2 and 4 first.

**How we work:** you build, and Fable reviews, merges and deploys.
- **Repository:** `neo-capiro/meri-greenfield`.
- **Rules:**
  - draft PRs, or pushes to the named branch only;
  - no merges, no AWS access, no GitHub Actions changes;
  - list the tests you ran and the ones you couldn't run;
  - mutation-check every new test.

## Sources of truth (read before coding)

1. **The two master closeout plans:** *Capiro Meri Wiring Closeout Plan* and *Capiro Portfolio, Workspace, Settings and Mail Wiring Closeout Plan* (20261021). They're the detailed spec for every ticket.
2. **`STANDING-RULES.md`:** the architecture to preserve, the owner map and collision rule, the no-duplication rules, the regression matrix and the definitions of done, copied verbatim from both plans. These apply to everything you do.
3. **Your tickets, verbatim:** `AGENT2-TICKETS.md` (MX-02, MT-02 for PR197; MT-04, MT-05, MT-09, MT-16 for the read slices).

**For every ticket:** implement its **bounded work** and meet its **acceptance**, exactly as written. Reuse the existing owners it names. If a ticket, the standing rules and this brief seem to disagree, or the ticket leaves a decision open, **stop and ask Fable through Neo; don't decide on your own**. Name the ticket IDs you closed in each PR.

## Task 1 · PR197's last red test (Phase 0 blocker, do this first)

**Where:** PR #197, branch `codex/meri-missed-source-20261021` @ `ac80ef4d` (draft). Push to this same branch.

Everything else in PR197 is green. Background is in `adj-c-PR197-MERGE-REVIEW.md` (attached).

**What's red:** `scripts/scope-ledger/source-exposure.test.mjs` refuses at load.
- The ledger's rule is "a registered read must have a complete adapter".
- But PR189, inside PR197, **deliberately** registers three reads as narrowed slices, and BD evidence covers only part of its contract.

**The fix (decision O120): add a declared-slice state to the ledger.**
- A registered read listed under `partialOperations` is allowed only if it carries an explicit `exposedSlice` description **and** references to the tests that cover that slice.
- It renders as **"partial, slice exposed"**, never as "complete".
- Keep it minimal: `scripts/scope-ledger/source-exposure.mjs`, its test, and the committed exposure file.

**Classify exactly as follows.** Cite PR189's handoff lines for each slice: `docs/integration/MERI-READ-TOOLS-HANDOFF-20261019.md:23-25` and `MERI-READ-GAPS-20261019.md:23-25`. The covering tests are the `ordinary ${id}` cases in `apps/worker/conversation/reads/test/selected-continuation.test.mjs`.

| Read | State | Exposed slice |
|---|---|---|
| `query_outreach` | partial | Campaign list only; `outreachId` detail and linked-resource expansion are refused |
| `search_legiwatch_news` | partial | `source` view plus explicit-year `personnel` only; implicit monitor/window context is refused |
| `get_legal_reference` | partial | No citation parsing |
| `get_business_development_evidence` | partial | Client subjects only; facility subjects are refused |
| `search_research_sources` | complete | Not applicable (cite its tests) |

**Do not mark any partial read complete, and do not un-register any read.**

**Also check:** two other files refuse at load. Do they also fail on `main` `bce70776`?
- `scripts/scope-ledger/ledger.test.mjs` (excluded-tool reference);
- `scripts/general-reads/inventory.test.mjs` ("Gateway dispatch profile list not found").

If either is new in PR197, fix it here. If both fail on `main` too, list them in the PR description as pre-existing.

**Deliver:** push to the PR197 branch; report the before → after ledger counts and the gates you ran.

## Task 2 · `AGENTS.md` ownership update (small, separate PRs)

In `meri-greenfield` (and in `capiro-frontend` and `capiro-backend` if they carry an owner map), state the current ownership:
- Neo's agents implement;
- Fable (Claude) reviews, merges and deploys;
- "dot" is no longer an owner.

Change the ownership text only.

## Task 3 · P2 (continue)

- **PR-A #196 (`c703e9f3`)** is being validated now: a security re-check, plus the Docker and rehearsal gates you couldn't run. Fix whatever the review reports, on the same branch.
- **Meanwhile, start PR-B** per `P2-PLAN.md` §3.5 and §4 "PR-B":
  - stack it on `feat/meri-p2-proof-reuse` as a separate draft PR;
  - rebase it onto `main` after PR-A merges.
