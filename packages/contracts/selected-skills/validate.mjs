/** Correlation only: the configured install/admission owners establish actual provenance. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../validate.mjs';
import {resolveOperationContract,artifactValidators as v} from '../retrieval-0.2/validate.mjs';
const fault=()=>{throw Object.assign(Error('SKILL_CURRENT_RECEIPT_REFUSED'),{code:'SKILL_CURRENT_RECEIPT_REFUSED'});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(x);
function pins(r,input,started,now,life){if(!same(r.binding,input.binding)||!same(r.skill,input.skill)||r.requestSha256!==input.requestSha256||r.selectionSha256!==input.selectionSha256||
 !Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now())fault();life.limitDeadline(r.expiresAtMs);}
export function assertSkillInstallation(raw,{input,selected,started,now,life,previous}) {
 const r=data(own(raw,['binding','skill','requestSha256','selectionSha256','baseCatalogSha256','installationId','executionCatalogSha256','operations','checkedAtMs','expiresAtMs']));pins(r,input,started,now,life);
 if(r.baseCatalogSha256!==selected.pin.catalogSha256||!uuid(r.installationId)||!digest(r.executionCatalogSha256)||!Array.isArray(r.operations)||r.operations.length>selected.manifest.allowedOperations.length)fault();
 const seen=new Set();for(const value of r.operations){const op=own(value,['operation','descriptorSha256','handlerSourceSha256','qualificationReceiptId']),key=canonicalSha256(op.operation);
  if(seen.has(key)||!selected.manifest.allowedOperations.some(ref=>same(ref,op.operation))||op.descriptorSha256!==canonicalSha256(resolveOperationContract(op.operation).descriptor)||!digest(op.handlerSourceSha256)||!uuid(op.qualificationReceiptId))fault();seen.add(key);}
 if(previous&&!same({...r,checkedAtMs:0,expiresAtMs:0},{...previous,checkedAtMs:0,expiresAtMs:0}))fault();return r;
}
export function assertSkillRun(raw,{input,selected,scopes,started,now,life,previous}) {
 const r=data(own(raw,['binding','skill','requestSha256','selectionSha256','manifestSha256','catalogSha256','budgets','allocationSha256','policyRevision','checkedAtMs','expiresAtMs']));pins(r,input,started,now,life);
 if(r.manifestSha256!==selected.pin.manifestSha256||r.catalogSha256!==selected.pin.catalogSha256||!same(r.budgets,selected.manifest.budgets)||!digest(r.allocationSha256)||scopes.some(s=>s.policyRevision!==r.policyRevision))fault();
 if(previous&&!same({...r,checkedAtMs:0,expiresAtMs:0},{...previous,checkedAtMs:0,expiresAtMs:0}))fault();return r;
}
/** Closed result correlation. Native authority remains with the configured output owner. */
export function assertSelectedOutput(raw,{binding,request,selection,inputSha256,prepared}) {
 const p=prepared,context=p.context,spec=p.request,base=p.baseVersionId??null;
 const expected={sourceBinding:binding,skill:request.skill,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection),inputSha256,preparationSha256:canonicalSha256(p),baseVersionId:base};
 const candidate=selectedOutputRecord(raw);
 if(candidate.state==='awaiting-output-approval'){
  const r=own(candidate,[...Object.keys(expected),'state','artifactRequestSha256','prepared']);
  if(Object.keys(expected).some(k=>!same(r[k],expected[k]))||r.artifactRequestSha256!==canonicalSha256(spec)||r.prepared!==p)fault();return r;
 }
 const r=data(own(candidate,[...Object.keys(expected),'state','outputBinding','sourceContextSha256','outputContextSha256','sourceArtifactRequestSha256','artifactRequestSha256','lineageSha256','lineage','projection','artifact']));
 if(r.state!=='delivered'||Object.keys(expected).some(k=>!same(r[k],expected[k]))||r.sourceContextSha256!==canonicalSha256(context)||r.sourceArtifactRequestSha256!==canonicalSha256(spec)||![r.outputContextSha256,r.artifactRequestSha256,r.lineageSha256].every(digest)||
 ['tenantId','actorId','conversationId'].some(k=>r.outputBinding?.[k]!==binding[k])||['runId','attemptId','workerId'].some(k=>r.outputBinding?.[k]===binding[k]))fault();
 const l=own(r.lineage,['recipe','sourceBinding','skill','selection','window','requestSha256','selectionSha256','inputSha256','readsSha256','compilerReadsSha256','preparationSha256','sourceArtifactRequestSha256','sourceContextSha256','baseVersionId','outputBinding','outputAllocationSha256','outputGrantId','approvalReceiptId','sourceEvidenceSha256','sourceDeadlineMs','outputDeadlineMs','sourceProvenance','sourceEvidence']);
 if(l.recipe!=='original-selected-docx/1'||canonicalSha256(l)!==r.lineageSha256||Object.keys(expected).some(k=>!same(l[k],expected[k]))||!same(l.outputBinding,r.outputBinding)||!same(l.selection,selection)||!same(l.window,selection.window)||!same(l.sourceProvenance,p.provenance)||!same(l.sourceEvidence,context.evidence)||l.sourceContextSha256!==r.sourceContextSha256||l.sourceArtifactRequestSha256!==r.sourceArtifactRequestSha256||l.sourceEvidenceSha256!==canonicalSha256(context.evidence)||l.sourceDeadlineMs!==context.deadlineMs||l.compilerReadsSha256!==p.provenance.readsSha256||![l.readsSha256,l.outputAllocationSha256].every(digest)||![l.outputGrantId,l.approvalReceiptId].every(uuid)||!Number.isSafeInteger(l.outputDeadlineMs))fault();
 const projection=own(r.projection,['request','context','baseVersionId']),projected=v.request(projection.request),outputContext=v.context(projection.context);
 const visible={...l};delete visible.sourceProvenance;delete visible.sourceEvidence;
 const added=[{kind:'paragraph',style:'Heading 1',runs:[{text:'Separately approved output lineage'}]},{kind:'paragraph',style:'Normal',runs:[{text:'Meri separately approved output lineage: '+JSON.stringify(visible)}]}];
 if(projection.baseVersionId!==base||canonicalSha256(projected)!==r.artifactRequestSha256||canonicalSha256(outputContext)!==r.outputContextSha256||
 !same(projected,{...spec,content:{...spec.content,blocks:[...spec.content.blocks,...added]}})||!same(outputContext,{...context,binding:r.outputBinding,deadlineMs:l.outputDeadlineMs,maxBytes:outputContext.maxBytes})||outputContext.maxBytes>context.maxBytes)fault();
 return r;
}

