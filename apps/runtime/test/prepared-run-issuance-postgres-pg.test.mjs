/** Real task-owned PostgreSQL 16 with migration meri_conversations 0011 applied by provision-postgres.sh: the durable issuance store
 * adapter and the issuer over it. Concurrency from two connections, restart (a new adapter and issuer over the same database), a
 * separate OS process that claims and completes, lost acknowledgement, conflicting intents, the claim fence, immutability, the facts
 * compare-or-set and the absence of any raw credential in the row. Synthetic bindings and material only. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';
import pg from '../node_modules/pg/lib/index.js';
import {createPostgresIssuanceStore} from '../prepared-run-issuance-postgres.mjs';
import {createPreparedRunIssuer} from '../prepared-run-issuer.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const socket=process.env.MERI_BROKER_TEST_SOCKET??'/tmp/meri-broker-pg-socket-20261014';
const binding=(fence=1,extra={})=>({tenantId:'tenant-a',actorId:'actor-a',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:fence,...extra});
const intentFor=(b,now)=>({issuanceKey:hash(b),binding:b,requestSha256:hash({prompt:'p'}),expiresAtMs:now+600000});
function authority(){const materials=new Map(),stats={generate:0,retrieve:0,status:0};
 return {stats,materials,
  async generate({issuanceKey}){stats.generate++;const grantId=randomUUID(),capability='synthetic-material-'+randomUUID(),materialRef='ref-'+randomUUID();materials.set(materialRef,{capability,grantId,issuanceKey});return {grantId,capability,materialRef};},
  async retrieve({materialRef,grantId}){stats.retrieve++;const m=materials.get(materialRef);if(!m||m.grantId!==grantId)return {state:'ABSENT'};return {state:'PRESENT',capability:m.capability};},
  async status({issuanceKey}){stats.status++;const e=[...materials].find(([,v])=>v.issuanceKey===issuanceKey);return e?{state:'PRESENT',grantId:e[1].grantId,capabilitySha256:capabilityDigest(e[1].capability),materialRef:e[0]}:{state:'ABSENT'};}};}
async function fixture(t){
 const pool=new pg.Pool({host:socket,user:'postgres',database:'postgres',max:6});t.after(()=>pool.end());
 assert.equal((await pool.query("SELECT current_setting('listen_addresses') AS l")).rows[0].l,'','task-owned socket-only cluster');
 await pool.query('TRUNCATE meri_conversations.run_issuances');
 const store=createPostgresIssuanceStore({pool});let t0=1_800_000_000_000;const now=()=>t0;
 return {pool,store,now,advance(ms){t0+=ms;},rowText:async key=>(await pool.query('SELECT row_to_json(r)::text AS t FROM meri_conversations.run_issuances r WHERE issuance_key=$1',[key])).rows[0]?.t??''};
}
test('claim is an atomic absent-row insert from two connections; the same run with a different binding collides; a different intent for the key is refused; the fence binds completion; identity and facts are immutable in the adapter and the trigger',async t=>{
 const f=await fixture(t),other=new pg.Pool({host:socket,user:'postgres',database:'postgres',max:4});t.after(()=>other.end());const second=createPostgresIssuanceStore({pool:other});
 const b=binding(),intent=intentFor(b,f.now());assert.equal(await f.store.read({issuanceKey:intent.issuanceKey}),null);
 const [a1,a2]=await Promise.all([f.store.claim(intent),second.claim(intent)]);assert.deepEqual([a1.fresh,a2.fresh].sort(),[true,undefined],'exactly one fresh claim');
 const fresh=a1.fresh?a1:a2,late=a1.fresh?a2:a1;assert.equal(fresh.state,'CLAIMED');assert.equal(late.state,'CLAIMED');assert.equal(late.claimFence,fresh.claimFence,'the late claimer sees the winner\'s fence');assert.equal(fresh.version,1);
 await assert.rejects(f.store.claim({...intent,requestSha256:hash({prompt:'other'})}),/ISSUANCE_STORE_INTENT_CONFLICT/);await assert.rejects(f.store.claim({...intent,expiresAtMs:intent.expiresAtMs+1}),/ISSUANCE_STORE_INTENT_CONFLICT/);
 const sameRun={...b,attemptId:randomUUID()};await assert.rejects(f.store.claim(intentFor(sameRun,f.now())),/ISSUANCE_STORE_INTENT_CONFLICT/,'one issuance per (tenant, conversation, run): a second binding for the same run collides');
 await assert.rejects(f.store.claim({...intent,issuanceKey:'0'.repeat(64)}),/ISSUANCE_STORE_INVALID/);
 const identity={grantId:randomUUID(),capabilitySha256:'a'.repeat(64),materialRef:'ref-'+randomUUID()};
 await assert.rejects(f.store.complete({issuanceKey:intent.issuanceKey,...identity,claimFence:randomUUID()}),/ISSUANCE_STORE_CLAIM_FENCED/,'another fence cannot complete this claim');
 assert.equal((await f.store.read({issuanceKey:intent.issuanceKey})).state,'CLAIMED');
 const issued=await f.store.complete({issuanceKey:intent.issuanceKey,...identity,claimFence:fresh.claimFence});assert.equal(issued.state,'ISSUED');assert.equal(issued.version,2);assert.equal(issued.materialRef,identity.materialRef);
 assert.deepEqual(await second.complete({issuanceKey:intent.issuanceKey,...identity}),issued,'an exact replay (lost acknowledgement) returns the identical row');
 await assert.rejects(second.complete({issuanceKey:intent.issuanceKey,...identity,grantId:randomUUID()}),/ISSUANCE_STORE_ISSUED_CONFLICT/);await assert.rejects(second.complete({issuanceKey:intent.issuanceKey,...identity,materialRef:'other'}),/ISSUANCE_STORE_ISSUED_CONFLICT/);
 await assert.rejects(f.store.complete({issuanceKey:hash({x:1}),...identity}),/ISSUANCE_STORE_NOT_CLAIMED/);
 assert.equal(await f.store.materialRef({issuanceKey:intent.issuanceKey}),identity.materialRef);
 const bound=await f.store.bindFacts({issuanceKey:intent.issuanceKey,factsSha256:'f'.repeat(64)});assert.equal(bound.factsSha256,'f'.repeat(64));assert.equal(bound.version,3);
 assert.deepEqual(await second.bindFacts({issuanceKey:intent.issuanceKey,factsSha256:'f'.repeat(64)}),bound,'facts compare-or-set replays');await assert.rejects(second.bindFacts({issuanceKey:intent.issuanceKey,factsSha256:'e'.repeat(64)}),/ISSUANCE_STORE_FACTS_CONFLICT/);
 const c2=binding(),i2=intentFor(c2,f.now());await f.store.claim(i2);await assert.rejects(f.store.bindFacts({issuanceKey:i2.issuanceKey,factsSha256:'f'.repeat(64)}),/ISSUANCE_STORE_NOT_ISSUED/);await assert.rejects(f.store.materialRef({issuanceKey:i2.issuanceKey}),/ISSUANCE_STORE_NOT_ISSUED/);
 for(const [label,sql] of [['intent','UPDATE meri_conversations.run_issuances SET binding=\'{}\'::jsonb,version=version+1 WHERE issuance_key=$1'],['expiry','UPDATE meri_conversations.run_issuances SET expires_at_ms=expires_at_ms+1,version=version+1 WHERE issuance_key=$1'],['fence','UPDATE meri_conversations.run_issuances SET claim_fence=gen_random_uuid(),version=version+1 WHERE issuance_key=$1'],['identity','UPDATE meri_conversations.run_issuances SET grant_id=gen_random_uuid(),version=version+1 WHERE issuance_key=$1'],['material','UPDATE meri_conversations.run_issuances SET material_ref=\'x\',version=version+1 WHERE issuance_key=$1'],['state','UPDATE meri_conversations.run_issuances SET state=\'CLAIMED\',grant_id=NULL,capability_sha256=NULL,material_ref=NULL,issued_at=NULL,facts_sha256=NULL,version=version+1 WHERE issuance_key=$1'],['facts','UPDATE meri_conversations.run_issuances SET facts_sha256=repeat(\'e\',64),version=version+1 WHERE issuance_key=$1'],['delete','DELETE FROM meri_conversations.run_issuances WHERE issuance_key=$1']])
  await assert.rejects(f.pool.query(sql,[intent.issuanceKey]),/RUN_ISSUANCE_IMMUTABLE|RUN_ISSUANCE_FACTS_IMMUTABLE/,label+' is immutable at the database');
 await assert.rejects(f.pool.query('UPDATE meri_conversations.run_issuances SET version=version+2 WHERE issuance_key=$1',[intent.issuanceKey]),/RUN_ISSUANCE_VERSION/,'the version only increments by one');
 await assert.rejects(f.pool.query('UPDATE meri_conversations.run_issuances SET version=version WHERE issuance_key=$1',[intent.issuanceKey]),/RUN_ISSUANCE_VERSION/);
 assert.deepEqual(await f.store.read({issuanceKey:intent.issuanceKey}),bound,'nothing changed');
});
test('the issuer over the durable adapter: concurrent callers share one generation; restart replays without generating; a separate OS process that claimed and completed is recognized; a lost completion stays UNKNOWN until the authority answers; no raw material reaches the row',async t=>{
 const f=await fixture(t),a=authority(),issuer=createPreparedRunIssuer({store:f.store,authority:a,now:f.now}),b=binding(),intent=intentFor(b,f.now());
 const results=await Promise.all([issuer.issue(intent),issuer.issue(intent),createPreparedRunIssuer({store:createPostgresIssuanceStore({pool:f.pool}),authority:a,now:f.now}).issue(intent)]);
 assert.ok(results.every(r=>r.state==='ISSUED'));assert.equal(new Set(results.map(r=>r.issuance.grantId)).size,1);assert.equal(a.stats.generate,1,'exactly one generation across concurrent callers');
 const material=a.materials.get(await f.store.materialRef({issuanceKey:intent.issuanceKey})).capability;const text=await f.rowText(intent.issuanceKey);assert.ok(!text.includes(material),'the raw material is not in the row');assert.ok(text.includes(results[0].issuance.capabilitySha256));
 // Restart: a new pool, adapter and issuer over the same database.
 const pool2=new pg.Pool({host:socket,user:'postgres',database:'postgres',max:4});t.after(()=>pool2.end());const restarted=createPreparedRunIssuer({store:createPostgresIssuanceStore({pool:pool2}),authority:a,now:f.now});
 f.advance(60000);const again=await restarted.issue(intent);assert.equal(again.issuance.grantId,results[0].issuance.grantId);assert.equal(a.stats.generate,1,'restart replays, never re-mints');
 const receipt={...again.issuance,factsSha256:hash({facts:1})};const bound=await restarted.bindFacts(receipt);assert.equal(bound.factsSha256,receipt.factsSha256);assert.equal(capabilityDigest(await restarted.resolve(bound)),again.issuance.capabilitySha256);
 await assert.rejects(restarted.bindFacts({...receipt,factsSha256:hash({facts:2})}),/PREPARED_RUN_ISSUER_FACTS_CONFLICT/);
 // Separate OS process: claims and completes a different key through the adapter; this process then reads ISSUED and replays without generating.
 const b2=binding(),intent2=intentFor(b2,f.now()),identity={grantId:randomUUID(),capabilitySha256:capabilityDigest('synthetic-material-elsewhere'),materialRef:'ref-'+randomUUID()};
 const script=`import pg from ${JSON.stringify(fileURLToPath(new URL('../node_modules/pg/lib/index.js',import.meta.url)))};import {createPostgresIssuanceStore} from ${JSON.stringify(fileURLToPath(new URL('../prepared-run-issuance-postgres.mjs',import.meta.url)))};
  const pool=new pg.Pool({host:${JSON.stringify(socket)},user:'postgres',database:'postgres',max:2});const store=createPostgresIssuanceStore({pool});const intent=${JSON.stringify(intent2)};
  const claimed=await store.claim(intent);const done=await store.complete({issuanceKey:intent.issuanceKey,...${JSON.stringify(identity)},claimFence:claimed.claimFence});process.stdout.write(JSON.stringify({fresh:claimed.fresh===true,state:done.state,pid:process.pid}));await pool.end();`;
 const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{timeout:20000});const child=JSON.parse(stdout);assert.equal(child.fresh,true);assert.equal(child.state,'ISSUED');assert.notEqual(child.pid,process.pid);
 const seen=await issuer.read(intent2);assert.equal(seen.state,'ISSUED');assert.equal(seen.issuance.grantId,identity.grantId);const replay=await issuer.issue(intent2);assert.equal(replay.issuance.capabilitySha256,identity.capabilitySha256);assert.equal(a.stats.generate,1,'the other process issued; this one never generates');
 // Lost completion: a claim whose generation crashed (the authority generated, the client died before complete) reads UNKNOWN, never re-mints, and reconciles from the authority.
 const b3=binding(),intent3=intentFor(b3,f.now());const crashing={...a,async generate(x){const m=await a.generate(x);throw Object.assign(Error('SYNTHETIC_CLIENT_CRASH'),{code:'SYNTHETIC_CLIENT_CRASH',m});}};
 await assert.rejects(createPreparedRunIssuer({store:f.store,authority:crashing,now:f.now,maxRequestMs:300}).issue(intent3),/PREPARED_RUN_ISSUER_UNKNOWN/);assert.equal((await f.store.read({issuanceKey:intent3.issuanceKey})).state,'CLAIMED');
 assert.deepEqual(await restarted.read(intent3),{state:'UNKNOWN'});await assert.rejects(restarted.issue(intent3),/PREPARED_RUN_ISSUER_UNKNOWN/);assert.equal(a.stats.generate,2,'no re-mint over an uncertain claim');
 const reconciled=await restarted.reconcile(intent3);assert.equal(reconciled.state,'ISSUED');assert.equal(a.stats.generate,2,'reconciliation completes from the authority without generating');assert.equal((await f.store.read({issuanceKey:intent3.issuanceKey})).state,'ISSUED');
 // A claim whose generation never happened stays UNKNOWN through reconciliation.
 const b4=binding(),intent4=intentFor(b4,f.now());await f.store.claim(intent4);assert.deepEqual(await restarted.reconcile(intent4),{state:'UNKNOWN'});assert.equal((await f.store.read({issuanceKey:intent4.issuanceKey})).state,'CLAIMED');
 assert.throws(()=>createPostgresIssuanceStore({pool:{}}),/ISSUANCE_STORE_CONFIGURATION/);
});
