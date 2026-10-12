import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { resolveOperationContract } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { createToolDispatch } from '../dispatch/tool-dispatch.mjs';
import { createSourceDisabledGateway } from '../index.mjs';
import { fixture, NOW, uuid, limits } from './fixtures.mjs';

// Synthetic source and retained-store ports on the actual canonical dispatcher.
// No mail account, handler registration, database or source connection exists.
function mailFixture(id = 'mail.list_messages') {
  const f = fixture(), operation = { id, version: '0.2.0' };
  const canonical = resolveOperationContract(operation), records = new Map();
  const mailboxId = uuid('a'), anchor = new Date(NOW-1000).toISOString();
  Object.assign(f.claims.scopes[0], { kind: 'mailbox', resourceId: mailboxId });
  f.state.grants = [...canonical.descriptor.requiredGrants];
  Object.assign(f.state, { total: 3, normalizationCalls: 0 });
  const policy = f.ports.authorizeBusiness;
  f.ports.authorizeBusiness = async (...args) => {
    const row = JSON.parse(await policy(...args));
    row.decision.operation = `${id}@0.2.0`;
    row.decision.decisionId = row.subject.authorizationDecisionId;
    return JSON.stringify(row);
  };
  f.ports.authorizeSources = async () => {
    f.calls.push('source-policy'); return JSON.stringify({ sourceIds: ['mail'], enabled: true,
      policyRevision: f.claims.policyRevision, checkedAtMs: f.state.now });
  };
  f.entry.descriptor = canonical.descriptor;
  f.entry.contract = { ...canonical, normalizeInput(...args) {
    f.state.normalizationCalls++; return canonical.normalizeInput(...args);
  } };
  function page(call) {
    const selection = call.input, offset = selection.offset;
    const count = f.state.total === null ? 1 : Math.min(selection.limit, Math.max(0, f.state.total-offset));
    const messages = Array.from({ length: count }, (_, n) => {
      const ordinal = offset+n, stamp = new Date(NOW-1000-ordinal*1000).toISOString();
      return { sourceId: 'mail', mailboxId, threadId: uuid('b'), messageId: uuid(String(9-ordinal)),
        recordVersionId: null, citationId: null, scopes: structuredClone(f.subject.scopes), removed: false,
        connectionStatus: 'disconnected', readHandle: `synthetic-read-${ordinal}`, internetMessageId: `<synthetic-${ordinal}@example.invalid>`,
        clientId: selection.subject.kind === 'client' ? selection.subject.entityId : null,
        receivedAt: stamp, sentAt: null, createdAt: stamp, effectiveAt: stamp,
        subjectText: 'Synthetic candidate', preview: { kind: 'incomplete-preview', text: 'Inert preview', fullSizeKnown: false },
        from: { email: null, name: null }, to: [], cc: [], toTruncated: false, ccTruncated: false };
    });
    const asOf = selection.asOf ?? anchor, more = f.state.total === null ? null : offset+count < f.state.total;
    return { kind: 'mail-candidate-source-page', contractVersion: '0.2.0', operation,
      requestId: uuid('c'), traceId: uuid('d'), binding: call.authority.binding, subject: call.authority.subject,
      window: { basis: 'unbounded' }, argumentsSha256: call.argumentsSha256, appliedFilters: [],
      sources: [{ sourceId: 'mail', authority: 'authoritative', snapshotVersionId: null, adapterVersion: '0.2.0',
        status: 'partial', synchronizedAt: null, asOf: null, retrievedAt: anchor, freshness: 'unknown' }],
      coverage: { sourcesRequested: ['mail'], sourcesChecked: ['mail'], sourcesUnavailable: [], enumeration: 'unknown',
        enumerableTotal: f.state.total, returnedCount: count, truncated: more === true, historySupport: 'bounded',
        limitations: ['Synthetic stored candidates; immutable snapshot and decisive bodies unknown.'] },
      selection, filterSha256: canonicalSha256({ ...selection, offset: 0, asOf: null }),
      order: 'effectiveAt-desc-nullslast_messageId-desc', snapshotVersionId: null,
      queryScope: { asOfInclusive: asOf, storedCreatedAtEndInclusive: asOf,
        effectiveStartInclusive: selection.withinDays === null ? null : new Date(Date.parse(asOf)-selection.withinDays*86400000).toISOString(),
        missingEffectiveDates: selection.withinDays === null ? 'included' : 'excluded' },
      messages, totalMatches: f.state.total, hasMore: more,
      nextOffset: more && count > 0 && offset+count <= 10000 ? offset+count : null,
      threadGroups: id === 'mail.list_messages' ? (count ? [{ mailboxId, threadId: uuid('b'), messageIds: messages.map(m => m.messageId) }] : []) : null,
      returnedThreadGroupCount: id === 'mail.list_messages' ? (count ? 1 : 0) : null,
      continuation: { cursor: null, requiredReads: messages.map(m => m.readHandle), remainingSources: [] },
      evidenceReady: false, negativeAssertion: { kind: 'none' } };
  }
  f.entry.execute = async call => {
    f.calls.push('handler'); f.state.handlerCall = call;
    const output = page(call); f.state.changeOutput?.(output);
    return JSON.stringify(output);
  };
  const contextPorts = {
    async loadPrevious({ key }) {
      f.calls.push('load-previous'); return JSON.stringify({ record: records.get(canonicalSha256(key)) ?? null, checkedAtMs: f.state.now });
    },
    async retain({ record }) {
      f.calls.push('retain'); f.state.retainedArgument = record;
      records.set(canonicalSha256(record.key), structuredClone(record));
      return JSON.stringify({ decision: 'retained', keySha256: canonicalSha256(record.key),
        previousSha256: record.previousSha256, checkedAtMs: f.state.now });
    },
  };
  const create = changes => createToolDispatch({ catalog: { entry: () => f.entry, discoverable: () => [] },
    authority: f.authority, budget: f.budget, limits, now: () => f.state.now, newId: () => uuid('7'),
    sourceEnabled: true, mailContextPorts: contextPorts, ...changes });
  const args = { subject: { kind: 'personal' }, limit: 1, ...(id === 'mail.search_messages' ? { query: '  synthetic  ' } : {}) };
  const request = input => JSON.stringify({ operation, arguments: input });
  const execute = (input = args, changes, signal) => create(changes).execute(request(input), 'synthetic-opaque', signal);
  return { ...f, operation, canonical, records, contextPorts, create, args, request, execute, anchor };
}

