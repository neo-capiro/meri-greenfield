/** The PostgreSQL recovered-watermark adapter over an injected pg-compatible pool: its statements run through the retention journal's
 * bounded transaction owner, so a lost COMMIT acknowledgement is RETENTION_COMMIT_UNKNOWN and retires the lease, a failed statement
 * rolls back and returns a clean lease, and a stale or corrupt row is refused. Through the startup owner, an advance whose commit is
 * unknown closes the serving fence. Synthetic pool against source-only reserved migration0013: not a real-driver,
 * network or PostgreSQL test. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../postgres-watermark.mjs';
import {watermarkedJournal} from '../recovery-watermark.mjs';
import {createMemoryRetentionJournal} from '../memory-journal.mjs';
import {createServingFence} from '../serving-fence.mjs';
import {createRetentionReadGate} from '../suppression.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {hash} from '../boundary.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../ledger.mjs';
/** One-row table emulation; `faults` maps a statement prefix to 'throw'. Every lease records its releases. */
function syntheticPool({faults={}}={}){
 let row=null;const made=[],idle=[],projections=new Map();
 const answer=(sql,values)=>{const k=Object.keys(faults).find(prefix=>sql.startsWith(prefix));if(k&&faults[k]==='throw')throw Object.assign(new Error('synthetic '+k),{code:'08006'});if(k&&typeof faults[k]==='function')return faults[k](sql,values);if(k&&faults[k]!=null)return faults[k];
  if(sql.startsWith('SELECT sequence'))return {rows:row?[{...row}]:[],rowCount:row?1:0};
  if(sql.startsWith('SELECT s.projection,')){const kind=sql.includes('meri_artifacts.retention_subjects')?'artifact':'conversation',p=projections.get(kind+JSON.stringify(values));
   return {rows:[{projection:null,projection_sha256:null,state:null,ledger_sequence:null,...p,watermark_sequence:row?.sequence??null,watermark_entry_sha256:row?.entry_sha256??null}],rowCount:1};}
  if(sql.startsWith('SELECT * FROM')&&sql.includes('.retention_subjects')){const kind=sql.includes('meri_artifacts')?'artifact':'conversation',p=projections.get(kind+JSON.stringify(values));return {rows:p?[p]:[]};}
  if(sql.startsWith('INSERT INTO meri_conversations.retention_recovery_watermark')){const exact=sql.includes('entry_sha256=EXCLUDED.entry_sha256');const [sequence,entry]=values;
   if(exact||!row)row={sequence:String(sequence),entry_sha256:exact?entry??null:null};else if(sequence>Number(row.sequence))row={sequence:String(sequence),entry_sha256:null};return {rows:[{...row}],rowCount:1};}
  return {rows:[],rowCount:0};};
 const client=()=>{const c={queries:[],statements:[],releases:[],async query(sql,values){c.queries.push(sql.split(' ')[0]);c.statements.push(sql);return answer(sql,values);},release(error){c.releases.push(error);if(!error)idle.push(c);}};made.push(c);return c;};
 const project=(key,value)=>{const parts=key.split(':'),kind=parts.at(-2),id=parts.at(-1),tenant=parts.slice(0,-2).join(':');projections.set(kind+JSON.stringify([tenant,id]),{state:value.state,ledger_sequence:String(value.ledgerSequence),projection:value,projection_sha256:hash(value)});};
 return {made,project,projections,set row(v){row=v;},get row(){return row;},async connect(){return idle.pop()??client();}};
}
const compose=options=>{const pool=syntheticPool(options),journal=createPostgresRetentionJournal({pool,maxRequestMs:options?.maxRequestMs??200});return {pool,journal,store:createPostgresWatermarkStore({journal})};};
const rowAt=sequence=>({state:'SUPPRESSED',ledgerSequence:sequence,entrySha256:'1'.repeat(64)});
const proofFor=(pool,sequence,minimumSequence=0)=>{const key=`tenant-a:conversation:${randomUUID()}`,row=rowAt(sequence);pool.project(key,row);return {key,sequence,minimumSequence,projectionSha256:hash(row)};};

