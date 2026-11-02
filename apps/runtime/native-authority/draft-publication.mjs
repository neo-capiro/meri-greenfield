/** A document intent draft, published to its conversation as the run's `artifact.available` event: the same event the
 * selected-skill output path appends, so the transcript (live and saved) lists the file the owner just created, whatever
 * the approvals panel shows. The draft itself is the document application's: this only projects an existing version,
 * bound to the run it was created in and to the run's current scopes, into the run's own event journal. The event id is
 * derived from the version, so a repeated publication is the store's own replay rather than a second event. */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
const same=(a,b)=>hash(a)===hash(b);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
/** A scope the run holds admits a version scope with the same tenant, kind and resource; policy revisions may differ. */
const held=(scopes,scope)=>scopes.some(s=>s.tenantId===scope.tenantId&&s.kind===scope.kind&&s.resourceId===scope.resourceId);
/** Deterministic UUID-shaped identity of the draft's event in its run. */
export const draftEventId=value=>{const h=hash(value);return h.slice(0,8)+'-'+h.slice(8,12)+'-8'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
/** @param {{store:{append:Function},binding:object,current:(signal?:AbortSignal)=>Promise<{scopes:object[]}>,now:()=>number}} configuration */
export function createDraftPublication({store,binding,current,now}){
 if(typeof store?.append!=='function'||typeof current!=='function'||typeof now!=='function')throw intentFault('INTENT_CONFIGURATION');
 validateShape('RunBinding',binding);
 return async function publishDraft({version,signal}){
  let v;try{v=data(version);}catch{throw intentFault('ACCESS_DENIED');}
  if(!same(v.binding,binding)||!UUID.test(v.artifactId??'')||!UUID.test(v.versionId??'')||!Array.isArray(v.scopes)||!v.scopes.length)throw intentFault('ACCESS_DENIED');
  const facts=await current(signal);
  if(!Array.isArray(facts?.scopes)||!facts.scopes.length||v.scopes.some(scope=>!held(facts.scopes,scope)))throw intentFault('ACCESS_DENIED');
  const eventData={artifactId:v.artifactId,versionId:v.versionId},type='artifact.available';
  const check=()=>{if(signal?.aborted)throw intentFault('CANCELLED');};
  return store.append(binding,{eventId:draftEventId({binding,type,data:eventData}),createdAt:new Date(now()).toISOString(),type,data:eventData},check,facts.scopes);
 };
}
