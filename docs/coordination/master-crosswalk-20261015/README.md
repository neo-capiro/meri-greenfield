# Current master requirement and source crosswalk - 15 October2026

**The master scope remains aligned with the original plans. Current work covers child milestones, not fullv1.** The coordination defect is stale source tracking, not demonstrated abandonment of the plan. This is an evidence overlay over the existing master, not a competing/reduced plan. No scope, threshold, release gate, runtime capability or source permission is approved by this publication.

Both newly supplied Library originals were read completely: `Meri_Greenfield_Agent_Plan(2).docx` (57,656 bytes,673 extracted lines) and `Meri_Codex_Hermes_Deployment_Plan(1).md` (34,216 bytes,367 lines). The original deployment document is not asserted byte-identical to the later86848-byte R2 revision. The Git Greenfield DOCX is57,656 bytes with SHA256 `80a96320bde810214127919ddfe14659e3efd44d7ee7f6ae57d51527bc814ad7`; matching Library byte count alone is not a binary hash comparison.

## Canonical sources and authority

Fresh remote main: `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`, tree `f1133b2190cf67acd782c00debfa82501fa71c43`. Fable candidate: `f0befe1e486cfda644f1f6170cf3d9d671e5158f`, tree `fb58adeccde7c5c7c48a5562ac3108b888a6d17e`. The master plan and accepted scope have identical bytes at those two pins. Source/candidate branches are cited without merging their product files into this main-based docs branch.

