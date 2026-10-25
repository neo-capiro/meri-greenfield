import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../boundary.mjs';
import {createConversationRetentionInventory} from '../retention-inventory.mjs';
import {decodeConversationInventoryRows} from '../retention-inventory-decode.mjs';
import {enumerateReferences} from '../../retention/inventory.mjs';
import {assertSdkRetentionTarget,scanSdkRetentionInventory,verifySdkRetentionTarget,forEachSdkRetentionTargetPage,sdkRetentionTargetPresent,SDK_RETENTION_PAGE_ROWS,SDK_RETENTION_PAGE_BYTES} from '../retention-sdk-rows.mjs';
import {sdkRetentionFixture,binding,id} from './retention-sdk-fixture.mjs';
const prefix='meri_conversations.',subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId,ownerActorId:binding.actorId};
const source=f=>createConversationRetentionInventory({pool:{connect(){throw Error('unexpected lease');}},withSnapshot:fn=>fn(f.reader)}).inventoryForConversation({tenantId:subject.tenantId,conversationId:subject.subjectId,ownerActorId:subject.ownerActorId});

for(const count of [4097,65537,100000])test(`complete ${count}-entry SDK inventory remains a compact exact target`,async t=>{
 const f=await sdkRetentionFixture({count});try{const started=performance.now(),decoded=await source(f),scanMs=performance.now()-started,inventory=enumerateReferences(decoded),targets=inventory.rowTargets.filter(t=>t.className==='sdkSession');
  t.diagnostic(`actual inventory scan ${scanMs.toFixed(1)} ms; fixture construction and direct decoder comparison excluded; no PostgreSQL timing claim`);
  assert.equal(targets.length,1);assert.equal(targets[0].sdk.entriesCount,count);assert.equal(targets[0].sdk.counts.entries,count);assert.equal(targets[0].rowSha256,hash(f.raw.contentRows[prefix+'sdk_sessions'][0]));
  assert.ok(Buffer.byteLength(JSON.stringify(inventory))<16384);assert.equal(JSON.stringify(inventory).includes('synthetic retained SDK entry'),false);
  assert.equal(decoded.inventorySha256,decodeConversationInventoryRows(f.raw).inventorySha256);
  assert.ok(f.reader.calls.filter(c=>c.sql.includes('sdk_session_entries r')).length<210,'bounded batches, not one query per row');
 }finally{f.close();}
});
test('more than 16 MiB of valid SDK content is validated without entering the ordinary raw inventory budget',async()=>{
 const f=await sdkRetentionFixture({count:17,text:'x'.repeat(1024*1024)});try{const d=await source(f);assert.ok(d.contentRows.find(t=>t.sdk).sdk.entryBytes>16*1024*1024);assert.ok(JSON.stringify(d).length<16384);}finally{f.close();}
});
test('SDK commitment changes for a late row and full preflight refuses the original target',async()=>{
 const f=await sdkRetentionFixture({count:1001,substream:true});try{const [target]=(await scanSdkRetentionInventory(f.reader,{subject})).targets;await verifySdkRetentionTarget(f.reader,{subject,target,lock:true});
  assert.ok(f.reader.calls.some(c=>c.sql.includes('sdk_sessions r')&&c.sql.endsWith('FOR UPDATE OF r')));
  assert.ok(f.reader.calls.some(c=>c.sql.includes('sdk_session_streams r')&&c.sql.endsWith('FOR UPDATE OF r')));
  const row=f.raw.contentRows[prefix+'sdk_session_entries'].at(-1);row.entry.message.content='changed';row.entry_sha256=hash(row.entry);
  f.raw.contentRows[prefix+'sdk_sessions'][0].bytes=f.raw.contentRows[prefix+'sdk_session_entries'].reduce((n,r)=>n+Buffer.byteLength(JSON.stringify(r.entry)),0);
  await assert.rejects(verifySdkRetentionTarget(f.reader,{subject,target}),/STORE_CORRUPT/);
 }finally{f.close();}
});
test('purge traversal emits exact targets in FK order and verifies its final commitment after callbacks',async()=>{
 const f=await sdkRetentionFixture({count:1001,substream:true});try{const [target]=(await scanSdkRetentionInventory(f.reader,{subject})).targets,order=[];let count=0;
  await verifySdkRetentionTarget(f.reader,{subject,target,lock:true});await forEachSdkRetentionTargetPage(f.reader,{subject,target},async page=>{
   assert.ok(page.length<=SDK_RETENTION_PAGE_ROWS);order.push(page[0].table);count+=page.length;
   for(const t of page){const rows=f.raw.contentRows[t.table],at=rows.findIndex(r=>Object.entries(t.key).every(([k,v])=>String(r[k])===String(v)));assert.ok(at>=0);assert.equal(hash(rows[at]),t.rowSha256);rows.splice(at,1);}
  });
  assert.equal(count,1004);assert.equal(order.at(-1),prefix+'sdk_sessions');assert.equal(order.at(-2),prefix+'sdk_session_streams');
  assert.equal(await sdkRetentionTargetPresent(f.reader,{subject:{tenantId:subject.tenantId,kind:'conversation',subjectId:subject.subjectId},target}),false);
  f.raw.contentRows[prefix+'sdk_session_batches'].push({tenant_id:subject.tenantId,conversation_id:subject.subjectId,run_id:target.key.run_id,session_id:target.key.session_id,append_id:id(2)});
  assert.equal(await sdkRetentionTargetPresent(f.reader,{subject,target}),true,'orphan batch remains present');
 }finally{f.close();}
});
for(const [name,mutate] of Object.entries({
 'late gap':r=>r[prefix+'sdk_session_entries'].at(-1).sequence++,
 'late digest':r=>r[prefix+'sdk_session_entries'].at(-1).entry_sha256='f'.repeat(64),
 'late duplicate UUID':r=>{const a=r[prefix+'sdk_session_entries'],x=a.at(-1);x.entry.uuid=x.entry_uuid=a[0].entry_uuid;x.entry_sha256=hash(x.entry);},
 'orphan entry':r=>r[prefix+'sdk_session_streams']=[],
 'orphan stream':r=>r[prefix+'sdk_sessions']=[],
 'foreign owner':r=>{const h=r[prefix+'sdk_sessions'][0];h.owner.binding.actorId='other';h.owner_sha256=hash(h.owner);},
}))test(`whole streamed inventory refuses ${name}`,async()=>{const f=await sdkRetentionFixture({count:1001});try{mutate(f.raw.contentRows);await assert.rejects(source(f),/STORE_CORRUPT/);}finally{f.close();}});
test('closed SDK summary cannot be forged into the decoder or widen a target',async()=>{const f=await sdkRetentionFixture();try{
 const scan=await scanSdkRetentionInventory(f.reader,{subject}),target=scan.targets[0];assertSdkRetentionTarget(target);
 for(const change of [t=>t.sdk.counts.sessions=2,t=>t.key.extra='unsafe',t=>t.sdk.rowsSha256='wrong']){const wrong=structuredClone(target);change(wrong);assert.throws(()=>assertSdkRetentionTarget(wrong));}
 const raw={...f.raw,contentRows:{...f.raw.contentRows},sdkInventory:structuredClone(scan)};for(const t of Object.keys(raw.contentRows).filter(k=>k.includes('.sdk_')))raw.contentRows[t]=[];
 assert.throws(()=>decodeConversationInventoryRows(raw),/STORE_CORRUPT/);
 }finally{f.close();}});

