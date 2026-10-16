import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {rawTypedSha256,typedExecutionWitness} from '../../../../../packages/runtime/objective-generation-custody.mjs';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {createActivityLifecycle} from '../activity-lifecycle.mjs';
import {continuationFixture,id} from './fixtures.mjs';

function descriptor(binding,request,sessionId){
 const result={schemaVersion:1,kind:'objective.strategy.draft',path:'meri-objective-strategy-draft.result.json',
  sourceAdmissionSha256:'a'.repeat(64),sourceRequestSha256:hash(request),typedRequestSha256:'b'.repeat(64),resultRef:id(30),
  resultSha256:'c'.repeat(64),fileSha256:'d'.repeat(64),bytes:1,
  execution:{provider:'provider',model:'model',receiptRef:id(31),receiptSha256:'0'.repeat(64),bindingSha256:hash(binding)},
  observation:{sessionId,completedAtMs:Date.now(),state:'succeeded',payloadSha256:'e'.repeat(64)}};
 result.execution.receiptSha256=hash(typedExecutionWitness(result));return result;
}

for(const typed of [false,true])test(`lifecycle completion ${typed?'forwards validated Objective descriptor':'omits absent Objective descriptor'}`,async()=>{
 const f=continuationFixture(),binding=f.target.binding,request=f.target.request,versions=f.target.versions,scopes=f.target.scopes,sessionId=id(40),calls=[];
 const life=createOperationLifetime({now:Date.now,deadlineMs:Date.now()+1500,errorFactory:code=>Error(code)});
 const owner={async nextControls(){return [];},async claimControl(){throw Error('unexpected claim');},async ackControl(){throw Error('unexpected ack');},async recordCheckpoint(){throw Error('unexpected checkpoint');}};
 const workspace={contractVersion:'0.1.0',manifestId:id(41),binding,logicalCwd:'/workspace/conversation',entries:[],scopes,createdAt:new Date().toISOString()};
 const opaqueSession={objectId:id(42),versionId:'synthetic-v1',sha256:'f'.repeat(64),bytes:1,scopes};
 const checkpoint={contractVersion:'0.1.0',checkpointId:id(43),parentCheckpointId:null,binding,sessionId,opaqueSession,workspace,
  workspaceSha256:hash(workspace),versions,lastEventSequence:3,scopes,createdAt:new Date().toISOString(),durableReceiptId:id(44)};
 const config={captureCheckpoint(){throw Error('unexpected pause');},pollMs:5,async captureCompletion(value){calls.push(value);return {checkpoint,checkpointSha256:hash(checkpoint),
  sourceRequestSha256:hash(request),contextSha256:f.contextSha256,sessionId,resumeSessionAt:null,verificationId:id(45),
  workspaceReadbackSha256:checkpoint.workspaceSha256,opaqueSessionReadbackSha256:opaqueSession.sha256,
  checkedAtMs:Date.now(),expiresAtMs:Date.now()+1000};}};
 const lifecycle=createActivityLifecycle({config,runOwner:owner,binding,saved:{request,run:{versions,scopes}},runtime:{deadlineMs:Date.now()+1500},
  input:{enqueue(){},close(){}},query:{interrupt(){},close(){}},life,now:Date.now});
 try{await lifecycle.observe({type:'system',subtype:'init',session_id:sessionId});
  const result=typed?descriptor(binding,request,sessionId):undefined;
  await lifecycle.captureCompletion(result);
  assert.equal(calls.length,1);assert.equal(Object.hasOwn(calls[0],'typedResult'),typed);
  if(typed)assert.deepEqual(calls[0].typedResult,result);
 }finally{lifecycle.close();life.close();}
});
