// W02-04 offline qualification: the REAL factory `createMeriChat` + external
// `@ai-sdk/react` Chat composed with the upstream writer / DefaultChatTransport.
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
import { meriEventStreamResponse } from './producer.ts';
import { createMeriChat } from './guarded-transport.ts';
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
const CONVERSATION_STREAM_URL = `/api/chat/${VIEW.conversationId}/stream`;

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

/** A stream whose only frame(s) are written directly (for malformed/native fixtures). */
function rawChunkResponse(chunks) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute({ writer }) {
        for (const chunk of chunks) writer.write(chunk);
      },
    }),
  });
}

async function consume(stream) {
  const reader = stream.getReader();
  for (;;) {
    const { done } = await reader.read();
    if (done) break;
  }
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

function factoryFor(fetchImpl) {
  return createMeriChat({ view: VIEW, validateEvent, fetchImpl });
}

async function sendAndSettle(chat) {
  await chat
    .sendMessage({ text: 'go' })
    .catch(() => {});
}

test('all ten frozen variants compose through the real factory + external Chat and project exactly once in order', async () => {
  assert.equal(MERI_UI_EVENT_VARIANTS.length, 10);
  const events = allTenVariants();
  const { fetchImpl, calls } = makeMockFetch({ POST: () => eventStreamResponse(events) });
  const { chat, transport, projection } = factoryFor(fetchImpl);

  assert.equal(chat.id, VIEW.conversationId, 'chat id is bound to the authorized conversation');

  await chat.sendMessage({ text: 'go' });

  assert.deepEqual(
    projection.accepted.map((e) => e.type),
    MERI_UI_EVENT_VARIANTS,
  );
  assert.deepEqual(
    projection.accepted.map((e) => e.sequence),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(projection.currentCursor, 10);
  assert.equal(projection.isRunCompleted(), false, 'finish does not mean the run completed');
  assert.equal(chat.status, 'ready');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');

  await chat.dispose();
  assert.equal(transport.isClosed, true);
});

test('split SSE / UTF-8 byte boundaries do not corrupt frames (real factory path)', async () => {
  const events = [
    makeEvent('message.delta', { messageId: randomUUID(), text: 'a\u2713\u4e16z' }, { sequence: 1 }),
    makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 2 }),
  ];
  const bytes = new Uint8Array(await eventStreamResponse(events).arrayBuffer());
  const split = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
      controller.close();
    },
  });
  const { fetchImpl } = makeMockFetch({
    POST: () => new Response(split, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  });
  const { chat, projection } = factoryFor(fetchImpl);
  await chat.sendMessage({ text: 'go' });
  assert.deepEqual(
    projection.accepted.map((e) => e.type),
    ['message.delta', 'run.status'],
  );
  assert.equal(projection.accepted[0].data.text, 'a\u2713\u4e16z');
});

test('duplicate replay of the same eventId and payload is idempotent', async () => {
  const first = makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 });
  const { fetchImpl } = makeMockFetch({ POST: () => eventStreamResponse([first, structuredClone(first)]) });
  const { chat, projection } = factoryFor(fetchImpl);
  await chat.sendMessage({ text: 'go' });
  assert.equal(projection.accepted.length, 1);
  assert.equal(projection.currentCursor, 1);
  assert.equal(chat.status, 'ready');
});

test('immutable eventId conflict aborts the subscription and preserves the last contiguous cursor', async () => {
  const eventId = randomUUID();
  const first = makeEvent('message.delta', { messageId: randomUUID(), text: 'a' }, { eventId, sequence: 1 });
  const changed = makeEvent('message.delta', { messageId: randomUUID(), text: 'b' }, { eventId, sequence: 1 });
  const { fetchImpl } = makeMockFetch({ POST: () => eventStreamResponse([first, changed]) });
  const { chat, projection } = factoryFor(fetchImpl);

  await sendAndSettle(chat);

  assert.equal(chat.status, 'error', 'conflict errors the chat, it does not silently continue');
  assert.deepEqual(
    projection.accepted.map((e) => e.sequence),
    [1],
    'the conflicting event is not admitted',
  );
  assert.equal(projection.currentCursor, 1);
});

