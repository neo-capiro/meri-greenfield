# Live-version lane briefs (Fable, 16 October 2026)

These are the exact briefs Fable gave the parallel implementation lanes for the initial live version. Six backend lanes and the frontend follow-up did not finish, because the account reached its weekly usage limit at about 00:30 UTC on 16 October. They are recorded here so dot, or a later session, can restart any of them unchanged. The handover is [FABLE-REPAIR-PACKAGE-4-20261016.md](../reports/FABLE-REPAIR-PACKAGE-4-20261016.md).

Base for every backend lane: `fable/live-base-20261016` @ `48a27c8d`. Since then, package four (`fable/repair-package-4-20261016`) has absorbed six lanes. A restarted lane should start from the package-four head rather than the live base, so that it composes against the merged intents, retention, documents, browser and memory/settings owners. Where a brief says `48a27c8d` or "candidate manifest g", read the package-four head and candidate h.

## Common preamble (every backend lane)

You are one bounded implementation lane for Meri, working in neo-capiro/meri-greenfield. A lead session coordinates, and dot independently reviews exact pushed commits. The product owner is Neo Martinez.

**Restart notes**
- The repository targets Node 24. If `node -v` is not 24.x, install Node 24 inside the container (nvm, or the nodejs.org linux-x64 tarball into `~/.local`).
- Running `npm ci` against the existing lockfiles inside your own container is allowed and needs no confirmation. Changing lockfiles is not allowed.
- AGENTS.md on this base still says Codex-only and gives older ownership. That text is superseded: the owner's direction is that Fable lanes implement Meri. Do not stop on that conflict.
- Work continuously to a pushed, tested result. Do not pause for confirmation, except for actions on the not-authorized list.

**Base and branch**
- Create and work only on your lane branch, and push it with `git push -u origin <branch>`. On network failure, retry after 2s, 4s, 8s and 16s.
- Do not push anything else, merge into main, or open a pull request.

**Read first (binding)**
- `docs/IMPLEMENTATION-STANDARDS.md`.
- `docs/coordination/reports/FABLE-OWNER-DECISIONS-20261015.md`. The initial live version ships first. The four advanced features (bridge, takeover, Office editor, authenticated sites) come after it and are out of scope.
- `git fetch origin dot/meri-comprehensive-audit-20261015`, then read in `docs/coordination/audits/meri-comprehensive-20261015/`:
  - `README.md`: the reconciled outcome matrix, the prioritized sequence and the end-to-end completion criteria;
  - `PACKAGE3-REVIEW-20261015.md`;
  - the report your lane names.

  Their required-outcome and missing-integration text are your acceptance criteria.
- `docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md` and the lane reports it links. For package four, also read the reports listed in the handover.

**Rules**
- Delegation: no sub-agents, other sessions, workflows or schedulers.
- Not authorized:
  - deployment;
  - AWS or cloud changes;
  - new credentials;
  - paid builds;
  - model or provider calls;
  - migration execution;
  - live purge;
  - editing frozen contracts (`packages/contracts/**` 0.1.0, UIEvent 0.1.0, the closed Run contract);
  - the Dockerfile or image recipe;
  - lockfiles.
- New wire shapes are clearly marked local proposals, with exact text for dot.
- Migrations: no ID is allocated to you. Put the SQL in `docs/coordination/proposals/` with a migration request, and keep code behind the existing store interfaces.
- Never put secrets or private content in Git, logs or reports.
- Durability:
  - Keep durable fences and UNKNOWN barriers. UNKNOWN never licenses redispatch, reuse or a blind retry.
  - Preserve the original authority and expiry, and immutable command and input identity.
  - Reuse canonical owners: no second authorization system, no generic SQL tool, and no second model loop (the Claude Agent SDK is the only model loop).
- Code organization: small entry points, cohesive modules, no god files, no dead code, no circular imports.
- Tests:
  - Every behaviour you add has tests.
  - Every finding you close has a negative regression that fails without the fix. Prove it by reverting the fix, then restore it.
  - Synthetic tests are labelled synthetic. Anything that needs real PostgreSQL, Temporal, S3, the SDK or AWS stays UNRUN, with the reason.
- Candidate manifests: do not create them. If you change a file hashed by the source proof in `scripts/qualification/assembled-image`, report the old and new SHA-256 per row and show the source proof fails only on those rows.
- Setup:
  - Install dependencies with `scripts/qualification/local-baseline/clean-checkout.sh`, or with `npm ci --ignore-scripts --no-audit --no-fund` per package lockfile.
  - Runtime tests that load the durable-invocation harness need `MERI_REVIEW_SOURCE_ROOT="$PWD"` (repo root).
  - `mock.module` tests need `--experimental-test-module-mocks`.
