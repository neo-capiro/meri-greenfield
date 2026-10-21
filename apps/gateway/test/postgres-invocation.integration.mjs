// Explicit real PostgreSQL entry; never part of ordinary/offline source checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseNativeAdmission, openNativePool, verifyDatabase, sha256 } from './postgres-budget-native-fixture.mjs';
const admission=parseNativeAdmission({...process.env});
const migrationSha=process.env.MERI_INVOCATION_PG_MIGRATION_SHA256;
if(typeof migrationSha!=='string'||!/^[0-9a-f]{64}$/.test(migrationSha)||
  sha256(await readFile(new URL('../../proxy/qualification/state/migrations/0003_tool_invocations.sql',import.meta.url)))!==migrationSha)
  throw Error('INVOCATION_NATIVE_MIGRATION_BINDING_REQUIRED');
const [{invocationCase,loseAcknowledgement,invocationRows,conservedAccounting,historicalResult,concurrentOwners},
  {canonicalSha256},{bindToolInvocationControl},{createPostgresToolBudget}]=await Promise.all([
  import('./postgres-invocation-fixture.mjs'),import('../../../packages/contracts/validate.mjs'),
  import('../../control/tool-invocations.mjs'),import('../budget/postgres-tool-budget.mjs')]);
let owner;
test.before(async()=>{owner=await openNativePool(admission);try{
  await verifyDatabase(owner.pool,admission,{empty:true});
  assert.ok((await owner.pool.query("SELECT to_regclass('meri_qualification.tool_invocations') AS name")).rows[0].name);
  assert.equal((await owner.pool.query('SELECT count(*)::int AS n FROM meri_qualification.tool_invocations')).rows[0].n,0);
}catch(error){await owner.close();owner=null;throw error;}});
test.after(async()=>{if(owner)await owner.close();});
const accounting=(s)=>conservedAccounting(owner.pool,s);
const one=async s=>{const rows=await invocationRows(owner.pool,s);assert.equal(rows.length,1);return rows[0];};

test('actual trusted control normalizes, produces one durable identity, completes and charges once',async()=>{
  const s=await invocationCase(owner.pool,admission);
  assert.equal((await s.reconcile()).stage,'ABSENT');
  const result=JSON.parse(await s.execute());assert.equal(result.data.total,0);assert.equal(s.effects(),1);
  const row=await one(s);assert.match(row.invocation_id,/^owned_/);
  assert.equal(row.raw_request_sha256,canonicalSha256(JSON.parse(s.requestJson)));
  assert.equal(row.arguments_sha256,canonicalSha256({page:1,limit:10}));
  assert.notEqual(row.arguments_sha256,canonicalSha256({}));assert.ok(row.completion.resultSha256);
  assert.equal(row.completion.resultSha256,canonicalSha256(s.f.output));
  assert.equal(row.completion.outputBytes,Buffer.byteLength(JSON.stringify(s.f.output)));
  assert.equal(row.completion.factsSha256,canonicalSha256(row.facts));
  const a=await s.reconcile(),b=await s.control().reconcile(s.requestJson,s.deliveryId);
  assert.equal(a.stage,'SETTLED');assert.equal(a.resultDelivered,false);
  assert.deepEqual(historicalResult(a),historicalResult(b));
  assert.deepEqual(await accounting(s),{held:'0',consumed:'10',slots:1});
  await assert.rejects(s.execute());assert.equal(s.effects(),1);assert.deepEqual(await one(s),row);
});

