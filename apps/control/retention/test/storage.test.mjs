import test from 'node:test';import assert from 'node:assert/strict';
import {classifyHeadOutcome,createVersionStorage} from '../storage-port.mjs';
import {compose,bucket} from './fixture.mjs';
const full={getObjectVersion:true,listBucketVersions:true,deleteObjectVersion:true},noList={...full,listBucketVersions:false};
const err=(status,name,headers)=>Object.assign(new Error(name),{name,$metadata:{httpStatusCode:status,httpHeaders:headers}});
test('version-specific absence: 404 is ABSENT only with the recorded list permission; 403, 405, delete markers, mismatches and ambiguity are UNKNOWN',()=>{
 assert.equal(classifyHeadOutcome({error:err(404,'NotFound'),versionId:'v1',permissions:full,versioned:true}).outcome,'ABSENT');assert.equal(classifyHeadOutcome({error:err(404,'NotFound'),versionId:'v1',permissions:full}).reason,'UNVERSIONED_NOT_FOUND','a 404 to a request that did not name the version says nothing about it');
 assert.deepEqual(classifyHeadOutcome({error:err(404,'NotFound'),versionId:'v1',permissions:noList,versioned:true}),{outcome:'UNKNOWN',reason:'NOT_FOUND_WITHOUT_LIST_PERMISSION',status:404,name:'NotFound'});
 assert.equal(classifyHeadOutcome({error:err(403,'NotFound'),versionId:'v1',permissions:full,versioned:true}).reason,'ACCESS_DENIED_MAY_MASK_ABSENCE','403 wins over the NotFound name');
 assert.equal(classifyHeadOutcome({error:err(500,'NoSuchKey'),versionId:'v1',permissions:full,versioned:true}).reason,'AMBIGUOUS_ERROR','500 wins over the NoSuchKey name');
 assert.equal(classifyHeadOutcome({error:Object.assign(new Error('NoSuchVersion'),{name:'NoSuchVersion'}),versionId:'v1',permissions:full,versioned:true}).reason,'STATUSLESS_ERROR','a name alone is not evidence');
 assert.equal(classifyHeadOutcome({response:{VersionId:'v1',$metadata:{httpStatusCode:206}},versionId:'v1',permissions:full}).reason,'AMBIGUOUS_STATUS');
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
test('holds: a version with no legal hold or retention answers 404 NoSuchObjectLockConfiguration, which is "none", while 403 stays unavailable',async()=>{
 // The live upload bucket has Object Lock enabled with a 7-day GOVERNANCE default rule: every original carries a
 // retention date, and S3 answers GetObjectLegalHold for it with 404 NoSuchObjectLockConfiguration because no legal
 // hold was ever placed. That answer is the explicit no-hold observation for this exact version; treating it as
 // unavailable turned every removal into a 503 unknown outcome and left the record in `removing`.
 const lockMissing=()=>Object.assign(new Error('NoSuchObjectLockConfiguration'),{name:'NoSuchObjectLockConfiguration',$metadata:{httpStatusCode:404}});
 const answers={retention:'governance',legal:'missing'};
 const send=async({operation,input})=>{
  if(operation==='HeadObject')return {VersionId:input.VersionId,DeleteMarker:false,$metadata:{httpStatusCode:200}};
  if(operation==='GetObjectRetention'){if(answers.retention==='missing')throw lockMissing();if(answers.retention==='forbidden')throw err(403,'AccessDenied');
   return {Retention:{Mode:'GOVERNANCE',RetainUntilDate:new Date(Date.now()+7*86400000).toISOString()},$metadata:{httpStatusCode:200}};}
  if(operation==='GetObjectLegalHold'){if(answers.legal==='missing')throw lockMissing();if(answers.legal==='forbidden')throw err(403,'AccessDenied');
   return {LegalHold:{Status:answers.legal},$metadata:{httpStatusCode:200}};}
  throw new Error('unexpected '+operation);
 };
 const storage=createVersionStorage({send,bucket:'synthetic-bucket',expectedBucketOwner:'967807252336',permissions:full,now:Date.now});
 const held=await storage.holdsFor({key:'k',versionId:'v1'});
 assert.equal(held.legalHold,false,'a missing legal-hold configuration is no legal hold');
 assert.ok(held.objectLockRetainUntilMs>Date.now(),'the default-rule retention date is still observed');
 answers.retention='missing';assert.deepEqual(await storage.holdsFor({key:'k',versionId:'v1'}),{objectLockRetainUntilMs:null,legalHold:false},'neither configured is no hold at all');
 answers.legal='ON';assert.equal((await storage.holdsFor({key:'k',versionId:'v1'})).legalHold,true);
 answers.legal='forbidden';await assert.rejects(storage.holdsFor({key:'k',versionId:'v1'}),/RETENTION_STORAGE_UNAVAILABLE/,'a denied read is never an invented no-hold');
 answers.legal='OFF';answers.retention='forbidden';await assert.rejects(storage.holdsFor({key:'k',versionId:'v1'}),/RETENTION_STORAGE_UNAVAILABLE/);
});
