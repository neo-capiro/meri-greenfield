/** SYNTHETIC: the Core P-INT-10 approval forwarder over the actual action-session owner (live native credential relay), the
 * actual native decision adapter (`createNativeIntentApprovals`) as the consumer, and a scripted Core that follows the b7c6e9cf
 * `NativeApprovalService` rules. No socket, live Core, database, key material or credential provisioning. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {applicationFixture,binding,scopes,id} from '../../../control/conversations/test/application-fixture.mjs';
import {createNativeIntentApprovals} from '../../../control/intents/native-approvals.mjs';
import {createRoutinesServiceSecret} from '../routines-core-client.mjs';
import {createCoreApprovalForwarder,createReservedCredentialDigests,registerApprovalSessionBinder,bindApprovalSessions,CORE_APPROVAL_ROUTES} from '../approval-forwarder.mjs';
import {approvalCore,CORE_ORIGIN,SECRET} from './approval-core-fixture.mjs';
const NATIVE='synthetic-native',CONTROL='synthetic-control-capability',principal={tenantId:binding.tenantId,actorId:binding.actorId};
const code=c=>e=>e?.code===c;
function proposalFor(b=binding,extra={}){
 const command={contractVersion:'0.1.0',commandId:id(200),binding:b,action:'task.create',arguments:{title:'Synthetic proposed task'},attachments:[],scopes,idempotencyKey:'immutable-task'};
 return {proposalId:id(201),command,commandSha256:hash(command),createdAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+30000).toISOString(),requiredApprover:principal,...extra};
}
export async function harness({selectedClientId,relay,readSecret}={}){
 const f=await applicationFixture(),core={requests:[],bearers:{[NATIVE]:{tenantId:binding.tenantId,userId:binding.actorId}},coreNow:()=>7,rewrite:null},synthetic=approvalCore(core);
 const proposals=new Map(),proposal=proposalFor();proposals.set(proposal.proposalId,proposal);
 const reads=[],secrets={'/run/meri/core-approvals':SECRET+'\n','/run/meri/control':CONTROL};
 const read=readSecret??(async path=>{reads.push(path);if(!(path in secrets))throw Error('missing');return Buffer.from(secrets[path]);});
 const getServiceSecret=createRoutinesServiceSecret({file:'/run/meri/core-approvals',reservedFiles:['/run/meri/control'],readSecret:read});
 const reservedCredentials=createReservedCredentialDigests({files:['/run/meri/control'],readSecret:read});
 const custody=[];
 const readProposal=async({tenantId,actorId,conversationId,proposalId})=>{custody.push(proposalId);const p=proposals.get(proposalId);if(!p||p.command.binding.tenantId!==tenantId||p.command.binding.actorId!==actorId||p.command.binding.conversationId!==conversationId)return null;return structuredClone(p);};
 const forwarder=createCoreApprovalForwarder({origin:CORE_ORIGIN,nativeCredentials:relay??f.sessions,getServiceSecret,reservedCredentials,readProposal,now:Date.now,fetchImpl:synthetic.fetchImpl,maxRequestMs:5000,...(selectedClientId===undefined?{}:{selectedClientId})});
 const decide=(decision='approved',p=proposal)=>forwarder.record({proposal:p,decision,approver:principal,binding:p.command.binding});
 return {f,core,synthetic,proposal,proposals,secrets,reads,custody,forwarder,decide,close:f.close};
}
test('record forwards the attended request byte for byte and returns a Meri-stamped, correlated receipt',async t=>{
 const h=await harness();t.after(h.close);
 const started=Date.now(),receipt=await h.decide();
 assert.deepEqual(Object.keys(receipt),['decision','checkedAtMs','revoked']);assert.ok(Object.isFrozen(receipt));
 assert.equal(receipt.decision.decision,'approved');assert.equal(receipt.decision.proposalId,h.proposal.proposalId);assert.equal(receipt.decision.commandSha256,h.proposal.commandSha256);
 assert.deepEqual(receipt.decision.approver,principal);assert.equal(receipt.decision.policyRevision,scopes[0].policyRevision);assert.equal(receipt.revoked,false);
 assert.ok(receipt.checkedAtMs>=started,'Meri clock, not Core\'s checkedAtMs 7');assert.notEqual(receipt.checkedAtMs,7);
 const sent=h.core.requests[0];assert.equal(sent.url,CORE_ORIGIN+CORE_APPROVAL_ROUTES.record);
 assert.equal(sent.headers.authorization,'Bearer '+NATIVE);assert.equal(sent.headers['x-internal-service-secret'],SECRET);
 assert.deepEqual(Object.keys(sent.body).sort(),['approver','binding','decision','proposal']);assert.deepEqual(sent.body.proposal,h.proposal);assert.deepEqual(sent.body.binding,binding);
 assert.ok(!JSON.stringify(sent).includes(h.f.credential),'the action-session credential never leaves');
 // The reserved digests and the secret getter each read the control file once (digests only are kept), then the secret per call.
 assert.deepEqual(h.reads,['/run/meri/control','/run/meri/control','/run/meri/core-approvals']);assert.deepEqual(h.custody,[h.proposal.proposalId]);
 await h.decide();assert.deepEqual(h.reads.slice(3),['/run/meri/core-approvals']);
});
test('record is idempotent on (proposalId, decision): concurrent repeats coalesce, later repeats answer the stored decision',async t=>{
 const h=await harness();t.after(h.close);
 const [a,b]=await Promise.all([h.decide(),h.decide()]);assert.equal(h.core.requests.length,1);assert.deepEqual(a.decision,b.decision);
 const again=await h.decide();assert.equal(h.core.requests.length,2);assert.deepEqual(again.decision,a.decision);
 // A flipped repeat is answered with the stored decision (approval.mjs refuses the mismatch); nothing is re-recorded.
 const flipped=await h.decide('rejected');assert.equal(flipped.decision.decision,'approved');assert.equal(h.synthetic.decisions.size,1);
});
test('decision reads bind to Meri custody and answer null before, the decision after; the native adapter consumes the seam unchanged',async t=>{
 const h=await harness();t.after(h.close);
 const adapter=createNativeIntentApprovals({call:(operation,input,options)=>h.forwarder.call(operation,input,options),now:Date.now,maxFactBytes:65536});
 const selection={proposalId:h.proposal.proposalId,commandSha256:h.proposal.commandSha256,binding};
 assert.equal(await adapter.readDecision(selection),null);await assert.rejects(adapter.getCurrent(selection),/COMMAND_APPROVAL_REFUSED/);
 assert.equal(h.core.requests.at(-1).url,CORE_ORIGIN+CORE_APPROVAL_ROUTES.decision);assert.deepEqual(h.core.requests.at(-1).body,selection);
 await h.decide();
 const d=await adapter.readDecision(selection);assert.equal(d.decision,'approved');
 const current=JSON.parse(await adapter.getCurrent(selection));assert.equal(current.decision.proposalId,h.proposal.proposalId);assert.equal(current.revoked,false);assert.ok(current.checkedAtMs>7);
 // A fresh executor attempt names the same run: stable keys only.
 const attempt={...binding,attemptId:id(77),workerId:id(78)};assert.equal((await h.forwarder.readDecision({...selection,binding:attempt})).decision,'approved');
 await assert.rejects(h.forwarder.readDecision({...selection,binding:{...binding,runId:id(79)}}),code('ACCESS_DENIED'));
 await assert.rejects(h.forwarder.readDecision({...selection,commandSha256:'f'.repeat(64)}),code('ACCESS_DENIED'));
 await assert.rejects(h.forwarder.readDecision({...selection,proposalId:id(202)}),code('ACCESS_DENIED'));
});
test('approval/read serves the retained proposal for its exact run and scopes only',async t=>{
 const h=await harness();t.after(h.close);
 assert.deepEqual(await h.forwarder.call('approval/read',{proposalId:h.proposal.proposalId,binding,scopes},{}),h.proposal);
 await assert.rejects(h.forwarder.read({proposalId:h.proposal.proposalId,binding:{...binding,runId:id(79)},scopes}),code('ACCESS_DENIED'));
 await assert.rejects(h.forwarder.read({proposalId:h.proposal.proposalId,binding,scopes:[{...scopes[0],resourceId:id(9)}]}),code('ACCESS_DENIED'));
 await assert.rejects(h.forwarder.call('checkpoint/read',{},{}),code('UNAVAILABLE'));assert.equal(h.core.requests.length,0);
});
for(const [name,mutate] of [
 ['approver other than the required approver',p=>({approver:{tenantId:binding.tenantId,actorId:'reviewer'}})],
 ['binding other than the proposal command binding',p=>({binding:{...binding,runId:id(79)}})],
 ['proposal unknown to Meri custody',p=>({proposal:proposalFor(binding,{proposalId:id(202)})})],
 ['proposal differing from the retained one',p=>({proposal:{...p,expiresAt:new Date(Date.now()+60000).toISOString()}})],
])test(`${name} is refused before any Core request with effect none`,async t=>{
 const h=await harness();t.after(h.close);
 const error=await h.forwarder.record({proposal:h.proposal,decision:'approved',approver:principal,binding,...mutate(h.proposal)}).then(()=>null,e=>e);
 assert.equal(error?.code,'ACCESS_DENIED');assert.equal(error.effect,'none');assert.equal(h.core.requests.length,0);
});
test('a required approver who is not the conversation owner is refused locally (Core would refuse it too)',async t=>{
 const h=await harness();t.after(h.close);
 const p=proposalFor(binding,{requiredApprover:{tenantId:binding.tenantId,actorId:'reviewer'}});h.proposals.set(p.proposalId,p);
 await assert.rejects(h.forwarder.record({proposal:p,decision:'approved',approver:{tenantId:binding.tenantId,actorId:'reviewer'},binding}),code('ACCESS_DENIED'));assert.equal(h.core.requests.length,0);
});
test('no live approver session refuses ACCESS_DENIED before any request; a session revoked during the secret read never reaches Core',async t=>{
 const h=await harness();t.after(h.close);
 h.f.sessions.revoke(h.f.credential);
 const error=await h.decide().then(()=>null,e=>e);assert.equal(error?.code,'ACCESS_DENIED');assert.equal(error.effect,'none');assert.equal(h.core.requests.length,0);
 const g=await harness({readSecret:async path=>{if(path==='/run/meri/core-approvals')g.f.sessions.revoke(g.f.credential);return Buffer.from(path==='/run/meri/control'?CONTROL:SECRET);}});t.after(g.close);
 await assert.rejects(g.decide(),code('ACCESS_DENIED'));assert.equal(g.core.requests.length,0);
});
test('the marked control credential is never forwarded, as bearer or as service secret',async t=>{
 const substituted=await harness({relay:{nativeCredentialFor(){return {credential:CONTROL,expiresAtMs:Date.now()+30000};}}});t.after(substituted.close);
 const error=await substituted.decide().then(()=>null,e=>e);assert.equal(error?.code,'ACCESS_DENIED');assert.equal(error.effect,'none');assert.equal(substituted.core.requests.length,0);
 const swapped=await harness({readSecret:async()=>Buffer.from(CONTROL)});t.after(swapped.close);
 await assert.rejects(swapped.decide(),code('UNAVAILABLE'));assert.equal(swapped.core.requests.length,0);
 // A service-only call does not exist: the relay is required at construction.
 assert.throws(()=>createCoreApprovalForwarder({origin:CORIGIN(),getServiceSecret:async()=>SECRET,now:Date.now}),code('APPROVAL_FORWARDER_CONFIGURATION'));
 function CORIGIN(){return CORE_ORIGIN;}
});
test('Core refusals, outages, malformed and uncorrelated answers refuse with the typed code and effect',async t=>{
 const h=await harness();t.after(h.close);
 const outcome=async()=>h.decide().then(()=>null,e=>({code:e.code,effect:e.effect}));
 h.core.rewrite=()=>[403,{message:'refused'}];assert.deepEqual(await outcome(),{code:'ACCESS_DENIED',effect:'none'});
 h.core.rewrite=()=>[409,{message:'conflict'}];assert.deepEqual(await outcome(),{code:'REFUSED',effect:'none'});
 h.core.rewrite=()=>[500,{message:'down'}];assert.deepEqual(await outcome(),{code:'UNAVAILABLE',effect:'unknown'});
 h.core.rewrite=()=>[200,{message:'wrong shape'}];assert.deepEqual(await outcome(),{code:'UNAVAILABLE',effect:'unknown'});
 h.core.rewrite=(status,body)=>[status,{...body,decision:{...body.decision,proposalId:id(202)}}];assert.deepEqual(await outcome(),{code:'UNAVAILABLE',effect:'unknown'});
 h.core.rewrite=(status,body)=>[status,{...body,decision:{...body.decision,policyRevision:'policy2'}}];assert.deepEqual(await outcome(),{code:'UNAVAILABLE',effect:'unknown'});
 h.core.rewrite=(status,body)=>[status,{...body,revoked:'no'}];assert.deepEqual(await outcome(),{code:'UNAVAILABLE',effect:'unknown'});
 h.core.rewrite=null;h.core.contentType='text/plain';assert.deepEqual(await outcome(),{code:'UNAVAILABLE',effect:'unknown'});delete h.core.contentType;
 h.core.serviceSecret='rotated-elsewhere';assert.deepEqual(await outcome(),{code:'ACCESS_DENIED',effect:'none'});delete h.core.serviceSecret;
 h.core.bearers={};assert.deepEqual(await outcome(),{code:'ACCESS_DENIED',effect:'none'});
});
test('a session revoked after Core answered withholds the receipt as an unknown effect',async t=>{
 const h=await harness();t.after(h.close);
 h.core.rewrite=(status,body)=>{h.f.sessions.revoke(h.f.credential);return [status,body];};
 const error=await h.decide().then(()=>null,e=>e);assert.equal(error?.code,'ACCESS_DENIED');assert.equal(error.effect,'unknown');assert.equal(h.synthetic.decisions.size,1);
});
test('a proposal naming another client scope than the configured selected client is refused',async t=>{
 const h=await harness({selectedClientId:id(9)});t.after(h.close);
 await assert.rejects(h.decide(),code('ACCESS_DENIED'));assert.equal(h.core.requests.length,0);
});
test('getCredentials hands the live approver bearer and service secret for the exact run, never for another purpose',async t=>{
 const h=await harness({selectedClientId:id(5)});t.after(h.close);
 const issued=await h.forwarder.getCredentials({tenantId:binding.tenantId,actorId:binding.actorId,purpose:'approval.execution',binding});
 assert.equal(issued.bearerToken,NATIVE);assert.equal(issued.serviceSecret,SECRET);assert.ok(issued.expiresAtMs>Date.now());assert.deepEqual({tenantId:issued.tenantId,actorId:issued.actorId},principal);
 await assert.rejects(h.forwarder.getCredentials({tenantId:binding.tenantId,actorId:binding.actorId,purpose:'read',binding}),code('ACCESS_DENIED'));
 await assert.rejects(h.forwarder.getCredentials({tenantId:binding.tenantId,actorId:'other',purpose:'approval.execution',binding}),code('ACCESS_DENIED'));
 const unselected=await harness();t.after(unselected.close);
 await assert.rejects(unselected.forwarder.getCredentials({tenantId:binding.tenantId,actorId:binding.actorId,purpose:'approval.execution',binding}),code('ACCESS_DENIED'));
});
test('the session binder binds once per context and is a no-op for a context without a forwarder',()=>{
 const context=Object.freeze({}),bound=[];registerApprovalSessionBinder(context,sessions=>bound.push(sessions));
 assert.throws(()=>registerApprovalSessionBinder(context,()=>{}),code('APPROVAL_FORWARDER_CONFIGURATION'));
 const sessions={};assert.equal(bindApprovalSessions(context,sessions),true);assert.deepEqual(bound,[sessions]);assert.equal(bindApprovalSessions(Object.freeze({}),sessions),false);
});
