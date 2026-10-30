/** Inert production-readiness surface for the browser host service.
 *
 * This module never starts a browser, SDK query, provider call or host. It states, by name, which production bindings
 * are still unbound so that a caller cannot present a partial composition as a working service.
 */
import {readBrowserHostServiceConfig} from './config.mjs';

/** Every binding this service needs before it could serve a real run. Ownership is not this directory's. */
export const PRODUCTION_BINDINGS = Object.freeze([
  {name: 'runnerQuery', owner: 'shared SDK runner integration owner', detail: 'createPreparedRunnerQuery consuming the one-use processClientFactory'},
  {name: 'capabilityPolicy.forRun', owner: 'control capability policy producer', detail: 'effective per-run policy; no default or privileged fallback'},
  {name: 'readBrowserPolicy', owner: 'control browser policy producer', detail: 'per-run browser policy with actor role'},
  {name: 'currentness.storeClient', owner: 'control browser-host currentness owner', detail: 'Runtime412 store/DB client for readHost/readRoute'},
  {name: 'host.allocate', owner: 'control host provisioner', detail: 'allocation, hostIdentity and lease deadline'},
  {name: 'browserActivation', owner: 'browser activation record owner', detail: 'hard-held activation record; source cannot open it'},
  {name: 'viewer.tlsMaterial', owner: 'release/provisioning', detail: 'mTLS server cert, key and client CA bytes'},
  {name: 'provisioning.loginCredentialReference', owner: 'provisioning decision (UNBOUND)', detail: 'LOGIN/protected credential reference; no guessed user, no embedded secret'},
]);

/**
 * @returns {{ready:false|true, missing:string[], invalid:string[], bindings:object[]}}
 * Ready only when configuration parses AND no production binding is outstanding.
 */
export function browserHostServiceReadiness({env = {}, bound = []} = {}) {
  const config = readBrowserHostServiceConfig(env);
  const supplied = new Set(Array.isArray(bound) ? bound : []);
  const missingBindings = PRODUCTION_BINDINGS.map(binding => binding.name).filter(name => !supplied.has(name));
  const missing = [...config.missing, ...missingBindings];
  return Object.freeze({
    ready: missing.length === 0 && config.invalid.length === 0,
    missing,
    invalid: config.invalid,
    bindings: PRODUCTION_BINDINGS,
  });
}

/** Entrypoint: refuse with a precise result. Never mutates anything. */
export function main({env = process.env, bound = []} = {}) {
  const readiness = browserHostServiceReadiness({env, bound});
  process.stdout.write(JSON.stringify({event: 'browser-host-service.readiness', ...readiness}) + '\n');
  return readiness.ready ? 0 : 3;
}
