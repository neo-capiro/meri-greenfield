/** Immutable object reads + canonical durable claim before task-owned byte writes. */
import {randomUUID,createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createCheckpointSdkSnapshot} from './checkpoint-snapshot.mjs';
import {restoreWorkspaceBytes,verifyWorkspaceBytes} from './workspace-restore.mjs';
import {buildContinuationOptions} from '../../worker/conversation/continuation/options.mjs';
import {executionFault} from './execution-broker.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function createNativeCheckpointRestorer(configuration){
 const c=own(configuration,['journal','objects','workspace','expiresAtMs'],['now']),now=c.now??Date.now,get=storageMethod(c.objects,'get'),claim=storageMethod(c.journal,'claim'),read=storageMethod(c.journal,'read'),record=storageMethod(c.journal,'record');
 if(typeof c.workspace!=='string'||!c.workspace.startsWith('/')||!Number.isSafeInteger(c.expiresAtMs)||typeof now!=='function')throw executionFault('RESTORE_CONFIGURATION');
 function context(value){const v=own(value,['binding','versions','request','sourceRequest','scopes','continuation','restoreKey'],['signal','revalidate']);nativeSignal(v.signal);const {signal,revalidate,...pins}=v,{restoreKey,...target}=pins;
  if(typeof revalidate!=='function'||hash(target)!==restoreKey)throw executionFault('RESTORE_REFUSED');buildContinuationOptions(v.continuation,{binding:v.binding,versions:v.versions,request:v.request,sourceRequest:v.sourceRequest,scopes:v.scopes});
  const check=()=>{if(v.signal?.aborted||now()>=c.expiresAtMs)throw executionFault('RESTORE_REFUSED');};check();return {...v,check};}
 async function bytes(ref,signal){const value=await get(ref,signal);if(!Buffer.isBuffer(value)||value.length!==ref.bytes||value.length>34*1024*1024||sha(value)!==ref.sha256)throw executionFault('RESTORE_OBJECT_REFUSED');return Buffer.from(value);}
 async function opaque(v){const cp=v.continuation.checkpoint,raw=await bytes(cp.opaqueSession,v.signal);v.check();let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{throw executionFault('RESTORE_FORMAT_REFUSED');}
  const key={projectKey:c.workspace.replace(/[^a-zA-Z0-9]/gu,'-'),sessionId:cp.sessionId},snapshot=await createCheckpointSdkSnapshot({key,transcripts:parsed});return {key,snapshot};}
 const intent=v=>({binding:v.binding,restoreKey:v.restoreKey,checkpointSha256:v.continuation.checkpointSha256,contextSha256:v.continuation.contextSha256,sourceRequestSha256:v.continuation.sourceRequestSha256,workspaceSha256:v.continuation.checkpoint.workspaceSha256,opaqueSessionSha256:v.continuation.checkpoint.opaqueSession.sha256,expiresAtMs:c.expiresAtMs});
 const matches=(saved,wanted)=>{if(Object.keys(wanted).some(k=>hash(saved[k])!==hash(wanted[k])))throw executionFault('RESTORE_REFUSED');};
 function response(v){const cp=v.continuation.checkpoint;return data({restoreReceipt:{verificationId:randomUUID(),binding:v.binding,checkpointId:cp.checkpointId,checkpointSha256:v.continuation.checkpointSha256,workspaceSha256:cp.workspaceSha256,opaqueSessionSha256:cp.opaqueSession.sha256,scopes:v.scopes,contextSha256:v.continuation.contextSha256,sourceRequestSha256:v.continuation.sourceRequestSha256,checkedAtMs:now(),expiresAtMs:c.expiresAtMs},sdkSessionKey:{projectKey:c.workspace.replace(/[^a-zA-Z0-9]/gu,'-'),sessionId:v.continuation.mode==='resume'?cp.sessionId:v.continuation.targetSessionId}});}
 async function restore(value){const v=context(value),wanted=intent(v),old=(await read({binding:v.binding,restoreKey:v.restoreKey},v.check)).record;
  if(old){matches(old,wanted);if(old.state!=='RESTORED')throw executionFault('RESTORE_UNKNOWN');await opaque(v);verifyWorkspaceBytes({workspace:c.workspace,manifest:v.continuation.checkpoint.workspace,check:v.check});await v.revalidate();return response(v);}
  const entries=v.continuation.checkpoint.workspace.entries;if(entries.length>256||entries.some(e=>e.object.bytes>8*1024*1024)||entries.reduce((n,e)=>n+e.object.bytes,0)>32*1024*1024)throw executionFault('RESTORE_OBJECT_REFUSED');
  await opaque(v);const files=[];for(const e of entries){files.push(await bytes(e.object,v.signal));v.check();}await v.revalidate();
  const claimed=await claim(wanted,v.check);if(!claimed.dispatch)throw executionFault('RESTORE_UNKNOWN');
  try{restoreWorkspaceBytes({workspace:c.workspace,manifest:v.continuation.checkpoint.workspace,files,check:v.check});await v.revalidate();v.check();
   await record({binding:v.binding,restoreKey:v.restoreKey,state:'RESTORED',receipt:{workspaceSha256:wanted.workspaceSha256,opaqueSessionSha256:wanted.opaqueSessionSha256}},v.check);v.check();return response(v);
  }catch(error){try{await record({binding:v.binding,restoreKey:v.restoreKey,state:'UNKNOWN',receipt:null},()=>{});}catch{}throw executionFault('RESTORE_UNKNOWN');}
 }
 async function snapshot(value){const v=context(value),saved=(await read({binding:v.binding,restoreKey:v.restoreKey},v.check)).record;if(saved?.state!=='RESTORED')throw executionFault('RESTORE_UNKNOWN');matches(saved,intent(v));const source=await opaque(v);await v.revalidate();v.check();
  return {binding:v.binding,key:source.key,checkpointSha256:v.continuation.checkpointSha256,opaqueSessionSha256:v.continuation.checkpoint.opaqueSession.sha256,transcripts:source.snapshot.transcripts()};}
 return Object.freeze({restore,snapshot});
}
