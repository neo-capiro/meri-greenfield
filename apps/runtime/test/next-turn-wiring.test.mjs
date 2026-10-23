import test from 'node:test';import assert from 'node:assert/strict';
import {waitForAdmittedTask} from '../task-bootstrap.mjs';
import {continuationFixture,NOW} from '../../worker/conversation/continuation/test/fixtures.mjs';
function fixture(){const f=continuationFixture(),nextTurn={checkpoint:f.continuation.checkpoint,checkpointSha256:f.continuation.checkpointSha256,sourceRequestSha256:f.continuation.sourceRequestSha256,contextSha256:f.continuation.contextSha256,sourceRequest:f.target.sourceRequest,targetBinding:f.target.binding,resumeSessionAt:f.continuation.resumeSessionAt};return {f,nextTurn};}
test('pre-admission task readiness forwards canonical next-prompt lineage without calling it lifecycle resume',async()=>{const {f,nextTurn}=fixture(),request={...f.target.request,prompt:'A different prompt'},calls=[];
 await waitForAdmittedTask({binding:f.target.binding,versions:f.target.versions,deadlineMs:NOW+1000,now:()=>NOW,native:{async call(op,input){calls.push({op,input});if(op==='runner/load')return {run:{binding:f.target.binding,versions:f.target.versions,scopes:f.target.scopes},request,nextTurn};return {binding:f.target.binding,versions:f.target.versions,deadlineMs:NOW+1000,maxOutputBytes:1,sdkSessionKey:{projectKey:'-workspace-conversation',sessionId:nextTurn.checkpoint.sessionId},restoreReceipt:{}};}}});
 assert.equal(calls.length,2);assert.deepEqual(calls[1].input,{binding:f.target.binding,versions:f.target.versions,nextTurn,sourceRequest:nextTurn.sourceRequest,request,scopes:f.target.scopes});assert.equal(Object.hasOwn(calls[1].input,'continuation'),false);
});
