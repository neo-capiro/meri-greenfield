// Ordinary checks only: no database, Docker, provider or native SDK start.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loseAcknowledgement } from './postgres-invocation-fixture.mjs';
import { sha256 } from './postgres-budget-native-fixture.mjs';

for(const phase of ['prepare','claim','marker','settle'])test(`fault control forwards SQL and fails only after acknowledged ${phase} COMMIT`,async()=>{
  const statements={prepare:'INSERT INTO meri_qualification.tool_invocations',claim:'UPDATE meri_qualification.tool_invocations SET reservation_id',
    marker:'UPDATE meri_qualification.tool_invocations SET completion',settle:'UPDATE meri_qualification.budget SET consumed_micro_usd'};
  const calls=[],releases=[];const client={processID:42,query:async(...args)=>{calls.push(args);return {rows:[{ack:true}]};},release:e=>releases.push(e)};
  const fault=loseAcknowledgement({connect:async()=>client},phase),forwarded=await fault.pool.connect();
  const args=[statements[phase],[{synthetic:true}]];
  assert.deepEqual(await forwarded.query(...args),{rows:[{ack:true}]});assert.deepEqual(calls[0],args);assert.equal(fault.fired(),false);
  await assert.rejects(forwarded.query('COMMIT'),/SYNTHETIC_POST_COMMIT_ACK_LOSS/);
  assert.deepEqual(calls[1],['COMMIT']);assert.equal(fault.fired(),true);
  assert.deepEqual(await forwarded.query('COMMIT'),{rows:[{ack:true}]}); // Exactly one lost ACK.
  const error=Error('synthetic');forwarded.release(error);assert.equal(releases[0],error);
  assert.equal(fault.events.filter(e=>e.phase===phase).length,1);
});
test('driver COMMIT refusal is not mislabeled as an acknowledged fault',async()=>{
  const driverError=Error('synthetic driver failure'),client={processID:42,query:async sql=>{if(sql==='COMMIT')throw driverError;return {rows:[]};},release(){}};
  const fault=loseAcknowledgement({connect:async()=>client},'prepare'),c=await fault.pool.connect();
  await c.query('INSERT INTO meri_qualification.tool_invocations');await assert.rejects(c.query('COMMIT'),e=>e===driverError);
  assert.equal(fault.fired(),false);assert.deepEqual(fault.events,[]);
});
test('native entry refuses absent admission and unbound0003 before pool/application imports',async()=>{
  const run=promisify(execFile),entry=new URL('./postgres-invocation.integration.mjs',import.meta.url).pathname;
  const clean={PATH:'/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8'};
  await assert.rejects(run(process.execPath,['--test',entry],{env:clean,timeout:5000,maxBuffer:8192}),e=>e.code===1&&e.stdout.includes('BUDGET_NATIVE_TEST_ADMISSION_REQUIRED'));
  const now=Date.now(),c={host:'127.0.0.1',port:55432,database:'meri_qualification_test',user:'qualification_owner',password:null,
    systemIdentifier:'123456789',serverStartTime:'2026-10-12T00:00:00Z',serverVersion:'160015',t0Ms:now,workDeadlineMs:now+720000,cleanupDeadlineMs:now+900000,
    stateLockSha256:'a'.repeat(64),migrationSha256:'b'.repeat(64),preparedContainer:{id:'c'.repeat(64),image:`sha256:${'d'.repeat(64)}`,serverHost:'172.17.0.2',serverPort:5432}};
  const raw=JSON.stringify(c),env={...clean,MERI_BUDGET_PG_TEST_RUN:'explicit-isolated-engine',MERI_BUDGET_PG_TEST_CONFIG:raw,MERI_BUDGET_PG_TEST_CONFIG_SHA256:sha256(raw)};
  for(const value of [undefined,'not-a-hash','f'.repeat(64)]){
    const configured={...env};if(value!==undefined)configured.MERI_INVOCATION_PG_MIGRATION_SHA256=value;
    await assert.rejects(run(process.execPath,['--test',entry],{env:configured,timeout:5000,maxBuffer:8192}),e=>e.code===1&&e.stdout.includes('INVOCATION_NATIVE_MIGRATION_BINDING_REQUIRED'));
  }
});
test('native source reuses canonical owner, keeps migrations separate, and proves actual contention',async()=>{
  const entry=await readFile(new URL('./postgres-invocation.integration.mjs',import.meta.url),'utf8');
  const fixture=await readFile(new URL('./postgres-invocation-fixture.mjs',import.meta.url),'utf8');
  assert.ok(entry.indexOf('const admission=parseNativeAdmission')<entry.indexOf("import('./postgres-invocation-fixture"));
  assert.ok(entry.indexOf('INVOCATION_NATIVE_MIGRATION_BINDING_REQUIRED')<entry.indexOf("import('./postgres-invocation-fixture"));
  assert.doesNotMatch(entry+fixture,/\b(?:TRUNCATE|DROP|DELETE|CREATE\s+(?:TABLE|SCHEMA|DATABASE))\b|\.migrate|\.native\b/);
  assert.match(entry,/to_regclass\('meri_qualification\.tool_invocations'\)/);
  assert.match(fixture,/await client\.query\(\.\.\.args\)/);
  assert.match(fixture,/new Set\(pids\)\.size,3/);assert.match(fixture,/wait_event_type='Lock'/);
  assert.match(fixture,/Date\.now\(\)\+1200/);assert.match(fixture,/await Promise\.allSettled\(owners\.map\(async o=>o\.close\(\)\)\)/);
  assert.match(fixture,/import\('\.\.\/budget\/durable-tool-dispatch\.mjs'\)/);
  assert.match(fixture,/import\('\.\.\/\.\.\/control\/tool-invocations\.mjs'\)/);
});