- Commits: focused, with message bodies that explain what and why.
- Lane report: `docs/coordination/reports/FABLE-<LANE>-20261016.md`, covering:
  - the implementation outline;
  - what was built and which audit or review items it closes;
  - the files;
  - tests: counts, before and after, and the reverted-fix proof;
  - unrun checks and why;
  - proposals for dot;
  - residual risks.
- Finish by pushing your branch. End with: the branch, final commit SHA, a summary, checks with exact counts, unrun checks, proposals, and hashed rows changed.

## Unfinished backend lanes

### L2-STARTUP — `fable/live-l2-startup-20261016`

**Source.** Audit L2 / Product §1, "Trusted product startup": `lifecycle-report.md` §L2, `meri-audit-product-integration.md` §1, and the README matrix row.

**What to build.**
- Compose the actual product startup so the existing canonical owners are mounted for real. This covers the `apps/runtime` roles (control, temporal-worker) and their composition modules. The owners are:
  - current authority;
  - continuation, admission, retirement and approval (the resume/fork and approval controls);
  - artifacts, actions, tasks and sessions;
  - sources;
  - retention;
  - proxy and budget.
- Fix the L2 defect. Missing ports must fail closed before a successor is persisted. The code must never persist a successor and then report an unknown effect without dispatch.
- Where an owner genuinely does not exist yet, keep the fail-closed unavailable default and name it explicitly in the readiness output.
- Do NOT register the schedule dispatch worker; its placement is not owner-approved (Q-X2). Leave a named composition point.

**Findings from the first run, to verify and act on.**
- `apps/control` `lifecycle/service.mjs` persists the successor before the transition-authority check. The order must be: check authority first, then persist.
- Startup composition wires no `transitionAuthority.readCurrent` owner, no continuation admit/retire owner and no approval owner.

**Tests.**
- An authenticated end-to-end startup composition with synthetic infrastructure (scripted SQL, fake Temporal/ECS).
- Denial, revocation and missing-owner cases, each proving fail-closed behaviour before any successor is persisted.

### L3-HISTORY — `fable/live-l3-history-20261016`

**Source.** Audit L3 / Product §2 backend: `lifecycle-report.md` §L3, `meri-audit-product-integration.md` §2, and the README row "Conversation-wide history and usable next turn".

**What to build.**
- Canonical authorized conversation discovery: list a user's conversations.
- Conversation-wide history, with paging across runs.
- Explicit new-turn admission, reusing the next-run journal and its proofs.
- Durable recovery for reload, reconnect and ACK.

**Constraints.**
- Preserve immutable command and input identity.
- Historical read admission must not imply old-writer eligibility.
- Expose stable HTTP routes on the existing conversation host. Document them precisely for the frontend: request and response shapes, auth and errors.
- Use the frozen contracts as they are. If they are insufficient, write exact proposals.

**Tests (synthetic).**
- Multi-turn, paging, reload, reconnect, old-history selection and lost-ACK cases, with no duplicate effects or identity substitution.
- Authorization denial across tenants, clients and actors.

**State when stopped.** The first run reported a real-PostgreSQL test passing and was writing candidate identity tests. Nothing was pushed, so this lane restarts from scratch.

### READS-A — `fable/live-reads-a-20261016`

**Scope.** General read families 1.2–1.7 from `docs/coordination/proposals/FABLE-GENERAL-READ-TOOLS-20261015.md` §6:
- meeting-source;
- action-items-complete;
- operational-reads;
- tenant-contacts;
- entity-candidates;
- client-knowledge-profile.

Build them on the existing `meri_reads` server and the gateway general-read port (`apps/worker/conversation/reads`, `apps/gateway/general-reads`; see `FABLE-S4-READS-MAIL-20261015.md`).

**For each family:**
- the gateway adapter, with its trusted dispatch context;
- canonical schema conversion: the advertised schema is equal to or narrower than the canonical one, and an unconvertible schema is a configuration failure;
- a client-scope gate where the adapter requires a client;
- distinct closed failure texts;
- durable receipts;
- with tenant-contacts (1.5), the §4 legacy-guidance neutralization notice.

