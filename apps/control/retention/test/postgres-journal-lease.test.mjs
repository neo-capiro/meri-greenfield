/** Audit DA-4 (meri-comprehensive-20261015): uncertain retention database leases returned to the pool as reusable. The actual PostgreSQL
 * journal adapter over an injected pg-compatible pool whose clients can lose a COMMIT acknowledgement, fail or stall a ROLLBACK, stall a
 * statement, arrive after their deadline, or fail or deny an advisory unlock. A lease goes back for reuse only when its transaction or
 * session lock is known closed; every other lease is retired with `release(error)` and a later borrower gets a fresh connection.
 * Synthetic pool and keys: not a real-driver, network or PostgreSQL fault test. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
const key=()=>`tenant-a:conversation:${randomUUID()}`,never=()=>new Promise(()=>{}),refused=sql=>Object.assign(new Error('synthetic '+sql),{code:'08006'});
/** `faults` maps a statement prefix to 'throw', 'hang' or a value to return; `connectDelayMs` delays every acquisition. */
function syntheticPool({faults={},connectDelayMs=0}={}){
 const idle=[],made=[];let connects=0;
 const answer=sql=>{const k=Object.keys(faults).find(prefix=>sql.startsWith(prefix));const f=k&&faults[k];if(f==='throw')throw refused(k);if(f==='hang')return never();if(f!==undefined&&f!==null)return f;
  if(sql.startsWith('SELECT pg_advisory_unlock'))return {rows:[{unlocked:true}],rowCount:1};return {rows:[],rowCount:0};};
 const client=()=>{const c={id:made.length+1,queries:[],releases:[],async query(sql){c.queries.push(sql.split(' ').slice(0,2).join(' '));return answer(sql);},release(error){c.releases.push(error);if(!error)idle.push(c);}};made.push(c);return c;};
 return {made,idle,connects:()=>connects,async connect(){connects++;if(connectDelayMs)await new Promise(r=>setTimeout(r,connectDelayMs));return idle.pop()??client();}};
}
const retired=c=>c.releases.length===1&&c.releases[0] instanceof Error;
const reused=c=>c.releases.length>=1&&c.releases.every(e=>e===undefined);
/** Guards the pre-fix behaviour, where a stalled ROLLBACK or statement never returned at all. */
async function within(promise,ms){let timer;try{return await Promise.race([promise.then(v=>({v}),e=>({e})),new Promise(r=>{timer=setTimeout(()=>r({timedOut:true}),ms);})]);}finally{clearTimeout(timer);}}
/** The lease the next transaction runs on (its own outcome is irrelevant here). */
async function laterBorrower(pool,journal){await journal.get(key()).catch(()=>{});return pool.made.at(-1);}

test('DA-4 control: a committed read and a refusal that rolls back cleanly return the lease for reuse',async()=>{
 const pool=syntheticPool(),journal=createPostgresRetentionJournal({pool,maxRequestMs:200});
 assert.equal(await journal.get(key()),null);assert.equal(pool.made.length,1);assert.ok(reused(pool.made[0]));
 await assert.rejects(journal.set(key(),{state:'SUPPRESSED',ledgerSequence:1,entrySha256:'1'.repeat(64),ownerActorId:'actor',suppressedAtMs:1},{expected:'0'.repeat(64)}),/RETENTION_STALE_WRITE/);
 assert.ok(pool.made[0].queries.includes('ROLLBACK'));assert.equal(pool.made.length,1,'the same lease served both');assert.ok(reused(pool.made[0]));
});

test('DA-4 lost COMMIT acknowledgement: the outcome is RETENTION_COMMIT_UNKNOWN, no ROLLBACK is sent over it, and the lease is retired',async()=>{
 const pool=syntheticPool({faults:{COMMIT:'throw'}}),journal=createPostgresRetentionJournal({pool,maxRequestMs:200});
 await assert.rejects(journal.get(key()),e=>e.code==='RETENTION_COMMIT_UNKNOWN');const first=pool.made[0];
 assert.ok(!first.queries.includes('ROLLBACK'),'an unknown commit is never rolled back over');assert.ok(retired(first),'released with an error, so the pool destroys it');assert.ok(!pool.idle.includes(first));
});

