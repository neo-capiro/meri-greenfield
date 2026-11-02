/** Actual native client -> private HTTP -> policy composition -> allocated-host
 * port. Core, allocation and browser effects are scripted; no live acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createNativeBrowserPort} from '../browser-client.mjs';
import {createBrowserOperations} from '../browser-operations.mjs';
import {createBrowserOperationOwner} from '../../control/intents/browser-operation-owner.mjs';
import {createIntentJournal} from '../../control/intents/journal.mjs';
import {createWorkerRunApplication} from '../worker-http.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions,scopes} from '../../control/conversations/test/store-fixture.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';
import {createBrowserExecutionPrerequisite} from '../browser-execution-prerequisite.mjs';
import {compileBrowserActivation,EGRESS_REQUIREMENTS_SHA256,BROWSER_ACTIVATION_RENDER_VERIFICATION} from '../../worker/conversation/browser/activation.mjs';
const policy=validateBrowserPolicy({enabled:true,tools:['browser_snapshot'],timeouts:{actionMs:5000,navigationMs:60000}});
function fixture({ensureHost,reached=true}={}){
 let at=1000,checks=0,roleReads=0,policyReads=0,dispatches=0,revoked=false,replyBinding=binding,authFailure=false,advance=0;
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:301000,runtimeSessionId:'synthetic-'+('a'.repeat(64))});
 const calls=[],requests=[],ensured=[],now=()=>at;
 // The real custody owner over an in-memory journal port: a browser call now claims before dispatch.
 const rows=new Map(),keyOf=k=>JSON.stringify([k.tenantId,k.actorId,k.conversationId,k.deliveryId]);
 const custody=createBrowserOperationOwner({now,journal:createIntentJournal({
  async claim({key,record}){const id=keyOf(key);if(rows.has(id))return {claimed:false,entry:structuredClone(rows.get(id))};
   rows.set(id,{record:structuredClone(record),state:'PENDING',outcome:null});return {claimed:true};},
  async settle({key,record,state,outcome}){const next={record:structuredClone(record),state,outcome:structuredClone(outcome)};
   rows.set(keyOf(key),next);return structuredClone(next);},
  async read({key}){const row=rows.get(keyOf(key));return row?structuredClone(row):null;}})});
 const hosts={async executeBrowserOperation(operation,request,options){dispatches++;calls.push({operation,request,deadlineMs:options.deadlineMs});at+=advance;options.signal.throwIfAborted();
  if(operation==='browser-prepare')return {binding:replyBinding,policy,activation:'open',approvalDeadlineMs:120000};
  if(operation==='browser-call')return {content:[{type:'text',text:'filtered snapshot'}]};
  if(operation==='browser-tools')return {tools:[{name:'browser_snapshot',inputSchema:{type:'object'}}]};
  if(operation==='browser-settle')return {schema:'meri-browser-cleanup/1',binding,outcome:request.outcome,activation:'open',egress:'done',process:'done',profile:'done'};
 }};
 const browserOperations=createBrowserOperations({ensureHost:async input=>{ensured.push({...input,dispatchesBefore:dispatches});await ensureHost?.(input);},hostReached:typeof reached==='function'?reached:async()=>reached,hosts,now,custody,readCapabilityRole:async()=>{roleReads++;if(revoked)throw Error('REVOKED');return {actorRole:'standard_user',checkedAtMs:at,expiresAtMs:at+30000};},readBrowserPolicy:async input=>{policyReads++;assert.deepEqual(input.scopes,scopes);return policy;}});
 const app=createWorkerRunApplication({now,browserOperations,configuration:{limits:{requestMs:3000,requestBytes:1048576}},createService(){throw Error('browser must not invent a run-owner method');},
  execution:{async authenticate(input){checks++;assert.equal(input.credential,'synthetic-execution');assert.deepEqual(input.binding,binding);if(authFailure||at>=identity.expiresAtMs)throw Error('EXECUTION_AUTHORITY_REFUSED');return {execution:identity,scopes,selectedClientId:scopes[0].resourceId,policyRevision:scopes[0].policyRevision};}}});
 const transport=async(url,init)=>{requests.push(url);return app.handle(new Request(url.replace('/v1/runner/','/internal/conversations/'),init));};
 const native=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:1048576},credential:'synthetic-execution',fetch:transport,now});
 const port=createNativeBrowserPort({native,binding,deadlineMs:identity.expiresAtMs,now});
 return {ensured,port,native,calls,requests,counts:()=>({checks,roleReads,policyReads,dispatches}),clock:()=>at,advance:value=>{advance=value;},setClock:value=>{at=value;},revoke:()=>{revoked=true;},authFail:()=>{authFailure=true;},wrongBinding:()=>{replyBinding={...binding,writerFence:2};}};
}
test('only the canonical browser routes receive policy-derived time beyond the ordinary HTTP cap',async()=>{
 const f=fixture();await f.port.prepare();f.advance(4000);
 assert.deepEqual(await f.port.call({requestId:'a'.repeat(64),tool:'browser_snapshot',args:{}}),{content:[{type:'text',text:'filtered snapshot'}]});
 assert.equal(f.calls[1].deadlineMs,301000,'control bounds a call by the execution only; the host clamps it to the page effect plus the selected approval window');assert.equal(f.clock(),5000);
 assert.deepEqual(f.counts(),{checks:4,roleReads:2,policyReads:2,dispatches:2});
 assert.deepEqual(Object.keys(f.calls[1].request).sort(),['args','binding','requestId','tool']);
});
test('revoked Core access refuses the next tool without an effect or retry',async()=>{
 const f=fixture();await f.port.prepare();f.revoke();
 await assert.rejects(f.port.tools());assert.equal(f.counts().dispatches,1);assert.equal(f.requests.length,2);
});
test('cleanup still attempts the existing host after policy revocation, but cannot bypass expired execution auth',async()=>{
 const f=fixture();await f.port.prepare();f.revoke();assert.equal((await f.port.settle({outcome:'cancelled'})).profile,'done');assert.equal(f.counts().roleReads,1);
 const g=fixture();await g.port.prepare();g.setClock(301001);await assert.rejects(g.port.settle({outcome:'failed'}));assert.equal(g.counts().dispatches,1);
});
test('a changed metadata binding cannot prepare the SDK and no further call is admitted',async()=>{
 const f=fixture();f.wrongBinding();await assert.rejects(f.port.prepare());await assert.rejects(f.port.tools());assert.equal(f.requests.length,1);
});
test('caller-supplied policy or destination is refused before authentication and host effects',async()=>{
 const f=fixture();for(const extra of [{policy},{endpoint:'https://other.invalid'},{deadlineMs:9999999}])await assert.rejects(f.native.call('runner/browser-prepare',{binding,...extra},{deadlineMs:10000,maxRequestMs:9000}));
 assert.deepEqual(f.counts(),{checks:0,roleReads:0,policyReads:0,dispatches:0});
});
test('a browser call has no retry when canonical execution authentication fails',async()=>{
 const f=fixture();await f.port.prepare();f.authFail();await assert.rejects(f.port.call({requestId:'b'.repeat(64),tool:'browser_snapshot',args:{}}));assert.equal(f.requests.length,2);assert.equal(f.counts().dispatches,1);
});
test('remaining execution time clamps policy allowance and withholds late effects',async()=>{
 const f=fixture();await f.port.prepare();f.setClock(300000);f.advance(1001);
 await assert.rejects(f.port.call({requestId:'c'.repeat(64),tool:'browser_snapshot',args:{}}));assert.equal(f.calls[1].deadlineMs,301000);assert.equal(f.requests.length,2);
});

test('the first browser preparation demands the run host and waits for it before reaching it; nothing else does',async()=>{
 const f=fixture();await f.port.prepare();
 assert.equal(f.ensured.length,1);const [demand]=f.ensured;
 assert.deepEqual(demand.binding,binding);assert.equal(demand.executionDeadlineMs,301000);assert.equal(demand.dispatchesBefore,0,'the host is reached only after it is ready');
 assert.ok(demand.deadlineMs>1000+130000,'preparation includes the provisioning allowance');
 await f.port.call({requestId:'b'.repeat(64),tool:'browser_snapshot',args:{}});await f.port.tools();
 assert.equal(f.ensured.length,1);
});
test('a preparation that never got a browser host settles as not-applicable at control; a reached host still settles itself',async()=>{
 const f=fixture({ensureHost:async()=>{throw Object.assign(Error('EXECUTION_BROWSER_PREREQUISITE_REFUSED'),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});},reached:false});
 await assert.rejects(f.port.prepare());assert.equal(f.counts().dispatches,0,'the host was never reached');
 assert.deepEqual(await f.port.settle({outcome:'failed'}),{schema:'meri-browser-cleanup/1',binding,outcome:'failed',activation:'not-applicable',egress:'not-applicable',process:'not-applicable',profile:'done'});
 assert.equal(f.counts().dispatches,0,'no host settlement is attempted for a host that does not exist');
 const g=fixture();await g.port.prepare();assert.equal((await g.port.settle({outcome:'ended'})).activation,'open');
 assert.deepEqual(g.calls.map(c=>c.operation),['browser-prepare','browser-settle']);
 assert.deepEqual(g.ensured[0].scopes,scopes,'the demand carries the run scopes for its durable record');
});
test('a start that created an allocation but never got the host active also settles at control, over the real reached read',async()=>{
 const activation=compileBrowserActivation({state:'open',evidence:'docs/qualification/browser-egress/EVIDENCE.md',evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256,
  renderVerification:{schema:BROWSER_ACTIVATION_RENDER_VERIFICATION,sourceCommit:'0'.repeat(40),renderedAtMs:1,evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256}});
 const refused=async()=>{throw Object.assign(Error('EXECUTION_BROWSER_PREREQUISITE_REFUSED'),{code:'EXECUTION_BROWSER_PREREQUISITE_REFUSED'});};
 for(const [answer,reachedHost] of [[{status:'not-ready',binding,state:'dispatching',generation:1,leaseDeadlineMs:Date.now()+60000},false],
  [{status:'not-ready',binding,state:'reserved',generation:1,leaseDeadlineMs:Date.now()+60000},false],[{status:'not-ready',binding,state:'expired'},true]]){
  const prerequisite=createBrowserExecutionPrerequisite({allocations:{ready:async()=>answer},activation,policy:{read:async()=>policy},
   demands:{record:async()=>{},read:async()=>true},now:Date.now,requestTimeoutMs:1000,effectTimeoutMs:2000});
  const f=fixture({ensureHost:refused,reached:input=>prerequisite.reached({...input,deadlineMs:Date.now()+5000})});
  await assert.rejects(f.port.prepare());
  const receipt=await f.port.settle({outcome:'failed'});
  assert.equal(receipt.activation,reachedHost?'open':'not-applicable',answer.state);
  assert.equal(f.counts().dispatches,reachedHost?1:0,answer.state);
 }
});
