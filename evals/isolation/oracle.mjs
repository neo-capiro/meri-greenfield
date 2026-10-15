/** Leak oracle: any victim-owned marker in an observable outcome is a disclosure. Fail closed on ambiguity. */
export const CATEGORIES=Object.freeze(['guessed-id','object-link','session-key','forged-arguments']);
export const SURFACES=Object.freeze(['conversations-http','gateway-dispatch','task-lookup-authorizer','artifact-service']);
export const OUTCOMES=Object.freeze(['refused','leaked','unexpected-success','harness-error']);
/** Everything a tenant owns that must never appear in another tenant's observation. `seeded` facts are added after seeding. */
export function victimMarkers(tenant,seeded={}){
 const p=tenant.principal,values=[tenant.tenantId,p.actorId,p.binding.conversationId,p.binding.runId,p.selectedClientId,tenant.promptSentinel,tenant.artifactSentinel,seeded.sessionCredential,seeded.artifactVersionId,seeded.gatewayCredential];
 return Object.freeze(values.filter(v=>typeof v==='string'&&v.length>0));
}
export function detectLeak(text,markers){if(typeof text!=='string')throw Object.assign(new Error('ORACLE_TEXT'),{code:'ORACLE_TEXT'});return markers.filter(marker=>text.includes(marker));}
/** `observation` is {accepted,refusal,text}: accepted means the surface reported success; refusal means a recognized product refusal.
 * A failure that is neither (a harness or fixture fault) is never counted as a refusal. */
export function classify(observation,markers){
 const leaked=detectLeak(observation.text,markers);
 if(leaked.length)return {outcome:'leaked',leaked};
 if(observation.accepted===true)return {outcome:'unexpected-success',leaked:[]};
 if(observation.refusal!==true)return {outcome:'harness-error',leaked:[]};
 return {outcome:'refused',leaked:[]};
}
