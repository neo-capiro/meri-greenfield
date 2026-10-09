# AI SDK UI transport qualification candidate

Prepared 2026-10-09 by Codex independent discovery. **Candidate only; G1 remains open.** No dependencies were installed, package scripts executed, UI implemented, shared contract changed, paid/model/cloud call made, or current Capiro implementation inspected. Registry metadata and exact published package source were read; tarballs were decompressed in memory only. No live transport or React test was run.

This follows `docs/plans/MERI-DEPLOYMENT.md`: Claude Agent SDK remains the sole model/agent loop; AI SDK supplies UI transport and state utilities. The frozen contract is `contracts/v0.1.0`, peeled commit `7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3`, schema SHA-256 `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b` (50043 bytes, LF). **Correction (W02-04):** the original value `0bf7d88dcef83e139eb1788864249d6d5c9396497e192e547c8d87ec6cc2965a` was the same document stored with CRLF line endings in a root Windows checkout (52191 bytes); normalizing only CRLF→LF reproduces the frozen LF blob exactly. The frozen schema is unchanged.

## Exact compatible candidates

| Package | Exact stable candidate | License | Compatibility observed from published metadata |
| --- | --- | --- | --- |
| `@ai-sdk/react` | `4.0.140` | Apache-2.0 | Current npm `latest`; depends exactly on `ai 7.0.137`; Node >=22; React peer `^18 || ~19.0.1 || ~19.1.2 || ^19.2.1` |
| `ai` | `7.0.137` | Apache-2.0 | Current npm `latest`, already in COMPONENTS.md; Node >=22; Zod peer `^3.25.76 || ^4.1.8` |
| `react` | `19.3.0` | MIT | Current npm `latest`, already the UI framework candidate; satisfies the React peer range |
| `zod` | `4.6.5` | MIT | Current npm `latest`; satisfies the AI SDK peer range; does not replace the frozen Ajv contract validator |

