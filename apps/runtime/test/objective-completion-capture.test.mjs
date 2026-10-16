/** A typed descriptor cannot create a checkpoint without protected issued Objective facts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeCompletionCapture} from '../native-authority/completion-capture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {objectiveCompletionId,typedExecutionWitness} from '../../../packages/runtime/objective-generation-custody.mjs';

test('native completion refuses a typed result before beginning capture when protected facts are absent',async()=>{
 const now=Date.now(),original=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:now+10000});
 const request={requestId:id(6),prompt:'Synthetic',window:null,skill:null},sessionId=id(7),ref=objectiveCompletionId(binding);
 const typedResult={schemaVersion:1,kind:'objective.strategy.draft',path:'meri-objective-strategy-draft.result.json',sourceAdmissionSha256:hash('admission'),sourceRequestSha256:hash(request),typedRequestSha256:hash('typed-request'),resultRef:ref,resultSha256:hash('result'),fileSha256:hash('file'),bytes:4,
  execution:{provider:'synthetic-provider',model:'synthetic-model',receiptRef:ref,receiptSha256:'',bindingSha256:hash(binding)},
  observation:{sessionId,completedAtMs:now,state:'succeeded',payloadSha256:hash('payload')}};
 typedResult.execution.receiptSha256=hash(typedExecutionWitness(typedResult));
 let begins=0,captures=0;
 const store={completions:{begin(){begins++;},read(){},publish(){},unknown(){}},read(){return {run:{binding,versions,scopes,policyRevision:'policy1'},request};}};
 const authority={verify(input){return {binding,operation:'load',inputSha256:input.inputSha256,identityCredential:'synthetic-native',scopes,selectedClientId:scopes[0].resourceId,policyRevision:'policy1',authorizationDecisionId:'synthetic-decision',checkedAtMs:now,expiresAtMs:original.expiresAtMs};}};
 const completion=createNativeCompletionCapture({store,objects:{get(){},put(){}},authority,taskCapability:'synthetic-task',original,taskCapture:{capture(){captures++;}},enabled:true,now:()=>now});
 await assert.rejects(completion.captureCompletion({binding,request,versions,scopes,sessionId,contextSha256:hash({window:request.window,skill:request.skill,scopes}),typedResult}),/NATIVE_COMPLETION_CAPTURE_UNKNOWN/);
 assert.equal(begins,0);assert.equal(captures,0);
});