for (const id of ['mail.list_messages', 'mail.search_messages']) {
  test(`${id}: three pages consume trusted prior results and one canonical normalization per call`, async () => {
    const f = mailFixture(id), original = structuredClone(f.args), outputs = [];
    for (let offset = 0; offset < 3; offset++) {
      const input = offset ? { ...f.args, offset, asOf: f.anchor } : f.args;
      outputs.push(JSON.parse(await f.execute(input)));
    }
    assert.deepEqual(f.args, original); assert.equal(f.state.normalizationCalls, 3);
    assert.equal(f.calls.filter(c => c === 'load-previous').length, 2);
    assert.equal(f.calls.filter(c => c === 'retain').length, 2);
    assert.equal(f.calls.filter(c => c === 'settle').length, 3);
    assert.equal(f.calls.includes('uncertain'), false);
    for (const page of outputs) {
      assert.equal(page.coverage.enumeration, 'unknown'); assert.equal(page.snapshotVersionId, null);
      assert.equal(page.evidenceReady, false); assert.deepEqual(page.negativeAssertion, { kind: 'none' });
      assert.equal(page.continuation.requiredReads.length, 1);
    }
    const first = [...f.records.values()][0];
    assert.deepEqual(first.previousPage, outputs[0]);
    const { authorizationDecisionId: ignored, ...stableSubject } = f.subject;
    assert.deepEqual(first.key.subject, stableSubject);
    assert.deepEqual(first.key.selection, { ...outputs[0].selection, offset: 1, asOf: f.anchor });
    assert.equal(first.previousSha256, canonicalSha256(outputs[0]));
    assert.equal(first.expiresAtMs, NOW+limits.maxRequestMs);
    assert.equal(Object.isFrozen(f.state.retainedArgument.previousPage.messages[0].preview), true);
    if (id === 'mail.search_messages') assert.equal(outputs[0].selection.query, 'synthetic');
  });
}

