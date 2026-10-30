/** Actual native client -> private HTTP -> policy composition -> allocated-host
 * port. Core, allocation and browser effects are scripted; no live acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createNativeBrowserPort} from '../browser-client.mjs';
import {createBrowserOperations} from '../browser-operations.mjs';
import {createWorkerRunApplication} from '../worker-http.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions,scopes} from '../../control/conversations/test/store-fixture.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';
const policy=validateBrowserPolicy({enabled:true,tools:['browser_snapshot'],timeouts:{actionMs:5000,navigationMs:60000}});
function fixture(){
 let at=1000,checks=0,roleReads=0,policyReads=0,dispatches=0,revoked=false,replyBinding=binding,authFailure=false,advance=0;
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:301000,runtimeSessionId:'synthetic-'+('a'.repeat(64))});
 const calls=[],requests=[],now=()=>at;
 const hosts={async executeBrowserOperation(operation,request,options){dispatches++;calls.push({operation,request,deadlineMs:options.deadlineMs});at+=advance;options.signal.throwIfAborted();
  if(operation==='browser-prepare')return {binding:replyBinding,policy,activation:'held',approvalDeadlineMs:120000};
  if(operation==='browser-call')return {content:[{type:'text',text:'filtered snapshot'}]};
  if(operation==='browser-tools')return {tools:[{name:'browser_snapshot',inputSchema:{type:'object'}}]};
  if(operation==='browser-settle')return {schema:'meri-browser-cleanup/1',binding,outcome:request.outcome,activation:'held',egress:'not-applicable',process:'not-applicable',profile:'done'};
 }};
 const browserOperations=createBrowserOperations({hosts,now,readCapabilityRole:async()=>{roleReads++;if(revoked)throw Error('REVOKED');return {actorRole:'standard_user',checkedAtMs:at,expiresAtMs:at+30000};},readBrowserPolicy:async input=>{policyReads++;assert.deepEqual(input.scopes,scopes);return policy;}});
 const app=createWorkerRunApplication({now,browserOperations,configuration:{limits:{requestMs:3000,requestBytes:1048576}},createService(){throw Error('browser must not invent a run-owner method');},
  execution:{async authenticate(input){checks++;assert.equal(input.credential,'synthetic-execution');assert.deepEqual(input.binding,binding);if(authFailure||at>=identity.expiresAtMs)throw Error('EXECUTION_AUTHORITY_REFUSED');return {execution:identity,scopes,selectedClientId:scopes[0].resourceId,policyRevision:scopes[0].policyRevision};}}});
 const transport=async(url,init)=>{requests.push(url);return app.handle(new Request(url.replace('/v1/runner/','/internal/conversations/'),init));};
 const native=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:1048576},credential:'synthetic-execution',fetch:transport,now});
 const port=createNativeBrowserPort({native,binding,deadlineMs:identity.expiresAtMs,now});
 return {port,native,calls,requests,counts:()=>({checks,roleReads,policyReads,dispatches}),clock:()=>at,advance:value=>{advance=value;},setClock:value=>{at=value;},revoke:()=>{revoked=true;},authFail:()=>{authFailure=true;},wrongBinding:()=>{replyBinding={...binding,writerFence:2};}};
}
test('only the canonical browser routes receive policy-derived time beyond the ordinary HTTP cap',async()=>{
 const f=fixture();await f.port.prepare();f.advance(4000);
 assert.deepEqual(await f.port.call({requestId:'a'.repeat(64),tool:'browser_snapshot',args:{}}),{content:[{type:'text',text:'filtered snapshot'}]});
 assert.equal(f.calls[1].deadlineMs,66000);assert.equal(f.clock(),5000);
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
