/** OPT-IN real PostgreSQL qualification. No database setup, schema/role mutation or credentials are provided by this suite.
 * Native identity/Core membership facts are SYNTHETIC; storage, locks, constraints, transactions, audit and API owners are real.
 * Lost COMMIT acknowledgement is a test-owned delivery fault after a real COMMIT, not TCP/network qualification. */
import test,{describe,before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createPostgresSettingsStore} from '../../postgres-store.mjs';
import {createUserPreferencesService} from '../../user-service.mjs';
import {createUserPreferencesFeature} from '../feature.mjs';
import {createMembershipGate} from '../../../product-access/membership.mjs';
import {productFailure} from '../../../product-access/errors.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createRuntimeUserPreferences} from '../../../../runtime/user-preferences.mjs';
import {receiveUserPreferencesRequest,receiveUserPreferencesResponse,USER_PREFERENCE_DEFAULTS,userPreferencesPaths} from '../../../../../packages/contracts/dist/user-preferences-application.mjs';
import {qualificationConfiguration,qualificationPool,qualificationDriverLoaded,taskIdentity,clientBoundary,concurrentQueryBoundary,lostCommitAcknowledgement,persisted,rolledBackProbe,QUALIFICATION_DATABASE,QUALIFICATION_PORT,scrubbed} from './postgres-qualification-fixture.mjs';
const enabled=process.env.MERI_PREFERENCES_PG_QUALIFY==='1',preferences=over=>({...structuredClone(USER_PREFERENCE_DEFAULTS),...over});
const saveInput=(identity,revision,document,auditId=randomUUID())=>({kind:'user',...identity,expectedRevision:revision,document,initialDocument:USER_PREFERENCE_DEFAULTS,audit:{auditId,actorId:identity.actorId,platformSha256:null}});
const failure=code=>error=>productFailure(error)?.code===code;
const qualify=(name,fn)=>test(name,{timeout:25000},()=>scrubbed(fn));
function assertStored(state,{revision,document,audits}){
 assert.equal(state.preferences.length,1);assert.equal(Number(state.preferences[0].revision),revision);assert.deepEqual(state.preferences[0].document,document);assert.equal(state.preferences[0].document_sha256,canonicalSha256(document));assert.equal(state.audit.length,audits);
 assert.equal(Number(state.audit.at(-1).to_revision),revision);assert.equal(state.audit.at(-1).after_sha256,canonicalSha256(document));
}
function api(pool){
 const primary=taskIdentity('api'),otherActor={tenantId:primary.tenantId,actorId:'qual-actor-'+randomUUID()},otherTenant={tenantId:'qual-task6-other-'+randomUUID(),actorId:primary.actorId};
 const identities={A:primary,B:otherActor,C:otherTenant},state={revision:'synthetic-membership-1',status:'active',admissions:0,memberships:0,revokeAfterAdmission:false,changeAfterCommit:false};
 const now=Date.now,gate=createMembershipGate({now,limits:{maxRequestMs:5000,maxFactBytes:65536},async verifyToken({credential}){
  assert(Object.hasOwn(identities,credential));state.admissions++;return {...identities[credential],checkedAtMs:now(),expiresAtMs:now()+10000};
 },async readMembership({tenantId,actorId}){
  state.memberships++;const fact={tenantId,actorId,status:state.status,role:'standard_user',permissions:[],clientIds:[],membershipRevision:state.revision,checkedAtMs:now(),expiresAtMs:now()+10000};
  if(state.revokeAfterAdmission){state.revokeAfterAdmission=false;state.status='removed';}return fact;
 }});
 const port=clientBoundary(pool,async call=>{const result=await call.forward();if(call.sql==='COMMIT'&&state.changeAfterCommit){state.changeAfterCommit=false;state.revision='synthetic-membership-2';}return result;});
 const feature=createUserPreferencesFeature({enabled:true,gate,pool:port,now,newId:randomUUID});
 const call=async(route,body,credential='A')=>{
  const response=await feature.application.handle(new Request('https://meri.synthetic.invalid'+userPreferencesPaths[route],{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+credential},body:JSON.stringify(body)}));
  const text=await response.text(),expectation=route==='save'?{owner:identities[credential],request:body}:{owner:identities[credential]};
  return {status:response.status,value:await receiveUserPreferencesResponse(route,response.status,text,expectation)};
 };
 const read=credential=>call('read',{},credential),save=async(revision,document,credential)=>call('save',await receiveUserPreferencesRequest('save',JSON.stringify({expectedRevision:revision,preferences:document})),credential);
 return {state,identities,feature,gate,call,read,save};
}