test('mail first page keeps fresh decision rotation and exact output page identity', async () => {
  const f = mailFixture(), policy = f.ports.authorizeBusiness; let decisions = 0;
  f.ports.authorizeBusiness = async (...args) => {
    const row = JSON.parse(await policy(...args)), decisionId = uuid(String(++decisions));
    row.decision.decisionId = decisionId; row.subject.authorizationDecisionId = decisionId;
    return JSON.stringify(row);
  };
  const output = JSON.parse(await f.execute());
  assert.equal(decisions, 5); assert.equal(output.subject.authorizationDecisionId, uuid('3'));
  const record = [...f.records.values()][0];
  assert.deepEqual(record.previousPage, output);
  assert.equal(Object.hasOwn(record.key.subject, 'authorizationDecisionId'), false);
});

test('prior/current page decision mismatch refuses without rewriting retained history', async () => {
  const f = mailFixture(); await f.execute();
  const original = structuredClone([...f.records.values()][0]);
  f.subject.authorizationDecisionId = uuid('e');
  await assert.rejects(f.execute({ ...f.args, offset: 1, asOf: f.anchor }), /INVALID_RESULT/);
  assert.equal(f.calls.filter(c => c === 'load-previous').length, 1);
  assert.equal(f.calls.filter(c => c === 'handler').length, 2);
  assert.equal(f.calls.filter(c => c === 'uncertain').length, 1);
  assert.deepEqual([...f.records.values()][0], original);
});

test('unknown, exhausted and empty totals retain no cursor or completeness claim', async () => {
  for (const total of [null, 0, 1]) {
    const f = mailFixture(); f.state.total = total;
    const output = JSON.parse(await f.execute());
    assert.equal(output.nextOffset, null); assert.equal(f.records.size, 0);
    assert.equal(f.calls.includes('load-previous'), false); assert.equal(f.calls.includes('retain'), false);
    assert.equal(output.coverage.enumeration, 'unknown'); assert.equal(output.evidenceReady, false);
  }
});

test('defaults and trimmed search filters feed the canonical selection key', async () => {
  for (const id of ['mail.list_messages', 'mail.search_messages']) {
    const f = mailFixture(id); f.state.total = 1;
    const args = { subject: { kind: 'personal' }, ...(id.includes('search') ? { query: '  literal  ' } : {}) };
    const output = JSON.parse(await f.execute(args));
    assert.equal(output.selection.limit, id.includes('search') ? 20 : 15);
    assert.equal(output.selection.offset, 0); assert.equal(output.selection.asOf, null);
    assert.equal(f.state.normalizationCalls, 1);
  }
});

test('model context or malformed family input is refused before authority calls', async () => {
  for (const extra of [{ previousPage: {} }, { nowMs: NOW }, { actorId: 'foreign' }, { limit: '1' }, { offset: -1 }]) {
    const f = mailFixture();
    await assert.rejects(f.execute({ ...f.args, ...extra }), /INVALID_ARGUMENTS/);
    assert.deepEqual(f.calls, []);
  }
});

test('missing ports and missing retained offset fail before reservation and effects', async () => {
  for (const changes of [{ mailContextPorts: undefined }, {}]) {
    const f = mailFixture();
    await assert.rejects(f.execute({ ...f.args, offset: 1, asOf: f.anchor }, changes), /GATEWAY_CONFIGURATION|ACCESS_DENIED/);
    assert.equal(f.calls.includes('reserve'), false); assert.equal(f.calls.includes('handler'), false);
  }
});

test('mail port getters/proxies are rejected without running their hooks', async () => {
  let touched = 0;
  const getter = { retain() {} }; Object.defineProperty(getter, 'loadPrevious', { enumerable: true, get() { touched++; } });
  const proxy = new Proxy({}, { getPrototypeOf() { touched++; return Object.prototype; } });
  for (const mailContextPorts of [getter, proxy]) {
    const f = mailFixture(); await assert.rejects(f.execute(f.args, { mailContextPorts }), /GATEWAY_CONFIGURATION/);
    assert.equal(f.calls.includes('reserve'), false);
  }
  assert.equal(touched, 0);
});

