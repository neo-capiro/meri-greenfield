/** SYNTHETIC durable rows/SQL/HTTPS over real native verifier + canonical budget/gateway. No listener, provider or database. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readsFixture} from './reads-fixture.mjs';
import {createPreparedNativeReads} from '../prepared-reads.mjs';
import {createPreparedReadEntry} from '../prepared-read-entry.mjs';
import {createNativeReadsClient} from '../reads-client.mjs';
import {createExecutionBinding} from '../../../control/conversations/execution-boundary.mjs';
import {versions} from '../../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
async function fixture(){
 const f=await readsFixture(),request={requestId:'71000000-0000-4000-8000-000000000099',prompt:'Synthetic saved input'},original=createExecutionBinding({binding:f.binding,versions,plan:{synthetic:true},expiresAtMs:f.deadlineMs});
 const issued={original,issuance:{binding:f.binding,requestSha256:hash(request),expiresAtMs:f.deadlineMs,grantId:f.entry.grantId,factsSha256:f.entry.issuanceFactsSha256},factsSha256:f.entry.issuanceFactsSha256,approvedReads:f.config,qualification:{policyRevision:f.policyRevision},allocationSha256:f.entry.allocationSha256,taskRequestSha256:'d'.repeat(64),grantIntents:[{grantId:f.entry.grantId,capabilitySha256:f.grant.capabilitySha256,expiresAtMs:f.deadlineMs}]};
 const state={row:{run:{binding:f.binding,state:'running',versions,scopes:f.scopes,policyRevision:f.policyRevision},request},receipt:issued.issuance,record:{state:'ADMITTED',original,allocationSha256:issued.allocationSha256,taskRequestSha256:issued.taskRequestSha256,grantIntents:issued.grantIntents,resource:{taskArn:f.entry.taskArn}},resource:{taskArn:f.entry.taskArn},reads:0,allocations:0};
 const entryOptions={store:{allocations:{async read(){state.allocations++;return {record:state.record};}}},issuance:{async readIssuance(){state.reads++;return state.receipt;}},issued,request,now:f.now,resource:()=>state.resource,async readCurrentRun(){return state.row;}};
 const readCurrentEntry=createPreparedReadEntry(entryOptions),configuration={...f.verifierConfiguration,runRequestSha256:hash(request),readCurrentEntry,gateway:f.ownerConfiguration.gateway,binding:f.binding};
 const prepared=createPreparedNativeReads(configuration),client=createNativeReadsClient({...f.clientConfiguration,fetchImpl:(url,init)=>prepared.application.handle(new Request(url,init))});
 return {...f,state,issued,entryOptions,configuration,readCurrentEntry,prepared,client};
}
test('prepared control composition traverses exact current entry, actual read-only admission and canonical gateway',async()=>{
 const f=await fixture(),available=await f.client.readAvailability();assert.ok(available.installation.operations.length);assert.ok(f.state.reads>0);assert.ok(f.state.allocations>0);assert.ok(f.commands.length>0);assert.ok(f.commands.every(sql=>!sql.includes('FOR UPDATE')));
 const result=await f.client.execute({operation:f.operation,arguments:f.arguments,deliveryId:'prepared:synthetic:1'});assert.equal(typeof result,'string');assert.equal(JSON.stringify(result).includes('identityCredential'),false);
});
for(const [name,change] of Object.entries({
 'missing receipt':f=>f.state.receipt=null,
 'different request receipt':f=>f.state.receipt={...f.state.receipt,requestSha256:'e'.repeat(64)},
 'changed request':f=>f.state.row={...f.state.row,request:{...f.state.row.request,prompt:'changed'}},
 'terminal run':f=>f.state.row.run.state='cancelled',
 'foreign run':f=>f.state.row.run.binding={...f.binding,actorId:'foreign'},
 'allocation unknown':f=>f.state.record.state='UNKNOWN',
 'allocation mismatch':f=>f.state.record.allocationSha256='e'.repeat(64),
 'task request mismatch':f=>f.state.record.taskRequestSha256='e'.repeat(64),
 'grant mismatch':f=>f.state.record.grantIntents=[],
 'task replacement':f=>f.state.resource.taskArn+='-replacement',
 'missing controller':f=>f.state.resource=null
}))test('prepared read refuses '+name+' before gateway release',async()=>{const f=await fixture();change(f);await assert.rejects(f.client.readAvailability());});
test('revocation after a successful effect withholds the result; no repeated execute inside one call',async()=>{
 const f=await fixture(),gateway=f.configuration.gateway;let calls=0;const prepared=createPreparedNativeReads({...f.configuration,gateway:{readAvailability:v=>gateway.readAvailability(v),async execute(v){calls++;const result=await gateway.execute(v);f.state.row.run.state='cancelled';return result;}}});
 const client=createNativeReadsClient({...f.clientConfiguration,fetchImpl:(url,init)=>prepared.application.handle(new Request(url,init))});await client.readAvailability();await assert.rejects(client.execute({operation:f.operation,arguments:f.arguments,deliveryId:'prepared:revoke:1'}));assert.equal(calls,1);
});
test('missing/disabled composition is inert, explicitly unavailable, and never calls current owners',async()=>{
 const f=await fixture();for(const options of [{binding:f.binding},{...f.configuration,enabled:false},{...f.configuration,approvedReads:{...f.config,enabled:false}},{...f.configuration,gateway:undefined}]){
  const p=createPreparedNativeReads(options),before=f.state.reads,response=await p.application.handle(new Request('https://native.synthetic.invalid/v1/runner/reads/availability',{method:'POST',headers:{authorization:'Bearer '+f.credential,'content-type':'application/json'},body:JSON.stringify(f.request)}));assert.equal(response.status,503);assert.equal(f.state.reads,before);
 }
});
test('entry operation cutoff remains original and late issuer/read settlement cannot release',async()=>{
 const f=await fixture(),cutoff=f.now()+1000,receipt=await f.readCurrentEntry({binding:f.binding,deadlineMs:cutoff});assert.equal(receipt.expiresAtMs,cutoff);
 await assert.rejects(f.readCurrentEntry({binding:f.binding,deadlineMs:f.now()}));assert.equal(receipt.runRequestSha256,hash(f.state.row.request));
 const entry=createPreparedReadEntry({...f.entryOptions,maxRequestMs:10,issuance:{async readIssuance(){await new Promise(resolve=>setTimeout(resolve,30));return f.issued.issuance;}}});await assert.rejects(entry({binding:f.binding,deadlineMs:f.deadlineMs}));
});
