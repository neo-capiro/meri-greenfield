import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {harness,canonicalSha256,NOW,limits} from '../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {nativeScopedPage,id} from '../../../../docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createTaskLookupDelivery,createPostgresTaskLookupStore,assertTaskLookupStoredBinding} from '../../../control/task-lookup/index.mjs';
import {createTaskLookupPoolFixture} from '../../../control/task-lookup/postgres-fixture.mjs';
import {fixture as controlFixture} from '../../../control/task-lookup/fixtures.mjs';
import {createLocalActionIdentity} from '../identity.mjs';
import {createLocalActionGateway} from '../gateway.mjs';
import {createLocalLookupAuthorizer} from '../control-authorizer.mjs';
const operation={id:'actions.query',version:'0.2.0'},contract=resolveOperationContract(operation),clientId=id(9);
async function setup(){
 const h=harness(),c=controlFixture(),sql=createTaskLookupPoolFixture(),http=[];
 h.allocation.manifest.allowedOperations=[operation];h.allocation.manifest.requiredSources=contract.descriptor.sourceRequirements;h.allocation.manifest.subjectKinds=['client'];
 h.allocation.manifestSha256=canonicalSha256(h.allocation.manifest);h.allocation.schedule.operations=[{operation,chargeMicrousd:10}];
 h.invocation.allocationSha256=canonicalSha256(h.allocation);
 const identity=createLocalActionIdentity({mode:'synthetic-local',binding:h.f.binding,clientId,policyRevision:h.invocation.qualificationBinding.policyRevision,deadlineMs:NOW+5000,budgets:h.f.claims.budgets,grants:contract.descriptor.requiredGrants,sourceEnabled:true,now:()=>h.f.state.now});
 const issued=identity.issueCredential({ttlMs:4000});h.invocation.capabilitySha256=issued.capabilitySha256;h.state().grant.capability_sha256=issued.capabilitySha256;
 let afterSource=()=>{};
 const source={origin:'https://review-local.invalid',getCredentials:async()=>({binding:h.f.binding,bearerToken:'SYNTHETIC',serviceSecret:'SYNTHETIC',expiresAtMs:NOW+4000}),fetchImpl:async(url,options)=>{http.push({url,method:options.method});const native=nativeScopedPage(JSON.parse(options.body));afterSource();return new Response(JSON.stringify(native),{status:200,headers:{'content-type':'application/json'}});}};
 const config={mode:'synthetic-local',identity,pool:h.pool,allocationJson:JSON.stringify(h.allocation),source,limits,now:()=>h.f.state.now,newId:randomUUID};
 const gateway=createLocalActionGateway(config);await gateway.bindTrustedGrant(h.json());
 c.context={...c.context,binding:h.f.binding,scopes:identity.status().scopes,selectedClientId:clientId,deliveryJson:h.delivery('independent-local-owner'),deadlineMs:NOW+3000};
 const control=credential=>createTaskLookupDelivery({gateway,store:createPostgresTaskLookupStore({pool:sql.pool}),clock:()=>h.f.state.now,authorize:createLocalLookupAuthorizer({identity,credential,assertStoredBinding:assertTaskLookupStoredBinding,now:()=>h.f.state.now})});
 const controller=control(issued.credential);
 const lookup=()=>controller.lookup({request:c.request,context:c.context,credential:issued.credential});
 const read=(owner=controller)=>owner.read({resultReference:c.context.resultReference,context:{currentBinding:identity.status().binding,scopes:identity.status().scopes,deadlineMs:NOW+3000}});
 const update=changes=>identity.updatePolicy({expectedRevision:identity.status().policyRevision,revision:identity.status().policyRevision,clientAllowed:true,sourceEnabled:true,grants:contract.descriptor.requiredGrants,...changes});
 return{h,c,sql,http,identity,issued,gateway,config,control,lookup,read,update,onSource:fn=>{afterSource=fn;}};
}
test('local gateway independent: actual owned credential reaches canonical durable dispatch/source/store/read',async()=>{
 const f=await setup(),delivered=await f.lookup(),read=await f.read();assert.equal(f.http.length,1);assert.equal(f.h.state().budget.consumed_micro_usd,'10');assert.equal([...f.sql.lookups.values()][0].state,'RESULT');
 assert.equal(read.resultSha256,delivered.resultSha256);assert.deepEqual(read.observation.binding,f.h.f.binding);assert.equal(read.acceptedTasks,false);
 assert.equal(f.gateway.execute,undefined);assert.equal(f.gateway.productionSourceEnabled,false);assert.deepEqual(await f.gateway.discover(),[]);await assert.rejects(f.lookup(),/LOOKUP_REPLAY/);assert.equal(f.http.length,1);
});
for(const [name,change] of [['client',{clientAllowed:false}],['grants',{grants:[]}],['sources',{sourceEnabled:false}]])
 test(`local gateway independent: narrowing ${name} after real source acquisition blocks release and result retention`,async()=>{
  const f=await setup();f.onSource(()=>f.update(change));await assert.rejects(f.lookup());assert.equal(f.http.length,1);assert.equal(f.h.state().budget.consumed_micro_usd,'0');assert.equal([...f.h.state().reservations.values()][0].state,'UNKNOWN');assert.equal([...f.sql.lookups.values()][0].record,null);
 });
test('local gateway independent: local capability cannot override canonical durable grant revocation',async()=>{
 const f=await setup();f.h.state().grant.state='REVOKED';await assert.rejects(f.lookup());assert.equal(f.http.length,0);assert.equal(f.h.state().reservations.size,0);
});
test('local gateway independent: historical result survives exact task replacement but requires newly issued current credential',async()=>{
 const f=await setup();await f.lookup();const a=f.identity.status().binding,b={...a,attemptId:randomUUID(),workerId:randomUUID(),writerFence:a.writerFence+1};
 f.identity.replaceRun({expectedBinding:a,binding:b,policyRevision:f.identity.status().policyRevision,deadlineMs:NOW+5000});await assert.rejects(f.read(),/ACCESS_DENIED/);
 const next=f.identity.issueCredential({ttlMs:1000}),read=await f.read(f.control(next.credential));assert.deepEqual(read.observation.binding,a);assert.equal(f.http.length,1);
 f.update({clientAllowed:false});await assert.rejects(f.read(f.control(next.credential)),/ACCESS_DENIED/);assert.equal(f.http.length,1);
});
test('local gateway independent: source acquisition token revocation leaves UNKNOWN without redispatch',async()=>{
 const f=await setup();f.onSource(()=>f.identity.revoke(f.issued.credential));await assert.rejects(f.lookup());assert.equal(f.http.length,1);assert.equal([...f.h.state().reservations.values()][0].state,'UNKNOWN');
 await assert.rejects(f.lookup());assert.equal(f.http.length,1);
});
test('local gateway independent: concrete construction rejects production origin, forged owner and extra request-selected ports',async()=>{
 const f=await setup();for(const changes of [{source:{...f.config.source,origin:'https://example.com'}},{identity:{...f.identity}},{sourceEnabled:true}])assert.throws(()=>createLocalActionGateway({...f.config,...changes}));
 assert.throws(()=>f.gateway.executeOwned(JSON.stringify({operation:{id:'save_memory',version:'0.2.0'},arguments:{}}),f.issued.credential,f.h.delivery()));assert.equal(f.http.length,0);
});
