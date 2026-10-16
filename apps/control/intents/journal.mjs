/** Replay journal for conversational write preparations. One entry per (tenant, actor, conversation, deliveryId):
 * a delivery is claimed before its owner is called and settled only on evidence. A repeat of the same delivery never
 * calls the owner again: PREPARED replays the retained result, FAILED (owner refused before any effect) replays the
 * same refusal, and PENDING or UNKNOWN answers UNKNOWN. A different request under the same delivery is a CONFLICT.
 *
 * The store is a port (LOCAL PROPOSAL; its table is migration request P-INT-M1 in
 * docs/coordination/proposals/FABLE-INTENTS-PROPOSALS-20261016.md, no migration ID allocated):
 *  - `claim({key,record,signal})` → `{claimed:true}` or `{claimed:false,entry:{record,state,outcome}}` (atomic insert-or-read).
 *  - `settle({key,record,state,outcome,signal})` → the settled entry; only a PENDING entry with the same record settles.
 * A lost acknowledgement from either call leaves the delivery PENDING or unknown; nothing here retries or deletes. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fault=(code,extra={})=>Object.assign(Error(code),{code,...extra});
const STATES=new Set(['PENDING','PREPARED','FAILED','UNKNOWN']);
export function createIntentJournal(store){
 const ports=own(store,['claim','settle']);if(typeof ports.claim!=='function'||typeof ports.settle!=='function')throw fault('INTENT_CONFIGURATION');
 const key=(binding,deliveryId)=>data({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId});
 /** Replay answer for an existing entry; never a new owner call. */
 function replay(entryValue,record){
  const entry=data(entryValue);own(entry,['record','state','outcome']);
  if(!STATES.has(entry.state))throw fault('UNKNOWN');
  if(canonicalSha256(entry.record)!==canonicalSha256(record))throw fault('CONFLICT');
  if(entry.state==='PREPARED'&&entry.outcome!==null&&typeof entry.outcome==='object'&&Object.hasOwn(entry.outcome,'result'))return {replayed:true,result:entry.outcome.result,release:entry.outcome.release??null};
  if(entry.state==='FAILED'&&typeof entry.outcome?.code==='string')throw fault(entry.outcome.code,{replayed:true});
  throw fault('UNKNOWN',{replayed:true});
 }
 return Object.freeze({
  /** @returns {Promise<{claimed:true}|{replayed:true,result:unknown,release:unknown}>} */
  async begin({binding,deliveryId,record,signal}){
   let raw,ack;
   try{raw=await ports.claim.call(store,{key:key(binding,deliveryId),record,signal});}
   // The claim may or may not exist, but no owner was called: nothing was prepared by this call.
   catch{throw fault('UNAVAILABLE');}
   try{ack=data(raw);}catch{throw fault('UNKNOWN');}
   if(ack?.claimed===true)return {claimed:true};
   if(ack?.claimed!==false)throw fault('UNKNOWN');
   try{return replay(ack.entry,record);}catch(error){throw error?.code?error:fault('UNKNOWN');}
  },
  /** Settle after the owner answered. Throws when the acknowledgement is lost or refused. */
  async settle({binding,deliveryId,record,state,outcome,signal}){
   const ack=data(await ports.settle.call(store,{key:key(binding,deliveryId),record,state,outcome,signal}));
   own(ack,['record','state','outcome']);if(ack.state!==state||canonicalSha256(ack.record)!==canonicalSha256(record)||canonicalSha256(ack.outcome)!==canonicalSha256(outcome))throw fault('UNKNOWN');
  },
 });
}
