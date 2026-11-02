/** Reconcile a logical execution. Terminal fencing precedes stop-only cleanup; a warm settled session stays running. */
import {randomUUID} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {bounded,same,own,fail,terminal,validateShape} from './boundary.mjs';
import {HOLD_CHECKPOINT_FAILED} from './lifecycle/journal.mjs';
import {executionOutcomeSettled} from './execution-boundary.mjs';
export const ATTEMPT_LOST='ATTEMPT_LOST';
const unknownReasons=new Set(['STOP_ACCESS_DENIED','STOP_UNAUTHORIZED','STOP_THROTTLED','STOP_CONFLICT','STOP_SERVICE_ERROR',
 'STOP_RUNTIME_ERROR','STOP_QUOTA_EXCEEDED','STOP_VALIDATION_ERROR','STOP_RESPONSE_REFUSED','STOP_INTERRUPTED','STOP_PROVIDER_OTHER',
 'STOP_TRANSPORT_UNKNOWN','STOP_SESSION_NOT_FOUND','STOP_NOT_FOUND_UNCONFIRMED','STOP_CALL_FAILED','STOP_RECEIPT_REFUSED',
 'STOP_READ_FAILED','STOP_SETTLEMENT_FAILED','EXECUTION_UNSETTLED','EXECUTION_MISSING','RECONCILE_ERROR']);
/** A closed vocabulary for the counts-only settlement event; never copy arbitrary exception text or codes to logs. */
export const settlementUnknownReason=value=>unknownReasons.has(value)?value:'RECONCILE_ERROR';
const checkpointed=state=>state==='paused'||state==='waiting-for-approval';
export function createRunReconciler({store,stopExecution,now=Date.now,newId=randomUUID,maxReconcileMs=60000}){
 if(['read','append'].some(k=>typeof store?.[k]!=='function')||['requestStop','settleStopped'].some(k=>typeof store?.executions?.[k]!=='function')||typeof stopExecution!=='function'||typeof now!=='function'||typeof newId!=='function'||!Number.isSafeInteger(maxReconcileMs)||maxReconcileMs<1||maxReconcileMs>120000)fail('RECONCILE_CONFIGURATION');
 async function reconcile({binding,signal}={}){
  const b=bounded(binding);validateShape('RunBinding',b);nativeSignal(signal);
  const life=createOperationLifetime({deadlineMs:now()+maxReconcileMs,now,signal,errorFactory:()=>Object.assign(Error('RECONCILE_UNKNOWN'),{code:'RECONCILE_UNKNOWN'})});
  const read=async()=>(await life.run(()=>store.read(b,{after:0,limit:1},life.check))).run;
  const write=(run,reasonCode)=>life.run(()=>store.append(b,{eventId:newId(),createdAt:new Date(now()).toISOString(),type:'run.status',data:{state:'failed',reasonCode}},life.check,run.scopes));
  async function fence(run){
   for(const reasonCode of [ATTEMPT_LOST,HOLD_CHECKPOINT_FAILED]){
    try{await write(run,reasonCode);return reasonCode;}
    catch(error){life.check();const current=await read();if(terminal(current.state)||checkpointed(current.state))return null;if(error?.code!=='RUN_HELD'&&error?.code!=='HOLD_FAILURE_REFUSED')throw error;}
   }
   fail('RECONCILE_REFUSED');
  }
  try{
   let run=await read(),reasonCode=terminal(run.state)||checkpointed(run.state)?null:await fence(run);run=await read();
   // The same lock prevents a later claim. Stopping blocks both SDK completion and successor admission while AWS is uncertain.
   const saved=await life.run(()=>store.executions.requestStop(b,life.check));
   if(saved.dispatch){
    const record=saved.record;
    let step='STOP_CALL_FAILED';
    try{
     const result=await life.run(signal=>stopExecution({binding:b,executionId:record.executionId,runtimeSessionId:record.runtimeSessionId,signal}));
     step='STOP_RECEIPT_REFUSED';const receipt=own(bounded(result),['binding','executionId','runtimeSessionId','stopped']);
     if(!same(receipt.binding,b)||receipt.executionId!==record.executionId||receipt.runtimeSessionId!==record.runtimeSessionId||receipt.stopped!==true)fail('RECONCILE_STOP_REFUSED');
     step='STOP_READ_FAILED';run=await read();
     step='STOP_SETTLEMENT_FAILED';
     await life.run(()=>store.executions.settleStopped({binding:b,executionId:record.executionId,runtimeSessionId:record.runtimeSessionId,state:run.state},life.check));
    }catch(error){life.check();const diagnostic=settlementUnknownReason(error?.reasonCode);
     return {outcome:'unknown',state:(await read()).state,reasonCode:step==='STOP_CALL_FAILED'&&diagnostic!=='RECONCILE_ERROR'?diagnostic:step};}
   }else if(saved.record?!executionOutcomeSettled(saved.record,run.state):run.state!=='failed'&&run.state!=='cancelled')
    return {outcome:'unknown',state:run.state,reasonCode:saved.record?'EXECUTION_UNSETTLED':'EXECUTION_MISSING'};
   return reasonCode?{outcome:'reconciled',state:run.state,reasonCode}:{outcome:checkpointed(run.state)?'checkpointed':'settled',state:run.state};
  }finally{life.close();}
 }
 return Object.freeze({reconcile});
}
