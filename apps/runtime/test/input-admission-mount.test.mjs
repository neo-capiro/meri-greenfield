/** SYNTHETIC actual assembleControl composition; scripted canonical SQL/current identity/Temporal, no listener or services. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assembleControl} from '../control.mjs';
import {storeFixture,binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {workflowId} from '../../control/conversations/temporal-dispatch.mjs';
function fixture(){
 const f=storeFixture(),state=Object.assign(f.state,{revoked:false,starts:[],nativeCalls:0}),now=Date.now;
 const identityContext={async verifyIdentity(){if(state.revoked)throw Error('revoked');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'synthetic-current',checkedAtMs:now(),expiresAtMs:now()+30000};},async resolveContext({identity}){if(state.revoked)throw Error('revoked');return {identitySha256:hash(identity),binding,scopes,selectedClientId:id(5),contextRevision:'synthetic-current',checkedAtMs:now(),expiresAtMs:now()+30000};}};
 const configuration={versions,sourceEnabled:false,sessions:{maxSessions:10,maxTtlMs:30000},limits:{requestMs:1000,requestBytes:131072,shutdownMs:1000},temporal:{taskQueue:'synthetic'},native:{maxResponseBytes:2097152}};
 const client={connection:{async withDeadline(_at,body){return body();},async withAbortSignal(_signal,body){return body();}},workflow:{async start(name,options){state.starts.push({name,options});},getHandle(){return {};}}};
 const assembly=assembleControl({configuration,pool:f.pool,client,native:{async call(){state.nativeCalls++;throw Error('No native effect');}},productPorts:{identityContext}});
 const post=(path,input,credential='synthetic-native')=>assembly.application.handle(new Request('https://meri.synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(input)}));
 return {...f,state,assembly,post};
}
test('actual startup mounts admission on SAME lifecycle service; durable replay has one queued event and zero workflows until submit',async()=>{
 const f=fixture();try{
  assert.equal(typeof f.assembly.service.admitInput,'function');const session=await f.post('/api/action-followthrough/session',{}),credential=(await session.json()).credential,input={requestId:id(6),prompt:'Synthetic explicit input'};
  const response=await f.post('/api/conversations/input/admit',input,credential);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const saved=await response.json();assert.equal(saved.request.prompt,input.prompt);assert.equal(saved.lastSequence,1);assert.deepEqual(saved.run.binding,binding);assert.equal(f.state.starts.length,0);
  assert.equal((await (await f.post('/api/conversations/input/admit',input,credential)).json()).replayed,true);assert.equal(f.state.starts.length,0);
  assert.equal((await f.post('/api/conversations/submit',input,credential)).status,200);assert.equal(f.state.starts.length,1);assert.equal(f.state.starts[0].name,'meriConversationLifecycleWorkflow');assert.equal(f.state.starts[0].options.workflowId,workflowId(binding));assert.deepEqual(f.state.starts[0].options.args,[{binding}]);
  assert.equal(f.state.runs.size,1);assert.equal([...f.state.events.values()].flat().length,1);assert.equal(f.state.nativeCalls,0);assert.equal(f.assembly.productReadiness().ready,false);
 }finally{f.assembly.close();}
});
test('mounted admission keeps revoked and forged requests from persistence and never calls native/model dispatch',async()=>{
 const f=fixture();try{const session=await f.post('/api/action-followthrough/session',{}),credential=(await session.json()).credential,input={requestId:id(6),prompt:'Synthetic guarded input'};
  assert.equal((await f.post('/api/conversations/input/admit',{...input,binding},credential)).status,400);assert.equal(f.state.runs.size,0);f.state.revoked=true;const denied=await f.post('/api/conversations/input/admit',input,credential);assert.equal(denied.status,403);assert.equal((await denied.text()).includes(input.prompt),false);assert.equal(f.state.runs.size,0);assert.equal(f.state.starts.length,0);assert.equal(f.state.nativeCalls,0);
 }finally{f.assembly.close();}
});
