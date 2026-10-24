/** Explicit source -> approved output projection. Source preparation remains untouched. */
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {same,hash,fail} from './preparation.mjs';
export const lineageMarker='Meri separately approved output lineage: ';
export const selectedInvocationId=(source,decision)=>'sdk:'+hash({kind:'selected-document',sourcePins:source.sourcePins,proposalId:decision.proposalId,approvalDecisionSha256:hash(decision)});
export const selectedDeliveryId=(source,receipt,projection)=>'selected-output:'+hash({sourcePins:source.sourcePins,outputBinding:receipt.outputBinding,proposalId:receipt.approvalDecision.proposalId,approvalDecisionSha256:hash(receipt.approvalDecision),lineageSha256:projection.lineageSha256});
export function projectOutput(source,receipt){
 const lineage=data({recipe:'original-selected-docx/1',...source.sourcePins,outputBinding:receipt.outputBinding,proposalId:receipt.approvalDecision.proposalId,approvalDecisionSha256:hash(receipt.approvalDecision),
 sourceEvidenceSha256:hash(source.context.evidence),sourceDeadlineMs:source.context.deadlineMs,
 sourceProvenance:source.prepared.provenance,sourceEvidence:source.context.evidence});
 const {sourceProvenance:retainedProvenance,sourceEvidence:retainedEvidence,...visible}=lineage;
 const lineageSha256=hash(lineage),request=v.request({...source.request,content:{...source.request.content,blocks:[...source.request.content.blocks,
  {kind:'paragraph',style:'Heading 1',runs:[{text:'Separately approved output lineage'}]},
  {kind:'paragraph',style:'Normal',runs:[{text:lineageMarker+JSON.stringify(visible)}]}]}});
 const context=v.context({...source.context,binding:receipt.outputBinding,deadlineMs:receipt.deadlineMs,maxBytes:Math.min(source.context.maxBytes,receipt.maxBytes)});
 const guard=intent=>{const i=own(data(intent),['request','context','baseVersionId']);if(!same(i.request,request)||!same(i.context,context)||i.baseVersionId!==source.sourcePins.baseVersionId)fail('ACCESS_DENIED');};
 return {request,context,lineage,lineageSha256,guard,artifactRequestSha256:hash(request),outputContextSha256:hash(context)};
}
