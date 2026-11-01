import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {createFixedRuntimeArtifactExecutor,createRuntimeDocumentOptionsComposer} from '../composition.mjs';
import {configuration} from '../../../control/document-application/current.mjs';
import {nativeDocumentFixture} from '../../../artifacts/test/native-document-fixture.mjs';
import {id} from '../../../artifacts/storage/test/sql-fixture.mjs';

function fixture(executor){
 const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1};
 const selectedClientId=id(106),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:selectedClientId,policyRevision:'synthetic'}];
 const f=nativeDocumentFixture({binding,scopes}),sessions={authenticateSession:async()=>{},readCurrentState:async()=>{}};
 const compose=createRuntimeDocumentOptionsComposer({storage:{objects:f.options.objects,versions:f.options.versions},executor,
  pool:f.options.pool,sessions,store:{lifecycle:{readArtifactFile:async()=>null}},now:f.options.now});
 return {compose,options:{artifactOptions:{...f.options,ids:()=>({})},selectedClientId,
  limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576}}};
}

test('fixed executor privately composes validator and document port preserves closed schema codes',async()=>{
 const executor=createFixedRuntimeArtifactExecutor({pythonExecutable:process.execPath,nodeExecutable:process.execPath,pptxModulePath:process.execPath,tempRoot:tmpdir()});
 assert.deepEqual(Object.keys(executor),['execute'],'generic executor interface unchanged');
 const {compose,options}=fixture(executor),composed=compose(options);
 assert.equal(typeof composed.federalValidator.validate,'function');
 const config=configuration(composed);
 await assert.rejects(config.federalValidator.validate('\ud800',{deadlineMs:Date.now()+10000}),{code:'DRAFT_SCHEMA_INVALID'});
 await assert.rejects(config.federalValidator.validate('<bill/>',{}),{code:'DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE'});
});

test('unassociated executor does not silently acquire schema authority or accept a supplied validator',()=>{
 const lookalike={execute:async()=>{},validate:async()=>({valid:true})},f=fixture(lookalike),composed=f.compose(f.options);
 assert.equal(composed.federalValidator,undefined);assert.equal(configuration(composed).federalValidator,null);
 assert.throws(()=>f.compose({...f.options,federalValidator:lookalike}));
});

test('captured validator port rejects unknown failures and keeps cancellation/cleanup inert',async()=>{
 const f=fixture({execute:async()=>{}}),composed=f.compose(f.options);
 for(const code of ['ARTIFACT_CANCELLED','ARTIFACT_DEADLINE','ARTIFACT_CLEANUP_FAILED','PRIVATE_DIAGNOSTIC']){
  const config=configuration({...composed,federalValidator:{async validate(){throw Object.assign(Error('private source'),{code});}}});
  const expected=code==='PRIVATE_DIAGNOSTIC'?'DOCUMENT_PORT_REFUSED':code;
  await assert.rejects(config.federalValidator.validate('source',{}),error=>error.code===expected&&error.message===expected);
 }
});