test('read, monotonic advance and exact record round-trip through bounded transactions that return clean leases',async()=>{
 const {pool,store}=compose();assert.deepEqual(await store.read(),{sequence:0,entrySha256:null},'no row reads as position zero');
 assert.deepEqual(await store.advanceProjection(proofFor(pool,3)),{sequence:3,entrySha256:null});assert.deepEqual(await store.advanceProjection(proofFor(pool,2)),{sequence:3,entrySha256:null},'an advance never moves backwards');
 const head={sequence:5,entrySha256:'e'.repeat(64)};assert.deepEqual(await store.record(head,{exclusive:true}),head);assert.deepEqual(await store.read({exclusive:true}),head);
 assert.ok(pool.made.every(c=>c.releases.every(e=>e===undefined)),'every committed lease was returned for reuse');
 const shared=pool.made[0].queries;assert.ok(shared.includes('BEGIN')&&shared.includes('COMMIT'));
 await assert.rejects(store.advanceProjection({...proofFor(pool,1),sequence:-1}),/RETENTION_INVALID_REQUEST/);await assert.rejects(store.record({sequence:1,entrySha256:'bad'}),/RETENTION_INVALID_REQUEST/);
 pool.row={sequence:'x',entry_sha256:null};await assert.rejects(store.read(),/RETENTION_STORE_CORRUPT/);
 assert.throws(()=>createPostgresWatermarkStore({journal:{}}),/RETENTION_CONFIGURATION/);
});

test('lease faults: a lost COMMIT acknowledgement is unknown and retires the lease; a failed statement rolls back and returns it clean',async()=>{
 const lost=compose({faults:{COMMIT:'throw'}});await assert.rejects(lost.store.advanceProjection(proofFor(lost.pool,4)),e=>e.code==='RETENTION_COMMIT_UNKNOWN');
 const first=lost.pool.made[0];assert.ok(!first.queries.includes('ROLLBACK'),'no ROLLBACK over an unknown commit');assert.equal(first.releases.length,1);assert.ok(first.releases[0] instanceof Error,'retired with an error');
 const failed=compose({faults:{'INSERT INTO':'throw'}});await assert.rejects(failed.store.advanceProjection(proofFor(failed.pool,4)),e=>e.code==='RETENTION_STORE_UNAVAILABLE');
 const c=failed.pool.made[0];assert.ok(c.queries.includes('ROLLBACK'));assert.deepEqual(c.releases,[undefined],'a confirmed ROLLBACK returns the lease');
});

test('through the watermarked journal, an advance whose commit is unknown leaves the projection standing and closes the serving fence',async()=>{
 const faults={}, {store,pool}=compose({faults}),fence=createServingFence();fence.enable({watermark:{sequence:0,entrySha256:null}});
 const writes=[],memory=createMemoryRetentionJournal(),inner={...memory,async set(key,row,options){writes.push(key);return memory.set(key,row,options);}};
 const tracked=watermarkedJournal({journal:inner,watermark:store,fence,ledger:createRetentionLedger({sink:createMemoryLedgerSink(),now:Date.now})});const key=`tenant-a:conversation:${randomUUID()}`;
 const set=inner.set;inner.set=async(...args)=>{const result=await set(...args);pool.project(args[0],args[1]);faults.COMMIT='throw';return result;};
 await tracked.set(key,{state:'SUPPRESSED',ledgerSequence:1,entrySha256:'1'.repeat(64)});
 assert.deepEqual(writes,[key]);assert.equal(fence.isEnabled(),false);assert.equal(fence.state().reason,'RETENTION_WATERMARK_UNKNOWN');assert.equal(fence.state().highWater,0,'an unacknowledged advance is not observed');
});

test('synthetic SQL: a guarded advance refuses a restored row in the same locked transaction',async()=>{
 const {pool,store}=compose();await store.advanceProjection(proofFor(pool,3));pool.row={sequence:'0',entry_sha256:null};
 await assert.rejects(store.advanceProjection(proofFor(pool,4,3)),/RETENTION_WATERMARK_STALE/);
 assert.equal(pool.row.sequence,'0');const queries=pool.made.flatMap(c=>c.queries);
 assert.ok(queries.includes('ROLLBACK'));assert.ok(pool.made.every(c=>c.releases.every(e=>e===undefined)));
});

