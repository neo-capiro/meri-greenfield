/** Synthetic current Core proof, admitted grants and live session. No database or service is contacted. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createCurrentAuthorityAdapters} from '../current-authority-adapters.mjs';
import {conversationScopes} from '../../../../packages/contracts/conversation-scope.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {fixture,BINDING,POLICY,CLIENT,OTHER_CLIENT,ORIGIN,FILES,TASK_CAPABILITY,PATHS,uuid} from './current-authority-fixture.mjs';
const limitDeadline=()=>{};
function setup(){const f=fixture();f.state.run.scopes=conversationScopes(BINDING,null,POLICY);f.state.clientIds=[CLIENT,OTHER_CLIENT];
 const relay={nativeCredentialFor(request){assert.deepEqual(request.binding,BINDING);assert.equal(request.selectedClientId,null);f.state.relay.push(request);return {...f.state.session};}};
 const a=createCurrentAuthorityAdapters({origin:ORIGIN,nativeCredentials:relay,readSecret:f.readSecret,reservedFiles:[FILES.identity,FILES.task,FILES.control,FILES.proxy],secretFiles:[FILES.service],sourceEnabled:true,now:f.now,fetchImpl:f.fetchImpl,newId:()=>uuid('7')});a.bind({pool:f.pool,conversations:f.conversations});
 return {...f,a};}
const descriptor=resolveOperationContract({id:'get_client_context',version:'0.3.0'}).descriptor;
const check=(f,clientId)=>f.a.authority.check({credential:TASK_CAPABILITY,descriptor,input:{clientId},limitDeadline});
test('General client reads use fresh authorized roster while retaining actual client provenance',async()=>{
 const f=setup(),first=await check(f,CLIENT),second=await check(f,OTHER_CLIENT);
 assert.deepEqual(first.subject.scopes,conversationScopes(BINDING,CLIENT,POLICY));assert.deepEqual(second.subject.scopes,conversationScopes(BINDING,OTHER_CLIENT,POLICY));
 assert.deepEqual(f.state.run.scopes,conversationScopes(BINDING,null,POLICY));assert.equal(first.claims.scopes.length,3);
 assert.ok(f.state.core.every(call=>call.path===PATHS.current&&call.body.clientId===null));
});
test('legacy clientless conversation, forged origin, foreign actor and unknown client are refused',async()=>{
 const legacy=setup();legacy.state.status[PATHS.current]=403;await assert.rejects(check(legacy,CLIENT));
 for(const change of [f=>f.state.run.scopes[0].resourceId=uuid('9'),f=>f.state.run.scopes[0].kind='tenant',f=>f.state.principalActor=uuid('9'),f=>f.state.clientIds=[CLIENT]]){const f=setup();change(f);await assert.rejects(check(f,OTHER_CLIENT));}
});
test('revocation after claim creation and before source release refuses old roster claims',async()=>{
 const f=setup(),claims=JSON.parse(await f.a.ports.verifyCapability(TASK_CAPABILITY));f.state.clientIds=[CLIENT];
 await assert.rejects(f.a.ports.authorizeBusiness({claims,operation:descriptor.operation,requiredGrants:descriptor.requiredGrants,input:{clientId:OTHER_CLIENT}}));
 const g=setup(),result=await check(g,OTHER_CLIENT);g.state.clientIds=[CLIENT];
 await assert.rejects(g.a.ports.authorizeSources({claims:result.claims,subject:result.subject,sourceRequirements:descriptor.sourceRequirements}));
 await assert.rejects(check(g,OTHER_CLIENT));
});
test('mixed clients in one selected subject and General client memory are refused',async()=>{
 const f=setup(),result=await check(f,CLIENT);
 await assert.rejects(f.a.ports.authorizeSources({claims:result.claims,subject:{...result.subject,entityIds:[CLIENT,OTHER_CLIENT],scopes:[...conversationScopes(BINDING,CLIENT,POLICY),...conversationScopes(BINDING,OTHER_CLIENT,POLICY)]},sourceRequirements:descriptor.sourceRequirements}));
 const memory=resolveOperationContract({id:'search_memory',version:'0.2.0'}).descriptor;
 await assert.rejects(f.a.authority.check({credential:TASK_CAPABILITY,descriptor:memory,input:{query:'test',clientId:CLIENT},limitDeadline}));
 const result2=await f.a.authority.check({credential:TASK_CAPABILITY,descriptor:memory,input:{query:'test',clientId:null},limitDeadline});assert.equal(result2.subject.kind,'personal');
 const mutation=resolveOperationContract({id:'create_task',version:'0.2.0'}).descriptor;
 await assert.rejects(f.a.authority.check({credential:TASK_CAPABILITY,descriptor:mutation,input:{clientId:CLIENT},limitDeadline}));
});
