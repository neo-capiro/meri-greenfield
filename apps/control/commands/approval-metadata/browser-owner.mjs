/** Immutable prepared-browser approval metadata. Prepares and reads ONE closed browser action proposal
 * in the existing approval_metadata table. It records provenance only: Core owns the human decision, the
 * one-time consumption and every effect, and this owner never mints a permit. */
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {nativeSignal} from '../protocol.mjs';
import {CommandError,data,deny,own,instant,canonicalSha256,immutablePayload,makePayload,assertReadIds,policySelection,policyReceipt,same} from './binding.mjs';
import {BROWSER_ACTION,BROWSER_ACTION_OPERATION,assertBrowserActionContext,assertBrowserApprovalPreparation,
 browserPreparationProposalId,normalizeBrowserActionArguments,sameBrowserPreparation} from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';

function safe(error,outcome,payload){
 const descriptor=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptor(error,'message'):undefined;
 const code=descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;
 const admitted=['DEADLINE','CANCELLED','INVALID_COMMAND','COMMAND_PREPARATION_REFUSED','APPROVAL_METADATA_UNKNOWN'];
 const message=admitted.includes(code)?code:(outcome==='UNKNOWN'?'APPROVAL_METADATA_UNKNOWN':'COMMAND_PREPARATION_REFUSED');
 // The stable code stays the contract; the underlying refusal is kept as a cause for diagnosis.
 return Object.assign(new CommandError(message),{cause:error,outcome,...(payload?{metadataReference:data({proposalId:payload.record.proposalId,commandSha256:payload.commandSha256})}:{})});
}
/** `preparePolicy` is the existing current-authority hook: it returns the canonical scopes, required
 * approver and proposal expiry for this exact binding, and refuses for a cancelled, successor or expired
 * run. No lock is held across a human wait or a browser effect. */