test('synthetic SQL: missing, changed or wrong-sequence projections cannot advance; exact proof and advance share one transaction',async()=>{
 for(const kind of ['missing','changed','sequence']){const {pool,store}=compose(),proof=proofFor(pool,1);
  if(kind==='missing')pool.projections.clear();if(kind==='changed')pool.project(proof.key,{...rowAt(1),state:'RELEASED'});if(kind==='sequence')proof.sequence=2;
  await assert.rejects(store.advanceProjection(proof),/RETENTION_PROJECTION_UNVERIFIED/);assert.equal(pool.row,null,kind);
  assert.ok(pool.made[0].statements.includes('ROLLBACK'));assert.ok(!pool.made[0].statements.some(s=>s.startsWith('INSERT INTO')));
 }
 const {pool,store}=compose();await store.advanceProjection(proofFor(pool,1));const statements=pool.made[0].statements;
 const proof=statements.findIndex(s=>s.startsWith('SELECT * FROM')&&s.endsWith('FOR UPDATE')),advance=statements.findIndex(s=>s.startsWith('INSERT INTO'));
 assert.ok(proof>statements.indexOf('BEGIN')&&advance>proof&&statements.indexOf('COMMIT')>advance);assert.equal(statements.filter(s=>s==='BEGIN').length,1);
 assert.ok(statements.some(s=>s.includes('meri_retention_subject:')||s.includes('pg_advisory_xact_lock(hashtextextended($1,0))')));
});

test('synthetic SQL snapshot: one joined data statement follows the shared recovery lock in the same clean transaction',async()=>{
 const {pool,store}=compose(),key=`tenant-a:conversation:${randomUUID()}`;
 assert.deepEqual(await store.readProjection(key),{projection:null,watermark:{sequence:0,entrySha256:null}});
 const row=rowAt(1);pool.project(key,row);pool.row={sequence:'1',entry_sha256:'a'.repeat(64)};
 assert.deepEqual(await store.readProjection(key),{projection:row,watermark:{sequence:1,entrySha256:'a'.repeat(64)}});
 const statements=pool.made[0].statements,joined=statements.map((s,i)=>s.startsWith('SELECT s.projection,')?i:-1).filter(i=>i>=0);
 assert.equal(joined.length,2);
 assert.equal(statements.filter(s=>s.startsWith('BEGIN')).every(s=>s==='BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY'),true,'pool session isolation cannot establish an older snapshot before the recovery lock grants, and the snapshot is strictly read-only');
 for(const i of joined){assert.ok(statements[i].includes('LEFT JOIN meri_conversations.retention_subjects'));
  assert.ok(statements[i].includes('LEFT JOIN meri_conversations.retention_recovery_watermark'));
  assert.ok(statements[i-1].startsWith('SELECT pg_advisory_xact_lock_shared'));assert.equal(statements[i+1],'COMMIT');}
 assert.equal(statements.some(s=>s.startsWith('SELECT sequence')||s.startsWith('SELECT * FROM')),false,'no independent projection/watermark observation');
 assert.ok(pool.made.every(c=>c.releases.every(e=>e===undefined)));
 assert.throws(()=>createPostgresWatermarkStore({journal:{tx(){},assertProjection(){}}}),/RETENTION_CONFIGURATION/);
});

test('synthetic SQL snapshot: another owner completing recovery before the shared lock grants is observed by the data snapshot',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;}),released=new Promise(r=>{release=r;});
 const faults={'SELECT pg_advisory_xact_lock_shared':async()=>{enter();await released;return {rows:[]};}}, {pool,store}=compose({faults});
 const key=`tenant-a:conversation:${randomUUID()}`,reading=store.readProjection(key);await entered;
 try{assert.equal(pool.made[0].statements.some(s=>s.startsWith('SELECT s.projection,')),false);
  pool.project(key,rowAt(1));pool.row={sequence:'1',entry_sha256:'a'.repeat(64)};
 }finally{release();}
 assert.deepEqual(await reading,{projection:rowAt(1),watermark:{sequence:1,entrySha256:'a'.repeat(64)}});
 assert.deepEqual(pool.made[0].releases,[undefined]);
});