Primary metadata: [React UI adapter](https://registry.npmjs.org/@ai-sdk%2freact/4.0.140), [AI SDK](https://registry.npmjs.org/ai/7.0.137), [React](https://registry.npmjs.org/react/19.3.0), [Zod](https://registry.npmjs.org/zod/4.6.5). This is declared dependency compatibility, not a compiled Next.js/React/AI Elements compatibility result. No full UI lockfile was generated. The React adapter also brings `swr ^2.4.1`, `throttleit 2.1.0`, `@ai-sdk/mcp 2.0.73`, `@ai-sdk/provider 4.0.26`, and `@ai-sdk/provider-utils 5.0.58`; `ai` brings `@ai-sdk/gateway 4.0.110`. Presence of these packages does not authorize using their model, MCP or workflow integrations.

Downloaded source identity, independently SHA-512 checked against registry SRI:

| Exact upstream tarball | SHA-256 |
| --- | --- |
| [react-4.0.140.tgz](https://registry.npmjs.org/@ai-sdk/react/-/react-4.0.140.tgz) | `6e1718e0627724b24ff0baffd8bdfcbb8e2dbf814a8803b716d399191d40e39f` |
| [ai-7.0.137.tgz](https://registry.npmjs.org/ai/-/ai-7.0.137.tgz) | `d40be3e407ebde2fa74ad895a0384bc4b582494d4781cad0f877561ef734f931` |

Both tarballs contain `package/LICENSE`; each license file SHA-256 is `b4f9adb7c568904834d0dd6cc98d16c390d21ca32fc17ae7a267715269bd5529`. Preserve the Apache license/notice obligations in the eventual assembled candidate. This observation does not constitute a complete transitive license/security audit.

## Verified APIs and a custom backend stream

The exact tarballs include TypeScript source as well as public `.d.ts` exports. The relevant source was inspected, rather than assuming documentation examples run unchanged:

| Published source path (inside the package tarball) | Observed capability |
| --- | --- |
| React `src/index.ts:8-9`; `src/use-chat.ts:44-62,127-132,284-294` | Public `useChat` and `Chat`; accepts typed `UIMessage`, a transport, `resume`, callbacks, initial messages; exposes send, stop, resume and local message state |
| AI `src/ui-message-stream/create-ui-message-stream.ts:29-70,141-175` | `createUIMessageStream<UI_MESSAGE>` invokes caller-owned `execute({writer})`; `writer.write`, `merge`, `setOutcome`; no model invocation is required |
| AI `src/ui-message-stream/create-ui-message-stream-response.ts:21-49` | `createUIMessageStreamResponse({stream, keepAliveMs?, consumeSseStream?, headers?, status?})` returns a standard web `Response` |
| AI `src/ui-message-stream/ui-message-chunks.ts:173-181,223-229`; `src/ui/ui-messages.ts:44-48,258-264` | Typed `data-${NAME}` chunks/parts with `id`, `data`, optional `transient` on chunks |
| AI `src/ui/default-chat-transport.ts:19-34`; `src/ui/http-chat-transport.ts:158-213,232-297` | Default HTTP transport parses and validates SSE chunks; POST submission and GET reconnection; customizable auth/request preparation; 204 means no resumable stream |

The adoption path is: the existing Claude Agent SDK worker publishes validated, fenced events through the new trusted broker; the trusted UI/control service subscribes to authorized persisted events and writes UI chunks with these helpers. `useChat` consumes that stream through `DefaultChatTransport`. This is a projection of broker events, not a second agent loop. Do not call AI SDK `streamText`, `generateText`, agent APIs or its model gateway for this path. Those calls in documentation examples are optional examples, not prerequisites for the inspected writer API. [Stream creation API](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream), [response API](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream-response).

A sufficient custom data chunk shape is:

```ts
{ type: 'data-meri-event', id: event.eventId, data: event }
```

Here `event` is the complete already-authorized frozen `UIEvent`, unchanged. The associated type is `UIMessage<Metadata, { 'meri-event': UIEvent }>`. **Correction (W02-04):** at this exact pin the static `dataPartSchemas` TYPE is keyed by the unprefixed data-type name (`meri-event`), but the runtime looks up `dataPartSchemas[chunk.type]`, i.e. `data-meri-event` (`ai/dist/index.js`, `processUIMessageStream`). A type-correct registration therefore never runs at runtime. The outer SDK chunk schema accepts `data: unknown` and loose records, so its validation alone does not enforce Meri's closed records or the `chunk.id` binding. Meri therefore enforces the frozen contract with an explicit guard at the transport boundary (injected validator + `chunk.id === event.eventId`), not with `dataPartSchemas`. This mismatch was reproduced with a runtime fixture in `apps/ui/qualification/qualification.test.mjs` (the type-correct key delivers malformed data to `onData`; the runtime key validates it). [Custom data documentation](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data).

Emit a stable `start` message envelope, the data chunks, and a deliberate `finish` for the transport message. Native assistant text projection uses matching `text-start`/`text-delta`/`text-end` IDs; the client rejects deltas without an active text block. The helpers produce SSE `data: <JSON>`, terminal `[DONE]`, `content-type: text/event-stream`, `x-vercel-ai-ui-message-stream: v1`, and no-cache/no-buffering headers. Optional keep-alive comments are supported; no platform deployment dependency is implied by the header name. These bytes/behaviors were confirmed in `json-to-sse-transform-stream.ts`, `ui-message-stream-headers.ts`, and `create-sse-stream-with-keep-alive.ts`. [Wire protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol).

## Preserve the frozen semantics

Every event retains `contractVersion`, `eventId`, complete tenant/actor/conversation/run/attempt/worker/fence binding, conversation-wide `sequence`, timestamp, scopes and exact data. AI SDK message/part IDs do not substitute for those fields.

| Frozen variant | Required projection rule |
| --- | --- |
| `message.delta` | Preserve durable `messageId` and delta; native text is optional derived display state with explicit start/end synthesis and replay rules |
| `run.status`, `run.error` | Preserve authoritative state/error; connection finish or hook status is not proof the durable run completed |
| `tool.started`, `tool.completed` | Keep the custom event and authorized result reference; the frozen payload lacks full native tool input/output, so do not invent those fields |
| `source.available` | Preserve source evidence/lineage; resolve citations through current-authority endpoints |
| `approval.required` | Preserve proposal ID, immutable command hash and expiry; use the governed approval API, not local `addToolApprovalResponse` state as execution authority |
| `artifact.available` | Preserve artifact/version IDs; obtain an authorized preview/download rather than publishing storage URLs |
| `checkpoint.verified`, `usage.recorded` | Preserve receipt/reference IDs; UI parts do not prove checkpoint durability or usage reconciliation |

Never expose opaque SDK transcripts, hidden reasoning, capabilities or provider keys. An AI SDK reasoning chunk exists but is not authorized by the frozen event contract. Reauthorize stream attach, replay, every protected publication and later reference resolution. The client-sent conversation ID/messages are untrusted input; request preparation should send the intended command/reference, while the server resolves current identity/history. [Transport customization](https://ai-sdk.dev/docs/ai-sdk-ui/transport).

## Replay, cancellation and measured limitations still to qualify

- `prepareReconnectToStreamRequest` can put an acknowledged sequence in an authenticated GET URL/header. There is no automatic Meri sequence acknowledgement, immutable event deduplication, gap detection, stale-fence rejection or authorization in these helpers. The SSE serializer does not emit event `id:` lines. Keep the durable event store and cursor semantics in the broker/control adapter. Within one UI message a repeated data part `(type,id)` replaces data, but `onData` still fires; this is not exactly-once event processing.
- Choose and test one projection strategy: full frozen events as the authoritative data channel, then a deduplicated projection into native text/display state. Blindly replaying both custom events and native text deltas can duplicate visible text. Native stream message lifecycle is distinct from conversation-wide ordering across multiple runs/attempts. The frozen contract has no message-start/end variant; transport synthesis must remain an adapter concern unless integration owner approves a versioned change.
- **Measured (W02-04):** `ChatTransport.resumeStreamIsReplay` is read by the Chat's `makeRequestImpl` to reset state on a resumed full replay. At this pin only `WebSocketChatTransport` sets it `true`; `DefaultChatTransport`/`HttpChatTransport` leave it undefined (falsy), so incremental replay is the default. React `use-chat` wraps an inline transport and forwards only `sendMessages`/`reconnectToStream`, dropping `resumeStreamIsReplay` and `close`; the externally managed `Chat` path (`useChat({ chat })`) bypasses the wrapper and preserves them. W02-04 therefore uses one external `Chat` per authorized view with `resumeStreamIsReplay = false`, and reconnect sends the last accepted contiguous conversation sequence via an authenticated header (`prepareReconnectToStreamRequest`), not the SSE `Last-Event-ID`. No replacement transport framework is used.
- `useChat.stop()` aborts the client request, and the hook also stops its owned Chat on unmount. This must detach a subscriber rather than accidentally cancel the durable broker run. A dedicated authenticated stop command must separately request cancellation, persist its outcome and propagate to the worker. `resume`/`resumeStream` reconnects a stream; it does not resume an SDK process or restore a workspace. [Official resume/stop guidance](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams).
- `writer.write` returns void and suppresses enqueue-after-close errors; it is neither a durable receipt nor an awaited backpressure boundary. `consumeSseStream` tees a connection stream and does not itself provide durable storage. Bound subscriber queues and detach slow clients without losing broker events. Record separate stream outcome/run outcome: current `writer.setOutcome` and `onEnd` support explicit completed/failed/aborted/unknown; a normal HTTP close is insufficient evidence of run success.
- **Measured offline (W02-04, `apps/ui/qualification`, 19 fixtures (including separately attributed owner fixes7d094e1)):** scripts-disabled nested lock/install, typecheck (0 errors) and tests pass; all ten frozen variants compose through the real `createMeriChat` factory + external `Chat` and are projected exactly once in order; split SSE/UTF-8 boundaries; duplicate replay is idempotent; immutable `eventId` conflict and duplicate-sequence conflict each abort the subscription and preserve the last contiguous cursor (acceptance is enforced synchronously on the guarded data path, before any chunk is forwarded or reaches `onData`); gap pause/repair; multiple runs/attempts; malformed custom data and unexpected reasoning/tool/text frames rejected (with the `dataPartSchemas` runtime/type mismatch reproduced); `run.error` redaction; HTTP 204 and incremental reconnect via the actual `chat.resumeStream` using the authorized conversation URL and a sequence header (not `Last-Event-ID`); held-open stop/dispose while pending admit nothing and issue no durable cancellation; accepted/pending inputs are deep-frozen snapshots immune to later raw/nested mutation; stream-outcome vs run-outcome separation. No network is used (global `fetch` throws; fetch is mocked).
- Still NOT RUN: real React hook/React mounting and browser rendering; durable browser storage/persistence; real network/SSE interop and browser-safe compiled schema; slow-client/memory/backpressure limits; expired authorization/revocation and historical access; approved stop versus tab closure; actual AWS load-balancer streaming/idle timeouts; Fargate/Chromium sandbox; AI Elements component compatibility (the `ai-elements 1.9.0` scaffolding CLI was not executed); accessibility/end-to-end controls. These require a bounded later qualification task and independent exact-commit/live review.

Only this document and the W02-04 offline qualification directory were written. No gate is passed and no dependent live-integration task is authorized by this document. The W02-04 fixtures are offline reference evidence only; Codex and a separate real Hermes exact-commit review own acceptance.
