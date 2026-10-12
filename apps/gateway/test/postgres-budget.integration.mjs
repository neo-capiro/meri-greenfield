// UNRUN real-engine source. NEVER include in an ordinary/offline source test command.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { parseNativeAdmission, openNativePool, verifyDatabase, syntheticCase,
  forwardedPool, row, active, sha256 } from './postgres-budget-native-fixture.mjs';

// Refuse before pg loading, connect, SQL, test fixture creation or child spawning.
const admission=parseNativeAdmission({...process.env});
const [{createPostgresToolBudget},{PostgresBudgetStore,BudgetCommitUncertain,BudgetStateDenied},
  {createDurableSourceDisabledGateway},{limits,requestJson}]=await Promise.all([
  import('../budget/postgres-tool-budget.mjs'),import('../budget/postgres-budget-store.mjs'),
  import('../index.mjs'),import('./fixtures.mjs')]);
let owner;
test.before(async()=>{owner=await openNativePool(admission);try{await verifyDatabase(owner.pool,admission,{empty:true});}
  catch(error){await owner.close();owner=null;throw error;}});
test.after(async()=>{if(owner)await owner.close();});
const consumed=async()=>BigInt((await owner.pool.query('SELECT consumed_micro_usd FROM meri_qualification.budget WHERE id=1')).rows[0].consumed_micro_usd);
const budget=(s,pool=owner.pool)=>createPostgresToolBudget({pool,allocationJson:s.allocationJson});
async function prepared(options){active(admission);const s=await syntheticCase(owner.pool,admission,options);await budget(s).bindTrustedGrant(s.invocationJson);return s;}

test('real production entry binds admitted grant but unavailable execution opens no transaction',async()=>{
  const s=await syntheticCase(owner.pool,admission);const tracked=forwardedPool(owner.pool);
  const gateway=createDurableSourceDisabledGateway({pool:tracked,allocationJson:s.allocationJson,
    authorityPorts:s.ports,limits,now:Date.now,newId:randomUUID});
  assert.equal(gateway.sourceEnabled,false);assert.deepEqual(await gateway.discover(),[]);assert.equal(tracked.events.length,0);
  await gateway.bindTrustedGrant(s.invocationJson);const before=tracked.events.length;
  await assert.rejects(gateway.execute(requestJson,s.credential,s.invocationJson),/UNAVAILABLE/);
  assert.equal(tracked.events.length,before);assert.equal(await row(owner.pool,s.invocationJson),undefined);
});

test('real slot survives fresh adapter; historical completion charges once without authorizing replay',async()=>{
  const s=await prepared();await budget(s).forInvocation(s.invocationJson).reserve(s.reserve);
  const before=await row(owner.pool,s.invocationJson);assert.equal(before.state,'UNKNOWN');
  await assert.rejects(budget(s).forInvocation(s.invocationJson).reserve({...s.reserve,reservationId:randomUUID()}),BudgetStateDenied);
  const i=JSON.parse(s.invocationJson);
  await owner.pool.query("UPDATE meri_qualification.grants SET state='REVOKED',expires_at=clock_timestamp()-interval '1 second' WHERE grant_id=$1",[i.grantId]);
  const newCall=JSON.stringify({...i,invocationId:randomUUID()});
  await assert.rejects(budget(s).forInvocation(newCall).reserve({...s.reserve,reservationId:randomUUID()}),BudgetStateDenied);
  assert.deepEqual(await row(owner.pool,s.invocationJson),before);
  const beforeConsumed=await consumed();
  await budget(s).forInvocation(s.invocationJson).settle({reservationId:s.reserve.reservationId,outcome:'completed',outputBytes:1});
  assert.equal(await consumed(),beforeConsumed+10n);
  const terminal=await row(owner.pool,s.invocationJson);assert.equal(terminal.state,'SETTLED');assert.equal(terminal.charged_micro_usd,'10');
  await assert.rejects(budget(s).forInvocation(s.invocationJson).settle({reservationId:s.reserve.reservationId,outcome:'completed',outputBytes:1}),BudgetStateDenied);
  await budget(s).forInvocation(s.invocationJson).markUncertain(s.reserve.reservationId);
  assert.deepEqual(await row(owner.pool,s.invocationJson),terminal);assert.equal(await consumed(),beforeConsumed+10n);
});

