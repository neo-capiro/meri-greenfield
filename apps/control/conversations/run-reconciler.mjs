/** Reconcile a logical execution. Terminal fencing precedes stop-only cleanup; a warm settled session stays running. */
import {randomUUID} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {bounded,same,own,fail,terminal,validateShape} from './boundary.mjs';
import {HOLD_CHECKPOINT_FAILED} from './lifecycle/journal.mjs';
import {executionOutcomeSettled} from './execution-boundary.mjs';
export const ATTEMPT_LOST='ATTEMPT_LOST';
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
    try{
     const receipt=own(bounded(await life.run(signal=>stopExecution({binding:b,executionId:record.executionId,runtimeSessionId:record.runtimeSessionId,signal}))),['binding','executionId','runtimeSessionId','stopped']);
     if(!same(receipt.binding,b)||receipt.executionId!==record.executionId||receipt.runtimeSessionId!==record.runtimeSessionId||receipt.stopped!==true)fail('RECONCILE_STOP_REFUSED');
     run=await read();
     await life.run(()=>store.executions.settleStopped({binding:b,executionId:record.executionId,runtimeSessionId:record.runtimeSessionId,state:run.state},life.check));
    }catch{life.check();return {outcome:'unknown',state:(await read()).state};}
   }else if(saved.record?!executionOutcomeSettled(saved.record,run.state):run.state!=='failed'&&run.state!=='cancelled')return {outcome:'unknown',state:run.state};
   return reasonCode?{outcome:'reconciled',state:run.state,reasonCode}:{outcome:checkpointed(run.state)?'checkpointed':'settled',state:run.state};
  }finally{life.close();}
 }
 return Object.freeze({reconcile});
}
