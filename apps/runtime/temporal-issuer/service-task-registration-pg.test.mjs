import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createTemporalIssuerServiceTaskRegistrationPg} from './service-task-registration-pg.mjs';

const TASK='arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/'+'a'.repeat(32);
const SAN='spiffe://meri.internal/control/'+encodeURIComponent(TASK);
const CERT_A='a'.repeat(64),CERT_B='b'.repeat(64);
const input=(sha=CERT_A,expected=null)=>({schemaVersion:1,role:'control',taskArn:TASK,
 peerIPv4:'10.0.1.8',revision:'deployment-1',
 serviceArn:'arn:aws:ecs:us-east-1:967807252336:service/capiro-dev/meri-control',
 taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/meri-control:4',
 imageUri:'967807252336.dkr.ecr.us-east-1.amazonaws.com/meri@sha256:'+'c'.repeat(64),
 taskRoleArn:'arn:aws:iam::967807252336:role/meri-control',
 executionRoleArn:'arn:aws:iam::967807252336:role/meri-execution',
 certificateSha256:sha,peerSanUri:SAN,expiresAtMs:sha===CERT_A?300000:400000,
 proofObservedAtMs:sha===CERT_A?100000:100001,proofValidUntilMs:115000,
 expectedCertificateSha256:expected});

function fakePool({standby=false,commitError=false,grant=true,profileOverrides={}}={}){
 const state={row:null,nowMs:100002,events:[],release:[],endCalls:0,standby,commitError,grant,profileOverrides};
 return {state,connect:async()=>{
  let before=null;
  return {release(reason){state.release.push(reason);},async query(sql,values=[]){
   if(typeof sql==='object'){
    assert.equal(sql.query_timeout,3000);
    values=sql.values??[];sql=sql.text;
   }
   state.events.push({sql,values});
   if(sql.startsWith('BEGIN')){before=structuredClone(state.row);return {rows:[]};}
   if(sql==='COMMIT'){
    if(state.commitError){state.commitError=false;throw Error('lost COMMIT response');}
    return {rows:[]};
   }
   if(sql==='ROLLBACK'){state.row=before;return {rows:[]};}
   if(sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql.includes('pg_is_in_recovery() AS standby'))return {rows:[{standby:state.standby}]};
   if(sql.includes('has_schema_privilege(current_user'))return {rows:[{
    session_role:'meri_issuer',current_role:'meri_issuer',superuser:false,bypass_rls:false,
    create_db:false,create_role:false,inherit_role:false,table_owner:'migration_admin',
    schema_owner:'migration_admin',table_owner_member:false,schema_owner_member:false,
    table_owner_set:false,schema_owner_set:false,role_membership:false,
    public_schema_acl:false,public_table_acl:false,public_column_acl:false,
    other_schema_acl:false,other_table_acl:false,other_column_acl:false,
    issuer_schema_grant_option:false,issuer_table_grant_option:false,
    issuer_column_grant_option:false,
    schema_usage:state.grant,schema_create:false,table_select:true,table_insert:true,
    table_update:false,table_delete:false,table_truncate:false,
    table_trigger:false,table_references:false,column_references:false,
    unexpected_column_update:false,cert_update:true,
    expiry_update:true,proof_update:true,generation_update:true,timestamp_update:true,revoke_update:true,
    ...state.profileOverrides}]};
   if(sql==='SELECT task_arn FROM meri_service_identity.service_task_registrations LIMIT 0')
    return {rows:[]};
   if(sql==='SELECT (extract(epoch from clock_timestamp())*1000)::bigint::text AS db_now_ms')
    return {rows:[{db_now_ms:String(state.nowMs)}]};
   if(sql.includes('SELECT revoked_at FROM'))return {rows:state.row?[{revoked_at:state.row.revoked_at}]:[]};
   if(sql.startsWith('INSERT INTO')&&sql.includes('(task_arn,revoked_at)')){
    if(state.row){if(state.row.revoked_at===null)state.row.revoked_at='now';}
    else state.row={task_arn:values[0],revoked_at:'now'};
    return {rows:[]};
   }
   if(sql.startsWith('INSERT INTO')){
    if(!state.row&&values[13]>state.nowMs+3000&&values[11]>state.nowMs){
     state.row={task_arn:values[0],role:values[1],peer_ipv4:values[2],revision:values[3],
      service_arn:values[4],task_definition_arn:values[5],image_uri:values[6],
      task_role_arn:values[7],execution_role_arn:values[8],certificate_sha256:values[9],
      peer_san_uri:values[10],expires_at_ms:String(values[11]),
      proof_observed_at_ms:String(values[12]),revoked_at:null,generation:'1'};
    }
    return {rows:[]};
   }
   if(sql.startsWith('UPDATE')){
    if(state.row?.revoked_at===null&&state.row.certificate_sha256===values[4]&&
       values[2]>Number(state.row.expires_at_ms)&&values[5]>state.nowMs+3000){
     state.row.certificate_sha256=values[1];state.row.expires_at_ms=String(values[2]);
     state.row.proof_observed_at_ms=String(values[3]);
     return {rows:[structuredClone(state.row)]};
    }
    return {rows:[]};
   }
   if(sql.includes('WHERE certificate_sha256=$1')){
    return {rows:state.row?.certificate_sha256===values[0]?
     [{...structuredClone(state.row),db_now_ms:String(state.nowMs)}]:[]};
   }
   if(sql.includes('WHERE task_arn=$1'))return {rows:state.row?.task_arn===values[0]?
    [structuredClone(state.row)]:[]};
   throw Error('unrecognized SQL');
  }};
 },end(){state.endCalls++;}};
}

