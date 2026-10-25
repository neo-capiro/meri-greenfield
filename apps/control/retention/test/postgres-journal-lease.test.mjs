/** Audit DA-4 (meri-comprehensive-20261015): uncertain retention database leases returned to the pool as reusable. The actual PostgreSQL
 * journal adapter over an injected pg-compatible pool whose clients can lose a COMMIT acknowledgement, fail or stall a ROLLBACK, stall a
 * statement, arrive after their deadline, or fail or deny an advisory unlock. A lease goes back for reuse only when its transaction or
 * session lock is known closed; every other lease is retired with `release(error)` and a later borrower gets a fresh connection.
 * Synthetic pool and keys: not a real-driver, network or PostgreSQL fault test. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../postgres-watermark.mjs';
import {createConversationManagementStore} from '../../conversations/history/management-store.mjs';
import {spawnSync} from 'node:child_process';
const key=()=>`tenant-a:conversation:${randomUUID()}`,never=()=>new Promise(()=>{}),refused=sql=>Object.assign(new Error('synthetic '+sql),{code:'08006'});
/** `faults` maps a statement prefix to 'throw', 'hang' or a value to return; `connectDelayMs` delays every acquisition. */
function syntheticPool({faults={},connectDelayMs=0,max=Infinity}={}){
 const idle=[],made=[],waiting=[];let connects=0,leased=0;
 const answer=sql=>{const k=Object.keys(faults).find(prefix=>sql.startsWith(prefix));const f=k&&faults[k];if(f==='throw')throw refused(k);if(f==='hang')return never();if(f!==undefined&&f!==null)return f;
  if(sql.startsWith('SELECT pg_advisory_unlock'))return {rows:[{unlocked:true}],rowCount:1};return {rows:[],rowCount:0};};
 const client=()=>{const c={id:made.length+1,queries:[],statements:[],releases:[],inTransaction:false,async query(sql,args){c.queries.push(sql.split(' ').slice(0,2).join(' '));c.statements.push({sql,args});const result=await answer(sql);if(sql.startsWith('BEGIN')){assert.equal(c.inTransaction,false);c.inTransaction=true;}if(sql==='COMMIT'||sql==='ROLLBACK')c.inTransaction=false;return result;},release(error){c.releases.push(error);leased--;if(!error)idle.push(c);waiting.shift()?.();}};made.push(c);return c;};
 return {made,idle,connects:()=>connects,async connect(){connects++;if(connectDelayMs)await new Promise(r=>setTimeout(r,connectDelayMs));if(leased>=max)await new Promise(resolve=>waiting.push(resolve));leased++;return idle.pop()??client();}};
}
const retired=c=>c.releases.length===1&&c.releases[0] instanceof Error;
const reused=c=>c.releases.length>=1&&c.releases.every(e=>e===undefined);

test('transaction drains unawaited work and refuses a caught query failure before COMMIT',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve;}),pool=syntheticPool({faults:{'SELECT pending':pending}}),journal=createPostgresRetentionJournal({pool});
 const operation=journal.tx(async reader=>{void reader.query('SELECT pending');});
 await new Promise(resolve=>setImmediate(resolve));assert.ok(!pool.made[0].queries.includes('COMMIT'));
 finish({rows:[]});await operation;assert.ok(pool.made[0].queries.includes('COMMIT'));
 const failing=syntheticPool({faults:{'SELECT failed':'throw'}}),j=createPostgresRetentionJournal({pool:failing});
 await assert.rejects(j.tx(async reader=>{await reader.query('SELECT failed').catch(()=>{});}),/RETENTION_STORE_UNAVAILABLE/);
 assert.ok(!failing.made[0].queries.includes('COMMIT'));assert.ok(failing.made[0].queries.includes('ROLLBACK'));
});

test('completed result pages are collectible before the transaction and held transition finish',()=>{
 const moduleUrl=new URL('../postgres-journal.mjs',import.meta.url).href;
 const program=`import assert from 'node:assert/strict';
 import {createPostgresRetentionJournal} from ${JSON.stringify(moduleUrl)};
 const refs=[];const client={release(){},async query(sql){if(sql==='SELECT page'){const page={rows:Array.from({length:1000},(_,i)=>({i,text:'retained transcript'}))};refs.push(new WeakRef(page));return page;}return {rows:[{unlocked:true}]};}};
 const journal=createPostgresRetentionJournal({pool:{connect:async()=>client}});
 const collect=async()=>{for(let i=0;i<3;i++){await new Promise(setImmediate);global.gc();}assert.ok(refs.filter(r=>r.deref()===undefined).length>=39,'fulfilled query pages must not remain live until lease release');refs.length=0;};
 await journal.tx(async reader=>{for(let i=0;i<40;i++)await reader.query('SELECT page');await collect();});
 await journal.withTransition('tenant-a:conversation:00000000-0000-4000-8000-000000000001',async lease=>{for(let i=0;i<40;i++)await lease.query('SELECT page');await collect();});`;
 const result=spawnSync(process.execPath,['--expose-gc','--input-type=module','--eval',program],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr||String(result.error));
});
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

