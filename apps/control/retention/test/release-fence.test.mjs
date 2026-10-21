/** Real canonical retention startup/owners over synthetic stores; PostgreSQL adapter fault tests use a scripted pool. No live DB. */
import test from 'node:test';import assert from 'node:assert/strict';
import {composeStartup,subjectOf,ownership} from './fixture.mjs';
import {createRetentionStartup} from '../startup.mjs';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../postgres-watermark.mjs';
import {watermarkedJournal} from '../recovery-watermark.mjs';
import {createServingFence} from '../serving-fence.mjs';
import {createRetentionReadGate} from '../suppression.mjs';
import {createConversationHistoryService} from '../../conversations/history/service.mjs';
import {hash,subjectKey} from '../boundary.mjs';
const deferred=()=>Promise.withResolvers();

for(const phase of ['authorization','later-subject-read'])test(`canonical release keeps earlier subject protected during awaited ${phase}`,async()=>{
 const f=composeStartup(),a=subjectOf(),b=subjectOf();await f.startup.start();
 const entered=deferred(),resume=deferred(),queued=deferred();let ack=false,published=false;
 const original=f.journal.withTransition,writerJournal={...f.journal,withTransition(key,fn){queued.resolve();return original(key,fn);}};
 const suppressor=createRetentionStartup({ledgerMaxHeadMs:10000,journal:writerJournal,watermark:f.watermark,ledgerSink:f.sink,ownership,purge:{enabled:false},now:f.clock.now});await suppressor.start();
 const release=f.startup.gate.withRelease([a,b,a],async()=>{
  if(phase==='authorization'){entered.resolve();await resume.promise;}
  await f.startup.gate.assertServable(a);
  if(phase==='later-subject-read'){entered.resolve();await resume.promise;}
  await f.startup.gate.assertServable(b);assert.equal(ack,false);published=true;return JSON.stringify({ids:[a.subjectId,b.subjectId]});
 },{deadlineMs:Date.now()+2000});
 await entered.promise;const suppression=suppressor.suppression.suppress({principal:f.principal,subject:a,reason:'A while B pending'}).then(()=>{ack=true;assert.equal(published,true);});
 await queued.promise;await new Promise(setImmediate);assert.equal(ack,false);assert.equal((await f.sink.read()).length,0,'exclusive transition cannot append during the page release');
 resume.resolve();assert.deepEqual(JSON.parse(await release).ids,[a.subjectId,b.subjectId]);await suppression;
 await assert.rejects(f.startup.gate.assertServable(a),/RETENTION_SUPPRESSED/);
});

test('canonical release sees suppression that acquired its transition lock first',async()=>{
 const f=composeStartup(),a=subjectOf();await f.startup.start();
 await f.startup.suppression.suppress({principal:f.principal,subject:a,reason:'before release'});let published=false;
 await assert.rejects(f.startup.gate.withRelease([a],async()=>{await f.startup.gate.assertServable(a);published=true;}),/RETENTION_SUPPRESSED/);assert.equal(published,false);
});

for(const mode of ['deadline','cancel','denied'])test(`canonical ${mode} release frees subject locks without late publication`,async()=>{
 const f=composeStartup(),a=subjectOf(),controller=new AbortController(),entered=deferred(),resume=deferred();await f.startup.start();let published=false;
 const pending=f.startup.gate.withRelease([a],async signal=>{entered.resolve();await resume.promise;signal.throwIfAborted();if(mode==='denied')throw Error('authorization denied');published=true;},{signal:controller.signal,deadlineMs:Date.now()+(mode==='deadline'?30:2000)});
 await entered.promise;
 if(mode==='cancel')controller.abort();if(mode==='denied')resume.resolve();
 await assert.rejects(pending,mode==='denied'?/authorization denied/:/RETENTION_READ_UNAVAILABLE/);
 await f.startup.suppression.suppress({principal:f.principal,subject:a,reason:'after failed release'});
 resume.resolve();await new Promise(setImmediate);assert.equal(published,false);await assert.rejects(f.startup.gate.assertServable(a),/RETENTION_SUPPRESSED/);
});

