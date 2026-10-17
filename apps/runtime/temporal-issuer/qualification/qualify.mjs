// Real PostgreSQL 16 qualification for the published service-task registration
// source. This file never provisions a cluster, database, role or migration.
// run-isolated.ps1 supplies an approved, new loopback cluster and two ephemeral
// credentials. Do not point it at an application database.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createTemporalIssuerServiceTaskRegistrationPg} from '../service-task-registration-pg.mjs';

const PORT=56457, DATABASE='meri_issuer_native_qual';
const ROLE='meri_issuer_native';
const ACCOUNT='967807252336', REGION='us-east-1', CLUSTER='qualification';
const CERT=()=>randomBytes(32).toString('hex');
const TASK=()=>`arn:aws:ecs:${REGION}:${ACCOUNT}:task/${CLUSTER}/${randomBytes(16).toString('hex')}`;
const required=(key)=>{
 const value=process.env[key];
 if(typeof value!=='string'||value.length<20)throw Error(`MISSING_${key}`);
 return value;
};
if(process.env.MERI_ISSUER_PG_QUALIFY!=='approved-task-owned-56457'||
 process.env.MERI_ISSUER_PG_QUALIFY_PORT!==String(PORT)||
 process.env.MERI_ISSUER_PG_QUALIFY_DATABASE!==DATABASE||
 !/^[a-f0-9]{32}$/u.test(process.env.MERI_ISSUER_PG_QUALIFY_RUN_ID??''))
 throw Error('EXPLICIT_ISOLATED_POSTGRES_QUALIFICATION_REQUIRED');
const adminPassword=required('MERI_ISSUER_PG_OWNER_PASSWORD');
const runtimePassword=required('MERI_ISSUER_PG_RUNTIME_PASSWORD');
const {default:pg}=await import('pg');
const common={host:'127.0.0.1',port:PORT,database:DATABASE,ssl:false,
 connectionTimeoutMillis:2000,idleTimeoutMillis:1000,query_timeout:3000,
 statement_timeout:3000,max:5};
