/** Observes actual scheduled work and performs explicit cancellation through the canonical run/retirement owners. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {frozenScheduleData,denySchedule} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {foreclosed} from '../conversations/native-preparation-journal.mjs';
import {terminal} from '../conversations/boundary.mjs';
import {createScheduledJobLineage,snapshotScheduledJobSelection} from './scheduled-job-lineage.mjs';
import {sdkMethod} from './temporal-schedule-mutations.mjs';

const same=(a,b)=>hash(a)===hash(b),fail=()=>denySchedule('SCHEDULE_JOB_UNKNOWN');
export function createScheduledJobLifecycle(configuration){
 const {store,runControl,retirement,now=Date.now,maxRequestMs=10000}=own(configuration,['store','runControl','retirement'],['now','maxRequestMs']);
 const lineage=createScheduledJobLineage({store}),facet=Object.getOwnPropertyDescriptor(store,'allocations');if(!facet||!Object.hasOwn(facet,'value'))fail();
 const allocation=sdkMethod(facet.value,'read'),cancelRun=sdkMethod(runControl,'cancel'),retire=sdkMethod(retirement,'retire');
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail();
 async function operate(value,cancelling){
  const {occurrence,effect,signal,deadlineMs,expectedLineage}=own(value,['occurrence','effect','deadlineMs'],cancelling?['signal','expectedLineage']:['signal']);nativeSignal(signal);
  const selected=snapshotScheduledJobSelection({occurrence,effect}),began=now();
  const expected=expectedLineage===undefined?null:data(own(expectedLineage,['currentBinding','bindings','lineageSha256']));
  if(expected){
   if(!Array.isArray(expected.bindings)||!expected.bindings.length||typeof expected.lineageSha256!=='string'||!/^[a-f0-9]{64}$/u.test(expected.lineageSha256))fail();
   for(const binding of expected.bindings)validateShape('RunBinding',binding);validateShape('RunBinding',expected.currentBinding);
   if(!same(expected.bindings[0],selected.effect.binding)||!same(expected.bindings.at(-1),expected.currentBinding)||new Set(expected.bindings.map(hash)).size!==expected.bindings.length)fail();
  }
  if(!Number.isSafeInteger(began)||!Number.isSafeInteger(deadlineMs)||deadlineMs<=began)fail();
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,began+maxRequestMs),errorFactory:()=>Object.assign(Error('SCHEDULE_JOB_UNKNOWN'),{code:'SCHEDULE_JOB_UNKNOWN'})});
  const read=()=>life.run(()=>lineage.read(selectedSelection(),life.check)),selectedSelection=()=>({occurrence:selected.occurrence,effect:selected.effect});
  async function retired(binding){
   const saved=await life.run(()=>allocation({binding,allocationKey:hash(binding)},life.check));
   if(!same(saved.run.binding,binding))fail();const r=saved.record;
   // A missing allocation row is never evidence that authority was never acquired.
   return !!r&&(foreclosed(r,binding)&&r.foreclosure.state===saved.run.state||r.state==='RETIRED'&&r.resource?.physicalStopProven===true&&same(r.original.binding,binding));
  }
  function result(s,settled,reason){life.check();return frozenScheduleData({state:settled?'SETTLED':'OCCUPIED',binding:selected.effect.binding,currentBinding:s.currentBinding,
   runState:s.run?.state??null,reason,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,began+maxRequestMs)});}
  try{
   let saved=await read();
   // Human approval binds one exact native execution selection. Re-resolving a later successor cannot widen that approval.
   if(expected&&(!same(expected.currentBinding,saved.currentBinding)||!same(expected.bindings,saved.bindings)||expected.lineageSha256!==saved.lineageSha256))return result(saved,false,'SCHEDULE_JOB_LINEAGE_CHANGED');
   if(saved.occupiedReason&&(!cancelling||!saved.cleanupReady))return result(saved,false,saved.occupiedReason);
   if(cancelling){
    // The actual current same-work binding is selected from canonical lineage, never from public schedule wrapper IDs.
    await life.run(signal=>cancelRun({binding:saved.currentBinding,signal,deadlineMs:Math.min(deadlineMs,began+maxRequestMs)}));
    const after=await read();if(!after.cleanupReady||!same(after.bindings,saved.bindings)||after.lineageSha256!==saved.lineageSha256)return result(after,false,'SCHEDULE_JOB_LINEAGE_CHANGED');saved=after;
    for(const binding of saved.bindings)if(!await retired(binding))await life.run(signal=>retire({binding,signal,deadlineMs:Math.min(deadlineMs,began+maxRequestMs)}));
   }
   // Checkpoint capture routinely retires a paused worker. It does not retire the job or free its overlap slot.
   if(!terminal(saved.run.state))return result(saved,false,'SCHEDULE_JOB_ACTIVE');
   for(const binding of saved.bindings)if(!await retired(binding))return result(saved,false,'SCHEDULE_JOB_RETIREMENT_UNPROVEN');
   const after=await read();
   if(after.occupiedReason&&(!cancelling||!after.cleanupReady)||!same(after.bindings,saved.bindings)||after.lineageSha256!==saved.lineageSha256||!terminal(after.run?.state))return result(after,false,'SCHEDULE_JOB_LINEAGE_CHANGED');
   return result(after,true,null);
  }finally{life.close();}
 }
 return Object.freeze({inspect:value=>operate(value,false),cancel:value=>operate(value,true)});
}
