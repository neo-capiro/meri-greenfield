/** Concrete tool accounting over the proxy qualification state's shared authority. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { PostgresBudgetStore, refuse } from './postgres-budget-store.mjs';
import { allocation, invocation, grantFacts, same, digest, integer } from './tool-budget-binding.mjs';
import { createToolInvocationOwner } from './tool-invocation-owner.mjs';
import { ownedId } from './tool-invocation-record.mjs';
import { outcomeExpectation, assertHistoricalGrant, outcomeSnapshot } from './tool-budget-outcome.mjs';

const n = value => { try { if (!((typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)) || (Number.isSafeInteger(value) && value >= 0))) throw Error(); return BigInt(value); } catch { refuse('INVALID_STORED_MONEY'); } };
const receipt = (reservationId, decision) => JSON.stringify({ reservationId, decision });
const reservationIdCheck = value => { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) refuse('INVALID_RESERVATION_ID'); };

export function createPostgresToolBudget({ pool, allocationJson, now = Date.now }) {
  const a = allocation(allocationJson); const allocationSha256 = canonicalSha256(a);
  const store = new PostgresBudgetStore(pool);
  async function admit(client, i, budget, publishDeadline) {
    const q = i.qualificationBinding;
    const run = (await client.query('SELECT * FROM meri_qualification.runs WHERE run_id=$1', [q.runId])).rows[0];
    const grant = (await client.query('SELECT * FROM meri_qualification.grants WHERE grant_id=$1', [i.grantId])).rows[0];
    const match = row => row && String(row.run_id) === q.runId && row.attempt === q.attempt && row.worker_arn === q.workerArn && row.fence === q.fence && row.policy_revision === q.policyRevision;
    if (!match(run) || !match(grant) || grant.state !== 'ACTIVE' || grant.capability_sha256 !== i.capabilitySha256 ||
        !(grant.expires_at instanceof Date) || !Number.isFinite(grant.expires_at.getTime()) || grant.expires_at <= budget.now) refuse('GRANT_ADMISSION_DENIED');
    if (budget.quarantined || Date.parse(a.schedule.expiresAt) <= budget.now.getTime()) refuse('BUDGET_ADMISSION_DENIED');
    publishDeadline?.(grant.expires_at.getTime());
    return grant;
  }
  async function storedAllocation(client, i) {
    const row = (await client.query('SELECT * FROM meri_qualification.tool_run_allocations WHERE run_id=$1', [i.binding.runId])).rows[0];
    if (!row || row.allocation_sha256 !== allocationSha256 || !same(row.allocation, a) || n(row.max_tool_calls) !== n(a.budgets.maxToolCalls) || n(row.max_cost_micro_usd) !== n(a.budgets.maxCostMicroUSD)) refuse('ALLOCATION_MISMATCH');
    return row;
  }
  async function bindTrustedGrant(invocationJson) {
    // Explicit trusted-owner operation. No automatic grant activation or run creation.
    const i = invocation(invocationJson, a); const facts = grantFacts(i);
    return store.transact(async client => {
      const budget = await store.lock(client); await admit(client, i, budget);
      const old = (await client.query('SELECT * FROM meri_qualification.tool_run_allocations WHERE run_id=$1', [i.binding.runId])).rows[0];
      if (old) await storedAllocation(client, i);
      else await client.query('INSERT INTO meri_qualification.tool_run_allocations(run_id,allocation_sha256,allocation,max_tool_calls,max_cost_micro_usd) VALUES($1,$2,$3,$4,$5)', [i.binding.runId, allocationSha256, a, a.budgets.maxToolCalls, a.budgets.maxCostMicroUSD]);
      const previous = (await client.query('SELECT * FROM meri_qualification.tool_grant_bindings WHERE grant_id=$1', [i.grantId])).rows[0];
      if (previous && !same(previous.facts, facts)) refuse('GRANT_BINDING_IMMUTABLE');
      if (!previous) await client.query('INSERT INTO meri_qualification.tool_grant_bindings(grant_id,run_id,facts) VALUES($1,$2,$3)', [i.grantId, i.binding.runId, facts]);
    });
  }
  async function readInvocationOutcome(invocationJson, expectedJson) {
    // Internal pool/allocation-bound owner read. Historical identity grants no effect.
    const i = invocation(invocationJson, a); const expected = outcomeExpectation(expectedJson, a);
    return store.transact(async client => {
      const budget = await store.lock(client); const installed = await storedAllocation(client, i);
      if (installed.run_id !== i.binding.runId) refuse('ALLOCATION_MISMATCH');
      const bound = (await client.query('SELECT * FROM meri_qualification.tool_grant_bindings WHERE grant_id=$1', [i.grantId])).rows[0];
      const grant = (await client.query('SELECT * FROM meri_qualification.grants WHERE grant_id=$1', [i.grantId])).rows[0];
      assertHistoricalGrant(i, bound, grant);
      const row = (await client.query('SELECT * FROM meri_qualification.tool_reservations WHERE invocation_id=$1', [i.invocationId])).rows[0];
      return outcomeSnapshot({ allocation: a, invocation: i, expected, row, now: budget.now });
    });
  }
  async function settleRow(client, row, outputBytes) {
    await client.query('UPDATE meri_qualification.budget SET consumed_micro_usd=consumed_micro_usd+$1 WHERE id=1', [row.hold_micro_usd]);
    await client.query("UPDATE meri_qualification.tool_reservations SET state='SETTLED',charged_micro_usd=hold_micro_usd,output_bytes=$2,settled_at=clock_timestamp() WHERE invocation_id=$1", [row.invocation_id, outputBytes]);
  }
  function makeInvocation(invocationJson, claim) {
    const i = invocation(invocationJson, a); let admittedDeadlineMs; // Snapshot before any await.
    const shorten = (deadline, publish) => {
      if (!Number.isSafeInteger(deadline)) refuse('BUDGET_DEADLINE');
      admittedDeadlineMs = Math.min(admittedDeadlineMs ?? deadline, deadline);
      if (typeof publish === 'function') publish(admittedDeadlineMs);
    };
    async function original(client, reservationId, optional = false) {
      const row = (await client.query('SELECT * FROM meri_qualification.tool_reservations WHERE invocation_id=$1', [i.invocationId])).rows[0];
      if (!row && optional) return null;
      if (!row || row.reservation_id !== reservationId || !same(row.facts, i)) refuse('RESERVATION_BINDING_MISMATCH');
      return row;
    }
    return Object.freeze({
      deadlineMs: () => admittedDeadlineMs,
      async reserve(call) {
        reservationIdCheck(call.reservationId); digest(call.argumentsSha256);
        if (!same(call.binding, i.binding) || !same(call.claims?.binding, i.binding) || call.claims.policyRevision !== i.qualificationBinding.policyRevision || !same(call.budgets, call.claims.budgets)) refuse('CAPABILITY_BINDING_MISMATCH');
        const charge = a.schedule.operations.find(item => same(item.operation, call.operation))?.chargeMicrousd;
        integer(charge); integer(call.budgets.maxCostMicrousd); integer(call.budgets.maxOutputBytes);
        if (!Number.isSafeInteger(call.deadlineMs)) refuse('INVALID_DEADLINE');
        shorten(Math.min(call.deadlineMs, Date.parse(a.schedule.expiresAt), Date.parse(call.claims.expiresAt), Date.parse(call.claims.issuedAt)+call.budgets.maxRuntimeSeconds*1000), call.limitDeadline);
        const facts = i; const operation = JSON.parse(JSON.stringify(call.operation)); const argumentsSha256 = call.argumentsSha256;
        return store.transact(async client => {
          const budget = await store.lock(client); await admit(client, i, budget, deadline => shorten(deadline, call.limitDeadline)); const installed = await storedAllocation(client, i);
          if (!(installed.started_at instanceof Date) || !Number.isFinite(installed.started_at.getTime())) refuse('BUDGET_DEADLINE');
          shorten(installed.started_at.getTime()+a.budgets.maxRuntimeSeconds*1000, call.limitDeadline);
          if (!Number.isSafeInteger(admittedDeadlineMs) || call.signal?.aborted || budget.now.getTime() >= admittedDeadlineMs) refuse('BUDGET_DEADLINE');
          const bound = (await client.query('SELECT * FROM meri_qualification.tool_grant_bindings WHERE grant_id=$1', [i.grantId])).rows[0];
          if (!bound || !same(bound.facts, grantFacts(i))) refuse('GRANT_BINDING_MISMATCH');
          if ((await client.query('SELECT * FROM meri_qualification.tool_reservations WHERE invocation_id=$1', [i.invocationId])).rows.length) refuse('INVOCATION_ALREADY_USED');
          if ((await client.query("SELECT 1 FROM meri_qualification.budget_liabilities WHERE grant_id=$1 AND state='UNKNOWN'", [i.grantId])).rows.length) refuse('UNRESOLVED_GRANT_LIABILITY');
          const totals = (await client.query("SELECT COALESCE(sum(CASE WHEN state='UNKNOWN' THEN hold_micro_usd ELSE 0 END),0) AS held, COALESCE(sum(CASE WHEN run_id=$1 THEN CASE WHEN state='UNKNOWN' THEN hold_micro_usd ELSE consumed_micro_usd END ELSE 0 END),0) AS run_total FROM meri_qualification.budget_liabilities", [i.binding.runId])).rows[0];
          const count = (await client.query('SELECT count(*) AS calls FROM meri_qualification.tool_reservations WHERE run_id=$1', [i.binding.runId])).rows[0];
          if (n(count.calls) >= n(a.budgets.maxToolCalls) || n(budget.consumed_micro_usd)+n(totals.held)+n(charge) > n(budget.cap_micro_usd) ||
              n(totals.run_total)+n(charge) > n(Math.min(a.budgets.maxCostMicroUSD, call.budgets.maxCostMicrousd))) refuse('BUDGET_EXHAUSTED');
          await client.query("INSERT INTO meri_qualification.tool_reservations(invocation_id,reservation_id,grant_id,run_id,facts,operation,arguments_sha256,hold_micro_usd,max_output_bytes,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'UNKNOWN')", [i.invocationId, call.reservationId, i.grantId, i.binding.runId, facts, operation, argumentsSha256, charge, Math.min(a.budgets.maxOutputBytes,call.budgets.maxOutputBytes)]);
          if (claim) await claim(client, call, budget);
          return receipt(call.reservationId, 'reserved');
        });
      },
      async settle({ reservationId, outcome, outputBytes }) {
        reservationIdCheck(reservationId);
        if (outcome !== 'completed' || !Number.isSafeInteger(outputBytes) || outputBytes < 0 || outputBytes > a.budgets.maxOutputBytes) refuse('INVALID_SETTLEMENT');
        return store.transact(async client => {
          const budget = await store.lock(client); const row = await original(client, reservationId);
          if (n(outputBytes) > n(row.max_output_bytes)) refuse('OUTPUT_BUDGET_EXCEEDED');
          if (row.state !== 'UNKNOWN') refuse('SETTLEMENT_ALREADY_RECORDED');
          // Fixed conservative accounting charge: no assertion about provider actual usage.
          await settleRow(client, row, outputBytes);
          return receipt(reservationId, 'settled');
        });
      },
      async markUncertain(reservationId) {
        reservationIdCheck(reservationId);
        return store.transact(async client => {
          await store.lock(client); await original(client, reservationId, true);
          // UNKNOWN already persists; SETTLED is terminal. No refund or state rewrite.
        });
      },
    });
  }
  const producer = createToolInvocationOwner({ a, store, admit, storedAllocation, makeInvocation, settleRow, now });
  function forInvocation(raw) {
    if (ownedId(invocation(raw,a).invocationId)) refuse('OWNED_INVOCATION_REQUIRED');
    return makeInvocation(raw);
  }
  return Object.freeze({ bindTrustedGrant, forInvocation, readInvocationOutcome,
    prepareInvocation: producer.prepare, forOwnedInvocation: producer.bind, reconcileInvocation: producer.reconcile });
}