test('primary reads distinguish absent, current, expired and revoked; standby never says current',async()=>{
 const pool=fakePool(),owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 assert.deepEqual(await owner.probe(),{schemaVersion:1,state:'READY'});
 assert.deepEqual(await owner.readTaskCurrent({role:'control',taskArn:TASK}),
  {schemaVersion:1,state:'ABSENT',certificateSha256:null});
 assert.equal((await owner.readCurrent({role:'control',certificateSha256:CERT_A})).state,'REVOKED');
 const saved=await owner.registerCurrent(input());
 assert.equal(saved.state,'CURRENT');
 assert.equal((await owner.readCurrent({role:'control',certificateSha256:CERT_A})).taskArn,TASK);
 pool.state.nowMs=300001;
 assert.equal((await owner.readCurrent({role:'control',certificateSha256:CERT_A})).state,'REVOKED');
 assert.equal((await owner.readTaskCurrent({role:'control',taskArn:TASK})).state,'CURRENT');
 pool.state.standby=true;
 await assert.rejects(owner.probe(),{code:'TEMPORAL_ISSUER_REGISTRATION_UNAVAILABLE'});
 assert.equal((await owner.readCurrent({role:'control',certificateSha256:CERT_A})).state,'UNAVAILABLE');
 assert.equal((await owner.readTaskCurrent({role:'control',taskArn:TASK})).state,'UNAVAILABLE');
 assert.equal(pool.state.endCalls,0);
});

test('startup preflight rejects missing narrow writer grant without touching a row',async()=>{
 const pool=fakePool({grant:false}),owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 await assert.rejects(owner.probe(),{code:'TEMPORAL_ISSUER_REGISTRATION_UNAVAILABLE'});
 assert.equal(pool.state.row,null);
 assert.equal(pool.state.events.some(event=>event.sql.startsWith('INSERT INTO')),false);
});

test('startup rejects owner, elevated login, SET ROLE, and broad destructive privileges',async()=>{
 for(const profileOverrides of [{table_owner:'meri_issuer'}, {superuser:true},
  {session_role:'shared_app'}, {table_delete:true}, {table_truncate:true},
  {table_update:true}, {inherit_role:true}, {bypass_rls:true},
  {schema_owner:'meri_issuer'}, {table_owner_member:true}, {schema_owner_member:true},
  {table_owner_set:true}, {schema_owner_set:true},
  {role_membership:true}, {table_trigger:true}, {table_references:true},
  {column_references:true}, {unexpected_column_update:true},
  {public_schema_acl:true}, {public_table_acl:true}, {public_column_acl:true},
  {other_schema_acl:true}, {other_table_acl:true}, {other_column_acl:true},
  {issuer_schema_grant_option:true}, {issuer_table_grant_option:true},
  {issuer_column_grant_option:true}]){
  const pool=fakePool({profileOverrides});
  const owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
  await assert.rejects(owner.probe(),{code:'TEMPORAL_ISSUER_REGISTRATION_UNAVAILABLE'});
  assert.equal(pool.state.row,null);
 }
});

