// W02-04 offline qualification: actual upstream writer + DefaultChatTransport +
// external Chat composed with the Meri guarded transport and projection.
//
// No server, socket, browser, model/provider or network is started. The global fetch
// is replaced with a throwing stub so an accidental network call fails the run. All
// fetches go through an injected mock that returns web `Response`/`ReadableStream`
// objects built by the upstream SSE helpers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  DefaultChatTransport,
} from 'ai';
import { Chat } from '@ai-sdk/react';

// The unchanged frozen root validator (imports node:fs/node:crypto); injected only
// into offline Node tests, never into the browser facade.
import { validateShape } from '../../../packages/contracts/validate.mjs';

import { MERI_UI_EVENT_VARIANTS } from './types.ts';
import { createMeriEventStream, meriEventStreamResponse } from './producer.ts';
import { MeriGuardedTransport, UiTransportGuardError } from './guarded-transport.ts';
import { ConversationProjection, renderRunError } from './projection.ts';

// Prove no accidental network path exists.
const realFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error('qualification forbids network access via globalThis.fetch');
};
test.after(() => {
  globalThis.fetch = realFetch;
});

const validateEvent = (value) => validateShape('UIEvent', value);

const VIEW = { tenantId: 'synthetic-a', actorId: 'actor-a', conversationId: randomUUID() };

const scope = () => ({
  tenantId: 'synthetic-a',
  kind: 'client',
  resourceId: 'client-a',
  policyRevision: 'policy-1',
});

const binding = (over = {}) => ({
  tenantId: 'synthetic-a',
  actorId: 'actor-a',
  conversationId: VIEW.conversationId,
  runId: randomUUID(),
  attemptId: randomUUID(),
  workerId: randomUUID(),
  writerFence: 1,
  ...over,
});

function makeEvent(type, data, over = {}) {
  return {
    contractVersion: '0.1.0',
    eventId: over.eventId ?? randomUUID(),
    binding: over.binding ?? binding(),
    sequence: over.sequence ?? 1,
    createdAt: '2026-10-09T18:00:00Z',
    scopes: [scope()],
    type,
    data,
  };
}

function allTenVariants({ sequenceFrom = 1 } = {}) {
  const seq = () => sequenceFrom++;
  return [
    makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: seq() }),
    makeEvent('message.delta', { messageId: randomUUID(), text: 'he\u2713llo \u4e16\u754c' }, { sequence: seq() }),
    makeEvent('tool.started', { requestId: randomUUID(), tool: 'search' }, { sequence: seq() }),
    makeEvent('tool.completed', { requestId: randomUUID(), resultReference: randomUUID() }, { sequence: seq() }),
    makeEvent(
      'source.available',
      {
        sourceId: 's1',
        recordId: 'r1',
        sourceVersionId: 'v1',
        observedAt: '2026-10-09T18:00:00Z',
        sourceUpdatedAt: null,
        citationId: randomUUID(),
        scopes: [scope()],
        contentSha256: 'a'.repeat(64),
        authorizationDecisionId: randomUUID(),
      },
      { sequence: seq() },
    ),
    makeEvent(
      'approval.required',
      { proposalId: randomUUID(), commandSha256: 'b'.repeat(64), expiresAt: '2026-10-09T18:10:00Z' },
      { sequence: seq() },
    ),
    makeEvent('artifact.available', { artifactId: randomUUID(), versionId: randomUUID() }, { sequence: seq() }),
    makeEvent('checkpoint.verified', { checkpointId: randomUUID() }, { sequence: seq() }),
    makeEvent('usage.recorded', { usageId: randomUUID() }, { sequence: seq() }),
    makeEvent(
      'run.error',
      { code: 'provider_unavailable', retryable: true, message: 'raw secret-shaped detail key=sk-do-not-render' },
      { sequence: seq() },
    ),
  ];
}

function eventStreamResponse(events, { messageId = randomUUID() } = {}) {
  return meriEventStreamResponse({ messageId, events });
}

/** Reads a UI chunk stream to completion, returning the chunks. Rejects on stream error. */
async function consume(stream) {
  const reader = stream.getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

function headerRecord(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function makeMockFetch(handlers) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = String(init.method ?? 'GET').toUpperCase();
    calls.push({ url, method, headers: headerRecord(init.headers), body: init.body });
    const handler = handlers[method];
    if (!handler) throw new Error(`unexpected ${method} ${url}`);
    return handler();
  };
  return { fetchImpl, calls };
}

