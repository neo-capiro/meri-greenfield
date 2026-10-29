/** Exact retained-source review through the existing artifact custody/delivery owners. */
import {createArtifactService} from '../../artifacts/service.mjs';
import {createPostgresArtifactService} from '../../artifacts/postgres-service.mjs';
import {federalDraftExportRequests} from '../../artifacts/federal-drafting/preparation.mjs';
import {FEDERAL_SOURCE_SCHEMA,federalSourceSelection,readFederalSourceEnvelope,federalSourceRequest} from '../../artifacts/federal-drafting/source-custody.mjs';
import {validateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {fail} from './http.mjs';
import {ARTIFACT_MIME_TYPES} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';

export const FEDERAL_REVIEW_SCHEMA='meri.federal-review.v1';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
const sha=v=>typeof v==='string'&&/^[0-9a-f]{64}$/u.test(v);
const kinds=['draft','operative','consolidated','redline'];
const delivery=v=>typeof v==='string'&&/^[A-Za-z0-9_.:@/-]{1,255}$/u.test(v);
function selection(raw){
 const s=data(own(raw,['versionId','expectedArtifactSha256','operations']));
 if(!uuid(s.versionId)||!sha(s.expectedArtifactSha256)||!Array.isArray(s.operations)||!s.operations.length||s.operations.length>64)fail('INVALID_REQUEST');
 for(const operation of s.operations)validateShape('FederalDraftOperation',operation);
 return s;
}
export function federalWorkbenchInput(intent,raw){
 const q=data(raw);
 if(intent==='federal-import'){
  own(q,['selection','deliveryId']);if(!delivery(q.deliveryId))fail('INVALID_REQUEST');
  return {...q,selection:federalSourceSelection(q.selection)};
 }
 if(intent==='federal-load'){
  own(q,['versionId','expectedArtifactSha256']);if(!uuid(q.versionId)||!sha(q.expectedArtifactSha256))fail('INVALID_REQUEST');return q;
 }
 own(q,intent==='federal-prepare'?['selection']:['selection','revisionSha256','output','deliveryId','baseVersionId','baseRevisionSha256']);
 const selected=selection(q.selection);
 if(intent==='federal-publish'){
  if(!sha(q.revisionSha256)||!kinds.includes(q.output)||!delivery(q.deliveryId)||
   (q.baseVersionId===null?q.baseRevisionSha256!==null:!uuid(q.baseVersionId)||!sha(q.baseRevisionSha256)||q.output!=='draft'))fail('INVALID_REQUEST');
 }
 return {...q,selection:selected};
}
const envelope=prepared=>({schema:FEDERAL_REVIEW_SCHEMA,prepared});
/** A saved JSON claim never establishes source trust: load reads the original
 * source again through current artifact authority and recompiles exact operations. */
async function loadReview(reads,prepare,versionId,expectedSha256,context,life){
 const retained=await life.run(signal=>reads.download(versionId,context,{signal}));
 if(retained.version.mimeType!==ARTIFACT_MIME_TYPES.txt||expectedSha256!==null&&retained.version.object.sha256!==expectedSha256)fail('DRAFT_REVIEW_CHANGED',409);
 let stored;try{stored=data(own(JSON.parse(retained.bytes.toString('utf8')),['schema','prepared']));}catch{fail('DRAFT_REVIEW_INVALID',422);}
 if(stored.schema!==FEDERAL_REVIEW_SCHEMA)fail('DRAFT_REVIEW_INVALID',422);
 let selected;try{selected=selection({versionId:stored.prepared.sourceArtifact.versionId,
  expectedArtifactSha256:stored.prepared.sourceArtifact.sha256,operations:stored.prepared.draft.operations});}catch{fail('DRAFT_REVIEW_INVALID',422);}
 const prepared=await prepare(selected);
 if(hash(envelope(prepared))!==hash(stored))fail('DRAFT_REVIEW_CHANGED',409);
 return {prepared,selection:selected,savedDraft:retained.version};
}
export async function federalWorkbenchRoute({intent,call,config,current,life,state,releasePublication}){
 const context=config.options.context,reads=createArtifactService({...config.options,authorize:current.authorize});
 state.readStarted=true;
 const sourceFailure=error=>{
  if(error?.code==='DRAFT_SOURCE_STALE')fail('DRAFT_SOURCE_STALE',409);
  if(error?.code==='DRAFT_SOURCE_READER_UNAVAILABLE')fail('UNAVAILABLE',503);
  if(typeof error?.code==='string'&&error.code.startsWith('DRAFT_'))fail('DRAFT_PREPARATION_REFUSED',422);throw error;
 };
 const prepare=selected=>life.run(signal=>reads.prepareFederalDraft(selected,context,{signal,readNative:config.federalSource?.read})).catch(sourceFailure);
 if(intent==='federal-import'){
  const read=()=>life.run(signal=>readFederalSourceEnvelope(config.federalSource?.read,call.selection,{signal,deadlineMs:context.deadlineMs})).catch(sourceFailure);
  const envelope=await read();
  let request;try{request=config.options.validators.request(federalSourceRequest(envelope));}catch{fail('DRAFT_OUTPUT_UNEXPORTABLE',422);}
  const recheck=async()=>{if(hash(await read())!==hash(envelope))fail('DRAFT_SOURCE_STALE',409);};
  const {ids,...options}=config.options,writes=createPostgresArtifactService({...options,authorize:async input=>{await recheck();return current.authorize(input);}});
  await current.fresh();state.writeStarted=true;
  const write={deliveryId:call.deliveryId,baseVersionId:null,request};
  const publication=releasePublication(await life.run(signal=>writes.execute(write,signal)),write);state.completed=true;
  await recheck();return {schema:FEDERAL_SOURCE_SCHEMA,selection:envelope.selection,source:envelope.source,publication};
 }
 let prepared,selected=call.selection,savedDraft=null;
 try{
  if(intent==='federal-load')({prepared,selection:selected,savedDraft}=await loadReview(reads,prepare,call.versionId,call.expectedArtifactSha256,context,life));
  else prepared=await prepare(selected);
 }catch(error){sourceFailure(error);}
 const exports=federalDraftExportRequests(prepared,prepared.revisionSha256);
 if(intent!=='federal-publish'){
  state.completed=true;return {schema:FEDERAL_REVIEW_SCHEMA,selection:selected,prepared,savedDraft};
 }
 if(prepared.revisionSha256!==call.revisionSha256)fail('DRAFT_REVIEW_CHANGED',409);
 if(call.baseVersionId!==null){
  const base=await loadReview(reads,prepare,call.baseVersionId,null,context,life);
  if(base.prepared.revisionSha256!==call.baseRevisionSha256)fail('DRAFT_REVIEW_CHANGED',409);
 }
 const selectedRequest=call.output==='draft'?{operation:'create_word',format:'txt',title:'Federal review',
  content:{text:JSON.stringify(envelope(prepared))}}:exports[call.output];
 const labels={draft:'Federal review',operative:'Operative amendment',consolidated:'Consolidated text',redline:'Legal redline'};
 // Persist the complete reviewed revision in the canonical immutable request.
 // Even equal output bytes from different source/operation pins cannot reuse a delivery.
 const request={...selectedRequest,title:`${labels[call.output]} [${prepared.revisionSha256}]: ${prepared.draft.source.documentId}`.slice(0,160)};
 // Use the canonical request receiver before effect admission; large review
 // bundles refuse without a partial write or a second artifact format owner.
 let exact;try{exact=config.options.validators.request(request);}catch{fail('DRAFT_OUTPUT_UNEXPORTABLE',422);}
 const recheckSource=async()=>{const fresh=await prepare(selected);
  if(fresh.revisionSha256!==prepared.revisionSha256)fail('DRAFT_REVIEW_CHANGED',409);};
 const {ids,...options}=config.options,writes=createPostgresArtifactService({...options,authorize:async request=>{
  await recheckSource();return current.authorize(request);
 }});
 await current.fresh();state.writeStarted=true;
 const write={deliveryId:call.deliveryId,baseVersionId:call.baseVersionId,request:exact};
 const publication=releasePublication(await life.run(signal=>writes.execute(write,signal)),write);
 state.completed=true;
 await recheckSource();
 return {schema:FEDERAL_REVIEW_SCHEMA,sourceArtifact:prepared.sourceArtifact,revisionSha256:prepared.revisionSha256,
  output:call.output,review:call.output==='draft'?'unapproved':'confirmed-for-export',publication};
}
