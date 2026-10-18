import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {storedCase,clientId,candidate} from './fixture.mjs';

test('registry raw DTO stays unchanged after exact original-call current-client visibility guard',async()=>{
 const f=storedCase(),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire;
 assert.deepEqual(out.result,f.page);assert.deepEqual(f.state.visibilityCalls,[{clientIds:[clientId]}]);assert.equal(f.state.visibilityFactory.originalCall,call);
 assert.deepEqual(f.state.visibilityFactory.operation,f.operation);assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/lookup_client_registry');assert.deepEqual(wire.body,f.arguments);
 assert.equal(f.credentialCalls[0].requestSha256,hash(f.arguments));assert.deepEqual(f.credentialCalls[0].normalizationContext,{});assert.equal(wire.options.method,'POST');
});
test('missing registry visibility factory or returned callback refuses before credential/native IO',async()=>{
 for(const changes of [{authorizeResultForCall:undefined},{authorizeResultForCall:()=>undefined}]){
  const f=storedCase();await assert.rejects(f.handler(changes)(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
 }
});
test('denied private existing client withholds the whole DTO including identity-bearing guidance',async()=>{
 const f=storedCase();f.state.visibilityDenied=true;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);assert.deepEqual(f.state.visibilityCalls,[{clientIds:[clientId]}]);
 assert.match(f.state.nativeValue.guidance,new RegExp(clientId));
});
test('registry malformed private DTO is refused before any visibility callback',async()=>{
 for(const mutate of [p=>p.existingClient.id=null,p=>p.existingClient.tenantId='forged',p=>p.created=true,p=>p.ldaCandidates=[candidate(),candidate()]]){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.state.visibilityCalls.length,0);
 }
});
test('registry no-existing-client branch checks empty private ID selection without inventing authoritative absence',async()=>{
 const f=storedCase();f.state.page={existingClient:null,ldaExactMatch:null,ldaCandidates:[candidate()],guidance:'Synthetic source guidance; grants no creation authority.'};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.state.visibilityCalls,[{clientIds:[]}]);assert.equal(out.result.existingClient,null);assert.equal(out.result.ldaCandidates.length,1);assert.equal(Object.hasOwn(out.result,'absenceProven'),false);
});
test('registry visibility wait is awaited and a changed or unhandled denial leaks no bytes',async()=>{
 const f=storedCase();let release,entered;const ready=new Promise(resolve=>entered=resolve);f.state.beforeVisibility=()=>{entered();return new Promise(resolve=>release=resolve);};
 let settled=false;const pending=f.handler()(f.call()).finally(()=>settled=true);await ready;assert.equal(settled,false);f.state.visibilityDenied=true;release();await assert.rejects(pending,{message:'ACCESS_DENIED'});
 const broken=storedCase();broken.state.beforeVisibility=()=>{throw Error('PRIVATE_SCOPE_DETAIL');};await assert.rejects(broken.handler()(broken.call()),{message:'INTERNAL_ERROR'});
});
test('registry original name keeps its trim/clip boundary with no second normalized trim',async()=>{
 const name='N'.repeat(299)+' X',f=storedCase(undefined,{request:{name}});await f.handler()(f.call());assert.equal(f.call().input.name,'N'.repeat(299)+' ');assert.deepEqual(f.wire[0].body,{name});
});
test('concurrent registry invocations using one original call retain separate current visibility guards',async()=>{
 const f=storedCase(),call=f.call(),seen=[],factories=[];
 const execute=f.handler({authorizeResultForCall(operation,original){const index=factories.length;factories.push({operation,original});return async selection=>{seen.push({index,selection});};}});
 const results=await Promise.all([execute(call),execute(call)]);assert.equal(results.length,2);assert.equal(f.wire.length,2);
 assert.deepEqual(seen.map(v=>v.index).sort(),[0,1]);assert.ok(factories.every(v=>v.original===call));assert.ok(seen.every(v=>v.selection.clientIds[0]===clientId));
});
test('registry caller authority digest operation and source drift cannot reach native source',async()=>{
 for(const mutate of [c=>c.argumentsSha256='0'.repeat(64),c=>c.authority.decision.decision='denied',c=>c.authority.decision.operation='list_members@0.2.0',c=>c.authority.sourceIds=[],c=>c.authority.decision.scopes=[]]){
  const f=storedCase(),call=structuredClone(f.call());mutate(call);await assert.rejects(f.handler()(call));assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.state.visibilityCalls.length,0);
 }
 const f=storedCase();await assert.rejects(f.handler()({...f.call(),request:{name:'Synthetic',tenantId:'forged'}}),{message:'INVALID_ARGUMENTS'});assert.equal(f.wire.length,0);
});
test('registry bounded native errors and cancellation during current visibility release nothing',async()=>{
 const bad=storedCase();bad.state.responseFactory=()=>Response.json({error:'PRIVATE'},{status:403});await assert.rejects(bad.handler()(bad.call()),{message:'INVALID_RESULT'});assert.equal(bad.state.visibilityCalls.length,0);
 const large=storedCase();await assert.rejects(large.handler({maxResponseBytes:16})(large.call()),{message:'RESOURCE_LIMIT'});
 const f=storedCase(),abort=new AbortController();f.state.beforeVisibility=()=>abort.abort();await assert.rejects(f.handler()({...f.call(),signal:abort.signal}),{message:'CANCELLED'});
});
