/** Synthetic current-authority ports; this is not a live/model qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreConversationManagement} from '../native-authority/conversation-management.mjs';
import {runStartFixture,syntheticObjectivePool,NOW} from '../objective-source/test/run-start-fixture.mjs';
import {assembleAgentCoreCandidate} from '../agentcore-candidate.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';

function fixture(){
 const f=runStartFixture(),state={checks:0,native:0,refuse:false,absent:false};
 const scopes=[{tenantId:f.tenantId,kind:'client',resourceId:f.clientId,policyRevision:'policy'}];
 const current={tenantId:f.tenantId,actorId:f.actorId,clientId:f.clientId,effectExpiresAtMs:f.record.effectExpiresAtMs};
 const owner=createCoreConversationManagement({origin:'https://core.synthetic.invalid',policyRevision:'policy',now:()=>NOW,maxRequestMs:1000,
  getServiceSecret:()=>assert.fail('ordinary management transport must not run'),fetchImpl:()=>assert.fail('ordinary user transport must not run'),
  nativeCredentials:{nativeCredentialFor(){state.native++;throw Object.assign(Error('SESSION_UNAVAILABLE'),{code:'SESSION_UNAVAILABLE'});}},
  objectiveCore:{async forBinding({binding}){state.checks++;assert.deepEqual(binding,f.binding);if(state.refuse)throw Error('OBJECTIVE_CURRENT_UNAVAILABLE');return state.absent?null:{record:f.record,current};}}});
 return {f,state,scopes,current,owner,input:{binding:f.binding,scopes,selectedClientId:f.clientId}};
}

test('saved Objective admission uses current Core job authority without an interactive session',async()=>{
 const f=fixture();await f.owner.assertActiveBinding(f.input);
 assert.equal(f.state.checks,1);assert.equal(f.state.native,0);
});

test('Core refusal or unavailable saved Objective authority never falls back to an interactive credential',async()=>{
 const f=fixture();f.state.refuse=true;
 await assert.rejects(f.owner.assertActiveBinding(f.input),/OBJECTIVE_CURRENT_UNAVAILABLE/u);
 assert.equal(f.state.checks,1);assert.equal(f.state.native,0);
});

test('absence of a saved Objective retains ordinary interactive admission',async()=>{
 const f=fixture();f.state.absent=true;
 await assert.rejects(f.owner.assertActiveBinding(f.input),/SESSION_UNAVAILABLE/u);
 assert.equal(f.state.checks,1);assert.equal(f.state.native,1);
});

for(const field of ['tenantId','actorId','clientId'])test(`saved Objective refuses a mismatched current ${field}`,async()=>{
 const f=fixture();f.current[field]='11111111-1111-4111-8111-999999999999';
 await assert.rejects(f.owner.assertActiveBinding(f.input));
 assert.equal(f.state.checks,1);assert.equal(f.state.native,0);
});

for(const change of ['client','tenant','policy','additional-scope'])test(`saved Objective refuses changed ${change} in input scope`,async()=>{
 const f=fixture();
 if(change==='client')f.scopes[0].resourceId='11111111-1111-4111-8111-999999999999';
 if(change==='tenant')f.scopes[0].tenantId='11111111-1111-4111-8111-999999999999';
 if(change==='policy')f.scopes[0].policyRevision='different';
 if(change==='additional-scope')f.scopes.push({...f.scopes[0]});
 await assert.rejects(f.owner.assertActiveBinding(f.input));
 assert.equal(f.state.checks,1);assert.equal(f.state.native,0);
});

test('caller cancellation is checked after the current Objective read',async()=>{
 const f=fixture();let checks=0;
 await assert.rejects(f.owner.assertActiveBinding(f.input,()=>{if(++checks===2)throw Error('cancelled');}),/cancelled/u);
 assert.equal(f.state.checks,1);assert.equal(f.state.native,0);
});

for(const status of [200,403])test(`production composition uses the saved-job Core transport and preserves status ${status}`,async()=>{
 const f=runStartFixture(),pg=syntheticObjectivePool(),configuration=agentcoreControlFixture().configuration;
 let calls=0,nativeCalls=0;
 const candidate=assembleAgentCoreCandidate({configuration,pool:pg.pool,now:()=>NOW,
  controlCredential:'synthetic-control-credential-long-enough',getCoreServiceSecret:async()=>'synthetic-objective-service-secret',
  nativeCredentials:{nativeCredentialFor(){nativeCalls++;throw Error('SESSION_UNAVAILABLE');}},
  provider:{invoke:()=>assert.fail('no model invocation'),stop:()=>assert.fail('no provider mutation')},
  fetchImpl:async(url,options)=>{
   calls++;assert.ok(url.endsWith('/api/internal/objective-generation/current'));
   assert.equal(options.headers.authorization,undefined);
   assert.deepEqual(JSON.parse(options.body),{schemaVersion:1,generationJobId:f.generationJobId});
   const a=f.selection.sourceAdmission;
   return Response.json({schemaVersion:1,generationJobId:f.generationJobId,tenantId:f.tenantId,actorId:f.actorId,
    clerkUserId:a.clerkUserId,clientId:f.clientId,role:'standard_user',consentId:a.consentId,controlVersion:a.controlVersion,checkedAtMs:NOW,effectExpiresAtMs:a.effectExpiresAtMs},{status});
  }});
 try{
  await candidate.objective.runStarts.putOnce({record:f.record});
  const input={binding:f.binding,selectedClientId:f.clientId,scopes:[{tenantId:f.tenantId,kind:'client',resourceId:f.clientId,policyRevision:candidate.objective.template.policyRevision}]};
  const pending=candidate.productPorts.conversationManagement.assertActiveBinding(input);
  if(status===200)await pending;else await assert.rejects(pending);
  assert.equal(calls,1);assert.equal(nativeCalls,0);
 }finally{await candidate.close();}
});
