/** Original-attempt reconciliation: settles a run whose own terminal write was never acknowledged, after the native stop
 * owner has physically stopped the original and revoked its grants. It never dispatches, restarts or resumes anything. */
import {randomUUID} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {bounded,hash,fail,terminal,validateShape} from './boundary.mjs';
import {HOLD_CHECKPOINT_FAILED} from './lifecycle/journal.mjs';
import {FORECLOSED} from './native-preparation-journal.mjs';
/** run.status reasonCode for a run whose original attempt ended without an acknowledged terminal write (free-form in the frozen UIEvent contract). */
export const ATTEMPT_LOST='ATTEMPT_LOST';
const checkpointed=state=>state==='paused'||state==='waiting-for-approval';
/** Retired means the canonical allocation journal recorded the physical stop; the allocator records RETIRED only after grant revocation. */
const retired=saved=>saved.record?.state==='RETIRED'&&saved.record.resource?.physicalStopProven===true;
/** Nothing to stop: the store's no-authority evidence that this attempt never claimed an allocation (never a missing row). */
const foreclosedAttempt=saved=>saved.record?.state===FORECLOSED;
export function createRunReconciler({store,retirement,now=Date.now,newId=randomUUID,maxReconcileMs=60000}){
 if(['read','append'].some(k=>typeof store?.[k]!=='function')||typeof store?.allocations?.read!=='function'||typeof retirement?.retire!=='function'||typeof now!=='function'||typeof newId!=='function'||!Number.isSafeInteger(maxReconcileMs)||maxReconcileMs<1||maxReconcileMs>120000)fail('RECONCILE_CONFIGURATION');
 /** Idempotent and bounded. Outcomes: settled (already terminal), reconciled (this call wrote the terminal event),
  * checkpointed (paused/waiting run, owned by continuation), unknown (physical stop not proven: a barrier, nothing written). */
 async function reconcile({binding,signal}={}){
  const b=bounded(binding);validateShape('RunBinding',b);nativeSignal(signal);
  const life=createOperationLifetime({deadlineMs:now()+maxReconcileMs,now,signal,errorFactory:()=>Object.assign(Error('RECONCILE_UNKNOWN'),{code:'RECONCILE_UNKNOWN'})});
  const read=async()=>(await life.run(()=>store.read(b,{after:0,limit:1},life.check))).run;
  const allocation=()=>life.run(()=>store.allocations.read({binding:b,allocationKey:hash(b)},life.check));
  // Asks the native stop owner to retire the original, then trusts only the journal's record of it.
  const stopped=async saved=>{if(!saved.record||retired(saved)||foreclosedAttempt(saved))return true;try{await life.run(signal=>retirement.retire({binding:b,signal}));}catch{life.check();}return retired(await allocation());};
  const write=(run,reasonCode)=>life.run(()=>store.append(b,{eventId:newId(),createdAt:new Date(now()).toISOString(),type:'run.status',data:{state:'failed',reasonCode}},life.check,run.scopes));
  async function settle(run){
   // The durable owner admits exactly one: an ordinary failure, or for an unapplied hold the verified hold failure (UNKNOWN barrier).
   for(const reasonCode of [ATTEMPT_LOST,HOLD_CHECKPOINT_FAILED]){
    try{await write(run,reasonCode);return reasonCode;}
    catch(error){life.check();const current=await read();if(terminal(current.state)||checkpointed(current.state))return null;if(error?.code!=='RUN_HELD'&&error?.code!=='HOLD_FAILURE_REFUSED')throw error;}
   }
   fail('RECONCILE_REFUSED');
  }
  try{
   let saved=await allocation();
   // A claimed allocation must be physically stopped before anything is written.
   if(!await stopped(saved))return {outcome:'unknown',state:(await read()).state};
   let run=await read();if(checkpointed(run.state))return {outcome:'checkpointed',state:run.state};
   const reasonCode=terminal(run.state)?null:await settle(run);run=await read();
   // No allocation was claimed: the terminal write above recorded the no-authority evidence in its own transaction (from queued)
   // and forecloses any later claim, so only a claim that committed before it can exist, and it is stopped like any other.
   if(!saved.record){saved=await allocation();if(!await stopped(saved))return {outcome:'unknown',state:run.state};}
   return reasonCode?{outcome:'reconciled',state:run.state,reasonCode}:{outcome:checkpointed(run.state)?'checkpointed':'settled',state:run.state};
  }finally{life.close();}
 }
 return Object.freeze({reconcile});
}
