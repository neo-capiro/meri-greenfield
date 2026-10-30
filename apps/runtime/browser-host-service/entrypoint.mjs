/** Inert readiness surface for the browser-only host service.
 *
 * It starts nothing. It names, by owner, every trusted production binding the service still needs and refuses before
 * any effect. A caller-declared string list is not proof that a binding exists; every entry is either supplied as a
 * real owner object to composeBrowserOnlyHostService or reported here.
 */
import {readBrowserHostServiceConfig} from './config.mjs';

export const PRODUCTION_BINDINGS = Object.freeze([
  {name: 'host.allocate', owner: 'control host provisioner', detail: 'allocation with hostMode:"browser-only", hostIdentity, cwd and lease deadline'},
  {name: 'authority.readCurrent', owner: 'control browser-host currentness (Runtime412)', detail: 'pinned policySha256/maxFreshMs currentness reader'},
  {name: 'browserPolicy', owner: 'control browser policy producer', detail: 'validated effective browser policy for this run'},
  {name: 'browserNetwork', owner: 'native network owner', detail: 'browser-only namespace plan, proof and verify()'},
  {name: 'browserEgress', owner: 'browser egress owner', detail: '{endpoint,grant,revoke,close}; required by teardown revoke/close'},
  {name: 'controls', owner: 'canonical viewer-control binder', detail: 'controls.bind({binding,pages,controls})'},
  {name: 'current', owner: 'browser session currentness owner', detail: 'readBrowserCurrent({binding,signal})'},
  {name: 'siteWorkflows', owner: 'site workflow owner', detail: 'resolve() for workflow manifests'},
  {name: 'hold', owner: 'browser hold owner', detail: 'custody hold used by the session owner'},
  {name: 'dispose', owner: 'browser workspace owner', detail: 'disposeBrowserState(paths,{signal})'},
  {name: 'processes', owner: 'host-wide process observer', detail: 'createHostWideProcessObserver arm/waitForExit; native cgroup ports and verifyConfinement'},
  {name: 'host', owner: 'cloud host owner', detail: 'destroy()/observeAbsent() for instance, root volume and ENI absence'},
  {name: 'readRun', owner: 'canonical run facts owner', detail: 'rereads {binding,cwd,deadlineMs,port} with port.modelTransport="host-owned"'},
  {name: 'installation/upstream', owner: 'browser installation owner', detail: 'context-only installation and pinned browser upstream'},
  {name: 'nativeLaunch', owner: 'image/native owner', detail: 'helperPath plus distinct browser uid/gid'},
  {name: 'viewer.tlsMaterial', owner: 'release/provisioning', detail: 'mTLS server cert/key and control client CA bytes'},
  {name: 'browserActivation', owner: 'browser activation record owner', detail: 'hard-held activation record; source cannot open it'},
  {name: 'provisioning.loginCredentialReference', owner: 'provisioning decision (UNBOUND)', detail: 'LOGIN/protected credential reference; no guessed user, no embedded secret'},
]);

/** Ready only when the service configuration parses AND every production binding is supplied. */
export function browserHostServiceReadiness({env = {}, bound = []} = {}) {
  const config = readBrowserHostServiceConfig(env);
  const supplied = new Set(Array.isArray(bound) ? bound : []);
  const missingBindings = PRODUCTION_BINDINGS.map(binding => binding.name).filter(name => !supplied.has(name));
  const missing = [...config.missing, ...missingBindings];
  return Object.freeze({ready: missing.length === 0 && config.invalid.length === 0, missing, invalid: config.invalid, bindings: PRODUCTION_BINDINGS});
}

/** Entrypoint: refuse with a precise result. Never mutates anything. */
export function main({env = process.env, bound = []} = {}) {
  const readiness = browserHostServiceReadiness({env, bound});
  process.stdout.write(JSON.stringify({event: 'browser-host-service.readiness', placement: 'browser-only', ...readiness}) + '\n');
  return readiness.ready ? 0 : 3;
}
