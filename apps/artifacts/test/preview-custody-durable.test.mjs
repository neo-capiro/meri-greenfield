/** Source control checks over synthetic conditional evidence, scripted SQL, synthetic PDF bytes and object ports. No native DB/provider. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {v} from '../storage/boundary.mjs';import {custodyFixture} from './preview-custody-fixture.mjs';import {createPreviewCustodyJournal} from '../preview/custody-journal.mjs';

test('synthetic durable preview: concurrent independent owners get one dispatch and immutable exact custody',async()=>{
 const f=custodyFixture(),results=await Promise.allSettled([f.publish(f.create()),f.publish(f.create())]);assert.equal(f.state.puts,1);assert.ok(results.some(r=>r.status==='fulfilled'));
 const rows=await f.create().custody();assert.equal(rows.length,1);assert.equal(rows[0].state,'COMMITTED');assert.equal(rows[0].object.versionId,'synthetic-native-1');assert.equal(f.state.facts.size,3);
 assert.equal((await f.publish(f.create())).status,'existing');assert.equal(f.state.puts,1);assert.ok(f.state.leases.every(l=>l.releases.length===1));
});

test('synthetic durable preview: conditional identical/conflicting source claims retain the original allocation, binding and deadline',async()=>{
 const f=custodyFixture(),first=await f.store.claim(f.claim),original=structuredClone(first.claim);assert.equal(first.claimed,true);
 assert.equal((await f.create().claim(f.claim)).claimed,false);const conflict={...f.claim,objectId:randomUUID(),previewId:randomUUID(),deadlineMs:f.claim.deadlineMs+1};
 const result=await f.create().claim(conflict);assert.equal(result.claimed,false);assert.deepEqual(result.claim,original);assert.equal(f.state.puts,0);assert.equal(f.state.facts.size,1);
});

for(const boundary of ['CLAIMED','OBJECT_RECORDED','COMMITTED'])test(`synthetic durable preview: lost ${boundary} durable ACK stays held and recovery never repeats object effects`,async()=>{
 const f=custodyFixture();f.state.lostFact=boundary;await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.code==='ARTIFACT_PREVIEW_CUSTODY_ACK_UNKNOWN');const puts=f.state.puts,original=structuredClone([...f.state.facts.values()][0]);
 await assert.rejects(f.publish(f.create()),e=>e.code==='ARTIFACT_PREVIEW_PROJECTION_STALE');await f.recover();
 if(boundary==='COMMITTED')assert.equal((await f.publish(f.create())).status,'existing');else await assert.rejects(f.publish(f.create()),{code:'ARTIFACT_EFFECT_UNKNOWN'});
 assert.equal(f.state.puts,puts);assert.deepEqual([...f.state.facts.values()][0],original);assert.ok(f.state.sourceRecoveries>0);
});

for(const boundary of ['CLAIMED','OBJECT_RECORDED','COMMITTED'])test(`synthetic durable preview: lost ${boundary} SQL COMMIT ACK retires its lease, replay cannot gain dispatch`,async()=>{
 const f=custodyFixture();f.state.lostSql=boundary;await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.code==='RETENTION_COMMIT_UNKNOWN');const puts=f.state.puts,unknown=f.state.leases.find(l=>l.releases.some(e=>e?.code==='RETENTION_COMMIT_UNKNOWN'));
 assert.ok(unknown);assert.equal(unknown.queries.some(q=>q.sql==='ROLLBACK'),false);await f.recover();
 if(boundary==='COMMITTED')assert.equal((await f.publish(f.create())).status,'existing');else await assert.rejects(f.publish(f.create()),{code:'ARTIFACT_EFFECT_UNKNOWN'});assert.equal(f.state.puts,puts);
});

test('synthetic durable preview: unseen later claim followed by restored SQL absence cannot serve or claim before recovery',async()=>{
 const f=custodyFixture(),reader=f.create();assert.equal(await reader.read(f.version.versionId),null);await f.store.claim(f.claim);f.state.rows.clear();
 await assert.rejects(reader.read(f.version.versionId),/PROJECTION_STALE/);await assert.rejects(f.create().claim({...f.claim,objectId:randomUUID()}),/PROJECTION_STALE/);
 await f.recover();assert.equal((await f.create().custody())[0].state,'UNKNOWN');await assert.rejects(f.publish(f.create()),{code:'ARTIFACT_EFFECT_UNKNOWN'});assert.equal(f.state.puts,0);
});

test('synthetic durable preview: restore before all SQL custody rows recovers exact record without a second put',async()=>{
 const f=custodyFixture();await f.publish();const original=await f.store.read(f.version.versionId);f.state.rows.clear();await assert.rejects(f.create().read(f.version.versionId),/PROJECTION_STALE/);
 await f.recover();assert.deepEqual(await f.create().read(f.version.versionId),original);assert.equal((await f.publish(f.create())).status,'existing');assert.equal(f.state.puts,1);
});

test('synthetic durable preview: TOMBSTONE survives SQL rollback, refuses reads and dispatch, retains physical custody',async()=>{
 const f=custodyFixture();await f.publish();const row=(await f.store.custody())[0];await f.durable().tombstone(row.claim,{reason:'synthetic suppression',atMs:f.state.now});
 await assert.rejects(f.store.read(f.version.versionId),/TOMBSTONED/);f.state.rows.clear();await f.recover();await assert.rejects(f.publish(f.create()),/TOMBSTONED/);
 const retained=(await f.create().custody())[0];assert.equal(retained.state,'TOMBSTONE');assert.equal(retained.object.versionId,row.object.versionId);assert.equal(f.state.puts,1);
});

test('synthetic durable preview: native receipt conflict and altered commit never overwrite durable or SQL identity',async()=>{
 const f=custodyFixture();await f.publish();const row=(await f.store.custody())[0],before=structuredClone([...f.state.facts]);
 await assert.rejects(f.store.recordObject(row.claim,{...row.object,versionId:'different-native'}),/CONFLICT/);
 await assert.rejects(f.store.commit({...row.record,createdAt:new Date(f.state.now+1).toISOString()}),/CONFLICT/);assert.deepEqual([...f.state.facts],before);
});

test('synthetic durable preview: corrupt receipts/duplicates and a legacy append-only sink fail closed',async()=>{
 const f=custodyFixture();assert.throws(()=>createPreviewCustodyJournal({evidence:{append(){},read(){}},tenantId:f.version.binding.tenantId,artifactId:f.version.artifactId,now:Date.now}),/CONFIGURATION/);
 await f.store.claim(f.claim);const first=[...f.state.facts.values()][0];first.receiptSha256='0'.repeat(64);await assert.rejects(f.durable().snapshot(),/CUSTODY_CORRUPT/);
 first.receiptSha256=v.hash({namespace:first.value.namespace,key:`${first.value.tenantId}/${first.value.versionId}/CLAIMED`,entrySha256:first.entrySha256});
 const evidence={...f.evidence,async read(){return [first,first];}};await assert.rejects(createPreviewCustodyJournal({evidence,tenantId:f.version.binding.tenantId,artifactId:f.version.artifactId,now:Date.now}).snapshot(),/CUSTODY_CORRUPT/);
});

test('synthetic durable preview: revocation during put retains UNKNOWN receipt and no publication; expiry prevents fresh dispatch',async()=>{
 const f=custodyFixture(),objects={...f.objects,async put(...args){const result=await f.objects.put(...args);f.state.deny=true;return result;}};
 await assert.rejects(f.publish(f.store,objects),{code:'ARTIFACT_EFFECT_UNKNOWN'});assert.equal((await f.store.custody())[0].state,'UNKNOWN');assert.equal(f.state.facts.size,2);assert.equal(f.state.puts,1);
 const expired=custodyFixture();expired.state.now=expired.claim.deadlineMs;await assert.rejects(expired.store.claim(expired.claim),/EXPIRED/);assert.equal(expired.state.facts.size,0);
});

test('synthetic durable preview: lost put ACK retains potential orphan and cannot dispatch again after recovery',async()=>{
 const f=custodyFixture(),objects={...f.objects,async put(...args){await f.objects.put(...args);throw Error('synthetic put ACK lost');}};
 await assert.rejects(f.publish(f.store,objects),e=>e.cause.message==='synthetic put ACK lost');const row=(await f.store.custody())[0];assert.equal(row.object,null);assert.equal(row.state,'UNKNOWN');
 await f.recover();await assert.rejects(f.publish(f.create()),{code:'ARTIFACT_EFFECT_UNKNOWN'});assert.equal(f.state.puts,1);assert.equal((await f.store.custody())[0].claim.objectId,row.claim.objectId);
});

test('synthetic durable preview: a tombstone arriving while preview bytes are read prevents byte release',async()=>{
 const f=custodyFixture();await f.publish();const row=(await f.store.custody())[0],objects={...f.objects,async get(...args){const bytes=await f.objects.get(...args);await f.durable().tombstone(row.claim,{reason:'synthetic during read',atMs:f.state.now});return bytes;}};
 await assert.rejects(f.service(f.store,objects).read(f.version.versionId,f.context),/TOMBSTONED/);assert.equal(f.state.puts,1);
});

test('synthetic durable preview: receipt after tombstone/SQL restore retains exact orphan custody without reopening serving',async()=>{
 const f=custodyFixture();await f.store.claim(f.claim);await f.durable().tombstone(f.claim,{reason:'synthetic before receipt',atMs:f.state.now});f.state.rows.clear();
 const object={...f.version.object,objectId:f.claim.objectId,versionId:'synthetic-recovered-native'};await f.store.recordObject(f.claim,object);
 const row=(await f.store.custody())[0];assert.equal(row.state,'TOMBSTONE');assert.deepEqual(row.object,object);await assert.rejects(f.store.read(f.version.versionId),/TOMBSTONED/);assert.equal(f.state.puts,0);
});

test('synthetic durable preview: tombstone during SQL publication prevents a successful publication response',async()=>{
 const f=custodyFixture();let injected=false;f.state.hook=async sql=>{if(!injected&&sql.startsWith('INSERT INTO meri_artifacts.previews')){injected=true;const row=(await f.durable().snapshot()).rows[0];await f.durable().tombstone(row.claim,{reason:'synthetic commit race',atMs:f.state.now});}};
 await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.code==='ARTIFACT_PREVIEW_TOMBSTONED');assert.equal(f.state.puts,1);assert.equal((await f.store.custody())[0].state,'TOMBSTONE');
});

test('synthetic durable preview: late conditional ACK after deadline remains UNKNOWN and never grants delayed dispatch',async()=>{
 const f=custodyFixture(),original=f.evidence.claim,park=Promise.withResolvers();f.evidence.claim=async request=>{await park.promise;return original(request);};
 const store=f.create();await assert.rejects(store.claim(f.claim),/ACK_UNKNOWN/);assert.equal(f.state.rows.size,0);park.resolve();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.state.facts.size,1);await assert.rejects(f.create().claim(f.claim),/PROJECTION_STALE/);await f.recover();assert.equal((await f.create().claim(f.claim)).claimed,false);assert.equal(f.state.puts,0);
});

test('synthetic durable preview: failed source prerequisite recovery never certifies restored custody',async()=>{
 const f=custodyFixture();await f.store.claim(f.claim);f.state.rows.clear();f.sourceRecovery.recover=async()=>{throw Error('synthetic canonical source unavailable');};
 await assert.rejects(f.recover(),/RETENTION_STORE_UNAVAILABLE/);assert.equal(f.state.rows.size,0);await assert.rejects(f.create().ensureServing(),/PROJECTION_STALE/);
 assert.ok(f.state.leases.every(l=>l.releases.length===1));assert.equal(f.state.puts,0);
});