| Record | Exact source | Meaning |
| --- | --- | --- |
| Current R2 master | [MERI-DEPLOYMENT.md at main](https://github.com/neo-capiro/meri-greenfield/blob/8b123bea4c90794dc2d766814b6ddbdbfe0928bc/docs/plans/MERI-DEPLOYMENT.md) |86848 bytes, SHA256 `43f9be7c385a1e321dbc9721bd7ff97752031a62e661f7691b78e0a20fd7c388`; W00-W11, G0-G7, R/REL/RG and original v1 requirements retained |
| Greenfield background plan | [Original Git DOCX](https://github.com/neo-capiro/meri-greenfield/blob/8b123bea4c90794dc2d766814b6ddbdbfe0928bc/docs/plans/Meri_Greenfield_Agent_Plan.docx) | Unaffected original architecture, source coverage, artifact/browser/durability and release scope |
| Accepted selected/deferred scope | [CAPABILITY-SCOPE.md](../../CAPABILITY-SCOPE.md), [historical immutable scope](https://github.com/neo-capiro/meri-greenfield/blob/8b123bea4c90794dc2d766814b6ddbdbfe0928bc/docs/CAPABILITY-SCOPE.md) | D012139 IDs:96 selected/43 deferred; scope acceptance is not parity |
| Source discovery | [22-domain inventory](https://github.com/neo-capiro/meri-greenfield/blob/f0befe1e486cfda644f1f6170cf3d9d671e5158f/docs/SOURCE-INVENTORY.md) | Agreed domains and policy surfaces, not current live credentials/coverage |
| R2 traces | [requirements](../r2/requirements.json), [tickets](../r2/tickets.json), [gates](../r2/gates.json), [capabilities](../r2/capabilities.json), [skills](../r2/skills.json) | Original workbook fields preserved; source-only capability/manifest overlays repaired with immutable pins |
| Whole-plan predecessor | [53-row reconciliation at f0](https://github.com/neo-capiro/meri-greenfield/blob/f0befe1e486cfda644f1f6170cf3d9d671e5158f/docs/qualification/candidates/original-runtime-20261013/reconciliation.json) | Historical assessments with original row/plan hashes; old missing-source classifications are not current absence claims |
| Current crosswalk | [crosswalk.json](crosswalk.json) | All53 rows -> accepted/deferred -> source commit/path/hash -> owner -> evidence level -> remaining gate;139 native rows and14 skills included |

Current explicit user instructions govern: D005 permits dedicated isolated browser-host qualification following measured Fargate failure; it does not qualify a host automatically. D014 and later consolidation put product UI in `neo-capiro/capiro-frontend`, with Meri backend/contracts separate. Mobile is explicitly deferred, not marked passed or silently removed. Current Codex/Fable/backend/frontend/Shipping allocations govern development; historical Hermes CLI/Kanban/session instructions are not mandatory product requirements and do not supersede newer ownership. Earlier worker decisions remain historical evidence.

## Current whole-plan position

**G0 historically accepted; G1 OPEN; G2-G7 unaccepted.** The53 trace rows retain2 discovery acceptances,45 open core rows and6 disabled optional rows. No new whole requirement or runtime gate is accepted here. REL-01..06/09 remain mandatory pending qualification; REL-07/08 remain optional/disabled. RG-01..09/12 remain core pending; RG-10/11 remain optional/disabled unless explicitly promoted.

| Master package | Current source/evidence and owner | Remaining whole-package gate |
| --- | --- | --- |
| W00 discovery/scope | Accepted discovery; Codex;139-row ledger/22-domain inventory | Preserve actual identity/source decisions; later activation separately qualified |
| W01 contracts | f0 descriptor/skill assets; separate `.2` Strategy candidate; Codex plus consumer owners | Full typed handler/source/control mappings and joint contract acceptance; no descriptor/test -> runtime promotion |
| W02 runtime qualification | f0 runtime source under17 correction findings; Fable source, Shipping actual execution | Image/security/proxy/native discovery/egress/restore/browser/Temporal qualification; G1 remains OPEN |
| W03 foundation | Infrastructure/qualification source and source allocations exist; Shipping/Codex | Full isolated product deployment/OIDC/services/persistence/network/runbooks and G2 evidence |
| W04 authorization/reads |96 selected descriptors and bounded source adapter work; backend/source owners | All agreed source and current membership/client-wall/mail/memory authority, exact reads/search/history/paging/coverage; no null-ledger -> absent-source inference |
| W05 durable runs | f0 conversation/retention/issuance/runtime source; Fable; historical PR86 maps separate | Durable S1/equality, real startup/per-entry transport, S4 current authority, retention suppression, physical retirement/revocation, complete session/files/approval/schedule recovery |
| W06 UI | capiro-frontend ownership/consolidation; backend event owner separate | Accepted visible-control real authenticated E2E, shared shell, streaming/history/steer/fork/approvals/files/schedules; mobile explicitly deferred |
| W07 artifacts/browser | Governed artifact and local native-output source/evidence; Fable/Shipping/viewer owner | Full native generate/render/revise/immutable-version/preview/download/filing quality; browser workflows individually qualified |
| W08 selected mutations | Source command contracts/adapters; backend/source owner | Memory proposals/tasks/artifact filing with immutable approval/current authority/expiry/idempotent receipts and zero duplicate effects |
| W09 verification | Source reviews/local PG/process/artifact checks exist; independent QA/Codex | Full original release suites plus frozen held-out R2 cohorts; no pooling unrelated source captures into a PASS |
| W10 staging | Candidate preparation only | One immutable integrated source/image/config/contracts/migrations/Temporal/corpus cohort; restore/rollback/lifecycle and full G6 |
| W11 controlled release | Release coordination only | Accepted staging, explicit allowlist/canary authorization, measured quality/cost/error and rollback; G7 unaccepted |

First authenticated chat/continuation repair is a child of W02/W05/W06/G1/G4/RG-12. Retention/issuance corrections support W05/W09/G4/G6/RG-07/RG-12. Neither milestone replaces artifacts/browser, full source coverage, complete selected workflows, schedules, command qualification or release acceptance.

## What the tracking repair changes

- Fable catalog0.2.15 contains97 descriptors and exact mappings for all96 selected native IDs. `r2/capabilities.json` now links those candidate descriptors;43 deferred rows stay deferred, and all139 retain `runtimeParity:NOT_QUALIFIED`. Every descriptor still has `handler:null`/`availability:unimplemented`. This does not deny separately installed handler/source code or integrate Fable into main.
- All14 original manifest/prose pairs are indexed at1.0.0 in f0. `r2/skills.json` now records actual source versions/paths/hashes, without claiming14 fully executable/qualified workflows. Bill Watch's bounded Congressional brief remains a subset of its wider promise.
- [Durability](https://github.com/neo-capiro/meri-greenfield/blob/f0befe1e486cfda644f1f6170cf3d9d671e5158f/docs/coordination/reports/FABLE-DURABILITY-COVERAGE-MAP-20261014.md) and [document](https://github.com/neo-capiro/meri-greenfield/blob/f0befe1e486cfda644f1f6170cf3d9d671e5158f/docs/coordination/reports/FABLE-DOCUMENT-COVERAGE-MAP-20261014.md) maps remain explicitly pinned to PR86 `c6053e24b465be677cc5980533009b4aab03beab`. They are not renamed current f0 qualification. The [current correction pickup](https://github.com/neo-capiro/meri-greenfield/blob/e6e3016e215126dfaf4cb4aa8ed13cd5a1bee4f7/docs/coordination/reports/DOT-FABLE-PICKUP-ALLOCATION-ADDENDUM-20261015.md) separately retains17 findings and source HOLDs.
- The queue's no-migration statement is historical. The [central allocation record](https://github.com/neo-capiro/meri-greenfield/blob/e6e3016e215126dfaf4cb4aa8ed13cd5a1bee4f7/docs/coordination/tasks/CODEX-CENTRAL-MIGRATION-ALLOCATION-20261015.md) confirms0009, reserves conversations0010/artifacts0002 retention and Fable0011 issuance.0012 remains unreserved/unassigned. No SQL was applied by this repair.
- Scope table labels now render human-accepted selected/deferred rather than provisional proposal labels. Original proposal wording remains at the immutable predecessor. Queue source-child progress is distinguished from whole-milestone pending acceptance.

The separate [Strategy candidate pickup](https://github.com/neo-capiro/meri-greenfield/blob/5bedcf675b86de6ca3b48a76d6513674f346d86e/docs/coordination/reports/DOT-STRATEGY-CANDIDATE-V2-PICKUP-20261015.md) remains source-only and unwired. Its21 local tests and dependency fingerprints do not freeze the public wire. Trusted applicationTarget/canonical association, distinct delegated/backend/Meri attempt identities, trusted observation time, Core custody-versus-applied/Planner receipt projection, named service identity and protected result custody remain joint decisions. Backend source intents/pure policy helpers are not a dispatcher, live delegation, automatic flow or new D012 capability grant. Keep that source lane separate from this docs-only branch.

## Original quantitative gates are unchanged

- At least60 representative end-to-end tasks; at least90% successful completion and95% checked factual correctness.
- At least100 adversarial isolation cases with zero unauthorized disclosure;100% agreed source inventory and within-tenant policy fixtures, including stored-context revocation.
- 100% benchmark native files open; supported formulas/reference totals correct; at least95% human quality; no critical corruption/clipping; original versions preserved.
- 100% restart/retry controls; recovery within2 minutes on healthy infrastructure; zero duplicate mutations.
- 100% accepted visible controls end-to-end, with source/version/tenant scope preserved; explicit mobile deferral is not a passed mobile test.
- 10 concurrent runs: p95 acknowledgement at most2 seconds; fresh readiness at most90 seconds; complete usage, budgets, deadlines and failed/cancelled/retried/subagent accounting.
- Complete retention/deletion/restore/rollback/in-flight compatibility and source scope protection across stores.

R2's75 initial real requests expanding to200 labelled held-out reliability cases and its RG targets supplement these gates. They do not replace or weaken them. The30-second revocation deadline remains a proposed target requiring an accepted numeric bound before G3 and actual measurement; writing it in a plan is not acceptance or a test. `crosswalk.json` preserves all18 master release-criterion rows verbatim, plus original53 requirement row hashes and workbook gate fields.

## Verification and remaining scope

`python docs/coordination/master-crosswalk-20261015/build.py` uses only explicit local Git objects and documentation data; it performs no network, runtime import or qualification call. Fetch the named immutable objects if reproducing from a narrow clone. [verification.json](verification.json) records document consistency only:53 original row hashes,139 IDs/96-43 scope,96 exact registered references,14 manifest/prose pairs and zero runtime promotions. Parent/independent consistency review remains separate from runtime gate acceptance.

The major remaining scope is the complete original v1: current-authority source coverage and selected workflow semantics; qualified native SDK/proxy/task identity and real recovery; full document/browser/approval/schedule/product UI integration; image admission; measured reliability/task/artifact/isolation/load/lifecycle gates; and staged/canary/rollback/restore evidence. A credible first chat is useful progress, never the full release. No new runtime, Fable source, contract export, migration, AWS/model call, private scan or production resource is changed by this docs lane.
