/** Synthetic native transport: the operator re-entry repeats only the exact original's independent stop, once. */
import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileRun,main} from '../reconcile-run.mjs';
import {binding} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
const configuration={native:{origin:'https://control.synthetic.invalid',capabilityFile:'/run/secrets/control',loopback:false,maxResponseBytes:2097152}};
function transport(reply){const calls=[];return {calls,async fetch(url,init){calls.push({url,body:JSON.parse(init.body),authorization:init.headers.authorization});return reply(JSON.parse(init.body));}};}
test('operator re-entry sends one execution/kickoff/stop for the exact binding and reports reconciliation',async()=>{
 const t=transport(input=>Response.json({binding:input.binding,executionId:input.executionId,expiresAtMs:Date.now()+1000}));
 assert.deepEqual(await reconcileRun({configuration,credential:'synthetic-control',binding,fetch:t.fetch}),{state:'reconciled'});
 assert.deepEqual(t.calls,[{url:'https://control.synthetic.invalid/v1/execution/kickoff/stop',body:{binding,executionId:hash(binding)},authorization:'Bearer synthetic-control'}]);});
test('an UNKNOWN stop stays a failure; malformed arguments never call the control owner',async()=>{
 const t=transport(()=>Response.json({error:{code:'KICKOFF_UNKNOWN'}},{status:503}));await assert.rejects(reconcileRun({configuration,credential:'synthetic-control',binding,fetch:t.fetch}));assert.equal(t.calls.length,1);
 const u=transport(()=>assert.fail('no call'));for(const argv of [[],['--config','/x.json'],['--binding','/b.json','--config','/x.json']])assert.equal(await main(argv,{fetch:u.fetch}),2);
 assert.equal(await main(['--config','/nonexistent/meri.json','--binding','/nonexistent/binding.json'],{fetch:u.fetch}),2);assert.equal(u.calls.length,0);});
