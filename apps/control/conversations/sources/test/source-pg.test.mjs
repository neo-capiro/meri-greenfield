/** Release-run native PG16 gate. Requires a dedicated migrated database and ordinary role;
 * does not provision, migrate, drop or reset anything. Missing allocation fails, never skips. */
import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';
import {createPostgresConversationStore} from '../../postgres-store.mjs';
import {binding,scopes,seedStore,status,proof,check} from './fixture.mjs';
import {createBillTextSourceCapture} from '../bill-text.mjs';
import {id} from '../../test/store-fixture.mjs';
test('native bill source transaction, replay, lost acknowledgement and completed history under an ordinary PG16 role',{timeout:30000},async t=>{
 const host=process.env.MERI_BILL_SOURCE_TEST_HOST,database=process.env.MERI_BILL_SOURCE_TEST_DATABASE,user=process.env.MERI_BILL_SOURCE_TEST_USER,port=Number(process.env.MERI_BILL_SOURCE_TEST_PORT);
 assert.ok(typeof host==='string'&&(host.startsWith('/tmp/')||host==='127.0.0.1'),'explicit isolated local PG host required');
 assert.match(database??'',/^meri_mf16_source_[a-z0-9_]+$/u);assert.match(user??'',/^meri_mf16_app_[a-z0-9_]+$/u);assert.ok(Number.isSafeInteger(port)&&port>=1024&&port<=65535);
 const pool=new pg.Pool({host,database,user,port,max:3,connectionTimeoutMillis:5000,query_timeout:5000});t.after(()=>pool.end());
 const role=(await pool.query(`SELECT current_database() AS db,current_user AS actor,session_user AS login,
  current_setting('server_version_num')::int AS version,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,
  EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS membership,
  EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='meri_conversations'::regnamespace AND relowner=r.oid) AS owns_tables
  FROM pg_roles r WHERE rolname=current_user`)).rows[0];
 assert.deepEqual({...role,version:0},{db:database,actor:user,login:user,version:0,rolsuper:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,membership:false,owns_tables:false});assert.ok(role.version>=160000&&role.version<170000);
 let now=1000;const store=createPostgresConversationStore({pool,now:()=>now});await seedStore(store);
 const capture=createBillTextSourceCapture({store,defaultCongress:119}),p=proof(),call={...p,scopes,check};
 await t.test('concurrent identical publications serialize to one durable event',async()=>{await Promise.all([capture(call),capture(call)]);const page=await store.read(binding,{},check);assert.equal(page.lastSequence,4);assert.equal(page.events.filter(e=>e.type==='source.native-bill-text').length,1);assert.equal(page.events.at(-1).createdAt,new Date(1000).toISOString());});
 await t.test('reconstructed owner preserves first publication and refuses changed delivery or scope',async()=>{
  now=2000;const fresh=createBillTextSourceCapture({store:createPostgresConversationStore({pool,now:()=>now}),defaultCongress:119});await fresh(call);await assert.rejects(fresh({...proof({total:13}),scopes,check}),/SOURCE_PUBLICATION_CONFLICT/);
  await assert.rejects(store.appendSource({...binding,actorId:id(80)},{eventId:p.event.eventId,type:p.event.type,data:p.event.data},check,scopes),/STALE_WRITER/);
  await assert.rejects(store.appendSource(binding,{eventId:p.event.eventId,type:p.event.type,data:p.event.data},check,[{...scopes[0],resourceId:id(80)}]),/SCOPE_REFUSED/);assert.equal((await store.read(binding,{},check)).lastSequence,4);
 });
 await t.test('lost actual COMMIT acknowledgement is UNKNOWN and exact retry recovers the same row',async()=>{
  let lose=true;const wrapped={async connect(){const client=await pool.connect();return {async query(...args){const result=await client.query(...args);if(args[0]==='COMMIT'&&lose){lose=false;throw Error('synthetic acknowledgement loss after actual COMMIT');}return result;},release:error=>client.release(error)};}};
  const second=proof({deliveryId:'second-page-read'}),unknown=createBillTextSourceCapture({store:createPostgresConversationStore({pool:wrapped,now:()=>3000}),defaultCongress:119});await assert.rejects(unknown({...second,scopes,check}),/SOURCE_PUBLICATION_UNKNOWN/);
  now=4000;await capture({...second,scopes,check});const page=await store.read(binding,{},check);assert.equal(page.lastSequence,5);assert.equal(page.events.at(-1).createdAt,new Date(3000).toISOString());
 });
 await t.test('completed transcript and exact source survive reload while foreign selectors and late publication refuse',async()=>{
  await store.append(binding,status(10,'completed'),check);const fresh=createPostgresConversationStore({pool}),principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[id(5)]},query={principal,conversationId:binding.conversationId,runId:binding.runId,referenceId:p.event.eventId};
  const source=await fresh.history.source(query,check);assert.equal(source.event.data.resultSha256,p.response.resultSha256);assert.equal(source.event.createdAt,new Date(1000).toISOString());
  const history=await fresh.history.transcript({principal,conversationId:binding.conversationId,after:0,limit:100},check);assert.equal(history.latestRun.state,'completed');assert.equal(history.events.filter(e=>e.event.type==='source.native-bill-text').length,2);
  for(const change of [{actorId:id(80)},{tenantId:id(80)},{clientIds:[]}])await assert.rejects(fresh.history.source({...query,principal:{...principal,...change}},check));
  await assert.rejects(fresh.history.source({...query,referenceId:id(80)},check),/SOURCE_REFERENCE_NOT_FOUND/);await assert.rejects(capture({...proof({deliveryId:'late'}),scopes,check}),/NOT_WRITABLE/);
  assert.equal((await fresh.read(binding,{},check)).lastSequence,6);
 });
});