test('synthetic SQL snapshot: malformed data or lost commit returns no snapshot and retires unknown leases',async()=>{
 const key=`tenant-a:conversation:${randomUUID()}`;
 for(const result of [{rows:[]},{rows:[{projection:null,projection_sha256:null,state:null,ledger_sequence:null,watermark_sequence:'x',watermark_entry_sha256:null}]},
  {rows:[{projection:null,projection_sha256:hash(null),state:'SUPPRESSED',ledger_sequence:'1',watermark_sequence:'1',watermark_entry_sha256:'a'.repeat(64)}]}]){
  const {store,pool}=compose({faults:{'SELECT s.projection,':result}});await assert.rejects(store.readProjection(key),/RETENTION_STORE_CORRUPT/);
  assert.ok(pool.made[0].queries.includes('ROLLBACK'));assert.deepEqual(pool.made[0].releases,[undefined]);
 }
 const {store,pool}=compose({faults:{COMMIT:'throw'}});await assert.rejects(store.readProjection(key),/RETENTION_COMMIT_UNKNOWN/);
 assert.equal(pool.made[0].queries.includes('ROLLBACK'),false);assert.ok(pool.made[0].releases[0] instanceof Error);
});

/** A lock timeout on the shared recovery lock: the only failure a strictly read-only snapshot may retry. */
const lockTimeout=()=>Object.assign(new Error('canceling statement due to lock timeout'),{code:'55P03'});
const lockFault=attempts=>()=>{attempts.n++;if(attempts.n===1)throw lockTimeout();return {rows:[]};};
const begins=c=>c.statements.filter(s=>s.startsWith('BEGIN')).length;

test('synthetic SQL: a read-only snapshot that loses the shared recovery lock is retried exactly once in a fresh transaction',async()=>{
 const attempts={n:0},{pool,store}=compose({faults:{'SELECT pg_advisory_xact_lock_shared':lockFault(attempts)},maxRequestMs:5000}),key=`tenant-a:conversation:${randomUUID()}`;
 pool.project(key,rowAt(1));pool.row={sequence:'1',entry_sha256:'a'.repeat(64)};
 assert.deepEqual(await store.readProjection(key),{projection:rowAt(1),watermark:{sequence:1,entrySha256:'a'.repeat(64)}});
 assert.equal(attempts.n,2,'exactly one retry');
 const c=pool.made[0],sql=c.statements;
 assert.equal(begins(c),2,'a fresh transaction for the retry');
 const first=sql.findIndex(s=>s.startsWith('BEGIN')),rollback=sql.indexOf('ROLLBACK'),second=sql.findIndex((s,i)=>i>rollback&&s.startsWith('BEGIN')),commit=sql.indexOf('COMMIT');
 assert.ok(first>=0&&first<rollback&&rollback<second&&second<commit,'a confirmed ROLLBACK precedes the fresh BEGIN and only the retry commits');
 assert.ok(c.releases.every(e=>e===undefined),'both transactions returned a clean lease');
});

test('synthetic SQL: the retried snapshot sees a recovery that completed while the first attempt waited',async()=>{
 const key=`tenant-a:conversation:${randomUUID()}`,attempts={n:0};let pool;
 const faults={'SELECT pg_advisory_xact_lock_shared':()=>{attempts.n++;if(attempts.n===1){pool.project(key,rowAt(3));pool.row={sequence:'3',entry_sha256:'c'.repeat(64)};throw lockTimeout();}return {rows:[]};}};
 const made=compose({faults,maxRequestMs:5000});pool=made.pool;
 pool.project(key,rowAt(1));pool.row={sequence:'1',entry_sha256:'a'.repeat(64)};
 assert.deepEqual(await made.store.readProjection(key),{projection:rowAt(3),watermark:{sequence:3,entrySha256:'c'.repeat(64)}},'the retry re-reads one fresh joined snapshot');
 assert.equal(attempts.n,2);
});

test('synthetic SQL: an unconfirmed ROLLBACK retires the lease and is never retried',async()=>{
 const attempts={n:0},{pool,store}=compose({faults:{'SELECT pg_advisory_xact_lock_shared':()=>{attempts.n++;throw lockTimeout();},ROLLBACK:'throw'},maxRequestMs:5000}),key=`tenant-a:conversation:${randomUUID()}`;
 await assert.rejects(store.readProjection(key),/RETENTION_STORE_UNAVAILABLE/);
 assert.equal(attempts.n,1,'cleanup uncertainty is not retried');assert.equal(pool.made.length,1);assert.ok(pool.made[0].releases[0] instanceof Error,'the uncertain lease is retired');});

