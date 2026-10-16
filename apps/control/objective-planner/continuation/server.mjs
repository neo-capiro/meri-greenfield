/** Trusted server entry. Browser/model selections cannot supply the producer's authentic run/job association or Core transport authority. */
import {own,data,continuationWork,coreDigest,fail} from './contract.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ProductError,productFailure} from '../../product-access/errors.mjs';
export function createObjectivePlannerServer({admission,dispatcher,core,now=Date.now,maxRequestMs=15000}){
 if(typeof admission?.available!=='function'||typeof admission?.check!=='function'||typeof core?.available!=='function'||typeof core?.inspect!=='function'||['start','read','stop'].some(k=>typeof dispatcher?.[k]!=='function')||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 const available=()=>admission.available()&&core.available();
 async function call(mode,value){
  const v=own(value,['work'],['signal','deadlineMs']),w=continuationWork(v.work);nativeSignal(v.signal);if(!available())fail('PRODUCER_UNAVAILABLE');
  const deadlineMs=Math.min(v.deadlineMs??now()+maxRequestMs,now()+maxRequestMs),life=createOperationLifetime({now,signal:v.signal,deadlineMs,errorFactory:code=>new ProductError('OBJECTIVE_PLANNER_'+code)});let dispatched=false,acknowledged=false;
  try{
   const before=await life.run(signal=>admission.check({work:w,phase:mode,signal,deadlineMs}));life.limitDeadline(before.expiresAtMs);
   const response=await life.run(signal=>{dispatched=mode!=='read';return dispatcher[mode]({work:w,signal,deadlineMs});});acknowledged=true;
   const after=await life.run(signal=>admission.check({work:w,phase:mode==='start'?'read':mode,signal,deadlineMs}));life.limitDeadline(after.expiresAtMs);
   if(before.workSha256!==after.workSha256||coreDigest(before.sourceBinding)!==coreDigest(after.sourceBinding)||before.sourceRequestSha256!==after.sourceRequestSha256)fail('CUSTODY_UNAVAILABLE');
   // Never release a cached Temporal ACK after Core now withholds creation output IDs. Return only fresh authorized creation data.
   const application=await life.run(signal=>core.inspect({work:w,signal,deadlineMs}));life.check();
   const state=response.state?own(response.state,['phase','prepareAttempted','stopRequested','ack']):undefined;
   if(state?.ack&&application.kind==='ack'&&coreDigest(state.ack)!==coreDigest(application.ack))fail('INVALID_RECEIPT');
   return data({workflowId:response.workflowId,workSha256:response.workSha256,...(state?{state:{phase:application.kind==='ack'?state.phase:'unavailable',prepareAttempted:state.prepareAttempted,stopRequested:state.stopRequested}}:{stopRequested:true}),application});
  }catch(error){if(productFailure(error)?.code==='OBJECTIVE_PLANNER_WORK_CONFLICT')throw error;if(dispatched)throw new ProductError(acknowledged?'OBJECTIVE_PLANNER_RESULT_NOT_RELEASED':'OBJECTIVE_PLANNER_TEMPORAL_UNKNOWN',acknowledged?'RESULT_NOT_RELEASED':'UNKNOWN');if(productFailure(error))throw error;fail('PRODUCER_UNAVAILABLE');}
  finally{life.close();}
 }
 return Object.freeze({available,start:value=>call('start',value),read:value=>call('read',value),stop:value=>call('stop',value)});
}
