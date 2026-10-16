/** The write activity has one attempt. Actual Core independently authenticates every write/read and owns durable creation custody. */
import {own,continuationWork,coreDigest,fail} from './contract.mjs';
import {Context} from '@temporalio/activity';
export function createObjectivePlannerActivities({client,admission,context=()=>Context.current(),now=Date.now,maxRequestMs=15000}){
 if(typeof client?.inspect!=='function'||typeof client?.prepare!=='function'||typeof admission?.check!=='function'||typeof context!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 async function run(mode,value){
  const input=own(value,['work','workSha256']),w=continuationWork(input.work);if(input.workSha256!==coreDigest(w))fail('WORK_CONFLICT');const signal=context().cancellationSignal,deadlineMs=now()+maxRequestMs;
  if(mode==='prepare'){try{await admission.check({work:w,phase:'prepare',signal,deadlineMs});}catch{return {kind:'refused'};}}
  // Fresh Core read authorization, including historical expiry/current-authority behavior, belongs to the actual read owner.
  return client[mode]({work:w,signal,deadlineMs});
 }
 return Object.freeze({inspectObjectivePlanner:value=>run('inspect',value),prepareObjectivePlanner:value=>run('prepare',value)});
}
