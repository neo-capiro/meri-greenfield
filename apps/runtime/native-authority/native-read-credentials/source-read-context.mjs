/** Finite CONTROL contexts over current native facts. Selectors never create a client grant. */
import {publicDomainDatasetRegistry} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {captureHearingClientReference,captureHearingClientSelection} from '../../../gateway/sources/public-domain-hearings/request-context.mjs';
import {assertLegalSliceRequest,assertLegalSearchRequest,captureResearchClientReference,legalSliceContext} from '../../../gateway/sources/research-legal-legislation/request-context.mjs';
import {assertNewsSliceRequest,newsSliceContext} from '../../../gateway/sources/research-legal-news/request-context.mjs';
import {captureOutreachListClientSelection} from '../../../gateway/sources/outreach-query/request-context.mjs';
import {assertStoredStateRequest} from '../../../gateway/sources/state-status-votes/request-context.mjs';
import {captureBusinessDevelopmentResource} from '../../../gateway/sources/business-development/request-context.mjs';
import {captureFundingClientSelection,assertFundingClientSubject} from '../../../gateway/sources/funding-opportunities/request-context.mjs';
import {captureClientKnowledgeSearchSelection,assertClientKnowledgeSearchSubject} from '../../../gateway/sources/client-knowledge-search/request-context.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const refuse=code=>{throw nativeReadFault(code);};
const lineageGroups=new Set(['facility-representation','district-nexus','tracked-bills']);
const subjectSelection=({authorizationDecisionId,...rest})=>rest;

/** Decision receipts may rotate; no other lineage or context field may drift. */
export function sourceReadContextSelection(group,context){
 return lineageGroups.has(group)?{...context,subject:subjectSelection(context.subject)}:context;
}

export function assertNativeResultClientIds(clientIds){
 if(!Array.isArray(clientIds)||clientIds.length>1||clientIds.some(id=>typeof id!=='string'||!UUID.test(id)))refuse('ACCESS_DENIED');
}

export function assertNativeVisibleClients(native,clientIds){
 assertNativeResultClientIds(clientIds);
 if(!Object.hasOwn(native,'clientIds'))refuse('UNAVAILABLE');
 if(clientIds.some(id=>!native.clientIds.includes(id)))refuse('ACCESS_DENIED');
}

function clientSubject(proof,native){
 const s=proof.subject;
 if(s.kind!=='client'||s.entityType!=='client'||s.entityIds.length!==1||!UUID.test(s.entityIds[0]))refuse('ACCESS_DENIED');
 if(!s.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===s.entityIds[0]))refuse('ACCESS_DENIED');
 assertNativeVisibleClients(native,s.entityIds);return s.entityIds[0];
}

/** A name is selection data only. The current task client and native roster establish its upper bound first. */
export function assertSourceReadReferenceSubject(contract,proof,native){
 // Hearings already permit a personal task's explicit UUID under the actual current native client wall.
 // Resolving a name follows that same admission; it never turns the roster into a task grant.
 if(contract.binding.group==='public-domain-hearings'&&proof.subject.kind!=='client'&&proof.subject.entityType!=='client'){
  assertNativeVisibleClients(native,[]);return null;
 }
 return clientSubject(proof,native);
}

export function sourceReadClientReference(contract,request){
 let reference=null;
 if(contract.binding.group==='tracked-bills'){
  if(typeof request.clientId!=='string')refuse('INVALID_ARGUMENTS');
  reference=request.clientId.trim().slice(0,80);
  if(!reference.trim())refuse('INVALID_ARGUMENTS');
 }else if(contract.binding.group==='public-domain-hearings')reference=captureHearingClientReference(request);
 else if(contract.binding.group==='research-legal-legislation'&&contract.descriptor.operation.id==='search_legislative_research')reference=captureResearchClientReference(request);
 return reference!==null&&!UUID.test(reference.trim().toLowerCase())?reference:null;
}

function visibleSelector(native,subject,id){
 if((subject.kind==='client'||subject.entityType==='client')&&(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0].toLowerCase()!==id||!subject.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===id)))refuse('ACCESS_DENIED');
 assertNativeVisibleClients(native,[id]);
}

/** Reject unsupported source fallback before observing or disclosing any native credential. */
export function assertSourceReadRequest(contract,request,subject){
 if(contract.binding.group==='state-status-votes')assertStoredStateRequest(contract.descriptor.operation,request);
 if(contract.binding.group==='tracked-bills'||contract.binding.group==='public-domain-hearings')sourceReadClientReference(contract,request);
 if(contract.binding.group==='research-legal-legislation'){
  if(contract.descriptor.operation.id==='search_legislative_research')assertLegalSearchRequest(contract.descriptor.operation,request);
  else assertLegalSliceRequest(contract.descriptor.operation,request);
 }
 if(contract.binding.group==='research-legal-news')assertNewsSliceRequest(contract.descriptor.operation,request);
 if(contract.binding.group==='outreach-query')captureOutreachListClientSelection(request);
 if(contract.binding.group==='business-development')captureBusinessDevelopmentResource(contract.descriptor.operation,request,subject);
 if(contract.binding.group==='funding-opportunities')assertFundingClientSubject(subject,captureFundingClientSelection(contract.descriptor.operation,request));
 if(contract.binding.group==='client-knowledge-search'&&contract.descriptor.operation.id==='search_client_knowledge')assertClientKnowledgeSearchSubject(subject,captureClientKnowledgeSearchSelection(contract.descriptor.operation,request));
}

