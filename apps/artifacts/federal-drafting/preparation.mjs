/** Private source preparation on the artifact service's existing current-authority, retention and byte-read path.
 * The source is a retained TXT envelope containing the exact parser snapshot, including its provenance and scopes.
 * The envelope is immutable; no live fetch, public DTO change, approval or write is performed by preparation. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {artifactValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {compileFederalDraft} from './engine.mjs';
const SHA=/^[a-f0-9]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fault=code=>{throw Object.assign(Error(code),{code});};

export async function prepareFederalDraft({read},raw,context,options={}){
 let input;try{input=data(own(raw,['versionId','expectedArtifactSha256','operations']));}catch{fault('DRAFT_SELECTION_INVALID');}
 if(!UUID.test(input.versionId)||!SHA.test(input.expectedArtifactSha256))fault('DRAFT_SELECTION_INVALID');
 const retained=await read(input.versionId,context,options);
 if(retained.version.object.sha256!==input.expectedArtifactSha256)fault('DRAFT_SOURCE_CHANGED');
 if(retained.request.operation!=='create_word'||retained.request.format!=='txt'||retained.inspection.currentBytesVerified!==true)fault('DRAFT_SOURCE_FORMAT');
 let source;try{source=JSON.parse(retained.request.content.text);}catch{fault('DRAFT_SOURCE_FORMAT');}
 const draft=compileFederalDraft(source,input.operations);
 const sourceArtifact=Object.freeze({versionId:retained.version.versionId,sha256:retained.version.object.sha256,specSha256:retained.specSha256});
 const revisionSha256=canonicalSha256({sourceArtifact,draftSha256:draft.revisionSha256});
 const prepared=Object.freeze({sourceArtifact,draft,revisionSha256,approval:'unapproved'});
 // Do not offer a reviewable package whose exact outputs cannot fit the existing artifact contract.
 try{federalDraftExportRequests(prepared,revisionSha256);}catch{fault('DRAFT_OUTPUT_UNEXPORTABLE');}
 return prepared;
}

/** Compile the three distinct outputs into the existing native artifact request contract. The expected hash is a
 * concurrency/content check, never authority or an approval. The ordinary approval/delivery owners must authorize
 * these exact requests, and retain/read each original outcome if publication is interrupted. */
export function federalDraftExportRequests(prepared,expectedRevisionSha256){
 const retained=data(own(prepared,['sourceArtifact','draft','revisionSha256','approval']));
 const recomputed=compileFederalDraft(retained.draft.source,retained.draft.operations);
 if(!SHA.test(expectedRevisionSha256)||retained.approval!=='unapproved'||canonicalSha256(recomputed)!==canonicalSha256(retained.draft)
  ||canonicalSha256({sourceArtifact:retained.sourceArtifact,draftSha256:recomputed.revisionSha256})!==expectedRevisionSha256
  ||retained.revisionSha256!==expectedRevisionSha256)fault('DRAFT_REVISION_CHANGED');
 const titles={operative:'Operative amendment',consolidated:'Consolidated text',redline:'Legal redline'};
 return Object.freeze(Object.fromEntries(Object.entries(titles).map(([kind,title])=>[kind,artifactValidators.request({
  operation:'create_word',format:'txt',title:`${title}: ${recomputed.source.documentId}`.slice(0,160),content:{text:recomputed.outputs[kind]},
 })])));
}
