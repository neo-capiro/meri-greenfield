import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeRetentionStorage} from '../retention-storage.mjs';
const versionId='actual-version',object={objectId:'00000000-0000-4000-8000-000000000001',scopesSha256:'a'.repeat(64),sha256:'b'.repeat(64)};
const fault=status=>Object.assign(Error('storage'),{$metadata:{httpStatusCode:status}});
function fixture(send){const calls=[];const storage=createRuntimeRetentionStorage({client:{async send(command,options){calls.push({name:command.constructor.name,input:command.input,options});return send(command,calls.length);}},bucket:'synthetic',prefix:'private/artifacts',expectedBucketOwner:'123456789012'});return {storage,calls};}
test('actual S3 commands retain exact key/version/owner, and 404 requires a successful version-list observation',async()=>{
 const f=fixture(c=>{if(c.constructor.name==='HeadObjectCommand')throw fault(404);return {$metadata:{httpStatusCode:200}};});
 const key=f.storage.keyFor(object);assert.equal(key,`private/artifacts/${object.scopesSha256}/${object.objectId}/${object.sha256}`);
 assert.equal((await f.storage.headVersion({key,versionId})).outcome,'ABSENT');
 assert.deepEqual(f.calls.map(c=>c.name),['HeadObjectCommand','ListObjectVersionsCommand']);
 assert.equal(f.calls[0].input.VersionId,versionId);assert.equal(f.calls[1].input.Prefix,key);assert.equal(f.calls[1].input.MaxKeys,1);
 assert.ok(f.calls.every(c=>c.input.ExpectedBucketOwner==='123456789012'));
 for(const bad of [undefined,'../scope','a'.repeat(63)])assert.throws(()=>f.storage.keyFor({...object,scopesSha256:bad}));
 const denied=fixture(()=>{throw fault(403);});assert.equal((await denied.storage.headVersion({key,versionId})).outcome,'UNKNOWN');assert.equal(denied.calls.length,1);
 const deniedList=fixture(c=>{throw fault(c.constructor.name==='HeadObjectCommand'?404:403);});assert.equal((await deniedList.storage.headVersion({key,versionId})).outcome,'UNKNOWN');
});
test('exact version holds are read through explicit APIs; missing or denied policy never becomes clear',async()=>{
 const f=fixture(c=>c.constructor.name==='HeadObjectCommand'?{VersionId:versionId,$metadata:{httpStatusCode:200}}:
  c.constructor.name==='GetObjectRetentionCommand'?{Retention:{Mode:'COMPLIANCE',RetainUntilDate:new Date(1900000000000)},$metadata:{httpStatusCode:200}}:
  {LegalHold:{Status:'ON'},$metadata:{httpStatusCode:200}});
 const key=f.storage.keyFor(object);assert.deepEqual(await f.storage.holdsFor({key,versionId}),{legalHold:true,objectLockRetainUntilMs:1900000000000});
 assert.deepEqual(f.calls.map(c=>c.name),['HeadObjectCommand','GetObjectRetentionCommand','GetObjectLegalHoldCommand']);
 assert.ok(f.calls.every(c=>c.input.VersionId===versionId));
 for(const reply of [{}, {LegalHold:{}}, {LegalHold:{Status:'OFF'},$metadata:{httpStatusCode:403}}]){
  const g=fixture(c=>c.constructor.name==='HeadObjectCommand'?{VersionId:versionId,$metadata:{httpStatusCode:200}}:
   c.constructor.name==='GetObjectRetentionCommand'?{$metadata:{httpStatusCode:200}}:reply);
  await assert.rejects(g.storage.holdsFor({key,versionId}),/RETENTION_STORAGE_UNAVAILABLE/);
 }
});
