# W02-04 UI transport compatibility — Hermes implementation report

Status: **implemented, offline qualification PASS; ready for review**. No gate passed,
no deployment/push, no cutover. Codex and a separate real Hermes exact-commit review own
acceptance. This is compatibility preparation only (no W03 promotion).

- Base (pinned): `f19afabe9b135c7b4fb4fd62ead40fede474be4d`
- Branch: `hermes/w02-ui`; worktree `C:\dev\main\meri-greenfield-worktrees\w02-ui`
- Session: `20261009_172411_d70282` (bounded continuation; same base)
- Bounds: <=3600s / <=40 turns; no self-resume, no retry, no push, no deployment.

## Scope and owned paths (14)

Written/committed exactly these owned paths:

- `apps/ui/qualification/package.json`
- `apps/ui/qualification/package-lock.json`
- `apps/ui/qualification/.gitignore`
- `apps/ui/qualification/tsconfig.json`
- `apps/ui/qualification/types.ts`
- `apps/ui/qualification/producer.ts`
- `apps/ui/qualification/guarded-transport.ts`
- `apps/ui/qualification/projection.ts`
- `apps/ui/qualification/client-facade.tsx`
- `apps/ui/qualification/qualification.test.mjs`
- `apps/ui/qualification/component-pins.json`
- `apps/ui/qualification/README.md`
- `docs/qualification/UI-TRANSPORT-CANDIDATE.md`
- `docs/coordination/reports/W02-04-UI-TRANSPORT.md` (this file)

No contract, root lock, infra, task, launcher, worker, proxy, Temporal or other-report
change. `.runtime/` and `node_modules/` are gitignored scratch. No root/shared dependency
was added.

## What was built

- `types.ts` — local browser-safe types mirroring `$defs.UIEvent` (10 variants),
  `RunBinding`, `Scope`, `SourceEvidence`; no invented fields; schema-hash binding.
- `producer.ts` — upstream `createUIMessageStream`/`createUIMessageStreamResponse`:
  stable `start`, one `data-meri-event` chunk per frozen event (`id = eventId`,
  `transient: true`), `finish`, and an explicit subscription outcome. No native
  text/tool/reasoning chunks; no `streamText`/`generateText`/agent/gateway.
- `guarded-transport.ts` — `MeriGuardedTransport implements ChatTransport` wrapping the
  public `DefaultChatTransport`. Explicit guard at the boundary: injected frozen-contract
  validator + `chunk.id === event.eventId`; rejects malformed custom frames and any
  unexpected native frame; `resumeStreamIsReplay = false`; `close()` never issues a
  durable run cancellation.
- `projection.ts` — synchronous conversation-wide projection: immutable `(eventId,
  canonical payload)` dedup, duplicate-sequence/different-`eventId` conflict, contiguous
  cursor with gap pause/repair, run status kept separate from stream/HTTP outcome, safe
  `run.error` rendering by approved code/generic message.
- `client-facade.tsx` — type-checked only: one external `Chat` per view
  (`@ai-sdk/react`), guarded transport, `useChat({ chat, resume: false })`, reconnect via
  `prepareReconnectToStreamRequest` header (last accepted contiguous sequence), not SSE
  `Last-Event-ID`.
- `qualification.test.mjs` — 14 offline fixtures on the actual composed path (real
  upstream writer + `DefaultChatTransport` + external `Chat`), mock fetch with web
  `Response`/`ReadableStream`; global `fetch` replaced with a throwing stub.

## Checks (separate outcomes / counts)

- Nested scripts-disabled install: `npm install --ignore-scripts` — 28 packages, exit 0.
- Typecheck: `tsc -p tsconfig.json` (5.9.3, noEmit) — **0 errors**, exit 0.
- Offline tests: `node --test qualification.test.mjs` — **14 pass / 0 fail**, exit 0.
- Root check: `npm run check` (contracts + evals) — see commit evidence; contracts
  unchanged.
- `git diff --check` — clean.
- Upstream pin re-verification: tarball SHA-256 + license SHA-256 match the brief.

## Frozen source / hashes

- Contract commit `7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3`, version `0.1.0`.
- `packages/contracts/meri.schema.json` SHA-256
  `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b` (50043 bytes, LF).
- Pins (verified against registry SRI and downloaded tarballs):
  - `@ai-sdk/react` 4.0.140 — tarball `6e1718e0…40e39f`, LICENSE `b4f9adb7…d5529`.
  - `ai` 7.0.137 — tarball `d40be3e4…4f931`, LICENSE `b4f9adb7…d5529`.
  - `react` 19.3.0 — tarball `5a402411…afbf9`; `zod` 4.6.5 — tarball `a78c0c53…b36fc`.
  - `typescript` 5.9.3 (dev), `@types/react` 19.3.0 (dev).
  - `ai-elements` 1.9.0 — observed-only, NOT installed/executed; tarball `6a931fe5…79df7`.
- Details in `apps/ui/qualification/component-pins.json`.

## Hash correction (owner-resolved)

The earlier schema SHA-256 `0bf7d88dcef83e139eb1788864249d6d5c9396497e192e547c8d87ec6cc2965a`
quoted in the brief/candidate was the same document with CRLF line endings in a root
Windows checkout (52191 bytes). Normalizing only CRLF→LF reproduces the frozen LF blob
(`e3de8781…`, 50043 bytes) exactly. The schema was not changed. The candidate document
records this correction.

## Measured limitations (as required)

- `dataPartSchemas` runtime/type key mismatch reproduced at the exact pin: the static
  type key is `meri-event` but the runtime lookup key is `data-meri-event`, so a
  type-correct registration never validates; the explicit guard is the enforcement
  boundary.
- `DefaultChatTransport` leaves `resumeStreamIsReplay` undefined (incremental by default);
  only `WebSocketChatTransport` sets it `true`. The react inline transport wrapper drops
  `resumeStreamIsReplay`/`close`; the external `Chat` path preserves them. Meri uses the
  external path with `resumeStreamIsReplay = false`.
- `onData` still fires for transient data parts (loose, not exactly-once); projection is
  the exactly-once boundary.

## NOT RUN (explicit)

- React mounting / real hook rendering, browser rendering/persistence, durable browser
  storage.
- Real network/SSE transport, ALB streaming/idle timeouts, authentication/authorization,
  revocation, historical-access replay, approved-stop-vs-tab-close, slow-client/
  backpressure limits.
- Real browser-safe schema compilation/generated validator.
- Fargate/Chromium sandbox proof, any AWS/cloud action, deployment.
- `ai-elements` component compatibility (its scaffolding CLI was not executed).

## Process state / integrity

- One owner; no recursive delegation; no global settings change; no approval bypass;
  no native binary/service execution; no browser/socket/server; no model/provider call;
  no credentials/cloud/private-source access.
- Commit on `hermes/w02-ui` only (owned paths, no amend, no push). Codex + separate
  Hermes review own acceptance. No G1/W03/cutover claim.
