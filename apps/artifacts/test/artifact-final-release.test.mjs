/** Synthetic settlement-time suppression, canonical publication/SQL adapters, no renderer/provider/native object or DB. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createArtifactService as current} from '../service.mjs';import {v,sha} from '../storage/boundary.mjs';
import {sqlFixture,record,commit,NOW,id} from '../storage/test/sql-fixture.mjs';
const old=process.env.MERI_ARTIFACT_RELEASE_OLD_MODULE,create=old?(await import(old)).createArtifactService:current;
async function scenario(kind,revision=false){const f=sqlFixture(),base=record(),versionId=revision?id(11):base.version.versionId,objectId=revision?id(111):base.version.object.objectId,artifactId=base.version.artifactId,objects=new Map(),events=[],counts={generate:0,put:0,settle:0};
 const context={binding:base.version.binding,scopes:base.version.scopes,evidence:[],assets:[],maxBytes:1048576,deadlineMs:NOW+60000};
 if(revision){await f.create().commit(commit(base));objects.set(v.hash(base.version.object),Buffer.from(base.spec.content.text));}
 const service=create({validators:v,now:()=>NOW,ids:()=>({artifactId:revision?id(999):artifactId,versionId,objectId}),versions:f.create(),
  retention:{async assertServable(subject){events.push('retention:'+subject.kind);return f.retention.assertServable(subject);}},
  async authorize(call){events.push('authorize:'+call.action);assert.deepEqual(call.binding,context.binding);assert.deepEqual(call.scopes,context.scopes);return {receiptId:'synthetic-release-authority',decision:'allow',action:call.action,binding:call.binding,scopesSha256:v.hash(call.scopes),resourceSha256:v.hash(call.resource),requestSha256:call.requestSha256,expiresAtMs:context.deadlineMs};},
  budget:{async reserve(call){return {ticketId:'original-synthetic-ticket',binding:call.binding,requestSha256:call.requestSha256,maxBytes:call.maxBytes,deadlineMs:call.deadlineMs};},async settle({ticketId,requestSha256,bytes,outcome}){counts.settle++;assert.equal(outcome,'completed');events.push('settled');f.suppressed.add(`${context.binding.tenantId}:${kind}:${kind==='artifact'?artifactId:context.binding.conversationId}`);return {ticketId,requestSha256,bytes,outcome,status:'settled'};}},
  executor:{async execute({request}){counts.generate++;const bytes=Buffer.from(request.content.text);return {bytes,inspection:{...base.inspection,sha256:sha(bytes),bytes:bytes.length}};}},
  objects:{async put(call){counts.put++;const object={objectId:call.objectId,versionId:'SYNTHETIC_RELEASE_NATIVE',sha256:sha(call.bytes),bytes:call.bytes.length,scopes:call.scopes};objects.set(v.hash(object),Buffer.from(call.bytes));return object;},async get(object){return Buffer.from(objects.get(v.hash(object)));}}});
 let delivered=false;const request={...base.spec,content:{text:'synthetic final release'}};
 await assert.rejects((revision?service.revise(base.version.versionId,request,context):service.create(request,context)).then(result=>{delivered=true;return result;}),error=>error.code==='ARTIFACT_EFFECT_UNKNOWN'&&error.cause?.code==='RETENTION_SUPPRESSED'&&error.versionCommitted===true&&error.versionId===versionId&&error.budgetSettlementUnknown===false&&error.budget.ticketId==='original-synthetic-ticket');
 assert.equal(delivered,false);assert.deepEqual(counts,{generate:1,put:1,settle:1});assert.equal(f.state.versions.size,revision?2:1);assert.equal(f.durable.state.writes,revision?2:1);assert.equal(f.state.heads.get(artifactId).version_id,versionId);assert.equal(f.state.versions.get(versionId).record.version.artifactId,artifactId);
 assert.deepEqual(events.slice(-1*(kind==='artifact'?4:3)),['settled','authorize:'+(revision?'artifact.revise':'artifact.generate'),'retention:conversation',...(kind==='artifact'?['retention:artifact']:[])]);await assert.rejects(f.create().read(versionId),/SUPPRESSED/);
}
test('final release: newly created artifact suppressed during settlement cannot return metadata',()=>scenario('artifact'));
test('final release: conversation suppression during settlement preserves caller scope and completed effect identity',()=>scenario('conversation'));
test('final release: revision checks the committed artifact rather than its unused new allocation identity',()=>scenario('artifact',true));
