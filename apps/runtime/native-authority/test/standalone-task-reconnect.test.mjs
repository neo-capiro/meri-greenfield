/** Actual initial-binding, conversation identity, opaque session, journal and HTTP owners; SQL and Core are scripted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {standaloneFixture,id} from './standalone-tasks-fixture.mjs';
import {initialInputFixture} from '../../../control/conversations/test/initial-input-fixture.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {createConversationIdentity} from '../../conversation-identity.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createStandaloneTaskApplication} from '../standalone-tasks.mjs';
import {receiveTaskCommandResponse} from '../../../../packages/contracts/dist/task-command-application.mjs';

async function fixture(t,general){
 const f=standaloneFixture({general}),db=initialInputFixture(),store=db.store(),now=db.now,b=f.binding,selectedClientId=general?null:id(5);
 const identity=createConversationIdentity({store,initialBindings:store.initialBindings,now,qualification:{policyRevision:f.scopes[0].policyRevision},versions,configurationSha256:'c'.repeat(64),proposeInitialExpiry:()=>now()+60000,factWindowMs:60000,
  limits:{maxRequestMs:3000,maxFactBytes:131072},nextRunOwner:{selectRun(){assert.fail('no accepted chat');},currentRun(){assert.fail('no accepted chat');}},
  identity:{origin:'https://core.synthetic.invalid',async fetchImpl(url){assert.equal(new URL(url).pathname,'/api/clio/application-authority/current');if(f.state.revoked)return Response.json({error:'denied'},{status:403});
   if(f.state.authorityDown)return Response.json({error:'unavailable'},{status:503});
   return Response.json({principal:{tenantId:b.tenantId,actorId:b.actorId},identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),role:'standard_user',permissions:[],clientIds:general?[]:[selectedClientId],conversationId:b.conversationId,selectedClientId,checkedAtMs:now(),expiresAtMs:now()+120000});}}});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,withAuthority:identity.withAuthority,now,limits:{maxSessions:10,maxRequestMs:3000,maxTtlMs:30000,maxFactBytes:131072}});t.after(()=>sessions.close());
 const issue=(runId)=>sessions.issue({identityCredential:'synthetic-native',hints:{conversationId:b.conversationId,clientId:selectedClientId,...(runId?{runId}:{})}});
 const app=createStandaloneTaskApplication({...f,context:{...f.context,now},sessions,store});
 const call=(session,route,body)=>app.handle(new Request('https://meri.invalid/api/task-commands/'+route,{method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {...f,db,store,issue,call,advance(ms){db.advance(ms);f.state.now+=ms;}};
}

for(const general of [false,true])test(`lost standalone ${general?'General':'client'} preparation response recovers after actual initial expiry and session rebind`,async t=>{
 const f=await fixture(t,general),first=await f.issue(),answer=await f.call(first,'prepare',f.raw);assert.equal(answer.status,200,await answer.clone().text());
 const prepared=await answer.json(),original=structuredClone(prepared.proposal.command.binding);assert.equal(f.metadata.rows.size,1);
 f.advance(61000);await assert.rejects(f.issue(first.context.runId));
 const next=await f.issue();assert.notEqual(next.context.runId,first.context.runId);assert.equal(f.db.bindings.length,2);
 await assert.rejects(f.store.initialBindings.readPreparation({binding:original},()=>{}));
 const replay=await f.call(next,'prepare',f.raw);assert.equal(replay.status,200,await replay.clone().text());assert.deepEqual(await replay.json(),prepared);
 assert.notEqual((await f.call(next,'prepare',{...f.raw,arguments:{...f.raw.arguments,title:'Changed'}})).status,200);
 assert.equal(f.metadata.rows.size,1);assert.equal(f.sql.state.rows.size,1);assert.equal(f.state.decisions,0);assert.equal(f.state.effects,0);
 assert.equal(f.db.state.runs.size,0);assert.equal(f.db.allocations.size,0);
 // Returning expired proposal text does not authorize a first execution after its approval window.
 assert.equal((await f.call(next,'execute',{proposal:prepared.proposal})).status,409);assert.equal(f.state.effects,0);
 f.state.revoked=true;assert.notEqual((await f.call(next,'prepare',f.raw)).status,200);
});

for(const state of ['PENDING','UNKNOWN'])test(`reconnected standalone ${state} preparation never dispatches again`,async t=>{
 const f=await fixture(t,false),first=await f.issue();assert.equal((await f.call(first,'prepare',f.raw)).status,200);
 const row=[...f.sql.state.rows.values()][0];row.state=state;row.outcome=null;
 f.advance(61000);const next=await f.issue(),before=f.metadata.rows.size;
 const answer=await f.call(next,'prepare',f.raw);assert.notEqual(answer.status,200);assert.equal((await answer.json()).error.outcome,'UNKNOWN');
 assert.equal(f.metadata.rows.size,before);assert.equal(f.sql.state.rows.size,1);assert.equal(f.state.effects,0);assert.equal(f.db.state.runs.size,0);
});

for(const operation of ['prepare','execute'])test(`standalone ${operation} preserves authority unavailability before dispatch`,async t=>{
 const f=await fixture(t,false),session=await f.issue();
 const body=operation==='prepare'?f.raw:{proposal:(await (await f.call(session,'prepare',f.raw)).json()).proposal};
 const before={metadata:f.metadata.rows.size,journal:f.sql.state.rows.size};
 f.state.authorityDown=true;
 const response=await f.call(session,operation,body),text=await response.text();
 assert.equal(response.status,502,text);
 const binding=Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(key=>[key,session.context[key]]));
 const expected={binding,...(operation==='prepare'?{request:body}:{proposal:body.proposal})};
 assert.deepEqual(await receiveTaskCommandResponse(operation,response.status,text,expected),{error:{code:'UNAVAILABLE',outcome:'NOT_DISPATCHED'}});
 assert.equal(f.metadata.rows.size,before.metadata);assert.equal(f.sql.state.rows.size,before.journal);
 assert.equal(f.state.decisions,0);assert.equal(f.state.effects,0);
});

test('standalone revoked and expired sessions remain authentication refusals before preparation',async t=>{
 const revoked=await fixture(t,false),session=await revoked.issue();revoked.state.revoked=true;
 const refusal=await revoked.call(session,'prepare',revoked.raw);
 assert.equal(refusal.status,401);assert.deepEqual(await refusal.json(),{error:{code:'UNAUTHENTICATED',outcome:'NOT_DISPATCHED'}});
 assert.equal(revoked.metadata.rows.size,0);assert.equal(revoked.sql.state.rows.size,0);assert.equal(revoked.state.effects,0);
 const expired=await fixture(t,false),old=await expired.issue();expired.advance(61000);expired.state.authorityDown=true;
 const stale=await expired.call(old,'prepare',expired.raw);
 assert.equal(stale.status,401);assert.deepEqual(await stale.json(),{error:{code:'UNAUTHENTICATED',outcome:'NOT_DISPATCHED'}});
 assert.equal(expired.metadata.rows.size,0);assert.equal(expired.sql.state.rows.size,0);assert.equal(expired.state.effects,0);
});