test('subject transition interlock spans its callback and retires an uncertain unlock',async()=>{
 const subject=key(),pool=syntheticPool(),journal=createPostgresRetentionJournal({pool,maxRequestMs:100});
 const observed=await journal.withTransition(subject,async()=>{
  assert.equal(pool.made[0].queries.at(-1),'SELECT pg_advisory_lock(hashtextextended($1,0))');
  return 'projected';
 });
 assert.equal(observed,'projected');assert.ok(reused(pool.made[0]));
 assert.equal(pool.made[0].queries.at(-1),'SELECT pg_advisory_unlock(hashtextextended($1,0))');
 const denied=syntheticPool({faults:{'SELECT pg_advisory_unlock':{rows:[{unlocked:false}],rowCount:1}}}),unsafe=createPostgresRetentionJournal({pool:denied,maxRequestMs:100});
 await assert.rejects(unsafe.withTransition(subject,async()=>null),/RETENTION_UNLOCK_UNKNOWN/);
 assert.ok(retired(denied.made[0]));
});

test('management shares one held lease with ownership, projection and watermark reads; external work has no open transaction',{timeout:2000},async()=>{
 const subject=key(),pool=syntheticPool({max:1}),journal=createPostgresRetentionJournal({pool,maxRequestMs:200}),watermark=createPostgresWatermarkStore({journal});
 const store=createConversationManagementStore({tx(){assert.fail('must not acquire a conversation lease');},rowRun(){assert.fail('no runs');},settlement(){assert.fail('no runs');},now:Date.now});
 const input={principal:{tenantId:'tenant-a',actorId:'actor-a',clientIds:[]},conversationId:subject.split(':').at(-1)};
 let escaped;
 await journal.withTransition(subject,async lease=>{
  escaped=lease;
  await store.withConversation(input,async state=>{
   assert.deepEqual(state,{conversation:null,hasTranscript:false,canManage:true});
   assert.equal(pool.made[0].inTransaction,false,'Core/ledger IO happens after inspection COMMIT');
   await Promise.all([journal.get(subject),journal.ownerOf({tenantId:'tenant-a',kind:'conversation',subjectId:input.conversationId}),watermark.read()]);
   assert.equal(pool.made[0].inTransaction,false,'nested canonical owners use bounded sequential transactions');
  },()=>{},lease);
 });
 assert.equal(pool.connects(),1);assert.equal(pool.made.length,1);assert.ok(reused(pool.made[0]));
 const locks=pool.made[0].statements.filter(s=>s.sql.startsWith('SELECT pg_advisory_lock(')||s.sql.startsWith('SELECT pg_advisory_unlock(')).map(s=>s.args[0]);
 assert.deepEqual(locks,[`meri_retention_transition:${subject}`,`tenant-a:${input.conversationId}`,`tenant-a:${input.conversationId}`,`meri_retention_transition:${subject}`]);
 const count=pool.made[0].statements.length;
 await assert.rejects(escaped.query('SELECT 1'),/RETENTION_INVALID_REQUEST/);
 await assert.rejects(escaped.tx(async()=>null),/RETENTION_INVALID_REQUEST/);
 assert.throws(()=>escaped.invalidate(),/RETENTION_INVALID_REQUEST/);
 assert.equal(pool.made[0].statements.length,count,'expired scope cannot issue SQL');
});

test('one-connection competing transitions wait without nested pool acquisition and clean up callback exceptions',{timeout:2000},async()=>{
 const pool=syntheticPool({max:1}),journal=createPostgresRetentionJournal({pool,maxRequestMs:500});
 let entered,finish;const started=new Promise(r=>{entered=r;}),release=new Promise(r=>{finish=r;});let second=false;
 const first=journal.withTransition(key(),async()=>{await journal.get(key());entered();await release;throw Error('Core unavailable');});
 first.catch(()=>{});await started;
 const following=journal.withTransition(key(),async()=>{second=true;await journal.get(key());});
 await new Promise(r=>setImmediate(r));assert.equal(second,false);assert.equal(pool.connects(),2);
 finish();await assert.rejects(first,/RETENTION_STORE_UNAVAILABLE/);await following;
 assert.equal(second,true);assert.equal(pool.made.length,1);assert.ok(reused(pool.made[0]));
});

