/** Exact admitted Core hearing pages. No source cache, derived claims or cursor synthesis. */
import {hash as digest} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {captureHearingClientReference,captureHearingClientSelection} from '../../../gateway/sources/public-domain-hearings/request-context.mjs';
import {assertSourceShape,assertNativeSourceEvent} from '../../../../packages/contracts/conversation-sources/validate.mjs';
import {HEARING_SOURCE_SCHEMA,HEARING_SOURCE_EVENT} from '../../../../packages/contracts/conversation-sources/protocol.mjs';
import {hearingLocation} from '../../../../packages/contracts/conversation-sources/hearing-semantics.mjs';
import {safeSourceLocator} from '../../../../packages/contracts/conversation-sources/semantics.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {ProductError} from '../../product-access/errors.mjs';
const operation=Object.freeze({id:'search_committee_hearings',version:'0.2.0'}),contract=resolveOperationContract(operation),same=(a,b)=>hash(a)===hash(b);
const pageOf=record=>({...hearingLocation(record.payload),payloadSha256:digest('sha256',JSON.stringify(record.payload),'hex')});
const sourceOf=record=>({recordId:record.recordId,provenance:record.provenance});
const context=(request,tenantId)=>({tenantId,clientResolution:captureHearingClientSelection(request)});
export function hearingReferenceId(binding,deliveryId){const h=hash({schema:HEARING_SOURCE_SCHEMA,binding,deliveryId});return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export function projectHearingSource({request,response,scopes}){
 if(!same(request.operation,operation))return null;
 const reference=captureHearingClientReference(request.arguments);
 // The native result does not carry a name-to-client resolution. Do not guess it.
 if(reference!==null&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(reference))return null;
 const ctx=context(request.arguments,request.binding.tenantId),normalized=contract.normalizeInput(request.arguments,ctx),input=normalized.input;
 if(!input.recordsView||!input.hearingId||!input.recordId)return null;
 const envelope=data(own(JSON.parse(response.resultJson),['binding','subject','operation','argumentsSha256','result']));
 if(!same(envelope.binding,request.binding)||!same(envelope.operation,operation)||envelope.argumentsSha256!==normalized.argumentsSha256||
  !same(envelope.subject.scopes,scopes)||envelope.subject.tenantId!==request.binding.tenantId||envelope.subject.actorId!==request.binding.actorId||
  envelope.subject.policyRevision!==response.policyRevision||hash(envelope)!==response.resultSha256||hash(request)!==response.inputSha256)throw nativeReadFault('INVALID_RESULT');
 const result=contract.assertOutput(envelope.result,{request:request.arguments,...ctx});
 if(result.records.length!==1)return null;
 const selection=Object.fromEntries(['recordsView','hearingId','recordId','clientId','asOf','cursor'].map(k=>[k,input[k]])),record=result.records[0];
 const source=assertSourceShape('NativeHearingSource',{schemaVersion:HEARING_SOURCE_SCHEMA,deliveryId:request.deliveryId,operation,requestSha256:response.inputSha256,
  argumentsSha256:envelope.argumentsSha256,resultSha256:response.resultSha256,executionSha256:response.executionSha256,policyRevision:response.policyRevision,
  selection,source:sourceOf(record),page:pageOf(record),coverage:result.coverage});
 assertNativeSourceEvent({contractVersion:'0.1.0',eventId:hearingReferenceId(request.binding,request.deliveryId),binding:request.binding,sequence:1,createdAt:'1970-01-01T00:00:00.000Z',scopes,type:HEARING_SOURCE_EVENT,data:source});
 return source;
}
export function createHearingSourceCapture({store}){
 if(typeof store?.appendSource!=='function')throw nativeReadFault('CONFIGURATION');
 return async function capture({request,response,scopes,signal,check,onPublicationStart}){
  const source=projectHearingSource({request,response,scopes});if(source===null)return;
  const verify=()=>{signal?.throwIfAborted();check();};verify();
  try{onPublicationStart?.();await store.appendSource(request.binding,{eventId:hearingReferenceId(request.binding,request.deliveryId),type:HEARING_SOURCE_EVENT,data:source},verify,scopes);verify();}
  catch(error){if(['STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN'].includes(error?.code))throw nativeReadFault('SOURCE_PUBLICATION_UNKNOWN');
   if(error?.code==='EVENT_REPLAY_REFUSED')throw nativeReadFault('SOURCE_PUBLICATION_CONFLICT');throw error;}
 };
}
export function savedHearingRequest(event){return data(event.data.selection);}
export function releaseHearingPage(event,raw){
 const result=data(raw),request=savedHearingRequest(event),record=result.records?.[0];
 if(!record){const reason=result.coverage?.sources?.[0]?.stopReason;
  throw new ProductError(['record_content_changed_restart_read','record_superseded_explicit_historical_read_required','record_version_unavailable'].includes(reason)?'SOURCE_REFERENCE_STALE':'SOURCE_REFERENCE_UNAVAILABLE');}
 if(!same(sourceOf(record),event.data.source)||!same(pageOf(record),event.data.page))throw new ProductError('SOURCE_REFERENCE_STALE');
 try{contract.assertOutput(result,{request,...context(request,event.binding.tenantId)});}catch{throw new ProductError('SOURCE_REFERENCE_UNAVAILABLE');}
 if(!same(result.coverage,event.data.coverage))throw new ProductError('SOURCE_REFERENCE_STALE');
 const sourceLocator=safeSourceLocator(record.payload.sourceUrl);
 return {result,sourceLocator,linkStatus:sourceLocator===null?'unsafe':'available'};
}
