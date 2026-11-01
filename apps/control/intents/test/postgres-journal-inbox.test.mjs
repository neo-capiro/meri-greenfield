/** SYNTHETIC: the actor-wide inbox reads of the real PostgreSQL adapter over a serialized SQL double seeded with prepared rows.
 * No DB/driver/DDL. It proves the statements' scope (tenant, actor, sdk family, PREPARED, inbox operations), the cursor refusal,
 * the newest-first order and the window count, not PostgreSQL planning or the 0005 index. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createPostgresIntentJournalStore} from '../postgres-journal.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sdk=n=>'sdk:'+String(n).padStart(64,'0');
const binding=(conversationId,actorId='actor',tenantId='tenant')=>({tenantId,actorId,conversationId,runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1});
const OPERATIONS=['create_task','watch_action'];
/** One PREPARED row of the shape `entry()` admits, created at `at` (ms since a fixed epoch), expiring at `expiresAtMs`. */
function row({tenantId='tenant',actorId='actor',conversationId,n,operation='create_task',state='PREPARED',at,expiresAtMs=1900000001000}){
 const record={operation:{id:operation,version:'0.2.0'},argumentsSha256:'a'.repeat(64)},b=binding(conversationId,actorId,tenantId);
 const outcome=state==='PREPARED'?{result:{status:'prepared'},release:{binding:b,scopes:[{tenantId,kind:'client',resourceId:id(5),policyRevision:'p1'}],expiresAtMs}}:null;
 return {key:[tenantId,actorId,conversationId,sdk(n)],row:{conversation_id:conversationId,delivery_id:sdk(n),created_at:new Date(Date.UTC(2026,10,1,0,0,0)+at*1000),record,record_sha256:hash(record),state,outcome}};
}
function fixture(seed){
 const rows=new Map(seed.map(({key,row})=>[JSON.stringify(key),row])),commands=[];
 const pool={async connect(){return {async query(sql,p=[]){
  commands.push({sql,p});const answer=x=>({rows:structuredClone(x),rowCount:x.length});
  if(sql==='BEGIN'||sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'||sql.startsWith('SET LOCAL')||sql==='COMMIT'||sql==='ROLLBACK')return answer([]);
  assert.ok(sql.includes('meri_intents.preparations'));
  const actorRows=[...rows].map(([k,r])=>[JSON.parse(k),r]).filter(([[t,a,,d]])=>t===p[0]&&a===p[1]&&d.startsWith('sdk:'));
  if(sql.startsWith('SELECT delivery_id FROM'))return answer(rows.has(JSON.stringify(p.slice(0,4)))?[{delivery_id:p[3]}]:[]);
  if(sql.startsWith('SELECT conversation_id,count(*)::int AS n')){
   const [,,ops,nowMs]=p;assert.match(sql,/state='PREPARED'/u);assert.match(sql,/delivery_id LIKE 'sdk:%'/u);assert.match(sql,/GROUP BY conversation_id$/u);
   const open=new Map();for(const [,r] of actorRows)if(r.state==='PREPARED'&&ops.includes(r.record.operation.id)&&r.outcome.release.expiresAtMs>nowMs)open.set(r.conversation_id,(open.get(r.conversation_id)??0)+1);
   return answer([...open].map(([conversation_id,n])=>({conversation_id,n})));
  }
  if(sql.startsWith('SELECT conversation_id,delivery_id,created_at,')){
   assert.match(sql,/ORDER BY created_at DESC,conversation_id DESC,delivery_id DESC LIMIT \d+$/u);assert.match(sql,/state='PREPARED' AND record->'operation'->>'id' = ANY\(\$\d::text\[\]\)/u);
   const limit=Number(/LIMIT (\d+)$/u.exec(sql)[1]),ops=p.at(-1),cursor=p.length===5?rows.get(JSON.stringify(p.slice(0,4))):null;
   const sorted=actorRows.map(([,r])=>r).filter(r=>r.state==='PREPARED'&&ops.includes(r.record.operation.id)).sort((x,y)=>y.created_at-x.created_at||y.conversation_id.localeCompare(x.conversation_id)||y.delivery_id.localeCompare(x.delivery_id));
   const after=cursor===null?sorted:sorted.filter(r=>r.created_at<cursor.created_at||r.created_at.getTime()===cursor.created_at.getTime()&&(r.conversation_id<cursor.conversation_id||r.conversation_id===cursor.conversation_id&&r.delivery_id<cursor.delivery_id));
   return answer(after.slice(0,limit));
  }
  assert.fail('Unexpected SQL: '+sql.slice(0,80));
 },release(){}};}};
 return {store:createPostgresIntentJournalStore({pool}),commands};
}
const actor={tenantId:'tenant',actorId:'actor'};

test('listForActor reads only this tenant and actor, only PREPARED rows of the inbox operations, newest first across conversations',async()=>{
 const f=fixture([
  row({conversationId:id(11),n:1,at:1}),row({conversationId:id(12),n:2,at:2,operation:'watch_action'}),row({conversationId:id(11),n:3,at:3,state:'PENDING'}),
  row({conversationId:id(11),n:4,at:4,operation:'save_note'}),row({conversationId:id(13),n:5,at:5}),
  row({conversationId:id(21),n:6,at:6,actorId:'someone-else'}),row({conversationId:id(31),n:7,at:7,tenantId:'other-tenant'}),
 ]);
 const page=await f.store.listForActor({actor,limit:50,operations:OPERATIONS});
 assert.deepEqual(page.entries.map(e=>[e.conversationId,e.deliveryId,e.record.operation.id]),[[id(13),sdk(5),'create_task'],[id(12),sdk(2),'watch_action'],[id(11),sdk(1),'create_task']]);
 assert.equal(page.next,null);assert.equal(page.entries[0].createdAt,'2026-11-01T00:00:05.000Z');assert.equal(page.entries[0].state,'PREPARED');
 const select=f.commands.find(c=>c.sql.startsWith('SELECT conversation_id'));assert.deepEqual(select.p,['tenant','actor',OPERATIONS],'tenant, actor and the operation list are bound parameters');
 assert.match(select.sql,/tenant_id=\$1 AND actor_id=\$2 AND delivery_id LIKE 'sdk:%'/u);
});
test('the cursor pages newest first by (created_at, conversation, delivery); a forged or foreign cursor is refused (INTENT_JOURNAL_CURSOR inside the store, UNKNOWN at the journal boundary, like the per-conversation list)',async()=>{
 const f=fixture([row({conversationId:id(11),n:1,at:1}),row({conversationId:id(12),n:2,at:2}),row({conversationId:id(13),n:3,at:3}),row({conversationId:id(21),n:9,at:9,actorId:'someone-else'})]);
 const first=await f.store.listForActor({actor,limit:2,operations:OPERATIONS});
 assert.deepEqual(first.entries.map(e=>e.deliveryId),[sdk(3),sdk(2)]);assert.deepEqual(first.next,{conversationId:id(12),deliveryId:sdk(2)});
 const second=await f.store.listForActor({actor,limit:2,operations:OPERATIONS,after:first.next});
 assert.deepEqual(second.entries.map(e=>e.deliveryId),[sdk(1)]);assert.equal(second.next,null);
 for(const after of [{conversationId:id(12),deliveryId:sdk(8)},{conversationId:id(21),deliveryId:sdk(9)}])
  await assert.rejects(f.store.listForActor({actor,limit:2,operations:OPERATIONS,after}),e=>e.code==='UNKNOWN',JSON.stringify(after));
 const cursorChecks=f.commands.filter(c=>c.sql.startsWith('SELECT delivery_id FROM'));assert.equal(cursorChecks.length,3,'every cursor is looked up under the actor before any page read');assert.equal(f.commands.filter(c=>c.sql.startsWith('SELECT conversation_id')).length,2,'a refused cursor reads no page');
 await assert.rejects(f.store.listForActor({actor,limit:2,operations:OPERATIONS,after:{conversationId:id(12),deliveryId:'browser:'+'0'.repeat(63)+'2'}}),e=>e.code==='UNKNOWN');
 await assert.rejects(f.store.listForActor({actor,limit:0,operations:OPERATIONS}),e=>e.message==='INTENT_JOURNAL_STATE');
 await assert.rejects(f.store.listForActor({actor,limit:2,operations:[]}),e=>e.message==='INTENT_JOURNAL_STATE');
 await assert.rejects(f.store.listForActor({actor,limit:2,operations:['DROP TABLE']}),e=>e.message==='INTENT_JOURNAL_STATE');
});
test('countForActor counts prepared inbox rows still inside their window for this actor only, per conversation, in one read-only statement',async()=>{
 const f=fixture([
  row({conversationId:id(11),n:1,at:1,expiresAtMs:2000}),row({conversationId:id(12),n:2,at:2,expiresAtMs:999}),row({conversationId:id(13),n:3,at:3,operation:'save_note',expiresAtMs:2000}),
  row({conversationId:id(14),n:4,at:4,state:'PENDING'}),row({conversationId:id(21),n:5,at:5,actorId:'someone-else',expiresAtMs:2000}),row({conversationId:id(11),n:6,at:6,expiresAtMs:2000}),
 ]);
 assert.deepEqual(await f.store.countForActor({actor,operations:OPERATIONS,nowMs:1000}),[{conversationId:id(11),open:2}]);
 const count=f.commands.find(c=>c.sql.startsWith('SELECT conversation_id,count'));assert.deepEqual(count.p,['tenant','actor',OPERATIONS,1000]);
 assert.ok(f.commands.some(c=>c.sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'),'the count is a read-only transaction');
 await assert.rejects(f.store.countForActor({actor,operations:OPERATIONS,nowMs:0}),e=>e.message==='INTENT_JOURNAL_STATE');
});
