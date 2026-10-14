/** Persisted target joins and borrowed native restore provenance; no session codec/storage owner. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {assertSdkSessionKey} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {buildContinuationOptions} from '../../worker/conversation/continuation/options.mjs';
import {assertRestoreReceipt} from '../../worker/conversation/continuation/native-receipts.mjs';
import {executionFault} from './execution-broker.mjs';
const same=(a,b)=>hash(a)===hash(b),hints=['continuation','sourceRequest','request','scopes'];
export function createNativeContinuationRuntime(configuration){
 const c=own(configuration,['store','verifier','taskCapability'],['restorer','now']);
 const read=storageMethod(c.store,'read'),execution=storageMethod(c.store.lifecycle,'execution'),verify=storageMethod(c.verifier,'verify'),now=c.now??Date.now;
 const nativeOwner=c.restorer?own(c.restorer,['restore','registration']):null;
 const restore=nativeOwner?storageMethod(c.restorer,'restore'):null,registration=nativeOwner?storageMethod(nativeOwner.registration,'read'):null;
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
  const restored=data(own(await restore({...context,restoreKey:hash(context),signal:input.signal}),['restoreReceipt','sdkSessionKey']));
  const expiresAtMs=assertRestoreReceipt(restored.restoreReceipt,{...context,started,now}),key=assertSdkSessionKey(restored.sdkSessionKey,{main:true}),expected=context.continuation.mode==='resume'?context.continuation.checkpoint.sessionId:context.continuation.targetSessionId;
  if(key.sessionId!==expected)throw executionFault('CONTINUATION_REFUSED');
  const final=await snapshot(input.binding,input.signal);
  if(!same(pin(first),pin(final))||expiresAtMs>Math.min(first.receipt.expiresAtMs,final.receipt.expiresAtMs)||expiresAtMs<=now())throw executionFault('CONTINUATION_REFUSED');
  return restored;
 }
 async function readRegistration(value){
  const input=own(value,['binding','key'],['signal','deadlineMs']),first=await snapshot(input.binding,input.signal);
  if(first.saved===null)return null;
  const expected=first.saved.continuation.mode==='resume'?first.saved.continuation.checkpoint.sessionId:first.saved.continuation.targetSessionId,key=assertSdkSessionKey(input.key,{main:true});
  if(!registration||key.sessionId!==expected)throw executionFault('CONTINUATION_REFUSED');
  // This is an independent owner read, never a receipt uploaded by the worker.
  // The canonical session owner validates its native observation and persists it.
  const observation=await registration(input);if(observation===null||observation===undefined)throw executionFault('CONTINUATION_REFUSED');
  const final=await snapshot(input.binding,input.signal);
  if(!same(pin(first),pin(final)))throw executionFault('CONTINUATION_REFUSED');return observation;
 }
 return Object.freeze({prepare,readRegistration});
}
