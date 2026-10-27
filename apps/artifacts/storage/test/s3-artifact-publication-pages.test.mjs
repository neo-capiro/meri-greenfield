import test from 'node:test';import assert from 'node:assert/strict';
import {createS3ArtifactPublication} from '../s3-artifact-publication.mjs';
import {GetObjectCommand,PutObjectCommand,ListObjectVersionsCommand} from '../s3-sdk.mjs';
import {s3PreviewFixture} from './s3-preview-fixture.mjs';import {publicationAuthority} from './publication-fixture.mjs';
const input=r=>({record:r,expectedParentVersionId:r.version.parentVersionId,...publicationAuthority(r,Date.now())});
async function fixture(){const f=s3PreviewFixture(),create=(enabled=true)=>createS3ArtifactPublication({...f.config,maxRequestMs:30000,enabled:true,pagedWritesEnabled:enabled}),owner=create();await owner.upgrade((await owner.snapshot()).positionSha256);return {...f,create,owner};}
test('native S3 protocol: immutable exact-version pages retain KMS/checksum/tenant/purpose metadata; only root CAS publishes',async()=>{
 const f=await fixture(),position=(await f.owner.snapshot()).positionSha256;await f.owner.publish(input(f.source),position);const root=await f.owner.snapshot();assert.ok(root.index.tree);assert.deepEqual((await f.create(false).readVersion(f.source.version.versionId)).result.decision.record,f.source);
 const pages=f.s3.calls.filter(c=>c.command instanceof PutObjectCommand&&c.command.input.Key.includes('/pages/'));assert.ok(pages.length>0);for(const {command}of pages){assert.equal(command.input.IfNoneMatch,'*');assert.equal(command.input.ServerSideEncryption,'aws:kms');assert.equal(command.input.SSEKMSKeyId,f.config.kmsKeyId);assert.equal(command.input.ExpectedBucketOwner,f.config.expectedBucketOwner);assert.equal(command.input.Metadata.namespace,'meri.artifact-publication-pages.1');}
 const gets=f.s3.calls.filter(c=>c.command instanceof GetObjectCommand&&c.command.input.Key.includes('/pages/'));assert.ok(gets.every(c=>typeof c.command.input.VersionId==='string'));assert.equal(f.s3.calls.some(c=>c.command instanceof ListObjectVersionsCommand),false);
 assert.equal((await f.create().publish(input(f.source),root.positionSha256)).created,false);
 assert.equal((await f.create().findObject(f.source.version.object.objectId,f.source.version.binding.conversationId)).decision.record.version.versionId,f.source.version.versionId);
 assert.equal(await f.create().findObject(f.source.version.object.objectId,'00000000-0000-4000-8000-000000000099'),null);
});
test('native S3 protocol: page ACK uncertainty never advances root; exact retry reconciles immutable content',async()=>{
 const f=await fixture(),position=(await f.owner.snapshot()).positionSha256;f.s3.lostAck=true;await assert.rejects(f.owner.publish(input(f.source),position),/ACK_UNKNOWN/);assert.equal((await f.owner.snapshot()).positionSha256,position);assert.equal((await f.create().publish(input(f.source),position)).created,true);
});
for(const field of['tenant','kms','checksum','version','missing'])test(`native S3 protocol: ${field} page mismatch fails closed`,async()=>{
 const f=await fixture();await f.owner.publish(input(f.source),(await f.owner.snapshot()).positionSha256);const root=(await f.owner.snapshot()).index;
 if(field==='missing')f.s3.versions.delete(root.tree.versionId);else f.s3.mutate=r=>{if(!r.Key.includes('/pages/'))return;if(field==='tenant')r.Metadata.tenantsha256='f'.repeat(64);if(field==='kms')r.SSEKMSKeyId='foreign';if(field==='checksum')r.ChecksumSHA256='wrong';if(field==='version')r.VersionId='foreign';};
 await assert.rejects(f.create().readVersion(f.source.version.versionId));
});
