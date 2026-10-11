# Calendar meeting preparation checkpoint

## Scope and pinned sources

- Worktree `C:\dev\meri-portfolio-facilities-20261011`, branch `codex/portfolio-meeting-prep-20261011`; clean starting commit `983ae6a55342b17e6e90b9188de5e172858cfed8`.
- Shared policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; fetched origin/main `b2b0ce8c2bf03817b81e671d968b7892985b8d06`, local ahead history preserved. Machine map revision `2026-09-30T00:21:48.2698715Z`.
- Backend reference `C:\dev\cap-portfolio-prospect-stages-20261011`, HEAD `fd6ed6c017ae91ab774fd34f74475a746de13b68`. Read-only inspection only.
- Figma design-to-code skill loaded; high-fidelity context and screenshots inspected for `411:64347` (Prep workspace), `680:142737` (edit), `680:142847` (settings), `683:142768` (progress), `683:143005` (sources).
- Audit scope: ENG-prep_generate, ENG-prep_progress, ENG-prep_cancel, ENG-prep_refine, ENG-prep_monday_read/save, ENG-prep_sources; no broader Module redesign.

## Implementation outline (before source edits)

- A focused `calendar/preparation` feature owns preparation presentation, editable content, search settings and durable job interaction. Public interface `MeetingPreparation({meeting: Meeting})`; root owns `MeetingDetail` composition and canonical meeting-validator integration.
- One preparation validator is imported by the canonical calendar meeting schema; no second differently projected meeting request or cache type. Existing HTTP, QueryClient, identity, Radix Dialog, TextareaField and design tokens are reused.
- Data adapters validate meeting/job/client receipts. Separate query/mutation hooks own server-state and invalidation; components own transient drafts. SessionBoundary already replaces all caches on authenticated scope changes.
- Generate uses verified capability and runtime posture, keeps its request key for an explicit same-payload retry, and polls persisted latest-job status. Cancel/resume are explicit mutations; failures never fabricate completion or erase the previous prep. Board mappings are user/client scoped and validated.
- Backend controller requires standard_user or higher. Writes also enforce ownMeetingWhere and saved-source access; durable jobs recheck membership, client memory access and assignment. Generation/edit auto-approve; there is no separate prep approve route. No sharing/confidentiality toggles are added here.
- Verification: focused unit contract/receipt/line-edit tests, synthetic component-browser positive/pending/failure/retry/permission/settings cases at temporary isolated port5194; focused type/lint/architecture/format checks. Root owns combined final Next/build/browser acceptance. No live LLM/provider writes, migrations, deployment, dependency installs or shared changes.

## Verified contract references

- `apps/api/src/engagement/engagement.controller.ts`: capabilities1986; DTO451–509; generation2239, latest2253, mapping2258/2263, job2268, cancel2273, resume2278, patch2285.
- `apps/api/src/engagement/meeting-prep-job.service.ts`: submit/get/mapping/cancel/resume; authorize430–500; publicJob502. Jobs queued/running/completed/failed/cancelled, with jobId/meetingId/stage/depth/prepId/errorCode/deadlineAt/createdAt/updatedAt.
- `apps/api/src/engagement/engagement.service.ts`: getMeeting1413, decorateMeetings2399–2483, updateMeetingPrep7007; source access rechecked, edits set approved/contentEdited; meetingInclude10750 returns latest prep.
- `engagement-access.helpers.ts` ownMeetingWhere36: caller-created or caller-owned calendar, excludes deleted. Client filter is not an access control.
- `PATCH meeting-preps/:id` supports summary and up to80 strings per agenda/talkingPoints/risks/followUps/emailEvidence. Service supports expectedRevision internally but current DTO does not declare it: do not invent a frontend revision precondition.

## Validation and remaining limits

## Delivered structure and behavior

