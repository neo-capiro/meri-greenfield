import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommandAuthority} from '../index.mjs';
import {createCurrentToolAuthority} from '../authorization/current-tool-authority.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const NOW=Date.parse('2026-10-12T21:00:00.000Z');
function fixture(){
 const calls=[],state={time:NOW,revoked:false,grants:['command.execute'],enabled:true};
 const binding={tenantId:'independent-tenant',actorId:'independent-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'tenant',resourceId:binding.tenantId,policyRevision:'review-p1'}];
 const claims={capabilityId:id(5),issuer:'review',audience:'meri-gateway',binding,actions:['command.execute'],scopes,issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+1000).toISOString(),policyRevision:'review-p1',budgets:{maxTurns:1,maxRuntimeSeconds:1,maxCostMicrousd:1,maxOutputBytes:8192}};
 const subject={kind:'personal',entityType:'user',entityIds:[binding.actorId],tenantId:binding.tenantId,actorId:binding.actorId,authorizationDecisionId:id(6),policyRevision:'review-p1',scopes,rosterVersionId:null};
 const decision={decisionId:id(6),actor:{tenantId:binding.tenantId,actorId:binding.actorId},operation:'task.create@0.1.0',scopes,policyRevision:'review-p1',evaluatedAt:new Date(NOW).toISOString(),decision:'allowed',reasonCode:'REVIEW'};
 const descriptor={operation:{id:'task.create',version:'0.1.0'},requiredGrants:['command.execute'],sourceRequirements:[{sourceId:'review-source'}]};
 const run={binding:structuredClone(binding),policyRevision:'review-p1',deadlineMs:NOW+1000,checkedAtMs:NOW};
 const ports={
  async verifyCapability(){calls.push('verify');if(state.revoked)throw Error('private');return JSON.stringify(claims);},
  async currentRun(){calls.push('run');return JSON.stringify(run);},
  async authorizeBusiness(){calls.push('business');return JSON.stringify({decision,subject,grants:state.grants});},
  async authorizeSources(){calls.push('sources');return JSON.stringify({sourceIds:['review-source'],enabled:state.enabled,policyRevision:'review-p1',checkedAtMs:state.time});}
 };
 const make=()=>createCommandAuthority({authorityPorts:ports,now:()=>state.time,maxFactBytes:8192});
 const check=async(authority=make())=>{const deadlines=[];const result=await authority.check({credential:'synthetic-only',descriptor,input:{},signal:new AbortController().signal,limitDeadline:x=>deadlines.push(x)});return {result,deadlines};};
 return {state,calls,binding,claims,subject,decision,descriptor,run,ports,make,check};
}

test('fixed public command factory uses canonical current authority, full binding and scopes',async()=>{
 const f=fixture(),{result,deadlines}=await f.check();assert.deepEqual(result.binding,f.binding);assert.deepEqual(result.decision.scopes,f.claims.scopes);assert.ok(Object.isFrozen(result));assert.deepEqual(f.calls,['verify','run','business','sources','run']);assert.deepEqual(deadlines,[NOW+1000,NOW+1000]);
});
test('public command factory refuses an activation or capability override',()=>{
 const f=fixture();for(const extra of [{sourceEnabled:true},{capabilityAction:'tool.read'},{ports:f.ports}])assert.throws(()=>createCommandAuthority({authorityPorts:f.ports,now:()=>NOW,maxFactBytes:8192,...extra}));
});
test('existing read default remains read-only and command factory remains command-only',async()=>{
 const f=fixture();await assert.rejects(f.check(createCurrentToolAuthority({ports:f.ports,now:()=>NOW,maxFactBytes:8192})),/ACCESS_DENIED/);
 f.claims.actions=['tool.read'];await f.check(createCurrentToolAuthority({ports:f.ports,now:()=>NOW,maxFactBytes:8192}));await assert.rejects(f.check(),/ACCESS_DENIED/);
 for(const capabilityAction of ['command.propose','artifact.publish','',null,[]])assert.throws(()=>createCurrentToolAuthority({ports:f.ports,now:()=>NOW,maxFactBytes:8192,capabilityAction}),/GATEWAY_CONFIGURATION/);
});
for(const [name,mutate] of [
 ['revoked',f=>f.state.revoked=true],['expired',f=>f.claims.expiresAt=new Date(NOW).toISOString()],['future issue',f=>f.claims.issuedAt=new Date(NOW+1).toISOString()],['nonrepresentable issue',f=>f.claims.issuedAt='2026-10-11T23:59:60Z'],['stale task fence',f=>f.run.binding.writerFence=2],['wrong policy',f=>f.run.policyRevision='other'],['wrong actor',f=>f.decision.actor.actorId='other'],['wrong scopes',f=>f.decision.scopes=[]],['missing grant',f=>f.state.grants=[]],['source disabled',f=>f.state.enabled=false],['stale decision',f=>f.decision.evaluatedAt=new Date(NOW-1).toISOString()]
])test(`command authority refuses ${name}`,async()=>{const f=fixture();mutate(f);await assert.rejects(f.check(),/ACCESS_DENIED/);});

for(const parkedPort of ['currentRun','authorizeBusiness','authorizeSources'])test(`short authority deadline bounds parked ${parkedPort} and ignores late completion`,async()=>{
 const f=fixture(),parked=Promise.withResolvers();let parkedValue;const original=f.ports[parkedPort];
 if(parkedPort==='currentRun')f.claims.expiresAt=new Date(NOW+20).toISOString();else f.run.deadlineMs=NOW+20;
 f.ports[parkedPort]=async(...args)=>{parkedValue=await original(...args);return parked.promise;};
 const lifetime=createOperationLifetime({deadlineMs:NOW+1000,now:()=>NOW,errorFactory:c=>Error(c)});
 const pending=lifetime.run(signal=>f.make().check({credential:'synthetic-only',descriptor:f.descriptor,input:{},signal,limitDeadline:lifetime.limitDeadline}));
 let supervisor;
 try{
  await assert.rejects(Promise.race([pending,new Promise((_,reject)=>{supervisor=setTimeout(()=>reject(Error('UNBOUNDED_PORT')),100);})]),/^Error: DEADLINE$/);
  assert.equal(typeof parkedValue,'string');const stopped=[...f.calls];parked.resolve(parkedValue);await new Promise(r=>setImmediate(r));assert.deepEqual(f.calls,stopped);
 }finally{clearTimeout(supervisor);parked.resolve(parkedValue);await pending.catch(()=>{});lifetime.close();}
});
test('late verified capability after explicit cancellation cannot begin current-run lookup',async()=>{
 const f=fixture(),parked=Promise.withResolvers(),controller=new AbortController();f.ports.verifyCapability=()=>{f.calls.push('verify');return parked.promise;};
 const pending=f.make().identify({credential:'synthetic',signal:controller.signal,limitDeadline:()=>{}});controller.abort();parked.resolve(JSON.stringify(f.claims));await assert.rejects(pending,/ACCESS_DENIED/);assert.deepEqual(f.calls,['verify']);
});
