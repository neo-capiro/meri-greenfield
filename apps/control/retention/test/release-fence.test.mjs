/** Real canonical retention startup/owners over synthetic stores; PostgreSQL adapter fault tests use a scripted pool. No live DB. */
import test from 'node:test';import assert from 'node:assert/strict';
import {composeStartup,subjectOf,ownership} from './fixture.mjs';
import {createRetentionStartup} from '../startup.mjs';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createConversationHistoryService} from '../../conversations/history/service.mjs';
import {subjectKey} from '../boundary.mjs';
const deferred=()=>Promise.withResolvers();

for(const phase of ['authorization','later-subject-read'])test(`canonical release keeps earlier subject protected during awaited ${phase}`,async()=>{
 const f=composeStartup(),a=subjectOf(),b=subjectOf();await f.startup.start();
 const entered=deferred(),resume=deferred(),queued=deferred();let ack=false,published=false;
 const original=f.journal.withTransition,writerJournal={...f.journal,withTransition(key,fn){queued.resolve();return original(key,fn);}};
 const suppressor=createRetentionStartup({journal:writerJournal,watermark:f.watermark,ledgerSink:f.sink,ownership,purge:{enabled:false},now:f.clock.now});await suppressor.start();
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
test('PostgreSQL page fence uses one lease and sorted shared locks matching suppression, then unlocks in reverse order',async()=>{
 const pool=poolWith(),journal=createPostgresRetentionJournal({pool,maxRequestMs:1000}),a=subjectKey(subjectOf()),b=subjectKey(subjectOf());
 assert.equal(await journal.withServing([b,a,b],async()=>{assert.equal(pool.clients.length,1);assert.equal(pool.clients[0].queries.length,2);return 'published';}), 'published');
 const calls=pool.clients[0].queries,keys=[a,b].sort();assert.deepEqual(calls.slice(0,2).map(c=>c.args[0]),keys.map(k=>'meri_retention_transition:'+k));assert.ok(calls.slice(0,2).every(c=>c.sql.startsWith('SELECT pg_advisory_lock_shared')));
 assert.deepEqual(calls.slice(2).map(c=>c.args[0]),keys.toReversed().map(k=>'meri_retention_transition:'+k));assert.deepEqual(pool.clients[0].releases,[undefined]);
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
 const retention=adapter==='memory'?{...f.startup.gate,withRelease:(subjects,fn,options)=>f.startup.gate.withRelease(subjects,fn,{...options,deadlineMs:Date.now()+30})}:{...f.startup.gate,withRelease:(subjects,fn,options)=>journal.withServing(subjects.map(subjectKey),fn,options)};
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
