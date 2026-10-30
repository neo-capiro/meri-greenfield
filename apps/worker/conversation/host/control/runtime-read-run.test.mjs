/** readRun join: canonical configuration from live facts, pinned binding, per-callback signals.
 * The host-currentness client and the runtime port are inert, clearly labelled fakes; every validator
 * used here is the REAL canonical one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertBrowserHostFacts} from '../../../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {createBrowserHostReadRun} from './runtime-read-run.mjs';

const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const tenantId=id(1),actorId=id(2);
const binding={tenantId,actorId,conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const allocation={schema:'meri-conversation-host-allocation/1',tenantId,conversationId:id(3),generation:2,
hostId:id(9),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:1700009000000};
const scopes=[{tenantId,kind:'private-user',resourceId:actorId,policyRevision:'p1'}];
const cwd=`/var/lib/capiro/conversations/${id(3)}`;
const capabilityPolicy={},browserPolicy={allowedOrigins:['https://example.test']};

function facts({currentUntilMs=1700000100000,deadlineMs=1700000900000}={}){
 return assertBrowserHostFacts({schema:'meri-browser-host-facts/3',binding,scopes,deadlineMs,currentUntilMs,
  phase:'active',admitted:{sdk:true,bash:false,browser:true},
  capabilityPolicy,capabilityPolicySha256:canonicalSha256(capabilityPolicy),
  browserPolicy,browserPolicySha256:canonicalSha256(browserPolicy)},{binding});
}
const manifest={siteId:'site',workflowId:'flow',version:1};
function fixture({fact=()=>facts(),workflow=null}={}){
 const calls={readFacts:[],resolve:[]};
 const client={async readFacts(request){calls.readFacts.push(request);return {facts:fact()};},
  async resolveBrowserWorkflow(request){calls.resolve.push(request);
   if(workflow)throw workflow;
   return {workflow:{enabled:true,manifest,manifestSha256:'f'.repeat(64)}};}};
 const port={approvals:{async decide(){}},receipts:{async record(){}},artifacts:{async ingest(){}}};
 const readRun=createBrowserHostReadRun({allocation,binding,cwd,client,port});
 return {calls,client,port,readRun,readRunFn:readRun.readRun};
}

test('readRun returns the canonical configuration with the ORIGINAL run deadline',async()=>{
 const {readRunFn,port}=fixture();
 const prepared=await readRunFn({binding});
 assert.equal(prepared.cwd,`/var/lib/capiro/conversations/${id(3)}`);
 assert.equal(prepared.deadlineMs,1700000900000);
 assert.equal(prepared.port,port);
 assert.deepEqual(prepared.binding,binding);
 assert.equal(typeof prepared.siteWorkflows.resolve,'function');
});

test('a rolling currentUntilMs never changes the pinned deadline or configuration',async()=>{
 let until=1700000100000;
 const {readRunFn}=fixture({fact:()=>facts({currentUntilMs:until})});
 const first=await readRunFn({binding});
 until+=5000;
 const second=await readRunFn({binding});
 assert.equal(first.deadlineMs,second.deadlineMs);
 assert.equal(canonicalSha256(first.binding),canonicalSha256(second.binding));
 assert.notEqual(first.deadlineMs,until);
});

test('a foreign or successor binding is refused',async()=>{
 const {readRunFn}=fixture();
 await assert.rejects(()=>readRunFn({binding:{...binding,runId:id(70)}}),/BROWSER_HOST_READ_RUN_REFUSED/u);
 await assert.rejects(()=>readRunFn({binding:{...binding,tenantId:id(71)}}),/BROWSER_HOST_READ_RUN_REFUSED/u);
 assert.throws(()=>createBrowserHostReadRun({allocation,binding,cwd:'relative/path',
  client:{readFacts(){},resolveBrowserWorkflow(){}},
  port:{approvals:{decide(){}},receipts:{record(){}},artifacts:{ingest(){}}}}),/BROWSER_HOST_READ_RUN_REFUSED/u);
});

test('each retained closure uses its OWN callback signal, not the closed readRun one',async()=>{
 const {readRun,readRunFn,calls}=fixture();
 const prepare=new AbortController();
 await readRunFn({binding,signal:prepare.signal});
 prepare.abort(); // the preparation operation is over
 const later=new AbortController();
 const resolved=await readRun.siteWorkflows.resolve({binding,signal:later.signal});
 assert.deepEqual(Object.keys(resolved).sort(),['enabled','manifest','manifestSha256']);
 assert.equal(resolved.enabled,true);
 assert.equal(calls.resolve.length,1);
 // A callback that arrives already cancelled fails closed instead of borrowing anything.
 const dead=new AbortController();dead.abort();
 await assert.rejects(()=>readRun.siteWorkflows.resolve({binding,signal:dead.signal}),
  /BROWSER_HOST_READ_RUN_REFUSED/u);
 assert.equal(calls.resolve.length,1);
});

test('a workflow answer is unwrapped, and a refusing client stays a refusal',async()=>{
 const {readRun,calls}=fixture();
 assert.deepEqual(await readRun.siteWorkflows.resolve({binding}),{manifest,manifestSha256:'f'.repeat(64),enabled:true});
 const refusing=fixture({workflow:Object.assign(Error('SITE_WORKFLOW_CURRENT_REFUSED'),
  {code:'SITE_WORKFLOW_CURRENT_REFUSED'})});
 await assert.rejects(()=>refusing.readRun.siteWorkflows.resolve({binding}),
  /SITE_WORKFLOW_CURRENT_REFUSED/u);
});
