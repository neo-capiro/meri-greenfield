# Calendar sync checkpoint

## Ownership and source

- Isolated branch `codex/portfolio-calendar-sync-20261011`, checkout `C:/dev/meri-portfolio-calendar-sync-20261011`.
- Frontend base `0b8bd7fa7e24dd38c43337aa8b57c115a63c63a8`; backend inspected from fetched `origin/main` `fd8765ec01d292013758606204f2c9d886cd31c1`.
- Shared policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, containing fetched remote policy `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; machine map dated 2026-09-30.
- Audit IDs: `ENG-calendar_sync_ms_window`, `ENG-calendar_sync_ms`, `ENG-calendar_sync_google`.
- Current Figma Prototype3.1 desktop `683:142846`, mobile `698:142925` context/screenshots inspected using `figma-design-to-code`. Both show pending Syncing calendar, not a success receipt. No supplied static assets.

## Outline and public interface

`calendar/sync/contracts.ts` validates account, range, intent and provider statistics; `api.ts` owns caller account preflight and calendar-only transport; `queries.ts` owns actor/tenant-bound discovery; `useCalendarSync.ts` owns the captured attempt and async lifetime; `CalendarSyncDialog.tsx` owns selection/review/presentation. Shared Dialog, CSS tokens, HTTP client, identity, QueryClient and calendar access guards are reused. No provider client or alternate calendar architecture.

Public `CalendarSyncDialog({open,onOpenChange,range?:{from,to},clientName?})` is controlled. Parent owns CalendarPage action/dialog composition and canonical test-main route. Account selection and opening never dispatch sync. Only connected Microsoft/Google accounts are offered conservatively; connected status is UI eligibility, not a server authorization guarantee. No OAuth, reconnect, disconnect or provider settings actions.

## Verified current contracts

| Operation                 | Method/path/query                                                                     | Body and response                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discover accounts         | `GET /api/engagement/integrations`                                                    | Array of IntegrationConnection; service filters tenant AND `createdByUserId=caller`. Projection validates creator as well as provider/status/account label. No tokens or syncState copied. |
| Microsoft cursor sync     | `POST /api/engagement/integrations/microsoft/:id/sync?calendar=1&mail=0`              | Empty body; reset omitted. `{connectionId,calendar:{scanned,matched,skipped,removed,failed,pages,hasMore}}`; required matching connection ID/calendar.                                     |
| Google cursor sync        | `POST /api/engagement/integrations/google/:id/sync?calendar=1&mail=0`                 | Same empty body/receipt. No from/to support.                                                                                                                                               |
| Microsoft explicit window | `POST /api/engagement/integrations/microsoft/:id/calendar-window?from=<ISO>&to=<ISO>` | Empty body; bare same statistics. **No server-confirmed connection, date range or operation binding in response.** The UI does not fabricate those receipt fields.                         |

Source: `EngagementController.integrations`, `EngagementService.listIntegrations`, `MicrosoftIntegrationActionsController`, `MicrosoftGraphSyncService.syncConnection/syncCalendarWindow/assertConnectionAccess/calendarWindow`, `GoogleOAuthController.syncConnection`, `GoogleSyncService.syncConnection/assertConnectionAccess`.

Both POST services recheck tenant, exact provider and caller-created connection. Admin role does not grant another user's account. Routes require standard-user-or-higher role and runtime `integration_sync`. Runtime policy allows sync only with `externalActions=enabled`; `test_only` is insufficient. UI reuses current successful, idle, noninvalidated identity/capabilities and `useDispatchGuard(...,true)`, including after asynchronous account preflight and before accepting response.

Calendar sync does not accept `clientId`. Selected client is display context; existing backend association rules determine client assignment. Generic endpoints default mail AND calendar when flags are omitted, so this adapter always sends explicit `calendar=1&mail=0`. The Microsoft window route is intrinsically calendar-only.

Microsoft ISO bounds must be finite, with end after start; current server imposes no maximum span. No invented frontend span limit. Generic initial server range is now minus/plus365 days, then provider cursor. Google cannot honor displayed range. All runs cap calendar pages at12. Generic Microsoft/Google persists continuation; Microsoft explicit-window sync does **not** persist nextLink. A partial window cannot truthfully offer resume; UI explains this.

## Outcome and lifetime semantics

- Actor/tenant-keyed QueryClient transient attempt is captured before POST and retained with infinite GC during that QueryClient lifetime. Cross-instance compare before dispatch, local busy guard, no automatic retry/loop. No localStorage.
- Close/unmount aborts local waiting only. It cannot cancel backend/provider writes. The captured actor's pending/unknown fence survives close/reopen and route remount with the same QueryClient, including switching away and back to that actor.
- Any failure after dispatch, malformed/wrong-ID receipt or lost authority after response is unknown because previous pages may have committed. HTTP400/403 alone does not prove a safe rejection. Unknown is frozen with no repeat control. Preflight/validation/authority failure before POST is safe rejection.
- Only a verified known response invalidates canonical `calendar/meetings` and the actor's account list. Statistics count processing outcomes, not newly created meetings. `lastSyncAt`, an empty feed or refreshing either is not an operation receipt and never resolves unknown.
- Known completion permits a separate explicit review. A partial generic run may continue the server cursor only through another reviewed action. No automatic continuation.

## Validation and evidence

Explicit runtime: `C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` v24.19.0. Existing root dependencies borrowed through an ignored local junction, no installs/copies; Vite/Vitest cache stays in ignored `work/`. Dedicated synthetic loopback5202, no real sync/provider/OAuth calls, no production build.

- Focused contracts: 11 tests PASS, including exact requests, bare window receipt, wrong actor/provider/receipt, after-dispatch HTTP400/authority loss and date bounds.
- Full source TypeScript PASS after explicit TanStack union updater/defined state correction; original TS errors retained in evidence summary.
- Focused lint PASS; architecture363 modules PASS; formatting PASS.
- Browser: 13 cases PASS cover explicit calendar-only Microsoft/Google/window, partial results, unknown close/remount/actor return, pending Cancel, identity invalidation while idle and before/after dispatch, actor switch, duplicate consent, runtime refusal, unavailable accounts, keyboard/mobile geometry/font and dark color. A focused QueryCache subscription makes `refetchType:none` invalidation immediately disable idle consent; canonical dispatch guards remain authoritative.
- Initial browser locator failure retained: visible correctly labelled combobox was not found by exact `getByLabel` because wrapping label included option text; semantic named `getByRole('combobox')` preserves accessibility assertion. Initial12-pass visual run was reviewed and found light despite its dark test name; corrected media emulation adds explicit dark background assertion. No product baseline was regenerated.
- Visual intentional difference: required cancellation explanation increases pending dialog height beyond compact Figma; desktop660px/mobile358px, padding24px/16px, typography and shared tokens follow current design.

Evidence: task outputs `evidence/portfolio-calendar-sync-20261011/`, including preserved first failure/first visual run and final browser JSON/screenshots. Source-qualified synthetic checks do not establish live integration or provider/privacy acceptance.

Reproduce from app directory using explicit Node above: `node_modules/vitest/vitest.mjs run tests/calendar-sync.test.ts`, `node_modules/typescript/bin/tsc --noEmit --incremental false`, focused ESLint/Prettier, `scripts/architecture.mjs`. Own ignored runner configs use dedicated5202 and `tests/browser/calendar-sync.spec.ts`; canonical root suite discovers that `.spec.ts` filename after parent composes `/__test/calendar-sync` with `CalendarSyncHarness`.

## Remaining dependencies

1. Parent CalendarPage composition and combined route/build acceptance; this source adds no shared route edits.
2. Backend operation ID/status/idempotency/cancellation contract is absent. QueryClient fence ends on full reload/new QueryClient; durable cross-reload retry safety is not claimed. Unknown must not be cleared based on observed account/feed state. Responsible Engagement owner unresolved.
3. Microsoft explicit-window continuation and account/range-bound operation receipt require backend changes for exhaustive resumable window import; not silently simulated.
4. Live account/provider sync is NOT RUN; synthetic coverage does not prove provider token/scopes, source association or live privacy behavior. No provider writes authorized in this slice.
