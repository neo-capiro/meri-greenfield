import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeReadsClient} from '../reads-client.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion,assertNativeReadTaskAssertion} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {binding} from '../../control/conversations/test/store-fixture.mjs';
const operation={id:'find_contacts',version:'0.2.0'},configuration={schemaVersion,enabled:true,operations:[operation],maxExecuteMs:1000,maxRequestBytes:65536,maxResponseBytes:1048576};
function fixture(transform=value=>value){const wires=[];let fail=false;const client=createNativeReadsClient({origin:'https://control.synthetic.invalid',credential:'synthetic-run',binding,approvedReads:configuration,fetchImpl:async(url,options)=>{
 const request=JSON.parse(options.body);wires.push(request);if(fail)throw Error('uncertain transport');const at=Date.now(),base={schemaVersion,binding,inputSha256:hash(request),policyRevision:'p',executionSha256:'a'.repeat(64),checkedAtMs:at,expiresAtMs:at+1000};
 const installation={installationId:'11111111-1111-4111-8111-111111111111',baseCatalogSha256:hash(catalog),executionCatalogSha256:'b'.repeat(64),operations:[operation],checkedAtMs:at,expiresAtMs:at+1000};
 const value=url.endsWith('/availability')?{...base,installation,discovery:{binding,policyRevision:'p',operations:[operation],checkedAtMs:at,expiresAtMs:at+1000}}:{...base,operation,deliveryId:request.deliveryId,installationId:request.installationId,executionCatalogSha256:request.executionCatalogSha256,resultJson:'{"synthetic":true}',resultSha256:hash({synthetic:true}),outputBytes:18};return Response.json(transform(value));}});return {client,wires,fail(){fail=true;}};}
test('private read transport pins execution identity, preserves typed operation and original delivery identity',async()=>{const f=fixture();await f.client.readAvailability();assert.equal(await f.client.execute({operation,arguments:{clientId:'synthetic'},deliveryId:'one'}),'{"synthetic":true}');assert.deepEqual(f.wires[1].operation,operation);assert.equal(f.wires[1].deliveryId,'one');assert.equal('taskArn'in f.wires[1],false);});
test('old allocation, changed execution, request/result digest and expiry cannot release read bytes',async()=>{
 for(const mode of ['allocation','execution','request','result','expiry']){let calls=0;const f=fixture(value=>{calls++;if(calls===1&&mode!=='allocation')return value;
 if(mode==='allocation'){const {executionSha256,...old}=value;return {...old,allocationSha256:executionSha256};}if(mode==='execution')value.executionSha256='c'.repeat(64);if(mode==='request')value.inputSha256='c'.repeat(64);if(mode==='result')value.resultSha256='c'.repeat(64);if(mode==='expiry')value.expiresAtMs=0;return value;});
 await assert.rejects(f.client.execute({operation,arguments:{},deliveryId:'same'}));}
});
test('transport uncertainty dispatches once; it does not issue a new delivery or replay source work',async()=>{const f=fixture();await f.client.readAvailability();f.fail();await assert.rejects(f.client.execute({operation,arguments:{},deliveryId:'stable'}),{code:'BUDGET_UNCERTAIN'});assert.equal(f.wires.length,2);assert.equal(f.wires[1].deliveryId,'stable');});
test('execution assertion rejects foreign binding/scopes, injected ECS provenance and altered request',()=>{
 const at=Date.now(),request={schemaVersion,binding},value={schemaVersion,binding,operation:'runner/reads/availability',inputSha256:hash(request),executionSha256:'a'.repeat(64),scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:'11111111-1111-4111-8111-111111111111',policyRevision:'p'}],policyRevision:'p',authorizationDecisionId:'b'.repeat(64),checkedAtMs:at,expiresAtMs:at+1000},expected={binding,operation:value.operation,inputSha256:value.inputSha256,started:at,now:()=>at};
 assert.deepEqual(assertNativeReadTaskAssertion(value,expected),value);for(const change of [{taskArn:'forged'},{grantId:'forged'},{inputSha256:'c'.repeat(64)},{binding:{...binding,actorId:'foreign'}},{scopes:[{...value.scopes[0],tenantId:'foreign'}]},{expiresAtMs:at}])assert.throws(()=>assertNativeReadTaskAssertion({...value,...change},expected));
});
