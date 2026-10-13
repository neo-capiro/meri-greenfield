// Native-test helpers only. Importing this module opens no file, pool or process.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { types } from 'node:util';

const fail = () => { throw new Error('BUDGET_NATIVE_TEST_ADMISSION_REQUIRED'); };
const admitted = new WeakSet();
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const keys = ['host', 'port', 'database', 'user', 'password', 'systemIdentifier', 'serverStartTime',
  'serverVersion', 't0Ms', 'workDeadlineMs', 'cleanupDeadlineMs', 'stateLockSha256', 'migrationSha256'];
export function parseNativeAdmission(env, nowMs = Date.now()) {
  if (!env || types.isProxy(env) || Object.getPrototypeOf(env) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(env);
  if (Object.values(descriptors).some(d => !Object.hasOwn(d, 'value'))) fail();
  const values = Object.fromEntries(Object.entries(descriptors).map(([k,d]) => [k,d.value]));
  if (values.MERI_BUDGET_PG_TEST_RUN !== 'explicit-isolated-engine' ||
      Object.entries(values).some(([k,v]) => v && /^(PG|AWS_|ANTHROPIC_|OPENAI_|BEDROCK_|NODE_OPTIONS$|NODE_PATH$)/.test(k))) fail();
  const raw = values.MERI_BUDGET_PG_TEST_CONFIG;
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 8192 ||
      typeof values.MERI_BUDGET_PG_TEST_CONFIG_SHA256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(values.MERI_BUDGET_PG_TEST_CONFIG_SHA256) ||
      sha256(raw) !== values.MERI_BUDGET_PG_TEST_CONFIG_SHA256) fail();
  let c; try { c = JSON.parse(raw); } catch { fail(); }
  if (!c || Array.isArray(c) || Object.keys(c).length !== keys.length || keys.some(k => !Object.hasOwn(c,k)) ||
      c.host !== '127.0.0.1' || c.database !== 'meri_qualification_test' || c.user !== 'qualification_owner' ||
      !Number.isInteger(c.port) || c.port < 1 || c.port > 65535 ||
      typeof c.password !== 'string' || c.password.length < 1 || c.password.length > 512 ||
      typeof c.systemIdentifier !== 'string' || !/^[1-9][0-9]{0,19}$/.test(c.systemIdentifier) ||
      typeof c.serverStartTime !== 'string' || !Number.isSafeInteger(Date.parse(c.serverStartTime)) ||
      typeof c.serverVersion !== 'string' || !/^[1-9][0-9]{5}$/.test(c.serverVersion) ||
      ![c.t0Ms,c.workDeadlineMs,c.cleanupDeadlineMs,nowMs].every(Number.isSafeInteger) ||
      c.t0Ms <= 0 || c.workDeadlineMs !== c.t0Ms+720000 || c.cleanupDeadlineMs !== c.t0Ms+900000 ||
      nowMs < c.t0Ms || nowMs >= c.workDeadlineMs ||
      ![c.stateLockSha256,c.migrationSha256].every(v => typeof v==='string' && /^[0-9a-f]{64}$/.test(v))) fail();
  // This frozen correlation/configuration is NOT host or execution authority.
  Object.freeze(c); admitted.add(c); return c;
}
export function active(c) { const now=Date.now(); if (!admitted.has(c) || now<c.t0Ms || now>=c.workDeadlineMs) fail(); }
export async function openNativePool(c) {
  active(c);
  const anchor = new URL('../../control/qualification-sdk-fixture/state/package.json', import.meta.url);
  const require = createRequire(anchor);
  const lock = await readFile(new URL('package-lock.json', anchor));
  const migration = await readFile(new URL('../../proxy/qualification/state/migrations/0002_tool_budget.sql', import.meta.url));
  if (sha256(lock)!==c.stateLockSha256 || sha256(migration)!==c.migrationSha256 ||
      JSON.parse(lock).packages['node_modules/pg'].version!=='8.23.1' || require('pg/package.json').version!=='8.23.1') fail();
  const { Pool } = require('pg');
  active(c);
  const pool = new Pool({ host:c.host,port:c.port,database:c.database,user:c.user,password:c.password,
    ssl:false,max:3,connectionTimeoutMillis:5000,query_timeout:6000,idleTimeoutMillis:1000,
    application_name:'meri-native-budget-source-test' });
  // No background error may disappear; owner checks before claiming success.
  const errors=[]; pool.on('error', () => errors.push('POOL_BACKGROUND_ERROR'));
  return { pool, errors, async close() { await pool.end(); assert.equal(pool.totalCount,0); assert.deepEqual(errors,[]); } };
}
export async function verifyDatabase(pool,c,{empty=false}={}) {
  active(c);
  const {rows:[r]}=await pool.query("SELECT current_database() AS db,current_user AS usr,pg_catalog.host(pg_catalog.inet_server_addr()) AS addr,inet_server_port() AS port,current_setting('fsync') AS fsync,current_setting('synchronous_commit') AS sync,current_setting('server_version_num') AS version,pg_postmaster_start_time() AS started,(SELECT system_identifier::text FROM pg_control_system()) AS system");
  assert.equal(r.db,c.database);assert.equal(r.usr,c.user);assert.equal(r.addr,c.host);assert.equal(r.port,c.port);
  assert.equal(r.fsync,'on');assert.equal(r.sync,'on');assert.equal(r.version,c.serverVersion);
  assert.equal(r.started.getTime(),Date.parse(c.serverStartTime));assert.equal(r.system,c.systemIdentifier);
  for(const table of ['budget','runs','grants','requests','tool_run_allocations','tool_grant_bindings','tool_reservations','budget_liabilities']) {
    assert.ok((await pool.query('SELECT to_regclass($1) AS name',[`meri_qualification.${table}`])).rows[0].name);
  }
  if(empty) {
    for(const table of ['runs','grants','requests','tool_run_allocations','tool_grant_bindings','tool_reservations'])
      assert.equal((await pool.query(`SELECT count(*)::text AS n FROM meri_qualification.${table}`)).rows[0].n,'0');
    const b=(await pool.query('SELECT * FROM meri_qualification.budget WHERE id=1')).rows[0];
    assert.equal(b.cap_micro_usd,'10000000');assert.equal(b.consumed_micro_usd,'0');assert.equal(b.quarantined,false);
  }
  active(c);
}
export async function syntheticCase(pool,c,{maxToolCalls=4,maxCostMicroUSD=100,charge=10}={}) {
  active(c);
  const [{canonicalSha256},{fixture,operation},catalogModule] = await Promise.all([
    import('../../../packages/contracts/validate.mjs'),import('./fixtures.mjs'),
    import('../../../packages/contracts/retrieval-0.2/catalog.json',{with:{type:'json'}})]);
  const f=fixture(), now=Date.now(), policy='a'.repeat(64);
  for(const k of ['conversationId','runId','attemptId','workerId'])f.binding[k]=randomUUID();
  f.claims.issuedAt=new Date(now-1000).toISOString();f.claims.expiresAt=new Date(Math.min(now+120000,c.workDeadlineMs)).toISOString();
  f.claims.policyRevision=policy;f.claims.scopes[0].policyRevision=policy;
  f.claims.budgets={maxTurns:5,maxRuntimeSeconds:120,maxCostMicrousd:maxCostMicroUSD,maxOutputBytes:65536};
  const budgets={maxTurns:5,maxToolCalls,maxRecoveryAttempts:0,maxRuntimeSeconds:120,maxCostMicroUSD,maxOutputBytes:65536};
  const manifest={contractVersion:'0.2.0',skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0',
    prose:{id:'urn:meri:synthetic:budget-native:1',sha256:'a'.repeat(64)},
    requiredSources:[{sourceId:'synthetic-source',authority:'authoritative',purpose:'enumeration'}],allowedOperations:[operation],
    subjectKinds:['personal'],windowBases:['unbounded'],completion:{requireAllSources:true,allowDisclosedPartial:true,
      negativeClaims:'complete-covered-only',rubric:[{id:'evidence',requirement:'Synthetic budget boundary',evidenceRequired:true}]},
    approval:{mutations:'separate-immutable-proposal',autoCreateTasks:false},budgets,
    versionPolicy:{existingRuns:'pin-immutable',resume:'exact-or-explicit-migration',fork:'preserve-unless-explicit-reselection'}};
  const allocation={run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,f.binding[k]])),
    manifest,manifestSha256:canonicalSha256(manifest),catalogSha256:canonicalSha256(catalogModule.default),budgets,
    schedule:{revision:'d'.repeat(64),expiresAt:f.claims.expiresAt,operations:[{operation,chargeMicrousd:charge}]}};
  const credential=`synthetic-${randomUUID()}`;
  const invocation={invocationId:randomUUID(),grantId:randomUUID(),binding:f.binding,
    qualificationBinding:{runId:f.binding.runId,attempt:1,workerArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${randomUUID().replaceAll('-','')}`,fence:1,policyRevision:policy},
    capabilitySha256:sha256(credential),allocationSha256:canonicalSha256(allocation)};
  const q=invocation.qualificationBinding;
  // Explicit synthetic rows on the separately admitted disposable schema, not a grant issuer.
  await pool.query('INSERT INTO meri_qualification.runs(run_id,attempt,worker_arn,fence,policy_revision) VALUES($1,$2,$3,$4,$5)',[q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision]);
  await pool.query("INSERT INTO meri_qualification.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE')",[invocation.grantId,q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision,invocation.capabilitySha256,f.claims.expiresAt]);
  return {allocationJson:JSON.stringify(allocation),invocationJson:JSON.stringify(invocation),credential,ports:f.ports,
    reserve:{reservationId:randomUUID(),binding:f.binding,operation,argumentsSha256:canonicalSha256({}),budgets:f.claims.budgets,claims:f.claims,deadlineMs:Date.parse(f.claims.expiresAt)}};
}
/** Fault injection only AFTER real COMMIT acknowledgement; all SQL remains native. */
export function forwardedPool(pool,{loseCommit=false}={}) {
  const events=[]; let fired=false;
  return {events,connect:async()=>{
    const client=await pool.connect();events.push({kind:'connect',pid:client.processID});
    return {async query(...args){const value=await client.query(...args);
      if(args[0]==='COMMIT'&&loseCommit&&!fired){fired=true;events.push({kind:'synthetic-post-commit-loss'});throw Error('SYNTHETIC_ACK_LOSS');}
      return value;},release(error){events.push({kind:'release',evicted:Boolean(error),pid:client.processID});client.release(error);}};
  }};
}
export async function row(pool,invocationJson) {
  const i=JSON.parse(invocationJson);
  return (await pool.query('SELECT * FROM meri_qualification.tool_reservations WHERE invocation_id=$1',[i.invocationId])).rows[0];
}
