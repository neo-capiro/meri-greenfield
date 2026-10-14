/** Current admission and trusted SQL effects over one canonical budget lease. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {PostgresBudgetStore,BudgetStateDenied,BudgetCommitUncertain,refuse} from './postgres-budget-store.mjs';
import {same} from './tool-budget-binding.mjs';
import {admittedConfiguration,currentInput} from './admitted-run-binding.mjs';
import {readCurrentAdmission} from './admitted-run-current.mjs';
export function createPostgresAdmittedRunOwner(configuration){
 const c=admittedConfiguration(configuration),store=new PostgresBudgetStore(c.pool,{namespace:c.namespace});
 function lifetime(input){
  if(!same(input.binding,c.binding))refuse('ADMITTED_RUN_REFUSED');
  const started=c.now();if(!Number.isSafeInteger(started)||started<0)refuse('ADMITTED_RUN_REFUSED');
  if(input.deadlineMs!==undefined&&!Number.isSafeInteger(input.deadlineMs))refuse('ADMITTED_RUN_REFUSED');
  const life=createOperationLifetime({deadlineMs:Math.min(started+c.limits.maxRequestMs,input.deadlineMs??Infinity),now:c.now,signal:input.signal,errorFactory:()=>new BudgetStateDenied('ADMITTED_RUN_STOPPED')});
  const check=()=>{life.check();if(input.signal?.aborted)refuse('ADMITTED_RUN_STOPPED');};
  return{life,check,started};
 }
 const checked=(raw,check)=>{const query=raw.query;return Object.freeze({async query(...args){check();const result=await query.call(raw,...args);check();return result;}});};
 const observation=(deadlineMs,checkedAtMs)=>({binding:c.binding,policyRevision:c.policyRevision,deadlineMs,checkedAtMs});
 async function currentObservation(value,options,readOnly=false){
  const input=currentInput(value,options),{life,check,started}=lifetime(input);
  try{
   const deadline=await life.run(()=>store.transact(raw=>readCurrentAdmission({c,store,client:checked(raw,check),life,check,readOnly}),check,undefined,readOnly));
   const at=c.now();check();if(!Number.isSafeInteger(at)||at<started||at>=deadline)refuse('ADMITTED_RUN_REFUSED');
   return JSON.stringify(observation(deadline,at));
  }finally{life.close();}
 }
 const currentRun=(value,options)=>currentObservation(value,options);
 // Fresh committed snapshot for verifier refresh inside a separate owned lease.
 // No row lock, mutation or effect callback; same admission predicate/SQL owner.
 const currentTaskRun=(value,options)=>currentObservation(value,options,true);
 async function currentAllocation(binding,options){
  const observed=JSON.parse(await currentRun(binding,options));
  return JSON.stringify({...observed,allocation:c.a,allocationSha256:c.allocationSha256});
 }
 async function withCurrentAllocation(value,effect){
  const v=own(value,['binding'],['signal','deadlineMs']);
  if(typeof effect!=='function')refuse('ADMITTED_EFFECT_REFUSED');
  const input={...currentInput(v.binding,{signal:v.signal}),deadlineMs:v.deadlineMs}, {life,check}=lifetime(input);
  let committing=false;
  try{return await life.run(()=>store.transact(async raw=>{
   const client=checked(raw,check);const deadline=await readCurrentAdmission({c,store,client,life,check,locked:true});
   let active=true;const pending=new Set();
   const port=Object.freeze({query(...args){if(!active)return Promise.reject(new BudgetStateDenied('ADMITTED_EFFECT_CLOSED'));const work=client.query(...args);pending.add(work);work.then(()=>pending.delete(work),()=>pending.delete(work));return work;}});
   let result;try{
    const current=data({...observation(deadline,c.now()),allocation:c.a,allocationSha256:c.allocationSha256});
    // An optional second trusted callback argument can only shorten the lease.
    result=await life.run(()=>effect(Object.freeze({client:port,current}),life.limitDeadline));check();
   }finally{active=false;}
   if(pending.size)refuse('ADMITTED_EFFECT_PENDING');
   await readCurrentAdmission({c,store,client,life,check,locked:true});check();return result;
  },check,()=>{committing=true;}));}
  catch(error){if(committing)throw new BudgetCommitUncertain('COMMIT_ACKNOWLEDGEMENT_UNKNOWN');throw error;}
  finally{life.close();}
 }
 return Object.freeze({currentRun,currentTaskRun,currentAllocation,withCurrentAllocation});
}
