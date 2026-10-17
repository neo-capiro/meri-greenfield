/** Canonical, task-keyed Temporal service certificate/revocation owner.
 * This adapter borrows a pg Pool and never owns or closes it. It requires a
 * primary writer, including for negative reads and post-COMMIT readback. */
import {isIP} from 'node:net';

const SHA=/^[a-f0-9]{64}$/u;
const TASK=/^arn:aws:ecs:([a-z0-9-]+):([0-9]{12}):task\/([A-Za-z0-9_-]+)\/[a-f0-9]{32}$/u;
const ROLE=['control','temporal-worker'];
const RECEIPT=['schemaVersion','state','certificateSha256','role','peerSanUri','taskArn','revision','expiresAtMs'];
const REGISTER=['schemaVersion','role','taskArn','peerIPv4','revision','serviceArn',
 'taskDefinitionArn','imageUri','taskRoleArn','executionRoleArn','certificateSha256',
 'peerSanUri','expiresAtMs','proofObservedAtMs','proofValidUntilMs',
 'expectedCertificateSha256','signal'];
const fault=code=>Object.assign(Error(code),{code});
const refused=()=>fault('TEMPORAL_ISSUER_REGISTRATION_REFUSED');
const unavailable=()=>fault('TEMPORAL_ISSUER_REGISTRATION_UNAVAILABLE');
const unknown=()=>fault('TEMPORAL_ISSUER_REGISTRATION_COMMIT_UNKNOWN');
const exact=(value,keys,optional=[])=>value!==null&&typeof value==='object'&&
 !Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&
 keys.every(key=>Object.hasOwn(value,key))&&
 Object.keys(value).every(key=>keys.includes(key)||optional.includes(key));