const sendOptions = () => ({
  trigger: 'submit-message',
  chatId: VIEW.conversationId,
  messageId: undefined,
  messages: [],
  abortSignal: undefined,
});

/** Composes events through real DefaultChatTransport -> guarded transport -> projection. */
async function composeEvents(events, { view = VIEW } = {}) {
  const projection = new ConversationProjection(view);
  const results = [];
  const { fetchImpl } = makeMockFetch({ POST: () => eventStreamResponse(events) });
  const inner = new DefaultChatTransport({ api: '/api/chat', fetch: fetchImpl });
  const transport = new MeriGuardedTransport({
    inner,
    validateEvent,
    onEvent: (event) => {
      results.push(projection.accept(event));
    },
  });
  const stream = await transport.sendMessages(sendOptions());
  await consume(stream);
  return { projection, results };
}

test('all ten frozen variants compose through the upstream writer, DefaultChatTransport and external Chat', async () => {
  assert.equal(MERI_UI_EVENT_VARIANTS.length, 10);
  const events = allTenVariants();
  const { fetchImpl, calls } = makeMockFetch({ POST: () => eventStreamResponse(events) });
  const inner = new DefaultChatTransport({ api: '/api/chat', fetch: fetchImpl });
  const projected = [];
  let dataCallbacks = 0;
  const transport = new MeriGuardedTransport({
    inner,
    validateEvent,
    onEvent: (event) => projected.push(event),
  });
  const projection = new ConversationProjection(VIEW);
  const chat = new Chat({
    transport,
    sendAutomaticallyWhen: () => false,
    onData: () => {
      dataCallbacks += 1;
    },
  });

  await chat.sendMessage({ text: 'go' });

  for (const event of projected) projection.accept(event);
  assert.equal(projected.length, 10);
  assert.deepEqual(
    projected.map((e) => e.type),
    MERI_UI_EVENT_VARIANTS,
  );
  assert.deepEqual(
    projection.accepted.map((e) => e.sequence),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(projection.currentCursor, 10);
  assert.equal(projection.isRunCompleted(), false, 'finish does not mean the run completed');
  // transient data parts still invoke onData upstream (loose, not exactly-once)
  assert.equal(dataCallbacks, 10);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');

  await chat.dispose();
  assert.equal(transport.isClosed, true);
});

test('split SSE / UTF-8 byte boundaries do not corrupt frames', async () => {
  const events = [
    makeEvent('message.delta', { messageId: randomUUID(), text: 'a\u2713\u4e16z' }, { sequence: 1 }),
    makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 2 }),
  ];
  const original = eventStreamResponse(events);
  const bytes = new Uint8Array(await original.arrayBuffer());
  const split = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
      controller.close();
    },
  });
  const response = new Response(split, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  const { fetchImpl } = makeMockFetch({ POST: () => response });
  const inner = new DefaultChatTransport({ api: '/api/chat', fetch: fetchImpl });
  const seen = [];
  const transport = new MeriGuardedTransport({ inner, validateEvent, onEvent: (e) => seen.push(e) });
  await consume(await transport.sendMessages(sendOptions()));
  assert.deepEqual(seen.map((e) => e.type), ['message.delta', 'run.status']);
  assert.equal(seen[0].data.text, 'a\u2713\u4e16z');
});

test('duplicate replay of the same eventId and payload is a duplicate, not a second accept', async () => {
  const first = makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 });
  const { projection, results } = await composeEvents([first, structuredClone(first)]);
  assert.deepEqual(results.map((r) => r.status), ['accepted', 'duplicate']);
  assert.equal(projection.currentCursor, 1);
  assert.equal(projection.accepted.length, 1);
});

test('duplicate eventId with changed content conflicts', async () => {
  const eventId = randomUUID();
  const first = makeEvent('message.delta', { messageId: randomUUID(), text: 'a' }, { eventId, sequence: 1 });
  const changed = makeEvent('message.delta', { messageId: randomUUID(), text: 'b' }, { eventId, sequence: 1 });
  const { projection, results } = await composeEvents([first, changed]);
  assert.deepEqual(results.map((r) => r.status), ['accepted', 'conflict']);
  assert.equal(projection.accepted.length, 1);
});

test('duplicate sequence bound to a different eventId conflicts', async () => {
  const first = makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 });
  const clash = makeEvent('run.status', { state: 'paused', reasonCode: null }, { sequence: 1 });
  const { results } = await composeEvents([first, clash]);
  assert.deepEqual(results.map((r) => r.status), ['accepted', 'conflict']);
});

