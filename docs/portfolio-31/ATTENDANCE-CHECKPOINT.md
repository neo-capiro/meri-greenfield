# Meeting attendance / client preferences checkpoint

## Outline recorded before implementation

- Worktree `C:/dev/meri-meeting-attendance-261011`, branch `codex/portfolio-meeting-attendance-20261011`, root base `f195938203521aa69bc3a24f564ce2556749c879`; freshly fetched Meri main `d16c457de7edb14e575814115d4c67f2a902cd7c`. Backend main remains `fd8765ec01d292013758606204f2c9d886cd31c1`; verified reference engagement files unchanged in `fd6ed6c017ae91ab774fd34f74475a746de13b68`.
- Current shared policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, remote `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; map date `2026-09-30T00:21:48.2698715Z`. Read bootstrap, policy, repo/app AGENTS, implementation standards and installed Next forms guide. Node24.19; read-only installed dependencies; 8GiB disk reserve. No install/build/provider/calendar/live writes.
- Own only new `features/calendar/attendance/**`, focused tests/browser spec and this checkpoint. Root owns Calendar/detail/header/menu composition, shared fixtures/config/proxy and extracting canonical dispatch guard to `calendar/access/public`.
- Public interfaces accepted by root: `MeetingAttendance({meeting,zone})`; `ClientAttendancePreferences({clientId,clientName,open,onOpenChange})`.
- Domain/API modules validate session and preference receipts, perform fresh preflight and recheck actor/lifetime/runtime before writes; query modules own actor/tenant-scoped server cache and status polling. Components own local consent/dialog/review state. Reuse existing HTTP, Query, identity/capabilities, Radix Dialog and design tokens. No second Meri orchestration/provider adapter.
- Current Figma high-fidelity context/screenshots inspected: client menu `411:48021`, meeting context `411:63894`, Send dialog `682:142893`, mobile `698:142755`. Owned dialog has no static imagery; native close/control primitives reused.
- Original audit remains read-only: CORE-123/124/125 and ENG-meri_session/dispatch/remove. GET/POST/DELETE client preference returns `{enabled,stopping}` scoped to tenant/client/current user; GET/POST/DELETE meeting notetaker returns latest/null session scoped to caller-created or caller-owned-calendar meeting. API decides actual authorization and provider support.
- Two consent affirmations retain exact verified wording. Current `NotetakerService.finishTranscript` (`notetaker.service.ts:1211–1245`) saves primary private Meeting Notes **approved**, then attempts a Debrief from the same generated summary **approved**, as a best-effort operation; Debrief failure does not lose notes. It does not create a user review gate or automatically share/email either record. Consent disclosure states this actual behavior. Manual upload/extract → debrief generation → existing editor explicit save remains a separate route. Future meetings use verified `joinAt=meeting.startsAt`, explicitly disclosed, without implying the bot is already attending.
- Unknown dispatch/removal completion must reconcile through read; no automatic POST/DELETE retry. Removal can fail while bot dispatch is still in flight. Client setting may be off with `stopping=true`; do not claim the bot left. No expected revision/idempotency key exists; fresh preflight is a bounded correctness check, not CAS. Client preference response carries no identity fields; cannot independently bind a boolean receipt beyond the authenticated scoped route and current actor guard.
- Verification: focused adapter/status/validation tests, actual root-composed browser flows on owned strict5193 after integration, final type/lint/format/architecture, visual comparison and explicit live gaps.

## Results

- Source pass: all six audited operations have current-contract adapters, actor-scoped queries and explicit UI state. Automatic preference is per current user/client; removal retains actual stopping/processing outcomes. Shared guard/capability extraction `f45d67f588dcf13621448e1280a3c707e9fd6c8f` is included as a separate prerequisite commit.
- Node24.19 focused unit tests **18/18 PASS**, full app/tests strict TypeScript **PASS**, focused ESLint **PASS**, Prettier **PASS**. Initial pre-integration typecheck reported only the missing approved shared access boundary; initial lint caught a render-time clock read, corrected to a lazy captured form-open timestamp. Both initial logs are preserved under the isolated worktree `work/`.
- Actual root composition `f595bb064afb287f259b5aaf01c4a506658de7a2` wires the Calendar information section and client Meri-actions menu. **12/12 actual-component browser cases PASS** on strict owned loopback5193: consent/future scheduling; retained server validation; mismatched receipt/uncertain no-resend; in-flight cancellation; enable→Off/stopping→DELETE retry; concurrent setting change; disabled runtime; read-only zero private reads; privacy404/session401; two held-preflight unmount cases proving zero later POST; responsive dark dialog.
- Visual comparison covers current Figma desktop660px/mobile358px dialog,24px/16px padding,20px title,12px labels,13px regular content, existing native controls/gradient/tokens. Actual Geist is verified loaded through a transient read-only dependency URL rewrite; no dependency tree was copied. Dark checked controls reuse the existing foreground accent convention. Additional truthful consent and scheduling text intentionally increases height versus fixtures. No static artwork exists in this owned dialog; shell assets remain canonical.
- First browser run **11 PASS/1 FAIL** exposed a second inaccurate permissions alert when uncertainty deliberately disabled the form; source now shows the precise unknown-completion state. Original assertion is retained, original failure log preserved. Initial visual check also found fallback fixture font; the transient font mapping and loaded-font assertion now qualify the final PNGs. No baseline/assertion was weakened.
- No live notetaker dispatch/removal/preference write, provider side effect, tenant-feature readiness or real attendance is claimed. Current GET capabilities does not expose per-tenant notetaker readiness; server tenant flag/provider checks remain authoritative. Automatic preference enable confirms a saved setting, not running background-worker/provider attendance. No expectedVersion/requestId exists; the bounded fresh-read checks cannot eliminate same-actor concurrent races. Original audit evidence stays read-only; these six rows are implemented and fixture-validated, with live external-action validation explicitly outstanding.

## Reproduce focused validation

Use Node24.19 and the existing app scripts when dependencies are installed. In this source-only checkout, the tiny transient `work/` configs alias the approved installed runtime read-only; no app configuration is changed:

```powershell
$node = 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$deps = 'C:/dev/meri-greenfield-portfolio-31/apps/portfolio-web/node_modules'
& $node "$deps/vitest/vitest.mjs" run --config work/vitest.config.mjs apps/portfolio-web/tests/attendance.test.ts
& $node "$deps/typescript/bin/tsc" -p work/tsconfig.json
& $node "$deps/eslint/bin/eslint.js" --config work/eslint.config.mjs apps/portfolio-web/src/features/calendar/attendance apps/portfolio-web/tests/attendance.test.ts apps/portfolio-web/tests/browser/attendance.spec.ts
$env:NODE_OPTIONS = '--require=C:/dev/meri-meeting-attendance-261011/work/test-resolution.cjs'
$env:NODE_PATH = $deps
& $node "$deps/@playwright/test/cli.js" test --config work/playwright.config.cjs
```

The fixture server composes the existing app components and only loopback API intercepts; it does not authenticate Clerk, run Next middleware/proxy, contact providers or prove deployed service behavior. Root owns broader Next/build/live-read/deployment qualification.
