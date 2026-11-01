import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createMailHttpAdapter} from '../http-adapter.mjs';
import {createMailReadHandler} from '../handler.mjs';
import {readContext} from '../request-context.mjs';
import {bodyText, createMailFixture, endpoints, NOW, uuid} from './fixtures.mjs';

const operations = ['mail.list_messages', 'mail.search_messages', 'mail.read_thread'];
const execute = (f, changes = {}, call = f.call()) => createMailReadHandler({operation: f.operation,
  adapter: createMailHttpAdapter({...f.config, ...changes}), now: () => f.state.now})(call);
const adapterCall = f => ({operation: f.operation, input: f.input(), request: f.args, authority: f.authority});
const jsonResponse = page => new Response(JSON.stringify(page), {headers: {'content-type': 'application/json'}});
const drain = () => new Promise(resolve => setImmediate(resolve));
const noncanonicalEndpoints = Object.freeze(Object.fromEntries(operations.map(id =>
  [id, `https://canonical-mail.example.invalid/legacy/${id}`])));
const rawSha256 = bytes => createHash('sha256').update(bytes, 'utf8').digest('hex');
const invocationCall = f => ({...f.call(), invocationId: 'synthetic_mail_call_1'});
const nativeCredentials = (f, pins, changes = {}) => ({...f.credentials(pins), ...changes});

for (const id of operations) test(`${id}: real loopback Fetch, byte decoder and handler preserve the canonical page`, async () => {
  const f = createMailFixture(id), observed = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    observed.push({method: req.method, url: req.url, headers: req.headers, rawBody: body, body: JSON.parse(body)});
    res.writeHead(200, {'content-type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(f.page(JSON.parse(body).input)));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const fetchImpl = (url, options) => {assert.equal(url, endpoints[id]); return fetch(`http://127.0.0.1:${server.address().port}/mail`, options);};
    const result = JSON.parse(await execute(f, {fetchImpl}));
    assert.deepEqual(result, f.page()); assert.equal(observed.length, 1); assert.equal(observed[0].method, 'POST');
    assert.deepEqual(observed[0].body, {input: f.input(), metadata: null}); assert.equal(observed[0].headers.authorization, 'Bearer SYNTHETIC_MAIL_TOKEN');
    assert.equal(observed[0].headers['x-internal-service-secret'], 'SYNTHETIC_SERVICE_SECRET');
    assert.equal(observed[0].headers['x-meri-deadline-at'], String(NOW+1000));
    const correlation = {binding: f.binding, subject: f.subject,
      policyRevision: f.authority.policyRevision, normalizationContext: null};
    assert.equal(observed[0].headers['x-meri-read-correlation'], Buffer.from(canonicalize(correlation)).toString('base64url'));
    assert.equal(observed[0].headers['x-tenant-id'], undefined); assert.equal(result.evidenceReady, false);
    assert.deepEqual(result.negativeAssertion, {kind: 'none'}); assert.equal(result.coverage.enumeration, 'unknown');
    const pins = f.credentialCalls[0];
    assert.deepEqual(pins.binding, f.binding); assert.deepEqual(pins.subject, f.subject); assert.deepEqual(pins.sourceIds, ['mail']);
    assert.deepEqual(pins.operation, f.operation); assert.equal(pins.argumentsSha256, canonicalSha256(observed[0].body.input));
    assert.equal(pins.requestSha256, canonicalSha256(observed[0].body)); assert.equal(pins.metadata, null);
    assert.deepEqual(pins.target, {method: 'POST', path: `/api/clio/tools/${id}`,
      bodySha256: rawSha256(observed[0].rawBody)});
    assert.ok(Object.isFrozen(pins.input)); assert.ok(Object.isFrozen(pins.subject.scopes));
  } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); assert.equal(server.listening, false);}
});

