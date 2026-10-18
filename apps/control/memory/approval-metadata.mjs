/** Immutable approval metadata for conversational save_memory. Core owns approval and memory publication; this owner only
 * prepares and re-reads the exact pending command. It shares the existing approval_metadata relation with task commands, but
 * uses the memory contract instead of the task-only codec. */
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {canonicalSha256,assertProposalIntegrity,validateShape} from '../../../packages/contracts/validate.mjs';
import {normalizeMemoryProposeInput,assertMemoryProposeCommand,validateCommandShape} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {CommandError,data,deny,instant,nativeSignal,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';

export const MEMORY_COMMAND_OPERATION=Object.freeze({id:'save_memory',version:'0.2.0'});
const ACTION='memory.propose';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const subject=binding=>Object.freeze({tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId});
const selected=(value,context)=>{
 const v=own(data(value),['operation','action','binding']);
 if(!same(v.operation,MEMORY_COMMAND_OPERATION)||v.action!==ACTION||!same(v.binding,context.binding))deny('COMMAND_PREPARATION_REFUSED');
 return v;
};
const input=(request,context)=>{
 const raw=data(request);
 // The selected conversation client is a trusted run fact, never an argument supplied by a model tool call.
 if(Object.hasOwn(raw,'clientId'))deny('COMMAND_PREPARATION_REFUSED');
 return data({arguments:normalizeMemoryProposeInput(raw,context),attachments:[]});
};
function contextOf(value){const context=data(value);validateCommandShape('MemoryProposeContext',context);return context;}

/** Validate both domains of the retained hash: raw request → normalized command and command → exact proposal. */
export function memoryMetadataPayload(value){
 const p=own(data(value),['record','commandContext','commandSha256']),c=contextOf(p.commandContext);
 const r=own(p.record,['operation','action','binding','request','inputSha256','commandId','idempotencyKey','proposalId','scopes','createdAt','expiresAt','requiredApprover']);
 selected({operation:r.operation,action:r.action,binding:r.binding},c);
 const normalized=input(r.request,c);
 if(canonicalSha256(normalized)!==r.inputSha256)deny('COMMAND_PREPARATION_REFUSED');
 const command={contractVersion:'0.1.0',commandId:r.commandId,binding:r.binding,action:ACTION,arguments:normalized.arguments,
  attachments:[],scopes:r.scopes,idempotencyKey:r.idempotencyKey};
 assertMemoryProposeCommand(command,c);
 const proposal={proposalId:r.proposalId,command,commandSha256:canonicalSha256(command),createdAt:r.createdAt,expiresAt:r.expiresAt,
  requiredApprover:r.requiredApprover};
 assertProposalIntegrity(proposal);
 if(p.commandSha256!==proposal.commandSha256||instant(r.createdAt)>=instant(r.expiresAt)||r.requiredApprover.tenantId!==r.binding.tenantId)deny('COMMAND_PREPARATION_REFUSED');
 return data(p);
}
function makePayload(record,context){
 const normalized=input(record.request,context),command={contractVersion:'0.1.0',commandId:record.commandId,binding:record.binding,
  action:ACTION,arguments:normalized.arguments,attachments:[],scopes:record.scopes,idempotencyKey:record.idempotencyKey};
 return memoryMetadataPayload({record,commandContext:context,commandSha256:canonicalSha256(command)});
}
function safe(error,outcome,payload){
 const descriptor=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptor(error,'message'):undefined;
 const code=descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;
 const admitted=['DEADLINE','CANCELLED','INVALID_COMMAND','COMMAND_PREPARATION_REFUSED','APPROVAL_METADATA_UNKNOWN'].includes(code)?code:'COMMAND_PREPARATION_REFUSED';
 return Object.assign(new CommandError(admitted),{outcome,...(payload?{metadataReference:data({proposalId:payload.record.proposalId,commandSha256:payload.commandSha256})}:{})});
}
const statedOutcome=error=>{
 const d=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptor(error,'outcome'):undefined;
 return d&&Object.hasOwn(d,'value')?d.value:undefined;
};
function selection(phase,call,payload=null){return data({phase,operation:call.operation,action:call.action,binding:call.binding,
 request:payload?.record.request??call.request??null,inputSha256:payload?.record.inputSha256??call.inputSha256??null,
 proposalId:payload?.record.proposalId??call.proposalId??null,commandSha256:payload?.commandSha256??call.commandSha256??null,
 recordSha256:payload?canonicalSha256(payload):null});}
function policyReceipt(value,selectedCall,started,at,payload){
 const r=own(data(value),['authorized','selectionSha256','binding','scopes','requiredApprover','proposalExpiresAt','checkedAtMs','expiresAtMs']);
 if(r.authorized!==true||r.selectionSha256!==canonicalSha256(selectedCall)||!same(r.binding,selectedCall.binding)||
  !Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>at||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=at||
  instant(r.proposalExpiresAt)<=at)deny('COMMAND_PREPARATION_REFUSED');
 validateShape('Identity',r.requiredApprover);
 if(r.requiredApprover.tenantId!==r.binding.tenantId||!Array.isArray(r.scopes))deny('COMMAND_PREPARATION_REFUSED');
 for(const scope of r.scopes){validateShape('Scope',scope);if(scope.tenantId!==r.binding.tenantId)deny('COMMAND_PREPARATION_REFUSED');}
 if(payload&&(!same(r.scopes,payload.record.scopes)||!same(r.requiredApprover,payload.record.requiredApprover)||r.proposalExpiresAt!==payload.record.expiresAt))deny('COMMAND_PREPARATION_REFUSED');
 return r;
}

export function createMemoryApprovalMetadataOwner(configuration){
 const {store,commandContext,preparePolicy,retention,now=Date.now,newId=randomUUID,maxRequestMs=60000}=
  own(configuration,['store','commandContext','preparePolicy','retention'],['now','newId','maxRequestMs']);
 const c=contextOf(commandContext);
 if(typeof preparePolicy!=='function'||typeof retention?.assertServable!=='function'||typeof now!=='function'||typeof newId!=='function'||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>60000)deny('COMMAND_CONFIGURATION');
 const ports=own(store,['insert','read']);if(typeof ports.insert!=='function'||typeof ports.read!=='function')deny('COMMAND_CONFIGURATION');
 const checkSubject=()=>retention.assertServable(subject(c.binding));
 function call(value,kind){
  const fields=kind==='prepare'?['operation','action','binding','request','input','inputSha256','deadlineMs','signal']:
   ['proposalId','commandSha256','operation','action','binding','deadlineMs','signal'];
  const raw=own(value,fields),{signal,...json}=raw,v=data(json);nativeSignal(signal);
  selected({operation:v.operation,action:v.action,binding:v.binding},c);
  const at=now();if(!Number.isSafeInteger(at)||!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=at)deny('DEADLINE');
  if(kind==='prepare'){const normalized=input(v.request,c);if(!same(normalized,v.input)||canonicalSha256(normalized)!==v.inputSha256)deny('COMMAND_PREPARATION_REFUSED');}
  else if(!UUID.test(v.proposalId)||typeof v.commandSha256!=='string'||!/^[a-f0-9]{64}$/u.test(v.commandSha256))deny('COMMAND_PREPARATION_REFUSED');
  return {value:v,lifetime:createOperationLifetime({deadlineMs:Math.min(v.deadlineMs,at+maxRequestMs),now,signal,errorFactory:code=>new CommandError(code)})};
 }
 async function policy(l,phase,v,payload=null){
  const requested=selection(phase,v,payload),selectionSha256=canonicalSha256(requested),started=now();
  const receipt=policyReceipt(await l.run(signal=>preparePolicy({phase,selection:requested,selectionSha256,signal,limitDeadline:l.limitDeadline})),
   requested,started,now(),payload);
  l.limitDeadline(Math.min(receipt.expiresAtMs,instant(receipt.proposalExpiresAt)));l.check();return receipt;
 }
 async function prepare(value){
  let l,payload,attempted=false,stored=false;
  try{
   const admitted=call(value,'prepare'),v=admitted.value;l=admitted.lifetime;
   await l.run(checkSubject);const p=await policy(l,'prepare',v);l.check();
   const at=now(),record={operation:v.operation,action:v.action,binding:v.binding,request:v.request,inputSha256:v.inputSha256,
    commandId:newId(),idempotencyKey:newId(),proposalId:newId(),scopes:p.scopes,createdAt:new Date(at).toISOString(),
    expiresAt:p.proposalExpiresAt,requiredApprover:p.requiredApprover};
   payload=makePayload(record,c);l.check();
   const ack=await l.run(()=>{l.check();attempted=true;return ports.insert(payload,l.check);});
   if(!same(memoryMetadataPayload(ack),payload))deny('COMMAND_PREPARATION_REFUSED');stored=true;
   await l.run(checkSubject);const current=await policy(l,'before_release',v,payload);l.check();return data({...record,checkedAtMs:current.checkedAtMs});
  }catch(error){throw safe(error,stored?'STORED_NOT_RELEASED':statedOutcome(error)==='NOT_STORED'?'NOT_STORED':attempted?'UNKNOWN':'NOT_STORED',payload);}
  finally{l?.close();}
 }
 async function read(value){
  let l,payload;
  try{
   const admitted=call(value,'read'),v=admitted.value;l=admitted.lifetime;
   await l.run(checkSubject);const pre=await policy(l,'before_read',v);
   const raw=await l.run(()=>ports.read({tenantId:v.binding.tenantId,actorId:v.binding.actorId,proposalId:v.proposalId},l.check));
   if(raw===null)deny('COMMAND_PREPARATION_REFUSED');payload=memoryMetadataPayload(raw);
   selected({operation:payload.record.operation,action:payload.record.action,binding:payload.record.binding},c);
   if(!same(payload.commandContext,c)||!same(payload.record.binding,v.binding)||payload.record.proposalId.toLowerCase()!==v.proposalId.toLowerCase()||
    payload.commandSha256!==v.commandSha256||instant(payload.record.createdAt)>now())deny('COMMAND_PREPARATION_REFUSED');
   l.limitDeadline(instant(payload.record.expiresAt));
   if(!same(pre.scopes,payload.record.scopes)||!same(pre.requiredApprover,payload.record.requiredApprover)||pre.proposalExpiresAt!==payload.record.expiresAt)deny('COMMAND_PREPARATION_REFUSED');
   await l.run(checkSubject);const current=await policy(l,'read_release',v,payload);l.check();return data({...payload.record,checkedAtMs:current.checkedAtMs});
  }catch(error){throw safe(error,'READ_UNAVAILABLE',payload);}
  finally{l?.close();}
 }
 return Object.freeze({prepare,read});
}
