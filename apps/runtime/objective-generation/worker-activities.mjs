/** Temporal carries job/binding/state only. Core credentials, database and typed prompt remain in control. */
import {Context} from '@temporalio/activity';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {compileObjectiveGenerationConfiguration} from './configuration.mjs';
import {OBJECTIVE_ACTIVITY_OPERATIONS} from '../native-authority/objective-runs-http.mjs';
export const OBJECTIVE_GENERATION_ACTIVITY_NAMES=Object.freeze(Object.keys(OBJECTIVE_ACTIVITY_OPERATIONS));
const fault=()=>Error('OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export function createObjectiveWorkerActivities(ports={}){
 let c;try{c=own(ports,[],['native','context']);}catch{throw fault();}const context=c.context??(()=>Context.current());
 if(typeof context!=='function'||c.native!==undefined&&typeof c.native?.call!=='function')throw fault();
 const activities=Object.fromEntries(OBJECTIVE_GENERATION_ACTIVITY_NAMES.map(name=>[name,async value=>{
  const extra=name==='objectiveGenerationStartRun'?['mode','requestSha256']:name==='objectiveGenerationComplete'?['sourceAdmissionSha256']:[];
  const v=data(own(value,['generationJobId','binding','notAfterMs',...extra]));validateShape('RunBinding',v.binding);
  if(!uuid(v.generationJobId)||!Number.isSafeInteger(v.notAfterMs)||name==='objectiveGenerationStartRun'&&(!['effect','read'].includes(v.mode)||!sha(v.requestSha256))||
   name==='objectiveGenerationComplete'&&!sha(v.sourceAdmissionSha256))throw fault();
  if(!c.native)return {kind:name==='objectiveGenerationStartRun'?'not-started':'unconfirmed'};
  const signal=context().cancellationSignal;nativeSignal(signal);
  const reply=data(await c.native.call(OBJECTIVE_ACTIVITY_OPERATIONS[name],v,{signal}));
  if(reply.kind==='ready'&&name==='objectiveGenerationSource'){own(reply,['kind','sourceAdmissionSha256','requestSha256','effectExpiresAtMs']);if(!sha(reply.sourceAdmissionSha256)||!sha(reply.requestSha256)||!Number.isSafeInteger(reply.effectExpiresAtMs))throw fault();}
  else if(reply.kind==='completed'&&name==='objectiveGenerationComplete'){own(reply,['kind','strategyId','strategyVersionId','objectiveReceiptSha256']);if(!uuid(reply.strategyId)||!uuid(reply.strategyVersionId)||!sha(reply.objectiveReceiptSha256))throw fault();}
  else if(reply.kind==='state'&&name==='objectiveGenerationReadRun'){own(reply,['kind','state']);if(!['queued','starting','running','completed','failed','cancelled','paused','waiting-for-approval'].includes(reply.state))throw fault();}
  else{own(reply,['kind']);if(reply.kind!=='unconfirmed'&&!(name==='objectiveGenerationStartRun'&&['not-started','started','absent','refused'].includes(reply.kind)))throw fault();}
  return reply;
 }]));
 return Object.freeze(activities);
}
export function objectiveWorkerPorts({configuration,native}){
 return compileObjectiveGenerationConfiguration(configuration,'temporal-worker').runs?Object.freeze({native}):Object.freeze({});
}