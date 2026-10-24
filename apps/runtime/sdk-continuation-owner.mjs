/** Current execution reads canonical native lineage; no task grant, object checkpoint or model authority. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {assertExecutionIdentity} from '../control/conversations/execution-boundary.mjs';
import {assertSdkSessionKey,assertNativeSessionReference,assertNativeConversationScope} from '../../packages/contracts/runtime-0.2/session.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {buildNextTurnOptions} from '../worker/conversation/continuation/next-turn-options.mjs';
import {buildContinuationOptions} from '../worker/conversation/continuation/options.mjs';
import {createNativeSdkSnapshot} from './sdk-session-snapshot.mjs';
import {assertNativeFileState} from '../../packages/contracts/runtime-0.2/files.mjs';
const same=(a,b)=>hash(a)===hash(b),hints=['continuation','nextTurn','sourceRequest','request','scopes'];
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createNativeSessionContinuation(configuration){
 const c=own(configuration,['store','execution','versions','maxOutputBytes'],['objectiveSelection','now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 const versions=data(c.versions);validateShape('RuntimeVersions',versions);
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(c.maxOutputBytes)||c.maxOutputBytes<1||c.maxOutputBytes>1048576)fail('CONTINUATION_CONFIGURATION');
 const authenticate=storageMethod(c.execution,'authenticate'),read=storageMethod(c.store,'read'),next=storageMethod(c.store.nextRuns,'execution'),lifecycle=storageMethod(c.store.lifecycle,'execution');
 const nextSnapshot=storageMethod(c.store.nextRuns,'sessionSnapshot');
 // The lifecycle snapshot is a canonical journal operation, added by the paired native control cut.
 const lifecycleSnapshot=c.store.lifecycle.sessionSnapshot?storageMethod(c.store.lifecycle,'sessionSnapshot'):null;
 async function operation(value,body){
  const raw=own(value,['credential','request'],['signal','deadlineMs']);
  if(typeof raw.credential!=='string'||!raw.credential||raw.credential.length>8192)fail('CONTINUATION_REFUSED');
  const started=now(),deadlineMs=Math.min(raw.deadlineMs??started+maxRequestMs,started+maxRequestMs);
  const life=createOperationLifetime({now,signal:raw.signal,deadlineMs,errorFactory:()=>Object.assign(Error('CONTINUATION_UNAVAILABLE'),{code:'CONTINUATION_UNAVAILABLE'})});
  try{return await body(raw,life);}finally{life.close();}
 }
 async function authority(raw,binding,life){
  validateShape('RunBinding',binding);
  const a=data(await life.run(signal=>authenticate({credential:raw.credential,binding,signal})));
  own(a,['execution','versions','state','scopes','selectedClientId','policyRevision']);assertExecutionIdentity(a.execution);
  if(!same(a.execution.binding,binding)||!same(a.versions,versions)||!['queued','starting','running'].includes(a.state)||!Array.isArray(a.scopes)||!a.scopes.length||a.scopes.length>100||new Set(a.scopes.map(hash)).size!==a.scopes.length||typeof a.policyRevision!=='string'||!a.policyRevision)fail('CONTINUATION_REFUSED');
  for(const scope of a.scopes){validateShape('Scope',scope);if(scope.tenantId!==binding.tenantId||scope.policyRevision!==a.policyRevision)fail('CONTINUATION_REFUSED');}
  assertNativeConversationScope({binding,scopes:a.scopes,selectedClientId:a.selectedClientId});
  life.limitDeadline(a.execution.expiresAtMs);life.check();return a;
 }
 const authorityPin=a=>({execution:a.execution,versions:a.versions,scopes:a.scopes,selectedClientId:a.selectedClientId,policyRevision:a.policyRevision});
 async function canonical(raw,binding,life){
  const admitted=await authority(raw,binding,life),target=data(await life.run(()=>read(binding,{},life.check))),selection={binding,scopes:admitted.scopes,selectedClientId:admitted.selectedClientId};
  if(!same(target.run.binding,binding)||!same(target.run.versions,versions)||!same(target.run.scopes,admitted.scopes)||target.run.policyRevision!==admitted.policyRevision||!['queued','starting','running'].includes(target.run.state))fail('CONTINUATION_REFUSED');
  const continued=data(await life.run(()=>lifecycle(selection,life.check))),following=data(await life.run(()=>next(selection,life.check)));
  if(continued!==null&&following!==null)fail('CONTINUATION_REFUSED');
  const saved=following??continued;let key=null,reference=null,kind=null;
  if(saved!==null){
   kind=following===null?'continuation':'nextTurn';
   own(saved,kind==='nextTurn'?['nextTurn']:['continuation','sourceRequest']);
   const lineage=saved[kind];reference=assertNativeSessionReference(lineage.sdkSession);
   const context={binding,versions,scopes:admitted.scopes,request:target.request,sourceRequest:kind==='nextTurn'?lineage.sourceRequest:saved.sourceRequest};
   if(kind==='nextTurn')buildNextTurnOptions(lineage,context);else {if(lineage.kind!=='native-session')fail('CONTINUATION_REFUSED');buildContinuationOptions(lineage,context);}
   key=assertSdkSessionKey({...reference.key,...(kind==='continuation'&&lineage.mode==='fork'?{sessionId:lineage.targetSessionId}:{})},{main:true});
  }
  return {admitted,target,selection,saved,kind,key,reference};
 }
 async function finalAuthority(raw,binding,first,life){
  const current=await authority(raw,binding,life);if(!same(authorityPin(first),authorityPin(current)))fail('CONTINUATION_REFUSED');life.check();
 }
 async function prepareRuntime(value){return operation(value,async(raw,life)=>{
  const input=data(own(raw.request,['binding','versions'],hints));if(!same(input.versions,versions))fail('CONTINUATION_REFUSED');
  const saved=await canonical(raw,input.binding,life),provided=hints.filter(k=>Object.hasOwn(input,k));
  if(saved.saved===null){if(provided.length)fail('CONTINUATION_REFUSED');}
  else {const required=[saved.kind,'sourceRequest','request','scopes'],sourceRequest=saved.kind==='nextTurn'?saved.saved.nextTurn.sourceRequest:saved.saved.sourceRequest;
   if(provided.length!==required.length||!required.every(k=>provided.includes(k))||!same(input[saved.kind],saved.saved[saved.kind])||!same(input.sourceRequest,sourceRequest)||!same(input.request,saved.target.request)||!same(input.scopes,saved.admitted.scopes))fail('CONTINUATION_REFUSED');}
  const objective=c.objectiveSelection===undefined?undefined:await life.run(signal=>storageMethod(c.objectiveSelection,'read')({binding:input.binding,signal}));
  if(objective&&saved.saved!==null)fail('CONTINUATION_REFUSED');
  await finalAuthority(raw,input.binding,saved.admitted,life);
  return {binding:input.binding,versions,deadlineMs:saved.admitted.execution.expiresAtMs,maxOutputBytes:c.maxOutputBytes,sdkSessionKey:saved.key,...(objective===undefined?{}:{objective})};
 });}
 async function readSnapshot(value){return operation(value,async(raw,life)=>{
  const input=data(own(raw.request,['binding'])),saved=await canonical(raw,input.binding,life);
  if(!saved.reference)fail('CONTINUATION_REFUSED');const load=saved.kind==='nextTurn'?nextSnapshot:lifecycleSnapshot;if(!load)fail('CONTINUATION_UNAVAILABLE');
  const result=own(await life.run(()=>load(saved.selection,life.check)),['binding','key','sdkSession','transcripts']);
  if(!same(result.binding,input.binding)||!same(result.sdkSession,saved.reference)||!same(result.key,saved.reference.key))fail('CONTINUATION_REFUSED');
  const snapshot=await life.run(()=>createNativeSdkSnapshot({key:result.key,transcripts:result.transcripts})),transcripts=snapshot.transcripts();
  if(transcripts.reduce((n,s)=>n+s.entries.length,0)!==saved.reference.entriesCount)fail('CONTINUATION_REFUSED');
  await finalAuthority(raw,input.binding,saved.admitted,life);
  return {binding:input.binding,key:result.key,sdkSession:saved.reference,transcripts};
 });}
 async function readFiles(value){return operation(value,async(raw,life)=>{
  const input=data(own(raw.request,['binding'])),saved=await canonical(raw,input.binding,life);
  if(!saved.reference){await finalAuthority(raw,input.binding,saved.admitted,life);return {binding:input.binding,sdkSession:null,files:null};}
  const load=storageMethod(saved.kind==='nextTurn'?c.store.nextRuns:c.store.lifecycle,'fileSnapshot'),result=own(await life.run(()=>load(saved.selection,life.check)),['binding','sdkSession','files']);
  if(!same(result.binding,input.binding)||!same(result.sdkSession,saved.reference))fail('CONTINUATION_REFUSED');if(result.files!==null)assertNativeFileState(result.files,{binding:saved.reference.binding,scopes:saved.admitted.scopes});
  await finalAuthority(raw,input.binding,saved.admitted,life);return result;
 });}
 return Object.freeze({prepareRuntime,readSnapshot,readFiles});
}
