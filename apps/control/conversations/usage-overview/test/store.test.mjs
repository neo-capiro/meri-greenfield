import test from 'node:test';import assert from 'node:assert/strict';
import {createUsageOverviewStore,projectUsageOverview,usagePeriods} from '../store.mjs';
import {productFailure} from '../../../product-access/errors.mjs';
import {assertUsageOverviewResponse} from '../../../../../packages/contracts/conversation-usage/overview-validate.mjs';
import {at,principal,facts,response,poolFixture} from './fixture.mjs';

test('UTC day, ISO week and calendar month boundaries cover leap/year transitions independently',()=>{
 const periods=usagePeriods(Date.parse('2024-03-01T00:00:00.000Z'));
 assert.equal(periods[1].startInclusive,'2024-02-26T00:00:00.000Z');assert.equal(periods[2].endExclusive,'2024-04-01T00:00:00.000Z');
 assert.equal(usagePeriods(Date.parse('2027-01-01T23:59:59.000Z'))[1].startInclusive,'2026-12-28T00:00:00.000Z');
 assert.equal(usagePeriods(Date.parse('2026-11-02T00:00:00.000Z'))[1].startInclusive,'2026-11-02T00:00:00.000Z');
 assert.throws(()=>usagePeriods(NaN));assert.throws(()=>usagePeriods(at+0.5));
});
test('partial/failed/cancelled denominators remain distinct from complete jobs and the admission-month ledger',()=>{
 const value=assertUsageOverviewResponse(response()),month=value.periods[2];
 assert.equal(month.attempts,4);assert.equal(month.states.failed,1);assert.equal(month.states.cancelled,1);
 assert.deepEqual(month.recording,{recorded:2,unavailable:1,notRecorded:1});assert.equal(month.completedAttemptsWithRecordedUsage,2);
 assert.equal(month.knownChargeMicroUsd,50);assert.equal(value.monthlyAdmission.knownChargeMicroUsd,80);assert.equal(value.monthlyAdmission.remainingKnownMicroUsd,20);
 assert.equal(value.coverage.completeJobCost,'unavailable');assert.equal(value.queue.availableCapacity,null);assert.equal(value.queue.physicalConcurrency,null);
 assert.doesNotMatch(JSON.stringify(value),/synthetic-tenant|synthetic-actor|conversationId|clientId|runId/);
});
test('empty known zero, absent policy and a reached cap do not invent configured budget or zero unknown costs',()=>{
 const empty=response({rows:[],currentRows:[],ledgerRows:[{charge:'0',unavailable:'0'}],policyRows:[]});
 assert.equal(empty.periods[0].attempts,0);assert.equal(empty.policy.status,'unavailable');assert.equal(empty.monthlyAdmission.reached,null);
 assert.equal(response({policyRows:[{revision:1,monthly_cap_micro_usd:null}]}).policy.status,'unavailable');
 const reached=response({ledgerRows:[{charge:'120',unavailable:'2'}]});assert.equal(reached.monthlyAdmission.reached,true);assert.equal(reached.monthlyAdmission.remainingKnownMicroUsd,0);assert.equal(reached.monthlyAdmission.unavailableRecordedAttempts,2);
});
test('malformed, unsafe, duplicated and contradictory canonical aggregates fail closed',()=>{
 for(const change of [f=>f.rows[0].charge='-1',f=>f.rows[0].attempts='9007199254740992',f=>f.rows[0].state='invented',f=>f.rows[0].recording='estimated',
  f=>f.rows.push(f.rows[0]),f=>f.rows[2].charge='1',f=>f.rows[0].attempts='0',f=>f.currentRows.push({state:'completed',attempts:'1'}),
  f=>f.ledgerRows=[],f=>f.policyRows[0].revision='0',f=>f.policyRows[0].monthly_cap_micro_usd='0',f=>f.policyRows[0].sdk_max_turns=101,
  f=>{f.rows[0].attempts='9007199254740991';f.rows.push({period:'day',state:'failed',recording:'not-recorded',attempts:'1',charge:'0'});}]){
  const f=facts();change(f);assert.throws(()=>projectUsageOverview(f),/USAGE_OVERVIEW_CORRUPT/);
 }
});
test('store borrows one repeatable-read read-only transaction and binds every aggregate to the admitted tenant',async()=>{
 const f=poolFixture(),store=createUsageOverviewStore({pool:f.pool,now:()=>at});let checks=0;
 assert.deepEqual(await store.read({principal},()=>checks++),response());assert(checks>=4);
 const calls=f.state.calls;assert.equal(calls[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(calls.at(-1).sql,'COMMIT');
 const reads=calls.filter(c=>/^(WITH|SELECT)/.test(c.sql));assert.equal(reads.length,4);assert(reads.every(c=>c.args[0]===principal.tenantId));
 assert.equal(reads[0].args[1],new Date(at).toISOString());assert.equal(reads[0].args.length,11);assert.deepEqual(f.state.releases,[undefined]);
 assert(calls.every(c=>!/^(INSERT|UPDATE|DELETE)/.test(c.sql)));
});
test('aborted reads roll back, uncertain COMMIT remains unavailable UNKNOWN and a fresh reader has no cached principal',async()=>{
 const f=poolFixture();f.state.beforeQuery=sql=>{if(sql.startsWith('WITH'))throw Error('synthetic read failure');};
 await assert.rejects(createUsageOverviewStore({pool:f.pool,now:()=>at}).read({principal},()=>{}),/USAGE_OVERVIEW_UNAVAILABLE/);assert.equal(f.state.calls.at(-1).sql,'ROLLBACK');
 const uncertain=poolFixture();uncertain.state.beforeQuery=sql=>{if(sql==='COMMIT')throw Error('synthetic disconnect');};
 await assert.rejects(createUsageOverviewStore({pool:uncertain.pool,now:()=>at}).read({principal},()=>{}),e=>productFailure(e)?.code==='USAGE_OVERVIEW_UNAVAILABLE'&&productFailure(e)?.outcome==='UNKNOWN');assert(uncertain.state.releases[0]);
 const fresh=poolFixture();await createUsageOverviewStore({pool:fresh.pool,now:()=>at}).read({principal:{...principal,tenantId:'other-tenant'}},()=>{});
 assert(fresh.state.calls.filter(c=>c.args).every(c=>c.args[0]==='other-tenant'));
});
