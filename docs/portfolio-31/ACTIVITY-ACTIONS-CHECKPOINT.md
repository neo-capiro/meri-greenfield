# Recorded activity actions — 2026-10-11

## Scope and source

- Frontend: `C:/dev/meri-activity-actions-261011`, branch `codex/portfolio-activity-actions-20261011`, starting commit `c36965af1fb40f4e92a34cba76bf50aac3fb422a`.
- Current operating policy read at `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; BOOTSTRAP, machine paths, repository AGENTS, Portfolio AGENTS and implementation standards inspected. User-directed frontend repository is meri-greenfield.
- Current capirov2 `origin/main`: `fd8765ec01d292013758606204f2c9d886cd31c1`; client-activity controller/service inspected without modification.
- Figma design-to-code skill used before focused context/screenshots: `411:49178` (inline pinned caption and 28px row menu), `411:50341` (520px removal dialog), within current Portfolio activity frames `411:49051` / `411:50097`. No image/icon assets are needed: these nodes use text glyphs. Existing dialog geometry and tokens are retained. The light pin caption uses Figma's `#6c5226` fallback; a feature-local dark fallback keeps it legible until the shared warning token exists.

## Audit implementation state

| ID       | Current behavior                                                                                                                                                                                       | Verification / qualification                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| CORE-104 | Recorded notes offer Pin note / Unpin note using the real `pinned` field; refreshed feed renders inline `★ Pinned`. Other recorded kinds and derived records do not gain a pin action.                 | Adapter + composed browser checks; live write unverified. No excluded pinned-account summary is restored.                         |
| CORE-050 | Existing edit, Settle and Reopen retained; fresh scoped preflight detects relevant changed fields, draft survives failures, successful receipts bind tenant/client/record and actual requested values. | Existing browser assertions retained, additional conflict/review cases. Versionless writes are **not CAS**.                       |
| CORE-051 | Existing explicit removal confirmation and failure states retained; all visible projection fields are checked before DELETE; only `{ok:true}` is accepted.                                             | Existing cancel, error, malformed acknowledgement and session-expiry assertions retained. DELETE has no identity-bearing receipt. |

## Verified endpoint contract

- `GET /api/clients/:clientId/activity?limit=500`: scoped normalized recorded/derived projection, newest 500 total items. A missing, duplicate, derived-replaced or changed target fails before a write; older records outside this feed cannot be changed here.
- `PATCH /api/clients/:clientId/activity/:id`: optional `title`, `body`, `pinned`, `settled`; returns the persisted row including `id`, `clientId`, `tenantId`, record identity and stored values. Empty edited details become `null`. Settling requires a due date; reopen confirms `settledAt:null`.
- `DELETE /api/clients/:clientId/activity/:id`: explicit `{ok:true}` acknowledgement. No automatic retry or alternate endpoint.
- Controller requires `standard_user` or higher. Current service checks tenant/client ownership; it does **not** enforce client memory-wall grants in list/update/remove. This existing backend authorization gap needs service/security-owner adjudication; frontend session checks do not close it.
- No row version, expected-version predicate or idempotency receipt exists. Another writer may act between preflight and mutation. Only supplied fields are PATCHed, preserving unrelated sibling fields; removal compares the visible projection rather than claiming a full-row atomic comparison.

## Structure and safeguards

`activity-change.ts` owns validated preflight, minimal request bodies and receipt verification. `activity-mutations.ts` coordinates one row's mutation state, using the existing public Quick Log client-writer boundary and HTTP/cache conventions. `ActivityActions` and its existing dialogs render that single shared state, so closing/reopening a dialog cannot clear an uncertain result.

Identity must be current, idle, valid and writer-capable; actor/tenant and component lifetime are checked before/after awaits and immediately before dispatch. An aborted preflight cannot dispatch. A single-flight guard and disabled pending controls prevent duplicates. Dispatched writes invalidate only this client's activity feed, including ambiguous failures. Network/server/malformed-success ambiguity blocks another write until the user explicitly reads and reviews the latest activity; no write is replayed by that read. Conflicting preflight also requires review. Failed edits retain local input.

Timeline, Quick Log, shared auth/config/proxy, backend, locks and other owners' files are untouched. `ActivityActions` keeps its public props unchanged; no parent integration is necessary beyond cherry-picking this slice.

## Validation and evidence

- Node `v24.19.0`; existing dependencies borrowed read-only from the root Portfolio worktree. No install, build, provider call, deployment or live mutation.
- Focused unit checks: **35/35** (30 adapter/contract checks plus 5 unchanged activity filter/date/DST checks).
- Actual existing fixture composition on isolated `127.0.0.1:5193`: **14/14 browser checks**. Existing four action cases remain, with canonical persisted receipts, additional preflight reads and explicit reread after uncertain results. Existing edit read-count changed from 2 to 6 for initial read + two preflights + two post-dispatch invalidations + explicit uncertainty review; no assertion was removed.
- Full source/test TypeScript, scoped ESLint, scoped Prettier and architecture checks pass. ESLint emits a React auto-detection warning because this source-only checkout borrows dependencies; it has no lint errors. Architecture checks 325 modules.
- Browser initially passed 11/12 and exposed keyboard focus loss during the disabled pin write. Source fix restores focus after pending state only if focus remains on the document body; original failure PNG/trace/log are preserved. Tool resolver mismatch and initial TypeScript diagnostics also remain in evidence.
- Desktop pin and removal, mobile dark pin/removal and settled-entry screenshots inspected. The full Timeline layout is owned separately; these checks qualify the new inline state, 28px menu slot, responsive dialog and existing composition, not a complete Timeline redesign.
- User-facing evidence: `outputs/evidence/activity-actions-20261011/` in the parent task, including source-bound metadata, logs, screenshots and original audit rows. No live backend write validation is claimed.

## Remaining dependencies

1. CORE-050/051/104: responsible backend/security owner must resolve the current client memory-wall authorization gap. Owner not identified in this slice; do not equate tenant scoping with client grants.
2. CORE-050/051/104: atomic stale-write prevention needs a reviewed backend version/CAS contract. Current bounded preflight is explicitly qualified.
3. CORE-050/051/104: designated safe live mutation checks remain with the parent task; this slice exercised only intercepted local services.