const corruptRecords = [
  ['digest', r => { r.previousPage.messages[0].subjectText = 'tampered'; }],
  ['tenant', r => { r.key.binding.tenantId = 'foreign'; }],
  ['actor', r => { r.key.binding.actorId = 'foreign'; }],
  ['run', r => { r.key.binding.runId = uuid('f'); }],
  ['attempt', r => { r.key.binding.attemptId = uuid('f'); }],
  ['worker', r => { r.key.binding.workerId = uuid('f'); }],
  ['fence', r => { r.key.binding.writerFence++; }],
  ['policy', r => { r.key.policyRevision = 'foreign'; }],
  ['operation', r => { r.key.operation.id = 'mail.search_messages'; }],
  ['subject', r => { r.key.subject.entityIds = ['foreign']; }],
  ['limit', r => { r.key.selection.limit++; }],
  ['offset', r => { r.key.selection.offset++; }],
  ['anchor', r => { r.key.selection.asOf = new Date(NOW).toISOString(); }],
  ['future recording', r => { r.recordedAtMs = NOW+1; }],
  ['negative recording', r => { r.recordedAtMs = -1; }],
  ['expired', r => { r.expiresAtMs = NOW; }],
  ['extended', r => { r.expiresAtMs = NOW+limits.maxRequestMs+1; }],
  ['noninteger expiry', r => { r.expiresAtMs = NOW+0.5; }],
];
for (const [name, mutate] of corruptRecords) {
  test(`retained ${name} substitution cannot reserve or execute the next page`, async () => {
    const f = mailFixture(); await f.execute();
    const record = structuredClone([...f.records.values()][0]); mutate(record);
    f.contextPorts.loadPrevious = async () => JSON.stringify({ record, checkedAtMs: NOW });
    await assert.rejects(f.execute({ ...f.args, offset: 1, asOf: f.anchor }), /ACCESS_DENIED/);
    assert.equal(f.calls.filter(c => c === 'reserve').length, 1);
    assert.equal(f.calls.filter(c => c === 'handler').length, 1);
  });
}

test('correctly rehashed foreign page binding and wrong next selection still refuse', async () => {
  for (const mutate of [r => { r.previousPage.binding.writerFence++; }, r => { r.previousPage.nextOffset++; },
    r => { r.previousPage.selection.folder = 'sent'; }, r => { r.previousPage.subject.actorId = 'foreign'; }]) {
    const f = mailFixture(); await f.execute();
    const record = structuredClone([...f.records.values()][0]); mutate(record);
    record.previousSha256 = canonicalSha256(record.previousPage);
    f.contextPorts.loadPrevious = async () => JSON.stringify({ record, checkedAtMs: NOW });
    await assert.rejects(f.execute({ ...f.args, offset: 1, asOf: f.anchor }), /ACCESS_DENIED/);
    assert.equal(f.calls.filter(c => c === 'handler').length, 1);
  }
});

test('canonical deeper prior-page checks reject rehashed corrupt pagination and window', async () => {
  for (const mutate of [p => { p.coverage.truncated = false; }, p => { p.filterSha256 = '0'.repeat(64); },
    p => { p.window = { basis: 'explicit', timezone: 'UTC', startInclusive: '2026-01-01T00:00:00Z', endExclusive: '2026-01-02T00:00:00Z', weekStartsOn: null }; }]) {
    const f = mailFixture(); await f.execute();
    const record = structuredClone([...f.records.values()][0]); mutate(record.previousPage);
    record.previousSha256 = canonicalSha256(record.previousPage);
    f.contextPorts.loadPrevious = async () => JSON.stringify({ record, checkedAtMs: NOW });
    await assert.rejects(f.execute({ ...f.args, offset: 1, asOf: f.anchor }), /INVALID_RESULT/);
    assert.equal(f.calls.filter(c => c === 'settle').length, 1);
    assert.equal(f.calls.filter(c => c === 'uncertain').length, 1);
  }
});

