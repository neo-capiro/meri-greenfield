import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserExecutionPrerequisite,BROWSER_NEED,BROWSER_DEFERRED} from '../browser-execution-prerequisite.mjs';
import {HELD_BROWSER_ACTIVATION,BROWSER_ACTIVATION_RENDER_VERIFICATION,EGRESS_REQUIREMENTS_SHA256,compileBrowserActivation} from '../../worker/conversation/browser/activation.mjs';

const binding={tenantId:'t',actorId:'a',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002',
 attemptId:'00000000-0000-4000-8000-000000000003',workerId:'00000000-0000-4000-8000-000000000004',writerFence:1};
const OPEN=compileBrowserActivation({state:'open',evidence:'docs/qualification/browser-egress/EVIDENCE.md',evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256,
 renderVerification:{schema:BROWSER_ACTIVATION_RENDER_VERIFICATION,sourceCommit:'0'.repeat(40),renderedAtMs:1,evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256}});
const ready=over=>({status:'ready',binding,generation:1,ownerInstanceId:'00000000-0000-4000-8000-000000000009',leaseDeadlineMs:Date.now()+60000,currentUntilMs:Date.now()+60000,recordSha256:'b'.repeat(64),...over});
const ENABLED={enabled:true},DISABLED={enabled:false};
const scopes=[{tenantId:'t',kind:'private-user',resourceId:'00000000-0000-4000-8000-000000000002',policyRevision:'policy1'}];
/** The durable demand journal (browser-operation-owner.mjs demandHost/hostDemanded), shared by every control task. */
const journal=()=>{const rows=new Map(),key=b=>JSON.stringify(b);return {rows,record:async({binding:b,scopes:s,expiresAtMs,signal})=>{assert.ok(signal instanceof AbortSignal);
 assert.deepEqual(s,scopes);assert.ok(Number.isSafeInteger(expiresAtMs));rows.set(key(b),true);},read:async({binding:b,signal})=>{assert.ok(signal instanceof AbortSignal);return rows.has(key(b));}};};
const owner=({activation=OPEN,answers=[ready()],policies=[ENABLED],requestTimeoutMs=1000,effectTimeoutMs=2000,demands=journal()}={})=>{
 let reads=0,policyReads=0;const allocations={async ready(input){assert.deepEqual(input.binding,binding);assert.ok(input.signal instanceof AbortSignal);const a=answers[Math.min(reads,answers.length-1)];reads++;return typeof a==='function'?a():a;}};
 const policy={async read(input){assert.deepEqual(input.binding,binding);assert.ok(input.signal instanceof AbortSignal);assert.ok(Number.isSafeInteger(input.deadlineMs));const v=policies[Math.min(policyReads,policies.length-1)];policyReads++;return typeof v==='function'?v():v;}};
 return {reads:()=>reads,policyReads:()=>policyReads,demands,p:createBrowserExecutionPrerequisite({allocations,activation,policy,demands,now:Date.now,requestTimeoutMs,effectTimeoutMs})};
};

