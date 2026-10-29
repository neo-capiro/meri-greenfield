import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {applicationFixture,binding} from '../../../control/conversations/test/application-fixture.mjs';
import {workflowSelection,workflowCurrent} from '../../../../packages/contracts/test/site-workflow.fixture.mjs';
test('selected site workflow cannot silently run as an ordinary conversation without a browser host',async()=>{
 const f=await applicationFixture({initialInput:true});let runtime=0,query=0;
 try{const input={...f.input,siteWorkflow:workflowSelection};await f.service.allocateInput({credential:f.credential,input});await f.service.submit({credential:f.credential,input});
  const run=createConversationActivity({runOwner:f.runOwner,siteWorkflows:{resolve:async()=>workflowCurrent()},
   prepareRuntime:async()=>{runtime++;throw Error('should not run');},query:()=>{query++;throw Error('should not run');}});
  await assert.rejects(run({binding}));assert.equal(runtime,0);assert.equal(query,0);
 }finally{f.close();}
});
