/** Native stored public reports; current authorization and accounting remain with dispatch. */
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields} from '../source-admission.mjs';
import {createRetainedHttpTransport} from '../retained-reads/http-transport.mjs';
import {retainedCall} from '../retained-reads/call-context.mjs';

export function createPublicReportsHandlers(configuration,operations){
 const options=ownFields(configuration,['origin','now'],['getCredentials','fetchImpl','maxRequestMs','maxResponseBytes']);
 const transport=createRetainedHttpTransport(options),now=options.now;
 return operations.map(operation=>{
  const {binding}=resolveOperationContract(operation);
  if(binding.group!=='public-reports')deny('GATEWAY_CONFIGURATION');
  const path=`/api/clio/tools/${binding.nativeId}`;
  return {operation,async execute(call){try{
   const c=retainedCall(operation,call,now);
   // Native normalization must run once. The original admitted request retains
   // CBO's pre-lowercase note label and trim/cap boundaries for every search.
   const result=await transport.read(c,{path,method:'POST',body:c.request,serviceSecret:true});
   try{c.contract.assertOutput(result,{request:c.request,...c.normalizationContext});}
   catch{deny('INVALID_RESULT');}
   if(c.signal?.aborted)deny('CANCELLED');if(now()>=c.deadlineMs)deny('DEADLINE');
   return JSON.stringify({binding:c.authority.binding,subject:c.authority.subject,operation,argumentsSha256:c.argumentsSha256,result});
  }catch(error){throw safeFailure(error);}}};
 });
}
