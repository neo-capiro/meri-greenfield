/** SYNTHETIC: Core's DRAFT rev 3 issuance route answered by a fake Fetch that signs with the synthetic production key. Exercises
 * the Meri adapter only: the rev 3 request body, correlation (budgets, allocation digest, qualification), fresh current-decision
 * observation, local stamping, signed-time handling and the grant installation that precedes every receipt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {productFailure} from '../../../control/product-access/errors.mjs';
import {compileExecutionTrust} from '../execution-capability.mjs';
import {createCoreExecutionIssuance,CORE_EXECUTION_ROUTE} from '../execution-issuance.mjs';
import {productionToken,productionTrust,admittedSet,ISSUED_AT,RUN_BINDING,BUDGETS,POLICY_REVISION,QUALIFICATION} from './execution-capability-fixture.mjs';
const ORIGIN='https://core.example.test';
const code=c=>e=>e?.code===c||productFailure(e)?.code===c;
/** The run's admitted allocation: the one the synthetic Core signs the budgets and allocation digest from. */
const allocation=admittedSet().allocation;
function harness({token=productionToken('clientAndDueDate'),decision,start=ISSUED_AT*1000+200,coreChecked=1,executor,respond,install}={}){
 const s={t:start,requests:[],decisions:0,sleeps:[],credentials:[],installs:[]};const now=()=>s.t;
 const current=()=>JSON.stringify({binding:RUN_BINDING,policyRevision:POLICY_REVISION,deadlineMs:start+600000,checkedAtMs:s.t,allocation,allocationSha256:hash(allocation)});
 const issuance=createCoreExecutionIssuance({origin:ORIGIN,trust:compileExecutionTrust(productionTrust()),now,
  sleep:async ms=>{s.sleeps.push(ms);s.t+=ms;},
  getCredentials:async v=>{s.credentials.push(v);return {tenantId:v.tenantId,actorId:v.actorId,bearerToken:'native-session-token',serviceSecret:'service-secret',expiresAtMs:s.t+300000};},
  executorFor:async({proposal})=>executor?executor(proposal):{binding:RUN_BINDING,currentAllocationJson:current(),qualification:QUALIFICATION},
  installGrant:async v=>{s.installs.push({...v,at:s.t,requests:s.requests.length,decisions:s.decisions});if(install)return install(v);},
  readDecision:async()=>{s.decisions++;return decision===undefined?token.decision:decision;},
  fetchImpl:async(url,init)=>{s.requests.push({url,init,body:JSON.parse(init.body)});s.t+=40;
   if(respond)return respond(url,init);
   return new Response(JSON.stringify({execution:token.execution,credential:token.credential,checkedAtMs:coreChecked,expiresAtMs:(ISSUED_AT+120)*1000}),{status:200,headers:{'content-type':'application/json'}});}});
 const issue=(extra={})=>issuance.issueExecution({proposal:token.proposal,principal:{tenantId:RUN_BINDING.tenantId,actorId:RUN_BINDING.actorId,role:'standard_user',permissions:[],clientIds:[],membershipRevision:'m1'},...extra});
 return {s,issue,token};
}
test('issues against the draft route with exact executor binding, deterministic request id, the authenticated allocation, its digest, the qualification, the run deadline and approver credentials',async()=>{
 const {s,issue,token}=harness(),started=s.t,receipt=await issue();
 assert.equal(s.requests.length,1);const r=s.requests[0];
 assert.equal(r.url,ORIGIN+CORE_EXECUTION_ROUTE);assert.equal(r.init.method,'POST');assert.equal(r.init.redirect,'error');
 assert.equal(r.init.headers.authorization,'Bearer native-session-token');assert.equal(r.init.headers['x-internal-service-secret'],'service-secret');
 assert.deepEqual(Object.keys(r.body),['proposal','executorBinding','requestId','allocation','allocationSha256','qualification','runDeadlineMs']);
 assert.deepEqual(r.body.executorBinding,RUN_BINDING);assert.equal(r.body.requestId,token.requestId);assert.deepEqual(r.body.allocation,allocation);assert.equal(r.body.allocationSha256,hash(allocation));
 assert.deepEqual(r.body.qualification,QUALIFICATION);assert.equal(r.body.runDeadlineMs,started+600000);assert.deepEqual(JSON.parse(Buffer.from(receipt.credential.split('.')[1],'base64url').toString()).capability.budgets,BUDGETS);
 // The grant was installed from the verified token, for the executor binding, after the correlated response and the fresh decision.
 assert.equal(s.installs.length,1);assert.equal(s.installs[0].verified.credentialSha256,createHash('sha256').update(token.credential).digest('hex'));
 assert.deepEqual(s.installs[0].executorBinding,RUN_BINDING);assert.equal(s.installs[0].requests,1);assert.equal(s.installs[0].decisions,1);assert.ok(receipt.checkedAtMs>=s.installs[0].at);
 assert.deepEqual(s.credentials.map(c=>[c.tenantId,c.actorId,c.purpose]),[[RUN_BINDING.tenantId,RUN_BINDING.actorId,'approval.execution']]);
 assert.equal(hash(receipt.execution),hash(token.execution));assert.equal(receipt.credential,token.credential);
 // Local stamp after the correlated response and the fresh decision read; Core's own checkedAtMs (1) is never used.
 assert.equal(receipt.checkedAtMs,s.t);assert.ok(receipt.checkedAtMs>=started+40);assert.equal(s.decisions,1);
 assert.equal(receipt.expiresAtMs,(ISSUED_AT+120)*1000);
});
test('an idempotent replay of the same immutable token is accepted only with a fresh current-decision observation, and re-installs the same grant idempotently',async()=>{
 const {s,issue}=harness(),first=await issue();s.t+=5000;const second=await issue();
 assert.equal(second.credential,first.credential);assert.equal(s.decisions,2);assert.ok(second.checkedAtMs>first.checkedAtMs);
 assert.equal(s.requests[0].body.requestId,s.requests[1].body.requestId);
 assert.equal(s.installs.length,2);assert.equal(s.installs[0].verified.credentialSha256,s.installs[1].verified.credentialSha256);
});
test('no receipt without the installed grant: a conflicting install is EXECUTION_GRANT_REFUSED, an unavailable owner is EXECUTION_OWNER_UNAVAILABLE',async()=>{
 for(const [thrown,expected] of [[Object.assign(Error('EXECUTION_GRANT_CONFLICT'),{code:'EXECUTION_GRANT_CONFLICT'}),'EXECUTION_GRANT_REFUSED'],[Error('EXECUTION_GRANT_REVOKED'),'EXECUTION_GRANT_REFUSED'],[Error('BUDGET_STATE_UNAVAILABLE'),'EXECUTION_OWNER_UNAVAILABLE'],[new TypeError('down'),'EXECUTION_OWNER_UNAVAILABLE']]){
  const h=harness({install:()=>{throw thrown;}});await assert.rejects(h.issue(),code(expected),String(thrown.message));assert.equal(h.s.installs.length,1);
 }
 // A token whose qualification or allocation digest is not the admitted run's never reaches the installer.
 const foreign=productionToken('clientAndDueDate',{qualification:{...QUALIFICATION,attempt:2}});
 const h=harness({token:foreign});await assert.rejects(h.issue(),code('EXECUTION_CAPABILITY_MISMATCH'));assert.equal(h.s.installs.length,0);
 const other=harness({executor:()=>({binding:RUN_BINDING,currentAllocationJson:JSON.stringify({binding:RUN_BINDING,policyRevision:POLICY_REVISION,deadlineMs:ISSUED_AT*1000+600000,checkedAtMs:ISSUED_AT*1000+200,allocation,allocationSha256:hash(allocation)}),qualification:{...QUALIFICATION,fence:2}})});
 await assert.rejects(other.issue(),code('EXECUTION_OWNER_UNAVAILABLE'));assert.equal(other.s.requests.length,0);
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
