import assert from 'node:assert/strict';
import test from 'node:test';
import {
 RUNNER_STARTUP_STAGE_ORDER,runnerStartupBudget,runnerLoadBudget,
} from '../runner-load-budget.mjs';

test('startup stages retain their own cap and all later caps before settlement',()=>{
 const expiry=1_000_000;
 const budget=runnerStartupBudget({requestMs:25_000,shutdownMs:10_000,originalExpiresAtMs:expiry});
 assert.equal(budget.reserveMs,302_000,'completion, catch cleanup, four terminal attempts, Browser cleanup, and three shutdown steps remain');
 assert.deepEqual(RUNNER_STARTUP_STAGE_ORDER,[
  'bootstrap','admittedBefore','admittedAfter','load','runtime','local',
  'starting','setup','running','nativePrepare','nativeStart','session',
 ]);
 assert.equal(budget.stages.bootstrap.maxMs,23_000);
 assert.equal(budget.stages.local.maxMs,3_000);
 assert.equal(budget.stages.setup.maxMs,23_000);
 assert.deepEqual(budget.stages.load,{maxMs:23_000,expiresAtMs:expiry-466_000});
 assert.equal(budget.stages.session.expiresAtMs,expiry-budget.reserveMs);
 for(let i=0;i<RUNNER_STARTUP_STAGE_ORDER.length-1;i++){
  const current=budget.stages[RUNNER_STARTUP_STAGE_ORDER[i]];
  const next=budget.stages[RUNNER_STARTUP_STAGE_ORDER[i+1]];
  assert.equal(next.expiresAtMs-current.expiresAtMs,next.maxMs);
 }
 assert.equal(budget.stages.bootstrap.expiresAtMs-budget.stages.bootstrap.maxMs,
  expiry-budget.reserveMs-256_000);
 assert.ok(Object.isFrozen(budget)&&Object.isFrozen(budget.stages)&&Object.isFrozen(budget.stages.load));
 assert.deepEqual(runnerLoadBudget({requestMs:25_000,shutdownMs:10_000,originalExpiresAtMs:expiry}),budget.stages.load);
});

test('the original lease and short control request only tighten the startup schedule',()=>{
 const expiry=1_000_000;
 const short=runnerStartupBudget({requestMs:12_000,shutdownMs:1_000,originalExpiresAtMs:expiry});
 assert.equal(short.reserveMs,302_000,'three ten-second shutdown steps still apply');
 assert.equal(short.stages.load.maxMs,10_000);
 assert.equal(short.stages.session.maxMs,10_000);
 assert.equal(short.stages.bootstrap.expiresAtMs-short.stages.bootstrap.maxMs,expiry-428_000);
 const largeShutdown=runnerStartupBudget({requestMs:25_000,shutdownMs:30_000,originalExpiresAtMs:expiry});
 assert.equal(largeShutdown.reserveMs,362_000);
 assert.equal(largeShutdown.stages.session.expiresAtMs,expiry-362_000);
 const shortLease=runnerStartupBudget({requestMs:25_000,shutdownMs:10_000,originalExpiresAtMs:100_000});
 assert.ok(shortLease.stages.bootstrap.expiresAtMs-shortLease.stages.bootstrap.maxMs<0,
  'a short original lease yields an expired stage rather than extending authority');
});

test('invalid stage inputs fail closed',()=>{
 for(const input of [
  {requestMs:2_000,shutdownMs:10_000,originalExpiresAtMs:1_000_000},
  {requestMs:25_000,shutdownMs:0,originalExpiresAtMs:1_000_000},
  {requestMs:25_000,shutdownMs:10_000,originalExpiresAtMs:NaN},
 ])assert.throws(()=>runnerStartupBudget(input),/RUNNER_STARTUP_BUDGET_REFUSED/u);
 assert.throws(()=>runnerLoadBudget({requestMs:NaN,shutdownMs:10_000,originalExpiresAtMs:1_000_000}),
  /RUNNER_LOAD_BUDGET_REFUSED/u);
});
