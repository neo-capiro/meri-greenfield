/** SYNTHETIC actual control composition and loopback health listener, scripted SQL/Temporal/native/Core facts. No real services. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assembleControl} from '../control.mjs';
import {listenRuntime} from '../http-server.mjs';
import {initialInputFixture} from '../../control/conversations/test/initial-input-fixture.mjs';
import {binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {createMembershipGate} from '../../control/product-access/membership.mjs';
import {hash} from '../../control/conversations/boundary.mjs';
const configuration={versions,sourceEnabled:false,http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://ui.invalid'},sessions:{maxSessions:10,maxTtlMs:30000},
 limits:{requestMs:1000,requestBytes:131072,shutdownMs:1000},temporal:{taskQueue:'synthetic'},native:{maxResponseBytes:2097152}};
function fixture(){const f=initialInputFixture();let revoked=false,starts=0,nativeCalls=0,onHistoryRead;const member={tenantId:binding.tenantId,actorId:binding.actorId,status:'active',role:'member',permissions:[],clientIds:[id(5)],membershipRevision:'m1'};
 const pool={async connect(){const c=await f.pool.connect();return {...c,async query(sql,p){
  if(sql.includes('owner_actor_id=$2'))return {rows:[...f.state.conversations.values()].filter(r=>r.tenant_id===p[0]&&r.owner_actor_id===p[1])};
  if(sql.startsWith('SELECT e.*')){await onHistoryRead?.();return {rows:[...f.state.events.values()].flat().map(e=>({...e,tenant_id:e.event.binding.tenantId,conversation_id:e.event.binding.conversationId,run_id:e.event.binding.runId})).filter(e=>e.event.sequence>p[2]).slice(0,p[3])};}
  return c.query(sql,p);
 }};}};
 const identity={async verifyIdentity(){if(revoked)throw Error('revoked');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'m1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};},
  async resolveContext({identity}){return {identitySha256:hash(identity),binding,scopes,selectedClientId:id(5),contextRevision:'current-1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};}};
 const gate=createMembershipGate({now:Date.now,limits:{maxRequestMs:1000,maxFactBytes:65536},verifyToken:async()=>{if(revoked)throw Error('revoked');return {tenantId:binding.tenantId,actorId:binding.actorId,checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};},
  readMembership:async()=>({...member,checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000})});
 const client={connection:{async withDeadline(_at,fn){return fn();},async withAbortSignal(_s,fn){return fn();}},workflow:{async start(){starts++;},getHandle(){return {};}}};
 const assembly=assembleControl({configuration,pool,client,native:{async call(operation,input){nativeCalls++;if(operation==='worker/authorize'&&input.capability==='synthetic-task-cap')return {binding:input.binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'native',scopes,selectedClientId:id(5),policyRevision:'policy1',authorizationDecisionId:'synthetic-worker-decision',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};throw Error('uncomposed');}},productPorts:{identityContext:identity,conversationMembership:gate}});
 const post=(path,body,credential='native')=>assembly.application.handle(new Request(`https://meri.invalid${path}`,{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body)}));
 const getStream=credential=>assembly.application.handle(new Request(`https://meri.invalid/api/conversations/events/${binding.conversationId}/stream`,{method:'GET',headers:{authorization:`Bearer ${credential}`,'x-meri-resume-sequence':'0'}}));
 return {...f,member,assembly,post,getStream,duringHistoryRead(callback){onHistoryRead=callback;},counts:()=>({starts,nativeCalls}),revoke(){revoked=true;member.status='removed';}};
}
async function issue(f){const response=await f.post('/api/action-followthrough/session',{});assert.equal(response.status,200);return (await response.json()).credential;}
async function allocate(f,credential,input){const response=await f.post('/api/conversations/input/allocate',input,credential);assert.equal(response.status,200);}
test('trusted startup composes canonical session, submit and membership history, with missing lifecycle owners refused before writes',async()=>{
 const f=fixture();try{
  const issued=await f.post('/api/action-followthrough/session',{});assert.equal(issued.status,200);const credential=(await issued.json()).credential;
  const input={requestId:id(6),prompt:'startup synthetic'};
  assert.equal((await f.post('/api/conversations/input/allocate',input,credential)).status,200);
  assert.equal((await f.post('/api/conversations/submit',input,credential)).status,200);
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

for(const [reason,change] of [['removed member',m=>m.status='removed'],['client removed',m=>m.clientIds=[]]])
 test(`${reason} cannot obtain an action session at assembled startup`,async()=>{
  const f=fixture();try{change(f.member);const response=await f.post('/api/action-followthrough/session',{});
   assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:{code:'SESSION_REFUSED'}});
   assert.equal(f.assembly.sessions.status().sessions,0);assert.equal(f.state.runs.size,0);assert.equal(f.allocations.size,0);assert.equal(f.counts().starts,0);
  }finally{f.assembly.close();}
 });

for(const [reason,change] of [['removed member',m=>m.status='removed'],['membership revision',m=>m.membershipRevision='m2'],['client roster',m=>m.clientIds=[]]])
 test(`${reason} after allocation refuses input admission and submit before a run or dispatch`,async()=>{
  const f=fixture();try{const credential=await issue(f),input={requestId:id(50),prompt:'qualified first chat'};await allocate(f,credential,input);change(f.member);
   for(const path of ['/api/conversations/input/admit','/api/conversations/submit']){const response=await f.post(path,input,credential);
    assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:{code:'SESSION_REFUSED'}});}
   assert.equal(f.state.runs.size,0);assert.equal(f.allocations.size,1);assert.equal(f.counts().starts,0);assert.equal(f.assembly.sessions.status().sessions,0);
  }finally{f.assembly.close();}
 });

for(const [reason,change] of [['removed member',m=>m.status='removed'],['membership revision',m=>m.membershipRevision='m2'],['client roster',m=>m.clientIds=[]]])
 test(`${reason} after dispatch refuses the old session's event stream and reload page`,async()=>{
  const f=fixture();try{const credential=await issue(f),input={requestId:id(51),prompt:'saved before membership change'};await allocate(f,credential,input);
   assert.equal((await f.post('/api/conversations/submit',input,credential)).status,200);assert.equal(f.state.runs.size,1);assert.equal(f.counts().starts,1);
   change(f.member);
   const stream=await f.getStream(credential);assert.equal(stream.status,403);assert.deepEqual(await stream.json(),{error:{code:'SESSION_REFUSED'}});
   const reload=await f.post('/api/conversations/history',{after:0,limit:10},credential);assert.equal(reload.status,403);assert.deepEqual(await reload.json(),{error:{code:'SESSION_REFUSED'}});
   assert.equal(f.state.runs.size,1);assert.equal(f.counts().starts,1);assert.equal(f.assembly.sessions.status().sessions,0);
  }finally{f.assembly.close();}
 });

test('membership revision changing during assembled transcript read withholds reload response',async()=>{
 const f=fixture();try{const credential=await issue(f),input={requestId:id(52),prompt:'saved transcript'};await allocate(f,credential,input);
  assert.equal((await f.post('/api/conversations/submit',input,credential)).status,200);
  f.duringHistoryRead(()=>{f.member.membershipRevision='m2';});
  const response=await f.post('/api/conversations/transcript',{conversationId:binding.conversationId});
  assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:{code:'MEMBERSHIP_CHANGED'}});
  assert.equal(f.state.runs.size,1);assert.equal(f.counts().starts,1);
 }finally{f.assembly.close();}
});

test('scripted worker delta streams publicly and reloads from the membership transcript',async()=>{
 const f=fixture();try{
  const credential=await issue(f),input={requestId:id(53),prompt:'What changed?'};await allocate(f,credential,input);
  assert.equal((await f.post('/api/conversations/submit',input,credential)).status,200);
  const publish=async(eventId,type,data)=>f.post('/internal/conversations/publish',{binding,event:{eventId,createdAt:new Date().toISOString(),type,data}},'synthetic-task-cap');
  for(const [eventId,state] of [[id(54),'starting'],[id(55),'running']])assert.equal((await publish(eventId,'run.status',{state,reasonCode:null})).status,200);
  assert.equal((await publish(id(56),'message.delta',{messageId:id(57),text:'Synthetic assistant answer'})).status,200);
  assert.equal((await publish(id(58),'run.status',{state:'completed',reasonCode:null})).status,200);
  const stream=await f.getStream(credential);assert.equal(stream.status,200);
  const wire=await stream.text();assert.match(wire,/Synthetic assistant answer/u);assert.match(wire,/message\.delta/u);
  const reload=await f.post('/api/conversations/transcript',{conversationId:binding.conversationId});assert.equal(reload.status,200);
  const saved=await reload.json();assert.equal(saved.turns[0].request.prompt,input.prompt);
  const delta=saved.events.find(row=>row.event.type==='message.delta')?.event;
  assert.equal(delta?.data.text,'Synthetic assistant answer');assert.equal(delta.eventId,id(56));
  assert.ok(wire.includes(`"eventId":"${delta.eventId}"`));assert.ok(wire.includes(`"sequence":${delta.sequence}`));
  assert.equal(wire.includes(credential),false);
  assert.equal(saved.latestRun.state,'completed');
 }finally{f.assembly.close();}
});
