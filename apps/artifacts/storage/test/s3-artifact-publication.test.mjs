/** Actual SDK command types, synthetic native replies, no external upload/S3/DB. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createS3ArtifactPublication} from '../s3-artifact-publication.mjs';import {PutObjectCommand} from '../s3-sdk.mjs';
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