test('synthetic SQL: a read-only transaction on a held transition lease is never retried',async()=>{
 const attempts={n:0},pool=syntheticPool({faults:{'SELECT pg_advisory_xact_lock_shared':()=>{attempts.n++;throw lockTimeout();}},maxRequestMs:5000}),journal=createPostgresRetentionJournal({pool,maxRequestMs:5000});
 await assert.rejects(journal.withTransition(`tenant-a:conversation:${randomUUID()}`,()=>journal.tx(async()=>null,{readOnly:true})),/RETENTION_STORE_UNAVAILABLE/);
 assert.equal(attempts.n,1,'a held lease is never retried');
});

test('synthetic SQL: a lock timeout that persists is retried only once and then refused',async()=>{
 const attempts={n:0},{pool,store}=compose({faults:{'SELECT pg_advisory_xact_lock_shared':()=>{attempts.n++;throw lockTimeout();}},maxRequestMs:5000}),key=`tenant-a:conversation:${randomUUID()}`;
 await assert.rejects(store.readProjection(key),/RETENTION_STORE_UNAVAILABLE/);
 assert.equal(attempts.n,2,'at most one retry');assert.equal(begins(pool.made[0]),2);
});

test('synthetic SQL: a lock timeout is not retried when the remaining budget cannot fit another lock wait',async()=>{
 const attempts={n:0},{pool,store}=compose({faults:{'SELECT pg_advisory_xact_lock_shared':lockFault(attempts)},maxRequestMs:5000}),key=`tenant-a:conversation:${randomUUID()}`;
 await assert.rejects(store.readProjection(key,{deadlineMs:Date.now()+1000}),/RETENTION_STORE_UNAVAILABLE/);
 assert.equal(attempts.n,1,'a 1s budget cannot fit a 2s lock wait');assert.equal(begins(pool.made[0]),1);
});

test('synthetic SQL: a non-lock failure, an unknown COMMIT and a write are never retried',async()=>{
 const transport={n:0},{pool,store}=compose({faults:{'SELECT pg_advisory_xact_lock_shared':()=>{transport.n++;throw Object.assign(new Error('synthetic transport'),{code:'08006'});}},maxRequestMs:5000}),key=`tenant-a:conversation:${randomUUID()}`;
 await assert.rejects(store.readProjection(key),/RETENTION_STORE_UNAVAILABLE/);assert.equal(transport.n,1,'a transport failure is not a lock timeout');
 const unknown=compose({faults:{COMMIT:'throw'},maxRequestMs:5000});await assert.rejects(unknown.store.readProjection(key),/RETENTION_COMMIT_UNKNOWN/);
 assert.equal(begins(unknown.pool.made[0]),1,'an unknown COMMIT is never retried');assert.equal(unknown.pool.made[0].queries.includes('ROLLBACK'),false);
 const write={n:0},w=compose({faults:{'SELECT pg_advisory_xact_lock_shared':()=>{write.n++;throw lockTimeout();}},maxRequestMs:5000});
 await assert.rejects(w.journal.set(key,{state:'SUPPRESSED',ledgerSequence:1,entrySha256:'1'.repeat(64),ownerActorId:'actor',suppressedAtMs:1}),/RETENTION_STORE_UNAVAILABLE/);
 assert.equal(write.n,1,'a write is never retried');assert.equal(begins(w.pool.made[0]),1);
});

test('synthetic SQL: an aborted caller is not retried',async()=>{
 const abort=new AbortController(),attempts={n:0},{pool,store}=compose({faults:{'SELECT pg_advisory_xact_lock_shared':()=>{attempts.n++;abort.abort();throw lockTimeout();}},maxRequestMs:5000}),key=`tenant-a:conversation:${randomUUID()}`;
 await assert.rejects(store.readProjection(key,{signal:abort.signal}),/RETENTION_STORE_UNAVAILABLE/);
 assert.equal(attempts.n,1,'an aborted caller is not retried');assert.equal(begins(pool.made[0]),1);
});

