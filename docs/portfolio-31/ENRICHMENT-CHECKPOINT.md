# Client profile enrichment review

## Outline and ownership (2026-10-11)

Isolated `C:/dev/meri-portfolio-enrichment-20261011`, branch `codex/portfolio-enrichment-20261011`, base `2405c80eef491330dd04a79968cddc78ac338503`. Current frontend main `d16c457de7edb14e575814115d4c67f2a902cd7c`. Shared policy fetched clean, local `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, origin/main `b2b0ce8c2bf03817b81e671d968b7892985b8d06` (ahead3 preserved); machine map mtime2026-09-30T00:21:48Z. Backend inspected `C:/dev/cap-portfolio-prospect-stages-20261011` fd6ed6c with main pinned fd8765ec.

Owned new enrichment subfeature only: schemas/adapters, saved-run queries/polling, guarded review actions, setup, task ledger, current/proposed finding rendering and scoped drawer CSS. Root owns header/public composition and shared exports/config/fixtures. Public `ClientEnrichmentDialog({clientId,open,onOpenChange,onCloseAutoFocus?})`; imports canonical files and advocacy public queries. Keep the controlled component mounted while closed so uncertain-write state survives close/reopen. Existing HTTP, auth/cache and Radix Dialog reused; no dependencies. New work does not rebuild Meri execution.

Figma skill + current screenshot/context read for root411:48361 and drawer411:48691: 620px full-height right drawer, 24px side padding, task ledger and current/proposed findings, footer explicit selected apply. Values, task labels and counts come from service; fixture values are never application defaults.

## Verified contracts and material conflict

Core `ClientProfileFillController` delegates to **completion facade**, not legacy hook. GET setup/latest/run; POST cancel returns full run; POST apply returns full run (not legacy hook's imagined count); reject/restore `{ok:true}` then scoped readback; assignment `{findingId,matterId,alreadyApplied}` saves immediately. Controller start/cancel/retry standard_user, apply/reject/restore/assign user_admin. Workflow asserts accessible nonarchived client and memory-wall grants; backend owns enforcement.

**CORE065,069,127 blocked:** every new completion run schedules `district_nexus`; `gatherDistrictNexus` calls `resolveFacilityDistrict` before emitting informational results, persisting facility district/geocode fields before review. Start website also immediately seeds client website; additional LDA identities immediately create mappings/prepopulate. Omitting those fields does not remove district writes. Retried tasks can also requeue completion checks. UI does not dispatch start or task/whole-review retry. Minimal required contract: server-owned preview-only execution mode preserving exact sources (including explicit[]), attachments and offered identity scope; no canonical profile/identity/facility writes before explicit selected apply; stable request ID/receipt for ambiguous start/retry. Existing worker/governed context remains canonical. Owner: Core enrichment service / root coordination. No backend changes or live provider runs in this slice.

GET latest/run may mark stale **legacy v1** runs failed during read. This is job maintenance, distinct from profile mutation; no live reads are performed by this subtask.

## Coverage and verification

CORE064/066 saved review/poll; CORE067 selected scoped apply and partial accepted-status readback; CORE068 explicit cancel (does not undo saved fields); CORE070/071 ignore reason/restore; CORE072 explicit immediate matter apply; CORE126 select supported pending findings/current-proposed/evidence. Unknown/nonapplyable kinds are display-only. Actual backend acceptance and signed-in browser remain NOT RUN. Intercepted browser fixtures are synthetic.

Before dispatch: current nonempty user/tenant, role, cache success/error-free/not-invalidated/not-fetching and hook lifetime checked; scoped fresh run and unchanged finding snapshot. Setup/latest caches include initiating tenant and user; actor changes remount the review state. Writes never automatically retry; ambiguous responses freeze writes and offer GET-only inspection. No idempotency/CAS claim; server races remain a contract limit. Cache invalidates affected canonical client/files/profile/advocacy and actual capability/person keys. Nonapplyable legacy kinds (`lda_history`, `program_element`, `bill_recommendation`) stay informational even if saved as pending; source metadata and arbitrary server JSON remain visible. Selection is capped at the actual 200-finding apply limit.

### Independent file upload

Upload reuses canonical `files/UploadDialog`, not a second uploader. It explicitly persists a client file immediately and neither starts research nor silently includes the file in a run. Root supplied public export `7b0d8f82ae5ae4187820ebe4099a7fbe2e4811dc` and optional `beforeDispatch` guard `caffc56f527e07978f42d64371df5d227de17a50`. Enrichment captures its initiating actor, client and visible drawer lifetime; the guard is rechecked before ticket/storage/confirm and after receipt. Closing/unmounting or changing actor stops later upload boundaries. No live upload bytes or writes were sent.

## Final focused qualification (2026-10-11)

Explicit bundled Node **24.19.0**. Unit **16/16 PASS**; actual composed ClientFrame browser **14/14 PASS**; TypeScript, scoped ESLint, scoped Prettier and architecture **exit 0** (303 modules). No full build; root owns final combined qualification. Browser uses canonical application/server with a small ignored qualification config/cache on port5194 and intercepted synthetic contracts, not an alternate product architecture. Root canonical Playwright configuration can run the committed spec after integration.

Final independent review tightened the drawer lifetime boundary from passive effect cleanup to layout effect cleanup, closing the commit-to-passive-cleanup dispatch window. The held review preflight/close and delayed upload-ticket/client-view unmount cases were rerun against this two-token hook change: **2/2 PASS**, scoped lint/format exit0. The earlier full14 browser/unit/type/architecture reports apply to `f661c15`; their unchanged domain assertions are retained and root performs final combined qualification at integrated source. No claim that the earlier full run includes the later lifetime change.

Browser coverage: current/proposed evidence and partial selected apply; ignore/restore; immediate matter assignment and wrong receipt refusal; lost apply response freeze across close/reopen and GET-only inspection; fresh finding drift and closed-drawer preflight with zero POST; standard-user read restrictions; running polling and explicit cancel; unsafe start/retry disabled; wrong-client read rejection/retry; exact desktop drawer geometry, mobile dark/no horizontal overflow; canonical upload validation and delayed ticket then client-view unmount with zero storage/confirm requests. Desktop light 1440x1040 and mobile dark 390x844 screenshots were visually inspected; the responsive comparison stacks and footer remains visible. Website becomes a full row on mobile. Figma task/count fixtures are not product defaults.

Initial browser failures remain preserved: accessible select lookup included option text, corrected to its actual combobox role/name; a later navigation assertion omitted the accessible roster count, corrected to assert the real Portfolio heading plus completed ticket response before zero-storage checks. No product assertions were removed. Two earlier unit fixture errors (inconsistent child client IDs and reusing a consumed Response) were corrected; their raw console outputs were not saved as files, and this is recorded in evidence notes.

Owned source commits before the final browser/upload refinement: `732c21ec81a308d3df216ab2df501008377ed619`, `a72bbe9cda6e3ac26407facc4c6b5cfacafdf43d`, `760a01465274d42a0b86634464f77a49747d2f15`. Qualification includes root's real header/Meri menu, actor/query exports, autofocus and canonical upload guard; root already owns those prerequisite commits. No unrelated files were changed.

### Remaining acceptance and contract dependencies

- **CORE065/069/127:** preview-only start/task retry/whole-run retry contract above; Core enrichment owner/root coordination. UI deliberately offers no successful-looking research action.
- **All affected IDs:** real signed-in browser and designated backend mutation/provider acceptance **NOT RUN**. The current facade's maintenance-on-GET means even live saved-run reads were not exercised here.
- **CORE067/070/071/072:** existing mutation routes have no shared CAS/idempotency receipt sufficient to eliminate a server race or recover an ambiguous accepted write authoritatively. UI preserves draft/review and freezes subsequent writes after ambiguity; GET-only inspection does not clear the freeze.
- **CORE067:** service can save only some findings while returning a run. UI reports accepted selected-status count, not an invented all-success count or field-level transactional guarantee.

Original audit labels/evidence are preserved separately in output traceability; original `implemented` means API exists. The implementation matrix qualifies browser fixtures and live gaps independently. This slice does not claim full Portfolio or provider integration completion.
