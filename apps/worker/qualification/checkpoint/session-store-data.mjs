// Inert SessionStore data admission. Caller getters, proxies and toJSON methods
// are never executed. Trusted executable dependencies are captured separately.
import { types } from 'node:util';

const fail = code => { throw Object.assign(new Error(code), { code }); };

function descriptors(value, array, code) {
  if (!value || typeof value !== 'object' || types.isProxy(value) ||
      Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) fail(code);
  const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
  if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(fields[key], 'value') ||
      (!fields[key].enumerable && !(array && key === 'length')))) fail(code);
  if (array) {
    const count = fields.length.value;
    if (keys.length !== count + 1 || keys.slice(0, -1).some((key, index) => key !== String(index)) ||
        keys.at(-1) !== 'length') fail(code);
  }
  return fields;
}

export function sessionDataRecord(value, { allowed, required = [], code }) {
  const fields = descriptors(value, false, code), keys = Object.keys(fields);
  if ((allowed && keys.some(key => !allowed.includes(key))) ||
      required.some(key => !Object.hasOwn(fields, key))) fail(code);
  const result = Object.create(null);
  for (const key of keys) Object.defineProperty(result, key, { value: fields[key].value, enumerable: true });
  return Object.freeze(result);
}

// Iterative JSON encoding retains supported opaque JSON without a recursion
// limit or invoking caller serialization hooks. Bounds apply to exact bytes.
export function copySessionJson(value, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) fail('SESSION_PAYLOAD_BOUND');
  const parts = [], active = new WeakSet(), stack = [{ kind: 'value', value }];
  let bytes = 0;
  function emit(fragment) {
    bytes += Buffer.byteLength(fragment);
    if (bytes > maxBytes) fail('SESSION_PAYLOAD_BOUND');
    parts.push(fragment);
  }
  while (stack.length) {
    const frame = stack.pop();
    if (frame.kind === 'container') {
      if (frame.index === frame.keys.length) {
        emit(frame.array ? ']' : '}'); active.delete(frame.value); continue;
      }
      if (frame.index) emit(',');
      const key = frame.keys[frame.index++];
      if (!frame.array) emit(JSON.stringify(key) + ':');
      stack.push(frame, { kind: 'value', value: frame.fields[key].value });
      continue;
    }
    const item = frame.value;
    if (item === null || typeof item === 'string' || typeof item === 'boolean' ||
        (typeof item === 'number' && Number.isFinite(item) && !Object.is(item, -0))) {
      emit(JSON.stringify(item)); continue;
    }
    if (!item || typeof item !== 'object' || types.isProxy(item) || active.has(item))
      fail('SESSION_NOT_JSON_SAFE');
    const array = Array.isArray(item), fields = descriptors(item, array, 'SESSION_NOT_JSON_SAFE');
    const keys = Object.keys(fields).filter(key => !array || key !== 'length');
    // Even empty values need at least one byte plus a separator; refuse before
    // building an oversized serialized copy of a very large container.
    if (keys.length + bytes > maxBytes) fail('SESSION_PAYLOAD_BOUND');
    active.add(item); emit(array ? '[' : '{');
    stack.push({ kind: 'container', value: item, array, fields, keys, index: 0 });
  }
  return JSON.parse(parts.join(''));
}

// Executable dependencies may be class instances (including the SDK reference
// store). Inspect only required method descriptors and retain their receiver.
export function captureSessionMethods(value, names, code) {
  if (!value || !['object', 'function'].includes(typeof value) || types.isProxy(value)) fail(code);
  const result = Object.create(null);
  for (const name of names) {
    let cursor = value, field;
    while (cursor && cursor !== Object.prototype && !field) {
      if (types.isProxy(cursor)) fail(code);
      field = Object.getOwnPropertyDescriptor(cursor, name);
      cursor = Object.getPrototypeOf(cursor);
    }
    if (!field || !Object.hasOwn(field, 'value') || typeof field.value !== 'function' ||
        types.isProxy(field.value)) fail(code);
    const method = field.value;
    result[name] = argument => Reflect.apply(method, value, [argument]);
  }
  return Object.freeze(result);
}

export function confirmedSessionWriteRejection(error) {
  if (!error || typeof error !== 'object' || types.isProxy(error)) return false;
  const code = Object.getOwnPropertyDescriptor(error, 'code');
  return !!code && Object.hasOwn(code, 'value') && code.value === 'SESSION_WRITE_REJECTED';
}
