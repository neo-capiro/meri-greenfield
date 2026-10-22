# Wave 1 brief: Agent 1 (lanes R and U: Meri runtime core and Meri UI)

Read `FINAL-PLAN-20261021.md` sections 1, 2 and 4 first.

**How we work:** you build, and Fable reviews, merges and deploys.
- **Repository:** `neo-capiro/meri-greenfield`, plus `neo-capiro/capiro-frontend` for UI work in later tasks.
- **Rules:**
  - draft PRs only;
  - no merges, no AWS access, no GitHub Actions changes;
  - every PR description lists the tests you ran and the ones you couldn't run (the Docker image gate and real-PostgreSQL suites run during validation);
  - every new test is mutation-checked: name the edit that turns it red.

## Sources of truth (read before coding)

1. **The two master closeout plans:** *Capiro Meri Wiring Closeout Plan* and *Capiro Portfolio, Workspace, Settings and Mail Wiring Closeout Plan* (20261021). They're the detailed spec for every ticket.
2. **`STANDING-RULES.md`:** the architecture to preserve, the owner map and collision rule, the no-duplication rules, the regression matrix and the definitions of done, copied verbatim from both plans. These apply to everything you do.
3. **Your tickets, verbatim:** `AGENT1-TICKETS.md` (MR-07 for C12; MR-01, MR-02, MR-06, MR-08, MR-09 for M1).

**For every ticket:** implement its **bounded work** and meet its **acceptance**, exactly as written. Reuse the existing owners it names. If a ticket, the standing rules and this brief seem to disagree, or the ticket leaves a decision open, **stop and ask Fable through Neo; don't decide on your own**. Name the ticket IDs you closed in each PR.

## Task 0 · Finish P1 and open its PR (first, since it's nearly done)

- Finish P1 on `feat/meri-p1-budget-table` per `P1-PLAN.md`.
- Rebase onto `main` `bce70776` (it adds `96b6da6d`, `3c56c3e9` and candidate 11 in files P1 touches). Re-locate references by function or constant name.
- Add any new timeout, deadline, retry or poll constant to the table, and list it as an inventory delta.
- Open the draft PR and report its number. Fable validates it and ships it with P2 PR-A as phase S1.

## Task 1 · C12: unstarted conversations recover (Phase 0 blocker, right after P1)

**Problem (live today):** when a user opens Meri, control creates the conversation's first-turn record ("original").
- That record is immutable, one per conversation, and expires after at most 15 minutes. It is also refused after any deploy that changes the configuration.
- So a conversation whose first message isn't sent within 15 minutes, or across a deploy, is **refused forever**. The logs show `CONTROL_SESSION_REFUSED step=initial-binding code=INITIAL_BINDING_EXPIRED` or `…CONFIGURATION_CHANGED`.

**Spec:** `adj-e-C12-UNSTARTED-ORIGINAL.md` (attached). Read §1 (diagnosis) and §2 option A (the approved fix).

**Starting point:** a partial, untested attempt is pushed as `fable/c12-unstarted-original-20261021` @ `0b6737d5` ("WIP (handover)").
- It was interrupted mid-build, with no notes and no gates run.
- It touches migration `0020_initial_generations.sql`, `initial-run-binding-journal.mjs`, `initial-input-journal.mjs`, `prepared-candidate.mjs`, the PLAN entry, and draft tests.
- Use it if it helps, or start from `main` `bce70776`. Either way, say which in the PR.

**Build option A exactly:**
1. **Migration `0020`:**
   - latest-generation initial-run bindings;
   - initial inputs keyed by run;
   - added to `infra/product-preview/first-chat/first-chat-migrate.mjs` PLAN, in order;
   - it runs up on already-populated `0016`/`0017` tables.

   **Keep the immutability triggers:** no UPDATE, no DELETE; supersession writes a new generation row. Report how long the primary-key change locks on a realistically sized table.
2. **Supersession:** an unstarted original that is expired, or stale on configuration or policy, is **re-prepared under the current render on the next session issuance**. Requirements:
   - same tenant, principal, client and current policy;
   - atomic, and idempotent when two issuances race;
   - **anything that has started is never rebound**;
   - a `RESERVED` first input bound to the dead run is superseded with it.

   Files (sized in the spec): `initial-run-binding-journal.mjs`, `prepared-candidate.mjs`, `initial-input-journal.mjs`, `otherState`, `objective-source/postgres-run-starts.mjs`.
3. **Refusal log:** add any new codes to the existing `CONTROL_SESSION_REFUSED` vocabulary.

**Tests (each must fail on `bce70776` and pass on your branch):**
1. Original claimed → 15-minute window passes (fake clock) → next issuance rebinds → turn 1 runs.
2. Original claimed under release A → release B → rebinds → turn 1 runs.
3. A first send that reserved input but never ran → the rebind supersedes the input too → the send works.
4. A started original is never rebound. A different principal, client or policy is refused.
5. Two concurrent issuances → exactly one new generation.
6. Real PostgreSQL:
   - the migration runs up on populated tables;
   - supersession works across two connections;
   - the triggers still reject UPDATE and DELETE.

**Deliver:** one draft PR into `main`, with the migration's lock time in the description.

## Task 2 · M1 Reliable chat (next)

The M1 brief arrives when C12 is in review. Your part of M1 is the runtime: MR-01, MR-02, MR-06, MR-08, MR-09, and pause/resume/fork across a deploy (E12). Agent 4 builds M1's screens (MF tickets) in capiro-frontend. The M1 brief includes the full text of each of those tickets, so you won't need any other document.
