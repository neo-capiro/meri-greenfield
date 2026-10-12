// Source-only review: original modules evaluated with in-memory native imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { parseNativeAdmission } from '/workspace/scratch/meri-native-invocation-20261012/apps/gateway/test/postgres-budget-native-fixture.mjs';

const base='/workspace/scratch/meri-native-invocation-20261012/apps/gateway/test/';
const fixtureSource=await readFile(base+'postgres-invocation-fixture.mjs','utf8');
const entrySource=await readFile(base+'postgres-invocation.integration.mjs','utf8');
const migration=await readFile('/workspace/scratch/meri-native-invocation-20261012/apps/proxy/qualification/state/migrations/0003_tool_invocations.sql');
const hash=value=>createHash('sha256').update(value).digest('hex');

async function synthetic(context,exports) {
  const module=new vm.SyntheticModule(Object.keys(exports),function(){for(const [name,value] of Object.entries(exports))this.setExport(name,value);},{context});
  await module.link(()=>{throw Error('UNEXPECTED_SYNTHETIC_IMPORT');});await module.evaluate();return module;
}
async function loadFixture(options={}) {
  let now=1800000000000;const state={opened:0,verified:0,closed:[],released:0,actionCalls:[],queries:[]};
  class Clock extends Date { static now(){return now;} }
  const admission={workDeadlineMs:now+720000};
  const active=()=>{if(now>=admission.workDeadlineMs)throw Error('ADMISSION_EXPIRED');};
  const openNativePool=async()=>{
    const index=state.opened++;
    if(options.openFailsAt===index)throw Error('OPEN_FAILURE');
    return {pool:{index,query:async sql=>{assert.equal(sql,'SELECT pg_backend_pid() AS pid');return {rows:[{pid:100+index}]};}},
      async close(){await new Promise(r=>setTimeout(r,index===2?15:1));state.closed.push(index);if(options.closeFailsAt===index)throw Error('CLOSE_FAILURE');}};
  };
  const verifyDatabase=async pool=>{state.verified++;if(options.verifyFailsAt===pool.index)throw Error('VERIFY_FAILURE');};
  const blocker={async query(sql){state.queries.push(sql);if(sql==='COMMIT'&&options.commitFails)throw Error('COMMIT_FAILURE');if(sql==='ROLLBACK'&&options.rollbackFails)throw Error('ROLLBACK_FAILURE');return {rows:[]};},
    release(){state.released++;if(options.releaseFails)throw Error('RELEASE_FAILURE');}};
  const pool={connect:async()=>blocker,query:async(sql,args)=>{
    assert.match(sql,/pg_stat_activity/);assert.deepEqual([...args[0]],[100,101,102]);
    if(options.observationFails)throw Error('OBSERVATION_FAILURE');
    if(options.lateWaiters)now+=1201;
    return {rows:[{n:3}]};
  }};
  const context=vm.createContext({Date:Clock,setTimeout,clearTimeout});
  const module=new vm.SourceTextModule(fixtureSource,{context,importModuleDynamically(){throw Error('APPLICATION_IMPORT_FORBIDDEN_IN_REVIEW');}});
  await module.link(async specifier=>{
    if(specifier==='node:assert/strict')return synthetic(context,{default:assert});
    if(specifier==='node:crypto')return synthetic(context,{randomUUID});
    if(specifier==='./postgres-budget-native-fixture.mjs')return synthetic(context,{syntheticCase(){throw Error('SYNTHETIC_ROW_CREATION_FORBIDDEN');},openNativePool,verifyDatabase,active});
    throw Error('UNEXPECTED_IMPORT');
  });await module.evaluate();
  return {fixture:module.namespace,state,pool,admission,action:pool=>{state.actionCalls.push(pool.index);if(options.actionFailsAt===pool.index)throw Error('ACTION_FAILURE');return Promise.resolve(pool.index);}};
}

