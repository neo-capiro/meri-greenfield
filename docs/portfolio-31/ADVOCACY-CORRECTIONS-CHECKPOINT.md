# Advocacy corrections — implementation checkpoint

## Binding / outline (2026-10-11)

- Isolated frontend `C:\dev\meri-portfolio-advocacy-20261011`, branch `codex/portfolio-advocacy-corrections-20261011`, reviewed root base `f15e74bce52105587390d9f6fd48dad2479f56d5`. Fresh frontend origin/main `af5c0304d1779e1a5e686f2b110d85e0ebc4827e`; backend remote main verified `fd8765ec01d292013758606204f2c9d886cd31c1`.
- Current private policy freshly fetched/read `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, remote main `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; BOOTSTRAP/AGENTS/machine-map applied. Map is the current ignored local path map (file revision date recorded in evidence). Repo standards and installed Next use-client guidance read. Explicit bundled Node24.19; approved read-only node_modules junction; no installs/copies/builds/provider writes.
- Mandatory Figma design-to-code skill read before context and screenshots for OBJ-07 `411:59667`, OBJ-08 `411:59801`, OBJ-09 `411:59935`, OBJ-10 `411:60062`, OBJ-11 matter context `411:59175`. Native shell/assets remain established shared components; dialogs contain text/select/button surfaces, no new imagery.
- Scope ownership: existing `features/advocacy/**`, focused tests and this checkpoint only. Public `AdvocacyHistory({clientId})` unchanged. Root owns Objectives composition; advocacy remains left, current objectives right, New matter retained.
- Outline: canonical schemas and bound scoped reads; source-safe provenance rendering; focused matter detail/record presentation; same-client admin-only reviewed correction dialog; fresh preflight reads, pending/duplicate guard, no automatic writes/retries; post-acknowledgement authoritative readback and cache invalidation. Failed/ambiguous writes retain review state and offer GET-only result checks. A bounded optional unassigned section uses actual timeline entries to recover detached records. No inferred advocacy/outcome/Meri rules.

## Verified contracts and limits

Source: current Core `ClientAdvocacyMatterController`, `ClientAdvocacyMatterService` and presentation interceptors. Read routes standard_user minimum; all writes user_admin minimum with inherited capiro_admin. Every service asserts nonarchived tenant/client ownership.

| Audit  | Existing contract                                                             | Verified semantics                                                                                                                        |
| ------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| OBJ-07 | POST `clients/:clientId/advocacy-matters/:targetId/merge`, `{sourceMatterId}` | Moves records, locks assignments, copies link provenance with duplicate link keys collapsed, deletes source matter. Destination retained. |
| OBJ-08 | POST `.../records/:recordId/reassign`, `{targetMatterId}`                     | Same-client target validated; reassigns, locks, clears not_advocacy and records reviewer/time.                                            |
| OBJ-09 | POST `.../records/:recordId/detach`                                           | Sets matter_id null and locks; record retained.                                                                                           |
| OBJ-10 | POST `.../records/:recordId/not-advocacy`, optional `{reason}` <=1000         | Rejects, detaches, locks, retains audit row; excluded from matter/timeline reads.                                                         |
| OBJ-11 | GET scoped matter detail                                                      | sourceType/sourceId/sourceUrl and metadata.presentation preserve source provenance; safe supplied URL can open directly.                  |

All four correction POSTs return void, with no ID/version/idempotency receipt. Readbacks can verify visible result and merge/reassign identity, not exact actor/audit persistence for rejection. No expected-version/CAS or operation key prevents concurrent races. GET timeline retains unassigned entries but caps at500 and exposes neither full source metadata nor lock/rejection audit. Paginated full ledger exists only as internal Meri tool, not a REST route; no fabricated endpoint or tool invocation is introduced. Legacy FARA/LegiWatch fallback routing is not reproduced from source-type guesses. Missing supplied URL has explicit unavailable state and source identity.

## Validation / delivery

Early focused units18/18 PASS; TypeScript PASS. First lint check rejected reading an operation ref during render; explicit submitted UI state replaces the render-time ref read, while the ref remains only an event-handler duplicate guard. No rule disabled. Pending actual composed Objectives component browser, visual comparison and final source gates. Synthetic fixtures do not establish live mutation or authenticated product-browser acceptance. No live mutations authorized for this slice; root may perform independently permitted GET compatibility checks. Preserve original baseline audit separately from implementation status.
