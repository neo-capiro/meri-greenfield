# Fable repair package three (meri-greenfield), 15 October 2026

One integrated candidate answering [dot's package-two review at a5dccb19](https://github.com/neo-capiro/meri-greenfield/blob/a5dccb19a28e1b68a7e831a97bccf858c0af12c2/docs/coordination/audits/meri-comprehensive-20261015/PACKAGE2-REVIEW-20261015.md) and continuing audit steps 3–4. Branch `fable/repair-package-3-20261015`. Every candidate stays HOLD until dot re-reviews the exact pins; source acceptance is never deployment acceptance. Nothing here is activated, deployed or migrated.

## Package-two review items

| Review item | Status | Where |
|---|---|---|
| L1 terminal settlement (30 ms cutoff left runs running/UNKNOWN or running/PENDING at 45 ms) | Fixed: acknowledged 3 s attempts, one event ID per candidate so a lost acknowledgement is read back, at most 4 attempts; otherwise the run reconciler settles only after proven physical retirement, exact binding and writer fence, idempotent replay | `fable/s3-l4-recovery-20261015` `a1a6bd88` (commits `f83ef51a`, `0f46de02`, `18caf6d3`) |
| Browser PDF R1 (`/Pages 2 1 R` accepted) | Fixed: `/Pages` resolved through the existing reference resolver (generation-checked, compressed objects generation 0) and the page tree walked with bounds; the previous validator accepts all 12 new negatives, this refuses all 12 | `fable/s4-pdf-page-tree-20261015` `b6dc012c` |
| PDF revision unimplemented | Implemented: full typed-spec re-render from the default template through the creation pipeline, new immutable version with exact-parent lineage; no contract change; PDF stays unadmitted until a qualified renderer is bound (exact admission change proposed) | `fable/s4-pdf-revision-20261015` `cab18e6a` |
| Clean-checkout dependency ownership and `MERI_REVIEW_SOURCE_ROOT` | S3 and Agent SDK classes now imported through their pinning packages (no lockfile change); dependency-ownership guard; documented clean-checkout procedure; pristine `git archive` proof | `fable/s4-clean-checkout-20261015` `3fae9112` |
| Frontend manual accessibility and later states | Kept explicitly open: 22 audits with unjudged `incomplete` results, two sandboxed iframe contents, two icon-label cases, and the unaudited later states listed in the evidence README | capiro-frontend evidence `59be1a24` |
| Four advanced features and legacy parity | Owner decided 15 Oct: all four required for the first shipment, each after an owner-approved design; parity replaced by 96 capabilities + 14 skills. Design proposal awaiting owner approval | owner decisions record; `fable/design-first-shipment-features-20261015` `c827406a` |
| P2b serving synchronization | Unchanged: no retry or workaround of the stopped review; independent review remains open | — |

## New audit step 3–4 work merged

| Lane | Pin | Summary |
|---|---|---|
| L4 crash recovery and next prompt | `a1a6bd88` | Failed/cancelled latest runs admit one next run after proven retirement and revocation (fresh SDK session, durable history only); one-attempt workflows reconcile through `execution/kickoff/stop` and never redispatch; two-minute recovery modelled only |
| L6 schedules | `fable/s3-l6-schedules-20261015` `56ed803d` | Fixed per-firing identity, dispatch under the owner's current authority, evidence-only UNKNOWN reconciliation for firings and intents; workflow unregistered pending the owner's placement decision |
| General reads, `meri_reads` + mail | `fable/s4-reads-mail-20261015` `28f83c6d` | One SDK in-process server, six trusted gates, distinct closed failures, durable receipts; zero reads available until a qualified installation exists |

## Integration-only changes

- One conflict in `apps/worker/conversation/activity.mjs`: the settlement lane's `terminalAttemptMs` and the reads lane's `generalReads` both changed the factory signature; both are kept.
- Candidate manifest f, derived from e (preserved byte-exact, `41814143…`): 18 changed rows, 27 unchanged. Rows changed since e: `prepared-kickoff.mjs`, `prepared-candidate.mjs` (L4 reconcile opt-in plus the storage S3 import), `temporal-worker.mjs`, `test/prepared-temporal.test.mjs`. Status stays `CANDIDATE_HOLD_SOURCE_REVIEW`. Only the immediate predecessor's bytes are required as `previousCandidateSha256`; the c/d loops keep their historical-hash checks.
- The dependency-ownership guard records the integrated lanes' uses of the same pending lock decisions and one new root-owned case (`@temporalio/client` in the schedules test harness).

## Checks on the integrated tree (Node v24.21.0, `MERI_REVIEW_SOURCE_ROOT` set)

| Suite | Result |
|---|---|
| Conversation worker (test, browser, continuation, skills, reads) | 266/266 |
| Control: next-run recovery, recovery workflow, terminal settlement, hold composition/failure; tsc | 41/41; clean |
| Control schedules | 153/154; the failure is `temporal-inspection-independent` "expiresAtMs substitution" (frozen clock vs `Date.now()`, unchanged file), 5/5 on rerun |
| Runtime focused (reconcile, registry, prepared Temporal, broker cleanup, link mount, artifacts) | 66/66 |
| Runtime full `npm test` | 221/228; 7 environment failures: image-closure (no Docker), PostgreSQL ×2, process ×3 (ambient AWS variables / root), runner-bootstrap-files (root). The two prepared-candidate files that failed in package two now pass |
| PDF revision, process-group drain, PDF lineage, slide layout, structure, usable-file grader | 22 pass, 2 skipped (opt-in LibreOffice); the lane branch's real LibreOffice variants passed 8/8 in the lead's rerun |
| Gateway general-reads mount, selected skills, catalog, tenant budget | 59 pass, 1 skipped (real PostgreSQL) |
| Source proof (candidate f) + scope ledger + dependency guard | 21/21 |

## Proposals for dot

1. Contracts: `ATTEMPT_LOST` and `HOLD_CHECKPOINT_FAILED` reason codes; optional post-failure checkpoint seeding (lineage change); read-tool P1/P2/P3/P8/P9/P12; PDF `revisionMethod` (optional).
2. Lock decisions: `pg`, `@temporalio/common` (control conversations), `zod` and `@modelcontextprotocol/sdk` (conversation worker), `zod` (worker qualification), root-owned `jszip`/`pg`/`@temporalio/client`.
3. Migration request P-L6-1 (recorded NOT_APPLIED intent state).
4. PDF admission together with a qualified renderer binding.
5. Candidate manifest f: freeze or reject. The Dockerfile root links for S3 and the Agent SDK are now unused by runtime code (image-candidate change).
6. Contracts generated drift at `document-application.metadata.json` (pre-existing since `847cd4b3`) needs the contracts owner.
7. `docs/COMPONENTS.md` lists S3 3.1148.0; actual pins are 3.1141.0 and 3.1149.0.

## Owner decisions pending

The four feature designs and build order; Office editor product and subscription; bridge trust tier; first authenticated sites; placements (schedule worker in the control service, takeover session owner on the browser host, bridge relay in the control service, disposable editor containers).

## Not run

Real PostgreSQL (no running cluster), Temporal server and worker-kill replay, live ECS stop/revocation, live SDK/CLI/provider, Docker image build and closure, native Office/PDF rendering qualification, renderer sandbox, browser/egress measurement, AWS and deployment.
