/** Worker-side `runs` port for the Objective generation activities over the poller's native capability client. The Temporal
 * worker has no database pool; the accepted-run owner lives in control (run-owner.mjs) behind the private native operations
 * of ../native-authority/objective-runs-http.mjs. Replies are closed and re-validated here; any transport failure throws, which
 * lifecycle-activities.mjs reports as unconfirmed (the workflow then only reads back). Composed only when the worker
 * configuration declares `objectiveGeneration.runs.enabled` (configuration.mjs); otherwise the activities get no `runs` port
 * and answer not-started, unchanged. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {OBJECTIVE_RUNS_OPERATIONS} from '../native-authority/objective-runs-http.mjs';

const fault=()=>Object.assign(Error('OBJECTIVE_RUNS_UNAVAILABLE'),{code:'OBJECTIVE_RUNS_UNAVAILABLE'});

export function createObjectiveNativeRunsPort({native}={}){
 let call;try{call=storageMethod(native,'call');}catch{throw fault();}
 async function start(value){
  const v=own(value,['binding','generationJobId','acceptedRequest','selection'],['signal']);nativeSignal(v.signal);validateShape('RunBinding',v.binding);
  const answer=data(await call(OBJECTIVE_RUNS_OPERATIONS.start,{binding:v.binding,generationJobId:v.generationJobId,acceptedRequest:v.acceptedRequest,selection:v.selection},{signal:v.signal}));
  try{own(answer,['kind']);}catch{throw fault();}
  if(!['started','not-started'].includes(answer.kind))throw fault();
  return data({kind:answer.kind});
 }
 async function read(value){
  const v=own(value,['binding'],['signal']);nativeSignal(v.signal);validateShape('RunBinding',v.binding);
  const answer=data(await call(OBJECTIVE_RUNS_OPERATIONS.read,{binding:v.binding},{signal:v.signal}));
  try{own(answer,['run']);if(answer.run!==null)validateShape('Run',answer.run);}catch{throw fault();}
  if(answer.run!==null&&hash(answer.run.binding)!==hash(v.binding))throw fault();
  return answer.run;
 }
 return Object.freeze({start,read});
}
