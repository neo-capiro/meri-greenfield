import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFixture,binding,id} from './application-fixture.mjs';
import {workflowSelection,workflowCurrent} from '../../../../packages/contracts/test/site-workflow.fixture.mjs';
import {assertRunOwnerRequest} from '../../../../packages/contracts/runtime-0.2/validate.mjs';
import {createTaskSiteWorkflowPort} from '../../../worker/conversation/browser/site-workflows/task-port.mjs';
import {assertSiteWorkflowSelection} from '../../../../packages/contracts/site-workflow-selection.mjs';
import {createCoreSiteWorkflowAdmission} from '../../../runtime/native-authority/site-workflow-admission.mjs';

test('allocation and replay pin the whole selection and native execution resolves only persisted facts',async()=>{
 const calls=[],http=[];
 const core=createCoreSiteWorkflowAdmission({origin:'https://core.example',getServiceSecret:async()=> 'synthetic-service',
  nativeCredentials:{nativeCredentialFor:()=>({credential:'synthetic-native',expiresAtMs:Date.now()+60000})},
  fetchImpl:async(url,init)=>{http.push({url,body:JSON.parse(init.body)});return Response.json(workflowCurrent());}});
 const f=await applicationFixture({initialInput:true,serviceOptions:{siteWorkflowAdmission:{async resolve(input){calls.push(input);return core.resolve(input);}}}});
 try{
  const input={...f.input,siteWorkflow:workflowSelection};await f.service.allocateInput({credential:f.credential,input});await f.service.submit({credential:f.credential,input});
  const saved=await f.store.findRequest(binding,input.requestId,()=>{});assert.deepEqual(saved.request.siteWorkflow,workflowSelection);
  for(const changed of [{...input,siteWorkflow:{...workflowSelection,version:2}},{...input,siteWorkflow:{...workflowSelection,manifestSha256:'b'.repeat(64)}},f.input])
   await assert.rejects(f.service.submit({credential:f.credential,input:changed}));
  const task=createTaskSiteWorkflowPort({native:{async call(operation,body,{signal}){
   assert.equal(operation,'runner/site-workflow-resolve');assert.deepEqual(body,{binding});assertRunOwnerRequest('site-workflow-resolve',body);
   return f.service.siteWorkflowResolve({credential:f.credential,...body,signal});
  }}});
  assert.deepEqual(await task.resolve({binding}),workflowCurrent());assert.deepEqual(calls[0].selection,workflowSelection);
  assert.deepEqual(calls[0].scopes,saved.run.scopes);assert.equal(f.state.starts,1);
  assert.deepEqual(http,[{url:'https://core.example/api/clio/site-workflows/runtime/read',body:{conversationId:binding.conversationId,selection:workflowSelection}}]);
  assert.throws(()=>assertRunOwnerRequest('site-workflow-resolve',{binding,selection:workflowSelection}));
 }finally{f.close();}
});
test('data-only selector refuses credentials, accessors, inherited fields and unsupported identities before persistence',async()=>{
 const f=await applicationFixture({initialInput:true});try{
  for(const siteWorkflow of [null,{...workflowSelection,cookie:'x'},{...workflowSelection,siteId:'bad/url'},{...workflowSelection,version:0}])
   await assert.rejects(f.service.allocateInput({credential:f.credential,input:{...f.input,siteWorkflow}}),{code:'INVALID_REQUEST'});
  let invoked=false;assert.throws(()=>assertSiteWorkflowSelection({...workflowSelection,get siteId(){invoked=true;return 'site';}}));assert.equal(invoked,false);
  assert.throws(()=>assertSiteWorkflowSelection(Object.create(workflowSelection)));assert.equal(f.state.starts,0);
  assert.equal(await f.store.findRequest(binding,f.input.requestId,()=>{}),null);
 }finally{f.close();}
});
test('account revocation while Core answers withholds the current manifest',async()=>{
 let f;f=await applicationFixture({initialInput:true,serviceOptions:{siteWorkflowAdmission:{async resolve(){f.state.revoked=true;return workflowCurrent();}}}});
 try{const input={...f.input,siteWorkflow:workflowSelection};await f.service.allocateInput({credential:f.credential,input});await f.service.submit({credential:f.credential,input});
  await assert.rejects(f.service.siteWorkflowResolve({credential:f.credential,binding}));
 }finally{f.close();}
});
test('absent selection or wrong binding cannot resolve another run configuration',async()=>{
 let called=false;const f=await applicationFixture({initialInput:true,serviceOptions:{siteWorkflowAdmission:{async resolve(){called=true;return workflowCurrent();}}}});
 try{await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
  await assert.rejects(f.service.siteWorkflowResolve({credential:f.credential,binding}));
  await assert.rejects(f.service.siteWorkflowResolve({credential:f.credential,binding:{...binding,runId:id(98)}}));assert.equal(called,false);
 }finally{f.close();}
});