test('stale/future receipt checks and oversized inbound records fail closed', async () => {
  for (const checkedAtMs of [NOW-1, NOW+1, 'now']) {
    const f = mailFixture(); await f.execute(); const record = [...f.records.values()][0];
    f.contextPorts.loadPrevious = async () => JSON.stringify({ record, checkedAtMs });
    await assert.rejects(f.execute({ ...f.args, offset: 1, asOf: f.anchor }), /ACCESS_DENIED/);
    assert.equal(f.calls.filter(c => c === 'handler').length, 1);
  }
  const f = mailFixture(); f.contextPorts.loadPrevious = async () => ' '.repeat(limits.maxResponseBytes+1);
  await assert.rejects(f.execute({ ...f.args, offset: 1, asOf: f.anchor }), /ACCESS_DENIED/);
  assert.equal(f.calls.includes('reserve'), false);
});

test('retention acknowledgements must bind actual immutable key/page and fresh time', async () => {
  for (const change of [r => { r.decision = 'unknown'; }, r => { r.keySha256 = '0'.repeat(64); },
    r => { r.previousSha256 = '0'.repeat(64); }, r => { r.checkedAtMs--; }, r => { r.checkedAtMs++; }]) {
    const f = mailFixture(), retain = f.contextPorts.retain;
    f.contextPorts.retain = async call => { const receipt = JSON.parse(await retain(call)); change(receipt); return JSON.stringify(receipt); };
    await assert.rejects(f.execute(), /ACCESS_DENIED/);
    assert.equal(f.calls.includes('settle'), false); assert.equal(f.calls.filter(c => c === 'uncertain').length, 1);
  }
});

test('retained key and page cannot be mutated by their storage port', async () => {
  const f = mailFixture(), retain = f.contextPorts.retain;
  f.contextPorts.retain = async call => {
    assert.throws(() => { call.record.key.selection.limit++; }, TypeError);
    assert.throws(() => { call.record.previousPage.messages[0].preview.text = 'replacement'; }, TypeError);
    return retain(call);
  };
  const page = JSON.parse(await f.execute()); assert.equal(page.messages[0].preview.text, 'Inert preview');
});

test('budget deadline publication caps the retained expiry, without a second timer owner', async () => {
  const f = mailFixture(); let limitDeadline;
  const authority = { ...f.authority, async check(call) { limitDeadline = call.limitDeadline; return f.authority.check(call); } };
  const reserve = f.budget.reserve;
  f.budget.reserve = async call => { limitDeadline(NOW+500); return reserve(call); };
  await f.execute(f.args, { authority });
  assert.equal([...f.records.values()][0].expiresAtMs, NOW+500);
});

test('a retained record exceeding a newly shorter request deadline cannot execute', async () => {
  const f = mailFixture(); await f.execute();
  await assert.rejects(f.execute({ ...f.args, offset: 1, asOf: f.anchor }, { limits: { ...limits, maxRequestMs: 500 } }), /ACCESS_DENIED/);
  assert.equal(f.calls.filter(c => c === 'handler').length, 1);
});

for (const port of ['loadPrevious', 'retain', 'settle']) {
  test(`mail ${port} parking is bounded and late completion starts no further work`, async () => {
    const f = mailFixture(), parked = Promise.withResolvers(); let receipt;
    if (port === 'loadPrevious') await f.execute();
    const holder = port === 'settle' ? f.budget : f.contextPorts, original = holder[port];
    holder[port] = async call => { receipt = await original(call); return parked.promise; };
    const input = port === 'loadPrevious' ? { ...f.args, offset: 1, asOf: f.anchor } : f.args;
    try {
      await assert.rejects(f.execute(input, { limits: { ...limits, maxRequestMs: 20 } }), /DEADLINE/);
      assert.equal(typeof receipt, 'string');
      const calls = [...f.calls]; parked.resolve(receipt); await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(f.calls, calls);
      assert.equal(f.calls.filter(c => c === 'uncertain').length, port === 'loadPrevious' ? 0 : 1);
    } finally { parked.resolve(receipt); }
  });
}

