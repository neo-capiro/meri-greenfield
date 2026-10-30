/** Structured completion adapter; the existing activity still owns the full SDK query. */
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertOutreachRequest,outreachIdentity,outreachFailure} from '../../../packages/runtime/outreach-generation.mjs';
export function createOutreachGenerationRuntime({selection,complete,fail}){
 return Object.freeze({async prepare({binding,request,scopes,model,signal}){
  const raw=await selection.read({binding,signal});if(raw===null)return null;
  const client=scopes.length===1&&scopes[0].kind==='client'?scopes[0].resourceId:null;
  const current=assertOutreachRequest(raw,{binding,request,selectedClientId:client});let attempted=false,settled=false;
  return Object.freeze({outputFormat:{type:'json_schema',schema:current.outputSchema},
   async capture({sdkResult,signal}){
    if(attempted||settled||sdkResult?.type!=='result'||sdkResult.subtype!=='success'||sdkResult.is_error!==false)throw outreachFailure();
    const output=data(own(sdkResult.structured_output,['plan','draft']));
    attempted=true;const result=await complete({binding,...outreachIdentity(current),output,model,signal});
    if(!['done','held','failed'].includes(result?.status))throw outreachFailure();settled=true;
   },
   async failed({signal}){if(settled)return;settled=true;await fail({binding,...outreachIdentity(current),errorCode:attempted?'generation_unknown':'generation_failed',signal});},
  });
 }});
}