- Initial feature commit `de3f310ef31f754bcf0c00e96e6f57f2ce3347dd`; root integrated it as `21cf37d`. Root canonical composition `6ccfbce` was cherry-picked locally as `0688b9d`; root receipt/scope/drawer integration `5b90b9f06b3a29f764011ac90387977f875efa1a` was cherry-picked as `77c2c82`. The final followup is a separate local commit, reported in the handoff.
- `schema.ts` is the single canonical preparation validator consumed by calendar/contracts.ts. It retains structured agenda/evidence-linked text, email evidence, comprehensive briefing, saved source excerpts/quotes/references/coverage and sharing state. Omitted sharing state is unknown; only explicit null is shown as private.
- `api.ts` owns validated endpoint adapters; generation/PATCH receipts require matching meeting and client, PATCH also matches prep ID. Job responses match meeting/job. Mapping receipts match client and exact canonical board selection. `hooks.ts` owns job polling, explicit generation/cancel/resume and shared cache invalidation.
- `editing.ts` computes changed sections only: a summary change does not flatten or erase untouched evidence-linked agenda/talking points. Changed list sections use the service's string array contract, capped at80. Edit failures retain the draft; close/cancel requests expose explicit discard controls.
- `MeetingPreparation` composes content, source settings, editor and progress dialog. Capability/runtime/role/loading/error states gate controls. Completed jobs invalidate the canonical meeting and calendar feeds. Queued/running is never treated as finished. Failed/cancelled runs preserve the previous briefing. An ambiguous comprehensive submission offers an explicit retry of the same key and frozen payload; legacy synchronous uncertainty does not automatically resubmit.
- Settings use server-backed personal/client board mappings, preserve exact 24-digit IDs as strings, reject wrong-client responses, prevent generation with unsaved or failed settings, and submit the selected depth. No local storage/shared-persistence substitute.
- Verified compatibility: `engagement.service.ts:5673` also writes institutional provenance `{schemaVersion:'research_portfolio_institutional_v1',briefing:true,reviewStatus:'unreviewed_draft'}`. This recognized sentinel renders flat saved content and its originating-review notice; it does not expose generic auto-approved editing/regeneration. Unknown boolean briefing formats fail validation.
- Root's designated-account read uncovered a second saved format: email evidence is either text or `{summary:string,sourceId:string,sourceUrl:string}`. The canonical validator accepts only these verified alternatives. Content and Sources retain summary/source ID and expose only absolute HTTP(S) links without embedded credentials. Structured email evidence is read-only in the generic editor because its PATCH DTO only accepts strings; unrelated edits preserve the original objects. The original live failure is retained under `outputs/evidence/portfolio-integration-20261011/live-preparation-schema-failure.json` and `live-preparation-shape.log`; root owns the corrected live readback.
- No new dependencies, providers, frameworks, static assets, API origins, authentication changes or backend code. Existing Radix close primitive/buttons, Geist, tokens and approved dark gradient reused. Figma's example source text, attendees, prices and counts are not production values.

## Checks and evidence

Evidence directory: `C:\Users\Administrator\Documents\Codex\2026-10-10\implement-capiro-3-1-portfolio-in\outputs\evidence\meeting-preparation-20261011`.

- PASS: strict TypeScript; focused ESLint; Prettier; architecture checks (foundation direction, typed boundaries, remote origins, cycles); focused unit suite15new preparation cases plus existing11 Calendar tests. Exact final counts/exits are in `results.json` and logs.
- PASS: actual CalendarPage → MeetingDetail → public preparation feature in the existing Vite component harness, temporary isolated `127.0.0.1:5194`: nine browser cases, zero skipped. Cases cover changed-only edit/failure/retry/source warning; queued/failure/resume/completion; ambiguous-submit same-key retry/cancel; wrong-client mapping/retry/save/depth; mobile dark read-only; comprehensive coverage/quotes; institutional review/unknown privacy; structured email attribution/read-only editor/safe links/unrelated edit preservation; completed job without an artifact never claims a briefing is ready.
- PASS: actual visual review of desktop, compact edit error, source settings, saved sources, durable progress modal, mobile dark. Captures are synthetic and named accordingly in the browser spec; final screenshots live in the evidence directory. Only the requested component/dialogs were compared against current Figma. The surrounding shared shell/Calendar page is separately owned by root.
- Initial checks retained in `failed-checks.md`: one unit assertion expected different wording for the correct wrong-meeting rejection; React purity rejected render-time Date.now; strict test indexing required optional access. Corrected without reducing behavioral assertions, suppressing lint or skipping tests.
- Temporary port5194 server/config are removed after validation; production/harness defaults and other processes are preserved.
- NOT RUN here: live LLM/provider generation, live board writes, live prep PATCH, live job cancellation/resume, real tenant/meeting-privacy enforcement, deployed worker durability, or provider error recovery. No external side effects were performed. Root owns the combined final Next/build/signed-in service gates; component fixtures do not pass those gates.

## Audit implementation state and remaining dependencies

All seven audited IDs remain **partial pending live acceptance**, preserving the baseline evidence and its historical API-exists labels separately:

| Audit IDs | Frontend behavior delivered | Remaining evidence/dependency |
| --- | --- | --- |
| ENG-prep_generate, ENG-prep_progress, ENG-prep_cancel | Real POST/latest/poll/DELETE/resume adapters; durable pending, explicit retry and failure preservation | Root/auth/backend owners: approved designated-service generation and worker/cancel/resume readbacks; no live LLM write was authorized in this pass |
| ENG-prep_refine | Changed-only validated PATCH, draft retention, receipt matching, discard controls | Root/backend owner: real saved readback and concurrent-edit contract. Service internally supports expectedRevision, but current public DTO omits it; current exposed writes can overwrite a concurrent edit |
| ENG-prep_monday_read, ENG-prep_monday_save | Personal/client mapping GET/PUT, exact string IDs, stale receipt rejection, saved feedback | Root/connector owner: designated connected Monday account and real mapping readback. No provider/board writes in this pass |
| ENG-prep_sources | Composition from canonical meeting payload; comprehensive coverage, source excerpts, references and quotations; edited-content caveat | Root/auth owner: real permitted-source readback. Unknown/unavailable source metadata is explicit; no invented source links or record routes |

Generation request keys are scoped to the current component interaction; a durable job is recovered through the verified latest-job endpoint after reopening. There is no fabricated persistent client-side request ledger. Legacy synchronous unknown outcomes deliberately require checking saved content before another run. PDF/email/share, attachment preparation and broader Module workflows remain outside this bounded preparation interaction pass and retain their existing audit status.
