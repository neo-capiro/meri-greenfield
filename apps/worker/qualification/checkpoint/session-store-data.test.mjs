import test from 'node:test';
import assert from 'node:assert/strict';
import { copySessionJson, measureSessionJson } from './session-store-data.mjs';
import { copySessionEntries, measureSessionEntry } from './bound-session-store.mjs';

const limit = 8 * 1024 * 1024;

test('entry measurement preserves exact opaque JSON bytes and leaves copying detached', () => {
  const shared = { value: 'λ 🦋\n\u0000"\\', numbers: [0, 1e-7, 1e21] };
  for (const entry of [{ type: 'system' }, { type: '', unknown: [shared, shared] },
    JSON.parse('{"type":"system","__proto__":{"opaque":true},"9":9,"2":2}')]) {
    const copy = copySessionEntries([entry]);
    assert.deepEqual(copy, [entry]);
    assert.notEqual(copy[0], entry);
    assert.equal(measureSessionEntry(entry), Buffer.byteLength(JSON.stringify(entry)));
    assert.equal(measureSessionJson([entry], limit), Buffer.byteLength(JSON.stringify(copy)));
  }
  const entry = { type: 'system', unknown: { value: 'retained' } };
  const [copy] = copySessionEntries([entry]);
  copy.unknown.value = 'changed';
  assert.equal(entry.unknown.value, 'retained');
});

test('measurement retains every inert-value refusal without executing hooks', () => {
  let executed = 0;
  const hook = () => { executed++; throw Error('must not execute'); };
  const accessor = { type: 'system' };
  Object.defineProperty(accessor, 'opaque', { enumerable: true, get: hook });
  const hidden = { type: 'system' };
  Object.defineProperty(hidden, 'opaque', { value: 1 });
  const symbol = { type: 'system', [Symbol('opaque')]: 1 };
  const sparse = Array(1), extra = []; extra.opaque = 1;
  const cycle = { type: 'system' }; cycle.self = cycle;
  const proxy = new Proxy({ type: 'system' }, { get: hook, ownKeys: hook,
    getOwnPropertyDescriptor: hook, getPrototypeOf: hook });
  const custom = Object.assign(Object.create({ opaque: 1 }), { type: 'system' });
  const nullPrototype = Object.assign(Object.create(null), { type: 'system' });
  const unsafe = [accessor, hidden, symbol, cycle, proxy, custom, nullPrototype,
    { type: 'system', toJSON: hook }, { type: 'system', nested: accessor },
    ...[undefined, NaN, Infinity, -Infinity, -0, 1n, Symbol('opaque'), hook,
      new Date(), sparse, extra].map(opaque => ({ type: 'system', opaque }))];
  for (const entry of unsafe) {
    assert.throws(() => copySessionEntries([entry]), { code: 'SESSION_NOT_JSON_SAFE' });
    assert.throws(() => measureSessionEntry(entry), { code: 'SESSION_NOT_JSON_SAFE' });
  }
  for (const entry of [null, false, 0, '', [], {}, { type: 1 }]) {
    assert.throws(() => copySessionEntries([entry]), { code: 'SESSION_ENTRY_SHAPE' });
    assert.throws(() => measureSessionEntry(entry), { code: 'SESSION_ENTRY_SHAPE' });
  }
  assert.equal(executed, 0);
});

test('entry measurement retains the exact singleton-array byte bound', () => {
  const entry = { type: 'system', text: '' };
  entry.text = 'x'.repeat(limit - Buffer.byteLength(JSON.stringify([entry])));
  assert.equal(Buffer.byteLength(JSON.stringify([entry])), limit);
  assert.equal(measureSessionEntry(entry), limit - 2);
  assert.deepEqual(copySessionEntries([entry]), [entry]);
  entry.text += 'x';
  assert.throws(() => copySessionEntries([entry]), { code: 'SESSION_PAYLOAD_BOUND' });
  assert.throws(() => measureSessionEntry(entry), { code: 'SESSION_PAYLOAD_BOUND' });
  for (const bound of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => copySessionJson(null, bound), { code: 'SESSION_PAYLOAD_BOUND' });
    assert.throws(() => measureSessionJson(null, bound), { code: 'SESSION_PAYLOAD_BOUND' });
  }
  assert.equal(measureSessionJson('λ🦋', 8), 8);
  assert.throws(() => measureSessionJson('λ🦋', 7), { code: 'SESSION_PAYLOAD_BOUND' });
});

test('measurement retains iterative deep traversal without serialization hooks', () => {
  const entry = { type: 'system' }; let node = entry;
  for (let i = 0; i < 20000; i++) node = node.child = {};
  const bytes = measureSessionEntry(entry);
  assert.equal(bytes, 18 + 10 * 20000);
  assert.equal(measureSessionJson([entry], bytes + 2), bytes + 2);
  assert.throws(() => measureSessionJson([entry], bytes + 1), { code: 'SESSION_PAYLOAD_BOUND' });
  let copy = copySessionEntries([entry])[0], depth = 0;
  while (copy.child) { copy = copy.child; depth++; }
  assert.equal(depth, 20000);
});
