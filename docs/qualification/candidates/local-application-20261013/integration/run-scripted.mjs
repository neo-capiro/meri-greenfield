/** Reproduce the reviewed application composition using its explicit scripted pool. */
import assert from 'node:assert/strict';
import {createLocalApplicationCase} from '../../../../../apps/control/action-host/local-integration/case.mjs';
import {runLocalApplication} from '../../../../../apps/control/action-host/local-integration/run.mjs';
import {createSharedPool} from '../../../../../apps/control/action-host/local-integration/test-pool.mjs';

const pool = createSharedPool();
const deadlineMs = Date.now() + 25000;
const caseOwner = createLocalApplicationCase({mode:'synthetic-local', deadlineMs});
let result;
try {
  await caseOwner.setup({pool:pool.pool});
  result = await runLocalApplication({caseOwner,initialPool:pool.pool,openFreshPool:pool.fresh,deadlineMs});
  assert.equal(result.accounting.chargedMicroUsd,'20');
  assert.equal(pool.h.state().budget.consumed_micro_usd,'20');
  assert.equal(caseOwner.stats().sourceReads,1);
  assert.equal(caseOwner.stats().taskEffects,1);
  assert.deepEqual(pool.stats(),{opened:2,closed:2});
} finally {
  caseOwner.close();
}
assert.equal(caseOwner.stats().closed,true);
console.log(JSON.stringify({status:'PASS',poolEvidence:'scripted-shared-state',nativeDatabase:false,
  receiver:result.receiver,chargedMicroUsd:result.accounting.chargedMicroUsd,
  allocations:result.accounting.allocations,grants:result.accounting.grants,
  reservations:result.accounting.reservations,stats:caseOwner.stats(),freshPools:pool.stats(),
  listeners:result.recovery.cleanup.listeners,productionActivated:false}));
