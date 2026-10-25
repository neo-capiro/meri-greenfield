/** Explicit recommendation draft and source validation; native task preparation remains with the intent journal. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {normalizeTaskCreateInput} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {CommandError,data,own,deny,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {same,uuid,selection,selectedRead,makeDraft,draft as admittedDraft} from './selection.mjs';
export function createActionFollowthrough(configuration){
 const {lookup,readContext,selectedClientId,commandContext:rawCommandContext,now,limits}=own(configuration,['lookup','readContext','selectedClientId','commandContext','now','limits']);
 const {read}=own(lookup,['read'],['lookup']);if(typeof read!=='function'||typeof now!=='function')deny('FOLLOWTHROUGH_CONFIGURATION');
 const context=data(readContext),clientId=uuid(selectedClientId),bounds=data(limits);
 own(context,['currentBinding','scopes','deadlineMs']);validateShape('RunBinding',context.currentBinding);own(bounds,['maxRequestMs','maxFactBytes']);
 if(!Number.isSafeInteger(bounds.maxRequestMs)||bounds.maxRequestMs<1||bounds.maxRequestMs>60000||!Number.isSafeInteger(bounds.maxFactBytes)||bounds.maxFactBytes<1||bounds.maxFactBytes>16*1024*1024||!Number.isSafeInteger(context.deadlineMs)||!Array.isArray(context.scopes)||!context.scopes.length)deny('FOLLOWTHROUGH_CONFIGURATION');
 for(const scope of context.scopes){validateShape('Scope',scope);if(scope.tenantId!==context.currentBinding.tenantId)deny('FOLLOWTHROUGH_CONFIGURATION');}
 if(!context.scopes.some(s=>s.kind==='client'&&s.resourceId.toLowerCase()===clientId))deny('FOLLOWTHROUGH_CONFIGURATION');
 const commandContext=data(rawCommandContext);
 if(!same(commandContext.binding,context.currentBinding)||commandContext.clientResolution?.reference!==clientId||commandContext.clientResolution?.clientId!==clientId)deny('FOLLOWTHROUGH_CONFIGURATION');
 normalizeTaskCreateInput({title:'Configuration validation',clientId,dueDate:null},commandContext);
 function check(lifetime,cutoff){const at=now();if(!Number.isSafeInteger(at)||at>=cutoff)deny('DEADLINE');lifetime.check();if(lifetime.signal.aborted)deny('CANCELLED');}
 async function run(signal,body){
  nativeSignal(signal);const started=now();if(!Number.isSafeInteger(started)||started<0)deny('FOLLOWTHROUGH_CLOCK');
  const cutoff=Math.min(context.deadlineMs,started+bounds.maxRequestMs),l=createOperationLifetime({deadlineMs:cutoff,now,signal,errorFactory:code=>new CommandError(code)});
  try{check(l,cutoff);const value=await body(l,cutoff);check(l,cutoff);return data(value);}finally{l.close();}
 }
 async function readSelection(wanted,l,cutoff){
  const value=await l.run(signal=>read.call(lookup,{resultReference:wanted.resultReference,context:{...context,deadlineMs:cutoff},signal}));check(l,cutoff);
  return selectedRead(value,wanted,context,clientId,bounds.maxFactBytes);
 }
 async function draft(value,edits={},extra={}){
  const wanted=selection(value),changes=data(own(edits,[],['title','dueDate'])),{signal}=own(extra,[],['signal']);
  return run(signal,async(l,cutoff)=>makeDraft(await readSelection(wanted,l,cutoff),changes,commandContext));
 }
 async function validate(value,extra={}){
  const d=admittedDraft(value,commandContext),{signal}=own(extra,[],['signal']);
  return run(signal,async(l,cutoff)=>{
   const wanted=selection({resultReference:d.source.resultReference,resultSha256:d.source.resultSha256,actionId:d.source.actionId});
   const selected=await readSelection(wanted,l,cutoff);
   if(!same(selected.source,d.source)||!same(selected.recommendation,d.recommendation))deny('FOLLOWTHROUGH_SOURCE');
   check(l,cutoff);
   return d;
  });
 }
 return Object.freeze({draft,validate});
}
