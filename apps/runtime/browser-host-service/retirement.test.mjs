import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserHostRetirement} from './retirement.mjs';
import {BROWSER_HOST_FACTS_SCHEMA} from '../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {binding} from '../../worker/conversation/browser/test/fixtures.mjs';

const NOW=1_700_000_000_000;
const allocation=Object.freeze({schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,
 hostMode:'browser-only',hostId:'00000000-0000-4000-8000-000000000002',imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:NOW+240000});
const custody=Object.freeze({schema:'meri-browser-custody/1',binding,controlId:'00000000-0000-4000-8000-000000000030',ownerInstanceId:'00000000-0000-4000-8000-000000000031',
 hostId:allocation.hostId,generation:allocation.generation,leaseEpoch:2,policySha256:'d'.repeat(64),expiresAtMs:NOW+60000});
const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];
const active={schema:BROWSER_HOST_FACTS_SCHEMA,binding,scopes,deadlineMs:NOW+90000,currentUntilMs:NOW+5000,phase:'active',admitted:{sdk:true,bash:false,browser:true},
 capabilityPolicy:{},capabilityPolicySha256:'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',browserPolicy:{},browserPolicySha256:'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'};
const held=(over={})=>({schema:BROWSER_HOST_FACTS_SCHEMA,binding,scopes,deadlineMs:NOW+90000,currentUntilMs:NOW+5000,phase:'browser-held',admitted:{sdk:false,bash:false,browser:true},browserCustody:{...custody,...over}});
function owner({facts=[active,active,held()],hold=()=>({outcome:'APPLIED',custody}),now=()=>NOW}={}){
 let reads=0;const calls=[];
 const client={async readFacts({allocation:a,binding:b}){calls.push('facts');assert.equal(a.hostMode,'browser-only');assert.deepEqual(b,binding);const f=facts[Math.min(reads,facts.length-1)];reads++;return {facts:typeof f==='function'?f():f};},
  async holdBrowser({binding:b}){calls.push('hold');assert.deepEqual(b,binding);return hold();}};
 return {calls,reads:()=>reads,retirement:createBrowserHostRetirement({allocation,binding,client,now,pollMs:10}),client};
}

test('prepare pins the host custody; wait polls facts until the run leaves active with SDK and Bash denied and this custody attached; retain re-reads the hold',async()=>{
 const o=owner();
 assert.deepEqual(await o.retirement.prepare({custody}),{prepared:true});
 assert.deepEqual(await o.retirement.wait({custody}),{retired:true,phase:'browser-held'});assert.equal(o.reads(),3);
 assert.deepEqual(await o.retirement.retain({custody}),{retained:true});
 assert.deepEqual(o.calls,['facts','facts','facts','hold']);
});
test('wait refuses a foreign custody in the facts, a still-admitted SDK, cancellation and an expired custody',async()=>{
 const foreign=owner({facts:[held({leaseEpoch:3})]});await foreign.retirement.prepare({custody});
 const ctl=new AbortController();setTimeout(()=>ctl.abort(),40);
 await assert.rejects(foreign.retirement.wait({custody,signal:ctl.signal}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});assert.ok(foreign.reads()>=2,'kept polling until cancelled');
 const stillAdmitted=owner({facts:[active]});
 await stillAdmitted.retirement.prepare({custody});const stop=new AbortController();setTimeout(()=>stop.abort(),30);
 await assert.rejects(stillAdmitted.retirement.wait({custody,signal:stop.signal}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
 const expired=owner({now:()=>NOW+60001});
 await assert.rejects(expired.retirement.prepare({custody}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
});
test('prepare is one-shot per host, wait and retain need the prepared custody, and retain needs an APPLIED hold for this custody',async()=>{
 const o=owner();
 await assert.rejects(o.retirement.wait({custody}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
 await o.retirement.prepare({custody});
 await assert.rejects(o.retirement.prepare({custody}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
 await assert.rejects(o.retirement.wait({custody:{...custody,controlId:'00000000-0000-4000-8000-000000000032'}}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
 const other=owner({hold:()=>({outcome:'APPLIED',custody:{...custody,leaseEpoch:3}})});await other.retirement.prepare({custody});
 await assert.rejects(other.retirement.retain({custody}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
 const foreignHost=owner();await assert.rejects(foreignHost.retirement.prepare({custody:{...custody,generation:allocation.generation+1}}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
});
test('the owner needs a browser-only allocation and a client with facts and hold reads',()=>{
 const {hostMode,...legacy}=allocation;
 assert.throws(()=>createBrowserHostRetirement({allocation:legacy,binding,client:{readFacts(){},holdBrowser(){}}}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
 assert.throws(()=>createBrowserHostRetirement({allocation,binding,client:{readFacts(){}}}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
 assert.throws(()=>createBrowserHostRetirement({allocation,binding,client:{readFacts(){},holdBrowser(){}},pollMs:5}),{code:'BROWSER_HOST_RETIREMENT_REFUSED'});
});