test('normal three-owner completion records distinct PIDs and closes all owned pools',async()=>{
  const f=await loadFixture(),r=await f.fixture.concurrentOwners(f.pool,f.admission,{},f.action);
  assert.equal(r.observedLockWaiters,3);assert.deepEqual([...r.pids],[100,101,102]);
  assert.ok(r.results.every(x=>x.status==='fulfilled'));assert.deepEqual(f.state.closed.sort(),[0,1,2]);assert.equal(f.state.released,1);
});
for(const [name,options,error,closed] of [
  ['initialization',{openFailsAt:2},'OPEN_FAILURE',[0,1]],
  ['verification',{verifyFailsAt:2},'VERIFY_FAILURE',[0,1,2]],
  ['observation',{observationFails:true},'OBSERVATION_FAILURE',[0,1,2]],
  ['rollback',{observationFails:true,rollbackFails:true},'INVOCATION_POOL_CLEANUP_FAILED',[0,1,2]],
  ['blocker release',{releaseFails:true},'INVOCATION_POOL_CLEANUP_FAILED',[0,1,2]],
  ['owner close',{closeFailsAt:0},'INVOCATION_POOL_CLEANUP_FAILED',[0,1,2]],
  ['commit',{commitFails:true},'COMMIT_FAILURE',[0,1,2]],
])test(`${name} failure still waits for every owned close attempt`,async()=>{
  const f=await loadFixture(options);
  await assert.rejects(f.fixture.concurrentOwners(f.pool,f.admission,{},f.action),e=>e.message===error);
  assert.deepEqual(f.state.closed.sort(),closed);
});
test('synchronous action rejection is registered before execution and other owners still settle',async()=>{
  const f=await loadFixture({actionFailsAt:1}),r=await f.fixture.concurrentOwners(f.pool,f.admission,{},f.action);
  assert.equal(r.results.filter(x=>x.status==='rejected').length,1);assert.deepEqual(f.state.actionCalls.sort(),[0,1,2]);
  assert.deepEqual(f.state.closed.sort(),[0,1,2]);
});
test('late three-waiter stats response cannot pass the original observation cutoff',async()=>{
  const f=await loadFixture({lateWaiters:true});
  await assert.rejects(f.fixture.concurrentOwners(f.pool,f.admission,{},f.action),e=>e.message==='NATIVE_LOCK_OBSERVATION_DEADLINE');
  assert.ok(!f.state.queries.includes('COMMIT'));
  assert.deepEqual(f.state.closed.sort(),[0,1,2]);
});
for(const [phase,statement] of [
  ['prepare','INSERT INTO meri_qualification.tool_invocations(...)'],
  ['claim','UPDATE meri_qualification.tool_invocations SET reservation_id=$2'],
  ['marker','UPDATE meri_qualification.tool_invocations SET completion=$2'],
  ['settle','UPDATE meri_qualification.budget SET consumed_micro_usd=consumed_micro_usd+$1'],
])test(`${phase} acknowledgement fault forwards identical arguments and only follows real COMMIT resolution`,async()=>{
  const {fixture}=await loadFixture();let resolveCommit;
  const calls=[],release=[];const client={processID:42,query:async(...args)=>{calls.push(args);if(args[0]==='COMMIT'&&calls.filter(x=>x[0]==='COMMIT').length===1)return new Promise(r=>{resolveCommit=r;});return {rows:[{ok:true}]};},release:e=>release.push(e)};
  const fault=fixture.loseAcknowledgement({connect:async()=>client},phase),c=await fault.pool.connect(),args=[statement,[1,{synthetic:true}]];
  assert.deepEqual(await c.query(...args),{rows:[{ok:true}]});assert.deepEqual(calls[0],args);
  const result=c.query('COMMIT');await Promise.resolve();assert.equal(fault.fired(),false);
  resolveCommit({rows:[]});await assert.rejects(result,e=>e.message==='SYNTHETIC_POST_COMMIT_ACK_LOSS');
  assert.equal(fault.fired(),true);await c.query('COMMIT');assert.equal(fault.events.filter(x=>x.phase===phase).length,1);
  const error=Error('SYNTHETIC_EVICTION');c.release(error);assert.equal(release[0],error);
});
test('unrelated phase and driver COMMIT rejection cannot be relabeled as the target acknowledgement loss',async()=>{
  const {fixture}=await loadFixture(),driver=Error('DRIVER_FAILURE');
  const client={processID:42,query:async sql=>{if(sql==='COMMIT')throw driver;return {rows:[]};},release(){}};
  const fault=fixture.loseAcknowledgement({connect:async()=>client},'marker'),c=await fault.pool.connect();
  await c.query('INSERT INTO meri_qualification.tool_invocations');await assert.rejects(c.query('COMMIT'),e=>e===driver);
  assert.equal(fault.fired(),false);assert.equal(fault.events.length,0);
});
test('historical comparison removes only volatile observedAtMs and retains every accounting outcome',async()=>{
  const {fixture}=await loadFixture();const a={stage:'UNKNOWN',invocationId:'same',resultDelivered:false,accounting:{observedAtMs:1,holdMicrousd:'10',chargedMicrousd:null,outputBytes:null,state:'UNKNOWN'}};
  const b={...a,accounting:{...a.accounting,observedAtMs:2}};
  assert.equal(JSON.stringify(fixture.historicalResult(a)),JSON.stringify(fixture.historicalResult(b)));
  for(const [key,value] of [['holdMicrousd','11'],['chargedMicrousd','10'],['outputBytes',1],['state','SETTLED']]){
    const changed={...b,accounting:{...b.accounting,[key]:value}};
    assert.notEqual(JSON.stringify(fixture.historicalResult(a)),JSON.stringify(fixture.historicalResult(changed)));
  }
  assert.equal(a.accounting.observedAtMs,1);assert.throws(()=>fixture.historicalResult({...a,accounting:{...a.accounting,observedAtMs:null}}));
});

