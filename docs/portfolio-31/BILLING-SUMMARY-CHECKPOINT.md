# CORE-075 — billing summary

## Source and ownership

- Worktree `C:/dev/meri-billing-summary-261011`, branch `codex/portfolio-billing-summary-20261011`.
- Starting root commit `90e78a80926f50fdcb63a434ca9e28efc6fdcc66`.
- Current operating policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; BOOTSTRAP/AGENTS/machine map read. Current policy checkout preserved ahead of origin. Repository instructions and installed Next client/data documentation read.
- Current capirov2 remote main `fd8765ec01d292013758606204f2c9d886cd31c1`; canonical source inspected read-only in `C:/dev/cap-billing-confirmation-261011`. No capirov2 imports or edits.
- Owned change to identity is the optional boolean `billingAdmin` projection only. New summary modules do not change existing capacity behavior. Root owns chooser/main composition and all other intake/billing files.

## Contract and permission evidence

`apps/api/src/billing/billing.controller.ts` exposes GET `/api/billing/summary` behind RolesGuard (`user_admin` minimum) and BillingAdminGuard. `billing-admin.guard.ts` allows `capiro_admin` directly; otherwise requires `user_admin` plus a membership with `status === 'active'` and `billingAdmin === true`. No other role gains billing visibility from a true flag.

`apps/api/src/users/users.controller.ts:me` returns `billingAdmin` as true for capiro_admin or the membership bit. `/me` does not expose membership status. Its tenant middleware (`tenant-context.middleware.ts`, active-membership lookup and self-heal refusal for suspended/removed records) selects only active memberships; the summary guard independently rechecks status at its boundary. The frontend does not claim an atomic revocation fence. Missing capability for user_admin fails closed; capiro_admin follows the actual direct guard even when the optional bit is absent or false. Both need a nonempty authenticated user and tenant.

The strict local validator mirrors `BillingSummary` in `packages/shared/src/index.ts` and `BillingService.getSummary`: billingEnabled, status, purchased slots, nonarchived usedSlots, monthly pricePerSlotUsd, pooled llmAllowanceUsd, llmUsedUsd, llmOverageUsd, llmWarn, nullable llmHardCapUsd/currentPeriodEnd, hasSubscription. Currency is USD by explicit field names. Values are formatted, not recomputed. No frontend allowance/overage/proration/total calculation.

`pricePerSlotUsd` is the Core plan tier rate, with a default minimum quantity when purchased slots are zero; it is not an invoice or verified Stripe line price. `hasSubscription` is currently implemented as existence of stripeCustomerId; it is validated but deliberately not rendered as proof of an active/paid subscription. `currentPeriodEnd` is shown as the current period end, never a promised charge date. Purchased slots are not substituted for the separate effective trial capacity.

## Design and placement

Read-only baseline CORE-075 points to Figma `411:45337` on Prototype — Capiro 3.1. Mandatory figma-design-to-code skill loaded before high-fidelity context/screenshots of `411:45337` and Add profile chooser `411:44629`. Exact summary cost rows are `411:45446`; billing dialog screenshot `411:45437` saved under `work/billing-summary-evidence/figma-411-45437.png`.

Reused row geometry: muted surface, radius12, padding16x12, 12px gap, 13px labels, 12px secondary copy, 14px values, borders and existing light/dark tokens. Figma's due-today/proration/card/next-invoice examples belong to a quote/payment workflow absent from this read-only contract and are not copied. Root approved a focused current-plan/usage panel under the existing chooser capacity status. This is an intentional data-backed adaptation; no checkout button or annual-plan selection is added.

Public insertion API: `BillingSummaryPanel({ enabled?: boolean })` from `features/billing/summary-public.ts`. Pass chooser visibility as `enabled`; false renders nothing and prevents a new fetch. The native details/summary disclosure starts collapsed, preserving mobile chooser actions, and requests only when expanded by a fresh eligible identity. It removes amount content when collapsed. Root owns composition. No new image assets or dependencies.

## State and privacy

