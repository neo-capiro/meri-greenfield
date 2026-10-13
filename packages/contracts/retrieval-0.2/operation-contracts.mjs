// Private source-only contract resolution. This binds validators, never live
// handlers, grants, provider/source credentials or SDK tool availability.
import { types } from 'node:util';
const fail = message => { throw new Error(message); };
// Private admission ceilings, separate from each family's narrower shape rules.
const JSON_LIMITS = Object.freeze({nodes: 100000, depth: 64, bytes: 16 * 1024 * 1024});

function copyData(value) {
  return copyDataWithLimits(value, JSON_LIMITS);
}

function copyDataWithLimits(value, limits) {
  const active = new WeakSet(), pending = [{value, depth: 0}];
  let nodes = 0, scheduled = 1, bytes = 0;
  const addBytes = amount => {
    bytes += amount;
    if (bytes > limits.bytes) fail('Operation contract JSON byte limit');
  };
  const textBytes = value => {
    if (value.length > limits.bytes) fail('Operation contract JSON byte limit');
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  };
  while (pending.length) {
    const item = pending.pop();
    if (item.exit) { active.delete(item.value); continue; }
    const value = item.value;
    if (++nodes > limits.nodes || item.depth > limits.depth)
      fail('Operation contract JSON structure limit');
    if (value === null || ['string', 'boolean'].includes(typeof value) ||
        (typeof value === 'number' && Number.isFinite(value))) {
      addBytes(typeof value === 'string' ? textBytes(value) : Buffer.byteLength(JSON.stringify(value)));
      continue;
    }
    if (!value || typeof value !== 'object' || types.isProxy(value) || active.has(value))
      fail('Operation contract requires inert JSON data');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null)
      fail('Operation contract requires plain JSON data');
    const names = Reflect.ownKeys(value);
    if (names.length > limits.nodes) fail('Operation contract JSON structure limit');
    const fields = Object.getOwnPropertyDescriptors(value);
    if (names.some(name => typeof name !== 'string' || !Object.hasOwn(fields[name], 'value') ||
        (!fields[name].enumerable && !(array && name === 'length'))))
      fail('Operation contract accessor or hidden property');
    if (array && (names.length !== fields.length.value + 1 ||
        names.slice(0, -1).some((name, index) => name !== String(index)))) fail('Operation contract sparse array');
    scheduled += names.length - (array ? 1 : 0);
    if (scheduled > limits.nodes) fail('Operation contract JSON structure limit');
    addBytes(2);
    active.add(value); pending.push({value, exit: true});
    for (const name of names) if (!(array && name === 'length')) {
      addBytes(1 + (array ? 0 : textBytes(name) + 1));
      pending.push({value: fields[name].value, depth: item.depth + 1});
    }
  }
  return JSON.parse(JSON.stringify(value));
}

// Private domain validators may share this exact admission boundary when called
// outside the resolver. Keep one owner for inert JSON checks and resource limits.
export {copyData as snapshotOperationData};

// Fixed private catalog-preservation profile, never a caller-controlled override.
// Keep conservative walker accounting separate from the exact serialized ceiling.
const PRESERVATION_LIMITS = Object.freeze({...JSON_LIMITS, nodes: 250000});
export function snapshotPreservationData(value) {
  const snapshot = copyDataWithLimits(value, PRESERVATION_LIMITS);
  if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > 4 * 1024 * 1024)
    fail('Operation contract JSON byte limit');
  return freezeData(snapshot);
}

function freezeData(value) {
  const pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) continue;
    for (const value of Object.values(item)) pending.push(value);
    Object.freeze(item);
  }
  return value;
}

export function createOperationContracts({catalog, bindings, validators, assertCatalog, canonicalSha256}) {
  const snapshot = copyData(catalog); assertCatalog(snapshot); freezeData(snapshot);
  const descriptors = new Map(snapshot.operations.map(row => [`${row.operation.id}@${row.operation.version}`, row]));
  const registry = new Map(bindings.map(binding => [binding.id, binding]));
  function contextData(value, binding, output = false) {
    const context = copyData(value);
    const names = binding.contextKeys ?? ['nowMs', 'actorId', 'previousPage'];
    if (!context || Array.isArray(context) || typeof context !== 'object' ||
        Object.keys(context).some(name => ![...names, ...(output ? ['request'] : [])].includes(name)))
      fail('Unknown operation contract context');
    return context;
  }
  function resolveOperationContract(reference) {
    const ref = copyData(reference);
    if (!ref || typeof ref !== 'object' || Array.isArray(ref) || Object.keys(ref).sort().join(',') !== 'id,version')
      fail('Invalid operation contract reference');
    const binding = registry.get(ref.id), descriptor = descriptors.get(`${ref.id}@${ref.version}`);
    if (!binding || ref.version !== binding.version || !descriptor) fail('Unknown operation contract version');
    return Object.freeze({descriptor, binding,
      normalizeInput(argumentsData, context = {}) {
        const request = freezeData(copyData(argumentsData)), options = contextData(context, binding);
        const normalized = binding.normalize(validators, request, options, binding);
        const input = copyData(normalized.input), metadata = copyData(normalized.metadata ?? null);
        return freezeData({request, input, metadata, argumentsSha256: canonicalSha256(input)});
      },
      assertOutput(output, context) {
        const options = contextData(context, binding, true);
        if (!Object.hasOwn(options, 'request')) fail('Output validation requires the original request');
        const page = copyData(output);
        return binding.outputAssert(validators, page, options.request, options, binding);
      },
    });
  }
  return Object.freeze({resolveOperationContract});
}
