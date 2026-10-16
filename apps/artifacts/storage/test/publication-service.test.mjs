/** Canonical generator/service -> publication -> SQL, with synthetic rendering/object/accounting ports only. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createArtifactService} from '../../service.mjs';import {v,sha} from '../boundary.mjs';import {sqlFixture,record,NOW,id} from './sql-fixture.mjs';
test('service publication: original validated authority, budget ticket and run/version binding reach canonical durable decision',async()=>{
 const f=sqlFixture(),a=record(),stored=new Map(),receipts=[];let effects=0;
 const context={binding:a.version.binding,scopes:a.version.scopes,evidence:[],assets:[],maxBytes:1048576,deadlineMs:NOW+60000};
 const service=createArtifactService({validators:v,now:()=>NOW,ids:()=>({artifactId:a.version.artifactId,versionId:a.version.versionId,objectId:a.version.object.objectId}),versions:f.create(),retention:f.retention,
  async authorize(call){const receipt={receiptId:'synthetic-original-'+receipts.length,decision:'allow',action:call.action,binding:call.binding,scopesSha256:v.hash(call.scopes),resourceSha256:v.hash(call.resource),requestSha256:call.requestSha256,expiresAtMs:context.deadlineMs};receipts.push(structuredClone(receipt));return receipt;},
  budget:{async reserve(call){return {ticketId:'original-synthetic-budget-ticket',binding:call.binding,requestSha256:call.requestSha256,maxBytes:call.maxBytes,deadlineMs:call.deadlineMs};},async settle({ticketId,requestSha256,bytes,outcome}){return {ticketId,requestSha256,bytes,outcome,status:'settled'};}},
  executor:{async execute({request}){effects++;const bytes=Buffer.from(request.content.text);return {bytes,inspection:{...a.inspection,sha256:sha(bytes),bytes:bytes.length}};}},
  objects:{async put(call){effects++;const object={objectId:call.objectId,versionId:'SYNTHETIC_SOURCE_NATIVE',sha256:sha(call.bytes),bytes:call.bytes.length,scopes:call.scopes};stored.set(v.hash(object),Buffer.from(call.bytes));return object;},async get(object){return Buffer.from(stored.get(v.hash(object)));}}});
 const result=await service.create(a.spec,context);assert.equal(result.version.versionId,id(10));assert.equal(effects,2);const decision=f.durable.state.index.decisions[0];
 assert.deepEqual(decision.record,await f.create().read(result.version.versionId));assert.deepEqual(decision.authorization,receipts.find(r=>r.receiptId===decision.authorization.receiptId));assert.equal(decision.invocation.budgetTicketId,'original-synthetic-budget-ticket');assert.equal(decision.invocation.versionId,result.version.versionId);assert.deepEqual(decision.invocation.binding,context.binding);assert.equal(decision.invocation.ownedInvocationId,null);
});
