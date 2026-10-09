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
| `guarded-transport.ts` | `MeriGuardedTransport implements ChatTransport` (validates every decoded chunk, rejects malformed/unexpected native frames, `resumeStreamIsReplay = false`, `close()` without durable cancellation) **and the runtime factory `createMeriChat`** that wires one external `Chat` (id bound to `view.conversationId`) + guarded transport + projection. |
| `projection.ts` | Synchronous conversation-wide projection: deep-frozen input snapshots, immutable `eventId`+payload dedup, duplicate-sequence conflict, contiguous cursor, gap pause/repair, run status separate from stream/HTTP outcome, `acceptOrReject` for the data path, safe `run.error` rendering. |
| `client-facade.tsx` | Type-checked only: React hook facade (`useChat({ chat, resume: false })`) + detach helper; re-exports the factory. Not mounted. |
| `qualification.test.mjs` | 19 offline composed fixtures driving the real factory/external `Chat` (mock fetch + web `Response`/`ReadableStream`; global fetch throws). |

`.runtime/` and `node_modules/` are gitignored scratch. No dependency is added to a
root or shared lockfile.

## Commands

```
npm install --ignore-scripts     # scripts-disabled nested install (already done)
npm run typecheck                # tsc -p tsconfig.json (noEmit)
npm test                         # node --test qualification.test.mjs
npm run check                    # typecheck + test
```

## Admission boundary (why this design)

`createMeriChat` calls `acceptOrReject(projection, event)` **synchronously inside the
guarded data path, before the chunk is forwarded** or reaches `onData`. An immutable
`eventId`/payload conflict or a duplicate-sequence/different-`eventId` conflict aborts
the subscription (the chat enters `error`) while the last accepted contiguous cursor is
preserved. Duplicates are idempotent and gaps pause without advancing the cursor.
`onData` is an unawaited, non-persisting observer and is never the admission authority.

The chat id is bound to the authorized conversation, so reconnect uses the exact URL
`/api/chat/<conversationId>/stream` and the last accepted sequence is sent in an
authenticated header (never the SSE `Last-Event-ID`).

Accepted/pending events are deep-frozen `structuredClone` snapshots; `accepted` returns
a fresh frozen array, so mutating raw/nested input (or the returned array) cannot rewrite
history.

## What the fixtures prove (offline only)

- All ten frozen variants compose through the real factory + external `Chat` and are
  projected exactly once in order.
- Split SSE / UTF-8 byte boundaries do not corrupt frames.
- Duplicate replay is idempotent; immutable `eventId` conflict and duplicate-sequence
  conflict each abort the subscription and preserve the cursor.
- A gap pauses the cursor and is repaired when the missing event arrives.
- Multiple runs/attempts share one conversation sequence.
- Malformed custom data and unexpected native reasoning/tool/text frames are rejected
  before admission; the exact-pin `dataPartSchemas` runtime/type key mismatch is
  reproduced.
- `run.error` renders only approved code/generic text.
- HTTP 204 and incremental reconnect both go through the actual `chat.resumeStream`, with
  the authorized conversation URL and cursor header (no `Last-Event-ID`).
- stop/dispose on a held-open pending stream admit nothing, issue no durable
  cancellation, and leave durable run status unchanged.
- Input/nested mutation after acceptance cannot rewrite accepted history; the returned
  accepted array is frozen.
- A completed stream outcome does not mark the run complete without an authoritative
  `run.status` event.

## NOT RUN (open for a later bounded task / live review)

React mounting, browser persistence/durable storage, real network transport, ALB
streaming/idle timeouts, authentication/authorization/revocation, historical-access
replay, approved-stop-vs-tab-close, slow-client/backpressure limits, real
browser-safe schema compilation, and any AWS/Fargate/Chromium behavior. This is not a
G1/W03/cutover claim and does not authorize deployment.
