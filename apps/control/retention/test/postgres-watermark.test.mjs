/** The PostgreSQL recovered-watermark adapter over an injected pg-compatible pool: its statements run through the retention journal's
 * bounded transaction owner, so a lost COMMIT acknowledgement is RETENTION_COMMIT_UNKNOWN and retires the lease, a failed statement
 * rolls back and returns a clean lease, and a stale or corrupt row is refused. Through the startup owner, an advance whose commit is
 * unknown closes the serving fence. Synthetic pool against the PROPOSED table (no migration allocated): not a real-driver,
 * network or PostgreSQL test. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../postgres-watermark.mjs';
import {watermarkedJournal} from '../recovery-watermark.mjs';
import {createServingFence} from '../serving-fence.mjs';
/** One-row table emulation; `faults` maps a statement prefix to 'throw'. Every lease records its releases. */
function syntheticPool({faults={}}={}){
 let row=null;const made=[],idle=[];
 const answer=(sql,values)=>{const k=Object.keys(faults).find(prefix=>sql.startsWith(prefix));if(k&&faults[k]==='throw')throw Object.assign(new Error('synthetic '+k),{code:'08006'});if(k&&faults[k]!=null)return faults[k];
  if(sql.startsWith('SELECT sequence'))return {rows:row?[{...row}]:[],rowCount:row?1:0};
  if(sql.startsWith('INSERT INTO meri_conversations.retention_recovery_watermark')){const exact=sql.includes('entry_sha256=EXCLUDED.entry_sha256');const [sequence,entry]=values;
   if(exact||!row)row={sequence:String(sequence),entry_sha256:exact?entry??null:null};else if(sequence>Number(row.sequence))row={sequence:String(sequence),entry_sha256:null};return {rows:[{...row}],rowCount:1};}
  return {rows:[],rowCount:0};};
 const client=()=>{const c={queries:[],releases:[],async query(sql,values){c.queries.push(sql.split(' ')[0]);return answer(sql,values);},release(error){c.releases.push(error);if(!error)idle.push(c);}};made.push(c);return c;};
 return {made,set row(v){row=v;},get row(){return row;},async connect(){return idle.pop()??client();}};
}
const compose=options=>{const pool=syntheticPool(options),journal=createPostgresRetentionJournal({pool,maxRequestMs:200});return {pool,journal,store:createPostgresWatermarkStore({journal})};};

test('read, monotonic advance and exact record round-trip through bounded transactions that return clean leases',async()=>{
 const {pool,store}=compose();assert.deepEqual(await store.read(),{sequence:0,entrySha256:null},'no row reads as position zero');
 assert.deepEqual(await store.advance(3),{sequence:3,entrySha256:null});assert.deepEqual(await store.advance(2),{sequence:3,entrySha256:null},'an advance never moves backwards');
 const head={sequence:5,entrySha256:'e'.repeat(64)};assert.deepEqual(await store.record(head,{exclusive:true}),head);assert.deepEqual(await store.read({exclusive:true}),head);
 assert.ok(pool.made.every(c=>c.releases.every(e=>e===undefined)),'every committed lease was returned for reuse');
 const shared=pool.made[0].queries;assert.ok(shared.includes('BEGIN')&&shared.includes('COMMIT'));
 await assert.rejects(store.advance(-1),/RETENTION_INVALID_REQUEST/);await assert.rejects(store.record({sequence:1,entrySha256:'bad'}),/RETENTION_INVALID_REQUEST/);
 pool.row={sequence:'x',entry_sha256:null};await assert.rejects(store.read(),/RETENTION_STORE_CORRUPT/);
 assert.throws(()=>createPostgresWatermarkStore({journal:{}}),/RETENTION_CONFIGURATION/);
});

test('lease faults: a lost COMMIT acknowledgement is unknown and retires the lease; a failed statement rolls back and returns it clean',async()=>{
 const lost=compose({faults:{COMMIT:'throw'}});await assert.rejects(lost.store.advance(4),e=>e.code==='RETENTION_COMMIT_UNKNOWN');
 const first=lost.pool.made[0];assert.ok(!first.queries.includes('ROLLBACK'),'no ROLLBACK over an unknown commit');assert.equal(first.releases.length,1);assert.ok(first.releases[0] instanceof Error,'retired with an error');
 const failed=compose({faults:{'INSERT INTO':'throw'}});await assert.rejects(failed.store.advance(4),e=>e.code==='RETENTION_STORE_UNAVAILABLE');
 const c=failed.pool.made[0];assert.ok(c.queries.includes('ROLLBACK'));assert.deepEqual(c.releases,[undefined],'a confirmed ROLLBACK returns the lease');
});

test('through the watermarked journal, an advance whose commit is unknown leaves the projection standing and closes the serving fence',async()=>{
 const faults={}, {store}=compose({faults}),fence=createServingFence();fence.enable({watermark:{sequence:0,entrySha256:null}});
 const writes=[];const inner={async get(){return null;},async set(key,row){writes.push(key);return row;},async keys(){return [];},async exclusive(fn){return fn();}};
 const tracked=watermarkedJournal({journal:inner,watermark:store,fence});const key=`tenant-a:conversation:${randomUUID()}`;
 const set=inner.set;inner.set=async(...args)=>{const result=await set(...args);faults.COMMIT='throw';return result;};
 await tracked.set(key,{state:'SUPPRESSED',ledgerSequence:1,entrySha256:'1'.repeat(64)});
 assert.deepEqual(writes,[key]);assert.equal(fence.isEnabled(),false);assert.equal(fence.state().reason,'RETENTION_WATERMARK_UNKNOWN');assert.equal(fence.state().highWater,0,'an unacknowledged advance is not observed');
});

test('synthetic SQL: a guarded advance refuses a restored row in the same locked transaction',async()=>{
 const {pool,store}=compose();await store.advance(3);pool.row={sequence:'0',entry_sha256:null};
 await assert.rejects(store.advance(4,{minimumSequence:3}),/RETENTION_WATERMARK_STALE/);
 assert.equal(pool.row.sequence,'0');const queries=pool.made.flatMap(c=>c.queries);
 assert.ok(queries.includes('ROLLBACK'));assert.ok(pool.made.every(c=>c.releases.every(e=>e===undefined)));
});
