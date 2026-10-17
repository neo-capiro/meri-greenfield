/** Real-pg qualification ingress and test-owned port faults. No setup, DDL, role/grant mutation or implicit connection. */
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
export const QUALIFICATION_DATABASE='meri_prefs_task6_qual_20261017';
export const QUALIFICATION_PORT=55436;
let driverLoaded=false;
export const qualificationDriverLoaded=()=>driverLoaded;
const configurationError=()=>{const error=Error('PG qualification requires the explicitly allocated direct loopback task-6 database; no connection attempted');error.name='QualificationConfigurationError';throw error;};
export function qualificationConfiguration(environment){
 if(environment.MERI_PREFERENCES_PG_QUALIFY!=='1')return null;
 const target=raw=>{let url;try{url=new URL(raw);}catch{configurationError();}
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||url.port!==String(QUALIFICATION_PORT)||url.pathname!=='/'+QUALIFICATION_DATABASE||url.search||url.hash||!url.username)configurationError();return raw;};
 const connectionString=target(environment.MERI_PREFERENCES_PG_URL),roles=environment.MERI_PREFERENCES_PG_ROLE_CHECK==='1';
 if(roles&&environment.MERI_PREFERENCES_PG_RESTORE_PLAN!=='dispose-task6-owned-database')configurationError();
 const applicationConnectionString=roles?target(environment.MERI_PREFERENCES_PG_APP_URL):null;
 if(roles&&new URL(applicationConnectionString).username===new URL(connectionString).username)configurationError();
 return Object.freeze({connectionString,applicationConnectionString});
}
/** Suppress driver diagnostics, which may contain connection identity or statement details. Synthetic assertion data remains visible. */
export async function scrubbed(operation){try{return await operation();}catch(error){if(['AssertionError','ProductError','QualificationConfigurationError'].includes(error?.name))throw error;const state=typeof error?.code==='string'&&/^[A-Z0-9]{5}$/u.test(error.code)?error.code:'unavailable';throw Error('PostgreSQL qualification failed ('+state+'); private driver detail withheld');}}
export async function qualificationPool(connectionString){
 qualificationConfiguration({MERI_PREFERENCES_PG_QUALIFY:'1',MERI_PREFERENCES_PG_URL:connectionString});
 // Runtime owns pg8.23.1. Resolve its already-installed dependency only after the task target guard; never install or use ambient root pg.
 const {Pool}=createRequire(new URL('../../../../runtime/package.json',import.meta.url))('pg');driverLoaded=true;
 const pool=new Pool({connectionString,max:6,connectionTimeoutMillis:2000,idleTimeoutMillis:1000,maxLifetimeSeconds:30,statement_timeout:5000,lock_timeout:2000,idle_in_transaction_session_timeout:5000,query_timeout:7000,application_name:'meri-prefs-task6-qualification'});
 pool.on('error',()=>{});
 try{
  const {rows:[identity]}=await pool.query('SELECT current_database() AS database, host(inet_server_addr()) AS address, inet_server_port() AS port, current_user AS role');
  if(identity.database!==QUALIFICATION_DATABASE||identity.address!=='127.0.0.1'||identity.port!==QUALIFICATION_PORT)throw Error('PG qualification server identity mismatch; no writes permitted');
  const {rows:[tables]}=await pool.query("SELECT to_regclass('meri_settings.user_preferences')::text AS preferences, to_regclass('meri_settings.settings_audit')::text AS audit");
  if(tables.preferences!=='meri_settings.user_preferences'||tables.audit!=='meri_settings.settings_audit')throw Error('PG qualification requires the separately provisioned reserved settings schema');
  return pool;
 }catch(error){await pool.end();throw error;}
}
export const taskIdentity=label=>({tenantId:'qual-task6-'+label+'-'+randomUUID(),actorId:'qual-actor-'+randomUUID()});
/** Production SQL and returned rows remain real. The test only coordinates query entry or acknowledgement delivery. */
export function clientBoundary(pool,intercept){return Object.freeze({async connect(){
 const client=await pool.connect();return {query:(sql,parameters)=>intercept({sql,parameters,forward:()=>client.query(sql,parameters)}),release:error=>client.release(error)};
}});}
export function concurrentQueryBoundary(pool,predicate){
 let arrivals=0,resolve,reject,timer;const ready=new Promise((yes,no)=>{resolve=yes;reject=no;});
 timer=setTimeout(()=>reject(Error('Two real PostgreSQL operations did not reach the coordinated boundary')),5000);
 const port=clientBoundary(pool,async call=>{if(predicate(call.sql)){if(++arrivals===2){clearTimeout(timer);resolve();}await ready;}return call.forward();});
 return {port,arrivals:()=>arrivals,close(){clearTimeout(timer);resolve();}};
}
export function lostCommitAcknowledgement(pool){
 const state={commits:0,injected:0,rollbacks:0,releasedWithError:0};
 const port={async connect(){const client=await pool.connect();return {async query(sql,parameters){
  const result=await client.query(sql,parameters);if(sql==='ROLLBACK')state.rollbacks++;
  if(sql==='COMMIT'){state.commits++;if(state.injected===0){state.injected++;throw Error('Test-owned acknowledgement withheld after a real committed transaction');}}return result;
 },release(error){if(error)state.releasedWithError++;client.release(error);}};}};
 return {port,state};
}
export async function persisted(pool,identity){
 const preferences=await pool.query('SELECT revision,document,document_sha256 FROM meri_settings.user_preferences WHERE tenant_id=$1 AND actor_id=$2',[identity.tenantId,identity.actorId]);
 const audit=await pool.query("SELECT audit_id,from_revision,to_revision,before_sha256,after_sha256,changed_fields,recorded_at FROM meri_settings.settings_audit WHERE tenant_id=$1 AND subject_actor_id=$2 AND target='user' ORDER BY sequence",[identity.tenantId,identity.actorId]);
 return {preferences:preferences.rows,audit:audit.rows};
}
/** A privilege/trigger probe always rolls back; even a failed rollback releases and evicts its owned client. */
export async function rolledBackProbe(pool,operation){
 const client=await pool.connect();let reusable=false;
 try{await client.query('BEGIN');return await operation(client);}
 finally{try{await client.query('ROLLBACK');reusable=true;}finally{client.release(reusable?undefined:new Error('Qualification probe rollback failed'));}}
}
