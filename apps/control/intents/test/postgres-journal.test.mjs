/** SYNTHETIC: canonical journal + real PostgreSQL adapter over a serialized SQL double. No DB/driver/DDL. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createPostgresIntentJournalStore} from '../postgres-journal.mjs';
import {createIntentJournal} from '../journal.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const record={operation:{id:'create_word',version:'0.2.0'},argumentsSha256:'a'.repeat(64)},deliveryId='sdk:'+'b'.repeat(64);
const key={binding,record,deliveryId},outcome={result:{status:'draft'},release:{binding,scopes:[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'p1'}],expiresAtMs:1900000001000}};
function fixture(){
 const state={rows:new Map(),commands:[],releases:[],loseCommit:false};let tail=Promise.resolve();
 const pool={async connect(){let local,unlock;return {async query(sql,p=[]){
  state.commands.push({sql,p});const rows=x=>({rows:structuredClone(x),rowCount:x.length});
  if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='COMMIT'){state.rows=local;if(state.loseCommit){state.loseCommit=false;throw Error('synthetic lost COMMIT ACK');}return rows([]);}
  if(sql==='ROLLBACK')return rows([]);
  assert.ok(sql.includes('meri_intents.preparations'));assert.equal(sql.includes('public.'),false);
  if(!local){const prior=tail;tail=new Promise(r=>unlock=r);await prior;local=structuredClone(state.rows);}
  const k=JSON.stringify(p.slice(0,4));
  if(sql.startsWith('INSERT')){if(local.has(k))return rows([]);const row={delivery_id:p[3],created_at:new Date(Date.UTC(2026,9,17,0,0,local.size)),record:JSON.parse(p[4]),record_sha256:p[5],state:'PENDING',outcome:null};local.set(k,row);return rows([row]);}
  if(sql.startsWith('SELECT delivery_id,created_at')){ // conversation list, creation order, keyset after an existing delivery
   assert.match(sql,/ORDER BY created_at,delivery_id LIMIT \d+$/u);const limit=Number(/LIMIT (\d+)$/u.exec(sql)[1]);
   const mine=[...local.entries()].filter(([key])=>JSON.stringify(JSON.parse(key).slice(0,3))===JSON.stringify(p.slice(0,3))).map(([,row])=>row).sort((a,b)=>a.created_at-b.created_at||a.delivery_id.localeCompare(b.delivery_id));
   const start=p.length===4?mine.findIndex(r=>r.delivery_id===p[3])+1:0;return rows(mine.slice(start,start+limit));}
  if(sql.startsWith('SELECT delivery_id FROM'))return rows(local.has(k)?[{delivery_id:p[3]}]:[]);
  if(sql.startsWith('SELECT'))return rows(local.has(k)?[local.get(k)]:[]);
  if(sql.startsWith('UPDATE')){const row=local.get(k);if(!row||row.state!=='PENDING'||row.record_sha256!==p[4])return rows([]);row.state=p[5];row.outcome=p[6]===null?null:JSON.parse(p[6]);return rows([row]);}
  assert.fail('Unexpected SQL');
 },release(error){state.releases.push(error);unlock?.();}};}};
 const store=createPostgresIntentJournalStore({pool});return {state,store,journal:createIntentJournal(store)};
}
test('canonical claim, PREPARED custody and same-conversation replay use only the reserved namespaced table',async()=>{
 const f=fixture();assert.deepEqual(await f.journal.begin(key),{claimed:true});await f.journal.settle({...key,state:'PREPARED',outcome});
 const retained=await f.journal.begin({...key,binding:{...binding,runId:id(9),attemptId:id(10),writerFence:2}});
 assert.equal(retained.replayed,true);assert.deepEqual(retained.result,outcome.result);assert.deepEqual(retained.release,outcome.release);
 assert.equal(f.state.rows.size,1);await assert.rejects(f.journal.begin({...key,record:{...record,argumentsSha256:'c'.repeat(64)}}),e=>e.code==='CONFLICT');
 assert.equal(f.state.commands.filter(c=>c.sql.startsWith('UPDATE')).length,1);
});
test('claim COMMIT loss leaves PENDING and replay UNKNOWN; no replacement claim or inferred absence',async()=>{
 const f=fixture();f.state.loseCommit=true;await assert.rejects(f.journal.begin(key),e=>e.code==='UNAVAILABLE');
 await assert.rejects(f.journal.begin(key),e=>e.code==='UNKNOWN');assert.equal(f.state.rows.size,1);assert.equal([...f.state.rows.values()][0].state,'PENDING');
 assert.ok(f.state.releases[0]);assert.equal(f.state.commands.some(c=>c.sql==='ROLLBACK'),false);
});
test('settlement COMMIT loss retains exact PREPARED outcome, recovered by canonical claim without second settlement',async()=>{
 const f=fixture();await f.journal.begin(key);f.state.loseCommit=true;await assert.rejects(f.journal.settle({...key,state:'PREPARED',outcome}),e=>e.code==='UNKNOWN');
 assert.deepEqual((await f.journal.begin(key)).result,outcome.result);assert.equal(f.state.commands.filter(c=>c.sql.startsWith('UPDATE')).length,1);
});
test('UNKNOWN settlement uses SQL NULL and never becomes dispatchable',async()=>{
 const f=fixture();await f.journal.begin(key);await f.journal.settle({...key,state:'UNKNOWN',outcome:null});
 assert.equal(f.state.commands.find(c=>c.sql.startsWith('UPDATE')).p[6],null);await assert.rejects(f.journal.begin(key),e=>e.code==='UNKNOWN');
});
test('tenant, actor and conversation remain independent claim keys; cancelled requests do not acquire a client',async()=>{
 const f=fixture();for(const b of [binding,{...binding,tenantId:'other'},{...binding,actorId:'other'},{...binding,conversationId:id(99)}])await f.journal.begin({...key,binding:b});
 assert.equal(f.state.rows.size,4);const count=f.state.commands.length,ac=new AbortController();ac.abort();
 await assert.rejects(f.journal.begin({...key,deliveryId:'sdk:'+'c'.repeat(64),signal:ac.signal}));assert.equal(f.state.commands.length,count);
});
test('scripted concurrent claims retain one row and grant preparation to only one caller',async()=>{
 const f=fixture(),out=await Promise.allSettled([f.journal.begin(key),f.journal.begin(key)]);
 assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.equal(out.find(r=>r.status==='rejected').reason.code,'UNKNOWN');assert.equal(f.state.rows.size,1);
});
test('malformed custody hash and terminal rewrites fail closed',async()=>{
 const f=fixture();await f.journal.begin(key);const row=[...f.state.rows.values()][0];row.record_sha256='f'.repeat(64);
 await assert.rejects(f.journal.begin(key),e=>e.code==='UNAVAILABLE','canonical begin withholds an unreadable claim before any preparer is called');row.record_sha256=hash(record);
 await f.journal.settle({...key,state:'FAILED',outcome:{code:'REFUSED'}});await assert.rejects(f.journal.begin(key),e=>e.code==='REFUSED');
 await assert.rejects(f.journal.settle({...key,state:'PREPARED',outcome}),e=>e.code==='UNKNOWN');assert.equal([...f.state.rows.values()][0].state,'FAILED');
});
test('new PREPARED settlement requires indivisible release custody before acquiring a SQL client',async()=>{
 const f=fixture();await f.journal.begin(key);const before=f.state.commands.length;
 await assert.rejects(f.store.settle({key:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId},record,state:'PREPARED',outcome:{result:outcome.result}}));
 assert.equal(f.state.commands.length,before);assert.equal([...f.state.rows.values()][0].state,'PENDING');
});
test('read answers one delivery or null under the full conversation key, without claiming',async()=>{
 const f=fixture(),k={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId};
 assert.equal(await f.store.read({key:k}),null);await f.journal.begin(key);await f.journal.settle({...key,state:'PREPARED',outcome});
 const got=await f.store.read({key:k});assert.equal(got.state,'PREPARED');assert.deepEqual(got.outcome,outcome);
 assert.equal(await f.store.read({key:{...k,actorId:'other'}}),null);assert.equal(await f.store.read({key:{...k,tenantId:'other'}}),null);
 assert.equal(f.state.commands.some(c=>c.sql.startsWith('INSERT')&&c.p[1]==='other'),false,'reading never claims');
 await assert.rejects(f.store.read({key:{...k,deliveryId:'not-a-delivery'}}));
});
test('list pages one conversation in creation order with a keyset cursor; other conversations and malformed cursors are refused',async()=>{
 const f=fixture(),d=n=>'sdk:'+String(n).repeat(64);
 for(const n of [1,2,3])await f.journal.begin({...key,deliveryId:d(n)});
 await f.journal.begin({...key,binding:{...binding,conversationId:id(99)},deliveryId:d(4)});await f.journal.begin({...key,binding:{...binding,actorId:'other'},deliveryId:d(5)});
 const conversation={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId};
 const first=await f.store.list({conversation,limit:2});assert.deepEqual(first.entries.map(e=>e.deliveryId),[d(1),d(2)]);assert.equal(first.next,d(2));
 assert.equal(first.entries[0].state,'PENDING');assert.match(first.entries[0].createdAt,/Z$/u);
 const second=await f.store.list({conversation,after:first.next,limit:2});assert.deepEqual(second.entries.map(e=>e.deliveryId),[d(3)]);assert.equal(second.next,null);
 await assert.rejects(f.store.list({conversation,after:d(4),limit:2}),'a cursor from another conversation is refused');
 await assert.rejects(f.store.list({conversation,limit:51}));await assert.rejects(f.store.list({conversation:{...conversation,conversationId:'x'},limit:1}));
});
