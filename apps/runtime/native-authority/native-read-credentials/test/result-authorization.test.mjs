/** Private post-read identity authorization over actual current task/native owners; all transports synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {storedCase as registryCase,clientId} from '../../../../gateway/sources/client-registry/test/fixture.mjs';
import {ownerFixture,uuid} from './fixture.mjs';

async function setup(changes={}){
 const f=await ownerFixture('lookup_client_registry',{scene:registryCase()}),owner=changes.owner?.(f)??f.owner;
 const receipt=JSON.parse(await owner.nativeReadContextPorts.readCurrent(f.proof())),call={...f.call(f.request,f.authority,receipt.context),signal:f.scope.signal};
 return {...f,owner,receipt,call,guard:owner.authorizeResultForCall(f.operation,call)};
}

test('private result guard rechecks actual owners, returns no receipt/roster, and releases no credential',async()=>{
 const f=await setup(),before=f.core.state.calls.length;assert.equal(await f.guard({clientIds:[clientId]}),undefined);
 assert.equal(f.core.state.calls.length,before+6);assert.equal(f.stateOwner.secrets,0);assert.equal(f.wire.length,0);assert.equal(JSON.stringify(f.receipt).includes(clientId),false);
 assert.deepEqual(f.receipt.context,{});assert.equal(await f.guard({clientIds:[]}),undefined);
});

for(const selection of [{clientIds:[uuid('a')]},{clientIds:['arbitrary-private-id']},{clientIds:[clientId,clientId]},{clientIds:null},{clientIds:[clientId],tenantId:'foreign'}])test('private identity refusal withholds entire selection without credential release',async()=>{
 const f=await setup();await assert.rejects(f.guard(selection));assert.equal(f.stateOwner.secrets,0);assert.equal(f.wire.length,0);
});

test('result guard is bound to an already observed invocation, operation and original request',async()=>{
 const f=await setup();assert.throws(()=>f.owner.authorizeResultForCall(f.operation,{...f.call,signal:new AbortController().signal}));
 const request={name:f.call.request.name+' changed'},normalized=f.contract.normalizeInput(request,{}),changed={...f.call,request,input:normalized.input,argumentsSha256:normalized.argumentsSha256};
 const guard=f.owner.authorizeResultForCall(f.operation,changed);await assert.rejects(guard({clientIds:[clientId]}));assert.equal(f.stateOwner.secrets,0);
});

for(const change of [f=>f.core.state.clientIds=[],f=>f.core.state.membershipRevision='d'.repeat(64),f=>f.state.grant.state='REVOKED'])test('current visibility or task revocation cannot be waived by a result identity',async()=>{
 const f=await setup();change(f);await assert.rejects(f.guard({clientIds:[clientId]}));assert.equal(f.stateOwner.secrets,0);
});

test('visibility changes between guard observations withhold result',async()=>{
 const f=await setup();let memberships=0;f.core.state.beforeResponse=path=>{if(path.endsWith('/membership')&&++memberships===2)f.core.state.clientIds=[];};
 await assert.rejects(f.guard({clientIds:[clientId]}));assert.equal(f.stateOwner.secrets,0);
});

test('original source expiry and cancellation do not renew during result authorization',async()=>{
 const f=await setup();f.scope.abort();const count=f.core.state.calls.length;await assert.rejects(f.guard({clientIds:[clientId]}),{message:'CANCELLED'});assert.equal(f.core.state.calls.length,count);
 const other=await setup();other.state.now=other.receipt.expiresAtMs;const initial=other.core.state.calls.length;await assert.rejects(other.guard({clientIds:[clientId]}));assert.equal(other.core.state.calls.length,initial);
});

test('legacy fake-port missing visibility cannot approve even an empty result',async()=>{
 const f=await setup({owner:f=>{const original=f.configuration.coreAuthority;return createNativeReadCredentialOwner({...f.configuration,coreAuthority:{available:true,origin:original.origin,async readCurrent(call){const {clientIds,...rest}=await original.readCurrent(call);return rest;}}});}});
 await assert.rejects(f.guard({clientIds:[]}),{message:'UNAVAILABLE'});assert.equal(f.stateOwner.secrets,0);
});

test('result guard promptly cancels an unresolved native authority observation without approving a late result',async()=>{
 let blocked=false,entered,release,timer;const started=new Promise(r=>entered=r),pending=new Promise(r=>release=r);
 const f=await setup({owner:f=>createNativeReadCredentialOwner({...f.configuration,getNativeCredential:async()=>{if(!blocked)return 'SYNTHETIC_NATIVE';entered();return pending;}})});
 blocked=true;const work=f.guard({clientIds:[clientId]}).then(()=>'RESULT_APPROVED',error=>error.message);await started;const calls=f.core.state.calls.length;f.scope.abort();
 try{assert.equal(await Promise.race([work,new Promise(r=>timer=setTimeout(()=>r('NOT_PROMPTLY_SETTLED'),200))]),'CANCELLED');}
 finally{clearTimeout(timer);release('SYNTHETIC_NATIVE');await new Promise(r=>setImmediate(r));}
 assert.equal(f.core.state.calls.length,calls);assert.equal(f.stateOwner.secrets,0);assert.equal(f.wire.length,0);
});