test('a gap pauses the cursor and is repaired by the missing event', async () => {
  const s1 = makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 });
  const s3 = makeEvent('message.delta', { messageId: randomUUID(), text: 'third' }, { sequence: 3 });
  const s2 = makeEvent('message.delta', { messageId: randomUUID(), text: 'second' }, { sequence: 2 });
  const { projection, results } = await composeEvents([s1, s3, s2]);
  assert.deepEqual(results.map((r) => r.status), ['accepted', 'gap', 'accepted']);
  assert.deepEqual(
    projection.accepted.map((e) => e.sequence),
    [1, 2, 3],
  );
  assert.equal(projection.currentCursor, 3);
  assert.deepEqual(projection.pendingSequences, []);
});

test('multiple runs and attempts share one conversation-wide sequence', async () => {
  const runA = binding();
  const runB = binding();
  const events = [
    makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1, binding: runA }),
    makeEvent('run.status', { state: 'completed', reasonCode: null }, { sequence: 2, binding: runA }),
    makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 3, binding: runB }),
    makeEvent('run.status', { state: 'completed', reasonCode: null }, { sequence: 4, binding: runB }),
  ];
  const { projection, results } = await composeEvents(events);
  assert.deepEqual(results.map((r) => r.status), ['accepted', 'accepted', 'accepted', 'accepted']);
  assert.equal(projection.currentCursor, 4);
  assert.equal(projection.isRunCompleted(), true);
});

test('malformed custom data is rejected by the guard even though the type-correct dataPartSchemas registration does not run', async () => {
  const malformed = { not: 'a uievent', sequence: 'x' };
  const malformedResponse = () =>
    createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute({ writer }) {
          writer.write({ type: 'data-meri-event', id: randomUUID(), data: malformed, transient: true });
        },
      }),
    });

  // Guarded path rejects the malformed frame.
  {
    const { fetchImpl } = makeMockFetch({ POST: () => malformedResponse() });
    const inner = new DefaultChatTransport({ api: '/api/chat', fetch: fetchImpl });
    const rejected = [];
    const transport = new MeriGuardedTransport({
      inner,
      validateEvent,
      onRejected: (error) => rejected.push(error),
    });
    await assert.rejects(consume(await transport.sendMessages(sendOptions())), (error) => {
      assert.ok(error instanceof UiTransportGuardError);
      return error.code === 'meri-event-invalid';
    });
    assert.equal(rejected.length, 1);
  }

  // A type-correct `dataPartSchemas` key ('meri-event') is never consulted at runtime,
  // so upstream still delivers the malformed data to onData.
  const strictSchema = {
    '~standard': {
      version: 1,
      vendor: 'meri-qualification',
      validate(value) {
        const ok =
          typeof value === 'object' &&
          value !== null &&
          value.contractVersion === '0.1.0' &&
          typeof value.eventId === 'string' &&
          typeof value.sequence === 'number';
        return ok ? { value } : { issues: [{ message: 'not a frozen UIEvent' }] };
      },
    },
  };

  let typedKeyCallbacks = 0;
  {
    const { fetchImpl } = makeMockFetch({ POST: () => malformedResponse() });
    const chat = new Chat({
      transport: new DefaultChatTransport({ api: '/api/chat', fetch: fetchImpl }),
      dataPartSchemas: { 'meri-event': strictSchema },
      onData: () => {
        typedKeyCallbacks += 1;
      },
    });
    await chat.sendMessage({ text: 'go' });
  }
  assert.equal(typedKeyCallbacks, 1, 'typed key is not applied at runtime (reproduced limitation)');

  // With the runtime key ('data-meri-event') the schema does run and rejects.
  let runtimeKeyCallbacks = 0;
  {
    const { fetchImpl } = makeMockFetch({ POST: () => malformedResponse() });
    const chat = new Chat({
      transport: new DefaultChatTransport({ api: '/api/chat', fetch: fetchImpl }),
      dataPartSchemas: { 'data-meri-event': strictSchema },
      onData: () => {
        runtimeKeyCallbacks += 1;
      },
      onError: () => {},
    });
    await chat.sendMessage({ text: 'go' }).catch(() => {});
  }
  assert.equal(runtimeKeyCallbacks, 0, 'runtime key is the one actually consulted');
});

