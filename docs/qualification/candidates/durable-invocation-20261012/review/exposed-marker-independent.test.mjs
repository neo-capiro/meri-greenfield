import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,requestJson,canonicalSha256,uuid,operation,NOW} from './invocation-harness.mjs';
test('general budget owner cannot offer completion writer that bypasses actual dispatcher',async()=>{
 const h=harness();await h.bind();const receipt=await h.enabledGateway().prepareInvocation(h.delivery(),requestJson);const owner=h.owner();
 if(typeof owner.forOwnedInvocation!=='function')return;
 const bound=owner.forOwnedInvocation(receipt.invocationJson,h.delivery(),requestJson);
 await bound.reserve({reservationId:uuid('7'),binding:h.f.binding,operation,argumentsSha256:canonicalSha256({page:1,limit:10}),budgets:h.f.claims.budgets,claims:h.f.claims,deadlineMs:NOW+1000});
 await bound.settle({reservationId:uuid('7'),outcome:'completed',outputBytes:4,resultSha256:'f'.repeat(64)});
 assert.equal(h.f.calls.includes('handler'),false,'no validated handler output exists');
 assert.equal(h.state().budget.consumed_micro_usd,'0','general owner must not persist invented proof and charge without canonical validation');
});
