# Lane report: memory, tasks, settings and membership surfaces (Fable, 16 October 2026)

Branch `fable/live-memory-settings-20261016`, based on `fable/live-base-20261016 @ 48a27c8d`. Scope ledger rows: `memory-read-propose`,
`identity-membership` (plus the Tasks and Settings product surfaces). Source only: no deployment, AWS, credentials, model/provider call,
migration execution, Core call, frozen-contract, Dockerfile or lockfile edit. Proposals and the migration request:
[FABLE-MEMORY-SETTINGS-PROPOSALS-20261016.md](../proposals/FABLE-MEMORY-SETTINGS-PROPOSALS-20261016.md). Frontend route documentation:
[apps/control/product-access/ROUTES.md](../../../apps/control/product-access/ROUTES.md).

## Implementation outline

| Responsibility | Canonical owner | This lane |
|---|---|---|
| Identity (Clerk session → tenant/actor) | native identity verifier (injected `verifyToken`) | consumed, not implemented |
| Current membership, role, permissions, clients | Core membership source (injected `readMembership`, proposal M3) | `product-access/membership.mjs` admits only an active member, rechecks before release, and supplies the action-session owner's `verifyIdentity` |
| Memory review, approval, publication | Core canonical review (proposal M2) | never performed by Meri; `memory/core-review.mjs` only submits and reads status |
| Memory proposal production | governed memory producer (new, `memory/producer.mjs`) | eligibility → immutable sourced candidate → journal → Core submission |
| Conversational `memory.propose` | canonical command executor (approval, authority, journal, budget) | `memory/command-source.mjs` is its source; executor unchanged except the personal admission gate |
| Settings validation | `settings/documents.mjs` + canonical `policy-resolution.mjs` (capabilities) | strict documents; widening refused with the resolver's own codes |
| Settings persistence, revisions, audit | `settings/postgres-store.mjs` (proposed tables) | compare-and-set + audit row in one transaction |
| Platform capability record | Capiro platform owner (injected `readPlatformLimits`, proposal M4) | consumed and validated per call |
| Task/action-item reads | gateway `query_tasks` / `query_action_items` owners via host `operationalReads` port | thin routes with canonical input/page validators and binding correlation |
| Task create/update | commands owner, `/api/action-followthrough/*` | unchanged, documented for the frontend |

Dependency direction: `product-access` (transport + membership) ← `memory`, `settings`, `tasks` route modules; `memory` and `settings`
use `product-persistence/transaction.mjs`. Cross-app imports are deliberate reuse of canonical owners: `settings` and `product-access`
import the pure worker capability resolver (`apps/worker/conversation/capabilities/policy-resolution.mjs`, no I/O); `memory/core-http.mjs`
reuses the gateway's bounded JSON response reader (`apps/gateway/sources/json-response.mjs`). Moving the resolver into a shared package
is a reasonable later refactor; it was not done here to keep the worker's accepted module unchanged. No circular imports; importing any
module opens nothing.

State and failure ownership: the producer journal holds only the immutable candidate and its submission state; review state is read from
Core each time. An unacknowledged Core submission is `SUBMISSION_UNKNOWN`/`submission_unknown`, never pending and never absent; reads
reconcile it from Core without resubmitting; a replay of the same idempotency key resubmits only the identical candidate (Core must
deduplicate by id+hash). Uncertain commits surface as `outcome: UNKNOWN`; acknowledged results withheld at release surface as
`RESULT_NOT_RELEASED`.

## What changed

New modules (all inert on import):

- `apps/control/product-access/`: `errors.mjs` (owned content-free failures with optional field name), `shape.mjs` (closed own-data
  admission over the canonical command boundary), `membership.mjs` (membership gate), `http.mjs` (product Fetch application), `ROUTES.md`.
- `apps/control/product-persistence/transaction.mjs`: one owned PostgreSQL transaction over a borrowed pool (shared by memory and settings).
- `apps/control/memory/`: `wire.mjs` (local wire shapes), `eligibility.mjs`, `candidate.mjs`, `core-http.mjs`, `core-review.mjs`,
  `core-memory.mjs`, `postgres-journal.mjs`, `producer.mjs`, `command-source.mjs`, `routes.mjs`.
- `apps/control/settings/`: `documents.mjs`, `service.mjs`, `postgres-store.mjs`, `routes.mjs`.
- `apps/control/tasks/routes.mjs`.
- Tests under each `test/` directory; suite `control-product-surfaces` added to `scripts/qualification/local-baseline/suites.json`.
- Proposed DDL: `docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql`.

Intentional behavior change (one existing file): `apps/control/commands/durable-executor.mjs` now refuses a personal `memory.propose` with
`PENDING_PRODUCER_UNAVAILABLE` only when its source does not declare `personalPending: true`. The legacy `save_memory` HTTP source does not
declare it, so its behavior and all existing refusal tests are unchanged; the governed producer source declares it.

Personal scope therefore no longer refuses when the producer is composed: personal, client and firm proposals all become pending
candidates for Core review. Direct `confirm_memory`/`correct_memory`/`forget_memory` remain excluded; sourced corrections are proposals
through the producer (surface route `correct`, or conversational `memory.propose` with a `key` matching an eligible memory).

`memory.read`: the existing gateway read owners (`search_memory`, `memory.list_own_proposals`) are unchanged. Once Core implements M2, Core's
proposal queue includes the producer's submissions, so the agent's proposal read and the surface's list/status agree on one review state.

## Checks

