// Thin, explicit, offline-inspectable Claude Agent SDK options builder for the
// synthetic Meri qualification worker. Building options performs NO model call.
//
// Adopted SDK: @anthropic-ai/claude-agent-sdk 0.3.295 (bundled CLI 2.1.295).
// The exported option fields below are asserted against the published
// sdk.d.ts in probes/static.test.mjs rather than assumed.
//
// Session persistence reference: the SDK's own InMemorySessionStore is used as
// an OFFLINE ADAPTER REFERENCE ONLY. It does not establish durability, remote
// append retries, mirror_error handling, broker durability, process resume or
// workspace restoration. No replacement storage SDK or broker is written here.

import { InMemorySessionStore } from '@anthropic-ai/claude-agent-sdk';

export { InMemorySessionStore };

/** Fixed coordinates the image recipe and probes share. */
export const QUALIFICATION = Object.freeze({
  sdkVersion: '0.3.295',
  bundledCliVersion: '2.1.295',
  // Stable synthetic SDK cwd inside the mounted writable workspace volume.
  cwd: '/workspace/conversation',
  claudeConfigDir: '/workspace/config',
  playwrightBrowsersPath: '/opt/meri-browsers',
});

// Overrides are deliberately narrow. Anything that would re-enable runtime
// discovery (settings/skills/settingSources), move the stable cwd, or turn on
// automatic memory is rejected outright.
const ALLOWED_OVERRIDES = new Set(['sessionStore', 'sessionStoreFlush', 'persistSession', 'enableFileCheckpointing']);

/**
 * Build the supported, explicit qualification SDK options.
 *
 * settingSources: [] and skills: [] make runtime discovery inert for this
 * synthetic qualification; settings.autoMemoryEnabled:false disables the
 * automatic filesystem memory that must stay off for governed deployments.
 */
export function buildQualificationOptions(overrides = {}) {
  for (const key of Object.keys(overrides)) {
    if (!ALLOWED_OVERRIDES.has(key)) {
      throw new Error(`rejected qualification option override: ${key}`);
    }
  }
  const options = {
    cwd: QUALIFICATION.cwd,
    settingSources: [],
    settings: { autoMemoryEnabled: false },
    skills: [],
    ...overrides,
  };
  assertInertOptions(options);
  assertSupportedCombination(options);
  return options;
}

/**
 * Reject any option set that would re-enable runtime discovery or move the
 * stable cwd. Applied to the final merged options, so it also guards a caller
 * that supplies its own object.
 */
export function assertInertOptions(options) {
  if (options.cwd !== QUALIFICATION.cwd) {
    throw new Error(`stable cwd required (${QUALIFICATION.cwd})`);
  }
  if (!Array.isArray(options.settingSources) || options.settingSources.length !== 0) {
    throw new Error('settingSources must be an empty array for this synthetic qualification');
  }
  if (!options.settings || typeof options.settings !== 'object' || options.settings.autoMemoryEnabled !== false) {
    throw new Error('settings.autoMemoryEnabled must be exactly false');
  }
  if (!Array.isArray(options.skills) || options.skills.length !== 0) {
    throw new Error('skills must be an empty array for this synthetic qualification');
  }
  return true;
}

/**
 * Fail closed on the two SessionStore combinations the pinned SDK documents as
 * invalid: sessionStore with persistSession:false, and sessionStore with
 * enableFileCheckpointing:true.
 */
export function assertSupportedCombination(options) {
  if (options.sessionStore && options.persistSession === false) {
    throw new Error('sessionStore cannot be combined with persistSession:false');
  }
  if (options.sessionStore && options.enableFileCheckpointing === true) {
    throw new Error('sessionStore cannot be combined with enableFileCheckpointing:true');
  }
  return true;
}

/** A fresh in-memory reference store. Offline reference only. */
export function createReferenceStore() {
  return new InMemorySessionStore();
}

/** Deterministic deep serialization with sorted object keys. */
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

/**
 * Offline reference restore check. Requires FULL ordered opaque-entry equality
 * against the expected state: same length, and every entry deep-equal in order.
 * A missing session, a changed unknown field, a dropped duplicate or a missing
 * UUID-less entry all fail closed rather than reporting a false "restored".
 */
export async function verifyRestore(store, key, expectedEntries) {
  const loaded = await store.load(key);
  if (loaded === null) {
    throw new Error(`restore verification failed: no session state for ${JSON.stringify(key)}`);
  }
  if (!Array.isArray(expectedEntries)) {
    throw new Error('restore verification failed: expected entries must be an array');
  }
  if (loaded.length !== expectedEntries.length) {
    throw new Error(`restore verification failed: entry count ${loaded.length} != expected ${expectedEntries.length}`);
  }
  for (let i = 0; i < expectedEntries.length; i += 1) {
    if (canonical(loaded[i]) !== canonical(expectedEntries[i])) {
      throw new Error(`restore verification failed: entry ${i} does not match expected opaque bytes`);
    }
  }
  return loaded;
}
