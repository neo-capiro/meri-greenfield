/** SYNTHETIC: the tasks product-port family and the per-session task-update application over the existing opaque session owner,
 * the actual task.update proposal owners and command executors of two runs (control intent fixture), a synthetic grant owner and
 * synthetic Core. Nothing here is PostgreSQL, Core or live evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductPortsFactory} from '../index.mjs';
import {createTasksFamily,createTasksFamilyWith} from '../tasks.mjs';
import {intentsComposition} from '../intents.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {commandComposition,id,canonicalSha256,NOW} from '../../../control/intents/test/fixture.mjs';
const code=c=>e=>e?.code===c;
const configuration=sourceEnabled=>({version:1,profile:'isolated-preview',sourceEnabled,limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:65536},
 native:{origin:'https://native.invalid',capabilityFile:'/run/native',loopback:false,maxResponseBytes:262144}});
const context=(sourceEnabled,now=()=>NOW)=>Object.freeze({configuration:configuration(sourceEnabled),pool:{connect(){throw Error('no SQL');}},client:{},native:{call:async()=>{throw Error('no Core');}},now,canonicalProductPorts:captureRuntimePorts({})});
const readiness=(ctx,ports)=>productReadiness({ports:captureRuntimePorts(ports),sourceEnabled:ctx.configuration.sourceEnabled}).owners.find(o=>o.name==='tasks.commands').state;
test('production family is disabled: source off, or source on without a Core grant owner; create never builds anything',()=>{
 for(const sourceEnabled of [false,true]){
  const ctx=context(sourceEnabled),ports=createProductPortsFactory({families:[['tasks',createTasksFamily]]})(ctx),factory=ports.taskCommandApplicationFactory;
  assert.equal(factory.state(),'disabled');assert.equal(factory.create({sessions:{}}),null);assert.equal(readiness(ctx,ports),'disabled');
 }
 const grant={servicesFor(){throw Error('not called');},authorizeExecution(){throw Error('not called');}};
 const off=createTasksFamilyWith({grant})(context(false)).ports.taskCommandApplicationFactory;assert.equal(off.state(),'disabled');assert.equal(off.create({sessions:{}}),null);
 const on=createTasksFamilyWith({grant})(context(true)).ports.taskCommandApplicationFactory;assert.equal(on.state(),'composed');
});
test('a malformed grant owner is refused at composition',()=>{
 for(const grant of [null,{},{servicesFor(){}},{servicesFor(){},authorizeExecution:1},{servicesFor(){},authorizeExecution(){},extra:1},new Proxy({servicesFor(){},authorizeExecution(){}},{})])
  assert.throws(()=>createTasksFamilyWith({grant}),code('TASKS_CONFIGURATION'));
});
/** Two runs (different tenants), one opaque session owner, one per-session application. */
function twoRuns(){
 const runs={a:commandComposition({action:'task.update'}),b:commandComposition({action:'task.update',tenantId:'other'})};
 for(const r of Object.values(runs))r.f.state.now=NOW;
 const clock=()=>NOW,byTenant=t=>Object.values(runs).find(r=>r.binding.tenantId===t);
 const sessions=createActionSessionOwner({mode:'process-local',now:clock,limits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:10000,maxFactBytes:65536},
  async verifyIdentity({credential}){const r=runs[credential.slice(-1)];return {principal:{tenantId:r.binding.tenantId,actorId:r.binding.actorId},identityRevision:'identity',checkedAtMs:NOW,expiresAtMs:NOW+20000};},
  async resolveContext({identity}){const r=byTenant(identity.principal.tenantId);
   return {identitySha256:canonicalSha256(identity),binding:r.binding,scopes:[...r.scopes,{tenantId:r.binding.tenantId,kind:'client',resourceId:id(9),policyRevision:'p1'}],selectedClientId:id(9),contextRevision:'current',checkedAtMs:NOW,expiresAtMs:NOW+20000};}});
 const seen=[];let swap=false;
 const grant={
  servicesFor(input){seen.push(input);const r=byTenant(input.binding.tenantId),served=swap?(r===runs.a?runs.b:runs.a):r;return {commandOptions:served.commandOptions};},
  async authorizeExecution({proposal,current}){const r=byTenant(current.binding.tenantId);return {credential:'synthetic',execution:{...r.f.execution,executorBinding:current.binding,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey}};}};
 return {runs,sessions,grant,seen,swap:v=>{swap=v;}};
}
test('per-session: each session prepares and executes on its own run; another run\'s proposal never executes; one shared approval store',async()=>{
 const t=twoRuns(),ctx=context(true,()=>NOW);
 const ports=createProductPortsFactory({families:[['tasks',createTasksFamilyWith({grant:t.grant})]]})(ctx),factory=ports.taskCommandApplicationFactory;
 assert.equal(factory.state(),'composed');assert.equal(readiness(ctx,ports),'composed');assert.equal(t.seen.length,0,'composition calls no grant');
 const app=factory.create({sessions:t.sessions});assert.equal(t.seen.length,0,'create calls no grant');
 try{
  const a=await t.sessions.issue({identityCredential:'native-a'}),b=await t.sessions.issue({identityCredential:'native-b'});
  const call=(intent,body,credential)=>app.handle(new Request('https://meri.invalid/api/task-commands/'+intent,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}));
  const pa=await call('prepare',{arguments:{taskId:id(21),title:'Updated'}},a.credential);assert.equal(pa.status,200);const {proposal:proposalA}=await pa.json();
  const pb=await call('prepare',{arguments:{taskId:id(22),title:'B'}},b.credential);assert.equal(pb.status,200);const {proposal:proposalB}=await pb.json();
  assert.equal(proposalA.command.binding.tenantId,'tenant');assert.equal(proposalB.command.binding.tenantId,'other');
  t.runs.a.approve(proposalA);
  assert.notEqual((await call('execute',{proposal:proposalA},b.credential)).status,200,'session B cannot execute run A\'s proposal');
  assert.equal(t.runs.a.f.state.fetches+t.runs.b.f.state.fetches,0);
  const ea=await call('execute',{proposal:proposalA},a.credential);assert.equal(ea.status,200);assert.equal((await ea.json()).status,'observed');
  assert.equal(t.runs.a.f.state.fetches,1);assert.equal(t.runs.b.f.state.fetches,0);
  assert.notEqual((await call('execute',{proposal:proposalB},b.credential)).status,200,'unapproved proposal of run B never executes');assert.equal(t.runs.b.f.state.fetches,0);
  assert.deepEqual(t.seen.map(s=>s.binding.tenantId),['tenant','other','other','tenant','other']);
  assert.ok(t.seen.every(s=>s.approvalStore===intentsComposition(ctx).approvalStore&&s.selectedClientId===id(9)),'every run receives the one shared approval store');
  // A grant owner that answers with another run's services is refused before any metadata, capability or Core call.
  t.swap(true);const before=t.runs.a.metadataCalls.prepare+t.runs.b.metadataCalls.prepare;
  const crossed=await call('prepare',{arguments:{taskId:id(23),title:'X'}},a.credential);assert.equal(crossed.status,401);
  assert.equal(t.runs.a.metadataCalls.prepare+t.runs.b.metadataCalls.prepare,before);
 }finally{t.sessions.close();}
});
