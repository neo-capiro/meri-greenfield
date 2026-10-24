/** Actual native runtime/session owners and SDK store, with scripted SQL and no model or server. */
import test from 'node:test';import assert from 'node:assert/strict';
import {nativeFixture,binding,scopes,id,check,rowKey} from '../../../control/conversations/test/native-next-run-fixture.mjs';
import {createNativeContinuationRuntime} from '../continuation-runtime.mjs';
import {createNativeRuntimeProvider} from '../runtime-provider.mjs';
import {createDurableSdkSessionOwner} from '../session-owner.mjs';
import {createNativeSdkSessionApplication} from '../session-http.mjs';
import {createRuntimeSdkSessionFactory} from '../../sdk-session-runtime.mjs';
import {buildConversationOptions} from '../../../worker/conversation/options.mjs';
import {buildNextTurnOptions} from '../../../worker/conversation/continuation/next-turn-options.mjs';
import {continuationSessionId} from '../../../worker/conversation/reads/runtime.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {ProductError,productFailure} from '../../../control/product-access/errors.mjs';
import {capabilityDigest} from '../task-verifier.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../../control/conversations/usage.mjs';
import {createConversationActivity} from '../../../worker/conversation/activity.mjs';

const workerContext=x=>({nextTurn:x.input.nextTurn,sourceRequest:x.input.sourceRequest,request:x.input.request,scopes,started:x.now,now:()=>x.now});
const optionsTarget=x=>({binding:x.target,versions:x.input.versions,sourceRequest:x.input.sourceRequest,request:x.input.request,scopes});
async function fixture(){
 const x=await nativeFixture(),target=await x.second(),now=Date.now(),credential='synthetic-target-task';let revoked=false,unknown=false,changedClient=false,verifies=0;
 const verifier={async verify(input){verifies++;assert.deepEqual(input.binding,target);assert.equal(input.capability,credential);if(revoked)throw Error('target revoked');const run=x.f.state.runs.get(rowKey(target)).projection,current={binding:run.binding,scopes:run.scopes,policyRevision:run.policyRevision};if(!['queued','starting','running'].includes(run.state))throw Error('target terminal');
  return {binding:current.binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-core-current',scopes:current.scopes,selectedClientId:changedClient?id(999):id(5),policyRevision:current.policyRevision,authorizationDecisionId:'canonical-synthetic',checkedAtMs:now,expiresAtMs:now+120000};}};
 const admission={async currentRun(b){assert.deepEqual(b,target);if(revoked)throw Error('target revoked');return JSON.stringify({binding:b,deadlineMs:now+120000});},async withCurrentRun(input,effect){assert.deepEqual(input.binding,target);if(revoked)throw Error('target revoked');const client=await x.f.pool.connect();try{await client.query('BEGIN');const value=await effect({client,current:{binding:target,policyRevision:'policy1',allocationSha256:'d'.repeat(64),deadlineMs:now+120000}});await client.query('COMMIT');if(unknown)throw new ProductError('STORE_COMMIT_UNKNOWN','UNKNOWN');return value;}catch(e){if(productFailure(e)?.outcome!=='UNKNOWN')await client.query('ROLLBACK');throw e;}finally{client.release();}}};
 const continuation=createNativeContinuationRuntime({store:x.f.store,verifier,taskCapability:credential,now:()=>now});
 const sessionOwner=createDurableSdkSessionOwner({admission,authority:verifier,enabled:true,now:()=>now});
 const app=createNativeSdkSessionApplication({owner:sessionOwner,snapshot:continuation,now:()=>now});
 const factory=createRuntimeSdkSessionFactory({origin:'https://synthetic-native.invalid',credential,binding:target,now:()=>now,fetchImpl:(url,options)=>app.handle(new Request(url,options))});
 const saved=await x.f.store.read(target,{},check),lineage=await x.lineage(target),input={binding:target,versions:saved.run.versions,...lineage,sourceRequest:lineage.nextTurn.sourceRequest,request:saved.request,scopes};
 const provider=createNativeRuntimeProvider({runtime:{binding:target,versions:saved.run.versions,deadlineMs:now+120000,maxOutputBytes:1048576},admission,taskCapabilitySha256:capabilityDigest(credential),continuation,enabled:true});
 return {...x,target,now,credential,continuation,factory,input,provider,app,sessionOwner,verifier,verifies:()=>verifies,revoke:()=>{revoked=true;},unknown:()=>{unknown=true;},changeClient:()=>{changedClient=true;}};
}
test('native next turn uses actual persisted 22-entry context and substream through target-authenticated SessionStore, with SDK resume and no restore receipt',async()=>{
 const x=await fixture();let session;try{const runtime=await x.provider.runtime(x.input);assert.deepEqual(runtime.sdkSessionKey,x.sessionKey);assert.equal('restoreReceipt' in runtime,false);
  session=await x.factory({binding:x.target,sessionKey:runtime.sdkSessionKey,nextTurn:x.input.nextTurn});
  const {sdkSessionKey,...prepared}=runtime;const options=buildConversationOptions({...prepared,...SDK_MODEL_CONFIGURATION,cwd:`/workspace/${x.target.conversationId}`,sessionStore:session.store,maxTurns:12,maxCostMicroUSD:1000000,providerEnvironment:{}},new AbortController(),workerContext(x));
  assert.equal(options.resume,x.sessionKey.sessionId);assert.equal(options.forkSession,undefined);assert.equal(options.resumeSessionAt,undefined);assert.equal(continuationSessionId(x.input),x.sessionKey.sessionId);
  assert.deepEqual(await options.sessionStore.load(x.sessionKey),x.transcripts[0].entries);assert.deepEqual(await options.sessionStore.listSubkeys(x.sessionKey),['subagents/original']);assert.deepEqual(await options.sessionStore.load({...x.sessionKey,subpath:'subagents/original'}),x.transcripts[1].entries);
  assert.equal(x.f.state.sdkSessions.size,1,'reads do not register a target or revive expired source authority');
  const secondPrompt={type:'user',uuid:id(1400),message:{role:'user',content:'What object did I ask you to remember?'}};await options.sessionStore.append(x.sessionKey,[secondPrompt]);await session.settle();
  const sourceEntries=x.f.state.sdkEntries.filter(e=>e.run_id===binding.runId).map(e=>e.entry);assert.deepEqual(sourceEntries,x.transcripts.flatMap(p=>p.entries));
  const targetEntries=x.f.state.sdkEntries.filter(e=>e.run_id===x.target.runId&&e.subpath==='').map(e=>e.entry);assert.deepEqual(targetEntries,[...x.transcripts[0].entries,secondPrompt]);assert.equal(x.f.state.sdkSessions.get(rowKey(x.target)).entries_count,23);assert.equal(x.f.state.completions.size,0);
 }finally{await session?.close();x.f.close();}
});
test('actual activity consumes native lineage without checkpoint capture, calls one synthetic query, and retains its session for a third turn',async()=>{
 const x=await fixture();let session,calls=0,closed=0;try{await x.allocate(x.target);
  const runOwner={load:async()=>({...await x.f.store.read(x.target,{},check),...await x.lineage(x.target)}),append:async({event})=>{if(event.type==='run.status'&&event.data.state==='completed')await session.settle();return x.f.store.append(x.target,event,check);},nextControls:async()=>[],claimControl:async()=>{throw Error('unexpected control');},ackControl:async()=>{throw Error('unexpected control');},recordCheckpoint:async()=>{throw Error('no legacy checkpoint');}};
  const execute=createConversationActivity({runOwner,lifecycle:{captureCheckpoint:async()=>{throw Error('native completion cannot capture a legacy checkpoint');}},prepareRuntime:async args=>{const {sdkSessionKey,...runtime}=await x.provider.runtime(x.input);session=await x.factory({binding:x.target,sessionKey:sdkSessionKey,nextTurn:x.input.nextTurn,runtimeSignal:args.runtimeSignal});return {...runtime,...SDK_MODEL_CONFIGURATION,providerEnvironment:{},cwd:`/workspace/${x.target.conversationId}`,sessionStore:session.store,maxTurns:12,maxCostMicroUSD:1000000};},query:({options})=>{calls++;return {async *[Symbol.asyncIterator](){assert.equal(options.resume,x.sessionKey.sessionId);assert.deepEqual(await options.sessionStore.load(x.sessionKey),x.transcripts[0].entries);await options.sessionStore.append(x.sessionKey,[{type:'user',uuid:id(1500),message:{role:'user',content:x.input.request.prompt}}]);yield {type:'system',subtype:'init',session_id:x.sessionKey.sessionId};yield {type:'result',subtype:'success',is_error:false,session_id:x.sessionKey.sessionId};},close(){closed++;}};}});
  assert.deepEqual(await execute({binding:x.target}),{state:'completed'});assert.equal(calls,1);assert.equal(closed,1);assert.equal(x.f.state.completions.size,0);
  await x.retire(x.target);const third=(await x.select()).binding;await x.accept(third,'third prompt');const next=await x.snapshot(third);assert.deepEqual(next.sdkSession.binding,x.target);assert.deepEqual(next.transcripts[0].entries.slice(0,20),x.transcripts[0].entries);assert.equal(next.transcripts[0].entries.at(-1).message.content,x.input.request.prompt);assert.deepEqual(next.transcripts[1],x.transcripts[1]);
 }finally{await session?.close();x.f.close();}
});
for(const mutation of ['target revoked','selected client changed','foreign credential','worker lineage substituted','source transcript corrupt'])test(`native session preparation/snapshot refuses ${mutation} before SDK context can be used`,async()=>{
 const x=await fixture();try{
  if(mutation==='target revoked')x.revoke();if(mutation==='selected client changed')x.changeClient();if(mutation==='source transcript corrupt')x.f.state.sdkEntries[0].entry.message.content='altered';
  if(mutation==='worker lineage substituted'){await assert.rejects(x.continuation.prepare({...x.input,nextTurn:{...x.input.nextTurn,sdkSession:{...x.input.nextTurn.sdkSession,entriesCount:23}}}));}
  else await assert.rejects(x.continuation.readSnapshot({credential:mutation==='foreign credential'?'foreign':x.credential,request:{binding:x.target}}));
  assert.equal(x.f.state.sdkSessions.size,1);
 }finally{x.f.close();}
});
for(const phase of ['register','seed append'])test(`unknown native ${phase} never falls back to fresh session or retries dispatch`,async()=>{
 const x=await fixture();let session;try{session=await x.factory({binding:x.target,sessionKey:x.sessionKey,nextTurn:x.input.nextTurn});
  if(phase==='register')x.unknown();else x.f.faults.onCommit=()=>{if(x.f.state.sdkEntries.some(e=>e.run_id===x.target.runId))x.unknown();};
  await assert.rejects(session.store.append(x.sessionKey,[{type:'user',uuid:id(1401),text:'new prompt'}]));const count=x.f.state.sdkEntries.length;await assert.rejects(session.store.append(x.sessionKey,[{type:'user',uuid:id(1402),text:'must not retry'}]));assert.equal(x.f.state.sdkEntries.length,count);await assert.rejects(session.settle());await assert.rejects(session.close());session=null;
 }finally{await session?.close().catch(()=>{});x.f.close();}
});
test('Stop after immutable read prevents target registration and any append; no model restart',async()=>{
 const x=await fixture(),controller=new AbortController();let session;try{session=await x.factory({binding:x.target,sessionKey:x.sessionKey,nextTurn:x.input.nextTurn,runtimeSignal:controller.signal});assert.deepEqual(await session.store.load(x.sessionKey),x.transcripts[0].entries);controller.abort();await assert.rejects(session.store.append(x.sessionKey,[{type:'user'}]));assert.equal(x.f.state.sdkSessions.size,1);}
 finally{await session?.close();x.f.close();}
});
test('native options reject altered tenant, actor, client scope, prompt lineage, context, SDK and fabricated legacy restore receipt',async()=>{
 const x=await fixture();try{for(const field of ['tenantId','actorId','conversationId']){const changed=structuredClone(x.input.nextTurn);changed.sdkSession.binding[field]=field==='conversationId'?id(999):'foreign';assert.throws(()=>buildNextTurnOptions(changed,optionsTarget(x)));}
  for(const change of [n=>n.scopes[0].resourceId=id(999),n=>n.sourceRequest.prompt='altered',n=>n.contextSha256='f'.repeat(64),n=>n.versions.sdk='0.3.294']){const n=structuredClone(x.input.nextTurn);change(n);assert.throws(()=>buildNextTurnOptions(n,optionsTarget(x)));}
  const {sdkSessionKey,...runtime}=await x.provider.runtime(x.input);assert.throws(()=>buildConversationOptions({...runtime,...SDK_MODEL_CONFIGURATION,cwd:`/workspace/${x.target.conversationId}`,sessionStore:{load(){},append(){}},maxTurns:12,maxCostMicroUSD:1000000,providerEnvironment:{},restoreReceipt:{}},new AbortController(),workerContext(x)));
 }finally{x.f.close();}
});