for (const port of ['retain', 'settle']) {
  test(`freshly shortened release deadline bounds parked ${port}`, async () => {
    const f = mailFixture(), parked = Promise.withResolvers(); let receipt, calls = 0, timer;
    const authority = { ...f.authority, async check(call) {
      const result = await f.authority.check(call);
      if (++calls === 4) { call.limitDeadline(NOW+20); return { ...result, deadlineMs: NOW+20 }; }
      return result;
    } };
    const holder = port === 'settle' ? f.budget : f.contextPorts, original = holder[port];
    holder[port] = async call => { receipt = await original(call); return parked.promise; };
    const controller = new AbortController(), outcome = f.execute(f.args, { authority }, controller.signal);
    try {
      await assert.rejects(Promise.race([outcome, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('short release deadline stayed pending after 100ms')), 100);
      })]), /^GatewayDenied: DEADLINE$/);
      assert.equal(typeof receipt, 'string'); assert.equal(f.calls.filter(c => c === 'uncertain').length, 1);
    } finally {
      clearTimeout(timer); controller.abort(); parked.resolve(receipt); await outcome.catch(() => {});
    }
  });
}

test('known preflight deadline is published before a prior-page read can park', async () => {
  const f = mailFixture(), parked = Promise.withResolvers(); let reads = 0, timer;
  f.contextPorts.loadPrevious = () => { reads++; return parked.promise; };
  const authority = { ...f.authority, async check(call) {
    const result = await f.authority.check(call); call.limitDeadline(NOW+20); return { ...result, deadlineMs: NOW+20 };
  } };
  const controller = new AbortController();
  const outcome = f.execute({ ...f.args, offset: 1, asOf: f.anchor }, { authority }, controller.signal);
  try {
    await assert.rejects(Promise.race([outcome, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('preflight deadline stayed pending after 100ms')), 100);
    })]), /^GatewayDenied: DEADLINE$/);
    assert.equal(reads, 1); assert.equal(f.calls.includes('reserve'), false);
  } finally { clearTimeout(timer); controller.abort(); parked.resolve('{}'); await outcome.catch(() => {}); }
});

test('cancellation during retained lookup stops before effects and ignores late history', async () => {
  const f = mailFixture(), controller = new AbortController(), parked = Promise.withResolvers(), entered = Promise.withResolvers();
  f.contextPorts.loadPrevious = () => { entered.resolve(); return parked.promise; };
  const outcome = f.execute({ ...f.args, offset: 1, asOf: f.anchor }, undefined, controller.signal);
  try {
    await entered.promise; controller.abort(); await assert.rejects(outcome, /CANCELLED/);
    parked.resolve('{}'); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.includes('reserve'), false); assert.equal(f.calls.includes('handler'), false);
  } finally { controller.abort(); parked.resolve('{}'); await outcome.catch(() => {}); }
});

test('revocation during retain prevents result release after historical settlement', async () => {
  const f = mailFixture(), retain = f.contextPorts.retain;
  f.contextPorts.retain = async call => { const receipt = await retain(call); f.state.revoked = true; return receipt; };
  await assert.rejects(f.execute(), /ACCESS_DENIED/);
  assert.equal(f.calls.includes('handler'), true); assert.equal(f.calls.includes('settle'), true);
});

test('malformed source results are never retained or settled and keep uncertain liability', async () => {
  const f = mailFixture(); f.state.changeOutput = output => { output.evidenceReady = true; };
  await assert.rejects(f.execute(), /INVALID_RESULT/);
  assert.equal(f.records.size, 0); assert.equal(f.calls.includes('settle'), false);
  assert.equal(f.calls.filter(c => c === 'uncertain').length, 1);
});

test('canonical entry keeps both mail operations unavailable with no authority or store effects', async () => {
  for (const id of ['mail.list_messages', 'mail.search_messages']) {
    const f = mailFixture(id), gateway = createSourceDisabledGateway({ authorityPorts: f.ports, budget: f.budget,
      limits, now: () => NOW, newId: () => uuid('7') });
    await assert.rejects(gateway.execute(f.request(f.args), 'synthetic-opaque'), /UNAVAILABLE/);
    assert.deepEqual(f.calls, []); assert.equal(f.records.size, 0);
  }
});