/** The real composed standalone read path: canonical gate -> watermarked journal -> watermark store -> journal. */
function composedGate({now,onLock}){
 const pool=syntheticPool({faults:{'SELECT pg_advisory_xact_lock_shared':onLock}});
 const journal=createPostgresRetentionJournal({pool,maxRequestMs:10000,now});
 const store=createPostgresWatermarkStore({journal}),fence=createServingFence();fence.enable({watermark:{sequence:0,entrySha256:null}});
 const tracked=watermarkedJournal({journal,watermark:store,fence,ledger:{async head(){return {sequence:0,entrySha256:null};}}});
 return {pool,journal,gate:createRetentionReadGate({journal:tracked,serving:fence,log(){}})};
}
const servedSubject=()=>({tenantId:'tenant-a',kind:'conversation',subjectId:randomUUID()});

test('composed gate: the production default cannot accept a snapshot beyond the agreed five-second window',async()=>{
 const clock={t:0},attempts={n:0};
 const {pool,gate}=composedGate({now:()=>clock.t,onLock:()=>{attempts.n++;if(attempts.n===1){clock.t=2001;throw lockTimeout();}clock.t=6001;return {rows:[]};}});
 await assert.rejects(gate.assertServable(servedSubject()),/RETENTION_READ_UNAVAILABLE/);
 assert.equal(attempts.n,2,'at most two attempts');
 const sql=pool.made[0].statements;
 assert.equal(sql.filter(s=>s.startsWith('BEGIN')).length,2,'one fresh transaction per attempt, nothing more');
 assert.equal(sql.some(s=>s.startsWith('SELECT s.projection,')),false,'no snapshot is accepted at 6001ms');
 assert.equal(sql.includes('COMMIT'),false,'no COMMIT after the five-second window');
 assert.ok(pool.made[0].releases.at(-1) instanceof Error,'the over-budget lease is retired');
});

test('composed gate: a far caller deadline is clipped to the same five-second window',async()=>{
 const clock={t:0},attempts={n:0};
 const {pool,gate}=composedGate({now:()=>clock.t,onLock:()=>{attempts.n++;if(attempts.n===1){clock.t=2001;throw lockTimeout();}clock.t=6001;return {rows:[]};}});
 await assert.rejects(gate.assertServable(servedSubject(),{deadlineMs:clock.t+60000}),/RETENTION_READ_UNAVAILABLE/);
 assert.equal(attempts.n,2,'the caller cannot buy extra attempts');assert.equal(pool.made[0].statements.some(s=>s.startsWith('SELECT s.projection,')),false);
});

test('composed gate: an owner-style abort stops the read before any second attempt',async()=>{
 const abort=new AbortController(),clock={t:0},attempts={n:0};
 const {pool,gate}=composedGate({now:()=>clock.t,onLock:()=>{attempts.n++;abort.abort();throw lockTimeout();}});
 const life=createOperationLifetime({deadlineMs:clock.t+1000,now:()=>clock.t,signal:abort.signal,errorFactory:code=>Object.assign(Error(code),{code})});
 const subject=servedSubject();let pending;
 const outer=await life.run(()=>{pending=gate.assertServable(subject,{deadlineMs:life.deadline(),signal:life.signal});return pending;}).then(()=>'accepted',error=>error.code);
 assert.equal(outer,'CANCELLED');await assert.rejects(pending,/RETENTION_READ_UNAVAILABLE/);life.close();
 assert.equal(attempts.n,1,'no retry after the caller aborted');
 const sql=pool.made[0].statements;
 assert.equal(sql.filter(s=>s.startsWith('BEGIN')).length,1,'no second BEGIN after the abort');
 assert.equal(sql.some(s=>s.startsWith('SELECT s.projection,')),false,'no joined read after the abort');
 assert.equal(sql.includes('COMMIT'),false,'no COMMIT after the abort');
 assert.equal(sql.includes('ROLLBACK'),false,'no post-abort ROLLBACK work');
 assert.ok(pool.made[0].releases[0] instanceof Error,'the aborted lease is retired');
});

test('composed gate: an expired caller budget prevents a second attempt',async()=>{
 const clock={t:0},attempts={n:0};
 const {pool,gate}=composedGate({now:()=>clock.t,onLock:()=>{attempts.n++;clock.t=2001;throw lockTimeout();}});
 await assert.rejects(gate.assertServable(servedSubject(),{deadlineMs:3000}),/RETENTION_READ_UNAVAILABLE/);
 assert.equal(attempts.n,1,'a retry cannot fit the 3000ms caller deadline');
 assert.equal(pool.made[0].statements.filter(s=>s.startsWith('BEGIN')).length,1,'no second BEGIN after expiry');
});
