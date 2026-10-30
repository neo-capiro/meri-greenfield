/** Finite service entrypoint and readiness surface (browser-only, source/inert).
 *
 * Readiness consumes actual validated trusted owner objects. A caller-provided list of binding NAMES can never make the
 * service ready: each named dependency must be present as the owner object the composition validates. Missing
 * provisioning/LOGIN/TLS/activation values stay explicitly unavailable and effect-free.
 */
import {readBrowserHostServiceConfig} from './config.mjs';
import {assertBrowserOnlyServiceInputs, composeBrowserOnlyHostService, BROWSER_ONLY_REQUIRED_INPUTS} from './composition.mjs';

export const PRODUCTION_BINDINGS = Object.freeze([
  {name: 'host.allocate', owner: 'control host provisioner', detail: 'allocation hostMode:"browser-only", hostIdentity, cwd, lease deadline'},
  {name: 'authority.readCurrent', owner: 'control browser-host currentness (Runtime412)', detail: 'pinned policySha256/maxFreshMs currentness'},
  {name: 'browserPolicy', owner: 'control browser policy producer', detail: 'validated effective browser policy'},
  {name: 'browserNetwork', owner: 'native network owner', detail: 'browser-only namespace plan/proof/verify'},
  {name: 'browserEgress', owner: 'browser egress owner', detail: '{endpoint,grant,revoke,close}'},
  {name: 'controls', owner: 'canonical viewer-control binder', detail: 'controls.bind({binding,pages,controls})'},
  {name: 'current', owner: 'browser session currentness owner', detail: 'readBrowserCurrent({binding,signal})'},
  {name: 'siteWorkflows', owner: 'site workflow owner', detail: 'resolve() for workflow manifests'},
  {name: 'hold', owner: 'browser hold owner', detail: 'custody hold'},
  {name: 'dispose', owner: 'browser workspace owner', detail: 'disposeBrowserState(paths,{signal})'},
  {name: 'sessionProcesses', owner: 'browser process observer', detail: 'createBrowserProcessObserver waitForExit for session/run lifecycle'},
  {name: 'processes', owner: 'host-wide process observer', detail: 'createHostWideProcessObserver arm/waitForExit for physical teardown'},
  {name: 'host', owner: 'cloud host owner', detail: 'destroy()/observeAbsent() for instance, volume and ENI absence'},
  {name: 'readRun', owner: 'canonical run facts owner', detail: 'rereads facts; port.modelTransport="host-owned"'},
  {name: 'installation/upstream', owner: 'browser installation owner', detail: 'context-only installation and pinned upstream'},
  {name: 'nativeLaunch', owner: 'image/native owner', detail: 'helperPath plus distinct browser uid/gid'},
  {name: 'viewer.tlsMaterial', owner: 'release/provisioning', detail: 'mTLS server cert/key and control client CA bytes'},
  {name: 'browserActivation', owner: 'browser activation record owner', detail: 'hard-held activation record; source cannot open it'},
  {name: 'provisioning.loginCredentialReference', owner: 'provisioning decision (UNBOUND)', detail: 'LOGIN/protected credential reference; no guessed user, no embedded secret'},
]);

/** Map a refusal code to the concrete binding it proves missing (object-level, never a name assertion). */
const BINDING_FOR = Object.freeze({
  BROWSER_HOST_SERVICE_CONFIGURATION: 'required owner inputs',
  BROWSER_HOST_SERVICE_PLACEMENT_REFUSED: 'host.allocate',
  BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND: 'authority.readCurrent',
  BROWSER_HOST_SERVICE_CONTROLS_UNBOUND: 'controls',
  BROWSER_HOST_SERVICE_BROWSER_OBSERVER_UNBOUND: 'sessionProcesses',
  BROWSER_HOST_SERVICE_PROCESS_OBSERVER_UNBOUND: 'processes',
  BROWSER_HOST_SERVICE_EGRESS_UNBOUND: 'browserEgress',
  BROWSER_HOST_SERVICE_HOST_UNBOUND: 'host',
  BROWSER_HOST_SERVICE_READRUN_UNBOUND: 'readRun',
  BROWSER_HOST_SERVICE_VIEWER_UNBOUND: 'viewer.tlsMaterial',
  BROWSER_HOST_SERVICE_SDK_UNSUPPORTED: 'browser-only placement (SDK-shaped input refused)',
});

/**
 * Readiness from ACTUAL owner objects. `inputs` must be the concrete composition input (or null while provisioning is
 * unfinished). `boundNames` is intentionally not accepted.
 */
export function browserHostServiceReadiness({env = {}, inputs} = {}) {
  const config = readBrowserHostServiceConfig(env);
  const missing = [...config.missing];
  if (inputs === undefined || inputs === null) missing.push('owner inputs');
  else {
    for (const name of BROWSER_ONLY_REQUIRED_INPUTS) {
      if (inputs[name] === undefined || inputs[name] === null) missing.push(name);
    }
    if (!missing.some(name => BROWSER_ONLY_REQUIRED_INPUTS.includes(name))) {
      try { assertBrowserOnlyServiceInputs(inputs); }
      catch (error) { missing.push(BINDING_FOR[error?.code] ?? error?.code ?? 'owner inputs'); }
    }
  }
  return Object.freeze({ready: missing.length === 0 && config.invalid.length === 0, missing, invalid: config.invalid, bindings: PRODUCTION_BINDINGS});
}

/**
 * Finite start/stop entrypoint: consumes the concrete trusted objects and returns the composed service handles.
 * Construction is inert; `start()` is the caller's decision and is not performed here.
 */
export function createBrowserHostServiceEntrypoint({inputs, dependencies = {}} = {}) {
  const readiness = browserHostServiceReadiness({env: {}, inputs});
  if (!readiness.ready && inputs === undefined) {
    // No owner objects at all: refuse before composing anything.
    return Object.freeze({ready: false, missing: readiness.missing, start: async () => { throw Object.assign(new Error('BROWSER_HOST_SERVICE_CONFIGURATION'), {code: 'BROWSER_HOST_SERVICE_CONFIGURATION'}); }, stop: async () => { throw Object.assign(new Error('BROWSER_HOST_SERVICE_CONFIGURATION'), {code: 'BROWSER_HOST_SERVICE_CONFIGURATION'}); }});
  }
  const service = composeBrowserOnlyHostService(inputs, dependencies);
  return Object.freeze({ready: true, missing: [], service, start: () => service.start(), stop: options => service.destroy(options)});
}

/** Refusal printer. Never starts the service. */
export function main({env = process.env, inputs} = {}) {
  const readiness = browserHostServiceReadiness({env, inputs});
  process.stdout.write(JSON.stringify({event: 'browser-host-service.readiness', placement: 'browser-only', ...readiness}) + '\n');
  return readiness.ready ? 0 : 3;
}
