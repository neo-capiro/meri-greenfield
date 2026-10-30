/** Approved-EFFECT settlement for a recorded browser action.
 *
 * The receipt producer/append path is unchanged and owns the durable event. This wrapper adds the Core result
 * join ONLY when the recorded action has a canonical PREPARED approval: it derives the proposal from the
 * actual full binding + SDK toolUseId, reads the immutable preparation metadata, validates the canonical
 * preparation digests, and reports the acknowledged event as truthful `ok`/`error` evidence.
 *
 * A metadata read that returns NULL is an ordinary observation and appends with NO Core result. An undefined,
 * malformed or failed read is UNKNOWN with the saved event provenance — never absence. Nothing here consumes
 * or grants.
 */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertBrowserActionReceipt,browserActionReceiptEventId}
 from '../../../packages/contracts/runtime-0.2/browser-receipt.mjs';
import {assertConversationEvent,isBrowserReceiptEventType as isEventType}
 from '../../../packages/contracts/conversation-sources/validate.mjs';
import {browserPreparationProposalId,browserRequestFromPreparation,assertBrowserPreparationDigests}
 from '../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {assertBrowserApprovalStatus} from '../../../packages/contracts/runtime-0.2/browser-approval-channel.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
const UNKNOWN='BROWSER_ACTION_SETTLEMENT_UNKNOWN',REFUSED='BROWSER_ACTION_SETTLEMENT_REFUSED';
const same=(a,b)=>{try{return canonicalSha256(data(a))===canonicalSha256(data(b));}catch{return false;}};

export function createBrowserActionRecorder({metadata,record,result,now=Date.now}={}){
 if(typeof metadata?.read!=='function'||typeof record!=='function'||
  (result!==null&&typeof result!=='function')||typeof now!=='function')fail('BROWSER_ACTION_RECORDER_CONFIGURATION');
 const unknown=(eventId,extra={})=>Object.freeze(Object.assign(Error(UNKNOWN),{code:UNKNOWN,eventId,...extra}));

 async function recordAction(value){
  const v=own(value,['binding','scopes','sessionId','toolUseId','action','urlHost','atMs','outcome'],
   ['reference','signal']);
  const signal=nativeSignal(v.signal);
  const binding=data(v.binding);
  // The durable event is written by the unchanged producer path and is the ONLY primary record.
  const appended=await record(value);
  if(appended?.recorded!==true||typeof appended.eventId!=='string'||!appended.event)fail(UNKNOWN);
  let event;
  try{
   event=assertConversationEvent(data(appended.event));
   if(!isEventType(event.type))fail(REFUSED);
   if(event.eventId!==appended.eventId)fail(REFUSED);
   // The acknowledgement must carry the CANONICAL deterministic identity for this binding/session/tool use;
   // a fake owner cannot pick an arbitrary id.
   const expectedId=browserActionReceiptEventId({binding,sessionId:v.sessionId,toolUseId:v.toolUseId??null});
   if(appended.eventId!==expectedId)fail(REFUSED);
   if(!same(event.binding,binding))fail(REFUSED);
   // The acknowledged event must carry EXACTLY the receipt this call submitted.
   const submitted=assertBrowserActionReceipt({schema:'meri-browser-receipt/1',kind:'browser.action',
    binding,sessionId:v.sessionId,toolUseId:v.toolUseId??null,action:v.action,urlHost:v.urlHost,atMs:v.atMs,
    reference:v.reference??null,outcome:v.outcome});
   if(!same(event.data,submitted))fail(REFUSED);
  }catch{throw unknown(appended.eventId);}
  if(typeof v.toolUseId!=='string')return Object.freeze({...appended,settlement:null});
  const proposalId=browserPreparationProposalId({binding,toolUseId:v.toolUseId});
  let payload;
  try{payload=await metadata.read({tenantId:binding.tenantId,actorId:binding.actorId,proposalId},()=>{
   if(signal?.aborted)fail(REFUSED);});}
  catch{throw unknown(appended.eventId);}
  // NULL is observation; undefined is NOT.
  if(payload===null)return Object.freeze({...appended,settlement:null});
  if(payload===undefined||typeof payload!=='object'||!payload.record)throw unknown(appended.eventId);
  let request,subjectSha256;
  try{
   const stored=data(payload.record),preparation=stored.request;
   request=browserRequestFromPreparation(preparation);
   assertBrowserPreparationDigests({preparation,record:stored,commandSha256:payload.commandSha256});
   if(stored.proposalId!==proposalId)fail(REFUSED);
   if(!same(stored.binding,binding)||!same(request.subject.binding,binding))fail(REFUSED);
   if(request.subject.toolUseId!==v.toolUseId)fail(REFUSED);
   if(request.subject.tool!==v.action)fail(REFUSED);
   subjectSha256=canonicalSha256(data(request.subject));
   if(request.subjectSha256!==subjectSha256)fail(REFUSED);
  }catch{throw Object.freeze(Object.assign(Error(REFUSED),{code:REFUSED,eventId:appended.eventId}));}
  // The settlement is the ACKNOWLEDGED event with the receipt's own ok/error — never a consumption state.
  const settlement=Object.freeze({outcome:event.data.outcome,
   result:Object.freeze({eventId:appended.eventId,event:Object.freeze({...event})})});
  // An absent Core result port is an explicit unavailable capability, not an implicit success.
  if(result===null)throw unknown(appended.eventId,{settlement});
  let answer;
  try{answer=await result({proposalId,subjectSha256,binding,outcome:settlement.outcome,
   result:settlement.result,...(signal===undefined?{}:{signal})});}
  catch{throw unknown(appended.eventId,{settlement});}
  // A canonical result answer is itself the acknowledgement: non-permissive status, exact identities,
  // COMPLETED consumption and the identical settlement wrapper. No redundant status roundtrip.
  let status;
  try{
   if(answer?.permitted!==false)fail(REFUSED);
   status=assertBrowserApprovalStatus(answer?.status);
   if(status.proposalId!==proposalId||status.subjectSha256!==subjectSha256||
    status.toolUseId!==v.toolUseId)fail(REFUSED);
   const consumption=status.consumption;
   if(!consumption||consumption.state!=='COMPLETED'||!same(consumption.result,settlement))fail(REFUSED);
  }catch{throw unknown(appended.eventId,{settlement});}
  return Object.freeze({...appended,settlement,status,answeredAtMs:now()});
 }
 return Object.freeze({recordAction});
}