const safe=value=>Number.isSafeInteger(value)&&value>=0;
const text=(value,max=512)=>typeof value==='string'&&value.length>=1&&value.length<=max;
const revoked=()=>Object.freeze({schemaVersion:1,state:'REVOKED'});
const absent=()=>Object.freeze({schemaVersion:1,state:'ABSENT',certificateSha256:null});
const notAvailable=()=>Object.freeze({schemaVersion:1,state:'UNAVAILABLE'});
const assertActive=(closed,signal)=>{if(closed()||signal?.aborted)throw unavailable();};
function parseIntMs(value){
 const parsed=typeof value==='string'&&/^(0|[1-9][0-9]*)$/u.test(value)?Number(value):value;
 if(!safe(parsed))throw unavailable();
 return parsed;
}
function task(value){
 const match=typeof value==='string'&&value.length<=512?TASK.exec(value):null;
 if(!match)throw refused();
 return {region:match[1],account:match[2],cluster:match[3]};
}
function registerInput(value){
 if(!exact(value,REGISTER.slice(0,-1),['signal'])||value.schemaVersion!==1||
    !ROLE.includes(value.role)||isIP(value.peerIPv4)!==4||
    !text(value.revision,128)||!SHA.test(value.certificateSha256??'')||
    !safe(value.expiresAtMs)||!safe(value.proofObservedAtMs)||
    !safe(value.proofValidUntilMs)||
    value.proofValidUntilMs<=value.proofObservedAtMs||
    value.proofValidUntilMs-value.proofObservedAtMs>120000||
    !(value.expectedCertificateSha256===null||SHA.test(value.expectedCertificateSha256??'')))throw refused();
 const {region,account,cluster}=task(value.taskArn);
 const servicePrefix=`arn:aws:ecs:${region}:${account}:service/${cluster}/`;
 if(!text(value.serviceArn)||!value.serviceArn.startsWith(servicePrefix)||
    !/^[A-Za-z0-9_-]{1,255}$/u.test(value.serviceArn.slice(servicePrefix.length))||
    !new RegExp(`^arn:aws:ecs:${region}:${account}:task-definition/[A-Za-z0-9_-]+:[1-9][0-9]*$`,'u')
      .test(value.taskDefinitionArn??'')||
    !text(value.imageUri,1024)||
    !value.imageUri.startsWith(`${account}.dkr.ecr.${region}.amazonaws.com/`)||
    !/^\S+@sha256:[a-f0-9]{64}$/u.test(value.imageUri)||
    !text(value.executionRoleArn)||
    !value.executionRoleArn.startsWith(`arn:aws:iam::${account}:role/`)||
    (value.taskRoleArn!==null&&
     (!text(value.taskRoleArn)||!value.taskRoleArn.startsWith(`arn:aws:iam::${account}:role/`)))||
    (value.role==='control'&&value.taskRoleArn===null)||
    !text(value.peerSanUri,1024)||
    !/^spiffe:\/\/[a-z0-9.-]+\/[A-Za-z0-9/_-]+\//u.test(value.peerSanUri)||
    !value.peerSanUri.endsWith(encodeURIComponent(value.taskArn)))throw refused();
 return value;
}
function receipt(row){
 if(!row||row.revoked_at!==null||!ROLE.includes(row.role)||
    !SHA.test(row.certificate_sha256??'')||!text(row.peer_san_uri,1024)||
    !text(row.revision,128))throw unavailable();
 task(row.task_arn);
 const expiresAtMs=parseIntMs(row.expires_at_ms);
 return Object.freeze({schemaVersion:1,state:'CURRENT',certificateSha256:row.certificate_sha256,
  role:row.role,peerSanUri:row.peer_san_uri,taskArn:row.task_arn,
  revision:row.revision,expiresAtMs});
}
function sameIdentity(row,input){
 return row.role===input.role&&row.task_arn===input.taskArn&&
  row.peer_ipv4===input.peerIPv4&&row.revision===input.revision&&
  row.service_arn===input.serviceArn&&row.task_definition_arn===input.taskDefinitionArn&&
  row.image_uri===input.imageUri&&row.task_role_arn===input.taskRoleArn&&
  row.execution_role_arn===input.executionRoleArn&&row.peer_san_uri===input.peerSanUri;
}
const sameReceipt=(a,b)=>a&&b&&RECEIPT.every(key=>a[key]===b[key]);
const ROW=`task_arn,role,host(peer_ipv4) AS peer_ipv4,revision,service_arn,
 task_definition_arn,image_uri,task_role_arn,execution_role_arn,certificate_sha256,
 peer_san_uri,expires_at_ms::text AS expires_at_ms,proof_observed_at_ms::text AS proof_observed_at_ms,
 revoked_at,generation::text AS generation`;

