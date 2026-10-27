import test from 'node:test';import assert from 'node:assert/strict';
import {v} from '../boundary.mjs';
import {createArtifactPublicationJournal} from '../artifact-publication.mjs';
import {record,id,NOW} from './sql-fixture.mjs';
import {publicationAuthority} from './publication-fixture.mjs';
import {pagedPublicationFixture} from './paged-publication-fixture.mjs';
const tenant=record().version.binding.tenantId,input=r=>({record:r,expectedParentVersionId:r.version.parentVersionId,...publicationAuthority(r,NOW)});
const publish=async(owner,r)=>owner.publish(input(r),(await owner.snapshot()).positionSha256);
async function activated(){const f=pagedPublicationFixture(tenant,()=>NOW);await f.owner.upgrade((await f.owner.snapshot()).positionSha256);return f;}
test('paged publication: explicit activation preserves legacy bytes; rollback floor reads both and old binary refuses v2',async()=>{
 const f=pagedPublicationFixture(tenant,()=>NOW),a=record();await publish(f.owner,a);const legacy=structuredClone(f.state.index),position=(await f.owner.snapshot()).positionSha256;
 await assert.rejects(f.create(false).upgrade(position),/UPGRADE_DISABLED/);assert.deepEqual(f.state.index,legacy);
 await f.owner.upgrade(position);assert.equal(f.state.index.legacy.positionSha256,v.hash(legacy));assert.equal(f.state.index.legacy.versionId,'root-1');assert.deepEqual(f.state.roots[1],legacy);
 assert.deepEqual((await f.create(false).readVersion(a.version.versionId)).result.decision.record,a);
 await assert.rejects(publish(f.create(false),record(11,a.version.versionId)),/UPGRADE_DISABLED/);
 await assert.rejects(createArtifactPublicationJournal({transport:f.transport,tenantId:tenant,now:()=>NOW}).snapshot());
 assert.equal((await publish(f.owner,a)).created,false);
});
test('paged publication: 1050 actual owner decisions resolve and page after reconstruction with bounded native-page reads',async()=>{
 const f=await activated();for(let n=0;n<1050;n++){const r=record(10000+n);r.version.artifactId=id(20000+n);await publish(f.owner,r);}
 const owner=f.create(),snapshot=await owner.snapshot();assert.ok(Buffer.byteLength(JSON.stringify(snapshot.index))<4096);
 f.state.pageReads=0;const found=await owner.readVersion(id(11049));assert.equal(found.result.decision.record.version.artifactId,id(21049));assert.ok(f.state.pageReads<30,`point reads ${f.state.pageReads}`);
 const seen=new Set();let offset=0,pages=0;do{f.state.pageReads=0;const page=await owner.page({kind:'list',offset,limit:100,positionSha256:snapshot.positionSha256});assert.ok(f.state.pageReads<70,`page reads ${f.state.pageReads}`);for(const row of page.records)seen.add(row.decision.record.version.artifactId);offset=page.nextOffset;pages++;}while(offset!==null);
 assert.equal(seen.size,1050);assert.equal(pages,11);assert.equal(f.state.revision,1051);
});
test('paged publication: history passes 1024 revisions without whole-chain read; immutable parent and current head remain exact',async()=>{
 const f=await activated();let parent=null;for(let n=0;n<1030;n++){const r=record(30000+n,parent);await publish(f.owner,r);parent=r.version.versionId;}
 const owner=f.create(),snapshot=await owner.snapshot();f.state.pageReads=0;const page=await owner.page({kind:'history',artifactId:id(9),anchorVersionId:id(30000),offset:1000,limit:20,positionSha256:snapshot.positionSha256});assert.equal(page.records.length,20);assert.equal(page.records[0].decision.record.version.versionId,id(30029));assert.equal(page.nextOffset,1020);assert.equal(page.anchor.head.versionId,parent);assert.ok(f.state.pageReads<45);
 const tail=await owner.page({kind:'history',artifactId:id(9),anchorVersionId:id(30000),offset:1020,limit:20,positionSha256:snapshot.positionSha256});assert.equal(tail.records.length,10);assert.equal(tail.nextOffset,null);assert.equal(tail.records.at(-1).decision.record.version.parentVersionId,null);
});
test('paged publication: page corruption/missing native version and changed root fail closed, no listing fallback',async()=>{
 const f=await activated(),a=record();await publish(f.owner,a);const snapshot=await f.owner.snapshot(),hash=snapshot.index.tree.sha256,bytes=f.state.pages.get(hash);f.state.pages.delete(hash);await assert.rejects(f.create().readVersion(a.version.versionId),/MISSING_PAGE/);f.state.pages.set(hash,bytes);
 const page=JSON.parse(bytes);page.tenantId='foreign';f.state.pages.set(hash,JSON.stringify(page));await assert.rejects(f.create().readVersion(a.version.versionId),/CORRUPT/);f.state.pages.set(hash,bytes);
 await publish(f.owner,record(11,a.version.versionId));await assert.rejects(f.owner.page({kind:'list',offset:0,limit:1,positionSha256:snapshot.positionSha256}),/STALE/);
});
test('paged publication: lost page/root ACKs preserve uncertainty; exact retry never duplicates a publication',async()=>{
 const f=await activated(),a=record();f.state.lostPageAck=true;await assert.rejects(publish(f.owner,a),/ACK_UNKNOWN/);assert.equal(f.state.revision,1);await publish(f.create(),a);assert.equal(f.state.revision,2);
 const b=record(11,a.version.versionId);f.state.lostRootAck=true;await assert.rejects(publish(f.owner,b),/ACK_UNKNOWN/);assert.equal(f.state.revision,3);assert.equal((await publish(f.create(),b)).created,false);assert.equal(f.state.revision,3);
 const revision=f.state.revision;await f.owner.tombstone({artifactId:id(9),versionId:b.version.versionId,retentionDecisionSha256:'f'.repeat(64)});await assert.rejects(publish(f.create(),record(12,b.version.versionId)),/TERMINAL/);assert.equal(f.state.revision,revision+1);
});
test('paged publication: full legacy upgrade builds bounded pages once and preserves an unseen terminal artifact',async()=>{
 const f=pagedPublicationFixture(tenant,()=>NOW),decisions=[],heads=[];
 // Build only the legacy fixture through its canonical validator; the separate scale case publishes1050 through the real owner.
 for(let n=0;n<1024;n++){const r=record(40000+n);r.version.artifactId=id(50000+n);const value=input(r),recordSha256=v.hash(r),decision={...value,recordSha256,decisionSha256:v.hash({...value,recordSha256})};decisions.push(decision);heads.push({artifactId:r.version.artifactId,versionId:r.version.versionId,decisionSha256:decision.decisionSha256});}
 const terminal={artifactId:id(99999),versionId:null,retentionDecisionSha256:'f'.repeat(64)};f.state.index={...f.state.index,decisions,heads,tombstones:[terminal]};const before=await f.owner.snapshot();await f.owner.upgrade(before.positionSha256);assert.ok(f.state.pageWrites<200,`upgrade wrote ${f.state.pageWrites} pages`);
 assert.deepEqual((await f.create().readVersion(id(41023))).result.decision,decisions.at(-1));const blocked=record(99998);blocked.version.artifactId=terminal.artifactId;await assert.rejects(publish(f.owner,blocked),/TERMINAL/);
});
test('paged publication: two independent owners select one exact child; parent scope and pre-aborted publication remain fenced',async()=>{
 const f=await activated(),a=record();await publish(f.owner,a);const before=await f.owner.snapshot(),b=record(11,a.version.versionId),c=record(12,a.version.versionId);
 const outcomes=await Promise.allSettled([f.create().publish(input(b),before.positionSha256),f.create().publish(input(c),before.positionSha256)]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);
 const head=(await f.owner.readHead(a.version.artifactId)).result.head.versionId,foreign=record(13,head);foreign.version.binding.actorId='foreign';await assert.rejects(publish(f.owner,foreign),/PARENT_BINDING/);
 const abort=new AbortController();abort.abort();const revision=f.state.revision;await assert.rejects(f.owner.publish(input(record(14,head)),(await f.owner.snapshot()).positionSha256,abort.signal));assert.equal(f.state.revision,revision);
});
