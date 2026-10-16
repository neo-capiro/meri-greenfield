/** Task and action-item surface routes over the existing owners. Reads go through the injected `operationalReads` port, which the host
 * composes from the canonical gateway dispatcher (`query_tasks`, `query_action_items`) so that current authority, source admission and
 * budget stay with the gateway. These routes add only canonical input/page validation and binding correlation to the admitted member.
 * Task creation and update are not duplicated here: they remain the commands owner's approval-gated
 * `/api/action-followthrough/{draft,prepare,execute}` routes. */
import {assertActionItemClientScopedPage,assertActionItemReadInput,assertTaskReadInput,assertTaskReadPage} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ProductError,asProductError,productFailure,refuse} from '../product-access/errors.mjs';
export const TASK_ERROR_STATUSES=Object.freeze({TASKS_REQUEST_INVALID:400,TASKS_ACCESS_DENIED:403,TASKS_RESULT_INVALID:502,TASKS_UNAVAILABLE:503});
const valid=(fn,code)=>{try{return fn();}catch{refuse(code);}};
export function createTaskRoutes({operationalReads,now}){
 if(typeof operationalReads?.read!=='function'||typeof now!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 async function read(operation,{principal,body,signal,deadlineMs},validateInput,validatePage){
  const nowMs=now();
  valid(()=>validateInput(body,nowMs,principal),'TASKS_REQUEST_INVALID');
  let page;
  try{page=await operationalReads.read({operation,input:body,principal,signal,deadlineMs});}
  catch(error){throw productFailure(error)?.code==='ACCESS_DENIED'?new ProductError('TASKS_ACCESS_DENIED'):asProductError(error,'TASKS_UNAVAILABLE');}
  valid(()=>validatePage(page,body,nowMs,principal),'TASKS_RESULT_INVALID');
  // The gateway answered for a run binding; release it only to the same tenant and actor the membership gate admitted.
  if(page.binding.tenantId!==principal.tenantId||page.binding.actorId!==principal.actorId)refuse('TASKS_ACCESS_DENIED');
  return page;
 }
 const route=handle=>Object.freeze({handle,errors:TASK_ERROR_STATUSES});
 return Object.freeze({
  '/api/tasks/list':route(call=>read('query_tasks',call,
   (input,nowMs,p)=>assertTaskReadInput(input,{nowMs,actorId:p.actorId}),
   (page,input,nowMs,p)=>assertTaskReadPage(page,input,{nowMs,actorId:p.actorId}))),
  // Only the client-scoped action-item page has a validated contract; client-less listing is refused before dispatch.
  '/api/tasks/action-items':route(call=>read('query_action_items',call,
   (input,_,p)=>{if(assertActionItemReadInput(input,{actorId:p.actorId}).mode!=='client_scoped')throw Error('unscoped');},
   (page,input,_,p)=>assertActionItemClientScopedPage(page,input,{actorId:p.actorId}))),
 });
}
