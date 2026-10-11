# Meeting composition

Root owns CalendarPage, MeetingDetail, MeetingArtifacts, preparation/public and calendar/debrief. The library worker owns calendar/library and the shared parent uploader extension. Routes compose public feature interfaces; rendering does not issue requests.

The library uses URL filters independently of the calendar date/view/scope. Client assignment reviews artifact movement and sharing revocation. Uploaded source confirmation and extraction remain in the canonical uploader/library adapter. The focused debrief adapter calls the verified existing `POST engagement/meetings/:id/debrief-draft` contract, validates the proposal and strips provider internals. Generation has no persistence. The existing artifact editor receives the generated body and requires explicit Save, approval and sharing.

Generation is gated on current actor/tenant/role and externalActionsEnabled. Pending actions resist duplicate dispatch; generation never retries automatically. Source stays available after an error, with an explicit warning before another provider request. Actor/tenant/meeting/client changes reset editor lifetime; cancellation discards late generation responses.

Root checks on 11 October: TypeScript, scoped lint and architecture (251 modules) pass. 21 focused unit cases pass across generation, library and upload. Worker browser qualification of the actual composed page follows; this is not live provider or signed-in acceptance. No calendar, provider, upload or model writes were made in live services.

Known contract limits: assignment has no atomic revision guard; VTT/SRT are not supported by the current upload service; extraction may be truncated and discloses that before generation. Matching Clerk/backend configuration is still needed for signed-in local acceptance.
