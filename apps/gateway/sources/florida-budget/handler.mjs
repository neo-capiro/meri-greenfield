/** Existing Core/Intel owner and typed projection; native current context is required. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {projectFloridaBudget} from './projection.mjs';
export function createFloridaBudgetHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'florida-budget',
  routes:{get_florida_budget_project:'/api/clio/tools/get_florida_budget_project'},
  requestBody:current=>current.input,
  resultBody:(current,result)=>projectFloridaBudget(result,current.normalizationContext),
  requirePerCall:()=>true});
}
