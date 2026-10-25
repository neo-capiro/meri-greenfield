/** Opt-in PostgreSQL 16 proof for the tenant-settings control-role grants.
 * Provisioning and disposal belong to the caller. This suite connects directly as the ordinary control role;
 * it never installs dependencies, creates roles, applies migrations, changes grants or selects another role.
 * Native identity and Core membership facts are synthetic; the runtime family, gate, service, SQL and database are real. */
import test,{describe,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createMembershipGate} from '../../product-access/membership.mjs';
import {createSettingsFamily} from '../../../runtime/product-ports/settings.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../../../runtime/product-ports/capability-policy.mjs';
import {TENANT_SETTINGS_PERMISSION} from '../service.mjs';
import {DEFAULT_MODEL_LIMITS} from '../documents.mjs';
import {TENANT_SETTINGS_PATHS} from '../tenant-application/protocol.mjs';
import {concurrentQueryBoundary,rolledBackProbe,scrubbed} from '../user-application/test/postgres-qualification-fixture.mjs';

const SOCKET='/tmp/meri-tenant-settings-role-pg-20261025/socket',DATABASE='meri_settings_role_fixture',ROLE='meri_control_runtime';
let driverLoaded=false;
function target(environment){
 const socket=environment.MERI_SETTINGS_ROLE_PG_SOCKET,database=environment.MERI_SETTINGS_ROLE_PG_DATABASE;
 if(socket===undefined&&database===undefined)return null;
 if(socket!==SOCKET||database!==DATABASE)throw Error('Tenant-settings role proof requires its exact disposable socket/database; no connection attempted');
 return {host:SOCKET,port:5432,database:DATABASE,user:ROLE,password:'',ssl:false};
}
const enabled=process.env.MERI_SETTINGS_ROLE_PG_SOCKET!==undefined||process.env.MERI_SETTINGS_ROLE_PG_DATABASE!==undefined;
const qualify=(name,operation)=>test(name,{timeout:30000},()=>scrubbed(operation));
const settings=(over={})=>({defaultTimezone:'UTC',capabilityPolicy:{capabilities:{bash:false}},model:{monthlyCapMicroUsd:5000000,maxTurns:11,maxBudgetMicroUsd:700000},...over});

async function rolePool(){
 const configuration=target(process.env);
 assert.ok(configuration,'Explicit disposable target is required before driver initialization');
 // Resolve the already installed runtime dependency, after the target guard. No ambient connection string is accepted.
 const {Pool}=createRequire(new URL('../../../runtime/package.json',import.meta.url))('pg');driverLoaded=true;
 const pool=new Pool({...configuration,max:4,connectionTimeoutMillis:2000,idleTimeoutMillis:1000,statement_timeout:5000,
  lock_timeout:2000,idle_in_transaction_session_timeout:5000,query_timeout:7000,application_name:'meri-tenant-settings-role-proof'});
 pool.on('error',()=>{});
 try{
  const {rows:[identity]}=await pool.query(`SELECT current_database()=$1 AS database_matches,
   current_user=$2 AND session_user=$2 AS direct_role,inet_server_addr() IS NULL AS unix_socket,
   current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS postgres_16,
   NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS ordinary_role,
   NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=pg_roles.oid) AS no_role_memberships,
   NOT pg_has_role(current_user,(SELECT datdba FROM pg_database WHERE datname=current_database()),'USAGE') AS not_database_owner,
   NOT pg_has_role(current_user,(SELECT nspowner FROM pg_namespace WHERE nspname='meri_settings'),'USAGE') AS not_schema_owner,
   NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='meri_settings' AND pg_has_role(current_user,c.relowner,'USAGE')) AS not_relation_owner
   FROM pg_roles WHERE rolname=current_user`,[DATABASE,ROLE]);
  assert.deepEqual(identity,{database_matches:true,direct_role:true,unix_socket:true,postgres_16:true,ordinary_role:true,
   no_role_memberships:true,not_database_owner:true,not_schema_owner:true,not_relation_owner:true});
  return pool;
 }catch(error){await pool.end();throw error;}
}

