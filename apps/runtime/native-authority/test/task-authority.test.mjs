import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeTaskAuthority} from '../task-authority.mjs';
import {createNativeTaskVerifierApplication} from '../task-verifier-http.mjs';import {capabilityDigest} from '../task-verifier.mjs';
import {createNativeCapabilityClient} from '../../native-client.mjs';
import {markAuthorityUnavailable,isAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
import {fixture,NOW} from './fixture.mjs';
const digest='a'.repeat(64);
function setup(change,options={}){const f=fixture(),calls=[],native={marker:true,async call(path,input,limits){assert.equal(this.marker,true);calls.push({path,input,limits});let result={binding:f.binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-native-identity',scopes:[{tenantId:f.binding.tenantId,kind:'client',resourceId:f.key.sessionId,policyRevision:'policy'}],selectedClientId:f.key.sessionId,policyRevision:'policy',authorizationDecisionId:'synthetic-decision',checkedAtMs:NOW,expiresAtMs:NOW+1000};return change?change(result):result;}};
 const authority=createNativeTaskAuthority({native,enabled:true,now:()=>NOW,maxRequestMs:100,...options});const input={capability:'synthetic-opaque-task',binding:f.binding,operation:'runner/session/register',inputSha256:digest};return {f,calls,authority,input,native};}
test('task adapter delegates exact opaque capability/operation/hash to existing native owner with preserved receiver',async()=>{const f=setup();const result=await f.authority.verify(f.input);assert.deepEqual(result.binding,f.f.binding);assert.equal(f.calls[0].path,'worker/authorize');assert.deepEqual(f.calls[0].input,f.input);assert.ok(f.calls[0].limits.signal instanceof AbortSignal);assert.equal(f.calls[0].limits.deadlineMs,NOW+100);});
test('default disabled or absent verifier makes zero native effects',async()=>{let calls=0;for(const options of [{native:{call(){calls++;}}},{enabled:true}]){const authority=createNativeTaskAuthority({maxRequestMs:3000,...options});await assert.rejects(authority.verify({}),{code:'WORKER_AUTHORITY_UNAVAILABLE'});}assert.equal(calls,0);});
test('malformed input and caller-added authority refuse before native effects',async()=>{for(const patch of [{operation:'admin/create'},{inputSha256:'invalid'},{capability:''},{capability:'has whitespace'},{grant:{authorized:true}},{binding:{tenantId:'synthetic'}}]){const f=setup();await assert.rejects(f.authority.verify({...f.input,...patch}),{code:'WORKER_AUTHORITY_REFUSED'});assert.equal(f.calls.length,0);}const f=setup();let getters=0;await assert.rejects(f.authority.verify({...f.input,get capability(){getters++;return 'synthetic';}}));assert.equal(getters,0);assert.equal(f.calls.length,0);});
test('foreign operation/hash/binding/client/scope and expired/future/boolean receipts confer no authority',async()=>{
 const changes=[r=>({...r,operation:'load'}),r=>({...r,inputSha256:'b'.repeat(64)}),r=>({...r,binding:{...r.binding,writerFence:2}}),r=>({...r,selectedClientId:'caller-selected-id'}),r=>({...r,scopes:r.scopes.map(s=>({...s,tenantId:'foreign'}))}),r=>({...r,checkedAtMs:NOW+1}),r=>({...r,checkedAtMs:NOW-1}),r=>({...r,expiresAtMs:NOW}),()=>true,r=>({...r,authorized:true})];
 for(const change of changes){const f=setup(change);await assert.rejects(f.authority.verify(f.input),{code:'WORKER_AUTHORITY_REFUSED'});assert.equal(f.calls.length,1);}
});
test('native refusal is not retried or exposed, even with active error fields',async()=>{let attempts=0,getters=0;const f=setup(()=>{attempts++;throw {get code(){getters++;throw Error('private');},message:'private'};});await assert.rejects(f.authority.verify(f.input),{code:'WORKER_AUTHORITY_REFUSED'});assert.equal(attempts,1);assert.equal(getters,0);});
test('parked native verifier is bounded and aborts its supplied signal',async()=>{let signal;const f=setup(undefined,{maxRequestMs:20,native:{call(_path,_input,limits){signal=limits.signal;return new Promise(()=>{});}}});await assert.rejects(f.authority.verify(f.input),{code:'WORKER_AUTHORITY_REFUSED'});assert.equal(signal.aborted,true);});
test('already cancelled verification never dispatches a capability',async()=>{const f=setup(),controller=new AbortController();controller.abort();await assert.rejects(f.authority.verify({...f.input,signal:controller.signal}));assert.equal(f.calls.length,0);});
test('a verifier that did not answer stays transient across the worker/authorize wire; a refusal stays a refusal',async()=>{
 for(const [thrown,code,transient] of [[markAuthorityUnavailable(Error('NATIVE_UNAVAILABLE')),'WORKER_AUTHORITY_UNAVAILABLE',true],[Error('NATIVE_UNAVAILABLE'),'WORKER_AUTHORITY_REFUSED',false]]){
  const f=setup(()=>{throw thrown;});await assert.rejects(f.authority.verify(f.input),e=>e.code===code&&isAuthorityUnavailable(e)===transient);}
 // The receiving boundary answers 503 NATIVE_TASK_AUTHORITY_UNAVAILABLE, which control's native client marks transient.
 const caller='synthetic-control-capability',statuses=[];
 for(const [failure,code,transient,status] of [[markAuthorityUnavailable(Error('NATIVE_AUTHORITY_UNAVAILABLE')),'WORKER_AUTHORITY_UNAVAILABLE',true,503],[Error('NATIVE_TASK_REFUSED'),'WORKER_AUTHORITY_REFUSED',false,403]]){
  const application=createNativeTaskVerifierApplication({maxRequestMs:3000,verifier:{async verify(){throw failure;}},callerCapabilitySha256:capabilityDigest(caller),taskCapabilitySha256:digest,enabled:true});
  const native=createNativeCapabilityClient({maxRequestMs:3000,loadMaxRequestMs:3000,configuration:{origin:'https://native.synthetic.invalid',maxResponseBytes:131072},credential:caller,
   fetch:async(url,init)=>{const response=await application.handle(new Request(url,init));statuses.push(response.status);return response;}});
  const {authority,input}=setup(undefined,{native,now:Date.now,maxRequestMs:1000});
  await assert.rejects(authority.verify(input),e=>e.code===code&&isAuthorityUnavailable(e)===transient);assert.equal(statuses.at(-1),status);
 }
});
