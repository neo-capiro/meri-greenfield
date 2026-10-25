/** Real control/session/service/execution composition over scripted SQL and Core/Temporal/provider ports. No server or model. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleControl} from '../control.mjs';
import {assembleAgentCoreCandidate} from '../agentcore-candidate.mjs';
import {createReadCredentialRelay} from '../read-credential-relay.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {initialInputFixture} from '../../control/conversations/test/initial-input-fixture.mjs';
import {binding,id} from '../../control/conversations/test/application-fixture.mjs';
import {hash} from '../../control/conversations/boundary.mjs';
import {productFailure} from '../../control/product-access/errors.mjs';
import {registerDocumentIntentOwner} from '../artifacts/intent-binding.mjs';
import {createControlRouteApplications} from '../control-route-boundary.mjs';

test('AgentCore startup installs the real request-local membership gate with the same identity and lazy SDK owner',async()=>{
 let now=1800000000000,effects=0;const calls=[],configuration=agentcoreControlFixture().configuration;
 const forbidden=()=>{effects++;throw Error('No persistence, provider or credential-relay work during membership admission');};
 const candidate=assembleAgentCoreCandidate({configuration,pool:{connect:forbidden,query:forbidden},
  controlCredential:'synthetic-control-credential-long-enough',nativeCredentials:{nativeCredentialFor:forbidden},
  provider:{invoke:forbidden,stop:forbidden},now:()=>now,fetchImpl:async(url,options)=>{
   calls.push({url,options});const times={checkedAtMs:now,expiresAtMs:now+500};
   if(url.endsWith('/identity'))return Response.json({principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'i1',...times});
   assert.ok(url.endsWith('/api/clio/application-authority/membership'));
   return Response.json({tenantId:binding.tenantId,actorId:binding.actorId,status:'active',role:'standard_user',permissions:[],clientIds:[],membershipRevision:'m1',...times});
  }});
 try{
  assert.equal(calls.length,0);assert.equal(effects,0);assert.equal(candidate.native.verifyIdentity,candidate.productPorts.identityContext.verifyIdentity);
  const gate=candidate.productPorts.conversationMembership,access=await gate.admit({credential:'synthetic-request-native'});
  await gate.recheck({principal:access.principal,credential:'synthetic-request-native',deadlineMs:access.expiresAtMs});
  assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/api/clio/application-authority/identity','/api/clio/application-authority/membership','/api/clio/application-authority/membership']);
  assert.ok(calls.every(c=>c.options.headers.authorization==='Bearer synthetic-request-native'&&c.options.body==='{}'));
  assert.deepEqual(access.principal.permissions,[]);assert.deepEqual(access.principal.clientIds,[]);
  await assert.rejects(candidate.productPorts.sdkSessionOwner.load({request:{binding}}));assert.equal(effects,0);
  now=access.expiresAtMs;await assert.rejects(gate.recheck({principal:access.principal,credential:'synthetic-request-native',deadlineMs:access.expiresAtMs}),e=>productFailure(e)?.code==='DEADLINE');assert.equal(calls.length,3);
 }finally{await candidate.close();}
});

test('public action session and submit reach the real execution and private worker without any task allocation',async t=>{
 const f=initialInputFixture(),configuration=agentcoreControlFixture().configuration,relay=createReadCredentialRelay();
 configuration.sourceEnabled=true;configuration.intents={enabled:true};
 const clientId=id(5);
 const pending=Promise.withResolvers();pending.promise.catch(()=>{});let invocation,starts=0,coreCalls=0;
 const fetchImpl=async(url,request)=>{assert.ok(url.endsWith('/current'));assert.equal(request.headers.authorization,'Bearer actual-user-bearer');coreCalls++;
  const now=Date.now(),input=JSON.parse(request.body);return Response.json({principal:{tenantId:binding.tenantId,actorId:binding.actorId},role:'standard_user',permissions:[],clientIds:[clientId],
   identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:input.conversationId,selectedClientId:input.clientId,checkedAtMs:now,expiresAtMs:now+120000});};
 const candidate=assembleAgentCoreCandidate({configuration,pool:f.pool,controlCredential:'synthetic-control-credential-long-enough',nativeCredentials:relay.port,fetchImpl,
  provider:{async invoke(input){invocation=input;return pending.promise;},async stop(){throw Error('No stop in this completed invocation');}}});
 const client={connection:{withDeadline(_deadline,operation){return operation();},withAbortSignal(_signal,operation){return operation();}},workflow:{async start(){starts++;},getHandle(){return {async signal(){},async cancel(){}};}}};
 const assembly=assembleControl({configuration,pool:f.pool,client,native:candidate.native,execution:candidate.execution,canonicalProductPorts:candidate.productPorts,
  productPortsFactory:context=>{registerDocumentIntentOwner(context,({binding})=>[{binding,owner:'document',operation:{id:'create_word',version:'0.2.0'},prepare(){assert.fail('availability does not prepare');}}]);return {};}});
 candidate.bindApplication(assembly.application);relay.bind(assembly.sessions);
 const routes=createControlRouteApplications({assembly:assembly.application,candidate:candidate.application});
 const call=(path,body,credential)=>new Request('https://control.synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
 try{
  const response=await assembly.application.handle(call('/api/action-followthrough/session',{conversationId:binding.conversationId,clientId},'actual-user-bearer'));
  assert.equal(response.status,200);const session=await response.json();assert.notEqual(session.credential,'actual-user-bearer');
  const input={requestId:id(600),prompt:'Synthetic composition only'};
  await assembly.service.allocateInput({credential:session.credential,input});await assembly.service.submit({credential:session.credential,input});assert.equal(starts,1);
  const selected=await assembly.sessions.authenticateSession({credential:session.credential});const current=await assembly.sessions.readCurrentState({authentication:selected});
  const activeBinding=current.binding;
  await candidate.native.call('execution/kickoff',{binding:activeBinding,executionKey:hash(activeBinding)});assert.ok(invocation);
  const intentRequest=credential=>call('/v1/runner/intents/availability',{binding:activeBinding},credential);
  assert.equal((await routes.public.handle(intentRequest(invocation.credential))).status,404);
  assert.equal((await routes.private.handle(intentRequest('synthetic-control-credential-long-enough'))).status,403);
  const available=await routes.private.handle(intentRequest(invocation.credential));assert.equal(available.status,200);
  assert.deepEqual((await available.json()).operations,[{id:'create_word',version:'0.2.0'}]);
  const before=coreCalls;
  const load=await candidate.application.handle(call('/v1/runner/load',{binding:activeBinding},invocation.credential));assert.equal(load.status,200);
  assert.deepEqual((await load.json()).run.binding,activeBinding);assert.equal(coreCalls,before,'local worker persistence does not repeat Core admission');
  const pollStart=f.state.calls.length;
  const controls=await candidate.application.handle(call('/v1/runner/next-controls',{binding:activeBinding,after:0},invocation.credential));
  assert.equal(controls.status,200);assert.deepEqual(await controls.json(),{controls:[],nextControlSequence:0});
  const pollSql=f.state.calls.slice(pollStart);assert.equal(coreCalls,before);
  t.diagnostic(JSON.stringify({controlPollStatements:pollSql.length,controlPageQueries:pollSql.filter(sql=>sql.includes('FROM meri_conversations.controls')).length}));
  assert.equal(pollSql.filter(sql=>sql.includes('FROM meri_conversations.events')).length,0,'control polling does not reread conversation transcript');
  const denied=await candidate.application.handle(call('/v1/runner/load',{binding:activeBinding},'foreign-execution'));assert.equal(denied.status,403);
  // The same current private owner can publish a terminal failure; its committed receipt is acknowledged before settlement.
  const event={eventId:id(601),createdAt:new Date().toISOString(),type:'run.status',data:{state:'failed',reasonCode:'SYNTHETIC_TEST'}};
  const published=await candidate.application.handle(call('/v1/runner/publish',{binding:activeBinding,event},invocation.credential));assert.equal(published.status,200);
  pending.resolve(await candidate.execution.settle({credential:invocation.credential,execution:invocation.execution,state:'failed'}));
  assert.equal(f.state.allocations.size,0);assert.equal(f.state.executions.size,1);
  const readiness=assembly.productReadiness();assert.equal(readiness.ready,false);assert.ok(!readiness.missingOwners.includes('sessions.snapshot'));assert.ok(readiness.missingOwners.length>0,'other real business owners remain required');
 }finally{pending.reject(Error('fixture cleanup'));relay.close();await candidate.close();await assembly.close();}
});

test('read-enabled startup composes management and Objective Core ports without declaring Objective runs',async()=>{
 const configuration=agentcoreControlFixture().configuration;
 configuration.reads={enabled:true,serviceSecretFile:'/synthetic/core-secret'};
 const unused=()=>assert.fail('lazy composition must not read secrets, SQL or Core');
 const candidate=assembleAgentCoreCandidate({configuration,pool:{connect:unused,query:unused},
  controlCredential:'synthetic-control-credential-long-enough',nativeCredentials:{nativeCredentialFor:unused},
  getCoreServiceSecret:unused,fetchImpl:unused,provider:{invoke:unused,stop:unused}});
 try{assert.equal(configuration.objectiveGeneration,undefined);assert.equal(typeof candidate.productPorts.conversationManagement.assertActiveBinding,'function');assert.ok(candidate.objective.core);}
 finally{await candidate.close();}
});
