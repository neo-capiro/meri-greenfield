/** Persisted target joins and borrowed native restore provenance; no session codec/storage owner. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {assertSdkSessionKey} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {buildContinuationOptions} from '../../worker/conversation/continuation/options.mjs';
import {assertRestoreReceipt} from '../../worker/conversation/continuation/native-receipts.mjs';
import {executionFault} from './execution-broker.mjs';
import {capabilityDigest,matchesCapability} from './task-verifier.mjs';
import {createCheckpointSdkSnapshot} from './checkpoint-snapshot.mjs';
const same=(a,b)=>hash(a)===hash(b),hints=['continuation','sourceRequest','request','scopes'];
export function createNativeContinuationRuntime(configuration){
 const c=own(configuration,['store','verifier','taskCapability'],['restorer','now']);
 const read=storageMethod(c.store,'read'),execution=storageMethod(c.store.lifecycle,'execution'),verify=storageMethod(c.verifier,'verify'),now=c.now??Date.now;
 const nativeOwner=c.restorer?own(c.restorer,['restore','snapshot']):null;
 const restore=nativeOwner?storageMethod(c.restorer,'restore'):null,readNativeSnapshot=nativeOwner?storageMethod(c.restorer,'snapshot'):null;
 if(typeof now!=='function')throw executionFault('CONTINUATION_CONFIGURATION');
 async function snapshot(binding,signal){
  nativeSignal(signal);const check=()=>{if(signal?.aborted)throw executionFault('REFUSED');};
  const started=now(),receipt=assertWorkerAuthorization(await verify({capability:c.taskCapability,binding,operation:'load',inputSha256:hash({binding}),signal}),{binding,operation:'load',inputSha256:hash({binding}),started,now});
  check();const target=data(await read(binding,{},check)),saved=data(await execution({binding,scopes:receipt.scopes,selectedClientId:receipt.selectedClientId},check));check();
  if(!same(target.run.binding,binding)||!same(target.run.scopes,receipt.scopes)||!['queued','running'].includes(target.run.state))throw executionFault('CONTINUATION_REFUSED');
  if(saved!==null){own(saved,['continuation','sourceRequest']);buildContinuationOptions(saved.continuation,{binding,versions:target.run.versions,scopes:receipt.scopes,request:target.request,sourceRequest:saved.sourceRequest});}
  return {target,saved,receipt};
 }
 const pin=s=>data({run:s.target.run,request:s.target.request,saved:s.saved,scopes:s.receipt.scopes,selectedClientId:s.receipt.selectedClientId,policyRevision:s.receipt.policyRevision});
 async function prepare(value){
  const input=own(value,['binding','versions'],['signal',...hints]),first=await snapshot(input.binding,input.signal),provided=hints.filter(k=>Object.hasOwn(input,k));
  if(!same(first.target.run.versions,input.versions))throw executionFault('CONTINUATION_REFUSED');
  if(first.saved===null){if(provided.length)throw executionFault('CONTINUATION_REFUSED');return null;}
  if(provided.length!==hints.length||!same(input.continuation,first.saved.continuation)||!same(input.sourceRequest,first.saved.sourceRequest)||!same(input.request,first.target.request)||!same(input.scopes,first.receipt.scopes)||!restore)throw executionFault('CONTINUATION_REFUSED');
  const context={binding:input.binding,versions:first.target.run.versions,request:first.target.request,sourceRequest:first.saved.sourceRequest,scopes:first.receipt.scopes,continuation:first.saved.continuation},started=now();
  // The borrowed owner must durably deduplicate this original target; uncertain
  // restoration must remain UNKNOWN rather than repeat physical writes.
  const restored=data(own(await restore({...context,restoreKey:hash(context),signal:input.signal,revalidate:async()=>{const current=await snapshot(input.binding,input.signal);if(!same(pin(first),pin(current)))throw executionFault('CONTINUATION_REFUSED');}}),['restoreReceipt','sdkSessionKey']));
  const expiresAtMs=assertRestoreReceipt(restored.restoreReceipt,{...context,started,now}),key=assertSdkSessionKey(restored.sdkSessionKey,{main:true}),expected=context.continuation.mode==='resume'?context.continuation.checkpoint.sessionId:context.continuation.targetSessionId;
  if(key.sessionId!==expected)throw executionFault('CONTINUATION_REFUSED');
  const final=await snapshot(input.binding,input.signal);
  if(!same(pin(first),pin(final))||expiresAtMs>Math.min(first.receipt.expiresAtMs,final.receipt.expiresAtMs)||expiresAtMs<=now())throw executionFault('CONTINUATION_REFUSED');
  return restored;
 }
 async function readSnapshot(value){
  const input=own(value,['credential','request'],['signal','deadlineMs']),request=own(input.request,['binding']);
  if(!matchesCapability(input.credential,capabilityDigest(c.taskCapability)))throw executionFault('CONTINUATION_REFUSED');
  const first=await snapshot(request.binding,input.signal);if(!first.saved||!readNativeSnapshot)throw executionFault('CONTINUATION_REFUSED');
  const context={binding:request.binding,versions:first.target.run.versions,request:first.target.request,sourceRequest:first.saved.sourceRequest,scopes:first.receipt.scopes,continuation:first.saved.continuation};
  const raw=own(await readNativeSnapshot({...context,restoreKey:hash(context),signal:input.signal,revalidate:async()=>{const current=await snapshot(request.binding,input.signal);if(!same(pin(first),pin(current)))throw executionFault('CONTINUATION_REFUSED');}}),['binding','key','checkpointSha256','opaqueSessionSha256','transcripts']);
  const {transcripts,...headers}=raw,header=data(headers),cp=first.saved.continuation.checkpoint;
  if(!same(header.binding,request.binding)||header.key.sessionId!==cp.sessionId||header.checkpointSha256!==first.saved.continuation.checkpointSha256||header.opaqueSessionSha256!==cp.opaqueSession.sha256)throw executionFault('CONTINUATION_REFUSED');
  const source=await createCheckpointSdkSnapshot({key:header.key,transcripts}),final=await snapshot(request.binding,input.signal);
  if(!same(pin(first),pin(final)))throw executionFault('CONTINUATION_REFUSED');return {...header,transcripts:source.transcripts()};
 }
 return Object.freeze({prepare,readSnapshot});
}
