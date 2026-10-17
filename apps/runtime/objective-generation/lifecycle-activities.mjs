/**
 * Activities for meriObjectiveGenerationWorkflow. Each call does one bounded unit of
 * work and returns only nonsecret digests/states for workflow history.
 *
 * Trusted composition ports (never request data):
 *  - clientFor(source): the decoded Core client (core-client.mjs) for ONE job and
 *    accepted binding, built over core-http with the genuine workload credential
 *    owner. Absent => every Core step is unconfirmed (nothing is invented).
 *  - runs.start / runs.read: the accepted-run owner. start must durably accept ONE
 *    run for {binding, generationJobId} with Core's published prompt and associate
 *    the decoded Objective selection for protected-fact compilation, then dispatch
 *    the existing conversation workflow; it must be idempotent for that identity.
 *    read returns the run projection or null. NOT COMPOSED in this source: it needs
 *    the run-to-Objective-selection persistence decision, the prepared-run splice
 *    and the conversation-runner SDK mount (see lane-7 record). Absent => not-started.
 */
import {Context} from '@temporalio/activity';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {productFailure} from '../../control/product-access/errors.mjs';

const fault=()=>Object.assign(Error('OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION'),{code:'OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION'});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const states=['queued','starting','running','completed','failed','cancelled','paused','waiting-for-approval'];
const unconfirmed=()=>data({kind:'unconfirmed'});

export function createObjectiveGenerationActivities({clientFor,runs,context=()=>Context.current(),now=Date.now,maxRequestMs=15000}={}){
 if(clientFor!==undefined&&typeof clientFor!=='function'||runs!==undefined&&(typeof runs?.start!=='function'||typeof runs?.read!=='function')||
    typeof context!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw fault();
 function parse(value,extra=[]){
  const v=own(value,['generationJobId','binding','notAfterMs',...extra]);validateShape('RunBinding',v.binding);
  if(!uuid(v.generationJobId)||!Number.isSafeInteger(v.notAfterMs))throw fault();
  return data(v);
 }
 function scope(v){
  const signal=context().cancellationSignal,deadlineMs=Math.min(now()+maxRequestMs,v.notAfterMs);
  return {signal,deadlineMs,client:clientFor?clientFor({generationJobId:v.generationJobId,binding:v.binding}):null};
 }
 // Core admission and publication: Core replays both by job, so a retry is an effect.
 async function objectiveGenerationSource(value){
  const v=parse(value),{signal,deadlineMs,client}=scope(v);if(!client)return unconfirmed();
  try{
   const a=await client.admit({signal,deadlineMs}),p=await client.publish({admission:a.sourceAdmission,signal,deadlineMs});
   return data({kind:'ready',sourceAdmissionSha256:a.sourceAdmissionSha256,requestSha256:p.requestSha256,
    effectExpiresAtMs:Math.min(a.sourceAdmission.effectExpiresAtMs,p.request.originalExpiresAtMs)});
  }catch{return unconfirmed();}
 }
 async function objectiveGenerationStartRun(value){
  const v=parse(value,['mode','requestSha256']);if(!['effect','read'].includes(v.mode)||!sha(v.requestSha256))throw fault();
  const {signal,deadlineMs,client}=scope(v);
  if(!runs)return data({kind:'not-started'});
  if(v.mode==='read'){
   try{const run=await runs.read({binding:v.binding,signal});return run?data({kind:'started'}):data({kind:'absent'});}catch{return unconfirmed();}
  }
  if(!client)return data({kind:'not-started'});
  let selection;
  // Read-only Core reads before any run write: failures here are definite no-ops.
  try{
   const read=await client.readAdmission({signal,deadlineMs}),p=await client.readRequest({admission:read.sourceAdmission,signal,deadlineMs});
   if(p.requestSha256!==v.requestSha256)return data({kind:'refused'});
   selection={sourceAdmission:read.sourceAdmission,request:p.request,executionContext:p.executionContext,queuedType:p.queuedType};
  }catch{return data({kind:'not-started'});}
  try{
   const out=await runs.start({binding:v.binding,generationJobId:v.generationJobId,
    acceptedRequest:{requestId:selection.sourceAdmission.generationRequestId,prompt:selection.executionContext.prompt},selection,signal});
   return out?.kind==='not-started'?data({kind:'not-started'}):data({kind:'started'});
  }catch{return unconfirmed();}
 }
 async function objectiveGenerationReadRun(value){
  const v=parse(value),{signal}=scope(v);if(!runs)return unconfirmed();
  try{const run=await runs.read({binding:v.binding,signal});return states.includes(run?.state)?data({kind:'state',state:run.state}):unconfirmed();}
  catch{return unconfirmed();}
 }
 // Core completion: Core replays the saved generation by job; read first, then effect.
 async function objectiveGenerationComplete(value){
  const v=parse(value,['sourceAdmissionSha256']),{signal,deadlineMs,client}=scope(v);if(!client||!sha(v.sourceAdmissionSha256))return unconfirmed();
  try{
   const read=await client.readAdmission({signal,deadlineMs});
   if(read.sourceAdmissionSha256!==v.sourceAdmissionSha256||!read.acceptance)return unconfirmed();
   const publication=await client.readRequest({admission:read.sourceAdmission,signal,deadlineMs}),ctx={admission:read.sourceAdmission,publication,acceptance:read.acceptance,signal,deadlineMs};
   let done;try{done=await client.readCompletion(ctx);}catch(error){if(productFailure(error)?.code!=='OBJECTIVE_GENERATION_CORE_UNAVAILABLE')throw error;done=await client.complete(ctx);}
   return data({kind:'completed',strategyId:done.strategyId,strategyVersionId:done.strategyVersionId,objectiveReceiptSha256:done.objectiveReceiptSha256});
  }catch{return unconfirmed();}
 }
 return Object.freeze({objectiveGenerationSource,objectiveGenerationStartRun,objectiveGenerationReadRun,objectiveGenerationComplete});
}
