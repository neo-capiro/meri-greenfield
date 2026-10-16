/** SYNTHETIC actual prepared membership composition. Linux plan/compiler and kickoff are borrowed; no SDK loop, DB, socket or AWS. */
import {test,mock} from 'node:test';import assert from 'node:assert/strict';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {productFailure} from '../../control/product-access/errors.mjs';
const f=candidateFixture(),config=f.configuration.nativeCandidate,original=createExecutionBinding({binding:f.binding,versions:f.configuration.versions,plan:config.plan,expiresAtMs:config.runtime.deadlineMs});
mock.module('../prepared-candidate-config.mjs',{namedExports:{compilePreparedCandidateConfiguration(value){return value;}}});
mock.module('../native-authority/broker-stack.mjs',{namedExports:{compileNativeBrokerPlan(){return {original,preparationIntent:config.preparationIntent};},createNativeBrokerStack(){throw Error('No broker stack');}}});
mock.module('../native-authority/prepared-kickoff.mjs',{namedExports:{createPreparedTaskKickoff({controller}){return {async kickoff(){throw Error('No kickoff');},async status(){},async stop(){},async close(){await controller.close();}};}}});
const {assemblePreparedCandidate}=await import('../prepared-candidate.mjs');
test('prepared startup installs the real request-local membership gate while retaining the same identity and lazy SDK owners',async()=>{
 let now=f.now,allocations=0;const calls=[];
 const candidate=assemblePreparedCandidate({configuration:f.configuration,pool:{connect(){throw Error('No SQL');}},ecs:{send(){throw Error('No AWS');}},objects:{get(){throw Error('No objects');},put(){throw Error('No objects');}},credentials:f.secret,now:()=>now,
  allocate(){allocations++;throw Error('No allocation');},async fetchImpl(url,options){
   calls.push({url,options});const times={checkedAtMs:now,expiresAtMs:now+500};
   if(url.endsWith('/identity'))return Response.json({principal:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},identityRevision:'i1',...times});
   assert.equal(url,config.identity.origin+'/api/clio/application-authority/membership');
   return Response.json({tenantId:f.binding.tenantId,actorId:f.binding.actorId,status:'active',role:'standard_user',permissions:[],clientIds:[],membershipRevision:'m1',...times});
  }});
 try{
  assert.equal(calls.length,0);assert.equal(allocations,0);assert.equal(candidate.productPorts.identityContext,candidate.identityContext);
  const gate=candidate.productPorts.conversationMembership,access=await gate.admit({credential:'synthetic-request-native'});
  await gate.recheck({principal:access.principal,credential:'synthetic-request-native',deadlineMs:access.expiresAtMs});
  assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/api/clio/application-authority/identity','/api/clio/application-authority/membership','/api/clio/application-authority/membership']);
  assert.ok(calls.every(c=>c.options.headers.authorization==='Bearer synthetic-request-native'&&c.options.body==='{}'));
  assert.equal(calls.some(c=>c.options.headers.authorization==='Bearer '+f.secret.identity),false);
  assert.equal(allocations,0);assert.deepEqual(access.principal.permissions,[]);assert.deepEqual(access.principal.clientIds,[]);
  assert.throws(()=>candidate.productPorts.sdkSessionOwner.load({request:{binding:f.binding}}),{code:'SDK_SESSION_UNAVAILABLE'});
  now=access.expiresAtMs;await assert.rejects(gate.recheck({principal:access.principal,credential:'synthetic-request-native',deadlineMs:access.expiresAtMs}),e=>productFailure(e)?.code==='DEADLINE');assert.equal(calls.length,3);
 }finally{await candidate.close();}
});
