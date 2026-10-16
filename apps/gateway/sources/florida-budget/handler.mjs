/** Existing Core read tool only; Core owns its Intel delegation and all current business guards. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {createRetainedHttpTransport} from '../retained-reads/http-transport.mjs';
import {retainedCall} from '../retained-reads/call-context.mjs';
import {projectFloridaBudget} from './projection.mjs';
export function createFloridaBudgetHandlers(configuration,operations){
 const transport=createRetainedHttpTransport(configuration),now=configuration.now;
 return operations.map(operation=>({operation,async execute(call){try{
  const c=retainedCall(operation,call,now);
  const native=await transport.read(c,{path:'/api/clio/tools/get_florida_budget_project',method:'POST',body:c.input,serviceSecret:true});
  const result=projectFloridaBudget(native,c.normalizationContext);
  c.contract.assertOutput(result,{request:c.request,...c.normalizationContext});
  if(c.signal?.aborted)deny('CANCELLED');if(now()>=c.deadlineMs)deny('DEADLINE');
  return JSON.stringify({binding:c.authority.binding,subject:c.authority.subject,operation,argumentsSha256:c.argumentsSha256,result});
 }catch(error){throw safeFailure(error);}}}));
}
