/** The write activity has one attempt. Actual Core independently authenticates every write/read and owns durable creation custody. */
import {own,data,continuationWork,coreDigest,fail} from '../control/objective-planner/continuation/contract.mjs';
import {Context} from '@temporalio/activity';
export function createObjectivePlannerActivities({client,admission,context=()=>Context.current(),now=Date.now,maxRequestMs=15000}){
 if(typeof client?.inspect!=='function'||typeof client?.prepare!=='function'||typeof admission?.check!=='function'||typeof context!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 async function run(mode,value){
  const input=own(value,['work','workSha256']),w=continuationWork(input.work);if(input.workSha256!==coreDigest(w))fail('WORK_CONFLICT');const signal=context().cancellationSignal;let deadlineMs=now()+maxRequestMs;
  if(mode==='prepare'){try{const proof=data(own(await admission.check({work:w,phase:'prepare',signal,deadlineMs}),['workSha256','sourceBinding','sourceRequestSha256','expiresAtMs']));
   // The genuine producer owns the intersection of original consent/task/delegation bounds. Longer transport credentials cannot extend it.
   if(proof.workSha256!==input.workSha256||!Number.isSafeInteger(proof.expiresAtMs)||proof.expiresAtMs<=now()||signal?.aborted)fail('ACCESS_DENIED');deadlineMs=Math.min(deadlineMs,proof.expiresAtMs);
  }catch{return {kind:'refused'};}}
  // Fresh Core read authorization, including historical expiry/current-authority behavior, belongs to the actual read owner.
  return client[mode]({work:w,signal,deadlineMs});
 }
 return Object.freeze({inspectObjectivePlanner:value=>run('inspect',value),prepareObjectivePlanner:value=>run('prepare',value)});
}