for (const id of operations) test(`${id}: native Bearer credentials bind the actual canonical path, raw body and correlation`, async () => {
  const f = createMailFixture(id); let issuedTarget, requestedDigest;
  const result = JSON.parse(await execute(f, {getCredentials: async pins => {
    issuedTarget = structuredClone(pins.target); requestedDigest = pins.correlationSha256;
    return nativeCredentials(f, pins, {target: issuedTarget});
  }}, invocationCall(f)));
  assert.deepEqual(result, f.page());
  const {url, options} = f.wire[0];
  assert.equal(new URL(url).pathname, issuedTarget.path);
  assert.equal(options.headers.authorization, 'Bearer SYNTHETIC_MAIL_TOKEN');
  assert.equal(options.headers['x-meri-deadline-at'], String(NOW+1000));
  assert.deepEqual(issuedTarget, {method: 'POST', path: `/api/clio/tools/${id}`, bodySha256: rawSha256(options.body)});
  const header = options.headers['x-meri-read-correlation'];
  const bytes = Buffer.from(header, 'base64url');
  assert.equal(header, bytes.toString('base64url'));
  assert.ok(bytes.length <= 8192);
  assert.equal(bytes.toString('utf8'), canonicalize({binding: f.binding, subject: f.subject,
    policyRevision: f.authority.policyRevision, normalizationContext: null}));
  assert.deepEqual(Object.keys(JSON.parse(bytes)).sort(), ['binding', 'normalizationContext', 'policyRevision', 'subject']);
  assert.equal(requestedDigest, rawSha256(bytes));
});

for (const change of [
  t => t.path = '/api/clio/tools/mail.search_messages',
  t => t.bodySha256 = '0'.repeat(64),
  t => t.method = 'GET',
]) test('mail rejects a substituted credential target before Fetch', async () => {
  const f = createMailFixture(), credentials = pins => {
    const target = structuredClone(pins.target); change(target);
    return nativeCredentials(f, pins, {target});
  };
  await assert.rejects(execute(f, {getCredentials: credentials}, invocationCall(f)), /ACCESS_DENIED/);
  assert.equal(f.wire.length, 0);
});

test('mail refuses a noncanonical configured path and an unknown scheme before Fetch', async () => {
  for (const [endpointsValue, scheme] of [[noncanonicalEndpoints, 'Bearer'], [endpoints, 'Basic'],
    [endpoints, null]]) {
    const f = createMailFixture();
    await assert.rejects(execute(f, {endpoints: endpointsValue, getCredentials: async pins =>
      nativeCredentials(f, pins, {authorizationScheme: scheme})}, invocationCall(f)), /ACCESS_DENIED/);
    assert.equal(f.wire.length, 0);
  }
});

test('mail correlates an optional invocation ID with the native credential response', async () => {
  const f = createMailFixture(), call = {...f.call(), invocationId: 'synthetic_mail_call_1'}; let requested;
  const result = JSON.parse(await execute(f, {getCredentials: async pins => {
    requested = pins.invocationId;
    return nativeCredentials(f, pins);
  }}, call));
  assert.deepEqual(result, f.page()); assert.equal(requested, call.invocationId);
  for (const value of [undefined, 'other_mail_call']) {
    const bad = createMailFixture();
    await assert.rejects(execute(bad, {getCredentials: async pins => {
      const receipt = nativeCredentials(bad, pins);
      if (value === undefined) delete receipt.invocationId; else receipt.invocationId = value;
      return receipt;
    }},
    {...bad.call(), invocationId: call.invocationId}), /ACCESS_DENIED/);
    assert.equal(bad.wire.length, 0);
  }
});

test('mail refuses missing or substituted correlation digest before Fetch', async () => {
  for (const echo of [undefined, '0'.repeat(64)]) {
    const f = createMailFixture();
    await assert.rejects(execute(f, {getCredentials: async pins => {
      const receipt = nativeCredentials(f, pins);
      if (echo === undefined) delete receipt.correlationSha256; else receipt.correlationSha256 = echo;
      return receipt;
    }}, invocationCall(f)), /ACCESS_DENIED/);
    assert.equal(f.wire.length, 0);
  }
});

test('mail refuses a native credential without the target echo before Fetch', async () => {
  const f = createMailFixture();
  await assert.rejects(execute(f, {getCredentials: async pins => {
    const receipt = nativeCredentials(f, pins); delete receipt.target; return receipt;
  }}, invocationCall(f)), /ACCESS_DENIED/);
  assert.equal(f.wire.length, 0);
});

test('mail refuses the retired CapiroMeriRead scheme even with exact target and correlation', async () => {
  for (const id of operations) {
    const f = createMailFixture(id);
    await assert.rejects(execute(f, {getCredentials: async pins =>
      nativeCredentials(f, pins, {authorizationScheme: 'CapiroMeriRead'})}, invocationCall(f)), /ACCESS_DENIED/);
    assert.equal(f.wire.length, 0);
  }
});