test('unexpected native reasoning/tool/text frames are rejected by the guard', async () => {
  const frames = [
    { type: 'reasoning-delta', id: 'r1', delta: 'hidden chain' },
    { type: 'text-delta', id: 't1', delta: 'native text' },
    { type: 'tool-input-available', toolCallId: 'x', toolName: 'search', input: {} },
  ];
  for (const frame of frames) {
    const response = () =>
      createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute({ writer }) {
            writer.write(frame);
          },
        }),
      });
    const { fetchImpl } = makeMockFetch({ POST: () => response() });
    const inner = new DefaultChatTransport({ api: '/api/chat', fetch: fetchImpl });
    const transport = new MeriGuardedTransport({ inner, validateEvent });
    await assert.rejects(consume(await transport.sendMessages(sendOptions())), (error) => {
      assert.ok(error instanceof UiTransportGuardError);
      return error.code === 'unexpected-frame' && error.chunkType === frame.type;
    });
  }
});

test('run.error is rendered by approved code or generic text, never the raw message', async () => {
  const known = makeEvent('run.error', { code: 'budget_exceeded', retryable: false, message: 'sk-secret' });
  const unknown = makeEvent('run.error', { code: 'weird_code', retryable: true, message: 'token=abc' });
  assert.deepEqual(renderRunError(known), {
    code: 'budget_exceeded',
    retryable: false,
    message: 'The run stopped because its budget was reached.',
  });
  const rendered = renderRunError(unknown);
  assert.equal(rendered.message, 'The run stopped because of an error.');
  assert.ok(!rendered.message.includes('token'));
  assert.ok(!rendered.message.includes('sk-secret'));
});

test('HTTP 204 reconnect yields no stream and no events', async () => {
  const { fetchImpl, calls } = makeMockFetch({ GET: () => new Response(null, { status: 204 }) });
  const inner = new DefaultChatTransport({ api: '/api/chat', fetch: fetchImpl });
  let events = 0;
  const transport = new MeriGuardedTransport({ inner, validateEvent, onEvent: () => (events += 1) });
  const stream = await transport.reconnectToStream({ chatId: VIEW.conversationId });
  assert.equal(stream, null);
  assert.equal(events, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});

test('disconnect/reconnect requests the last accepted contiguous sequence, not Last-Event-ID', async () => {
  const events = [makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 })];
  const { fetchImpl, calls } = makeMockFetch({
    POST: () => eventStreamResponse(events),
    GET: () => new Response(null, { status: 204 }),
  });
  const projection = new ConversationProjection(VIEW);
  const transport = new MeriGuardedTransport({
    inner: new DefaultChatTransport({
      api: '/api/chat',
      fetch: fetchImpl,
      prepareReconnectToStreamRequest: ({ headers }) => ({
        headers: { ...headerRecord(headers), 'x-meri-resume-sequence': String(projection.currentCursor) },
      }),
    }),
    validateEvent,
    onEvent: (event) => projection.accept(event),
  });

  await consume(await transport.sendMessages(sendOptions()));
  assert.equal(projection.currentCursor, 1);

  await transport.reconnectToStream({ chatId: VIEW.conversationId });
  const reconnect = calls.find((c) => c.method === 'GET');
  assert.ok(reconnect);
  assert.equal(reconnect.headers['x-meri-resume-sequence'], '1');
  assert.equal(reconnect.headers['last-event-id'], undefined);
});

test('abort/dispose detach the subscriber without issuing a durable cancellation', async () => {
  const events = allTenVariants();
  const { fetchImpl, calls } = makeMockFetch({ POST: () => eventStreamResponse(events) });
  const inner = new DefaultChatTransport({ api: '/api/chat', fetch: fetchImpl });
  const transport = new MeriGuardedTransport({ inner, validateEvent, onEvent: () => {} });
  const chat = new Chat({ transport, sendAutomaticallyWhen: () => false });

  await chat.sendMessage({ text: 'go' });
  await chat.stop();
  await chat.dispose();

  assert.ok(calls.every((c) => c.method === 'POST'), 'no cancellation request was issued');
  assert.equal(transport.isClosed, true);
  assert.equal(transport.resumeStreamIsReplay, false);
  assert.equal(typeof transport.cancel, 'undefined', 'transport exposes no cancellation');
});

test('a completed stream outcome does not mark the run complete without an authoritative run.status', () => {
  const projection = new ConversationProjection(VIEW);
  projection.setStreamOutcome('completed');
  assert.equal(projection.connectionOutcome, 'completed');
  assert.equal(projection.isRunCompleted(), false);
  projection.accept(makeEvent('run.status', { state: 'completed', reasonCode: null }, { sequence: 1 }));
  assert.equal(projection.isRunCompleted(), true);
});