test('duplicate sequence bound to a different eventId aborts the subscription', async () => {
  const first = makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 });
  const clash = makeEvent('run.status', { state: 'paused', reasonCode: null }, { sequence: 1 });
  const { fetchImpl } = makeMockFetch({ POST: () => eventStreamResponse([first, clash]) });
  const { chat, projection } = factoryFor(fetchImpl);

  await sendAndSettle(chat);

  assert.equal(chat.status, 'error');
  assert.deepEqual(
    projection.accepted.map((e) => e.sequence),
    [1],
  );
  assert.equal(projection.currentCursor, 1);
});

test('a gap pauses the cursor and is repaired by the missing event (real factory path)', async () => {
  const s1 = makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 });
  const s3 = makeEvent('message.delta', { messageId: randomUUID(), text: 'third' }, { sequence: 3 });
  const s2 = makeEvent('message.delta', { messageId: randomUUID(), text: 'second' }, { sequence: 2 });
  const { fetchImpl } = makeMockFetch({ POST: () => eventStreamResponse([s1, s3, s2]) });
  const { chat, projection } = factoryFor(fetchImpl);
  await chat.sendMessage({ text: 'go' });
  assert.deepEqual(
    projection.accepted.map((e) => e.sequence),
    [1, 2, 3],
  );
  assert.equal(projection.currentCursor, 3);
  assert.deepEqual(projection.pendingSequences, []);
});

test('multiple runs and attempts share one conversation-wide sequence (real factory path)', async () => {
  const runA = binding();
  const runB = binding();
  const events = [
    makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1, binding: runA }),
    makeEvent('run.status', { state: 'completed', reasonCode: null }, { sequence: 2, binding: runA }),
    makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 3, binding: runB }),
    makeEvent('run.status', { state: 'completed', reasonCode: null }, { sequence: 4, binding: runB }),
  ];
  const { fetchImpl } = makeMockFetch({ POST: () => eventStreamResponse(events) });
  const { chat, projection } = factoryFor(fetchImpl);
  await chat.sendMessage({ text: 'go' });
  assert.equal(projection.currentCursor, 4);
  assert.equal(projection.isRunCompleted(), true);
});

test('malformed custom data is rejected on the guard boundary before onData/admission', async () => {
  const malformed = { not: 'a uievent', sequence: 'x' };
  const malformedResponse = () => rawChunkResponse([{ type: 'data-meri-event', id: randomUUID(), data: malformed, transient: true }]);
  const { fetchImpl } = makeMockFetch({ POST: () => malformedResponse() });
  const { chat, projection } = factoryFor(fetchImpl);

  await sendAndSettle(chat);

  assert.equal(chat.status, 'error');
  assert.equal(chat.error instanceof Error, true);
  assert.equal(projection.accepted.length, 0);
  assert.equal(projection.currentCursor, 0);
});