**Constraints.**
- One SDK in-process MCP server and no SQL escape hatch.
- "Unavailable" is explicit, never an empty success.
- The 43 excluded legacy tools are never registered.
- Zero reads are available until a qualified installation receipt exists.
- Keep each family in its own file, and keep shared edits append-only.
- Also address the in-scope general-reads findings of `PACKAGE3-PRODUCT-REVIEW.md` (for example, durable scoped tool-history and citation linkage). If that would need a frozen-contract edit, write a precise proposal instead.

**Tests.** Synthetic, per family, through the real gateway authority and adapters with fake transports.

### READS-B — `fable/live-reads-b-20261016`

**Scope.** Families 1.8–1.13:
- client-documents;
- client-knowledge-memory;
- client-knowledge-monday;
- dataset-metadata;
- memory-proposals;
- research-portfolio-evidence.

Then the three reads the owner kept: `get_research_portfolio`, `get_research_portfolio_changes` and `get_florida_budget_project`. Where a Core endpoint contract exists, implement and qualify the adapter through the typed gateway. Where none exists, write a precise adapter brief and proposal (inputs, outputs, denials, dispatch context); do not invent endpoints.

**Constraints.**
- Same per-family requirements and constraints as READS-A.
- dataset-metadata validates fields against the dataset registry and never passes raw query text to a database.
- Keep each family in its own file, and keep shared edits append-only.

**Tests.** Synthetic, per family, as in READS-A.

### PLANNER — `fable/live-planner-20261016`

**Source.** The README row "Durable Objective → Strategy → Planner" and `meri-audit-product-integration.md` §4.

**Current gap.** Follow-through is browser-owned, and suspension or closure can stop automatic Planner continuation.

**What to build.** Server-owned continuation, with:
- canonical association;
- current authority;
- immutable result custody;
- Core application receipts.

**Constraints.**
- Dispatch goes through the canonical run-creation and admission owners, with exact requested and applied source identities and canonical output identities.
- A completed model run alone is not a Core application receipt.
- Use Temporal only through the existing durable orchestration patterns.

**Tests (synthetic).** Close/reopen, crash, ACK loss, concurrent revision and current-authority revocation. Each case has an exact output identity and no duplicate model query or product effect.

### BUDGET-GRANTS — `fable/live-budget-grants-20261016`

**Source.** SEC-REL-02, "Canonical budget and model grants" (`security-release-report.md`).

**What to build.**
- One canonical product budget ledger. Reuse `apps/gateway/budget` and the tenant budget gate, and preserve the accepted tenant-budget liability fix and the authored product-budget 0002 migration source.
- Current, peer-bound per-run model grants that are:
  - issued with the run's issuance;
  - checked by the retained model proxy (`apps/proxy/qualification` runtime ingress admits only the pinned CLI query; preserve that);
  - revocable;
  - settled with uncertain-liability accounting retained.

**Constraints.** No new provider, credential or model call.

**Tests (synthetic).**
- Admission;
- late settlement;
- concurrency;
- expiry;
- cancellation;
- revocation mid-run;
- a stale or retargeted grant refused;
- budget exhaustion.

Run the Python proxy tests from the repo root with `python3 -m unittest apps.proxy.qualification.test.<module>`.

## Frontend follow-up — capiro-frontend `meri/live-wiring-20261016` @ `2acbd89c`

**Original brief (summary).**
- Replace fixture-only behaviour on the ordinary Meri routes with real API wiring:
  - conversations (multi-turn, streaming with reconnect, Stop, list and history);
  - files and artifacts (preview, and signed-link download with POST bodies only);
  - approvals, memory, routines and settings, where routes exist, with explicit unavailable states otherwise.
- Keep the fixture registry for tests.
- Rules: no package or lockfile changes, no Tailwind, no god files, and no fake data on production paths.
- Lane report: `docs/meri-figma-34-20261015/LIVE-WIRING-20261016.md`.

**Remaining work on that branch.**
1. `npm run architecture` exits 1, although the lane report says "pass". The new function `useLiveRun` (`apps/web/src/features/meri/conversation/useLiveRun.ts:18`, 84 nonblank lines) is an unreviewed blocking size finding. Either split it below 80 lines, or add a reviewed entry with a reason in the size-review registry. Then correct the report row.
2. The full Meri/Settings Playwright run did not finish before the stop, so the report's browser-test row is a placeholder. Run the Meri specs, including the new `meri-conversation-host.spec.ts` (22 cases) and `meri-conversation-artifacts.spec.ts` (3 cases), and record the counts.
3. The production build (`apps/web`) was not run. Run it.
4. When L3 lands, wire the conversation list and the earlier-turns-after-reload view to the L3 routes. The report's "Still unavailable" table names each missing route and its owner.
