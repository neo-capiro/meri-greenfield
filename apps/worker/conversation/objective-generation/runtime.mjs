/** Typed output for the same SDK query, selected by the existing accepted run owner. */
import {own,data,hash,assertPreparedObjectiveSelection,typedFault} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {loadObjectiveStrategyCodec} from './typed-result.mjs';
import {writeObjectiveResultFile} from './fixed-file.mjs';
const refuse=()=>{throw typedFault();},same=(a,b)=>hash(a)===hash(b);
export function createObjectiveGenerationRuntime({selection,now=Date.now,codec=loadObjectiveStrategyCodec,writeFile=writeObjectiveResultFile,maxRequestMs=3000}){
 const read=storageMethod(selection,'read');if(typeof now!=='function'||typeof codec!=='function'||typeof writeFile!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 async function prepare(value){
  const v=own(value,['binding','request','versions','scopes','cwd','model','deadlineMs'],['signal']),life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs,now()+maxRequestMs),errorFactory:typedFault});
  try{
   const raw=await life.run(signal=>read({binding:v.binding,signal}));if(raw===null)return null;
   const entry=data(own(raw,['objectiveGeneration','objectiveStrategy','expiresAtMs']));
   const selected=assertPreparedObjectiveSelection({objectiveGeneration:entry.objectiveGeneration,objectiveStrategy:entry.objectiveStrategy},{binding:v.binding,acceptedRequest:v.request,expiresAtMs:entry.expiresAtMs,nowMs:now()});
   if(selected.strategy.executionSelection.model!==v.model)refuse();
   const deadlineMs=Math.min(v.deadlineMs,entry.expiresAtMs);life.limitDeadline(deadlineMs);
   const selectedCodec=await life.run(()=>codec(selected.strategy.request)),bound=selectedCodec.selection(selected);let captured=false;
   return Object.freeze({outputFormat:selectedCodec.outputFormat(),deadlineMs,async capture({sdkResult,signal}){
    if(captured||signal?.aborted||now()>=deadlineMs)refuse();captured=true;
    const captureLife=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+maxRequestMs),errorFactory:typedFault});
    try{const current=await captureLife.run(signal=>read({binding:v.binding,signal}));if(current===null||!same(current,entry))refuse();
     // The existing native completion identity is the run ID, not an old workspace-checkpoint identity.
     const ref=v.binding.runId,output=selectedCodec.encode({selection:bound,executionSelection:selected.strategy.executionSelection,sdkResult,sessionId:sdkResult.session_id,receiptRef:ref,resultRef:ref,completedAtMs:now()});
     await captureLife.run(signal=>writeFile({cwd:v.cwd,bytes:output.bytes,descriptor:output.descriptor,signal}));captureLife.check();return output.descriptor;
    }finally{captureLife.close();}
   }});
  }finally{life.close();}
 }
 return Object.freeze({prepare});
}