test('held transition retires unknown COMMIT, timed-out query and unlock; clean rolled-back refusal remains reusable',{timeout:3000},async()=>{
 for(const faults of [{COMMIT:'throw'},{'SELECT * FROM':'hang'},{'SELECT pg_advisory_unlock':{rows:[{unlocked:false}]}}]){
  const pool=syntheticPool({faults,max:1}),journal=createPostgresRetentionJournal({pool,maxRequestMs:50});
  await assert.rejects(journal.withTransition(key(),()=>journal.get(key())),/RETENTION_(COMMIT_UNKNOWN|STORE_UNAVAILABLE|UNLOCK_UNKNOWN)/);
  assert.equal(pool.connects(),1);assert.ok(retired(pool.made[0]));assert.equal(pool.idle.length,0);
 }
 const pool=syntheticPool({max:1}),journal=createPostgresRetentionJournal({pool,maxRequestMs:200});
 await journal.withTransition(key(),async()=>{
  await assert.rejects(journal.tx(async()=>{throw Object.assign(Error('refused'),{code:'RETENTION_STALE_WRITE'});}),/RETENTION_STALE_WRITE/);
  await journal.get(key());
 });
 assert.equal(pool.connects(),1);assert.ok(reused(pool.made[0]));assert.ok(pool.made[0].queries.includes('ROLLBACK'));
});

test('recovery reuses its existing exclusion lease for projection and watermark transactions',{timeout:2000},async()=>{
 const pool=syntheticPool({max:1}),journal=createPostgresRetentionJournal({pool,maxRequestMs:200}),watermark=createPostgresWatermarkStore({journal});
 let escaped;
 await journal.exclusive(async lease=>{
  escaped=lease;
  await journal.get(key(),{exclusive:true});
  await watermark.read({exclusive:true});
  assert.equal(pool.made[0].inTransaction,false,'ledger/head IO has no open SQL transaction');
 });
 assert.equal(pool.connects(),1);assert.equal(pool.made.length,1);assert.ok(reused(pool.made[0]));
 await assert.rejects(escaped.query('SELECT 1'),/RETENTION_INVALID_REQUEST/);
});

test('retention snapshot uses its held lease, establishes recovery exclusion first, and expires the reader',{timeout:2000},async()=>{
 const pool=syntheticPool({max:1}),journal=createPostgresRetentionJournal({pool,maxRequestMs:200});let escaped;
 await assert.rejects(journal.withSnapshot(async()=>null),/RETENTION_INVALID_REQUEST/);
 await journal.withTransition(key(),async()=>{
  await journal.withSnapshot(async reader=>{escaped=reader;assert.equal(pool.made[0].inTransaction,true);await reader.query('SELECT snapshot');});
  assert.equal(pool.made[0].inTransaction,false,'external Core/storage IO holds no SQL transaction');
  await journal.get(key());
 });
 assert.equal(pool.connects(),1);assert.ok(reused(pool.made[0]));
 const sql=pool.made[0].statements.map(s=>s.sql),lock=sql.findIndex(s=>s.startsWith('SELECT pg_advisory_lock_shared'));
 const begin=sql.indexOf('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'),commit=sql.indexOf('COMMIT');
 const unlock=sql.findIndex(s=>s.startsWith('SELECT pg_advisory_unlock_shared'));
 assert.ok(lock>=0&&lock<begin&&begin<commit&&commit<unlock);
 const count=sql.length;await assert.rejects(escaped.query('SELECT escaped'),/RETENTION_INVALID_REQUEST/);
 assert.equal(pool.made[0].statements.length,count);
});

test('snapshot refusal rolls back before unlock, while an interrupted query retires the single held lease',{timeout:2000},async()=>{
 const pool=syntheticPool({max:1}),journal=createPostgresRetentionJournal({pool,maxRequestMs:200});
 await journal.withTransition(key(),async()=>{
  await assert.rejects(journal.withSnapshot(async()=>{throw Object.assign(Error('invalid inventory'),{code:'RETENTION_INVALID_REQUEST'});}),/RETENTION_INVALID_REQUEST/);
  await journal.get(key());
 });
 assert.equal(pool.connects(),1);assert.ok(reused(pool.made[0]));
 const sql=pool.made[0].statements.map(s=>s.sql);
 assert.ok(sql.indexOf('ROLLBACK')<sql.findIndex(s=>s.startsWith('SELECT pg_advisory_unlock_shared')));
 for(const cancelled of [false,true]){
  const bad=syntheticPool({max:1,faults:{'SELECT stall':'hang'}}),j=createPostgresRetentionJournal({pool:bad,maxRequestMs:50}),abort=new AbortController();
  await assert.rejects(j.withTransition(key(),()=>j.withSnapshot(async reader=>{
   const pending=reader.query('SELECT stall');if(cancelled)abort.abort();await pending;
  },{deadlineMs:Date.now()+100,signal:abort.signal})),/RETENTION_STORE_UNAVAILABLE/);
  assert.equal(bad.connects(),1);assert.ok(retired(bad.made[0]));assert.equal(bad.made[0].queries.includes('ROLLBACK'),false);
 }
});
