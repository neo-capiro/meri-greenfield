# Meri package three review — 15 October 2026

**Aggregate implementation, reproducible integration, image and live release: HOLD.** Exact reviewed candidate: `81e20025b7a805ac28a44f2044df87b0ebab905b`, tree `324764ed9358c45cf0ab72a7f7ca523715e2a83e`, branch `fable/repair-package-3-20261015`. Package two `69040f9b4ab2d239bec1a057354d578d2bf24b1e` is its ancestor (+41/−0). Fable retains implementation ownership. This publication records supplied independent reviews and the coordinator's bounded technical decision; the documentation lane did not rerun their source tests or perform product changes.

## Exact review outcomes

| Complete report | Scoped disposition |
|---|---|
| [Lifecycle](PACKAGE3-LIFECYCLE-REVIEW.md) | **L1 terminal-settlement source ACCEPT.** Both retained 45 ms cases and same-event lost-ACK replay are corrected. **L4 recovery HOLD:** restart cannot reconstruct a stop-only retirement owner; failed/cancelled sources that never allocated have no successor path. |
| [Browser/PDF structure](PACKAGE3-BROWSER-REVIEW.md) | **Package-two PDF reference-generation R1 source HOLD closed.** Page-tree reference/coherence repair ACCEPT; prior H1–H5 corrections retained. Live browser/SDK/egress, native output and contract gates remain held. |
| [Artifact/PDF revision](PACKAGE3-ARTIFACTS-REVIEW.md) | **Bounded complete-spec/default-template PDF rerender and exact-parent lineage source ACCEPT.** Product HTTP PDF admission and renderer/image/sandbox/native qualification remain HOLD. Prior DA-1/DA-4 safety and DA-3 frame-layout acceptances are preserved. |
| [Integration/dependencies/proof](PACKAGE3-INTEGRATION-REVIEW.md) | **Canonical-owner S3/Agent SDK seams, accepted-repair preservation, lane inclusion and final candidate-f static proof 5/5 ACCEPT.** Not an all-green clean checkout or complete image closure. P2b synchronization remains independently incomplete. |
| [Product/reads/schedules](PACKAGE3-PRODUCT-REVIEW.md) | Useful source foundations; **production general reads, complete scheduling and full-product integration HOLD**. No qualified ordinary-run read composition or registered schedule execution exists; exact-effect reconciliation has a concrete incomplete-comparison finding. |
| [Feature design](PACKAGE3-DESIGN-REVIEW.md) | **Recommendations/proposals only.** No new user approval of first-shipment scope, Collabora purchase/budget, device/browser access, authenticated sites, design or placement is recorded. |

These advances apply at this immutable pin. Source presence, ancestry and disclosed limitations do not establish working production composition. The [package-two evidence/source record](PACKAGE2-REVIEW-20261015.md) and all earlier reports remain unchanged; prior frontend portable automated evidence acceptance and its manual accessibility/mobile/live limits carry forward without a new frontend review.

## Repairs that advanced

**L1:** terminal publication now has a finite default of 3,000 ms per attempt, at most two rounds over two events (12 seconds at default), with IDs/time allocated once. Both original 45 ms failures now terminalize failed/UNKNOWN; a committed terminal with a lost ACK replays the same event. Exhausted publication has a retirement-gated reconciliation path, not unconditional availability: uncertain stop/commit still refuses settlement. For existing allocations the reconciler requires journaled RETIRED plus physical-stop evidence; it does not trust a stop return alone. Preserve the good output fence, applied-checkpoint protection and exact writer/binding checks.

**PDF structure:** `/Pages` now uses the existing object resolver with exact generation checks; the bounded tree walk validates root/child types, Parent references, Count and repeated nodes. The retained same-byte generation counterexample now refuses. All twelve new malformed assertions reject through validator, grader and synthetic download with zero ingests/receipts; coherent nonzero generations remain valid. This closes the reviewed reference defect, not native PDF usability or a claim of complete arbitrary PDF support. Prior XML-allocation/raw-stream-cap recommendations remain nonblocking hardening work.

**PDF revision:** create and revise generate fresh DOCX from the full supplied spec, with `base:null`, then use an injected converter. Retained PDF bytes never enter the DOCX parser. Intermediate/converter hashes and exact-parent CAS/replay are retained. This is typed-content replacement, not arbitrary existing-PDF editing, unmodelled style preservation or byte-identical fresh rendering. A stale parent can reject after an object effect; ARTIFACT_EFFECT_UNKNOWN is honest, not a zero-effect refusal. Product admission still permits DOCX/TXT/XLSX only; merely providing an officeTransformer is not qualified renderer admission.

**Integration:** accepted cancellation/proxy/readiness/plugin source is preserved. Cleanup now uses `canonicalSha256(binding)` unconditionally, closing the inherited nonblocking wrong-ID injected-receipt hardening caveat. S3 and Agent SDK re-exports preserve their owning packages' ESM identity without a second SDK or provider policy.