One canonical HTTP/auth/query mechanism is reused. Summary cache keys include tenant and user; identity errors, pending reads, invalidation and permission loss hide amounts. GET adapter validates authority before dispatch and after response, checks AbortSignal both times, and rejects changed actor/tenant or ignored late aborts. The hook observes invalidation independently of identity-object changes. No automatic summary retry; explicit GET-only retry follows the same guard. Errors do not leave stale financial data visible. Session expiry follows canonical HTTP handling. Summary responses have no tenant ID, so client binding relies on authenticated same-origin Core context, not a fabricated receipt identifier.

## Qualification checkpoint

- Explicit bundled Node `24.19.0`; dependency junction is read-only, no install or dependency modification.
- Focused unit tests: **29 PASS**, including actual HTTP routing/validation, exact role/flag combinations, missing capability, empty identity, fetching/error/invalidated identity, zero unauthorized reads, tenant/user cache separation and held-response actor/tenant/permission/abort refusal.
- **13/13 intercepted component browser PASS**, on private loopback port5194 using the canonical Playwright/Vite stack and a small ignored local entry/cache. New public test harness is compatible with root's canonical main route `/__test/billing-summary`. Coverage: canonical standard_user/client_portal_user/user_admin denials, missing flag, capiro_admin direct access, collapsed zero-GET behavior, keyboard Enter/Space, explicit failure/retry, actual403, actor/tenant/invalidation boundaries, closed consumer/held response, no-plan semantics, exact supplied amounts, current-period date and no payment controls. Geist font loading is explicitly asserted; desktop-light/mobile-dark captures were inspected and mobile overflow checked.
- Typecheck, focused lint, focused format, architecture **385 modules**, and git diff checks **PASS**. Exact runtime is bundled Node `24.19.0`; no production build was run. Final source and evidence hashes are recorded in `outputs/evidence/portfolio-billing-summary-20261011/qualification.json` and `source-manifest.json` in the parent task output directory.
- Initial browser setup failed because Playwright resolves a relative web-server path from the ignored config directory. The next run preserved **6 PASS / 6 FAIL**: all six failed on an exact-text locator for an amount whose definition also contains `/ slot / month`; positive and absence assertions were corrected to inspect the actual containing text. That run also exposed the local junction font allowlist omission; the isolated server now explicitly permits the read-only dependency directory. All initial logs/JSON/PNG/traces are retained. An intermediate12-PASS run predates canonical-role correction; final13-PASS includes both actual non-admin roles. No assertions or baseline were weakened.
- No live summary read, provider call, mutation, build, deployment or customer data used in this agent task. Synthetic component tests do not establish live billing acceptance.
- Setup diagnostics preserved: wrong installed Next `.mdx` filename and wrong existing capacity-test filename failed discovery reads; actual `.md` docs and `tests/profile-capacity.test.ts` were then read.

## Remaining dependencies

CORE-075 is read-only current plan/usage support. Actual signed-in summary GET and composed chooser qualification remain separate root checks; the agent's13 component checks do not prove either. Monthly/annual plan choice, payment method, due-today quote, explicit charge/receipt, inline conversion, SCA and billing-write safety belong to the separately reviewed billing contract; this panel neither implements nor implies them. Future billing writers must invalidate both summary and capacity query prefixes. The current slice has no billing writer.

## Reviewable delivery

Ordered source commits: `36848d21721242356b866c8b0d62420ceb13385e` (summary and strict authority/contract), `33efdbbff28bdec732502b5d849be3ce2339efb5` (collapsed disclosure and browser boundary tests), followed by the narrow canonical-role/font-test/checkpoint commit identified in the qualification manifest. Existing capacity six files, root composition/fixtures, package locks, auth/session handling and backend source remain untouched by this agent.

Reproduce focused units from `apps/portfolio-web` with explicit Node24 and `node_modules/vitest/vitest.mjs run tests/billing-summary.test.ts`. Root's composed harness uses the normal Playwright config and `tests/browser/billing-summary.spec.ts`; the ignored agent qualification config/server are packaged with evidence for the port5194 component run. No hosted preview was created by this slice.
