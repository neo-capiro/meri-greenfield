/** Opt-in SQL proof only in the marked disposable M7 PG16 cluster; never an inherited DB URL. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {randomBytes} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {createUsageOverviewStore} from '../store.mjs';import {assertUsageOverviewResponseV2} from '../../../../../packages/contracts/conversation-usage/overview-validate.mjs';
import {row,principal} from '../../runs/test/fixture.mjs';import {hash} from '../../boundary.mjs';
const config=process.env.MERI_USAGE_OVERVIEW_PG_CONFIG,require=createRequire(new URL('../../../../runtime/package.json',import.meta.url));
test('owned PG16: actual usage SQL cohorts, tenant isolation and consistent read-only snapshot',{skip:!config},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);const c=JSON.parse(await readFile(config,'utf8'));
 assert.equal(c.marker,'wave5-m7-management-protocol-20261027');assert.equal(c.host,'127.0.0.1');assert.match(c.name,/^w5-m7-management-20261027-[a-f0-9]{8}$/);
 const actual=JSON.parse(execFileSync('wsl.exe',['-d','Codex-Gates','--exec','docker','inspect',c.name],{encoding:'utf8',windowsHide:true}))[0];
 assert.equal(actual.Id,c.containerId);assert.equal(actual.Config.Labels['codex.owner'],c.marker);assert.equal(actual.State.Running,true);
 const {Client}=require('pg'),connection={host:c.host,port:c.port,user:'postgres',password:c.password,connectionTimeoutMillis:5000,query_timeout:10000};
 const database='m7_usage_'+randomBytes(6).toString('hex'),marker='wave5-m7-usage-read-proof',admin=new Client({...connection,database:'postgres'});
 assert.match(database,/^m7_usage_[a-f0-9]{12}$/);await admin.connect();let made=false,db,reader;
 try{
  await admin.query(`CREATE DATABASE ${database}`);made=true;await admin.query(`COMMENT ON DATABASE ${database} IS '${marker}'`);
  db=new Client({...connection,database});await db.connect();const server=(await db.query("SELECT version(),current_setting('server_version_num')::integer AS number,current_setting('fsync') AS fsync")).rows[0];
  assert(server.number>=160000&&server.number<170000);assert.equal(server.fsync,'on');t.diagnostic(`${server.version}; Node${process.version}; pg${require('pg/package.json').version}; isolated new marked database`);
  await db.query('CREATE SCHEMA meri_product_budget');
  for(const path of ['../../../../gateway/budget/migrations/0002_tenant_budgets.sql','../../../settings/migrations/0001_settings.sql','../../migrations/0001_conversations.sql','../../migrations/0021_sdk_run_usage.sql'])await db.query(await readFile(new URL(path,import.meta.url),'utf8'));
  await db.query('GRANT USAGE ON SCHEMA meri_conversations,meri_settings TO meri_control_runtime');await db.query('GRANT SELECT ON ALL TABLES IN SCHEMA meri_conversations,meri_settings TO meri_control_runtime');
  const observedAt='2026-10-27T12:00:00.000Z';
  async function seed(n,options={},recordedAt=observedAt,tenant=principal.tenantId){const raw=row(n,options),a=raw.conversation_row,r=raw.run_row;
   a.tenant_id=tenant;r.tenant_id=tenant;a.projection.owner.tenantId=tenant;r.projection.binding.tenantId=tenant;a.projection_sha256=hash(a.projection);r.projection_sha256=hash(r.projection);
   await db.query('INSERT INTO meri_conversations.conversations VALUES($1,$2,$3,$4,$5)',[a.tenant_id,a.conversation_id,a.owner_actor_id,a.projection,a.projection_sha256]);
   await db.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sdk_usage,sdk_usage_sha256,sdk_charge_micro_usd,sdk_usage_recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[r.tenant_id,r.conversation_id,r.run_id,r.projection,r.projection_sha256,r.request_id,r.request,r.request_sha256,r.last_sequence,r.sdk_usage,r.sdk_usage_sha256,r.sdk_usage?.chargeMicroUsd??null,r.sdk_usage===null?null:recordedAt]);
   return r.sdk_usage?.chargeMicroUsd??0;
  }
  const cost=await seed(1,{at:'2026-10-27T10:00:00.000Z'});
  await seed(2,{state:'failed',usage:'unavailable',at:'2026-10-26T10:00:00.000Z'});
  await seed(3,{state:'cancelled',usage:'absent',at:'2026-10-20T10:00:00.000Z'});
  await seed(4,{at:'2026-09-30T10:00:00.000Z'});
  await seed(5,{state:'running',usage:'zero',at:'2026-10-27T11:00:00.000Z'});
  await seed(6,{state:'queued',usage:'absent',at:'2026-10-25T11:00:00.000Z'});
  await seed(7,{at:'2026-10-27T11:00:00.000Z'},observedAt,'synthetic-other-tenant');
  await db.query('INSERT INTO meri_settings.tenant_settings(tenant_id,revision,document,document_sha256,updated_at,updated_by,monthly_cap_micro_usd,sdk_max_turns,sdk_max_budget_micro_usd) VALUES($1,1,$2,$3,$4,\'synthetic-admin\',$5,20,2000000)',[principal.tenantId,{defaultTimezone:'UTC',capabilityPolicy:{}},hash({defaultTimezone:'UTC',capabilityPolicy:{}}),observedAt,cost*3]);
  reader=new Client({...connection,database});await reader.connect();await reader.query('SET ROLE meri_control_runtime');
  let afterQuery;const pool={async connect(){return {async query(sql,args){const result=await reader.query(sql,args);if(afterQuery)await afterQuery(sql,result);return result;},release(){}};}};
  const read=async(p=principal)=>assertUsageOverviewResponseV2(await createUsageOverviewStore({pool,now:()=>Date.parse(observedAt)}).read({principal:p},()=>{}));
  await t.test('day/week/month attempts and missing/failed/cancelled denominators are actual SQL observations',async()=>{
   const value=await read();assert.deepEqual(value.periods.map(p=>p.attempts),[2,3,5]);assert.deepEqual(value.periods[2].recording,{recorded:2,unavailable:1,notRecorded:2});
   assert.equal(value.periods[2].states.cancelled,1);assert.equal(value.periods[2].states.failed,1);assert.equal(value.periods[2].knownChargeMicroUsd,cost);
   assert.equal(value.monthlyAdmission.knownChargeMicroUsd,cost*2);assert.equal(value.monthlyAdmission.remainingKnownMicroUsd,cost);assert.equal(value.monthlyAdmission.unavailableRecordedAttempts,1);
   assert.equal(value.queue.states.queued,1);assert.equal(value.queue.states.running,1);assert.equal(value.queue.physicalConcurrency,null);
  });
  await t.test('fresh readers isolate current tenant and accept an empty current tenant without fabricated policy',async()=>{
   const other=await read({...principal,tenantId:'synthetic-other-tenant'});assert.deepEqual(other.periods.map(p=>p.attempts),[1,1,1]);assert.equal(other.policy.status,'unavailable');
   const empty=await read({...principal,tenantId:'synthetic-empty'});assert.equal(empty.periods[2].attempts,0);assert.equal(empty.monthlyAdmission.reached,null);
  });
  await t.test('aggregate and model policy share one repeatable-read snapshot across a concurrent setting change',async()=>{
   let changed=false;afterQuery=async sql=>{if(sql.startsWith('WITH')&&!changed){changed=true;await db.query('UPDATE meri_settings.tenant_settings SET monthly_cap_micro_usd=$2,revision=2 WHERE tenant_id=$1',[principal.tenantId,cost]);}};
   const before=await read();afterQuery=null;assert.equal(changed,true);assert.equal(before.policy.revision,1);assert.equal(before.monthlyAdmission.reached,false);
   const next=await read();assert.equal(next.policy.revision,2);assert.equal(next.monthlyAdmission.reached,true);
  });
  await t.test('the real production store transaction is read only and refuses a write before any result release',async()=>{
   let checked=false;afterQuery=async sql=>{if(sql.startsWith('WITH')&&!checked){checked=true;const settings=(await reader.query("SELECT current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];assert.equal(settings.ro,'on');assert.equal(settings.isolation,'repeatable read');await assert.rejects(reader.query('DELETE FROM meri_conversations.runs'),e=>e.code==='25006'||e.code==='42501');throw Error('synthetic write guard witness');}};
   await assert.rejects(read(),/USAGE_OVERVIEW_UNAVAILABLE/);afterQuery=null;assert.equal(checked,true);assert.equal((await read()).periods[2].attempts,5);
  });
 }finally{
  if(reader)await reader.end();if(db)await db.end();if(made){const marked=await admin.query('SELECT shobj_description(oid,\'pg_database\') AS marker FROM pg_database WHERE datname=$1',[database]);assert.equal(marked.rows[0]?.marker,marker);await admin.query(`DROP DATABASE ${database}`);t.diagnostic('Dropped only the newly created marked usage-proof database; previous management databases retained.');}await admin.end();
 }
});
