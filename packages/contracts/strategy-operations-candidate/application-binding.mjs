/** Closed proposal identities only. Backend owns resolution/CAS; this module performs no claim or write. */
import {obj,text,uuid as legacyUuid,sha,nullable,choice,operations} from './shapes.mjs';
const uuid={...legacyUuid,pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'};
const positive={type:'integer',minimum:1,maximum:2147483647};
const expected={expectedExistingStrategyVersionId:nullable(uuid),expectedExistingStrategyHash:nullable(sha)};
const humanBaseline={humanBaselineStrategyVersionId:nullable(uuid),humanBaselineStrategyHash:nullable(sha)};
const common={version:{const:'strategy-application-target/1'},tenantId:text(128),clientId:uuid,operation:choice(operations),sourceSha256:sha,canonicalStrategyId:uuid,canonicalProjectId:nullable(uuid)};
export const applicationTargetShape={oneOf:[
 obj({...common,tenantId:uuid,kind:{const:'objective-strategy'},productOperation:{const:'objective.strategy.draft'},canonicalPlanId:uuid,bindingVersion:positive,epoch:{const:1},requestedIntentId:uuid,objectiveId:uuid,requestedObjectiveRevisionId:uuid,requestedObjectiveVersion:positive,snapshotHash:sha,mode:choice(['create','regenerate']),...expected,...humanBaseline}),
 obj({...common,kind:{const:'manual-strategy-draft'},productOperation:{const:'manual.strategy.draft'},manualRequestId:uuid,mode:choice(['create','regenerate']),...expected,...humanBaseline}),
 obj({...common,kind:{const:'strategy-edit'},productOperation:{const:'strategy.edit'},mode:{const:'edit'},...expected}),
 obj({...common,kind:{const:'strategy-step-document'},productOperation:{const:'strategy.step-document'},mode:{const:'generate-document'},...expected,nodeId:uuid,nodeSha256:sha,documentKind:choice(['workspace_draft','outreach_record'])}),
]};
// Names are provisional proposal namespaces, not Core columns or a concrete 0011 FK/token/issuer.
export const issuanceReferenceShape=obj({kind:{const:'opaque-meri-0011-issuance-reference'},identity:text(256)});
export const associationShape=obj({version:{const:'strategy-attempt-association/1'},associationId:uuid,requestSha256:sha,applicationTargetSha256:sha,
 origin:{oneOf:[obj({kind:{const:'core-objective-generation'},intentId:uuid,generationOperationId:uuid,generationAttemptId:uuid}),obj({kind:{const:'product-operation'},operation:choice(operations),sourceSha256:sha})]},
 backend:obj({claimId:uuid,attemptNumber:positive}),meri:obj({binding:{$ref:'urn:meri:contracts:0.1.0#/$defs/RunBinding'},issuance:issuanceReferenceShape})});
export function checkApplicationTarget(r,{hash,fail}){
 const t=r.applicationTarget;
 if(t.tenantId!==r.principal.tenantId||t.clientId!==r.principal.clientId||t.operation!==r.operation||t.sourceSha256!==hash(r.source))fail();
 if(r.operation==='strategy.draft'){
  if(r.source.kind==='objective'){
   const s=r.source;if(t.kind!=='objective-strategy'||t.canonicalProjectId===null||t.requestedIntentId!==s.requestedIntentId||t.objectiveId!==s.objectiveId||t.requestedObjectiveRevisionId!==s.objectiveRevisionId||t.requestedObjectiveVersion!==s.objectiveVersion||t.snapshotHash!==s.snapshotSha256)fail();
  }else if(t.kind!=='manual-strategy-draft'||t.manualRequestId!==r.source.manualRequestId)fail();
  if(t.mode==='create'?(t.expectedExistingStrategyVersionId!==null||t.expectedExistingStrategyHash!==null):(t.expectedExistingStrategyVersionId===null||t.expectedExistingStrategyHash===null))fail();
  if((t.humanBaselineStrategyVersionId===null)!==(t.humanBaselineStrategyHash===null)||t.mode==='create'&&t.humanBaselineStrategyVersionId!==null)fail();
 }else{
  if(t.kind!==(r.operation==='strategy.edit'?'strategy-edit':'strategy-step-document')||t.canonicalStrategyId!==r.basis.strategyId||t.expectedExistingStrategyVersionId!==r.basis.strategyVersionId||t.expectedExistingStrategyHash!==r.basis.strategySha256)fail();
  if(r.operation==='strategy.step-document'&&(t.nodeId!==r.input.node.id||t.nodeSha256!==hash(r.input.node)||t.documentKind!==r.input.kind))fail();
 }
}
export function checkAssociation(a,r,binding,{hash,fail}){
 if(a.requestSha256!==hash(r)||a.applicationTargetSha256!==hash(r.applicationTarget)||hash(a.meri.binding)!==hash(binding)||binding.tenantId!==r.principal.tenantId||binding.actorId!==r.principal.actorId)fail();
 const o=a.origin;if(r.applicationTarget.kind==='objective-strategy'){
  if(o.kind!=='core-objective-generation'||o.intentId!==r.applicationTarget.requestedIntentId)fail();
 }else if(o.kind!=='product-operation'||o.operation!==r.operation||o.sourceSha256!==hash(r.source))fail();
}
