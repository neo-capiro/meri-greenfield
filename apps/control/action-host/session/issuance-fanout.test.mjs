/** Core calls behind one session issuance (the client's renewal) and one turn's session observations, through the actual
 * issuance route, session owner, native identity context and Core membership gate that control composes (control.mjs,
 * agentcore-candidate.mjs). Scripted Core, no network, database or credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeIdentityContext} from '../../../runtime/native-authority/identity-context.mjs';
import {createCoreMembershipGate} from '../../product-access/core-membership.mjs';
import {createActionSessionOwner,authenticatedCurrentState} from './owner.mjs';
import {createActionSessionApplication} from './http.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(t){
 let at=1800000000000;const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const core={current:0,identity:0,membership:0,context:0},local={currentRun:0,admit:0},now=()=>at,limits={maxRequestMs:3000,maxFactBytes:65536};
 const principal={tenantId:'tenant',actorId:'actor'},member={role:'standard_user',permissions:[],clientIds:[id(5)],membershipRevision:'b'.repeat(64)};
 const fetchImpl=async(url,init)=>{
  const route=new URL(url).pathname.split('/').at(-1);assert.ok(Object.hasOwn(core,route),route);core[route]++;assert.equal(init.headers.authorization,'Bearer native');
  if(route==='identity')return Response.json({principal,identityRevision:'a'.repeat(64),checkedAtMs:at,expiresAtMs:at+120000});
  if(route==='membership')return Response.json({...principal,status:'active',...member,checkedAtMs:at,expiresAtMs:at+120000});
  return Response.json({principal,...member,identityRevision:'a'.repeat(64),contextRevision:'c'.repeat(64),conversationId:id(1),selectedClientId:id(5),checkedAtMs:at,expiresAtMs:at+120000});
 };
 const runFact=()=>JSON.stringify({binding,policyRevision:'policy',checkedAtMs:at,deadlineMs:at+100000});
 // The native owner alone. With routines enabled, control composes the scheduled wrapper over it (conversation-identity.mjs),
 // whose observe() first reads Core /identity to learn the tenant for its occurrence lookup; that wrapper imports the Temporal
 // client, so its extra call per observation is read from scheduled-conversation-identity.mjs, not measured here.
 const identity=createNativeIdentityContext({origin:'https://core.synthetic.invalid',fetchImpl,now,limits,enabled:true,admitInitialConversation:async()=>{local.admit++;return runFact();},currentOwner:{async currentRun(){local.currentRun++;return runFact();}}});
 const membership=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext:identity,fetchImpl,now,limits});
 const sessions=createActionSessionOwner({mode:'process-local',now,verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,withAuthority:identity.withAuthority,membership:{admit:membership.admit,recheck:membership.recheck},limits:{...limits,maxSessions:10,maxTtlMs:300000},refusals:()=>{}});
 t.after(()=>sessions.close());
 const app=createActionSessionApplication({owner:sessions,now,maxRequestMs:3000});
 const issue=()=>app.handle(new Request('http://127.0.0.1/api/action-followthrough/session',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:JSON.stringify({conversationId:id(1),clientId:id(5)})}));
 const snapshot=()=>({...core,...local});
 return {core,local,sessions,membership,issue,snapshot,observe:authenticatedCurrentState(sessions)};
}

test('one session issuance (the client renewal) is one Core authority call and no membership read',async t=>{
 const f=fixture(t),response=await f.issue();
 assert.equal(response.status,200);
 assert.deepEqual(f.snapshot(),{current:1,identity:0,membership:0,context:0,currentRun:2,admit:1},'identity and membership are projected from the one /current receipt; the run binding is read locally twice');
 const again=await f.issue();assert.equal(again.status,200);
 assert.deepEqual(f.snapshot(),{current:2,identity:0,membership:0,context:0,currentRun:4,admit:2},'a renewal is never served from an earlier receipt');
});

test('a turn repeats no membership read: each admission observes Core once fresh, read rechecks within 20 s reuse it',async t=>{
 const f=fixture(t),receipt=await (await f.issue()).json();
 // The conversation service and every lifecycle operation observe the session through this fused reader (service.mjs,
 // lifecycle/service.mjs): one owner resolve per admission, before and after the work.
 const before=await f.observe({credential:receipt.credential});
 assert.deepEqual(f.snapshot(),{current:2,identity:0,membership:0,context:0,currentRun:4,admit:2},'every recheck re-admits the conversation and re-reads the run binding locally (context-adapter.mjs resolve)');
 await f.sessions.readCurrentState({authentication:before.authentication});await f.sessions.readCurrentState({authentication:before.authentication});
 assert.deepEqual(f.snapshot(),{current:2,identity:0,membership:0,context:0,currentRun:8,admit:4},'read rechecks reuse the admission receipt; the local reads are never cached');
 await f.observe({credential:receipt.credential});
 assert.deepEqual(f.snapshot(),{current:3,identity:0,membership:0,context:0,currentRun:10,admit:5},'the closing admission is fresh again');
 // The 20 s reuse bound itself is monotonic-clock owned and proven in run-current-authority.test.mjs and s2-session.test.mjs.
 assert.equal(f.core.membership+f.core.identity+f.core.context,0,'no separate identity, context or membership read anywhere in the turn');
});

test('a product-access request (history, memory, settings, tasks, uploads) pays identity plus two membership reads with no session',async t=>{
 // The membership gate outside an action session has no /current receipt to project from: this is where the live
 // identity and membership volume comes from, and each read is the gate's own enforcement (admit, then recheck before release).
 const f=fixture(t),admitted=await f.membership.admit({credential:'native',deadlineMs:1800000000000+3000});
 assert.deepEqual(f.snapshot(),{current:0,identity:1,membership:1,context:0,currentRun:0,admit:0});
 await f.membership.recheck({principal:admitted.principal,credential:'native',deadlineMs:1800000000000+3000});
 assert.deepEqual(f.snapshot(),{current:0,identity:1,membership:2,context:0,currentRun:0,admit:0});
});
