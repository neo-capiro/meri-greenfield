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
function fixture(t,{ttlMs=120000}={}){
 let at=1800000000000;const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const core={current:0,identity:0,membership:0,context:0},state={refused:false},local={currentRun:0,admit:0},now=()=>at,limits={maxRequestMs:3000,maxFactBytes:65536};
 const principal={tenantId:'tenant',actorId:'actor'},member={role:'standard_user',permissions:[],clientIds:[id(5)],membershipRevision:'b'.repeat(64)};
 // Core's receipts expire `ttlMs` after they are checked: the minimum of the Clerk token's exp and Core's own receipt
 // lifetime (application-authority.ts APPLICATION_AUTHORITY_CURRENT_RECEIPT_TTL_MS). A revoked user answers 403 everywhere.
 const fetchImpl=async(url,init)=>{
  const route=new URL(url).pathname.split('/').at(-1);assert.ok(Object.hasOwn(core,route),route);core[route]++;assert.equal(init.headers.authorization,'Bearer native');
  if(state.refused)return Response.json({error:'Application authority unavailable'},{status:403});
  if(route==='identity')return Response.json({principal,identityRevision:'a'.repeat(64),checkedAtMs:at,expiresAtMs:at+ttlMs});
  if(route==='membership')return Response.json({...principal,status:'active',...member,checkedAtMs:at,expiresAtMs:at+ttlMs});
  return Response.json({principal,...member,identityRevision:'a'.repeat(64),contextRevision:'c'.repeat(64),conversationId:id(1),selectedClientId:id(5),checkedAtMs:at,expiresAtMs:at+ttlMs});
 };
 // The local run fact's deadline (conversation-identity.mjs fact(): the run's expiry within runWindowMs, 900 s on preview)
 // also bounds the session; keep it above the 300 s cap as on preview so the Core receipt and the cap decide below.
 const runFact=()=>JSON.stringify({binding,policyRevision:'policy',checkedAtMs:at,deadlineMs:at+900000});
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
 return {core,local,sessions,membership,issue,snapshot,observe:authenticatedCurrentState(sessions),advance:ms=>{at+=ms;},at:()=>at,revoke:()=>{state.refused=true;}};
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

// Renewal cadence. The session's cap is min(Core receipt expiry, sessions.maxTtlMs) (owner.mjs resolveFacts); the frontend
// ends an idle session RENEW_LEAD_MS (45 s) before that cap (opaque-session-controller.ts) and issues again. Every operation
// still re-verifies at Core: the cap only bounds how long an idle tab holds a session, never how long a revoked user keeps one.
const RENEW_LEAD_MS=45000,SESSION_CAP_MS=300000;
test('a 300 s Core receipt under the 300 s cap: one idle tab is one Core read per 255 s renewal and nothing in between',async t=>{
 const f=fixture(t,{ttlMs:300000}),started=f.at();
 const first=await (await f.issue()).json();
 assert.equal(first.expiresAtMs,started+SESSION_CAP_MS,'the Core receipt and the control cap coincide at 300 s');
 assert.deepEqual(f.snapshot(),{current:1,identity:0,membership:0,context:0,currentRun:2,admit:1});
 // Three idle renewals, each at cap - 45 s: exactly one fresh /current read per renewal, no identity or membership read.
 for(let renewal=1;renewal<=3;renewal++){
  f.advance(SESSION_CAP_MS-RENEW_LEAD_MS);
  const next=await (await f.issue()).json();
  assert.equal(next.expiresAtMs,f.at()+SESSION_CAP_MS);
  assert.deepEqual(f.snapshot(),{current:1+renewal,identity:0,membership:0,context:0,currentRun:2+2*renewal,admit:1+renewal},`renewal ${renewal}`);
 }
 assert.equal(f.at()-started,3*(SESSION_CAP_MS-RENEW_LEAD_MS),'765 s idle cost three renewals');
 // The first session reached its cap long ago: it refuses without asking Core and no longer counts against capacity.
 await assert.rejects(f.sessions.authenticateSession({credential:first.credential}),e=>e.code==='SESSION_REFUSED');
 assert.equal(f.core.current,4,'an expired session is refused locally');
 assert.equal(f.sessions.status().sessions,2,'the latest renewal and its predecessor, which keeps its last 45 s, are all that is held');
});
test('a shorter Core receipt, not the 300 s cap, bounds the session: 120 s (Core before PR 408) and a 60 s Clerk token',async t=>{
 for(const ttlMs of [120000,60000]){
  const f=fixture(t,{ttlMs}),receipt=await (await f.issue()).json();
  assert.equal(receipt.expiresAtMs,f.at()+ttlMs,`a ${ttlMs/1000} s receipt caps the session at ${ttlMs/1000} s, so the idle renewal came every ${(ttlMs-RENEW_LEAD_MS)/1000} s`);
  f.advance(ttlMs);
  await assert.rejects(f.sessions.authenticateSession({credential:receipt.credential}),e=>e.code==='SESSION_REFUSED');
  assert.equal(f.sessions.status().sessions,0);
 }
});
test('a revoked user loses the session at the next operation and the next renewal is refused, within the 300 s cap',async t=>{
 const f=fixture(t,{ttlMs:300000}),receipt=await (await f.issue()).json();
 await f.observe({credential:receipt.credential});
 assert.equal(f.sessions.status().sessions,1);
 f.revoke();f.advance(30000);
 // The next admission (a send, a lifecycle operation, the Files page) observes Core fresh and is refused definitively.
 await assert.rejects(f.observe({credential:receipt.credential}),e=>e.code==='SESSION_REFUSED');
 assert.equal(f.sessions.status().sessions,0,'a definitive Core refusal removes the session at once');
 await assert.rejects(f.sessions.authenticateSession({credential:receipt.credential}),e=>e.code==='SESSION_REFUSED');
 // The idle renewal at cap - 45 s cannot restore it.
 f.advance(SESSION_CAP_MS-RENEW_LEAD_MS-30000);
 const renewal=await f.issue();
 assert.equal(renewal.status,401);
 assert.equal(f.sessions.status().sessions,0);
 assert.equal(f.core.current,4,'each attempt after revocation still asked Core fresh and was refused there');
});
