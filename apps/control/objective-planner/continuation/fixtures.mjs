// Synthetic Core receiving data only; no real creation receipt, job/run correlation or credential.
import {fixture as legacy,id,now,at,clone} from '../test/fixtures.mjs';
import {applicationRequestId,coreDigest,corePlannerRequestSha256,materializationSource,OPERATION} from './contract.mjs';
export {id,now,at,clone};
export function fixture(){
 const old=legacy(),work={canonical:old.canonical,actorUserId:id(40),consentId:id(41),controlVersion:1,generationJobId:old.work.generationJobId,generationRequestId:old.work.generationRequestId,strategyId:old.work.strategyId,strategyVersionId:old.work.strategyVersionId,objectiveReceiptSha256:coreDigest(old.receipt),snapshotDigest:old.work.snapshotDigest,applicationRequestId:applicationRequestId(old.canonical,id(40))};
 const current={...old.observation,requestId:work.applicationRequestId,source:materializationSource(work)};current.projects[0].output.id=work.canonical.canonicalProjectId;
 const ack={schemaVersion:1,operation:OPERATION,applicationRequestId:work.applicationRequestId,requestSha256:corePlannerRequestSha256(work),canonical:work.canonical,actorUserId:work.actorUserId,consentId:work.consentId,controlVersion:work.controlVersion,source:materializationSource(work),objectiveReceiptSha256:work.objectiveReceiptSha256,ownerReceiptId:id(42),ownerReceiptSha256:'f'.repeat(64),recordedAt:at,outcome:'applied_with_issues',projects:current.projects.map(p=>({groupKey:p.groupKey,projectId:p.output.id,createdVersion:p.output.createdVersion,originalNodeIds:p.originalNodeIds})),tasks:current.tasks.map(t=>({sourceNodeId:t.sourceNodeId,taskId:t.output.id,createdVersion:t.output.createdVersion,originalGroupKeys:t.originalGroupKeys}))};
 const envelope={schemaVersion:1,applicationRequestId:work.applicationRequestId,creation:{availability:'available',ack,sha256:coreDigest(ack)},current};
 const sourceBinding={tenantId:work.canonical.tenantId,actorId:'user_synthetic_clerk',conversationId:id(50),runId:id(51),attemptId:id(52),workerId:id(53),writerFence:1};
 return clone({work,receipt:old.receipt,envelope,sourceBinding});
}
