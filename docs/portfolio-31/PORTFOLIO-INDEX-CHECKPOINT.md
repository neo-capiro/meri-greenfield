# Portfolio index and profile chooser checkpoint

## Isolation and sources

- Worktree: `C:/dev/meri-portfolio-intake-20261011`; branch `codex/portfolio-index-20261011`.
- Starting commit: `6ccfbce09b482aacecc1f354a7903315cd3fb5c1`.
- Current policy read: `capiro-agent-ops` `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; origin/main fetched, local policy changes preserved. Machine-map timestamp `2026-09-30T00:21:48.2698715Z`.
- Read repository/app instructions and IMPLEMENTATION-STANDARDS. No other feature, backend, lockfile or shared fixture changes.
- Figma design-to-code skill applied. Inspected high-fidelity context and screenshots for `411:41421`, `411:44024`, `411:44629`, and `411:45185` (the last is Add prospect, not the chooser).
- Four chooser SVG assets exported directly from Figma, with native geometry preserved. Existing shared shell/assets retained.

## Implemented behavior and audit trace

| Audit IDs                              | Implementation / current qualification                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORE-001                               | Existing GET core `/clients` feeds cards/list. Verified ClientsService.list explicitly filters tenant, excludes archived, orders `createdAt DESC`. No per-client index queries.                                                                                                                                                    |
| CORE-002                               | Case-insensitive organization name, description, primary contact, sector and actual owner-name search. Missing `Unassigned` display text is not searchable data. Location search remains blocked: Client list/model has no canonical headquarters field; facilities are a separate per-client resource. No N+1 facilities queries. |
| CORE-003                               | URL filters use actual profileStatus, sector, primary owner, CLIENT type. Known unassigned is distinct from unavailable owner data. Legacy `type=PROSPECT` deep links are identified explicitly; current Prospects navigation goes to Business Development. No synthetic at-risk classification.                                   |
| CORE-004                               | Name A–Z and Recently added (verified server order). Unsupported attention/readiness sort links disclose the fallback. Attention/readiness comparators remain blocked on matching definitions and safe aggregate contracts.                                                                                                        |
| CORE-005                               | Cards/list retained in URL; restores both current `view` and historical audit `layout` aliases. Changing view preserves filters/actions. Clear filters preserves layout and sort. This is URL state, not shared saved-layout persistence.                                                                                          |
| CORE-006                               | Actual client-resource links preserved, with existing canonical profile route. BD prospect IDs are never passed to Client routes.                                                                                                                                                                                                  |
| CORE-011 / CORE-027                    | Existing `/client-account-owners` batch supplies names and filter choices. Source SQL explicitly scopes tenant and nonarchived clients. Owner errors expose retry, and an active owner filter cannot falsely report an empty result while lookup is unavailable.                                                                   |
| CORE-012 / CORE-016 / CORE-017         | Designed Add profile chooser reuses canonical three-step `ClientIntakeDialog` for Manual entry, including existing validation, persistence, logo receipt checks and roles. No duplicate form. Existing wrapper props unchanged.                                                                                                    |
| PROS-003                               | Chooser Add prospect navigates to existing `/portfolio/prospects?new=1`, whose own stage capability discovery controls creation. No new legacy `Client(profileType=PROSPECT)` records.                                                                                                                                             |
| CORE-019–023 / CORE-097                | Designed Search LDA / Create with Meri choices are disabled with explicit availability notes. Root confirmed no allocated public import/drafting entrypoints; no substitute operation or success UI.                                                                                                                               |
| CORE-098                               | Saved card order/visibility remains blocked on shared persistence contract. No local storage or fake drag/save behavior.                                                                                                                                                                                                           |
| CORE-007–010 / CORE-086–090 / CORE-099 | Existing pulse/attention and broader analytics/assignment ownership retained. This pass does not claim these complete.                                                                                                                                                                                                             |

## Contract concerns requiring owner followthrough

1. **CORE-002 location:** propose a bounded, tenant-authorized client-list headquarters/facility-summary projection with an explicit designated location rule; backend/client-profile owner to define it. Existing `ClientFacility` has city/address, but `/clients` does not include it. Do not guess from arbitrary `intakeData` keys.
2. **CORE-004/008 attention/readiness:** historical `IntelligenceService.getPortfolioRollup` returns counts of open engagement tasks, in-progress tasks, tracked bills and next shared meeting. These are not Figma urgency, objective readiness or ranked attention. At the audited current source, its four queries use `withTenant` without explicit tenant predicates, while ClientsService documents the runtime table-owner RLS bypass. Root notified; no new consumer added. Backend owner must revalidate isolation and matching semantics before use.
3. **CORE-098:** no verified saved Portfolio layout contract. Define user-scoped persistence and version/conflict behavior before saved ordering/visibility.
4. **CORE-019–023/097:** LDA import and Meri profile draft handoffs require owning feature entrypoints and receipt semantics; root confirmed unavailable in this preview.

## Validation checkpoint

- Focused new units: 6 PASS; existing Portfolio units: 6 PASS (12 total).
- Focused ESLint PASS; architecture check PASS (209 modules).
- Full TypeScript initially failed only because this worktree's existing older dependencies lack `d3-geo` and its types introduced in the pinned base. No install/copy performed; root authorized a transient read-only resolution to its installed package. Full root TypeScript already passes its integrated base. Follow-up records browser/aliased check evidence.
- Live/backend auth, tenant/role integration and real writes are not established by fixture browser tests. No live writes or provider effects performed. Root owns full integrated build/checks and live test access.