export function createSourceReadContext({contract,proof,native,defaultCongress,now,priorContext,clientReferenceObservation}){
 const group=contract.binding.group;
 if(group==='client-knowledge-search'&&contract.descriptor.operation.id==='search_client_knowledge'){
  const selected=captureClientKnowledgeSearchSelection(contract.descriptor.operation,proof.request);
  assertClientKnowledgeSearchSubject(proof.subject,selected);
  if(selected.clientId!==null)assertNativeVisibleClients(native,[selected.clientId]);
  if(priorContext)return {asOf:priorContext.asOf};
  const at=now();if(!Number.isSafeInteger(at)||at<0||at>8640000000000000)refuse('ACCESS_DENIED');
  return {asOf:new Date(at).toISOString()};
 }
 if(group==='funding-opportunities'){
  const selected=captureFundingClientSelection(contract.descriptor.operation,proof.request);
  assertFundingClientSubject(proof.subject,selected);assertNativeVisibleClients(native,[selected.clientId]);
  if(priorContext)return {asOf:priorContext.asOf};
  const at=now();if(!Number.isSafeInteger(at)||at<0||at>8640000000000000)refuse('ACCESS_DENIED');
  return {asOf:new Date(at).toISOString()};
 }
 if(['bill-text','federal-legislation'].includes(group))return {defaultCongress};
 if(group==='acquisition-personnel')return {actorRole:native.actorRole};
 if(group==='research-legal-legislation'||group==='research-legal-news'){
  const context=group==='research-legal-legislation'?legalSliceContext(contract.descriptor.operation,proof.request,clientReferenceObservation):newsSliceContext(contract.descriptor.operation,proof.request);
  if(context.clientResolution===null){if(proof.subject.kind==='client'||proof.subject.entityType==='client')refuse('ACCESS_DENIED');}
  else if(context.clientResolution.clientId!==clientSubject(proof,native))refuse('ACCESS_DENIED');
  return context;
 }
 if(group==='outreach-query'){
  const clientResolution=captureOutreachListClientSelection(proof.request);
  if(clientResolution.clientId!==clientSubject(proof,native))refuse('ACCESS_DENIED');
  return {clientResolution};
 }
 if(group==='public-domain-hearings'){
  const clientResolution=captureHearingClientSelection(proof.request,clientReferenceObservation),s=proof.subject;
  if(clientResolution===null){if(s.kind==='client'||s.entityType==='client')refuse('ACCESS_DENIED');}
  else visibleSelector(native,s,clientResolution.clientId);
  return {tenantId:proof.binding.tenantId,clientResolution};
 }
 if(group==='client-knowledge-search'){
  const input=contract.normalizeInput(proof.request,{}).input,selected=input.clientId,s=proof.subject;
  // Core returns the canonical malformed-selector note before loading any graph.
  if(selected!==null&&!UUID.test(selected.toLowerCase()))return {};
  if(selected===null){if(s.kind==='client'||s.entityType==='client')refuse('ACCESS_DENIED');}
  else{
   const id=selected.toLowerCase();
   visibleSelector(native,s,id);
  }
  if(input.seed?.startsWith('client:')&&UUID.test(input.seed.slice(7).toLowerCase()))visibleSelector(native,s,input.seed.slice(7).toLowerCase());
  return {};
 }
 if(group==='tracked-bills'){
  const selected=clientSubject(proof,native),clientReference=proof.request.clientId.trim().slice(0,80);
  if(UUID.test(clientReference.trim().toLowerCase())){if(clientReference.trim().toLowerCase()!==selected)refuse('ACCESS_DENIED');}
  else if(!clientReferenceObservation||clientReferenceObservation.reference!==clientReference||clientReferenceObservation.clientId!==selected)refuse('ACCESS_DENIED');
  const context={binding:proof.binding,subject:proof.subject,clientReference};
  contract.normalizeInput(proof.request,context);return context;
 }
 if(lineageGroups.has(group)){
  const selected=clientSubject(proof,native),context={binding:proof.binding,subject:proof.subject};
  const input=contract.normalizeInput(proof.request,context).input;
  // Facility's missing-selector branch is an explicit note, never an implicit client selection.
  if(input.clientId!==null&&input.clientId!==selected)refuse('ACCESS_DENIED');
  return context;
 }
 if(group==='federal-market'){
  const input=contract.normalizeInput(proof.request,{}).input,selected=input.clientId??null,s=proof.subject;
  if(selected!==null){
   const id=typeof selected==='string'?selected.toLowerCase():'';
   if(!UUID.test(id))refuse('ACCESS_DENIED');
   // Forecast selectors must be admitted too, although Core intentionally discards them from the global query.
   visibleSelector(native,s,id);
  }
  return {};
 }
 if(group==='public-domain-query'){
  const supportsAsOf=publicDomainDatasetRegistry.resolveDatasetSnapshot(proof.request.dataset).metadata.supportsAsOf;
  if(!supportsAsOf||Object.hasOwn(proof.request,'asOfDate'))return {defaultAsOf:null};
  if(priorContext)return {defaultAsOf:priorContext.defaultAsOf};
  const at=now();if(!Number.isSafeInteger(at)||at<0)refuse('ACCESS_DENIED');
  return {defaultAsOf:new Date(at).toISOString()};
 }
 return {};
}
