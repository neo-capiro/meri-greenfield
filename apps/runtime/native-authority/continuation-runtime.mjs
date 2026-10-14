/** Persisted target joins and borrowed native restore provenance; no session codec/storage owner. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {assertSdkSessionKey} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {buildNextTurnOptions} from '../../worker/conversation/continuation/next-turn-options.mjs';
import {buildContinuationOptions} from '../../worker/conversation/continuation/options.mjs';
import {assertRestoreReceipt} from '../../worker/conversation/continuation/native-receipts.mjs';
import {executionFault} from './execution-broker.mjs';
import {capabilityDigest,matchesCapability} from './task-verifier.mjs';
import {createCheckpointSdkSnapshot} from './checkpoint-snapshot.mjs';
const same=(a,b)=>hash(a)===hash(b),hints=['continuation','nextTurn','sourceRequest','request','scopes'];
const lineage=s=>s.nextTurn??s.continuation;
const savedContext=s=>({binding:s.target.run.binding,versions:s.target.run.versions,request:s.target.request,sourceRequest:s.saved.nextTurn?.sourceRequest??s.saved.sourceRequest,scopes:s.receipt.scopes,...(s.saved.nextTurn?{nextTurn:s.saved.nextTurn}:{continuation:s.saved.continuation})});
export function createNativeContinuationRuntime(configuration){
 const c=own(configuration,['store','verifier','taskCapability'],['restorer','now']);
 const read=storageMethod(c.store,'read'),execution=storageMethod(c.store.lifecycle,'execution'),verify=storageMethod(c.verifier,'verify'),now=c.now??Date.now;
 const nextExecution=c.store.nextRuns?storageMethod(c.store.nextRuns,'execution'):null;
 const nativeOwner=c.restorer?own(c.restorer,['restore','snapshot']):null;
 const restore=nativeOwner?storageMethod(c.restorer,'restore'):null,readNativeSnapshot=nativeOwner?storageMethod(c.restorer,'snapshot'):null;
 if(typeof now!=='function')throw executionFault('CONTINUATION_CONFIGURATION');
 async function snapshot(binding,signal){
  nativeSignal(signal);const check=()=>{if(signal?.aborted)throw executionFault('REFUSED');};
  const started=now(),receipt=assertWorkerAuthorization(await verify({capability:c.taskCapability,binding,operation:'load',inputSha256:hash({binding}),signal}),{binding,operation:'load',inputSha256:hash({binding}),started,now});
  check();const target=data(await read(binding,{},check)),selection={binding,scopes:receipt.scopes,selectedClientId:receipt.selectedClientId};
  const lifecycle=data(await execution(selection,check)),next=nextExecution?data(await nextExecution(selection,check)):null;check();
  if(lifecycle!==null&&next!==null)throw executionFault('CONTINUATION_REFUSED');const saved=next??lifecycle;
  if(!same(target.run.binding,binding)||!same(target.run.scopes,receipt.scopes)||!['queued','running'].includes(target.run.state))throw executionFault('CONTINUATION_REFUSED');
  if(saved!==null){if(next!==null){own(saved,['nextTurn']);buildNextTurnOptions(saved.nextTurn,{binding,versions:target.run.versions,scopes:receipt.scopes,request:target.request,sourceRequest:saved.nextTurn.sourceRequest});}
   else {own(saved,['continuation','sourceRequest']);buildContinuationOptions(saved.continuation,{binding,versions:target.run.versions,scopes:receipt.scopes,request:target.request,sourceRequest:saved.sourceRequest});}}
  return {target,saved,receipt};
 }
 const pin=s=>data({run:s.target.run,request:s.target.request,saved:s.saved,scopes:s.receipt.scopes,selectedClientId:s.receipt.selectedClientId,policyRevision:s.receipt.policyRevision});
 async function prepare(value){
  const input=own(value,['binding','versions'],['signal',...hints]),first=await snapshot(input.binding,input.signal),provided=hints.filter(k=>Object.hasOwn(input,k));
  if(!same(first.target.run.versions,input.versions))throw executionFault('CONTINUATION_REFUSED');
  if(first.saved===null){if(provided.length)throw executionFault('CONTINUATION_REFUSED');return null;}
  const kind=first.saved.nextTurn?'nextTurn':'continuation',required=[kind,'sourceRequest','request','scopes'];
  if(provided.length!==required.length||!required.every(k=>provided.includes(k))||!same(input[kind],first.saved[kind])||!same(input.sourceRequest,first.saved.nextTurn?.sourceRequest??first.saved.sourceRequest)||!same(input.request,first.target.request)||!same(input.scopes,first.receipt.scopes)||!restore)throw executionFault('CONTINUATION_REFUSED');
  const context=savedContext(first),started=now();
  // The borrowed owner must durably deduplicate this original target; uncertain
  // restoration must remain UNKNOWN rather than repeat physical writes.
  const restored=data(own(await restore({...context,restoreKey:hash(context),signal:input.signal,revalidate:async()=>{const current=await snapshot(input.binding,input.signal);if(!same(pin(first),pin(current)))throw executionFault('CONTINUATION_REFUSED');}}),['restoreReceipt','sdkSessionKey']));
  const expiresAtMs=assertRestoreReceipt(restored.restoreReceipt,{...context,continuation:lineage(context),started,now}),key=assertSdkSessionKey(restored.sdkSessionKey,{main:true}),expected=context.nextTurn?context.nextTurn.checkpoint.sessionId:context.continuation.mode==='resume'?context.continuation.checkpoint.sessionId:context.continuation.targetSessionId;
  if(key.sessionId!==expected)throw executionFault('CONTINUATION_REFUSED');
  const final=await snapshot(input.binding,input.signal);
  if(!same(pin(first),pin(final))||expiresAtMs>Math.min(first.receipt.expiresAtMs,final.receipt.expiresAtMs)||expiresAtMs<=now())throw executionFault('CONTINUATION_REFUSED');
  return restored;
 }
 async function readSnapshot(value){
  const input=own(value,['credential','request'],['signal','deadlineMs']),request=own(input.request,['binding']);
  if(!matchesCapability(input.credential,capabilityDigest(c.taskCapability)))throw executionFault('CONTINUATION_REFUSED');
  const first=await snapshot(request.binding,input.signal);if(!first.saved||!readNativeSnapshot)throw executionFault('CONTINUATION_REFUSED');
  const context=savedContext(first);
  const raw=own(await readNativeSnapshot({...context,restoreKey:hash(context),signal:input.signal,revalidate:async()=>{const current=await snapshot(request.binding,input.signal);if(!same(pin(first),pin(current)))throw executionFault('CONTINUATION_REFUSED');}}),['binding','key','checkpointSha256','opaqueSessionSha256','transcripts']);
  const {transcripts,...headers}=raw,header=data(headers),cp=lineage(first.saved).checkpoint;
  if(!same(header.binding,request.binding)||header.key.sessionId!==cp.sessionId||header.checkpointSha256!==lineage(first.saved).checkpointSha256||header.opaqueSessionSha256!==cp.opaqueSession.sha256)throw executionFault('CONTINUATION_REFUSED');
  const source=await createCheckpointSdkSnapshot({key:header.key,transcripts}),final=await snapshot(request.binding,input.signal);
  if(!same(pin(first),pin(final)))throw executionFault('CONTINUATION_REFUSED');return {...header,transcripts:source.transcripts()};
 }
 return Object.freeze({prepare,readSnapshot});
}
