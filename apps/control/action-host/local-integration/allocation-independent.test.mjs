/** Shared allocation admission is distinct from a callable command view. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {harness,canonicalSha256,NOW,limits} from '../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {nativeScopedPage,id} from '../../../../docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createLocalActionIdentity} from '../../../gateway/local-action/identity.mjs';
import {createLocalActionGateway} from '../../../gateway/local-action/gateway.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
const read={id:'actions.query',version:'0.2.0'},command={id:'create_task',version:'0.2.0'},clientId=id(9),contract=resolveOperationContract(read);
function setup(operations=[read,command]){
 const h=harness(),before=canonicalSha256(catalog);h.allocation.manifest.allowedOperations=structuredClone(operations);h.allocation.manifest.requiredSources=contract.descriptor.sourceRequirements;h.allocation.manifest.subjectKinds=['client'];h.allocation.manifestSha256=canonicalSha256(h.allocation.manifest);h.allocation.schedule.operations=operations.map(operation=>({operation,chargeMicrousd:10}));h.invocation.allocationSha256=canonicalSha256(h.allocation);
 const identity=createLocalActionIdentity({mode:'synthetic-local',binding:h.f.binding,clientId,policyRevision:h.invocation.qualificationBinding.policyRevision,deadlineMs:NOW+5000,budgets:h.f.claims.budgets,grants:contract.descriptor.requiredGrants,sourceEnabled:true,now:()=>h.f.state.now});
 const issued=identity.issueCredential({ttlMs:4000});h.invocation.capabilitySha256=issued.capabilitySha256;h.state().grant.capability_sha256=issued.capabilitySha256;let reads=0;
 const source={origin:'https://independent.invalid',getCredentials:async()=>({binding:h.f.binding,bearerToken:'synthetic',serviceSecret:'synthetic',expiresAtMs:NOW+4000}),fetchImpl:async(_url,init)=>{reads++;return new Response(JSON.stringify(nativeScopedPage(JSON.parse(init.body))),{headers:{'content-type':'application/json'}});}};
 const config={mode:'synthetic-local',identity,pool:h.pool,allocationJson:JSON.stringify(h.allocation),source,limits,now:()=>h.f.state.now,newId:randomUUID};
 return {h,identity,issued,config,before,reads:()=>reads,create:()=>createLocalActionGateway(config)};
}
for(const operations of [[read,command],[command,read]])test('independent shared allocation: read executes through actual owned budget while command stays inaccessible '+operations[0].id,async()=>{
 const f=setup(operations);try{const gateway=f.create();await gateway.bindTrustedGrant(f.h.json());const result=await gateway.executeOwned(JSON.stringify({operation:read,arguments:{clientId,limit:20}}),f.issued.credential,f.h.delivery('independent-shared-read'));assert.ok(result);assert.equal(f.reads(),1);assert.equal(f.h.state().budget.consumed_micro_usd,'10');assert.equal(f.h.state().reservations.size,1);const calls=f.h.commands.length;
 assert.throws(()=>gateway.executeOwned(JSON.stringify({operation:command,arguments:{title:'must not dispatch'}}),f.issued.credential,f.h.delivery('independent-command-refusal')));assert.equal(f.h.commands.length,calls);assert.equal(f.reads(),1);assert.deepEqual(await gateway.discover(),[]);assert.equal(gateway.execute,undefined);assert.equal(canonicalSha256(catalog),f.before);assert.ok(catalog.operations.every(x=>x.handler===null&&x.availability==='unimplemented'&&x.qualification==='pending'));
 }finally{f.identity.close();}
});
for(const [name,ops] of [['command only',[command]],['extra operation',[read,command,{id:'save_memory',version:'0.2.0'}]],['wrong command version',[read,{...command,version:'0.1.0'}]],['different second operation',[read,{id:'update_task',version:'0.2.0'}]],['duplicate read',[read,read]]])test('independent shared allocation refuses '+name,()=>{const f=setup(ops);try{assert.throws(f.create);assert.equal(f.h.commands.length,0);assert.equal(f.reads(),0);}finally{f.identity.close();}});
