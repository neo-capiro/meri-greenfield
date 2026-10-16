/** SYNTHETIC actual control composition and loopback health listener, scripted SQL/Temporal/native/Core facts. No real services. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assembleControl} from '../control.mjs';
import {listenRuntime} from '../http-server.mjs';
import {storeFixture,binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {createMembershipGate} from '../../control/product-access/membership.mjs';
import {hash} from '../../control/conversations/boundary.mjs';
const configuration={versions,sourceEnabled:false,http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://ui.invalid'},sessions:{maxSessions:10,maxTtlMs:30000},
 limits:{requestMs:1000,requestBytes:131072,shutdownMs:1000},temporal:{taskQueue:'synthetic'},native:{maxResponseBytes:2097152}};
function fixture(){const f=storeFixture();let revoked=false,starts=0,nativeCalls=0;
 const pool={async connect(){const c=await f.pool.connect();return {...c,async query(sql,p){
  if(sql.includes('owner_actor_id=$2'))return {rows:[...f.state.conversations.values()].filter(r=>r.tenant_id===p[0]&&r.owner_actor_id===p[1])};
  if(sql.startsWith('SELECT e.*'))return {rows:[...f.state.events.values()].flat().map(e=>({...e,tenant_id:e.event.binding.tenantId,conversation_id:e.event.binding.conversationId,run_id:e.event.binding.runId})).filter(e=>e.event.sequence>p[2]).slice(0,p[3])};
  return c.query(sql,p);
 }};}};
 const identity={async verifyIdentity(){if(revoked)throw Error('revoked');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'m1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};},
  async resolveContext({identity}){return {identitySha256:hash(identity),binding,scopes,selectedClientId:id(5),contextRevision:'current-1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};}};
 const gate=createMembershipGate({now:Date.now,limits:{maxRequestMs:1000,maxFactBytes:65536},verifyToken:async()=>{if(revoked)throw Error('revoked');return {tenantId:binding.tenantId,actorId:binding.actorId,checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};},
  readMembership:async()=>({tenantId:binding.tenantId,actorId:binding.actorId,status:revoked?'removed':'active',role:'member',permissions:[],clientIds:[id(5)],membershipRevision:'m1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000})});
 const client={connection:{async withDeadline(_at,fn){return fn();},async withAbortSignal(_s,fn){return fn();}},workflow:{async start(){starts++;},getHandle(){return {};}}};
 const assembly=assembleControl({configuration,pool,client,native:{async call(){nativeCalls++;throw Error('uncomposed');}},productPorts:{identityContext:identity,conversationMembership:gate}});
 const post=(path,body,credential='native')=>assembly.application.handle(new Request(`https://meri.invalid${path}`,{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {...f,assembly,post,counts:()=>({starts,nativeCalls}),revoke(){revoked=true;}};
}
test('trusted startup composes canonical session, submit and membership history, with missing lifecycle owners refused before writes',async()=>{
 const f=fixture();try{
  const issued=await f.post('/api/action-followthrough/session',{});assert.equal(issued.status,200);const credential=(await issued.json()).credential;
  assert.equal((await f.post('/api/conversations/submit',{requestId:id(6),prompt:'startup synthetic'},credential)).status,200);
  const page=await f.post('/api/conversations/transcript',{conversationId:binding.conversationId});assert.equal(page.status,200);assert.equal((await page.json()).turns[0].request.prompt,'startup synthetic');
  assert.equal((await f.post('/api/conversations/list',{})).status,200);
  const refused=await f.post('/api/conversations/control',{controlId:id(7),intent:'resume',checkpointId:id(8),checkpointSha256:'a'.repeat(64)},credential);
  assert.equal(refused.status,503);assert.deepEqual(await refused.json(),{error:{code:'LIFECYCLE_OWNER_UNAVAILABLE',outcome:'NOT_DISPATCHED'}});
  assert.equal(f.state.runs.size,1);assert.equal(f.state.controls.size,0);assert.deepEqual(f.counts(),{starts:1,nativeCalls:0});
  assert.equal((await f.post('/api/action-followthrough/query',{})).status,503);
  const ready=f.assembly.productReadiness();assert.equal(ready.ready,false);assert.ok(ready.missingOwners.includes('lifecycle.admissionRetirement'));
  f.revoke();assert.equal((await f.post('/api/conversations/transcript',{conversationId:binding.conversationId})).status,403);
 }finally{f.assembly.close();}
});
test('actual readiness response names composition gaps and keeps release held',async()=>{
 const f=fixture(),listener=await listenRuntime({configuration,application:f.assembly.application,readiness:async()=>({product:f.assembly.productReadiness()})});
 try{const response=await fetch(`http://127.0.0.1:${listener.address.port}/health/ready`);assert.equal(response.status,503);const body=await response.json();
  assert.equal(body.status,'not-ready');assert.equal(body.releaseAcceptance,'held');assert.ok(body.product.missingOwners.includes('schedules.dispatchWorker'));
 }finally{await listener.close();f.assembly.close();}
});
