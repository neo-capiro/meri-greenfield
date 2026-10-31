/** Real session/current adapters; only Core HTTP and durable run storage are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNativeIdentityContext} from '../identity-context.mjs';
import {createRunCurrentAuthority} from '../run-current-authority.mjs';
import {createCoreConversationCurrentness} from '../conversation-currentness.mjs';
import {createActionSessionOwner,borrowedRunSession} from '../../../control/action-host/session/owner.mjs';
import {createActionSessionApplication} from '../../../control/action-host/session/http.mjs';
import {createNativeToolAuthorityClient} from '../../read-context/core-client.mjs';
import {validSessionReceipt} from '../../../../packages/contracts/session-receipt/validate.mjs';
import {createConversationHistoryService} from '../../../control/conversations/history/service.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenantId=id(20),actorId=id(21);
const capture=(name='Captured research',revision=2)=>{
 const fields={kind:'research_portfolio',researchPortfolioId:id(8),researchPortfolioName:name,researchPortfolioRevision:revision};
 return {...fields,scopeVersion:createHash('sha256').update(JSON.stringify(fields)).digest('hex')};
};
const scope=capture(),subject={scopeKind:'research_portfolio',scope};
function fixture(t){
 const at=1800000000000,now=()=>at,binding={tenantId,actorId,conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const state={calls:[],status:200,subject:scope,local:0},limits={maxRequestMs:3000,maxFactBytes:65536};
 const receipt=()=>({principal:{tenantId,actorId},role:'standard_user',permissions:[],clientIds:[id(5)],identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:id(1),selectedClientId:null,checkedAtMs:at,expiresAtMs:at+120000,
  researchPortfolio:{...state.subject,currentResearchPortfolioName:'Current research',currentResearchPortfolioRevision:4,stale:true,resourceRevision:'d'.repeat(64)}});
 const fetchImpl=async(url,init)=>{const body=JSON.parse(init.body);state.calls.push(body);assert.ok(url.endsWith('/current'));assert.equal(body.scopeKind,'research_portfolio');
  if(state.status!==200)return Response.json({}, {status:state.status});return Response.json(receipt());};
 const run=()=>JSON.stringify({binding,policyRevision:'policy',checkedAtMs:at,deadlineMs:at+100000});
 const identity=createNativeIdentityContext({origin:'https://core.synthetic.invalid',fetchImpl,now,limits,enabled:true,
  admitInitialConversation:async input=>{await state.beforeAdmit?.();await input.recheckActive();return run();},
  currentOwner:{async currentRun(){state.local++;return run();}}});
 const sessions=createActionSessionOwner({mode:'process-local',now,verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,
  withAuthority:identity.withAuthority,limits:{...limits,maxSessions:10,maxTtlMs:100000},refusals:()=>{}});t.after(()=>sessions.close());
 const hints={conversationId:binding.conversationId,clientId:null,...subject};
 const issue=()=>sessions.issue({identityCredential:'native',hints});
 return {state,now,binding,limits,fetchImpl,receipt,sessions,hints,issue};
}
test('Research session retains exact five-field capture, private-user storage and explicit public opt-in',async t=>{
 const f=fixture(t),session=await f.issue();assert.deepEqual(session.context.scope,scope);assert.equal(session.context.scopeKind,'research_portfolio');
 assert.equal(validSessionReceipt(session,f.now(),{general:true}),false);assert.equal(validSessionReceipt(session,f.now(),{research:true}),true);
 const authentication=await f.sessions.authenticateSession({credential:session.credential}),current=await f.sessions.readCurrentState({authentication});
 assert.deepEqual(current.scope,scope);assert.deepEqual(current.scopes,[{kind:'private-user',tenantId,resourceId:actorId,policyRevision:'policy'}]);
 assert.deepEqual(borrowedRunSession(f.sessions)({binding:f.binding,selectedClientId:null}).context.scope,scope);
 const ordinary=f.sessions.nativeCredentialFor({binding:f.binding,selectedClientId:null});assert.deepEqual(Object.keys(ordinary),['credential','expiresAtMs']);
 const explicit=f.sessions.nativeCredentialFor({binding:f.binding,selectedClientId:null,includeSubject:true});assert.deepEqual(explicit.scope,scope);
});
test('Research refusal after the initial-binding await withholds session issuance',async t=>{
 const f=fixture(t);f.state.beforeAdmit=()=>{f.state.status=403;};await assert.rejects(f.issue());assert.equal(f.sessions.status().sessions,0);
 assert.equal(f.state.calls.length,2);
});
test('Research capture changes during a later fresh observation refuse and invalidate the old session',async t=>{
 const f=fixture(t),session=await f.issue();f.state.subject=capture('Changed capture',3);
 await assert.rejects(f.sessions.authenticateSession({credential:session.credential}));assert.equal(f.sessions.status().sessions,0);
});
test('Research HTTP issuance carries the closed capture and refuses absent opt-in',async t=>{
 const f=fixture(t),app=createActionSessionApplication({owner:f.sessions,now:f.now,maxRequestBytes:65536,maxRequestMs:3000});
 const post=hints=>app.handle(new Request('https://control.synthetic.invalid/api/action-followthrough/session',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:JSON.stringify(hints)}));
 const response=await post(f.hints);assert.equal(response.status,200);assert.deepEqual((await response.json()).context.scope,scope);
 assert.equal((await post({conversationId:f.binding.conversationId,clientId:null})).status,401);
 assert.equal((await post({...f.hints,scope:undefined})).status,401);
});
test('Research cache entries are isolated from General and from another exact capture',async t=>{
 const f=fixture(t),calls=[];const owner=createRunCurrentAuthority({now:f.now,monotonic:()=>0,client:{
  readCurrent:async()=>{calls.push('general');throw Object.assign(Error('refused'),{status:403});},
  readResearchCurrent:async()=>{calls.push('research');return f.receipt();}}});
 const request={credential:'native',binding:f.binding,selectedClientId:null,sessionFence:'test',deadlineMs:f.now()+3000};
 await owner.read({...request,...subject});await owner.read({...request,...subject});assert.deepEqual(calls,['research']);
 await assert.rejects(owner.read(request));await assert.rejects(owner.read({...request,...subject,scope:capture('Other',3)}));
 assert.deepEqual(calls,['research','general','research']);
});
test('Research current transport cannot fall back to General on Core refusal',async t=>{
 const f=fixture(t),client=createNativeToolAuthorityClient({origin:'https://core.synthetic.invalid',fetchImpl:f.fetchImpl,now:f.now,enabled:true,binding:f.binding,selectedClientId:null});
 const request={credential:'native',deadlineMs:f.now()+3000,...subject};
 const current=await client.readCurrent(request);assert.deepEqual(current.scope,scope);assert.equal(current.researchPortfolio.currentResearchPortfolioRevision,4);
 assert.equal(current.researchPortfolio.stale,true);assert.equal(current.contextRevision,'c'.repeat(64));
 f.state.status=403;await assert.rejects(client.readCurrent(request));assert.equal(f.state.calls.length,2);
 f.state.status=200;f.state.subject=capture('Other',3);await assert.rejects(client.readCurrent(request));
});
test('Research history currentness uses fresh explicit current and rejects a substituted capture',async t=>{
 const f=fixture(t),owner=createCoreConversationCurrentness({origin:'https://core.synthetic.invalid',fetchImpl:f.fetchImpl,now:f.now,limits:f.limits});
 const call={credential:'native',principal:{tenantId,actorId,clientIds:[],membershipRevision:'b'.repeat(64)},conversationId:f.binding.conversationId,
  scopes:[{kind:'private-user',tenantId,resourceId:actorId,policyRevision:'policy'}],deadlineMs:f.now()+3000,...subject};
 await owner.assertCurrent(call);await owner.assertCurrent(call);assert.equal(f.state.calls.length,2);
 f.state.subject=capture('Other',3);await assert.rejects(owner.assertCurrent(call));
});
test('Research summary release rejects capture replacement after the initial observation',async()=>{
 const row={conversationId:id(1),clientId:null,...subject},store={history:{list(){},transcript(){}}};
 const service=createConversationHistoryService({store,gate:{recheck(){}}});let published=false;
 const value={operation:'summaries',result:{conversations:[row]},request:{},recheckMembership:async()=>{},
  management:{metadata:async()=>({...row,scope:capture('Replacement',3)})},publish(){published=true;}};
 await assert.rejects(service.recheckRelease(value));assert.equal(published,false);
 value.management.metadata=async()=>({...row,scope:{...scope}});await service.recheckRelease(value);assert.equal(published,true);
});
