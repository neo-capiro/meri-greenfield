# Meri W02-04 UI-transport offline qualification

Preparation-only, offline compatibility qualification for the frozen Meri UI-event
transport. It composes the **real upstream** AI SDK writer, `DefaultChatTransport`
and external `Chat` with a Meri guard boundary and a conversation-sequence
projection. Nothing here mounts React, opens a socket/server, runs a browser, or
calls a model/provider/AI-gateway.

Frozen inputs:

- Contract commit `7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3`, version `0.1.0`.
- `packages/contracts/meri.schema.json` SHA-256
  `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b` (50043 bytes, LF).
  The earlier `0bf7d88…` value was the same document with CRLF endings (52191 bytes);
  normalizing only CRLF→LF reproduces the frozen LF blob. The schema is unchanged.
- Pins and hashes: `component-pins.json`.

## Files

| File | Purpose |
| --- | --- |
| `types.ts` | Local browser-safe types mirroring `$defs.UIEvent` (10 variants), `RunBinding`, `Scope`, `SourceEvidence`; schema-hash binding constants. Not a compiled validator. |
| `producer.ts` | Emits `start`, one `data-meri-event` chunk per frozen event (`id = eventId`, `transient: true`), `finish` and an explicit stream outcome via `createUIMessageStream`/`createUIMessageStreamResponse`. |
| `guarded-transport.ts` | `MeriGuardedTransport implements ChatTransport`: validates every decoded chunk (injected frozen-contract validator + `chunk.id` equality), rejects malformed/unexpected native frames, `resumeStreamIsReplay = false`, `close()` without durable cancellation. |
| `projection.ts` | Synchronous conversation-wide projection: immutable `eventId`+payload dedup, duplicate-sequence conflict, contiguous cursor, gap pause/repair, run status kept separate from stream/HTTP outcome, safe `run.error` rendering. |
| `client-facade.tsx` | Type-checked only: one external `Chat` per view + guarded transport, `useChat({ chat, resume: false })`. Not mounted. |
| `qualification.test.mjs` | Offline composed fixtures (mock fetch + web `Response`/`ReadableStream`; global fetch throws). |

`.runtime/` and `node_modules/` are gitignored scratch. No dependency is added to a
root or shared lockfile.

## Commands

```
npm install --ignore-scripts     # scripts-disabled nested install (already done)
npm run typecheck                # tsc -p tsconfig.json (noEmit)
npm test                         # node --test qualification.test.mjs
npm run check                    # typecheck + test
```

## What the fixtures prove (offline only)

- All ten frozen variants compose through the real upstream writer →
  `DefaultChatTransport` → external `Chat` → guard → projection, accepted exactly
  once in conversation-wide sequence order.
- Split SSE / UTF-8 byte boundaries do not corrupt frames.
- Duplicate replay (same `eventId`+payload) is idempotent; changed content conflicts;
  duplicate sequence with a different `eventId` conflicts.
- A gap pauses the cursor and is repaired when the missing event arrives.
- Multiple runs/attempts share one conversation sequence.
- Malformed custom data is rejected by the guard. The exact-pin `dataPartSchemas`
  runtime/type key mismatch is reproduced: a type-correct `{'meri-event': …}` schema is
  never consulted at runtime, while `{'data-meri-event': …}` is — so the explicit guard,
  not schema registration, is the enforcement boundary.
- Unexpected native reasoning/tool/text frames are rejected.
- `run.error` renders only approved code/generic text.
- HTTP 204 reconnect yields no stream; reconnect requests the last accepted contiguous
  sequence via a header (not SSE `Last-Event-ID`).
- abort/dispose detach the subscriber without issuing a durable run cancellation.
- A completed stream outcome does not mark the run complete without an authoritative
  `run.status` event.

## NOT RUN (open for a later bounded task / live review)

React mounting, browser persistence/durable storage, real network transport, ALB
streaming/idle timeouts, authentication/authorization/revocation, historical-access
replay, approved-stop-vs-tab-close, slow-client/backpressure limits, real
browser-safe schema compilation, and any AWS/Fargate/Chromium behavior. This is not a
G1/W03/cutover claim and does not authorize deployment.