for(const phase of ['prepare','claim','marker','settle'])test(`lost real ${phase} COMMIT acknowledgement retains identity and conserved accounting`,async()=>{
  const s=await invocationCase(owner.pool,admission),fault=loseAcknowledgement(owner.pool,phase);
  await assert.rejects(s.execute(fault.pool));assert.equal(fault.fired(),true);
  assert.equal(fault.events.filter(e=>e.phase===phase).length,1);
  const lostPid=fault.events.find(e=>e.phase===phase).pid;
  assert.ok(fault.events.some(e=>e.release&&e.pid===lostPid&&e.evicted));
  assert.notEqual((await owner.pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,lostPid);
  const before=await one(s),id=before.invocation_id;
  const expectedStage=phase==='prepare'?'PREPARED':phase==='claim'?'UNKNOWN':'SETTLED';
  const hasEffect=['marker','settle'].includes(phase);assert.equal(s.effects(),Number(hasEffect));
  assert.deepEqual(await accounting(s),{held:phase==='claim'||phase==='marker'?'10':'0',consumed:phase==='settle'?'10':'0',slots:phase==='prepare'?0:1});
  const a=await s.reconcile(),b=await s.control().reconcile(s.requestJson,s.deliveryId);
  assert.equal(a.stage,expectedStage);assert.equal(a.invocationId,id);assert.equal(a.resultDelivered,false);
  assert.deepEqual(historicalResult(a),historicalResult(b));
  assert.deepEqual(await accounting(s),{held:phase==='claim'?'10':'0',consumed:hasEffect?'10':'0',slots:phase==='prepare'?0:1});
  if(phase==='prepare'){
    const again=await s.gateway().prepareInvocation(s.deliveryJson,s.requestJson);assert.equal(JSON.parse(again.invocationJson).invocationId,id);
    await s.execute();assert.equal(s.effects(),1);assert.equal((await one(s)).invocation_id,id);
    assert.deepEqual(await accounting(s),{held:'0',consumed:'10',slots:1});
  }else{await assert.rejects(s.execute());assert.equal(s.effects(),Number(hasEffect));}
  assert.equal((await one(s)).invocation_id,id);
});

test('simultaneous real trusted deliveries issue one identity, one reservation and one handler',async()=>{
  const s=await invocationCase(owner.pool,admission);
  const group=await concurrentOwners(owner.pool,admission,s,p=>s.execute(p));
  assert.equal(group.observedLockWaiters,3);assert.equal(group.results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(s.effects(),1);assert.ok((await one(s)).completion);
  assert.deepEqual(await accounting(s),{held:'0',consumed:'10',slots:1});
});

test('three native preparations converge to the retained producer identity without duplicate issuance',async()=>{
  const s=await invocationCase(owner.pool,admission);
  const group=await concurrentOwners(owner.pool,admission,s,p=>s.disabledGateway(p).prepareInvocation(s.deliveryJson,s.requestJson));
  assert.equal(group.observedLockWaiters,3);assert.ok(group.results.every(r=>r.status==='fulfilled'));
  const ids=group.results.map(r=>JSON.parse(r.value.invocationJson).invocationId);assert.equal(new Set(ids).size,1);
  assert.equal((await one(s)).invocation_id,ids[0]);assert.equal(s.effects(),0);
  assert.deepEqual(await accounting(s),{held:'0',consumed:'0',slots:0});
  await s.execute();assert.equal(s.effects(),1);assert.equal((await one(s)).invocation_id,ids[0]);
  assert.deepEqual(await accounting(s),{held:'0',consumed:'10',slots:1});
});

test('concurrent fresh owners reconcile the real completion marker and charge exactly once',async()=>{
  const s=await invocationCase(owner.pool,admission),fault=loseAcknowledgement(owner.pool,'marker');
  await assert.rejects(s.execute(fault.pool));assert.equal(fault.fired(),true);
  const before=await one(s);assert.ok(before.completion);assert.equal(s.effects(),1);
  assert.deepEqual(await accounting(s),{held:'10',consumed:'0',slots:1});
  await owner.pool.query("UPDATE meri_qualification.grants SET state='REVOKED',expires_at=clock_timestamp()-interval '1 second' WHERE grant_id=$1",[s.context.grantId]);
  const group=await concurrentOwners(owner.pool,admission,s,p=>s.disabledControl(p).reconcile(s.requestJson,s.deliveryId));
  assert.equal(group.observedLockWaiters,3);assert.ok(group.results.every(r=>r.status==='fulfilled'));
  for(const r of group.results){assert.equal(r.value.stage,'SETTLED');assert.equal(r.value.invocationId,before.invocation_id);assert.equal(r.value.resultDelivered,false);}
  assert.deepEqual(historicalResult(group.results[0].value),historicalResult(group.results[1].value));
  assert.deepEqual(await accounting(s),{held:'0',consumed:'10',slots:1});
  assert.deepEqual(await one(s),before);await assert.rejects(s.execute());assert.equal(s.effects(),1);
});

test('same delivery rejects request/context substitution and cannot bypass canonical owned dispatch',async()=>{
  const s=await invocationCase(owner.pool,admission),gateway=s.gateway();
  const prepared=await gateway.prepareInvocation(s.deliveryJson,s.requestJson),before=await one(s);
  const changed=JSON.stringify({...JSON.parse(s.requestJson),arguments:{limit:1}});
  await assert.rejects(s.control().execute(changed,s.credential,s.deliveryId));
  const context={...s.context,binding:{...s.context.binding,attemptId:'99999999-9999-4999-8999-999999999999'}};
  const foreign=bindToolInvocationControl({gateway:s.gateway(),contextJson:JSON.stringify(context),producerJson:s.producerJson});
  await assert.rejects(foreign.execute(s.requestJson,s.credential,s.deliveryId));
  await assert.rejects(gateway.execute(s.requestJson,s.credential,prepared.invocationJson),/OWNED_INVOCATION_REQUIRED/);
  assert.throws(()=>createPostgresToolBudget({pool:owner.pool,allocationJson:s.allocationJson}).forInvocation(prepared.invocationJson),/OWNED_INVOCATION_REQUIRED/);
  assert.deepEqual(await one(s),before);assert.equal(s.effects(),0);
  assert.deepEqual(await accounting(s),{held:'0',consumed:'0',slots:0});
});

test('production control stays source-disabled while actual producer provenance remains recoverable',async()=>{
  const s=await invocationCase(owner.pool,admission),control=s.disabledControl();
  await assert.rejects(control.execute(s.requestJson,s.credential,s.deliveryId),/UNAVAILABLE/);
  const row=await one(s);assert.equal(row.reservation_id,null);assert.equal(row.completion,null);
  assert.equal((await control.reconcile(s.requestJson,s.deliveryId)).stage,'PREPARED');assert.equal(s.effects(),0);
  assert.deepEqual(await accounting(s),{held:'0',consumed:'0',slots:0});
});

test('foreign completion facts cannot release or charge a real UNKNOWN hold',async()=>{
  const s=await invocationCase(owner.pool,admission),fault=loseAcknowledgement(owner.pool,'marker');
  await assert.rejects(s.execute(fault.pool));assert.equal(s.effects(),1);
  const row=await one(s),completion={...row.completion,factsSha256:'f'.repeat(64)};
  await owner.pool.query('UPDATE meri_qualification.tool_invocations SET completion=$2 WHERE invocation_id=$1',[row.invocation_id,completion]);
  const corrupted=await one(s);await assert.rejects(s.reconcile());await assert.rejects(s.execute());
  assert.deepEqual(await one(s),corrupted);assert.equal(s.effects(),1);
  assert.deepEqual(await accounting(s),{held:'10',consumed:'0',slots:1});
});

test('three historical reconciliations conserve UNKNOWN after revocation expiry replacement and quarantine',async()=>{
  const s=await invocationCase(owner.pool,admission),fault=loseAcknowledgement(owner.pool,'claim');
  await assert.rejects(s.execute(fault.pool));assert.equal(s.effects(),0);
  await owner.pool.query("UPDATE meri_qualification.grants SET state='REVOKED',expires_at=clock_timestamp()-interval '1 second' WHERE grant_id=$1",[s.context.grantId]);
  await owner.pool.query('UPDATE meri_qualification.runs SET fence=fence+1 WHERE run_id=$1',[s.context.binding.runId]);
  await owner.pool.query('UPDATE meri_qualification.budget SET quarantined=true WHERE id=1');
  const row=await one(s),group=await concurrentOwners(owner.pool,admission,s,p=>s.disabledControl(p).reconcile(s.requestJson,s.deliveryId));
  assert.equal(group.observedLockWaiters,3);assert.ok(group.results.every(r=>r.status==='fulfilled'));
  for(const r of group.results){assert.equal(r.value.stage,'UNKNOWN');assert.equal(r.value.invocationId,row.invocation_id);assert.equal(r.value.resultDelivered,false);assert.equal(r.value.accounting.holdMicrousd,'10');assert.equal(r.value.accounting.chargedMicrousd,null);}
  assert.deepEqual(await one(s),row);await assert.rejects(s.execute());assert.equal(s.effects(),0);
  assert.deepEqual(await accounting(s),{held:'10',consumed:'0',slots:1});
});
