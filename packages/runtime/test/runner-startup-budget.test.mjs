import assert from 'node:assert/strict';
import test from 'node:test';
import {runnerStartupBudget,RUNNER_LOAD_CONTROL_MARGIN_MS,READ_AVAILABILITY_CONTROL_MS,READ_AVAILABILITY_RUNNER_MS,READ_AVAILABILITY_WORKER_MS,INTENT_AVAILABILITY_WORKER_MS} from '../runner-load-budget.mjs';

test('direct SDK startup keeps independent caps and one completion allowance, not cumulative stage reservations',()=>{
 const expiry=1_000_000,budget=runnerStartupBudget({requestMs:25_000,shutdownMs:10_000,originalExpiresAtMs:expiry});
 assert.deepEqual(Object.keys(budget.stages),['bootstrap','admittedBefore','admittedAfter','load','runtime','local','starting','setup','running','session']);
 assert.equal(budget.stages.bootstrap.maxMs,23_000);
 assert.equal(budget.stages.local.maxMs,10_000);
 assert.equal(budget.stages.setup.maxMs,23_000);
 assert.deepEqual(budget.stages.load,{maxMs:46_500,attemptMs:23_000,expiresAtMs:977_000});
 for(const stage of Object.values(budget.stages)){assert.equal(stage.expiresAtMs,expiry-23_000);assert.ok(Object.isFrozen(stage));}
 assert.equal(budget.originalExpiresAtMs,expiry);
 assert.ok(Object.isFrozen(budget)&&Object.isFrozen(budget.stages));
});

test('read availability keeps one control margin per hop and, beside the intent offer, fits the setup stage',()=>{
 assert.ok(READ_AVAILABILITY_CONTROL_MS>3_000,'wider than the 3 s bound the live chain (execution authentication, two snapshots with a Core role read each) outran');
 assert.equal(READ_AVAILABILITY_RUNNER_MS,READ_AVAILABILITY_CONTROL_MS+RUNNER_LOAD_CONTROL_MARGIN_MS);
 assert.equal(READ_AVAILABILITY_WORKER_MS,READ_AVAILABILITY_RUNNER_MS+RUNNER_LOAD_CONTROL_MARGIN_MS);
 const budget=runnerStartupBudget({requestMs:25_000,shutdownMs:10_000,originalExpiresAtMs:1_000_000});
 assert.ok(READ_AVAILABILITY_WORKER_MS+INTENT_AVAILABILITY_WORKER_MS<budget.stages.setup.maxMs,'two unanswered offers leave the run its setup allowance');
});

test('idle time and local cleanup do not consume imaginary future stages or extend original expiry',()=>{
 const at=1_000_000,remaining=371_351,expiry=at+remaining;
 for(const shutdownMs of [1_000,10_000,30_000]){
  const budget=runnerStartupBudget({requestMs:25_000,shutdownMs,originalExpiresAtMs:expiry});
  assert.equal(budget.stages.bootstrap.expiresAtMs-at,remaining-23_000);
  assert.equal(budget.stages.session.expiresAtMs+budget.stages.session.maxMs,expiry);
 }
 const short=runnerStartupBudget({requestMs:25_000,shutdownMs:1_000,originalExpiresAtMs:at+23_000});
 assert.equal(short.stages.bootstrap.expiresAtMs,at,'the actual completion allowance is still required');
});

test('invalid operation inputs fail closed and existing request caps never inflate',()=>{
 for(const input of [
  {requestMs:2_000,shutdownMs:10_000,originalExpiresAtMs:1_000_000},
  {requestMs:24_999,shutdownMs:10_000,originalExpiresAtMs:1_000_000},
  {requestMs:12_000,shutdownMs:1_000,originalExpiresAtMs:1_000_000},
  {requestMs:25_000,shutdownMs:0,originalExpiresAtMs:1_000_000},
  {requestMs:25_000,shutdownMs:10_000,originalExpiresAtMs:NaN},
 ])assert.throws(()=>runnerStartupBudget(input),/RUNNER_STARTUP_BUDGET_REFUSED/u);
 const budget=runnerStartupBudget({requestMs:30_000,shutdownMs:10_000,originalExpiresAtMs:1_000_000});
 assert.equal(budget.stages.bootstrap.maxMs,23_000);assert.equal(budget.stages.load.attemptMs,23_000);
});
