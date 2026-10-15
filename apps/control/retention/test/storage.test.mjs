import test from 'node:test';import assert from 'node:assert/strict';
import {classifyHeadOutcome,createVersionStorage} from '../storage-port.mjs';
import {compose,bucket} from './fixture.mjs';
const full={getObjectVersion:true,listBucketVersions:true,deleteObjectVersion:true},noList={...full,listBucketVersions:false};
const err=(status,name,headers)=>Object.assign(new Error(name),{name,$metadata:{httpStatusCode:status,httpHeaders:headers}});
test('version-specific absence: 404 is ABSENT only with the recorded list permission; 403, 405, delete markers, mismatches and ambiguity are UNKNOWN',()=>{
 assert.equal(classifyHeadOutcome({error:err(404,'NotFound'),versionId:'v1',permissions:full}).outcome,'ABSENT');
 assert.deepEqual(classifyHeadOutcome({error:err(404,'NotFound'),versionId:'v1',permissions:noList}),{outcome:'UNKNOWN',reason:'NOT_FOUND_WITHOUT_LIST_PERMISSION',status:404,name:'NotFound'});
 assert.equal(classifyHeadOutcome({error:err(403,'AccessDenied'),versionId:'v1',permissions:full}).reason,'ACCESS_DENIED_MAY_MASK_ABSENCE');
 assert.equal(classifyHeadOutcome({error:err(405,'MethodNotAllowed'),versionId:'v1',permissions:full}).reason,'DELETE_MARKER_NOT_PROOF');
 assert.equal(classifyHeadOutcome({error:err(404,'NotFound',{'x-amz-delete-marker':'true'}),versionId:'v1',permissions:full}).outcome,'UNKNOWN','a 404 carrying a delete-marker header is not absence of the historical version');
 assert.equal(classifyHeadOutcome({response:{VersionId:'v1',DeleteMarker:true},versionId:'v1',permissions:full}).outcome,'UNKNOWN');
 assert.equal(classifyHeadOutcome({response:{VersionId:'v2'},versionId:'v1',permissions:full}).reason,'VERSION_MISMATCH');
 assert.equal(classifyHeadOutcome({response:{VersionId:'v1'},versionId:'v1',permissions:full}).outcome,'PRESENT');
 assert.equal(classifyHeadOutcome({error:err(500,'InternalError'),versionId:'v1',permissions:full}).reason,'AMBIGUOUS_ERROR');
 assert.equal(classifyHeadOutcome({error:null,response:null,versionId:'v1',permissions:full}).reason,'NO_RESPONSE');
 assert.throws(()=>classifyHeadOutcome({error:err(404,'NotFound'),versionId:'v1',permissions:{getObjectVersion:true}}),/INVALID_COMMAND/);
});
test('the storage port times out to UNKNOWN, refuses deletes without the delete permission, and fails a version delete that produced a delete marker',async()=>{
 const f=compose({maxRequestMs:30});f.store.put('k','v1');
 assert.equal((await f.storage.headVersion({key:'k',versionId:'v1'})).outcome,'PRESENT');assert.equal((await f.storage.headVersion({key:'k',versionId:'v9'})).outcome,'ABSENT');
 f.store.fault.mode='timeout';const t=await f.storage.headVersion({key:'k',versionId:'v1'});assert.equal(t.outcome,'UNKNOWN');assert.equal(t.name,'TimeoutError');
 f.store.fault.mode='forbidden';assert.equal((await f.storage.headVersion({key:'k',versionId:'v1'})).reason,'ACCESS_DENIED_MAY_MASK_ABSENCE');
 f.store.fault.mode='marker-on-delete';await assert.rejects(f.storage.deleteVersion({key:'k',versionId:'v1'}),/RETENTION_DELETE_MARKER/);
 f.store.fault.mode=null;const receipt=await f.storage.deleteVersion({key:'k',versionId:'v1'});assert.equal(receipt.outcome,'REQUESTED');assert.ok(receipt.requestId);assert.equal((await f.storage.headVersion({key:'k',versionId:'v1'})).outcome,'ABSENT');
 const b=bucket();const noDelete=createVersionStorage({send:b.send,bucket:'synthetic-bucket',expectedBucketOwner:'967807252336',permissions:{...full,deleteObjectVersion:false},now:Date.now});
 await assert.rejects(noDelete.deleteVersion({key:'k',versionId:'v1'}),/RETENTION_STORAGE_PERMISSION/);
 assert.throws(()=>createVersionStorage({send:b.send,bucket:'synthetic-bucket',expectedBucketOwner:'bad',permissions:full,now:Date.now}),/RETENTION_CONFIGURATION/);
});