test('concurrent pages with reversed subject order share a deterministic fence without deadlock',async()=>{
 const f=composeStartup(),a=subjectOf(),b=subjectOf(),entered=deferred(),resume=deferred();await f.startup.start();let readers=0;
 const read=subjects=>f.startup.gate.withRelease(subjects,async()=>{if(++readers===2)entered.resolve();await resume.promise;for(const s of subjects)await f.startup.gate.assertServable(s);return true;},{deadlineMs:Date.now()+2000});
 const pages=[read([a,b]),read([b,a])];await entered.promise;resume.resolve();assert.deepEqual(await Promise.all(pages),[true,true]);
});

function poolWith({hangLock=false,unlock=false,connectDelay=0}={}){
 const clients=[];return {clients,async connect(){if(connectDelay)await new Promise(r=>setTimeout(r,connectDelay));const client={queries:[],releases:[],locks:0,async query(sql,args){this.queries.push({sql,args});if(sql.startsWith('SELECT pg_advisory_lock_shared')&&(hangLock===true||++this.locks===hangLock))return new Promise(()=>{});if(sql.startsWith('SELECT pg_advisory_unlock_shared')){if(unlock==='hang')return new Promise(()=>{});if(unlock==='throw')throw Error('unlock failed');return {rows:[{unlocked:!unlock}]};}return {rows:[]};},release(error){this.releases.push(error);}};clients.push(client);return client;}};
}
/** A pg-compatible, capacity-bound synthetic pool. A held session lock consumes its lease until release. */
function boundedHistoryPool(max){
 const clients=[],idle=[],waiters=[],events=[],projections=new Map(),locks=new Map();let live=0,active=0,peak=0,checkouts=0,queued=0;
 let position={sequence:0,entrySha256:null};
 const state=key=>{if(!locks.has(key))locks.set(key,{shared:new Set(),exclusive:null,waiting:[]});return locks.get(key);};
 const pump=lock=>{if(lock.exclusive||lock.shared.size||!lock.waiting.length)return;
  if(lock.waiting[0].mode==='exclusive'){const next=lock.waiting.shift();lock.exclusive=next.client;next.resolve();return;}
  while(lock.waiting[0]?.mode==='shared'){const next=lock.waiting.shift();lock.shared.add(next.client);next.resolve();}};
 const acquire=(client,key,mode)=>{const lock=state(key);
  if(mode==='shared'&&!lock.exclusive&&!lock.waiting.length){lock.shared.add(client);return Promise.resolve();}
  if(mode==='exclusive'&&!lock.exclusive&&!lock.shared.size&&!lock.waiting.length){lock.exclusive=client;return Promise.resolve();}
  return new Promise(resolve=>lock.waiting.push({client,mode,resolve}));};
 const unlock=(client,key,mode)=>{const lock=state(key),held=mode==='shared'?lock.shared.delete(client):lock.exclusive===client;
  if(mode==='exclusive'&&held)lock.exclusive=null;pump(lock);return held;};
 const lockKey=(sql,args)=>args?.[0]??(sql.includes('meri_retention_recovery')?'meri_retention_recovery':null);
 const client=()=>{const c={queries:[],releases:[],async query(sql,args){this.queries.push({sql,args});events.push({type:'query',sql,args,client:this});
   if(sql.startsWith('SELECT pg_advisory_lock_shared')){await acquire(this,lockKey(sql,args),'shared');return {rows:[]};}
   if(sql.startsWith('SELECT pg_advisory_lock(')){await acquire(this,lockKey(sql,args),'exclusive');return {rows:[]};}
   if(sql.startsWith('SELECT pg_advisory_unlock_shared'))return {rows:[{unlocked:unlock(this,lockKey(sql,args),'shared')}]};
   if(sql.startsWith('SELECT pg_advisory_unlock('))return {rows:[{unlocked:unlock(this,lockKey(sql,args),'exclusive')}]};
   if(sql.startsWith('SELECT s.projection,')){const p=projections.get(`${args[0]}:conversation:${args[1]}`)??null;return {rows:[{projection:p,projection_sha256:p?hash(p):null,state:p?.state??null,ledger_sequence:p?.ledgerSequence??null,watermark_sequence:position.sequence,watermark_entry_sha256:position.entrySha256}]};}
   return {rows:[]};},release(error){this.releases.push(error);active--;events.push({type:'release',error,client:this});
    if(error){live--;for(const lock of locks.values()){lock.shared.delete(this);if(lock.exclusive===this)lock.exclusive=null;pump(lock);}}else idle.push(this);drain();}};clients.push(c);live++;return c;};
 const lease=()=>{const c=idle.pop()??client();active++;peak=Math.max(peak,active);return c;};
 const drain=()=>{while(waiters.length&&(idle.length||live<max))waiters.shift()(lease());};
 return {clients,events,connects:()=>checkouts,queued:()=>queued,waiting:()=>waiters.length,peak:()=>peak,head:()=>({...position}),
  suppress(subject){const key=subjectKey(subject),entrySha256='e'.repeat(64);projections.set(key,{state:'SUPPRESSED',ledgerSequence:1,entrySha256});position={sequence:1,entrySha256};},
  connect(){checkouts++;if(idle.length||live<max)return Promise.resolve(lease());queued++;return new Promise(resolve=>waiters.push(resolve));}};
}
function boundedHistory(max){
 const pool=boundedHistoryPool(max),journal=createPostgresRetentionJournal({pool,maxRequestMs:80}),watermark=createPostgresWatermarkStore({journal}),fence=createServingFence();
 fence.enable({watermark:pool.head()});const tracked=watermarkedJournal({journal,watermark,fence,ledger:{head:async()=>pool.head()}});
 const retention=createRetentionReadGate({journal:tracked,serving:fence});
 const service=createConversationHistoryService({retention,gate:{async recheck(){}},store:{history:{async list(){},async transcript(){}}}});
 return {pool,journal,retention,service};
}
function releaseHistoryPage(f,s,{recheckMembership=async()=>{},publish=x=>x}={}){
 return f.service.recheckRelease({principal:{tenantId:s.tenantId,actorId:s.ownerActorId},request:{},result:{conversations:[{conversationId:s.subjectId,scopes:[]}]},operation:'list',deadlineMs:Date.now()+500,
  recheckMembership,async recheckConversation(){},publish});
}
function releaseHistoryTranscript(f,s,{publish=x=>x}={}){
 return f.service.recheckRelease({principal:{tenantId:s.tenantId,actorId:s.ownerActorId},request:{conversationId:s.subjectId},result:{conversation:{conversationId:s.subjectId,scopes:[]}},operation:'transcript',deadlineMs:Date.now()+500,
  async recheckMembership(){},async recheckConversation(){},publish});
}
test('bounded pool: one PostgreSQL lease completes the canonical saved-history release and returns clean',async()=>{
 const f=boundedHistory(1),subject=subjectOf();let published=0;
 const result=await releaseHistoryPage(f,subject,{publish:value=>{published++;return value;}});
 assert.deepEqual(result.conversations.map(c=>c.conversationId),[subject.subjectId]);assert.equal(published,1);
 assert.equal(f.pool.connects(),1,'the fenced projection and watermark proof uses the held lease');assert.equal(f.pool.queued(),0);
 assert.equal(f.pool.peak(),1);assert.deepEqual(f.pool.clients[0].releases,[undefined]);
 const statements=f.pool.clients[0].queries.map(q=>q.sql),joined=statements.findIndex(sql=>sql.startsWith('SELECT s.projection,'));
 assert.ok(statements[0].startsWith('SELECT pg_advisory_lock_shared'));
 assert.ok(statements[joined-1].includes('pg_advisory_lock_shared')&&statements[joined-1].includes('meri_retention_recovery'));
 assert.ok(statements[joined+1].includes('pg_advisory_unlock_shared')&&statements[joined+1].includes('meri_retention_recovery'));
 assert.ok(statements.at(-1).startsWith('SELECT pg_advisory_unlock_shared'));
});
test('bounded pool: two concurrent saved-history releases never request a third lease',async()=>{
 const f=boundedHistory(2),a=subjectOf(),b=subjectOf(),entered=deferred(),resume=deferred();let arrivals=0,published=0;
 const recheckMembership=async()=>{if(++arrivals===2)entered.resolve();await resume.promise;};
 const pages=[a,b].map(subject=>releaseHistoryPage(f,subject,{recheckMembership,publish:value=>{published++;return value;}}));
 await entered.promise;assert.equal(f.pool.peak(),2);resume.resolve();await Promise.all(pages);
 assert.equal(published,2);assert.equal(f.pool.connects(),2);assert.equal(f.pool.queued(),0);assert.equal(f.pool.waiting(),0);
 assert.ok(f.pool.clients.every(c=>c.releases.length===1&&c.releases[0]===undefined));
});
test('bounded pool: a saved page publishes before queued suppression acknowledges, then the subject is refused',async()=>{
 const f=boundedHistory(2),subject=subjectOf(),entered=deferred(),resume=deferred(),order=[];
 const page=releaseHistoryPage(f,subject,{async recheckMembership(){entered.resolve();await resume.promise;},publish:value=>{order.push('page');return value;}});
 await entered.promise;
 const suppression=f.journal.withTransition(subjectKey(subject),async()=>{f.pool.suppress(subject);order.push('suppressed');});
 await new Promise(setImmediate);assert.deepEqual(order,[],'exclusive transition waits for the page shared lock');
 resume.resolve();await page;await suppression;assert.deepEqual(order,['page','suppressed']);
 const after=await releaseHistoryPage(f,subject);assert.deepEqual(after.conversations,[],'a later page excludes the suppressed subject');
 assert.equal(f.pool.queued(),0);assert.ok(f.pool.clients.every(c=>c.releases.every(error=>error===undefined)));
});
test('bounded pool: suppression that owns the transition lock first prevents transcript publication',async()=>{
 const f=boundedHistory(2),subject=subjectOf(),entered=deferred(),resume=deferred();let published=0;
 const suppression=f.journal.withTransition(subjectKey(subject),async()=>{f.pool.suppress(subject);entered.resolve();await resume.promise;});
 await entered.promise;const transcript=releaseHistoryTranscript(f,subject,{publish:value=>{published++;return value;}});
 await new Promise(setImmediate);assert.equal(published,0);resume.resolve();await suppression;
 await assert.rejects(transcript,/CONVERSATION_UNAVAILABLE/);assert.equal(published,0);
 assert.equal(f.pool.queued(),0);assert.ok(f.pool.clients.every(c=>c.releases.every(error=>error===undefined)));
});
test('bounded pool: failed final authorization returns the session and cannot publish late',async()=>{
 const f=boundedHistory(1),subject=subjectOf();let published=0;
 await assert.rejects(releaseHistoryPage(f,subject,{async recheckMembership(){throw Error('denied');},publish(){published++;}}),/CONVERSATION_UNAVAILABLE/);
 assert.equal(published,0);assert.equal(f.pool.clients.length,1);assert.deepEqual(f.pool.clients[0].releases,[undefined]);
 await releaseHistoryPage(f,subject,{publish:value=>{published++;return value;}});
 assert.equal(published,1);assert.equal(f.pool.clients.length,1,'the clean lease is reusable after an authorization denial');
 assert.deepEqual(f.pool.clients[0].releases,[undefined,undefined]);assert.equal(f.pool.queued(),0);
});
test('bounded pool: scoped projection and schedule reads cannot escape locked subjects or released lease',async()=>{
 const f=boundedHistory(1),a=subjectOf(),b=subjectOf();let saved,scheduleRead;
 await f.retention.withRelease([a],async(_signal,assertLocked,readScheduleOriginRows)=>{
  saved=assertLocked;scheduleRead=readScheduleOriginRows;assert.equal(typeof scheduleRead,'function');
  assert.throws(()=>assertLocked(b),/RETENTION_INVALID_REQUEST/);
  await assert.rejects(scheduleRead({tenantId:b.tenantId,conversationId:b.subjectId}),/RETENTION_INVALID_REQUEST/);
  assert.deepEqual(await scheduleRead({tenantId:a.tenantId,conversationId:a.subjectId}),[]);
  await assertLocked(a);
 });
 assert.throws(()=>saved(a),/RETENTION_READ_UNAVAILABLE/);
 assert.throws(()=>scheduleRead({tenantId:a.tenantId,conversationId:a.subjectId}),/RETENTION_READ_UNAVAILABLE/);
 assert.equal(f.pool.connects(),1);assert.deepEqual(f.pool.clients[0].releases,[undefined]);
});
test('PostgreSQL page fence uses one lease and sorted shared locks matching suppression, then unlocks in reverse order',async()=>{
 const pool=poolWith(),journal=createPostgresRetentionJournal({pool,maxRequestMs:1000}),a=subjectKey(subjectOf()),b=subjectKey(subjectOf());
 assert.equal(await journal.withServing([b,a,b],async()=>{assert.equal(pool.clients.length,1);assert.equal(pool.clients[0].queries.length,3);return 'published';}), 'published');
 const calls=pool.clients[0].queries,keys=[a,b].sort();assert.deepEqual(calls.slice(0,2).map(c=>c.args[0]),keys.map(k=>'meri_retention_transition:'+k));assert.ok(calls.slice(0,2).every(c=>c.sql.startsWith('SELECT pg_advisory_lock_shared')));
 assert.ok(calls[2].sql.includes('pg_advisory_lock_shared')&&calls[2].sql.includes('meri_retention_recovery'));
 assert.ok(calls[3].sql.includes('pg_advisory_unlock_shared')&&calls[3].sql.includes('meri_retention_recovery'));
 assert.deepEqual(calls.slice(4).map(c=>c.args[0]),keys.toReversed().map(k=>'meri_retention_transition:'+k));assert.deepEqual(pool.clients[0].releases,[undefined]);
});
test('PostgreSQL page fence drains an unawaited scheduled read before unlock and refuses its response',async()=>{
 const entered=deferred(),resume=deferred(),pool=poolWith(),connect=pool.connect;
 pool.connect=async()=>{const client=await connect.call(pool),query=client.query;client.query=async function(sql,args){
  if(sql.startsWith('SELECT tenant_id,generation,occurrence_key')){entered.resolve();await resume.promise;return {rows:[]};}
  return query.call(this,sql,args);
 };return client;};
 const journal=createPostgresRetentionJournal({pool,maxRequestMs:1000}),s=subjectOf(),key=subjectKey(s);
 const result=journal.withServing([key],(_signal,scoped)=>{scoped.readScheduleOriginRows({tenantId:s.tenantId,conversationId:s.subjectId});return 'published';});
 await entered.promise;assert.equal(pool.clients[0].queries.filter(q=>q.sql.startsWith('SELECT pg_advisory_unlock_shared')).length,0);
 resume.resolve();await assert.rejects(result,/RETENTION_READ_UNAVAILABLE/);
 assert.deepEqual(pool.clients[0].releases,[undefined],'a completed read leaves a clean unlocked session');
});
for(const mode of ['cancel','deadline','unlock-unknown','late-lease'])test(`PostgreSQL ${mode} page fence retires unknown session state`,async()=>{
 const pool=poolWith({hangLock:mode==='cancel'||mode==='deadline',unlock:mode==='unlock-unknown',connectDelay:mode==='late-lease'?60:0}),journal=createPostgresRetentionJournal({pool,maxRequestMs:1000}),controller=new AbortController();let calls=0;
 const pending=journal.withServing([subjectKey(subjectOf())],async()=>{calls++;return 'published';},{signal:controller.signal,deadlineMs:Date.now()+30});
 if(mode==='cancel'){await new Promise(setImmediate);controller.abort();}
 await assert.rejects(pending,/RETENTION_(READ_UNAVAILABLE|UNLOCK_UNKNOWN)/);if(mode==='late-lease')await new Promise(r=>setTimeout(r,80));
 assert.equal(calls,mode==='unlock-unknown'?1:0);assert.equal(pool.clients.length,1);assert.equal(pool.clients[0].releases.length,1);assert.ok(pool.clients[0].releases[0] instanceof Error);if(mode==='late-lease')assert.deepEqual(pool.clients[0].queries,[]);
});