test('mail refuses missing Bearer scheme, target or correlation with and without an invocation ID', async () => {
  for (const invocation of [false, true]) {
    for (const missing of ['authorizationScheme', 'target', 'correlationSha256']) {
      const f = createMailFixture(), call = invocation ? invocationCall(f) : f.call();
      await assert.rejects(execute(f, {getCredentials: async pins => {
        const credentials = f.credentials(pins); delete credentials[missing]; return credentials;
      }}, call), /ACCESS_DENIED/);
      assert.equal(f.wire.length, 0);
    }
  }
});

test('mail refuses a native credential expiring after the trusted deadline before Fetch', async () => {
  const f = createMailFixture();
  await assert.rejects(execute(f, {getCredentials: async pins =>
    nativeCredentials(f, pins, {expiresAtMs: f.authority.deadlineMs + 1})}, invocationCall(f)), /ACCESS_DENIED/);
  assert.equal(f.wire.length, 0);
});

test('mail refuses correlation larger than the ingress cap before credentials or Fetch', async () => {
  const f = createMailFixture();
  const authority = structuredClone(f.authority);
  const policy = authority.policyRevision;
  const extra = Array.from({length: 80}, (_, index) => ({tenantId: f.binding.tenantId, kind: 'mailbox',
    resourceId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, policyRevision: policy}));
  authority.subject.scopes.push(...extra);
  assert.doesNotThrow(() => readContext({operation: f.operation, input: f.input(), request: f.args, authority}, () => f.state.now));
  assert.ok(Buffer.byteLength(canonicalize({binding: authority.binding, subject: authority.subject,
    policyRevision: authority.policyRevision, normalizationContext: null}), 'utf8') > 8192);
  let credentialCalls = 0;
  await assert.rejects(execute(f, {getCredentials: async pins => {
    credentialCalls += 1; return nativeCredentials(f, pins);
  }}, {...invocationCall(f), authority}), /ACCESS_DENIED/);
  assert.equal(credentialCalls, 0);
  assert.equal(f.wire.length, 0);
});

for (const id of operations) test(`${id}: exact selected client and mailbox remain scoped independently of connection status`, async () => {
  const f = createMailFixture(id, {client: true}), result = JSON.parse(await execute(f));
  assert.deepEqual(result.subject, f.subject); assert.equal(result.messages[0].mailboxId, f.mailboxId);
  assert.equal(result.messages[0].connectionStatus, 'disabled'); assert.equal(result.selection.subject.entityId, f.clientId);
  if (id !== 'mail.read_thread') assert.equal(result.messages[0].clientId, f.clientId);
});

test('mail previews exclude a late-body decision; exact UTF-16 continuation retrieves it without upgrading verification', async () => {
  const list = createMailFixture(), preview = JSON.parse(await execute(list));
  assert.equal(preview.messages[0].preview.text.includes('committee approved'), false);
  assert.equal(preview.messages[0].recordVersionId, null); assert.equal(preview.messages[0].preview.fullSizeKnown, false);
  const f = createMailFixture('mail.read_thread'), first = JSON.parse(await execute(f));
  assert.equal(first.messages[0].section.text.includes('committee approved'), false);
  assert.equal(first.messages[0].section.hasMore, true); assert.equal(first.coverage.truncated, true);
  const request = {...f.args, messageId: first.messages[0].messageId, bodyOffset: first.messages[0].section.endExclusive};
  const next = JSON.parse(await execute(f, {}, f.call(request)));
  assert.equal(next.messages[0].section.text.includes('committee approved'), true);
  assert.equal(next.messages[0].section.text.endsWith('😀'), true);
  assert.equal(next.messages[0].section.endExclusive, bodyText.length);
  assert.equal(next.messages[0].section.endExclusive-next.messages[0].section.start, next.messages[0].section.text.length);
  assert.equal(next.messages[0].contentSha256, first.messages[0].contentSha256);
  assert.equal(next.messages[0].recordVersionId, first.messages[0].recordVersionId);
  assert.equal(next.messages[0].citationId, first.messages[0].citationId);
  assert.equal(next.messages[0].section.hasMore, false); assert.equal(next.evidenceReady, false);
  assert.deepEqual(next.continuation.requiredReads, ['synthetic-authorized-mail-body']);
});

