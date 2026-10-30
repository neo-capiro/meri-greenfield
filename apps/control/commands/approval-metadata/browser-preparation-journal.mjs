/** Durable identity for ONE browser approval PREPARATION, in the existing intent journal.
 *
 * The row is the journal's exact two-key record {operation, argumentsSha256}; this module owns the stable
 * preimage (full binding + SDK toolUseId + deterministic proposal id + the original request digest) and the
 * domain-separated delivery id, so an approval preparation can never be read as browser EXECUTION custody
 * (which keys on the MCP requestId) or as any other intent.
 *
 * A repeat from a NEW owner instance recovers the acknowledged preparation instead of running the producer
 * again; altered input under the same delivery conflicts. A lost claim or settle acknowledgement stays
 * unresolved and is never retried as a write.
 */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {browserApprovalDeliveryId} from '../../../../packages/contracts/runtime-0.2/browser-operation.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const OPERATION=Object.freeze({id:'browser_approval_preparation',version:'0.2.0'});

/** The two-key SQL record. No clock, lease or resolved state enters the identity. */
export function browserApprovalPreparationRecord({binding,toolUseId,proposalId,requestSha256}){
 validateShape('RunBinding',data(binding));
 if(typeof proposalId!=='string')fail('BROWSER_PREPARATION_REFUSED');
 if(typeof requestSha256!=='string'||!/^[0-9a-f]{64}$/u.test(requestSha256))fail('BROWSER_PREPARATION_REFUSED');
 return Object.freeze({operation:OPERATION,
  argumentsSha256:canonicalSha256({binding:data(binding),toolUseId,proposalId,requestSha256})});
}

export function createBrowserApprovalPreparationOwner({journal}={}){
 if(typeof journal?.begin!=='function'||typeof journal?.settle!=='function'||typeof journal?.read!=='function')
  fail('BROWSER_PREPARATION_CONFIGURATION');
 function key(value){
  const v=own(value,['binding','toolUseId','proposalId','requestSha256'],['signal']);
  const signal=nativeSignal(v.signal);
  const record=browserApprovalPreparationRecord(v);
  return {binding:data(v.binding),record,signal,
   deliveryId:browserApprovalDeliveryId({binding:v.binding,toolUseId:v.toolUseId,proposalId:v.proposalId})};
 }
 /** Claim before the metadata producer runs. Only `dispatch:true` may write a new preparation. */
 async function claim(value){
  const {binding,record,signal,deliveryId}=key(value);
  let ack;
  try{ack=await journal.begin({binding,deliveryId,record,...(signal===undefined?{}:{signal})});}
  catch(error){
   if(error?.code==='UNKNOWN')return Object.freeze({dispatch:false,variant:'unresolved',deliveryId,
    argumentsSha256:record.argumentsSha256});
   throw error;
  }
  if(ack?.claimed===true)return Object.freeze({dispatch:true,variant:'claimed',deliveryId,
   argumentsSha256:record.argumentsSha256});
  const saved=ack?.result??ack?.outcome??null;
  if(saved===null||typeof saved!=='object'||saved.proposalId!==value.proposalId)
   fail('BROWSER_PREPARATION_CONFLICT');
  return Object.freeze({dispatch:false,variant:'replayed',deliveryId,argumentsSha256:record.argumentsSha256,
   preparation:Object.freeze({proposalId:saved.proposalId,subjectSha256:saved.subjectSha256??null,
    requestSha256:saved.requestSha256??null})});
 }
 /** Settle PREPARED only after the metadata owner acknowledged the immutable preparation. */
 async function settle(value){
  const {binding,record,signal,deliveryId}=key(value);
  if(!value.preparation||typeof value.preparation!=='object')fail('BROWSER_PREPARATION_REFUSED');
  await journal.settle({binding,deliveryId,record,state:'PREPARED',outcome:data(value.preparation),
   ...(signal===undefined?{}:{signal})});
  return Object.freeze({settled:true,deliveryId,argumentsSha256:record.argumentsSha256});
 }
 /** Closed read: the acknowledged row must carry THIS exact record. */
 async function read(value){
  const {binding,record,signal,deliveryId}=key(value);
  const entry=await journal.read({binding,deliveryId,...(signal===undefined?{}:{signal})});
  if(entry===null)return Object.freeze({variant:'absent',deliveryId});
  const saved=data(entry.record);
  if(saved.operation?.id!==OPERATION.id||saved.argumentsSha256!==record.argumentsSha256)
   fail('BROWSER_PREPARATION_CONFLICT');
  return Object.freeze({variant:'retained',deliveryId,state:entry.state,argumentsSha256:saved.argumentsSha256});
 }
 return Object.freeze({claim,settle,read,operation:OPERATION});
}
