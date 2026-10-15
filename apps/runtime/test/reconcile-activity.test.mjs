/** Synthetic native port: the workflow's reconcile activity repeats only the original's independent stop. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createReconcileActivity} from '../temporal-worker.mjs';
import {binding} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
function native(reply){const calls=[];return {calls,async call(operation,input,{signal}){calls.push({operation,input});assert.ok(signal instanceof AbortSignal);return reply(input,signal);}};}
test('reconciliation calls only execution/kickoff/stop for the exact original and never starts or kicks off',async()=>{
 const n=native(input=>({binding:input.binding,executionId:input.executionId,expiresAtMs:Date.now()+1000}));
 assert.deepEqual(await createReconcileActivity({native:n})({binding}),{state:'reconciled'});assert.deepEqual(n.calls,[{operation:'execution/kickoff/stop',input:{binding,executionId:hash(binding)}}]);});
test('a mismatched or missing stop receipt and an unavailable owner are UNKNOWN',async()=>{
 for(const reply of [input=>({binding:{...input.binding,attemptId:'00000000-0000-4000-8000-000000000999'},executionId:input.executionId,expiresAtMs:1}),input=>({binding:input.binding,executionId:'f'.repeat(64),expiresAtMs:1}),()=>{throw Error('KICKOFF_UNKNOWN');}])
  await assert.rejects(createReconcileActivity({native:native(reply)})({binding}),/BROKER_RECONCILE_UNKNOWN|KICKOFF_UNKNOWN/);});
test('the stop is bounded: a stalled owner is abandoned at the deadline as UNKNOWN',async()=>{
 const n=native((input,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
 await assert.rejects(createReconcileActivity({native:n,timeoutMs:30})({binding}),/BROKER_RECONCILE_UNKNOWN/);assert.throws(()=>createReconcileActivity({native:n,timeoutMs:0}),/BROKER_CONFIGURATION/);});
