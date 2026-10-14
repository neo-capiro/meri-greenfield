/** One original task freezes mirrored SessionStore bytes before genuine CLI exit. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {copySessionJson} from '../../worker/qualification/checkpoint/session-store-data.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {remoteOriginal} from './remote-task-boundary.mjs';
import {assertNativeExecution} from './execution-broker.mjs';
import {createCheckpointSdkSnapshot} from './checkpoint-snapshot.mjs';
import {createWorkspaceCapture} from './workspace-capture.mjs';
const fault=()=>Error('TASK_CHECKPOINT_SOURCE_UNKNOWN'),refuse=()=>{throw fault();};
export function createTaskCheckpointSource(configuration){
 const c=own(configuration,['original','workspace','session','native','closeQuery'],['now','maxRequestMs']),original=remoteOriginal(c.original),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??8000;
 const settle=storageMethod(c.session,'settle'),snapshot=storageMethod(c.session,'snapshot'),closeSession=storageMethod(c.session,'close'),closeNative=storageMethod(c.native,'close'),inspectNative=storageMethod(c.native,'inspect'),closeQuery=storageMethod(c,'closeQuery');
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 const workspace=createWorkspaceCapture({workspace:c.workspace,expiresAtMs:original.expiresAtMs,now});let state='pristine';
 return Object.freeze({async capture(value){
  const raw=own(value,['binding','controlId','sessionId'],['signal']),{signal,...request}=raw,input=data(request);nativeSignal(signal);
  if(hash(input.binding)!==hash(original.binding)||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/u.test(input.controlId)||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/u.test(input.sessionId)||signal?.aborted||now()>=original.expiresAtMs||state!=='pristine')refuse();
  state='capturing';const life=createOperationLifetime({now,signal,deadlineMs:Math.min(now()+maxRequestMs,original.expiresAtMs),errorFactory:fault});let nativeClosed=false,sessionClosed=false,queryClosed=false;
  const sessionCall=method=>life.run(signal=>method({...input,signal}));
  async function frozenSnapshot(){const value=copySessionJson(await sessionCall(snapshot),9*1024*1024),v=own(value,['key','transcripts']);if(v.key.sessionId!==input.sessionId||v.key.projectKey!==c.workspace.replace(/[^a-zA-Z0-9]/gu,'-'))refuse();const verified=await createCheckpointSdkSnapshot({key:v.key,transcripts:copySessionJson(v.transcripts,8*1024*1024)});life.check();return {key:verified.key,transcripts:verified.transcripts()};}
  try{
   const live=assertNativeExecution(await life.run(signal=>inspectNative({...original,signal})),original);if(live.state!=='executing'||live.physicalStopProven)refuse();
   await sessionCall(settle);await sessionCall(closeSession);sessionClosed=true;
   // close() must freeze/drain writes while snapshot() uses the retained
   // canonical read owner on this capture lifetime. No new registration call.
   const frozen=await frozenSnapshot(),second=await frozenSnapshot();if(hash(frozen)!==hash(second))refuse();const beforeStop=assertNativeExecution(await life.run(signal=>inspectNative({...original,signal})),original);if(beforeStop.state!=='executing'||beforeStop.physicalStopProven)refuse();
   await life.run(signal=>closeQuery({signal}));queryClosed=true;
   await life.run(signal=>closeNative({...original,signal}));
   const quiescence=assertNativeExecution(await life.run(signal=>inspectNative({...original,signal})),original);if(!quiescence.physicalStopProven||quiescence.state!=='stopped')refuse();nativeClosed=true;
   const files=workspace.capture({signal:life.signal});life.check();state='captured';return copySessionJson({...input,key:frozen.key,transcripts:frozen.transcripts,files,quiescence},56*1024*1024);
  }catch{state='unknown';throw fault();}
  finally{
   life.close();
   // Cleanup gets a separate bounded lifetime so cancellation of preparation
   // cannot skip stopping the original process. Its receipt never makes a
   // failed capture successful and it cannot authorize a retry.
   if(!nativeClosed||!sessionClosed||!queryClosed){const cleanup=createOperationLifetime({now,deadlineMs:now()+maxRequestMs,errorFactory:fault});
    try{if(!sessionClosed)try{await cleanup.run(signal=>closeSession({...input,signal}));}catch{}if(!queryClosed)try{await cleanup.run(signal=>closeQuery({signal}));}catch{}if(!nativeClosed)try{await cleanup.run(signal=>closeNative({...original,signal}));}catch{}}
    finally{cleanup.close();}
   }
  }
 },status:()=>Object.freeze({state})});
}
