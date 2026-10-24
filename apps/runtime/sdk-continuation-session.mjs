/** Immutable persisted SDK entries bootstrap resume; genuine target init gates all writes. */
import {randomUUID} from 'node:crypto';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {assertSdkSessionKey} from '../../packages/contracts/runtime-0.2/session.mjs';
import {assertContinuationEnvelope} from '../../packages/contracts/conversation-lifecycle/validate.mjs';
import {assertNextTurnLineage} from '../worker/conversation/continuation/next-turn-options.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {copySessionEntries,scopedSessionKey} from '../worker/qualification/checkpoint/bound-session-store.mjs';
import {createNativeBoundSdkSessionStore} from './sdk-session-client.mjs';
import {createNativeSdkSnapshot} from './sdk-session-snapshot.mjs';
import {fault} from './config.mjs';
export async function createContinuationRuntimeSdkSession(configuration){
 const c=own(configuration,['client','binding','sessionKey'],['continuation','nextTurn','signal','runtimeSignal']);nativeSignal(c.signal);nativeSignal(c.runtimeSignal);
 if((c.continuation===undefined)===(c.nextTurn===undefined))throw fault('RUNNER_SDK_RESTORE_REFUSED');
 const continuation=c.nextTurn!==undefined?assertNextTurnLineage(c.nextTurn,c.binding):assertContinuationEnvelope(c.continuation);
 const target=assertSdkSessionKey(c.sessionKey,{main:true}),methods=Object.fromEntries(['snapshot','register','load','append','listSubkeys'].map(k=>[k,storageMethod(c.client,k)])),abort=new AbortController(),signal=AbortSignal.any([abort.signal,...[c.runtimeSignal].filter(Boolean)]);
 const native=Boolean(c.nextTurn?.sdkSession||c.continuation?.kind==='native-session'),reference=c.nextTurn?.sdkSession??c.continuation?.sdkSession,raw=own(await methods.snapshot({},{signal:AbortSignal.any([signal,...[c.signal].filter(Boolean)])}),['binding','key','transcripts',...(native?['sdkSession']:['checkpointSha256','opaqueSessionSha256'])]);
 if(hash(raw.binding)!==hash(c.binding)||raw.key.projectKey!==target.projectKey||target.sessionId!==(c.nextTurn!==undefined||continuation.mode==='resume'?raw.key.sessionId:continuation.targetSessionId))throw fault('RUNNER_SDK_RESTORE_REFUSED');
 if(native){if(hash(raw.sdkSession)!==hash(reference)||hash(raw.key)!==hash(reference.key))throw fault('RUNNER_SDK_RESTORE_REFUSED');}
 else if(raw.key.sessionId!==continuation.checkpoint.sessionId||raw.checkpointSha256!==continuation.checkpointSha256||raw.opaqueSessionSha256!==continuation.checkpoint.opaqueSession.sha256)throw fault('RUNNER_SDK_RESTORE_REFUSED');
 const source=await createNativeSdkSnapshot({key:raw.key,transcripts:raw.transcripts}),batches=[];
 if(native&&source.transcripts().reduce((n,row)=>n+row.entries.length,0)!==reference.entriesCount)throw fault('RUNNER_SDK_RESTORE_REFUSED');
 for(const row of source.transcripts()){
  const key={...target,...(row.subpath===undefined?{}:{subpath:row.subpath})};let part=[],bytes=2,offset=0;
  const flush=()=>{const entries=copySessionEntries(part);batches.push({key,appendId:randomUUID(),expectedOffset:offset,entriesSha256:hash(entries),entries});offset+=entries.length;part=[];bytes=2;};
  for(const entry of row.entries){const size=Buffer.byteLength(JSON.stringify(entry))+1;if(size>8388606)throw fault('RUNNER_SDK_RESTORE_REFUSED');if(part.length>=1000||bytes+size>8388608)flush();part.push(entry);bytes+=size;}
  if(part.length||!row.entries.length)flush();
 }
 let bound,bootstrap,closed=false,failed=false,ready=false;const initialized=Promise.withResolvers();initialized.promise.catch(()=>{});
 const check=()=>{if(closed||signal.aborted||failed)throw fault('RUNNER_SDK_SESSION_UNKNOWN');};
 function observeInit(frame){
  check();if(frame?.type!=='system'||frame.subtype!=='init'||frame.session_id!==target.sessionId){failed=true;initialized.reject(fault('RUNNER_SDK_INIT_REFUSED'));throw fault('RUNNER_SDK_INIT_REFUSED');}
  initialized.resolve();
 }
 function first(key){check();scopedSessionKey(key,target,!bound);
  if(bound)return bound;
  const admitted={register:methods.register,...Object.fromEntries(['load','append','listSubkeys'].map(name=>[name,async(input,options)=>{check();return methods[name](input,{...options,signal});}]))};
  bound=createNativeBoundSdkSessionStore({client:admitted,binding:c.binding,sessionKey:target});
  bootstrap=initialized.promise.then(async()=>{check();await methods.register({key:target},{signal});check();
   // Exact immutable history seeds a distinct target namespace only AFTER the
   // canonical owner establishes the independently observed native target key.
   for(const batch of batches){await methods.append(batch,{signal});check();}ready=true;
  });bootstrap.catch(()=>{failed=true;});return bound;
 }
 const store=Object.freeze({observeInit,async load(key){check();const captured=assertSdkSessionKey(key);if(continuation.mode==='fork'&&captured.sessionId===source.key.sessionId||!ready)return source.store.load(captured);return bound.store.load(captured);},async listSubkeys(key){check();const captured=assertSdkSessionKey(key,{main:true});if(continuation.mode==='fork'&&captured.sessionId===source.key.sessionId||!ready)return source.store.listSubkeys(captured);return bound.store.listSubkeys(captured);},async append(key,entries){try{check();const copied=copySessionEntries(entries),target=first(key);
  // The bootstrap's register and restore appends each run on their own RPC allowance; the bound store's per-call timer starts
  // only once they are done, so it covers this call's own load and append.
  await bootstrap;check();return await target.store.append(key,copied);}catch(error){failed=true;throw error;}}});
 const settle=async()=>{check();if(!bound)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');const result=await bound.settleObservedCalls();await bootstrap;check();if(result.uncertain||result.appendFailures||result.rejectedAppends)throw fault('RUNNER_SDK_SESSION_UNKNOWN');};
 const close=async()=>{closed=true;abort.abort();initialized.reject(fault('RUNNER_SESSION_STOPPED'));if(bound){bound.closeMirror();const result=await bound.settleObservedCalls();await bootstrap;if(failed||result.uncertain||result.appendFailures||result.rejectedAppends)throw fault('RUNNER_SDK_SESSION_UNKNOWN');}};
 return Object.freeze({store,settle,close});
}
