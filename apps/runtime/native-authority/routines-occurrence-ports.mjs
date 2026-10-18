/** Worker-side lane-1 owners for the schedule service over its native capability client: `runAdmission` and `retirement` as
 * scheduled-dispatch.mjs and scheduled-job-lifecycle.mjs call them, implemented as control's private native operations
 * (routines-occurrence-http.mjs). The worker has no prepared candidate, issuance store or capability authority; control admits and
 * retires, this port only carries closed requests and re-validates closed replies. A carried refusal (`{refused:{code}}`) is thrown
 * with that exact code, so the dispatch reports the same UNKNOWN code its in-process owner would have; a transport failure keeps the
 * native client's code (NATIVE_UNAVAILABLE, DEADLINE, CANCELLED); an open reply shape is ROUTINES_OCCURRENCE_REPLY. Fail closed. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {snapshotOccurrence,occurrenceIdentity} from '../../control/schedules/scheduled-occurrence.mjs';
import {ROUTINES_OCCURRENCE_OPERATIONS,ROUTINES_OCCURRENCE_CODE} from './routines-occurrence-http.mjs';

const HEX64=/^[a-f0-9]{64}$/u,same=(a,b)=>hash(a)===hash(b);
const fault=code=>Object.assign(Error('ROUTINES_OCCURRENCE_'+code),{code:'ROUTINES_OCCURRENCE_'+code});
const refuse=code=>{throw fault(code);};

export function createRoutinesOccurrencePorts(options){
 let call;
 try{const o=own(options,['native']);call=storageMethod(o.native,'call');}catch{throw fault('UNAVAILABLE');}
 const options_=v=>({...(v.signal===undefined?{}:{signal:v.signal}),...(v.deadlineMs===undefined?{}:{deadlineMs:v.deadlineMs})});
 /** A carried refusal is thrown with its own code; any other single-member reply is returned for the route's check. */
 function answer(value){
  let keys;try{keys=Object.keys(data(value));}catch{refuse('REPLY');}
  if(keys.length!==1)refuse('REPLY');
  if(keys[0]!=='refused')return value;
  let code;try{code=own(value.refused,['code']).code;}catch{refuse('REPLY');}
  if(typeof code!=='string'||!ROUTINES_OCCURRENCE_CODE.test(code))refuse('REPLY');
  throw Object.assign(Error(code),{code});
 }
 async function admit(value){
  let v,occ,id,effect,input;
  try{
   v=own(value,['occurrence','occurrenceKey','effect','input'],['signal','deadlineMs']);nativeSignal(v.signal);
   occ=snapshotOccurrence(v.occurrence);id=occurrenceIdentity(occ);effect=data(v.effect);input=data(own(v.input,['conversation','run','request','event']));
  }catch{refuse('REQUEST');}
  if(v.occurrenceKey!==id.occurrenceKey||v.deadlineMs!==undefined&&!Number.isSafeInteger(v.deadlineMs))refuse('REQUEST');
  const reply=answer(await call(ROUTINES_OCCURRENCE_OPERATIONS.admit,{occurrence:occ,occurrenceKey:id.occurrenceKey,effect,input},options_(v)));
  let r;try{r=data(own(own(reply,['admitted']).admitted,['binding','requestSha256','expiresAtMs','replayed']));validateShape('RunBinding',r.binding);}catch{refuse('REPLY');}
  if(!same(r.binding,id.binding)||r.requestSha256!==hash(input.request)||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<1||typeof r.replayed!=='boolean')refuse('REPLY');
  return data({binding:r.binding,requestSha256:r.requestSha256,expiresAtMs:r.expiresAtMs,replayed:r.replayed});
 }
 async function retire(value){
  let v,binding;
  try{v=own(value,['binding'],['signal','deadlineMs']);nativeSignal(v.signal);binding=data(v.binding);validateShape('RunBinding',binding);}catch{refuse('REQUEST');}
  if(v.deadlineMs!==undefined&&!Number.isSafeInteger(v.deadlineMs))refuse('REQUEST');
  const reply=answer(await call(ROUTINES_OCCURRENCE_OPERATIONS.retire,{binding},options_(v)));
  let r;try{r=own(own(reply,['retired']).retired,['physicalStopProven']);}catch{refuse('REPLY');}
  if(r.physicalStopProven!==true)refuse('REPLY');
  return data({physicalStopProven:true});
 }
 return Object.freeze({runAdmission:Object.freeze({admit}),retirement:Object.freeze({retire})});
}