Final candidate-f SHA-256 **`3215210633f64dcb4c8d98aa1c7e17af658c512511bc4f7bdf3df4f8a4085017` is ACCEPT as the reviewed static candidate only**. Its 45 historical paths (18 changed, 27 unchanged), predecessor preservation and current-row checks passed 5/5. It retains null sourceHead/publicationSource and HOLD status. Acceptance does not seal earlier f bytes, a full tree, image, build or admission; historical manifests remain immutable.

## Remaining source and product work

- **L4 restart:** a fresh process with durable ALLOCATED state but no in-memory controller cannot stop/retire the original; memoized close yields KICKOFF_UNKNOWN. Supply a bounded stop-only owner reconstructed from exact durable allocation/issuance facts, with no allocation, redispatch, resume or release. Preserve revocation/physical-stop evidence and UNKNOWN, and provide durable re-entry after finite reconciliation exhaustion.
- **L4 no-allocation successor:** failed/reconciled or cancelled-before-allocation sources cannot supply the required retired allocation; terminal state also prevents creating it later. Add trusted explicit no-dispatch/no-authority evidence and claim-versus-terminal exclusion. **Never equate a missing row with safety.** Existing-authority cases still require retirement/revocation. Fresh SDK sessions do not restore prior model context; durable history is a different claim.
- **General reads:** three constructible mail tools share one `meri_reads` SDK server and the canonical gateway, but the normal runner supplies no generalReads port. Production installation/discovery/policy and legitimate no-skill budget allocation are absent. Do not fake a skill or widen grants. Worker receipts are process-local; durable scoped visible tool-history/citation/reload linkage remains unimplemented. Other read families, governed non-reads and 14-skill completion remain required.
- **Schedules:** fixed occurrence identities and evidence-only reconciliation are useful. Canonical startup does not register the workflow/activities; current authority and retained approved instructions are missing. The wrapper returns after dispatch and does not own actual-job overlap, cancellation/physical stop, cost/runtime/retry limits or delivery destination. Preserve an UNKNOWN barrier beyond wrapper timeout and bind each occurrence to its actual conversation/native effect.
- **Schedule correctness:** create/update reconciliation compares only an action tuple, not cadence/spec/policies/paused state/limits/retries, yet may clear the intent barrier. Define and compare the complete provider-normalized approved effect, or keep non-comparable evidence unresolved; add real describe-shape mismatches. CLAIMED/unknown effects without proof remain blocked, not recovered availability.
- **Startup and broader gates:** general reads/schedules do not close artifact/action/session/approval composition, conversation discovery/history/reload, authoritative retention/restore or browser-independent Objective → Strategy → Planner. P2b's stopped-review/no-retry boundary remains; provenance cannot supply its missing semantic acceptance. Browser stays desired ON with destination deny-by-default and live activation held.

## Coordinator technical owner decision — bounded source work for Fable

**ACCEPT the integration review §3's explicit dependency declarations at existing pins**, with minimal affected-lock regeneration and no upgrades/new providers:

| Owner | Approved declaration / existing ownership |
|---|---|
| `apps/control/conversations` | devDependencies `pg 8.23.1`, `@temporalio/common 1.24.0` |
| `apps/worker/conversation` | dependency `zod 4.6.7`; devDependency `@modelcontextprotocol/sdk 1.32.1` |
| `apps/worker/qualification` | dependency `zod 4.6.5` |
| Root package | devDependencies `pg 8.23.1`, `jszip 3.10.2` |
| Schedule Temporal client | Retain conversations ownership at `@temporalio/client 1.24.0`, through its anchored require or an owner re-export; no duplicate root install. |

Preserve already locked resolutions/integrities. Storage's independent `pg 8.23.0` test pin is not upgraded. No new S3/Agent SDK runtime lock is needed for the accepted owner seams. Keep the frozen SDK type-only fixture exception scoped. Remove only resolved guard exceptions, retain unresolved debt, and qualify a pristine archive without comparison links. This is technical source-work coordination, **not deployment, spending, credentials, feature-design or placement approval**. No manifests or locks were changed by this publication.

## Checks, failures and exact evidence limits

| Review | Independently executed | Limits |
|---|---|---|
| Lifecycle | 24 syntax checks; **19 scripted scenarios: 16 good-behavior checks and 3 reproductions of the two L4 gaps**. | Extracted pinned bodies/scripted SQL; synthetic SDK/retirement/schema/hash boundaries. Not real PostgreSQL concurrency, process kill, grant revocation, Temporal replay or measured two-minute recovery. |
| Browser/PDF | **43/43** browser/structure tests; twelve old/new malformed comparisons, four generation probes and eleven retained malformed checks. | Twelve new assertions are inside one test, not twelve additional suite cases. No real browser/SDK/renderer/egress or package-wide rerun. |
| Artifacts | **6 passed, 1 native skip**, plus **2 supplemental passes**; real DOCX generation with synthetic PDF converter. | Separate durable lineage file inspected, not independently executed; owner 22/2 and LibreOffice 8/8 remain author evidence. Product/native PDF remains unqualified. |
| Integration | **5/5 static proof**, verified partial blobs/ancestry and owner seams. | No pristine final-package full-suite run, install, image build or live qualification. Dependency guard is a regex debt ratchet, not a full resolver or proof all imports/suites work. |
| Product/design | Read-only source/test/report tracing and recommendation review. | No independent repository-test, source-grant, SDK/mail/Temporal/browser execution or vendor purchase. Static schedule witness/clock deduction are not live bypasses. |