All runs used Node 24.22.0 with `MERI_REVIEW_SOURCE_ROOT` set; root and `packages/contracts` installed with `npm ci --ignore-scripts`.
Every test below is **SYNTHETIC** (doubles at the identity, membership, Core transport, journal/settings-store, platform-record and
operational-read boundaries; the command test reuses the accepted scripted budget-SQL harness and command fixture).

| Suite (local-baseline runner, `--allow-root`) | Result |
|---|---|
| `control-product-surfaces` (new) | 42 tests: 41 pass, 1 skipped (real PostgreSQL, UNRUN) |
| `control-commands` | 76/76 pass |
| `control-core` | 260/260 pass |
| `control-action-application` | 124/124 pass |
| `gateway-sources` | 315/315 pass |
| `scripts-local` (includes dependency-ownership and run-suites guards) | 33/33 pass |
| `control-action-host` | 329/386; **57 fail, pre-existing/environmental**: every failure is `fatal: not a git repository: '/tmp/capiro-endpoint-integration-source-20261013.git'` (pinned cross-repository Capiro source absent on this host). No action-host file changed. |
| `root-check` | 4183/4241; **58 fail, pre-existing**: the identical failure set reproduces at the base commit with this lane's changes stashed (known host requirement: Codex-host Python with python-docx/openpyxl). |

Coverage of the requested cases: eligibility and client scope (`producer.test.mjs`, `command-source.test.mjs`); sourced immutable
candidates (`producer.test.mjs` hash/immutability/source tests); no direct publish by proposal (`producer.test.mjs` "no direct publish",
review authority tests); review authority (status correlation, unavailable never pending); settings validation and widening refusal
(`settings/test/service.test.mjs`, `product-access/test/http.test.mjs`); membership removal (new requests, withheld release with
`RESULT_NOT_RELEASED`, stored action sessions through the actual action-session owner, stored client proposals and default client);
cross-tenant denial (memory list/status, settings, task page binding).

### Negative regressions proven by reverting

Each guard was reverted in place, the named test file run, and the source restored (script kept outside the repository). All 15 mutants
failed their tests:

| Reverted guard | Failing file (failures) |
|---|---|
| Removed/suspended membership admitted | membership.test (3) |
| Constant session identity revision | membership.test (1) |
| No membership recheck before release | http.test (1) |
| No scope eligibility on propose | producer.test (1) |
| Status ignores current client walls | producer.test (1) |
| Correction target walls skipped | producer.test (1) |
| Core submission echo not checked | producer.test (1) |
| Review status hash not correlated | producer.test (1) |
| Unknown submission reported as pending | producer.test (2) |
| Personal refused unconditionally (old executor behavior) | command-source.test (3) |
| Personal admitted for the legacy source | command-source.test (1) |
| Tenant widening not checked | service.test (1) |
| Tenant save without admin permission | service.test (1) |
| Stale default client released | service.test (1) |
| Task page binding not correlated | tasks routes.test (1) |

A sixteenth mutant (service-level revision precheck removed) survived because the store's compare-and-set already owns conflicts; the
duplicate precheck was removed instead of kept as a second rule.

## UNRUN and not established

- Real PostgreSQL journal/settings store (`product-persistence/test/postgres-stores.test.mjs`, needs the proposed DDL applied and
  `MERI_PRODUCT_PG_SOCKET`). The DDL has never been executed.
- Core routes M2 and the membership source M3 do not exist yet; their shapes are proposals. No Clerk, Core, membership, platform-record or
  gateway call was made.
- Host composition: nothing mounts `createProductApplication` or composes `operationalReads` from the gateway dispatcher, and the
  memory.propose executor is not yet composed with the producer source in a startup path (STARTUP-COMPOSITION gate).
- Run policy issuance does not yet read persisted tenant settings: the control owner that passes the effective capability policy beside
  `run` still needs to call `resolveCapabilityPolicy` with the stored tenant record and the member's role.
- Committed-memory browsing for the Memory surface (choosing a correction target) relies on the existing memory reads; no new committed
  memory list route was added. Notification preferences are stored but not yet consumed.
- Live gates (MEMORY-PRODUCER real owner/client wall/lifecycle/grant/approval-expiry/replay/revoke evidence, COMMAND-G5,
  READ-QUALIFICATION, DEPLOY-G1–G7) remain open.

## Hashed source-proof rows

None changed. Neither modified existing file is among candidate g's 45 rows. For traceability:

| File | Old SHA-256 | New SHA-256 |
|---|---|---|
| `apps/control/commands/durable-executor.mjs` | `1fb45049a3f214e9191b30818dfa122cb999eacc8316bf4ee5a5dbe6ee08b80d` | `447d5b8a74a2a51867267160144e0d1859a1bdee889f213f00ab004fe4dc5cf2` |
| `scripts/qualification/local-baseline/suites.json` | `76325eb9490ebc26f5c635678453f9dafbabffb6eec1e19bd5e2ef98777631b7` | `bf455e8421ff08fc455c7c9ab75907c65d8f3ff597f749e73e63512c272bd7d7` |

## Scope ledger

Recommended `memory-read-propose.currentState` once accepted: "Governed producer creates pending sourced candidates for personal, client
and firm scope and sourced corrections, submitted to Core review (M2 pending); surface routes for list/status/propose/correct exist;
composition and live qualification open." `identity-membership`: "Membership gate denies removed/changed members for new requests,
results awaiting release and stored action sessions (synthetic); Core membership source M3 and live evidence open." The ledger file was
not edited in this lane.
