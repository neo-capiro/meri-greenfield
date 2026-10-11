# Saved Portfolio ordering frontend — CORE-098

## Source and boundaries

- Isolated worktree `C:/dev/meri-portfolio-layout-261011`, branch `codex/portfolio-layout-frontend-20261011`, pinned root `bcb6166ca38e1f7cc5473c73d9ae9c2e5080ae32`.
- Current operating policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac` (fetched remote `b2b0ce8c2bf03817b81e671d968b7892985b8d06`); local machine map unchanged at `2026-09-30T00:21:48.2698715Z`.
- Mandatory Figma design-to-code skill applied. Current high-fidelity context/screenshot inspected for `411:41421`, footer `411:41642`: “Drag any card to rearrange · your layout is saved to your profile”. Evidence remains in `outputs/evidence/portfolio-saved-layouts-20261011` in the parent task. No verified overlay is invented. This scope arranges organization profile cards only, without visibility, resizing, widget layout, or Business Development mixing.
- Backend candidate `46937ce53506657658fd85d9e6ef840abb842013` is unregistered; its SQL remains unallocated/unapplied. This frontend does not establish live persistence.

## Outline and public integration

`contracts.ts` validates v1 receipts. `api.ts` uses existing core HTTP transport, strict actor and exact saved version/order receipts. `ordering.ts` owns only catalog projection and movement. `usePortfolioLayout.ts` owns one canonical Query read/cache and scoped mutations/recovery. `PortfolioLayoutEditor.tsx` renders an inline grid using the supplied existing card renderer, pointer drag handles, accessible move buttons and live announcements. Save/Cancel appear only for a changed draft. Styling uses current tokens, responsive columns and no new assets or backgrounds.

```tsx
const layout = usePortfolioLayout(clients.map((client) => client.id));
<PortfolioLayoutEditor
  cards={clients.map(({ id, name }) => ({ id, name }))}
  layout={layout}
  renderCard={(id) => renderExistingOrganizationCard(id)}
/>;
```

Root owns PortfolioIndex composition, ordinary card renderer and test main entry. Pass the full current catalog in canonical default order, not a search-filtered subset; root must preserve filter/name-sort semantics when choosing where to expose reordering. The editor does not issue a competing GET. Public exports are limited to the hook, its state type, component and card type. Test-only `PortfolioLayoutHarness` entry is `/__test/portfolio-layout`.

## Persistence, identity and failure semantics

GET/PUT use the existing core proxy path `me/portfolio-layout`. The query binds tenant, actor and catalog; canonical public `currentClientWriter`/`assertClientWriter` enforce current identity success/idle/non-invalidated state and standard-user-or-higher role. Lifetime and catalog changes abort writes and refuse late results. No localStorage, optimistic persistent success, automatic mutation retry or new permission service is introduced. Backend authorization remains required.

404/503 explicitly report unavailable while preserving default cards. Wrong-actor, malformed, wrong-version or wrong-order successful responses fail validation. GET receipts must contain exactly the full current catalog; extra, foreign or omitted IDs fail before caching. A catalog change racing the read requires reloading profiles, not silently projecting a successful receipt. A 409 reloads the latest receipt but retains the draft and presents its latest saved names for explicit review. If latest read fails, the stale pre-conflict receipt cannot be accepted as latest. Unknown PUT completion disables repeat; explicit GET reconciliation confirms only the exact next version and exact requested token order. Any other valid latest state requires review instead of a silent overwrite. A failed read leaves the uncertainty gate in place. An authority guard failure after a successful PUT is uncertain completion, not a known HTTP refusal. Known 400/401/403/404 transport refusals do not claim success. Session expiration uses the existing DataProvider behavior.

CAS detects layout writer conflicts; it does not make catalog/membership revocation atomic. Above 2,000 current cards is an explicit backend contract refusal. Backend defaults and actual client content permissions are unchanged.

## Verification and remaining dependency

Explicit Node v24.19.0; read-only installed dependencies borrowed from root. No installs, full build, live calls, migrations, cloud or provider writes. Focused unit/type/lint/browser evidence is recorded in this worktree's `work/` and final source-bound output package. Initial static failures remain preserved; no assertions are weakened. Browser fixture qualification proves component behavior with intercepted synthetic contracts, not activated backend persistence. Root owns independent acceptance, shared browser entry composition and live/deployed qualification after backend owner approval.

Final focused qualification: **27 unit cases and 16 actual-component browser cases PASS**, full source TypeScript check has zero diagnostics, focused ESLint/format and the 356-module architecture check pass. Root integration `99fdee443087c575e9a89f14bd13eb1c788745c9` is cherry-picked locally as `ece77d0`; its only conflict was unrelated preceding public-event context in the shared test main. The local resolution preserved the pinned main and applied only the two intended layout entry lines. The harness renders the canonical exported `ProfileCard` directly.

Preserved failures: initial hook lifecycle lint diagnostics; an incorrectly parameterized new test case; first browser setup resolving two installed Playwright versions; and the first actual browser run (15/16) exposing visually enabled controls after identity invalidation. That UI defect was fixed with a narrow invalidated-state subscription to the same Query identity cache used by the canonical authority guard, followed by focused 1/1 and full 16/16 reruns. No checks or assertions were disabled. The second-run screenshot/trace and original result remain available separately.

Desktop and 390px dark mobile captures were opened and visually reviewed: two-column desktop / single-column mobile organization cards, existing card tokens/avatars, visible move controls, legible footer and no horizontal overflow. Dark mode is verified through the actual color-scheme media query and background assertion. No new static design asset is introduced; the supplied canonical card owns its dynamic imagery. These are component-surface captures with synthetic names and a small test heading, not a claim of whole-screen Figma parity; root owns the integrated Portfolio shell comparison.

Reproduction from this checkout (test server strict loopback `5193`, owned process exits with Playwright):

```powershell
$node24 = 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$deps = 'C:/dev/meri-greenfield-portfolio-31/apps/portfolio-web/node_modules'
& $node24 "$deps/vitest/vitest.mjs" run --config work/vitest.config.mjs tests/portfolio-layout.test.ts
& $node24 "$deps/typescript/bin/tsc" --project work/tsconfig.json --noEmit
& $node24 --require C:/dev/meri-portfolio-layout-261011/work/test-resolution.cjs "$deps/@playwright/test/cli.js" test --config work/playwright.config.cjs
```
