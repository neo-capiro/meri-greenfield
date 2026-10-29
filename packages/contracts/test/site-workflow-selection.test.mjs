import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveConversationRequest,receiveConversationResponse} from '../dist/conversation-application.mjs';
import {assertSiteWorkflowSelection} from '../site-workflow-selection.mjs';
import {workflowSelection} from './site-workflow.fixture.mjs';
import {applicationFixture} from '../../../apps/control/conversations/test/application-fixture.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
test('published receiving boundary accepts exact selector and rejects authority-bearing additions',()=>{
 const value={requestId:'00000000-0000-4000-8000-000000000001',prompt:'Read filings',siteWorkflow:workflowSelection};
 assert.deepEqual(receiveConversationRequest('submit',bytes(value)).siteWorkflow,workflowSelection);
 for(const selection of [{...workflowSelection,cookie:'x'},{...workflowSelection,tools:['*']},{...workflowSelection,version:1.5},{...workflowSelection,manifestSha256:'bad'},null])
  assert.throws(()=>receiveConversationRequest('submit',bytes({...value,siteWorkflow:selection})));
 assert.ok(Object.isFrozen(assertSiteWorkflowSelection(workflowSelection)));
});
test('public history preserves the selection and refuses substituted or removed identity',async()=>{
 const f=await applicationFixture({initialInput:true});try{
  const input={...f.input,siteWorkflow:workflowSelection},request=receiveConversationRequest('submit',bytes(input));
  await f.service.allocateInput({credential:f.credential,input});const result=await f.service.submit({credential:f.credential,input});
  const view=await receiveConversationResponse('submit',200,bytes(result),request);
  const historyRequest=receiveConversationRequest('history',bytes({})),history=await f.service.history({credential:f.credential});
  const read=value=>receiveConversationResponse('history',200,bytes(value),historyRequest,view);
  assert.deepEqual((await read(history)).request.siteWorkflow,workflowSelection);
  await assert.rejects(read({...history,request:{...history.request,siteWorkflow:{...workflowSelection,version:2}}}));
  const {siteWorkflow,...without}=history.request;await assert.rejects(read({...history,request:without}));
 }finally{f.close();}
});
