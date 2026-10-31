/** Durable browser-download capacity through the REAL intent-journal adapter over a serialized SQL double. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresIntentJournalStore} from '../postgres-journal.mjs';
import {createBrowserDownloadReservations} from '../browser-download-reservations.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const sha=(n)=>hash(`bytes-${n}`);
function fixture(){
 const state={rows:new Map(),commands:[]};let tail=Promise.resolve();
 const pool={async connect(){let local,unlock;
  return {async query(sql,p=[]){state.commands.push({sql,p});
   const out=x=>({rows:structuredClone(x),rowCount:x.length});
   if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return out([]);
   if(sql==='COMMIT'){state.rows=local;return out([]);}
   if(sql==='ROLLBACK')return out([]);
   if(!sql.startsWith('SELECT pg_advisory_xact_lock'))assert.ok(sql.includes('meri_intents.preparations'),'one canonical table');
   if(!local){const prior=tail;tail=new Promise(r=>unlock=r);await prior;local=structuredClone(state.rows);}
   if(sql.startsWith('SELECT pg_advisory_xact_lock'))return out([]);
   if(sql.includes("run_id IS NULL"))return out([{n:state.orphans??0}]);
   if(sql.includes('count(*)::int')){const n=[...local.values()].filter(r=>r.tenant===p[0]&&r.actor===p[1]&&r.conv===p[2]&&r.run_id===p[3]&&r.record.operation.id==='browser_download'&&r.state!=='FAILED').length;return out([{n}]);}
   if(sql.startsWith('INSERT')){const key=JSON.stringify(p.slice(0,4));if(local.has(key))return out([]);
    const row={tenant:p[0],actor:p[1],conv:p[2],delivery_id:p[3],record:typeof p[4]==='string'?JSON.parse(p[4]):p[4],record_sha256:p[5],state:'PENDING',outcome:null,settled_at:null,run_id:p[6],created_at:new Date()};local.set(key,row);return out([row]);}
   const key=JSON.stringify(p.slice(0,4));
   if(sql.startsWith('SELECT'))return out(local.has(key)?[local.get(key)]:[]);
   if(sql.startsWith('UPDATE')){const row=local.get(key);if(!row||row.state!=='PENDING'||row.record_sha256!==p[4])return out([]);
    row.state=p[5];row.outcome=p[6]===null?null:(typeof p[6]==='string'?JSON.parse(p[6]):p[6]);row.settled_at=new Date();return out([row]);}
   assert.fail('Unexpected SQL '+sql);
  },release(){unlock?.();}};}};
 const store=()=>createPostgresIntentJournalStore({pool});
 return {state,store,owner:()=>createBrowserDownloadReservations({store:store()})};
}
const release={binding,scopes:[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'p1'}],expiresAtMs:1900000000000};
test('two fresh workers racing for the LAST slot produce one admitted attempt',async()=>{
 const f=fixture(),out=await Promise.allSettled([
  f.owner().begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1}),
  f.owner().begin({binding,filename:'b.txt',sha256:sha(2),maxFiles:1})]);
 const values=out.map(r=>r.status==='fulfilled'?r.value:{error:r.reason});
 assert.equal(values.filter(v=>v.admitted===true).length,1);
 assert.equal(values.filter(v=>v.limit===true).length,1);
 assert.equal(f.state.rows.size,1);
});
test('a recreated reservations owner cannot reset the cap',async()=>{
 const f=fixture();
 let first;first=await f.owner().begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 assert.equal(first.admitted,true);
 assert.equal((await f.owner().begin({binding,filename:'b.txt',sha256:sha(2),maxFiles:1})).limit,true);
 assert.equal(f.state.rows.size,1);
});
test('another run or actor does not consume this run capacity',async()=>{
 const f=fixture();
 await f.owner().begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 assert.equal((await f.owner().begin({binding:{...binding,runId:id(9)},filename:'b.txt',sha256:sha(2),maxFiles:1})).admitted,true);
 assert.equal((await f.owner().begin({binding:{...binding,actorId:'other'},filename:'c.txt',sha256:sha(3),maxFiles:1})).admitted,true);
});
test('changed bytes under the SAME original delivery conflict instead of overwriting',async()=>{
 const f=fixture();await f.owner().begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:2});
 await assert.rejects(()=>f.owner().begin({binding,filename:'a.txt',sha256:sha(2),maxFiles:2}),e=>e.code==='CONFLICT');
 assert.equal(f.state.rows.size,1);
});
test('a changed worker/fence on the SAME run reuses the SAME slot (stable original identity)'
 ,async()=>{
 const f=fixture(),o=f.owner();
 await o.begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 const moved=await o.begin({binding:{...binding,attemptId:id(8),workerId:id(9),writerFence:5},filename:'a.txt',sha256:sha(1),maxFiles:1});
 assert.equal(moved.admitted,true);assert.equal(moved.replayed,true);
});
test('at the cap, the SAME accepted delivery still reads its durable reservation',async()=>{
 const f=fixture();const o=f.owner();
 await o.begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 const again=await o.begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 assert.equal(again.admitted,true);assert.equal(again.replayed,true);assert.equal(again.state,'PENDING');
});
test('a proven pre-effect refusal releases only its own slot for another filename',async()=>{
 const f=fixture(),o=f.owner();
 await o.begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 await o.refused({binding,filename:'a.txt',sha256:sha(1),code:'REFUSED'});
 const next=await o.begin({binding,filename:'b.txt',sha256:sha(2),maxFiles:1});
 assert.equal(next.admitted,true);
});
test('a lost claim acknowledgement retains capacity and replay is idempotent',async()=>{
 const f=fixture(),o=f.owner();
 const first=await o.begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 assert.equal(first.admitted,true);
 assert.equal((await f.owner().begin({binding,filename:'b.txt',sha256:sha(2),maxFiles:1})).limit,true);
 const replay=await f.owner().begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 assert.equal(replay.replayed,true);
 const row=f.state.rows.values().next().value;
 assert.equal(row.state,'PENDING');assert.equal(row.run_id,binding.runId);
});
test('PREPARED keeps the slot; the recorded release is the same run/binding',async()=>{
 const f=fixture(),o=f.owner();
 await o.begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 const prepared=await o.prepared({binding,filename:'a.txt',sha256:sha(1),result:{status:'prepared',sha256:sha(1)},release});
 assert.equal(prepared.state,'PREPARED');
 assert.equal((await f.owner().begin({binding,filename:'b.txt',sha256:sha(2),maxFiles:1})).limit,true);
 const same=await f.owner().begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:1});
 assert.equal(same.replayed,true);assert.equal(same.state,'PREPARED');
});
test('a historical NULL-run browser_download custody fails closed instead of freeing a slot',async()=>{
 const f=fixture();f.state.orphans=1;
 const r=await f.owner().begin({binding,filename:'a.txt',sha256:sha(1),maxFiles:5});
 assert.equal(r.admitted,false);assert.equal(r.limit,true);
 assert.equal(f.state.rows.size,0,'no new claim is inserted');
});
