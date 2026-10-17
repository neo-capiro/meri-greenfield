/**
 * Deterministic server-owned Objective generation lifecycle (no I/O, no imports).
 * Runs inside the Temporal workflow so it survives browser close and worker loss:
 *
 *   source  : Core admit + publish (Core replays both by job; safe to repeat)
 *   run     : accept ONE Meri conversation run for the published request. After an
 *             unconfirmed start only read-back is used; absence never re-starts.
 *   running : poll the run until it is terminal (the conversation workflow owns it)
 *   complete: Core generation completion (Core replays by job; safe to repeat)
 *
 * Planner continuation after completion is Core's mounted Planner worker; this
 * driver never applies Planner work. Activities return nonsecret digests and
 * states only; prompts and typed requests never enter workflow history.
 * A stop request prevents a run start; once a run exists it is the conversation
 * lifecycle's job to stop it, and this driver keeps accounting for its outcome.
 * Every wait is bounded by the server-set input.notAfterMs and, once known, the
 * Core admission effect expiry.
 */
export const OBJECTIVE_GENERATION_POLL_MS=30000,OBJECTIVE_GENERATION_RETRY_MS=120000;
const terminal=['completed','failed','cancelled'];

export async function driveObjectiveGeneration(input,{source,startRun,readRun,complete,wait,publish,stopped,now,fatal=(_error)=>false}){
 const attempted={run:false};let summary=null,runState=null,result=null;
 const view=(phase)=>{const value={phase,runStartAttempted:attempted.run,stopRequested:stopped(),
  sourceAdmissionSha256:summary?.sourceAdmissionSha256??null,requestSha256:summary?.requestSha256??null,runState,result};publish(value);return value;};
 if(!Number.isSafeInteger(input?.notAfterMs))return view('refused');
 const expired=()=>now()>=Math.min(input.notAfterMs,summary?.effectExpiresAtMs??input.notAfterMs);
 // Workflow cancellation (fatal) propagates; every other activity failure is unconfirmed.
 const call=async(activity,value)=>{try{return await activity(value);}catch(error){if(fatal(error))throw error;return {kind:'unconfirmed'};}};

 // 1. Core source admission and immutable publication.
 for(;;){
  view('admitting');
  const s=await call(source,input);
  if(s?.kind==='ready'&&typeof s.sourceAdmissionSha256==='string'&&typeof s.requestSha256==='string'&&Number.isSafeInteger(s.effectExpiresAtMs)){
   summary={sourceAdmissionSha256:s.sourceAdmissionSha256,requestSha256:s.requestSha256,effectExpiresAtMs:s.effectExpiresAtMs};break;
  }
  if(stopped())return view('stopped');
  if(expired())return view('expired');
  view('admission_unconfirmed');await wait(OBJECTIVE_GENERATION_RETRY_MS);
 }
 // 2. Accept exactly one Meri run for the published request.
 for(;;){
  if(expired())return view(attempted.run?'expired_unconfirmed':'expired');
  if(!attempted.run&&stopped())return view('stopped');
  view(attempted.run?'run_reconciling':'starting_run');
  const mode=attempted.run?'read':'effect';
  if(mode==='effect')attempted.run=true;
  const r=await call(startRun,{...input,mode,requestSha256:summary.requestSha256});
  if(r?.kind==='started')break;
  // The published request no longer matches the admitted one: nothing was written.
  if(mode==='effect'&&r?.kind==='refused')return view('refused');
  // A definite no-op (owner unavailable before any write) may be retried as an effect.
  if(mode==='effect'&&r?.kind==='not-started')attempted.run=false;
  view(attempted.run?'run_unconfirmed':'run_unavailable');await wait(OBJECTIVE_GENERATION_RETRY_MS);
 }
 // 3. The conversation workflow owns execution; observe it to a terminal state.
 for(;;){
  const r=await call(readRun,input);
  if(r?.kind==='state'&&typeof r.state==='string')runState=r.state;
  if(terminal.includes(runState))break;
  if(expired())return view('expired_unconfirmed');
  view('running');await wait(OBJECTIVE_GENERATION_POLL_MS);
 }
 // Failed or cancelled runs never complete a generation. Core terminal accounting
 // uses a separate Core subject that is not allocated to Meri in this source.
 if(runState!=='completed')return view('run_'+runState);
 // 4. Core completion: Core reads the retained typed result through its own reader.
 for(;;){
  view('completing');
  const c=await call(complete,{...input,sourceAdmissionSha256:summary.sourceAdmissionSha256});
  if(c?.kind==='completed'&&typeof c.objectiveReceiptSha256==='string'){
   result={strategyId:c.strategyId,strategyVersionId:c.strategyVersionId,objectiveReceiptSha256:c.objectiveReceiptSha256};return view('completed');
  }
  if(expired())return view('completion_unconfirmed');
  view('completion_unconfirmed_retrying');await wait(OBJECTIVE_GENERATION_RETRY_MS);
 }
}
