# Client profile enrichment review

## Outline and ownership (2026-10-11)

Isolated `C:/dev/meri-portfolio-enrichment-20261011`, branch `codex/portfolio-enrichment-20261011`, base `2405c80eef491330dd04a79968cddc78ac338503`. Current frontend main `d16c457de7edb14e575814115d4c67f2a902cd7c`. Shared policy fetched clean, local `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, origin/main `b2b0ce8c2bf03817b81e671d968b7892985b8d06` (ahead3 preserved); machine map mtime2026-09-30T00:21:48Z. Backend inspected `C:/dev/cap-portfolio-prospect-stages-20261011` fd6ed6c with main pinned fd8765ec.

Owned new enrichment subfeature only: schemas/adapters, saved-run queries/polling, guarded review actions, setup, task ledger, current/proposed finding rendering and scoped drawer CSS. Root owns header/public composition and shared exports/config/fixtures. Public `ClientEnrichmentDialog({clientId,open,onOpenChange})`; imports canonical files and advocacy public queries. Existing HTTP, auth/cache and Radix Dialog reused; no dependencies. New work does not rebuild Meri execution.

Figma skill + current screenshot/context read for root411:48361 and drawer411:48691: 620px full-height right drawer, 24px side padding, task ledger and current/proposed findings, footer explicit selected apply. Values, task labels and counts come from service; fixture values are never application defaults.

## Verified contracts and material conflict

Core `ClientProfileFillController` delegates to **completion facade**, not legacy hook. GET setup/latest/run; POST cancel returns full run; POST apply returns full run (not legacy hook's imagined count); reject/restore `{ok:true}` then scoped readback; assignment `{findingId,matterId,alreadyApplied}` saves immediately. Controller start/cancel/retry standard_user, apply/reject/restore/assign user_admin. Workflow asserts accessible nonarchived client and memory-wall grants; backend owns enforcement.

**CORE065,069,127 blocked:** every new completion run schedules `district_nexus`; `gatherDistrictNexus` calls `resolveFacilityDistrict` before emitting informational results, persisting facility district/geocode fields before review. Start website also immediately seeds client website; additional LDA identities immediately create mappings/prepopulate. Omitting those fields does not remove district writes. Retried tasks can also requeue completion checks. UI does not dispatch start or task/whole-review retry. Minimal required contract: server-owned preview-only execution mode preserving exact sources (including explicit[]), attachments and offered identity scope; no canonical profile/identity/facility writes before explicit selected apply; stable request ID/receipt for ambiguous start/retry. Existing worker/governed context remains canonical. Owner: Core enrichment service / root coordination. No backend changes or live provider runs in this slice.

GET latest/run may mark stale **legacy v1** runs failed during read. This is job maintenance, distinct from profile mutation; no live reads are performed by this subtask.

## Coverage and verification

CORE064/066 saved review/poll; CORE067 selected scoped apply and partial accepted-status readback; CORE068 explicit cancel (does not undo saved fields); CORE070/071 ignore reason/restore; CORE072 explicit immediate matter apply; CORE126 select supported pending findings/current-proposed/evidence. Unknown/nonapplyable kinds are display-only. Actual backend acceptance and signed-in browser remain NOT RUN. Intercepted browser fixtures are synthetic.

Before dispatch: current nonempty user/tenant, role, cache success/not-invalidated/not-fetching and hook lifetime checked; scoped fresh run and unchanged finding snapshot. Writes never automatically retry; ambiguous responses freeze writes and offer GET-only inspection. No idempotency/CAS claim; server races remain a contract limit. Cache invalidates affected canonical client/files/profile/advocacy and actual capability/person keys. Tests/results to follow.