Runtime **221/228** and schedules **153/154** remain failed owner-reported aggregates. Raw final receipts were not supplied; do not certify every failure as environmental. The earlier clean archive's 27/38 passing suites, 9,066 passes and 169 failures are also owner evidence, not a clean final checkout. The baseline inventory omits runtime telemetry and worker browser/reads cases; publish exact separate commands or complete the inventory before claiming full coverage.

Two focused corrections are source-supported: Docker-copy testing still compares current files against obsolete historical hashes, so Docker availability alone cannot make that assertion pass; select the reviewed frozen candidate for current bytes while preserving historical verification. The schedule expiry fixture mixes frozen logical time with ambient `Date.now()-1`; derive all boundary times from one injected clock and rerun the full suite, retaining the failed receipt. This does not change production clock policy. Runner-bootstrap's chmod/root-sensitive fixture is distinct from the runner workspace guard; exact observed errors still need portable logs.

## Prioritized Fable follow-up and unapproved design choices

1. Close L4 stop-only restart/no-allocation evidence paths and complete-effect schedule reconciliation with focused race/UNKNOWN regressions. Preserve accepted L1/PDF/cleanup fixes, finite bounds and immutable identities.
2. Apply the bounded dependency decision; repair Docker-proof selection and the frozen-clock fixture; complete the suite recipe and supply portable final command/source-export/Node/UID/selectors, failing names/stacks, stdout/stderr hashes and targeted-rerun receipts. Qualify pristine source without stale hoists; retain failures.
3. Compose ordinary reads and schedules with canonical current authority, installations, budgets, retained instructions, actual-job lifecycle and UI evidence owners. Bind/admit/qualify a real PDF renderer and execute HTTP create/revise/inspect/download/replay before product acceptance. Preserve all independent live/image/scan/database/isolation/SDK/Temporal/egress/native gates.
4. Resolve feature designs explicitly with Neo. Repository prose quotes recorded first-shipment intent; **this review does not independently confirm that scope or approve designs/placements**. Collabora-through-WOPI is an evaluation recommendation, not a subscription, numeric budget or verified Meri commercial offer. The 30–47 engineer-week estimate is unvalidated author planning. Browser-device permissions/trust-tier acceptance, named authenticated sites/tasks, deployment placements and any purchase remain unconfirmed. Neither deferral nor release optionality is silently adopted.
5. Refine the design findings before implementation approval: exclusive takeover must fence/drain in-flight agent actions; suppress model-bound login snapshots/credentials; destroy all authenticated state; define WOPI repeated-save/CAS/draft recovery; enforce urgent disable/revocation during active runs. The user-device browser is outside infrastructure egress controls; intranet support conflicts with public-only filtering and requires a separate explicit decision. Recommendations grant no device installation, credential persistence, cloud resources or scope commitment.

## Delivery integrity and preservation

All seventeen chunks were complete and untruncated. XML transport decoding and separator-free concatenation preserve the transferred prose; these hashes match the coordinator's supplied values:

| Report | Bytes | SHA-256 |
|---|---:|---|
| `PACKAGE3-ARTIFACTS-REVIEW.md` | 9,895 | `1ff133f4503dd23870796aef6fb7e429949dcba07ec04c90d75736bed687ec6f` |
| `PACKAGE3-BROWSER-REVIEW.md` | 11,240 | `a17ba0fc05b5bf8f1ce601e48ac7b94f124b0ee6f9354602175fc88376bf3d8e` |
| `PACKAGE3-DESIGN-REVIEW.md` | 11,788 | `ded6d6a785624b3310ff96e4feaefca0cd8dce450f11dd134155d675616b657e` |
| `PACKAGE3-INTEGRATION-REVIEW.md` | 23,241 | `9501eb8010bf260eb4887c341cdc7d4032855b3c1932062235e7ac22ef862da1` |
| `PACKAGE3-LIFECYCLE-REVIEW.md` | 13,432 | `3fcd3cdc25152deeda8ae14b522ddff2dfdac04bad5a01323ee117de11e5edfb` |
| `PACKAGE3-PRODUCT-REVIEW.md` | 21,178 | `467cd2eabf38d892d75039eb696380caaf14cedcfdc98a023e1faeb2a49b2930` |

All twenty-one prior audit/review files remain unchanged. Their earlier pin-specific HOLDs are historical evidence; only the identified findings advance here. Reviewer scratch artifacts referenced in the six complete reports are not included in this publication. No product edits, scope decisions, purchase, security/permission change, activation, migration, image build or deployment was performed by this documentation lane.
