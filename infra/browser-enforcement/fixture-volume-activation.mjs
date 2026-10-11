// Qualification DATA identity only. No deployment, authority, clock or IO.
import { createHash } from 'node:crypto';
import { FIXTURE as F, fixtureTags, fixtureMachineName, fixtureExecutionName, validateFixtureBinding } from './fixture-volume-binding.mjs';

export const FIXTURE_BOOTSTRAP_PROFILE = 'MANAGED_WIRE_BOOTSTRAP_V1';
const ownData = (v, keys) => v && Object.getPrototypeOf(v) === Object.prototype &&
  Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k) &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(v, k), 'value'));
const refuse = () => { throw new Error('Exact fixed bootstrap descriptor DATA required; no authority or overrides'); };
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };

// Version1 finite serialization: these source-defined keys and nested order,
// JSON.stringify UTF8, no spaces/newline. Not RFC8785. No self/final hashes.
function descriptorBody(window) {
  if (!ownData(window, ['t0Ms', 'createNotAfterMs'])) refuse();
  const b = validateFixtureBinding({ ...window, ownerBindingId: '0'.repeat(64) });
  return {
    schema: 'meri-browser-fixture-bootstrap-descriptor/1', profile: FIXTURE_BOOTSTRAP_PROFILE,
    environment: { account: F.account, region: F.region, runUuid: F.runUuid, subnet: F.subnet,
      vpc: F.vpc, availabilityZone: F.az, keyArn: F.keyArn },
    names: { machine: fixtureMachineName(), execution: fixtureExecutionName() },
    resource: { sizeGiB: 1, volumeType: 'gp3', encrypted: true, attachments: 'NEVER_ATTACH', tags: fixtureTags() },
    clock: { t0Ms: b.t0Ms, createNotAfterMs: b.createNotAfterMs, C: b.C },
    limits: { ceilingMs: F.ceilingMs, createWindowMs: F.createWindowMs, maxPages: F.maxPages,
      pageSize: F.pageSize, maxRows: F.maxRows, maxCalls: F.maxCalls, maxPolls: F.maxPolls,
      maxResultChars: F.maxResultChars, maxTokenChars: F.maxTokenChars },
    wireProfile: F.wireProfile,
  };
}

export function createFixtureBootstrapDescriptor(window) {
  const body = descriptorBody(window);
  const ownerBindingId = createHash('sha256').update(JSON.stringify(body), 'utf8').digest('hex');
  return freeze({ ...body, ownerBindingId });
}

// Compare own data descriptors before reading a field; getters/symbols, array
// holes/extra keys, foreign prototypes and nonfinite substitutions all refuse.
function sameDescriptorData(value, expected) {
  if (!expected || typeof expected !== 'object') return Object.is(value, expected);
  if (Array.isArray(expected)) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
        Reflect.ownKeys(value).length !== expected.length + 1 || value.length !== expected.length) return false;
    return expected.every((v, i) => Object.hasOwn(value, i) &&
      Object.hasOwn(Object.getOwnPropertyDescriptor(value, String(i)), 'value') && sameDescriptorData(value[i], v));
  }
  const keys = Object.keys(expected);
  return ownData(value, keys) && keys.every(k => sameDescriptorData(value[k], expected[k]));
}

export function validateFixtureBootstrapDescriptor(value) {
  const keys = ['schema', 'profile', 'environment', 'names', 'resource', 'clock', 'limits', 'wireProfile', 'ownerBindingId'];
  if (!ownData(value, keys) || !ownData(value.clock, ['t0Ms', 'createNotAfterMs', 'C'])) refuse();
  const expected = createFixtureBootstrapDescriptor({ t0Ms: value.clock.t0Ms, createNotAfterMs: value.clock.createNotAfterMs });
  if (!sameDescriptorData(value, expected)) refuse();
  return expected; // detached, fixed-order and deeply frozen; not owner permission
}

export function fixtureBootstrapInput(value) {
  const d = validateFixtureBootstrapDescriptor(value);
  return Object.freeze({ profile: FIXTURE_BOOTSTRAP_PROFILE, runUuid: F.runUuid, t0Ms: d.clock.t0Ms,
    createNotAfterMs: d.clock.createNotAfterMs, ownerBindingId: d.ownerBindingId });
}
