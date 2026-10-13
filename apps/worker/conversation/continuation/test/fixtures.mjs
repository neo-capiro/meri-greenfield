import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
export const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
export const NOW=Date.parse('2026-10-13T15:45:00Z');
export function continuationFixture(mode='resume') {
 const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:10};
 const versions={imageDigest:`sha256:${'a'.repeat(64)}`,sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision:'synthetic-policy'}];
 const object={objectId:id(19),versionId:'synthetic-version',sha256:'c'.repeat(64),bytes:100,scopes};
 const workspace={contractVersion:'0.1.0',manifestId:id(6),binding,logicalCwd:'/workspace/conversation',entries:[],scopes,createdAt:new Date(NOW).toISOString()};
 const checkpoint={contractVersion:'0.1.0',checkpointId:id(7),parentCheckpointId:null,binding,sessionId:id(8),opaqueSession:object,workspace,
  workspaceSha256:canonicalSha256(workspace),versions,lastEventSequence:3,scopes,createdAt:new Date(NOW).toISOString(),durableReceiptId:id(9)};
 const sourceRequest={requestId:id(10),prompt:'Original request',window:null,windowRequest:null,skill:selectSkill('quick_skill.mail_history','1.0.0').pin};
 const targetBinding={...binding,conversationId:mode==='resume'?binding.conversationId:id(11),runId:id(12),attemptId:id(13),workerId:id(14),writerFence:mode==='resume'?11:1};
 const target={binding:targetBinding,versions,scopes,sourceRequest,request:{...sourceRequest,requestId:id(15),prompt:'Continue the original request'}};
 const contextSha256=canonicalSha256({window:sourceRequest.window,skill:sourceRequest.skill,scopes});
 const continuation={mode,controlId:id(16),checkpoint,checkpointSha256:canonicalSha256(checkpoint),sourceRequestSha256:canonicalSha256(sourceRequest),
  contextSha256,resumeSessionAt:id(17),targetSessionId:mode==='resume'?null:id(18)};
 return structuredClone({continuation,target,binding,contextSha256});
}
