/** SYNTHETIC: Core's DRAFT issuance route answered by a fake Fetch that signs with the synthetic production key. Exercises the
 * Meri adapter only: correlation, exact budgets, fresh current-decision observation, local stamping and signed-time handling. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {productFailure} from '../../../control/product-access/errors.mjs';
import {compileExecutionTrust} from '../execution-capability.mjs';
import {createCoreExecutionIssuance,CORE_EXECUTION_ROUTE} from '../execution-issuance.mjs';
import {productionToken,productionTrust,ISSUED_AT,RUN_BINDING,BUDGETS,POLICY_REVISION} from './execution-capability-fixture.mjs';
const ORIGIN='https://core.example.test';
const code=c=>e=>e?.code===c||productFailure(e)?.code===c;
const allocation={run:{tenantId:RUN_BINDING.tenantId,actorId:RUN_BINDING.actorId,conversationId:RUN_BINDING.conversationId,runId:RUN_BINDING.runId},
 budgets:{maxTurns:3,maxToolCalls:1,maxRecoveryAttempts:0,maxRuntimeSeconds:900,maxCostMicroUSD:2000000,maxOutputBytes:262144},
 schedule:{revision:'d'.repeat(64),expiresAt:'2026-10-18T15:00:00.000Z',operations:[{operation:{id:'create_task',version:'0.2.0'},chargeMicrousd:1000}]}};
function harness({token=productionToken('clientAndDueDate'),decision,start=ISSUED_AT*1000+200,coreChecked=1,executor,respond}={}){
 const s={t:start,requests:[],decisions:0,sleeps:[],credentials:[]};const now=()=>s.t;
 const current=()=>JSON.stringify({binding:RUN_BINDING,policyRevision:POLICY_REVISION,deadlineMs:start+600000,checkedAtMs:s.t,allocation,allocationSha256:hash(allocation)});
 const issuance=createCoreExecutionIssuance({origin:ORIGIN,trust:compileExecutionTrust(productionTrust()),now,
  sleep:async ms=>{s.sleeps.push(ms);s.t+=ms;},
  getCredentials:async v=>{s.credentials.push(v);return {tenantId:v.tenantId,actorId:v.actorId,bearerToken:'native-session-token',serviceSecret:'service-secret',expiresAtMs:s.t+300000};},
  executorFor:async({proposal})=>executor?executor(proposal):{binding:RUN_BINDING,currentAllocationJson:current()},
  readDecision:async()=>{s.decisions++;return decision===undefined?token.decision:decision;},
  fetchImpl:async(url,init)=>{s.requests.push({url,init,body:JSON.parse(init.body)});s.t+=40;
   if(respond)return respond(url,init);
   return new Response(JSON.stringify({execution:token.execution,credential:token.credential,checkedAtMs:coreChecked,expiresAtMs:(ISSUED_AT+120)*1000}),{status:200,headers:{'content-type':'application/json'}});}});
 const issue=(extra={})=>issuance.issueExecution({proposal:token.proposal,principal:{tenantId:RUN_BINDING.tenantId,actorId:RUN_BINDING.actorId,role:'standard_user',permissions:[],clientIds:[],membershipRevision:'m1'},...extra});
 return {s,issue,token};
}
test('issues against the draft route with exact executor binding, deterministic request id, allocation budgets and approver credentials',async()=>{
 const {s,issue,token}=harness(),started=s.t,receipt=await issue();
 assert.equal(s.requests.length,1);const r=s.requests[0];
 assert.equal(r.url,ORIGIN+CORE_EXECUTION_ROUTE);assert.equal(r.init.method,'POST');assert.equal(r.init.redirect,'error');
 assert.equal(r.init.headers.authorization,'Bearer native-session-token');assert.equal(r.init.headers['x-internal-service-secret'],'service-secret');
 assert.deepEqual(Object.keys(r.body),['proposal','executorBinding','requestId','budgets','allocationSha256']);
 assert.deepEqual(r.body.executorBinding,RUN_BINDING);assert.equal(r.body.requestId,token.requestId);assert.deepEqual(r.body.budgets,BUDGETS);assert.equal(r.body.allocationSha256,hash(allocation));
 assert.deepEqual(s.credentials.map(c=>[c.tenantId,c.actorId,c.purpose]),[[RUN_BINDING.tenantId,RUN_BINDING.actorId,'approval.execution']]);
 assert.equal(hash(receipt.execution),hash(token.execution));assert.equal(receipt.credential,token.credential);
 // Local stamp after the correlated response and the fresh decision read; Core's own checkedAtMs (1) is never used.
 assert.equal(receipt.checkedAtMs,s.t);assert.ok(receipt.checkedAtMs>=started+40);assert.equal(s.decisions,1);
 assert.equal(receipt.expiresAtMs,(ISSUED_AT+120)*1000);
});
test('an idempotent replay of the same immutable token is accepted only with a fresh current-decision observation',async()=>{
 const {s,issue}=harness(),first=await issue();s.t+=5000;const second=await issue();
 assert.equal(second.credential,first.credential);assert.equal(s.decisions,2);assert.ok(second.checkedAtMs>first.checkedAtMs);
 assert.equal(s.requests[0].body.requestId,s.requests[1].body.requestId);
});
test('a revoked, changed or rejected current decision refuses the token before any receipt',async()=>{
 const base=productionToken('clientAndDueDate');
 for(const decision of [null,{...base.decision,decidedAt:'2026-10-18T14:01:42.000Z'},{...base.decision,decision:'rejected'}])
  await assert.rejects(harness({token:base,decision}).issue(),code('EXECUTION_CAPABILITY_MISMATCH'));
});
test('budgets below the allocation, another request id or executor binding, and a stale token are refused',async()=>{
 await assert.rejects(harness({token:productionToken('clientAndDueDate',{budgets:{...BUDGETS,maxCostMicrousd:1}})}).issue(),code('EXECUTION_CAPABILITY_MISMATCH'));
 const other=productionToken('clientAndDueDate',{executorBinding:{...RUN_BINDING,attemptId:'00000000-0000-4000-8000-000000000003'}});
 await assert.rejects(harness({token:{...other,proposal:productionToken('clientAndDueDate').proposal}}).issue(),code('EXECUTION_CAPABILITY_MISMATCH'));
 await assert.rejects(harness({start:(ISSUED_AT+120)*1000}).issue(),e=>['EXECUTION_CAPABILITY_REFUSED','EXECUTION_OWNER_UNAVAILABLE'].some(c=>code(c)(e)));
});
test('signed iat ahead of this clock: a bounded wait within skew, a refusal beyond it',async()=>{
 const ahead=harness({start:ISSUED_AT*1000-500}),receipt=await ahead.issue();
 assert.ok(ahead.s.sleeps.length===1&&ahead.s.sleeps[0]>0&&ahead.s.sleeps[0]<=500);assert.ok(receipt.checkedAtMs>=ISSUED_AT*1000);
 await assert.rejects(harness({start:ISSUED_AT*1000-5000}).issue(),code('EXECUTION_CAPABILITY_REFUSED'));
});
test('Core unreachable or refusing, a foreign run, or a non-approver principal never yields a receipt',async()=>{
 await assert.rejects(harness({respond:async()=>{throw Error('down');}}).issue(),code('EXECUTION_OWNER_UNAVAILABLE'));
 await assert.rejects(harness({respond:async()=>new Response('{"error":"refused"}',{status:409,headers:{'content-type':'application/json'}})}).issue(),code('EXECUTION_OWNER_UNAVAILABLE'));
 await assert.rejects(harness({executor:()=>({binding:{...RUN_BINDING,runId:'00000000-0000-4000-8000-000000000002'},currentAllocationJson:'{}'})}).issue(),code('EXECUTION_OWNER_UNAVAILABLE'));
 const h=harness();await assert.rejects(h.issue({principal:{tenantId:RUN_BINDING.tenantId,actorId:'user_other'}}),code('EXECUTION_CAPABILITY_MISMATCH'));assert.equal(h.s.requests.length,0);
});
