import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserExecutionPrerequisite,BROWSER_NEED} from '../browser-execution-prerequisite.mjs';
import {HELD_BROWSER_ACTIVATION,BROWSER_ACTIVATION_RENDER_VERIFICATION,EGRESS_REQUIREMENTS_SHA256,compileBrowserActivation} from '../../worker/conversation/browser/activation.mjs';

const binding={tenantId:'t',actorId:'a',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002',
 attemptId:'00000000-0000-4000-8000-000000000003',workerId:'00000000-0000-4000-8000-000000000004',writerFence:1};
const OPEN=compileBrowserActivation({state:'open',evidence:'docs/qualification/browser-egress/EVIDENCE.md',evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256,
 renderVerification:{schema:BROWSER_ACTIVATION_RENDER_VERIFICATION,sourceCommit:'0'.repeat(40),renderedAtMs:1,evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256}});
const ready=over=>({status:'ready',binding,generation:1,ownerInstanceId:'00000000-0000-4000-8000-000000000009',leaseDeadlineMs:Date.now()+60000,currentUntilMs:Date.now()+60000,recordSha256:'b'.repeat(64),...over});
const ENABLED={enabled:true},DISABLED={enabled:false};
const owner=({activation=OPEN,answers=[ready()],policies=[ENABLED],requestTimeoutMs=1000,effectTimeoutMs=2000}={})=>{
 let reads=0,policyReads=0;const allocations={async ready(input){assert.deepEqual(input.binding,binding);assert.ok(input.signal instanceof AbortSignal);const a=answers[Math.min(reads,answers.length-1)];reads++;return typeof a==='function'?a():a;}};
 const policy={async read(input){assert.deepEqual(input.binding,binding);assert.ok(input.signal instanceof AbortSignal);assert.ok(Number.isSafeInteger(input.deadlineMs));const v=policies[Math.min(policyReads,policies.length-1)];policyReads++;return typeof v==='function'?v():v;}};
 return {reads:()=>reads,policyReads:()=>policyReads,p:createBrowserExecutionPrerequisite({allocations,activation,policy,now:Date.now,requestTimeoutMs,effectTimeoutMs})};
};

test('a held activation is an explicit none for need and readiness without touching the policy or the allocation reader',async()=>{
 const {p,reads,policyReads}=owner({activation:HELD_BROWSER_ACTIVATION});
 assert.deepEqual(await p.need({binding}),{kind:'none'});
 assert.deepEqual(await p.ready({binding,deadlineMs:Date.now()+5000}),{status:'none'});
 assert.equal(reads(),0);assert.equal(policyReads(),0);
});
test('a run whose resolved policy has the browser off gets no host: none for need and readiness, no allocation read',async()=>{
 const {p,reads,policyReads}=owner({policies:[DISABLED]});
 assert.deepEqual(await p.need({binding}),{kind:'none'});
 assert.deepEqual(await p.ready({binding,deadlineMs:Date.now()+5000}),{status:'none'});
 assert.equal(reads(),0);assert.equal(policyReads(),2);
});
test('a failed or malformed policy read refuses instead of deciding either way',async()=>{
 for(const policies of [[()=>{throw Error('CORE_UNAVAILABLE');}],[{enabled:'yes'}],[null]])
  await assert.rejects(owner({policies}).p.need({binding}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'},JSON.stringify(policies[0]?.toString?.()));
 const slow=createBrowserExecutionPrerequisite({allocations:{ready:async()=>ready()},policy:{read:()=>new Promise(()=>{})},activation:OPEN,now:Date.now,requestTimeoutMs:20,effectTimeoutMs:2000});
 await assert.rejects(slow.need({binding}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
});
test('an open activation with an enabled policy needs a browser-only host; readiness polls absent and not-ready until the host is ready',async()=>{
 const {p,reads}=owner({answers:[{status:'absent'},{status:'not-ready',state:'dispatching',generation:1,leaseDeadlineMs:Date.now()+60000},ready()]});
 assert.deepEqual(await p.need({binding}),BROWSER_NEED);assert.equal(BROWSER_NEED.hostMode,'browser-only');
 const result=await p.ready({binding,deadlineMs:Date.now()+5000});
 assert.equal(result.status,'ready');assert.equal(result.generation,1);assert.ok(result.currentUntilMs<=result.leaseDeadlineMs);assert.equal(reads(),3);
});
test('ready refuses an unknown status, an expired receipt, a missing generation and an elapsed deadline',async()=>{
 for(const answers of [[{status:'ready?'}],[ready({currentUntilMs:Date.now()-1})],[ready({leaseDeadlineMs:Date.now()-1})],[ready({generation:undefined})]]){
  await assert.rejects(()=>owner({answers}).p.ready({binding,deadlineMs:Date.now()+5000}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'},JSON.stringify(answers[0]));
 }
 await assert.rejects(()=>owner().p.ready({binding,deadlineMs:Date.now()-1}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
});
test('a noncooperative allocation read is bounded by the request budget; cancellation ends the poll',async()=>{
 const slow=createBrowserExecutionPrerequisite({allocations:{ready:()=>new Promise(()=>{})},policy:{read:async()=>ENABLED},activation:OPEN,now:Date.now,requestTimeoutMs:20,effectTimeoutMs:2000});
 const started=Date.now();await assert.rejects(()=>slow.ready({binding,deadlineMs:Date.now()+2000}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
 assert.ok(Date.now()-started<300);
 const ctl=new AbortController();const {p}=owner({answers:[{status:'absent'}]});
 const work=p.ready({binding,deadlineMs:Date.now()+5000,signal:ctl.signal});setTimeout(()=>ctl.abort(),30);
 await assert.rejects(()=>work,{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
});
test('the owner refuses a reader without ready, a policy port without read, or unbounded budgets',()=>{
 for(const bad of [{allocations:{}},{policy:{}},{requestTimeoutMs:0},{effectTimeoutMs:-1}])
  assert.throws(()=>createBrowserExecutionPrerequisite({allocations:{ready:async()=>({})},policy:{read:async()=>ENABLED},activation:OPEN,now:Date.now,requestTimeoutMs:1000,effectTimeoutMs:2000,...bad}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
});
