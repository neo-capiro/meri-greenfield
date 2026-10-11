# Calendar meeting preparation checkpoint

## Scope and pinned sources

- Worktree `C:\dev\meri-portfolio-facilities-20261011`, branch `codex/portfolio-meeting-prep-20261011`; clean starting commit `983ae6a55342b17e6e90b9188de5e172858cfed8`.
- Shared policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; fetched origin/main `b2b0ce8c2bf03817b81e671d968b7892985b8d06`, local ahead history preserved. Machine map revision `2026-09-30T00:21:48.2698715Z`.
- Backend reference `C:\dev\cap-portfolio-prospect-stages-20261011`, HEAD `fd6ed6c017ae91ab774fd34f74475a746de13b68`. Read-only inspection only.
- Figma design-to-code skill loaded; high-fidelity context and screenshots inspected for `411:64347` (Prep workspace), `680:142737` (edit), `680:142847` (settings), `683:142768` (progress).
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

Implementation and check results will be recorded after the bounded pass. Synthetic checks do not establish live generation, backend persistence, authorization or final Next visual acceptance.
