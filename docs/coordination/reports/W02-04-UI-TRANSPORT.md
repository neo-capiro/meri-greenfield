# W02-04 UI transport compatibility — Hermes implementation report

Status: **implemented, offline qualification PASS; ready for review**. No gate passed,
no deployment/push, no cutover. Codex and a separate real Hermes exact-commit review own
acceptance. This is compatibility preparation only (no W03 promotion).

- Original base (pinned): `f19afabe9b135c7b4fb4fd62ead40fede474be4d`
- Repair base (previous, **rejected** by independent audit): `df2d0bb5fc0abea1a513d30add0997ee1e0aee6d`
- Branch: `hermes/w02-ui`; worktree `C:\dev\main\meri-greenfield-worktrees\w02-ui`
- Session: `20261009_172411_d70282` (bounded repair continuation)
- Bounds: <=1800s / <=30 turns; no self-resume, no retry, no push, no deployment.

## Why the previous commit was rejected and what changed

The prior commit (`df2d0bb`) passed root 15 + typecheck + 14 tests but the independent
audit ran the actual `createMeriChat` factory and found four real-path defects. This
repair addresses each with a concrete fix and a fixture on the **real factory /
external Chat** path.

1. **Conflict silently continued.** `createMeriChat` ignored the projection outcome, so a
   valid `seq1` + same-`eventId` changed payload (then `seq2`) ended with
   `status=ready, cursor=2, accepted=[1,2]`. Fix: the guard's `onEvent` now calls
   `acceptOrReject(projection, event)` **synchronously on the data path before the chunk
   is forwarded** (and before `onData`). A conflict raises `ProjectionRejectionError`,
   erroring the subscription while the last contiguous cursor is preserved.
2. **Chat id never bound.** Reconnect used a random chat id. Fix: `new Chat({ id: view.conversationId, … })`,
   so the reconnect URL is exactly `/api/chat/<conversationId>/stream`; tests now call the
   actual `chat.resumeStream` and assert the exact URL + sequence header.
3. **Mutable internals.** The projection retained the caller's event object and exposed
   the internal array. Fix: accepted/pending values are deep-frozen `structuredClone`
   snapshots; `accepted` returns a fresh frozen array; the view is frozen. Tests mutate
   raw/nested input (including pending repair and nested `scopes`) and attempt to push to
   the returned array.
4. **Stop/dispose only tested post-completion.** Fix: a held-open pending stream is now
   stopped/disposed mid-flight; the fixture proves nothing is admitted afterwards, no
   durable cancel is issued, and durable run status is unchanged; reconnect tests use the
   actual `chat.resumeStream`.

The factory was relocated from `client-facade.tsx` (TSX, not runtime-importable) into
`guarded-transport.ts` (plain `.ts`) so the composed path is exercised directly in offline
Node without transpiling TSX or mounting React; `client-facade.tsx` is now a thin hook
facade that re-exports the factory. No new file was added; the 14 owned paths are
unchanged.

## Scope and owned paths (14)

- `apps/ui/qualification/{package.json, package-lock.json, .gitignore, tsconfig.json}`
- `apps/ui/qualification/{types.ts, producer.ts, guarded-transport.ts, projection.ts, client-facade.tsx}`
- `apps/ui/qualification/{qualification.test.mjs, component-pins.json, README.md}`
- `docs/qualification/UI-TRANSPORT-CANDIDATE.md`
- `docs/coordination/reports/W02-04-UI-TRANSPORT.md` (this file)

No contract, root lock, schema, infra, task, launcher, worker, proxy, Temporal or
other-report change. `.runtime/` and `node_modules/` are gitignored scratch.

## Checks (separate outcomes / counts)

- Nested scripts-disabled install: `npm install --ignore-scripts` — 28 packages, exit 0.
- Typecheck: `tsc -p tsconfig.json` (5.9.3, noEmit) — **0 errors**.
- Offline tests: `node --test qualification.test.mjs` — **17 pass / 0 fail**.
- Root check: `npm run check` (contracts + evals) — 15 pass / 0 fail (contracts unchanged).
- `git diff --check` — clean.
- Frozen schema blob re-verified: `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b`.

## Fixtures (real `createMeriChat` + external `Chat`, mock fetch)

All ten frozen variants (ordered, exactly-once); split SSE/UTF-8; duplicate replay
(idempotent); immutable `eventId` conflict → aborts, cursor preserved; duplicate-sequence
conflict → aborts; gap pause/repair; multiple runs/attempts; malformed custom data
rejected before admission; `dataPartSchemas` runtime/type mismatch reproduced; unexpected
native reasoning/tool/text frames rejected; `run.error` redaction; HTTP 204 reconnect via
`chat.resumeStream` (exact conversation URL + cursor header, no `Last-Event-ID`);
incremental reconnect via `chat.resumeStream`; held-open stop/dispose while pending (no
admission, no durable cancel, run status unchanged); input/nested mutation immunity
(pending repair + committed + nested scopes) and frozen accepted array; stream-outcome
vs run-outcome separation.

## Frozen source / hashes

- Contract commit `7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3`, version `0.1.0`.
- `meri.schema.json` SHA-256 `e3de8781…` (50043 bytes, LF). The earlier `0bf7d88…` value
  was the same document with CRLF endings (52191 bytes); normalizing only CRLF→LF
  reproduces the frozen blob. The schema was not changed.
- Pins: `@ai-sdk/react` 4.0.140 (tar `6e1718e0…40e39f`, LICENSE `b4f9adb7…d5529`),
  `ai` 7.0.137 (tar `d40be3e4…4f931`, LICENSE `b4f9adb7…d5529`), `react` 19.3.0,
  `zod` 4.6.5, dev `typescript` 5.9.3 / `@types/react` 19.3.0; `ai-elements` 1.9.0
  observed-only (CLI not executed). See `apps/ui/qualification/component-pins.json`.

## NOT RUN (explicit)

React mounting / real hook render; browser rendering/persistence/durable storage; real
network/SSE transport; ALB streaming/idle timeouts; auth/authorization/revocation;
historical-access replay; approved-stop-vs-tab-close; slow-client/backpressure; real
browser-safe compiled schema; Fargate/Chromium sandbox; any AWS/cloud; `ai-elements`
component compatibility; accessibility/E2E.

## Process state / integrity

One owner; no recursive delegation; no global settings change; no approval bypass; no
native binary/service execution; no browser/socket/server; no model/provider call; no
credentials/cloud/private-source access; no dependency install in this repair (existing
nested tree reused). Commit on `hermes/w02-ui` only (owned paths, no amend, no push).
Codex + separate Hermes review own acceptance. No G1/W03/cutover claim.
