/** Actual PG16, one disposable labelled tmpfs database; production grants and canonical lookup adapter. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createPostgresTaskLookupStore} from '../postgres-results.mjs';
import {createTaskLookupDelivery} from '../delivery.mjs';
import {fixture,envelope,NOW} from '../fixtures.mjs';
import {prepare} from '../binding.mjs';
const {Pool}=createRequire(new URL('../../../runtime/package.json',import.meta.url))('pg');
test('ordinary-role attended lookup claims serialize existing event slots and roll back atomically',{skip:process.env.MERI_STANDALONE_LOOKUP_PG!=='1',timeout:120000},async t=>{
 const name='meri-attended-lookup-'+randomUUID(),call=(args,input)=>spawnSync(process.platform==='win32'?'wsl.exe':'docker',process.platform==='win32'?['-d','Codex-Gates','--','docker',...args]:args,{input,encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:1048576});
 const docker=(args,input)=>{const p=call(args,input);assert.equal(p.status,0,p.stderr);return p.stdout.trim();};
 let created=false,pool;
 try{
  assert.equal(docker(['ps','-aq','--filter','name=^/'+name+'$']),'');
  docker(['run','-d','--name',name,'--label','meri-test-owner='+name,'--tmpfs','/var/lib/postgresql/data','-p','127.0.0.1::5432','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=attended_lookup','pgvector/pgvector:pg16']);created=true;console.log('Owned disposable PG: '+name);
  for(let i=0;i<40;i++){if(call(['exec',name,'pg_isready','-U','postgres','-d','attended_lookup']).status===0)break;await new Promise(r=>setTimeout(r,250));}
  const sql=text=>docker(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','attended_lookup'],text);
  assert.match(sql('SHOW server_version;'),/^16\./u);
  sql('CREATE ROLE meri_control_runtime LOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE unrelated NOLOGIN; '+readFileSync(new URL('../migrations/0001_task_lookup.sql',import.meta.url),'utf8'));
  const grants=readFileSync(new URL('../../../../infra/product-preview/first-chat-database-integration.sql',import.meta.url),'utf8').match(/-- Control: task lookup results\.([\s\S]*?)-- Control: Objective/u)[1];
  sql('REVOKE ALL ON SCHEMA meri_task_lookup FROM PUBLIC; GRANT USAGE ON SCHEMA meri_task_lookup TO meri_control_runtime; '+grants);
  const port=Number(docker(['inspect','--format','{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',name]));
  pool=new Pool({host:'127.0.0.1',port,database:'attended_lookup',user:'meri_control_runtime',max:8,connectionTimeoutMillis:3000});
  assert.equal((await pool.query('SELECT current_user')).rows[0].current_user,'meri_control_runtime');
  const store=createPostgresTaskLookupStore({pool}),seed=fixture(),context=()=>{const {slots,...base}=seed.context;return {...base,lookupId:randomUUID(),resultReference:randomUUID(),requestId:randomUUID()};};
  await t.test('concurrent claims use unique sequential existing slots',async()=>{
   const claims=await Promise.all(Array.from({length:6},()=>store.claimPrepared({request:seed.request,context:context(),at:NOW},()=>{})));
   assert.deepEqual(claims.flatMap(c=>Object.values(c.binding.context.slots).map(s=>s.sequence)).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM meri_task_lookup.lookups')).rows[0].n,6);
   const first=claims[0];await assert.rejects(store.claimPrepared({request:seed.request,context:Object.fromEntries(Object.entries(first.binding.context).filter(([k])=>k!=='slots')),at:NOW},()=>{}),{code:'LOOKUP_REPLAY'});
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM meri_task_lookup.events')).rows[0].n,12);
  });
  await t.test('second event insert failure rolls back lookup and both slots',async()=>{
   let inserts=0;const broken=createPostgresTaskLookupStore({pool:{async connect(){const c=await pool.connect();return {async query(q,p){if(q.startsWith('INSERT INTO meri_task_lookup.events')&&++inserts===2)throw Error('synthetic second event failure');return c.query(q,p);},release:e=>c.release(e)};}}});
   await assert.rejects(broken.claimPrepared({request:seed.request,context:context(),at:NOW},()=>{}));
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM meri_task_lookup.lookups')).rows[0].n,6);assert.equal((await pool.query('SELECT count(*)::int AS n FROM meri_task_lookup.events')).rows[0].n,12);
  });
  await t.test('ordinary grants support complete retained delivery and read without model/run allocation',async()=>{
   const c=context();let reads=0;
   const delivery=createTaskLookupDelivery({store,clock:()=>NOW,authorize:async({binding})=>({authorized:true,bindingSha256:binding.bindingSha256,expiresAtMs:NOW+1000}),gateway:{async executeOwned(raw){reads++;const request=JSON.parse(raw),slots={started:{eventId:randomUUID(),sequence:1},terminal:{eventId:randomUUID(),sequence:2}};return JSON.stringify(envelope(prepare(Object.fromEntries(Object.entries(request.arguments).filter(([k])=>k!=='clientId')),{...c,slots},NOW)));}}});
   const saved=await delivery.lookup({request:seed.request,context:c,credential:'synthetic'}),read=await delivery.read({resultReference:saved.resultReference,context:{currentBinding:c.binding,scopes:c.scopes,deadlineMs:c.deadlineMs}});
   assert.equal(read.resultSha256,saved.resultSha256);assert.equal(read.observation.result.returned,0);assert.equal(reads,1);assert.deepEqual(read.events.map(e=>e.sequence),[13,14]);
  });
  await t.test('unrelated role cannot read and runtime cannot alter immutable payload columns',async()=>{
   const denied=call(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','attended_lookup'],'SET ROLE unrelated; SELECT * FROM meri_task_lookup.lookups;');assert.notEqual(denied.status,0);assert.match(denied.stderr,/permission denied/u);
   await assert.rejects(pool.query("UPDATE meri_task_lookup.lookups SET payload='{}'::jsonb"),{code:'42501'});
  });
 }finally{
  await pool?.end();if(created){assert.equal(docker(['inspect','--format','{{index .Config.Labels "meri-test-owner"}}',name]),name);docker(['rm','-f',name]);assert.equal(docker(['ps','-aq','--filter','name=^/'+name+'$']),'');console.log('Owned disposable PG removed and absent: '+name);}
 }
});