export function createTemporalIssuerServiceTaskRegistrationPg({pool,expectedRole}={}){
 if(typeof pool?.connect!=='function'||typeof expectedRole!=='string'||
    !/^[a-z][a-z0-9_]{2,62}$/u.test(expectedRole))throw refused();
 let closed=false,uncertain=false,cleanupUnknownSticky=false;
 const pendingTransactions=new Set(),pendingQueries=new Set(),pendingBorrows=new Set();
 const isClosed=()=>closed;
 function track(set,promise){
  set.add(promise);
  promise.then(()=>set.delete(promise),()=>set.delete(promise));
  return promise;
 }
 function query(client,text,values){
  const pending=track(pendingQueries,Promise.resolve().then(()=>client.query({text,values,
   query_timeout:3000})));
  // A client-side timeout or transport error does not prove the primary server
  // stopped processing that statement, even if a later ROLLBACK is acknowledged.
  pending.then(undefined,()=>{uncertain=true;});
  return pending;
 }
 async function borrow(signal){
  assertActive(isClosed,signal);
  const pending=track(pendingBorrows,Promise.resolve().then(()=>pool.connect()));
  let borrowSettled=false;
  pending.then(()=>{borrowSettled=true;},()=>{borrowSettled=true;});
  let timer,abort;
  const stopped=new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(unavailable()),2000);timer.unref?.();
   abort=()=>reject(unavailable());signal?.addEventListener('abort',abort,{once:true});
  });
  try{return await Promise.race([pending,stopped]);}
  catch(error){
   if(!borrowSettled)uncertain=true;
   // Return a client that becomes available only after the deadline.
   pending.then(client=>{try{client.release(unavailable());}catch{}},()=>{});
   throw error;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 async function executeTransaction(body,signal){
  assertActive(isClosed,signal);
  let client,begun=false,committing=false,reusable=false,failure,result;
  try{
   client=await borrow(signal);assertActive(isClosed,signal);
   // pg 8.23 supports per-query query_timeout. Apply it before BEGIN so a
   // network-stalled BEGIN/COMMIT has a deadline even before SET LOCAL runs.
   const boundedClient={query:(text,values)=>query(client,text,values)};
   await boundedClient.query('BEGIN TRANSACTION READ WRITE');begun=true;
   await boundedClient.query("SET LOCAL statement_timeout = '3s'");
   await boundedClient.query("SET LOCAL lock_timeout = '1s'");
   await boundedClient.query("SET LOCAL idle_in_transaction_session_timeout = '5s'");
   assertActive(isClosed,signal);
   const primary=await boundedClient.query('SELECT pg_is_in_recovery() AS standby');
   if(primary?.rows?.length!==1||primary.rows[0]?.standby!==false)throw unavailable();
   result=await body(boundedClient);assertActive(isClosed,signal);
   committing=true;await boundedClient.query('COMMIT');reusable=true;
   assertActive(isClosed,signal);
  }catch(error){
   if(committing||pendingQueries.size>0||pendingBorrows.size>0)uncertain=true;
   failure=committing?unknown():
    error?.code==='TEMPORAL_ISSUER_REGISTRATION_REFUSED'?error:unavailable();
   // Roll back best-effort, then discard on every failure. In particular a
   // client-side query timeout does not prove the server stopped its statement.
   if(begun&&!committing)try{await query(client,'ROLLBACK');}
    catch{uncertain=true;}
  }finally{
   if(client)try{client.release(reusable?undefined:failure??unavailable());}
    catch{uncertain=true;failure??=unavailable();}
  }
  if(failure)throw failure;
  return result;
 }
 function transaction(body,signal){
  const running=executeTransaction(body,signal);
  return track(pendingTransactions,running);
 }
 async function readTaskCurrent({role,taskArn,signal}={}){
  try{
   if(!ROLE.includes(role))throw refused();task(taskArn);
   return await transaction(async client=>{
    const found=await client.query(`SELECT ${ROW} FROM meri_service_identity.service_task_registrations WHERE task_arn=$1`,[taskArn]);
    if(found?.rows?.length===0)return absent();
    if(found?.rows?.length!==1)throw unavailable();
    const row=found.rows[0];
    if(row.revoked_at!==null||row.role!==role)return revoked();
    return receipt(row);
   },signal);
  }catch{return notAvailable();}
 }
 async function probe({signal}={}){
  // Startup gate: a fresh primary read, schema presence, and the exact narrow
  // DML grants. No synthetic row or write is used for the preflight.
  // This does not borrow a real task or create/revoke a registration.
  await transaction(async client=>{
   const grants=await client.query(`SELECT
    session_user::text AS session_role,current_user::text AS current_role,
    r.rolsuper AS superuser,r.rolbypassrls AS bypass_rls,
    r.rolcreatedb AS create_db,r.rolcreaterole AS create_role,
    r.rolinherit AS inherit_role,pg_get_userbyid(c.relowner) AS table_owner,
    pg_get_userbyid(n.nspowner) AS schema_owner,
    pg_has_role(current_user,c.relowner,'MEMBER') AS table_owner_member,
    pg_has_role(current_user,n.nspowner,'MEMBER') AS schema_owner_member,
    pg_has_role(current_user,c.relowner,'SET') AS table_owner_set,
    pg_has_role(current_user,n.nspowner,'SET') AS schema_owner_set,
    EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid OR (m.roleid=r.oid AND NOT
      (m.grantor=10 AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)))
      AS role_membership,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) acl
      WHERE acl.grantee=0) AS public_schema_acl,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
      WHERE acl.grantee=0) AS public_table_acl,
    EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) acl
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped AND acl.grantee=0)
      AS public_column_acl,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) acl
      WHERE acl.grantee NOT IN (n.nspowner,r.oid)) AS other_schema_acl,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
      WHERE acl.grantee NOT IN (c.relowner,r.oid)) AS other_table_acl,
    EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) acl
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped AND
        acl.grantee NOT IN (c.relowner,r.oid)) AS other_column_acl,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) acl
      WHERE acl.grantee=r.oid AND acl.is_grantable) AS issuer_schema_grant_option,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
      WHERE acl.grantee=r.oid AND acl.is_grantable) AS issuer_table_grant_option,
    EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) acl
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped AND
        acl.grantee=r.oid AND acl.is_grantable) AS issuer_column_grant_option,
    has_schema_privilege(current_user,'meri_service_identity','USAGE') AS schema_usage,
    has_schema_privilege(current_user,'meri_service_identity','CREATE') AS schema_create,
    has_table_privilege(current_user,'meri_service_identity.service_task_registrations','SELECT') AS table_select,
    has_table_privilege(current_user,'meri_service_identity.service_task_registrations','INSERT') AS table_insert,
    has_table_privilege(current_user,'meri_service_identity.service_task_registrations','UPDATE') AS table_update,
    has_table_privilege(current_user,'meri_service_identity.service_task_registrations','DELETE') AS table_delete,
    has_table_privilege(current_user,'meri_service_identity.service_task_registrations','TRUNCATE') AS table_truncate,
    has_table_privilege(current_user,'meri_service_identity.service_task_registrations','TRIGGER') AS table_trigger,
    has_table_privilege(current_user,'meri_service_identity.service_task_registrations','REFERENCES') AS table_references,
    has_any_column_privilege(current_user,c.oid,'REFERENCES') AS column_references,
    EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0
      AND NOT a.attisdropped AND a.attname NOT IN
        ('certificate_sha256','expires_at_ms','proof_observed_at_ms','generation','updated_at','revoked_at')
      AND has_column_privilege(current_user,c.oid,a.attnum,'UPDATE')) AS unexpected_column_update,
    has_column_privilege(current_user,'meri_service_identity.service_task_registrations','certificate_sha256','UPDATE') AS cert_update,
    has_column_privilege(current_user,'meri_service_identity.service_task_registrations','expires_at_ms','UPDATE') AS expiry_update,
    has_column_privilege(current_user,'meri_service_identity.service_task_registrations','proof_observed_at_ms','UPDATE') AS proof_update,
    has_column_privilege(current_user,'meri_service_identity.service_task_registrations','generation','UPDATE') AS generation_update,
    has_column_privilege(current_user,'meri_service_identity.service_task_registrations','updated_at','UPDATE') AS timestamp_update,
    has_column_privilege(current_user,'meri_service_identity.service_task_registrations','revoked_at','UPDATE') AS revoke_update
    FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE r.rolname=current_user AND c.oid='meri_service_identity.service_task_registrations'::regclass`);
   if(grants?.rows?.length!==1)throw unavailable();
   const g=grants.rows[0];
   if(Object.keys(g).length!==40||g.session_role!==expectedRole||g.current_role!==expectedRole||
      g.table_owner===expectedRole||g.schema_owner===expectedRole||
      ['superuser','bypass_rls','create_db','create_role','inherit_role',
       'schema_create','table_update','table_delete','table_truncate',
       'table_trigger','table_references','column_references','unexpected_column_update',
       'role_membership','table_owner_member','schema_owner_member',
       'table_owner_set','schema_owner_set','public_schema_acl','public_table_acl',
       'public_column_acl','other_schema_acl','other_table_acl','other_column_acl',
       'issuer_schema_grant_option','issuer_table_grant_option',
       'issuer_column_grant_option'].some(key=>g[key]!==false)||
      ['schema_usage','table_select','table_insert','cert_update','expiry_update',
       'proof_update','generation_update','timestamp_update','revoke_update'].some(key=>g[key]!==true))
    throw unavailable();
   const checked=await client.query('SELECT task_arn FROM meri_service_identity.service_task_registrations LIMIT 0');
   if(!Array.isArray(checked?.rows)||checked.rows.length!==0)throw unavailable();
  },signal);
  return Object.freeze({schemaVersion:1,state:'READY'});
 }
 async function readCurrent({certificateSha256,role,signal}={}){
  try{
   if(!SHA.test(certificateSha256??'')||!ROLE.includes(role))throw refused();
   return await transaction(async client=>{
    const result=await client.query(`SELECT ${ROW},
      (extract(epoch from clock_timestamp())*1000)::bigint::text AS db_now_ms
      FROM meri_service_identity.service_task_registrations WHERE certificate_sha256=$1`,
      [certificateSha256]);
    if(result?.rows?.length===0)return revoked();
    if(result?.rows?.length!==1)throw unavailable();
    const row=result.rows[0];
    if(row.revoked_at!==null||row.role!==role||
       parseIntMs(row.expires_at_ms)<=parseIntMs(row.db_now_ms))return revoked();
    return receipt(row);
   },signal);
  }catch{return notAvailable();}
 }
 async function registerCurrent(raw){
  const input=registerInput(raw);
  const saved=await transaction(async client=>{
   // An absent task is inserted once; conflict with a prior revoke preserves its
   // tombstone. No UPSERT path can turn revoked_at back to NULL.
   if(input.expectedCertificateSha256===null){
    await client.query(`INSERT INTO meri_service_identity.service_task_registrations
      (task_arn,role,peer_ipv4,revision,service_arn,task_definition_arn,image_uri,
       task_role_arn,execution_role_arn,certificate_sha256,peer_san_uri,
       expires_at_ms,proof_observed_at_ms,generation)
      SELECT $1,$2,$3::inet,$4,$5,$6,$7,$8,$9,$10,$11,$12::bigint,$13::bigint,1
      WHERE (extract(epoch from clock_timestamp())*1000)::bigint + 3000 < $14::bigint
        AND $13::bigint <= (extract(epoch from clock_timestamp())*1000)::bigint
        AND $12::bigint > (extract(epoch from clock_timestamp())*1000)::bigint
        AND $12::bigint <= (extract(epoch from clock_timestamp())*1000)::bigint + 3600000
        AND NOT pg_is_in_recovery()
      ON CONFLICT (task_arn) DO NOTHING`,
      [input.taskArn,input.role,input.peerIPv4,input.revision,input.serviceArn,
       input.taskDefinitionArn,input.imageUri,input.taskRoleArn,input.executionRoleArn,
       input.certificateSha256,input.peerSanUri,input.expiresAtMs,input.proofObservedAtMs,
       input.proofValidUntilMs]);
   }
   const found=await client.query(`SELECT ${ROW} FROM meri_service_identity.service_task_registrations
     WHERE task_arn=$1 FOR UPDATE`,[input.taskArn]);
   if(found?.rows?.length!==1)throw refused();
   let row=found.rows[0];
   if(row.revoked_at!==null||!sameIdentity(row,input))throw refused();
   const clock=await client.query('SELECT (extract(epoch from clock_timestamp())*1000)::bigint::text AS db_now_ms');
   if(clock?.rows?.length!==1)throw unavailable();
   const dbNow=parseIntMs(clock.rows[0].db_now_ms);
   if(input.proofObservedAtMs>dbNow||input.proofValidUntilMs<=dbNow+3000||
      input.expiresAtMs<=dbNow||input.expiresAtMs>dbNow+3600000)throw refused();
   if(row.certificate_sha256===input.certificateSha256){
    // Recovery after a lost COMMIT is positive only after an exact writer row.
    if(parseIntMs(row.expires_at_ms)!==input.expiresAtMs||
       parseIntMs(row.proof_observed_at_ms)!==input.proofObservedAtMs)throw refused();
    return receipt(row);
   }
   if(input.expectedCertificateSha256===null||
      row.certificate_sha256!==input.expectedCertificateSha256)throw refused();
   const changed=await client.query(`UPDATE meri_service_identity.service_task_registrations
     SET certificate_sha256=$2,expires_at_ms=$3::bigint,
         proof_observed_at_ms=$4::bigint,generation=generation+1,
         updated_at=clock_timestamp()
     WHERE task_arn=$1 AND certificate_sha256=$5 AND revoked_at IS NULL
       AND $3::bigint > expires_at_ms
       AND $3::bigint > (extract(epoch from clock_timestamp())*1000)::bigint
       AND $4::bigint >= proof_observed_at_ms
       AND $4::bigint <= (extract(epoch from clock_timestamp())*1000)::bigint
       AND (extract(epoch from clock_timestamp())*1000)::bigint + 3000 < $6::bigint
       AND NOT pg_is_in_recovery()
     RETURNING ${ROW}`,[input.taskArn,input.certificateSha256,input.expiresAtMs,
       input.proofObservedAtMs,input.expectedCertificateSha256,input.proofValidUntilMs]);
   if(changed?.rows?.length!==1)throw refused();
   row=changed.rows[0];return receipt(row);
  },input.signal);
  const current=await readCurrent({certificateSha256:input.certificateSha256,
   role:input.role,signal:input.signal});
  if(!sameReceipt(saved,current))throw unavailable();
  return saved;
 }
 // Internal deployment-owner operation only. Never mount this method on the
 // bootstrap/token HTTP boundary or authorize it from a caller body.
 async function revokeTask({taskArn,signal}={}){
  task(taskArn);
  await transaction(async client=>{
   await client.query(`INSERT INTO meri_service_identity.service_task_registrations
     (task_arn,revoked_at) VALUES($1,clock_timestamp())
     ON CONFLICT (task_arn) DO UPDATE SET
       revoked_at=clock_timestamp(),generation=meri_service_identity.service_task_registrations.generation+1,
       updated_at=clock_timestamp()
     WHERE meri_service_identity.service_task_registrations.revoked_at IS NULL`,[taskArn]);
  },signal);
  const tombstone=await transaction(async client=>{
   const found=await client.query(`SELECT revoked_at FROM meri_service_identity.service_task_registrations
     WHERE task_arn=$1`,[taskArn]);
   return found?.rows?.length===1&&found.rows[0].revoked_at!==null;
  },signal);
  if(tombstone!==true)throw unavailable();
  return revoked();
 }
 return Object.freeze({probe,readTaskCurrent,readCurrent,registerCurrent,revokeTask,
  close(){
   closed=true;
   const pendingTransactionsCount=pendingTransactions.size;
   const pendingQueriesCount=pendingQueries.size;
   const pendingBorrowsCount=pendingBorrows.size;
   if(pendingTransactionsCount>0||pendingQueriesCount>0||pendingBorrowsCount>0)
    cleanupUnknownSticky=true;
   return Object.freeze({schemaVersion:1,
    state:uncertain||cleanupUnknownSticky?
     'CLEANUP_UNKNOWN':'CLEAN',
    pendingTransactions:pendingTransactionsCount,pendingQueries:pendingQueriesCount,
    pendingBorrows:pendingBorrowsCount,uncertain});
  },available:()=>!closed});
}