test('DA-4 uncertain rollback: a failed ROLLBACK and a ROLLBACK that never answers both retire the lease within the bound, and a later borrower gets a fresh connection',async()=>{
 for(const mode of ['throw','hang']){
  const pool=syntheticPool({faults:{'SELECT * FROM':'throw',ROLLBACK:mode}}),journal=createPostgresRetentionJournal({pool,maxRequestMs:200});
  const r=await within(journal.get(key()),3000);assert.ok(!r.timedOut,`${mode}: the ROLLBACK wait is bounded`);assert.equal(r.e?.code,'RETENTION_STORE_UNAVAILABLE',mode);
  const first=pool.made[0];assert.ok(first.queries.includes('ROLLBACK'),mode);assert.ok(retired(first),`${mode}: retired, not returned`);
  assert.equal(pool.idle.length,0,mode);const next=await laterBorrower(pool,journal);assert.notEqual(next,first,`${mode}: the later borrower never inherits the uncertain lease`);assert.equal(pool.made.length,2);}
});

test('DA-4 client-side deadline: a statement that never answers fails within the bound, sends no ROLLBACK behind it, and retires the lease; a failed BEGIN retires it too',async()=>{
 const pool=syntheticPool({faults:{'SELECT * FROM':'hang'}}),journal=createPostgresRetentionJournal({pool,maxRequestMs:100});
 const r=await within(journal.get(key()),3000);assert.ok(!r.timedOut,'bounded');assert.equal(r.e?.code,'RETENTION_STORE_UNAVAILABLE');
 const first=pool.made[0];assert.ok(!first.queries.includes('ROLLBACK'),'the transaction state is unknown: no statement is queued behind the stalled one');assert.ok(retired(first));
 const begin=syntheticPool({faults:{BEGIN:'throw'}}),j2=createPostgresRetentionJournal({pool:begin,maxRequestMs:100});await assert.rejects(j2.get(key()),/RETENTION_STORE_UNAVAILABLE/);assert.ok(retired(begin.made[0]),'a BEGIN whose outcome is unknown is not reusable');
});

test('DA-4 late lease: an acquisition that outlives its deadline fails the caller and the lease is retired when it arrives',async()=>{
 const pool=syntheticPool({connectDelayMs:250}),journal=createPostgresRetentionJournal({pool,maxRequestMs:50});
 const r=await within(journal.get(key()),3000);assert.ok(!r.timedOut);assert.equal(r.e?.code,'RETENTION_STORE_UNAVAILABLE');
 await new Promise(res=>setTimeout(res,400));assert.equal(pool.made.length,1);assert.ok(retired(pool.made[0]),'the late lease is released with an error');assert.deepEqual(pool.made[0].queries,[],'nothing ran on it');assert.equal(pool.idle.length,0);
});

test('DA-4 uncertain unlock: a failed, denied or stalled advisory unlock and an unknown lock acquisition retire the recovery session; a confirmed unlock returns it',async()=>{
 for(const [label,faults] of [['unlock throws',{'SELECT pg_advisory_unlock':'throw'}],['unlock denied',{'SELECT pg_advisory_unlock':{rows:[{unlocked:false}],rowCount:1}}],['unlock stalls',{'SELECT pg_advisory_unlock':'hang'}]]){
  const pool=syntheticPool({faults}),journal=createPostgresRetentionJournal({pool,maxRequestMs:100});let ran=false;
  const r=await within(journal.exclusive(async()=>{ran=true;return 'pass';}),3000);assert.ok(!r.timedOut,label);assert.ok(r.e,`${label}: the caller is told`);assert.match(r.e.code,/^RETENTION_(UNLOCK_UNKNOWN|STORE_UNAVAILABLE)$/,label);assert.ok(ran,label);
  assert.ok(retired(pool.made[0]),`${label}: the session holding an unknown lock is retired`);assert.equal(pool.idle.length,0,label);
  const next=await laterBorrower(pool,journal);assert.notEqual(next,pool.made[0],`${label}: a later borrower gets a fresh connection`);}
 const lockLost=syntheticPool({faults:{'SELECT pg_advisory_lock':'throw'}}),j=createPostgresRetentionJournal({pool:lockLost,maxRequestMs:100});let ran=false;
 await assert.rejects(j.exclusive(async()=>{ran=true;}),/RETENTION_STORE_UNAVAILABLE/);assert.equal(ran,false);assert.ok(retired(lockLost.made[0]),'a lock acquisition with an unknown outcome is retired');
 const clean=syntheticPool(),jc=createPostgresRetentionJournal({pool:clean,maxRequestMs:100});assert.equal(await jc.exclusive(async()=>'pass'),'pass');assert.ok(reused(clean.made[0]));
 await assert.rejects(jc.exclusive(async()=>{throw Object.assign(new Error('x'),{code:'RETENTION_RECOVERY_UNSETTLED'});}),/RETENTION_RECOVERY_UNSETTLED/);assert.ok(reused(clean.made[0]),'a failing pass with a confirmed unlock keeps the session');
});

