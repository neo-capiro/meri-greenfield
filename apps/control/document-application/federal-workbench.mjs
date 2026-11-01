/** Exact retained-source review through the existing artifact custody/delivery owners. */
import {createArtifactService} from '../../artifacts/service.mjs';
import {createPostgresArtifactService} from '../../artifacts/postgres-service.mjs';
import {federalDraftExportRequests} from '../../artifacts/federal-drafting/preparation.mjs';
import {federalSourceSelection,readFederalSourceEnvelope,federalSourceRequest} from '../../artifacts/federal-drafting/source-custody.mjs';
import {FEDERAL_REVIEW_SCHEMA,federalRevisionRecord,federalApprovalRecord,encodeFederalReview,decodeFederalReview,assertFederalApprovalBinds} from '../../artifacts/federal-drafting/review-record.mjs';
import {federalDraftDossier} from '../../artifacts/federal-drafting/dossier.mjs';
import {structuralDossierMaterial} from '../../../packages/contracts/federal-workbench/structural-dossier.mjs';
import {isSchemaUslm} from '../../../packages/contracts/federal-workbench/source-layout.mjs';
import {admitsDocumentFormat} from './format-admission.mjs';
import {federalValidatorForOperation} from '../../artifacts/federal-drafting/schema-qualification.mjs';
import {receiveFederalRequest} from '@capiro/meri-contracts/federal-workbench';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {fail} from './http.mjs';

const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
const sha=v=>typeof v==='string'&&/^[0-9a-f]{64}$/u.test(v);
const kinds=['draft','operative','consolidated','redline','docx','xml','pdf'];
const labels={draft:'Federal review',operative:'Operative amendment',consolidated:'Consolidated text',redline:'Legal redline',docx:'Federal review dossier',xml:'Consolidated XML',pdf:'Federal review dossier'};
const delivery=v=>typeof v==='string'&&/^[A-Za-z0-9_.:@/-]{1,255}$/u.test(v);
function selection(raw){
 const s=data(own(raw,['versionId','expectedArtifactSha256','operations']));
 if(!uuid(s.versionId)||!sha(s.expectedArtifactSha256)||!Array.isArray(s.operations)||!s.operations.length||s.operations.length>64)fail('INVALID_REQUEST');
 try{receiveFederalRequest('federal-prepare',new TextEncoder().encode(JSON.stringify({selection:s})));}catch{fail('INVALID_REQUEST');}
 return s;
}
export function federalWorkbenchInput(intent,raw){
 const q=data(raw);
 if(intent==='federal-import'){
  try{receiveFederalRequest('federal-import',new TextEncoder().encode(JSON.stringify(q)));}catch{fail('INVALID_REQUEST');}
  return {...q,selection:federalSourceSelection(q.selection)};
 }
 if(intent==='federal-load'){
  own(q,['versionId','expectedArtifactSha256']);if(!uuid(q.versionId)||!sha(q.expectedArtifactSha256))fail('INVALID_REQUEST');return q;
 }
 if(intent==='federal-approve'){
  own(q,['versionId','expectedArtifactSha256','revisionSha256','deliveryId']);
  if(!uuid(q.versionId)||!sha(q.expectedArtifactSha256)||!sha(q.revisionSha256)||!delivery(q.deliveryId))fail('INVALID_REQUEST');return q;
 }
 if(intent==='federal-history'){
  own(q,['versionId','limit','cursor']);
  if(!uuid(q.versionId)||!Number.isInteger(q.limit)||q.limit<1||q.limit>100||q.cursor!==null&&!sha(q.cursor))fail('INVALID_REQUEST');return q;
 }
 own(q,intent==='federal-prepare'?['selection']:['selection','revisionSha256','output','deliveryId','baseVersionId','baseRevisionSha256'],intent==='federal-prepare'?[]:['reviewVersionId']);
 const selected=selection(q.selection);
 if(intent==='federal-publish'){
  // Absent is the ordinary unapproved export: the deployed client sends no citation until its own release adds it.
  const reviewVersionId=q.reviewVersionId??null;
  if(!sha(q.revisionSha256)||!kinds.includes(q.output)||!delivery(q.deliveryId)||reviewVersionId!==null&&!uuid(reviewVersionId)||
   (q.baseVersionId===null?q.baseRevisionSha256!==null:!uuid(q.baseVersionId)||!sha(q.baseRevisionSha256)||q.output!=='draft')||
   q.output==='draft'&&reviewVersionId!==null)fail('INVALID_REQUEST');
  return {...q,selection:selected,reviewVersionId};
 }
 return {...q,selection:selected};
}
/** The complete retained record admitted under current custody; the compiled revision is recomputed from the
 * source and the approval is held to the store rule before anything is released. */
async function readRecord(reads,versionId,expectedSha256,context,life){
 const retained=await life.run(signal=>reads.download(versionId,context,{signal}));
 if(expectedSha256!==null&&retained.version.object.sha256!==expectedSha256)fail('DRAFT_REVIEW_CHANGED',409);
 let stored;try{stored=decodeFederalReview(retained.bytes.toString('utf8'));}catch{fail('DRAFT_REVIEW_INVALID',422);}
 return {retained,stored};
}
/** A saved JSON claim never establishes source trust: load reads the original
 * source again through current artifact authority and recompiles exact operations. */
