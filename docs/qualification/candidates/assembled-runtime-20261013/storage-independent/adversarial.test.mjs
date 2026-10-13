/** Independent local controls; actual product imports, synthetic storage replies only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createS3ArtifactObjects,createPostgresArtifactVersions} from '../../../../../apps/artifacts/storage/index.mjs';
import {createArtifactService} from '../../../../../apps/artifacts/service.mjs';
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
// Only valid immutable records and the inert SQL protocol are reused. Assertions are independent.
import {sqlFixture,record,commit,id,NOW} from '../../../../../apps/artifacts/storage/test/sql-fixture.mjs';
const require=createRequire(new URL('../../../../../apps/artifacts/storage/package.json',import.meta.url));
const {GetBucketVersioningCommand,PutObjectCommand,GetObjectCommand,HeadObjectCommand}=require('@aws-sdk/client-s3');
const KMS='arn:aws:kms:us-east-1:111122223333:key/22222222-2222-4222-8222-222222222222';
const sha=b=>createHash('sha256').update(b).digest('hex');
function transport(){const calls=[],stored=new Map();let tamper=null,body=null,versions=0;
 const client={async send(command,options){assert.ok(options.abortSignal instanceof AbortSignal);calls.push(command);const a=command.input;
  assert.equal(a.ExpectedBucketOwner,'111122223333');assert.equal(a.Bucket,'synthetic-review-bucket');
  if(command instanceof GetBucketVersioningCommand)return {Status:'Enabled'};
  if(command instanceof PutObjectCommand){assert.equal(a.IfNoneMatch,'*');if(stored.has(a.Key))throw {$metadata:{httpStatusCode:412}};
   stored.set(a.Key,{bytes:Buffer.from(a.Body),VersionId:`independent-native-${++versions}`,Metadata:structuredClone(a.Metadata),ChecksumSHA256:a.ChecksumSHA256});}
  const retained=stored.get(a.Key);assert.ok(retained);if(a.VersionId!==undefined)assert.equal(a.VersionId,retained.VersionId);
  const result={VersionId:retained.VersionId,Metadata:structuredClone(retained.Metadata),ChecksumSHA256:retained.ChecksumSHA256,ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:KMS,ContentLength:retained.bytes.length};
  if(command instanceof GetObjectCommand)result.Body=body??Readable.from([retained.bytes]);return tamper?tamper(command,result):result;
 }};
 const objects=createS3ArtifactObjects({client,bucket:'synthetic-review-bucket',prefix:'independent-review',expectedBucketOwner:'111122223333',kmsKeyId:KMS,now:()=>NOW,maxRequestMs:100,maxBytes:4096});
 return {objects,calls,stored,setTamper(fn){tamper=fn;},setBody(value){body=value;}};
}
const objectInput=()=>({objectId:id(500),bytes:Buffer.from('independent exact bytes'),scopes:record().version.scopes,requestSha256:'a'.repeat(64)});
test('same object ID and bytes with different canonical scopes occupy different trusted keys',async()=>{
 const f=transport(),a=objectInput(),b=structuredClone(a);b.bytes=Buffer.from(a.bytes);b.scopes[0].resourceId='different-client';
 const left=await f.objects.put(a),right=await f.objects.put(b);assert.notEqual(left.versionId,right.versionId);
 const keys=f.calls.filter(c=>c instanceof PutObjectCommand).map(c=>c.input.Key);assert.notEqual(keys[0],keys[1]);
 assert.deepEqual(await f.objects.get(left),a.bytes);assert.deepEqual(await f.objects.get(right),a.bytes);
});
test('conditional replay never promotes a matching URL/key to matching request provenance',async()=>{
 const f=transport(),input=objectInput(),first=await f.objects.put(input);assert.deepEqual(await f.objects.put(input),first);
 await assert.rejects(f.objects.put({...input,requestSha256:'b'.repeat(64)}),{code:'ARTIFACT_S3_PUT_UNKNOWN'});
 assert.equal(f.stored.size,1);assert.equal(f.calls.filter(c=>c instanceof PutObjectCommand).length,3);
});
for(const [name,mutate] of [
 ['native version',r=>r.VersionId='foreign-version'],['scope metadata',r=>r.Metadata.scopessha256='c'.repeat(64)],
 ['KMS key',r=>r.SSEKMSKeyId=KMS.replace('111122223333','999988887777')],['checksum type',r=>r.ChecksumType='COMPOSITE'],
])test(`exact-version HEAD rejects substituted ${name} before any GET`,async()=>{
 const f=transport(),object=await f.objects.put(objectInput());f.setTamper((c,r)=>{if(c instanceof HeadObjectCommand)mutate(r);return r;});
 await assert.rejects(f.objects.get(object),/ARTIFACT_S3_MISMATCH/);assert.equal(f.calls.filter(c=>c instanceof GetObjectCommand).length,0);
});
test('matching S3 headers do not verify corrupt current bytes; acquired body is destroyed',async()=>{
 const f=transport(),object=await f.objects.put(objectInput()),body=Readable.from([Buffer.alloc(object.bytes,120)]);f.setBody(body);
 await assert.rejects(f.objects.get(object),{code:'ARTIFACT_S3_MISMATCH'});assert.equal(body.destroyed,true);
});
test('redundant immutable-row owner fields are checked even when canonical record hash is valid',async()=>{
 for(const field of ['tenant_id','actor_id','conversation_id','artifact_id','request_sha256']){
  const f=sqlFixture(),versions=f.create(),r=record();await versions.commit(commit(r));
  f.state.versions.get(r.version.versionId)[field]=field==='request_sha256'?'c'.repeat(64):id(999);
  await assert.rejects(versions.read(r.version.versionId),{code:'ARTIFACT_VERSION_CORRUPT'});assert.equal(f.releases.at(-1),null);
 }
});
test('an unreferenced immutable record cannot be promoted to published lineage by its selector',async()=>{
 const f=sqlFixture(),versions=f.create(),r=record();await versions.commit(commit(r));f.state.heads.delete(r.version.artifactId);
 await assert.rejects(versions.read(r.version.versionId));assert.equal(f.state.versions.size,1);
});
test('stale CAS retains original and current head, and releases a rolled-back lease',async()=>{
 const f=sqlFixture(),versions=f.create(),a=record(),b=record(11,a.version.versionId),stale=record(12,a.version.versionId);
 await versions.commit(commit(a));await versions.commit(commit(b));await assert.rejects(versions.commit(commit(stale)),{code:'ARTIFACT_STALE_PARENT'});
 assert.equal(f.state.versions.size,2);assert.equal(f.state.heads.get(a.version.artifactId).version_id,b.version.versionId);
 assert.deepEqual(await versions.read(a.version.versionId),a);assert.equal(f.releases.at(-1),null);
});
test('lost COMMIT acknowledgement remains UNKNOWN then exact replay succeeds without second insertion',async()=>{
 const f=sqlFixture(),versions=f.create(),r=record();f.flags.commitFailure=true;
 await assert.rejects(versions.commit(commit(r)),{code:'ARTIFACT_VERSION_COMMIT_UNKNOWN'});assert.equal(f.releases.at(-1).code,'ARTIFACT_VERSION_COMMIT_UNKNOWN');
 f.flags.commitFailure=false;assert.equal((await versions.commit(commit(r))).status,'duplicate');assert.equal(f.state.versions.size,1);
 assert.equal(f.events.filter(e=>e.sql.startsWith('INSERT INTO meri_artifacts.versions')).length,1);
});
test('existing artifact service rechecks current authorization after reading bytes and refuses release',async()=>{
 const f=transport(),sql=sqlFixture(),context={binding:record().version.binding,scopes:record().version.scopes,evidence:[],assets:[],deadlineMs:NOW+5000,maxBytes:4096};let allowed=true,next=700;
 const versions=createPostgresArtifactVersions({pool:sql.pool,now:()=>NOW,maxRequestMs:100});
 const objects={put:f.objects.put,async get(object,signal){const bytes=await f.objects.get(object,signal);if(revokeAfterGet)allowed=false;return bytes;}};let revokeAfterGet=false;
 const budget={reserve:async a=>({ticketId:'independent-ticket',binding:a.binding,requestSha256:a.requestSha256,maxBytes:a.maxBytes,deadlineMs:a.deadlineMs}),settle:async a=>({ticketId:a.ticketId,requestSha256:a.requestSha256,bytes:a.bytes,outcome:a.outcome,status:'settled'})};
 const actual=createArtifactService({validators:v,objects,versions,now:()=>NOW,ids:()=>({artifactId:id(next++),versionId:id(next++),objectId:id(next++)}),authorize:async a=>({receiptId:'independent-current-owner',decision:allowed?'allow':'deny',action:a.action,binding:a.binding,scopesSha256:v.hash(a.scopes),resourceSha256:v.hash(a.resource),requestSha256:a.requestSha256,expiresAtMs:a.deadlineMs}),budget,executor:{async execute({request}){const bytes=Buffer.from(request.content.text);return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'txt',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged'}}};}}});
 const created=await actual.create({operation:'create_word',format:'txt',title:'Independent',content:{text:'current authority control'}},context);revokeAfterGet=true;
 await assert.rejects(actual.download(created.version.versionId,context),{code:'ARTIFACT_AUTHORITY'});assert.equal(sql.state.versions.size,1);assert.equal(f.stored.size,1);
});
