# Fable repair package four and handover to dot (16 October 2026)

**Why this is a handover.** The account reached its weekly usage limit at about 00:30 UTC on 16 October; it resets on 17 October at 18:00 UTC. Every Fable cloud lane stopped at that point, and the owner asked for a stop point and a handover so that dot can continue. Everything this document references is in Git:
- in this repository, on `fable/repair-package-4-20261016`;
- on `dot/meri-comprehensive-audit-20261015` @ `f8d1816e`;
- or in `neo-capiro/capiro-frontend` on `meri/live-wiring-20261016` @ `2acbd89c`.

None of this is deployment acceptance. Every result below is source-level and local unless it says otherwise.

## 1. Where things stand

| Item | Ref |
| --- | --- |
| Package four (integration branch) | `fable/repair-package-4-20261016`, head = the commit that adds this report. The candidate-h commit is `753bd621`, and the head before candidate h was `e8620278`. |
| Live base it grows from | `fable/live-base-20261016` @ `48a27c8d`: package three plus the round-four repairs (L4 restart, schedules, design refine, reads typecheck fix, PDF page tree) and candidate manifest g. |
| Owner decisions (binding) | [FABLE-OWNER-DECISIONS-20261015.md](FABLE-OWNER-DECISIONS-20261015.md), §6–§7 (commit `355d64de`, an ancestor of package four). |
| dot's reviews | `docs/coordination/audits/meri-comprehensive-20261015/` on `dot/meri-comprehensive-audit-20261015` @ `f8d1816e`: `README.md`, `PACKAGE3-REVIEW-20261015.md` and its `PACKAGE3-*-REVIEW.md` parts, `SUCCESSOR-REVIEW-20261015.md`, and `PACKAGE2-REVIEW-20261015.md`. |
| Lane briefs (finished and unfinished) | [../briefs/FABLE-LIVE-LANE-BRIEFS-20261016.md](../briefs/FABLE-LIVE-LANE-BRIEFS-20261016.md) |
| Frontend | capiro-frontend `meri/live-wiring-20261016` @ `2acbd89c` (based on `meri/figma-34-ui` @ `c7e06000`). Report: `docs/meri-figma-34-20261015/LIVE-WIRING-20261016.md` on that branch. |

## 2. What package four contains

| Lane | Merged commit | Lane report (in this branch) | Proposals / requests |
| --- | --- | --- | --- |
| Round-4 dependencies, Docker-proof selection, suite inventory, receipts | `3d79610c` (lane head `1f883f0c`) | [FABLE-R4-DEPS-RECIPE-20261015.md](FABLE-R4-DEPS-RECIPE-20261015.md) | Its "Proposals and residual items for dot" section |
| INTENTS: `meri_intents` SDK server and control intent mount (prepare-only conversational writes) | `cb94dfbb` (lane head `c1a86b1b`, plus `cdb85b33`) | [FABLE-INTENTS-20261016.md](FABLE-INTENTS-20261016.md) | [../proposals/FABLE-INTENTS-PROPOSALS-20261016.md](../proposals/FABLE-INTENTS-PROPOSALS-20261016.md), P-INT-1…9 and P-INT-M1 (journal table SQL) |
| RETENTION: data-class registry, recovered-watermark serving fence, startup composition, schedule subject kind | `b75ababc` (lane head `8694c1ed`) | [FABLE-RETENTION-20261016.md](FABLE-RETENTION-20261016.md) | [../proposals/FABLE-RETENTION-MIGRATION-REQUEST-20261016.md](../proposals/FABLE-RETENTION-MIGRATION-REQUEST-20261016.md): watermark table and row-class amendments; ledger-sink binding; suppression route |
| DOCUMENTS: qualified renderer binding, PDF admission gate, previews, filing | `2138b50f` (lane head `94e3b83b`) | [FABLE-DOCUMENTS-20261016.md](FABLE-DOCUMENTS-20261016.md) | P1–P7 in the report: preview contract, durable preview store migration, renderer admission, attachment broker, preview token claim |
| BROWSER COMPOSITION: run-bound egress control, canonical approval binding, server-owned options routing, run cleanup | `973dbbf3` (lane heads `e677f434`, `9a6bb724`) | [FABLE-BROWSER-COMPOSITION-20261016.md](FABLE-BROWSER-COMPOSITION-20261016.md) | A1–A6 in the report: approval-owner `consume`, artifact ingest, trusted browser runtime port, prompt sentence, policy tightening, status publication |
| MEMORY / TASKS / SETTINGS: governed memory producer, persisted settings, membership-gated surfaces | `62a93745` (lane head `1fcac067`) | [FABLE-MEMORY-SETTINGS-20261016.md](FABLE-MEMORY-SETTINGS-20261016.md) | [../proposals/FABLE-MEMORY-SETTINGS-PROPOSALS-20261016.md](../proposals/FABLE-MEMORY-SETTINGS-PROPOSALS-20261016.md), M1–M6, and [proposed-memory-settings.sql](../proposals/memory-settings-20261016/proposed-memory-settings.sql) |
| Suite inventory fix for the intents test directories | `e8620278` | (this report) | — |
| Candidate manifest h | `753bd621` | (this report, §4) | dot to accept or reject |