const run=()=>Date.now()+60000;
test('a held activation is an explicit none and refuses a demand, without touching the policy or the allocation reader',async()=>{
 const {p,reads,policyReads}=owner({activation:HELD_BROWSER_ACTIVATION});
 assert.deepEqual(await p.need({binding,deadlineMs:run()}),{kind:'none'});
 await assert.rejects(p.demand({binding,scopes,deadlineMs:Date.now()+5000,executionDeadlineMs:run()}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
 assert.equal(reads(),0);assert.equal(policyReads(),0);
});
test('a run whose resolved policy has the browser off gets no host: none, and a demand refuses without an allocation read',async()=>{
 const {p,reads,policyReads}=owner({policies:[DISABLED]}),until=run();
 assert.deepEqual(await p.need({binding,deadlineMs:until}),{kind:'none'});
 await assert.rejects(p.demand({binding,scopes,deadlineMs:Date.now()+5000,executionDeadlineMs:until}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
 assert.equal(reads(),0);assert.equal(policyReads(),1,'the verdict is read once per run');
});
test('a failed or malformed policy read refuses instead of deciding either way',async()=>{
 for(const policies of [[()=>{throw Error('CORE_UNAVAILABLE');}],[{enabled:'yes'}],[null]])
  await assert.rejects(owner({policies}).p.need({binding,deadlineMs:run()}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'},JSON.stringify(policies[0]?.toString?.()));
 const slow=createBrowserExecutionPrerequisite({allocations:{ready:async()=>ready()},policy:{read:()=>new Promise(()=>{})},demands:journal(),activation:OPEN,now:Date.now,requestTimeoutMs:20,effectTimeoutMs:2000});
 await assert.rejects(slow.need({binding,deadlineMs:run()}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
});
test('an enabled run is deferred until its first browser use; the demand makes it browser-only and waits until the host is ready',async()=>{
 const {p,reads,policyReads}=owner({answers:[{status:'absent'},{status:'not-ready',state:'dispatching',generation:1,leaseDeadlineMs:Date.now()+60000},ready()]}),until=run();
 assert.deepEqual(await p.need({binding,deadlineMs:until}),BROWSER_DEFERRED);
 assert.deepEqual(await p.need({binding,deadlineMs:until}),BROWSER_DEFERRED,'ordinary chats never provision');
 assert.equal(reads(),0);
 const result=await p.demand({binding,scopes,deadlineMs:Date.now()+5000,executionDeadlineMs:until});
 assert.equal(result.status,'ready');assert.equal(result.generation,1);assert.ok(result.currentUntilMs<=result.leaseDeadlineMs);assert.equal(reads(),3);
 assert.deepEqual(await p.need({binding,deadlineMs:until}),BROWSER_NEED);assert.equal(BROWSER_NEED.hostMode,'browser-only');
 assert.equal(policyReads(),1,'the enabled verdict is kept for the run');
 // A demand belongs to its own run: another run of the same conversation is still deferred.
 const other={...binding,runId:'00000000-0000-4000-8000-000000000005'};
 const second=createBrowserExecutionPrerequisite({allocations:{ready:async()=>ready()},policy:{read:async()=>ENABLED},demands:journal(),activation:OPEN,now:Date.now,requestTimeoutMs:1000,effectTimeoutMs:2000});
 await second.demand({binding,scopes,deadlineMs:Date.now()+5000,executionDeadlineMs:until});
 assert.deepEqual(await second.need({binding:other,deadlineMs:until}),BROWSER_DEFERRED);assert.deepEqual(await second.need({binding,deadlineMs:until}),BROWSER_NEED);
});
test('a demand refuses an unknown status, an expired receipt, a missing generation and an elapsed deadline',async()=>{
 for(const answers of [[{status:'ready?'}],[ready({currentUntilMs:Date.now()-1})],[ready({leaseDeadlineMs:Date.now()-1})],[ready({generation:undefined})]]){
  await assert.rejects(()=>owner({answers}).p.demand({binding,scopes,deadlineMs:Date.now()+5000,executionDeadlineMs:run()}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'},JSON.stringify(answers[0]));
 }
 await assert.rejects(()=>owner().p.demand({binding,scopes,deadlineMs:Date.now()-1,executionDeadlineMs:run()}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
});
test('a noncooperative allocation read is bounded by the request budget; cancellation ends the wait',async()=>{
 const slow=createBrowserExecutionPrerequisite({allocations:{ready:()=>new Promise(()=>{})},policy:{read:async()=>ENABLED},demands:journal(),activation:OPEN,now:Date.now,requestTimeoutMs:20,effectTimeoutMs:2000});
 const started=Date.now();await assert.rejects(()=>slow.demand({binding,scopes,deadlineMs:Date.now()+2000,executionDeadlineMs:run()}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
 assert.ok(Date.now()-started<300);
 const ctl=new AbortController();const {p}=owner({answers:[{status:'absent'}]});
 const work=p.demand({binding,scopes,deadlineMs:Date.now()+5000,executionDeadlineMs:run(),signal:ctl.signal});setTimeout(()=>ctl.abort(),30);
 await assert.rejects(()=>work,{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
});
test('the owner refuses a reader without ready, a policy port without read, or unbounded budgets',()=>{
 for(const bad of [{allocations:{}},{policy:{}},{demands:{read:async()=>false}},{demands:undefined},{requestTimeoutMs:0},{effectTimeoutMs:-1}])
  assert.throws(()=>createBrowserExecutionPrerequisite({allocations:{ready:async()=>({})},policy:{read:async()=>ENABLED},demands:journal(),activation:OPEN,now:Date.now,requestTimeoutMs:1000,effectTimeoutMs:2000,...bad}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
});
test('the demand is durable: another control task (or a restarted one) answers browser-only from the journal',async()=>{
 const demands=journal(),until=run(),first=owner({demands}),second=owner({demands});
 assert.deepEqual(await second.p.need({binding,deadlineMs:until}),BROWSER_DEFERRED);
 await first.p.demand({binding,scopes,deadlineMs:Date.now()+5000,executionDeadlineMs:until});
 assert.equal(demands.rows.size,1);
 assert.deepEqual(await second.p.need({binding,deadlineMs:until}),BROWSER_NEED,'the task that did not see the demand reads it');
 // A failed demand read is not a verdict: the broker asks again on its next poll. A demand that cannot be recorded refuses.
 const flaky=owner({demands:{record:async()=>{throw Error('JOURNAL_UNAVAILABLE');},read:async()=>{throw Error('JOURNAL_UNAVAILABLE');}}});
 assert.deepEqual(await flaky.p.need({binding,deadlineMs:until}),BROWSER_DEFERRED);
 await assert.rejects(flaky.p.demand({binding,scopes,deadlineMs:Date.now()+5000,executionDeadlineMs:until}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
 assert.equal(flaky.reads(),0,'nothing waits for a host whose demand was not recorded');
});
test('reached says whether any browser host was ever allocated for the run; a failed read refuses',async()=>{
 assert.equal(await owner({answers:[{status:'absent',binding}]}).p.reached({binding,deadlineMs:Date.now()+5000}),false);
 for(const answer of [{status:'not-ready',state:'dispatching'},ready()])assert.equal(await owner({answers:[answer]}).p.reached({binding,deadlineMs:Date.now()+5000}),true);
 await assert.rejects(owner({answers:[()=>{throw Error('BROWSER_HOST_ALLOCATION_REFUSED');}]}).p.reached({binding,deadlineMs:Date.now()+5000}),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});
});