test('PostgreSQL clean fence preserves callback authorization denial and frees its session',async()=>{
 const pool=poolWith(),journal=createPostgresRetentionJournal({pool,maxRequestMs:1000}),denied=Object.assign(Error('owned denial'),{code:'ACCESS_DENIED'});
 await assert.rejects(journal.withServing([subjectKey(subjectOf())],async()=>{throw denied;}),error=>error===denied);assert.deepEqual(pool.clients[0].releases,[undefined]);
});

for(const adapter of ['memory','postgres'])test(`history cannot publish after an internal ${adapter} fence deadline while its HTTP signal stays active`,async()=>{
 const f=composeStartup(),a=subjectOf(),entered=deferred(),resume=deferred(),http=new AbortController();await f.startup.start();
 const pool=poolWith(),journal=createPostgresRetentionJournal({pool,maxRequestMs:30});let published=0;
 const retention=adapter==='memory'?{...f.startup.gate,withRelease:(subjects,fn,options)=>f.startup.gate.withRelease(subjects,fn,{...options,deadlineMs:Date.now()+30})}:{...f.startup.gate,withRelease:(subjects,fn,options)=>journal.withServing(subjects.map(subjectKey),(signal)=>fn(signal,s=>f.startup.gate.assertServable(s)),options)};
 const conversation={conversationId:a.subjectId,scopes:[]},service=createConversationHistoryService({retention,gate:{async recheck(){}},store:{history:{async list(){},async transcript(){}}}});
 const pending=service.recheckRelease({principal:f.principal,request:{},result:{conversations:[conversation]},operation:'list',signal:http.signal,deadlineMs:Date.now()+2000,async recheckMembership(){entered.resolve();await resume.promise;},async recheckConversation(){},publish(){published++;}});
 await entered.promise;await assert.rejects(pending,/CONVERSATION_UNAVAILABLE/);assert.equal(http.signal.aborted,false,'outer HTTP authority remains active past the internal fence deadline');
 resume.resolve();await new Promise(setImmediate);assert.equal(published,0);if(adapter==='postgres')assert.ok(pool.clients[0].releases[0] instanceof Error);
});

for(const mode of ['failed-unlock','stalled-unlock','partial-acquire'])test(`PostgreSQL ${mode} page fence retires the session within its original bound`,async()=>{
 const pool=poolWith({unlock:mode==='failed-unlock'?'throw':mode==='stalled-unlock'?'hang':false,hangLock:mode==='partial-acquire'?2:false}),journal=createPostgresRetentionJournal({pool,maxRequestMs:30});let called=false;
 await assert.rejects(journal.withServing([subjectKey(subjectOf()),subjectKey(subjectOf())],async()=>{called=true;return 'published';}),/RETENTION_(STORE_UNAVAILABLE|READ_UNAVAILABLE)/);
 assert.equal(called,mode!=='partial-acquire');assert.equal(pool.clients.length,1);assert.equal(pool.clients[0].releases.length,1);assert.ok(pool.clients[0].releases[0] instanceof Error);
 if(mode==='partial-acquire')assert.equal(pool.clients[0].queries.filter(q=>q.sql.startsWith('SELECT pg_advisory_unlock_shared')).length,0,'do not enqueue unlocks behind a stalled partial acquisition');
});
