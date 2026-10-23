/** Source-only composed control session + current transport; scripted Core, no native/live claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeIdentityContext} from '../identity-context.mjs';
import {createCoreMembershipGate} from '../../../control/product-access/core-membership.mjs';
import {createActionSessionOwner,borrowedRunSession} from '../../../control/action-host/session/owner.mjs';
import {createCapiroApplicationAuthorityClient} from '../../../control/action-host/application-adapters/authority-http.mjs';
import {createTurnTelemetry} from '../../telemetry/turn-context.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(t){
 const at=1800000000000,binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},state={calls:[],local:0,status:200};
 const now=()=>at,limits={maxRequestMs:3000,maxFactBytes:65536},fetchImpl=async(url,init)=>{state.calls.push({url,init});assert.ok(url.endsWith('/current'));assert.equal(init.headers.authorization,'Bearer native');if(state.status!==200)return Response.json({}, {status:state.status});return Response.json({principal:{tenantId:'tenant',actorId:'actor'},role:'standard_user',permissions:['memory.propose.firm'],clientIds:[id(5)],identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:state.contextRevision??'c'.repeat(64),conversationId:id(1),selectedClientId:id(5),checkedAtMs:at,expiresAtMs:at+120000});};
 const identity=createNativeIdentityContext({origin:'https://core.synthetic.invalid',fetchImpl,now,limits,enabled:true,commandContext:{binding,clientResolution:{reference:id(5),clientId:id(5)}},currentOwner:{async currentRun(){state.local++;return JSON.stringify({binding,policyRevision:'policy',checkedAtMs:at,deadlineMs:at+100000});}}});
 const membership=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext:identity,fetchImpl,now,limits});
 const sessions=createActionSessionOwner({mode:'process-local',now,verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,withAuthority:identity.withAuthority,membership:{admit:membership.admit,recheck:membership.recheck},limits:{...limits,maxSessions:10,maxTtlMs:100000},refusals:()=>{}});t.after(()=>sessions.close());
 return {state,sessions,binding,now,fetchImpl,identity,async issue(){return sessions.issue({identityCredential:'native'});}};
}
test('S2 one combined observation serves issuance; read rechecks still read the local run',async t=>{
 const f=fixture(t),s=await f.issue();assert.equal(f.state.calls.length,1);assert.equal(f.state.local,2);
 const a=await f.sessions.authenticateSession({credential:s.credential});assert.equal(f.state.calls.length,2,'admission authentication is always fresh');const local=f.state.local;
 await f.sessions.readCurrentState({authentication:a});await f.sessions.readCurrentState({authentication:a});assert.equal(f.state.calls.length,2,'read rechecks reuse');assert.equal(f.state.local,local+4,'no local current-run check was cached');
 await f.sessions.authenticateSession({credential:s.credential});assert.equal(f.state.calls.length,3,'the next effect admission must call fresh');
});
test('S2 borrows the originating session for the same run, never another run, and revocation removes it',async t=>{
 const f=fixture(t),s=await f.issue(),borrow=borrowedRunSession(f.sessions),input={binding:f.binding,selectedClientId:id(5)};
 assert.equal(borrow(input).credential,s.credential);assert.equal(borrow(input).credential,s.credential);assert.equal(f.sessions.status().sessions,1);
 // Live: the session is issued before the worker takes the run, so the runner's attempt/worker/fence differ (run row owns the fence).
 for(const binding of [{...f.binding,attemptId:id(8)},{...f.binding,workerId:id(10)},{...f.binding,writerFence:2}])assert.equal(borrow({...input,binding}).credential,s.credential);
 for(const binding of [{...f.binding,runId:id(9)},{...f.binding,conversationId:id(11)},{...f.binding,actorId:'other'}])assert.throws(()=>borrow({...input,binding}));
 assert.throws(()=>borrow({...input,selectedClientId:id(7)}));f.sessions.revoke(s.credential);assert.throws(()=>borrow(input));assert.equal(f.sessions.status().sessions,0);
});
test('S2 fresh admission403 invalidates the session while503 refuses without stale fallback',async t=>{
 for(const status of [403,503]){const f=fixture(t),s=await f.issue(),a=await f.sessions.authenticateSession({credential:s.credential});f.state.status=status;
  await assert.rejects(f.sessions.authenticateSession({credential:s.credential}));await assert.rejects(f.sessions.readCurrentState({authentication:a}));assert.equal(f.sessions.status().sessions,status===403?0:1);
 }
});
test('S2 current transport keeps401/403/409/503 distinct and never retries',async t=>{
 const f=fixture(t),client=createCapiroApplicationAuthorityClient({origin:'https://core.synthetic.invalid',fetchImpl:f.fetchImpl,now:f.now,enabled:true,limits:{maxRequestMs:3000,maxResponseBytes:65536}});
 for(const status of [401,403,409,503]){f.state.status=status;const count=f.state.calls.length;await assert.rejects(client.readCurrent({credential:'native',conversationId:id(1),clientId:id(5),deadlineMs:f.now()+3000}),e=>e.status===status);assert.equal(f.state.calls.length,count+1);}
});
test('S2 owner and control counters separate fresh calls from reused observations',async t=>{
 const f=fixture(t),lines=[],telemetry=createTurnTelemetry({service:'control',now:f.now,write:line=>lines.push(JSON.parse(line))});t.after(()=>telemetry.close());
 await telemetry.within(f.binding,async()=>{const s=await f.issue(),a=await f.sessions.authenticateSession({credential:s.credential});await f.sessions.readCurrentState({authentication:a});});
 const counts=telemetry.counters(f.binding);assert.equal(counts.authorityFresh,2);assert.ok(counts.authorityReuses>=1);assert.equal(f.state.calls.length,2);telemetry.close();
 assert.ok(lines.some(l=>l.authorityFresh===2&&l.authorityReuses>=1));
});
test('S2 a session recheck reuses only its own fenced receipt and never pins revisions',async t=>{
 const f=fixture(t);await f.issue();
 const observe=(extra={})=>f.identity.withAuthority({credential:'native',binding:f.binding,sessionFence:'session:revision',hints:{conversationId:id(1),clientId:id(5)},deadlineMs:f.now()+3000,...extra},()=>true);
 const first=f.state.calls.length;await observe();const count=f.state.calls.length;assert.equal(count,first+1);
 await observe();assert.equal(f.state.calls.length,count,'the same session fence reuses its receipt');
 await observe({sessionFence:'other:revision'});assert.equal(f.state.calls.length,count+1,'another session fence reads Core fresh');
 await observe({fresh:true});assert.equal(f.state.calls.length,count+2,'a fresh recheck always reads Core');
 for(const call of f.state.calls.slice(first))assert.equal(JSON.parse(call.init.body).expect,undefined,'no revision pins are sent');
 f.state.status=401;await assert.rejects(observe({fresh:true}),'Core refusing the credential refuses the recheck');
});
test('S2 one caller cancelling does not discard a concurrent fresh positive',async t=>{
 const f=fixture(t);await f.issue();
 const ac=new AbortController(),args=extra=>({credential:'native',binding:f.binding,sessionFence:'session:revision',fresh:true,hints:{conversationId:id(1),clientId:id(5)},deadlineMs:f.now()+3000,...extra});
 const cancelled=f.identity.withAuthority(args({signal:ac.signal}),()=>true),kept=f.identity.withAuthority(args({}),()=>true);ac.abort();
 await assert.rejects(cancelled);assert.equal(await kept,true);
});