for(const phase of ['reserve','settle'])test(`synthetic lost ${phase} acknowledgement after real COMMIT preserves exact native row`,async()=>{
  const s=await prepared();if(phase==='settle')await budget(s).forInvocation(s.invocationJson).reserve(s.reserve);
  const beforeConsumed=await consumed();
  const tracked=forwardedPool(owner.pool,{loseCommit:true});const bound=budget(s,tracked).forInvocation(s.invocationJson);
  await assert.rejects(phase==='reserve'?bound.reserve(s.reserve):bound.settle({reservationId:s.reserve.reservationId,outcome:'completed',outputBytes:1}),BudgetCommitUncertain);
  assert.equal(tracked.events.filter(e=>e.kind==='synthetic-post-commit-loss').length,1);
  assert.equal(tracked.events.find(e=>e.kind==='release').evicted,true);
  const observed=await row(owner.pool,s.invocationJson);assert.equal(observed.state,phase==='reserve'?'UNKNOWN':'SETTLED');
  assert.equal(observed.reservation_id,s.reserve.reservationId);
  assert.equal(observed.charged_micro_usd,phase==='reserve'?null:'10');
  assert.equal(await consumed(),beforeConsumed+(phase==='reserve'?0n:10n));
  const lostPid=tracked.events.find(e=>e.kind==='connect').pid;
  const fresh=await owner.pool.connect();try{assert.notEqual(fresh.processID,lostPid);}finally{fresh.release();}
  await budget(s).forInvocation(s.invocationJson).markUncertain(s.reserve.reservationId);
  assert.deepEqual(await row(owner.pool,s.invocationJson),observed);
  assert.equal(await consumed(),beforeConsumed+(phase==='reserve'?0n:10n));
  await assert.rejects(budget(s).forInvocation(s.invocationJson).reserve({...s.reserve,reservationId:randomUUID()}),BudgetStateDenied);
});

test('real pg clients are returned after commit/rollback; borrowed pool remains usable',async()=>{
  const tracked=forwardedPool(owner.pool),store=new PostgresBudgetStore(tracked);
  assert.equal(await store.transact(async client=>(await client.query('SELECT 41::int AS value')).rows[0].value),41);
  await assert.rejects(store.transact(async()=>{throw new BudgetStateDenied('SYNTHETIC_DENIAL');}),BudgetStateDenied);
  assert.equal(tracked.events.filter(e=>e.kind==='release').length,2);
  assert.ok(tracked.events.filter(e=>e.kind==='release').every(e=>e.evicted===false));
  assert.equal((await owner.pool.query('SELECT 42::int AS value')).rows[0].value,42);
  assert.equal(owner.pool.waitingCount,0);assert.equal(owner.pool.idleCount,owner.pool.totalCount);
});