async function loadEntry({migrationBinding,missingMode=false,missingTable=false,dirtyTable=false,dirtyBudget=false}={}) {
  const now=Date.now(),config={host:'127.0.0.1',port:55432,database:'meri_qualification_test',user:'qualification_owner',password:null,
    systemIdentifier:'123456789',serverStartTime:'2026-10-12T00:00:00Z',serverVersion:'160015',t0Ms:now-1000,workDeadlineMs:now-1000+720000,cleanupDeadlineMs:now-1000+900000,
    stateLockSha256:'a'.repeat(64),migrationSha256:'b'.repeat(64),preparedContainer:{id:'c'.repeat(64),image:'sha256:'+'d'.repeat(64),serverHost:'172.17.0.2',serverPort:5432}};
  const raw=JSON.stringify(config),env={MERI_BUDGET_PG_TEST_RUN:'explicit-isolated-engine',MERI_BUDGET_PG_TEST_CONFIG:raw,MERI_BUDGET_PG_TEST_CONFIG_SHA256:hash(raw)};
  if(missingMode)delete env.MERI_BUDGET_PG_TEST_RUN;if(migrationBinding!==undefined)env.MERI_INVOCATION_PG_MIGRATION_SHA256=migrationBinding;
  const state={applicationImports:0,opened:0,closed:0,cases:[],queries:[],before:null,after:null};
  const sourceTest=(name,fn)=>state.cases.push({name,fn});sourceTest.before=fn=>state.before=fn;sourceTest.after=fn=>state.after=fn;
  const pool={query:async sql=>{state.queries.push(sql);if(sql.includes('to_regclass'))return {rows:[{name:missingTable?null:'meri_qualification.tool_invocations'}]};return {rows:[{n:dirtyTable?1:0}]};}};
  const context=vm.createContext({process:{env},URL});
  const modules={
    'node:test':{default:sourceTest},'node:assert/strict':{default:assert},'node:fs/promises':{readFile:async()=>migration},
    './postgres-budget-native-fixture.mjs':{parseNativeAdmission:e=>parseNativeAdmission(JSON.parse(JSON.stringify(e)),now),sha256:hash,
      openNativePool:async()=>{state.opened++;return {pool,close:async()=>{state.closed++;}};},verifyDatabase:async(p,c,options)=>{assert.equal(options.empty,true);if(dirtyBudget)throw Error('DIRTY_BUDGET');}},
  };
  const dynamic={
    './postgres-invocation-fixture.mjs':Object.fromEntries(['invocationCase','loseAcknowledgement','invocationRows','conservedAccounting','historicalResult','concurrentOwners'].map(x=>[x,()=>{throw Error('NATIVE_CASE_EXECUTION_FORBIDDEN');}])),
    '../../../packages/contracts/validate.mjs':{canonicalSha256:hash},'../../control/tool-invocations.mjs':{bindToolInvocationControl(){}},'../budget/postgres-tool-budget.mjs':{createPostgresToolBudget(){}},
  };
  const module=new vm.SourceTextModule(entrySource,{context,identifier:new URL(base+'postgres-invocation.integration.mjs','file://').href,
    initializeImportMeta:meta=>meta.url='file://'+base+'postgres-invocation.integration.mjs',
    importModuleDynamically:async specifier=>{state.applicationImports++;assert.ok(Object.hasOwn(dynamic,specifier));return synthetic(context,dynamic[specifier]);}});
  await module.link(specifier=>{assert.ok(Object.hasOwn(modules,specifier));return synthetic(context,modules[specifier]);});
  try{await module.evaluate();}catch(error){return {state,error};}return {state,module};
}
test('missing native mode refuses before any application or native resource stub',async()=>{
  const r=await loadEntry({missingMode:true,migrationBinding:hash(migration)});assert.equal(r.error.message,'BUDGET_NATIVE_TEST_ADMISSION_REQUIRED');
  assert.equal(r.state.applicationImports,0);assert.equal(r.state.opened,0);
});
for(const value of [undefined,'not-a-hash','f'.repeat(64)])test(`migration binding ${String(value)} refuses before application/native resource stubs`,async()=>{
  const r=await loadEntry({migrationBinding:value});assert.equal(r.error.message,'INVOCATION_NATIVE_MIGRATION_BINDING_REQUIRED');
  assert.equal(r.state.applicationImports,0);assert.equal(r.state.opened,0);
});
for(const [name,options] of [['missing table',{missingTable:true}],['dirty table',{dirtyTable:true}],['dirty budget',{dirtyBudget:true}]])test(`${name} admission closes owner before any native case can execute`,async()=>{
  const r=await loadEntry({migrationBinding:hash(migration),...options});assert.equal(r.error,undefined);assert.equal(r.state.cases.length,12);
  await assert.rejects(r.state.before());assert.equal(r.state.opened,1);assert.equal(r.state.closed,1);await r.state.after();assert.equal(r.state.closed,1);
  assert.ok(r.state.queries.every(sql=>sql.startsWith('SELECT')));
});
test('valid migration admits exactly twelve registrations, runs no cases, and closes pool via after hook',async()=>{
  const r=await loadEntry({migrationBinding:hash(migration)});assert.equal(r.error,undefined);assert.equal(r.state.cases.length,12);
  await r.state.before();await r.state.after();assert.equal(r.state.closed,1);
  assert.equal(r.state.cases.filter(x=>x.name.includes('COMMIT acknowledgement')).length,4);
});