async function loadReview(reads,prepare,versionId,expectedSha256,context,life){
 const {retained,stored}=await readRecord(reads,versionId,expectedSha256,context,life);
 let selected;try{selected=selection({versionId:stored.prepared.sourceArtifact.versionId,
  expectedArtifactSha256:stored.prepared.sourceArtifact.sha256,operations:stored.prepared.draft.operations});}catch{fail('DRAFT_REVIEW_INVALID',422);}
 const prepared=await prepare(selected);
 if(hash(stored.prepared)!==hash(prepared))fail('DRAFT_REVIEW_CHANGED',409);
 try{assertFederalApprovalBinds(stored.approval,prepared,retained.version.parentVersionId);}catch{fail('DRAFT_REVIEW_INVALID',422);}
 return {prepared,selection:selected,savedDraft:retained.version,approval:stored.approval};
}
/** History releases the retained claims of each immutable review version under current custody; it recompiles
 * nothing. `federal-load` is the path that re-establishes a revision from its source. */
async function reviewHistory(reads,call,context,life){
 const page=await life.run(signal=>reads.history({versionId:call.versionId,limit:call.limit,cursor:call.cursor},context,{signal}));
 own(page,['artifactId','anchorVersionId','headVersionId','versions','nextCursor']);
 const revisions=[];
 for(const version of page.versions){
  const {stored}=await readRecord(reads,version.versionId,version.object.sha256,context,life);
  try{assertFederalApprovalBinds(stored.approval,stored.prepared,version.parentVersionId);}catch{fail('DRAFT_REVIEW_INVALID',422);}
  revisions.push({version,revisionSha256:stored.prepared.revisionSha256,sourceArtifact:stored.prepared.sourceArtifact,approval:stored.approval});
 }
 return {schema:FEDERAL_REVIEW_SCHEMA,artifactId:page.artifactId,anchorVersionId:page.anchorVersionId,headVersionId:page.headVersionId,revisions,nextCursor:page.nextCursor};
}
export async function federalWorkbenchRoute({intent,call,config,current,life,state,releasePublication}){
 if(intent==='federal-publish'&&['xml','pdf'].includes(call.output)&&!admitsDocumentFormat(config.formatAdmission,call.output))fail('UNSUPPORTED_DOCUMENT_FORMAT',422);
 const federalValidator=federalValidatorForOperation(config.federalValidator);
 const context=config.options.context,reads=createArtifactService({...config.options,authorize:current.authorize});
 state.readStarted=true;
 // Compiler refusals are released as their exact reason: the public error keeps `code` as the reason and names the
 // refused operation when the compiler identified one. Stale official source and an absent reader keep their codes.
 const sourceFailure=error=>{
  const code=error?.code;
  if(code==='DRAFT_SOURCE_STALE')fail(code,409);
  if(code==='DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE')fail(code,503);
  if(code==='DRAFT_SOURCE_READER_UNAVAILABLE')fail('UNAVAILABLE',503);
  if(typeof code==='string'&&code.startsWith('DRAFT_'))fail(code,422,{operationId:typeof error.operationId==='string'?error.operationId:null});
  throw error;
 };
 const prepare=selected=>life.run(signal=>reads.prepareFederalDraft(selected,context,{signal,readNative:config.federalSource?.read,federalValidator})).catch(sourceFailure);
 const writer=authorize=>{const {ids,...options}=config.options;return createPostgresArtifactService({...options,authorize});};
 if(intent==='federal-import'){
  const read=()=>life.run(signal=>readFederalSourceEnvelope(config.federalSource?.read,call.selection,{signal,deadlineMs:context.deadlineMs,representation:call.representation,validationProfile:call.validationProfile,sourceProfile:call.sourceProfile,federalValidator})).catch(sourceFailure);
  const envelope=await read();
  let request;try{request=config.options.validators.request(federalSourceRequest(envelope));}catch{fail('DRAFT_OUTPUT_UNEXPORTABLE',422);}
  const recheck=async()=>{if(hash(await read())!==hash(envelope))fail('DRAFT_SOURCE_STALE',409);};
  const writes=writer(async input=>{await recheck();return current.authorize(input);});
  await current.fresh();state.writeStarted=true;
  const write={deliveryId:call.deliveryId,baseVersionId:null,request};
  const publication=releasePublication(await life.run(signal=>writes.execute(write,signal)),write);state.completed=true;
  await recheck();return {...envelope,publication};
 }
 if(intent==='federal-history'){
  const result=await reviewHistory(reads,call,context,life);state.completed=true;return result;
 }
 let prepared,selected=call.selection,savedDraft=null,approval=null;
 try{
  if(intent==='federal-load'||intent==='federal-approve')({prepared,selection:selected,savedDraft,approval}=await loadReview(reads,prepare,call.versionId,call.expectedArtifactSha256,context,life));
  else prepared=await prepare(selected);
 }catch(error){sourceFailure(error);}
 if(intent==='federal-prepare'||intent==='federal-load'){
  state.completed=true;return {schema:FEDERAL_REVIEW_SCHEMA,selection:selected,prepared,savedDraft,approval};
 }
 if(prepared.revisionSha256!==call.revisionSha256)fail('DRAFT_REVIEW_CHANGED',409);
 const recheckSource=async()=>{const fresh=await prepare(selected);
  if(fresh.revisionSha256!==prepared.revisionSha256)fail('DRAFT_REVIEW_CHANGED',409);};
 let request,baseVersionId,structuralMaterial;
 if(intent==='federal-approve'){
  // An approval is its own immutable child of the exact version it approves; approving an approval is refused.
  if(approval!==null)fail('DRAFT_REVIEW_ALREADY_APPROVED',409);
  const record=federalApprovalRecord(prepared,call.versionId);approval=record.approval;baseVersionId=call.versionId;
  request={operation:'create_word',format:'txt',title:`Federal approval [${prepared.revisionSha256}]: ${prepared.draft.source.documentId}`.slice(0,160),content:{text:encodeFederalReview(record)}};
 }else{
  if(call.baseVersionId!==null){
   const base=await loadReview(reads,prepare,call.baseVersionId,null,context,life);
   if(base.prepared.revisionSha256!==call.baseRevisionSha256)fail('DRAFT_REVIEW_CHANGED',409);
  }
  if(call.reviewVersionId!==null){
   // An export may cite the saved review it comes from; the export is approved only when that exact version carries
   // an approval for this exact revision. A revised review is never approved through its parent.
   const reviewed=await loadReview(reads,prepare,call.reviewVersionId,null,context,life);
   if(reviewed.prepared.revisionSha256!==call.revisionSha256)fail('DRAFT_REVIEW_CHANGED',409);
   approval=reviewed.approval;
  }
  baseVersionId=call.baseVersionId;
  if(call.output==='xml'){
   if(!isSchemaUslm(prepared.draft.source.parserVersion))fail('DRAFT_SCHEMA_PROFILE_REQUIRED',422);
   if(prepared.draft.resultKind==='source-text-removed')fail('DRAFT_XML_REMOVED',422);
  }
  const selectedRequest=call.output==='draft'?{operation:'create_word',format:'txt',title:labels.draft,content:{text:encodeFederalReview(federalRevisionRecord(prepared))}}
   :['docx','pdf'].includes(call.output)?(()=>{try{return federalDraftDossier(prepared,approval,call.output);}catch(error){sourceFailure(error);}})()
   :call.output==='xml'?{operation:'create_word',format:'xml',content:{text:prepared.draft.outputs.consolidated}}
   :federalDraftExportRequests(prepared,prepared.revisionSha256)[call.output];
  // Persist the complete reviewed revision in the canonical immutable request.
  // Even equal output bytes from different source/operation pins cannot reuse a delivery.
  request={...selectedRequest,title:`${labels[call.output]} [${prepared.revisionSha256}]: ${prepared.draft.source.documentId}`.slice(0,160)};
  if(['docx','pdf'].includes(call.output)&&prepared.draft.source.parserVersion==='federal-uslm-xml/3')structuralMaterial=structuralDossierMaterial(prepared,approval,call.output,request.title);
 }
 // Use the canonical request receiver before effect admission; large review
 // bundles refuse without a partial write or a second artifact format owner.
 let exact;try{exact=config.options.validators.request(request);}catch{fail('DRAFT_OUTPUT_UNEXPORTABLE',422);}
 if(structuralMaterial&&hash(structuralMaterial.request)!==hash(exact))fail('DRAFT_OUTPUT_UNEXPORTABLE',422);
 const writes=writer(async request=>{await recheckSource();return current.authorize(request);});
 await current.fresh();state.writeStarted=true;
 const write={deliveryId:call.deliveryId,baseVersionId,request:exact};
 const publication=releasePublication(await life.run(signal=>writes.execute(write,signal)),write);
 state.completed=true;
 await recheckSource();
 if(intent==='federal-approve')return {schema:FEDERAL_REVIEW_SCHEMA,selection:selected,prepared,savedDraft:publication.version,approval};
 const structuralReceipt=structuralMaterial?{structuralReceipt:{profile:'uslm-word/1',sourceSha256:prepared.draft.source.sha256,
  consolidatedSha256:prepared.draft.outputHashes.consolidated,revisionSha256:prepared.revisionSha256,specSha256:hash(exact),
  executionRequestSha256:publication.execution.requestSha256,mappingSha256:hash({mapping:structuralMaterial.mapping,omissions:structuralMaterial.omissions}),
  mapping:structuralMaterial.mapping,omissions:structuralMaterial.omissions}}:{};
 return {schema:FEDERAL_REVIEW_SCHEMA,sourceArtifact:prepared.sourceArtifact,revisionSha256:prepared.revisionSha256,
  output:call.output,review:call.output==='draft'?'unapproved':approval===null?'confirmed-for-export':'approved',approval:call.output==='draft'?null:approval,publication,...structuralReceipt};
}
