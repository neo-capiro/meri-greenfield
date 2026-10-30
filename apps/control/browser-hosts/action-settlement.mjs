/** Approved-EFFECT settlement for a recorded browser action.
 *
 * The receipt producer/append path is unchanged and owns the durable event. This wrapper adds the Core result
 * join ONLY when the recorded action has a canonical PREPARED approval: it derives the proposal from the
 * actual full binding + SDK toolUseId, reads the immutable preparation metadata, verifies the exact request
 * subject/action/toolUseId, and reports the recorded event as the truthful settlement. A metadata read that
 * returns NULL is an ordinary observation and appends with NO Core result; a read/results failure is UNKNOWN,
 * never absence, and never a fabricated grant.
 */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {browserPreparationProposalId,browserRequestFromPreparation}
 from '../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
const UNKNOWN='BROWSER_ACTION_SETTLEMENT_UNKNOWN',REFUSED='BROWSER_ACTION_SETTLEMENT_REFUSED';

export function createBrowserActionRecorder({metadata,record,result,status,now=Date.now}={}){
 if(typeof metadata?.read!=='function'||typeof record!=='function'||typeof result!=='function'||
  typeof status!=='function'||typeof now!=='function')fail('BROWSER_ACTION_RECORDER_CONFIGURATION');
 /** Record the action, then settle its approved effect when (and only when) a PREPARED approval exists. */
 async function recordAction(value){
  const v=own(value,['binding','scopes','sessionId','toolUseId','action','urlHost','atMs','outcome'],
   ['reference','signal']);
  const signal=nativeSignal(v.signal);
  const binding=data(v.binding);
  // The durable event is the ONLY primary record; it is written by the unchanged producer path.
  const appended=await record(value);
  if(appended?.recorded!==true||typeof appended.eventId!=='string'||!appended.event)
   fail(UNKNOWN);
  if(typeof v.toolUseId!=='string')return Object.freeze({...appended,settlement:null});
  const proposalId=browserPreparationProposalId({binding,toolUseId:v.toolUseId});
  let saved;
  try{saved=await metadata.read({tenantId:binding.tenantId,actorId:binding.actorId,proposalId},()=>{
   if(signal?.aborted)fail(REFUSED);});}
  catch(error){if(error?.code===REFUSED)throw error;
   // A failed/unknown read is NOT absence: the effect result stays UNKNOWN.
   throw Object.freeze(Object.assign(Error(UNKNOWN),{code:UNKNOWN,eventId:appended.eventId}));}
  if(saved===null||saved===undefined)return Object.freeze({...appended,settlement:null});
  let request;
  try{
   const payload=data(saved),record0=data(payload.record);
   request=browserRequestFromPreparation(record0.request);
   if(canonicalSha256(record0.binding)!==canonicalSha256(binding))fail(REFUSED);
   if(request.subject.toolUseId!==v.toolUseId)fail(REFUSED);
   if(canonicalSha256(request.subject.binding)!==canonicalSha256(binding))fail(REFUSED);
   if(request.subject.tool!==v.action&&request.subject.action!==v.action)fail(REFUSED);
   if(request.subjectSha256!==canonicalSha256(request.subject))fail(REFUSED);
  }catch{throw Object.freeze(Object.assign(Error(REFUSED),{code:REFUSED,eventId:appended.eventId}));}
  // The truthful settlement is the ACKNOWLEDGED durable event, not a new observation.
  const settlement=Object.freeze({outcome:'COMPLETED',
   result:Object.freeze({eventId:appended.eventId,event:Object.freeze({...data(appended.event)})})});
  let answer;
  try{answer=await result({proposalId,subjectSha256:request.subjectSha256,binding,outcome:settlement.outcome,
   result:settlement.result,...(signal===undefined?{}:{signal})});}
  catch{throw Object.freeze(Object.assign(Error(UNKNOWN),{code:UNKNOWN,eventId:appended.eventId,
   settlement}));}
  // The canonical status must report this proposal's COMPLETED settlement with the SAME result wrapper.
  let current;
  try{current=await status({proposalId,subjectSha256:request.subjectSha256,binding,
   ...(signal===undefined?{}:{signal})});}
  catch{throw Object.freeze(Object.assign(Error(UNKNOWN),{code:UNKNOWN,eventId:appended.eventId,settlement}));}
  const statusDoc=current?.status;
  const consumption=statusDoc?.consumption;
  if(statusDoc?.permissive===true||statusDoc?.proposalId!==proposalId||
   consumption?.state!=='COMPLETED'||canonicalSha256(consumption.result)!==canonicalSha256(settlement))
   throw Object.freeze(Object.assign(Error(UNKNOWN),{code:UNKNOWN,eventId:appended.eventId,settlement}));
  return Object.freeze({...appended,settlement,answeredAtMs:now()});
 }
 return Object.freeze({recordAction});
}
