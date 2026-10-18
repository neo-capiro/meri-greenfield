/** Existing tool API over the shared trusted durable execution composition. */
import {createToolDispatch} from '../dispatch/tool-dispatch.mjs';
import {deny} from '../dispatch/operation-result.mjs';
import {composeBudgetExecution} from './tool-budget-execution.mjs';
export function composeToolBudgetDispatch({owner,producer,allocationJson,...options}){
 if(Object.hasOwn(options,'budget'))deny('GATEWAY_CONFIGURATION');
 return composeBudgetExecution({owner,producer,allocationJson,authority:options.authority,limits:options.limits,now:options.now,
  createExecutor:(ports,call)=>createToolDispatch({...options,...ports,...(call?.invocationId===undefined?{}:{invocationId:call.invocationId})})});
}