test('PostgreSQL target guard is inert without opt-in and refuses wrong destinations before pg initialization',async()=>{
 assert.equal(qualificationDriverLoaded(),false);
 assert.equal(qualificationConfiguration({}),null);assert.equal(qualificationConfiguration({MERI_PREFERENCES_PG_URL:'postgresql://example.invalid/production'}),null);
 const env=raw=>({MERI_PREFERENCES_PG_QUALIFY:'1',MERI_PREFERENCES_PG_URL:raw}),valid='postgresql://qualification@127.0.0.1:'+QUALIFICATION_PORT+'/'+QUALIFICATION_DATABASE;
 assert.equal(qualificationConfiguration(env(valid)).connectionString,valid);
 for(const value of [undefined,'postgresql://qualification@localhost:'+QUALIFICATION_PORT+'/'+QUALIFICATION_DATABASE,'postgresql://qualification@127.0.0.1:5432/'+QUALIFICATION_DATABASE,valid.replace(QUALIFICATION_DATABASE,'postgres'),valid+'?options=-csearch_path%3Dpublic',valid+'#other','https://qualification@127.0.0.1:'+QUALIFICATION_PORT+'/'+QUALIFICATION_DATABASE])assert.throws(()=>qualificationConfiguration(env(value)),/no connection attempted/u);
 assert.throws(()=>qualificationConfiguration({...env(valid),MERI_PREFERENCES_PG_ROLE_CHECK:'1'}),/no connection attempted/u);
 await assert.rejects(qualificationPool(valid.replace(QUALIFICATION_DATABASE,'postgres')),/no connection attempted/u);assert.equal(qualificationDriverLoaded(),false);
});

