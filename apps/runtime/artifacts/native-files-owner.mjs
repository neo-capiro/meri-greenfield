/** Native cwd/task bytes use the existing object store and durable control/completion rows. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {assertNativeFileUpload,assertNativeFileState,nativeFileSha256} from '../../../packages/contracts/runtime-0.2/files.mjs';
import {assertExecutionIdentity} from '../../control/conversations/execution-boundary.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertTypedResult} from '../../../packages/runtime/objective-generation-custody.mjs';
const same=(a,b)=>hash(a)===hash(b),fail=()=>{throw Error('NATIVE_FILES_UNAVAILABLE');};
const id=value=>{const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
export function createNativeFileOwner(configuration){
 const c=own(configuration,['store','execution','objects','snapshot'],['now','maxRequestMs','retention','objectiveSelection']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??23000;
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail();
 const authenticate=storageMethod(c.execution,'authenticate'),put=storageMethod(c.objects,'put'),get=storageMethod(c.objects,'get'),readFiles=storageMethod(c.snapshot,'readFiles');
 const beginHold=storageMethod(c.store.lifecycle,'beginFileCapture'),recordHold=storageMethod(c.store.lifecycle,'recordFiles'),beginCompletion=storageMethod(c.store.completions,'begin'),publishCompletion=storageMethod(c.store.completions,'publish');
 const servable=c.retention?storageMethod(c.retention,'assertServable'):null,selection=c.objectiveSelection?storageMethod(c.objectiveSelection,'read'):null;
 async function authorized({credential,binding,signal}){validateShape('RunBinding',binding);const a=data(await authenticate({credential,binding,signal}));own(a,['execution','versions','state','scopes','selectedClientId','policyRevision']);assertExecutionIdentity(a.execution);assertNativeConversationScope({binding,scopes:a.scopes,selectedClientId:a.selectedClientId});
  if(!same(a.execution.binding,binding)||a.execution.expiresAtMs<=now()||!['queued','starting','running','completed'].includes(a.state))fail();
  if(servable)await servable({tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId});return a;
 }
 async function operation(raw,body){const v=own(raw,['credential','request'],['signal','deadlineMs']),binding=own(v.request,['binding'],Object.keys(v.request).filter(k=>k!=='binding')).binding;
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs??now()+maxRequestMs,now()+maxRequestMs),errorFactory:()=>Error('NATIVE_FILES_UNAVAILABLE')});
  const auth=()=>life.run(signal=>authorized({credential:v.credential,binding,signal}));
  try{const a=await auth();life.limitDeadline(a.execution.expiresAtMs);const pin=x=>({execution:x.execution,versions:x.versions,scopes:x.scopes,selectedClientId:x.selectedClientId,policyRevision:x.policyRevision});
   const recheck=async()=>{const current=await auth();if(!same(pin(current),pin(a)))fail();life.check();};return await body(v,a,life,recheck);
  }finally{life.close();}
 }
 async function capture(value,{completion=false}={}){return operation(value,async(v,a,life,recheck)=>{
  const input=own(v.request,['binding','sessionId','files','taskFiles',...(completion?[]:['controlId'])],completion?['typedResult']:[]),upload=assertNativeFileUpload({files:input.files,taskFiles:input.taskFiles}),binding=input.binding;
  const withoutBytes=rows=>rows.map(({base64,...metadata})=>metadata),requestSha256=hash({binding,sessionId:input.sessionId,...(completion?{completion:true,typedResult:input.typedResult??null}:{controlId:input.controlId}),files:withoutBytes(upload.files),taskFiles:withoutBytes(upload.taskFiles)});
  const key={binding,scopes:a.scopes,selectedClientId:a.selectedClientId},attempt={...key,sessionId:input.sessionId};let typed={};
  if(input.typedResult!==undefined){if(!selection)fail();const descriptor=assertTypedResult(input.typedResult,{binding,sessionId:input.sessionId}),rows=upload.files.filter(f=>f.path===descriptor.path);
   if(descriptor.resultRef!==binding.runId||descriptor.execution.receiptRef!==binding.runId||rows.length!==1||rows[0].executable||rows[0].sha256!==descriptor.fileSha256||rows[0].bytes!==descriptor.bytes)fail();
   typed={typedResult:descriptor,typedSelection:await life.run(signal=>selection({binding,typedResult:descriptor,signal}))};}
  const claimed=await life.run(()=>completion?beginCompletion({...attempt,completionId:binding.runId,checkpointId:binding.runId,kind:'native-session',filesRequestSha256:requestSha256,...typed},life.check):beginHold({...attempt,controlId:input.controlId,requestSha256},life.check));
  if(!claimed.capture){const files=completion?claimed.proof?.files:claimed.files;if(!files)fail();await recheck();return completion?{binding,state:'completed',proof:claimed.proof}:{binding,controlId:input.controlId,files};}
  const entries=async(rows,tree)=>{const result=[];for(const raw of rows){life.check();const bytes=Buffer.from(raw.base64,'base64'),objectId=id({binding,requestSha256,tree,path:raw.path}),object=await life.run(signal=>put({objectId,bytes,scopes:a.scopes,requestSha256},signal));
    if(object.objectId!==objectId||object.sha256!==raw.sha256||object.bytes!==raw.bytes||!same(object.scopes,a.scopes))fail();result.push({path:raw.path,kind:'file',executable:raw.executable,object});}return result;};
  // Any failed/unknown put leaves the existing durable attempt uncompleted; no automatic upload replay or fabricated inventory.
  const files=assertNativeFileState({workspace:{contractVersion:'0.1.0',manifestId:id({binding,requestSha256,manifest:true}),binding,logicalCwd:'/workspace/conversation',entries:await entries(upload.files,'workspace'),scopes:a.scopes,createdAt:new Date(now()).toISOString()},tasks:await entries(upload.taskFiles,'tasks')},{binding,scopes:a.scopes});
  await recheck();
  if(!completion){await life.run(()=>recordHold({...attempt,controlId:input.controlId,requestSha256,files},life.check));await recheck();return {binding,controlId:input.controlId,files};}
  const event=(eventId,type,data)=>({contractVersion:'0.1.0',eventId,type,data,createdAt:new Date(now()).toISOString()}),published=await life.run(()=>publishCompletion({...key,completionId:binding.runId,files,events:[event(claimed.verifiedEventId,'checkpoint.verified',{checkpointId:binding.runId}),event(claimed.completedEventId,'run.status',{state:'completed',reasonCode:null})]},life.check));
  await recheck();return {binding,state:'completed',proof:published.proof};
 });}
 async function restore(value){return operation(value,async(v,a,life,recheck)=>{const input=own(v.request,['binding']),saved=own(await life.run(signal=>readFiles({credential:v.credential,request:input,signal,deadlineMs:a.execution.expiresAtMs})),['binding','sdkSession','files']);
  if(!same(saved.binding,input.binding))fail();if(saved.files===null){await recheck();return {binding:input.binding,files:null,upload:null};}
  if(!saved.sdkSession)fail();const state=assertNativeFileState(saved.files,{binding:saved.sdkSession.binding,scopes:a.scopes}),read=async entries=>{const result=[];for(const entry of entries){const bytes=await life.run(signal=>get(entry.object,signal));if(!Buffer.isBuffer(bytes)||bytes.length!==entry.object.bytes||nativeFileSha256(bytes)!==entry.object.sha256)fail();result.push({path:entry.path,executable:entry.executable,bytes:bytes.length,sha256:entry.object.sha256,base64:bytes.toString('base64')});}return result;};
  const upload=assertNativeFileUpload({files:await read(state.workspace.entries),taskFiles:await read(state.tasks)});await recheck();return {binding:input.binding,files:state,upload};
 });}
 return Object.freeze({authenticate:authorized,capture:value=>capture(value),complete:value=>capture(value,{completion:true}),restore});
}