/** Before-persistence admission from the configured native original-run owner. */
export function assertSelectionAdmission(raw,{binding,request,scopes,selectedClientId,selected,started,now}) {
 const r=data(own(raw,['binding','skill','requestSha256','selectionSha256','scopes','selectedClientId','manifestSha256','catalogSha256','budgets','allocationSha256','policyRevision','installationId','executionCatalogSha256','checkedAtMs','expiresAtMs']));
 if(!same(r.binding,binding)||!same(r.skill,selected.pin)||r.requestSha256!==canonicalSha256(request)||!digest(r.selectionSha256)||!same(r.scopes,scopes)||r.selectedClientId!==selectedClientId||r.manifestSha256!==selected.pin.manifestSha256||r.catalogSha256!==selected.pin.catalogSha256||!same(r.budgets,selected.manifest.budgets)||!digest(r.allocationSha256)||scopes.some(s=>s.policyRevision!==r.policyRevision)||!uuid(r.installationId)||!digest(r.executionCatalogSha256)||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now())fault();
 return r;
}

export function selectedOutputPreparationSha256(raw){const r=selectedOutputRecord(raw);if(!digest(r.preparationSha256))fault();return r.preparationSha256;}

function selectedOutputRecord(raw){return own(raw,['state','preparationSha256'],['sourceBinding','skill','requestSha256','selectionSha256','inputSha256','baseVersionId','artifactRequestSha256','prepared','outputBinding','sourceContextSha256','outputContextSha256','sourceArtifactRequestSha256','lineageSha256','lineage','projection','artifact']);}
