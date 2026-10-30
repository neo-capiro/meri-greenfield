/** Explicit local PostgreSQL qualification. Adds this new schema only; preserves existing fixture data/services. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createPostgresHostAllocationWriter,createPostgresHostAllocationReader} from '../../apps/control/browser-hosts/postgres-allocations.mjs';
import {createBrowserHostRouter} from '../../apps/control/browser-hosts/router.mjs';
import {createPostgresHostCurrentnessStore} from '../../apps/worker/conversation/host/control/postgres-store.mjs';
import {HOST_CONTROL_REQUEST_SCHEMA} from '../../apps/worker/conversation/host/control/protocol.mjs';
import {publicCertificates} from '../../apps/control/browser-hosts/test/certificates.mjs';

if(process.env.MERI_HOST_ALLOCATIONS_PG_ATTEST!=='isolated-local')throw Error('HOST_ALLOCATION_PG_ATTESTATION_REQUIRED');
const port=Number(process.env.MERI_HOST_ALLOCATIONS_PG_PORT??55487);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('HOST_ALLOCATION_PG_PORT_REFUSED');
const connection={host:'127.0.0.1',port,database:'wave6_browser_custody_20261030',connectionTimeoutMillis:1500};
const administrator='office_fixture_admin',writerRole='wave6_host_writer_20261030',readerRole='wave6_host_reader_20261030';
const binding=()=>({tenantId:'host-qualification-'+randomUUID(),actorId:'fixture-actor',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1});
function input(source=binding()){
 const hostId=randomUUID(),allocation={schema:'meri-conversation-host-allocation/1',tenantId:source.tenantId,conversationId:source.conversationId,
  generation:1,hostId,imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:Date.now()+600000};
 const names={hostCertificate:`h-${hostId.replaceAll('-','')}-g1.host.meri.internal`,serverCertificate:`v-${hostId.replaceAll('-','')}.host.meri.internal`};
 return {allocation,originalBinding:source,hostIdentity:{schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef0',bootId:randomUUID(),conversationId:source.conversationId,hostId},
  ownerInstanceId:randomUUID(),endpoint:{address:'127.0.0.1',port:49151,serverName:names.serverCertificate},...publicCertificates(names)};
}
const active=async(_client,{binding,allocation})=>({binding,browserAdmitted:true,currentUntilMs:allocation.leaseDeadlineMs});

test('physical allocations and routing use actual PostgreSQL with separated ordinary roles',async t=>{
 const admin=new pg.Pool({...connection,user:administrator,max:2});t.after(()=>admin.end());
 const installed=(await admin.query("SELECT to_regclass('meri_host_control.host_allocations') AS name")).rows[0].name;
 if(!installed){try{await admin.query(await readFile(new URL('../../apps/control/browser-hosts/migrations/0001_host_allocations.sql',import.meta.url),'utf8'));}catch(error){await admin.query('ROLLBACK');throw error;}}
 const teardownInstalled=(await admin.query("SELECT 1 FROM information_schema.columns WHERE table_schema='meri_host_control' AND table_name='host_allocations' AND column_name='teardown_json'")).rows.length;
 if(!teardownInstalled){try{await admin.query(await readFile(new URL('../../apps/control/browser-hosts/migrations/0002_verified_teardown.sql',import.meta.url),'utf8'));}catch(error){await admin.query('ROLLBACK');throw error;}}
 const placementInstalled=(await admin.query("SELECT 1 FROM pg_constraint WHERE conrelid='meri_host_control.host_allocations'::regclass AND conname='host_allocation_placement'")).rows.length;
 if(!placementInstalled){try{await admin.query(await readFile(new URL('../../apps/control/browser-hosts/migrations/0003_browser_only_teardown.sql',import.meta.url),'utf8'));}catch(error){await admin.query('ROLLBACK');throw error;}}
 await admin.query(`DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${writerRole}') THEN CREATE ROLE ${writerRole} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${readerRole}') THEN CREATE ROLE ${readerRole} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB; END IF;
 END $$; GRANT meri_host_allocator TO ${writerRole}; GRANT meri_host_currentness TO ${readerRole};`);
 const writePool=new pg.Pool({...connection,user:writerRole,max:3}),readPool=new pg.Pool({...connection,user:readerRole,max:3});
 t.after(async()=>{await Promise.all([writePool.end(),readPool.end()]);});
 for(const pool of [writePool,readPool]){
  const role=(await pool.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user')).rows[0];
  assert.deepEqual(role,{rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false});
 }
 const writer=createPostgresHostAllocationWriter({pool:writePool}),reader=createPostgresHostAllocationReader({pool:readPool,readCanonicalRun:active});

 await t.test('actual certificate pins, immutable replay and read-only route resolution',async()=>{
  const q=input(),saved=await writer.admit({record:q}),route=await reader.resolve({binding:q.originalBinding});
  assert.equal(route.ownerInstanceId,q.ownerInstanceId);assert.equal(route.endpoint.address,q.endpoint.address);
  assert.equal(route.recordSha256,hash(saved));assert.deepEqual(await writer.admit({record:q}),saved);
  await assert.rejects(writer.admit({record:{...q,endpoint:{...q.endpoint,port:49152}}}));
  await assert.rejects(readPool.query("UPDATE meri_host_control.host_allocations SET state='revoked' WHERE host_id=$1",[q.allocation.hostId]),{code:'42501'});
  await assert.rejects(writePool.query('UPDATE meri_host_control.host_allocations SET endpoint_json=$1 WHERE host_id=$2',[{},q.allocation.hostId]),{code:'42501'});
  await assert.rejects(admin.query('UPDATE meri_host_control.host_allocations SET endpoint_json=$1 WHERE host_id=$2',[{},q.allocation.hostId]),/HOST_ALLOCATION_IMMUTABLE/);
  await assert.rejects(reader.resolve({binding:{...q.originalBinding,tenantId:'foreign-tenant'}}));
  const deny=createPostgresHostAllocationReader({pool:readPool,readCanonicalRun:async()=>{throw Error('Core revoked');}});
  await assert.rejects(deny.resolve({binding:q.originalBinding}));
 });

 await t.test('revocation serializes with the locked canonical read and prohibits replacement without teardown',async()=>{
  const q=input();await writer.admit({record:q});const entered=Promise.withResolvers(),release=Promise.withResolvers();
  const held=createPostgresHostAllocationReader({pool:readPool,readCanonicalRun:async(client,request)=>{entered.resolve();await release.promise;return active(client,request);}});
  const reading=held.resolve({binding:q.originalBinding});await entered.promise;let revoked=false;
  const revoking=writer.revoke(q.allocation).then(()=>{revoked=true;});
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(revoked,false);release.resolve();await reading;await revoking;
  await assert.rejects(reader.resolve({binding:q.originalBinding}));
  await assert.rejects(writer.admit({record:input(q.originalBinding)}));
  await assert.rejects(admin.query("UPDATE meri_host_control.host_allocations SET state='active' WHERE host_id=$1",[q.allocation.hostId]),/HOST_ALLOCATION_STATE_REFUSED/);
 });

 await t.test('unknown COMMIT is retained and the exact admission recovers without another allocation',async()=>{
  const q=input();let unknown=true;
  const uncertain={async connect(){const client=await writePool.connect();return {
   async query(sql,values){const result=await client.query(sql,values);if(sql==='COMMIT'&&unknown){unknown=false;throw Error('lost commit ACK');}return result;},release:error=>client.release(error),
  };}};
  await assert.rejects(createPostgresHostAllocationWriter({pool:uncertain}).admit({record:q}),/BROWSER_HOST_ALLOCATION_UNKNOWN/);
  await writer.admit({record:q});const count=await readPool.query('SELECT count(*)::int AS n FROM meri_host_control.host_allocations WHERE host_id=$1',[q.allocation.hostId]);assert.equal(count.rows[0].n,1);
 });

 await t.test('actual host currentness uses the lock function, consumes a nonce and has no allocation mutation right',async()=>{
  const q=input(),saved=await writer.admit({record:q});
  const transact=async(body)=>{const client=await readPool.connect();try{await client.query('BEGIN');const r=await body(client);await client.query('COMMIT');return r;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}};
  const store=createPostgresHostCurrentnessStore({transact,maxLeaseMs:5000,readCanonicalRun:async(_client,{binding})=>({binding,browserPolicySha256:'b'.repeat(64),capabilityPolicySha256:'c'.repeat(64),sdkAdmitted:true,browserAdmitted:true,bashAdmitted:false,phase:'active',currentUntilMs:q.allocation.leaseDeadlineMs})});
  const request={schema:HOST_CONTROL_REQUEST_SCHEMA,allocation:q.allocation,binding:q.originalBinding,hostIdentity:q.hostIdentity,purpose:'browser',policySha256:'b'.repeat(64),nonce:'d'.repeat(64)};
  const value={request,fingerprintSha256:saved.hostCertificate.fingerprintSha256,peerDnsName:saved.hostCertificate.dnsName};
  const result=await store.readCurrent(value);assert.equal(result.receipt.binding.runId,q.originalBinding.runId);
  await assert.rejects(store.readCurrent(value));
 });

 await t.test('routing checks allocation again after a native effect and never releases a revoked reply',async()=>{
  const q=input();await writer.admit({record:q});let called=0,closed=0;
  const router=createBrowserHostRouter({allocations:reader,tls:{clientName:'control.test',cert:Buffer.from('fixture'),key:Buffer.from('fixture'),ca:Buffer.from('fixture')},connect(config){
   assert.equal(config.endpoint.address,q.endpoint.address);assert.equal(config.ownerInstanceId,q.ownerInstanceId);
   return {async read(){called++;await writer.revoke(q.allocation);return {admitted:true};},close(){closed++;}};
  }});
  try{await assert.rejects(router.read({binding:q.originalBinding}));assert.equal(called,1);assert.equal(closed,1);}finally{router.close();}
 });
 await t.test('only exact verified teardown becomes durable and permits another host; unknown ACK recovers once',async()=>{
  const q=input(),saved=await writer.admit({record:q}),key={hostId:q.allocation.hostId,generation:1};await writer.revoke(key);
  const receipt={schema:'meri-d005-host-teardown/1',allocationSha256:hash(saved.allocation),bindingSha256:hash(saved.originalBinding),hostIdentitySha256:hash(saved.hostIdentity),
   reason:'conversation-end',startedAtMs:Date.now(),browserEgress:'closed',bashEgress:'closed',processes:'exited',browserState:'disposed',hostDestroy:'requested',hostAbsence:'confirmed',status:'VERIFIED'};
  for(const change of [{status:'UNKNOWN'},{hostAbsence:'unknown'},{processes:'unknown'},{bindingSha256:'f'.repeat(64)},{hostIdentitySha256:'e'.repeat(64)}])
   await assert.rejects(writer.recordTeardown({...key,receipt:{...receipt,...change}}));
  await assert.rejects(writePool.query("UPDATE meri_host_control.host_allocations SET state='terminated' WHERE host_id=$1",[key.hostId]),{code:'23514'});
  await assert.rejects(writer.admit({record:input(q.originalBinding)}));
  let unknown=true;
  const uncertain={async connect(){const client=await writePool.connect();return {async query(sql,values){const result=await client.query(sql,values);if(sql==='COMMIT'&&unknown){unknown=false;throw Error('lost commit ACK');}return result;},release:error=>client.release(error)};}};
  await assert.rejects(createPostgresHostAllocationWriter({pool:uncertain}).recordTeardown({...key,receipt}),/BROWSER_HOST_TEARDOWN_UNKNOWN/);
  const [first,second]=await Promise.all([writer.recordTeardown({...key,receipt}),writer.recordTeardown({...key,receipt})]);
  assert.deepEqual(first,second);assert.equal(first.receiptSha256,hash(receipt));
  await assert.rejects(writer.recordTeardown({...key,receipt:{...receipt,reason:'failed'}}));
  await assert.rejects(writePool.query('UPDATE meri_host_control.host_allocations SET teardown_json=$2 WHERE host_id=$1',[key.hostId,{...receipt,reason:'failed'}]),/HOST_ALLOCATION_IMMUTABLE/);
  await writer.admit({record:input(q.originalBinding)});
  await assert.rejects(reader.resolve({binding:q.originalBinding,custody:{schema:'meri-browser-custody/1',binding:q.originalBinding,controlId:randomUUID(),ownerInstanceId:q.ownerInstanceId,hostId:key.hostId,generation:1,leaseEpoch:1,policySha256:'a'.repeat(64),expiresAtMs:Date.now()+30000}}));
 });
 await t.test('browser-only placement is immutable and both SQL and owner require the matching cleanup scope',async()=>{
  const q=input();q.allocation.hostMode='browser-only';const saved=await writer.admit({record:q}),key={hostId:q.allocation.hostId,generation:1};
  assert.equal(saved.allocation.hostMode,'browser-only');assert.equal((await reader.resolve({binding:q.originalBinding})).allocation.hostMode,'browser-only');
  const receipt={schema:'meri-d005-host-teardown/1',allocationSha256:hash(saved.allocation),bindingSha256:hash(saved.originalBinding),hostIdentitySha256:hash(saved.hostIdentity),reason:'conversation-end',startedAtMs:Date.now(),browserEgress:'closed',bashEgress:'not-applicable',processScope:'browser-host-descendants',processes:'exited',browserState:'disposed',hostDestroy:'requested',hostAbsence:'confirmed',status:'VERIFIED'};
  for(const change of [{processScope:'browser-bash-sdk-descendants'},{bashEgress:'closed'},{hostAbsence:'unknown'},{processScope:null}]){
   const bad={...receipt,...change};await assert.rejects(writer.recordTeardown({...key,receipt:bad}));
   await assert.rejects(writePool.query("UPDATE meri_host_control.host_allocations SET state='terminated',teardown_json=$2,teardown_sha256=$3 WHERE host_id=$1",[key.hostId,bad,hash(bad)]),{code:'23514'});
  }
  await assert.rejects(admin.query("UPDATE meri_host_control.host_allocations SET allocation_json=allocation_json-'hostMode' WHERE host_id=$1",[key.hostId]),/HOST_ALLOCATION_IMMUTABLE/);
  const first=await writer.recordTeardown({...key,receipt});assert.deepEqual(await writer.recordTeardown({...key,receipt}),first);
  assert.equal(first.receiptSha256,hash(receipt));await writer.admit({record:input(q.originalBinding)});
  const legacy=input(),legacySaved=await writer.admit({record:legacy});
  const relabeled={...receipt,allocationSha256:hash(legacySaved.allocation),bindingSha256:hash(legacySaved.originalBinding),hostIdentitySha256:hash(legacySaved.hostIdentity)};
  await assert.rejects(writer.recordTeardown({...legacy.allocation,receipt:relabeled}));
  await assert.rejects(writePool.query("UPDATE meri_host_control.host_allocations SET state='terminated',teardown_json=$2,teardown_sha256=$3 WHERE host_id=$1",[legacy.allocation.hostId,relabeled,hash(relabeled)]),{code:'23514'});
 });
 t.diagnostic('PostgreSQL ordinary-role allocation/custody/placement boundaries passed; external Core/host currentness decisions are synthetic. No cloud, model, or deployed acceptance.');
});
