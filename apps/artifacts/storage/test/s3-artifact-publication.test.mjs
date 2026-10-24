/** Actual SDK command types, synthetic native replies, no external upload/S3/DB. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createS3ArtifactPublication,createS3ArtifactPublications} from '../s3-artifact-publication.mjs';import {PutObjectCommand,ListObjectVersionsCommand} from '../s3-sdk.mjs';
import {v} from '../boundary.mjs';
import {publicationAuthority} from './publication-fixture.mjs';import {s3PreviewFixture} from './s3-preview-fixture.mjs';
const input=f=>({record:f.source,expectedParentVersionId:f.source.version.parentVersionId,...publicationAuthority(f.source,Date.now())});
test('S3 publication: purpose namespace is isolated from preview custody and exact full envelope/native receipt is retained',async()=>{
 const f=s3PreviewFixture(),owner=createS3ArtifactPublication({...f.config,enabled:true});
 f.install(f.createEvidence());await f.durable().claim(f.claim,f.source);const previewKey=[...f.s3.roots.keys()][0],before=await owner.snapshot(),value=input(f);
 const result=await owner.publish(value,before.positionSha256);assert.equal(result.created,true);assert.deepEqual(result.decision.record,f.source);assert.equal(f.s3.roots.size,2);const keys=[...f.s3.roots.keys()];assert.ok(keys.some(k=>k.includes('/artifact-publication/')));assert.ok(keys.some(k=>k.includes('/preview-custody/')));assert.equal(previewKey.includes('/preview-custody/'),true);
 const after=await owner.snapshot();assert.equal(after.index.decisions.length,1);assert.equal(after.index.heads[0].versionId,f.version.versionId);assert.equal((await owner.publish(value,after.positionSha256)).created,false);
 const puts=f.s3.calls.filter(c=>c.command instanceof PutObjectCommand&&c.command.input.Key.includes('/artifact-publication/'));assert.equal(puts.length,1);assert.equal(puts[0].command.input.IfNoneMatch,'*');assert.equal(puts[0].command.input.Metadata.namespace,'meri.artifact-publication.proposal-1');assert.equal(puts[0].command.input.ExpectedBucketOwner,'111122223333');
});
test('S3 publication: lost applied native PUT ACK stops and identical current decision replays without another PUT',async()=>{
 const f=s3PreviewFixture(),owner=createS3ArtifactPublication({...f.config,enabled:true}),position=(await owner.snapshot()).positionSha256;f.s3.lostAck=true;await assert.rejects(owner.publish(input(f),position),/ACK_UNKNOWN/);assert.equal(f.s3.versions.size,1);
 const current=await owner.snapshot();assert.equal(current.index.decisions.length,1);assert.equal((await owner.publish(input(f),current.positionSha256)).created,false);assert.equal(f.s3.versions.size,1);
});
test('S3 publication: disabled/403/delete-marker/native metadata failure cannot invent complete facts',async()=>{
 const f=s3PreviewFixture();await assert.rejects(createS3ArtifactPublication(f.config).snapshot(),/DISABLED/);assert.equal(f.s3.calls.length,0);
 const owner=createS3ArtifactPublication({...f.config,enabled:true});await owner.publish(input(f),(await owner.snapshot()).positionSha256);f.s3.mutate=r=>{r.Metadata.namespace='foreign';};await assert.rejects(owner.snapshot(),/CORRUPT/);f.s3.mutate=null;f.s3.deny=true;await assert.rejects(owner.snapshot());assert.equal(f.s3.versions.size,1);
 const absent=s3PreviewFixture(),client={async send(command,options){if(command.constructor.name==='GetObjectCommand')throw Object.assign(Error('synthetic delete marker'),{name:'NoSuchKey',$metadata:{httpStatusCode:404},$response:{headers:{'x-amz-delete-marker':'true'}}});return absent.config.client.send(command,options);}};
 await assert.rejects(createS3ArtifactPublication({...absent.config,client,enabled:true}).snapshot());assert.equal(absent.s3.versions.size,0);
});
test('S3 publication: only proven precondition failure permits bounded retry; failed native readback stays UNKNOWN',async()=>{
 const f=s3PreviewFixture(),owner=createS3ArtifactPublication({...f.config,enabled:true});f.s3.preconditions=3;await assert.rejects(owner.publish(input(f),(await owner.snapshot()).positionSha256),/CONTENTION/);assert.equal(f.s3.versions.size,0);assert.equal(f.s3.calls.filter(c=>c.command instanceof PutObjectCommand).length,3);
 const readback=s3PreviewFixture(),other=createS3ArtifactPublication({...readback.config,enabled:true});readback.s3.mutate=r=>{r.ChecksumSHA256='wrong';};await assert.rejects(other.publish(input(readback),(await other.snapshot()).positionSha256),/ACK_UNKNOWN/);assert.equal(readback.s3.versions.size,1);
});

test('dynamic publication selection reads only the selected tenant and never lists every tenant',async()=>{
 const f=s3PreviewFixture(),{tenantId,...config}=f.config,owner=createS3ArtifactPublications({...config,enabled:true});
 assert.deepEqual(Object.keys(owner),['forTenant']);assert.equal(f.s3.calls.length,0);
 await owner.forTenant(tenantId).snapshot();await owner.forTenant('other-tenant').snapshot();
 assert.equal(f.s3.calls.some(c=>c.command instanceof ListObjectVersionsCommand),false);
 const keys=f.s3.calls.filter(c=>c.command.constructor.name==='GetObjectCommand').map(c=>c.command.input.Key);
 assert.equal(new Set(keys).size,2);assert.ok(keys.some(k=>k.includes(v.hash(tenantId))));assert.ok(keys.some(k=>k.includes(v.hash('other-tenant'))));
 for(const invalid of ['',null,' a','a'.repeat(129)])assert.throws(()=>owner.forTenant(invalid));
});
for(const kind of ['denied','kms','checksum','tenant-hash','delete-marker'])test(`selected tenant ${kind} cannot become an empty publication`,async()=>{
 const f=s3PreviewFixture(),{tenantId,...config}=f.config;
 const client={async send(command,options){if(kind==='delete-marker'&&command.constructor.name==='GetObjectCommand')throw Object.assign(Error('deleted'),{name:'NoSuchKey',$metadata:{httpStatusCode:404},$response:{headers:{'x-amz-delete-marker':'true'}}});return config.client.send(command,options);}};
 const owner=createS3ArtifactPublications({...config,client,enabled:true}).forTenant(tenantId);
 if(kind!=='delete-marker')await owner.publish(input(f),(await owner.snapshot()).positionSha256);
 if(kind==='denied')f.s3.deny=true;if(kind==='kms')f.s3.mutate=r=>{r.SSEKMSKeyId='foreign';};if(kind==='checksum')f.s3.mutate=r=>{r.ChecksumSHA256='wrong';};if(kind==='tenant-hash')f.s3.mutate=r=>{r.Metadata.tenantsha256='f'.repeat(64);};
 await assert.rejects(owner.snapshot());assert.equal(f.s3.calls.some(c=>c.command instanceof ListObjectVersionsCommand),false);
});
test('selected tenant absence is distinct from disabled or stalled lookup',async()=>{
 const f=s3PreviewFixture(),{tenantId,...config}=f.config;
 const owner=createS3ArtifactPublications({...config,enabled:true});assert.equal((await owner.forTenant(tenantId).snapshot()).index.decisions.length,0);
 await assert.rejects(createS3ArtifactPublications({...config,enabled:false}).forTenant(tenantId).snapshot(),/DISABLED/);
 const client={async send(){return new Promise(()=>{});}};await assert.rejects(createS3ArtifactPublications({...config,client,enabled:true,maxRequestMs:20}).forTenant(tenantId).snapshot(),/DEADLINE/);
});
