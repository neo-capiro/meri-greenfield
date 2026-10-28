import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createArtifactService} from '../service.mjs';import {nativeDocumentFixture} from './native-document-fixture.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
const owner=(f,changes={})=>createArtifactService({...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),...changes});
test('private revision source reads exact immutable spec and current bytes without changing public inspect/download DTOs',async()=>{
 const f=nativeDocumentFixture(),created=await f.run(),original=structuredClone(f.call.request),before={puts:f.state.puts,executions:f.state.executions.length};
 const source=await owner(f).revisionSource(created.version.versionId,f.context);
 assert.deepEqual(source.request,original);assert.equal(source.specSha256,v.hash(original));assert.deepEqual(source.version,created.version);assert.equal(source.inspection.currentBytesVerified,true);
 assert.deepEqual(Object.keys(await owner(f).inspect(created.version.versionId,f.context)).sort(),['inspection','version']);
 assert.deepEqual(Object.keys(await owner(f).download(created.version.versionId,f.context)).sort(),['bytes','version']);
 assert.deepEqual({puts:f.state.puts,executions:f.state.executions.length},before);
});
test('private source refuses corrupt original bytes and wrong actor/conversation before content release',async()=>{
 const f=nativeDocumentFixture(),created=await f.run();
 for(const field of ['actorId','conversationId'])await assert.rejects(owner(f).revisionSource(created.version.versionId,{...f.context,binding:{...f.context.binding,[field]:randomUUID()}}),{code:'ARTIFACT_VERSION_CONTEXT'});
 const objects={...f.options.objects,get:async()=>Buffer.from('corrupt')};await assert.rejects(owner(f,{objects}).revisionSource(created.version.versionId,f.context),{code:'ARTIFACT_OBJECT_MISMATCH'});
});
test('late current denial and suppression withhold the private source just like ordinary inspect',async()=>{
 for(const suppress of [false,true]){const f=nativeDocumentFixture(),created=await f.run();let checks=0;
  f.state.authorizeHook=()=>{if(++checks===3){if(suppress)f.sql.suppressed.add(`${f.context.binding.tenantId}:artifact:${created.version.artifactId}`);else f.state.denied=true;}};
  await assert.rejects(owner(f).revisionSource(created.version.versionId,f.context),suppress?{code:'RETENTION_SUPPRESSED'}:/CURRENT_ACCESS_DENIED/);
 }
});
