// Invocation qualification fixtures. Importing performs no I/O or resource allocation.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { syntheticCase, openNativePool, verifyDatabase, active } from './postgres-budget-native-fixture.mjs';

export async function invocationCase(pool, admission) {
  active(admission);
  const s=await syntheticCase(pool,admission);
  const [{fixture,limits,requestJson},{createCurrentToolAuthority},{createDurableToolDispatch},
    {bindToolInvocationControl,createToolInvocationControl},{createDurableSourceDisabledGateway}]=await Promise.all([
    import('./fixtures.mjs'),import('../authorization/current-tool-authority.mjs'),
    import('../budget/durable-tool-dispatch.mjs'),import('../../control/tool-invocations.mjs'),import('../index.mjs')]);
  const f=fixture(),claims=s.reserve.claims,deadline=Date.parse(claims.expiresAt);
  Object.assign(f.binding,claims.binding);Object.assign(f.claims.scopes[0],claims.scopes[0]);
  Object.assign(f.claims,claims);f.subject.policyRevision=claims.policyRevision;f.subject.scopes=claims.scopes;
  Object.defineProperty(f.state,'now',{get:Date.now});
  f.data.asOf=f.data.generatedAt=new Date().toISOString();
  const ports={...f.ports,currentRun:async()=>JSON.stringify({binding:{...f.binding,writerFence:f.state.fence},
    policyRevision:claims.policyRevision,deadlineMs:deadline,checkedAtMs:Date.now()})};
  const authority=createCurrentToolAuthority({ports,now:Date.now,maxFactBytes:65536});
  const {invocationId:unused,...context}=JSON.parse(s.invocationJson);
  const producer={namespace:'trusted-control',executionId:`synthetic-${randomUUID()}`};
  const deliveryId='delivery-1',contextJson=JSON.stringify(context),producerJson=JSON.stringify(producer);
  const deliveryJson=JSON.stringify({context,producer,deliveryId});
  const gateway=(p=pool)=>createDurableToolDispatch({pool:p,allocationJson:s.allocationJson,
    catalog:{entry:()=>f.entry,discoverable:()=>[]},authority,limits,now:Date.now,newId:randomUUID,sourceEnabled:true});
  const control=(p=pool)=>bindToolInvocationControl({gateway:gateway(p),contextJson,producerJson});
  const disabledGateway=(p=pool)=>createDurableSourceDisabledGateway({pool:p,allocationJson:s.allocationJson,
    authorityPorts:ports,limits,now:Date.now,newId:randomUUID});
  const disabledControl=(p=pool)=>createToolInvocationControl({gatewayOptions:{pool:p,allocationJson:s.allocationJson,
    authorityPorts:ports,limits,now:Date.now,newId:randomUUID},contextJson,producerJson});
  await control().bindTrustedGrant();
  return {...s,f,context,contextJson,producerJson,deliveryId,deliveryJson,requestJson,gateway,control,
    disabledGateway,disabledControl,effects:()=>f.calls.filter(x=>x==='handler').length,
    execute:(p=pool)=>control(p).execute(requestJson,s.credential,deliveryId),
    reconcile:(p=pool)=>control(p).reconcile(requestJson,deliveryId)};
}

/** Forward every SQL command unchanged; lose only the real acknowledged COMMIT. */
export function loseAcknowledgement(pool,target) {
  assert.ok(['prepare','claim','marker','settle'].includes(target));
  const events=[];let fired=false;
  const forwarded={async connect(){const client=await pool.connect();let phase;
    return {async query(...args){const result=await client.query(...args),sql=args[0];
      if(sql.startsWith('INSERT INTO meri_qualification.tool_invocations'))phase='prepare';
      if(sql.startsWith('UPDATE meri_qualification.tool_invocations SET reservation_id'))phase='claim';
      if(sql.startsWith('UPDATE meri_qualification.tool_invocations SET completion'))phase='marker';
      if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd'))phase='settle';
      if(sql==='COMMIT'&&phase===target&&!fired){fired=true;events.push({phase,pid:client.processID});throw Error('SYNTHETIC_POST_COMMIT_ACK_LOSS');}
      return result;
    },release(error){events.push({release:true,pid:client.processID,evicted:Boolean(error)});client.release(error);}};
  }};
  return {pool:forwarded,events,fired:()=>fired};
}

export async function invocationRows(pool,s) {
  return (await pool.query('SELECT * FROM meri_qualification.tool_invocations WHERE run_id=$1 ORDER BY invocation_id',[s.context.binding.runId])).rows;
}
export async function conservedAccounting(pool,s) {
  const q=await pool.query("SELECT COALESCE(sum(hold_micro_usd) FILTER(WHERE state='UNKNOWN'),0)::text AS held,COALESCE(sum(consumed_micro_usd) FILTER(WHERE state='SETTLED'),0)::text AS consumed,count(*)::int AS slots FROM meri_qualification.budget_liabilities WHERE run_id=$1",[s.context.binding.runId]);
  const global=await pool.query("SELECT b.consumed_micro_usd::text AS consumed,(SELECT COALESCE(sum(consumed_micro_usd),0)::text FROM meri_qualification.budget_liabilities WHERE state='SETTLED') AS ledger FROM meri_qualification.budget b WHERE id=1");
  assert.equal(global.rows[0].consumed,global.rows[0].ledger);
  return q.rows[0];
}
export function historicalResult(result) {
  if(result.accounting){assert.ok(Number.isSafeInteger(result.accounting.observedAtMs));
    const {observedAtMs:observed,...accounting}=result.accounting;return {...result,accounting};}
  return result;
}

/** Three real pools contend on the same native row lock; no scripted SQL or workers. */
export async function concurrentOwners(pool,admission,s,action) {
  active(admission);const owners=[];let blocker,locked=false,joined;
  try {
    for(let n=0;n<3;n++){const owner=await openNativePool(admission);owners.push(owner);await verifyDatabase(owner.pool,admission);}
    const pids=await Promise.all(owners.map(async o=>(await o.pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid));
    assert.equal(new Set(pids).size,3);
    blocker=await pool.connect();await blocker.query('BEGIN');locked=true;
    await blocker.query("SET LOCAL statement_timeout='5s'");
    await blocker.query('SELECT id FROM meri_qualification.budget WHERE id=1 FOR UPDATE');
    const pending=owners.map(o=>Promise.resolve().then(()=>action(o.pool)));joined=Promise.allSettled(pending);
    const deadline=Math.min(admission.workDeadlineMs,Date.now()+1200);let waiting=0;
    do {
      active(admission);
      waiting=(await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=ANY($1::int[]) AND wait_event_type='Lock'",[pids])).rows[0].n;
      active(admission);
      if(Date.now()>=deadline)throw Error('NATIVE_LOCK_OBSERVATION_DEADLINE');
      if(waiting===3)break;
      await new Promise(resolve=>setTimeout(resolve,10));
    }while(true);
    await blocker.query('COMMIT');locked=false;blocker.release();blocker=null;
    const results=await joined;
    return {results,pids,observedLockWaiters:waiting};
  }finally{
    let cleanupFailed=false;
    if(blocker){
      try{if(locked)await blocker.query('ROLLBACK');}catch{cleanupFailed=true;}
      try{blocker.release(cleanupFailed?Error('INVOCATION_BLOCKER_CLEANUP_FAILED'):undefined);}catch{cleanupFailed=true;}
    }
    if(joined)await joined;
    const closed=await Promise.allSettled(owners.map(async o=>o.close()));
    if(cleanupFailed||closed.some(r=>r.status==='rejected'))throw Error('INVOCATION_POOL_CLEANUP_FAILED');
  }
}
