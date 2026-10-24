/** MR-08 / E05ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“E06: fresh process-local sessions over the same canonical conversation journal. Core HTTP answers and SQL
 * persistence are synthetic; this proves owner composition, not native PostgreSQL, a browser, or a deployed identity service. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationIdentity as createPreparedCandidateIdentity} from '../conversation-identity.mjs';
import {createActionSessionOwner,issuedCurrentState} from '../../control/action-host/session/owner.mjs';
import {createNextRunOwner} from '../../control/conversations/next-run.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createConversationService} from '../../control/conversations/service.mjs';
import {createConversationEventSource} from '../../control/conversations/events.mjs';
import {applicationFixture,binding,scopes,versions,id} from '../../control/conversations/test/application-fixture.mjs';
import {isAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';

const clientId=scopes[0].resourceId,exact={conversationId:binding.conversationId,runId:binding.runId,clientId};
async function fixture(){
 const f=await applicationFixture({initialInput:true}),owners=[],state={offset:0,bearer:'synthetic-bearer-A',principal:{tenantId:binding.tenantId,actorId:binding.actorId},clientId,status:200};
 const now=()=>Date.now()+state.offset,effects={starts:0,cancels:0,reservations:0,retirements:0,revocations:0};let serial=900;
 await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
 const publish=(type,data)=>f.service.publish({credential:f.credential,binding,event:{eventId:id(serial++),createdAt:new Date().toISOString(),type,data}});
 for(const state of ['starting','running'])await publish('run.status',{state,reasonCode:null});
 await publish('message.delta',{messageId:id(890),text:'before reconnect'});
 function processOwner(){
  const stored=createPostgresConversationStore({pool:f.pool,now}),store={...stored,nextRuns:{...stored.nextRuns,async reserve(...args){effects.reservations++;return stored.nextRuns.reserve(...args);}}};
  const nextRunOwner=createNextRunOwner({store,versions,now,retirement:{async verifyRetired(){effects.retirements++;assert.fail('session renewal cannot retire a run');}},revocation:{async verifyRevoked(){effects.revocations++;assert.fail('session renewal cannot revoke grants');}}});
  const original={schemaVersion:1,state:'ADMITTED',binding,selectedClientId:clientId,policyRevision:scopes[0].policyRevision,versions,configurationSha256:'a'.repeat(64),createdAtMs:now()-1000,expiresAtMs:now()+900000};
  const initialBindings={async readConversation(){return original;},async claim(){assert.fail('renewal cannot claim');},async rebind(){assert.fail('started original cannot rebind');}};
  const identity=createPreparedCandidateIdentity({store,nextRunOwner,initialBindings,configurationSha256:original.configurationSha256,versions,proposeInitialExpiry:()=>now()+900000,now,factWindowMs:60000,qualification:{policyRevision:scopes[0].policyRevision},limits:{maxRequestMs:3000,maxFactBytes:131072},
   identity:{origin:'https://authority.synthetic.invalid',async fetchImpl(url,options){
    if(options.headers.authorization!==`Bearer ${state.bearer}`||state.status!==200)return Response.json({error:{code:'SYNTHETIC_REFUSAL'}},{status:state.status===200?401:state.status});
    const input=JSON.parse(options.body),base={principal:state.principal,identityRevision:'identity-1',checkedAtMs:now(),expiresAtMs:now()+10000};
    return Response.json(url.endsWith('/identity')?base:{...base,identitySha256:input.identitySha256,conversationId:binding.conversationId,selectedClientId:state.clientId,contextRevision:'context-1'});
   }}});
  const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,now,refusals(){},limits:{maxSessions:4,maxRequestMs:3000,maxTtlMs:10000,maxFactBytes:131072}});
  owners.push(sessions);
  const service=createConversationService({store,sessions,versions,now,dispatcher:{async start(){effects.starts++;},async cancel(){effects.cancels++;}}});
  return {sessions,service,issue:()=>issuedCurrentState(sessions)({identityCredential:state.bearer,hints:exact}),stream:(credential,after)=>createConversationEventSource({service,credential,after,now,pollMs:10,maxSubscriptionMs:3000}).getReader()};
 }
 const assertReadOnly=()=>{assert.deepEqual(effects,{starts:0,cancels:0,reservations:0,retirements:0,revocations:0});assert.equal(f.state.starts,1);assert.equal(f.state.cancels,0);assert.equal(f.state.runs.size,1);assert.equal(f.state.nextRuns.size,0);assert.equal(f.state.allocations.size,0);};
 return {f,state,now,publish,processOwner,assertReadOnly,close(){for(const owner of owners)owner.close();f.close();}};
}
async function drain(reader){const events=[];try{for(;;){const item=await reader.read();if(item.done)return events;events.push(item.value);}}finally{reader.releaseLock();}}

test('MR-08 renewed bearer after expiry and control restart resumes the exact cursor without a next turn or Stop',async t=>{
 const h=await fixture();t.after(h.close);const old=h.processOwner(),first=await old.issue();assert.deepEqual(first.current.binding,binding);
 const reader=old.stream(first.receipt.credential,3),seen=await reader.read();assert.equal(seen.value.sequence,4);await reader.cancel();reader.releaseLock();h.assertReadOnly();
 h.state.offset=first.receipt.expiresAtMs-Date.now()+1;h.state.bearer='synthetic-bearer-B';
 await assert.rejects(old.service.history({credential:first.receipt.credential}),{code:'SESSION_REFUSED'});old.sessions.close();
 await h.publish('message.delta',{messageId:id(890),text:'after reconnect'});await h.publish('run.status',{state:'failed',reasonCode:'EXECUTION_FAILED'});
 const fresh=h.processOwner(),second=await fresh.issue();assert.notEqual(second.receipt.credential,first.receipt.credential);assert.deepEqual(second.current.binding,binding);
 await assert.rejects(fresh.service.history({credential:first.receipt.credential}),{code:'SESSION_REFUSED'});
 const events=await drain(fresh.stream(second.receipt.credential,seen.value.sequence));assert.deepEqual(events.map(e=>e.sequence),[5,6]);assert.equal(events[0].data.text,'after reconnect');assert.equal(events[1].data.state,'failed');
 assert.equal(new Set([seen.value,...events].map(e=>e.eventId)).size,3);assert.deepEqual((await fresh.service.history({credential:second.receipt.credential})).run.binding,binding);h.assertReadOnly();
 t.diagnostic(JSON.stringify({tier:'synthetic Core/SQL',binding,versions,requestId:h.f.input.requestId,eventIds:[seen.value,...events].map(e=>e.eventId),cursor:seen.value.sequence,resumedSequences:events.map(e=>e.sequence),runState:'failed',runs:h.f.state.runs.size,reservations:h.f.state.nextRuns.size,allocations:h.f.state.allocations.size,starts:h.f.state.starts,cancels:h.f.state.cancels}));
});

for(const change of ['tenant','actor','client'])test(`MR-08 changed ${change} refuses retained and renewed sessions before scoped stream bytes`,async t=>{
 const h=await fixture();t.after(h.close);const old=h.processOwner(),first=await old.issue();
 if(change==='client')h.state.clientId=id(991);else h.state.principal={...h.state.principal,[change==='tenant'?'tenantId':'actorId']:'foreign'};
 await assert.rejects(old.service.history({credential:first.receipt.credential}),{code:'SESSION_REFUSED'});
 const stream=old.stream(first.receipt.credential,3);try{await assert.rejects(stream.read(),/SUBSCRIPTION_UNAVAILABLE/);}finally{stream.releaseLock();}
 h.state.bearer='synthetic-new-identity';const fresh=h.processOwner();await assert.rejects(fresh.issue(),{code:'SESSION_REFUSED'});assert.equal(fresh.sessions.status().sessions,0);h.assertReadOnly();
});

test('MR-08 transient Core503 withholds history and stream, then exact recovery works; revocation removes the session',async t=>{
 const h=await fixture();t.after(h.close);await h.publish('run.status',{state:'failed',reasonCode:'EXECUTION_FAILED'});
 const process=h.processOwner(),issued=await process.issue();h.state.status=503;
 await assert.rejects(process.service.history({credential:issued.receipt.credential}),error=>error.code==='SESSION_AUTHORITY_UNAVAILABLE'&&isAuthorityUnavailable(error));
 const stream=process.stream(issued.receipt.credential,3);try{await assert.rejects(stream.read(),/SUBSCRIPTION_UNAVAILABLE/);}finally{stream.releaseLock();}
 assert.equal(process.sessions.status().sessions,1);h.state.status=200;
 assert.deepEqual((await process.service.history({credential:issued.receipt.credential})).run.binding,binding);
 assert.deepEqual((await drain(process.stream(issued.receipt.credential,3))).map(e=>e.sequence),[4,5]);
 h.state.status=403;await assert.rejects(process.service.history({credential:issued.receipt.credential}),{code:'SESSION_REFUSED'});assert.equal(process.sessions.status().sessions,0);
 await assert.rejects(h.processOwner().issue(),{code:'SESSION_REFUSED'});h.assertReadOnly();
});