async function compete(s,{sameInvocation}) {
  active(admission);const children=[],observations=[];const deadline=Math.min(admission.workDeadlineMs,Date.now()+30000);
  const env={};for(const k of ['PATH','SystemRoot','WINDIR','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
  for(const k of ['MERI_BUDGET_PG_TEST_RUN','MERI_BUDGET_PG_TEST_CONFIG','MERI_BUDGET_PG_TEST_CONFIG_SHA256'])env[k]=process.env[k];
  env.MERI_BUDGET_PG_CHILD_RUN='reserve';
  const payloads=[];
  for(let n=0;n<3;n++) {
    let invocationJson=s.invocationJson;
    if(!sameInvocation) {
      const i={...JSON.parse(s.invocationJson),invocationId:randomUUID(),grantId:randomUUID(),capabilitySha256:sha256(randomUUID())};
      const q=i.qualificationBinding;
      await owner.pool.query("INSERT INTO meri_qualification.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE')",[i.grantId,q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision,i.capabilitySha256,s.reserve.claims.expiresAt]);
      invocationJson=JSON.stringify(i);await budget(s).bindTrustedGrant(invocationJson);
    }
    payloads.push({allocationJson:s.allocationJson,invocationJson,reserve:{...s.reserve,reservationId:randomUUID()}});
  }
  try {
    for(let n=0;n<3;n++){
      active(admission);
      const child=fork(new URL('./postgres-budget-child.mjs',import.meta.url),[],{execPath:process.execPath,execArgv:[],env,stdio:['ignore','pipe','pipe','ipc'],serialization:'json'});
      let bytes=0,timer;const record={child,ready:null,done:null,closed:false};children.push(record);
      const bounded=chunk=>{bytes+=chunk.length;if(bytes>8192)child.kill('SIGTERM');};child.stdout.on('data',bounded);child.stderr.on('data',bounded);
      record.ready=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',()=>reject(Error('CHILD_CLOSED_BEFORE_READY')));child.once('message',m=>m?.kind==='ready'?resolve():reject(Error('CHILD_PROTOCOL')));});
      record.done=new Promise((resolve,reject)=>{
        let outcome;child.on('message',m=>{if(m?.kind==='result')outcome=m.outcome;});child.once('error',reject);
        child.once('close',(code,signal)=>{record.closed=true;clearTimeout(timer);observations.push({pid:child.pid,code,signal,bytes});
          if(code!==0||signal||bytes>8192||!['reserved','denied'].includes(outcome))reject(Error('CHILD_FAILED'));else resolve(outcome);});
        timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('CHILD_DEADLINE'));},Math.max(1,deadline-Date.now()));
      });
      // Attach immediately while the parent waits for the all-ready barrier.
      record.done.catch(()=>{});
    }
    let readyTimer;
    try { await Promise.race([Promise.all(children.map(c=>c.ready)),new Promise((_,reject)=>{
      readyTimer=setTimeout(()=>reject(Error('CHILD_READY_DEADLINE')),Math.max(1,deadline-Date.now()));
    })]); } finally {clearTimeout(readyTimer);}
    active(admission);children.forEach(({child},n)=>child.send(payloads[n]));
    const outcomes=await Promise.all(children.map(c=>c.done));assert.equal(outcomes.filter(v=>v==='reserved').length,1);
    assert.equal(observations.length,3);assert.ok(observations.every(o=>o.code===0&&!o.signal));
  } finally {
    for(const {child} of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
    const pending=children.filter(record=>!record.closed);
    if(pending.length)await Promise.all(pending.map(({child})=>new Promise((resolve,reject)=>{
      const remaining=Math.max(1,Math.min(5000,admission.cleanupDeadlineMs-Date.now()));
      const escalation=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},Math.min(1000,remaining));
      const cutoff=setTimeout(()=>{clearTimeout(escalation);reject(Error('CHILD_CLEANUP_UNKNOWN'));},remaining);
      child.once('close',()=>{clearTimeout(escalation);clearTimeout(cutoff);resolve();});
    })));
  }
}
for(const sameInvocation of [true,false])test(`three real child pools contend ${sameInvocation?'one retained invocation':'one run call allowance'}`,async()=>{
  const s=await prepared({maxToolCalls:1});await compete(s,{sameInvocation});
  const i=JSON.parse(s.invocationJson);
  const rows=(await owner.pool.query('SELECT * FROM meri_qualification.tool_reservations WHERE run_id=$1',[i.binding.runId])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].state,'UNKNOWN');assert.equal(rows[0].hold_micro_usd,'10');
  await assert.rejects(budget(s).forInvocation(s.invocationJson).reserve({...s.reserve,reservationId:randomUUID()}),BudgetStateDenied);
  assert.equal((await owner.pool.query('SELECT count(*)::text AS n FROM meri_qualification.tool_reservations WHERE run_id=$1',[i.binding.runId])).rows[0].n,'1');
});

for(const modelHold of [91,90])test(`real shared model/tool run cap retains model UNKNOWN ${modelHold}`,async()=>{
  const s=await prepared({maxCostMicroUSD:100,charge:10}),i=JSON.parse(s.invocationJson),q=i.qualificationBinding;
  const modelGrant=randomUUID(),request=randomUUID();
  await owner.pool.query("INSERT INTO meri_qualification.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE')",[modelGrant,q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision,sha256(randomUUID()),s.reserve.claims.expiresAt]);
  await owner.pool.query("INSERT INTO meri_qualification.requests(request_id,grant_id,run_id,attempt,worker_arn,fence,policy_revision,native_body_sha256,raw_request_sha256,model_id,profile_id,pricing_revision,pricing_valid_until,input_tokens,max_output_tokens,hold_micro_usd,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,'synthetic-model','synthetic-profile',$8,$9,1,1,$10,'UNKNOWN')",[request,modelGrant,q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision,'e'.repeat(64),s.reserve.claims.expiresAt,modelHold]);
  const before=(await owner.pool.query('SELECT * FROM meri_qualification.requests WHERE request_id=$1',[request])).rows[0];
  const attempt=budget(s).forInvocation(s.invocationJson).reserve(s.reserve);
  if(modelHold===91){await assert.rejects(attempt,BudgetStateDenied);assert.equal(await row(owner.pool,s.invocationJson),undefined);}
  else {await attempt;assert.equal((await row(owner.pool,s.invocationJson)).hold_micro_usd,'10');}
  assert.deepEqual((await owner.pool.query('SELECT * FROM meri_qualification.requests WHERE request_id=$1',[request])).rows[0],before);
});
