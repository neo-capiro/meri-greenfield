# Global objective client picker — OBJ-19

## Scope and source

- Isolated checkout `C:/dev/meri-global-objective-261011`, branch `codex/portfolio-global-objective-20261011`; starting commit `6d554e365b39e83cf33a93748add47cca38465c0`.
- Current policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; BOOTSTRAP/AGENTS and repository implementation standards read. Ops fetch/ff verified without discarding changes.
- Current Figma `Zc2dEN5aLU47dVdsewDmiJ`, Prototype 3.1, node `411:62481`, dialog `411:62788`. Mandatory design-to-code skill, full component context and screenshot inspected before implementation. Evidence: task outputs `evidence/global-objective-discovery-20261011/figma-picker.png`, `figma-context.json`, `dialog-context.txt` and original audit row.
- Baseline `OBJ-19`: New objective outside client: choose authorized client. The catalog backing exists; selection and draft form state are local. Original audit evidence remains separate and unchanged.

## Implementation boundary

The controlled `GlobalObjectiveClientPicker({open,onOpenChange,onContinue,onCloseAutoFocus?})` owns only client search/selection. Parent continues to `/portfolio/{id}/objectives?new=1`, reusing the existing ObjectiveEditor and its four-field readiness rule. No objective is created or mutated by the picker. No local storage, profile-based drafting, invented client types, additional navigation, or duplicated editor.

The real `GET /api/backend/core/clients` uses canonical `useClients` with tenant/user scoped cache. `useIdentity`, canonical `currentClientWriter`/`assertClientWriter`, public `Client` schema/initials, Radix Dialog and existing tokens are reused. Continue revalidates current actor, fresh idle non-invalidated catalog, and an exact non-archived selected row synchronously before navigation. Cache invalidation, fetch/error, role or actor change block continuation; keyed actor sessions discard prior selection. Destination authorization remains authoritative: catalog metadata is not a memory-wall grant, and this frontend guard does not close server revocation races.

The 560px dialog, 28px client initials, compact rows, footer and dark surface follow the inspected design. Figma says everything else is filled from the client profile, but current ObjectiveEditor starts empty; approved truthful wording is “Choose the client for this objective.” Current screenshot does not establish a new global trigger location. Root owns entry placement review, `?new=objective` composition and shared browser main.

## Verification

- Focused units: 17/17 passed, including canonical writer roles, changed actor, invalidated/in-flight/error identity or catalog, scoped-cache isolation, malformed/duplicate receipts, archived/removed/unselected clients, and name/sector search.
- Composed browser: 15/15 passed after the harness focus-return correction. Covers keyboard/search→existing empty ObjectiveEditor/four-field validation with zero writes; Cancel/Escape/reopen; loading/empty; failure/retry; portal role with zero catalog reads; malformed catalog; role/actor/authority/catalog invalidation; held refresh and removal; unmount/late reads; session expiry; 560px desktop and 358px mobile-dark geometry; actual `/portfolio?new=objective` close preserving filters and continuation into the canonical editor. Final visual corrections keep Client \* inline and match the inspected close-button geometry. Exact final committed-source results are in the evidence manifest.
- Full app source/tests TypeScript and focused lint passed. Borrowed read-only dependencies cause only the existing React version detection warning. Architecture check passed for 367 modules. Formatting passed after correction of an initial docs-path typo and CSS terminal newline; all initial failures retained.
- Initial browser setup hit unresolved shared-main cherry-pick context before the shell exit was inspected. It was stopped in this owned process tree, retained as setup-failure evidence, then the conflict was resolved to add only this harness (the approved base has no CalendarSyncHarness). The first resolved run passed the real editor flow and failed focus return in the test harness. The existing public `onCloseAutoFocus` callback was then wired to the harness trigger, preserving the assertion. The subsequent 15-case run passed; no test assertions were weakened.

No dependency installs, build, live API writes or deployment. Synthetic browser intercepts establish local UI behavior only; live tenant/client and auth integration remain separate qualification. The reserved strict-port server at `http://127.0.0.1:5193` runs only during the focused Playwright invocation and is closed afterward.

## Reproduction and remaining dependency

Run with explicit Node 24.19 and the existing read-only dependency tree. Task-local `work/` configs only adapt module resolution; they do not change app configuration. Commands and exact source hashes are recorded in `outputs/evidence/global-objective-frontend-20261011`:

1. `node24 <deps>/vitest/vitest.mjs run tests/global-objective.test.ts --config ../../work/vitest.config.mjs` (from app).
2. `node24 <deps>/typescript/bin/tsc --noEmit -p work/tsconfig.json` (from checkout).
3. `node24 <deps>/eslint/bin/eslint.js -c ../../work/eslint.config.mjs src/features/objectives/global-create tests/global-objective.test.ts tests/browser/global-objective*.tsx tests/browser/global-objective*.ts` (from app).
4. `node24 --require work/test-resolution.cjs <deps>/@playwright/test/cli.js test --config work/playwright.config.cjs` (from checkout; owns strict port 5193).

Root composition `728191123076f2a0adb8449e06a9816078e35a84` is locally integrated as `87669ac4273be474d24890e70a5831756614546a`; do not cherry-pick the local copy back. It wires the actual index deep link and shared browser main. The permanent global entry placement remains a specific product decision with the root owner (global Quick add versus Overview header); current Figma screenshot establishes the chooser, not that trigger. No speculative trigger was added. No backend contract changes are required for this local selection flow.