### Merge resolutions (Fable)

**`apps/worker/conversation/options.mjs`**
- `buildConversationOptions` now takes `(value, abortController, continuationContext, skillOptions, capabilityFragment, readOptions, intentOptions, browserFragment)`.
- The system prompt appends `readPromptSentence(...)` and then `intentPromptSentence(intentOptions!==undefined)`.
- The browser fragment is applied last, through `composeBrowserOptions`.

**`apps/worker/conversation/activity.mjs`**
- The factory accepts `generalReads`, `governedIntents` and `browser` together, and validates each.
- The `finally` block closes the skill, read and intent runtimes, then settles the browser run.

**`apps/worker/conversation/browser/test/composition.test.mjs`**
- Calls now pass the browser fragment as the 8th argument.

**`scripts/qualification/local-baseline/dependency-ownership.test.mjs`**
- Kept the package-four side, where the dependencies are declared.

**`scripts/qualification/local-baseline/suites.json`**
- Minimal additions: `intents/test/*.test.mjs` under `worker-conversation`, and a new `control-intents` suite.

### Checks Fable ran on the integrated tree (before candidate h)

Run with Node 24 on a shared host without Docker, PostgreSQL provisioning, root or AWS.

| Suite | Result |
| --- | --- |
| Worker conversation | 307/307 at the final merge (the counts grew from 283 as lanes merged) |
| Control intents | 21/21 |
| Retention | 45/45 |
| Control core | 260/260 |
| Documents | 41 pass, 5 opt-in skips |
| Runtime artifacts | 26/26 |
| Memory / settings | 41 pass, 1 skip |
| Local-baseline (inventory, dependency ownership, receipts) | 21/21 |
| Runtime full | 234/241. The 7 failures are environmental (Docker daemon, PostgreSQL, root, AWS environment) and match the lane reports' UNRUN lists. |

**After candidate h:**
- source proof 5/5;
- local-baseline 21/21 plus `frozen-candidate.test.mjs`, 25 of 28 in total. The 3 failures are explained in §4.

**Not re-run on the final tree:** repository-wide `tsc`, and the lane-specific real-PostgreSQL tests (each lane report lists those under UNRUN).

### Correction to the package-three report

The package-three report said the control typecheck was clean. That was wrong: `apps/worker/conversation/reads/schema.mjs` and `tools.mjs` had type errors. The fix is `b1db921b` on `fable/r4-reads-typecheck-20261015`, and it is in the live base. Please re-run `tsc` for control and the conversations packages on package four rather than relying on either report.

## 3. What is NOT done (initial live version)

Nothing from these lanes was pushed. Each needs a fresh start from the package-four head, using its brief in [FABLE-LIVE-LANE-BRIEFS-20261016.md](../briefs/FABLE-LIVE-LANE-BRIEFS-20261016.md).

| Lane | Branch to create | Notes |
| --- | --- | --- |
| L2-STARTUP: trusted product startup composition | `fable/live-l2-startup-20261016` | Known defect: `lifecycle/service.mjs` persists the successor before the transition-authority check. No owner is wired for `transitionAuthority.readCurrent`, continuation admit/retire or approval. Package four now holds the retention startup owner, the intents mount and the browser composition, so L2 can mount them. |
| L3-HISTORY: conversation list, conversation-wide history, reconnect | `fable/live-l3-history-20261016` | The frontend depends on it for Recent conversations and for earlier turns after reload. |
| READS-A: general read families 1.2–1.7 | `fable/live-reads-a-20261016` | Per-family files; append-only shared edits. |
| READS-B: families 1.8–1.13 plus the three kept reads | `fable/live-reads-b-20261016` | Where no Core endpoint contract exists, write an adapter brief instead of an adapter. |
| PLANNER: server-owned Objective → Strategy → Planner continuation | `fable/live-planner-20261016` | |
| BUDGET-GRANTS: canonical budget and per-run model grants (SEC-REL-02) | `fable/live-budget-grants-20261016` | |

**Frontend.** `meri/live-wiring-20261016` is pushed, but three items are open. See the frontend section of the briefs file for details.
1. `npm run architecture` exits 1, although the lane report says it passed. `useLiveRun` is 84 nonblank lines and is an unreviewed blocking size finding.
2. The full Meri Playwright run is unfinished.
3. The production build was not run.

Fable re-ran these on `2acbd89c`:
- `npm run typecheck`: pass;
- root `npm test`: 117/117;
- `npm run architecture`: exit 1, for the reason above.

## 4. Candidate manifest h

`scripts/qualification/assembled-image/candidate-manifest-fable-20261015h.json`:
- derived from g (`b74243e64a2a6d031434315cd7e4699ecc151f6ba2ca13959c04c31a75edfcd6`);
- 18 changed rows and 27 unchanged rows;
- status `CANDIDATE_HOLD_SOURCE_REVIEW`.

Full SHA-256 of h: `79a5f7fc5254c0152c0119264d653cdb5b561f27ded91d379569d00ba73a5c1e`.

Only two rows changed since g. Both come from the retention lane:

