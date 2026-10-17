/** S4 live revocation by withdrawal generations (design section 1.1 S4; owner answer Q-X7 accepted 15 October 2026: 30 s
 * propagation target and 30 s fail-closed staleness bound, measured end to end) for all four post-shipment features.
 *
 * PREPARATION ONLY: the pure decision every enforcement point runs before each action (session owner per agent call and
 * input batch, relay per frame, WOPI host per call). Control keeps one monotonic generation per scope; narrowing,
 * disabling, withdrawing or revoking bumps it. A run pins the generations it was admitted under; a later bump of any
 * pinned scope refuses the next action. Widening never bumps a generation (it takes effect at the next run). The
 * generation SOURCE (control, beside the revocation/membership source and the artifact suppression generation) and its
 * push channel are not built; the contract is a proposal for dot. */
export const WITHDRAWAL_SCOPES=Object.freeze(['platform-feature','site-workflow','tenant-enablement','membership','conversation','artifact-suppression','device-pairing']);
export const WITHDRAWAL_FEATURES=Object.freeze({
 takeover:Object.freeze({scopes:Object.freeze(['platform-feature','tenant-enablement','membership','conversation']),refusal:'BROWSER_REVOKED'}),
 'site-workflows':Object.freeze({scopes:Object.freeze(['platform-feature','site-workflow','tenant-enablement','membership','conversation']),refusal:'BROWSER_REVOKED'}),
 editor:Object.freeze({scopes:Object.freeze(['platform-feature','tenant-enablement','membership','artifact-suppression']),refusal:'WOPI_REVOKED'}),
 bridge:Object.freeze({scopes:Object.freeze(['platform-feature','tenant-enablement','membership','conversation','device-pairing']),refusal:'BRIDGE_REVOKED'}),
});
export const WITHDRAWAL_LIMITS=Object.freeze({propagationMs:30000,stalenessMs:30000});
const fault=code=>Object.assign(new Error(code),{code});
const generation=v=>Number.isSafeInteger(v)&&v>=0;
function feature(name){const f=WITHDRAWAL_FEATURES[name];if(!f)throw fault('WITHDRAWAL_CONFIGURATION');return f;}
function generations(value,scopes,code){
 if(!value||typeof value!=='object'||Array.isArray(value))throw fault(code);
 const out={};for(const s of scopes){if(!generation(value[s]))throw fault(code);out[s]=value[s];}
 return Object.freeze(out);
}

/** The generations a run is admitted under, for exactly the feature's scopes. */
export function pinGenerations(featureName,current){return generations(current,feature(featureName).scopes,'WITHDRAWAL_PIN_INVALID');}

/** Decision for one action. `observation` = `{generations, observedAtMs}` as last confirmed from the source. Stale or
 * incomplete observations refuse (fail closed); any pinned scope whose generation advanced refuses with the feature's
 * revocation code; a generation that went backwards is a source fault and refuses. */
export function checkWithdrawal(featureName,{pinned,observation,now}){
 const f=feature(featureName),t=now();
 if(!observation||!Number.isSafeInteger(observation.observedAtMs)||observation.observedAtMs>t)throw fault('WITHDRAWAL_STALE');
 if(t-observation.observedAtMs>WITHDRAWAL_LIMITS.stalenessMs)throw fault('WITHDRAWAL_STALE');
 const pin=generations(pinned,f.scopes,'WITHDRAWAL_PIN_INVALID');
 let current;try{current=generations(observation.generations,f.scopes,'WITHDRAWAL_STALE');}catch{throw fault('WITHDRAWAL_STALE');}
 const advanced=[];
 for(const s of f.scopes){if(current[s]<pin[s])throw fault('WITHDRAWAL_GENERATION_REGRESSED');if(current[s]>pin[s])advanced.push(s);}
 if(advanced.length)throw Object.assign(fault(f.refusal),{scopes:Object.freeze(advanced)});
 return Object.freeze({allowed:true,observedAtMs:observation.observedAtMs});
}

/** Enforcement-point guard over a generation source (`read()` -> `{generations}`) and pushes (`observe`). It keeps the last
 * confirmed observation; when the source cannot answer, the old observation ages out and every action refuses after the
 * staleness bound. */
export function createWithdrawalGuard({feature:featureName,source,now}){
 feature(featureName);
 if(typeof source?.read!=='function'||typeof now!=='function')throw fault('WITHDRAWAL_CONFIGURATION');
 let last=null;
 const accept=g=>{last={generations:g,observedAtMs:now()};};
 return Object.freeze({
  /** A push from control: record it as the current confirmed observation. */
  observe(g){accept(g);},
  async check(pinned){
   try{accept((await source.read())?.generations);}catch{}
   return checkWithdrawal(featureName,{pinned,observation:last,now});
  },
 });
}
