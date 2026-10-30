/** Durable identity for ONE browser approval PREPARATION, in the existing intent journal.
 *
 * The row is the journal's exact two-key record {operation, argumentsSha256}; this module owns the stable
 * preimage (full binding + SDK toolUseId + proposal id + the original request digest) and the
 * domain-separated delivery id, so an approval preparation can never be read as browser EXECUTION custody
 * (which keys on the MCP requestId).
 *
 * A repeat from a NEW owner instance recovers the ACKNOWLEDGED preparation instead of running the producer
 * again. An altered request under the same SDK identity conflicts against the original digest; it never
 * creates a second delivery. Identity carries no clock, lease or resolved state.
 */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {browserApprovalDeliveryId} from '../../../../packages/contracts/runtime-0.2/browser-operation.mjs';
import {assertBrowserPreparationResult} from './browser-preparation-result.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const OPERATION=Object.freeze({id:'browser_approval_preparation',version:'0.2.0'});
const KEY=['binding','toolUseId','proposalId','requestSha256'];

/** The two-key SQL record. No clock, lease or resolved state enters the identity. */
export function browserApprovalPreparationRecord({binding,toolUseId,proposalId,requestSha256}){
 validateShape('RunBinding',data(binding));
 if(typeof proposalId!=='string'||proposalId.length===0)fail('BROWSER_PREPARATION_REFUSED');
 if(typeof requestSha256!=='string'||!/^[0-9a-f]{64}$/u.test(requestSha256))fail('BROWSER_PREPARATION_REFUSED');
 return Object.freeze({operation:OPERATION,
  argumentsSha256:canonicalSha256({binding:data(binding),toolUseId,proposalId,requestSha256})});
}

export function createBrowserApprovalPreparationOwner({journal}={}){
 if(typeof journal?.begin!=='function'||typeof journal?.settle!=='function'||typeof journal?.read!=='function')
  fail('BROWSER_PREPARATION_CONFIGURATION');
 function key(value){
  const v=own(value,KEY,['signal']);
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
   // A retained refusal/conflict keeps its own code; only an uncertain claim is UNKNOWN.
   if(error?.code&&error.code!=='UNKNOWN')throw error;
   return Object.freeze({dispatch:false,variant:'unresolved',deliveryId,argumentsSha256:record.argumentsSha256});
  }
  if(ack?.claimed===true)return Object.freeze({dispatch:true,variant:'claimed',deliveryId,
   argumentsSha256:record.argumentsSha256});
  const saved=ack?.result;
  if(!saved||typeof saved!=='object'||typeof saved.proposalId!=='string')fail('BROWSER_PREPARATION_CONFLICT');
  if(saved.proposalId!==value.proposalId)fail('BROWSER_PREPARATION_CONFLICT');
  if(typeof saved.requestSha256!=='string'||saved.requestSha256!==value.requestSha256)
   fail('BROWSER_PREPARATION_CONFLICT');
  // A retained outcome is only a replay when it is a GENUINE full result for this exact identity: a
  // partial/legacy ids-only row is a conflict, never a recovered preparation.
  const preparation=assertBrowserPreparationResult(saved,{binding:value.binding,toolUseId:value.toolUseId});
  if(preparation.requestSha256!==value.requestSha256)fail('BROWSER_PREPARATION_CONFLICT');
  return Object.freeze({dispatch:false,variant:'replayed',deliveryId,argumentsSha256:record.argumentsSha256,
   preparation});
 }
 /** Settle PREPARED only after the metadata owner acknowledged the immutable preparation. */
 async function settle(value){
  const v=own(value,[...KEY,'preparation'],['signal']);
  const {binding,record,signal,deliveryId}=key({binding:v.binding,toolUseId:v.toolUseId,
   proposalId:v.proposalId,requestSha256:v.requestSha256,...(v.signal===undefined?{}:{signal:v.signal})});
  const preparation=assertBrowserPreparationResult(v.preparation,
   {binding:v.binding,toolUseId:v.toolUseId});
  if(preparation.proposalId!==v.proposalId||preparation.requestSha256!==v.requestSha256)
   fail('BROWSER_PREPARATION_REFUSED');
  // The journal's outcome carries the FULL immutable preparation under `result`, so a later replay returns
  // the same record rather than a pair of ids.
  // PREPARED carries the canonical release window the existing journal adapter requires: the record's own
  // binding/scopes and the ORIGINAL request expiry. No new clock is minted here.
  await journal.settle({binding,deliveryId,record,state:'PREPARED',
   outcome:Object.freeze({result:preparation,release:Object.freeze({
    binding:data(preparation.record.binding),scopes:preparation.record.scopes,
    expiresAtMs:preparation.record.request.expiresAtMs})}),
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
  const preparation=entry.outcome?.result===undefined?null
   :assertBrowserPreparationResult(entry.outcome.result,{binding:value.binding,toolUseId:value.toolUseId});
  return Object.freeze({variant:'retained',deliveryId,state:entry.state,argumentsSha256:saved.argumentsSha256,
   preparation});
 }
 return Object.freeze({claim,settle,read,operation:OPERATION});
}
