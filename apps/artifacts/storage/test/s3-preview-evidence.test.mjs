/** Concrete conditional SDK extension over synthetic responses, never a product resource/durability qualification. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {v} from '../boundary.mjs';import {createS3PreviewEvidence} from '../s3-preview-evidence.mjs';import {createPreviewCustodyJournal} from '../../preview/custody-journal.mjs';
import {PutObjectCommand,GetObjectCommand} from '../s3-sdk.mjs';import {s3PreviewFixture} from './s3-preview-fixture.mjs';
const journal=(f,evidence)=>createPreviewCustodyJournal({evidence,tenantId:f.version.binding.tenantId,artifactId:f.version.artifactId,now:Date.now,maxRequestMs:300});

test('synthetic S3 evidence: disabled construction/methods perform zero client calls',async()=>{
 const f=s3PreviewFixture(),owner=createS3PreviewEvidence(f.config);assert.equal(f.s3.calls.length,0);await assert.rejects(journal(f,owner).claim(f.claim,f.source),e=>e.code==='ARTIFACT_PREVIEW_CUSTODY_ACK_UNKNOWN'&&e.cause.code==='ARTIFACT_PREVIEW_EVIDENCE_DISABLED');assert.equal(f.s3.calls.length,0);
});

test('synthetic S3 evidence: independent owners atomically choose one source/allocation winner with actual conditional headers',async()=>{
 const f=s3PreviewFixture(),a=journal(f,f.createEvidence()),b=journal(f,f.createEvidence()),other={...f.claim,objectId:randomUUID(),previewId:randomUUID()};
 const results=await Promise.all([a.claim(f.claim,f.source),b.claim(other,f.source)]);assert.equal(results.filter(r=>r.created).length,1);assert.deepEqual(results[0].claim,results[1].claim);
 const root=JSON.parse(f.s3.current.bytes);assert.equal(root.facts.length,1);assert.equal(root.allocations.length,1);
 const before=f.s3.versions.size;assert.equal((await a.claim(results[0].claim,f.source)).created,false);assert.equal(f.s3.versions.size,before);
 const puts=f.s3.calls.filter(c=>c.command instanceof PutObjectCommand);assert.ok(puts.every(c=>c.command.input.IfNoneMatch==='*'));
 assert.ok(f.s3.calls.every(c=>c.command.input.ExpectedBucketOwner==='111122223333'&&c.options.abortSignal instanceof AbortSignal));
});

test('synthetic S3 evidence: an allocation cannot be won by a different source',async()=>{
 const f=s3PreviewFixture(),owner=journal(f,f.createEvidence());await owner.claim(f.claim,f.source);const source=structuredClone(f.source);source.version.versionId=randomUUID();
 const claim={...f.claim,versionId:source.version.versionId,sourceVersionSha256:v.hash(source.version)};
 await assert.rejects(owner.claim(claim,source),e=>e.cause.code==='ARTIFACT_PREVIEW_ALLOCATION_HELD');assert.equal(JSON.parse(f.s3.current.bytes).facts.length,1);
});

test('synthetic S3 evidence: full preview adapter uses CAS/native readback, restores SQL custody, and never repeats put',async()=>{
 const f=s3PreviewFixture();f.install(f.createEvidence());await f.publish(f.create());assert.equal(f.state.puts,1);assert.equal(JSON.parse(f.s3.current.bytes).facts.length,3);
 const puts=f.s3.calls.filter(c=>c.command instanceof PutObjectCommand);assert.equal(puts.length,3);assert.equal(puts[0].command.input.IfNoneMatch,'*');assert.ok(puts.slice(1).every(c=>typeof c.command.input.IfMatch==='string'));
 assert.ok(f.s3.calls.some(c=>c.command instanceof GetObjectCommand&&c.command.input.VersionId==='synthetic-index-native-3'));
 f.state.rows.clear();await assert.rejects(f.create().read(f.version.versionId),/PROJECTION_STALE/);await f.recover();assert.equal((await f.publish(f.create())).status,'existing');assert.equal(f.state.puts,1);
});

test('synthetic S3 evidence: lost applied conditional PUT ACK never becomes a newly won replay',async()=>{
 const f=s3PreviewFixture(),owner=journal(f,f.createEvidence());f.s3.lostAck=true;await assert.rejects(owner.claim(f.claim,f.source),e=>e.code==='ARTIFACT_PREVIEW_CUSTODY_ACK_UNKNOWN'&&e.cause.code==='ARTIFACT_PREVIEW_EVIDENCE_ACK_UNKNOWN');
 assert.equal(f.s3.versions.size,1);assert.equal((await owner.claim(f.claim,f.source)).created,false);assert.equal(f.s3.versions.size,1);
});

test('synthetic S3 evidence: only proven412 permits bounded CAS retry; contention never dispatches',async()=>{
 const f=s3PreviewFixture(),owner=journal(f,f.createEvidence());f.s3.preconditions=3;await assert.rejects(owner.claim(f.claim,f.source),e=>e.cause.code==='ARTIFACT_PREVIEW_EVIDENCE_CONTENTION');
 assert.equal(f.s3.calls.filter(c=>c.command instanceof PutObjectCommand).length,3);assert.equal(f.s3.versions.size,0);
});

test('synthetic S3 evidence: immutable append conflict and bounded inventory never overwrite or truncate existing facts',async()=>{
 const f=s3PreviewFixture(),owner=journal(f,f.createEvidence({maxFacts:1}));await owner.claim(f.claim,f.source);
 const object={...f.version.object,objectId:f.claim.objectId,versionId:'synthetic-preview-native'};await assert.rejects(owner.recordObject(f.claim,object),e=>e.cause.code==='ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');assert.equal((await owner.snapshot()).rows.length,1);
 const tooSmall=s3PreviewFixture();await assert.rejects(journal(tooSmall,tooSmall.createEvidence({maxIndexBytes:50})).claim(tooSmall.claim,tooSmall.source),e=>e.cause.code==='ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');assert.equal(tooSmall.s3.versions.size,0);
 const exact=s3PreviewFixture(),unbounded=journal(exact,exact.createEvidence());await unbounded.claim(exact.claim,exact.source);const known={...exact.version.object,objectId:exact.claim.objectId,versionId:'known-native'};await unbounded.recordObject(exact.claim,known);
 await assert.rejects(unbounded.recordObject(exact.claim,{...known,versionId:'different-native'}),e=>e.cause.code==='ARTIFACT_PREVIEW_CONFLICT');assert.equal(JSON.parse(exact.s3.current.bytes).facts.length,2);
});

test('synthetic S3 evidence: changed metadata/checksum/native version and403 cannot certify current facts',async()=>{
 for(const kind of ['metadata','checksum','native','denied']){const f=s3PreviewFixture(),owner=journal(f,f.createEvidence());await owner.claim(f.claim,f.source);
  if(kind==='denied')f.s3.deny=true;else f.s3.mutate=r=>{if(kind==='metadata')r.Metadata.tenantsha256='0'.repeat(64);if(kind==='checksum')r.ChecksumSHA256='bad';if(kind==='native')r.VersionId='null';};await assert.rejects(owner.snapshot());}
});

test('synthetic S3 evidence: suspended versioning and parked current reads remain unavailable',async()=>{
 const f=s3PreviewFixture();f.s3.versioning='Suspended';await assert.rejects(journal(f,f.createEvidence()).claim(f.claim,f.source));assert.equal(f.s3.versions.size,0);
 const parked=s3PreviewFixture();await journal(parked,parked.createEvidence()).claim(parked.claim,parked.source);parked.s3.park=true;await assert.rejects(journal(parked,parked.createEvidence({maxRequestMs:20})).snapshot(),/DEADLINE/);
});

test('synthetic S3 evidence: complete current index partitions remain exact across artifacts',async()=>{
 const f=s3PreviewFixture(),evidence=f.createEvidence(),first=journal(f,evidence);await first.claim(f.claim,f.source);
 const source=structuredClone(f.source);source.version.artifactId=randomUUID();source.version.versionId=randomUUID();
 const claim={...f.claim,artifactId:source.version.artifactId,versionId:source.version.versionId,sourceVersionSha256:v.hash(source.version),previewId:randomUUID(),objectId:randomUUID()};
 const second=createPreviewCustodyJournal({evidence,tenantId:source.version.binding.tenantId,artifactId:source.version.artifactId,now:Date.now});await second.claim(claim,source);
 assert.equal((await first.snapshot()).rows.length,1);assert.equal((await second.snapshot()).rows[0].claim.versionId,claim.versionId);assert.equal(JSON.parse(f.s3.current.bytes).facts.length,2);
});

test('synthetic S3 evidence: failed exact native readback after accepted PUT never grants a fresh winner on replay',async()=>{
 const f=s3PreviewFixture(),owner=journal(f,f.createEvidence());f.s3.mutate=r=>r.ChecksumSHA256='wrong';await assert.rejects(owner.claim(f.claim,f.source),e=>e.cause.code==='ARTIFACT_PREVIEW_EVIDENCE_ACK_UNKNOWN');
 assert.equal(f.s3.versions.size,1);f.s3.mutate=null;assert.equal((await owner.claim(f.claim,f.source)).created,false);assert.equal(f.s3.versions.size,1);
});

test('synthetic S3 evidence: a known index delete-marker or foreign404 never becomes empty authoritative custody',async()=>{
 for(const kind of ['property','header','bucket']){const f=s3PreviewFixture(),client={async send(command,options){if(command instanceof GetObjectCommand){const error=Object.assign(Error('synthetic index unavailable'),{name:kind==='bucket'?'NoSuchBucket':'NoSuchKey',$metadata:{httpStatusCode:404}});
    if(kind==='property')error.DeleteMarker=true;if(kind==='header')error.$response={headers:{'x-amz-delete-marker':'true'}};throw error;}return f.config.client.send(command,options);}};
  await assert.rejects(journal(f,f.createEvidence({client})).claim(f.claim,f.source),e=>e.code==='ARTIFACT_PREVIEW_CUSTODY_ACK_UNKNOWN'&&e.cause.message==='synthetic index unavailable');assert.equal(f.s3.versions.size,0);}
});