for (const id of operations.slice(0, 2)) test(`${id}: anchor, filters and advancing offset are transported exactly; history stays with dispatcher`, async () => {
  const f = createMailFixture(id), args = {...f.args, offset: 1, asOf: f.anchor, withinDays: 7, folder: 'inbox'};
  const result = JSON.parse(await execute(f, {}, f.call(args)));
  assert.deepEqual(JSON.parse(f.wire[0].options.body), {input: f.input(args), metadata: null});
  assert.equal(result.queryScope.asOfInclusive, f.anchor); assert.equal(result.queryScope.storedCreatedAtEndInclusive, f.anchor);
  assert.equal(result.queryScope.effectiveStartInclusive, new Date(Date.parse(f.anchor)-7*86400000).toISOString());
  assert.equal(result.selection.offset, 1); assert.equal(result.nextOffset, null); assert.equal(result.evidenceReady, false);
  if (id === 'mail.search_messages') assert.equal(result.selection.query, 'revised allocation');
});

for (const total of [0, null]) test(`mail empty/unknown count ${total} does not become an absence claim`, async () => {
  const f = createMailFixture(); f.state.total = total;
  const result = JSON.parse(await execute(f)); assert.equal(result.coverage.enumeration, 'unknown');
  assert.equal(result.totalMatches, total); assert.equal(result.nextOffset, null); assert.equal(result.evidenceReady, false);
  assert.deepEqual(result.negativeAssertion, {kind: 'none'});
});

test('missing stored body/version/hash remain explicit unknowns', async () => {
  const f = createMailFixture('mail.read_thread'), page = f.page();
  Object.assign(page.messages[0], {recordVersionId: null, contentSha256: null, citationId: null, bodyCompleteness: 'missing',
    section: {start: 0, endExclusive: 0, totalCodeUnits: null, unit: 'utf16-code-unit', text: null, hasMore: null}});
  page.nextBodyOffsets = []; page.coverage.truncated = false;
  const result = JSON.parse(await execute(f, {fetchImpl: async () => jsonResponse(page)}));
  assert.deepEqual(result.messages[0], page.messages[0]); assert.equal(result.evidenceReady, false);
});

const credentialMutations = {
  tenant: c => c.binding.tenantId = 'foreign', actor: c => c.binding.actorId = 'foreign',
  conversation: c => c.binding.conversationId = uuid('f'), run: c => c.binding.runId = uuid('f'),
  attempt: c => c.binding.attemptId = uuid('f'), worker: c => c.binding.workerId = uuid('f'), fence: c => c.binding.writerFence++,
  mailbox: c => c.subject.scopes.find(scope => scope.kind === 'mailbox').resourceId = uuid('f'), client: c => c.subject.entityIds[0] = uuid('f'),
  operation: c => c.operation.id = 'mail.search_messages', version: c => c.operation.version = '0.3.0',
  digest: c => c.argumentsSha256 = 'f'.repeat(64), requestDigest: c => c.requestSha256 = 'f'.repeat(64),
  metadata: c => c.metadata = {cursor: 'invented'}, source: c => c.sourceIds = ['foreign'], policy: c => c.policyRevision = 'foreign',
  expired: c => c.expiresAtMs = NOW, newline: c => c.bearerToken = 'INVALID\nTOKEN', oversized: c => c.serviceSecret = 'x'.repeat(8193),
};
for (const [name, change] of Object.entries(credentialMutations)) test(`mail credential ${name} substitution refuses before Fetch`, async () => {
  const f = createMailFixture();
  await assert.rejects(execute(f, {getCredentials: async pins => {const c = f.credentials(pins); change(c); return c;}}), /ACCESS_DENIED/);
  assert.equal(f.calls.includes('fetch'), false);
});

