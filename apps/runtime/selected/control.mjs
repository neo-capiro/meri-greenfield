/** Trusted passive mediation. Existing compiler/output owners retain all real brands. */
import {randomUUID} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertSelectedRequest} from '../../../packages/contracts/runtime-0.2/selected.mjs';
import {createSelectedSkillExecutionRuntime} from '../../worker/conversation/skills/selected-runtime.mjs';
import {createOriginalSelectedSkillExecution} from '../../control/conversations/skills/execution.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {fault} from '../config.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
const hash=canonicalSha256,same=(a,b)=>hash(a)===hash(b);
export function createSelectedControl(configuration){
 const c=own(configuration,['executionOptions','loadCurrentTask','ledger','now'],['sourceEnabled']);if(typeof c.loadCurrentTask!=='function'||typeof c.now!=='function'||typeof(c.sourceEnabled??false)!=='boolean')throw fault('SELECTED_CONTROL_CONFIGURATION');
 const options=own(c.executionOptions,['admissionForBinding','gatewayForBinding','readSelection','readContext','publishForBinding','retention','defaultCongress'],['outputBridge','readBase','readRevisionBase','now','runtimeFactory']);
 const ledger=Object.freeze({claim:storageMethod(c.ledger,'claim'),retain:storageMethod(c.ledger,'retain'),unknown:storageMethod(c.ledger,'unknown')});
 const records=new Map();let closed=false;
 const execution=createOriginalSelectedSkillExecution({...options,now:c.now,runtimeFactory:async args=>{
  const gateway=args.gateway,selector={binding:args.binding,requestSha256:hash(args.request),selectionSha256:hash(args.selection)};
  const execute=async value=>{const {signal,...raw}=value,request=data(raw),delivery={...selector,operation:request.operation,arguments:request.arguments,deliveryId:request.deliveryId};
   const claimed=await ledger.claim(delivery,{signal});if(!claimed.claimed)throw fault('SELECTED_READ_NOT_REDISPATCHED');
   try{const result=await gateway.execute(value);await ledger.retain(delivery,result,{signal});return result;}catch(error){await ledger.unknown(delivery).catch(()=>{});throw error;}
  };
  return createSelectedSkillExecutionRuntime({...args,gateway:{execute}});
 }});
 async function withTask(operation,raw,capability,signal,body){if(closed)throw fault('SELECTED_CONTROL_CLOSED');if(c.sourceEnabled!==true)throw fault('UNAVAILABLE');nativeSignal(signal);const input=assertSelectedRequest(operation,raw),life=createOperationLifetime({deadlineMs:c.now()+3000,now:c.now,signal,errorFactory:fault});let pinned;
  async function fresh(){const started=c.now(),task=data(await life.run(signal=>c.loadCurrentTask({capability,binding:input.binding,requestSha256:input.requestSha256,inputSha256:hash(input),operation,signal})));own(task,['binding','versions','request','scopes','selectedClientId','checkedAtMs','expiresAtMs']);
   if(!same(task.binding,input.binding)||hash(task.request)!==input.requestSha256||task.checkedAtMs<started||task.checkedAtMs>c.now()||!Number.isSafeInteger(task.checkedAtMs)||!Number.isSafeInteger(task.expiresAtMs)||task.expiresAtMs<=c.now())throw fault('SELECTED_TASK_AUTHORITY_REFUSED');
   const stable={binding:task.binding,versions:task.versions,request:task.request,scopes:task.scopes,selectedClientId:task.selectedClientId};if(pinned&&!same(pinned,stable))throw fault('SELECTED_TASK_AUTHORITY_CHANGED');pinned??=stable;life.limitDeadline(task.expiresAtMs);return task;
  }
  let result;try{const task=await fresh();result=await body(input,task,life,fresh);await fresh();life.check();return result;}catch(error){if(operation==='prepare'&&result?.sessionId){const r=records.get(result.sessionId);records.delete(result.sessionId);r?.controller.abort();await r?.runtime.close();}throw error;}finally{life.close();}
 }
 async function handle(operation,input,capability,signal){return withTask(operation,input,capability,signal,async(i,task,life,fresh)=>{
  if(operation==='prepare'){if(records.size>=64)throw fault('SELECTED_SESSION_LIMIT');const controller=new AbortController(),abort=()=>controller.abort(life.signal.reason);life.signal.addEventListener('abort',abort,{once:true});let runtime;
   try{runtime=await life.run(()=>execution.selectedSkills.prepare({binding:task.binding,versions:task.versions,request:task.request,scopes:task.scopes,signal:controller.signal}));life.check();}catch(error){controller.abort();throw error;}finally{life.signal.removeEventListener('abort',abort);}
   const sessionId=randomUUID(),selection=runtime.selection,record={runtime,controller,task,sessionId,selection,completion:null,inputSha256:null,output:null};records.set(sessionId,record);return {sessionId,binding:task.binding,requestSha256:i.requestSha256,selection,checkedAtMs:c.now(),expiresAtMs:task.expiresAtMs};}
  const r=records.get(i.sessionId);if(!r||r.task.expiresAtMs<=c.now()||!same(r.task.binding,task.binding)||!same(r.task.versions,task.versions)||!same(r.task.request,task.request)||!same(r.task.scopes,task.scopes)||r.task.selectedClientId!==task.selectedClientId||hash(r.selection)!==i.selectionSha256)throw fault('SELECTED_SESSION_REFUSED');
  if(operation==='read'){await fresh();const result=await life.run(signal=>r.runtime.read(i.operation,i.arguments,signal,i.deliveryId));await fresh();return {result};}
  if(operation==='finish'){const sha=hash(i.structuredOutput);if(r.inputSha256!==null&&r.inputSha256!==sha)throw fault('SKILL_OUTPUT_REPLAY_REFUSED');r.inputSha256=sha;
   if(!r.completion){r.output=await life.run(()=>r.runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:i.structuredOutput}));r.completion={completionId:randomUUID(),binding:task.binding,state:r.output.state,requestSha256:i.requestSha256,selectionSha256:i.selectionSha256,inputSha256:sha,preparationSha256:r.output.preparationSha256,readsSha256:hash(r.runtime.receipts())};}
   return data(r.completion);
  }
  if(!r.completion||i.completionId!==r.completion.completionId)throw fault('SELECTED_COMPLETION_REFUSED');await execution.selectedSkills.publish({binding:task.binding,output:r.output,signal:life.signal});await fresh();return {published:true};
 });}
 return Object.freeze({handle,publication:execution.publication,async close(){if(closed)return;closed=true;for(const record of records.values())record.controller.abort();try{await execution.close();}finally{records.clear();}}});
}
