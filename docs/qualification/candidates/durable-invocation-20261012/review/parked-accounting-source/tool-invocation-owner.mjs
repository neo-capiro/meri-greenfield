/** Durable invocation provenance using the canonical budget lock and accounting. */
import { randomUUID } from 'node:crypto';
import { invocation, same, grantFacts } from './tool-budget-binding.mjs';
import { assertHistoricalGrant, outcomeSnapshot } from './tool-budget-outcome.mjs';
import { deliveryRecord, assertInvocationRecord, completionRecord } from './tool-invocation-record.mjs';
import { refuse } from './postgres-budget-store.mjs';

export function createToolInvocationOwner({ a, store, admit, storedAllocation, makeInvocation, settleRow, now }) {
  const active = (call, deadline) => {
    const current = now();
    if (call.signal?.aborted || !Number.isSafeInteger(current) || !Number.isSafeInteger(deadline) || current >= deadline) refuse('INVOCATION_STOPPED');
  };
  const read = async (client, d) => (await client.query('SELECT * FROM meri_qualification.tool_invocations WHERE run_id=$1 AND producer_key_sha256=$2', [a.run.runId, d.key])).rows[0];
  async function historical(client, d) {
    const installed = await storedAllocation(client, d.context);
    if (installed.run_id !== a.run.runId) refuse('ALLOCATION_MISMATCH');
    const bound = (await client.query('SELECT * FROM meri_qualification.tool_grant_bindings WHERE grant_id=$1', [d.context.grantId])).rows[0];
    const grant = (await client.query('SELECT * FROM meri_qualification.grants WHERE grant_id=$1', [d.context.grantId])).rows[0];
    assertHistoricalGrant(d.context, bound, grant); return installed;
  }
  async function prepared(client, d) {
    await historical(client, d); const row = await read(client, d);
    if (!row) refuse('INVOCATION_NOT_PREPARED');
    assertInvocationRecord(row, d, a); return row;
  }
  async function accounting(client, row, d, budget) {
    if (!row.reservation_id) return null;
    const reservation = (await client.query('SELECT * FROM meri_qualification.tool_reservations WHERE invocation_id=$1', [row.invocation_id])).rows[0];
    if (!reservation || reservation.reservation_id !== row.reservation_id) refuse('INVOCATION_CLAIM_MISMATCH');
    const result = outcomeSnapshot({ allocation:a, invocation:invocation(JSON.stringify(row.facts),a),
      expected:{operation:d.operation,argumentsSha256:row.arguments_sha256},row:reservation,now:budget.now });
    return { reservation, result };
  }
  async function prepare(deliveryJson, requestJson, call) {
    const d = deliveryRecord(deliveryJson, requestJson, a); active(call,call.deadlineMs);
    return store.transact(async client => {
      const budget = await store.lock(client); active(call,call.deadlineMs);
      const installed = await historical(client,d); active(call,call.deadlineMs);
      const old = await read(client,d); active(call,call.deadlineMs);
      if (old) return assertInvocationRecord(old,d,a); // Identity recovery, never fresh authority.
      const grant = await admit(client,d.context,budget); active(call,call.deadlineMs);
      const deadlineMs=Math.min(call.deadlineMs,grant.expires_at.getTime(),Date.parse(a.schedule.expiresAt),
        installed.started_at.getTime()+a.budgets.maxRuntimeSeconds*1000);
      active(call,deadlineMs); if(budget.now.getTime()>=deadlineMs)refuse('INVOCATION_STOPPED');
      const facts={...grantFacts(d.context),invocationId:`owned_${randomUUID()}`};
      await client.query('INSERT INTO meri_qualification.tool_invocations(invocation_id,run_id,producer_key_sha256,delivery,facts,raw_request_sha256,operation,deadline_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [facts.invocationId,a.run.runId,d.key,d.delivery,facts,d.rawRequestSha256,d.operation,deadlineMs]);
      active(call,deadlineMs);
      return Object.freeze({invocationJson:JSON.stringify(facts),rawRequestSha256:d.rawRequestSha256,operation:d.operation,deadlineMs});
    });
  }
  function bind(invocationJson, deliveryJson, requestJson) {
    const d=deliveryRecord(deliveryJson,requestJson,a),i=invocation(invocationJson,a);
    if(!same(grantFacts(i),grantFacts(d.context)))refuse('INVOCATION_CONFLICT');
    const bound=makeInvocation(invocationJson,async(client,call,budget)=>{
      const row=await prepared(client,d);active(call,Number(row.deadline_ms));
      if(row.invocation_id!==i.invocationId||row.reservation_id!==null||!same(row.operation,call.operation))refuse('INVOCATION_ALREADY_CLAIMED');
      if(budget.now.getTime()>=Number(row.deadline_ms))refuse('INVOCATION_STOPPED');
      await client.query('UPDATE meri_qualification.tool_invocations SET reservation_id=$2,arguments_sha256=$3 WHERE invocation_id=$1',
        [i.invocationId,call.reservationId,call.argumentsSha256]);
      active(call,Number(row.deadline_ms));
    });
    async function settle(call) {
      const deadline=bound.deadlineMs();active(call,deadline);
      await store.transact(async client=>{
        const budget=await store.lock(client);active(call,deadline);
        const row=await prepared(client,d);active(call,deadline);
        if(row.invocation_id!==i.invocationId)refuse('INVOCATION_CONFLICT');
        const observed=await accounting(client,row,d,budget);active(call,deadline);
        if(!observed||observed.result.reservationId!==call.reservationId||call.outcome!=='completed')refuse('COMPLETION_MISMATCH');
        const marker=completionRecord(row,call);
        if(call.outputBytes>Number(observed.reservation.max_output_bytes))refuse('OUTPUT_BUDGET_EXCEEDED');
        if(row.completion!==null&&!same(row.completion,marker))refuse('COMPLETION_MISMATCH');
        if(row.completion===null)await client.query('UPDATE meri_qualification.tool_invocations SET completion=$2 WHERE invocation_id=$1',[i.invocationId,marker]);
        active(call,deadline);
      });
      // Marker ACK is a separate recoverable boundary. No new port after cancellation/expiry.
      active(call,deadline);
      const result=await reconcile(deliveryJson,requestJson,{call,deadline});
      if(result.stage!=='SETTLED')refuse('COMPLETION_MISMATCH');
      return JSON.stringify({reservationId:call.reservationId,decision:'settled'});
    }
    return Object.freeze({...bound,settle});
  }
  async function reconcile(deliveryJson,requestJson,live) {
    const d=deliveryRecord(deliveryJson,requestJson,a);if(live)active(live.call,live.deadline);
    return store.transact(async client=>{
      const budget=await store.lock(client);if(live)active(live.call,live.deadline);
      await historical(client,d);if(live)active(live.call,live.deadline);
      const row=await read(client,d);if(live)active(live.call,live.deadline);
      if(!row)return Object.freeze({stage:'ABSENT',invocationId:null,reservationId:null,accounting:null,resultDelivered:false});
      assertInvocationRecord(row,d,a);
      let observed=await accounting(client,row,d,budget);if(live)active(live.call,live.deadline);
      if(row.completion!==null){
        if(!observed)refuse('COMPLETION_MISMATCH');
        const marker=completionRecord(row,{reservationId:row.reservation_id,resultSha256:row.completion.resultSha256,outputBytes:row.completion.outputBytes});
        if(!same(marker,row.completion)||marker.outputBytes>Number(observed.reservation.max_output_bytes))refuse('COMPLETION_MISMATCH');
        if(observed.result.state==='UNKNOWN'){
          await settleRow(client,observed.reservation,marker.outputBytes);if(live)active(live.call,live.deadline);
          observed={...observed,result:Object.freeze({...observed.result,state:'SETTLED',chargedMicrousd:observed.result.holdMicrousd,outputBytes:marker.outputBytes})};
        }else if(observed.result.outputBytes!==marker.outputBytes)refuse('COMPLETION_MISMATCH');
      }else if(observed?.result.state==='SETTLED')refuse('COMPLETION_MISSING');
      return Object.freeze({stage:observed?.result.state??'PREPARED',invocationId:row.invocation_id,
        reservationId:row.reservation_id,accounting:observed?.result??null,resultDelivered:false});
    });
  }
  return Object.freeze({prepare,bind,reconcile});
}
