/** Serial latency model from the existing capture-chain cases, extended to the P1 named hops.
 * This test does not replace capture-chain-budget.test.mjs or its composed timer cases. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_PROFILES} from '../../test/rehearsal-support.mjs';
import {HOT_PATH_BUDGET_EXCEPTIONS,budget} from '../../../../packages/runtime/hot-path-budgets.mjs';
import {testBudgetTable} from '../../../../packages/runtime/test/budget-fixture.mjs';

const DB_MS=10,RPC_IO_MS=100,S3_MS=150,ECS_MS=200,TLS_MS=50,LOCAL_MS=300;
function serialWork(profile){
 const verify=profile.identity+profile.context+4*DB_MS;
 const read=2*verify+RPC_IO_MS+3*DB_MS;
 const router=3*DB_MS+2*ECS_MS+TLS_MS;
 const session={load:read,'list-subkeys':read,append:3*verify+RPC_IO_MS+8*DB_MS,register:4*verify+router+RPC_IO_MS+4*DB_MS,snapshot:3*verify+S3_MS+9*DB_MS+RPC_IO_MS};
 const runnerCapture=2*(session['list-subkeys']+session.load)+LOCAL_MS;
 const routerCapture=runnerCapture+router,channel=routerCapture+TLS_MS;
 const controlCapture=2*verify+8*DB_MS+channel+(4*verify+2*8*DB_MS+S3_MS+S3_MS)+5*DB_MS+verify;
 // load/publish each perform 16 identity/context pairs (32 Core calls); fixed work is the existing 1.3 s model envelope.
 const load=16*(profile.identity+profile.context)+1300;
 // One owner reserve does 13 identity/context pairs plus four pair proofs (ECS+EC2 each).
 // Pair proof model keeps the observed quiet/median/tail 0.2/0.6/1 s provider profiles distinct from Core latency.
 const provider=profile===CORE_PROFILES.quiet?200:profile===CORE_PROFILES['live-median']?600:1000;
 const owner=13*verify+8*provider;
 // A full event window repeats 32 authority rounds; one round is the same verify operation used above.
 const events=32*verify;
 return {...Object.fromEntries(Object.entries(session).map(([name,ms])=>['runner.session.'+name,ms])),
  'runner.session.store':session.load+session.append,'runner.stage.local':session.snapshot,
  'runner.capture':runnerCapture,'router.capture':routerCapture,'control.capture.channel':channel,
  'control.capture':controlCapture,'runner.checkpoint.complete':controlCapture+RPC_IO_MS,
  'runner.call.load':load,'runner.call.publish':load,'proxy.exchange.max':owner,'conversation.events.subscription':events};
}

test('quiet, median and tail serial work has 1.5 times allowance or an exact phase-owned exception',()=>{
 const exceptions=HOT_PATH_BUDGET_EXCEPTIONS.filter(row=>row.rule==='tail-margin'),byHop=new Map(exceptions.map(row=>[row.hop,row]));
 const observed=new Set();
 for(const[name,profile]of Object.entries(CORE_PROFILES))for(const[hop,workMs]of Object.entries(serialWork(profile))){
  const allowance=budget(testBudgetTable,hop),adequate=allowance>=1.5*workMs;
  if(!adequate){const exception=byHop.get(hop);assert.ok(exception,`${name} ${hop}: ${allowance} ms < 1.5 × ${workMs} ms`);assert.match(exception.removedBy,/^P[1-6]$/);observed.add(hop);}
 }
 assert.deepEqual([...observed].sort(),[...byHop.keys()].sort(),'A tail exception that no longer violates must be removed.');
});

test('the extended model retains the original capture-chain quiet and tail values',()=>{
 const quiet=serialWork(CORE_PROFILES.quiet),tail=serialWork(CORE_PROFILES['live-tail']);
 assert.equal(quiet['runner.capture'],3820);assert.equal(tail['runner.capture'],8340);
 assert.equal(quiet['control.capture'],7565);assert.equal(tail['control.capture'],16040);
 assert.equal(tail['runner.call.load'],15700);
 assert.equal(tail['runner.checkpoint.complete'],16140);
 assert.ok(tail['proxy.exchange.max']>budget(testBudgetTable,'proxy.exchange.max'));
});
