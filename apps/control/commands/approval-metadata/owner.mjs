import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {nativeSignal} from '../protocol.mjs';
import {CommandError,data,deny,own,instant,canonicalSha256,context,selected,input,same,makePayload,immutablePayload,assertReadIds,policySelection,policyReceipt} from './binding.mjs';
function safe(error,outcome,payload){
 const admitted=!types.isProxy(error)&&error instanceof CommandError&&['DEADLINE','CANCELLED','INVALID_COMMAND','COMMAND_PREPARATION_REFUSED','APPROVAL_METADATA_UNKNOWN'].includes(error.message)?error.message:'COMMAND_PREPARATION_REFUSED';
 return Object.assign(new CommandError(admitted),{outcome,...(payload?{metadataReference:data({proposalId:payload.record.proposalId,commandSha256:payload.commandSha256})}:{})});
}
export function createTaskCreateApprovalMetadataOwner(configuration){
 const {store,commandContext,preparePolicy,now=Date.now,newId=randomUUID,maxRequestMs=60000}=own(configuration,['store','commandContext','preparePolicy'],['now','newId','maxRequestMs']);
 const c=context(commandContext);
 if(typeof preparePolicy!=='function'||typeof now!=='function'||typeof newId!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>60000)deny('COMMAND_CONFIGURATION');
 const ports=own(store,['insert','read']);if(typeof ports.insert!=='function'||typeof ports.read!=='function')deny('COMMAND_CONFIGURATION');
 const insert=ports.insert.bind(store),readStored=ports.read.bind(store);
 function call(value,kind){
  const fields=kind==='prepare'?['operation','action','binding','request','input','inputSha256','deadlineMs','signal']:['proposalId','commandSha256','operation','action','binding','deadlineMs','signal'];
  const raw=own(value,fields),{signal,...json}=raw,v=data(json);nativeSignal(signal);selected({operation:v.operation,action:v.action,binding:v.binding},c);
  const at=now();if(!Number.isSafeInteger(at)||!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=at)deny('DEADLINE');
  if(kind==='prepare'){const normalized=input(v.request,c);if(!same(normalized,v.input)||canonicalSha256(normalized)!==v.inputSha256)deny('COMMAND_PREPARATION_REFUSED');}
  else assertReadIds(v);
  return {value:v,lifetime:createOperationLifetime({deadlineMs:Math.min(v.deadlineMs,at+maxRequestMs),now,signal,errorFactory:code=>new CommandError(code)})};
 }
 async function policy(l,phase,v,payload=null){
  const selection=policySelection(phase,v,payload),selectionSha256=canonicalSha256(selection),started=now();
  const raw=await l.run(signal=>preparePolicy({phase,selection,selectionSha256,signal,limitDeadline:l.limitDeadline}));
  const p=policyReceipt(raw,selection,started,now(),payload);l.limitDeadline(Math.min(p.expiresAtMs,instant(p.proposalExpiresAt)));l.check();return p;
 }
 async function prepare(value){
  let l,payload,attempted=false,stored=false;
  try{
   const admitted=call(value,'prepare'),v=admitted.value;l=admitted.lifetime;
   const p=await policy(l,'prepare',v);l.check();
   const at=now(),record={operation:v.operation,action:v.action,binding:v.binding,request:v.request,inputSha256:v.inputSha256,commandId:newId(),idempotencyKey:newId(),proposalId:newId(),scopes:p.scopes,createdAt:new Date(at).toISOString(),expiresAt:p.proposalExpiresAt,requiredApprover:p.requiredApprover};
   payload=makePayload(record,c);l.check();
   const ack=await l.run(()=>{l.check();attempted=true;return insert(payload,l.check);});
   if(!same(immutablePayload(ack),payload))deny('COMMAND_PREPARATION_REFUSED');stored=true;
   const current=await policy(l,'before_release',v,payload);l.check();return data({...record,checkedAtMs:current.checkedAtMs});
  }catch(error){throw safe(error,stored?'STORED_NOT_RELEASED':attempted?'UNKNOWN':'NOT_STORED',payload);}
  finally{l?.close();}
 }
 async function read(value){
  let l,payload;
  try{
   const admitted=call(value,'read'),v=admitted.value;l=admitted.lifetime;
   const pre=await policy(l,'before_read',v);
   const raw=await l.run(()=>readStored({tenantId:v.binding.tenantId,actorId:v.binding.actorId,proposalId:v.proposalId},l.check));
   if(raw===null)deny('COMMAND_PREPARATION_REFUSED');payload=immutablePayload(raw);
   if(!same(payload.commandContext,c)||!same(payload.record.binding,v.binding)||payload.record.proposalId.toLowerCase()!==v.proposalId.toLowerCase()||payload.commandSha256!==v.commandSha256||instant(payload.record.createdAt)>now())deny('COMMAND_PREPARATION_REFUSED');
   l.limitDeadline(instant(payload.record.expiresAt));
   if(!same(pre.scopes,payload.record.scopes)||!same(pre.requiredApprover,payload.record.requiredApprover)||pre.proposalExpiresAt!==payload.record.expiresAt)deny('COMMAND_PREPARATION_REFUSED');
   const current=await policy(l,'read_release',v,payload);l.check();return data({...payload.record,checkedAtMs:current.checkedAtMs});
  }catch(error){throw safe(error,'READ_UNAVAILABLE',payload);}
  finally{l?.close();}
 }
 return Object.freeze({prepare,read});
}