const pageMutations = {
  binding: p => p.binding.writerFence++, subject: p => p.subject.entityIds[0] = 'foreign-actor',
  operation: p => p.operation.id = 'mail.search_messages', digest: p => p.argumentsSha256 = 'f'.repeat(64),
  selection: p => p.selection.limit++, anchor: p => p.queryScope.asOfInclusive = new Date(NOW+2000).toISOString(),
  mailbox: p => p.messages[0].mailboxId = uuid('f'), source: p => p.sources[0].sourceId = 'foreign',
  authority: p => p.sources[0].authority = 'derivative', verified: p => p.evidenceReady = true,
  absence: p => p.negativeAssertion = {kind: 'absence'}, complete: p => p.coverage.enumeration = 'complete',
  reads: p => p.continuation.requiredReads = [], snapshot: p => p.snapshotVersionId = 'invented',
};
for (const [name, change] of Object.entries(pageMutations)) test(`mail source ${name} substitution or unsupported truth claim refuses`, async () => {
  const f = createMailFixture(), page = f.page(); change(page);
  await assert.rejects(execute(f, {fetchImpl: async () => jsonResponse(page)}), /INVALID_RESULT/);
});

for (const name of ['offset', 'length', 'thread', 'message', 'bodyMissing', 'unknownTotal']) test(`mail thread ${name} counterexample refuses`, async () => {
  const f = createMailFixture('mail.read_thread'), page = f.page();
  if (name === 'offset') page.messages[0].section.start++;
  if (name === 'length') page.messages[0].section.text += 'x';
  if (name === 'thread') page.messages[0].threadId = uuid('f');
  if (name === 'message') {f.args.messageId = uuid('8'); page.selection.messageId = uuid('8'); page.argumentsSha256 = canonicalSha256(page.selection);}
  if (name === 'bodyMissing') page.messages[0].bodyCompleteness = 'missing';
  if (name === 'unknownTotal') {page.totalMessages = null; page.hasMoreMessages = false;}
  await assert.rejects(execute(f, {fetchImpl: async () => jsonResponse(page)}), /INVALID_RESULT/);
});

test('wrong normalized request, body-offset selection and subject refuse before credentials', async () => {
  for (const mutate of [c => c.input.limit++, c => c.argumentsSha256 = 'f'.repeat(64), c => c.input.subject = {kind: 'client', entityId: uuid('b')},
    c => c.authority.binding = {...c.authority.binding, actorId: 'foreign-actor'}, c => c.authority.subject.scopes = [], c => c.authority.sourceIds = ['foreign']]) {
    const f = createMailFixture(), call = structuredClone(f.call()); mutate(call);
    await assert.rejects(execute(f, {}, call)); assert.deepEqual(f.calls, []);
  }
  const f = createMailFixture('mail.read_thread');
  await assert.rejects(execute(f, {}, {...f.call(), request: {...f.args, bodyOffset: 2000}})); assert.deepEqual(f.calls, []);
});

test('untrusted operation, endpoint overrides and source-context fields refuse without I/O', () => {
  const f = createMailFixture();
  for (const url of ['http://mail.invalid/thread', 'https://user:pass@mail.invalid/thread', 'https://mail.invalid/thread?actor=1', 'https://mail.invalid/thread#fragment']) {
    assert.throws(() => createMailHttpAdapter({...f.config, endpoints: {...endpoints, 'mail.read_thread': url}}));
  }
  for (const endpointsValue of [{}, {...endpoints, unknown: 'https://mail.invalid'}, {...endpoints, 'mail.list_messages': 1}]) {
    assert.throws(() => createMailHttpAdapter({...f.config, endpoints: endpointsValue}));
  }
  assert.throws(() => createMailReadHandler({operation: {id: 'mail.send', version: '0.2.0'}, adapter: {read() {}}, now: () => NOW}));
  assert.deepEqual(f.calls, []);
});

test('proxy, accessor and forged AbortSignal admission never executes their traps', async () => {
  for (const mode of ['proxy', 'getter', 'signal']) {
    const f = createMailFixture(); let touched = 0; let call = f.call();
    if (mode === 'proxy') call = new Proxy(call, {get() {touched++; throw Error('private');}, ownKeys() {touched++; throw Error('private');}});
    if (mode === 'getter') Object.defineProperty(call, 'input', {enumerable: true, get() {touched++; throw Error('private');}});
    if (mode === 'signal') call.signal = {get aborted() {touched++; throw Error('private');}};
    await assert.rejects(execute(f, {}, call)); assert.equal(touched, 0); assert.deepEqual(f.calls, []);
  }
});