| Path | g bytes | h bytes |
| --- | --- | --- |
| `apps/runtime/control.mjs` | `399698afaa8cac6851f9f40590b1bbf0173e73541125a6b25be65af75ad18ee0` | `ec63730199cbc092042dab6b6694506087530ee85572e1daadfb478bf76c5757` |
| `apps/runtime/config.mjs` | `3a1a136ddeccac2983040113c9de16a91110a70178964da601c839db8f169b71` | `9558183a7eab179d3b66d2b1d65707a0f495f882b3aa03e8b04b029942c6685d` |

The browser-composition lane changed `apps/worker/conversation/activity.mjs` and `options.mjs`. Neither file is a hashed row of g or h; see that lane report's "Hashed rows" section. `source-proof.test.mjs` now reads h and checks the f → g → h chain; with g it fails on exactly the two rows above.

**Pin decision for dot.** `scripts/qualification/assembled-image/frozen-candidate.mjs` (from the round-4 deps lane) still pins f, the last candidate dot accepted (`3215210633f64dcb…`). Because of that, three tests in `frozen-candidate.test.mjs` fail:
- 2, "a COPY tree holding the current reviewed bytes passes";
- 3, "a copy that is excluded or differs…";
- 7, "the static source proof and the Docker COPY check select the same frozen candidate file".

They already failed in the same way once g was the source-proof candidate. Fable left the pin alone because it should record dot's acceptance. When dot accepts h, set `FROZEN_CANDIDATE` to `{file:'candidate-manifest-fable-20261015h.json', sha256:'79a5f7fc5254c0152c0119264d653cdb5b561f27ded91d379569d00ba73a5c1e'}`, and all three should pass.

## 5. Handover plan for dot, in order

1. **Review package four as it stands.**
   - Review the six merged lanes against their reports, and the merge resolutions in §2.
   - Re-run `tsc` on control and conversations.
   - Run the real-PostgreSQL suites the lanes left UNRUN: retention watermark and journal, intents journal, memory/settings stores, documents preview store, L4 and schedules.
   - Accept or reject candidate h, and update the frozen-candidate pin (§4).
2. **Allocate migrations and decide the proposals.** The lanes deliberately requested no migration IDs by number:
   - retention watermark table and row-class amendments;
   - intents journal (P-INT-M1);
   - `meri_memory` and `meri_settings` (M1);
   - durable preview store (documents P2);
   - schedule occurrences;
   - product budget 0002, already authored.

   The contract and owner proposals are listed in §2. The decisions that block the live path are:
   - the prepared-candidate ledger-sink binding (retention 2);
   - the approval-owner `consume` for browser subjects (browser A1);
   - `application/pdf` in the `DocumentApplication` mime enum (documents P1);
   - the A4 prompt sentence. It needs owner approval of the exact text.
3. **Dependencies and image** (deps report):
   - decide `--omit=dev` for the root and conversations `npm ci` lines in the Dockerfile (a hashed row);
   - record a successor worker-provenance source candidate for the three changed qualification inputs;
   - the two artifact checks that still resolve `jszip` through the Codex-host `pptxgenjs` path.
4. **Finish the live version's remaining lanes** (§3), in this order:
   - L2-STARTUP;
   - L3-HISTORY;
   - READS-A and READS-B in parallel;
   - BUDGET-GRANTS;
   - PLANNER.

   Each brief lists its acceptance tests. Start them from the package-four head, after step 1, so they compose against the merged owners.
5. **Frontend:**
   - fix the architecture finding and the report row;
   - finish the Playwright run and the production build;
   - wire L3's routes when they exist;
   - integrate `meri/live-wiring-20261016` into the frontend candidate.

   Keep the accessibility "incomplete" items and the untested states explicitly open, as dot asked.
6. **Owner items still open** (for Neo):
   - the Q-X2 placements: the takeover owner on the browser host, the bridge MCP placement, and the schedule worker in control. L2 leaves the schedule worker unregistered until this is decided.
   - the first authenticated-site list (Q-A1);
   - the bridge "access all" control model (deferred with the bridge);
   - sending the Collabora quote request (Q-O2), which a Capiro person sends.
7. **After the live version.** The four advanced features follow the owner's build order (Q-X1): prerequisites, then a test spike, then live takeover, then the first authenticated site. The bridge and the session vault come after the first shipment. Designs and decisions are in [FABLE-OWNER-DECISIONS-20261015.md](FABLE-OWNER-DECISIONS-20261015.md) and on `fable/design-first-shipment-features-20261015`.

## 6. Boundaries respected

- No deployment, AWS change, new credential, paid build, model or provider call, migration execution, live purge, frozen-contract edit or lockfile change.
- Approved dependencies were declared at their existing locked pins, as the round-4 deps lane approved.
- No pull requests.
- No secrets or private content in Git.
- Local fixtures and synthetic tests are not claimed as live acceptance.

## 7. Session state at the stop

- All Fable cloud sessions are stopped.
- The scheduled check-in was deleted.
- Lanes that had finished were archived after their branches were merged.
- The stopped sessions hold no pushed work beyond what is listed above.
