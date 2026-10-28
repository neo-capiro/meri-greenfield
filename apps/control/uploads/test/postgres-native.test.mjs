/** Explicitly selected task-owned PG16 proof; never a live database or a default test discovery target. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {randomBytes} from 'node:crypto';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresUploadStore} from '../postgres-store.mjs';
import {hash} from '../custody.mjs';
const config=JSON.parse(readFileSync(process.env.MERI_UPLOAD_PG_CONFIG,'utf8'));
if(config.marker!=='wave5-a5-publication-pages-20261027'||config.host!=='127.0.0.1'||!config.name.startsWith('w5-a5-pages-20261027-'))throw Error('OWNED_DATABASE_REQUIRED');
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,check=()=>{},at=1800000000000;
const owner={tenantId:'synthetic',actorId:'synthetic-owner',conversationId:id(1),clientId:null};
const record=(n=2)=>({uploadId:id(n),requestId:id(3),owner,declaration:{filename:'original.txt',mimeType:'text/plain',bytes:1,sha256:'a'.repeat(64)},
 scopes:[{tenantId:owner.tenantId,kind:'private-user',resourceId:owner.actorId,policyRevision:'p'}],objectId:id(n+100),object:null,state:'prepared',inspection:null,createdAtMs:at,updatedAtMs:at,revision:0});
test('actual PG16 custody: grants, concurrent replay, immutable originals, CAS and restart recovery',async()=>{
 const database='w5_upload_custody_'+randomBytes(5).toString('hex'),connection={host:config.host,port:config.port,user:'postgres',password:config.password,connectionTimeoutMillis:5000,query_timeout:7000};
 const admin=new pg.Client({...connection,database:'postgres'});await admin.connect();let setup,pool;
 try{
  assert.match((await admin.query('SELECT version() AS v')).rows[0].v,/PostgreSQL 16\.15/);
  const exists=(await admin.query("SELECT rolname FROM pg_roles WHERE rolname='meri_control_runtime'")).rows.length;
  if(!exists)await admin.query('CREATE ROLE meri_control_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT');
  await admin.query(`CREATE DATABASE ${database}`);setup=new pg.Client({...connection,database});await setup.connect();
  for(const name of ['0001_upload_custody.sql','0002_control_grants.sql'])await setup.query(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  // Each lease assumes exactly the production grant role. No table owner/superuser rights reach the adapter.
  pool=new pg.Pool({...connection,database,max:4});const borrowed={async connect(){const c=await pool.connect();await c.query('SET ROLE meri_control_runtime');return c;}};
  const store=createPostgresUploadStore({pool:borrowed}),r=record();
  const unused={...record(8),requestId:id(9)};await store.prepare(unused,check);
  const cancelled={...unused,state:'removed',revision:1};await store.transition(unused,cancelled,check);assert.deepEqual(await store.read(owner,unused.uploadId,check),cancelled);
  const replays=await Promise.all([r,record(4),record(5)].map(value=>store.prepare(value,check)));
  assert.ok(replays.every(v=>v.uploadId===r.uploadId));assert.equal((await setup.query('SELECT count(*)::int AS n FROM meri_uploads.originals')).rows[0].n,2);
  await assert.rejects(store.prepare({...record(6),declaration:{...r.declaration,filename:'different.txt'}},check),{code:'UPLOAD_REQUEST_CONFLICT'});
  assert.equal(await store.read({...owner,actorId:'other'},r.uploadId,check),null);assert.equal(await store.read({...owner,tenantId:'other'},r.uploadId,check),null);
  const writing={...r,state:'writing',revision:1},race=await Promise.allSettled([store.transition(r,writing,check),store.transition(r,writing,check)]);
  assert.equal(race.filter(v=>v.status==='fulfilled').length,1);
  const object={objectId:r.objectId,versionId:'NATIVE_ORIGINAL_VERSION',sha256:r.declaration.sha256,bytes:1,scopes:r.scopes},stored={...writing,state:'stored',object,revision:2};
  await store.transition(writing,stored,check);assert.deepEqual(await createPostgresUploadStore({pool:borrowed}).read(owner,r.uploadId,check),stored);
  const client=await borrowed.connect();try{
   await assert.rejects(client.query('UPDATE meri_uploads.originals SET owner_actor_id=$1',['other']),/permission denied/);
   const changed={...stored,declaration:{...stored.declaration,filename:'forged.txt'},revision:3};
   await assert.rejects(client.query('UPDATE meri_uploads.originals SET record=$1,record_sha256=$2,revision=3',[changed,hash(changed)]),/UPLOAD_ORIGINAL_IMMUTABLE/);
   const changedObject={...stored,object:{...object,versionId:'FORGED'},revision:3};
   await assert.rejects(client.query('UPDATE meri_uploads.originals SET record=$1,record_sha256=$2,revision=3',[changedObject,hash(changedObject)]),/UPLOAD_ORIGINAL_IMMUTABLE/);
  }finally{client.release();}
  console.log(JSON.stringify({database,postgres:'16.15',concurrentReplayRows:1,casWinners:1,nativeVersionRetained:true,identityUpdateDenied:true,projectionForgeryDenied:true}));
 }finally{await pool?.end();await setup?.end();await admin.end();}
});