test('credential accessor and proxy receipt fail without evaluating secret getters', async () => {
  for (const mode of ['getter', 'proxy']) {
    const f = createMailFixture(); let touched = 0;
    await assert.rejects(execute(f, {getCredentials: async pins => {
      const c = f.credentials(pins);
      if (mode === 'getter') Object.defineProperty(c, 'bearerToken', {enumerable: true, get() {touched++; return 'PRIVATE';}});
      else return new Proxy(c, {get(t, key) {if (key === 'then') return undefined; touched++; return Reflect.get(t, key);}});
      return c;
    }}));
    assert.equal(touched, 0); assert.equal(f.calls.includes('fetch'), false);
  }
});

for (const kind of ['status', 'media', 'encoding', 'length', 'overflow', 'utf8', 'json', 'object', 'redirect']) test(`mail response ${kind} is bounded and errors disclose no source text`, async () => {
  const f = createMailFixture(); const changes = {}; let fetched = false;
  const expected = kind === 'status' ? 'ACCESS_DENIED' : kind === 'overflow' ? 'RESOURCE_LIMIT'
    : kind === 'utf8' ? 'INTERNAL_ERROR' : 'INVALID_RESULT';
  if (kind === 'overflow') changes.maxResponseBytes = 64;
  changes.fetchImpl = async () => {
    fetched = true;
    if (kind === 'object') return {status: 200, body: 'PRIVATE'};
    const data = kind === 'utf8' ? new Uint8Array([0xc3, 0x28]) : kind === 'json' ? '{PRIVATE' : JSON.stringify(f.page());
    const response = new Response(data, {status: kind === 'status' ? 403 : 200,
      headers: {'content-type': kind === 'media' ? 'text/html' : 'application/json',
        ...(kind === 'encoding' ? {'content-encoding': 'gzip'} : {}), ...(kind === 'length' ? {'content-length': '1'} : {})}});
    if (kind === 'redirect') Object.defineProperty(response, 'redirected', {value: true});
    return response;
  };
  await assert.rejects(execute(f, changes), error => error.message === expected && !error.message.includes('PRIVATE'));
  assert.equal(fetched, true);
});

for (const stage of ['credentials', 'fetch', 'body']) for (const cancelled of [false, true]) test(`mail ${cancelled ? 'cancellation' : 'deadline'} bounds parked ${stage} and retires late body`, async () => {
  const f = createMailFixture(), held = Promise.withResolvers(), entered = Promise.withResolvers(), controller = new AbortController();
  let bodyCancelled = false, effectSignal, credentialPins;
  const changes = {maxRequestMs: 25};
  if (stage === 'credentials') changes.getCredentials = pins => {credentialPins = pins; effectSignal = pins.signal; entered.resolve(); return held.promise;};
  if (stage === 'fetch') changes.fetchImpl = (url, options) => {effectSignal = options.signal; entered.resolve(); return held.promise;};
  if (stage === 'body') changes.fetchImpl = async (url, options) => {
    effectSignal = options.signal; return new Response(new ReadableStream({pull() {entered.resolve(); return held.promise;}, cancel() {bodyCancelled = true;}}),
      {headers: {'content-type': 'application/json'}});
  };
  const pending = execute(f, changes, {...f.call(), signal: controller.signal});
  try {
    await entered.promise; if (cancelled) controller.abort();
    await assert.rejects(pending, new RegExp(cancelled ? 'CANCELLED' : 'DEADLINE'));
    assert.equal(effectSignal.aborted, true); const count = f.calls.length;
    const late = new Response(new ReadableStream({cancel() {bodyCancelled = true;}}), {headers: {'content-type': 'application/json'}});
    held.resolve(stage === 'credentials' ? f.credentials(credentialPins) : stage === 'fetch' ? late : undefined);
    await drain(); await drain(); assert.equal(f.calls.length, count); if (stage !== 'credentials') assert.equal(bodyCancelled, true);
  } finally {controller.abort(); held.resolve(); await pending.catch(() => {});}
});

test('credentials shorten the inherited lifetime and expiry prevents any fetch', async () => {
  const f = createMailFixture(), adapter = createMailHttpAdapter({...f.config, getCredentials: async pins => {
    const c = f.credentials(pins); c.expiresAtMs = NOW+10; f.state.now = NOW+10; return c;
  }});
  await assert.rejects(adapter.read(adapterCall(f)), /ACCESS_DENIED|DEADLINE/); assert.equal(f.calls.includes('fetch'), false);
});
