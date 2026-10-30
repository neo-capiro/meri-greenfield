/** Durable ONE-CONSUME ownership for a browser approval, in the existing intent journal.
 *
 * The consume POST is an effect: it must be claimed BEFORE it is sent, and the claim must survive a
 * recreated owner or a restarted process. This module owns that claim in the same journal store as the
 * preparation, under its own operation reference and its own delivery domain tag, so:
 *   - a fresh acknowledged claim is the ONLY condition under which a consume POST may be sent;
 *   - a PREPARED/PENDING/UNKNOWN/replayed/failed entry never yields another consume;
 *   - a lost claim or settle acknowledgement stays UNKNOWN and is never retried as a write;
 *   - the settled receipt is PROVENANCE, not a fresh executable permission.
 *
 * Identity is the original preparation's delivery plus the proposal: no clock, lease or checkedAt enters it.
 */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const OPERATION=Object.freeze({id:'browser_approval_consumption',version:'0.2.0'});
const KEY=['binding','toolUseId','proposalId','requestSha256'];

export function browserApprovalConsumptionRecord({binding,toolUseId,proposalId,requestSha256}){
 if(typeof proposalId!=='string'||proposalId.length===0)fail('BROWSER_APPROVAL_REFUSED');
 if(typeof requestSha256!=='string'||!/^[0-9a-f]{64}$/u.test(requestSha256))fail('BROWSER_APPROVAL_REFUSED');
 return Object.freeze({operation:OPERATION,
  argumentsSha256:canonicalSha256({grant:'browser-approval-consumption/1',binding:data(binding),
   toolUseId,proposalId,requestSha256})});
}

export function createBrowserApprovalConsumptionOwner({journal}={}){
 if(typeof journal?.begin!=='function'||typeof journal?.settle!=='function')fail('BROWSER_APPROVAL_CONFIGURATION');
 // A DIFFERENT digest domain from the preparation (same binding/tool-use/proposal), still `browser:`-prefixed
 // so the row keeps the table's exact delivery-id shape while never colliding with the preparation row.
 const consumptionDeliveryId=({binding,toolUseId,proposalId})=>'browser:'+
  canonicalSha256({domain:'meri-browser-approval-consumption/1',binding:data(binding),toolUseId,proposalId});
 function key(value){
  const v=own(value,KEY,['signal']);
  const signal=nativeSignal(v.signal);
  const record=browserApprovalConsumptionRecord(v);
  return {binding:data(v.binding),record,signal,
   deliveryId:consumptionDeliveryId({binding:v.binding,toolUseId:v.toolUseId,proposalId:v.proposalId})};
 }
 /** Claim before the consume POST. Only `dispatch:true` may send it, once. */
 async function claim(value){
  const {binding,record,signal,deliveryId}=key(value);
  let ack;
  try{ack=await journal.begin({binding,deliveryId,record,...(signal===undefined?{}:{signal})});}
  catch(error){
   if(error?.code&&error.code!=='UNKNOWN')throw error;
   return Object.freeze({dispatch:false,variant:'unresolved',deliveryId});
  }
  if(ack?.claimed===true)return Object.freeze({dispatch:true,variant:'claimed',deliveryId,
   argumentsSha256:record.argumentsSha256});
  const saved=ack?.result;
  if(!saved||typeof saved!=='object')fail('BROWSER_APPROVAL_REFUSED');
  // A retained entry is evidence only: it can never authorize another consume.
  return Object.freeze({dispatch:false,variant:'replayed',deliveryId,evidence:Object.freeze(data(saved)),
   argumentsSha256:record.argumentsSha256});
 }
 /** Settle after the Core answer, with the canonical receipt as evidence. */
 async function settle(value){
  const v=own(value,[...KEY,'receipt'],['signal']);
  const {binding,record,signal,deliveryId}=key({binding:v.binding,toolUseId:v.toolUseId,
   proposalId:v.proposalId,requestSha256:v.requestSha256,...(v.signal===undefined?{}:{signal:v.signal})});
  const receipt=data(v.receipt);
  await journal.settle({binding,deliveryId,record,state:'PREPARED',outcome:Object.freeze({result:receipt}),
   ...(signal===undefined?{}:{signal})});
  return Object.freeze({settled:true,deliveryId});
 }
 return Object.freeze({claim,settle,operation:OPERATION});
}