const admin=new pg.Pool({...common,user:'postgres',password:adminPassword});
const runtime=new pg.Pool({...common,user:ROLE,password:runtimePassword});
const owner=createTemporalIssuerServiceTaskRegistrationPg({pool:runtime,expectedRole:ROLE});
const results=[];
function input({taskArn=TASK(),certificateSha256=CERT(),expiresAtMs=Date.now()+300000,
 revision='deployment-1',expectedCertificateSha256=null,
 proofObservedAtMs=Date.now()-1000,proofValidUntilMs=Date.now()+30000}={}){
 return {schemaVersion:1,role:'control',taskArn,peerIPv4:'127.0.0.1',revision,
  serviceArn:`arn:aws:ecs:${REGION}:${ACCOUNT}:service/${CLUSTER}/meri-temporal-issuer`,
  taskDefinitionArn:`arn:aws:ecs:${REGION}:${ACCOUNT}:task-definition/meri-temporal-issuer:1`,
  imageUri:`${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/meri@sha256:${'c'.repeat(64)}`,
  taskRoleArn:`arn:aws:iam::${ACCOUNT}:role/meri-control`,
  executionRoleArn:`arn:aws:iam::${ACCOUNT}:role/meri-execution`,
  certificateSha256,
  peerSanUri:'spiffe://meri.internal/control/'+encodeURIComponent(taskArn),
  expiresAtMs,proofObservedAtMs,proofValidUntilMs,expectedCertificateSha256};
}
async function check(name,fn){
 try{await fn();results.push({name,passed:true});}
 catch(error){results.push({name,passed:false,code:typeof error?.code==='string'?error.code:'ASSERTION'});}
}
async function refused(fn,code){
 await assert.rejects(fn,error=>error?.code===code);
}
async function triggerRefused(sql,values,marker){
 await assert.rejects(admin.query(sql,values),error=>
  error?.code==='P0001'&&error.message.includes(marker));
}
async function main(){
 await check('postgres16-primary-and-private-role',async()=>{
  const a=await admin.query(`SELECT current_setting('server_version_num')::int AS version,
    pg_is_in_recovery() AS standby,current_database() AS database,
    inet_server_addr()::text AS address,inet_server_port() AS port`);
  assert.equal(a.rows.length,1);
  assert.ok(a.rows[0].version>=160000&&a.rows[0].version<170000);
  assert.equal(a.rows[0].standby,false);
  assert.equal(a.rows[0].database,DATABASE);
  assert.equal(a.rows[0].address,'127.0.0.1');
  assert.equal(a.rows[0].port,PORT);
  const b=await admin.query(`SELECT r.rolsuper,r.rolinherit,r.rolbypassrls,
    r.rolcreatedb,r.rolcreaterole,r.rolreplication,
    pg_has_role($1,pg_get_userbyid(c.relowner),'MEMBER') AS owner_member,
    pg_has_role($1,pg_get_userbyid(c.relowner),'SET') AS owner_set,
    pg_has_role($1,pg_get_userbyid(n.nspowner),'MEMBER') AS schema_owner_member,
    pg_has_role($1,pg_get_userbyid(n.nspowner),'SET') AS schema_owner_set,
    EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid OR m.roleid=r.oid) AS role_membership,
    pg_get_userbyid(c.relowner) AS table_owner,
    pg_get_userbyid(n.nspowner) AS schema_owner
    FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE r.rolname=$1 AND c.oid='meri_service_identity.service_task_registrations'::regclass`,[ROLE]);
  assert.equal(b.rows.length,1);
  for(const key of ['rolsuper','rolinherit','rolbypassrls','rolcreatedb',
   'rolcreaterole','rolreplication','owner_member','owner_set',
   'schema_owner_member','schema_owner_set','role_membership'])
   assert.equal(b.rows[0][key],false,key);
  assert.notEqual(b.rows[0].table_owner,ROLE);
  assert.notEqual(b.rows[0].schema_owner,ROLE);
  assert.deepEqual(await owner.probe(),{schemaVersion:1,state:'READY'});
  const member=await runtime.connect();
  try{await refused(()=>member.query('SET ROLE postgres'),'42501');}
  finally{member.release(true);}
 });
 if(!results.at(-1).passed)throw Error('NATIVE_PREFLIGHT_FAILED');

 await check('dedicated-runtime-negative-grants',async()=>{
  await refused(()=>runtime.query('DELETE FROM meri_service_identity.service_task_registrations WHERE false'),'42501');
  await refused(()=>runtime.query('TRUNCATE meri_service_identity.service_task_registrations'),'42501');
  await refused(()=>runtime.query('UPDATE meri_service_identity.service_task_registrations SET role=role WHERE false'),'42501');
  await refused(()=>runtime.query('CREATE TABLE meri_service_identity.unauthorized_probe (id int)'),'42501');
  const grants=await admin.query(`SELECT has_schema_privilege($1,'meri_service_identity','USAGE') AS schema_usage,
   has_schema_privilege($1,'meri_service_identity','CREATE') AS schema_create,
   has_table_privilege($1,'meri_service_identity.service_task_registrations','SELECT') AS selected,
   has_table_privilege($1,'meri_service_identity.service_task_registrations','INSERT') AS inserted,
   has_table_privilege($1,'meri_service_identity.service_task_registrations','DELETE') AS deleted,
   has_table_privilege($1,'meri_service_identity.service_task_registrations','TRUNCATE') AS truncated,
   has_table_privilege($1,'meri_service_identity.service_task_registrations','TRIGGER') AS trigger_priv,
   has_table_privilege($1,'meri_service_identity.service_task_registrations','REFERENCES') AS references_priv,
   has_database_privilege($1,$2,'CREATE') AS database_create`,[ROLE,DATABASE]);
  assert.deepEqual(grants.rows[0],{schema_usage:true,schema_create:false,
   selected:true,inserted:true,deleted:false,truncated:false,trigger_priv:false,
   references_priv:false,database_create:false});
  const rawAcl=await admin.query(`SELECT
    EXISTS(SELECT 1 FROM aclexplode(n.nspacl) a WHERE a.grantee=0) AS public_schema,
    EXISTS(SELECT 1 FROM aclexplode(c.relacl) a WHERE a.grantee=0) AS public_table,
    EXISTS(SELECT 1 FROM aclexplode(c.relacl) a WHERE a.grantee=r.oid AND a.is_grantable) AS table_grant_option,
    EXISTS(SELECT 1 FROM pg_attribute attr,
      LATERAL aclexplode(attr.attacl) a WHERE attr.attrelid=c.oid
      AND a.grantee=r.oid AND a.is_grantable) AS column_grant_option
    FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE r.rolname=$1 AND c.oid='meri_service_identity.service_task_registrations'::regclass`,[ROLE]);
  assert.deepEqual(rawAcl.rows[0],{public_schema:false,public_table:false,
   table_grant_option:false,column_grant_option:false});
 });

 await check('first-register-replay-and-unique-certificate',async()=>{
  const original=input();
  const saved=await owner.registerCurrent(original);
  assert.equal(saved.state,'CURRENT');
  assert.deepEqual(await owner.registerCurrent(original),saved);
  assert.equal((await owner.readCurrent({role:'control',certificateSha256:original.certificateSha256})).state,'CURRENT');
  const collision=input({certificateSha256:original.certificateSha256});
  await assert.rejects(owner.registerCurrent(collision));
  const rows=await admin.query('SELECT count(*)::int AS n FROM meri_service_identity.service_task_registrations WHERE certificate_sha256=$1',[original.certificateSha256]);
  assert.equal(rows.rows[0].n,1);
 });

 await check('actual-trigger-permanence-and-immutability',async()=>{
  const value=input();await owner.registerCurrent(value);
  await triggerRefused('DELETE FROM meri_service_identity.service_task_registrations WHERE task_arn=$1',[value.taskArn],'SERVICE_TASK_REGISTRATION_PERMANENT');
  await triggerRefused('TRUNCATE meri_service_identity.service_task_registrations',[],'SERVICE_TASK_REGISTRATION_PERMANENT');
  await triggerRefused('UPDATE meri_service_identity.service_task_registrations SET role=$2,generation=generation+1 WHERE task_arn=$1',[value.taskArn,'temporal-worker'],'SERVICE_TASK_REGISTRATION_IMMUTABLE');
  await triggerRefused('UPDATE meri_service_identity.service_task_registrations SET generation=generation+2 WHERE task_arn=$1',[value.taskArn],'SERVICE_TASK_REGISTRATION_IMMUTABLE');
  await triggerRefused(`UPDATE meri_service_identity.service_task_registrations
    SET certificate_sha256=$2,generation=generation+1,updated_at=clock_timestamp()
    WHERE task_arn=$1`,[value.taskArn,CERT()],'SERVICE_TASK_REGISTRATION_ROTATION_REFUSED');
  await triggerRefused(`UPDATE meri_service_identity.service_task_registrations
    SET certificate_sha256=$2,expires_at_ms=$3::bigint,
      proof_observed_at_ms=proof_observed_at_ms-1,generation=generation+1,
      updated_at=clock_timestamp() WHERE task_arn=$1`,
    [value.taskArn,CERT(),value.expiresAtMs+100000],'SERVICE_TASK_REGISTRATION_ROTATION_REFUSED');
  assert.equal((await owner.readCurrent({role:'control',certificateSha256:value.certificateSha256})).state,'CURRENT');
 });

 await check('concurrent-first-writer-is-singular',async()=>{
  const taskArn=TASK(),a=input({taskArn}),b=input({taskArn});
  const settled=await Promise.allSettled([owner.registerCurrent(a),owner.registerCurrent(b)]);
  assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
  const winner=settled.find(x=>x.status==='fulfilled').value;
  assert.equal(winner.state,'CURRENT');
  const row=await admin.query('SELECT certificate_sha256,generation FROM meri_service_identity.service_task_registrations WHERE task_arn=$1',[taskArn]);
  assert.equal(row.rows.length,1);assert.equal(row.rows[0].certificate_sha256,winner.certificateSha256);
  assert.equal(Number(row.rows[0].generation),1);
 });

 await check('concurrent-rotation-cas-and-stale-revision',async()=>{
  const first=input();await owner.registerCurrent(first);
  const shared={taskArn:first.taskArn,expiresAtMs:first.expiresAtMs+100000,
   proofObservedAtMs:Date.now()-500,expectedCertificateSha256:first.certificateSha256};
  const a=input(shared),b=input(shared);
  const settled=await Promise.allSettled([owner.registerCurrent(a),owner.registerCurrent(b)]);
  assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
  const winner=settled.find(x=>x.status==='fulfilled').value;
  assert.equal((await owner.readCurrent({role:'control',certificateSha256:winner.certificateSha256})).state,'CURRENT');
  assert.equal((await owner.readCurrent({role:'control',certificateSha256:first.certificateSha256})).state,'REVOKED');
  const row=await admin.query('SELECT generation FROM meri_service_identity.service_task_registrations WHERE task_arn=$1',[first.taskArn]);
  assert.equal(Number(row.rows[0].generation),2);
  const stale=input({...shared,revision:'deployment-stale',certificateSha256:CERT(),
   expectedCertificateSha256:winner.certificateSha256,expiresAtMs:shared.expiresAtMs+100000});
  await refused(()=>owner.registerCurrent(stale),'TEMPORAL_ISSUER_REGISTRATION_REFUSED');
 });

 await check('revoke-before-register-and-concurrent-revoke-rotate',async()=>{
  const prior=input();assert.equal((await owner.revokeTask({taskArn:prior.taskArn})).state,'REVOKED');
  await refused(()=>owner.registerCurrent(prior),'TEMPORAL_ISSUER_REGISTRATION_REFUSED');
  const first=input();await owner.registerCurrent(first);
  const successor=input({taskArn:first.taskArn,expectedCertificateSha256:first.certificateSha256,
   expiresAtMs:first.expiresAtMs+100000,proofObservedAtMs:Date.now()-500});
  await Promise.allSettled([owner.registerCurrent(successor),owner.revokeTask({taskArn:first.taskArn})]);
  assert.equal((await owner.readTaskCurrent({role:'control',taskArn:first.taskArn})).state,'REVOKED');
  assert.equal((await owner.readCurrent({role:'control',certificateSha256:first.certificateSha256})).state,'REVOKED');
  assert.equal((await owner.readCurrent({role:'control',certificateSha256:successor.certificateSha256})).state,'REVOKED');
  await refused(()=>owner.registerCurrent(first),'TEMPORAL_ISSUER_REGISTRATION_REFUSED');
  const tombstone=await admin.query('SELECT revoked_at IS NOT NULL AS revoked FROM meri_service_identity.service_task_registrations WHERE task_arn=$1',[first.taskArn]);
  assert.equal(tombstone.rows[0].revoked,true);
  await triggerRefused('UPDATE meri_service_identity.service_task_registrations SET revoked_at=NULL,generation=generation+1 WHERE task_arn=$1',[first.taskArn],'SERVICE_TASK_REGISTRATION_IMMUTABLE');
 });

 await check('expiry-is-denied-by-primary-clock',async()=>{
  const value=input({expiresAtMs:Date.now()+10000});await owner.registerCurrent(value);
  await delay(11500);
  assert.equal((await owner.readCurrent({role:'control',certificateSha256:value.certificateSha256})).state,'REVOKED');
 });

 await check('transaction-rollback-witness',async()=>{
  const first=input();await owner.registerCurrent(first);
  const client=await admin.connect(),temporary=CERT();
  try{
   await client.query('BEGIN');
   const inTx=await client.query(`UPDATE meri_service_identity.service_task_registrations
     SET certificate_sha256=$2,expires_at_ms=$3::bigint,
       generation=generation+1,updated_at=clock_timestamp()
     WHERE task_arn=$1 RETURNING certificate_sha256`,
     [first.taskArn,temporary,first.expiresAtMs+100000]);
   assert.equal(inTx.rows[0].certificate_sha256,temporary);
   await client.query('ROLLBACK');
  }finally{
   try{await client.query('ROLLBACK');}catch{}
   client.release();
  }
  assert.equal((await owner.readCurrent({role:'control',certificateSha256:first.certificateSha256})).state,'CURRENT');
  assert.equal((await owner.readCurrent({role:'control',certificateSha256:temporary})).state,'REVOKED');
 });

 await check('lost-commit-ack-does-not-release-positive-receipt',async()=>{
  const value=input();let dropped=false;
  const uncertainPool={connect:async()=>{
   const client=await runtime.connect();
   return {query:async(...args)=>{
    const result=await client.query(...args);
    const query=typeof args[0]==='string'?args[0]:args[0]?.text;
    if(query==='COMMIT'&&!dropped){dropped=true;throw Error('synthetic-lost-commit-ack');}
    return result;
   },release:reason=>client.release(reason)};
  }};
  const uncertain=createTemporalIssuerServiceTaskRegistrationPg({pool:uncertainPool,expectedRole:ROLE});
  await refused(()=>uncertain.registerCurrent(value),'TEMPORAL_ISSUER_REGISTRATION_COMMIT_UNKNOWN');
  assert.equal(dropped,true);
  assert.deepEqual(uncertain.close(),{schemaVersion:1,state:'CLEANUP_UNKNOWN',
   pendingTransactions:0,pendingQueries:0,pendingBorrows:0,uncertain:true});
  assert.equal((await owner.registerCurrent(value)).state,'CURRENT');
 });
}
try{await main();}
catch(error){results.push({name:'fatal-preflight',passed:false,code:error?.code??'ASSERTION'});}
finally{
 try{
  const close=owner.close();
  assert.deepEqual(close,{schemaVersion:1,state:'CLEAN',pendingTransactions:0,
   pendingQueries:0,pendingBorrows:0,uncertain:false});
 }catch(error){results.push({name:'native-adapter-cleanup',passed:false,
   code:error?.code??'CLEANUP_UNKNOWN'});}
 const poolEnds=await Promise.allSettled([runtime.end(),admin.end()]);
 if(poolEnds.some(item=>item.status!=='fulfilled'))
  results.push({name:'native-pool-cleanup',passed:false,code:'CLEANUP_UNKNOWN'});
 const failed=results.filter(item=>!item.passed).length;
 console.log(JSON.stringify({schemaVersion:1,source:'temporal-issuer-registration-pg16',
  port:PORT,database:DATABASE,checks:results,passed:results.length-failed,failed}));
 if(failed>0)process.exitCode=1;
}
