# Public proceeding detail

Audit IDs: `ENG-public_event_detail`, `ENG-public_event_follow_state`, `ENG-public_event_capture_state`, `ENG-public_event_open`. Isolated `C:/dev/meri-portfolio-public-events-20261011`, branch `codex/portfolio-public-events-20261011`, base `2b344249c10a4f8e5933762c4ee7b98c7fc26b67`. Current backend fetched `origin/main`: `fd8765ec01d292013758606204f2c9d886cd31c1`. Shared policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac` contains fetched `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; machine map baseline2026-09-30. AGENTS/implementation standards and installed Next16.4 client guidance read. Node24.19.0; dependencies borrowed read-only, no installs.

## Contract and responsibilities

Figma `411:47846` on Prototype3.1 was inspected with required design-to-code context/screenshot. It shows a300px compact hearing card, actual source date/committee/client relevance/capture, Following and Open in LegiWatch. Two exact Figma SVGs are local feature assets at their original8px/16px geometry. Shared Dialog retains its accessible close button and keyboard/focus behavior. Dynamic notices and wrapping add height when needed; no fixture event/client values ship.

The new public-event feature owns typed read projection, actor-scoped query and presentation. Root owns CalendarPage/Agenda/feed ID selection, public composition and final acceptance. API/auth/cache/config/Dialog remain canonical. Interface:

```ts
PublicEventDetail({ eventId, open, onOpenChange, destinations, clientId? });
```

Pass the canonical committee-hearing `CalendarItem.sourceId` (calendar row.id), not the `hearing:` dedupe key, official-source identifier or capture/browser-session ID. Verified `GET /api/legiwatch/live-hearings/events/:id/detail-v2` composes public hearing, caller follow configuration, tenant attendance assessment and authorized client relevance. Optional clientId is validated as a UUID and tenant-owned by the backend. `CanonicalHearingIdPipe` resolves retained aliases server-side; this calendar slice requires the canonical feed ID and refuses a changed returned ID with409/refresh instead of guessing alias equivalence. No alternate backend or legacy fallback.

Source references on backendfd8765: Wave1 controller85/110/418 (GET follow-config/attendance/detail-v2); service2214 detail composition; attendance assessment separates browser scheduling from automatic capture; relevance1532/1589 loads selected client or active tenant-authorized client list under withTenant/RLS. Detail client relevance lists all authorized clients including NONE; the card shows positive service bands, distinguishes insufficient evidence, and does not treat follow-associated client IDs as exposure. No financial/probability/relevance calculation is introduced.

`GET detail-v2` already contains follow/attendance; separate requests are unnecessary. Missing/malformed/mismatched partial rails show unavailable. Following never schedules capture. SCHEDULED is **Attendance scheduled**, with the server message retained; the contract does not expose chosen attendance mode as a typed field, so the card never claims transcription scheduled. Current detail does not serialize timePrecision/calendarRevision/source-check freshness or jurisdiction despite loading some internally. Published calendarDate remains a civil date; scheduledStart uses only an explicit valid source zone, absent precision is disclosed, invalid/mismatched dates/zones are explicit. Federal/state labels are not inferred from chamber.

Native LegiWatch route verified in current `VNextLegiWatchRoutes.tsx`: `/legiwatch/hearings/:hearingId`. Link uses validated destinations.existingApp and the verified canonical returned ID; absent destination shows unavailable. It does not fall back to a hardcoded deployed hostname. Existing bill-tracker has a private three-line destination builder; this feature keeps its narrow verified path construction local because that feature has no public destination contract. Root may promote the demonstrated common destination behavior deliberately.

Query key binds tenant, user, event and optional client. Canonical dispatch guard applies before/after reads; open/actor/event/client lifetimes abort pending reads on close/unmount/scope change. Late private relevance cannot publish into another actor's cache or closed view. Read-only follow indicator is a span; no follow, attendance, export, calendar or provider mutation is implemented.

## Qualification

Focused unit/browser/source gates and visual review are recorded in the follow-up qualification commit. No live backend request, provider action, shared write, full production build, deployment or new dependency is authorized in this slice. Current source inspection establishes contract compatibility; synthetic checks cannot establish live policy or freshness. Parent owns actual Master Agenda composition and independent integrated checks.
