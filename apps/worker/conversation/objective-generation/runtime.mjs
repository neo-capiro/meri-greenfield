/** Optional owner for ONE existing query. Reads protected issued facts; never accepts request/model configuration as authority. */
import {own,data,hash,issuedObjectiveSelection,objectiveCompletionId,typedFault} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {loadObjectiveStrategyCodec} from './typed-result.mjs';
import {writeObjectiveResultFile} from './fixed-file.mjs';
const refuse=()=>{throw typedFault();},same=(a,b)=>hash(a)===hash(b);
export function createObjectiveGenerationRuntime({preparedFacts,querySelection,now=Date.now,codec=loadObjectiveStrategyCodec,writeFile=writeObjectiveResultFile,maxRequestMs=3000}){
 const read=storageMethod(preparedFacts,'read');if(typeof now!=='function'||typeof codec!=='function'||typeof writeFile!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 const readQuery=querySelection===undefined?null:storageMethod(querySelection,'read');
 async function prepare(value){
  const v=own(value,['binding','request','versions','scopes','cwd','model','deadlineMs'],['signal','proxyUrl','proxyCredentialSha256']),life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs,now()+maxRequestMs),errorFactory:typedFault});
  try{
   const entry=data(await life.run(signal=>read({binding:v.binding,signal})));life.check();
   if(entry.objectiveGeneration===undefined&&entry.objectiveStrategy===undefined)return null;
   const selected=issuedObjectiveSelection(entry,{binding:v.binding,acceptedRequest:v.request}),issuance=entry.issuance,admission=entry.objectiveGeneration.sourceAdmission,s=selected.strategy,r=s.request;
   if(issuance.expiresAtMs<=now()||s.executionSelection.model!==v.model)refuse();
   if(!readQuery)throw Error('OBJECTIVE_QUERY_SELECTION_UNAVAILABLE');
   let proxy;try{proxy=new URL(v.proxyUrl);}catch{refuse();}if(proxy.protocol!=='https:'||proxy.username||proxy.password||proxy.search||proxy.hash||typeof v.proxyCredentialSha256!=='string'||!/^[a-f0-9]{64}$/u.test(v.proxyCredentialSha256))refuse();
   const query=data({binding:v.binding,sourceRequestSha256:hash(v.request),proxyUrl:proxy.href,proxyCredentialSha256:v.proxyCredentialSha256});
   let deadlineMs=Math.min(v.deadlineMs,issuance.expiresAtMs,admission.effectExpiresAtMs,r.originalExpiresAtMs);
   async function actualSelection(operation){const started=now(),observed=data(own(await operation.run(signal=>readQuery({...query,signal})),['binding','sourceRequestSha256','proxyUrl','proxyCredentialSha256','provider','model','checkedAtMs','expiresAtMs']));
    if(!same(observed.binding,query.binding)||observed.sourceRequestSha256!==query.sourceRequestSha256||observed.proxyUrl!==query.proxyUrl||observed.proxyCredentialSha256!==query.proxyCredentialSha256||!same({provider:observed.provider,model:observed.model},s.executionSelection)||observed.model!==v.model||!Number.isSafeInteger(observed.checkedAtMs)||observed.checkedAtMs<started||observed.checkedAtMs>now()||!Number.isSafeInteger(observed.expiresAtMs)||observed.expiresAtMs<=now())refuse();deadlineMs=Math.min(deadlineMs,observed.expiresAtMs);operation.limitDeadline(deadlineMs);operation.check();return data({provider:observed.provider,model:observed.model});}
   let actualExecution=await actualSelection(life);
   const selectedCodec=await life.run(()=>codec(r)),selection=selectedCodec.selection(selected);
   if(!Number.isSafeInteger(deadlineMs)||deadlineMs<=now())refuse();let captured=false;
   return Object.freeze({outputFormat:selectedCodec.outputFormat(),deadlineMs,async capture({sdkResult,signal}){
    if(captured||signal?.aborted||now()>=deadlineMs)refuse();captured=true;
    const captureLife=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+maxRequestMs),errorFactory:typedFault});
    try{const current=data(await captureLife.run(signal=>read({binding:v.binding,signal})));if(!same(current,entry))refuse();actualExecution=await actualSelection(captureLife);
     const ref=objectiveCompletionId(v.binding),output=selectedCodec.encode({selection,executionSelection:actualExecution,sdkResult,sessionId:sdkResult.session_id,receiptRef:ref,resultRef:ref,completedAtMs:now()});
     await captureLife.run(signal=>writeFile({cwd:v.cwd,bytes:output.bytes,descriptor:output.descriptor,signal}));captureLife.check();return output.descriptor;
    }finally{captureLife.close();}
   }});
  }finally{life.close();}
 }
 return Object.freeze({prepare});
}