test('exact uncertain replay is recovered by primary read; CAS rotates once and stale competitor fails',async()=>{
 const pool=fakePool(),owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 await owner.registerCurrent(input());
 assert.equal((await owner.registerCurrent(input())).certificateSha256,CERT_A);
 const old=await owner.readTaskCurrent({role:'control',taskArn:TASK});
 assert.equal(old.certificateSha256,CERT_A);
 const rotated=await owner.registerCurrent(input(CERT_B,CERT_A));
 assert.equal(rotated.certificateSha256,CERT_B);
 await assert.rejects(owner.registerCurrent(input(CERT_A,CERT_A)),
  {code:'TEMPORAL_ISSUER_REGISTRATION_REFUSED'});
 assert.equal((await owner.readCurrent({role:'control',certificateSha256:CERT_A})).state,'REVOKED');
 assert.equal((await owner.readCurrent({role:'control',certificateSha256:CERT_B})).state,'CURRENT');
 assert.equal(pool.state.row.generation,'1'); // fake SQL does not emulate generation increments
});

test('revocation before or after first registration is irreversible and closes readback',async()=>{
 const pool=fakePool(),owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 assert.equal((await owner.revokeTask({taskArn:TASK})).state,'REVOKED');
 assert.equal((await owner.readTaskCurrent({role:'control',taskArn:TASK})).state,'REVOKED');
 await assert.rejects(owner.registerCurrent(input()),{code:'TEMPORAL_ISSUER_REGISTRATION_REFUSED'});
 const pool2=fakePool(),owner2=createTemporalIssuerServiceTaskRegistrationPg({pool:pool2,expectedRole:'meri_issuer'});
 await owner2.registerCurrent(input());
 await owner2.revokeTask({taskArn:TASK});
 assert.equal((await owner2.readCurrent({role:'control',certificateSha256:CERT_A})).state,'REVOKED');
 await assert.rejects(owner2.registerCurrent(input()),{code:'TEMPORAL_ISSUER_REGISTRATION_REFUSED'});
 assert.equal(pool2.state.endCalls,0);
});

test('proof lease expiring while the row is locked and writer failover deny rotation',async()=>{
 const pool=fakePool(),owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 await owner.registerCurrent(input());
 pool.state.nowMs=113000;
 await assert.rejects(owner.registerCurrent(input(CERT_B,CERT_A)),
  {code:'TEMPORAL_ISSUER_REGISTRATION_REFUSED'});
 assert.equal((await owner.readCurrent({role:'control',certificateSha256:CERT_A})).state,'CURRENT');
 pool.state.standby=true;
 await assert.rejects(owner.registerCurrent(input(CERT_B,CERT_A)),
  {code:'TEMPORAL_ISSUER_REGISTRATION_UNAVAILABLE'});
 assert.equal(pool.state.row.certificate_sha256,CERT_A);
});

test('lost COMMIT is UNKNOWN, never a positive certificate receipt; damaged connection discarded',async()=>{
 const pool=fakePool({commitError:true}),owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 await assert.rejects(owner.registerCurrent(input()),{code:'TEMPORAL_ISSUER_REGISTRATION_COMMIT_UNKNOWN'});
 assert.equal(pool.state.release.length,1);
 assert.equal(pool.state.release[0]?.code,'TEMPORAL_ISSUER_REGISTRATION_COMMIT_UNKNOWN');
 // The fake models a committed write with a lost ACK. Exact retry recovers only
 // through the new primary transaction and matching durable row.
 assert.equal((await owner.registerCurrent(input())).state,'CURRENT');
});

