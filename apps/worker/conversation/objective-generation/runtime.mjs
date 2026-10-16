/** Optional owner for ONE existing query. Reads protected issued facts; never accepts request/model configuration as authority. */
import {own,data,hash,issuedObjectiveSelection,objectiveCompletionId,typedFault} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {loadTypedDraftCodec} from './typed-result.mjs';
import {writeObjectiveResultFile} from './fixed-file.mjs';
const refuse=()=>{throw typedFault();},same=(a,b)=>hash(a)===hash(b);
export function createObjectiveGenerationRuntime({preparedFacts,now=Date.now,codec=loadTypedDraftCodec,writeFile=writeObjectiveResultFile,maxRequestMs=3000}){
 const read=storageMethod(preparedFacts,'read');if(typeof now!=='function'||typeof codec!=='function'||typeof writeFile!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 async function prepare(value){
  const v=own(value,['binding','request','versions','scopes','cwd','model','deadlineMs'],['signal']),life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs,now()+maxRequestMs),errorFactory:typedFault});
  try{
   const entry=data(await life.run(signal=>read({binding:v.binding,signal})));life.check();
   if(entry.objectiveGeneration===undefined&&entry.objectiveStrategy===undefined)return null;
   const selected=issuedObjectiveSelection(entry,{binding:v.binding,acceptedRequest:v.request}),issuance=entry.issuance,admission=entry.objectiveGeneration.sourceAdmission,s=selected.strategy,r=s.request;
   if(issuance.expiresAtMs<=now()||s.executionSelection.model!==v.model)refuse();
   const selectedCodec=await life.run(()=>codec()),selection=selectedCodec.selection(selected);
   const deadlineMs=Math.min(v.deadlineMs,issuance.expiresAtMs,admission.effectExpiresAtMs,r.originalExpiresAtMs);if(!Number.isSafeInteger(deadlineMs)||deadlineMs<=now())refuse();let captured=false;
   return Object.freeze({outputFormat:selectedCodec.outputFormat(),deadlineMs,async capture({sdkResult,signal}){
    if(captured||signal?.aborted||now()>=deadlineMs)refuse();captured=true;
    const captureLife=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+maxRequestMs),errorFactory:typedFault});
    try{const current=data(await captureLife.run(signal=>read({binding:v.binding,signal})));if(!same(current,entry))refuse();
     const ref=objectiveCompletionId(v.binding),output=selectedCodec.encode({selection,sdkResult,sessionId:sdkResult.session_id,receiptRef:ref,resultRef:ref,completedAtMs:now()});
     await captureLife.run(signal=>writeFile({cwd:v.cwd,bytes:output.bytes,descriptor:output.descriptor,signal}));captureLife.check();return output.descriptor;
    }finally{captureLife.close();}
   }});
  }finally{life.close();}
 }
 return Object.freeze({prepare});
}
