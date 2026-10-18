/** Read consent beside the routine's approval (option B, lane RD; D016-A item 5; FABLE-RUN-BOUND-READ-DELEGATION §9).
 * The owner's explicit approval of a routine is also the signed-in consent for its READS (at most 30 days, renewable only by a
 * live login). It is created, resumed, paused and revoked here through `readConsents`, the composer's consent port bound to the
 * approving request's own live session (`native-authority/read-delegation/routine-consents.mjs`), and only its reference and last
 * state are kept beside the projection it binds (`scheduleOwner.recordReadConsent`). Nothing here is authority: Core answers every
 * occurrence from its own consent row, and refuses on its own once the projection digest the consent binds changes.
 *
 * Order. Everything happens BEFORE the schedule mutation. Widening (a new consent for an active projection, or the resume of a
 * paused consent whose projection digest still matches) is a refusal when it fails: no routine is approved without its consent.
 * Narrowing (pause, delete) only reports a failure and the pause or delete proceeds: authority only narrows. A mutation that then
 * does not happen (NOT_DISPATCHED) revokes a consent created for it, best effort. A paused projection (created or updated paused)
 * gets no new consent: a paused schedule never fires, and its later resume is a projection change that creates one. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export const ROUTINE_READ_CONSENT_EVENTS=Object.freeze({narrowFailed:'routines.read_consent.narrow_failed',abandonFailed:'routines.read_consent.abandon_failed'});
const fault=code=>{throw Object.assign(Error('ROUTINES_'+code),{code:'ROUTINES_'+code,outcome:'NOT_DISPATCHED'});};
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
const errorCode=error=>typeof error?.code==='string'?error.code:'UNKNOWN';
const defaultLog=event=>{process.stderr.write(JSON.stringify(event)+'\n');};
export function createRoutineReadConsentLifecycle({readConsents,scheduleOwner,now,log=defaultLog}={}){
 let port;try{const p=own(readConsents,['approve','narrow','resume'],['operations','operationsDigest']);port={approve:p.approve,narrow:p.narrow,resume:p.resume};}catch{fault('CONFIGURATION');}
 if(!ordinary(now)||!ordinary(log)||Object.values(port).some(fn=>!ordinary(fn)))fault('CONFIGURATION');
 /** A widening that fails refuses the approval (nothing dispatched); a deadline or cancellation keeps its own code. */
 const widen=async work=>{try{return await work();}catch(error){const code=errorCode(error);if(code==='DEADLINE'||code==='CANCELLED')throw error;fault('READ_CONSENT_REFUSED');}};
 const read=storageMethod(scheduleOwner,'readReadConsent'),record=storageMethod(scheduleOwner,'recordReadConsent');
 const report=event=>{try{log(event);}catch{}};
 const check=signal=>()=>{if(signal?.aborted)throw Object.assign(Error('CANCELLED'),{code:'CANCELLED',outcome:'NOT_DISPATCHED'});};
 /** Before the mutation. Returns `{consent, created}` to record once the mutation is acknowledged, or null when nothing changes. */
 async function before(value){
  const v=own(value,['intent','attended','clientId','policyRevision','deadlineMs'],['signal']);nativeSignal(v.signal);
  const intent=data(v.intent),attended=data(v.attended),p=intent.projection,tenantId=p.owner.tenantId,scheduleId=p.scheduleId,projectionSha256=hash(p),at=now();
  const stored=intent.operation==='schedule_task'?null:await read({tenantId,scheduleId},check(v.signal));
  const narrowing=intent.operation==='cancel_scheduled_task'||p.state==='paused';
  if(narrowing){
   const state=intent.cancel?.mode==='delete'?'revoked':'paused';
   if(stored===null||stored.state==='revoked'||stored.state===state)return null;
   try{await port.narrow({consentId:stored.consentId,state,signal:v.signal,deadlineMs:v.deadlineMs});}
   catch(error){report({event:ROUTINE_READ_CONSENT_EVENTS.narrowFailed,operation:intent.operation,scheduleId,consentId:stored.consentId,state,code:errorCode(error)});return null;}
   return Object.freeze({consent:Object.freeze({...stored,state}),created:false});
  }
  const matching=stored!==null&&stored.scheduleProjectionSha256===projectionSha256&&stored.expiresAtMs>at;
  if(matching&&stored.state==='active')return null;
  if(matching&&stored.state==='paused'){
   await widen(()=>port.resume({attended,consentId:stored.consentId,signal:v.signal,deadlineMs:v.deadlineMs}));
   return Object.freeze({consent:Object.freeze({...stored,state:'active'}),created:false});
  }
  const endAt=intent.configuration?.spec?.endAt??null,scheduleEndsAtMs=endAt===null?null:Date.parse(endAt);
  const receipt=await widen(async()=>data(own(await port.approve({attended,scheduleId,clientId:v.clientId,policyRevision:v.policyRevision,scheduleProjectionSha256:projectionSha256,scheduleEndsAtMs,signal:v.signal,deadlineMs:v.deadlineMs}),
   ['consentId','state','createdAtMs','expiresAtMs','operationsDigest'])));
  if(receipt.state!=='active')fault('READ_CONSENT_REFUSED');
  return Object.freeze({consent:Object.freeze({consentId:receipt.consentId,state:'active',createdAtMs:receipt.createdAtMs,expiresAtMs:receipt.expiresAtMs,scheduleProjectionSha256:projectionSha256,operationsDigest:receipt.operationsDigest}),created:true});
 }
 /** After the acknowledged mutation: the consent facts recorded beside the acknowledged generation. */
 async function after({tenantId,intent,consent},checkFn){
  const i=data(intent);return record({tenantId,scheduleId:i.projection.scheduleId,generation:i.generation,consent:data(consent)},checkFn);
 }
 /** The mutation did not happen: a consent created for it is revoked, best effort, and a failure is reported. */
 async function abandon({consent,created},{signal,deadlineMs}={}){
  if(!created)return false;
  try{await port.narrow({consentId:consent.consentId,state:'revoked',signal,deadlineMs});return true;}
  catch(error){report({event:ROUTINE_READ_CONSENT_EVENTS.abandonFailed,consentId:consent.consentId,code:errorCode(error)});return false;}
 }
 return Object.freeze({before,after,abandon});
}