describe('explicitly allocated task-6 real PostgreSQL user preferences',{skip:enabled?false:'PENDING: explicit task-owned PostgreSQL allocation, schema provisioning and opt-in environment required',timeout:120000,concurrency:1},()=>{
 let pool,configuration;
 before(async()=>scrubbed(async()=>{configuration=qualificationConfiguration(process.env);pool=await qualificationPool(configuration.connectionString);}));
 after(async()=>{if(pool)await scrubbed(()=>pool.end());});

 qualify('two simultaneous absent-row creators produce one revision and one audit',async()=>{
  const identity=taskIdentity('initial-cas'),documents=[preferences({theme:'dark'}),preferences({theme:'light'})],boundary=concurrentQueryBoundary(pool,sql=>sql.startsWith('INSERT INTO meri_settings.user_preferences('));
  try{
   const store=createPostgresSettingsStore({pool:boundary.port}),outcomes=await Promise.allSettled(documents.map(document=>store.save(saveInput(identity,0,document))));
   assert.equal(boundary.arrivals(),2);assert.equal(outcomes.filter(value=>value.status==='fulfilled').length,1);assert.equal(outcomes.filter(value=>value.status==='rejected'&&failure('SETTINGS_REVISION_CONFLICT')(value.reason)).length,1);
   const winner=outcomes.findIndex(value=>value.status==='fulfilled'),state=await persisted(pool,identity);assertStored(state,{revision:1,document:documents[winner],audits:1});
   assert.equal(Number(state.audit[0].from_revision),0);assert.equal(state.audit[0].before_sha256,null);assert.deepEqual(state.audit[0].changed_fields,['theme']);
   const reread=await createPostgresSettingsStore({pool}).read({kind:'user',...identity});assert.equal(reread.revision,1);assert.deepEqual(reread.document,documents[winner]);
  }finally{boundary.close();}
 });

 qualify('two simultaneous updates of the same existing revision produce one additional audit',async()=>{
  const identity=taskIdentity('existing-cas'),initial=preferences({theme:'dark'}),store=createPostgresSettingsStore({pool});await store.save(saveInput(identity,0,initial));
  const documents=[preferences({theme:'dark',density:'compact'}),preferences({theme:'light'})],boundary=concurrentQueryBoundary(pool,sql=>sql.startsWith('SELECT revision,document,document_sha256 FROM meri_settings.user_preferences ')&&sql.endsWith(' FOR UPDATE'));
  try{
   const concurrent=createPostgresSettingsStore({pool:boundary.port}),outcomes=await Promise.allSettled(documents.map(document=>concurrent.save(saveInput(identity,1,document))));
   assert.equal(boundary.arrivals(),2);assert.equal(outcomes.filter(value=>value.status==='fulfilled').length,1);assert.equal(outcomes.filter(value=>value.status==='rejected'&&failure('SETTINGS_REVISION_CONFLICT')(value.reason)).length,1);
   const winner=outcomes.findIndex(value=>value.status==='fulfilled'),state=await persisted(pool,identity);assertStored(state,{revision:2,document:documents[winner],audits:2});
   assert.equal(Number(state.audit[1].from_revision),1);assert.equal(state.audit[1].before_sha256,canonicalSha256(initial));assert.deepEqual(state.audit[1].changed_fields,winner===0?['density']:['theme']);
  }finally{boundary.close();}
 });

 qualify('real audit uniqueness failure rolls the document update and audit back atomically',async()=>{
  const identity=taskIdentity('audit-rollback'),auditId=randomUUID(),store=createPostgresSettingsStore({pool});await store.save(saveInput(identity,0,preferences({theme:'dark'}),auditId));
  const before=await persisted(pool,identity);await assert.rejects(store.save(saveInput(identity,1,preferences({theme:'light'}),auditId)),failure('SETTINGS_STORE_UNAVAILABLE'));
  assert.deepEqual(await persisted(pool,identity),before);
 });

 qualify('cancellation after a real insert claim rolls back before audit and leaves the pool usable',async()=>{
  const identity=taskIdentity('cancel-insert'),controller=new AbortController(),port=clientBoundary(pool,async call=>{const result=await call.forward();if(call.sql.startsWith('INSERT INTO meri_settings.user_preferences('))controller.abort();return result;});
  await assert.rejects(createPostgresSettingsStore({pool:port}).save({...saveInput(identity,0,preferences({theme:'dark'})),signal:controller.signal}),failure('CANCELLED'));
  assert.deepEqual(await persisted(pool,identity),{preferences:[],audit:[]});assert.equal((await pool.query('SELECT 1 AS alive')).rows[0].alive,1);
 });

 qualify('reserved append-only trigger refuses audit UPDATE and preserves the stored evidence',async()=>{
  const identity=taskIdentity('audit-trigger'),store=createPostgresSettingsStore({pool});await store.save(saveInput(identity,0,preferences({theme:'dark'})));const before=await persisted(pool,identity);
  await rolledBackProbe(pool,async client=>{let state;try{await client.query('UPDATE meri_settings.settings_audit SET recorded_at=recorded_at WHERE audit_id=$1',[before.audit[0].audit_id]);}catch(error){state=error.code;}assert.equal(state,'P0001','reserved immutable-audit trigger must reject UPDATE');});
  assert.deepEqual(await persisted(pool,identity),before);
 });

 qualify('actual native user API persists complete preferences and isolates actor and tenant documents',async()=>{
  const f=api(pool),document=preferences({theme:'dark',density:'compact',timezone:'UTC'});assert.deepEqual((await f.read('A')).value,{owner:f.identities.A,revision:0,preferences:USER_PREFERENCE_DEFAULTS});
  const saved=await f.save(0,document,'A');assert.equal(saved.status,200);assert.deepEqual(saved.value,{owner:f.identities.A,revision:1,preferences:document});assert.deepEqual((await f.read('A')).value,saved.value);
  for(const credential of ['B','C'])assert.deepEqual((await f.read(credential)).value,{owner:f.identities[credential],revision:0,preferences:USER_PREFERENCE_DEFAULTS});
  assert.equal((await f.save(0,preferences({theme:'light'}),'B')).status,200);assert.deepEqual((await f.read('A')).value,saved.value);assert.equal((await f.save(0,document,'A')).status,409);
  assertStored(await persisted(pool,f.identities.A),{revision:1,document,audits:1});assert.equal((await persisted(pool,f.identities.C)).preferences.length,0);assert(f.state.memberships>=f.state.admissions*2,'membership admission and release must remain fresh');
 });

 qualify('current membership loss before persistence refuses the write and acknowledged changed membership withholds release',async()=>{
  const f=api(pool);f.state.revokeAfterAdmission=true;const refused=await f.save(0,preferences({theme:'dark'}),'A');assert.equal(refused.status,403);assert.deepEqual(refused.value,{error:{code:'MEMBERSHIP_REVOKED'}});assert.deepEqual(await persisted(pool,f.identities.A),{preferences:[],audit:[]});
  f.state.status='active';f.state.changeAfterCommit=true;const withheld=await f.save(0,preferences({theme:'light'}),'A');assert.equal(withheld.status,409);assert.deepEqual(withheld.value,{error:{code:'MEMBERSHIP_CHANGED',outcome:'RESULT_NOT_RELEASED'}});
  assertStored(await persisted(pool,f.identities.A),{revision:1,document:preferences({theme:'light'}),audits:1});assert.equal((await f.read('A')).value.revision,1);
 });

 qualify('real schema readiness opens the actual runtime preference adapter and complete save/readback',async()=>{
  const f=api(pool),configuration={sourceEnabled:false,userPreferences:{enabled:true},limits:{requestMs:3000,requestBytes:8192},native:{maxResponseBytes:16384}},ports={conversationMembership:f.gate};
  const runtime=createRuntimeUserPreferences({configuration,pool,ports});
  const body={expectedRevision:0,preferences:preferences({theme:'dark'})},call=async(route,value)=>{
   const response=await runtime.handle(new Request('https://meri.synthetic.invalid'+userPreferencesPaths[route],{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer A'},body:JSON.stringify(value)}));
   const expectation=route==='save'?{owner:f.identities.A,request:body}:{owner:f.identities.A};return {status:response.status,value:await receiveUserPreferencesResponse(route,response.status,await response.text(),expectation)};
  };
  try{
   assert.equal(runtime.state(),'pending');assert.equal((await call('read',{})).status,503);await runtime.readiness();assert.equal(runtime.state(),'composed');
   assert.equal((await call('read',{})).value.revision,0);const saved=await call('save',body);assert.equal(saved.status,200);assert.deepEqual((await call('read',{})).value,saved.value);assertStored(await persisted(pool,f.identities.A),{revision:1,document:body.preferences,audits:1});
  }finally{runtime.close();}
  assert.equal(runtime.state(),'retired');assert.equal((await call('read',{})).status,503);await assert.rejects(runtime.readiness(),failure('USER_PREFERENCES_UNAVAILABLE'));assert.equal((await pool.query('SELECT 1 AS alive')).rows[0].alive,1,'runtime must leave the borrowed pool usable');
 });

 qualify('real committed write with withheld pg acknowledgement reports UNKNOWN and supports read-only recovery',async()=>{
  const identity=taskIdentity('commit-ack'),fault=lostCommitAcknowledgement(pool),document=preferences({theme:'dark'}),service=createUserPreferencesService({store:createPostgresSettingsStore({pool:fault.port}),newId:randomUUID}),principal={...identity,clientIds:[]};
  await assert.rejects(service.saveUser({principal,body:{expectedRevision:0,preferences:document}}),error=>failure('SETTINGS_COMMIT_UNKNOWN')(error)&&productFailure(error).outcome==='UNKNOWN');
  assert.deepEqual(fault.state,{commits:1,injected:1,rollbacks:0,releasedWithError:1});assertStored(await persisted(pool,identity),{revision:1,document,audits:1});
  const recovered=await createUserPreferencesService({store:createPostgresSettingsStore({pool}),newId:randomUUID}).readUser({principal});assert.deepEqual(recovered,{revision:1,preferences:document});assert.equal((await persisted(pool,identity)).audit.length,1,'read-only recovery must not append or retry the mutation');
 });

 test('provided app role has narrow user/audit/sequence privileges and no audit destruction, tenant access or schema administration',{skip:process.env.MERI_PREFERENCES_PG_ROLE_CHECK==='1'?false:'PENDING: separate restricted app role and acknowledged restore/disposal plan not provided',timeout:25000},()=>scrubbed(async()=>{
  const identity=taskIdentity('audit-role'),store=createPostgresSettingsStore({pool});await store.save(saveInput(identity,0,preferences({theme:'dark'})));const before=await persisted(pool,identity),auditId=before.audit[0].audit_id;
  const applicationPool=await qualificationPool(configuration.applicationConnectionString);
  try{
   const {rows:[grants]}=await applicationPool.query(`SELECT
    has_table_privilege(current_user,'meri_settings.user_preferences','SELECT') AS preference_read,
    has_table_privilege(current_user,'meri_settings.user_preferences','INSERT') AS preference_insert,
    has_table_privilege(current_user,'meri_settings.user_preferences','UPDATE') AS preference_update,
    has_table_privilege(current_user,'meri_settings.user_preferences','DELETE,TRUNCATE') AS preference_destructive,
    has_table_privilege(current_user,'meri_settings.settings_audit','SELECT') AS audit_read,
    has_table_privilege(current_user,'meri_settings.settings_audit','INSERT') AS audit_insert,
    has_table_privilege(current_user,'meri_settings.settings_audit','UPDATE') AS audit_update,
    has_table_privilege(current_user,'meri_settings.settings_audit','DELETE') AS audit_delete,
    has_table_privilege(current_user,'meri_settings.settings_audit','TRUNCATE') AS audit_truncate,
    has_table_privilege(current_user,'meri_settings.settings_audit','REFERENCES,TRIGGER') AS audit_administration,
    has_table_privilege(current_user,'meri_settings.tenant_settings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS tenant_access,
    has_sequence_privilege(current_user,pg_get_serial_sequence('meri_settings.settings_audit','sequence'),'USAGE') AS audit_sequence_usage,
    has_sequence_privilege(current_user,pg_get_serial_sequence('meri_settings.settings_audit','sequence'),'SELECT,UPDATE') AS audit_sequence_administration,
    has_schema_privilege(current_user,'meri_settings','USAGE') AS schema_usage,
    has_schema_privilege(current_user,'meri_settings','CREATE') AS schema_create,
    has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
    pg_has_role(current_user,(SELECT nspowner FROM pg_namespace WHERE nspname='meri_settings'),'USAGE') AS schema_owner,
    pg_has_role(current_user,(SELECT relowner FROM pg_class WHERE oid='meri_settings.settings_audit'::regclass),'USAGE') AS audit_owner,
    rolsuper AS role_superuser,rolcreatedb AS role_createdb,rolcreaterole AS role_createrole,rolbypassrls AS role_bypassrls
    FROM pg_roles WHERE rolname=current_user`);
   assert.deepEqual(grants,{preference_read:true,preference_insert:true,preference_update:true,preference_destructive:false,audit_read:true,audit_insert:true,audit_update:false,audit_delete:false,audit_truncate:false,audit_administration:false,tenant_access:false,audit_sequence_usage:true,audit_sequence_administration:false,schema_usage:true,schema_create:false,database_create:false,schema_owner:false,audit_owner:false,role_superuser:false,role_createdb:false,role_createrole:false,role_bypassrls:false});
   const probes=[
    ['UPDATE meri_settings.settings_audit SET recorded_at=recorded_at WHERE audit_id=$1',[auditId]],
    ['DELETE FROM meri_settings.settings_audit WHERE audit_id=$1',[auditId]],
    ['TRUNCATE TABLE meri_settings.settings_audit',[]],
    ['SELECT * FROM meri_settings.tenant_settings LIMIT 1',[]],
   ];
   for(const [sql,parameters]of probes){
    await rolledBackProbe(applicationPool,async client=>{let denied=false;try{await client.query(sql,parameters);}catch(error){denied=error.code==='42501';}assert.equal(denied,true,'restricted role must receive PostgreSQL insufficient_privilege for audit destruction or tenant access');});
   }
   const appIdentity=taskIdentity('app-role-write'),service=createUserPreferencesService({store:createPostgresSettingsStore({pool:applicationPool}),newId:randomUUID});await service.saveUser({principal:{...appIdentity,clientIds:[]},body:{expectedRevision:0,preferences:preferences({theme:'light'})}});assertStored(await persisted(pool,appIdentity),{revision:1,document:preferences({theme:'light'}),audits:1});
   assert.deepEqual(await persisted(pool,identity),before);
  }finally{await applicationPool.end();}
 }));
});
