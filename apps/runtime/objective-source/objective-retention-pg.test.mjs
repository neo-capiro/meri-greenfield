/** Exact disposable PG16 boundary assay for forward54. No owner delta imports.
 * These synthetic SQL rows exercise grants/triggers only; application inventory,
 * current authority and serving exclusion have separate integration coverage. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as id} from 'node:crypto';
import pg from '../node_modules/pg/lib/index.js';
import {runStartFixture} from './test/run-start-fixture.mjs';
import {objectiveRunStartColumns} from './run-starts.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

const SOCKET='/tmp/meri-expired-trash-pg-20261024/socket',DATABASE='meri_expired_trash_fixture';
const supplied=process.env.MERI_EXPIRED_TRASH_PG_SOCKET!==undefined||process.env.MERI_EXPIRED_TRASH_PG_DATABASE!==undefined;
if(supplied&&(process.platform!=='linux'||process.env.MERI_EXPIRED_TRASH_PG_SOCKET!==SOCKET||process.env.MERI_EXPIRED_TRASH_PG_DATABASE!==DATABASE))throw Error('OBJECTIVE_RETENTION_PG_TARGET_REFUSED');
const enabled=supplied&&process.platform==='linux',day=86400000;
const insert=(c,table,row)=>{const keys=Object.keys(row);return c.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));};
const marker=b=>({retentionTombstone:true,conversationId:b.conversationId});
const fresh=()=>runStartFixture({tenantId:id(),actorId:id(),generationJobId:id(),requestId:id(),clientId:id()});
async function denied(c,work,pattern){await c.query('SAVEPOINT negative');await assert.rejects(work,pattern);await c.query('ROLLBACK TO SAVEPOINT negative');}
async function seed(c,change){
 const f=fresh(),b=f.binding,now=Date.now(),trash={requestId:id(),revision:'2',trashedAtMs:now-31*day,restoreUntilMs:now-day};
 const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes:[{tenantId:b.tenantId,kind:'client',resourceId:f.clientId,policyRevision:'policy1'}],policyRevision:'policy1',createdAt:new Date(now).toISOString()};
 await insert(c,'meri_conversations.conversations',{tenant_id:b.tenantId,conversation_id:b.conversationId,owner_actor_id:b.actorId,projection:conversation,projection_sha256:hash(conversation)});
 const columns=objectiveRunStartColumns(f.record,{tenantId:b.tenantId});await insert(c,'meri_objective_source.run_starts',columns);
 const planSha256='a'.repeat(64),entrySha256='b'.repeat(64),target={table:'meri_objective_source.run_starts',mode:'objective',key:{generation_job_id:f.generationJobId},rowSha256:hash(columns)};
 const projection={state:'SUPPRESSED',ownerActorId:b.actorId,ledgerSequence:1,entrySha256,reason:'conversation-trash:'+trash.requestId,purge:{state:'PLANNED',planSha256,ledgerSequence:1,trash}};
 if(change==='unexpired'){trash.trashedAtMs=now-day;trash.restoreUntilMs=now+29*day;}
 if(change==='wrong-owner')projection.ownerActorId=id();
 if(change==='wrong-key')target.key.generation_job_id=id();
 if(change==='wrong-mode')target.mode='run';
 if(change==='wrong-trash')projection.reason='conversation-trash:'+id();
 if(change==='wrong-plan')projection.purge.planSha256='c'.repeat(64);
 if(change==='released')projection.state='RELEASED';
 await insert(c,'meri_conversations.retention_subjects',{tenant_id:b.tenantId,conversation_id:b.conversationId,owner_actor_id:b.actorId,state:projection.state,suppressed_at:projection.state==='SUPPRESSED'?new Date(now-day):null,released_at:null,ledger_sequence:1,entry_sha256:entrySha256,projection,projection_sha256:hash(projection)});
 if(change!=='missing-target')await insert(c,'meri_conversations.retention_purge_targets',{workflow_id:hash(id()),tenant_id:b.tenantId,conversation_id:b.conversationId,class:'conversation',plan_sha256:planSha256,state:'PLANNED',ledger_sequence:1,target});
 return {...f,columns};
}
const erase=(c,f)=>c.query('UPDATE meri_objective_source.run_starts SET record=$2 WHERE generation_job_id=$1',[f.generationJobId,marker(f.binding)]);
const read=(c,f)=>c.query('SELECT * FROM meri_objective_source.run_starts WHERE generation_job_id=$1',[f.generationJobId]).then(r=>r.rows[0]);

test('forward54 ordinary-role Objective SQL boundaries',{skip:!enabled&&'requires exact disposable Unix PG16 fixture',timeout:30000},async t=>{
 const pool=new pg.Pool({host:SOCKET,database:DATABASE,user:'meri_control_runtime',max:2,connectionTimeoutMillis:2000,query_timeout:5000,options:'-c statement_timeout=4000 -c lock_timeout=1000'});t.after(()=>pool.end());
 await t.test('target and record-only grants are exact',async()=>{
  const r=(await pool.query("SELECT current_user,current_database() database,current_setting('listen_addresses') listen,current_setting('server_version_num')::int version,inet_server_addr() address")).rows[0];
  assert.equal(r.current_user,'meri_control_runtime');assert.equal(r.database,DATABASE);assert.equal(r.listen,'');assert.equal(r.address,null);assert.ok(r.version>=160000&&r.version<170000);
  const role=(await pool.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user')).rows[0];assert.ok(Object.values(role).every(v=>v===false));
  const grants=(await pool.query("SELECT has_column_privilege(current_user,'meri_objective_source.run_starts','record','UPDATE') body,has_column_privilege(current_user,'meri_objective_source.run_starts','binding','UPDATE') binding,has_table_privilege(current_user,'meri_objective_source.run_starts','DELETE') deletion,has_table_privilege(current_user,'meri_objective_source.run_starts','TRUNCATE') truncate")).rows[0];
  assert.deepEqual(grants,{body:true,binding:false,deletion:false,truncate:false});
 });
 await t.test('distinct Clerk and internal actor insertion works; direct tombstone and wrong actor are refused',async()=>{
  const c=await pool.connect();try{await c.query('BEGIN');const f=await seed(c);assert.notEqual(f.actorId,f.record.selection.sourceAdmission.clerkUserId);assert.deepEqual((await read(c,f)).record,f.record);
   for(const kind of ['tombstone','actor']){const g=fresh(),columns=structuredClone(objectiveRunStartColumns(g.record,{tenantId:g.tenantId}));
    if(kind==='tombstone')columns.record=marker(g.binding);else columns.record.selection.sourceAdmission.actorUserId=id();
    await denied(c,()=>insert(c,'meri_objective_source.run_starts',columns),kind==='tombstone'?/OBJECTIVE_RUN_START_IMMUTABLE/:/check constraint/);
   }
  }finally{await c.query('ROLLBACK');c.release();}
 });
 for(const change of ['missing-target','wrong-key','wrong-mode','wrong-owner','wrong-trash','wrong-plan','released','unexpired'])await t.test('erasure refuses '+change,async()=>{
  const c=await pool.connect();try{await c.query('BEGIN');const f=await seed(c,change);await denied(c,()=>erase(c,f),/OBJECTIVE_RUN_START_IMMUTABLE/);assert.deepEqual((await read(c,f)).record,f.record);
  }finally{await c.query('ROLLBACK');c.release();}
 });
 await t.test('a target committed by an earlier transaction cannot erase',async()=>{
  const c=await pool.connect();try{await c.query('BEGIN');const f=await seed(c);await c.query('COMMIT');await c.query('BEGIN');await denied(c,()=>erase(c,f),/OBJECTIVE_RUN_START_IMMUTABLE/);assert.deepEqual((await read(c,f)).record,f.record);
  }finally{await c.query('ROLLBACK');c.release();}
 });
 await t.test('exact same-transaction expired target commits only the terminal body and cannot rehydrate',async()=>{
  const c=await pool.connect();let f,before;try{await c.query('BEGIN');f=await seed(c);before=await read(c,f);assert.equal((await erase(c,f)).rowCount,1);await c.query('COMMIT');
   const after=await read(pool,f);assert.deepEqual(after.record,marker(f.binding));assert.deepEqual({...after,record:before.record},before);
   await c.query('BEGIN');await denied(c,()=>c.query('UPDATE meri_objective_source.run_starts SET record=$2 WHERE generation_job_id=$1',[f.generationJobId,f.record]),/OBJECTIVE_RUN_START_IMMUTABLE/);
   await denied(c,()=>c.query('DELETE FROM meri_objective_source.run_starts WHERE generation_job_id=$1',[f.generationJobId]),/permission denied/);
   await denied(c,()=>c.query('UPDATE meri_objective_source.run_starts SET binding=$2 WHERE generation_job_id=$1',[f.generationJobId,f.binding]),/permission denied/);
  }finally{await c.query('ROLLBACK');c.release();}
 });
});
