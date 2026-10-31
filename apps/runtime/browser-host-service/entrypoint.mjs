/** Finite service entrypoint and readiness surface (browser-only, source/inert).
 *
 * Readiness validates the ACTUAL owner objects with the composition's own canonical validators (placement/binding/host
 * identity, policy, context installation, workspace ownership, policy/currentness/deadline, real viewer TLS bytes).
 * A caller-provided list of names is not accepted at all, and accepting an object is never the same as validating it.
 */
import {readBrowserHostServiceConfig} from './config.mjs';
import {assertBrowserOnlyServiceInputs, composeBrowserOnlyHostService, BROWSER_ONLY_REQUIRED_INPUTS} from './composition.mjs';
import {createBrowserOnlyReadRun} from './read-run.mjs';

export const PRODUCTION_BINDINGS = Object.freeze([
  {name: 'host.allocate', owner: 'control host provisioner', detail: 'allocation hostMode:"browser-only", hostIdentity, cwd, lease deadline'},
  {name: 'authority.readCurrent', owner: 'control browser-host currentness (Runtime412)', detail: 'pinned policySha256/maxFreshMs currentness'},
  {name: 'browserClient.currentness', owner: 'control browser-purpose currentness client', detail: 'readCurrent for admitted workspace preparation'},
  {name: 'browserPolicy', owner: 'control browser policy producer', detail: 'validated effective browser policy'},
  {name: 'browserNetwork', owner: 'native network owner', detail: 'browser-only namespace plan/proof/verify'},
  {name: 'browserEgress', owner: 'browser egress owner', detail: '{endpoint,grant,revoke,close}'},
  {name: 'controls', owner: 'canonical viewer-control binder', detail: 'controls.bind({binding,pages,controls})'},
  {name: 'current', owner: 'browser session currentness owner', detail: 'readBrowserCurrent({binding,signal})'},
  {name: 'siteWorkflows', owner: 'site workflow owner', detail: 'resolve() for workflow manifests'},
  {name: 'hold', owner: 'browser hold owner', detail: 'custody hold'},
  {name: 'dispose', owner: 'browser workspace owner', detail: 'disposeBrowserState(paths,{signal})'},
  {name: 'workspaceOwnership', owner: 'image/workspace provisioning', detail: 'trusted sdk/browser filesystem ownership and readback IDs'},
  {name: 'sessionProcesses', owner: 'browser process observer', detail: 'createBrowserProcessObserver arm/waitForExit for session/run lifecycle'},
  {name: 'processes', owner: 'host-wide process observer', detail: 'createHostWideProcessObserver arm/waitForExit for physical teardown'},
  {name: 'host', owner: 'cloud host owner', detail: 'destroy()/observeAbsent() for instance, volume and ENI absence'},
  {name: 'readRun', owner: 'canonical run facts owner', detail: 'rereads facts; port.modelTransport="host-owned" (Parent contract still unbound)'},
  {name: 'installation/upstream', owner: 'browser installation owner', detail: 'context-only installation and pinned upstream'},
  {name: 'nativeLaunch', owner: 'image/native owner', detail: 'helperPath plus distinct browser uid/gid'},
  {name: 'viewer.tlsMaterial', owner: 'release/provisioning', detail: 'mTLS server cert/key and control client CA bytes'},
  {name: 'browserActivation', owner: 'browser activation record owner', detail: 'hard-held activation record; source cannot open it'},
  {name: 'provisioning.loginCredentialReference', owner: 'provisioning decision (UNBOUND)', detail: 'LOGIN/protected credential reference; no guessed user, no embedded secret'},
]);

const BINDING_FOR = Object.freeze({
  BROWSER_HOST_SERVICE_PLACEMENT_REFUSED: 'host.allocate',
  BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND: 'authority.readCurrent',
  BROWSER_HOST_SERVICE_CONTROLS_UNBOUND: 'controls',
  BROWSER_HOST_SERVICE_BROWSER_OBSERVER_UNBOUND: 'sessionProcesses',
  BROWSER_HOST_SERVICE_PROCESS_OBSERVER_UNBOUND: 'processes',
  BROWSER_HOST_SERVICE_EGRESS_UNBOUND: 'browserEgress',
  BROWSER_HOST_SERVICE_HOST_UNBOUND: 'host',
  BROWSER_HOST_SERVICE_READRUN_UNBOUND: 'readRun',
  BROWSER_HOST_SERVICE_VIEWER_UNBOUND: 'viewer.tlsMaterial',
  BROWSER_HOST_SERVICE_WORKSPACE_UNBOUND: 'workspaceOwnership',
  BROWSER_HOST_SERVICE_INSTALLATION_UNBOUND: 'installation/upstream',
  BROWSER_HOST_SERVICE_POLICY_REFUSED: 'browserPolicy',
  BROWSER_HOST_SERVICE_SDK_UNSUPPORTED: 'browser-only placement (SDK-shaped input refused)',
});

/** Readiness from ACTUAL validated owner objects. */
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
      catch (error) {
        const key = BINDING_FOR[error?.code] ?? error?.code ?? 'owner inputs';
        // Canonical validator refusals (HOST_*/BROWSER_* from binding/policy/server/tls) name the input category they refused.
        missing.push(key === 'owner inputs' && error?.code ? error.code : key);
      }
    }
  }
  return Object.freeze({ready: missing.length === 0 && config.invalid.length === 0, missing, invalid: config.invalid, bindings: PRODUCTION_BINDINGS});
}

/** Finite start/stop entrypoint: composes validated concrete objects and starts nothing. */
export function createBrowserHostServiceEntrypoint({inputs, dependencies = {}, env = {}} = {}) {
  // The browser-only service CONSTRUCTS its own canonical readRun from the authenticated currentness client and
  // the already-validated placement; a caller may still pass an explicit one. A client without the closed ingest
  // method yields no readRun, and readiness then names it instead of mounting a partial service.
  let complete = inputs;
  if (inputs && inputs.readRun === undefined && inputs.browserClient !== undefined) {
    try { complete = {...inputs, readRun: createBrowserOnlyReadRun(inputs).readRun}; } catch { complete = inputs; }
  }
  const readiness = browserHostServiceReadiness({env, inputs: complete});
  if (!readiness.ready) {
    const refuse = async () => { throw Object.assign(new Error('BROWSER_HOST_SERVICE_CONFIGURATION'), {code: 'BROWSER_HOST_SERVICE_CONFIGURATION'}); };
    return Object.freeze({ready: false, missing: readiness.missing, start: refuse, stop: refuse});
  }
  const service = composeBrowserOnlyHostService(complete, dependencies);
  return Object.freeze({ready: true, missing: [], service, start: () => service.start(), stop: options => service.destroy(options)});
}

/** Refusal printer. Never starts the service. */
export function main({env = process.env, inputs} = {}) {
  const readiness = browserHostServiceReadiness({env, inputs});
  process.stdout.write(JSON.stringify({event: 'browser-host-service.readiness', placement: 'browser-only', ...readiness}) + '\n');
  return readiness.ready ? 0 : 3;
}