test('oversized stored SDK row is refused from metadata before its body is loaded',async()=>{
 const f=await sdkRetentionFixture({count:1});try{let loaded=false;const reader={async query(sql,args){
  if(sql.startsWith('SELECT r.* FROM '+prefix+'sdk_session_entries'))loaded=true;
  const result=await f.reader.query(sql,args);
  if(sql.includes('AS retention_row_bytes FROM '+prefix+'sdk_session_entries'))return {rows:result.rows.map(r=>({...r,retention_row_bytes:String(SDK_RETENTION_PAGE_BYTES+1)}))};
  return result;
 }};
 await assert.rejects(scanSdkRetentionInventory(reader,{subject}),/STORE_CORRUPT/);assert.equal(loaded,false);
 }finally{f.close();}
});

test('SDK traversal checks cancellation after an awaited page before emitting any complete target',async()=>{
 const f=await sdkRetentionFixture({count:1001});try{let cancelled=false;const reader={async query(sql,args){
  const result=await f.reader.query(sql,args);if(sql.startsWith('SELECT r.* FROM '+prefix+'sdk_session_entries'))cancelled=true;return result;
 }};
 await assert.rejects(scanSdkRetentionInventory(reader,{subject,check:()=>{if(cancelled)throw Error('synthetic cancellation');}}),/synthetic cancellation/);
 assert.equal(f.reader.calls.filter(c=>c.sql.startsWith('SELECT r.* FROM '+prefix+'sdk_session_entries')).length,1);
 }finally{f.close();}
});