test('closing while pool borrow is unresolved reports pending work and never ends the borrowed pool',async()=>{
 const pool=fakePool();const original=pool.connect.bind(pool);
 let release,entered;const started=new Promise(resolve=>{entered=resolve;});
 pool.connect=()=>{entered();return new Promise(resolve=>{release=async()=>resolve(await original());});};
 const owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 const probing=owner.probe();await started;
 const receipt=owner.close();
 assert.deepEqual(receipt,{schemaVersion:1,state:'CLEANUP_UNKNOWN',
  pendingTransactions:1,pendingQueries:0,pendingBorrows:1,uncertain:false});
 assert.equal(pool.state.endCalls,0);
 await release();
 await assert.rejects(probing,{code:'TEMPORAL_ISSUER_REGISTRATION_UNAVAILABLE'});
 assert.equal(pool.state.release.length,1);
 assert.equal(receipt.state,'CLEANUP_UNKNOWN');
 assert.equal(owner.close().state,'CLEANUP_UNKNOWN');
});

test('closing during a pending COMMIT leaves an explicit uncertain transaction receipt',async()=>{
 const pool=fakePool(),original=pool.connect.bind(pool);
 let release,entered;const started=new Promise(resolve=>{entered=resolve;});
 pool.connect=async()=>{
  const client=await original(),query=client.query.bind(client);
  client.query=(sql,values)=>{
   if((typeof sql==='object'?sql.text:sql)==='COMMIT'){
    entered();return new Promise(resolve=>{release=()=>resolve(query(sql,values));});
   }
   return query(sql,values);
  };
  return client;
 };
 const owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 const registering=owner.registerCurrent(input());await started;
 const receipt=owner.close();
 assert.equal(receipt.state,'CLEANUP_UNKNOWN');
 assert.equal(receipt.pendingTransactions,1);
 assert.equal(receipt.pendingQueries,1);
 assert.equal(pool.state.endCalls,0);
 release();
 await assert.rejects(registering,{code:'TEMPORAL_ISSUER_REGISTRATION_COMMIT_UNKNOWN'});
 assert.equal(owner.close().state,'CLEANUP_UNKNOWN');
 assert.equal(owner.close().uncertain,true);
});

test('a rejected primary query remains cleanup-uncertain after an acknowledged rollback',async()=>{
 const pool=fakePool(),original=pool.connect.bind(pool);
 pool.connect=async()=>{
  const client=await original(),query=client.query.bind(client);
  client.query=(sql,values)=>{
   if((typeof sql==='object'?sql.text:sql)==='SELECT pg_is_in_recovery() AS standby')
    throw Error('client query timeout; server outcome not known');
   return query(sql,values);
  };
  return client;
 };
 const owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 await assert.rejects(owner.probe(),{code:'TEMPORAL_ISSUER_REGISTRATION_UNAVAILABLE'});
 assert.ok(pool.state.events.some(event=>event.sql==='ROLLBACK'));
 assert.deepEqual(owner.close(),{schemaVersion:1,state:'CLEANUP_UNKNOWN',
  pendingTransactions:0,pendingQueries:0,pendingBorrows:0,uncertain:true});
});

test('input/proof errors fail before writes, and source SQL locks permanence and grants',async()=>{
 const pool=fakePool(),owner=createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole:'meri_issuer'});
 await assert.rejects(owner.registerCurrent({...input(),proofValidUntilMs:100000}),
  {code:'TEMPORAL_ISSUER_REGISTRATION_REFUSED'});
 await assert.rejects(owner.registerCurrent({...input(),taskRoleArn:null}),
  {code:'TEMPORAL_ISSUER_REGISTRATION_REFUSED'});
 assert.equal(pool.state.events.length,0);
 const sql=readFileSync(new URL('./migrations/0001_service_task_registrations.sql',import.meta.url),'utf8');
 const source=readFileSync(new URL('./service-task-registration-pg.mjs',import.meta.url),'utf8');
 for(const term of ['CREATE SCHEMA meri_service_identity','task_arn text PRIMARY KEY',
  'CREATE UNIQUE INDEX service_task_registrations_current_certificate_uq',
  'guard_service_task_registration_change','BEFORE TRUNCATE','REVOKE ALL ON TABLE'])
  assert.ok(sql.includes(term),term);
 for(const term of ['FOR UPDATE','pg_is_in_recovery()','ON CONFLICT (task_arn) DO NOTHING',
  'proofValidUntilMs','TEMPORAL_ISSUER_REGISTRATION_COMMIT_UNKNOWN'])
  assert.ok(source.includes(term),term);
});