function api(pool,{newId=randomUUID,tenantId='qual-tenant-settings-'+randomUUID()}={}){
 const identities={admin:{tenantId,actorId:'qual-admin-'+randomUUID()},member:{tenantId,actorId:'qual-member-'+randomUUID()},
  other:{tenantId:'qual-other-tenant-'+randomUUID(),actorId:'qual-other-admin-'+randomUUID()}};
 const state={permissions:[TENANT_SETTINGS_PERMISSION],status:'active',revision:'synthetic-membership-1',memberships:0};
 const now=Date.now,gate=createMembershipGate({now,limits:{maxRequestMs:5000,maxFactBytes:65536},
  async verifyToken({credential}){
   assert.ok(Object.hasOwn(identities,credential));
   return {...identities[credential],checkedAtMs:now(),expiresAtMs:now()+10000};
  },
  async readMembership({tenantId:requestedTenant,actorId,credential}){
   state.memberships++;
   return {tenantId:requestedTenant,actorId,status:credential==='admin'?state.status:'active',role:credential==='member'?'standard_user':'user_admin',
    permissions:credential==='admin'?[...state.permissions]:credential==='other'?[TENANT_SETTINGS_PERMISSION]:[],clientIds:[],
    membershipRevision:state.revision,checkedAtMs:now(),expiresAtMs:now()+10000};
  }});
 const configuration={tenantSettings:{enabled:true},capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM,
  limits:{requestMs:10000,requestBytes:65536},native:{maxResponseBytes:262144}};
 const {settingsApplication}=createSettingsFamily({configuration,pool,now,canonicalProductPorts:{conversationMembership:gate}},{newId}).ports;
 const call=async(route,body={},credential='admin')=>{
  const response=await settingsApplication.handle(new Request('https://control.synthetic.invalid'+TENANT_SETTINGS_PATHS[route],{
   method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+credential},body:JSON.stringify(body)}));
  return {status:response.status,value:await response.json()};
 };
 return {state,identities,call,read:(credential='admin')=>call('read',{},credential),
  save:(revision,document,credential='admin')=>call('save',{expectedRevision:revision,settings:document},credential),
  audit:(body={},credential='admin')=>call('audit',body,credential)};
}

async function persisted(pool,tenantId){
 const tenant=await pool.query('SELECT * FROM meri_settings.tenant_settings WHERE tenant_id=$1',[tenantId]);
 const audit=await pool.query("SELECT * FROM meri_settings.settings_audit WHERE tenant_id=$1 AND target='tenant' ORDER BY sequence",[tenantId]);
 return {tenant:tenant.rows,audit:audit.rows};
}
function assertStored(state,{revision,document,audits}){
 const {model,...base}=document;
 assert.equal(state.tenant.length,1);assert.equal(Number(state.tenant[0].revision),revision);
 assert.deepEqual(state.tenant[0].document,base);assert.equal(state.tenant[0].document_sha256,canonicalSha256(base));
 assert.deepEqual({monthlyCapMicroUsd:Number(state.tenant[0].monthly_cap_micro_usd),maxTurns:state.tenant[0].sdk_max_turns,
  maxBudgetMicroUsd:Number(state.tenant[0].sdk_max_budget_micro_usd)},model);
 assert.equal(state.audit.length,audits);assert.equal(Number(state.audit.at(-1).to_revision),revision);
 assert.equal(state.audit.at(-1).after_sha256,canonicalSha256(document));assert.equal(state.audit.at(-1).subject_actor_id,null);
 assert.ok(state.audit.every(row=>row.target==='tenant'&&row.platform_sha256!==null));
}
function assertLimitedRead(result,revision,timezone){
 assert.equal(result.status,200);
 assert.deepEqual(Object.keys(result.value).sort(),['capabilityStatus','defaultTimezone','effectiveCapabilities','revision']);
 assert.equal(result.value.revision,revision);assert.equal(result.value.defaultTimezone,timezone);assert.equal(result.value.capabilityStatus,'resolved');
}

