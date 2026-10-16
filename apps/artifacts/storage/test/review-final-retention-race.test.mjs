/** Canonical generator/service -> publication -> SQL, with synthetic rendering/object/accounting ports only. */
import test from 'node:test';import assert from 'node:assert/strict';
const {createArtifactService}=await import(process.env.MERI_REVIEW_ARTIFACT_SERVICE??'../../service.mjs');import {v,sha} from '../boundary.mjs';import {sqlFixture,record,NOW,id} from './sql-fixture.mjs';
test('review: suppression during final budget settlement must prevent new-artifact metadata success',async()=>{
 const f=sqlFixture(),a=record(),stored=new Map(),receipts=[];let effects=0;
 const context={binding:a.version.binding,scopes:a.version.scopes,evidence:[],assets:[],maxBytes:1048576,deadlineMs:NOW+60000};
 const service=createArtifactService({validators:v,now:()=>NOW,ids:()=>({artifactId:a.version.artifactId,versionId:a.version.versionId,objectId:a.version.object.objectId}),versions:f.create(),retention:f.retention,
  async authorize(call){const receipt={receiptId:'synthetic-original-'+receipts.length,decision:'allow',action:call.action,binding:call.binding,scopesSha256:v.hash(call.scopes),resourceSha256:v.hash(call.resource),requestSha256:call.requestSha256,expiresAtMs:context.deadlineMs};receipts.push(structuredClone(receipt));return receipt;},
  budget:{async reserve(call){return {ticketId:'original-synthetic-budget-ticket',binding:call.binding,requestSha256:call.requestSha256,maxBytes:call.maxBytes,deadlineMs:call.deadlineMs};},async settle({ticketId,requestSha256,bytes,outcome}){f.suppressed.add(`${a.version.binding.tenantId}:artifact:${a.version.artifactId}`);return {ticketId,requestSha256,bytes,outcome,status:'settled'};}},
  executor:{async execute({request}){effects++;const bytes=Buffer.from(request.content.text);return {bytes,inspection:{...a.inspection,sha256:sha(bytes),bytes:bytes.length}};}},
  objects:{async put(call){effects++;const object={objectId:call.objectId,versionId:'SYNTHETIC_SOURCE_NATIVE',sha256:sha(call.bytes),bytes:call.bytes.length,scopes:call.scopes};stored.set(v.hash(object),Buffer.from(call.bytes));return object;},async get(object){return Buffer.from(stored.get(v.hash(object)));}}});
 await assert.rejects(service.create(a.spec,context), error=>error.code==='ARTIFACT_EFFECT_UNKNOWN'&&error.cause?.code==='RETENTION_SUPPRESSED');
});