export function createBrowserActionApprovalMetadataOwner(configuration){
 const {store,preparePolicy,now=Date.now,newId=randomUUID,maxRequestMs=60000}=own(configuration,['store','preparePolicy'],['now','newId','maxRequestMs']);
 if(typeof preparePolicy!=='function'||typeof now!=='function'||typeof newId!=='function'||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>60000)deny('COMMAND_CONFIGURATION');
 const ports=own(store,['insert','read']);
 if(typeof ports.insert!=='function'||typeof ports.read!=='function')deny('COMMAND_CONFIGURATION');
 const insert=ports.insert.bind(store),readStored=ports.read.bind(store);

 function admitted(value){
  const raw=own(value,['operation','action','binding','request','deadlineMs'],['signal']);
  const {signal,...json}=raw,v=data(json);nativeSignal(signal);
  if(v.action!==BROWSER_ACTION||!same(v.operation,BROWSER_ACTION_OPERATION))deny('COMMAND_PREPARATION_REFUSED');
  // Every shape refusal is reported as the one stable preparation refusal, never a raw schema message.
  const shape=fn=>{try{return fn();}catch{deny('COMMAND_PREPARATION_REFUSED');}};
  shape(()=>validateShape('RunBinding',data(v.binding)));
  const at=now();
  if(!Number.isSafeInteger(at)||!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=at)deny('DEADLINE');
  const preparation=shape(()=>assertBrowserApprovalPreparation(v.request));
  if(!same(preparation.subject.binding,v.binding))deny('COMMAND_PREPARATION_REFUSED');
  if(preparation.expiresAtMs<=at||preparation.requestedAtMs>at)deny('COMMAND_PREPARATION_REFUSED');
  const proposalId=browserPreparationProposalId({binding:v.binding,toolUseId:preparation.subject.toolUseId});
  const normalized=normalizeBrowserActionArguments(preparation);
  const inputSha256=canonicalSha256(normalized);
  return {v,at,preparation,proposalId,inputSha256,signal,
   lifetime:createOperationLifetime({deadlineMs:Math.min(v.deadlineMs,at+maxRequestMs),now,signal,errorFactory:code=>new CommandError(code)})};
 }
 async function policy(l,phase,call,payload=null){
  const selection=policySelection(phase,call,payload),selectionSha256=canonicalSha256(selection),started=now();
  const raw=await l.run(signal=>preparePolicy({phase,selection,selectionSha256,signal,limitDeadline:l.limitDeadline}));
  const p=policyReceipt(raw,selection,started,now(),payload);
  l.limitDeadline(Math.min(p.expiresAtMs,instant(p.proposalExpiresAt)));l.check();return p;
 }
 async function prepare(value){
  let l,payload,attempted=false,storedOk=false;
  try{
   const a=admitted(value),v=a.v;l=a.lifetime;
   const key={tenantId:v.binding.tenantId,actorId:v.binding.actorId,proposalId:a.proposalId};
   // Identity is a selector, never proof: an existing row is always re-read and compared in full.
   const existing=await l.run(()=>readStored(key,l.check));
   if(existing!==null){
    const found=immutablePayload(existing);
    if(!same(found.record.binding,v.binding)||!sameBrowserPreparation(found.record.request,a.preparation)||
     found.record.action!==BROWSER_ACTION||canonicalSha256(found.record.request)!==canonicalSha256(a.preparation))deny('COMMAND_PREPARATION_REFUSED');
    l.check();return data({...found.record,checkedAtMs:now(),resolved:true});
   }
   const call={operation:v.operation,action:v.action,binding:v.binding,request:a.preparation,inputSha256:a.inputSha256,proposalId:a.proposalId};
   const p=await policy(l,'prepare',call);l.check();
   const c=assertBrowserActionContext({binding:v.binding,scopes:p.scopes,requiredApprover:p.requiredApprover});
   const record={operation:v.operation,action:v.action,binding:v.binding,request:a.preparation,inputSha256:a.inputSha256,
    commandId:newId(),idempotencyKey:newId(),proposalId:a.proposalId,scopes:c.scopes,createdAt:new Date(a.at).toISOString(),
    expiresAt:new Date(Math.min(a.preparation.expiresAtMs,instant(p.proposalExpiresAt))).toISOString(),requiredApprover:c.requiredApprover};
   payload=makePayload(record,c);l.check();
   const ack=await l.run(()=>{l.check();attempted=true;return insert(payload,l.check);});
   if(!same(immutablePayload(ack),payload))deny('COMMAND_PREPARATION_REFUSED');storedOk=true;
   const current=await policy(l,'before_release',call,payload);l.check();
   return data({...payload.record,checkedAtMs:current.checkedAtMs,resolved:false});
  }catch(error){
   // A refused preparation keeps its exact refusal; any other failure after an attempted write is an
   // UNKNOWN outcome reconciled by READING the same identity, never by writing a new proposal.
   const code=typeof error?.code==='string'?error.code:error?.message;
   const refused=['DEADLINE','CANCELLED','INVALID_COMMAND','COMMAND_PREPARATION_REFUSED'].includes(code);
   const outcome=refused?(storedOk?'STORED_NOT_RELEASED':'NOT_STORED'):(attempted?'UNKNOWN':'NOT_STORED');
   throw safe(error,outcome,payload);
  }finally{l?.close();}
 }
 async function read(value){
  let l,payload;
  try{
   const raw=own(value,['proposalId','commandSha256','operation','action','binding','deadlineMs'],['signal']);
   const {signal,...json}=raw,v=data(json);nativeSignal(signal);
   if(v.action!==BROWSER_ACTION||!same(v.operation,BROWSER_ACTION_OPERATION))deny('COMMAND_PREPARATION_REFUSED');
   try{validateShape('RunBinding',data(v.binding));}catch{deny('COMMAND_PREPARATION_REFUSED');}
   const at=now();if(!Number.isSafeInteger(at)||!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=at)deny('DEADLINE');
   assertReadIds(v);
   l=createOperationLifetime({deadlineMs:Math.min(v.deadlineMs,at+maxRequestMs),now,signal,errorFactory:code=>new CommandError(code)});
   const pre=await policy(l,'before_read',v);
   const stored=await l.run(()=>readStored({tenantId:v.binding.tenantId,actorId:v.binding.actorId,proposalId:v.proposalId},l.check));
   if(stored===null)deny('COMMAND_PREPARATION_REFUSED');
   payload=immutablePayload(stored);
   if(payload.record.action!==BROWSER_ACTION||!same(payload.record.binding,v.binding)||
    payload.record.proposalId.toLowerCase()!==v.proposalId.toLowerCase()||payload.commandSha256!==v.commandSha256||
    instant(payload.record.expiresAt)<=at)deny('COMMAND_PREPARATION_REFUSED');
   const preparation=assertBrowserApprovalPreparation(payload.record.request);
   const expected=browserPreparationProposalId({binding:payload.record.binding,toolUseId:preparation.subject.toolUseId});
   if(expected!==payload.record.proposalId)deny('COMMAND_PREPARATION_REFUSED');
   l.limitDeadline(instant(payload.record.expiresAt));
   if(!same(pre.scopes,payload.record.scopes)||!same(pre.requiredApprover,payload.record.requiredApprover)||
    pre.proposalExpiresAt!==payload.record.expiresAt)deny('COMMAND_PREPARATION_REFUSED');
   const current=await policy(l,'read_release',v,payload);l.check();
   return data({...payload.record,checkedAtMs:current.checkedAtMs});
  }catch(error){throw safe(error,'READ_UNAVAILABLE',payload);}
  finally{l?.close();}
 }
 return Object.freeze({prepare,read,action:BROWSER_ACTION});
}