test('tenant-role target guard is inert by default and refuses other destinations before loading pg',()=>{
 assert.equal(driverLoaded,false);assert.equal(target({}),null);
 assert.deepEqual(target({MERI_SETTINGS_ROLE_PG_SOCKET:SOCKET,MERI_SETTINGS_ROLE_PG_DATABASE:DATABASE}),
  {host:SOCKET,port:5432,database:DATABASE,user:ROLE,password:'',ssl:false});
 for(const environment of [
  {MERI_SETTINGS_ROLE_PG_SOCKET:SOCKET},{MERI_SETTINGS_ROLE_PG_DATABASE:DATABASE},
  {MERI_SETTINGS_ROLE_PG_SOCKET:'/tmp',MERI_SETTINGS_ROLE_PG_DATABASE:DATABASE},
  {MERI_SETTINGS_ROLE_PG_SOCKET:'127.0.0.1',MERI_SETTINGS_ROLE_PG_DATABASE:DATABASE},
  {MERI_SETTINGS_ROLE_PG_SOCKET:SOCKET,MERI_SETTINGS_ROLE_PG_DATABASE:'postgres'},
 ])assert.throws(()=>target(environment),/no connection attempted/u);
 assert.equal(driverLoaded,false);
});

describe('ordinary control-role PostgreSQL tenant settings',{skip:enabled?false:'Disposable PostgreSQL socket/database not explicitly supplied',concurrency:1,timeout:150000},()=>{
 let pool;
 before(()=>scrubbed(async()=>{pool=await rolePool();}));
 after(async()=>{if(pool)await scrubbed(()=>pool.end());});

 qualify('ordinary role has only the required tenant columns and cannot rewrite identity, destroy rows or administer the schema',async()=>{
  const columns=(await pool.query(`SELECT attname AS name,
   has_column_privilege(current_user,attrelid,attnum,'SELECT') AS read,
   has_column_privilege(current_user,attrelid,attnum,'INSERT') AS insert,
   has_column_privilege(current_user,attrelid,attnum,'UPDATE') AS update
   FROM pg_attribute WHERE attrelid='meri_settings.tenant_settings'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum`)).rows;
  const names=['tenant_id','revision','document','document_sha256','updated_at','updated_by','monthly_cap_micro_usd','sdk_max_turns','sdk_max_budget_micro_usd'];
  assert.deepEqual(columns,names.map(name=>({name,read:true,insert:true,update:name!=='tenant_id'})));
  const {rows:[grants]}=await pool.query(`SELECT
   has_table_privilege(current_user,'meri_settings.tenant_settings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS tenant_table_grant,
   has_any_column_privilege(current_user,'meri_settings.tenant_settings','REFERENCES') AS tenant_reference,
   has_table_privilege(current_user,'meri_settings.settings_audit','INSERT') AS audit_insert,
   has_table_privilege(current_user,'meri_settings.settings_audit','SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS audit_table_extra,
   has_any_column_privilege(current_user,'meri_settings.settings_audit','UPDATE,REFERENCES') AS audit_column_extra,
   has_schema_privilege(current_user,'meri_settings','USAGE') AS schema_usage,
   has_schema_privilege(current_user,'meri_settings','CREATE') AS schema_create,
   has_database_privilege(current_user,current_database(),'CREATE') AS database_create`);
  assert.deepEqual(grants,{tenant_table_grant:false,tenant_reference:false,audit_insert:true,audit_table_extra:false,
   audit_column_extra:false,schema_usage:true,schema_create:false,database_create:false});
  const auditColumns=(await pool.query(`SELECT attname AS name,has_column_privilege(current_user,attrelid,attnum,'SELECT') AS read
   FROM pg_attribute WHERE attrelid='meri_settings.settings_audit'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum`)).rows;
  assert.deepEqual(auditColumns,['sequence','audit_id','tenant_id','target','subject_actor_id','actor_id','from_revision','to_revision',
   'before_sha256','after_sha256','platform_sha256','changed_fields','recorded_at'].map(name=>({name,read:true})));
  const f=api(pool);assert.equal((await f.save(0,settings())).status,200);
  const previous=await persisted(pool,f.identities.admin.tenantId);
  const probes=[
   ['UPDATE meri_settings.tenant_settings SET tenant_id=tenant_id WHERE tenant_id=$1',[f.identities.admin.tenantId]],
   ['DELETE FROM meri_settings.tenant_settings WHERE tenant_id=$1',[f.identities.admin.tenantId]],
   ['TRUNCATE TABLE meri_settings.tenant_settings',[]],
   ['UPDATE meri_settings.settings_audit SET recorded_at=recorded_at WHERE tenant_id=$1',[f.identities.admin.tenantId]],
   ['DELETE FROM meri_settings.settings_audit WHERE tenant_id=$1',[f.identities.admin.tenantId]],
   ['TRUNCATE TABLE meri_settings.settings_audit',[]],
   ['CREATE TABLE meri_settings.role_probe (value integer)',[]],
   ['ALTER TABLE meri_settings.tenant_settings ADD COLUMN role_probe integer',[]],
   ['CREATE SCHEMA tenant_settings_role_probe',[]],
  ];
  for(const [sql,parameters]of probes)await rolledBackProbe(pool,async client=>{
   await assert.rejects(client.query(sql,parameters),error=>error.code==='42501','forbidden operation must receive insufficient_privilege');
  });
  assert.deepEqual(await persisted(pool,f.identities.admin.tenantId),previous);
 });

 qualify('runtime family reads defaults, creates and updates tenant settings, reads audit pages and isolates other tenants',async()=>{
  const f=api(pool),initial=settings({defaultTimezone:'America/New_York'}),updated=settings({defaultTimezone:'Europe/London',
   model:{monthlyCapMicroUsd:6000000,maxTurns:12,maxBudgetMicroUsd:800000}});
  const defaults=await f.read();assert.equal(defaults.status,200);assert.equal(defaults.value.revision,0);
  assert.equal(defaults.value.defaultTimezone,'UTC');assert.deepEqual(defaults.value.capabilityPolicy,{});
  assert.deepEqual(defaults.value.model,{monthlyCapMicroUsd:null,...DEFAULT_MODEL_LIMITS});
  assertLimitedRead(await f.read('member'),0,'UTC');
  for(const [revision,document]of [[0,initial],[1,updated]]){
   const saved=await f.save(revision,document);assert.equal(saved.status,200);assert.equal(saved.value.revision,revision+1);
   assert.deepEqual(saved.value.model,document.model);assert.equal(saved.value.effectiveCapabilities.bash,false);
   const read=await f.read();assert.equal(read.status,200);assert.equal(read.value.revision,revision+1);
   assert.equal(read.value.defaultTimezone,document.defaultTimezone);assert.deepEqual(read.value.capabilityPolicy,document.capabilityPolicy);
   assert.deepEqual(read.value.model,document.model);
   assertStored(await persisted(pool,f.identities.admin.tenantId),{revision:revision+1,document,audits:revision+1});
  }
  assertLimitedRead(await f.read('member'),2,updated.defaultTimezone);
  const first=await f.audit({limit:1});assert.equal(first.status,200);assert.equal(first.value.entries.length,1);
  assert.equal(first.value.entries[0].fromRevision,1);assert.equal(first.value.entries[0].toRevision,2);
  assert.equal(first.value.entries[0].beforeSha256,canonicalSha256(initial));assert.equal(first.value.entries[0].afterSha256,canonicalSha256(updated));
  assert.deepEqual(first.value.entries[0].changedFields,['defaultTimezone','model.maxBudgetMicroUsd','model.maxTurns','model.monthlyCapMicroUsd']);
  assert.equal(first.value.nextBeforeSequence,first.value.entries[0].sequence);
  const second=await f.audit({limit:1,beforeSequence:first.value.nextBeforeSequence});assert.equal(second.status,200);
  assert.equal(second.value.entries.length,1);assert.equal(second.value.entries[0].fromRevision,0);assert.equal(second.value.entries[0].beforeSha256,null);
  assert.equal(second.value.nextBeforeSequence,null);
  const other=await f.read('other');assert.equal(other.status,200);assert.equal(other.value.revision,0);
  assert.deepEqual(await f.audit({},'other'),{status:200,value:{entries:[],nextBeforeSequence:null}});
  assert.deepEqual(await persisted(pool,f.identities.other.tenantId),{tenant:[],audit:[]});
 });

 qualify('current membership permission removal refuses saves and audit while active members retain their limited read',async()=>{
  const f=api(pool),document=settings();assert.equal((await f.save(0,document)).status,200);
  const previous=await persisted(pool,f.identities.admin.tenantId);
  for(const credential of ['member','admin']){
   if(credential==='admin'){
    assert.equal((await f.audit()).status,200);
    f.state.permissions=[];f.state.revision='synthetic-membership-2';
   }
   const reads=f.state.memberships;
   assert.deepEqual(await f.save(1,settings({defaultTimezone:'Europe/London'}),credential),{status:403,value:{error:{code:'SETTINGS_ADMIN_REQUIRED'}}});
   assert.deepEqual(await f.audit({},credential),{status:403,value:{error:{code:'SETTINGS_ADMIN_REQUIRED'}}});
   assertLimitedRead(await f.read(credential),1,document.defaultTimezone);
   assert.ok(f.state.memberships>=reads+4,'each new request must use current membership and successful reads must recheck it');
  }
  f.state.status='removed';f.state.revision='synthetic-membership-3';
  for(const result of [await f.read(),await f.save(1,settings()),await f.audit()])
   assert.deepEqual(result,{status:403,value:{error:{code:'MEMBERSHIP_REVOKED'}}});
  assert.deepEqual(await persisted(pool,f.identities.admin.tenantId),previous);
 });

 qualify('concurrent initial and existing revision saves have one winner and stale saves never add an audit',async()=>{
  const tenantId='qual-tenant-cas-'+randomUUID(),plain=api(pool,{tenantId});
  for(const revision of [0,1]){
   const documents=[settings({defaultTimezone:'America/New_York'}),settings({defaultTimezone:'Europe/London'})];
   const boundary=concurrentQueryBoundary(pool,sql=>revision===0?sql.startsWith('INSERT INTO meri_settings.tenant_settings('):
    sql.startsWith('SELECT * FROM meri_settings.tenant_settings ')&&sql.endsWith(' FOR UPDATE'));
   try{
    const concurrent=api(boundary.port,{tenantId}),outcomes=await Promise.all(documents.map(document=>concurrent.save(revision,document)));
    assert.equal(boundary.arrivals(),2);assert.equal(outcomes.filter(result=>result.status===200).length,1);
    assert.equal(outcomes.filter(result=>result.status===409&&result.value.error.code==='SETTINGS_REVISION_CONFLICT').length,1);
    const winner=outcomes.findIndex(result=>result.status===200),state=await persisted(pool,tenantId);
    assertStored(state,{revision:revision+1,document:documents[winner],audits:revision+1});
    assert.equal(new Set(state.audit.map(row=>row.audit_id)).size,revision+1);
    const read=await plain.read();assert.equal(read.status,200);assert.equal(read.value.defaultTimezone,documents[winner].defaultTimezone);
    assert.deepEqual(await plain.save(revision,documents[1-winner]),{status:409,value:{error:{code:'SETTINGS_REVISION_CONFLICT'}}});
    assert.deepEqual(await persisted(pool,tenantId),state);
   }finally{boundary.close();}
  }
 });

 qualify('a real audit uniqueness failure rolls the tenant update back with its typed model columns',async()=>{
  const auditId=randomUUID(),f=api(pool,{newId:()=>auditId}),initial=settings();
  assert.equal((await f.save(0,initial)).status,200);const previous=await persisted(pool,f.identities.admin.tenantId);
  const failed=await f.save(1,settings({defaultTimezone:'Europe/London',model:{monthlyCapMicroUsd:9000000,maxTurns:19,maxBudgetMicroUsd:900000}}));
  assert.deepEqual(failed,{status:503,value:{error:{code:'SETTINGS_STORE_UNAVAILABLE'}}});
  assert.deepEqual(await persisted(pool,f.identities.admin.tenantId),previous);
  const read=await f.read();assert.equal(read.status,200);assert.equal(read.value.revision,1);assert.deepEqual(read.value.model,initial.model);
  assert.equal((await f.audit()).value.entries.length,1);
 });
});