test('the dataPartSchemas runtime/type key mismatch is reproduced at this exact pin', async () => {
  const malformedResponse = () => rawChunkResponse([{ type: 'data-meri-event', id: randomUUID(), data: { not: 'a uievent' }, transient: true }]);
  const strictSchema = {
    '~standard': {
      version: 1,
      vendor: 'meri-qualification',
      validate(value) {
        const ok =
          typeof value === 'object' && value !== null && value.contractVersion === '0.1.0' && typeof value.sequence === 'number';
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

test('unexpected native reasoning/tool/text frames are rejected (real factory path)', async () => {
  const frames = [
    { type: 'reasoning-delta', id: 'r1', delta: 'hidden chain' },
    { type: 'text-delta', id: 't1', delta: 'native text' },
    { type: 'tool-input-available', toolCallId: 'x', toolName: 'search', input: {} },
  ];
  for (const frame of frames) {
    const { fetchImpl } = makeMockFetch({ POST: () => rawChunkResponse([frame]) });
    const { chat, projection } = factoryFor(fetchImpl);
    await sendAndSettle(chat);
    assert.equal(chat.status, 'error', `${frame.type} rejected`);
    assert.equal(projection.accepted.length, 0);
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

test('HTTP 204 reconnect via chat.resumeStream uses the authorized conversation URL and cursor header', async () => {
  const { fetchImpl, calls } = makeMockFetch({ GET: () => new Response(null, { status: 204 }) });
  const { chat, projection } = factoryFor(fetchImpl);

  await chat.resumeStream();

  const get = calls.find((c) => c.method === 'GET');
  assert.ok(get, 'a reconnect GET was issued');
  assert.equal(get.url, CONVERSATION_STREAM_URL);
  assert.equal(get.headers['x-meri-resume-sequence'], '0');
  assert.equal(get.headers['last-event-id'], undefined);
  assert.equal(projection.accepted.length, 0);
});

test('incremental reconnect via chat.resumeStream requests the last accepted sequence and appends', async () => {
  const s1 = makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 });
  const s2 = makeEvent('message.delta', { messageId: randomUUID(), text: 'late' }, { sequence: 2 });
  const { fetchImpl, calls } = makeMockFetch({
    POST: () => eventStreamResponse([s1]),
    GET: () => eventStreamResponse([s2]),
  });
  const { chat, projection } = factoryFor(fetchImpl);

  await chat.sendMessage({ text: 'go' });
  assert.equal(projection.currentCursor, 1);

  await chat.resumeStream();

  const get = calls.find((c) => c.method === 'GET');
  assert.ok(get);
  assert.equal(get.url, CONVERSATION_STREAM_URL);
  assert.equal(get.headers['x-meri-resume-sequence'], '1');
  assert.deepEqual(
    projection.accepted.map((e) => e.sequence),
    [1, 2],
  );
  assert.equal(projection.currentCursor, 2);
});

test('stop/dispose on a held-open pending stream admit nothing, issue no durable cancel, and leave run status unchanged', async () => {
  const events = allTenVariants();
  const bytes = new Uint8Array(await eventStreamResponse(events).arrayBuffer());
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const held = new Response(
    new ReadableStream({
      async start(controller) {
        await gate;
        try {
          controller.enqueue(bytes);
          controller.close();
        } catch {
          // consumer cancelled the stream after stop/dispose
        }
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  const { fetchImpl, calls } = makeMockFetch({ POST: () => held });
  const { chat, transport, projection } = factoryFor(fetchImpl);

  const pending = chat.sendMessage({ text: 'go' });
  while (calls.length === 0) await new Promise((r) => setTimeout(r, 1));

  await chat.stop();
  release();
  await pending.catch(() => {});

  assert.equal(projection.accepted.length, 0, 'no event admitted after stop');
  assert.equal(projection.currentCursor, 0);
  assert.equal(projection.runStatus, undefined, 'durable run status unchanged');
  assert.ok(
    calls.every((c) => c.method === 'POST'),
    'stopping detaches only; no durable cancellation request was issued',
  );

  const beforeDispose = calls.length;
  await chat.dispose();
  assert.equal(transport.isClosed, true);
  assert.equal(calls.length, beforeDispose, 'dispose issues no request');
  assert.equal(typeof transport.cancel, 'undefined', 'transport exposes no cancellation');
});

test('projection snapshots inputs: mutating raw/nested input cannot rewrite accepted history', async () => {
  const projection = new ConversationProjection(VIEW);
  const s1 = makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 });
  const s3 = makeEvent('message.delta', { messageId: randomUUID(), text: 'original' }, { sequence: 3 });

  projection.accept(s1);
  assert.equal(projection.accept(s3).status, 'gap');

  // Deeply mutate the raw pending input after acceptance.
  s3.data.text = 'MUTATED';
  s3.data.messageId = 'MUTATED-ID';
  s3.binding.tenantId = 'evil';

  const s2 = makeEvent('message.delta', { messageId: randomUUID(), text: 'two' }, { sequence: 2 });
  assert.equal(projection.accept(s2).status, 'accepted');

  assert.equal(projection.accepted.length, 3);
  assert.equal(projection.accepted[2].data.text, 'original', 'pending snapshot preserved through repair');
  assert.equal(projection.accepted[2].binding.tenantId, 'synthetic-a');
  assert.equal(projection.currentCursor, 3);

  // The returned accepted array is a frozen copy.
  assert.throws(() => {
    projection.accepted.push(s1);
  }, TypeError);
  assert.equal(projection.accepted.length, 3, 'history unchanged after rejected mutation');
});

test('projection snapshots committed inputs and nested payloads; factory path is immune to later mutation', async () => {
  const committed = makeEvent('message.delta', { messageId: randomUUID(), text: 'keep' }, { sequence: 1 });
  const source = makeEvent(
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
    { sequence: 2 },
  );
  const { fetchImpl } = makeMockFetch({ POST: () => eventStreamResponse([committed, source]) });
  const { chat, projection } = factoryFor(fetchImpl);
  await chat.sendMessage({ text: 'go' });
  assert.equal(projection.currentCursor, 2);

  // Mutate the raw inputs after they were accepted.
  committed.data.text = 'changed';
  committed.sequence = 99;
  committed.binding.tenantId = 'evil';
  source.data.scopes[0].resourceId = 'evil';
  source.data.contentSha256 = 'f'.repeat(64);

  assert.equal(projection.accepted[0].data.text, 'keep');
  assert.equal(projection.accepted[0].sequence, 1);
  assert.equal(projection.accepted[0].binding.tenantId, 'synthetic-a');
  assert.equal(projection.accepted[1].data.scopes[0].resourceId, 'client-a');
  assert.equal(projection.accepted[1].data.contentSha256, 'a'.repeat(64));
  assert.equal(projection.currentCursor, 2);
});

test('a completed stream outcome does not mark the run complete without an authoritative run.status', () => {
  const projection = new ConversationProjection(VIEW);
  projection.setStreamOutcome('completed');
  assert.equal(projection.connectionOutcome, 'completed');
  assert.equal(projection.isRunCompleted(), false);
  projection.accept(makeEvent('run.status', { state: 'completed', reasonCode: null }, { sequence: 1 }));
  assert.equal(projection.isRunCompleted(), true);
});

test('prototype-looking run error codes use only the generic safe string', () => {
  for (const code of ['toString', 'constructor', '__proto__']) {
    const result = renderRunError(makeEvent('run.error', { code, retryable: false, message: 'private provider detail' }));
    assert.equal(typeof result.message, 'string');
    assert.equal(result.message, 'The run stopped because of an error.');
  }
});

test('mutating factory view input cannot change send or reconnect conversation identity', async () => {
  const view = { ...VIEW };
  const { fetchImpl, calls } = makeMockFetch({
    POST: () => eventStreamResponse([makeEvent('run.status', { state: 'running', reasonCode: null }, { sequence: 1 })]),
    GET: () => new Response(null, { status: 204 }),
  });
  const { chat, projection } = createMeriChat({ view, validateEvent, fetchImpl });
  view.conversationId = randomUUID();
  view.tenantId = 'changed-tenant';
  view.actorId = 'changed-actor';
  await chat.sendMessage({ text: 'go' });
  await chat.resumeStream();
  assert.equal(chat.id, VIEW.conversationId);
  assert.deepEqual(projection.view, VIEW);
  assert.equal(JSON.parse(calls[0].body).command.conversationId, VIEW.conversationId);
  assert.equal(calls[1].url, CONVERSATION_STREAM_URL);
  assert.equal(calls[1].headers['x-meri-resume-sequence'], '1');
  await chat.dispose();
});
